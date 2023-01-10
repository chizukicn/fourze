import os from "os";
import path from "path";
import EventEmitter from "events";
import { slash } from "@fourze/core";

/**
 *  copy from @vitejs/vite/packages/vite/src/node/utils.ts
 */

export const isWindows = os.platform() === "win32";

export function normalizePath(id: string) {
  return path.posix.normalize(isWindows ? slash(id) : id);
}

export function injectEventEmitter<T extends EventEmitter>(app: T) {
  const _emitter = new EventEmitter();
  app.addListener = function (
    event: string,
    listener: (...args: any[]) => void
  ) {
    _emitter.addListener(event, listener);
    return this;
  };

  app.on = function (event: string, listener: (...args: any[]) => void) {
    _emitter.on(event, listener);
    return this;
  };

  app.emit = function (event: string, ...args: any[]) {
    return _emitter.emit(event, ...args);
  };

  app.once = function (event: string, listener: (...args: any[]) => void) {
    _emitter.once(event, listener);
    return this;
  };

  app.removeListener = function (
    event: string,
    listener: (...args: any[]) => void
  ) {
    _emitter.removeListener(event, listener);
    return this;
  };

  app.removeAllListeners = function (event?: string) {
    _emitter.removeAllListeners(event);
    return this;
  };

  app.listeners = function (event: string) {
    return _emitter.listeners(event);
  };
}

export function defineEnvs(
  env: Record<string, any>,
  prefix = ""
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => {
      return [`${prefix}${key}`, JSON.stringify(value)];
    })
  );
}
