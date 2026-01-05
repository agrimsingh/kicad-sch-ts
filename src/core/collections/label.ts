// src/core/collections/label.ts

import { randomUUID } from "crypto";
import { BaseCollection } from "./base";
import {
  Label,
  GlobalLabel,
  HierarchicalLabel,
  LabelType,
  HierarchicalLabelShape,
  Point,
  TextEffects,
} from "../types";

type AnyLabel = Label | GlobalLabel | HierarchicalLabel;

export interface AddLabelOptions {
  text: string;
  position: Point;
  rotation?: number;
  type?: LabelType;
  shape?: HierarchicalLabelShape;
  effects?: TextEffects;
}

export class LabelCollection extends BaseCollection<AnyLabel> {
  add(options: AddLabelOptions): AnyLabel {
    const uuid = randomUUID();
    const type = options.type || LabelType.LOCAL;

    if (type === LabelType.GLOBAL) {
      const label: GlobalLabel = {
        uuid,
        text: options.text,
        position: options.position,
        rotation: options.rotation || 0,
        effects: options.effects,
        shape: options.shape || HierarchicalLabelShape.BIDIRECTIONAL,
        properties: new Map(),
      };
      return this.addItem(label);
    }

    if (type === LabelType.HIERARCHICAL) {
      const label: HierarchicalLabel = {
        uuid,
        text: options.text,
        position: options.position,
        rotation: options.rotation || 0,
        effects: options.effects,
        shape: options.shape || HierarchicalLabelShape.BIDIRECTIONAL,
      };
      return this.addItem(label);
    }

    const label: Label = {
      uuid,
      text: options.text,
      position: options.position,
      rotation: options.rotation || 0,
      effects: options.effects,
    };
    return this.addItem(label);
  }

  addFromData(label: AnyLabel): AnyLabel {
    return this.addItem(label);
  }

  remove(uuid: string): boolean {
    return this.removeItem(uuid);
  }

  getLocalLabels(): Label[] {
    return this.filter((l) => !("shape" in l)) as Label[];
  }

  getGlobalLabels(): GlobalLabel[] {
    return this.filter(
      (l) => "shape" in l && "properties" in l
    ) as GlobalLabel[];
  }

  getHierarchicalLabels(): HierarchicalLabel[] {
    return this.filter(
      (l) => "shape" in l && !("properties" in l)
    ) as HierarchicalLabel[];
  }

  findByText(text: string): AnyLabel[] {
    return this.filter((l) => l.text === text);
  }
}
