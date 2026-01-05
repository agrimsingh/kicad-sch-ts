// src/geometry/symbol-bbox.ts

import {
  Point,
  SymbolDefinition,
  SymbolGraphics,
  SymbolPin,
} from "../core/types";
import { Component } from "../core/collections/component";
import { SymbolLibraryCache } from "../library/cache";
import {
  DEFAULT_PIN_LENGTH,
  DEFAULT_PIN_NAME_OFFSET,
  DEFAULT_PIN_NUMBER_SIZE,
  DEFAULT_PIN_TEXT_WIDTH_RATIO,
  DEFAULT_TEXT_HEIGHT,
} from "./font-metrics";

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

export class SymbolBoundingBoxCalculator {
  static calculateBoundingBox(
    symbolData: SymbolDefinition,
    includeProperties: boolean = true,
    pinNetMap?: Record<string, string>
  ): [number, number, number, number] {
    if (!symbolData) {
      throw new Error("Symbol data is None or empty");
    }

    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];

    const updateBounds = (bounds: [number, number, number, number] | null) => {
      if (!bounds) return;
      minX = Math.min(minX, bounds[0]);
      minY = Math.min(minY, bounds[1]);
      maxX = Math.max(maxX, bounds[2]);
      maxY = Math.max(maxY, bounds[3]);
    };

    for (const unit of symbolData.units.values()) {
      for (const shape of unit.graphics) {
        updateBounds(this._getShapeBounds(shape));
      }
      for (const pin of unit.pins) {
        updateBounds(this._getPinBounds(pin, pinNetMap));
      }
    }

    if (minX === Infinity) {
      // If no geometry, create a default small box
      return [-1, -1, 1, 1];
    }

    const margin = 0.254; // 10 mils
    minX -= margin;
    minY -= margin;
    maxX += margin;
    maxY += margin;

    if (includeProperties) {
      const componentWidth = maxX - minX;
      const componentHeight = maxY - minY;
      const propertyWidth = Math.max(10.0, componentWidth * 0.8);
      const propertyHeight = DEFAULT_TEXT_HEIGHT;
      const verticalSpacingAbove = Math.max(5.0, componentHeight * 0.1);
      const verticalSpacingBelow = Math.max(10.0, componentHeight * 0.15);

      minY -= verticalSpacingAbove + propertyHeight;
      maxY += verticalSpacingBelow + propertyHeight;

      const centerX = (minX + maxX) / 2;
      minX = Math.min(minX, centerX - propertyWidth / 2);
      maxX = Math.max(maxX, centerX + propertyWidth / 2);
    }

    return [minX, minY, maxX, maxY];
  }

  private static _getShapeBounds(
    shape: SymbolGraphics
  ): [number, number, number, number] | null {
    const shapeType = shape.type;
    switch (shapeType) {
      case "rectangle": {
        const start = shape.start as Point;
        const end = shape.end as Point;
        return [
          Math.min(start.x, end.x),
          Math.min(start.y, end.y),
          Math.max(start.x, end.x),
          Math.max(start.y, end.y),
        ];
      }
      case "circle": {
        const center = shape.center as Point;
        const radius = shape.radius as number;
        return [
          center.x - radius,
          center.y - radius,
          center.x + radius,
          center.y + radius,
        ];
      }
      case "arc": {
        const start = shape.start as Point;
        const mid = shape.mid as Point;
        const end = shape.end as Point;
        const arcMinX = Math.min(start.x, mid.x, end.x);
        const arcMinY = Math.min(start.y, mid.y, end.y);
        const arcMaxX = Math.max(start.x, mid.x, end.x);
        const arcMaxY = Math.max(start.y, mid.y, end.y);
        return [arcMinX, arcMinY, arcMaxX, arcMaxY];
      }
      case "polyline": {
        const points = shape.pts as Point[];
        if (!points || points.length === 0) return null;
        const polyMinX = Math.min(...points.map((p) => p.x));
        const polyMinY = Math.min(...points.map((p) => p.y));
        const polyMaxX = Math.max(...points.map((p) => p.x));
        const polyMaxY = Math.max(...points.map((p) => p.y));
        return [polyMinX, polyMinY, polyMaxX, polyMaxY];
      }
      case "text": {
        const at = shape.at as Point;
        const text = shape.text as string;
        const textWidth = text.length * DEFAULT_TEXT_HEIGHT * 0.6;
        const textHeight = DEFAULT_TEXT_HEIGHT;
        return [
          at.x - textWidth / 2,
          at.y - textHeight / 2,
          at.x + textWidth / 2,
          at.y + textHeight / 2,
        ];
      }
    }
    return null;
  }

  private static _getPinBounds(
    pin: SymbolPin,
    pinNetMap?: Record<string, string>
  ): [number, number, number, number] | null {
    const { x, y } = pin.position;
    const angle = pin.rotation;
    const length = pin.length || DEFAULT_PIN_LENGTH;

    const angleRad = (angle * Math.PI) / 180;
    const endX = x + length * Math.cos(angleRad);
    const endY = y + length * Math.sin(angleRad);

    let [pinMinX, pinMinY, pinMaxX, pinMaxY] = [
      Math.min(x, endX),
      Math.min(y, endY),
      Math.max(x, endX),
      Math.max(y, endY),
    ];

    const pinName = pin.name || "";
    const pinNumber = pin.number || "";

    const labelText =
      (pinNetMap && pinNetMap[pinNumber]) || (pinName !== "~" ? pinName : "");

    if (labelText) {
      const nameWidth =
        labelText.length * DEFAULT_TEXT_HEIGHT * DEFAULT_PIN_TEXT_WIDTH_RATIO;
      const offset = DEFAULT_PIN_NAME_OFFSET;

      if (angle === 0) {
        // Right
        pinMinX = Math.min(pinMinX, endX - offset - nameWidth);
      } else if (angle === 180) {
        // Left
        pinMaxX = Math.max(pinMaxX, endX + offset + nameWidth);
      } else if (angle === 90) {
        // Up
        pinMinY = Math.min(pinMinY, endY - offset - DEFAULT_TEXT_HEIGHT);
      } else if (angle === 270) {
        // Down
        pinMaxY = Math.max(pinMaxY, endY + offset + DEFAULT_TEXT_HEIGHT);
      }
    }

    if (pinNumber) {
      const pinMargin = DEFAULT_PIN_NUMBER_SIZE * 1.5;
      pinMinX -= pinMargin;
      pinMinY -= pinMargin;
      pinMaxX += pinMargin;
      pinMaxY += pinMargin;
    }

    return [pinMinX, pinMinY, pinMaxX, pinMaxY];
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

  const [minX, minY, maxX, maxY] =
    SymbolBoundingBoxCalculator.calculateBoundingBox(
      symbolDef,
      includeProperties
    );

  const symbolBbox = createBoundingBox(minX, minY, maxX, maxY);

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

  let tMinX = transformed[0].x,
    tMaxX = transformed[0].x;
  let tMinY = transformed[0].y,
    tMaxY = transformed[0].y;
  for (const p of transformed) {
    tMinX = Math.min(tMinX, p.x);
    tMaxX = Math.max(tMaxX, p.x);
    tMinY = Math.min(tMinY, p.y);
    tMaxY = Math.max(tMaxY, p.y);
  }

  return createBoundingBox(tMinX, tMinY, tMaxX, tMaxY);
}
