import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistance,
  calculatePerimeter,
  calculatePolygonArea,
  calculateCentroid,
  isPointInsidePolygon,
  snapToGrid,
  formatArea,
  formatLength,
  calculateBearingDegrees,
  calculateCornerAngle,
  formatDegrees,
  resizeEdgeLength,
} from './geoMath';

// Scale factor: 50 pixels = 1 meter -> metersPerPixel = 1 / 50 = 0.02
const SCALE = 1 / 50;

// ============================================================================
// SUITE 1: 20 TESTS ON RECTANGLES (Convex Quadrilaterals of various sizes)
// ============================================================================
for (let i = 1; i <= 20; i++) {
  test(`Test ${i}/100: Rectangle ${i * 5}m x ${i * 3}m area and perimeter`, () => {
    const widthMeters = i * 5;
    const heightMeters = i * 3;
    const widthPx = widthMeters * 50;
    const heightPx = heightMeters * 50;

    const rect = [
      { x: 0, y: 0 },
      { x: widthPx, y: 0 },
      { x: widthPx, y: heightPx },
      { x: 0, y: heightPx },
    ];

    const expectedArea = widthMeters * heightMeters;
    const expectedPerimeter = 2 * (widthMeters + heightMeters);

    const calculatedArea = calculatePolygonArea(rect, SCALE);
    const calculatedPerimeter = calculatePerimeter(rect, true, SCALE);

    assert.ok(
      Math.abs(calculatedArea - expectedArea) < 1e-6,
      `Rect area failed: got ${calculatedArea}, expected ${expectedArea}`
    );
    assert.ok(
      Math.abs(calculatedPerimeter - expectedPerimeter) < 1e-6,
      `Rect perimeter failed: got ${calculatedPerimeter}, expected ${expectedPerimeter}`
    );
  });
}

// ============================================================================
// SUITE 2: 20 TESTS ON TRIANGLES (Right, Scalene, and Isosceles Triangles)
// ============================================================================
for (let i = 1; i <= 20; i++) {
  test(`Test ${20 + i}/100: Right triangle with legs ${i * 4}m and ${i * 3}m`, () => {
    const aMeters = i * 4;
    const bMeters = i * 3;
    const cMeters = Math.hypot(aMeters, bMeters); // 5 * i

    const triangle = [
      { x: 0, y: 0 },
      { x: aMeters * 50, y: 0 },
      { x: 0, y: bMeters * 50 },
    ];

    const expectedArea = 0.5 * aMeters * bMeters;
    const expectedPerimeter = aMeters + bMeters + cMeters;

    const calculatedArea = calculatePolygonArea(triangle, SCALE);
    const calculatedPerimeter = calculatePerimeter(triangle, true, SCALE);

    assert.ok(
      Math.abs(calculatedArea - expectedArea) < 1e-6,
      `Triangle area failed: got ${calculatedArea}, expected ${expectedArea}`
    );
    assert.ok(
      Math.abs(calculatedPerimeter - expectedPerimeter) < 1e-6,
      `Triangle perimeter failed: got ${calculatedPerimeter}, expected ${expectedPerimeter}`
    );
  });
}

// ============================================================================
// SUITE 3: 20 TESTS ON ROTATED & TRANSLATED POLYGONS (Invariance Verification)
// ============================================================================
for (let i = 1; i <= 20; i++) {
  test(`Test ${40 + i}/100: Rotation & translation invariance at angle ${(i * Math.PI) / 10} rad`, () => {
    const angle = (i * Math.PI) / 10;
    const baseW = 10 * 50; // 10m
    const baseH = 6 * 50;  // 6m
    const expectedArea = 10 * 6; // 60 m²
    const expectedPerimeter = 2 * (10 + 6); // 32 m
    const offsetX = i * 250;
    const offsetY = -i * 180;

    // Rotate and translate rectangle
    const rawPoints = [
      { x: 0, y: 0 },
      { x: baseW, y: 0 },
      { x: baseW, y: baseH },
      { x: 0, y: baseH },
    ];

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const transformedPoints = rawPoints.map((pt) => ({
      x: pt.x * cos - pt.y * sin + offsetX,
      y: pt.x * sin + pt.y * cos + offsetY,
    }));

    const calculatedArea = calculatePolygonArea(transformedPoints, SCALE);
    const calculatedPerimeter = calculatePerimeter(transformedPoints, true, SCALE);

    assert.ok(
      Math.abs(calculatedArea - expectedArea) < 1e-4,
      `Rotated polygon area failed: got ${calculatedArea}, expected ${expectedArea}`
    );
    assert.ok(
      Math.abs(calculatedPerimeter - expectedPerimeter) < 1e-4,
      `Rotated polygon perimeter failed: got ${calculatedPerimeter}, expected ${expectedPerimeter}`
    );
  });
}

// ============================================================================
// SUITE 4: 20 TESTS ON REGULAR N-GONS (Pentagons, Hexagons, Octagons, etc.)
// ============================================================================
const N_VALUES = [5, 6, 8, 10, 12];
for (let i = 1; i <= 20; i++) {
  const n = N_VALUES[(i - 1) % N_VALUES.length];
  const radiusMeters = 5 + (i * 2);
  const radiusPx = radiusMeters * 50;

  test(`Test ${60 + i}/100: Regular ${n}-gon with circumradius ${radiusMeters}m`, () => {
    const points = [];
    for (let j = 0; j < n; j++) {
      const theta = (2 * Math.PI * j) / n;
      points.push({
        x: radiusPx * Math.cos(theta),
        y: radiusPx * Math.sin(theta),
      });
    }

    // Analytical regular polygon area: (n / 2) * R^2 * sin(2*pi / n)
    const expectedArea = 0.5 * n * radiusMeters * radiusMeters * Math.sin((2 * Math.PI) / n);
    // Analytical regular polygon perimeter: n * 2 * R * sin(pi / n)
    const expectedPerimeter = n * 2 * radiusMeters * Math.sin(Math.PI / n);

    const calculatedArea = calculatePolygonArea(points, SCALE);
    const calculatedPerimeter = calculatePerimeter(points, true, SCALE);

    assert.ok(
      Math.abs(calculatedArea - expectedArea) < 1e-4,
      `Regular ${n}-gon area failed: got ${calculatedArea}, expected ${expectedArea}`
    );
    assert.ok(
      Math.abs(calculatedPerimeter - expectedPerimeter) < 1e-4,
      `Regular ${n}-gon perimeter failed: got ${calculatedPerimeter}, expected ${expectedPerimeter}`
    );
  });
}

// ============================================================================
// SUITE 5: 20 TESTS ON CONCAVE / IRREGULAR L-SHAPES & CROSSES
// ============================================================================
for (let i = 1; i <= 20; i++) {
  test(`Test ${80 + i}/100: Concave L-shaped land parcel variation ${i}`, () => {
    // L-shape with main outer bounding box (10+i)m x (8+i)m minus cutout (5)m x (4)m
    const W = 10 + i;
    const H = 8 + i;
    const cutW = 4;
    const cutH = 3;

    // Six vertices in clockwise order
    const lShape = [
      { x: 0, y: 0 },
      { x: W * 50, y: 0 },
      { x: W * 50, y: (H - cutH) * 50 },
      { x: (W - cutW) * 50, y: (H - cutH) * 50 },
      { x: (W - cutW) * 50, y: H * 50 },
      { x: 0, y: H * 50 },
    ];

    const expectedArea = W * H - cutW * cutH;
    const expectedPerimeter = 2 * (W + H); // L-cut preserves bounding box perimeter!

    const calculatedArea = calculatePolygonArea(lShape, SCALE);
    const calculatedPerimeter = calculatePerimeter(lShape, true, SCALE);

    assert.ok(
      Math.abs(calculatedArea - expectedArea) < 1e-5,
      `L-shape area failed: got ${calculatedArea}, expected ${expectedArea}`
    );
    assert.ok(
      Math.abs(calculatedPerimeter - expectedPerimeter) < 1e-5,
      `L-shape perimeter failed: got ${calculatedPerimeter}, expected ${expectedPerimeter}`
    );
  });
}

// Additional verification of helper functions
test('Centroid, ray-casting, snap-to-grid, formatArea and formatLength check', () => {
  const sq = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  const c = calculateCentroid(sq);
  assert.equal(c.x, 50);
  assert.equal(c.y, 50);

  assert.equal(isPointInsidePolygon({ x: 50, y: 50 }, sq), true);
  assert.equal(isPointInsidePolygon({ x: 150, y: 50 }, sq), false);

  assert.deepEqual(snapToGrid({ x: 48, y: 99 }, 50), { x: 50, y: 100 });

  const fa = formatArea(25000);
  assert.equal(fa.unit, 'ha');
  assert.equal(fa.isHectare, true);

  const fl = formatLength(1500);
  assert.equal(fl.unit, 'km');
});

test('calculateBearingDegrees, calculateCornerAngle and formatDegrees verification', () => {
  // Bearing: East (0°), North (90° in screen space with -dy), West (180°), South (270°)
  const pOrigin = { x: 0, y: 0 };
  const pEast = { x: 50, y: 0 };
  const pNorth = { x: 0, y: -50 }; // In screen coords, negative y is up (North)
  const pWest = { x: -50, y: 0 };
  const pSouth = { x: 0, y: 50 }; // In screen coords, positive y is down (South)

  assert.equal(Math.round(calculateBearingDegrees(pOrigin, pEast)), 0);
  assert.equal(Math.round(calculateBearingDegrees(pOrigin, pNorth)), 90);
  assert.equal(Math.round(calculateBearingDegrees(pOrigin, pWest)), 180);
  assert.equal(Math.round(calculateBearingDegrees(pOrigin, pSouth)), 270);

  // Corner angle at perpendicular vertex: e.g. (50, 0) -> (0, 0) -> (0, 50)
  const corner90 = calculateCornerAngle(pEast, pOrigin, pSouth);
  assert.equal(Math.round(corner90), 90);

  // Collinear 180 deg
  const corner180 = calculateCornerAngle(pWest, pOrigin, pEast);
  assert.equal(Math.round(corner180), 180);

  // Degree formatting
  assert.equal(formatDegrees(90), '90,0°');
  assert.equal(formatDegrees(45.24), '45,2°');
});

test('resizeEdgeLength accurately modifies edge length in meters', () => {
  // A triangle: (0, 0) -> (100, 0) -> (0, 100) -> close
  // Segment 0 is from (0,0) to (100,0), initial length = 100px = 2 meters (at 50px/m)
  const triangle = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
  ];

  // Resize segment 0 from 2m to 5m (moveEnd)
  const resizedEnd = resizeEdgeLength(triangle, 0, 5, SCALE, 'moveEnd');
  assert.equal(resizedEnd[0].x, 0);
  assert.equal(resizedEnd[0].y, 0);
  assert.equal(resizedEnd[1].x, 250); // 5m * 50px/m = 250px
  assert.equal(resizedEnd[1].y, 0);
  assert.equal(calculateDistance(resizedEnd[0], resizedEnd[1], SCALE), 5);

  // Resize segment 0 from 2m to 4m (moveStart)
  const resizedStart = resizeEdgeLength(triangle, 0, 4, SCALE, 'moveStart');
  // p2 is at (100,0), so p1 should move to 100 - 200 = -100
  assert.equal(resizedStart[1].x, 100);
  assert.equal(resizedStart[0].x, -100);
  assert.equal(calculateDistance(resizedStart[0], resizedStart[1], SCALE), 4);
});
