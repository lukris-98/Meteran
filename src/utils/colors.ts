export interface PolygonColor {
  id: string;
  name: string;
  stroke: string;
  fill: string;
  glow: string;
}

export const POLYGON_COLORS: PolygonColor[] = [
  {
    id: 'cyan',
    name: 'Sian (Default)',
    stroke: '#06b6d4',
    fill: 'rgba(6, 182, 212, 0.22)',
    glow: 'rgba(6, 182, 212, 0.45)',
  },
  {
    id: 'emerald',
    name: 'Zamrud',
    stroke: '#10b981',
    fill: 'rgba(16, 185, 129, 0.22)',
    glow: 'rgba(16, 185, 129, 0.45)',
  },
  {
    id: 'amber',
    name: 'Kuning Jingga',
    stroke: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.22)',
    glow: 'rgba(245, 158, 11, 0.45)',
  },
  {
    id: 'purple',
    name: 'Ungu Elegan',
    stroke: '#8b5cf6',
    fill: 'rgba(139, 92, 246, 0.22)',
    glow: 'rgba(139, 92, 246, 0.45)',
  },
  {
    id: 'rose',
    name: 'Merah Mawar',
    stroke: '#f43f5e',
    fill: 'rgba(244, 63, 94, 0.22)',
    glow: 'rgba(244, 63, 94, 0.45)',
  },
  {
    id: 'blue',
    name: 'Biru Arsitek',
    stroke: '#3b82f6',
    fill: 'rgba(59, 130, 246, 0.22)',
    glow: 'rgba(59, 130, 246, 0.45)',
  },
];

export function getNextColor(index: number): string {
  return POLYGON_COLORS[index % POLYGON_COLORS.length].stroke;
}
