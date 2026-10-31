import React, { useState } from 'react';
import {
  PolygonShape,
  ScaleConfig,
  Point,
  EditEdgeTarget,
} from '../types/cad';
import {
  calculateDistance,
  calculatePerimeter,
  calculatePolygonArea,
  formatArea,
  formatLength,
} from '../utils/geoMath';
import { useCountUp } from '../hooks/useCountUp';
import {
  ChevronUp,
  ChevronDown,
  Layers,
  Edit2,
  Check,
  Trash2,
  ListOrdered,
} from 'lucide-react';

interface ResultsPanelProps {
  polygons: PolygonShape[];
  activePolygonId: string | null;
  scaleConfig: ScaleConfig;
  onRenamePolygon: (id: string, newName: string) => void;
  onClosePolygon?: (id: string) => void;
  onOpenVertexManager?: (polygonId: string) => void;
  onDeletePolygon?: (polygonId: string) => void;
  onEditEdgeRequest?: (target: EditEdgeTarget) => void;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  polygons,
  activePolygonId,
  scaleConfig,
  onRenamePolygon,
  onClosePolygon,
  onOpenVertexManager,
  onDeletePolygon,
  onEditEdgeRequest,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const activePoly = polygons.find((p) => p.id === activePolygonId);
  const metersPerPixel = scaleConfig.metersPerGrid / scaleConfig.gridPixelSize;

  // Raw calculations for active polygon
  const activeAreaM2 =
    activePoly && activePoly.points.length >= 3 && activePoly.isClosed
      ? calculatePolygonArea(activePoly.points, metersPerPixel)
      : 0;

  const activePerimeterM =
    activePoly && activePoly.points.length >= 2
      ? calculatePerimeter(activePoly.points, activePoly.isClosed, metersPerPixel)
      : 0;

  const sideCount = activePoly ? activePoly.points.length : 0;

  // Total area of all closed polygons combined
  const totalCombinedAreaM2 = polygons.reduce((acc, p) => {
    if (p.isClosed && p.points.length >= 3) {
      return acc + calculatePolygonArea(p.points, metersPerPixel);
    }
    return acc;
  }, 0);

  // Smooth animated count-up values
  const animatedArea = useCountUp(activeAreaM2, 350);
  const animatedPerimeter = useCountUp(activePerimeterM, 350);
  const animatedTotalArea = useCountUp(totalCombinedAreaM2, 350);

  // Formatted representations
  const areaDisplay = formatArea(animatedArea);
  const perimeterDisplay = formatLength(animatedPerimeter);
  const totalAreaDisplay = formatArea(animatedTotalArea);

  // Individual sides for the breakdown list with click-to-edit support
  const sideSegments: {
    name: string;
    lengthM: number;
    formatted: string;
    p1: Point;
    p2: Point;
    edgeIndex: number;
  }[] = [];
  if (activePoly && activePoly.points.length >= 2) {
    const pts = activePoly.points;
    const numEdges = activePoly.isClosed && pts.length >= 3 ? pts.length : pts.length - 1;
    for (let i = 0; i < numEdges; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const dist = calculateDistance(p1, p2, metersPerPixel);
      const { primary, unit } = formatLength(dist);
      sideSegments.push({
        name: `Sisi ${i + 1}`,
        lengthM: dist,
        formatted: `${primary} ${unit}`,
        p1,
        p2,
        edgeIndex: i,
      });
    }
  }

  const handleStartRename = () => {
    if (activePoly) {
      setNameInput(activePoly.name);
      setIsEditingName(true);
    }
  };

  const handleSaveRename = () => {
    if (activePoly && nameInput.trim()) {
      onRenamePolygon(activePoly.id, nameInput.trim());
    }
    setIsEditingName(false);
  };

  return (
    <footer className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 z-20 pointer-events-none">
      <div className="max-w-4xl mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden pointer-events-auto transition-all duration-200">
        {/* Top Header bar inside panel: Active polygon name & Collapse Toggle */}
        <div className="px-4 py-2 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2 truncate">
            {activePoly ? (
              <>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activePoly.color }}
                />
                {isEditingName ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveRename();
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onBlur={handleSaveRename}
                      className="px-2 py-0.5 text-xs font-semibold bg-slate-950 border border-cyan-500 rounded text-slate-100 focus:outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Simpan Nama Bidang"
                      className="text-cyan-400 hover:text-cyan-300 p-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5 group cursor-pointer" onClick={handleStartRename}>
                    <span className="text-xs sm:text-sm font-bold text-slate-200 tracking-tight">
                      {activePoly.name}
                    </span>
                    <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                )}
                {!activePoly.isClosed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Sedang Digambar
                  </span>
                )}
                {!activePoly.isClosed && activePoly.points.length >= 3 && onClosePolygon && (
                  <button
                    type="button"
                    onClick={() => onClosePolygon(activePoly.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/30 cursor-pointer transition-all animate-pulse"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Tutup Bidang</span>
                  </button>
                )}

                {/* Open Vertex CRUD button */}
                {onOpenVertexManager && (
                  <button
                    type="button"
                    onClick={() => onOpenVertexManager(activePoly.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium cursor-pointer"
                    title="Kelola Titik Sudut (CRUD)"
                  >
                    <ListOrdered className="w-3 h-3 text-cyan-400" />
                    <span className="hidden xs:inline">Titik</span>
                    <span className="font-mono text-[10px]">({activePoly.points.length})</span>
                  </button>
                )}

                {/* Delete Shape Button */}
                {onDeletePolygon && (
                  <div className="relative">
                    {showConfirmDelete ? (
                      <div className="flex items-center gap-1 bg-rose-950/80 p-0.5 rounded-lg border border-rose-500/80">
                        <button
                          type="button"
                          onClick={() => {
                            onDeletePolygon(activePoly.id);
                            setShowConfirmDelete(false);
                          }}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold cursor-pointer"
                        >
                          Hapus Bidang
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowConfirmDelete(false)}
                          className="px-1.5 py-0.5 text-slate-400 hover:text-white text-[11px] cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowConfirmDelete(true)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer transition-colors"
                        title="Hapus Bidang Ini"
                        aria-label={`Hapus ${activePoly.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-400">Belum ada bidang terpilih</span>
            )}
          </div>

          {/* Right controls: Total polygons info & Expand sides button */}
          <div className="flex items-center gap-3">
            {polygons.length > 1 && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Total Gabungan: <strong className="font-mono text-cyan-300">{totalAreaDisplay.primary} {totalAreaDisplay.unit}</strong>
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Tutup Detail Sisi' : 'Buka Detail Sisi'}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>{sideSegments.length} Sisi</span>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="p-3 sm:p-4 grid grid-cols-3 gap-2 sm:gap-4 items-center">
          {/* 1. LUAS (Area) */}
          <div className="flex flex-col border-r border-slate-800/80 pr-2">
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Luas Bidang
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono-numbers text-xl sm:text-3xl font-extrabold text-cyan-400 tracking-tight">
                {areaDisplay.primary}
              </span>
              <span className="text-xs sm:text-sm font-bold text-cyan-300">
                {areaDisplay.unit}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs font-mono text-slate-400 mt-0.5 truncate">
              ≈ {areaDisplay.secondary}
            </span>
          </div>

          {/* 2. KELILING (Perimeter) */}
          <div className="flex flex-col border-r border-slate-800/80 pr-2 pl-1 sm:pl-2">
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Keliling
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono-numbers text-lg sm:text-2xl font-bold text-slate-100 tracking-tight">
                {perimeterDisplay.primary}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-400">
                {perimeterDisplay.unit}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
              {activePoly?.isClosed ? 'Batas tertutup' : 'Garis terbuka'}
            </span>
          </div>

          {/* 3. JUMLAH SISI (Sides count) */}
          <div className="flex flex-col pl-1 sm:pl-2">
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Bentuk Lahan
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono-numbers text-lg sm:text-2xl font-bold text-slate-100 tracking-tight">
                {sideCount}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-400">
                Titik / Sudut
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
              {sideCount < 3 ? 'Minimal 3 titik' : `${sideSegments.length} segmen sisi`}
            </span>
          </div>
        </div>

        {/* Multi-Polygon Combined Area Banner for Mobile */}
        {polygons.length > 1 && (
          <div className="sm:hidden px-4 py-1.5 bg-slate-950/60 border-t border-slate-800 text-[11px] flex justify-between items-center text-slate-300">
            <span>Total Semua Bidang:</span>
            <span className="font-mono font-bold text-cyan-300">
              {totalAreaDisplay.primary} {totalAreaDisplay.unit} ({polygons.length} bidang)
            </span>
          </div>
        )}

        {/* Expandable Breakdown of All Sides (S1, S2, ...) */}
        {isExpanded && (
          <div className="px-4 pb-3 pt-1 border-t border-slate-800 bg-slate-950/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                Rincian Panjang Tiap Sisi ({sideSegments.length}):
              </span>
              <span className="text-[10px] text-slate-400">Diukur berurutan searah jarum jam</span>
            </div>
            {sideSegments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                Tambahkan minimal 2 titik untuk melihat rincian sisi.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-44 overflow-y-auto pr-1">
                {sideSegments.map((side, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (onEditEdgeRequest && activePoly) {
                        onEditEdgeRequest({
                          polygonId: activePoly.id,
                          edgeIndex: side.edgeIndex,
                          currentLengthMeters: side.lengthM,
                          p1: side.p1,
                          p2: side.p2,
                        });
                      }
                    }}
                    title={`Klik untuk mengetik angka panjang ${side.name}`}
                    className="p-2 sm:p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 active:bg-slate-700/80 border border-slate-800 hover:border-cyan-500/60 flex flex-col items-start transition-all cursor-pointer group text-left"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-semibold text-slate-400 group-hover:text-cyan-400 transition-colors">
                        {side.name}
                      </span>
                      <span className="text-[10px] text-slate-500 group-hover:text-cyan-300 font-medium">
                        ✎ Ubah
                      </span>
                    </div>
                    <span className="font-mono text-xs sm:text-sm font-bold text-slate-100 mt-1 group-hover:text-cyan-200">
                      {side.formatted}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
};
