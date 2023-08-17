import destr from "destr";
import { assert } from "./error";
import { isString } from "./is";

export function transformTemplate(
  template: string,
  data: Record<string, any>
): string {
  return template.replace(/<%(.*?)%>/g, (_, name) => {
    return data[name.trim()] ?? "";
  });
}

/**
 * @reference escape-string-regexp
 * @param str
 * @returns
 */
export function escapeStringRegexp(str: string) {
  assert(isString(str), "Expected a string");

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return str
    .replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")
    .replace(/-/g, "\\x2d");
}

export const parseJson = destr;

export const stringifyJson = JSON.stringify;

export function normalizeRoute(path: string, method = "GET") {
  method = method.toUpperCase();
  return `[${method}] ${path}`;
}
