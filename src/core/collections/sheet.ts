// src/core/collections/sheet.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import { Sheet, Point, Size, Stroke, StrokeType, PropertyValue, SheetPin } from "../types";
import { toSchematicPoint } from "../config";

export interface AddSheetOptions {
  position: Point;
  size: Size;
  name: string;
  filename: string;
  stroke?: Stroke;
  fill?: { color: [number, number, number, number] };
}

export class SheetCollection extends BaseCollection<Sheet> {
  add(options: AddSheetOptions): Sheet {
    const position = toSchematicPoint(options.position);
    const sheet: Sheet = {
      uuid: randomUUID(),
      position,
      size: options.size,
      stroke: options.stroke || {
        width: 0.1524,
        type: StrokeType.SOLID,
      },
      fill: options.fill,
      name: {
        value: options.name,
        position: { x: position.x + 0.5, y: position.y + 0.5 },
        rotation: 0,
      },
      filename: {
        value: options.filename,
        position: { x: position.x + 0.5, y: position.y + options.size.height - 0.5 },
        rotation: 0,
      },
      pins: [],
    };
    return this.addItem(sheet);
  }

  addFromData(sheet: Sheet): Sheet {
    return this.addItem(sheet);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }

  getByName(name: string): Sheet | undefined {
    return this.find((s) => s.name.value === name);
  }
}
