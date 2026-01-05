// src/core/collections/graphics.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import { SchematicRectangle, SchematicImage, Point, Stroke, FillType } from "../types";

export interface AddRectangleOptions {
  start: Point;
  end: Point;
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
}

export class RectangleCollection extends BaseCollection<SchematicRectangle> {
  add(options: AddRectangleOptions): SchematicRectangle {
    const rect: SchematicRectangle = {
      uuid: randomUUID(),
      start: options.start,
      end: options.end,
      stroke: options.stroke,
      fill: options.fill,
    };
    return this.addItem(rect);
  }

  addFromData(rect: SchematicRectangle): SchematicRectangle {
    return this.addItem(rect);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }
}

export interface AddImageOptions {
  position: Point;
  scale: number;
  data: string;
}

export class ImageCollection extends BaseCollection<SchematicImage> {
  add(options: AddImageOptions): SchematicImage {
    const image: SchematicImage = {
      uuid: randomUUID(),
      position: options.position,
      scale: options.scale,
      data: options.data,
    };
    return this.addItem(image);
  }

  addFromData(image: SchematicImage): SchematicImage {
    return this.addItem(image);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }
}
