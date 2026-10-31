import React, { useState } from 'react';
import {
  PenTool,
  Move,
  Magnet,
  Undo2,
  Redo2,
  RotateCcw,
  Download,
  Share2,
  Plus,
  HelpCircle,
  Sliders,
  ChevronDown,
  Layers,
  Trash2,
  ListOrdered,
} from 'lucide-react';
import { AppMode, PolygonShape, ScaleConfig } from '../types/cad';
import { POLYGON_COLORS } from '../utils/colors';

interface ToolbarProps {
  mode: AppMode;
  onSetMode: (mode: AppMode) => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  scaleConfig: ScaleConfig;
  onChangeMetersPerGrid: (meters: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onOpenExport: () => void;
  onShare: () => void;
  onOpenHelp: () => void;
  polygons: PolygonShape[];
  activePolygonId: string | null;
  onSelectPolygon: (id: string) => void;
  onAddNewPolygon: () => void;
  onChangePolygonColor: (id: string, color: string) => void;
  onOpenShapeManager: () => void;
  onOpenVertexManager?: () => void;
  onDeleteActivePolygon?: () => void;
}

const PRESET_SCALES = [0.5, 1, 2, 5];

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  onSetMode,
  snapToGrid,
  onToggleSnap,
  scaleConfig,
  onChangeMetersPerGrid,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onOpenExport,
  onShare,
  onOpenHelp,
  polygons,
  activePolygonId,
  onSelectPolygon,
  onAddNewPolygon,
  onChangePolygonColor,
  onOpenShapeManager,
  onOpenVertexManager,
  onDeleteActivePolygon,
}) => {
  const [showScaleMenu, setShowScaleMenu] = useState(false);
  const [showPolyMenu, setShowPolyMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const activePoly = polygons.find((p) => p.id === activePolygonId);

  return (
    <header className="absolute top-0 left-0 right-0 z-20 pointer-events-none p-1.5 sm:p-3">
      <div className="flex items-center gap-1.5 sm:gap-2 max-w-7xl mx-auto overflow-x-auto no-scrollbar pointer-events-auto px-1 py-1">
        {/* Left Side: Brand Logo & Primary Mode Switcher */}
        <div className="flex items-center gap-1 sm:gap-2 bg-slate-900/90 backdrop-blur-md p-1 sm:p-1.5 rounded-2xl border border-slate-700/70 shadow-xl shrink-0">
          {/* Logo badge */}
          <div className="flex items-center gap-1.5 pl-1.5 pr-1 sm:pr-2.5 py-0.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center text-white shadow-inner font-bold text-xs sm:text-sm">
              HT
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight leading-none">
                Hitung Tanah
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">v1.0 CAD</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-slate-950/60 p-0.5 sm:p-1 rounded-xl border border-slate-800/80">
            <button
              type="button"
              onClick={() => onSetMode('draw')}
              aria-label="Mode Tarik Garis Poligon"
              title="Mode Tarik Garis Lahan"
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[40px] sm:min-h-[44px] ${
                mode === 'draw'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Garis</span>
            </button>

            <button
              type="button"
              onClick={() => onSetMode('edit')}
              aria-label="Mode Geser dan Ubah Bentuk"
              title="Mode Geser & Ubah Titik"
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[40px] sm:min-h-[44px] ${
                mode === 'edit'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Move className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Geser</span>
            </button>
          </div>

          {/* Snap-to-Grid Toggle */}
          <button
            type="button"
            onClick={onToggleSnap}
            aria-label={snapToGrid ? 'Matikan Snap ke Grid' : 'Aktifkan Snap ke Grid'}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-all cursor-pointer min-h-[40px] sm:min-h-[44px] border ${
              snapToGrid
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-950/40 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            title="Snap ke Grid 50px"
          >
            <Magnet className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${snapToGrid ? 'text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Snap</span>
          </button>
        </div>

        {/* Center/Right Side: Scale, Multi-Polygon, Shape Management, Undo, Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 sm:p-1.5 rounded-2xl border border-slate-700/70 shadow-xl shrink-0">
          {/* Scale Control Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowScaleMenu(!showScaleMenu);
                setShowPolyMenu(false);
              }}
              aria-label="Pengaturan Skala Grid"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-mono bg-slate-950/60 border border-slate-800 text-slate-200 hover:border-slate-700 min-h-[40px] sm:min-h-[44px] cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xs:inline text-slate-400 font-sans text-[11px]">Skala:</span>
              <span className="font-bold text-cyan-300">{scaleConfig.metersPerGrid}m</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showScaleMenu && (
              <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 w-56 p-3 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-slate-200">
                <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                  1 Kotak Grid (50px) =
                </span>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {PRESET_SCALES.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        onChangeMetersPerGrid(val);
                        setShowScaleMenu(false);
                      }}
                      className={`py-1.5 text-xs font-mono rounded-lg border cursor-pointer min-h-[36px] ${
                        scaleConfig.metersPerGrid === val
                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                          : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {val}m
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Kustom:</span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    max="1000"
                    value={scaleConfig.metersPerGrid}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value);
                      if (!isNaN(num) && num > 0) {
                        onChangeMetersPerGrid(num);
                      }
                    }}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 text-right"
                  />
                  <span className="text-xs font-mono text-slate-300">meter</span>
                </div>
              </div>
            )}
          </div>

          {/* Shape Selector & Shape Manager Button */}
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setShowPolyMenu(!showPolyMenu);
                setShowScaleMenu(false);
              }}
              aria-label="Pilih Bidang Poligon"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs bg-slate-950/60 border border-slate-800 text-slate-200 hover:border-slate-700 min-h-[40px] sm:min-h-[44px] cursor-pointer"
            >
              <div
                className="w-3 h-3 rounded-full border border-white/50"
                style={{ backgroundColor: activePoly?.color || '#38bdf8' }}
              />
              <span className="max-w-[75px] sm:max-w-[100px] truncate font-medium">
                {activePoly ? activePoly.name : 'Bidang'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Shape Manager Modal Trigger (Kelola Bidang) */}
            <button
              type="button"
              onClick={onOpenShapeManager}
              aria-label="Buka Manajemen Semua Bidang"
              title="Manajemen Bidang (Shape Manager)"
              className="flex items-center gap-1 px-2 sm:px-2.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 min-h-[40px] sm:min-h-[44px] cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline text-xs font-medium">Kelola</span>
              <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-300">
                {polygons.length}
              </span>
            </button>

            {/* Delete Selected Shape Button */}
            {activePoly && onDeleteActivePolygon && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                  aria-label={`Hapus ${activePoly.name}`}
                  title={`Hapus ${activePoly.name}`}
                  className="p-2 sm:px-2.5 rounded-xl bg-slate-950/60 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 border border-slate-800 min-h-[40px] sm:min-h-[44px] min-w-[40px] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                </button>

                {showDeleteConfirm && (
                  <div className="absolute top-full mt-2 right-0 w-48 p-2.5 bg-slate-900 border border-rose-500/80 rounded-2xl shadow-2xl z-50 text-slate-200">
                    <span className="text-xs font-bold text-rose-400 block mb-1">
                      Hapus {activePoly.name}?
                    </span>
                    <span className="text-[10px] text-slate-400 block mb-2">
                      Seluruh titik pada bidang ini akan dihapus.
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteActivePolygon();
                          setShowDeleteConfirm(false);
                        }}
                        className="flex-1 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Ya, Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Vertex CRUD Modal Trigger Button */}
            {activePoly && onOpenVertexManager && (
              <button
                type="button"
                onClick={onOpenVertexManager}
                aria-label="Kelola Titik Sudut Bidang Aktif (CRUD)"
                title="Kelola Titik Sudut (CRUD)"
                className="flex items-center gap-1 px-2 sm:px-2.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 min-h-[40px] sm:min-h-[44px] cursor-pointer"
              >
                <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden lg:inline text-xs font-medium">Titik</span>
                <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-cyan-300">
                  {activePoly.points.length}
                </span>
              </button>
            )}

            {/* Dropdown Menu for Polygons */}
            {showPolyMenu && (
              <div className="absolute top-full mt-2 right-0 w-64 p-3 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-slate-200">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-300">Daftar Bidang Lahan</span>
                  <button
                    type="button"
                    onClick={() => {
                      onAddNewPolygon();
                      setShowPolyMenu(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Baru
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-1">
                  {polygons.length === 0 ? (
                    <span className="text-xs text-slate-500 italic py-2 text-center block">
                      Belum ada bidang
                    </span>
                  ) : (
                    polygons.map((p) => {
                      const isSelected = p.id === activePolygonId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            onSelectPolygon(p.id);
                            setShowPolyMenu(false);
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border ${
                            isSelected
                              ? 'bg-slate-800/80 border-cyan-500/60 text-white'
                              : 'bg-slate-950/40 border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white/40"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="truncate font-medium">{p.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {p.points.length} titik {p.isClosed ? '(tertutup)' : ''}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {activePoly && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">
                      Warna Bidang Aktif:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {POLYGON_COLORS.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => onChangePolygonColor(activePoly.id, col.stroke)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                            activePoly.color === col.stroke
                              ? 'scale-110 border-white'
                              : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: col.stroke }}
                          title={col.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Undo and Redo */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo Perubahan (Ctrl+Z)"
            title="Undo (Ctrl+Z)"
            className="p-2 sm:px-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-950/50 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors min-h-[40px] sm:min-h-[44px] min-w-[40px] flex items-center justify-center cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo Perubahan"
            title="Redo"
            className="p-2 sm:px-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-950/50 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors min-h-[40px] sm:min-h-[44px] min-w-[40px] flex items-center justify-center cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onReset}
            aria-label="Kosongkan Kanvas / Reset Semua"
            title="Kosongkan Kanvas"
            className="p-2 sm:px-2.5 rounded-xl text-slate-300 hover:text-rose-400 bg-slate-950/50 hover:bg-slate-800 transition-colors min-h-[40px] sm:min-h-[44px] min-w-[40px] flex items-center justify-center cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-slate-800" />

          {/* Export & Share buttons */}
          <button
            type="button"
            onClick={onOpenExport}
            aria-label="Ekspor Gambar & Data"
            title="Ekspor (PNG & JSON)"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 border border-slate-800 transition-colors min-h-[40px] sm:min-h-[44px] cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span className="hidden xl:inline text-xs font-semibold">Ekspor</span>
          </button>

          <button
            type="button"
            onClick={onShare}
            aria-label="Bagikan Hasil Pengukuran"
            title="Bagikan"
            className="p-2 sm:px-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-950/50 hover:bg-slate-800 transition-colors min-h-[40px] sm:min-h-[44px] min-w-[40px] flex items-center justify-center cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Help Button */}
          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="Petunjuk Penggunaan"
            title="Petunjuk"
            className="p-2 sm:px-2.5 rounded-xl text-slate-300 hover:text-cyan-400 bg-slate-950/50 hover:bg-slate-800 transition-colors min-h-[40px] sm:min-h-[44px] min-w-[40px] flex items-center justify-center cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
