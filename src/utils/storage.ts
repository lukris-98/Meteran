import { PolygonShape, ScaleConfig } from '../types/cad';

const STORAGE_KEY_POLYGONS = 'hitungtanah_polygons_v1';
const STORAGE_KEY_SCALE = 'hitungtanah_scale_v1';
const STORAGE_KEY_SNAP = 'hitungtanah_snap_v1';

export function saveStateToStorage(
  polygons: PolygonShape[],
  scale: ScaleConfig,
  snapToGrid: boolean
) {
  try {
    localStorage.setItem(STORAGE_KEY_POLYGONS, JSON.stringify(polygons));
    localStorage.setItem(STORAGE_KEY_SCALE, JSON.stringify(scale));
    localStorage.setItem(STORAGE_KEY_SNAP, JSON.stringify(snapToGrid));
  } catch (err) {
    console.warn('Gagal menyimpan ke localStorage:', err);
  }
}

export function loadStateFromStorage(): {
  polygons: PolygonShape[] | null;
  scale: ScaleConfig | null;
  snapToGrid: boolean | null;
} {
  try {
    const polyStr = localStorage.getItem(STORAGE_KEY_POLYGONS);
    const scaleStr = localStorage.getItem(STORAGE_KEY_SCALE);
    const snapStr = localStorage.getItem(STORAGE_KEY_SNAP);

    const parsed = polyStr ? JSON.parse(polyStr) : null;
    // Discard initial sample polygon if present
    const cleanedPolygons = parsed
      ? parsed.filter((p: PolygonShape) => p.id !== 'poly_default_1')
      : null;

    return {
      polygons: cleanedPolygons && cleanedPolygons.length > 0 ? cleanedPolygons : null,
      scale: scaleStr ? JSON.parse(scaleStr) : null,
      snapToGrid: snapStr !== null ? JSON.parse(snapStr) : null,
    };
  } catch (err) {
    console.warn('Gagal memuat dari localStorage:', err);
    return { polygons: null, scale: null, snapToGrid: null };
  }
}
