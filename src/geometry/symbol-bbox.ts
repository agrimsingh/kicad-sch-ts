// src/geometry/symbol-bbox.ts

import { Point, SymbolDefinition, SymbolPin } from "../core/types";
import { Component } from "../core/collections/component";
import { SymbolLibraryCache } from "../library/cache";

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function createBoundingBox(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): BoundingBox {
  return { minX, minY, maxX, maxY };
}

export function getBoundingBoxWidth(bbox: BoundingBox): number {
  return bbox.maxX - bbox.minX;
}

export function getBoundingBoxHeight(bbox: BoundingBox): number {
  return bbox.maxY - bbox.minY;
}

export function getBoundingBoxCenter(bbox: BoundingBox): Point {
  return {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };
}

export function expandBoundingBox(
  bbox: BoundingBox,
  margin: number
): BoundingBox {
  return {
    minX: bbox.minX - margin,
    minY: bbox.minY - margin,
    maxX: bbox.maxX + margin,
    maxY: bbox.maxY + margin,
  };
}

export function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

export function mergeBoundingBoxes(
  boxes: BoundingBox[]
): BoundingBox | undefined {
  if (boxes.length === 0) return undefined;

  let minX = boxes[0].minX;
  let minY = boxes[0].minY;
  let maxX = boxes[0].maxX;
  let maxY = boxes[0].maxY;

  for (let i = 1; i < boxes.length; i++) {
    minX = Math.min(minX, boxes[i].minX);
    minY = Math.min(minY, boxes[i].minY);
    maxX = Math.max(maxX, boxes[i].maxX);
    maxY = Math.max(maxY, boxes[i].maxY);
  }

  return createBoundingBox(minX, minY, maxX, maxY);
}

export function pointInBoundingBox(point: Point, bbox: BoundingBox): boolean {
  return (
    point.x >= bbox.minX &&
    point.x <= bbox.maxX &&
    point.y >= bbox.minY &&
    point.y <= bbox.maxY
  );
}

const DEFAULT_TEXT_HEIGHT = 2.54;
const DEFAULT_PIN_TEXT_WIDTH_RATIO = 2.0;
const DEFAULT_PIN_NUMBER_SIZE = 1.27;

export class SymbolBoundingBoxCalculator {
  static calculateBoundingBox(
    symbol: SymbolDefinition,
    includeProperties: boolean = true
  ): BoundingBox {
    if (!symbol) {
      return createBoundingBox(-2.54, -2.54, 2.54, 2.54);
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const unit of symbol.units.values()) {
      for (const pin of unit.pins) {
        const pinBbox = this.getPinBounds(pin);
        minX = Math.min(minX, pinBbox.minX);
        minY = Math.min(minY, pinBbox.minY);
        maxX = Math.max(maxX, pinBbox.maxX);
        maxY = Math.max(maxY, pinBbox.maxY);
      }
    }

    if (includeProperties) {
      minY -= DEFAULT_TEXT_HEIGHT * 1.5;
      maxY += DEFAULT_TEXT_HEIGHT * 1.5;
    }

    if (!isFinite(minX)) {
      return createBoundingBox(-2.54, -2.54, 2.54, 2.54);
    }

    return createBoundingBox(minX, minY, maxX, maxY);
  }

  private static getPinBounds(pin: SymbolPin): BoundingBox {
    const pos = pin.position;
    const length = pin.length;
    const rotation = pin.rotation;

    let endX = pos.x;
    let endY = pos.y;

    switch (rotation) {
      case 0:
        endX = pos.x + length;
        break;
      case 90:
        endY = pos.y + length;
        break;
      case 180:
        endX = pos.x - length;
        break;
      case 270:
        endY = pos.y - length;
        break;
    }

    const textWidth = Math.max(
      pin.name.length * DEFAULT_PIN_TEXT_WIDTH_RATIO * DEFAULT_PIN_NUMBER_SIZE,
      pin.number.length * DEFAULT_PIN_TEXT_WIDTH_RATIO * DEFAULT_PIN_NUMBER_SIZE
    );

    const minX = Math.min(pos.x, endX) - textWidth / 2;
    const maxX = Math.max(pos.x, endX) + textWidth / 2;
    const minY = Math.min(pos.y, endY) - DEFAULT_PIN_NUMBER_SIZE;
    const maxY = Math.max(pos.y, endY) + DEFAULT_PIN_NUMBER_SIZE;

    return createBoundingBox(minX, minY, maxX, maxY);
  }
}

/**
 * Get bounding box for a placed component in schematic space.
 */
export function getComponentBoundingBox(
  component: Component,
  symbolCache?: SymbolLibraryCache,
  includeProperties: boolean = true
): BoundingBox | null {
  const symbolDef = symbolCache?.getSymbol(component.libId);
  if (!symbolDef) return null;

  const symbolBbox = SymbolBoundingBoxCalculator.calculateBoundingBox(
    symbolDef,
    includeProperties
  );

  return transformBoundingBox(
    symbolBbox,
    component.position,
    component.rotation,
    component.mirror
  );
}

function transformBoundingBox(
  bbox: BoundingBox,
  position: Point,
  rotation: number,
  mirror?: "x" | "y"
): BoundingBox {
  const corners: Point[] = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ];

  const transformed = corners.map((corner) => {
    let x = corner.x;
    let y = -corner.y; // Y-negation for symbol-to-schematic

    if (mirror === "x") x = -x;
    if (mirror === "y") y = -y;

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotX = x * cos - y * sin;
    const rotY = x * sin + y * cos;

    return {
      x: position.x + rotX,
      y: position.y + rotY,
    };
  });

  let minX = transformed[0].x,
    maxX = transformed[0].x;
  let minY = transformed[0].y,
    maxY = transformed[0].y;
  for (const p of transformed) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  return createBoundingBox(minX, minY, maxX, maxY);
}
