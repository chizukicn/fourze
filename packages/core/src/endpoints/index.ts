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
  return defineFourzeHook(async (req, res, next) => {
    let catchError = false;
    const _send = res.send.bind(res);

    res.send = function (data, contentType) {
      if (catchError) {
        return _send(data, contentType);
      }
      contentType = contentType ?? res.getContentType(data);
      if (contentType?.startsWith("application/json")) {
        data = resolve(data);
      }
      return _send(data, contentType);
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
