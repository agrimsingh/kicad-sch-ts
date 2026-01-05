// src/geometry/routing.ts

import { Point } from "../core/types";

const GRID_SIZE = 1.27;

export function snapToGrid(point: Point, gridSize: number = GRID_SIZE): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function isOnGrid(point: Point, gridSize: number = GRID_SIZE): boolean {
  const snapped = snapToGrid(point, gridSize);
  return (
    Math.abs(point.x - snapped.x) < 0.01 &&
    Math.abs(point.y - snapped.y) < 0.01
  );
}

export enum CornerDirection {
  AUTO = "auto",
  HORIZONTAL_FIRST = "horizontal_first",
  VERTICAL_FIRST = "vertical_first",
}

export interface RoutingResult {
  segments: Array<{ start: Point; end: Point }>;
  corner?: Point;
  isDirectRoute: boolean;
}

/**
 * Create orthogonal (Manhattan) routing between two points.
 *
 * CRITICAL: Remember KiCAD Y-axis is INVERTED in schematic space.
 */
export function createOrthogonalRouting(
  fromPos: Point,
  toPos: Point,
  cornerDirection: CornerDirection = CornerDirection.AUTO
): RoutingResult {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;

  // Check for direct routing (aligned on same axis)
  if (Math.abs(dx) < 0.01) {
    return {
      segments: [{ start: fromPos, end: toPos }],
      isDirectRoute: true,
    };
  }

  if (Math.abs(dy) < 0.01) {
    return {
      segments: [{ start: fromPos, end: toPos }],
      isDirectRoute: true,
    };
  }

  // Need L-shaped routing
  let corner: Point;

  if (cornerDirection === CornerDirection.AUTO) {
    cornerDirection =
      Math.abs(dx) >= Math.abs(dy)
        ? CornerDirection.HORIZONTAL_FIRST
        : CornerDirection.VERTICAL_FIRST;
  }

  if (cornerDirection === CornerDirection.HORIZONTAL_FIRST) {
    corner = { x: toPos.x, y: fromPos.y };
  } else {
    corner = { x: fromPos.x, y: toPos.y };
  }

  corner = snapToGrid(corner);

  return {
    segments: [
      { start: fromPos, end: corner },
      { start: corner, end: toPos },
    ],
    corner,
    isDirectRoute: false,
  };
}

export function validateRoutingResult(result: RoutingResult): boolean {
  if (result.segments.length === 0) return false;

  for (let i = 0; i < result.segments.length - 1; i++) {
    const end = result.segments[i].end;
    const nextStart = result.segments[i + 1].start;

    if (
      Math.abs(end.x - nextStart.x) > 0.01 ||
      Math.abs(end.y - nextStart.y) > 0.01
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate distance between two points.
 */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate Manhattan distance between two points.
 */
export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}
