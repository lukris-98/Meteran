import React, { useState } from 'react';
import { PolygonShape, ScaleConfig, Point } from '../types/cad';
import {
  calculateDistance,
  formatLength,
} from '../utils/geoMath';
import { X, Plus, Trash2, Edit3, Check, Navigation, AlertTriangle } from 'lucide-react';

interface VertexManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  polygon: PolygonShape | null;
  scaleConfig: ScaleConfig;
  onUpdatePoints: (polygonId: string, newPoints: Point[]) => void;
}

export const VertexManagerModal: React.FC<VertexManagerModalProps> = ({
  isOpen,
  onClose,
  polygon,
  scaleConfig,
  onUpdatePoints,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editXMeter, setEditXMeter] = useState<string>('');
  const [editYMeter, setEditYMeter] = useState<string>('');

  // New vertex inputs
  const [showAddForm, setShowAddForm] = useState(false);
  const [newXMeter, setNewXMeter] = useState<string>('0');
  const [newYMeter, setNewYMeter] = useState<string>('0');

  if (!isOpen || !polygon) return null;

  const metersPerPixel = scaleConfig.metersPerGrid / scaleConfig.gridPixelSize;
  const pixelsPerMeter = 1 / metersPerPixel;

  // Convert pixel to meter relative to origin
  const pxToMeter = (px: number) => px * metersPerPixel;
  const meterToPx = (m: number) => m * pixelsPerMeter;

  // Start editing a vertex
  const handleStartEdit = (index: number) => {
    const pt = polygon.points[index];
    setEditingIndex(index);
    setEditXMeter(pxToMeter(pt.x).toFixed(2));
    setEditYMeter(pxToMeter(pt.y).toFixed(2));
  };

  // Save edited vertex
  const handleSaveEdit = (index: number) => {
    const xNum = parseFloat(editXMeter);
    const yNum = parseFloat(editYMeter);
    if (isNaN(xNum) || isNaN(yNum)) return;

    const updated = polygon.points.map((p, idx) => {
      if (idx === index) {
        return {
          x: meterToPx(xNum),
          y: meterToPx(yNum),
        };
      }
      return p;
    });

    onUpdatePoints(polygon.id, updated);
    setEditingIndex(null);
  };

  // Delete a vertex
  const handleDeleteVertex = (index: number) => {
    const updated = polygon.points.filter((_, idx) => idx !== index);
    onUpdatePoints(polygon.id, updated);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  // Add new vertex
  const handleAddVertex = () => {
    const xNum = parseFloat(newXMeter);
    const yNum = parseFloat(newYMeter);
    if (isNaN(xNum) || isNaN(yNum)) return;

    const newPt: Point = {
      x: meterToPx(xNum),
      y: meterToPx(yNum),
    };

    onUpdatePoints(polygon.id, [...polygon.points, newPt]);
    setShowAddForm(false);
    setNewXMeter('0');
    setNewYMeter('0');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-xl shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: polygon.color }}
            />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Kelola Titik Sudut (CRUD)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  {polygon.name}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total {polygon.points.length} titik koordinat • Skala: 1 kotak = {scaleConfig.metersPerGrid}m
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Kelola Titik"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar: Add point toggle */}
        <div className="py-3 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-300">
            Daftar Titik Koordinat:
          </span>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Titik Manual</span>
          </button>
        </div>

        {/* Add point form */}
        {showAddForm && (
          <div className="mb-3 p-3 bg-slate-950/80 border border-cyan-500/40 rounded-2xl shrink-0 animate-in fade-in duration-150">
            <span className="text-xs font-semibold text-cyan-400 block mb-2">
              + Masukkan Koordinat Titik Baru (meter):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">X (meter)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newXMeter}
                  onChange={(e) => setNewXMeter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Y (meter)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newYMeter}
                  onChange={(e) => setNewYMeter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-end gap-1.5">
                <button
                  type="button"
                  onClick={handleAddVertex}
                  className="flex-1 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Simpan Titik
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Points Table / List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {polygon.points.length === 0 ? (
            <div className="p-6 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80">
              <Navigation className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">
                Belum ada titik di bidang ini. Ketuk kanvas atau gunakan tombol di atas untuk menambah titik.
              </p>
            </div>
          ) : (
            polygon.points.map((pt, idx) => {
              const isFirst = idx === 0;
              const isEditing = editingIndex === idx;
              const nextPt = polygon.points[(idx + 1) % polygon.points.length];
              const distToNext = calculateDistance(pt, nextPt, metersPerPixel);
              const { primary, unit } = formatLength(distToNext);

              return (
                <div
                  key={idx}
                  className="p-2.5 sm:p-3 bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
                >
                  {/* Point Label & Tag */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold text-white ${
                        isFirst ? 'bg-amber-500' : 'bg-cyan-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-slate-200">
                        Titik {idx + 1} {isFirst ? '(Titik Awal)' : ''}
                      </span>
                      {polygon.points.length > 1 && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Ke Titik {((idx + 1) % polygon.points.length) + 1}: {primary} {unit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Coordinates view or edit */}
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">X:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={editXMeter}
                          onChange={(e) => setEditXMeter(e.target.value)}
                          className="w-16 px-1.5 py-1 bg-slate-900 border border-cyan-400 rounded text-xs font-mono text-cyan-300 text-right"
                        />
                        <span className="text-[10px] text-slate-400">m</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Y:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={editYMeter}
                          onChange={(e) => setEditYMeter(e.target.value)}
                          className="w-16 px-1.5 py-1 bg-slate-900 border border-cyan-400 rounded text-xs font-mono text-cyan-300 text-right"
                        />
                        <span className="text-[10px] text-slate-400">m</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(idx)}
                        className="p-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg cursor-pointer font-bold"
                        title="Simpan Perubahan"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                        title="Batal"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <div className="flex items-center gap-2 font-mono text-xs text-cyan-300 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800">
                        <span>X: {pxToMeter(pt.x).toFixed(2)}m</span>
                        <span className="text-slate-600">•</span>
                        <span>Y: {pxToMeter(pt.y).toFixed(2)}m</span>
                      </div>

                      {/* Action buttons: Edit & Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(idx)}
                          aria-label={`Ubah koordinat Titik ${idx + 1}`}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
                          title="Edit Koordinat"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteVertex(idx)}
                          aria-label={`Hapus Titik ${idx + 1}`}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-900/50 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Hapus Titik Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Warning hint if polygon points < 3 */}
        {polygon.points.length > 0 && polygon.points.length < 3 && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Bidang membutuhkan minimal 3 titik untuk dapat dihitung luasnya.</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
