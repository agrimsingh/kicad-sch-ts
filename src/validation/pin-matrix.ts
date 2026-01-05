// src/validation/pin-matrix.ts

import { PinType } from "../core/types";

export enum PinSeverity {
  OK = 0,
  WARNING = 1,
  ERROR = 2,
}

const PIN_TYPE_ALIASES: Record<string, PinType> = {
  input: PinType.INPUT,
  output: PinType.OUTPUT,
  bidirectional: PinType.BIDIRECTIONAL,
  tristate: PinType.TRI_STATE,
  tri_state: PinType.TRI_STATE,
  passive: PinType.PASSIVE,
  free: PinType.FREE,
  unspecified: PinType.UNSPECIFIED,
  power_in: PinType.POWER_IN,
  power_out: PinType.POWER_OUT,
  open_collector: PinType.OPEN_COLLECTOR,
  open_emitter: PinType.OPEN_EMITTER,
  no_connect: PinType.NO_CONNECT,
};

export class PinConflictMatrix {
  private matrix: Map<string, PinSeverity> = new Map();

  constructor() {
    this.matrix = this.getDefaultMatrix();
  }

  private getDefaultMatrix(): Map<string, PinSeverity> {
    const matrix = new Map<string, PinSeverity>();
    const pinTypes = Object.values(PinType);

    for (const pin1 of pinTypes) {
      for (const pin2 of pinTypes) {
        matrix.set(`${pin1},${pin2}`, PinSeverity.OK);
      }
    }

    const errorRules: [PinType, PinType][] = [
      [PinType.OUTPUT, PinType.OUTPUT],
      [PinType.POWER_OUT, PinType.POWER_OUT],
      [PinType.OUTPUT, PinType.POWER_OUT],
      [PinType.NO_CONNECT, PinType.INPUT],
      [PinType.NO_CONNECT, PinType.OUTPUT],
      [PinType.NO_CONNECT, PinType.BIDIRECTIONAL],
      [PinType.NO_CONNECT, PinType.TRI_STATE],
      [PinType.NO_CONNECT, PinType.POWER_IN],
      [PinType.NO_CONNECT, PinType.POWER_OUT],
      [PinType.NO_CONNECT, PinType.OPEN_COLLECTOR],
      [PinType.NO_CONNECT, PinType.OPEN_EMITTER],
    ];

    for (const [pin1, pin2] of errorRules) {
      matrix.set(`${pin1},${pin2}`, PinSeverity.ERROR);
      matrix.set(`${pin2},${pin1}`, PinSeverity.ERROR);
    }

    const warningRules: [PinType, PinType][] = [
      [PinType.UNSPECIFIED, PinType.INPUT],
      [PinType.UNSPECIFIED, PinType.OUTPUT],
      [PinType.UNSPECIFIED, PinType.BIDIRECTIONAL],
      [PinType.UNSPECIFIED, PinType.TRI_STATE],
      [PinType.UNSPECIFIED, PinType.PASSIVE],
      [PinType.UNSPECIFIED, PinType.POWER_IN],
      [PinType.UNSPECIFIED, PinType.POWER_OUT],
      [PinType.UNSPECIFIED, PinType.OPEN_COLLECTOR],
      [PinType.UNSPECIFIED, PinType.OPEN_EMITTER],
      [PinType.UNSPECIFIED, PinType.UNSPECIFIED],
      [PinType.TRI_STATE, PinType.OUTPUT],
      [PinType.TRI_STATE, PinType.TRI_STATE],
    ];

    for (const [pin1, pin2] of warningRules) {
      matrix.set(`${pin1},${pin2}`, PinSeverity.WARNING);
      matrix.set(`${pin2},${pin1}`, PinSeverity.WARNING);
    }

    for (const pinType of pinTypes) {
      if (pinType !== PinType.NO_CONNECT) {
        matrix.set(`${PinType.PASSIVE},${pinType}`, PinSeverity.OK);
        matrix.set(`${pinType},${PinType.PASSIVE}`, PinSeverity.OK);
      }
    }

    for (const pinType of pinTypes) {
      matrix.set(`${PinType.FREE},${pinType}`, PinSeverity.OK);
      matrix.set(`${pinType},${PinType.FREE}`, PinSeverity.OK);
    }

    return matrix;
  }

  normalizePinType(pinType: string): PinType {
    const normalized = pinType.toLowerCase().trim();
    if (normalized in PIN_TYPE_ALIASES) {
      return PIN_TYPE_ALIASES[normalized];
    }
    // Fallback for aliases not in the map
    for (const key in PIN_TYPE_ALIASES) {
      if (key.includes(normalized)) return PIN_TYPE_ALIASES[key];
    }
    // Default to unspecified if unknown
    return PinType.UNSPECIFIED;
  }

  checkConnection(pin1_type: string, pin2_type: string): PinSeverity {
    const pin1 = this.normalizePinType(pin1_type);
    const pin2 = this.normalizePinType(pin2_type);
    const key = `${pin1},${pin2}`;
    return this.matrix.get(key) ?? PinSeverity.OK;
  }
}
