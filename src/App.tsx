import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppMode,
  PolygonShape,
  ScaleConfig,
  Point,
  EditEdgeTarget,
} from './types/cad';
import { CanvasView } from './components/CanvasView';
import { Toolbar } from './components/Toolbar';
import { ResultsPanel } from './components/ResultsPanel';
import { ExportModal } from './components/ExportModal';
import { HelpModal } from './components/HelpModal';
import { ShapeManagerModal } from './components/ShapeManagerModal';
import { VertexManagerModal } from './components/VertexManagerModal';
import { EditEdgeLengthModal } from './components/EditEdgeLengthModal';
import {
  loadStateFromStorage,
  saveStateToStorage,
} from './utils/storage';
import { getNextColor } from './utils/colors';
import {
  calculatePerimeter,
  calculatePolygonArea,
  formatArea,
  formatLength,
  resizeEdgeLength,
} from './utils/geoMath';

export default function App() {
  // Canvas starts completely empty on initial load (no template shape)
  const [polygons, setPolygons] = useState<PolygonShape[]>([]);
  const [activePolygonId, setActivePolygonId] = useState<string | null>(null);

  const [mode, setMode] = useState<AppMode>('draw');

  const [snapToGrid, setSnapToGrid] = useState<boolean>(() => {
    const saved = loadStateFromStorage();
    return saved.snapToGrid !== null ? saved.snapToGrid : true;
  });

  const [scaleConfig, setScaleConfig] = useState<ScaleConfig>(() => {
    const saved = loadStateFromStorage();
    return saved.scale || { gridPixelSize: 50, metersPerGrid: 1 };
  });

  // Undo / Redo history
  const [history, setHistory] = useState<PolygonShape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const isInternalChangeRef = useRef<boolean>(false);

  // Modals & Panels
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isShapeManagerOpen, setIsShapeManagerOpen] = useState<boolean>(false);
  const [isVertexManagerOpen, setIsVertexManagerOpen] = useState<boolean>(false);
  const [vertexManagerPolyId, setVertexManagerPolyId] = useState<string | null>(null);
  const [editingEdgeTarget, setEditingEdgeTarget] = useState<EditEdgeTarget | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  };

  // Push new state into history stack
  const updatePolygonsWithHistory = useCallback(
    (updater: (prev: PolygonShape[]) => PolygonShape[]) => {
      setPolygons((prev) => {
        const next = updater(prev);
        if (JSON.stringify(prev) !== JSON.stringify(next)) {
          setHistory((hPrev) => {
            const nextHistory = hPrev.slice(0, historyIndex + 1);
            return [...nextHistory, next];
          });
          setHistoryIndex((idx) => idx + 1);
        }
        return next;
      });
    },
    [historyIndex]
  );

  // Auto-save to localStorage
  useEffect(() => {
    saveStateToStorage(polygons, scaleConfig, snapToGrid);
  }, [polygons, scaleConfig, snapToGrid]);

  // Keep activePolygonId valid
  useEffect(() => {
    if (polygons.length === 0) {
      setActivePolygonId(null);
    } else if (!activePolygonId || !polygons.some((p) => p.id === activePolygonId)) {
      setActivePolygonId(polygons[polygons.length - 1].id);
    }
  }, [polygons, activePolygonId]);

  // Undo handler
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      const targetState = history[prevIdx];
      isInternalChangeRef.current = true;
      setPolygons(targetState);
      setHistoryIndex(prevIdx);
      if (activePolygonId && !targetState.find((p) => p.id === activePolygonId)) {
        setActivePolygonId(targetState.length > 0 ? targetState[0].id : null);
      }
      showToast('Perubahan dibatalkan (Undo)');
    }
  }, [historyIndex, history, activePolygonId]);

  // Redo handler
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const targetState = history[nextIdx];
      isInternalChangeRef.current = true;
      setPolygons(targetState);
      setHistoryIndex(nextIdx);
      showToast('Perubahan dikembalikan (Redo)');
    }
  }, [historyIndex, history]);

  // Keyboard shortcut for Undo (Ctrl+Z / Cmd+Z) and Redo (Ctrl+Y / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Reset / Clear canvas
  const handleReset = () => {
    if (window.confirm('Kosongkan kanvas dan bersihkan semua bidang lahan?')) {
      setPolygons([]);
      setActivePolygonId(null);
      setHistory([[]]);
      setHistoryIndex(0);
      setMode('draw');
      showToast('Kanvas telah dikosongkan');
    }
  };

  // Add new polygon
  const handleAddNewPolygon = () => {
    const newId = `poly_${Date.now()}`;
    const nextColor = getNextColor(polygons.length);
    const newShape: PolygonShape = {
      id: newId,
      name: `Bidang ${polygons.length + 1}`,
      color: nextColor,
      isClosed: false,
      createdAt: Date.now(),
      points: [],
    };

    updatePolygonsWithHistory((prev) => [...prev, newShape]);
    setActivePolygonId(newId);
    setMode('draw');
    showToast(`Membuat ${newShape.name} baru`);
  };

  // Delete specific polygon (Shape Management)
  const handleDeletePolygon = (id: string) => {
    const poly = polygons.find((p) => p.id === id);
    const polyName = poly ? poly.name : 'Bidang';

    updatePolygonsWithHistory((prev) => prev.filter((p) => p.id !== id));
    if (activePolygonId === id) {
      const remaining = polygons.filter((p) => p.id !== id);
      setActivePolygonId(remaining.length > 0 ? remaining[0].id : null);
    }
    showToast(`${polyName} berhasil dihapus`);
  };

  // Duplicate specific polygon (Shape Management)
  const handleDuplicatePolygon = (id: string) => {
    const target = polygons.find((p) => p.id === id);
    if (!target) return;

    const newId = `poly_${Date.now()}`;
    const nextColor = getNextColor(polygons.length);
    // Shift duplicated points slightly (+50px = 1m) so it is clearly visible
    const shiftedPoints = target.points.map((pt) => ({
      x: pt.x + 50,
      y: pt.y + 50,
    }));

    const duplicated: PolygonShape = {
      id: newId,
      name: `${target.name} (Salinan)`,
      color: nextColor,
      isClosed: target.isClosed,
      createdAt: Date.now(),
      points: shiftedPoints,
    };

    updatePolygonsWithHistory((prev) => [...prev, duplicated]);
    setActivePolygonId(newId);
    showToast(`${target.name} berhasil diduplikasi`);
  };

  // Change polygon color
  const handleChangePolygonColor = (id: string, color: string) => {
    updatePolygonsWithHistory((prev) =>
      prev.map((p) => (p.id === id ? { ...p, color } : p))
    );
  };

  // Rename polygon
  const handleRenamePolygon = (id: string, newName: string) => {
    updatePolygonsWithHistory((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    );
  };

  // Update points of a polygon (CRUD Points)
  const handleUpdatePolygonPoints = (polygonId: string, newPoints: Point[]) => {
    updatePolygonsWithHistory((prev) =>
      prev.map((p) => {
        if (p.id === polygonId) {
          const stillClosed = p.isClosed && newPoints.length >= 3;
          return {
            ...p,
            points: newPoints,
            isClosed: stillClosed,
          };
        }
        return p;
      })
    );
    showToast('Titik sudut berhasil diperbarui');
  };

  // Open vertex manager for a polygon
  const handleOpenVertexManager = (polygonId?: string) => {
    const targetId = polygonId || activePolygonId;
    if (targetId) {
      setVertexManagerPolyId(targetId);
      setIsVertexManagerOpen(true);
    } else {
      showToast('Pilih bidang terlebih dahulu untuk mengelola titik');
    }
  };

  // Web Share API integration
  const handleShare = async () => {
    const metersPerPixel = scaleConfig.metersPerGrid / scaleConfig.gridPixelSize;
    const activePoly = polygons.find((p) => p.id === activePolygonId);
    const areaM2 =
      activePoly && activePoly.isClosed && activePoly.points.length >= 3
        ? calculatePolygonArea(activePoly.points, metersPerPixel)
        : 0;
    const perimM =
      activePoly && activePoly.points.length >= 2
        ? calculatePerimeter(activePoly.points, activePoly.isClosed, metersPerPixel)
        : 0;
    const { primary: areaStr, unit: areaUnit } = formatArea(areaM2);
    const { primary: perimStr, unit: perimUnit } = formatLength(perimM);

    const shareData = {
      title: 'Hitung Tanah - Pengukur Luas & Keliling Lahan',
      text: `Pengukuran ${activePoly ? activePoly.name : 'Lahan'}: Luas = ${areaStr} ${areaUnit}, Keliling = ${perimStr} ${perimUnit}. Diukur dengan aplikasi Hitung Tanah.`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled share
      }
    } else {
      setIsExportOpen(true);
      showToast('Buka menu Ekspor untuk menyalin data ringkasan');
    }
  };

  // Handle typing custom edge length in meters
  const handleApplyNewLength = useCallback(
    (
      polygonId: string,
      edgeIndex: number,
      newLengthMeters: number,
      resizeMode: 'moveEnd' | 'moveStart' | 'both'
    ) => {
      const metersPerPixel = scaleConfig.metersPerGrid / scaleConfig.gridPixelSize;
      updatePolygonsWithHistory((prev) =>
        prev.map((p) => {
          if (p.id === polygonId) {
            const updatedPts = resizeEdgeLength(
              p.points,
              edgeIndex,
              newLengthMeters,
              metersPerPixel,
              resizeMode
            );
            return { ...p, points: updatedPts };
          }
          return p;
        })
      );
      showToast(`Panjang sisi ${edgeIndex + 1} diubah menjadi ${newLengthMeters.toFixed(2)} m`);
    },
    [scaleConfig, updatePolygonsWithHistory]
  );

  const activePoly = polygons.find((p) => p.id === activePolygonId);
  const vertexManagerPoly = polygons.find((p) => p.id === vertexManagerPolyId) || activePoly;
  const editingEdgePoly = editingEdgeTarget
    ? polygons.find((p) => p.id === editingEdgeTarget.polygonId) || null
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Application Toolbar */}
      <Toolbar
        mode={mode}
        onSetMode={setMode}
        snapToGrid={snapToGrid}
        onToggleSnap={() => setSnapToGrid(!snapToGrid)}
        scaleConfig={scaleConfig}
        onChangeMetersPerGrid={(meters) =>
          setScaleConfig((prev) => ({ ...prev, metersPerGrid: meters }))
        }
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleReset}
        onOpenExport={() => setIsExportOpen(true)}
        onShare={handleShare}
        onOpenHelp={() => setIsHelpOpen(true)}
        polygons={polygons}
        activePolygonId={activePolygonId}
        onSelectPolygon={setActivePolygonId}
        onAddNewPolygon={handleAddNewPolygon}
        onChangePolygonColor={handleChangePolygonColor}
        onOpenShapeManager={() => setIsShapeManagerOpen(true)}
        onOpenVertexManager={() => handleOpenVertexManager()}
        onDeleteActivePolygon={activePolygonId ? () => handleDeletePolygon(activePolygonId) : undefined}
      />

      {/* Main Full-Screen CAD Canvas View */}
      <main className="flex-1 w-full h-full relative" role="region" aria-label="Kanvas Gambar Hitung Tanah">
        <CanvasView
          polygons={polygons}
          activePolygonId={activePolygonId}
          mode={mode}
          scaleConfig={scaleConfig}
          snapToGridEnabled={snapToGrid}
          onUpdatePolygons={updatePolygonsWithHistory}
          onSelectPolygon={setActivePolygonId}
          onShapeClosed={(id) => {
            showToast('Bidang poligon berhasil ditutup!');
            setMode('edit');
          }}
          onEditEdgeRequest={(target) => setEditingEdgeTarget(target)}
        />
      </main>

      {/* Persistent Bottom Results Panel */}
      <ResultsPanel
        polygons={polygons}
        activePolygonId={activePolygonId}
        scaleConfig={scaleConfig}
        onRenamePolygon={handleRenamePolygon}
        onClosePolygon={(id) => {
          updatePolygonsWithHistory((prev) =>
            prev.map((p) => {
              if (p.id === id && p.points.length >= 3) {
                return { ...p, isClosed: true };
              }
              return p;
            })
          );
          setMode('edit');
          showToast('Bidang poligon berhasil ditutup!');
        }}
        onOpenVertexManager={(id) => handleOpenVertexManager(id)}
        onDeletePolygon={(id) => handleDeletePolygon(id)}
        onEditEdgeRequest={(target) => setEditingEdgeTarget(target)}
      />

      {/* Shape Management Modal */}
      <ShapeManagerModal
        isOpen={isShapeManagerOpen}
        onClose={() => setIsShapeManagerOpen(false)}
        polygons={polygons}
        activePolygonId={activePolygonId}
        scaleConfig={scaleConfig}
        onSelectPolygon={(id) => {
          setActivePolygonId(id);
          setIsShapeManagerOpen(false);
        }}
        onAddNewPolygon={() => {
          handleAddNewPolygon();
          setIsShapeManagerOpen(false);
        }}
        onDeletePolygon={handleDeletePolygon}
        onDuplicatePolygon={handleDuplicatePolygon}
        onRenamePolygon={handleRenamePolygon}
        onChangeColor={handleChangePolygonColor}
        onClearAll={() => {
          handleReset();
          setIsShapeManagerOpen(false);
        }}
        onOpenVertexManager={(id) => {
          setIsShapeManagerOpen(false);
          handleOpenVertexManager(id);
        }}
      />

      {/* Vertex CRUD Modal (Kelola Titik Sudut) */}
      <VertexManagerModal
        isOpen={isVertexManagerOpen}
        onClose={() => setIsVertexManagerOpen(false)}
        polygon={vertexManagerPoly || null}
        scaleConfig={scaleConfig}
        onUpdatePoints={handleUpdatePolygonPoints}
      />

      {/* Edit Edge Length Modal (Ketik Angka Panjang) */}
      <EditEdgeLengthModal
        isOpen={Boolean(editingEdgeTarget)}
        onClose={() => setEditingEdgeTarget(null)}
        target={editingEdgeTarget}
        polygon={editingEdgePoly}
        scaleConfig={scaleConfig}
        onApplyNewLength={handleApplyNewLength}
      />

      {/* Export & Data Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        polygons={polygons}
        scaleConfig={scaleConfig}
      />

      {/* User Guide & Gestures Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-slate-900/95 border border-cyan-500/60 rounded-full shadow-2xl text-xs font-semibold text-cyan-300 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
