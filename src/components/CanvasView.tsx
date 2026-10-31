import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Point,
  PolygonShape,
  ScaleConfig,
  AppMode,
  DragState,
  VertexDeletePrompt,
  ActiveLineDrag,
  EditEdgeTarget,
} from '../types/cad';
import {
  renderCanvas,
  screenToWorld,
  worldToScreen,
} from './CanvasRenderer';
import {
  calculateDistance,
  formatLength,
  findClosestVertex,
  findClosestEdge,
  isPointInsidePolygon,
  snapToGrid,
  calculateBearingDegrees,
  calculateCornerAngle,
  formatDegrees,
} from '../utils/geoMath';
import { Trash2, X } from 'lucide-react';

interface CanvasViewProps {
  polygons: PolygonShape[];
  activePolygonId: string | null;
  mode: AppMode;
  scaleConfig: ScaleConfig;
  snapToGridEnabled: boolean;
  onUpdatePolygons: (updater: (prev: PolygonShape[]) => PolygonShape[]) => void;
  onSelectPolygon: (id: string) => void;
  onShapeClosed?: (id: string) => void;
  onEditEdgeRequest?: (target: EditEdgeTarget) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  polygons,
  activePolygonId,
  mode,
  scaleConfig,
  snapToGridEnabled,
  onUpdatePolygons,
  onSelectPolygon,
  onShapeClosed,
  onEditEdgeRequest,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport transformation: pan and zoom
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);

  // Real-time pointer positions (world coordinates)
  const [pointerWorld, setPointerWorld] = useState<Point | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<{
    polygonId: string;
    index: number;
  } | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{
    polygonId: string;
    edgeIndex: number;
    insertPoint: Point;
  } | null>(null);
  const [hoveredCentroidId, setHoveredCentroidId] = useState<string | null>(null);

  // In-canvas vertex delete prompt
  const [deletePrompt, setDeletePrompt] = useState<VertexDeletePrompt | null>(null);

  // Active line drag measurement state (real-time meter update while dragging)
  const [activeDragLine, setActiveDragLine] = useState<ActiveLineDrag | null>(null);

  // Hovered edge label for click-to-edit indicator
  const [hoveredEdgeLabel, setHoveredEdgeLabel] = useState<{
    polygonId: string;
    edgeIndex: number;
  } | null>(null);

  // Draw interaction tracking: press-and-drag vs quick tap
  const drawInteractionRef = useRef<{
    isDown: boolean;
    startScreen: Point;
    startWorld: Point;
    originPoint: Point;
    targetPoint: Point;
    isDragging: boolean;
    targetPolyId: string;
  }>({
    isDown: false,
    startScreen: { x: 0, y: 0 },
    startWorld: { x: 0, y: 0 },
    originPoint: { x: 0, y: 0 },
    targetPoint: { x: 0, y: 0 },
    isDragging: false,
    targetPolyId: '',
  });

  // Touch tracking for pinch-to-zoom
  const activeTouchesRef = useRef<Map<number, Point>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);
  const initialPinchCenterRef = useRef<Point | null>(null);

  // Dragging state in edit mode
  const dragStateRef = useRef<DragState>({ type: 'none' });

  // Long press timer for vertex deletion in edit mode
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

  // Center initial view on screen load and track resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateCenter = () => {
      const rect = el.getBoundingClientRect();
      setPan((prev) => {
        // Only set default center if pan was not moved
        if (prev.x === 0 && prev.y === 0) {
          return { x: rect.width / 2, y: rect.height / 2 };
        }
        return prev;
      });
    };

    updateCenter();
    const observer = new ResizeObserver(updateCenter);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute snapped pointer if snap is enabled
  const getProcessedPoint = useCallback(
    (worldPoint: Point): Point => {
      if (snapToGridEnabled) {
        return snapToGrid(worldPoint, scaleConfig.gridPixelSize);
      }
      return worldPoint;
    },
    [snapToGridEnabled, scaleConfig.gridPixelSize]
  );

  // Helper to find if screen coordinate clicks on an edge label
  const findClickedEdgeLabel = useCallback(
    (screenPos: Point): EditEdgeTarget | null => {
      const metersPerPixel = scaleConfig.metersPerGrid / scaleConfig.gridPixelSize;
      for (const poly of polygons) {
        const pts = poly.points;
        if (pts.length < 2) continue;
        const edgeCount = poly.isClosed && pts.length >= 3 ? pts.length : pts.length - 1;
        for (let i = 0; i < edgeCount; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % pts.length];
          const s1 = worldToScreen(p1, pan, zoom);
          const s2 = worldToScreen(p2, pan, zoom);
          const midX = (s1.x + s2.x) / 2;
          const midY = (s1.y + s2.y) / 2;
          const dx = s2.x - s1.x;
          const dy = s2.y - s1.y;
          const len = Math.hypot(dx, dy);
          if (len === 0) continue;
          const nx = -dy / len;
          const ny = dx / len;
          const labelX = midX + nx * 15;
          const labelY = midY + ny * 15;
          if (Math.hypot(screenPos.x - labelX, screenPos.y - labelY) <= 26) {
            const distM = calculateDistance(p1, p2, metersPerPixel);
            return {
              polygonId: poly.id,
              edgeIndex: i,
              currentLengthMeters: distM,
              p1,
              p2,
            };
          }
        }
      }
      return null;
    },
    [polygons, pan, zoom, scaleConfig]
  );

  // Render loop whenever state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const snappedPointer = pointerWorld ? getProcessedPoint(pointerWorld) : null;

    renderCanvas({
      ctx,
      width,
      height,
      pan,
      zoom,
      polygons,
      activePolygonId,
      mode,
      scaleConfig,
      snapToGrid: snapToGridEnabled,
      pointerPos: pointerWorld,
      snappedPointerPos: snappedPointer,
      hoveredVertex,
      hoveredEdge,
      hoveredEdgeLabel,
      hoveredCentroidPolygonId: hoveredCentroidId,
      deletePrompt,
      activeDragLine,
    });

    ctx.restore();
  }, [
    pan,
    zoom,
    polygons,
    activePolygonId,
    mode,
    scaleConfig,
    snapToGridEnabled,
    pointerWorld,
    hoveredVertex,
    hoveredEdge,
    hoveredEdgeLabel,
    hoveredCentroidId,
    deletePrompt,
    activeDragLine,
    getProcessedPoint,
  ]);

  // Pointer position helper
  const getScreenPos = (e: { clientX: number; clientY: number }): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Close active polygon helper
  const closeActivePolygon = useCallback(
    (polyId: string) => {
      onUpdatePolygons((prev) =>
        prev.map((p) => {
          if (p.id === polyId && p.points.length >= 3) {
            return { ...p, isClosed: true };
          }
          return p;
        })
      );
      if (onShapeClosed) onShapeClosed(polyId);
    },
    [onUpdatePolygons, onShapeClosed]
  );

  // Cancel long press
  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const screenPos = getScreenPos(e);
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.max(0.2, Math.min(8.0, zoom * zoomFactor));

    // Zoom centered on cursor
    const worldBefore = screenToWorld(screenPos, pan, zoom);
    const newPan = {
      x: screenPos.x - worldBefore.x * newZoom,
      y: screenPos.y - worldBefore.y * newZoom,
    };

    setZoom(newZoom);
    setPan(newPan);
  };

  // Handle pointer down
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Track active touches
    activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch pinch zoom initiation
    if (activeTouchesRef.current.size === 2) {
      clearLongPress();
      dragStateRef.current = { type: 'none' };
      drawInteractionRef.current.isDown = false;
      setActiveDragLine(null);

      const touches = Array.from(activeTouchesRef.current.values());
      const dist = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
      initialPinchDistRef.current = dist;
      initialZoomRef.current = zoom;
      initialPinchCenterRef.current = {
        x: (touches[0].x + touches[1].x) / 2,
        y: (touches[0].y + touches[1].y) / 2,
      };
      return;
    }

    if (activeTouchesRef.current.size > 1) return;

    const screenPos = getScreenPos(e);
    const worldPos = screenToWorld(screenPos, pan, zoom);
    longPressTriggeredRef.current = false;

    // Check if clicked directly on an edge length label to edit typing numbers
    const clickedLabel = findClickedEdgeLabel(screenPos);
    if (clickedLabel && onEditEdgeRequest) {
      onSelectPolygon(clickedLabel.polygonId);
      onEditEdgeRequest(clickedLabel);
      return;
    }

    // Dismiss delete prompt if open
    if (deletePrompt) {
      setDeletePrompt(null);
    }

    // Vertex hit test
    const vertexHitRadius = 20 / zoom;
    let foundVertex: { polyId: string; index: number } | null = null;

    const activePoly = polygons.find((p) => p.id === activePolygonId);
    if (activePoly) {
      const vIdx = findClosestVertex(worldPos, activePoly.points, vertexHitRadius);
      if (vIdx !== null) {
        foundVertex = { polyId: activePoly.id, index: vIdx };
      }
    }

    if (!foundVertex) {
      for (const poly of polygons) {
        if (poly.id === activePolygonId) continue;
        const vIdx = findClosestVertex(worldPos, poly.points, vertexHitRadius);
        if (vIdx !== null) {
          foundVertex = { polyId: poly.id, index: vIdx };
          onSelectPolygon(poly.id);
          break;
        }
      }
    }

    // DRAW MODE (TARIK GARIS) INTERACTION
    if (mode === 'draw') {
      let targetPoly = activePoly;

      // If clicked on vertex 0 and points >= 3 -> Close shape immediately
      if (
        targetPoly &&
        !targetPoly.isClosed &&
        foundVertex &&
        foundVertex.polyId === targetPoly.id &&
        foundVertex.index === 0 &&
        targetPoly.points.length >= 3
      ) {
        closeActivePolygon(targetPoly.id);
        return;
      }

      // If no active polygon or active is already closed, create a fresh polygon
      let targetId = targetPoly?.id;
      if (!targetPoly || targetPoly.isClosed) {
        const newId = `poly_${Date.now()}`;
        const newShape: PolygonShape = {
          id: newId,
          name: `Bidang ${polygons.length + 1}`,
          color: '#06b6d4',
          points: [],
          isClosed: false,
          createdAt: Date.now(),
        };
        onUpdatePolygons((prev) => [...prev, newShape]);
        onSelectPolygon(newId);
        targetPoly = newShape;
        targetId = newId;
      }

      const snappedStart = getProcessedPoint(worldPos);

      // Origin of the rubber-band:
      // If polygon has points, origin is the last placed point
      // If polygon has 0 points, origin is the touch down position
      const originPoint =
        targetPoly.points.length > 0
          ? targetPoly.points[targetPoly.points.length - 1]
          : snappedStart;

      drawInteractionRef.current = {
        isDown: true,
        startScreen: screenPos,
        startWorld: snappedStart,
        originPoint,
        targetPoint: snappedStart,
        isDragging: false,
        targetPolyId: targetId!,
      };

      return;
    }

    // EDIT MODE INTERACTION
    if (mode === 'edit') {
      // 1. Hit on a vertex -> Drag vertex or trigger long-press delete
      if (foundVertex) {
        const targetPoly = polygons.find((p) => p.id === foundVertex!.polyId);
        if (targetPoly) {
          dragStateRef.current = {
            type: 'vertex',
            polygonId: foundVertex.polyId,
            vertexIndex: foundVertex.index,
            startPointer: worldPos,
            lastPointer: worldPos,
          };

          clearLongPress();
          const targetVertexIndex = foundVertex.index;
          const targetPolyId = foundVertex.polyId;
          const targetScreenPos = worldToScreen(
            targetPoly.points[targetVertexIndex],
            pan,
            zoom
          );

          longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            dragStateRef.current = { type: 'none' };
            setDeletePrompt({
              polygonId: targetPolyId,
              vertexIndex: targetVertexIndex,
              screenPos: targetScreenPos,
            });
          }, 520);

          return;
        }
      }

      // 2. Check edge click to insert vertex
      const edgeHitDist = 14 / zoom;
      for (const poly of polygons) {
        const edgeHit = findClosestEdge(worldPos, poly.points, edgeHitDist);
        if (edgeHit) {
          onSelectPolygon(poly.id);
          const snapped = getProcessedPoint(edgeHit.insertPoint);
          onUpdatePolygons((prev) =>
            prev.map((p) => {
              if (p.id === poly.id) {
                const nextPts = [...p.points];
                nextPts.splice(edgeHit.edgeIndex + 1, 0, snapped);
                return { ...p, points: nextPts };
              }
              return p;
            })
          );
          return;
        }
      }

      // 3. Check inside polygon body to select and drag whole polygon
      for (const poly of polygons) {
        if (poly.isClosed && isPointInsidePolygon(worldPos, poly.points)) {
          onSelectPolygon(poly.id);
          dragStateRef.current = {
            type: 'polygon',
            polygonId: poly.id,
            startPointer: worldPos,
            lastPointer: worldPos,
            polygonStartPoints: poly.points.map((pt) => ({ ...pt })),
          };
          return;
        }
      }

      // 4. Otherwise pan the canvas
      dragStateRef.current = {
        type: 'pan',
        startPointer: screenPos,
        lastPointer: screenPos,
      };
    }
  };

  // Handle pointer move
  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const screenPos = getScreenPos(e);
    const worldPos = screenToWorld(screenPos, pan, zoom);
    setPointerWorld(worldPos);

    if (activeTouchesRef.current.has(e.pointerId)) {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Multi-touch Pinch Zoom handling
    if (activeTouchesRef.current.size === 2 && initialPinchDistRef.current !== null) {
      clearLongPress();
      const touches = Array.from(activeTouchesRef.current.values());
      const currentDist = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
      const scaleDelta = currentDist / initialPinchDistRef.current;
      const targetZoom = Math.max(0.2, Math.min(8.0, initialZoomRef.current * scaleDelta));

      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentCenter = {
          x: (touches[0].x + touches[1].x) / 2 - rect.left,
          y: (touches[0].y + touches[1].y) / 2 - rect.top,
        };

        const worldCenter = screenToWorld(currentCenter, pan, zoom);

        setZoom(targetZoom);
        setPan({
          x: currentCenter.x - worldCenter.x * targetZoom,
          y: currentCenter.y - worldCenter.y * targetZoom,
        });
      }
      return;
    }

    // DRAW MODE INTERACTION: KLIK & TAHAN SAMBIL GESER
    if (mode === 'draw' && drawInteractionRef.current.isDown) {
      const dState = drawInteractionRef.current;
      const screenDelta = Math.hypot(
        screenPos.x - dState.startScreen.x,
        screenPos.y - dState.startScreen.y
      );

      // If user drags finger more than 6px, activate drag-line mode
      if (screenDelta > 6) {
        dState.isDragging = true;
        const targetPoint = getProcessedPoint(worldPos);
        dState.targetPoint = targetPoint;

        const metersPerPixel = scaleConfig.metersPerGrid / scaleConfig.gridPixelSize;
        const distM = calculateDistance(dState.originPoint, targetPoint, metersPerPixel);

        const targetPoly = polygons.find((p) => p.id === dState.targetPolyId);
        const prevPt =
          targetPoly && targetPoly.points.length >= 2
            ? targetPoly.points[targetPoly.points.length - 2]
            : null;
        const bearingDeg = calculateBearingDegrees(dState.originPoint, targetPoint);
        const cornerDeg = prevPt
          ? calculateCornerAngle(prevPt, dState.originPoint, targetPoint)
          : undefined;

        setActiveDragLine({
          originPoint: dState.originPoint,
          targetPoint,
          distanceMeters: distM,
          bearingDegrees: bearingDeg,
          cornerAngleDegrees: cornerDeg,
        });
      }
      return;
    }

    // EDIT MODE DRAGGING
    const drag = dragStateRef.current;

    if (drag.type === 'vertex' && drag.startPointer) {
      const dist = Math.hypot(worldPos.x - drag.startPointer.x, worldPos.y - drag.startPointer.y);
      if (dist > 5 / zoom) {
        clearLongPress();
      }
    }

    // 1. Dragging Vertex
    if (drag.type === 'vertex' && drag.polygonId !== undefined && drag.vertexIndex !== undefined) {
      if (longPressTriggeredRef.current) return;
      const targetPos = getProcessedPoint(worldPos);

      onUpdatePolygons((prev) =>
        prev.map((p) => {
          if (p.id === drag.polygonId) {
            const nextPts = [...p.points];
            nextPts[drag.vertexIndex!] = targetPos;
            return { ...p, points: nextPts };
          }
          return p;
        })
      );
      return;
    }

    // 2. Dragging Entire Polygon
    if (
      drag.type === 'polygon' &&
      drag.polygonId !== undefined &&
      drag.startPointer &&
      drag.polygonStartPoints
    ) {
      const dx = worldPos.x - drag.startPointer.x;
      const dy = worldPos.y - drag.startPointer.y;

      onUpdatePolygons((prev) =>
        prev.map((p) => {
          if (p.id === drag.polygonId) {
            const nextPts = drag.polygonStartPoints!.map((pt) => {
              const shifted = { x: pt.x + dx, y: pt.y + dy };
              return snapToGridEnabled
                ? snapToGrid(shifted, scaleConfig.gridPixelSize)
                : shifted;
            });
            return { ...p, points: nextPts };
          }
          return p;
        })
      );
      return;
    }

    // 3. Panning Canvas
    if (drag.type === 'pan' && drag.lastPointer) {
      const dx = screenPos.x - drag.lastPointer.x;
      const dy = screenPos.y - drag.lastPointer.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      dragStateRef.current.lastPointer = screenPos;
      return;
    }

    // Edge label hover detection (works in both draw and edit mode)
    const hoveredLbl = findClickedEdgeLabel(screenPos);
    setHoveredEdgeLabel(
      hoveredLbl ? { polygonId: hoveredLbl.polygonId, edgeIndex: hoveredLbl.edgeIndex } : null
    );

    // Hover detection for vertices and edges (when not dragging)
    if (mode === 'edit') {
      const vertexHitRadius = 16 / zoom;
      let hoveredV: { polygonId: string; index: number } | null = null;

      for (const poly of polygons) {
        const vIdx = findClosestVertex(worldPos, poly.points, vertexHitRadius);
        if (vIdx !== null) {
          hoveredV = { polygonId: poly.id, index: vIdx };
          break;
        }
      }
      setHoveredVertex(hoveredV);

      if (!hoveredV) {
        const edgeHitDist = 12 / zoom;
        let edgeFound = false;
        for (const poly of polygons) {
          const edgeHit = findClosestEdge(worldPos, poly.points, edgeHitDist);
          if (edgeHit) {
            setHoveredEdge({
              polygonId: poly.id,
              edgeIndex: edgeHit.edgeIndex,
              insertPoint: edgeHit.insertPoint,
            });
            edgeFound = true;
            break;
          }
        }
        if (!edgeFound) setHoveredEdge(null);
      } else {
        setHoveredEdge(null);
      }
    }
  };

  // Handle pointer up
  const handlePointerUp = (e: React.PointerEvent) => {
    clearLongPress();
    activeTouchesRef.current.delete(e.pointerId);

    if (activeTouchesRef.current.size === 0) {
      initialPinchDistRef.current = null;
    }

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if capture already lost
    }

    // DRAW MODE UP HANDLER:
    // If was dragging -> place point at dragged target
    // If was simple tap -> place point at tap position
    if (mode === 'draw' && drawInteractionRef.current.isDown) {
      const { isDragging, originPoint, startWorld, targetPolyId } = drawInteractionRef.current;
      drawInteractionRef.current.isDown = false;
      setActiveDragLine(null);

      const screenPos = getScreenPos(e);
      const worldPos = screenToWorld(screenPos, pan, zoom);
      const targetPoint = getProcessedPoint(worldPos);

      const targetPoly = polygons.find((p) => p.id === targetPolyId);

      if (isDragging) {
        // TAHAN & GESER: commit the dragged segment
        if (targetPoly) {
          // If dragged near first point and points >= 2 -> Close polygon!
          if (targetPoly.points.length >= 2) {
            const firstPt = targetPoly.points[0];
            const distToFirst = Math.hypot(targetPoint.x - firstPt.x, targetPoint.y - firstPt.y);
            if (distToFirst < 25 / zoom) {
              closeActivePolygon(targetPoly.id);
              dragStateRef.current = { type: 'none' };
              return;
            }
          }

          if (targetPoly.points.length === 0) {
            // Created both point 1 and point 2 in one smooth gesture
            onUpdatePolygons((prev) =>
              prev.map((p) => {
                if (p.id === targetPolyId) {
                  return { ...p, points: [originPoint, targetPoint] };
                }
                return p;
              })
            );
          } else {
            // Append targetPoint
            onUpdatePolygons((prev) =>
              prev.map((p) => {
                if (p.id === targetPolyId) {
                  return { ...p, points: [...p.points, targetPoint] };
                }
                return p;
              })
            );
          }
        }
      } else {
        // KLIK BIASA: "Jika hanya klik biasa maka akan menambahkan titik saja"
        if (targetPoly) {
          // If clicked on vertex 0 and points >= 3 -> Close polygon!
          if (targetPoly.points.length >= 3) {
            const firstPt = targetPoly.points[0];
            const distToFirst = Math.hypot(startWorld.x - firstPt.x, startWorld.y - firstPt.y);
            if (distToFirst < 24 / zoom) {
              closeActivePolygon(targetPoly.id);
              dragStateRef.current = { type: 'none' };
              return;
            }
          }

          onUpdatePolygons((prev) =>
            prev.map((p) => {
              if (p.id === targetPolyId) {
                return { ...p, points: [...p.points, startWorld] };
              }
              return p;
            })
          );
        }
      }
    }

    dragStateRef.current = { type: 'none' };
  };

  // Double click / tap to close polygon
  const handleDoubleClick = () => {
    if (mode === 'draw' && activePolygonId) {
      const activePoly = polygons.find((p) => p.id === activePolygonId);
      if (activePoly && !activePoly.isClosed && activePoly.points.length >= 3) {
        closeActivePolygon(activePoly.id);
      }
    }
  };

  // Vertex delete actions
  const handleDeleteVertex = () => {
    if (!deletePrompt) return;
    const { polygonId, vertexIndex } = deletePrompt;

    onUpdatePolygons((prev) =>
      prev
        .map((p) => {
          if (p.id === polygonId) {
            const nextPts = p.points.filter((_, idx) => idx !== vertexIndex);
            const stillClosed = p.isClosed && nextPts.length >= 3;
            return {
              ...p,
              points: nextPts,
              isClosed: stillClosed,
            };
          }
          return p;
        })
        .filter((p) => p.points.length > 0)
    );

    setDeletePrompt(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none bg-slate-900"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />

      {/* Empty State Guide Overlay (Clean, Crisp & Responsive) */}
      {polygons.reduce((acc, p) => acc + p.points.length, 0) === 0 && !activeDragLine && mode === 'draw' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none p-4 max-w-xs sm:max-w-sm w-[88%] bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-9 h-9 mx-auto mb-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <span className="text-base">📐</span>
          </div>
          <h3 className="text-sm font-bold text-slate-100">Tarik Garis Lahan</h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Ketuk untuk taruh titik, atau <strong className="text-amber-300">tahan & geser jari</strong> untuk melihat ukuran meter secara real-time.
          </p>
        </div>
      )}

      {/* Floating Measurement HUD during Drag (Distance & Degrees) */}
      {activeDragLine && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-slate-900/95 border border-amber-400/80 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-semibold text-slate-300">Tarik Garis:</span>
          <span className="text-sm font-mono font-bold text-amber-300">
            {formatLength(activeDragLine.distanceMeters).primary} {formatLength(activeDragLine.distanceMeters).unit}
          </span>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/40">
            ∠ {formatDegrees(activeDragLine.cornerAngleDegrees ?? activeDragLine.bearingDegrees ?? 0)}
          </span>
        </div>
      )}

      {/* Floating Hint when hovering near an edge label */}
      {hoveredEdgeLabel && !activeDragLine && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-sky-950/90 border border-sky-400/80 rounded-full shadow-xl backdrop-blur-md flex items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-100 text-xs font-medium text-sky-200">
          <span>✏️</span>
          <span>Klik angka sisi untuk mengetik panjang</span>
        </div>
      )}

      {/* In-canvas Delete confirmation prompt popover for long-press */}
      {deletePrompt && (
        <div
          className="absolute z-30 flex flex-col items-center bg-slate-900/95 border border-rose-500/80 shadow-2xl rounded-xl p-3 text-slate-100 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.max(16, Math.min(window.innerWidth - 200, deletePrompt.screenPos.x - 90)),
            top: Math.max(70, deletePrompt.screenPos.y - 95),
            minWidth: '180px',
          }}
        >
          <span className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            Hapus titik ke-{deletePrompt.vertexIndex + 1}?
          </span>
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleDeleteVertex}
              className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Hapus
            </button>
            <button
              type="button"
              onClick={() => setDeletePrompt(null)}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
