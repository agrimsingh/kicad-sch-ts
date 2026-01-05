// src/core/collections/text.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import { Text, TextBox, Point, Size, TextEffects, Stroke, FillType } from "../types";

export interface AddTextOptions {
  text: string;
  position: Point;
  rotation?: number;
  effects?: TextEffects;
}

export class TextCollection extends BaseCollection<Text> {
  add(options: AddTextOptions): Text {
    const text: Text = {
      uuid: randomUUID(),
      text: options.text,
      position: options.position,
      rotation: options.rotation || 0,
      effects: options.effects,
    };
    return this.addItem(text);
  }

  addFromData(text: Text): Text {
    return this.addItem(text);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }
}

export interface AddTextBoxOptions {
  text: string;
  position: Point;
  size: Size;
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
  effects?: TextEffects;
}

export class TextBoxCollection extends BaseCollection<TextBox> {
  add(options: AddTextBoxOptions): TextBox {
    const textBox: TextBox = {
      uuid: randomUUID(),
      text: options.text,
      position: options.position,
      size: options.size,
      stroke: options.stroke,
      fill: options.fill,
      effects: options.effects,
    };
    return this.addItem(textBox);
  }

  addFromData(textBox: TextBox): TextBox {
    return this.addItem(textBox);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }
}
