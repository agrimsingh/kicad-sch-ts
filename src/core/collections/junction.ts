// src/core/collections/junction.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import { Junction, Point } from "../types";

export interface AddJunctionOptions {
  position: Point;
  diameter?: number;
  color?: [number, number, number, number];
}

export class JunctionCollection extends BaseCollection<Junction> {
  add(options: AddJunctionOptions): Junction {
    const junction: Junction = {
      uuid: randomUUID(),
      position: options.position,
      diameter: options.diameter || 0,
      color: options.color || [0, 0, 0, 0],
    };
    return this.addItem(junction);
  }

  addFromData(junction: Junction): Junction {
    return this.addItem(junction);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }

  findAtPoint(point: Point, tolerance: number = 0.01): Junction | undefined {
    return this.find(
      (j) =>
        Math.abs(j.position.x - point.x) < tolerance &&
        Math.abs(j.position.y - point.y) < tolerance
    );
  }
}
