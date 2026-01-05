// src/connectivity/analyzer.ts

import { Schematic } from "../core/schematic";
import { Point, Wire, Net } from "../core/types";
import { Component } from "../core/collections/component";
import { SymbolLibraryCache } from "../library/cache";

const TOLERANCE = 0.01;

interface Segment {
  start: Point;
  end: Point;
}

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < TOLERANCE && Math.abs(a.y - b.y) < TOLERANCE;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < TOLERANCE;
}

function pointOnSegment(point: Point, start: Point, end: Point): boolean {
  const cross =
    (end.x - start.x) * (point.y - start.y) -
    (end.y - start.y) * (point.x - start.x);
  if (Math.abs(cross) > TOLERANCE) {
    return false;
  }

  const dot =
    (point.x - start.x) * (point.x - end.x) +
    (point.y - start.y) * (point.y - end.y);
  return dot <= TOLERANCE;
}

type SegmentIntersection =
  | { type: "none" }
  | { type: "point"; point: Point }
  | { type: "overlap"; start: Point; end: Point };

function segmentIntersection(
  aStart: Point,
  aEnd: Point,
  bStart: Point,
  bEnd: Point
): SegmentIntersection {
  const aDx = aEnd.x - aStart.x;
  const aDy = aEnd.y - aStart.y;
  const bDx = bEnd.x - bStart.x;
  const bDy = bEnd.y - bStart.y;

  const denom = aDx * bDy - aDy * bDx;
  const crossStart =
    (bStart.x - aStart.x) * aDy - (bStart.y - aStart.y) * aDx;

  if (Math.abs(denom) < TOLERANCE) {
    if (Math.abs(crossStart) > TOLERANCE) {
      return { type: "none" };
    }

    const useX = Math.abs(aDx) >= Math.abs(aDy);
    const aMin = useX ? Math.min(aStart.x, aEnd.x) : Math.min(aStart.y, aEnd.y);
    const aMax = useX ? Math.max(aStart.x, aEnd.x) : Math.max(aStart.y, aEnd.y);
    const bMin = useX ? Math.min(bStart.x, bEnd.x) : Math.min(bStart.y, bEnd.y);
    const bMax = useX ? Math.max(bStart.x, bEnd.x) : Math.max(bStart.y, bEnd.y);

    const overlapMin = Math.max(aMin, bMin);
    const overlapMax = Math.min(aMax, bMax);

    if (overlapMax < overlapMin - TOLERANCE) {
      return { type: "none" };
    }

    const pointAt = (coord: number): Point => {
      if (useX) {
        const t = nearlyEqual(aDx, 0) ? 0 : (coord - aStart.x) / aDx;
        return { x: coord, y: aStart.y + t * aDy };
      }
      const t = nearlyEqual(aDy, 0) ? 0 : (coord - aStart.y) / aDy;
      return { x: aStart.x + t * aDx, y: coord };
    };

    return {
      type: "overlap",
      start: pointAt(overlapMin),
      end: pointAt(overlapMax),
    };
  }

  const ua =
    ((bStart.x - aStart.x) * bDy - (bStart.y - aStart.y) * bDx) / denom;
  const ub =
    ((bStart.x - aStart.x) * aDy - (bStart.y - aStart.y) * aDx) / denom;

  if (ua < -TOLERANCE || ua > 1 + TOLERANCE) {
    return { type: "none" };
  }
  if (ub < -TOLERANCE || ub > 1 + TOLERANCE) {
    return { type: "none" };
  }

  return {
    type: "point",
    point: {
      x: aStart.x + ua * aDx,
      y: aStart.y + ua * aDy,
    },
  };
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
  private lastPointToNet: Map<string, NetInfo> | null = null;

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
    const segments: Segment[] = [];
    const junctionKeys = new Set<string>();
    this.lastPointToNet = new Map();

    // Add all wire endpoints and track segments
    for (const wire of this.schematic.wires) {
      const pts = wire.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const start = pts[i];
        const end = pts[i + 1];
        const startKey = pointKey(start);
        const endKey = pointKey(end);
        uf.find(startKey);
        uf.find(endKey);
        uf.union(startKey, endKey);
        segments.push({ start, end });
      }
    }

    // Add junction points (connect all wires at that point)
    for (const junction of this.schematic.junctions) {
      const jKey = pointKey(junction.position);
      uf.find(jKey);
      junctionKeys.add(jKey);
    }

    const connectPointToSegments = (point: Point): void => {
      const key = pointKey(point);
      for (const segment of segments) {
        if (pointOnSegment(point, segment.start, segment.end)) {
          uf.union(key, pointKey(segment.start));
          uf.union(key, pointKey(segment.end));
        }
      }
    };

    const connectIntersection = (point: Point, segment: Segment): void => {
      const key = pointKey(point);
      uf.find(key);
      uf.union(key, pointKey(segment.start));
      uf.union(key, pointKey(segment.end));
    }

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const first = segments[i];
        const second = segments[j];
        const intersection = segmentIntersection(
          first.start,
          first.end,
          second.start,
          second.end
        );

        if (intersection.type === "overlap") {
          uf.union(pointKey(first.start), pointKey(second.start));
          uf.union(pointKey(first.start), pointKey(second.end));
          uf.union(pointKey(first.end), pointKey(second.start));
          uf.union(pointKey(first.end), pointKey(second.end));
          connectIntersection(intersection.start, first);
          connectIntersection(intersection.end, first);
          connectIntersection(intersection.start, second);
          connectIntersection(intersection.end, second);
          continue;
        }

        if (intersection.type === "point") {
          const point = intersection.point;
          const pointKeyValue = pointKey(point);
          const isEndpoint =
            pointsEqual(point, first.start) ||
            pointsEqual(point, first.end) ||
            pointsEqual(point, second.start) ||
            pointsEqual(point, second.end);
          const hasJunction = junctionKeys.has(pointKeyValue);

          if (isEndpoint || hasJunction) {
            connectIntersection(point, first);
            connectIntersection(point, second);
          }
        }
      }
    }

    const addLabelAt = (text: string, position: Point) => {
      const key = pointKey(position);
      uf.find(key);
      connectPointToSegments(position);
      if (!pointLabels.has(key)) {
        pointLabels.set(key, []);
      }
      pointLabels.get(key)!.push(text);
    };

    for (const label of this.schematic.labels) {
      addLabelAt(label.text, label.position);
    }

    for (const label of this.schematic.globalLabels) {
      addLabelAt(label.text, label.position);
    }

    for (const label of this.schematic.hierarchicalLabels) {
      addLabelAt(label.text, label.position);
    }

    for (const component of this.schematic.components) {
      const powerName = this.getPowerSymbolName(component);
      if (powerName) {
        addLabelAt(powerName, component.position);
      }
    }

    // Map component pins to positions
    for (const component of this.schematic.components) {
      const pins = this.getComponentPinPositions(component);
      for (const pin of pins) {
        const key = pointKey(pin.position);
        uf.find(key);
        connectPointToSegments(pin.position);
        if (!pointPins.has(key)) {
          pointPins.set(key, []);
        }
        pointPins.get(key)!.push(pin);
      }
    }

    for (const junction of this.schematic.junctions) {
      connectPointToSegments(junction.position);
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
        for (const member of members) {
          this.lastPointToNet!.set(member, nets[nets.length - 1]);
        }
      }
    }

    return nets;
  }

  getNetAtPoint(position: Point): NetInfo | undefined {
    if (!this.lastPointToNet) {
      this.analyzeNets();
    }
    return this.lastPointToNet?.get(pointKey(position));
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

  private getPowerSymbolName(component: Component): string | null {
    const libId = component.libId.toLowerCase();
    if (libId.startsWith("power:")) {
      return component.value || null;
    }
    if (component.reference.startsWith("#PWR")) {
      return component.value || null;
    }
    return null;
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
