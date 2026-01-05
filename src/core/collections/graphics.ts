// src/core/collections/graphics.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import {
  SchematicRectangle,
  SchematicImage,
  SchematicPolyline,
  SchematicArc,
  SchematicCircle,
  SchematicBezier,
  Point,
  Stroke,
  FillType,
} from "../types";
import { toSchematicPoint } from "../config";

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
      start: toSchematicPoint(options.start),
      end: toSchematicPoint(options.end),
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

export interface AddPolylineOptions {
  points: Point[];
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
}

export class PolylineCollection extends BaseCollection<SchematicPolyline> {
  add(options: AddPolylineOptions): SchematicPolyline {
    const polyline: SchematicPolyline = {
      uuid: randomUUID(),
      points: options.points.map((pt) => toSchematicPoint(pt)),
      stroke: options.stroke,
      fill: options.fill,
    };
    return this.addItem(polyline);
  }

  addFromData(polyline: SchematicPolyline): SchematicPolyline {
    return this.addItem(polyline);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }
}

export interface AddArcOptions {
  start: Point;
  mid: Point;
  end: Point;
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
}

export class ArcCollection extends BaseCollection<SchematicArc> {
  add(options: AddArcOptions): SchematicArc {
    const arc: SchematicArc = {
      uuid: randomUUID(),
      start: toSchematicPoint(options.start),
      mid: toSchematicPoint(options.mid),
      end: toSchematicPoint(options.end),
      stroke: options.stroke,
      fill: options.fill,
    };
    return this.addItem(arc);
  }

  addFromData(arc: SchematicArc): SchematicArc {
    return this.addItem(arc);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }
}

export interface AddCircleOptions {
  center: Point;
  radius: number;
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
}

export class CircleCollection extends BaseCollection<SchematicCircle> {
  add(options: AddCircleOptions): SchematicCircle {
    const circle: SchematicCircle = {
      uuid: randomUUID(),
      center: toSchematicPoint(options.center),
      radius: options.radius,
      stroke: options.stroke,
      fill: options.fill,
    };
    return this.addItem(circle);
  }

  addFromData(circle: SchematicCircle): SchematicCircle {
    return this.addItem(circle);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }
}

export interface AddBezierOptions {
  points: Point[];
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
}

export class BezierCollection extends BaseCollection<SchematicBezier> {
  add(options: AddBezierOptions): SchematicBezier {
    const bezier: SchematicBezier = {
      uuid: randomUUID(),
      points: options.points.map((pt) => toSchematicPoint(pt)),
      stroke: options.stroke,
      fill: options.fill,
    };
    return this.addItem(bezier);
  }

  addFromData(bezier: SchematicBezier): SchematicBezier {
    return this.addItem(bezier);
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
      position: toSchematicPoint(options.position),
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
