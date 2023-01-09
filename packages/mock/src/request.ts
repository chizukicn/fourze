import type {
  ClientRequest,
  ClientRequestArgs,
  IncomingMessage,
  RequestOptions
} from "http";
import type http from "http";
import type https from "https";
import {
  createLogger,
  flatHeaders,
  getHeaderValue,
  isBuffer,
  isFunction,
  isString,
  isURL,
  normalizeRoute
} from "@fourze/core";
import type { FourzeLogger, FourzeResponse } from "@fourze/core";
import type { FourzeMockRouter } from "./shared";

type RequestCallback = (res: IncomingMessage) => void;

type WriteCallback = (error?: Error | null) => void;

interface ProxyRequestOptions extends ClientRequestArgs {
  nativeProtocols?: Record<string, typeof http | typeof https>
  nativeRequest?: typeof http.request | typeof https.request
  agents?: Record<string, http.Agent | https.Agent>
  logger?: FourzeLogger
}

function optionsToURL(options: RequestOptions): URL {
  const protocol = options.protocol ?? "http:";
  const hostname = options.hostname ?? "localhost";
  const path = options.path ?? "/";
  const url = new URL(`${protocol}//${hostname}${path}`);
  if (options.port) {
    url.port = options.port.toString();
  }
  return url;
}

export function createProxyRequest(router: FourzeMockRouter) {
  const originHttpRequest = router.originalHttpRequest;
  const originHttpsRequest = router.originalHttpsRequest;
  const logger = createLogger("@fourze/mock");

  if (!originHttpRequest || !originHttpsRequest) {
    logger.warn("request is not defined");
    return;
  }

  const { Writable, Readable } = require("stream") as typeof import("stream");

  class ProxyClientResponse extends Readable {
    headers: IncomingMessage["headers"];

    method?: string;
    statusCode = 200;
    completed = false;
    data: Buffer | Uint8Array | string;
    _offset = 0;
    _maxLength = 0;

    get rawHeaders() {
      return Object.entries(this.headers).flatMap(([key, value]) => [
        key,
        value
      ]);
    }

    constructor(res: FourzeResponse) {
      super();
      this.headers = flatHeaders(res.getHeaders());
      this.method = res.method;
      this.statusCode = res.statusCode;
      this.data = res.data ?? [];
      this._maxLength = this.data.length;
    }

    read(size = 1024) {
      if (this.completed) {
        return null;
      }
      if (this._offset >= this._maxLength) {
        this.completed = true;
        this.emit("end");
        return null;
      }
      const start = this._offset;
      const end = (this._offset = Math.min(this._maxLength, start + size));
      const chunk = this.data.slice(start, end);
      this.emit("data", Buffer.from(chunk));
      return chunk;
    }
  }

  class ProxyClientRequest extends Writable {
    aborted = false;

    _ending: boolean;
    _ended: boolean;
    _options: ProxyRequestOptions;

    _requestHeaders: Record<string, string>;

    readonly method: string;

    _url: string;

    _timeout: number;

    buffer: Buffer;

    get timeout() {
      return this._timeout;
    }

    constructor(options: ProxyRequestOptions, callback?: RequestCallback) {
      super({});
      this._ending = false;
      this._ended = false;
      this._options = options;
      this._requestHeaders = flatHeaders(options.headers);
      this.method = options.method ?? "GET";
      this._url = optionsToURL(options).toString();
      this.buffer = Buffer.alloc(0);
      this._timeout = options.timeout ?? 0;

      if (callback) {
        this.on("response", callback);
      }
    }

    setTimeout(timeout: number) {
      this._timeout = timeout;
    }

    async _mockRequest() {
      const { response } = await router.service({
        url: this._url,
        method: this.method,
        headers: this._requestHeaders,
        body: this.buffer.toString("utf-8")
      });
      if (response.matched) {
        const res = new ProxyClientResponse(response);
        this.emit("response", res);
        logger.success(
          `Found route by ${normalizeRoute(this._url, this.method)}.`
        );
      } else {
        logger.debug(
          `Not found route, fallback to original ${normalizeRoute(
            this._url,
            this.method
          )}.`
        );
        this._nativeRequest();
      }
    }

    async _nativeRequest() {
      const protocol = this._options.protocol ?? "http:";
      const nativeRequest = this._options.nativeRequest;
      if (nativeRequest) {
        const req = nativeRequest(this._options, (res) => {
          this.emit("response", res);
        });
        req.end();
      } else {
        throw new Error(`Unsupported protocol: ${protocol}`);
      }
    }

    async _performRequest() {
      const method = this._options.method;
      const headers = flatHeaders(this._options.headers);
      const useMock = getHeaderValue(headers, "X-Fourze-Mock");
      if (useMock === "off") {
        logger.debug(
          `X-Fourze-Mock is off, fallback to original [${method}] -> "${this._url}"`
        );
        this._nativeRequest();
      } else {
        this._mockRequest();
      }
    }

    write(
      chunk: string,
      encoding?: BufferEncoding,
      callback?: WriteCallback
    ): boolean;

    write(
      chunk: Uint8Array | string,
      callback?: (error?: Error | null) => void
    ): boolean;

    write(
      chunk: Uint8Array | string,
      enc?: BufferEncoding | WriteCallback,
      cb?: WriteCallback
    ): boolean {
      const isCallback = isFunction(enc);
      const callback = isCallback ? enc : cb;
      const encoding = (isCallback ? undefined : enc) ?? "utf-8";
      if (this._ending) {
        throw new Error("write after end");
      }

      if (isString(chunk)) {
        this.buffer.write(chunk, encoding);
      } else if (isBuffer(chunk)) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
      } else {
        throw new TypeError("CHUNK should be a string, Buffer or Uint8Array");
      }

      if (chunk.length === 0) {
        if (callback) {
          callback();
        }
        return false;
      }

      callback?.(null);
      return false;
    }

    end(callback: WriteCallback): this;

    end(chunk?: any, encoding?: BufferEncoding, callback?: WriteCallback): this;

    end(chunk?: any, callback?: WriteCallback): this;

    end(
      chunk?: any | WriteCallback,
      encoding?: BufferEncoding | WriteCallback,
      callback?: WriteCallback
    ): this {
      if (isFunction(chunk)) {
        callback = chunk;
        chunk = encoding = undefined;
      } else if (isFunction(encoding)) {
        callback = encoding;
        encoding = undefined;
      }
      if (!chunk) {
        this._ended = this._ending = true;
        this._performRequest();
      } else {
        this.write(chunk, encoding, (err) => {
          this._performRequest();
          this._ended = true;
          callback?.(err);
        });
        this._ending = true;
      }
      return this;
    }

    abort() {
      this.aborted = true;
    }
  }

  return function (
    param0: URL | string | ProxyRequestOptions,
    param1?: ProxyRequestOptions | RequestCallback,
    param2?: RequestCallback
  ) {
    const isStr = isString(param0);
    const isUrl = isURL(param0);

    const isOptions = !isStr && !isUrl;

    const isFunc = isFunction(param1);

    const options = (isOptions ? param0 : isFunc ? undefined : param1) ?? {};

    const u = isStr ? new URL(param0) : isUrl ? param0 : optionsToURL(param0);

    options.protocol = u.protocol;
    options.hostname = u.hostname;
    options.port = u.port;
    options.path = u.pathname + u.search;
    options.nativeRequest
      = u.protocol === "https:" ? originHttpsRequest : originHttpRequest;
    const callback = isFunc ? param1 : param2;

    return new ProxyClientRequest(
      options,
      callback
    ) as unknown as ClientRequest;
  };
}
