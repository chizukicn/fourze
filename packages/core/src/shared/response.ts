import type { OutgoingMessage, ServerResponse } from "node:http";
import { safeParse } from "fast-content-type-parse";
import { PolyfillServerResponse, getHeaderValue } from "../polyfill";
import { assert, defineOverload, isDef, isNumber, isObject, isString, isUint8Array, isUndefined } from "../utils";
import { FourzeError } from "./error";
import type { FourzeRequest } from "./request";

export interface FourzeResponseOptions {
  url: string
  method: string
  request: FourzeRequest
  response?: OutgoingMessage
}

const FourzeResponseFlag = "__isFourzeResponse";

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

  send(payload: any, statusCode?: number): this

  send(payload: any, statusCode?: number, contentType?: string | null): this
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

  sent: boolean

  readonly res?: OutgoingMessage

  readonly request: FourzeRequest

  readonly url: string

  readonly payload: any

  readonly error: FourzeError | undefined

  readonly [FourzeResponseFlag]: true
}

export function createResponse(options: FourzeResponseOptions) {
  const res = options?.response;
  const response = (res ?? (new PolyfillServerResponse())) as FourzeResponse;

  let _payload: any;
  let _error: FourzeError;

  response.setContentType = function (contentType) {
    if (!response.headersSent) {
      response.setHeader("Content-Type", contentType);
    }
    return this;
  };

  response.getContentType = function (data) {
    let contentType = getHeaderValue(this.getHeaders(), "Content-Type");
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

  const overloadSend = defineOverload({
    statusCode: {
      type: Number
    },
    contentType: {
      type: String
    }
  });

  response.send = function (payload, ...args: any[]) {
    response.sent = true;

    let { statusCode, contentType } = overloadSend(args);

    if (isNumber(args[0])) {
      statusCode = args[0];
      contentType = args[1];
    } else if (isString(args[0])) {
      contentType = args[0];
    }

    statusCode ??= this.statusCode ?? 200;
    contentType ??= this.getContentType(payload);

    const normalizedContentType = contentType ? safeParse(contentType) : undefined;
    switch (normalizedContentType?.type) {
      case "application/json":
        payload = JSON.stringify(payload);
        break;
      case "text/plain":
      case "text/html":
        payload = payload?.toString();
        break;
      default:
        break;
    }
    if (contentType) {
      this.setContentType(contentType);
    }
    if (!isUndefined(payload)) {
      _payload = payload;
    }
    return this.status(statusCode).end(_payload);
  };

  response.status = function (code) {
    this.statusCode = code;
    return this;
  };

  response.sendError = function (...args: any[]) {
    _error = new FourzeError(...args);
    return this.send(_error.baseError, _error.statusCode);
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
    return this.setHeader("Location", url)
      .status(302)
      .end();
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

  let _sent = false;

  Object.defineProperties(response, {
    [FourzeResponseFlag]: {
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
    },
    sent: {
      get() {
        return _sent;
      },
      set(val) {
        assert(val || !this.writableEnded, "response has been sent");
        _sent = val;
      },
      enumerable: true
    }
  });

  return response;
}

export function isFourzeResponse(obj: any): obj is FourzeResponse {
  return !!obj && !!obj[FourzeResponseFlag];
}
