// src/core/collections/no-connect.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import { NoConnect, Point } from "../types";
import { toSchematicPoint } from "../config";

export interface AddNoConnectOptions {
  position: Point;
}

export class NoConnectCollection extends BaseCollection<NoConnect> {
  add(options: AddNoConnectOptions): NoConnect {
    const noConnect: NoConnect = {
      uuid: randomUUID(),
      position: toSchematicPoint(options.position),
    };
    return this.addItem(noConnect);
  }

  addFromData(noConnect: NoConnect): NoConnect {
    return this.addItem(noConnect);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }

  findAtPoint(point: Point, tolerance: number = 0.01): NoConnect | undefined {
    return this.find(
      (nc) =>
        Math.abs(nc.position.x - point.x) < tolerance &&
        Math.abs(nc.position.y - point.y) < tolerance
    );
  }
}
