// src/core/config.ts

import { Point } from "./types";

export interface GridSettings {
  size: number; // Default: 1.27 (50 mil)
  snapEnabled: boolean;
}

export interface PositioningSettings {
  defaultPropertyOffset: Point;
  referenceOffset: Point;
  valueOffset: Point;
}

export interface ToleranceSettings {
  positionTolerance: number; // Default: 0.001
  angleTolerance: number; // Default: 0.01
}

export interface KiCADConfig {
  grid: GridSettings;
  positioning: PositioningSettings;
  tolerance: ToleranceSettings;
  defaultTextSize: [number, number];
  defaultStrokeWidth: number;
  coordinateSystem: "kicad" | "standard";
}

export const DEFAULT_CONFIG: KiCADConfig = {
  grid: {
    size: 1.27,
    snapEnabled: true,
  },
  positioning: {
    defaultPropertyOffset: { x: 0, y: 0 },
    referenceOffset: { x: 1.27, y: -1.27 },
    valueOffset: { x: 1.27, y: 1.27 },
  },
  tolerance: {
    positionTolerance: 0.001,
    angleTolerance: 0.01,
  },
  defaultTextSize: [1.27, 1.27],
  defaultStrokeWidth: 0,
  coordinateSystem: "kicad",
};

let globalConfig: KiCADConfig = { ...DEFAULT_CONFIG };

export function getConfig(): KiCADConfig {
  return globalConfig;
}

export function setConfig(config: Partial<KiCADConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

export function resetConfig(): void {
  globalConfig = { ...DEFAULT_CONFIG };
}

export const GRID_SIZE = 1.27;

export function snapToGrid(point: Point): Point {
  return {
    x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
  };
}

export function isOnGrid(point: Point): boolean {
  const snapped = snapToGrid(point);
  return (
    Math.abs(point.x - snapped.x) < 0.001 &&
    Math.abs(point.y - snapped.y) < 0.001
  );
}

export function toSchematicPoint(point: Point): Point {
  if (getConfig().coordinateSystem === "standard") {
    return { x: point.x, y: -point.y };
  }
  return point;
}

export function fromSchematicPoint(point: Point): Point {
  if (getConfig().coordinateSystem === "standard") {
    return { x: point.x, y: -point.y };
  }
  return point;
}
