// src/core/exceptions.ts

export class KiCadSchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KiCadSchError";
  }
}

export class ParseError extends KiCadSchError {
  constructor(
    message: string,
    public line?: number,
    public column?: number
  ) {
    super(message);
    this.name = "ParseError";
  }
}

export class FormatError extends KiCadSchError {
  constructor(message: string) {
    super(message);
    this.name = "FormatError";
  }
}

export class ValidationError extends KiCadSchError {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ElementNotFoundError extends KiCadSchError {
  constructor(elementType: string, identifier: string) {
    super(`${elementType} not found: ${identifier}`);
    this.name = "ElementNotFoundError";
  }
}

export class DuplicateElementError extends KiCadSchError {
  constructor(elementType: string, identifier: string) {
    super(`Duplicate ${elementType}: ${identifier}`);
    this.name = "DuplicateElementError";
  }
}

export class LibraryError extends KiCadSchError {
  constructor(message: string) {
    super(message);
    this.name = "LibraryError";
  }
}

export class SymbolNotFoundError extends LibraryError {
  constructor(libId: string) {
    super(`Symbol not found: ${libId}`);
    this.name = "SymbolNotFoundError";
  }
}

export class ConnectivityError extends KiCadSchError {
  constructor(message: string) {
    super(message);
    this.name = "ConnectivityError";
  }
}

export class HierarchyError extends KiCadSchError {
  constructor(message: string) {
    super(message);
    this.name = "HierarchyError";
  }
}
