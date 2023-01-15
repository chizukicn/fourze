import type {
  MaybeArray,
  MaybeAsyncFunction,
  MaybeFunction,
  MaybeNumber
} from "maybe-types";
import { parseFakerNumber } from "./faker";
import { isFunction } from "./is";

export type DelayMsType = MaybeFunction<MaybeArray<MaybeNumber>>;

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
 *
 * @category Promise
 * @see https://github.com/antfu/utils/blob/main/src/promise.ts
 */
export function createSingletonPromise<T>(
  fn: MaybeAsyncFunction<T>
): SingletonPromiseReturn<T> {
  let _promise: Promise<T> | undefined;

  function wrapper(this: any) {
    if (!_promise) {
      _promise = Promise.resolve(fn.call(this));
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

/**
 *  alias of `createSingletonPromise`
 */
export const asyncLock = createSingletonPromise;
