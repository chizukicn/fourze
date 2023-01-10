import type { MaybePromise } from "maybe-types";
import { defineFourzeHook } from "../shared";
import type { DelayMsType } from "../utils";
import { delay } from "../utils";

export function delayHook(ms: DelayMsType) {
  return defineFourzeHook(async (req, res, next) => {
    await next?.();
    const delayMs
      = res.getHeader("Fourze-Delay") ?? req.headers["Fourze-Delay"] ?? ms;
    const time = await delay(delayMs);
    res.setHeader("Fourze-Delay", time);
  });
}

export function jsonWrapperHook(
  resolve: (data: any) => MaybePromise<any>,
  reject?: (error: any) => MaybePromise<any>
) {
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

  return defineFourzeHook(async (req, res) => {
    if (!hasMark(res)) {
      const _send = res.send.bind(res);

      res.send = function (data, contentType) {
        contentType = contentType ?? res.getContentType(data);
        if (contentType?.startsWith("application/json")) {
          data = resolve(data);
        }
        return _send(data, contentType);
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
  });
}
