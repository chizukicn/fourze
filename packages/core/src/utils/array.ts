import { isDef, isFunction, isNumber, isString, isUndef, isUndefined } from "./is";
import { isKeyOf } from "./object";

export type PredicateFn<T> = (item: T, index: number, source: T[]) => boolean;

export type MapFn<T, U> = (item: T, index: number, source: T[]) => U;

export type CompareFn<T> = (a: T, b: T) => number;

export type PredicateParameter<T> = [PredicateFn<T>] | [keyof T, ...T[keyof T][]];

export type MapParameter<T, K> = keyof T | MapFn<T, K>;
export interface Predicate<T> extends PredicateFn<T> {
  and(...args: PredicateParameter<T>): this;
  or(...args: PredicateParameter<T>): this;
}

export interface ExtraArrayMethods<T> {
  where(fn: PredicateFn<T>): CollectionQuery<T>;
  select<U>(mapFn: MapFn<T, U>): CollectionQuery<U>;
  select(): CollectionQuery<T>;
}

export interface MathQuery<T> {
  max(fn?: MapFn<T, number>): typeof fn extends undefined ? T extends number ? T : never : number;
  min(fn?: MapFn<T, number>): typeof fn extends undefined ? T extends number ? T : never : number;
  sum(fn?: MapFn<T, number>): typeof fn extends undefined ? T extends number ? T : never : number;
  average(fn?: MapFn<T, number>): typeof fn extends undefined ? T extends number ? T : never : number;
}

export interface ArrayQuery<T> extends Iterable<T> {

  join(
    separator?: string
  ): string;

  at(index: number): T | undefined;

  fill(value: T, start?: number, end?: number): this;
  sort(compareFn?: CompareFn<T>): this;
  reverse(): this;

  includes(value: T, fromIndex?: number): boolean;

  some(fn: PredicateFn<T>): boolean;
  every(fn: PredicateFn<T>): boolean;

  find(fn: PredicateFn<T>): T | undefined;
  findIndex(fn: PredicateFn<T>): number;
  findLast(fn: PredicateFn<T>): T | undefined;
  findLastIndex(fn: PredicateFn<T>): number;

  reduce<U>(
    callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U,
    initialValue: U
  ): U;
  reduceRight<U>(
    callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U,
    initialValue: U
  ): U;
  forEach(fn: (item: T, index: number) => void): void;

  indexOf(value: T, fromIndex?: number): number;
  lastIndexOf(value: T, fromIndex?: number): number;

}

export interface CollectionBase<T> extends Iterable<T> {
  append(...items: T[]): this;
  prepend(...items: T[]): this;
  insert(index: number, ...items: T[]): this;
  delete(index: number): this;
  delete(fn: PredicateFn<T>, deleteLimit?: number): this;
  replace(fn: PredicateFn<T>, item: T): this;
  set(index: number, value: T): this;
  get(index: number): T | undefined;
  clear(): this;
  reset(source?: Iterable<T>): this;
  clone(): this;
  first(): T | undefined;
  last(): T | undefined;
  [key: number]: T;
  length: number;
}

export interface CollectionQuery<T> extends CollectionBase<T>, ArrayQuery<T>, MathQuery<T> {
  where(fn: PredicateFn<T>): CollectionQuery<T>;
  where<K extends keyof T, V = T[K]>(key: K, ...values: V[]): CollectionQuery<T>;

  select<U>(mapFn: MapFn<T, U>): CollectionQuery<U>;
  select<K extends keyof T>(key: K): CollectionQuery<T[K]>;
  select(): CollectionQuery<T>;

  chunk(size: number): CollectionQuery<T[]>;

  union(...collections: T[]): this;

  distinct(): this;
  distinct<U>(selector: MapFn<T, U>): this;
  distinct(selector: keyof T): this;

  intersect(...collections: Iterable<T>[]): this;
  except(...collections: Iterable<T>[]): this;

  zip<U>(collection: Iterable<U>): CollectionQuery<[T, U]>;
  zip<U, R>(
    collection: Iterable<U>,
    mapFn: (a: T, b: U) => R
  ): CollectionQuery<R>;

  groupBy<K>(mapFn: MapParameter<T, K>): CollectionQuery<[K, T[]]>;

  orderBy(fn: CompareFn<T>): this;
  orderBy<K extends keyof T>(key: K, desc?: boolean, nullsFirst?: boolean): this;

  countBy<K>(mapFn: MapParameter<T, K>): CollectionQuery<[K, number]>;

  crossJoin<U>(collection: Iterable<U>): CollectionQuery<[T, U]>;

  crossJoin<U, R>(
    collection: Iterable<U>,
    fn: (a: T, b: U) => R
  ): CollectionQuery<R>;

  innerJoin<U, K, R>(
    collection: Iterable<U>,
    outerKeySelector: MapFn<T, K>,
    innerKeySelector: MapFn<U, K>,
    resultSelector: (a: T, b: U) => R
  ): CollectionQuery<R>;

  leftJoin<U, K, R>(
    collection: Iterable<U>,
    outerKeySelector: MapFn<T, K>,
    innerKeySelector: MapFn<U, K>,
    resultSelector: (a: T, b: U | undefined) => R
  ): CollectionQuery<R>;

  groupJoin<U, K, R>(
    collection: Iterable<U>,
    outerKeySelector: MapParameter<T, K>,
    innerKeySelector: MapParameter<U, K>,
    resultSelector: (a: T, b: U[]) => R
  ): CollectionQuery<R>;

  concat(...collections: (ConcatArray<T> | T)[]): CollectionQuery<T>;
  flat<D extends number = 1>(depth?: D): CollectionQuery<FlatArray<T[], D>>;
  flatMap<U>(mapFn: MapFn<T, U[] | U>): CollectionQuery<U>;

  map<U>(mapFn: MapFn<T, U>): CollectionQuery<U>;
  filter(fn: PredicateFn<T>): CollectionQuery<T>;
  slice(start?: number, end?: number): CollectionQuery<T>;

  toArray(): T[];
  toSet(): Set<T>;
  toMap<K extends string | number | symbol>(
    keySelector: MapFn<T, K>
  ): Map<K, T>;
  toMap<K extends string | number | symbol, V>(
    keySelector: MapFn<T, K>,
    valueSelector: MapFn<T, V>
  ): Map<K, V>;

  toJSON(): T[];

  toString(): string;
}
function getPredicateFn<T>(...args: PredicateParameter<T>) {
  const [fn] = args;
  if (isFunction(fn)) {
    return fn;
  }
  const values = args.slice(1) as T[keyof T][];
  return (item: T) => values.includes(item[fn]);
}

export function createPredicate<T, Q>(
  ...args: PredicateParameter<T>
): Predicate<T> {
  const predicate = getPredicateFn(...args) as Predicate<T>;

  predicate.and = (...args: PredicateParameter<T>) => {
    const predicateFn = getPredicateFn(...args);
    const oldPredicate = predicate;
    const newPredicate = createPredicate<T, Q>(
      (item: T, index: number, source: T[]) => oldPredicate(item, index, source) && predicateFn(item, index, source)
    );
    return newPredicate;
  };
  predicate.or = (...args: PredicateParameter<T>) => {
    const predicateFn = getPredicateFn(...args);
    const oldPredicate = predicate;
    const newPredicate = createPredicate<T, Q>(
      (item: T, index: number, source: T[]) => oldPredicate(item, index, source) || predicateFn(item, index, source)
    );
    return newPredicate;
  };
  return predicate;
}

function normalizeMapFn<T, K = keyof T>(fn: MapParameter<T, K>) {
  if (isDef(fn)) {
    if (isFunction(fn)) {
      return fn as MapFn<T, K>;
    }
    return (item: T) => item[fn as keyof T];
  }
  return (item: T) => item;
}

function normalizeIndex(index: number, length: number) {
  return index < 0 ? length + index : index;
}

export function createQuery<T>(
  initSource: Iterable<T> = []
): CollectionQuery<T> {
  const query = new CollectionQueryClass(initSource);
  return query as unknown as CollectionQuery<T>;
}

export function range(
  start: number,
  end: number,
  step = 1
): CollectionQuery<number> {
  const source = [];
  for (let i = start; i < end; i += step) {
    source.push(i);
  }
  return createQuery(source);
}

export function unique<T>(array: Iterable<T>) {
  return Array.from(new Set(array));
}

export class CollectionQueryClass<T> implements ArrayLike<T> {
  source: T[] = [];

  private static proxyHandler: ProxyHandler<CollectionQueryClass<any>> = {
    get(target, property: string) {
      if (isKeyOf(target, property)) {
        return target[property];
      }
      return target.get(+property);
    },
    set(target, property: string, value): boolean {
      if (isKeyOf(target, property)) {
        target[property] = value;
        return true;
      }
      target.set(+property, value);
      return true;
    },
    deleteProperty(target, prop) {
      if (isString(prop)) {
        let index = +prop;
        if (!Number.isNaN(index)) {
          index = normalizeIndex(index, target.length);
          return delete target.source[index];
        }
      }
      return false;
    }
  };

  constructor(source: Iterable<T> = []) {
    this.source = Array.isArray(source) ? source : source as T[];
    return new Proxy(this, CollectionQueryClass.proxyHandler);
  }

  [n: number]: T;

  where(...args: PredicateParameter<T>) {
    return createQuery(this.source.filter(createPredicate(...args)));
  }

  select<U>(mapFn: MapFn<T, U>): CollectionQuery<U>;
  select<K extends keyof T>(key: K): CollectionQuery<T[K]>;
  select(): CollectionQuery<T>;
  select<U>(fn?: MapFn<T, U> | keyof T) {
    if (isUndefined(fn)) {
      return createQuery(this.source);
    }
    if (isFunction(fn)) {
      return createQuery(this.source.map(fn));
    }
    return createQuery(this.source.map(item => item[fn]));
  }

  insert(index: number, ...items: T[]) {
    this.source.splice(index, 0, ...items);
    return this;
  }

  append(...items: T[]) {
    this.source.push(...items);
    return this;
  }

  prepend(...items: T[]) {
    this.source.unshift(...items);
    return this;
  }

  delete(fn: number | PredicateFn<T>, deleteLimit?: number) {
    if (isNumber(fn)) {
      fn = normalizeIndex(fn, this.length);
      this.source.splice(fn, 1);
    } else {
      // 顺序批量删除

      const indices: number[] = [];

      for (let i = 0; i < this.source.length; i++) {
        if (deleteLimit && indices.length >= deleteLimit) {
          break;
        }
        if (fn(this.source[i], i, this.source)) {
          indices.push(i);
        }
      }

      for (let i = indices.length - 1; i >= 0; i--) {
        this.source.splice(indices[i], 1);
      }
    }
    return this;
  }

  concat(...items: (ConcatArray<T> | T)[]) {
    const newSource = this.source.concat(...items);
    return createQuery(newSource);
  }

  replace(fn: PredicateFn<T>, item: T) {
    for (let i = 0; i < this.source.length; i++) {
      if (fn(this.source[i], i, this.source)) {
        this.source[i] = item;
      }
    }
    return this;
  }

  max(fn?: MapFn<T, number>) {
    if (!fn) {
      fn = item => isNumber(item) ? item : 0;
    }
    return Math.max(...this.source.map(fn));
  }

  min(fn?: MapFn<T, number>) {
    if (!fn) {
      fn = item => isNumber(item) ? item : 0;
    }
    return Math.min(...this.source.map(fn));
  }

  sum(fn?: MapFn<T, number>) {
    if (!fn) {
      fn = item => isNumber(item) ? item : 0;
    }
    return this.source.map(fn).reduce((a, b) => a + b, 0);
  }

  average(fn?: MapFn<T, number>) {
    return this.sum(fn) / this.source.length;
  }

  distinct<U>(mapFn?: MapFn<T, U> | keyof T) {
    if (isUndef(mapFn)) {
      return this.reset(new Set(this.source));
    }
    const fn = isFunction(mapFn) ? mapFn : (item: T) => item[mapFn];

    const set = new Set();
    const array: T[] = [];
    for (let i = 0; i < this.source.length; i++) {
      const item = this.source[i];
      const key = fn(item, i, this.source);
      if (!set.has(key)) {
        set.add(key);
        array.push(item);
      }
    }
    return this.reset(new Set(array));
  }

  intersect(...collections: Iterable<T>[]) {
    const set = new Set(collections.flatMap(c => Array.from(c)));
    const array = this.source.filter(item => set.has(item));
    return this.reset(array);
  }

  chunk(size: number) {
    const array: T[][] = [];
    for (let i = 0; i < this.source.length; i += size) {
      array.push(this.source.slice(i, i + size));
    }
    return createQuery(array);
  }

  union(...collections: Iterable<T>[]) {
    this.source.push(...collections.flatMap(c => Array.from(c)));
    return this;
  }

  except(...collections: Iterable<T>[]) {
    const set = new Set(collections.flatMap(c => Array.from(c)));
    const array = this.source.filter(item => !set.has(item));
    return this.reset(array);
  }

  zip<U, R = [T, U]>(
    collection: Iterable<U>,
    mapFn: (a: T, b: U) => R = (a, b) => [a, b] as R
  ) {
    const array = Array.from(collection);
    const result = this.source.map((item, index) => mapFn(item, array[index]));
    return createQuery(result);
  }

  orderBy(arg: CompareFn<T> | keyof T, desc = false, nullsFirst = false) {
    const compareFn = isFunction(arg)
      ? arg
      : (a: T, b: T) => {
          const aVal = a[arg];
          const bVal = b[arg];
          if (aVal === bVal) {
            return 0;
          }
          if (isUndef(aVal)) {
            return nullsFirst ? -1 : 1;
          }
          if (isUndef(aVal)) {
            return nullsFirst ? 1 : -1;
          }
          return (aVal < bVal && !desc) ? -1 : 1;
        };
    this.source.sort(compareFn);
    return this;
  }

  countBy<K>(args: MapParameter<T, K>) {
    const mapFn = normalizeMapFn(args);
    const map = new Map();
    for (let i = 0; i < this.source.length; i++) {
      const item = this.source[i];
      const key = mapFn(item, i, this.source);
      const count = map.get(key) ?? 0;
      map.set(key, count + 1);
    }
    const result = Array.from(map.entries());
    return createQuery(result);
  }

  groupBy<K = keyof T>(args: MapParameter<T, K>) {
    const mapFn = normalizeMapFn(args);
    const map = new Map();
    for (let i = 0; i < this.source.length; i++) {
      const item = this.source[i];
      const key = mapFn(item, i, this.source);
      const array = map.get(key) ?? [];
      array.push(item);
      map.set(key, array);
    }
    const result = Array.from(map.entries());
    return createQuery(result);
  }

  groupJoin<U, K, R>(
    collection: Iterable<U>,
    outerKeySelector: MapParameter<T, K>,
    innerKeySelector: MapParameter<U, K>,
    resultSelector: (outer: T, inner: U[]) => R
  ) {
    const map = new Map();
    const outerMapFn = normalizeMapFn(outerKeySelector);
    const innerMapFn = normalizeMapFn(innerKeySelector);
    for (let i = 0; i < this.source.length; i++) {
      const item = this.source[i];
      const key = outerMapFn(item, i, this.source);
      const array = map.get(key) ?? [];
      array.push(item);
      map.set(key, array);
    }
    const innerSource = Array.from(collection);
    const result = Array.from(map.entries()).flatMap(([key, value]) => {
      const inner = innerSource.filter((item, index) => innerMapFn(item, index, innerSource) === key);
      return value.map((item: T) => resultSelector(item, inner));
    });

    return createQuery(result);
  }

  crossJoin<U, R>(
    collection: Iterable<U>,
    resultSelector: (a: T, b: U) => R = (a, b) => [a, b] as R
  ) {
    const array = Array.from(collection);
    const result = this.source.flatMap(item => array.map(i => resultSelector(item, i)));
    return createQuery(result);
  }

  innerJoin<U, K, R>(
    collection: Iterable<U>,
    outerKeySelector: MapFn<T, K>,
    innerKeySelector: MapFn<U, K>,
    resultSelector: (a: T, b: U) => R = (a, b) => [a, b] as R
  ) {
    const array = Array.from(collection);
    const innerSource = Array.from(collection);
    const result = this.source.flatMap((item, index) => {
      const key = outerKeySelector(item, index, this.source);
      const inner = array.filter((i, iIndex) => innerKeySelector(i, iIndex, innerSource) === key);
      return inner.map(i => resultSelector(item, i));
    });
    return createQuery(result);
  }

  leftJoin<U, K, R>(
    collection: Iterable<U>,
    outerKeySelector: MapFn<T, K>,
    innerKeySelector: MapFn<U, K>,
    resultSelector: (a: T, b: U | undefined) => R = (a, b) => [a, b] as R
  ) {
    const array = Array.from(collection);
    const result = this.source.flatMap((item, index) => {
      const key = outerKeySelector(item, index, this.source);
      const inner = array.find((i, iIndex) => innerKeySelector(i, iIndex, array) === key);
      return [resultSelector(item, inner)];
    });
    return createQuery(result);
  }

  slice(start: number, end: number) {
    return createQuery(this.source.slice(start, end));
  }

  set(index: number, item: T) {
    index = normalizeIndex(index, this.length);
    this.source[index] = item;
    return this;
  }

  get(index: number) {
    index = normalizeIndex(index, this.length);
    return this.source[index];
  }

  clear() {
    this.source.length = 0;
    return this;
  }

  clone() {
    return createQuery(this.source);
  }

  reset(iterable: Iterable<T> = this.source) {
    this.source.splice(0, this.source.length, ...iterable);
    return this;
  }

  toArray() {
    return Array.from(this.source);
  }

  toSet() {
    return new Set(this.source);
  }

  flat() {
    const result = this.source.flat();
    return createQuery(result);
  }

  flatMap<U>(mapFn: MapFn<T, U[]>) {
    const result = this.source.flatMap(mapFn);
    return createQuery(result);
  }

  reverse() {
    this.source.reverse();
    return this;
  }

  sort(compareFn?: (a: T, b: T) => number) {
    this.source.sort(compareFn);
    return this;
  }

  every(predicate: (value: T, index: number, array: T[]) => unknown) {
    return this.source.every(predicate);
  }

  some(predicate: (value: T, index: number, array: T[]) => unknown) {
    return this.source.some(predicate);
  }

  find(predicate: (value: T, index: number, array: T[]) => unknown) {
    return this.source.find(predicate);
  }

  findIndex(predicate: (value: T, index: number, array: T[]) => unknown) {
    return this.source.findIndex(predicate);
  }

  includes(searchElement: T, fromIndex?: number) {
    return this.source.includes(searchElement, fromIndex);
  }

  indexOf(searchElement: T, fromIndex?: number) {
    return this.source.indexOf(searchElement, fromIndex);
  }

  lastIndexOf(searchElement: T, fromIndex?: number) {
    return this.source.lastIndexOf(searchElement, fromIndex);
  }

  forEach(callbackfn: (value: T, index: number, array: T[]) => void) {
    this.source.forEach(callbackfn);
    return this;
  }

  map<U>(mapFn: MapFn<T, U>) {
    const result = this.source.map(mapFn);
    return createQuery(result);
  }

  filter(predicate: (value: T, index: number, array: T[]) => unknown) {
    const result = this.source.filter(predicate);
    return createQuery(result);
  }

  splice(start: number, deleteCount?: number, ...items: T[]) {
    if (deleteCount === undefined) {
      deleteCount = this.source.length - start;
    }
    this.source.splice(start, deleteCount, ...items);
    return this;
  }

  get length() {
    return this.source.length;
  }

  set length(value: number) {
    this.source.length = value;
  }

  first() {
    return this.source[0];
  }

  last() {
    return this.source.at(-1);
  }

  toMap(keySelector: MapFn<T, any>, valueSelector?: MapFn<T, any>) {
    const map = new Map();
    for (let i = 0; i < this.source.length; i++) {
      const item = this.source[i];
      const key = keySelector(item, i, this.source);
      const value = valueSelector ? valueSelector(item, i, this.source) : item;
      map.set(key, value);
    }
    return map;
  }

  [Symbol.iterator]() {
    return this.source[Symbol.iterator]();
  }
}

export function deleteBy<T>(collection: T[], ...predicate: PredicateParameter<T>) {
  const fn = getPredicateFn(...predicate);
  for (let i = collection.length - 1; i >= 0; i--) {
    if (fn(collection[i], i, collection)) {
      collection.splice(i, 1);
    }
  }
  return collection;
}

export function restoreArray<T>(collection: T[], newCollection: T[]) {
  collection.splice(0, collection.length, ...newCollection);
  return collection;
}
