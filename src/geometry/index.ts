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
