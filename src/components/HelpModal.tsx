import React from 'react';
import { X, Touchpad, Mouse, PenTool, Move, Magnet, Trash2 } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Panduan Hitung Tanah</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                CAD Tool
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Cara mudah mengukur lahan poligon di HP & Laptop</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Panduan"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mt-4 text-xs sm:text-sm text-slate-300">
          {/* Section 1: Mode Gambar */}
          <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <h4 className="font-semibold text-cyan-400 flex items-center gap-2 mb-2">
              <PenTool className="w-4 h-4" />
              1. Mode Gambar (Menaruh Titik Lahan)
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-slate-300 text-xs">
              <li>
                <strong>Ketuk layar:</strong> Menambahkan titik sudut (vertex) baru. Garis bantu kuning (rubber-band) mengikuti posisi pointer dengan label panjang langsung.
              </li>
              <li>
                <strong>Menutup Poligon:</strong> Ketuk kembali titik pertama (lingkaran oranye <span className="text-amber-400 font-bold">●</span>) setelah minimal 3 titik, atau <strong>ketuk dua kali (double-tap)</strong>.
              </li>
              <li>
                <strong>Snap Grid:</strong> Aktifkan ikon Magnet agar titik menempel otomatis ke garis grid 50px.
              </li>
            </ul>
          </div>

          {/* Section 2: Mode Geser / Edit */}
          <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <h4 className="font-semibold text-cyan-400 flex items-center gap-2 mb-2">
              <Move className="w-4 h-4" />
              2. Mode Geser (Ubah & Sesuaikan Bentuk)
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-slate-300 text-xs">
              <li>
                <strong>Tarik Titik (Drag Vertex):</strong> Sentuh dan geser titik sudut mana pun untuk mengubah bentuk lahan. Luas dan keliling ter-update otomatis secara real-time.
              </li>
              <li>
                <strong>Tambah Titik di Sisi:</strong> Ketuk garis sisi mana saja untuk menyisipkan titik sudut baru di posisi tersebut.
              </li>
              <li>
                <strong>Hapus Titik (Long-Press):</strong> Tekan dan tahan titik selama 0.5 detik hingga tombol konfirmasi hapus muncul.
              </li>
              <li>
                <strong>Geser Seluruh Bidang:</strong> Sentuh dan tarik titik tengah (lingkaran di pusat bidang) untuk memindahkan seluruh bentuk lahan.
              </li>
            </ul>
          </div>

          {/* Section 3: Navigasi Kanvas */}
          <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <h4 className="font-semibold text-cyan-400 flex items-center gap-2 mb-2">
              <Touchpad className="w-4 h-4" />
              3. Navigasi Zoom & Geser Kanvas
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-semibold text-slate-200 block mb-1 flex items-center gap-1">
                  <Touchpad className="w-3.5 h-3.5 text-cyan-400" /> Di Smartphone (HP):
                </span>
                <p className="text-slate-400 text-[11px]">
                  Cubit dua jari (pinch) untuk perbesar/perkecil layar. Geser dua jari untuk menggeser kanvas.
                </p>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-semibold text-slate-200 block mb-1 flex items-center gap-1">
                  <Mouse className="w-3.5 h-3.5 text-cyan-400" /> Di Komputer/Laptop:
                </span>
                <p className="text-slate-400 text-[11px]">
                  Putar roda mouse (scroll wheel) untuk zoom. Tarik area kosong di mode Geser untuk menggeser peta.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Skala & Satuan */}
          <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <h4 className="font-semibold text-cyan-400 flex items-center gap-2 mb-1.5">
              <Magnet className="w-4 h-4" />
              4. Skala & Konversi Satuan
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Atur nilai meter per kotak grid (default 1m). Luas dihitung dalam m² dan otomatis dikonversi ke Hektar (ha) jika luas mencapai 10.000 m². Keliling dikonversi ke km jika mencapai 1.000 meter.
            </p>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};
