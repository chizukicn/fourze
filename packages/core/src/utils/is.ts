export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

export const isArray = Array.isArray;

/**
 * Get the raw type string of a value, e.g., [object Object].
 */
const _toString = Object.prototype.toString;

export function toRawType(value: any): string {
  return _toString.call(value).slice(8, -1);
}
/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
export function isPlainObject(obj: any): boolean {
  return _toString.call(obj) === "[object Object]";
}

// eslint-disable-next-line ts/no-unsafe-function-type
export function isFunction<T extends Function>(value: any): value is T {
  return typeof value === "function";
}

export function isConstructor<T>(value: unknown): value is Constructor<T> {
  return isFunction(value) && value.prototype?.constructor === value;
}

export function isBuffer(value: unknown): value is Buffer {
  return isObject(value) && !!globalThis.Buffer && globalThis.Buffer.isBuffer(value);
}

export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

export function isPromise<R = unknown>(value: unknown): value is Promise<R> {
  return isObject(value) && "then" in value;
}

export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

export function isFormData(value: unknown): value is FormData {
  return isDef(value) && !!globalThis.FormData && value instanceof FormData;
}

export function isURL(value: unknown): value is URL {
  return globalThis.URL && value instanceof URL;
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function isPrimitive(
  value: unknown
): value is string | number | boolean {
  return isString(value) || isNumber(value) || isBoolean(value);
}

export function isSymbol(value: unknown): value is symbol {
  return typeof value === "symbol";
}

export function isDef<T>(value?: T): value is Exclude<T, undefined> {
  return !isUndef(value);
}

export function isUndef(value: unknown): value is null | undefined {
  return isUndefined(value) || isNull(value);
}

export function isUndefined(value: unknown): value is undefined {
  return typeof value === "undefined";
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isTrue(value: unknown): value is true {
  return value === true;
}

export function isFalse(value: unknown): value is false {
  return value === false;
}

export function isFalsy(
  value: unknown
): value is false | 0 | "" | null | undefined {
  return !value;
}

export function isTruthy<T>(value: T): value is NonNullable<T> {
  return !!value;
}

export const isNode = () => typeof window === "undefined";

export const isBrowser = () => !isNode();

export type Constructor<T> =
  | {
    new (...args: any[]): NonNullable<T>;
  }
  | {
    (): T;
  };
