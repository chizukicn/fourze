import type { OutgoingMessage, ServerResponse } from "http";
import { createLogger } from "../logger";
import { PolyfillServerResponse, getHeaderValue } from "../polyfill";
import { isDef, isObject, isString, isUint8Array } from "../utils";
import { FourzeError } from "./error";
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

  /**
   * 发送数据
   * @param payload
   * @param contentType
   */
  send(payload: any, contentType?: string | null): this

  /**
   * 获取Content-Type
   * @param payload 如果没有指定contentType，则会根据payload的类型自动推断
   */
  getContentType(payload?: any): string | undefined

  /**
   * 设置Content-Type
   * @param contentType
   */
  setContentType(contentType: string): this

  status(code: number): this

  /**
   * 发送错误
   * @param code
   * @param error
   */
  sendError(code: number, error?: string | Error): this

  /**
   * 发送错误
   * @param error
   */
  sendError(error?: string | Error): this

  /**
   *  等待所有的异步操作完成
   */
  done(): Promise<void>

  readonly res?: OutgoingMessage

  readonly request: FourzeRequest

  readonly url: string

  readonly payload: any

  readonly error: FourzeError | undefined

  readonly [FOURZE_RESPONSE_SYMBOL]: true
}

export function createResponse(options: FourzeResponseOptions) {
  const res = options?.response;
  const response = (res ?? (new PolyfillServerResponse())) as FourzeResponse;
  const logger = createLogger("@fourze/core");

  let _payload: any;
  let _error: FourzeError;

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

  response.status = function (code) {
    this.statusCode = code;
    return this;
  };

  response.sendError = function (...args: any[]) {
    _error = new FourzeError(...args);
    this.statusCode = _error.statusCode;
    logger.error(_error);
    return this.send(_error);
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
    this.end();
    return this;
  };

  response.done = function () {
    return new Promise((resolve) => {
      if (this.writableEnded) {
        resolve();
        return;
      }
      this.on("finish", () => {
        resolve();
      });
    });
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
