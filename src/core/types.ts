// src/core/types.ts

// ============================================================
// Basic Geometric Types
// ============================================================

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rectangle {
  start: Point;
  end: Point;
}

// ============================================================
// Enums
// ============================================================

export enum PinType {
  INPUT = "input",
  OUTPUT = "output",
  BIDIRECTIONAL = "bidirectional",
  TRI_STATE = "tri_state",
  PASSIVE = "passive",
  FREE = "free",
  UNSPECIFIED = "unspecified",
  POWER_IN = "power_in",
  POWER_OUT = "power_out",
  OPEN_COLLECTOR = "open_collector",
  OPEN_EMITTER = "open_emitter",
  NO_CONNECT = "no_connect",
}

export enum PinShape {
  LINE = "line",
  INVERTED = "inverted",
  CLOCK = "clock",
  INVERTED_CLOCK = "inverted_clock",
  INPUT_LOW = "input_low",
  CLOCK_LOW = "clock_low",
  OUTPUT_LOW = "output_low",
  EDGE_CLOCK_HIGH = "edge_clock_high",
  NON_LOGIC = "non_logic",
}

export enum WireType {
  WIRE = "wire",
  BUS = "bus",
  BUS_ENTRY = "bus_entry",
}

export enum LabelType {
  LOCAL = "label",
  GLOBAL = "global_label",
  HIERARCHICAL = "hierarchical_label",
}

export enum HierarchicalLabelShape {
  INPUT = "input",
  OUTPUT = "output",
  BIDIRECTIONAL = "bidirectional",
  TRI_STATE = "tri_state",
  PASSIVE = "passive",
}

export enum TextJustify {
  LEFT = "left",
  CENTER = "center",
  RIGHT = "right",
}

export enum TextVerticalJustify {
  TOP = "top",
  CENTER = "center",
  BOTTOM = "bottom",
}

export enum StrokeType {
  DEFAULT = "default",
  SOLID = "solid",
  DASH = "dash",
  DOT = "dot",
  DASH_DOT = "dash_dot",
  DASH_DOT_DOT = "dash_dot_dot",
}

export enum FillType {
  NONE = "none",
  OUTLINE = "outline",
  BACKGROUND = "background",
}

// ============================================================
// Text Effects
// ============================================================

export interface TextEffects {
  font?: {
    face?: string;
    size: [number, number]; // [width, height]
    thickness?: number;
    bold?: boolean;
    italic?: boolean;
    color?: [number, number, number, number]; // RGBA
  };
  justify?: {
    horizontal?: TextJustify;
    vertical?: TextVerticalJustify;
    mirror?: boolean;
  };
  hide?: boolean;
}

// ============================================================
// Property Value (for component properties)
// ============================================================

export interface PropertyValue {
  value: string;
  position: Point;
  rotation: number;
  effects?: TextEffects;
  showName?: boolean;
}

// ============================================================
// Stroke
// ============================================================

export interface Stroke {
  width: number;
  type: StrokeType;
  color?: [number, number, number, number];
}

// ============================================================
// Title Block
// ============================================================

export interface TitleBlock {
  title?: string;
  date?: string;
  rev?: string;
  company?: string;
  comment: Map<number, string>;
}

// ============================================================
// Schematic Symbol (placed component)
// ============================================================

export interface SchematicSymbol {
  uuid: string;
  libId: string;
  position: Point;
  rotation: number;
  mirror?: "x" | "y";
  unit: number;
  inBom: boolean;
  onBoard: boolean;
  excludeFromSim: boolean;
  dnp: boolean;
  fieldsAutoplaced?: boolean;
  properties: Map<string, PropertyValue>;
  pins: Map<string, string>; // pin number -> pin uuid
  instances?: SymbolInstance[];
}

export interface SymbolInstance {
  project: string;
  path: string;
  reference: string;
  unit: number;
}

// ============================================================
// Wire
// ============================================================

export interface Wire {
  uuid: string;
  points: Point[];
  stroke?: Stroke;
}

// ============================================================
// Bus
// ============================================================

export interface Bus {
  uuid: string;
  points: Point[];
  stroke?: Stroke;
}

export interface BusEntry {
  uuid: string;
  position: Point;
  size: Size;
  stroke?: Stroke;
}

// ============================================================
// Labels
// ============================================================

export interface Label {
  uuid: string;
  text: string;
  position: Point;
  rotation: number;
  effects?: TextEffects;
  fieldsAutoplaced?: boolean;
}

export interface GlobalLabel extends Label {
  shape: HierarchicalLabelShape;
  properties: Map<string, PropertyValue>;
}

export interface HierarchicalLabel extends Label {
  shape: HierarchicalLabelShape;
}

// ============================================================
// Junction & No Connect
// ============================================================

export interface Junction {
  uuid: string;
  position: Point;
  diameter: number;
  color: [number, number, number, number];
}

export interface NoConnect {
  uuid: string;
  position: Point;
}

// ============================================================
// Power Symbol
// ============================================================

export interface PowerSymbol {
  uuid: string;
  position: Point;
  rotation: number;
  effects?: TextEffects;
}

// ============================================================
// Sheet (Hierarchical)
// ============================================================

export interface Sheet {
  uuid: string;
  position: Point;
  size: Size;
  fieldsAutoplaced?: boolean;
  stroke?: Stroke;
  fill?: { color: [number, number, number, number] };
  name: PropertyValue;
  filename: PropertyValue;
  pins: SheetPin[];
  instances?: SheetInstance[];
}

export interface SheetPin {
  uuid: string;
  name: string;
  shape: HierarchicalLabelShape;
  position: Point;
  rotation: number;
  effects?: TextEffects;
}

export interface SheetInstance {
  project: string;
  path: string;
  page: string;
}

// ============================================================
// Text Elements
// ============================================================

export interface Text {
  uuid: string;
  text: string;
  position: Point;
  rotation: number;
  effects?: TextEffects;
  excludeFromSim?: boolean;
}

export interface TextBox {
  uuid: string;
  text: string;
  position: Point;
  size: Size;
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
  effects?: TextEffects;
}

// ============================================================
// Graphics
// ============================================================

export interface SchematicRectangle {
  uuid: string;
  start: Point;
  end: Point;
  stroke?: Stroke;
  fill?: { type: FillType; color?: [number, number, number, number] };
}

export interface SchematicImage {
  uuid: string;
  position: Point;
  scale: number;
  data: string; // Base64 encoded
}

// ============================================================
// Symbol Definition (from lib_symbols or .kicad_sym)
// ============================================================

export interface SymbolDefinition {
  libId: string;
  name: string;
  library: string;
  extends?: string;
  referencePrefix: string;
  description: string;
  keywords: string;
  datasheet: string;
  unitCount: number;
  unitsLocked: boolean;
  isPower: boolean;
  pinNames: { offset: number; hide: boolean };
  pinNamesDefined?: boolean;
  pinNumbers: { hide: boolean };
  pinNumbersDefined?: boolean;
  inBom: boolean;
  onBoard: boolean;
  properties: Map<string, PropertyValue>;
  propertyPositions?: Map<string, [number, number, number]>;
  units: Map<number, SymbolUnit>;
}

export interface SymbolUnit {
  unitNumber: number;
  style: number;
  graphics: SymbolGraphics[];
  pins: SymbolPin[];
}

export interface SymbolPin {
  number: string;
  name: string;
  position: Point;
  length: number;
  rotation: number;
  electricalType: PinType;
  graphicStyle: PinShape;
  nameEffects?: TextEffects;
  numberEffects?: TextEffects;
  hide: boolean;
  alternate: Array<{ name: string; type: PinType; shape: PinShape }>;
}

export interface SymbolGraphics {
  type: "rectangle" | "circle" | "arc" | "polyline" | "text";
  // Additional properties depend on type
  [key: string]: unknown;
}

// ============================================================
// Net (for connectivity analysis - used in Part 2)
// ============================================================

export interface Net {
  name: string;
  pins: Array<{ reference: string; pin: string; position: Point }>;
  labels: string[];
  wires: Wire[];
}

// ============================================================
// Hierarchy (for hierarchy analysis - used in Part 2.5)
// ============================================================

export interface SheetPinConnection {
  sheetPath: string;
  pinName: string;
  labelName: string;
  isMatch: boolean;
}

export interface SignalPath {
  signalName: string;
  startPath: string;
  endPath: string;
  connections: SheetPinConnection[];
  sheetCrossings: number;
}
