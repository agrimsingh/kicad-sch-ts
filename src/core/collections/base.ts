// src/core/collections/base.ts

import { DuplicateElementError } from "../exceptions";

/**
 * Registry for tracking elements by various indices.
 */
export class IndexRegistry<T> {
  private byUuid: Map<string, T> = new Map();
  private byReference: Map<string, T> = new Map();

  addByUuid(uuid: string, item: T): void {
    if (this.byUuid.has(uuid)) {
      throw new DuplicateElementError("element", uuid);
    }
    this.byUuid.set(uuid, item);
  }

  addByReference(reference: string, item: T): void {
    if (this.byReference.has(reference)) {
      throw new DuplicateElementError("reference", reference);
    }
    this.byReference.set(reference, item);
  }

  getByUuid(uuid: string): T | undefined {
    return this.byUuid.get(uuid);
  }

  getByReference(reference: string): T | undefined {
    return this.byReference.get(reference);
  }

  removeByUuid(uuid: string): boolean {
    return this.byUuid.delete(uuid);
  }

  removeByReference(reference: string): boolean {
    return this.byReference.delete(reference);
  }

  hasUuid(uuid: string): boolean {
    return this.byUuid.has(uuid);
  }

  hasReference(reference: string): boolean {
    return this.byReference.has(reference);
  }

  clear(): void {
    this.byUuid.clear();
    this.byReference.clear();
  }

  get referenceMap(): Map<string, T> {
    return this.byReference;
  }
}

/**
 * Base class for all element collections.
 */
export abstract class BaseCollection<T extends { uuid: string }>
  implements Iterable<T>
{
  protected items: T[] = [];
  protected index: IndexRegistry<T> = new IndexRegistry();
  protected modified: boolean = false;

  get length(): number {
    return this.items.length;
  }

  get isModified(): boolean {
    return this.modified;
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }

  all(): T[] {
    return [...this.items];
  }

  getByUuid(uuid: string): T | undefined {
    return this.index.getByUuid(uuid);
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  map<U>(fn: (item: T) => U): U[] {
    return this.items.map(fn);
  }

  forEach(fn: (item: T) => void): void {
    this.items.forEach(fn);
  }

  some(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate);
  }

  every(predicate: (item: T) => boolean): boolean {
    return this.items.every(predicate);
  }

  protected addItem(item: T): T {
    this.index.addByUuid(item.uuid, item);
    this.items.push(item);
    this.modified = true;
    return item;
  }

  protected removeItem(uuid: string): boolean {
    const idx = this.items.findIndex((item) => item.uuid === uuid);
    if (idx === -1) return false;

    this.items.splice(idx, 1);
    this.index.removeByUuid(uuid);
    this.modified = true;
    return true;
  }

  clear(): void {
    this.items = [];
    this.index.clear();
    this.modified = true;
  }

  resetModified(): void {
    this.modified = false;
  }
}
