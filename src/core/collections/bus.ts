// src/core/collections/bus.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import { Bus, BusEntry, Point, Size, Stroke, StrokeType } from "../types";
import { toSchematicPoint } from "../config";

export interface AddBusOptions {
  points: Point[];
  stroke?: Stroke;
}

export class BusCollection extends BaseCollection<Bus> {
  add(options: AddBusOptions): Bus {
    const bus: Bus = {
      uuid: randomUUID(),
      points: options.points.map((pt) => toSchematicPoint(pt)),
      stroke: options.stroke || {
        width: 0,
        type: StrokeType.DEFAULT,
      },
    };
    return this.addItem(bus);
  }

  addFromData(bus: Bus): Bus {
    return this.addItem(bus);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }
}

export interface AddBusEntryOptions {
  position: Point;
  size: Size;
  stroke?: Stroke;
}

export class BusEntryCollection extends BaseCollection<BusEntry> {
  add(options: AddBusEntryOptions): BusEntry {
    const entry: BusEntry = {
      uuid: randomUUID(),
      position: toSchematicPoint(options.position),
      size: options.size,
      stroke: options.stroke || {
        width: 0,
        type: StrokeType.DEFAULT,
      },
    };
    return this.addItem(entry);
  }

  addFromData(entry: BusEntry): BusEntry {
    return this.addItem(entry);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }
}
