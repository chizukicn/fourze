// eslint-disable-next-line unicorn/prefer-node-protocol
import { EventEmitter } from "events";

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
