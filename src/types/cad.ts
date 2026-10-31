export interface Point {
  x: number;
  y: number;
}

export interface PolygonShape {
  id: string;
  name: string;
  color: string;
  points: Point[];
  isClosed: boolean;
  createdAt: number;
}

export type AppMode = 'draw' | 'edit';

export interface ScaleConfig {
  gridPixelSize: number; // typically 50px
  metersPerGrid: number; // default 1 meter per 50px grid
}

export interface DragState {
  type: 'none' | 'vertex' | 'polygon' | 'pan';
  polygonId?: string;
  vertexIndex?: number;
  startPointer?: Point;
  lastPointer?: Point;
  polygonStartPoints?: Point[];
}

export interface VertexDeletePrompt {
  polygonId: string;
  vertexIndex: number;
  screenPos: Point;
}

export interface ActiveLineDrag {
  originPoint: Point;
  targetPoint: Point;
  distanceMeters: number;
  bearingDegrees?: number;
  cornerAngleDegrees?: number;
}

export interface EditEdgeTarget {
  polygonId: string;
  edgeIndex: number;
  currentLengthMeters: number;
  p1: Point;
  p2: Point;
}

