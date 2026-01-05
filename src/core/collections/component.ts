// src/core/collections/component.ts

import { randomUUID } from "crypto";
import { BaseCollection, IndexRegistry } from "./base";
import { SchematicSymbol, Point, PropertyValue } from "../types";
import { getPropertyPosition } from "../property-positioning";
import { getSymbolCache, SymbolLibraryCache } from "../../library/cache";
import { SymbolDefinition } from "../types";

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
    this.collection.markModified();
  }

  get value(): string {
    return this.symbol.properties.get("Value")?.value || "";
  }

  set value(val: string) {
    const prop = this.symbol.properties.get("Value");
    if (prop) {
      prop.value = val;
    }
    this.collection.markModified();
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
      this.collection.markModified();
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
    this.collection.markModified();
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
    return this.addComponent(options, false);
  }

  addAllUnits(
    options: AddComponentOptions,
    symbolCache?: SymbolLibraryCache
  ): Component[] {
    const cache = symbolCache || getSymbolCache();
    const symbol = cache.getSymbol(options.libId);
    const unitNumbers = this.getUnitNumbers(symbol);
    const components: Component[] = [];

    unitNumbers.forEach((unitNumber, index) => {
      components.push(
        this.addComponent(
          {
            ...options,
            unit: unitNumber,
          },
          index > 0
        )
      );
    });

    return components;
  }

  private addComponent(
    options: AddComponentOptions,
    ignoreDuplicateReference: boolean
  ): Component {
    const uuid = randomUUID();
    const componentRotation = options.rotation || 0;

    const properties = new Map<string, PropertyValue>();
    const referencePosition = getPropertyPosition(
      options.libId,
      "Reference",
      options.position,
      componentRotation
    );
    const valuePosition = getPropertyPosition(
      options.libId,
      "Value",
      options.position,
      componentRotation
    );
    properties.set("Reference", {
      value: options.reference,
      position: referencePosition.position,
      rotation: referencePosition.rotation,
    });
    properties.set("Value", {
      value: options.value,
      position: valuePosition.position,
      rotation: valuePosition.rotation,
    });

    if (options.footprint) {
      const footprintPosition = getPropertyPosition(
        options.libId,
        "Footprint",
        options.position,
        componentRotation
      );
      properties.set("Footprint", {
        value: options.footprint,
        position: footprintPosition.position,
        rotation: footprintPosition.rotation,
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
      rotation: componentRotation,
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
    if (ignoreDuplicateReference) {
      try {
        this.referenceIndex.addByReference(options.reference, component);
      } catch {
        // Allow duplicate references for multi-unit components
      }
    } else {
      this.referenceIndex.addByReference(options.reference, component);
    }

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

  private getUnitNumbers(symbol?: SymbolDefinition): number[] {
    if (!symbol) return [1];
    const units = Array.from(symbol.units.keys()).filter((unit) => unit > 0);
    if (units.length > 0) {
      return units.sort((a, b) => a - b);
    }
    const count = symbol.unitCount || 1;
    return Array.from({ length: count }, (_, i) => i + 1);
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
