import React, { useState } from 'react';
import { PolygonShape, ScaleConfig } from '../types/cad';
import { calculatePerimeter, calculatePolygonArea, formatArea, formatLength } from '../utils/geoMath';
import { X, Image, FileJson, Check, Copy } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  polygons: PolygonShape[];
  scaleConfig: ScaleConfig;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  polygons,
  scaleConfig,
}) => {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const metersPerPixel = scaleConfig.metersPerGrid / scaleConfig.gridPixelSize;

  // Prepare JSON export payload
  const exportData = {
    appName: 'Hitung Tanah',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    scale: {
      metersPerGrid: scaleConfig.metersPerGrid,
      gridPixelSize: scaleConfig.gridPixelSize,
      metersPerPixel,
    },
    polygons: polygons.map((p) => {
      const areaM2 = p.isClosed && p.points.length >= 3 ? calculatePolygonArea(p.points, metersPerPixel) : 0;
      const perimeterM = p.points.length >= 2 ? calculatePerimeter(p.points, p.isClosed, metersPerPixel) : 0;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        isClosed: p.isClosed,
        vertexCount: p.points.length,
        areaM2,
        areaFormatted: formatArea(areaM2),
        perimeterM,
        perimeterFormatted: formatLength(perimeterM),
        vertices: p.points,
      };
    }),
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hitung-tanah-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = async () => {
    let summary = `📍 HASIL PENGUKURAN LAHAN - HITUNG TANAH\nTanggal: ${new Date().toLocaleDateString('id-ID')}\nSkala: 1 kotak (${scaleConfig.gridPixelSize}px) = ${scaleConfig.metersPerGrid} meter\n---------------------------------\n`;

    exportData.polygons.forEach((p, idx) => {
      summary += `${idx + 1}. ${p.name}\n`;
      summary += `   • Luas: ${p.areaFormatted.primary} ${p.areaFormatted.unit} (≈ ${p.areaFormatted.secondary})\n`;
      summary += `   • Keliling: ${p.perimeterFormatted.primary} ${p.perimeterFormatted.unit}\n`;
      summary += `   • Jumlah Sudut: ${p.vertexCount} titik\n\n`;
    });

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleDownloadPNG = () => {
    setExporting(true);
    try {
      // Find canvas or generate dedicated high-res export canvas
      const exportCanvas = document.createElement('canvas');
      const width = 1920;
      const height = 1080;
      exportCanvas.width = width;
      exportCanvas.height = height;
      const ctx = exportCanvas.getContext('2d');

      if (!ctx) return;

      // Dark CAD background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Fine grid
      const gridSize = 50;
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = '#1e293b';
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Major grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#334155';
      for (let x = 0; x <= width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Calculate bounding box of all polygons to auto-frame nicely
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let totalPts = 0;
      polygons.forEach((poly) => {
        poly.points.forEach((pt) => {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
          totalPts++;
        });
      });

      ctx.save();
      if (totalPts > 0 && isFinite(minX)) {
        const polyW = Math.max(100, maxX - minX);
        const polyH = Math.max(100, maxY - minY);
        const padding = 160;
        const scaleX = (width - padding * 2) / polyW;
        const scaleY = (height - padding * 2) / polyH;
        const autoZoom = Math.min(1.5, Math.min(scaleX, scaleY));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        ctx.translate(width / 2, height / 2);
        ctx.scale(autoZoom, autoZoom);
        ctx.translate(-centerX, -centerY);

        // Draw each polygon
        polygons.forEach((poly) => {
          if (poly.points.length === 0) return;
          ctx.beginPath();
          ctx.moveTo(poly.points[0].x, poly.points[0].y);
          for (let i = 1; i < poly.points.length; i++) {
            ctx.lineTo(poly.points[i].x, poly.points[i].y);
          }
          if (poly.isClosed && poly.points.length >= 3) {
            ctx.closePath();
            ctx.fillStyle = `${poly.color}2e`;
            ctx.fill();
          }
          ctx.strokeStyle = poly.color;
          ctx.lineWidth = 3 / autoZoom;
          ctx.stroke();

          // Vertices
          poly.points.forEach((pt, i) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6 / autoZoom, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#f59e0b' : poly.color;
            ctx.fill();
            ctx.lineWidth = 2 / autoZoom;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
          });
        });
      }
      ctx.restore();

      // Header card
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(40, 40, 450, 180, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText('HITUNG TANAH', 65, 80);

      ctx.fillStyle = '#38bdf8';
      ctx.font = "600 14px 'JetBrains Mono', monospace";
      ctx.fillText(`Skala: 1 kotak = ${scaleConfig.metersPerGrid} meter`, 65, 110);

      const totalClosed = polygons.filter((p) => p.isClosed && p.points.length >= 3);
      const totalArea = totalClosed.reduce((sum, p) => sum + calculatePolygonArea(p.points, metersPerPixel), 0);
      const totalFmt = formatArea(totalArea);

      ctx.fillStyle = '#94a3b8';
      ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(`Jumlah Bidang: ${polygons.length} | Tertutup: ${totalClosed.length}`, 65, 140);

      ctx.fillStyle = '#4ade80';
      ctx.font = "bold 16px 'JetBrains Mono', monospace";
      ctx.fillText(`Total Luas: ${totalFmt.primary} ${totalFmt.unit} (≈ ${totalFmt.secondary})`, 65, 175);

      // Watermark in bottom right
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = "600 16px 'JetBrains Mono', monospace";
      ctx.textAlign = 'right';
      ctx.fillText('Hitung Tanah • CAD Land Surveyor', width - 40, height - 40);

      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.fillText(new Date().toLocaleString('id-ID'), width - 40, height - 20);

      // Download PNG
      const link = document.createElement('a');
      link.download = `peta-hitung-tanah-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl text-slate-100 relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100">Ekspor & Bagikan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Simpan gambar peta atau unduh data pengukuran</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Dialog Ekspor"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 mt-4">
          {/* Option 1: PNG Image */}
          <button
            type="button"
            onClick={handleDownloadPNG}
            disabled={exporting}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition-all text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
              <Image className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-slate-200 block">
                Unduh Gambar Peta (PNG)
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Resolusi tinggi dengan grid, rincian luas, & watermark
              </span>
            </div>
          </button>

          {/* Option 2: JSON Data */}
          <button
            type="button"
            onClick={handleDownloadJSON}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 transition-all text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <FileJson className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-slate-200 block">
                Unduh Data Koordinat (JSON)
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Koordinat vertex, panjang sisi, dan hasil hitung lengkap
              </span>
            </div>
          </button>

          {/* Option 3: Copy Text Summary */}
          <button
            type="button"
            onClick={handleCopySummary}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 transition-all text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-slate-200 block">
                {copied ? 'Tersalin ke Clipboard!' : 'Salin Ringkasan Teks'}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Format teks rapi untuk dikirim via WhatsApp atau catatan
              </span>
            </div>
          </button>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 text-center">
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
