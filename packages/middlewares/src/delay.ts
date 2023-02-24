import type { DelayMsType, FourzeMiddleware } from "@fourze/core";
import { defineMiddleware, delay } from "@fourze/core";

export const DELAY_HEADER = "Fourze-Delay";

export function createDelayMiddleware(ms: DelayMsType): FourzeMiddleware {
  return defineMiddleware("Delay", -1, async (req, res, next) => {
    const _send = res.send.bind(res);

    res.send = function (...args: any[]) {
      const delayMs = res.getHeader(DELAY_HEADER) ?? req.headers[DELAY_HEADER] ?? req.meta[DELAY_HEADER] ?? ms;
      delay(delayMs).then((ms) => {
        if (!res.writableEnded) {
          res.setHeader(DELAY_HEADER, ms);
          _send(...args as Parameters<typeof _send>);
        }
      });
      return res;
    };

    await next?.();
  });
}
