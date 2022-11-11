export function isString(value: unknown): value is string {
    return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
    return typeof value === "number";
}

export function isBoolean(value: unknown): value is boolean {
    return typeof value === "boolean";
}

export function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object";
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction<T extends Function>(value: unknown): value is T {
    return typeof value === "function" || value instanceof Function;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isConstructor<T extends Function>(value: unknown): value is T {
    return isFunction(value) && value.prototype !== undefined;
}

export function isBuffer(value: unknown): value is Buffer {
    return isObject(value) && "length" in value;
}

export function isPromise<R = unknown>(value: unknown): value is Promise<R> {
    return isObject(value) && "then" in value;
}

export function isRegExp(value: unknown): value is RegExp {
    return value instanceof RegExp;
}

export function isFormData(value: unknown): value is FormData {
    return value != null && globalThis.FormData && value instanceof FormData;
}

export function isURL(value: unknown): value is URL {
    return globalThis.URL && value instanceof URL;
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
