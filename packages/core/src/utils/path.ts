import type { MaybeRegex } from "maybe-types";
import minimatch from "minimatch";
import { isRegExp } from "./is";

export function slash(...paths: string[]): string {
  let path = paths
    .map((p) => p.replace(/\\/g, "/"))
    .join("/")
    .replace(/\/+/g, "/");

  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path;
}

export function resolvePath(_path: string, _base = "/"): string {
  if (!hasProtocol(_path)) {
    if (!_path.startsWith("//")) {
      return slash(_base, _path);
    }
    return slash(_path);
  }
  return _path;
}

export function relativePath(path: string, base?: string): string | null {
  if (!hasProtocol(path)) {
    if (base) {
      if (path.startsWith(base)) {
        path = path.replace(new RegExp(`^${slash(base)}`), "/");
      } else {
        return null;
      }
    }
    return slash(path);
  }
  return null;
}

export function hasProtocol(path: string) {
  return /^\w+:\/\//i.test(path);
}

export function isMatch(path: string, ...pattern: MaybeRegex[]) {
  return pattern.some((r) => {
    if (isRegExp(r)) {
      return r.test(path);
    }
    return path.startsWith(r) || minimatch(path, r, { partial: true });
  });
}
