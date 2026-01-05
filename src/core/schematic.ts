// src/core/schematic.ts

import { readFileSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { SExpressionParser, Symbol, SExp, isSymbol, isList, getTag, findElement, findElements, isFloat } from "./parser";
import { ExactFormatter } from "./formatter";
import { ParseError } from "./exceptions";
import {
  Point,
  Wire,
  Junction,
  NoConnect,
  Label,
  GlobalLabel,
  HierarchicalLabel,
  Text,
  TextBox,
  SchematicRectangle,
  Bus,
  BusEntry,
  Sheet,
  SchematicSymbol,
  PropertyValue,
  TextEffects,
  Stroke,
  StrokeType,
  TextJustify,
  TextVerticalJustify,
  HierarchicalLabelShape,
  TitleBlock,
  SymbolInstance,
  SheetInstance,
  SheetPin,
  FillType,
} from "./types";
import {
  ComponentCollection,
  WireCollection,
  LabelCollection,
  JunctionCollection,
  NoConnectCollection,
  BusCollection,
  BusEntryCollection,
  SheetCollection,
  TextCollection,
  TextBoxCollection,
  RectangleCollection,
} from "./collections";

/**
 * Main Schematic class that handles loading, parsing, and saving KiCAD schematic files.
 * 
 * For round-trip fidelity, we preserve the original S-expression structure
 * and only modify specific elements when needed.
 */
export class Schematic {
  // Raw S-expression representation (preserved for round-trip fidelity)
  private _sexp: SExp[];
  
  // Metadata
  public version: number = 20250114;
  public generator: string = "eeschema";
  public generatorVersion: string = "9.0";
  public uuid: string = "";
  public paper: string = "A4";
  public titleBlock?: TitleBlock;
  public embeddedFonts: boolean = false;
  
  // Collections
  public readonly components: ComponentCollection;
  public readonly wires: WireCollection;
  public readonly labels: LabelCollection;
  public readonly junctions: JunctionCollection;
  public readonly noConnects: NoConnectCollection;
  public readonly buses: BusCollection;
  public readonly busEntries: BusEntryCollection;
  public readonly sheets: SheetCollection;
  public readonly texts: TextCollection;
  public readonly textBoxes: TextBoxCollection;
  public readonly rectangles: RectangleCollection;
  
  // lib_symbols S-expression (preserved for round-trip)
  private _libSymbolsSexp: SExp[] | null = null;
  
  // sheet_instances and symbol_instances (preserved for round-trip)
  private _sheetInstancesSexp: SExp[] | null = null;
  private _symbolInstancesSexp: SExp[] | null = null;

  // File I/O helper
  private _filePath: string | null = null;
  
  // Track if this schematic was created fresh (vs loaded from file)
  private _isCreated: boolean = false;
  private _isModified: boolean = false;

  private constructor() {
    this._sexp = [];
    this.components = new ComponentCollection();
    this.wires = new WireCollection();
    this.labels = new LabelCollection();
    this.junctions = new JunctionCollection();
    this.noConnects = new NoConnectCollection();
    this.buses = new BusCollection();
    this.busEntries = new BusEntryCollection();
    this.sheets = new SheetCollection();
    this.texts = new TextCollection();
    this.textBoxes = new TextBoxCollection();
    this.rectangles = new RectangleCollection();
  }

  /**
   * Load a schematic from a file.
   */
  static load(filepath: string): Schematic {
    const content = readFileSync(filepath, "utf-8");
    const schematic = Schematic.fromString(content);
    schematic._filePath = filepath;
    return schematic;
  }

  /**
   * Parse a schematic from a string.
   */
  static fromString(content: string): Schematic {
    const parser = new SExpressionParser();
    const sexp = parser.parse(content);
    
    if (!isList(sexp) || getTag(sexp) !== "kicad_sch") {
      throw new ParseError("Invalid KiCAD schematic file: expected (kicad_sch ...)");
    }
    
    const schematic = new Schematic();
    schematic._sexp = sexp;
    schematic.parseSchematic(sexp);
    schematic.resetModifiedFlags();
    
    return schematic;
  }

  /**
   * Create a new empty schematic.
   */
  static create(title?: string): Schematic {
    const schematic = new Schematic();
    schematic.uuid = randomUUID();
    schematic._isCreated = true;
    
    if (title) {
      schematic.titleBlock = {
        title,
        comment: new Map(),
      };
    }
    
    // Build initial S-expression
    schematic._sexp = schematic.buildSexp();
    
    return schematic;
  }

  /**
   * Parse the schematic S-expression into the data model.
   */
  private parseSchematic(sexp: SExp[]): void {
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (!isList(item)) continue;
      
      const tag = getTag(item);
      
      switch (tag) {
        case "version":
          this.version = this.getNumber(item, 1) || this.version;
          break;
        case "generator":
          this.generator = this.getString(item, 1) || this.generator;
          break;
        case "generator_version":
          this.generatorVersion = this.getString(item, 1) || this.generatorVersion;
          break;
        case "uuid":
          this.uuid = this.getString(item, 1) || "";
          break;
        case "paper":
          this.paper = this.getString(item, 1) || "A4";
          break;
        case "title_block":
          this.parseTitleBlock(item);
          break;
        case "lib_symbols":
          this._libSymbolsSexp = item;
          break;
        case "wire":
          this.parseWire(item);
          break;
        case "bus":
          this.parseBus(item);
          break;
        case "bus_entry":
          this.parseBusEntry(item);
          break;
        case "junction":
          this.parseJunction(item);
          break;
        case "no_connect":
          this.parseNoConnect(item);
          break;
        case "label":
          this.parseLabel(item);
          break;
        case "global_label":
          this.parseGlobalLabel(item);
          break;
        case "hierarchical_label":
          this.parseHierarchicalLabel(item);
          break;
        case "symbol":
          this.parseSymbol(item);
          break;
        case "sheet":
          this.parseSheet(item);
          break;
        case "text":
          this.parseText(item);
          break;
        case "text_box":
          this.parseTextBox(item);
          break;
        case "rectangle":
          this.parseRectangle(item);
          break;
        case "sheet_instances":
          this._sheetInstancesSexp = item;
          break;
        case "symbol_instances":
          this._symbolInstancesSexp = item;
          break;
        case "embedded_fonts":
          this.embeddedFonts = this.getBool(item, 1) || false;
          break;
      }
    }
  }

  private hasModifiedCollections(): boolean {
    return (
      this.components.isModified ||
      this.wires.isModified ||
      this.labels.isModified ||
      this.junctions.isModified ||
      this.noConnects.isModified ||
      this.buses.isModified ||
      this.busEntries.isModified ||
      this.sheets.isModified ||
      this.texts.isModified ||
      this.textBoxes.isModified ||
      this.rectangles.isModified
    );
  }

  private resetModifiedFlags(): void {
    this._isModified = false;
    this.components.resetModified();
    this.wires.resetModified();
    this.labels.resetModified();
    this.junctions.resetModified();
    this.noConnects.resetModified();
    this.buses.resetModified();
    this.busEntries.resetModified();
    this.sheets.resetModified();
    this.texts.resetModified();
    this.textBoxes.resetModified();
    this.rectangles.resetModified();
  }

  private parseTitleBlock(sexp: SExp[]): void {
    const block: TitleBlock = { comment: new Map() };
    
    for (let i = 1; i < sexp.length; i++) {
      const item = sexp[i];
      if (!isList(item)) continue;
      
      const tag = getTag(item);
      switch (tag) {
        case "title":
          block.title = this.getString(item, 1) || undefined;
          break;
        case "date":
          block.date = this.getString(item, 1) || undefined;
          break;
        case "rev":
          block.rev = this.getString(item, 1) || undefined;
          break;
        case "company":
          block.company = this.getString(item, 1) || undefined;
          break;
        case "comment":
          const num = this.getNumber(item, 1);
          const text = this.getString(item, 2);
          if (num !== null && text !== null) {
            block.comment.set(num, text);
          }
          break;
      }
    }
    
    this.titleBlock = block;
  }

  private parseWire(sexp: SExp[]): void {
    const pts = findElement(sexp, "pts");
    const stroke = findElement(sexp, "stroke");
    const uuidElem = findElement(sexp, "uuid");
    
    const points = this.parsePoints(pts);
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const wire: Wire = {
      uuid,
      points,
      stroke: stroke ? this.parseStroke(stroke) : undefined,
    };
    
    this.wires.addFromData(wire);
  }

  private parseBus(sexp: SExp[]): void {
    const pts = findElement(sexp, "pts");
    const stroke = findElement(sexp, "stroke");
    const uuidElem = findElement(sexp, "uuid");
    
    const points = this.parsePoints(pts);
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const bus: Bus = {
      uuid,
      points,
      stroke: stroke ? this.parseStroke(stroke) : undefined,
    };
    
    this.buses.addFromData(bus);
  }

  private parseBusEntry(sexp: SExp[]): void {
    const at = findElement(sexp, "at");
    const size = findElement(sexp, "size");
    const stroke = findElement(sexp, "stroke");
    const uuidElem = findElement(sexp, "uuid");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const entry: BusEntry = {
      uuid,
      position,
      size: size ? {
        width: this.getNumber(size, 1) || 0,
        height: this.getNumber(size, 2) || 0,
      } : { width: 0, height: 0 },
      stroke: stroke ? this.parseStroke(stroke) : undefined,
    };
    
    this.busEntries.addFromData(entry);
  }

  private parseJunction(sexp: SExp[]): void {
    const at = findElement(sexp, "at");
    const diameter = findElement(sexp, "diameter");
    const color = findElement(sexp, "color");
    const uuidElem = findElement(sexp, "uuid");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const junction: Junction = {
      uuid,
      position,
      diameter: diameter ? this.getNumber(diameter, 1) || 0 : 0,
      color: color ? [
        this.getNumber(color, 1) || 0,
        this.getNumber(color, 2) || 0,
        this.getNumber(color, 3) || 0,
        this.getNumber(color, 4) || 0,
      ] : [0, 0, 0, 0],
    };
    
    this.junctions.addFromData(junction);
  }

  private parseNoConnect(sexp: SExp[]): void {
    const at = findElement(sexp, "at");
    const uuidElem = findElement(sexp, "uuid");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const noConnect: NoConnect = {
      uuid,
      position,
    };
    
    this.noConnects.addFromData(noConnect);
  }

  private parseLabel(sexp: SExp[]): void {
    const text = this.getString(sexp, 1) || "";
    const at = findElement(sexp, "at");
    const effects = findElement(sexp, "effects");
    const uuidElem = findElement(sexp, "uuid");
    const fieldsAutoplaced = findElement(sexp, "fields_autoplaced");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const rotation = at ? this.getNumber(at, 3) || 0 : 0;
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const label: Label = {
      uuid,
      text,
      position,
      rotation,
      effects: effects ? this.parseTextEffects(effects) : undefined,
      fieldsAutoplaced: fieldsAutoplaced !== null,
    };
    
    this.labels.addFromData(label);
  }

  private parseGlobalLabel(sexp: SExp[]): void {
    const text = this.getString(sexp, 1) || "";
    const at = findElement(sexp, "at");
    const shape = findElement(sexp, "shape");
    const effects = findElement(sexp, "effects");
    const uuidElem = findElement(sexp, "uuid");
    const fieldsAutoplaced = findElement(sexp, "fields_autoplaced");
    const properties = findElements(sexp, "property");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const rotation = at ? this.getNumber(at, 3) || 0 : 0;
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const label: GlobalLabel = {
      uuid,
      text,
      position,
      rotation,
      shape: shape ? this.parseShape(shape) : HierarchicalLabelShape.BIDIRECTIONAL,
      effects: effects ? this.parseTextEffects(effects) : undefined,
      fieldsAutoplaced: fieldsAutoplaced !== null,
      properties: new Map(),
    };
    
    for (const prop of properties) {
      const propValue = this.parseProperty(prop);
      if (propValue) {
        label.properties.set(propValue.name, propValue.value);
      }
    }
    
    this.labels.addFromData(label);
  }

  private parseHierarchicalLabel(sexp: SExp[]): void {
    const text = this.getString(sexp, 1) || "";
    const at = findElement(sexp, "at");
    const shape = findElement(sexp, "shape");
    const effects = findElement(sexp, "effects");
    const uuidElem = findElement(sexp, "uuid");
    const fieldsAutoplaced = findElement(sexp, "fields_autoplaced");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const rotation = at ? this.getNumber(at, 3) || 0 : 0;
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const label: HierarchicalLabel = {
      uuid,
      text,
      position,
      rotation,
      shape: shape ? this.parseShape(shape) : HierarchicalLabelShape.BIDIRECTIONAL,
      effects: effects ? this.parseTextEffects(effects) : undefined,
      fieldsAutoplaced: fieldsAutoplaced !== null,
    };
    
    this.labels.addFromData(label);
  }

  private parseSymbol(sexp: SExp[]): void {
    const libId = findElement(sexp, "lib_id");
    const at = findElement(sexp, "at");
    const unit = findElement(sexp, "unit");
    const excludeFromSim = findElement(sexp, "exclude_from_sim");
    const inBom = findElement(sexp, "in_bom");
    const onBoard = findElement(sexp, "on_board");
    const dnp = findElement(sexp, "dnp");
    const fieldsAutoplaced = findElement(sexp, "fields_autoplaced");
    const uuidElem = findElement(sexp, "uuid");
    const properties = findElements(sexp, "property");
    const pins = findElements(sexp, "pin");
    const instances = findElement(sexp, "instances");
    const mirror = findElement(sexp, "mirror");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const rotation = at ? this.getNumber(at, 3) || 0 : 0;
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const symbol: SchematicSymbol = {
      uuid,
      libId: libId ? this.getString(libId, 1) || "" : "",
      position,
      rotation,
      mirror: mirror ? this.getString(mirror, 1) as "x" | "y" | undefined : undefined,
      unit: unit ? this.getNumber(unit, 1) || 1 : 1,
      excludeFromSim: excludeFromSim ? this.getBool(excludeFromSim, 1) || false : false,
      inBom: inBom ? this.getBool(inBom, 1) || true : true,
      onBoard: onBoard ? this.getBool(onBoard, 1) || true : true,
      dnp: dnp ? this.getBool(dnp, 1) || false : false,
      fieldsAutoplaced: fieldsAutoplaced !== null,
      properties: new Map(),
      pins: new Map(),
      instances: instances ? this.parseSymbolInstances(instances) : undefined,
    };
    
    for (const prop of properties) {
      const propValue = this.parseProperty(prop);
      if (propValue) {
        symbol.properties.set(propValue.name, propValue.value);
      }
    }
    
    for (const pin of pins) {
      const pinNum = this.getString(pin, 1);
      const pinUuidElem = findElement(pin, "uuid");
      const pinUuid = pinUuidElem ? this.getString(pinUuidElem, 1) || "" : "";
      if (pinNum) {
        symbol.pins.set(pinNum, pinUuid);
      }
    }
    
    this.components.addFromSymbol(symbol);
  }

  private parseSheet(sexp: SExp[]): void {
    const at = findElement(sexp, "at");
    const size = findElement(sexp, "size");
    const stroke = findElement(sexp, "stroke");
    const fill = findElement(sexp, "fill");
    const uuidElem = findElement(sexp, "uuid");
    const fieldsAutoplaced = findElement(sexp, "fields_autoplaced");
    const properties = findElements(sexp, "property");
    const pins = findElements(sexp, "pin");
    const instances = findElement(sexp, "instances");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    let nameValue: PropertyValue = { value: "", position: { x: 0, y: 0 }, rotation: 0 };
    let filenameValue: PropertyValue = { value: "", position: { x: 0, y: 0 }, rotation: 0 };
    
    for (const prop of properties) {
      const name = this.getString(prop, 1);
      if (name === "Sheetname") {
        const value = this.getString(prop, 2) || "";
        const propAt = findElement(prop, "at");
        const propEffects = findElement(prop, "effects");
        nameValue = {
          value,
          position: propAt ? this.parsePoint(propAt) : { x: 0, y: 0 },
          rotation: propAt ? this.getNumber(propAt, 3) || 0 : 0,
          effects: propEffects ? this.parseTextEffects(propEffects) : undefined,
        };
      } else if (name === "Sheetfile") {
        const value = this.getString(prop, 2) || "";
        const propAt = findElement(prop, "at");
        const propEffects = findElement(prop, "effects");
        filenameValue = {
          value,
          position: propAt ? this.parsePoint(propAt) : { x: 0, y: 0 },
          rotation: propAt ? this.getNumber(propAt, 3) || 0 : 0,
          effects: propEffects ? this.parseTextEffects(propEffects) : undefined,
        };
      }
    }
    
    const sheet: Sheet = {
      uuid,
      position,
      size: size ? {
        width: this.getNumber(size, 1) || 0,
        height: this.getNumber(size, 2) || 0,
      } : { width: 0, height: 0 },
      fieldsAutoplaced: fieldsAutoplaced !== null,
      stroke: stroke ? this.parseStroke(stroke) : undefined,
      fill: fill ? this.parseFillColor(fill) : undefined,
      name: nameValue,
      filename: filenameValue,
      pins: this.parseSheetPins(pins),
      instances: instances ? this.parseSheetInstances(instances) : undefined,
    };
    
    this.sheets.addFromData(sheet);
  }

  private parseText(sexp: SExp[]): void {
    const text = this.getString(sexp, 1) || "";
    const at = findElement(sexp, "at");
    const effects = findElement(sexp, "effects");
    const uuidElem = findElement(sexp, "uuid");
    const excludeFromSim = findElement(sexp, "exclude_from_sim");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const rotation = at ? this.getNumber(at, 3) || 0 : 0;
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const textObj: Text = {
      uuid,
      text,
      position,
      rotation,
      effects: effects ? this.parseTextEffects(effects) : undefined,
      excludeFromSim: excludeFromSim ? this.getBool(excludeFromSim, 1) || false : false,
    };
    
    this.texts.addFromData(textObj);
  }

  private parseTextBox(sexp: SExp[]): void {
    const text = this.getString(sexp, 1) || "";
    const at = findElement(sexp, "at");
    const size = findElement(sexp, "size");
    const stroke = findElement(sexp, "stroke");
    const fill = findElement(sexp, "fill");
    const effects = findElement(sexp, "effects");
    const uuidElem = findElement(sexp, "uuid");
    
    const position = at ? this.parsePoint(at) : { x: 0, y: 0 };
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const textBox: TextBox = {
      uuid,
      text,
      position,
      size: size ? {
        width: this.getNumber(size, 1) || 0,
        height: this.getNumber(size, 2) || 0,
      } : { width: 0, height: 0 },
      stroke: stroke ? this.parseStroke(stroke) : undefined,
      fill: fill ? this.parseFill(fill) : undefined,
      effects: effects ? this.parseTextEffects(effects) : undefined,
    };
    
    this.textBoxes.addFromData(textBox);
  }

  private parseRectangle(sexp: SExp[]): void {
    const start = findElement(sexp, "start");
    const end = findElement(sexp, "end");
    const stroke = findElement(sexp, "stroke");
    const fill = findElement(sexp, "fill");
    const uuidElem = findElement(sexp, "uuid");
    
    const uuid = uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID();
    
    const rect: SchematicRectangle = {
      uuid,
      start: start ? this.parsePoint(start) : { x: 0, y: 0 },
      end: end ? this.parsePoint(end) : { x: 0, y: 0 },
      stroke: stroke ? this.parseStroke(stroke) : undefined,
      fill: fill ? this.parseFill(fill) : undefined,
    };
    
    this.rectangles.addFromData(rect);
  }

  // Helper parsing methods
  
  private parsePoints(pts: SExp[] | null): Point[] {
    if (!pts) return [];
    
    const points: Point[] = [];
    for (let i = 1; i < pts.length; i++) {
      const item = pts[i];
      if (isList(item) && getTag(item) === "xy") {
        points.push(this.parsePoint(item));
      }
    }
    return points;
  }

  private parsePoint(sexp: SExp[]): Point {
    return {
      x: this.getNumber(sexp, 1) || 0,
      y: this.getNumber(sexp, 2) || 0,
    };
  }

  private parseStroke(sexp: SExp[]): Stroke {
    const width = findElement(sexp, "width");
    const type = findElement(sexp, "type");
    const color = findElement(sexp, "color");
    
    return {
      width: width ? this.getNumber(width, 1) || 0 : 0,
      type: type ? this.parseStrokeType(type) : StrokeType.DEFAULT,
      color: color ? [
        this.getNumber(color, 1) || 0,
        this.getNumber(color, 2) || 0,
        this.getNumber(color, 3) || 0,
        this.getNumber(color, 4) || 0,
      ] : undefined,
    };
  }

  private parseStrokeType(sexp: SExp[]): StrokeType {
    const typeStr = this.getString(sexp, 1);
    switch (typeStr) {
      case "solid": return StrokeType.SOLID;
      case "dash": return StrokeType.DASH;
      case "dot": return StrokeType.DOT;
      case "dash_dot": return StrokeType.DASH_DOT;
      case "dash_dot_dot": return StrokeType.DASH_DOT_DOT;
      default: return StrokeType.DEFAULT;
    }
  }

  private parseFill(sexp: SExp[]): { type: FillType; color?: [number, number, number, number] } | undefined {
    const type = findElement(sexp, "type");
    const color = findElement(sexp, "color");
    
    if (!type) return undefined;
    
    let fillType: FillType;
    switch (this.getString(type, 1)) {
      case "outline": fillType = FillType.OUTLINE; break;
      case "background": fillType = FillType.BACKGROUND; break;
      default: fillType = FillType.NONE;
    }
    
    return {
      type: fillType,
      color: color ? [
        this.getNumber(color, 1) || 0,
        this.getNumber(color, 2) || 0,
        this.getNumber(color, 3) || 0,
        this.getNumber(color, 4) || 0,
      ] : undefined,
    };
  }

  private parseFillColor(sexp: SExp[]): { color: [number, number, number, number] } | undefined {
    const color = findElement(sexp, "color");
    if (!color) return undefined;
    
    return {
      color: [
        this.getNumber(color, 1) || 0,
        this.getNumber(color, 2) || 0,
        this.getNumber(color, 3) || 0,
        this.getNumber(color, 4) || 0,
      ],
    };
  }

  private parseTextEffects(sexp: SExp[]): TextEffects {
    const font = findElement(sexp, "font");
    const justify = findElement(sexp, "justify");
    const hide = findElement(sexp, "hide");
    
    const effects: TextEffects = {};
    
    if (font) {
      effects.font = {
        size: [
          this.getNumber(findElement(font, "size"), 1) || 1.27,
          this.getNumber(findElement(font, "size"), 2) || 1.27,
        ],
      };
      
      const face = findElement(font, "face");
      if (face) {
        effects.font.face = this.getString(face, 1) || undefined;
      }
      
      const thickness = findElement(font, "thickness");
      if (thickness) {
        effects.font.thickness = this.getNumber(thickness, 1) || undefined;
      }
      
      const bold = findElement(font, "bold");
      if (bold) {
        effects.font.bold = this.getBool(bold, 1) ?? true;
      }
      
      const italic = findElement(font, "italic");
      if (italic) {
        effects.font.italic = this.getBool(italic, 1) ?? true;
      }
      
      const color = findElement(font, "color");
      if (color) {
        effects.font.color = [
          this.getNumber(color, 1) || 0,
          this.getNumber(color, 2) || 0,
          this.getNumber(color, 3) || 0,
          this.getNumber(color, 4) || 0,
        ];
      }
    }
    
    if (justify) {
      effects.justify = {};
      for (let i = 1; i < justify.length; i++) {
        const item = justify[i];
        const str = isSymbol(item) ? item.name : typeof item === "string" ? item : null;
        if (str === "left") effects.justify.horizontal = TextJustify.LEFT;
        else if (str === "right") effects.justify.horizontal = TextJustify.RIGHT;
        else if (str === "top") effects.justify.vertical = TextVerticalJustify.TOP;
        else if (str === "bottom") effects.justify.vertical = TextVerticalJustify.BOTTOM;
        else if (str === "mirror") effects.justify.mirror = true;
      }
    }
    
    if (hide) {
      effects.hide = this.getBool(hide, 1) ?? true;
    }
    
    return effects;
  }

  private parseShape(sexp: SExp[]): HierarchicalLabelShape {
    const shapeStr = this.getString(sexp, 1);
    switch (shapeStr) {
      case "input": return HierarchicalLabelShape.INPUT;
      case "output": return HierarchicalLabelShape.OUTPUT;
      case "bidirectional": return HierarchicalLabelShape.BIDIRECTIONAL;
      case "tri_state": return HierarchicalLabelShape.TRI_STATE;
      case "passive": return HierarchicalLabelShape.PASSIVE;
      default: return HierarchicalLabelShape.BIDIRECTIONAL;
    }
  }

  private parseProperty(sexp: SExp[]): { name: string; value: PropertyValue } | null {
    const name = this.getString(sexp, 1);
    const valueStr = this.getString(sexp, 2);
    const at = findElement(sexp, "at");
    const effects = findElement(sexp, "effects");
    const showName = findElement(sexp, "show_name");
    
    if (!name) return null;
    
    return {
      name,
      value: {
        value: valueStr || "",
        position: at ? this.parsePoint(at) : { x: 0, y: 0 },
        rotation: at ? this.getNumber(at, 3) || 0 : 0,
        effects: effects ? this.parseTextEffects(effects) : undefined,
        showName: showName !== null,
      },
    };
  }

  private parseSymbolInstances(sexp: SExp[]): SymbolInstance[] {
    const instances: SymbolInstance[] = [];
    const projects = findElements(sexp, "project");
    
    for (const project of projects) {
      const projectName = this.getString(project, 1) || "";
      const paths = findElements(project, "path");
      
      for (const path of paths) {
        const pathStr = this.getString(path, 1) || "";
        const reference = findElement(path, "reference");
        const unit = findElement(path, "unit");
        
        instances.push({
          project: projectName,
          path: pathStr,
          reference: reference ? this.getString(reference, 1) || "" : "",
          unit: unit ? this.getNumber(unit, 1) || 1 : 1,
        });
      }
    }
    
    return instances;
  }

  private parseSheetInstances(sexp: SExp[]): SheetInstance[] {
    const instances: SheetInstance[] = [];
    const projects = findElements(sexp, "project");
    
    for (const project of projects) {
      const projectName = this.getString(project, 1) || "";
      const paths = findElements(project, "path");
      
      for (const path of paths) {
        const pathStr = this.getString(path, 1) || "";
        const page = findElement(path, "page");
        
        instances.push({
          project: projectName,
          path: pathStr,
          page: page ? this.getString(page, 1) || "" : "",
        });
      }
    }
    
    return instances;
  }

  private parseSheetPins(pins: SExp[][]): SheetPin[] {
    return pins.map((pin) => {
      const name = this.getString(pin, 1) || "";
      const shape = this.getString(pin, 2) || "passive";
      const at = findElement(pin, "at");
      const effects = findElement(pin, "effects");
      const uuidElem = findElement(pin, "uuid");
      
      return {
        uuid: uuidElem ? this.getString(uuidElem, 1) || randomUUID() : randomUUID(),
        name,
        shape: this.parseShapeString(shape),
        position: at ? this.parsePoint(at) : { x: 0, y: 0 },
        rotation: at ? this.getNumber(at, 3) || 0 : 0,
        effects: effects ? this.parseTextEffects(effects) : undefined,
      };
    });
  }

  private parseShapeString(shape: string): HierarchicalLabelShape {
    switch (shape) {
      case "input": return HierarchicalLabelShape.INPUT;
      case "output": return HierarchicalLabelShape.OUTPUT;
      case "bidirectional": return HierarchicalLabelShape.BIDIRECTIONAL;
      case "tri_state": return HierarchicalLabelShape.TRI_STATE;
      case "passive": return HierarchicalLabelShape.PASSIVE;
      default: return HierarchicalLabelShape.PASSIVE;
    }
  }

  // Utility methods for extracting values from S-expressions

  private getString(sexp: SExp[] | null, index: number): string | null {
    if (!sexp || index >= sexp.length) return null;
    const val = sexp[index];
    if (typeof val === "string") return val;
    if (isSymbol(val)) return val.name;
    return null;
  }

  private getNumber(sexp: SExp[] | null, index: number): number | null {
    if (!sexp || index >= sexp.length) return null;
    const val = sexp[index];
    if (typeof val === "number") return val;
    if (isFloat(val)) return val.value;
    return null;
  }

  private getBool(sexp: SExp[] | null, index: number): boolean | null {
    if (!sexp || index >= sexp.length) return null;
    const val = sexp[index];
    if (typeof val === "boolean") return val;
    if (isSymbol(val)) {
      if (val.name === "yes") return true;
      if (val.name === "no") return false;
    }
    return null;
  }

  /**
   * Build minimal S-expression from the data model.
   * Used for initial structure of created schematics.
   */
  private buildSexp(): SExp[] {
    const sexp: SExp[] = [
      new Symbol("kicad_sch"),
      [new Symbol("version"), this.version],
      [new Symbol("generator"), this.generator],
      [new Symbol("generator_version"), this.generatorVersion],
      [new Symbol("uuid"), this.uuid],
      [new Symbol("paper"), this.paper],
    ];
    
    if (this.titleBlock) {
      sexp.push(this.buildTitleBlock(this.titleBlock));
    }
    
    // lib_symbols
    sexp.push([new Symbol("lib_symbols")]);
    
    // sheet_instances
    sexp.push([
      new Symbol("sheet_instances"),
      [new Symbol("path"), "/", [new Symbol("page"), "1"]],
    ]);
    
    return sexp;
  }

  /**
   * Build full S-expression including all collections.
   * Used for created schematics that have added components/wires.
   */
  private buildFullSexp(): SExp[] {
    const sexp: SExp[] = [
      new Symbol("kicad_sch"),
      [new Symbol("version"), this.version],
      [new Symbol("generator"), this.generator],
      [new Symbol("generator_version"), this.generatorVersion],
      [new Symbol("uuid"), this.uuid],
      [new Symbol("paper"), this.paper],
    ];
    
    if (this.titleBlock) {
      sexp.push(this.buildTitleBlock(this.titleBlock));
    }
    
    const libSymbols = this._libSymbolsSexp || this.buildLibSymbols();
    sexp.push(libSymbols);

    for (const sheet of this.sheets) {
      sexp.push(this.buildSheet(sheet));
    }

    for (const comp of this.components) {
      sexp.push(this.buildSymbol(comp.toSymbol()));
    }

    for (const wire of this.wires) {
      sexp.push(this.buildWire(wire));
    }

    for (const bus of this.buses) {
      sexp.push(this.buildBus(bus));
    }

    for (const entry of this.busEntries) {
      sexp.push(this.buildBusEntry(entry));
    }

    for (const junction of this.junctions) {
      sexp.push(this.buildJunction(junction));
    }

    for (const nc of this.noConnects) {
      sexp.push(this.buildNoConnect(nc));
    }

    for (const label of this.labels) {
      sexp.push(this.buildLabel(label));
    }

    for (const text of this.texts) {
      sexp.push(this.buildText(text));
    }

    for (const textBox of this.textBoxes) {
      sexp.push(this.buildTextBox(textBox));
    }

    for (const rect of this.rectangles) {
      sexp.push(this.buildRectangle(rect));
    }

    if (this._sheetInstancesSexp) {
      sexp.push(this._sheetInstancesSexp);
    } else {
      sexp.push([
        new Symbol("sheet_instances"),
        [new Symbol("path"), "/", [new Symbol("page"), "1"]],
      ]);
    }

    if (this._symbolInstancesSexp) {
      sexp.push(this._symbolInstancesSexp);
    }

    if (this.embeddedFonts) {
      sexp.push([new Symbol("embedded_fonts"), new Symbol("yes")]);
    } else {
      sexp.push([new Symbol("embedded_fonts"), new Symbol("no")]);
    }
    
    return sexp;
  }

  private buildLibSymbols(): SExp[] {
    // For now, return empty lib_symbols - KiCAD will fill it in when opened
    // In a full implementation, we'd lookup symbol definitions from the cache
    return [new Symbol("lib_symbols")];
  }

  private buildWire(wire: Wire): SExp[] {
    const pts: SExp[] = [new Symbol("pts")];
    for (const pt of wire.points) {
      pts.push([new Symbol("xy"), pt.x, pt.y]);
    }
    
    const sexp: SExp[] = [
      new Symbol("wire"),
      pts,
    ];

    if (wire.stroke) {
      sexp.push(this.buildStroke(wire.stroke));
    }

    sexp.push([new Symbol("uuid"), wire.uuid]);
    return sexp;
  }

  private buildBus(bus: Bus): SExp[] {
    const pts: SExp[] = [new Symbol("pts")];
    for (const pt of bus.points) {
      pts.push([new Symbol("xy"), pt.x, pt.y]);
    }

    const sexp: SExp[] = [
      new Symbol("bus"),
      pts,
    ];

    if (bus.stroke) {
      sexp.push(this.buildStroke(bus.stroke));
    }

    sexp.push([new Symbol("uuid"), bus.uuid]);
    return sexp;
  }

  private buildBusEntry(entry: BusEntry): SExp[] {
    const sexp: SExp[] = [
      new Symbol("bus_entry"),
      [new Symbol("at"), entry.position.x, entry.position.y],
      [new Symbol("size"), entry.size.width, entry.size.height],
    ];

    if (entry.stroke) {
      sexp.push(this.buildStroke(entry.stroke));
    }

    sexp.push([new Symbol("uuid"), entry.uuid]);
    return sexp;
  }

  private buildJunction(junction: Junction): SExp[] {
    return [
      new Symbol("junction"),
      [new Symbol("at"), junction.position.x, junction.position.y],
      [new Symbol("diameter"), junction.diameter],
      [new Symbol("color"), ...junction.color],
      [new Symbol("uuid"), junction.uuid],
    ];
  }

  private buildNoConnect(nc: NoConnect): SExp[] {
    return [
      new Symbol("no_connect"),
      [new Symbol("at"), nc.position.x, nc.position.y],
      [new Symbol("uuid"), nc.uuid],
    ];
  }

  private buildLabel(label: Label | GlobalLabel | HierarchicalLabel): SExp[] {
    const isGlobal = "properties" in label;
    const isHierarchical = "shape" in label && !("properties" in label);
    const tag = isGlobal
      ? "global_label"
      : isHierarchical
        ? "hierarchical_label"
        : "label";

    const sexp: SExp[] = [new Symbol(tag), label.text];
    if ("shape" in label) {
      sexp.push([new Symbol("shape"), new Symbol(label.shape)]);
    }
    sexp.push([new Symbol("at"), label.position.x, label.position.y, label.rotation]);
    const effects = this.buildTextEffects(label.effects, true);
    if (effects) {
      sexp.push(effects);
    }
    if ("fieldsAutoplaced" in label && label.fieldsAutoplaced) {
      sexp.push([new Symbol("fields_autoplaced")]);
    }
    if ("properties" in label) {
      for (const [name, prop] of label.properties) {
        sexp.push(this.buildProperty(name, prop, true));
      }
    }
    sexp.push([new Symbol("uuid"), label.uuid]);
    return sexp;
  }

  private buildSymbol(symbol: SchematicSymbol): SExp[] {
    const sexp: SExp[] = [new Symbol("symbol")];
    
    sexp.push([new Symbol("lib_id"), symbol.libId]);
    sexp.push([new Symbol("at"), symbol.position.x, symbol.position.y, symbol.rotation]);
    
    if (symbol.mirror) {
      sexp.push([new Symbol("mirror"), new Symbol(symbol.mirror)]);
    }
    
    sexp.push([new Symbol("unit"), symbol.unit]);
    sexp.push([new Symbol("exclude_from_sim"), new Symbol(symbol.excludeFromSim ? "yes" : "no")]);
    sexp.push([new Symbol("in_bom"), new Symbol(symbol.inBom ? "yes" : "no")]);
    sexp.push([new Symbol("on_board"), new Symbol(symbol.onBoard ? "yes" : "no")]);
    sexp.push([new Symbol("dnp"), new Symbol(symbol.dnp ? "yes" : "no")]);
    if (symbol.fieldsAutoplaced) {
      sexp.push([new Symbol("fields_autoplaced")]);
    }
    sexp.push([new Symbol("uuid"), symbol.uuid]);
    
    // Add properties
    for (const [name, prop] of symbol.properties) {
      sexp.push(this.buildProperty(name, prop, true));
    }

    for (const [pinNumber, pinUuid] of symbol.pins) {
      if (!pinUuid) continue;
      sexp.push([
        new Symbol("pin"),
        pinNumber,
        [new Symbol("uuid"), pinUuid],
      ]);
    }

    if (symbol.instances && symbol.instances.length > 0) {
      sexp.push(this.buildSymbolInstances(symbol.instances));
    }
    
    return sexp;
  }

  private buildSheet(sheet: Sheet): SExp[] {
    const sexp: SExp[] = [
      new Symbol("sheet"),
      [new Symbol("at"), sheet.position.x, sheet.position.y],
      [new Symbol("size"), sheet.size.width, sheet.size.height],
    ];

    if (sheet.fieldsAutoplaced) {
      sexp.push([new Symbol("fields_autoplaced")]);
    }

    if (sheet.stroke) {
      sexp.push(this.buildStroke(sheet.stroke));
    }

    if (sheet.fill) {
      sexp.push(this.buildFillColor(sheet.fill));
    }

    sexp.push([new Symbol("uuid"), sheet.uuid]);

    sexp.push(this.buildProperty("Sheetname", sheet.name, true));
    sexp.push(this.buildProperty("Sheetfile", sheet.filename, true));

    for (const pin of sheet.pins) {
      sexp.push(this.buildSheetPin(pin));
    }

    if (sheet.instances && sheet.instances.length > 0) {
      sexp.push(this.buildSheetInstances(sheet.instances));
    }

    return sexp;
  }

  private buildSheetPin(pin: SheetPin): SExp[] {
    const sexp: SExp[] = [
      new Symbol("pin"),
      pin.name,
      new Symbol(pin.shape),
      [new Symbol("at"), pin.position.x, pin.position.y, pin.rotation],
      [new Symbol("uuid"), pin.uuid],
    ];

    const effects = this.buildTextEffects(pin.effects, true);
    if (effects) {
      sexp.push(effects);
    }

    return sexp;
  }

  private buildText(text: Text): SExp[] {
    const sexp: SExp[] = [
      new Symbol("text"),
      text.text,
      [new Symbol("at"), text.position.x, text.position.y, text.rotation],
    ];

    const effects = this.buildTextEffects(text.effects, true);
    if (effects) {
      sexp.push(effects);
    }

    if (text.excludeFromSim !== undefined) {
      sexp.push([
        new Symbol("exclude_from_sim"),
        new Symbol(text.excludeFromSim ? "yes" : "no"),
      ]);
    }

    sexp.push([new Symbol("uuid"), text.uuid]);
    return sexp;
  }

  private buildTextBox(textBox: TextBox): SExp[] {
    const sexp: SExp[] = [
      new Symbol("text_box"),
      textBox.text,
      [new Symbol("at"), textBox.position.x, textBox.position.y],
      [new Symbol("size"), textBox.size.width, textBox.size.height],
    ];

    if (textBox.stroke) {
      sexp.push(this.buildStroke(textBox.stroke));
    }

    if (textBox.fill) {
      sexp.push(this.buildFill(textBox.fill));
    }

    const effects = this.buildTextEffects(textBox.effects, true);
    if (effects) {
      sexp.push(effects);
    }

    sexp.push([new Symbol("uuid"), textBox.uuid]);
    return sexp;
  }

  private buildRectangle(rect: SchematicRectangle): SExp[] {
    const sexp: SExp[] = [
      new Symbol("rectangle"),
      [new Symbol("start"), rect.start.x, rect.start.y],
      [new Symbol("end"), rect.end.x, rect.end.y],
    ];

    if (rect.stroke) {
      sexp.push(this.buildStroke(rect.stroke));
    }

    if (rect.fill) {
      sexp.push(this.buildFill(rect.fill));
    }

    sexp.push([new Symbol("uuid"), rect.uuid]);
    return sexp;
  }

  private buildProperty(
    name: string,
    prop: PropertyValue,
    includeDefaultFont: boolean
  ): SExp[] {
    const propSexp: SExp[] = [new Symbol("property"), name, prop.value];
    propSexp.push([new Symbol("at"), prop.position.x, prop.position.y, prop.rotation]);
    const effects = this.buildTextEffects(prop.effects, includeDefaultFont);
    if (effects) {
      propSexp.push(effects);
    }
    if (prop.showName) {
      propSexp.push([new Symbol("show_name")]);
    }
    return propSexp;
  }

  private buildTextEffects(
    effects?: TextEffects,
    includeDefaultFont: boolean = false
  ): SExp[] | null {
    const result: SExp[] = [new Symbol("effects")];
    let hasChild = false;

    if (effects?.font || includeDefaultFont) {
      const fontSexp: SExp[] = [new Symbol("font")];
      const size = effects?.font?.size || [1.27, 1.27];
      fontSexp.push([new Symbol("size"), size[0], size[1]]);

      if (effects?.font?.face) {
        fontSexp.push([new Symbol("face"), effects.font.face]);
      }
      if (effects?.font?.thickness !== undefined) {
        fontSexp.push([new Symbol("thickness"), effects.font.thickness]);
      }
      if (effects?.font?.bold !== undefined) {
        fontSexp.push([new Symbol("bold"), new Symbol(effects.font.bold ? "yes" : "no")]);
      }
      if (effects?.font?.italic !== undefined) {
        fontSexp.push([new Symbol("italic"), new Symbol(effects.font.italic ? "yes" : "no")]);
      }
      if (effects?.font?.color) {
        fontSexp.push([
          new Symbol("color"),
          effects.font.color[0],
          effects.font.color[1],
          effects.font.color[2],
          effects.font.color[3],
        ]);
      }

      result.push(fontSexp);
      hasChild = true;
    }

    if (effects?.justify) {
      const justifySexp: SExp[] = [new Symbol("justify")];
      if (effects.justify.horizontal === TextJustify.LEFT) {
        justifySexp.push(new Symbol("left"));
      } else if (effects.justify.horizontal === TextJustify.RIGHT) {
        justifySexp.push(new Symbol("right"));
      }
      if (effects.justify.vertical === TextVerticalJustify.TOP) {
        justifySexp.push(new Symbol("top"));
      } else if (effects.justify.vertical === TextVerticalJustify.BOTTOM) {
        justifySexp.push(new Symbol("bottom"));
      }
      if (effects.justify.mirror) {
        justifySexp.push(new Symbol("mirror"));
      }
      if (justifySexp.length > 1) {
        result.push(justifySexp);
        hasChild = true;
      }
    }

    if (effects?.hide !== undefined) {
      result.push([new Symbol("hide"), new Symbol(effects.hide ? "yes" : "no")]);
      hasChild = true;
    }

    return hasChild ? result : null;
  }

  private buildStroke(stroke: Stroke): SExp[] {
    const sexp: SExp[] = [new Symbol("stroke")];
    sexp.push([new Symbol("width"), stroke.width]);
    sexp.push([new Symbol("type"), new Symbol(stroke.type)]);
    if (stroke.color) {
      sexp.push([
        new Symbol("color"),
        stroke.color[0],
        stroke.color[1],
        stroke.color[2],
        stroke.color[3],
      ]);
    }
    return sexp;
  }

  private buildFill(fill: { type: FillType; color?: [number, number, number, number] }): SExp[] {
    const sexp: SExp[] = [new Symbol("fill")];
    sexp.push([new Symbol("type"), new Symbol(fill.type)]);
    if (fill.color) {
      sexp.push([
        new Symbol("color"),
        fill.color[0],
        fill.color[1],
        fill.color[2],
        fill.color[3],
      ]);
    }
    return sexp;
  }

  private buildFillColor(fill: { color: [number, number, number, number] }): SExp[] {
    return [
      new Symbol("fill"),
      [
        new Symbol("color"),
        fill.color[0],
        fill.color[1],
        fill.color[2],
        fill.color[3],
      ],
    ];
  }

  private buildSymbolInstances(instances: SymbolInstance[]): SExp[] {
    const sexp: SExp[] = [new Symbol("instances")];
    const byProject = new Map<string, SymbolInstance[]>();

    for (const instance of instances) {
      if (!byProject.has(instance.project)) {
        byProject.set(instance.project, []);
      }
      byProject.get(instance.project)!.push(instance);
    }

    for (const [project, projectInstances] of byProject) {
      const projectSexp: SExp[] = [new Symbol("project"), project];
      for (const instance of projectInstances) {
        projectSexp.push([
          new Symbol("path"),
          instance.path,
          [new Symbol("reference"), instance.reference],
          [new Symbol("unit"), instance.unit],
        ]);
      }
      sexp.push(projectSexp);
    }

    return sexp;
  }

  private buildSheetInstances(instances: SheetInstance[]): SExp[] {
    const sexp: SExp[] = [new Symbol("instances")];
    const byProject = new Map<string, SheetInstance[]>();

    for (const instance of instances) {
      if (!byProject.has(instance.project)) {
        byProject.set(instance.project, []);
      }
      byProject.get(instance.project)!.push(instance);
    }

    for (const [project, projectInstances] of byProject) {
      const projectSexp: SExp[] = [new Symbol("project"), project];
      for (const instance of projectInstances) {
        projectSexp.push([
          new Symbol("path"),
          instance.path,
          [new Symbol("page"), instance.page],
        ]);
      }
      sexp.push(projectSexp);
    }

    return sexp;
  }

  private buildTitleBlock(block: TitleBlock): SExp[] {
    const sexp: SExp[] = [new Symbol("title_block")];
    
    if (block.title) {
      sexp.push([new Symbol("title"), block.title]);
    }
    if (block.date) {
      sexp.push([new Symbol("date"), block.date]);
    }
    if (block.rev) {
      sexp.push([new Symbol("rev"), block.rev]);
    }
    if (block.company) {
      sexp.push([new Symbol("company"), block.company]);
    }
    for (const [num, text] of block.comment) {
      sexp.push([new Symbol("comment"), num, text]);
    }
    
    return sexp;
  }

  /**
   * Format the schematic to a string.
   * For round-trip fidelity (loaded files), we format the stored _sexp directly.
   * For created files, we rebuild the S-expression from collections.
   */
  format(): string {
    const formatter = new ExactFormatter();
    if (this._isCreated || this._isModified || this.hasModifiedCollections()) {
      this._sexp = this.buildFullSexp();
      this._isCreated = false;
      this.resetModifiedFlags();
    }
    return formatter.format(this._sexp);
  }

  /**
   * Convert the schematic to S-expression.
   */
  toSexp(): SExp[] {
    return this._sexp;
  }

  /**
   * Save the schematic to a file.
   */
  save(filepath: string): void {
    const content = this.format();
    writeFileSync(filepath, content + "\n", "utf-8");
    this._filePath = filepath;
  }

  /**
   * Get the title from the title block.
   */
  get title(): string {
    return this.titleBlock?.title || "";
  }

  /**
   * Set the title in the title block.
   */
  set title(value: string) {
    if (!this.titleBlock) {
      this.titleBlock = { comment: new Map() };
    }
    this.titleBlock.title = value;
    this._isModified = true;
  }

  /**
   * File I/O accessor.
   */
  get fileIO(): { getFilePath(): string | null } {
    return {
      getFilePath: () => this._filePath,
    };
  }

  /**
   * Get global labels from the label collection.
   */
  get globalLabels(): GlobalLabel[] {
    return this.labels.getGlobalLabels();
  }

  /**
   * Get hierarchical labels from the label collection.
   */
  get hierarchicalLabels(): HierarchicalLabel[] {
    return this.labels.getHierarchicalLabels();
  }
}
