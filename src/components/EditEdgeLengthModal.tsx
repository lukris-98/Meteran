import React, { useState, useEffect } from 'react';
import { PolygonShape, ScaleConfig, EditEdgeTarget } from '../types/cad';
import { resizeEdgeLength, formatLength } from '../utils/geoMath';
import { Ruler, Check, X, ArrowRight, MoveHorizontal } from 'lucide-react';

interface EditEdgeLengthModalProps {
  target: EditEdgeTarget | null;
  polygon: PolygonShape | null;
  scaleConfig: ScaleConfig;
  isOpen: boolean;
  onClose: () => void;
  onApplyNewLength: (
    polygonId: string,
    edgeIndex: number,
    newLengthMeters: number,
    mode: 'moveEnd' | 'moveStart' | 'both'
  ) => void;
}

export const EditEdgeLengthModal: React.FC<EditEdgeLengthModalProps> = ({
  target,
  polygon,
  scaleConfig,
  isOpen,
  onClose,
  onApplyNewLength,
}) => {
  const [lengthInput, setLengthInput] = useState<string>('');
  const [resizeMode, setResizeMode] = useState<'moveEnd' | 'moveStart' | 'both'>('moveEnd');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setLengthInput(target.currentLengthMeters.toFixed(2));
      setErrorMsg(null);
      setResizeMode('moveEnd');
    }
  }, [target]);

  if (!isOpen || !target || !polygon) return null;

  const pts = polygon.points;
  const p1Idx = target.edgeIndex;
  const p2Idx = (target.edgeIndex + 1) % pts.length;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(lengthInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg('Masukkan angka panjang yang valid dan lebih dari 0 meter');
      return;
    }
    if (parsed > 10000) {
      setErrorMsg('Panjang maksimal adalah 10.000 meter');
      return;
    }

    onApplyNewLength(target.polygonId, target.edgeIndex, parsed, resizeMode);
    onClose();
  };

  const handleQuickAdd = (delta: number) => {
    const current = parseFloat(lengthInput.replace(',', '.')) || target.currentLengthMeters;
    const nextVal = Math.max(0.1, current + delta);
    setLengthInput(nextVal.toFixed(2));
    setErrorMsg(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-sm sm:max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-4 sm:p-6 text-slate-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                Ubah Panjang Sisi {target.edgeIndex + 1}
              </h3>
              <p className="text-xs text-slate-400">
                {polygon.name} • Titik {p1Idx + 1} <ArrowRight className="inline w-3 h-3" /> Titik {p2Idx + 1}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Info */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Panjang Saat Ini:</span>
          <span className="text-sm font-mono font-bold text-cyan-400">
            {formatLength(target.currentLengthMeters).primary} meter
          </span>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Ketik Panjang Baru (meter):
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.05"
                autoFocus
                value={lengthInput}
                onChange={(e) => {
                  setLengthInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Contoh: 15.50"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl font-mono text-base font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                meter
              </span>
            </div>
            {errorMsg && (
              <p className="text-[11px] text-rose-400 mt-1 font-medium">{errorMsg}</p>
            )}
          </div>

          {/* Quick Step Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 mr-1">Cepat:</span>
            {[-1, -0.5, 0.5, 1, 5].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => handleQuickAdd(delta)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300 transition-colors cursor-pointer"
              >
                {delta > 0 ? `+${delta}m` : `${delta}m`}
              </button>
            ))}
          </div>

          {/* Direction / Mode Selection */}
          <div className="mt-1">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Metode Perubahan Titik:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setResizeMode('moveEnd')}
                className={`px-2.5 py-2 rounded-xl text-left border text-xs font-medium transition-all cursor-pointer ${
                  resizeMode === 'moveEnd'
                    ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold text-[11px]">Geser Titik {p2Idx + 1}</div>
                <div className="text-[10px] opacity-75">Titik akhir maju/mundur</div>
              </button>
              <button
                type="button"
                onClick={() => setResizeMode('moveStart')}
                className={`px-2.5 py-2 rounded-xl text-left border text-xs font-medium transition-all cursor-pointer ${
                  resizeMode === 'moveStart'
                    ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold text-[11px]">Geser Titik {p1Idx + 1}</div>
                <div className="text-[10px] opacity-75">Titik awal maju/mundur</div>
              </button>
              <button
                type="button"
                onClick={() => setResizeMode('both')}
                className={`px-2.5 py-2 rounded-xl text-left border text-xs font-medium transition-all cursor-pointer ${
                  resizeMode === 'both'
                    ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="font-semibold text-[11px]">Simetris</div>
                <div className="text-[10px] opacity-75">Kedua sisi melebar rata</div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-900/40 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Terapkan Panjang Baru
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-medium border border-slate-700 transition-colors cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
