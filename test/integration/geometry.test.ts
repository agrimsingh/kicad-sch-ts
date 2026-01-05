// test/integration/geometry.test.ts

import {
  createOrthogonalRouting,
  CornerDirection,
  snapToGrid,
  isOnGrid,
  validateRoutingResult,
  distance,
  manhattanDistance,
} from "../../src/geometry/routing";

import {
  createBoundingBox,
  getBoundingBoxWidth,
  getBoundingBoxHeight,
  getBoundingBoxCenter,
  expandBoundingBox,
  boundingBoxesOverlap,
  mergeBoundingBoxes,
  pointInBoundingBox,
  SymbolBoundingBoxCalculator,
} from "../../src/geometry/symbol-bbox";

describe("Routing", () => {
  it("should create direct route for horizontally aligned points", () => {
    const result = createOrthogonalRouting(
      { x: 100, y: 100 },
      { x: 150, y: 100 }
    );

    expect(result.isDirectRoute).toBe(true);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].start).toEqual({ x: 100, y: 100 });
    expect(result.segments[0].end).toEqual({ x: 150, y: 100 });
  });

  it("should create direct route for vertically aligned points", () => {
    const result = createOrthogonalRouting(
      { x: 100, y: 100 },
      { x: 100, y: 150 }
    );

    expect(result.isDirectRoute).toBe(true);
    expect(result.segments).toHaveLength(1);
  });

  it("should create L-shaped route for non-aligned points", () => {
    const result = createOrthogonalRouting(
      { x: 100, y: 100 },
      { x: 150, y: 150 }
    );

    expect(result.isDirectRoute).toBe(false);
    expect(result.segments).toHaveLength(2);
    expect(result.corner).toBeDefined();
  });

  it("should respect horizontal first corner direction", () => {
    const result = createOrthogonalRouting(
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      CornerDirection.HORIZONTAL_FIRST
    );

    expect(result.corner?.y).toBe(100);
  });

  it("should respect vertical first corner direction", () => {
    const result = createOrthogonalRouting(
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      CornerDirection.VERTICAL_FIRST
    );

    expect(result.corner?.x).toBe(100);
  });

  it("should validate valid routing result", () => {
    const result = createOrthogonalRouting(
      { x: 100, y: 100 },
      { x: 150, y: 150 }
    );

    expect(validateRoutingResult(result)).toBe(true);
  });

  it("should snap points to grid", () => {
    const point = snapToGrid({ x: 100.5, y: 101.3 });
    expect(point.x).toBeCloseTo(100.33, 1);
    expect(point.y).toBeCloseTo(101.6, 1);
  });

  it("should check if point is on grid", () => {
    expect(isOnGrid({ x: 100.33, y: 100.33 })).toBe(false); // Off by small amount
    expect(isOnGrid({ x: 127, y: 127 })).toBe(true); // 100 * 1.27
  });

  it("should calculate distance between points", () => {
    const d = distance({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(d).toBe(5);
  });

  it("should calculate manhattan distance", () => {
    const d = manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(d).toBe(7);
  });
});

describe("Bounding Box", () => {
  it("should create bounding box", () => {
    const bbox = createBoundingBox(0, 0, 10, 20);
    expect(bbox.minX).toBe(0);
    expect(bbox.minY).toBe(0);
    expect(bbox.maxX).toBe(10);
    expect(bbox.maxY).toBe(20);
  });

  it("should calculate width and height", () => {
    const bbox = createBoundingBox(0, 0, 10, 20);
    expect(getBoundingBoxWidth(bbox)).toBe(10);
    expect(getBoundingBoxHeight(bbox)).toBe(20);
  });

  it("should calculate center", () => {
    const bbox = createBoundingBox(0, 0, 10, 20);
    const center = getBoundingBoxCenter(bbox);
    expect(center.x).toBe(5);
    expect(center.y).toBe(10);
  });

  it("should expand bounding box", () => {
    const bbox = createBoundingBox(0, 0, 10, 10);
    const expanded = expandBoundingBox(bbox, 5);
    expect(expanded.minX).toBe(-5);
    expect(expanded.minY).toBe(-5);
    expect(expanded.maxX).toBe(15);
    expect(expanded.maxY).toBe(15);
  });

  it("should detect overlapping bounding boxes", () => {
    const bbox1 = createBoundingBox(0, 0, 10, 10);
    const bbox2 = createBoundingBox(5, 5, 15, 15);
    const bbox3 = createBoundingBox(20, 20, 30, 30);

    expect(boundingBoxesOverlap(bbox1, bbox2)).toBe(true);
    expect(boundingBoxesOverlap(bbox1, bbox3)).toBe(false);
  });

  it("should merge bounding boxes", () => {
    const boxes = [
      createBoundingBox(0, 0, 10, 10),
      createBoundingBox(5, 5, 20, 20),
    ];
    const merged = mergeBoundingBoxes(boxes);

    expect(merged).toBeDefined();
    expect(merged!.minX).toBe(0);
    expect(merged!.minY).toBe(0);
    expect(merged!.maxX).toBe(20);
    expect(merged!.maxY).toBe(20);
  });

  it("should check if point is in bounding box", () => {
    const bbox = createBoundingBox(0, 0, 10, 10);

    expect(pointInBoundingBox({ x: 5, y: 5 }, bbox)).toBe(true);
    expect(pointInBoundingBox({ x: 15, y: 5 }, bbox)).toBe(false);
  });

  it("should return default bbox for undefined symbol", () => {
    const bbox = SymbolBoundingBoxCalculator.calculateBoundingBox(
      undefined as any
    );
    expect(bbox).toBeDefined();
    expect(getBoundingBoxWidth(bbox)).toBeGreaterThan(0);
  });
});
