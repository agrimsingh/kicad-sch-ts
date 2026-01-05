// src/library/cache.ts

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { SExpressionParser, Symbol as SSymbol } from "../core/parser";
import {
  SymbolDefinition,
  SymbolUnit,
  SymbolPin,
  PinType,
  PinShape,
  PropertyValue,
} from "../core/types";
import { LibraryError } from "../core/exceptions";

export interface LibraryStats {
  symbolCount: number;
  loadTime: number;
  lastAccessed: number;
}

export class SymbolLibraryCache {
  private symbolCache: Map<string, SymbolDefinition> = new Map();
  private resolvedSymbolCache: Map<string, SymbolDefinition> = new Map();
  private libraryIndex: Map<string, string[]> = new Map();
  private libraryPaths: string[] = [];
  private libStats: Map<string, LibraryStats> = new Map();
  private parser: SExpressionParser = new SExpressionParser();

  constructor() {
    this.discoverLibraryPaths();
  }

  /**
   * Discover KiCAD library paths from environment and standard locations.
   */
  private discoverLibraryPaths(): void {
    const paths: string[] = [];

    // Check environment variables
    const envVars = [
      "KICAD_SYMBOL_DIR",
      "KICAD8_SYMBOL_DIR",
      "KICAD7_SYMBOL_DIR",
    ];
    for (const envVar of envVars) {
      const path = process.env[envVar];
      if (path && existsSync(path)) {
        paths.push(path);
      }
    }

    // Standard locations by platform
    const platform = process.platform;
    const standardPaths: string[] = [];

    if (platform === "darwin") {
      standardPaths.push(
        "/Applications/KiCad/KiCad.app/Contents/SharedSupport/symbols",
        join(homedir(), "Library/Application Support/kicad/8.0/symbols"),
        join(homedir(), "Library/Application Support/kicad/7.0/symbols")
      );
    } else if (platform === "win32") {
      standardPaths.push(
        "C:\\Program Files\\KiCad\\8.0\\share\\kicad\\symbols",
        "C:\\Program Files\\KiCad\\7.0\\share\\kicad\\symbols"
      );
    } else {
      // Linux
      standardPaths.push(
        "/usr/share/kicad/symbols",
        "/usr/local/share/kicad/symbols",
        join(homedir(), ".local/share/kicad/8.0/symbols"),
        join(homedir(), ".local/share/kicad/7.0/symbols")
      );
    }

    for (const path of standardPaths) {
      if (existsSync(path) && !paths.includes(path)) {
        paths.push(path);
      }
    }

    this.libraryPaths = paths;
  }

  /**
   * Add a custom library path.
   */
  addLibraryPath(path: string): void {
    if (existsSync(path) && !this.libraryPaths.includes(path)) {
      this.libraryPaths.push(path);
    }
  }

  /**
   * Get all library paths currently configured.
   */
  getLibraryPaths(): string[] {
    return [...this.libraryPaths];
  }

  setLibraryPaths(paths: string[]): void {
    this.libraryPaths = [...paths];
    this.clearCache();
  }

  /**
   * Get all available library names.
   */
  getLibraryNames(): string[] {
    const names = new Set<string>();

    for (const libPath of this.libraryPaths) {
      try {
        const files = readdirSync(libPath);
        for (const file of files) {
          if (file.endsWith(".kicad_sym")) {
            names.add(basename(file, ".kicad_sym"));
          }
        }
      } catch {
        // Directory not readable
      }
    }

    return Array.from(names).sort();
  }

  /**
   * Get a symbol by lib_id (e.g., "Device:R").
   */
  getSymbol(libId: string): SymbolDefinition | undefined {
    if (this.resolvedSymbolCache.has(libId)) {
      return this.resolvedSymbolCache.get(libId);
    }
    if (this.symbolCache.has(libId)) {
      const resolved = this.resolveSymbolInheritance(libId);
      if (resolved) {
        this.resolvedSymbolCache.set(libId, resolved);
      }
      return resolved;
    }

    const [libraryName, symbolName] = libId.split(":");
    if (!libraryName || !symbolName) {
      return undefined;
    }

    if (!this.libraryIndex.has(libraryName)) {
      this.loadLibrary(libraryName);
    }

    const resolved = this.resolveSymbolInheritance(libId);
    if (resolved) {
      this.resolvedSymbolCache.set(libId, resolved);
    }
    return resolved;
  }

  /**
   * Load a library file and cache all its symbols.
   */
  private loadLibrary(libraryName: string): void {
    const startTime = Date.now();
    const filename = `${libraryName}.kicad_sym`;

    for (const libPath of this.libraryPaths) {
      const fullPath = join(libPath, filename);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          const symbols = this.parseLibraryFile(content, libraryName);

          const symbolNames: string[] = [];
          for (const symbol of symbols) {
            const libId = `${libraryName}:${symbol.name}`;
            symbol.libId = libId;
            symbol.library = libraryName;
            this.symbolCache.set(libId, symbol);
            symbolNames.push(symbol.name);
          }

          this.libraryIndex.set(libraryName, symbolNames);
          this.resolvedSymbolCache.clear();
          this.libStats.set(libraryName, {
            symbolCount: symbols.length,
            loadTime: Date.now() - startTime,
            lastAccessed: Date.now(),
          });

          return;
        } catch (e) {
          console.error(`Error loading library ${libraryName}:`, e);
        }
      }
    }
  }

  /**
   * Parse a .kicad_sym library file.
   */
  private parseLibraryFile(
    content: string,
    libraryName: string
  ): SymbolDefinition[] {
    const sexp = this.parser.parse(content) as unknown[];

    if (
      !Array.isArray(sexp) ||
      !(sexp[0] instanceof SSymbol) ||
      sexp[0].name !== "kicad_symbol_lib"
    ) {
      throw new LibraryError("Invalid symbol library file");
    }

    const symbols: SymbolDefinition[] = [];

    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (
        Array.isArray(item) &&
        item[0] instanceof SSymbol &&
        item[0].name === "symbol"
      ) {
        const symbol = this.parseSymbolDefinition(item, libraryName);
        symbols.push(symbol);
      }
    }

    return symbols;
  }

  /**
   * Parse a symbol definition from S-expression.
   */
  private parseSymbolDefinition(
    sexp: unknown[],
    libraryName: string
  ): SymbolDefinition {
    const name = sexp[1] as string;

    const symbol: SymbolDefinition = {
      libId: `${libraryName}:${name}`,
      name,
      library: libraryName,
      referencePrefix: "U",
      description: "",
      keywords: "",
      datasheet: "",
      unitCount: 1,
      unitsLocked: false,
      isPower: false,
      pinNames: { offset: 0.508, hide: false },
      pinNumbers: { hide: false },
      inBom: true,
      onBoard: true,
      properties: new Map(),
      propertyPositions: new Map(),
      units: new Map(),
    };

    for (let i = 2; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || !(item[0] instanceof SSymbol)) continue;

      const tag = item[0].name;
      switch (tag) {
        case "property":
          this.parseSymbolProperty(item, symbol);
          break;
        case "extends":
          symbol.extends = item[1] as string;
          break;
        case "power":
          symbol.isPower = true;
          break;
        case "pin_names":
          symbol.pinNamesDefined = true;
          this.parsePinNames(item, symbol);
          break;
        case "pin_numbers":
          symbol.pinNumbersDefined = true;
          if (
            item.some((x: unknown) => x instanceof SSymbol && x.name === "hide")
          ) {
            symbol.pinNumbers.hide = true;
          }
          break;
        case "in_bom":
          symbol.inBom = item[1] === "yes" || item[1] === true;
          break;
        case "on_board":
          symbol.onBoard = item[1] === "yes" || item[1] === true;
          break;
        case "symbol":
          this.parseSymbolUnit(item, symbol);
          break;
      }
    }

    return symbol;
  }

  private parseSymbolProperty(sexp: unknown[], symbol: SymbolDefinition): void {
    const name = sexp[1] as string;
    const value = sexp[2] as string;

    switch (name) {
      case "Reference":
        symbol.referencePrefix = value.replace(/[0-9]/g, "");
        break;
      case "ki_description":
        symbol.description = value;
        break;
      case "ki_keywords":
        symbol.keywords = value;
        break;
      case "Datasheet":
        symbol.datasheet = value;
        break;
    }

    const propValue: PropertyValue = {
      value,
      position: { x: 0, y: 0 },
      rotation: 0,
    };

    // Parse position if present
    for (let i = 3; i < sexp.length; i++) {
      const item = sexp[i];
      if (
        Array.isArray(item) &&
        item[0] instanceof SSymbol &&
        item[0].name === "at"
      ) {
        propValue.position = {
          x: item[1] as number,
          y: item[2] as number,
        };
        if (item.length > 3) {
          propValue.rotation = item[3] as number;
        }
      }
    }

    symbol.properties.set(name, propValue);
    if (symbol.propertyPositions) {
      symbol.propertyPositions.set(name, [
        propValue.position.x,
        propValue.position.y,
        propValue.rotation,
      ]);
    }
  }

  private parsePinNames(sexp: unknown[], symbol: SymbolDefinition): void {
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (
        Array.isArray(item) &&
        item[0] instanceof SSymbol &&
        item[0].name === "offset"
      ) {
        symbol.pinNames.offset = item[1] as number;
      } else if (item instanceof SSymbol && item.name === "hide") {
        symbol.pinNames.hide = true;
      }
    }
  }

  private parseSymbolUnit(sexp: unknown[], symbol: SymbolDefinition): void {
    const unitName = sexp[1] as string;
    const parts = unitName.split("_");
    const unitNumber = parseInt(parts[parts.length - 2]) || 0;
    const style = parseInt(parts[parts.length - 1]) || 1;

    if (!symbol.units.has(unitNumber)) {
      symbol.units.set(unitNumber, {
        unitNumber,
        style,
        graphics: [],
        pins: [],
      });
    }

    const unit = symbol.units.get(unitNumber)!;

    for (let i = 2; i < sexp.length; i++) {
      const item = sexp[i];
      if (!Array.isArray(item) || !(item[0] instanceof SSymbol)) continue;

      const tag = item[0].name;
      if (tag === "pin") {
        unit.pins.push(this.parsePin(item));
      }
    }

    symbol.unitCount = Math.max(symbol.unitCount, unitNumber + 1);
  }

  private parsePin(sexp: unknown[]): SymbolPin {
    const electricalType = sexp[1] as string;
    const graphicStyle = sexp[2] as string;

    const pin: SymbolPin = {
      number: "",
      name: "",
      position: { x: 0, y: 0 },
      length: 2.54,
      rotation: 0,
      electricalType: electricalType as PinType,
      graphicStyle: graphicStyle as PinShape,
      hide: false,
      alternate: [],
    };

    for (let i = 3; i < sexp.length; i++) {
      const item = sexp[i];
      if (item instanceof SSymbol && item.name === "hide") {
        pin.hide = true;
        continue;
      }
      if (!Array.isArray(item) || !(item[0] instanceof SSymbol)) continue;

      const tag = item[0].name;
      switch (tag) {
        case "at":
          pin.position = { x: item[1] as number, y: item[2] as number };
          pin.rotation = (item[3] as number) || 0;
          break;
        case "length":
          pin.length = item[1] as number;
          break;
        case "name":
          pin.name = item[1] as string;
          break;
        case "number":
          pin.number = item[1] as string;
          break;
        case "hide":
          pin.hide = true;
          break;
      }
    }

    return pin;
  }

  listPins(libId: string, unit?: number): SymbolPin[] {
    const symbol = this.getSymbol(libId);
    if (!symbol) return [];

    if (unit !== undefined) {
      return symbol.units.get(unit)?.pins || [];
    }

    const pins: SymbolPin[] = [];
    for (const symbolUnit of symbol.units.values()) {
      pins.push(...symbolUnit.pins);
    }
    return pins;
  }

  showPins(libId: string, unit?: number): string[] {
    return this.listPins(libId, unit).map(
      (pin) => `${pin.number}:${pin.name}`
    );
  }

  validateInheritanceChain(libId: string): string[] {
    const errors: string[] = [];
    try {
      this.resolveSymbolInheritance(libId);
    } catch (e) {
      errors.push((e as Error).message);
    }
    return errors;
  }

  validateAllInheritanceChains(): Map<string, string[]> {
    const results = new Map<string, string[]>();
    for (const libId of this.symbolCache.keys()) {
      const errors = this.validateInheritanceChain(libId);
      if (errors.length > 0) {
        results.set(libId, errors);
      }
    }
    return results;
  }

  private resolveSymbolInheritance(
    libId: string,
    stack: string[] = []
  ): SymbolDefinition | undefined {
    if (this.resolvedSymbolCache.has(libId)) {
      return this.resolvedSymbolCache.get(libId);
    }

    const symbol = this.symbolCache.get(libId);
    if (!symbol) return undefined;

    if (!symbol.extends) {
      this.resolvedSymbolCache.set(libId, symbol);
      return symbol;
    }

    if (stack.includes(libId)) {
      throw new LibraryError(
        `Circular symbol inheritance: ${[...stack, libId].join(" -> ")}`
      );
    }

    const baseName = symbol.extends;
    const baseLibId = baseName.includes(":")
      ? baseName
      : `${symbol.library}:${baseName}`;
    const baseSymbol = this.resolveSymbolInheritance(baseLibId, [
      ...stack,
      libId,
    ]);

    if (!baseSymbol) {
      throw new LibraryError(`Base symbol not found: ${baseLibId}`);
    }

    const merged = this.mergeSymbols(baseSymbol, symbol);
    this.resolvedSymbolCache.set(libId, merged);
    return merged;
  }

  private mergeSymbols(
    base: SymbolDefinition,
    derived: SymbolDefinition
  ): SymbolDefinition {
    const merged: SymbolDefinition = {
      ...base,
      ...derived,
      properties: new Map(base.properties),
      units: new Map(),
    };

    const derivedOverrides = {
      reference: derived.properties.has("Reference"),
      description: derived.properties.has("ki_description"),
      keywords: derived.properties.has("ki_keywords"),
      datasheet: derived.properties.has("Datasheet"),
    };

    if (!derivedOverrides.reference) {
      merged.referencePrefix = base.referencePrefix;
    }
    if (!derivedOverrides.description) {
      merged.description = base.description;
    }
    if (!derivedOverrides.keywords) {
      merged.keywords = base.keywords;
    }
    if (!derivedOverrides.datasheet) {
      merged.datasheet = base.datasheet;
    }

    if (!derived.pinNamesDefined) {
      merged.pinNames = { ...base.pinNames };
    }
    if (!derived.pinNumbersDefined) {
      merged.pinNumbers = { ...base.pinNumbers };
    }

    if (!derived.isPower) {
      merged.isPower = base.isPower;
    }

    if (derived.units.size === 0) {
      for (const [unitNumber, unit] of base.units) {
        merged.units.set(unitNumber, this.cloneSymbolUnit(unit));
      }
      merged.unitCount = base.unitCount;
    } else {
      for (const [unitNumber, unit] of base.units) {
        merged.units.set(unitNumber, this.cloneSymbolUnit(unit));
      }
      for (const [unitNumber, unit] of derived.units) {
        merged.units.set(unitNumber, this.cloneSymbolUnit(unit));
      }
      merged.unitCount = Math.max(base.unitCount, derived.unitCount);
    }

    for (const [name, prop] of derived.properties) {
      merged.properties.set(name, prop);
    }

    return merged;
  }

  private cloneSymbolUnit(unit: SymbolUnit): SymbolUnit {
    return {
      unitNumber: unit.unitNumber,
      style: unit.style,
      graphics: unit.graphics.map((graphic) => ({ ...graphic })),
      pins: unit.pins.map((pin) => this.cloneSymbolPin(pin)),
    };
  }

  private cloneSymbolPin(pin: SymbolPin): SymbolPin {
    return {
      ...pin,
      nameEffects: pin.nameEffects
        ? {
            ...pin.nameEffects,
            font: pin.nameEffects.font
              ? { ...pin.nameEffects.font }
              : undefined,
            justify: pin.nameEffects.justify
              ? { ...pin.nameEffects.justify }
              : undefined,
          }
        : undefined,
      numberEffects: pin.numberEffects
        ? {
            ...pin.numberEffects,
            font: pin.numberEffects.font
              ? { ...pin.numberEffects.font }
              : undefined,
            justify: pin.numberEffects.justify
              ? { ...pin.numberEffects.justify }
              : undefined,
          }
        : undefined,
      alternate: pin.alternate.map((alt) => ({ ...alt })),
    };
  }

  /**
   * Search for symbols by name or keywords.
   */
  searchSymbols(query: string, limit: number = 50): SymbolDefinition[] {
    const results: SymbolDefinition[] = [];
    const queryLower = query.toLowerCase();

    // First load all libraries to search
    for (const libName of this.getLibraryNames()) {
      if (!this.libraryIndex.has(libName)) {
        this.loadLibrary(libName);
      }
    }

    for (const symbol of this.symbolCache.values()) {
      if (results.length >= limit) break;

      const nameMatch = symbol.name.toLowerCase().includes(queryLower);
      const descMatch = symbol.description.toLowerCase().includes(queryLower);
      const keywordMatch = symbol.keywords.toLowerCase().includes(queryLower);

      if (nameMatch || descMatch || keywordMatch) {
        results.push(symbol);
      }
    }

    return results;
  }

  /**
   * Get all symbols in a library.
   */
  getLibrarySymbols(libraryName: string): SymbolDefinition[] {
    if (!this.libraryIndex.has(libraryName)) {
      this.loadLibrary(libraryName);
    }

    const symbolNames = this.libraryIndex.get(libraryName) || [];
    return symbolNames
      .map((name) => this.getSymbol(`${libraryName}:${name}`))
      .filter(Boolean) as SymbolDefinition[];
  }

  getPerformanceStats(): {
    totalSymbolsCached: number;
    totalLibrariesLoaded: number;
    libraryStats: Map<string, LibraryStats>;
  } {
    return {
      totalSymbolsCached: this.symbolCache.size,
      totalLibrariesLoaded: this.libraryIndex.size,
      libraryStats: this.libStats,
    };
  }

  /**
   * Clear the cache (useful for testing or refreshing).
   */
  clearCache(): void {
    this.symbolCache.clear();
    this.resolvedSymbolCache.clear();
    this.libraryIndex.clear();
    this.libStats.clear();
  }
}

// Global cache instance
let globalCache: SymbolLibraryCache | undefined;

export function getSymbolCache(): SymbolLibraryCache {
  if (!globalCache) {
    globalCache = new SymbolLibraryCache();
  }
  return globalCache;
}

export function getSymbolInfo(libId: string): SymbolDefinition | undefined {
  return getSymbolCache().getSymbol(libId);
}

export function searchSymbols(
  query: string,
  limit?: number
): SymbolDefinition[] {
  return getSymbolCache().searchSymbols(query, limit);
}

export function listSymbolPins(
  libId: string,
  unit?: number
): SymbolPin[] {
  return getSymbolCache().listPins(libId, unit);
}

export function showSymbolPins(
  libId: string,
  unit?: number
): string[] {
  return getSymbolCache().showPins(libId, unit);
}

export function validateSymbolInheritance(libId: string): string[] {
  return getSymbolCache().validateInheritanceChain(libId);
}

export function validateAllSymbolInheritance(): Map<string, string[]> {
  return getSymbolCache().validateAllInheritanceChains();
}
