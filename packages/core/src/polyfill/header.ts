function isHeader(headers: unknown): headers is Headers {
  return (
    (!!globalThis.Headers && headers instanceof globalThis.Headers)
    || headers instanceof PolyfillHeaders
  );
}

export type PolyfillHeaderValue = string | string[] | number | undefined;

export type PolyfillHeaderInit =
  | Record<string, PolyfillHeaderValue>
  | string[][]
  | Headers;

export class PolyfillHeaders {
  readonly #headers: Record<string, string> = {};
  constructor(init: PolyfillHeaderInit = {}) {
    this.#headers = flatHeaders(init);
  }

  append(name: string, value: string): void {
    appendHeader(this.#headers, name.toLowerCase(), value);
  }

  delete(name: string): void {
    delete this.#headers[name];
  }

  get(name: string): string | null {
    return this.#headers[name.toLowerCase()] ?? null;
  }

  has(name: string): boolean {
    return name in this.#headers;
  }

  set(name: string, value: string): void {
    this.#headers[name.toLowerCase()] = value;
  }

  forEach(
    callbackfn: (value: string, key: string, parent: Headers) => void,
    thisArg?: any
  ): void {
    for (const key in this.#headers) {
      callbackfn(this.#headers[key], key, thisArg ?? this);
    }
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return Object.entries(this.#headers)[Symbol.iterator]();
  }

  entries(): IterableIterator<[string, string]> {
    return Object.entries(this.#headers)[Symbol.iterator]();
  }

  keys(): IterableIterator<string> {
    return Object.keys(this.#headers)[Symbol.iterator]();
  }

  values(): IterableIterator<string> {
    return Object.values(this.#headers)[Symbol.iterator]();
  }
}

export interface TransformHeaderOptions {
  /**
   *  @default ", "
   */
  separator?: string

  /**
   * @default "lower"
   */
  caseInsensitive?: "lower" | "upper" | "none"
}

export function getHeader(headers: Record<string, string>, key: string) {
  if (!(key in headers)) {
    if (key.toLowerCase() in headers) {
      key = key.toLowerCase();
    } else if (key.toUpperCase() in headers) {
      key = key.toUpperCase();
    }
  }
  return [key, headers[key]];
}

export function getHeaderKey(headers: PolyfillHeaderInit, key: string) {
  return getHeader(flatHeaders(headers), key)[0];
}

export function getHeaderValue(
  headers: PolyfillHeaderInit,
  key: string,
  defaultValue?: string
) {
  return getHeader(flatHeaders(headers), key)?.[1] ?? defaultValue;
}

export function getHeaderRawValue(
  value: PolyfillHeaderValue,
  options: TransformHeaderOptions = {}
): string | undefined {
  if (Array.isArray(value)) {
    return value
      .map((v) => getHeaderRawValue(v, options))
      .filter((r) => !!r)
      .join(options.separator ?? ", ");
  }
  return value ? String(value) : undefined;
}

export function appendHeader(
  headers: Record<string, string>,
  _key: string,
  value: PolyfillHeaderValue,
  options: TransformHeaderOptions = {}
) {
  const [key, oldValue] = getHeader(headers, _key);

  delete headers[key];

  const { separator = ", ", caseInsensitive = "lower" } = options;

  const appendValue = value
    ? Array.isArray(value)
      ? value.join(separator)
      : String(value)
    : "";
  value = oldValue ? `${oldValue}, ${appendValue}` : appendValue;

  headers[transformCase(key, caseInsensitive)] = value;
}

export interface FlatHeadersOptions {
  /**
   * @default "lower"
   */
  caseInsensitive?: "lower" | "upper" | "none"
}

function transformCase(
  key: string,
  caseInsensitive: "lower" | "upper" | "none" = "none"
) {
  if (caseInsensitive === "lower") {
    return key.toLowerCase();
  } else if (caseInsensitive === "upper") {
    return key.toUpperCase();
  }
  return key;
}

export function flatHeaders(
  init: PolyfillHeaderInit = {},
  options: TransformHeaderOptions = {}
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (isHeader(init)) {
    init.forEach((value, key) => {
      appendHeader(headers, key, value, options);
    });
  } else {
    const entries = Array.isArray(init) ? init : Object.entries(init);
    for (const [key, value] of entries) {
      appendHeader(headers, key, value, options);
    }
  }
  return headers;
}

export function toRawHeaders(init: PolyfillHeaderInit = {}): string {
  const headers = flatHeaders(init);
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\r\n");
}
