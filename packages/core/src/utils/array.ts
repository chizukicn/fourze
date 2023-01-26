export function unique<T>(arr: Iterable<T>): T[] {
  return Array.from(new Set(arr));
}

export function groupBy<T, K>(array: T[], callback: (t: T) => K) {
  const map = new Map<K, T[]>();
  for (let i = 0; i < array.length; i++) {
    const t = array[i];
    const key = callback(t);
    const temp: T[] = map.get(key) || [];
    if (!map.has(key)) {
      map.set(key, temp);
    }
    temp.push(t);
  }

  return Array.from(map.entries());
}

export function filterBy<T, I>(array: T[], callback: (t: T) => I) {
  const set = new Set<I>();
  const arr = <T[]>[];
  for (let i = 0; i < array.length; i++) {
    const t = array[i];
    const key = callback(t);
    if (!set.has(key)) {
      set.add(key);
      arr.push(t);
    }
  }

  return arr;
}

export function countBy<T, I>(array: T[], callback: (t: T) => I) {
  const map = new Map<I, number>();
  for (let i = 0; i < array.length; i++) {
    const t = array[i];
    const key = callback(t);

    if (!map.has(key)) {
      map.set(key, 0);
    }
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries());
}

export type PredicateFn<T> = (item: T, index: number) => boolean;

export type MapFn<T, U> = (item: T, index: number) => U;

export type CompareFn<T> = (a: T, b: T) => number;

export interface Predicate<T> extends PredicateFn<T> {
  and(predicateFm: PredicateFn<T>): this
  or(predicateFm: PredicateFn<T>): this
}
export interface WhereCollectionQuery<T>
  extends CollectionQuery<T>,
  Predicate<T> {}

export interface CollectionQuery<T> extends Iterable<T> {
  where(fn: PredicateFn<T>): WhereCollectionQuery<T>
  select<U>(mapFn: MapFn<T, U>): CollectionQuery<U>
  select(): CollectionQuery<T>
  append(...items: T[]): this
  prepend(...items: T[]): this
  insert(index: number, ...items: T[]): this
  delete(index: number): this
  delete(fn: PredicateFn<T>): this
  sort(compareFn: CompareFn<T>): this
  clear(): this
  reverse(): this
  union(...collections: Iterable<T>[]): this
  flat<D extends number = 1>(depth?: D): CollectionQuery<FlatArray<T[], D>>
  distinct(): this
  distinct<U>(mapFn: MapFn<T, U>): this
  intersect(...collections: Iterable<T>[]): this
  except(...collections: Iterable<T>[]): this
  zip<U>(collection: Iterable<U>): CollectionQuery<[T, U]>
  zip<U, R>(
    collection: Iterable<U>,
    mapFn: (a: T, b: U) => R
  ): CollectionQuery<R>
  groupBy<K>(mapFn: MapFn<T, K>): CollectionQuery<[K, T[]]>
  clone(): this
  fill(value: T, start?: number, end?: number): this
  slice(start?: number, end?: number): this
  toArray(): T[]
  toSet(): Set<T>
  includes(value: T, fromIndex?: number): boolean
  reset(source?: Iterable<T>): this

  readonly length: number
  // set(index: number, value: T): this
  // get(index: number): T | undefined
}

export function createPredicate<T, Q>(
  predicateFn: PredicateFn<T>
): Predicate<T> {
  const predicate = predicateFn as Predicate<T>;
  predicate.and = (fn: PredicateFn<T>) => {
    const oldPredicate = predicate;
    const newPredicate = createPredicate<T, Q>(
      (item: T, index: number) => oldPredicate(item, index) && fn(item, index)
    );
    return newPredicate;
  };
  predicate.or = (fn: PredicateFn<T>) => {
    const oldPredicate = predicate;
    const newPredicate = createPredicate<T, Q>(
      (item: T, index: number) => oldPredicate(item, index) || fn(item, index)
    );
    return newPredicate;
  };
  return predicate;
}

export function createQuery<T>(
  initSource: Iterable<T> = []
): CollectionQuery<T> {
  const source = Array.from(initSource);
  return {
    where(predicateFn: PredicateFn<T>) {
      let predicate = createPredicate(predicateFn);
      const query = this.clone() as WhereCollectionQuery<T>;
      query.and = (fn: PredicateFn<T>) => {
        predicate = predicate.and(fn);
        return query;
      };
      query.or = (fn: PredicateFn<T>) => {
        predicate = predicate.or(fn);
        return query;
      };
      query.select = (fn?: MapFn<T, any>) => {
        return createQuery(source.filter(predicate)).select(fn!);
      };
      return query;
    },
    select<U>(fn?: (item: T, index: number) => U) {
      if (fn) {
        return createQuery(source.map(fn));
      }
      return createQuery(source);
    },
    insert(index, ...items) {
      source.splice(index, 0, ...items);
      return this;
    },
    append(...items: T[]) {
      source.push(...items);
      return this;
    },
    prepend(...items: T[]) {
      source.unshift(...items);
      return this;
    },
    delete(fn: number | PredicateFn<T>) {
      const index = typeof fn === "number" ? fn : source.findIndex(fn);
      if (index >= 0) {
        source.splice(index, 1);
      }
      return this;
    },
    sort(fn: CompareFn<T>) {
      source.sort(fn);
      return this;
    },
    distinct<U>(mapFn?: MapFn<T, U>) {
      if (!mapFn) {
        return this.reset(new Set(source));
      }
      const set = new Set<U>();
      const array: T[] = [];
      for (let i = 0; i < source.length; i++) {
        const item = source[i];
        const key = mapFn(item, i);
        if (!set.has(key)) {
          set.add(key);
          array.push(item);
        }
      }
      return this.reset(new Set(array));
    },
    intersect(...collections: Iterable<T>[]) {
      const set = new Set(collections.flatMap((c) => Array.from(c)));
      const array = source.filter((item) => set.has(item));
      return this.reset(array);
    },
    union(...collections: Iterable<T>[]) {
      source.push(...collections.flatMap((c) => Array.from(c)));
      return this;
    },
    except(...collections: Iterable<T>[]) {
      const set = new Set(collections.flatMap((c) => Array.from(c)));
      const array = source.filter((item) => !set.has(item));
      return this.reset(array);
    },
    zip<U, R = [T, U]>(
      collection: Iterable<U>,
      mapFn: (a: T, b: U) => R = (a, b) => [a, b] as R
    ) {
      const array = Array.from(collection);
      const result = source.map((item, index) => mapFn(item, array[index]));
      return createQuery(result);
    },
    groupBy<K>(mapFn: MapFn<T, K>) {
      const map = new Map<K, T[]>();
      for (let i = 0; i < source.length; i++) {
        const item = source[i];
        const key = mapFn(item, i);
        const array = map.get(key) ?? [];
        array.push(item);
        map.set(key, array);
      }
      const result = Array.from(map.entries());
      return createQuery(result);
    },
    flat<D extends number = 1>(depth?: D) {
      return createQuery(source.flat(depth));
    },
    fill(value: T, start = 0, end = source.length) {
      start = start < 0 ? source.length + start : start;
      end = end < 0 ? source.length + end : end;
      source.fill(value, start, end);
      return this;
    },
    slice(start, end) {
      return createQuery(source.slice(start, end));
    },
    reverse() {
      source.reverse();
      return this;
    },
    clear() {
      source.length = 0;
      return this;
    },
    clone() {
      return createQuery(source);
    },
    reset(iterable: Iterable<T> = initSource) {
      source.splice(0, source.length, ...Array.from(iterable));
      return this;
    },
    includes(item: T, fromIndex = 0) {
      return source.includes(item, fromIndex);
    },
    toArray() {
      return Array.from(source);
    },
    toSet() {
      return new Set(source);
    },
    [Symbol.iterator]() {
      return source[Symbol.iterator]();
    },
    get length() {
      return source.length;
    }
  };
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
