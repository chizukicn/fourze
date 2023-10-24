import type {
  MaybeArray,
  MaybeAsyncFunction,
  MaybeFunction,
  MaybeNumeric
} from "maybe-types";
import { parseFakerNumber } from "./faker";
import { isFunction } from "./is";

export type DelayMsType = MaybeFunction<MaybeArray<MaybeNumeric>>;

export function delay(ms: DelayMsType) {
  ms = isFunction(ms) ? ms() : ms;
  const tmp = parseFakerNumber(ms);
  return new Promise<number>((resolve) => setTimeout(() => resolve(tmp), tmp));
}

export interface SingletonPromiseReturn<T> {
  (): Promise<T>
  /**
   * Reset current staled promise.
   * Await it to have proper shutdown.
   */
  reset: () => Promise<void>
}

/**
 * Create singleton promise function
 * base on original work of @antfu/utils by Anthony Fu (MIT)
 * @category Promise
 * @see https://github.com/antfu/utils/blob/main/src/promise.ts
 */
export function createSingletonPromise<T, Args extends any[] = any[]>(
  fn: MaybeAsyncFunction<T, Args, false>
): SingletonPromiseReturn<T> {
  let _promise: Promise<T> | undefined;

  function wrapper(this: any, ...args: Args) {
    if (!_promise) {
      _promise = Promise.resolve(fn.call(this, ...args));
    }
    return _promise;
  }

  wrapper.reset = async () => {
    const _prev = _promise;
    _promise = undefined;
    if (_prev) {
      await _prev;
    }
  };

  return wrapper;
}

export interface MemoizeReturn<R, P extends any[], K> {

  /**
   * Memoize function
   */
  (...args: P): R

  /**
   * Get raw function
   * @param args
   * @returns
   */
  raw: (...args: P) => R

  /**
   * Force cache by key
   * @param args
   * @returns
   */
  force: (...args: P) => R

  /**
   * Set cache by key
   * @param key
   * @param value
   */
  set(key: K | P, value: R): void

  /**
   * Get cache by key
   * @param key
   */
  get(key: K | P): R | undefined

  delete(key: K | P): boolean

  /**
   * Clear cache
   * @returns
   */
  clear: () => void

  readonly cache: Map<K, R>

  readonly size: number
}

export interface MemoizeOptions<_, P extends any[], K extends string | number | symbol> {
  serialize?: (...args: P) => K
  maxCount?: number
}
/**
 * Create memoize promise function
 * @param fn  - function to memoize
 * @param options - options
 * @returns memoized function
 */
export function memoize<R, P extends any[], K extends string | number | symbol = string>(fn: (...args: P) => R, options: MemoizeOptions<R, P, K> = {}): MemoizeReturn<R, P, K> {
  const cache = new Map<K, R>();
  const serialize = options.serialize ?? ((...args: P) => JSON.stringify(args) as K);

  const getKey = (args: P | K) => {
    if (Array.isArray(args)) {
      return serialize(...args);
    }
    return args;
  };

  const wrapper = ((...args: P) => {
    const item = wrapper.get(args);
    if (item) {
      return item;
    }
    return wrapper.force(...args);
  }) as MemoizeReturn<R, P, K>;

  wrapper.clear = () => {
    cache.clear();
  };

  wrapper.raw = (...args: P) => {
    return fn(...args);
  };

  wrapper.force = (...args: P) => {
    const key = serialize(...args);
    const value = wrapper.raw(...args);
    wrapper.set(key, value);
    return value;
  };

  wrapper.delete = (key: K | P) => {
    key = getKey(key);
    return cache.delete(key);
  };

  wrapper.set = (key: K | P, value: R) => {
    key = getKey(key);
    cache.set(key, value);
    if (options.maxCount && cache.size > options.maxCount) {
      const first = cache.keys().next().value;
      cache.delete(first);
    }
  };

  wrapper.get = (key: K | P) => {
    key = getKey(key);
    return cache.get(key);
  };

  Object.defineProperties(wrapper, {
    cache: {
      get: () => cache
    },
    size: {
      get: () => cache.size
    }
  });

  return wrapper;
}

