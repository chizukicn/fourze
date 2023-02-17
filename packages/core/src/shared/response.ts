import type { OutgoingMessage, ServerResponse } from "http";
import { createLogger } from "../logger";
import { PolyfillServerResponse, getHeaderValue } from "../polyfill";
import { isDef, isObject, isString, isUint8Array } from "../utils";
import type { FourzeRequest } from "./request";

export interface FourzeResponseOptions {
  url: string
  method: string
  request: FourzeRequest
  response?: OutgoingMessage
}

const FOURZE_RESPONSE_SYMBOL = Symbol("FourzeResponse");

export interface FourzeBaseResponse extends ServerResponse {
}
export interface FourzeResponse extends FourzeBaseResponse {
  json(payload: any): this

  image(payload: Buffer): this

  text(payload: string): this

  binary(payload: Buffer): this

  redirect(url: string): this

  appendHeader(key: string, value: string | string[]): this

  removeHeader(key: string): this

  send(payload: any, contentType?: string | null): this

  getContentType(payload?: any): string | undefined

  setContentType(contentType: string): this

  sendError(code: number, error?: string | Error): this

  readonly res?: OutgoingMessage

  readonly request: FourzeRequest

  readonly url: string

  readonly payload: any

  readonly error: Error | undefined

  readonly [FOURZE_RESPONSE_SYMBOL]: true
}

export function createResponse(options: FourzeResponseOptions) {
  const res = options?.response;
  const response = (res ?? (new PolyfillServerResponse())) as FourzeResponse;
  const logger = createLogger("@fourze/core");

  let _payload: any;
  let _error: Error;

  response.setContentType = function (contentType) {
    if (!response.headersSent) {
      response.setHeader("Content-Type", contentType);
    }
    return this;
  };

  response.getContentType = function (data) {
    let contentType: string = getHeaderValue(this.getHeaders(), "Content-Type");
    if (!contentType && isDef(data)) {
      if (isUint8Array(data)) {
        contentType = "application/octet-stream";
      } else if (isObject(data)) {
        contentType = "application/json";
      } else if (isString(data)) {
        contentType = "text/plain";
      }
    }
    return contentType;
  };

  response.send = function (payload: any, contentType?: string) {
    contentType = contentType ?? this.getContentType(payload);
    switch (contentType) {
      case "application/json":
        payload = JSON.stringify(payload);
        break;
      case "text/plain":
      case "text/html":
        payload = payload.toString();
        break;
      default:
        break;
    }
    if (contentType) {
      response.setContentType(contentType);
    }
    _payload = payload;
    this.end(_payload);
    return this;
  };

  response.sendError = function (code = 500, error: Error | string) {
    _error = isString(error) ? new Error(error) : error;
    this.statusCode = code;
    logger.error(error);
    return this;
  };

  response.appendHeader = function (
    name: string,
    value: string | ReadonlyArray<string> | number
  ) {
    const oldValue = this.getHeader(name);
    if (isDef(oldValue)) {
      this.setHeader(
        name,
        [oldValue, value]
          .flat()
          .filter((r) => !!r)
          .join(",")
      );
    } else {
      this.setHeader(name, value);
    }
    return this;
  };

  response.json = function (payload: any) {
    return this.send(payload, "application/json");
  };

  response.binary = function (payload: Buffer) {
    return this.send(payload, "application/octet-stream");
  };

  response.image = function (payload: Buffer) {
    return this.send(payload, "image/jpeg");
  };

  response.text = function (payload: string) {
    return this.send(payload, "text/plain");
  };

  response.redirect = function (url: string) {
    this.statusCode = 302;
    this.setHeader("Location", url);
    return this;
  };

  Object.defineProperties(response, {
    [FOURZE_RESPONSE_SYMBOL]: {
      get() {
        return true;
      },
      enumerable: true
    },
    request: {
      get() {
        return options.request;
      },
      enumerable: true
    },
    res: {
      get() {
        return res;
      }
    },
    url: {
      get() {
        return options.url;
      },
      enumerable: true
    },
    payload: {
      get() {
        return _payload;
      },
      enumerable: true
    },
    error: {
      get() {
        return _error;
      },
      enumerable: true
    },

    method: {
      get() {
        return options.method;
      },
      enumerable: true
    }
  });

  return response;
}

export function isFourzeResponse(obj: any): obj is FourzeResponse {
  return !!obj && !!obj[FOURZE_RESPONSE_SYMBOL];
}
