import EventEmitter from "node:events";
import { getHeaderRawValue } from "./header";

export class PolyfillServerResponse extends EventEmitter {
  headers: Record<string, string>;
  _ended: boolean;
  matched: boolean;
  statusCode: number;

  constructor() {
    super();
    this.headers = {};
    this._ended = false;
    this.matched = false;
    this.statusCode = 200;
  }

  get writableEnded() {
    return this._ended;
  }

  end(cb?: () => void): this;
  end(chunk: any, cb?: () => void): this;
  end(chunk: any, encoding: BufferEncoding, cb?: () => void): this;
  end(
    chunk?: any,
    encoding?: BufferEncoding | (() => void),
    cb?: () => void
  ) {
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = undefined;
    }
    if (cb) {
      cb();
    }
    this._ended = true;
    this.emit("finish");
    return this;
  }

  getHeaders() {
    return this.headers;
  }

  getHeaderNames() {
    return Object.keys(this.headers);
  }

  hasHeader(name: string, value?: string | number) {
    if (value) {
      const v = this.headers[name];
      const arr = Array.isArray(v) ? v : v?.split(",") ?? [];
      return arr.includes(String(value));
    }
    return !!this.headers[name];
  }

  getHeader(name: string) {
    const value = this.headers[name];
    return getHeaderRawValue(value);
  }

  setHeader(name: string, value: string | ReadonlyArray<string> | number) {
    if (Array.isArray(value)) {
      value = value.join(",");
    }
    this.headers[name] = value ? String(value) : "";
    return this;
  }

  removeHeader(name: string) {
    delete this.headers[name];
    return this;
  }
}
