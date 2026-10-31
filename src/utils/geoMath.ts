import { Point } from '../types/cad';

/**
 * Calculates Euclidean distance between two points in meters
 */
export function calculateDistance(
  p1: Point,
  p2: Point,
  metersPerPixel: number
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy) * metersPerPixel;
}

/**
 * Calculates perimeter of polygon or polyline in meters
 */
export function calculatePerimeter(
  points: Point[],
  isClosed: boolean,
  metersPerPixel: number
): number {
  if (points.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < points.length - 1; i++) {
    perimeter += calculateDistance(points[i], points[i + 1], metersPerPixel);
  }
  if (isClosed && points.length >= 3) {
    perimeter += calculateDistance(points[points.length - 1], points[0], metersPerPixel);
  }
  return perimeter;
}

/**
 * Calculates polygon area in square meters using the Shoelace formula (Gauss's area formula).
 * Returns positive area.
 */
export function calculatePolygonArea(
  points: Point[],
  metersPerPixel: number
): number {
  if (points.length < 3) return 0;

  let sum = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += points[i].x * points[j].y;
    sum -= points[j].x * points[i].y;
  }

  const pixelArea = Math.abs(sum) / 2;
  return pixelArea * (metersPerPixel * metersPerPixel);
}

/**
 * Calculates geometric centroid of a polygon or average of points.
 */
export function calculateCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };
  if (points.length === 2) {
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }

  // True polygon centroid
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const factor = points[i].x * points[j].y - points[j].x * points[i].y;
    signedArea += factor;
    cx += (points[i].x + points[j].x) * factor;
    cy += (points[i].y + points[j].y) * factor;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-5) {
    // Fallback to arithmetic mean if collinear or self-intersecting degenerate
    let avgX = 0;
    let avgY = 0;
    for (const p of points) {
      avgX += p.x;
      avgY += p.y;
    }
    return { x: avgX / points.length, y: avgY / points.length };
  }

  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);
  return { x: cx, y: cy };
}

/**
 * Ray-casting algorithm to test if point is inside polygon
 */
export function isPointInsidePolygon(point: Point, points: Point[]): boolean {
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Projects point P onto line segment AB and finds the closest point on AB.
 */
export function findClosestPointOnSegment(
  p: Point,
  a: Point,
  b: Point
): { point: Point; t: number; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    const dist = Math.hypot(p.x - a.x, p.y - a.y);
    return { point: { ...a }, t: 0, distance: dist };
  }

  // Parameter t of projection on line AB
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const dist = Math.hypot(p.x - projX, p.y - projY);

  return { point: { x: projX, y: projY }, t, distance: dist };
}

/**
 * Finds the closest edge of a polygon to point P within maxDistance pixels.
 */
export function findClosestEdge(
  point: Point,
  points: Point[],
  maxDistance: number
): { edgeIndex: number; insertPoint: Point } | null {
  if (points.length < 2) return null;

  let minDistance = maxDistance;
  let bestEdge: { edgeIndex: number; insertPoint: Point } | null = null;
  const count = points.length;

  for (let i = 0; i < count; i++) {
    const nextIdx = (i + 1) % count;
    // If not closed, don't test closing edge
    if (nextIdx === 0 && points.length < 3) continue;

    const { point: projPoint, distance } = findClosestPointOnSegment(
      point,
      points[i],
      points[nextIdx]
    );

    if (distance < minDistance) {
      minDistance = distance;
      bestEdge = {
        edgeIndex: i,
        insertPoint: projPoint,
      };
    }
  }

  return bestEdge;
}

/**
 * Finds vertex index within hitRadius.
 */
export function findClosestVertex(
  point: Point,
  points: Point[],
  hitRadius: number
): number | null {
  let minDistance = hitRadius;
  let closestIndex: number | null = null;

  for (let i = 0; i < points.length; i++) {
    const dist = Math.hypot(points[i].x - point.x, points[i].y - point.y);
    if (dist <= minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * Snaps a coordinate point to nearest grid interval.
 */
export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/**
 * Formats area according to rules:
 * - If >= 10,000 m², format with hectares (ha) as primary or secondary.
 * - Always includes detailed formatted m² and hectare equivalents.
 */
export function formatArea(areaM2: number): {
  primary: string;
  secondary: string;
  unit: string;
  isHectare: boolean;
} {
  if (isNaN(areaM2) || areaM2 < 0) {
    return { primary: '0.00', secondary: '0 ha', unit: 'm²', isHectare: false };
  }

  if (areaM2 >= 10000) {
    const ha = areaM2 / 10000;
    const haFormatted = ha.toLocaleString('id-ID', {
      minimumFractionDigits: ha < 10 ? 3 : 2,
      maximumFractionDigits: ha < 10 ? 3 : 2,
    });
    const m2Formatted = areaM2.toLocaleString('id-ID', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });

    return {
      primary: haFormatted,
      secondary: `${m2Formatted} m²`,
      unit: 'ha',
      isHectare: true,
    };
  } else {
    const m2Formatted = areaM2.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const haFormatted = (areaM2 / 10000).toLocaleString('id-ID', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });

    return {
      primary: m2Formatted,
      secondary: `${haFormatted} ha`,
      unit: 'm²',
      isHectare: false,
    };
  }
}

/**
 * Formats length in meters or kilometers if >= 1000 m.
 */
export function formatLength(lengthM: number): {
  primary: string;
  unit: string;
} {
  if (isNaN(lengthM) || lengthM < 0) {
    return { primary: '0.00', unit: 'm' };
  }

  if (lengthM >= 1000) {
    const km = lengthM / 1000;
    return {
      primary: km.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
      }),
      unit: 'km',
    };
  }

  return {
    primary: lengthM.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    unit: 'm',
  };
}

/**
 * Calculates heading/bearing angle of a line in degrees (0° to 360°).
 * 0° = East (Right), 90° = North (Up), 180° = West (Left), 270° = South (Down).
 */
export function calculateBearingDegrees(from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return 0;
  // Screen coordinates has Y down, invert dy for standard math
  let deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  if (Math.abs(deg) < 1e-9 || Object.is(deg, -0)) deg = 0;
  return deg;
}

/**
 * Calculates interior/vertex angle at pVertex between incoming and outgoing line segments.
 * Returns angle in degrees (0° to 180°).
 */
export function calculateCornerAngle(
  pPrev: Point,
  pVertex: Point,
  pNext: Point
): number {
  const v1x = pPrev.x - pVertex.x;
  const v1y = pPrev.y - pVertex.y;
  const v2x = pNext.x - pVertex.x;
  const v2y = pNext.y - pVertex.y;

  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 0;

  const dot = v1x * v2x + v1y * v2y;
  const cosTheta = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Formats degree value with degree symbol (e.g., "90.0°").
 */
export function formatDegrees(deg: number): string {
  if (isNaN(deg)) return '0.0°';
  const clean = ((deg % 360) + 360) % 360;
  return `${clean.toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}°`;
}

/**
 * Resizes an edge to an exact length in meters.
 * Adjusts either the endpoint (moveEnd), start point (moveStart), or both symmetrically (both).
 */
export function resizeEdgeLength(
  points: Point[],
  edgeIndex: number,
  newLengthMeters: number,
  metersPerPixel: number,
  mode: 'moveEnd' | 'moveStart' | 'both' = 'moveEnd'
): Point[] {
  if (points.length < 2 || edgeIndex < 0 || edgeIndex >= points.length) {
    return points;
  }

  const p1 = points[edgeIndex];
  const nextIdx = (edgeIndex + 1) % points.length;
  const p2 = points[nextIdx];

  const targetPixels = newLengthMeters / metersPerPixel;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const currentLength = Math.hypot(dx, dy);

  // Unit direction vector along edge (p1 -> p2)
  const ux = currentLength > 0 ? dx / currentLength : 1;
  const uy = currentLength > 0 ? dy / currentLength : 0;

  const nextPoints = points.map((p) => ({ ...p }));

  if (mode === 'moveEnd') {
    nextPoints[nextIdx] = {
      x: p1.x + ux * targetPixels,
      y: p1.y + uy * targetPixels,
    };
  } else if (mode === 'moveStart') {
    nextPoints[edgeIndex] = {
      x: p2.x - ux * targetPixels,
      y: p2.y - uy * targetPixels,
    };
  } else if (mode === 'both') {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const halfLen = targetPixels / 2;
    nextPoints[edgeIndex] = {
      x: midX - ux * halfLen,
      y: midY - uy * halfLen,
    };
    nextPoints[nextIdx] = {
      x: midX + ux * halfLen,
      y: midY + uy * halfLen,
    };
  }

  return nextPoints;
}
