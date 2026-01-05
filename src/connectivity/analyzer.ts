// src/connectivity/analyzer.ts

import { Schematic } from "../core/schematic";
import { Point, Wire, Net } from "../core/types";
import { Component } from "../core/collections/component";
import { SymbolLibraryCache } from "../library/cache";

const TOLERANCE = 0.01;

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < TOLERANCE && Math.abs(a.y - b.y) < TOLERANCE;
}

function pointKey(p: Point): string {
  // Round to grid for consistent keys
  const x = Math.round(p.x * 100) / 100;
  const y = Math.round(p.y * 100) / 100;
  return `${x},${y}`;
}

export interface PinConnection {
  reference: string;
  pin: string;
  position: Point;
}

export interface NetInfo {
  name: string;
  pins: PinConnection[];
  labels: string[];
  junctions: Point[];
  wireCount: number;
}

/**
 * Union-Find data structure for grouping connected points.
 */
class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(key);
    }
    return groups;
  }
}

export class ConnectivityAnalyzer {
  private schematic: Schematic;
  private symbolCache?: SymbolLibraryCache;
  private pinPositions: Map<string, PinConnection[]> = new Map(); // position key -> pins

  constructor(schematic: Schematic, symbolCache?: SymbolLibraryCache) {
    this.schematic = schematic;
    this.symbolCache = symbolCache;
  }

  /**
   * Build connectivity map and return all nets.
   */
  analyzeNets(): NetInfo[] {
    const uf = new UnionFind();
    const pointLabels = new Map<string, string[]>();
    const pointPins = new Map<string, PinConnection[]>();

    // Add all wire endpoints
    for (const wire of this.schematic.wires) {
      const pts = wire.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const startKey = pointKey(pts[i]);
        const endKey = pointKey(pts[i + 1]);
        uf.find(startKey);
        uf.find(endKey);
        uf.union(startKey, endKey);
      }
    }

    // Add junction points (connect all wires at that point)
    for (const junction of this.schematic.junctions) {
      const jKey = pointKey(junction.position);
      uf.find(jKey);
    }

    // Map labels to positions
    for (const label of this.schematic.labels) {
      const key = pointKey(label.position);
      uf.find(key);
      if (!pointLabels.has(key)) {
        pointLabels.set(key, []);
      }
      pointLabels.get(key)!.push(label.text);
    }

    for (const label of this.schematic.globalLabels) {
      const key = pointKey(label.position);
      uf.find(key);
      if (!pointLabels.has(key)) {
        pointLabels.set(key, []);
      }
      pointLabels.get(key)!.push(label.text);
    }

    // Map component pins to positions
    for (const component of this.schematic.components) {
      const pins = this.getComponentPinPositions(component);
      for (const pin of pins) {
        const key = pointKey(pin.position);
        uf.find(key);
        if (!pointPins.has(key)) {
          pointPins.set(key, []);
        }
        pointPins.get(key)!.push(pin);
      }
    }

    // Build nets from groups
    const groups = uf.getGroups();
    const nets: NetInfo[] = [];
    let netIndex = 0;

    for (const [, members] of groups) {
      const pins: PinConnection[] = [];
      const labels: string[] = [];
      const junctions: Point[] = [];
      let wireCount = 0;

      for (const member of members) {
        const memberPins = pointPins.get(member);
        if (memberPins) {
          pins.push(...memberPins);
        }

        const memberLabels = pointLabels.get(member);
        if (memberLabels) {
          labels.push(...memberLabels);
        }
      }

      // Count wires in this net
      for (const wire of this.schematic.wires) {
        const startKey = pointKey(wire.points[0]);
        if (uf.find(startKey) === uf.find(members[0])) {
          wireCount++;
        }
      }

      // Find junctions in this net
      for (const junction of this.schematic.junctions) {
        const jKey = pointKey(junction.position);
        if (uf.find(jKey) === uf.find(members[0])) {
          junctions.push(junction.position);
        }
      }

      // Name the net (from labels or auto-generated)
      const name = labels.length > 0 ? labels[0] : `Net${netIndex++}`;

      if (pins.length > 0 || labels.length > 0) {
        nets.push({
          name,
          pins,
          labels: [...new Set(labels)],
          junctions,
          wireCount,
        });
      }
    }

    return nets;
  }

  /**
   * Get all pins connected at a specific position.
   */
  getPinsAtPosition(position: Point): PinConnection[] {
    const key = pointKey(position);
    const result: PinConnection[] = [];

    for (const component of this.schematic.components) {
      const pins = this.getComponentPinPositions(component);
      for (const pin of pins) {
        if (pointKey(pin.position) === key) {
          result.push(pin);
        }
      }
    }

    return result;
  }

  /**
   * Check if a pin is connected to anything.
   */
  checkPinConnection(
    reference: string,
    pinNumber: string
  ): { connected: boolean; netName?: string } {
    const component = this.schematic.components.get(reference);
    if (!component) {
      return { connected: false };
    }

    const pins = this.getComponentPinPositions(component);
    const pin = pins.find((p) => p.pin === pinNumber);
    if (!pin) {
      return { connected: false };
    }

    const pinKey = pointKey(pin.position);

    // Check if any wire connects to this pin
    for (const wire of this.schematic.wires) {
      for (const pt of wire.points) {
        if (pointKey(pt) === pinKey) {
          const nets = this.analyzeNets();
          const net = nets.find((n) =>
            n.pins.some((p) => p.reference === reference && p.pin === pinNumber)
          );
          return { connected: true, netName: net?.name };
        }
      }
    }

    return { connected: false };
  }

  /**
   * Get pin positions for a component based on symbol definition.
   */
  private getComponentPinPositions(component: Component): PinConnection[] {
    const pins: PinConnection[] = [];

    if (!this.symbolCache) {
      // Fallback: use pin data from component if available
      for (const [pinNumber] of component.data.pins) {
        // Without symbol cache, we can't determine exact positions
        // Use component position as approximation
        pins.push({
          reference: component.reference,
          pin: pinNumber,
          position: component.position,
        });
      }
      return pins;
    }

    const symbolDef = this.symbolCache.getSymbol(component.libId);
    if (!symbolDef) {
      return pins;
    }

    const unit = symbolDef.units.get(component.unit) || symbolDef.units.get(0);
    if (!unit) {
      return pins;
    }

    for (const pin of unit.pins) {
      // Transform pin position from symbol space to schematic space
      const worldPos = this.transformPinPosition(
        pin.position,
        component.position,
        component.rotation,
        component.mirror
      );

      pins.push({
        reference: component.reference,
        pin: pin.number,
        position: worldPos,
      });
    }

    return pins;
  }

  private transformPinPosition(
    pinPos: Point,
    componentPos: Point,
    rotation: number,
    mirror?: "x" | "y"
  ): Point {
    let x = pinPos.x;
    let y = -pinPos.y; // Symbol Y is inverted

    if (mirror === "x") x = -x;
    if (mirror === "y") y = -y;

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotX = x * cos - y * sin;
    const rotY = x * sin + y * cos;

    return {
      x: componentPos.x + rotX,
      y: componentPos.y + rotY,
    };
  }

  /**
   * Find all unconnected pins.
   */
  findUnconnectedPins(): PinConnection[] {
    const unconnected: PinConnection[] = [];

    for (const component of this.schematic.components) {
      const pins = this.getComponentPinPositions(component);
      for (const pin of pins) {
        const result = this.checkPinConnection(component.reference, pin.pin);
        if (!result.connected) {
          unconnected.push(pin);
        }
      }
    }

    return unconnected;
  }
}
