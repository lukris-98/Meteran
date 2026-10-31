import { Point, PolygonShape, ScaleConfig, VertexDeletePrompt, ActiveLineDrag } from '../types/cad';
import {
  calculateCentroid,
  calculateDistance,
  formatLength,
  calculateBearingDegrees,
  calculateCornerAngle,
  formatDegrees,
} from '../utils/geoMath';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pan: Point;
  zoom: number;
  polygons: PolygonShape[];
  activePolygonId: string | null;
  mode: 'draw' | 'edit';
  scaleConfig: ScaleConfig;
  snapToGrid: boolean;
  pointerPos: Point | null; // world coordinates
  snappedPointerPos: Point | null; // world coordinates
  hoveredVertex: { polygonId: string; index: number } | null;
  hoveredEdge: { polygonId: string; edgeIndex: number; insertPoint: Point } | null;
  hoveredEdgeLabel: { polygonId: string; edgeIndex: number } | null;
  hoveredCentroidPolygonId: string | null;
  deletePrompt: VertexDeletePrompt | null;
  activeDragLine: ActiveLineDrag | null;
}

export function screenToWorld(screenPoint: Point, pan: Point, zoom: number): Point {
  return {
    x: (screenPoint.x - pan.x) / zoom,
    y: (screenPoint.y - pan.y) / zoom,
  };
}

export function worldToScreen(worldPoint: Point, pan: Point, zoom: number): Point {
  return {
    x: worldPoint.x * zoom + pan.x,
    y: worldPoint.y * zoom + pan.y,
  };
}

export function renderCanvas(rc: RenderContext) {
  const { ctx, width, height, pan, zoom, polygons, activePolygonId, scaleConfig } = rc;
  const metersPerPixel = scaleConfig.metersPerGrid / scaleConfig.gridPixelSize;

  // 1. Clear background
  ctx.save();
  ctx.fillStyle = '#0f172a'; // Elegant dark background slate-900
  ctx.fillRect(0, 0, width, height);

  // 2. Draw CAD Grid
  drawGrid(ctx, width, height, pan, zoom, scaleConfig);

  // 3. Apply Pan and Zoom Transform for World Elements
  ctx.save();
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  // 4. Draw Polygons
  for (const poly of polygons) {
    const isActive = poly.id === activePolygonId;
    drawPolygon(ctx, poly, isActive, metersPerPixel, rc);
  }

  // 5. Draw active line drag (interactive touch drag on mobile/mouse drag)
  const activePoly = polygons.find((p) => p.id === activePolygonId);
  const firstPoint = activePoly && activePoly.points.length >= 3 ? activePoly.points[0] : null;
  const lastPointInPoly =
    activePoly && activePoly.points.length > 0
      ? activePoly.points[activePoly.points.length - 1]
      : null;
  const prevPointInPoly =
    activePoly && activePoly.points.length >= 2
      ? activePoly.points[activePoly.points.length - 2]
      : null;

  if (rc.mode === 'draw' && rc.activeDragLine) {
    drawRubberBandLine(
      ctx,
      rc.activeDragLine.originPoint,
      rc.activeDragLine.targetPoint,
      prevPointInPoly,
      firstPoint,
      (activePoly?.points.length || 0) >= 2,
      metersPerPixel,
      zoom,
      true // isDragging active
    );
  } else if (
    rc.mode === 'draw' &&
    activePoly &&
    !activePoly.isClosed &&
    activePoly.points.length > 0 &&
    rc.pointerPos
  ) {
    // Desktop hover rubber-band (only if moved noticeably away from the last point)
    const lastPoint = activePoly.points[activePoly.points.length - 1];
    const targetPoint = rc.snappedPointerPos || rc.pointerPos;
    const distM = calculateDistance(lastPoint, targetPoint, metersPerPixel);
    const distPx = Math.hypot(targetPoint.x - lastPoint.x, targetPoint.y - lastPoint.y);

    if (distM >= 0.2 && distPx > 14 / zoom) {
      drawRubberBandLine(
        ctx,
        lastPoint,
        targetPoint,
        prevPointInPoly,
        firstPoint,
        activePoly.points.length >= 3,
        metersPerPixel,
        zoom,
        false
      );
    }
  }

  // 6. Draw edge hover indicator in edit mode (previewing adding vertex)
  if (rc.mode === 'edit' && rc.hoveredEdge) {
    const edgePoly = polygons.find((p) => p.id === rc.hoveredEdge?.polygonId);
    if (edgePoly) {
      drawEdgeHoverInsert(ctx, rc.hoveredEdge.insertPoint);
    }
  }

  ctx.restore(); // Restore world transform

  // 7. Draw Screen-Space HUD Elements (Scale bar, Compass, Delete Confirmation)
  drawScaleLegend(ctx, width, height, zoom, scaleConfig);
  drawCompass(ctx, width);

  // 8. Draw in-canvas Delete confirmation badge if active
  if (rc.deletePrompt) {
    drawDeletePromptBadge(ctx, rc.deletePrompt);
  }

  ctx.restore();
}

/**
 * Draws CAD grid with 50px subgrid and 100px major grid lines
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: Point,
  zoom: number,
  scaleConfig: ScaleConfig
) {
  const subgridSize = scaleConfig.gridPixelSize * zoom; // e.g. 50 * zoom
  const majorGridSize = subgridSize * 2; // e.g. 100 * zoom

  // Determine bounds in screen space
  const startX = pan.x % subgridSize;
  const startY = pan.y % subgridSize;

  // Thin subgrid lines (50px)
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#1e293b'; // slate-800 subtle

  for (let x = startX - subgridSize; x <= width + subgridSize; x += subgridSize) {
    ctx.moveTo(Math.floor(x) + 0.5, 0);
    ctx.lineTo(Math.floor(x) + 0.5, height);
  }
  for (let y = startY - subgridSize; y <= height + subgridSize; y += subgridSize) {
    ctx.moveTo(0, Math.floor(y) + 0.5);
    ctx.lineTo(width, Math.floor(y) + 0.5);
  }
  ctx.stroke();

  // Thicker major grid lines (100px)
  const majorStartX = pan.x % majorGridSize;
  const majorStartY = pan.y % majorGridSize;

  ctx.beginPath();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = '#334155'; // slate-700 contrast

  for (let x = majorStartX - majorGridSize; x <= width + majorGridSize; x += majorGridSize) {
    ctx.moveTo(Math.floor(x) + 0.5, 0);
    ctx.lineTo(Math.floor(x) + 0.5, height);
  }
  for (let y = majorStartY - majorGridSize; y <= height + majorGridSize; y += majorGridSize) {
    ctx.moveTo(0, Math.floor(y) + 0.5);
    ctx.lineTo(width, Math.floor(y) + 0.5);
  }
  ctx.stroke();

  // Subtle origin axis marker
  const originX = pan.x;
  const originY = pan.y;
  if (originX >= -50 && originX <= width + 50 && originY >= -50 && originY <= height + 50) {
    ctx.save();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(originX, originY, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Draws polygon body, strokes, edge length badges, and vertex markers
 */
function drawPolygon(
  ctx: CanvasRenderingContext2D,
  poly: PolygonShape,
  isActive: boolean,
  metersPerPixel: number,
  rc: RenderContext
) {
  const points = poly.points;
  if (points.length === 0) return;

  const strokeColor = poly.color || '#38bdf8';
  const fillColor = poly.isClosed
    ? `${strokeColor}2a` // 16% opacity hex
    : 'transparent';

  // 1. Draw shape path
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  if (poly.isClosed && points.length >= 3) {
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Active selection glow/border
    if (isActive) {
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();

      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
  } else {
    // Open path
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }

  // 2. Draw edge length labels
  drawEdgeLabels(ctx, poly, strokeColor, metersPerPixel, rc.zoom, rc.hoveredEdgeLabel);

  // 2.5 Draw corner angle badges for closed polygons with >= 3 vertices
  if (poly.isClosed && points.length >= 3) {
    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const cDeg = calculateCornerAngle(prev, curr, next);
      if (cDeg > 0 && cDeg < 180) {
        drawCornerAngleBadge(ctx, prev, curr, next, cDeg, strokeColor, rc.zoom);
      }
    }
  }

  // 3. Draw Centroid handle for closed polygons
  if (poly.isClosed && points.length >= 3) {
    const centroid = calculateCentroid(points);
    drawCentroidHandle(
      ctx,
      centroid,
      poly.name,
      strokeColor,
      isActive,
      rc.hoveredCentroidPolygonId === poly.id,
      rc.zoom
    );
  }

  // 4. Draw vertices
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const isFirst = i === 0;
    const isHovered =
      rc.hoveredVertex?.polygonId === poly.id && rc.hoveredVertex?.index === i;

    ctx.save();

    if (isFirst) {
      // First vertex: Vibrant Orange (#f59e0b)
      // Pulse / Close Target ring if currently drawing and points >= 3
      if (rc.mode === 'draw' && !poly.isClosed && points.length >= 3) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14 / rc.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2 / rc.zoom;
        ctx.setLineDash([3 / rc.zoom, 3 / rc.zoom]);
        ctx.stroke();
      }

      ctx.beginPath();
      const radius = (isHovered ? 8 : 6.5) / rc.zoom;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.lineWidth = 2 / rc.zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Number label "1"
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(9, 10 / rc.zoom)}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    } else {
      // Other vertices: Blue / Theme color
      ctx.beginPath();
      const radius = (isHovered ? 7.5 : 5.5) / rc.zoom;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
      ctx.lineWidth = 1.75 / rc.zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws dimension length labels on each edge of the polygon with clickable indicator
 */
function drawEdgeLabels(
  ctx: CanvasRenderingContext2D,
  poly: PolygonShape,
  strokeColor: string,
  metersPerPixel: number,
  zoom: number,
  hoveredEdgeLabel?: { polygonId: string; edgeIndex: number } | null
) {
  const points = poly.points;
  if (points.length < 2) return;

  const edgeCount = poly.isClosed && points.length >= 3 ? points.length : points.length - 1;

  for (let i = 0; i < edgeCount; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    const distM = calculateDistance(p1, p2, metersPerPixel);
    const { primary, unit } = formatLength(distM);
    const labelText = `S${i + 1}: ${primary} ${unit} ✎`;

    // Midpoint
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Normal vector for offset to avoid sitting directly on the line
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;

    // Unit normal vector perpendicular to edge
    const nx = -dy / len;
    const ny = dx / len;
    const offsetDist = 15 / zoom;

    const labelX = midX + nx * offsetDist;
    const labelY = midY + ny * offsetDist;

    const isHovered =
      hoveredEdgeLabel?.polygonId === poly.id && hoveredEdgeLabel?.edgeIndex === i;

    // Draw badge pill with clickable appearance
    drawBadgePill(
      ctx,
      labelText,
      labelX,
      labelY,
      isHovered ? '#0284c7' : '#0f172a',
      isHovered ? '#38bdf8' : strokeColor,
      isHovered ? '#ffffff' : '#f8fafc',
      zoom,
      11
    );
  }
}

/**
 * Subtle corner angle arc and badge on polygon vertices
 */
function drawCornerAngleBadge(
  ctx: CanvasRenderingContext2D,
  prev: Point,
  curr: Point,
  next: Point,
  deg: number,
  strokeColor: string,
  zoom: number
) {
  ctx.save();
  const v1Angle = Math.atan2(prev.y - curr.y, prev.x - curr.x);
  const v2Angle = Math.atan2(next.y - curr.y, next.x - curr.x);

  const arcRadius = 14 / zoom;
  ctx.beginPath();
  ctx.arc(curr.x, curr.y, arcRadius, v1Angle, v2Angle, false);
  ctx.strokeStyle = `${strokeColor}88`;
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();

  // Subtle interior angle label (only if space permits)
  if (zoom >= 0.75) {
    const midAngle = (v1Angle + v2Angle) / 2;
    const lx = curr.x + Math.cos(midAngle) * (24 / zoom);
    const ly = curr.y + Math.sin(midAngle) * (24 / zoom);
    drawBadgePill(
      ctx,
      formatDegrees(deg),
      lx,
      ly,
      'rgba(15, 23, 42, 0.75)',
      `${strokeColor}66`,
      '#94a3b8',
      zoom,
      9
    );
  }
  ctx.restore();
}

/**
 * Draws dynamic rubber-band line with real-time length badge, degree arc, and finger callout
 */
function drawRubberBandLine(
  ctx: CanvasRenderingContext2D,
  fromPoint: Point,
  toPoint: Point,
  prevPoint: Point | null,
  firstPoint: Point | null,
  canClose: boolean,
  metersPerPixel: number,
  zoom: number,
  isDragging: boolean
) {
  ctx.save();

  // Dynamic rubber-band line in vibrant amber-yellow (#facc15)
  ctx.beginPath();
  ctx.moveTo(fromPoint.x, fromPoint.y);
  ctx.lineTo(toPoint.x, toPoint.y);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2.5 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.stroke();

  // Origin dot
  ctx.beginPath();
  ctx.arc(fromPoint.x, fromPoint.y, 5 / zoom, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  // Target endpoint reticle
  ctx.beginPath();
  ctx.arc(toPoint.x, toPoint.y, 6.5 / zoom, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.lineWidth = 2 / zoom;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Distance calculations
  const distM = calculateDistance(fromPoint, toPoint, metersPerPixel);
  const { primary, unit } = formatLength(distM);
  const distText = `${primary} ${unit}`;

  // Angle calculations:
  // Bearing angle relative to horizontal (0° to 360°)
  const bearingDeg = calculateBearingDegrees(fromPoint, toPoint);
  // Corner angle relative to previous line segment if points >= 2
  const cornerDeg = prevPoint ? calculateCornerAngle(prevPoint, fromPoint, toPoint) : null;
  const activeDeg = cornerDeg !== null ? cornerDeg : bearingDeg;
  const degText = formatDegrees(activeDeg);

  // Draw angle arc at fromPoint
  const linePixelDist = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
  if (linePixelDist > 16 / zoom) {
    const angleTo = Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x);
    const angleFrom = prevPoint
      ? Math.atan2(prevPoint.y - fromPoint.y, prevPoint.x - fromPoint.x)
      : 0;

    ctx.save();
    ctx.beginPath();
    const arcRadius = 22 / zoom;
    ctx.arc(fromPoint.x, fromPoint.y, arcRadius, angleFrom, angleTo, false);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.75 / zoom;
    ctx.stroke();

    // Degree label near the vertex arc
    const midAngle = (angleFrom + angleTo) / 2;
    const arcLabelX = fromPoint.x + Math.cos(midAngle) * (34 / zoom);
    const arcLabelY = fromPoint.y + Math.sin(midAngle) * (34 / zoom);
    drawBadgePill(
      ctx,
      `∠ ${degText}`,
      arcLabelX,
      arcLabelY,
      '#0f172a',
      '#facc15',
      '#fef08a',
      zoom,
      10
    );
    ctx.restore();
  }

  // Midpoint label showing BOTH length and degrees
  const midX = (fromPoint.x + toPoint.x) / 2;
  const midY = (fromPoint.y + toPoint.y) / 2;
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const len = Math.hypot(dx, dy);
  const nx = len > 0 ? -dy / len : 0;
  const ny = len > 0 ? dx / len : 0;
  const offset = 18 / zoom;

  const fullLabel = `📏 ${distText} • ∠ ${degText}`;

  drawBadgePill(
    ctx,
    fullLabel,
    midX + nx * offset,
    midY + ny * offset,
    '#0f172a',
    '#facc15',
    '#fde047',
    zoom,
    11.5
  );

  // If user is actively dragging with finger on mobile:
  // Render callout badge directly above the finger (offset by 38px in screen space)
  if (isDragging) {
    const calloutY = toPoint.y - 38 / zoom;
    drawBadgePill(
      ctx,
      `📏 ${distText} • ${degText}`,
      toPoint.x,
      calloutY,
      '#1e1b4b',
      '#facc15',
      '#fef08a',
      zoom,
      12.5
    );
  }

  // If near first point and canClose:
  if (firstPoint && canClose) {
    const distToFirst = Math.hypot(toPoint.x - firstPoint.x, toPoint.y - firstPoint.y);
    if (distToFirst < 30 / zoom) {
      // Pulsing green ring
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, 18 / zoom, 0, Math.PI * 2);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3 / zoom;
      ctx.stroke();

      drawBadgePill(
        ctx,
        '✓ Tutup Bidang',
        firstPoint.x,
        firstPoint.y - 24 / zoom,
        '#052e16',
        '#22c55e',
        '#86efac',
        zoom,
        11
      );
    }
  }

  ctx.restore();
}

/**
 * Draws CAD guide message when the canvas is empty
 */
function drawEmptyCanvasHint(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  const centerX = width / 2;
  const centerY = height / 2 - 30;

  // Background card
  const cardW = Math.min(340, width - 40);
  const cardH = 76;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(centerX - cardW / 2, centerY - cardH / 2, cardW, cardH, 16);
  ctx.fill();
  ctx.stroke();

  // Hint Title
  ctx.fillStyle = '#38bdf8';
  ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('📐 Tarik Garis Lahan', centerX, centerY - 12);

  // Subtitle / gesture instruction
  ctx.fillStyle = '#94a3b8';
  ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText('Ketuk kanvas atau tahan & geser jari untuk mengukur sisi', centerX, centerY + 14);

  ctx.restore();
}

/**
 * Centroid handle for moving whole polygon
 */
function drawCentroidHandle(
  ctx: CanvasRenderingContext2D,
  centroid: Point,
  name: string,
  strokeColor: string,
  isActive: boolean,
  isHovered: boolean,
  zoom: number
) {
  ctx.save();

  // Center handle disc
  ctx.beginPath();
  const radius = (isHovered ? 12 : 9) / zoom;
  ctx.arc(centroid.x, centroid.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = isActive ? strokeColor : '#334155';
  ctx.fill();
  ctx.lineWidth = 2 / zoom;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Crosshair icon
  ctx.beginPath();
  const cross = 4 / zoom;
  ctx.moveTo(centroid.x - cross, centroid.y);
  ctx.lineTo(centroid.x + cross, centroid.y);
  ctx.moveTo(centroid.x, centroid.y - cross);
  ctx.lineTo(centroid.x, centroid.y + cross);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5 / zoom;
  ctx.stroke();

  // Polygon Name Tag
  const nameY = centroid.y + 18 / zoom;
  drawBadgePill(
    ctx,
    name,
    centroid.x,
    nameY,
    isActive ? '#0f172a' : '#1e293b',
    isActive ? strokeColor : '#64748b',
    '#f8fafc',
    zoom,
    10
  );

  ctx.restore();
}

/**
 * Preview indicator when hovering over an edge to insert vertex
 */
function drawEdgeHoverInsert(ctx: CanvasRenderingContext2D, point: Point) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#38bdf8';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Plus symbol
  ctx.beginPath();
  ctx.moveTo(point.x - 3, point.y);
  ctx.lineTo(point.x + 3, point.y);
  ctx.moveTo(point.x, point.y - 3);
  ctx.lineTo(point.x, point.y + 3);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * Reusable badge pill with border and crisp text
 */
function drawBadgePill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg: string,
  border: string,
  textColor: string,
  zoom: number,
  fontSize: number = 11
) {
  ctx.save();
  const adjustedFontSize = Math.max(8.5, Math.min(15, fontSize / zoom));
  ctx.font = `600 ${adjustedFontSize}px 'JetBrains Mono', monospace`;
  const metrics = ctx.measureText(text);
  const paddingX = 5 / zoom;
  const paddingY = 2.5 / zoom;
  const width = metrics.width + paddingX * 2;
  const height = adjustedFontSize * 1.35 + paddingY * 2;

  const rectX = x - width / 2;
  const rectY = y - height / 2;
  const radius = 3.5 / zoom;

  // Background
  ctx.beginPath();
  ctx.roundRect(rectX, rectY, width, height, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();

  // Text
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);

  ctx.restore();
}

/**
 * Scale Legend on bottom-left of screen
 */
function drawScaleLegend(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  scaleConfig: ScaleConfig
) {
  ctx.save();
  const pixelsPerMeter = scaleConfig.gridPixelSize / scaleConfig.metersPerGrid;
  const screenPixelsPerMeter = pixelsPerMeter * zoom;

  // Pick a round meter step for scale bar (e.g. 1m, 2m, 5m, 10m, 20m, 50m, 100m)
  const targetBarWidth = 100; // desired width in px
  const roughMeters = targetBarWidth / screenPixelsPerMeter;
  const niceSteps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  let chosenMeters = niceSteps[0];
  for (const step of niceSteps) {
    if (step <= roughMeters * 1.3) {
      chosenMeters = step;
    }
  }

  const barPx = chosenMeters * screenPixelsPerMeter;
  const posX = 20;
  // Position above bottom results panel
  const posY = height - 175;

  if (posY > 100) {
    // Backdrop
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(posX - 8, posY - 22, barPx + 16, 32, 6);
    ctx.fill();
    ctx.stroke();

    // Scale bar
    ctx.beginPath();
    ctx.moveTo(posX, posY);
    ctx.lineTo(posX + barPx, posY);
    // End ticks
    ctx.moveTo(posX, posY - 4);
    ctx.lineTo(posX, posY + 4);
    ctx.moveTo(posX + barPx, posY - 4);
    ctx.lineTo(posX + barPx, posY + 4);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    const label = `${chosenMeters} m`;
    ctx.fillStyle = '#f8fafc';
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(label, posX + barPx / 2, posY - 8);
  }

  ctx.restore();
}

/**
 * Modern CAD North Arrow / Compass Rose in top-right
 */
function drawCompass(ctx: CanvasRenderingContext2D, width: number) {
  ctx.save();
  const posX = width - 42;
  const posY = 75;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(posX, posY, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // North pointer arrow (red / white)
  ctx.beginPath();
  ctx.moveTo(posX, posY - 12);
  ctx.lineTo(posX + 5, posY + 4);
  ctx.lineTo(posX, posY + 1);
  ctx.closePath();
  ctx.fillStyle = '#ef4444'; // Red north needle
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(posX, posY - 12);
  ctx.lineTo(posX - 5, posY + 4);
  ctx.lineTo(posX, posY + 1);
  ctx.closePath();
  ctx.fillStyle = '#dc2626';
  ctx.fill();

  // "U" (Utara / North) label
  ctx.fillStyle = '#f8fafc';
  ctx.font = "bold 9px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('U', posX, posY + 5);

  ctx.restore();
}

/**
 * Draws the in-canvas vertex deletion confirmation badge
 */
function drawDeletePromptBadge(ctx: CanvasRenderingContext2D, prompt: VertexDeletePrompt) {
  ctx.save();
  const { x, y } = prompt.screenPos;
  const badgeWidth = 140;
  const badgeHeight = 64;
  const boxX = Math.max(10, x - badgeWidth / 2);
  const boxY = Math.max(70, y - badgeHeight - 14);

  // Background box with drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, badgeWidth, badgeHeight, 8);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('Hapus titik ini?', boxX + badgeWidth / 2, boxY + 20);

  // Action hint (User can click on screen button in DOM overlay or handle click)
  ctx.font = "9px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Ketuk lagi untuk hapus', boxX + badgeWidth / 2, boxY + 44);

  ctx.restore();
}
