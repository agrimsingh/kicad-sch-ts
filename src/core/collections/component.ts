// src/core/collections/component.ts

import { randomUUID } from "crypto";
import { BaseCollection, IndexRegistry } from "./base";
import { SchematicSymbol, Point, PropertyValue } from "../types";

/**
 * Wrapper class for a component that provides a convenient API.
 */
export class Component {
  constructor(
    private symbol: SchematicSymbol,
    private collection: ComponentCollection
  ) {}

  get uuid(): string {
    return this.symbol.uuid;
  }
  get libId(): string {
    return this.symbol.libId;
  }
  get position(): Point {
    return this.symbol.position;
  }
  get rotation(): number {
    return this.symbol.rotation;
  }
  get mirror(): "x" | "y" | undefined {
    return this.symbol.mirror;
  }
  get unit(): number {
    return this.symbol.unit;
  }
  get inBom(): boolean {
    return this.symbol.inBom;
  }
  get onBoard(): boolean {
    return this.symbol.onBoard;
  }

  get reference(): string {
    return this.symbol.properties.get("Reference")?.value || "";
  }

  set reference(value: string) {
    const prop = this.symbol.properties.get("Reference");
    if (prop) {
      prop.value = value;
    }
    this.collection.updateReferenceIndex(this.symbol.uuid, value);
  }

  get value(): string {
    return this.symbol.properties.get("Value")?.value || "";
  }

  set value(val: string) {
    const prop = this.symbol.properties.get("Value");
    if (prop) {
      prop.value = val;
    }
  }

  get footprint(): string | undefined {
    return this.symbol.properties.get("Footprint")?.value;
  }

  set footprint(val: string | undefined) {
    if (val) {
      const prop = this.symbol.properties.get("Footprint");
      if (prop) {
        prop.value = val;
      } else {
        this.symbol.properties.set("Footprint", {
          value: val,
          position: { x: 0, y: 0 },
          rotation: 0,
        });
      }
    }
  }

  get properties(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, prop] of this.symbol.properties) {
      result[name] = prop.value;
    }
    return result;
  }

  getProperty(name: string): string | undefined {
    return this.symbol.properties.get(name)?.value;
  }

  setProperty(name: string, value: string): void {
    const existing = this.symbol.properties.get(name);
    if (existing) {
      existing.value = value;
    } else {
      this.symbol.properties.set(name, {
        value,
        position: { x: 0, y: 0 },
        rotation: 0,
      });
    }
  }

  /** Get the raw symbol data for serialization */
  toSymbol(): SchematicSymbol {
    return this.symbol;
  }

  /** Get the raw symbol data (alias for compatibility) */
  get data(): SchematicSymbol {
    return this.symbol;
  }
}

export interface AddComponentOptions {
  libId: string;
  reference: string;
  value: string;
  position: Point;
  rotation?: number;
  mirror?: "x" | "y";
  unit?: number;
  footprint?: string;
  properties?: Record<string, string>;
  inBom?: boolean;
  onBoard?: boolean;
}

/**
 * Collection of components in a schematic.
 */
export class ComponentCollection extends BaseCollection<Component> {
  private referenceIndex: IndexRegistry<Component> = new IndexRegistry();

  add(options: AddComponentOptions): Component {
    const uuid = randomUUID();

    const properties = new Map<string, PropertyValue>();
    properties.set("Reference", {
      value: options.reference,
      position: { x: options.position.x + 1.27, y: options.position.y - 1.27 },
      rotation: 0,
    });
    properties.set("Value", {
      value: options.value,
      position: { x: options.position.x + 1.27, y: options.position.y + 1.27 },
      rotation: 0,
    });

    if (options.footprint) {
      properties.set("Footprint", {
        value: options.footprint,
        position: { x: options.position.x, y: options.position.y + 2.54 },
        rotation: 0,
      });
    }

    if (options.properties) {
      for (const [name, value] of Object.entries(options.properties)) {
        if (!properties.has(name)) {
          properties.set(name, {
            value,
            position: { x: 0, y: 0 },
            rotation: 0,
          });
        }
      }
    }

    const symbol: SchematicSymbol = {
      uuid,
      libId: options.libId,
      position: options.position,
      rotation: options.rotation || 0,
      mirror: options.mirror,
      unit: options.unit || 1,
      inBom: options.inBom !== false,
      onBoard: options.onBoard !== false,
      excludeFromSim: false,
      dnp: false,
      properties,
      pins: new Map(),
    };

    const component = new Component(symbol, this);
    this.addItem(component);
    this.referenceIndex.addByReference(options.reference, component);

    return component;
  }

  get(reference: string): Component | undefined {
    return this.referenceIndex.getByReference(reference);
  }

  remove(reference: string): boolean {
    const component = this.get(reference);
    if (!component) return false;

    this.referenceIndex.removeByReference(reference);
    return this.removeItem(component.uuid);
  }

  findByLibId(libId: string): Component[] {
    return this.filter((c) => c.libId === libId);
  }

  updateReferenceIndex(uuid: string, newReference: string): void {
    const component = this.getByUuid(uuid);
    if (component) {
      // Remove old reference
      for (const [ref, comp] of this.referenceIndex.referenceMap) {
        if (comp.uuid === uuid) {
          this.referenceIndex.removeByReference(ref);
          break;
        }
      }
      // Add new reference
      this.referenceIndex.addByReference(newReference, component);
    }
  }

  /** Add a component from raw symbol data (used during parsing) */
  addFromSymbol(symbol: SchematicSymbol): Component {
    const component = new Component(symbol, this);
    this.addItem(component);

    const reference = symbol.properties.get("Reference")?.value;
    if (reference) {
      try {
        this.referenceIndex.addByReference(reference, component);
      } catch {
        // Ignore duplicate reference errors during parsing
      }
    }

    return component;
  }
}
