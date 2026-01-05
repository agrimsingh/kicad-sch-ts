// src/core/collections/wire.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import { Wire, Point, Stroke, StrokeType } from "../types";
import { toSchematicPoint } from "../config";

export interface AddWireOptions {
  start?: Point;
  end?: Point;
  points?: Point[];
  stroke?: Stroke;
}

export class WireCollection extends BaseCollection<Wire> {
  add(options: AddWireOptions): Wire {
    let points: Point[];

    if (options.points) {
      points = options.points.map((pt) => toSchematicPoint(pt));
    } else if (options.start && options.end) {
      points = [toSchematicPoint(options.start), toSchematicPoint(options.end)];
    } else {
      throw new Error("Must provide either points array or start/end");
    }

    const wire: Wire = {
      uuid: randomUUID(),
      points,
      stroke: options.stroke || {
        width: 0,
        type: StrokeType.DEFAULT,
      },
    };

    return this.addItem(wire);
  }

  addFromData(wire: Wire): Wire {
    return this.addItem(wire);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }

  findAtPoint(point: Point, tolerance: number = 0.01): Wire[] {
    return this.filter((wire) =>
      wire.points.some(
        (p) =>
          Math.abs(p.x - point.x) < tolerance &&
          Math.abs(p.y - point.y) < tolerance
      )
    );
  }
}
