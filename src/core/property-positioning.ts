// src/core/property-positioning.ts

import { SymbolLibraryCache, getSymbolCache } from "../library/cache";
import { SymbolBoundingBoxCalculator } from "../geometry/symbol-bbox";
import { DEFAULT_TEXT_HEIGHT } from "../geometry/font-metrics";
import { Point } from "./types";

export interface PropertyOffset {
  x: number;
  y: number;
  rotation: number;
}

export interface ComponentPositioningRule {
  referenceOffset: PropertyOffset;
  valueOffset: PropertyOffset;
  footprintOffset?: PropertyOffset;
}

const POSITIONING_RULES: Record<string, ComponentPositioningRule> = {
  "Device:R": {
    referenceOffset: { x: 2.54, y: -1.2701, rotation: 0 },
    valueOffset: { x: 2.54, y: 1.2699, rotation: 0 },
    footprintOffset: { x: -1.778, y: 0, rotation: 90 },
  },
  "Device:C": {
    referenceOffset: { x: 3.81, y: -1.2701, rotation: 0 },
    valueOffset: { x: 3.81, y: 1.2699, rotation: 0 },
    footprintOffset: { x: 0.9652, y: 3.81, rotation: 0 },
  },
  "Device:C_Polarized": {
    referenceOffset: { x: 3.81, y: -2.1591, rotation: 0 },
    valueOffset: { x: 3.81, y: 0.3809, rotation: 0 },
    footprintOffset: { x: 0.9652, y: 3.81, rotation: 0 },
  },
  "Device:L": {
    referenceOffset: { x: 1.27, y: -1.2701, rotation: 0 },
    valueOffset: { x: 1.27, y: 1.2699, rotation: 0 },
    footprintOffset: { x: 0, y: 0, rotation: 0 },
  },
  "Device:D": {
    referenceOffset: { x: 0, y: -6.35, rotation: 0 },
    valueOffset: { x: 0, y: -3.81, rotation: 0 },
    footprintOffset: { x: 0, y: 0, rotation: 0 },
  },
  "Device:LED": {
    referenceOffset: { x: -1.5875, y: -6.35, rotation: 0 },
    valueOffset: { x: -1.5875, y: -3.81, rotation: 0 },
    footprintOffset: { x: 0, y: 0, rotation: 0 },
  },
  "Transistor_BJT:2N2219": {
    referenceOffset: { x: 5.08, y: -1.2701, rotation: 0 },
    valueOffset: { x: 5.08, y: 1.2699, rotation: 0 },
    footprintOffset: { x: 5.08, y: 1.905, rotation: 0 },
  },
  "Amplifier_Operational:TL072": {
    referenceOffset: { x: 0, y: -10.16, rotation: 0 },
    valueOffset: { x: 0, y: -7.62, rotation: 0 },
    footprintOffset: { x: 0, y: 0, rotation: 0 },
  },
  "74xx:74HC595": {
    referenceOffset: { x: 2.1433, y: -17.78, rotation: 0 },
    valueOffset: { x: 2.1433, y: -15.24, rotation: 0 },
    footprintOffset: { x: 0, y: 0, rotation: 0 },
  },
  "Connector:Conn_01x04_Pin": {
    referenceOffset: { x: 0.635, y: -7.62, rotation: 0 },
    valueOffset: { x: 0.635, y: -5.08, rotation: 0 },
    footprintOffset: { x: 0, y: 0, rotation: 0 },
  },
};

export function getPropertyPosition(
  libId: string,
  propertyName: "Reference" | "Value" | "Footprint",
  componentPosition: Point,
  componentRotation: number = 0,
  symbolCache?: SymbolLibraryCache
): { position: Point; rotation: number } {
  const offset =
    getOffsetFromSymbolLibrary(libId, propertyName, symbolCache) ||
    (propertyName !== "Footprint"
      ? getOffsetFromSymbolGeometry(libId, propertyName, symbolCache)
      : null) ||
    getOffsetFromRule(libId, propertyName);

  const { x, y, rotation } = applyRotationTransform(
    offset.x,
    offset.y,
    offset.rotation,
    componentPosition,
    componentRotation
  );

  return {
    position: { x, y },
    rotation,
  };
}

function getOffsetFromSymbolLibrary(
  libId: string,
  propertyName: string,
  symbolCache?: SymbolLibraryCache
): PropertyOffset | null {
  const cache = symbolCache || getSymbolCache();
  const symbol = cache.getSymbol(libId);
  const position = symbol?.propertyPositions?.get(propertyName);
  if (!position) return null;

  return {
    x: position[0],
    y: position[1],
    rotation: position[2] || 0,
  };
}

function getOffsetFromSymbolGeometry(
  libId: string,
  propertyName: "Reference" | "Value",
  symbolCache?: SymbolLibraryCache
): PropertyOffset | null {
  const cache = symbolCache || getSymbolCache();
  const symbol = cache.getSymbol(libId);
  if (!symbol) return null;
  if (symbol.propertyPositions?.has(propertyName)) return null;

  const [minX, minY, maxX, maxY] =
    SymbolBoundingBoxCalculator.calculateBoundingBox(symbol, false);
  const centerX = (minX + maxX) / 2;

  if (propertyName === "Reference") {
    return { x: centerX, y: minY - DEFAULT_TEXT_HEIGHT, rotation: 0 };
  }

  return { x: centerX, y: maxY + DEFAULT_TEXT_HEIGHT, rotation: 0 };
}

function getOffsetFromRule(
  libId: string,
  propertyName: string
): PropertyOffset {
  const rule = POSITIONING_RULES[libId] || POSITIONING_RULES["Device:R"];

  if (propertyName === "Reference") {
    return rule.referenceOffset;
  }
  if (propertyName === "Value") {
    return rule.valueOffset;
  }
  if (propertyName === "Footprint") {
    return rule.footprintOffset || { x: 0, y: 0, rotation: 0 };
  }

  return { x: 0, y: 0, rotation: 0 };
}

function applyRotationTransform(
  offsetX: number,
  offsetY: number,
  textRotation: number,
  componentPosition: Point,
  componentRotation: number
): { x: number; y: number; rotation: number } {
  const rotation = ((componentRotation % 360) + 360) % 360;

  if (rotation === 0) {
    return {
      x: componentPosition.x + offsetX,
      y: componentPosition.y + offsetY,
      rotation: textRotation,
    };
  }

  if (rotation === 90) {
    return {
      x: componentPosition.x - offsetY,
      y: componentPosition.y + offsetX,
      rotation: (textRotation + 90) % 360,
    };
  }

  if (rotation === 180) {
    return {
      x: componentPosition.x - offsetX,
      y: componentPosition.y - offsetY,
      rotation: (textRotation + 180) % 360,
    };
  }

  if (rotation === 270) {
    return {
      x: componentPosition.x + offsetY,
      y: componentPosition.y - offsetX,
      rotation: (textRotation + 270) % 360,
    };
  }

  return {
    x: componentPosition.x + offsetX,
    y: componentPosition.y + offsetY,
    rotation: textRotation,
  };
}
