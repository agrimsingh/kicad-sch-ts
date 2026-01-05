// src/geometry/index.ts

export {
  snapToGrid,
  isOnGrid,
  CornerDirection,
  RoutingResult,
  createOrthogonalRouting,
  validateRoutingResult,
  distance,
  manhattanDistance,
} from "./routing";

export {
  BoundingBox,
  createBoundingBox,
  getBoundingBoxWidth,
  getBoundingBoxHeight,
  getBoundingBoxCenter,
  expandBoundingBox,
  boundingBoxesOverlap,
  mergeBoundingBoxes,
  pointInBoundingBox,
  SymbolBoundingBoxCalculator,
  getComponentBoundingBox,
} from "./symbol-bbox";

export {
  DEFAULT_TEXT_HEIGHT,
  DEFAULT_PIN_LENGTH,
  DEFAULT_PIN_NAME_OFFSET,
  DEFAULT_PIN_NUMBER_SIZE,
  DEFAULT_PIN_TEXT_WIDTH_RATIO,
} from "./font-metrics";
