import type { MaybeRegex } from "maybe-types";
import { hasProtocol, isEmptyURL, isRelative, joinURL, normalizeURL, withLeadingSlash, withTrailingSlash, withoutBase, withoutLeadingSlash, withoutTrailingSlash } from "ufo";
import { minimatch } from "minimatch";
import { isRegExp } from "./is";

export function isMatch(path: string, ...pattern: MaybeRegex[]) {
  return pattern.some((r) => {
    if (isRegExp(r)) {
      return r.test(path);
    }

    return path.startsWith(r) || minimatch(path, r, { matchBase: true });
  });
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

export { withoutBase, normalizeURL, isEmptyURL, isRelative, joinURL, hasProtocol, withTrailingSlash, withoutTrailingSlash, withLeadingSlash, withoutLeadingSlash };
