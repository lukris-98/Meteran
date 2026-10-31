import React, { useState } from 'react';
import { PolygonShape, ScaleConfig } from '../types/cad';
import { calculatePerimeter, calculatePolygonArea, formatArea, formatLength } from '../utils/geoMath';
import { POLYGON_COLORS } from '../utils/colors';
import {
  X,
  Plus,
  Trash2,
  Copy,
  Layers,
  Edit2,
  Check,
  CheckCircle2,
} from 'lucide-react';

interface ShapeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  polygons: PolygonShape[];
  activePolygonId: string | null;
  scaleConfig: ScaleConfig;
  onSelectPolygon: (id: string) => void;
  onAddNewPolygon: () => void;
  onDeletePolygon: (id: string) => void;
  onDuplicatePolygon: (id: string) => void;
  onRenamePolygon: (id: string, newName: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onClearAll: () => void;
  onOpenVertexManager?: (polygonId: string) => void;
}

export const ShapeManagerModal: React.FC<ShapeManagerModalProps> = ({
  isOpen,
  onClose,
  polygons,
  activePolygonId,
  scaleConfig,
  onSelectPolygon,
  onAddNewPolygon,
  onDeletePolygon,
  onDuplicatePolygon,
  onRenamePolygon,
  onChangeColor,
  onClearAll,
  onOpenVertexManager,
}) => {
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const metersPerPixel = scaleConfig.metersPerGrid / scaleConfig.gridPixelSize;

  const totalAreaM2 = polygons.reduce((acc, p) => {
    if (p.isClosed && p.points.length >= 3) {
      return acc + calculatePolygonArea(p.points, metersPerPixel);
    }
    return acc;
  }, 0);

  const totalAreaFmt = formatArea(totalAreaM2);

  const handleStartRename = (poly: PolygonShape) => {
    setEditingNameId(poly.id);
    setTempName(poly.name);
  };

  const handleSaveRename = (id: string) => {
    if (tempName.trim()) {
      onRenamePolygon(id, tempName.trim());
    }
    setEditingNameId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-xl shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100">
                Manajemen Bidang Lahan (Shape Manager)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Kelola seleksi, duplikasi, dan hapus bidang poligon
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Manajemen Bidang"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Bar */}
        <div className="py-3 px-4 my-3 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[11px] text-slate-400 block">Total Bidang:</span>
            <span className="text-sm font-bold text-slate-200">{polygons.length} Bidang</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Total Luas Gabungan:</span>
            <span className="text-sm font-mono font-bold text-cyan-400">
              {totalAreaFmt.primary} {totalAreaFmt.unit}
            </span>
          </div>
        </div>

        {/* Action Top Bar */}
        <div className="flex items-center justify-between pb-2 shrink-0">
          <span className="text-xs font-semibold text-slate-300">
            Daftar Bidang:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddNewPolygon}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-md shadow-cyan-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Bidang Baru</span>
            </button>
            {polygons.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 text-xs font-medium transition-colors cursor-pointer"
              >
                Hapus Semua
              </button>
            )}
          </div>
        </div>

        {/* Polygon List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
          {polygons.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80">
              <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">
                Kanvas masih kosong. Klik tombol &quot;+ Bidang Baru&quot; di atas untuk mulai menggambar lahan.
              </p>
            </div>
          ) : (
            polygons.map((poly) => {
              const isSelected = poly.id === activePolygonId;
              const areaM2 = poly.isClosed && poly.points.length >= 3
                ? calculatePolygonArea(poly.points, metersPerPixel)
                : 0;
              const perimM = poly.points.length >= 2
                ? calculatePerimeter(poly.points, poly.isClosed, metersPerPixel)
                : 0;
              const areaFmt = formatArea(areaM2);
              const perimFmt = formatLength(perimM);

              return (
                <div
                  key={poly.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-slate-900/90 border-cyan-500 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Top row: Name & Selection Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate flex-1">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40"
                        style={{ backgroundColor: poly.color }}
                      />

                      {editingNameId === poly.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(poly.id);
                              if (e.key === 'Escape') setEditingNameId(null);
                            }}
                            className="px-2 py-0.5 text-xs font-bold bg-slate-950 border border-cyan-400 rounded text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(poly.id)}
                            className="p-1 text-cyan-400"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1.5 group cursor-pointer"
                          onClick={() => handleStartRename(poly)}
                        >
                          <span className="text-xs sm:text-sm font-bold text-slate-200">
                            {poly.name}
                          </span>
                          <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                        </div>
                      )}

                      {isSelected && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                          Terpilih
                        </span>
                      )}
                    </div>

                    {/* Quick Select button if not selected */}
                    {!isSelected && (
                      <button
                        type="button"
                        onClick={() => onSelectPolygon(poly.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      >
                        Pilih Bidang
                      </button>
                    )}
                  </div>

                  {/* Middle row: Stats (Points, Area, Perimeter) */}
                  <div className="mt-2 pt-2 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Titik Sudut:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {poly.points.length} titik {poly.isClosed ? '(tertutup)' : '(terbuka)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Luas:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {areaFmt.primary} {areaFmt.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Keliling:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {perimFmt.primary} {perimFmt.unit}
                      </span>
                    </div>
                  </div>

                  {/* Bottom row: Action Buttons */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    {/* Color palette */}
                    <div className="flex items-center gap-1">
                      {POLYGON_COLORS.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => onChangeColor(poly.id, col.stroke)}
                          className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                            poly.color === col.stroke ? 'scale-115 border-white shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: col.stroke }}
                          title={col.name}
                        />
                      ))}
                    </div>

                    {/* Shape Actions: Kelola Titik, Duplikat, Hapus */}
                    <div className="flex items-center gap-1.5">
                      {onOpenVertexManager && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectPolygon(poly.id);
                            onOpenVertexManager(poly.id);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                        >
                          Titik ({poly.points.length})
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDuplicatePolygon(poly.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Duplikasi Bidang Ini"
                        aria-label={`Duplikasi ${poly.name}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete with inline confirmation */}
                      {confirmDeleteId === poly.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePolygon(poly.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Ya, Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(poly.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Hapus Bidang Ini"
                          aria-label={`Hapus ${poly.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
