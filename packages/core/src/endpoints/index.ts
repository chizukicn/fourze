import type { MaybePromise } from "maybe-types";
import { getHeaderRawValue } from "../polyfill";
import { defineFourzeHook } from "../shared";
import type { DelayMsType } from "../utils";
import { delay, isBuffer, isObject } from "../utils";

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
  return defineFourzeHook(async (req, res, next) => {
    const _send = res.send.bind(res);

    let catchError = false;

    res.send = function (data) {
      if (catchError) {
        return _send(data);
      }
      _send(data);
      const contentType = getHeaderRawValue(res.getHeader("Content-Type"));
      if (
        (!isBuffer(data) && isObject(data))
        || contentType?.startsWith("application/json")
      ) {
        data = resolve(data);
      }
      return _send(data);
    };

    try {
      await next?.();
    } catch (error) {
      if (reject) {
        const rs = reject(error);
        catchError = true;
        return rs;
      } else {
        throw error;
      }
    }
  });
}
