import type { FourzeMiddleware } from "@fourze/core";
import type { MaybePromise } from "maybe-types";
import type { DelayMsType } from "../utils";
import { delay } from "../utils";

export function delayHook(ms: DelayMsType): FourzeMiddleware {
  return async (req, res, next) => {
    await next?.();
    const delayMs
      = res.getHeader("Fourze-Delay") ?? req.headers["Fourze-Delay"] ?? ms;
    const time = await delay(delayMs);
    res.setHeader("Fourze-Delay", time);
  };
}

export function jsonWrapperHook(
  resolve: (data: any) => MaybePromise<any>,
  reject?: (error: any) => MaybePromise<any>
): FourzeMiddleware {
  const JSON_WRAPPER_MARK = Symbol("JSON_WRAPPER_MARK");
  function hasMark(value: any) {
    return value && value[JSON_WRAPPER_MARK];
  }

  function mark(value: any) {
    Object.defineProperty(value, JSON_WRAPPER_MARK, {
      get() {
        return true;
      }
    });
  }

  return async (req, res, next) => {
    if (!hasMark(res)) {
      const _send = res.send.bind(res);

      res.send = function (payload, contentType) {
        contentType = contentType ?? res.getContentType(payload);
        if (contentType?.startsWith("application/json")) {
          payload = resolve(payload);
        }
        return _send(payload, contentType);
      };

      if (reject) {
        const _sendError = res.sendError.bind(res);
        res.sendError = function (code, message) {
          _sendError(code, message);
          _send(reject(message), "application/json");
          return this;
        };
      }
      mark(res);
    }
    await next();
  };
}
