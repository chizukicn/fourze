import type { MaybeRegex } from "maybe-types";
import minimatch from "minimatch";
import { isRegExp } from "./is";

export function slash(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function slashEnd(p: string): string {
  return p.replace(/\/+$/, "");
}

export const NOT_NEED_BASE = /^((https?|file):)\/\//i;

export function resolvePath(_path: string, _base?: string): string {
  if (isRelative(_path)) {
    if (!_path.startsWith("//") && _base) {
      return slash(`${_base}/${_path}`);
    }
    return slash(_path);
  }
  return _path;
}

export function relativePath(path: string, base?: string): string {
  if (base) {
    path = path.replace(new RegExp(`^${slash(base)}`), "");
  }
  return path;
}

export function isAbsolute(path: string) {
  return NOT_NEED_BASE.test(path);
}

export function isRelative(path: string) {
  return !NOT_NEED_BASE.test(path);
}

export function isMatch(path: string, ...pattern: MaybeRegex[]) {
  return pattern.some((r) => {
    if (isRegExp(r)) {
      return r.test(path);
    }
    return path.startsWith(r) || minimatch(path, r, { partial: true });
  });
}
