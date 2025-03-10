import type { MaybeRegex } from "maybe-types";
import { hasProtocol, isEmptyURL, isRelative, joinURL, normalizeURL, withLeadingSlash, withoutBase, withoutLeadingSlash, withoutTrailingSlash, withTrailingSlash } from "ufo";

export function createFilter(
  include: MaybeRegex[],
  exclude: MaybeRegex[]
): (id: string) => boolean {
  return (id: string) => {
    if (exclude.some((p) => id.match(p))) {
      return false;
    };
    return include.length === 0 || include.some((p) => id.match(p));
  };
}

export function isMatch(id: string, include: MaybeRegex[], exclude: MaybeRegex[]) {
  return createFilter(include, exclude)(id);
}

export function withBase(input: string, base: string, trailingSlash = true) {
  if (isEmptyURL(base) || hasProtocol(input)) {
    return input;
  }
  const _base = trailingSlash ? withTrailingSlash(base) : base;

  if (input.startsWith(_base)) {
    return input;
  }
  return joinURL(_base, input);
}

export { hasProtocol, isEmptyURL, isRelative, joinURL, normalizeURL, withLeadingSlash, withoutBase, withoutLeadingSlash, withoutTrailingSlash, withTrailingSlash };
