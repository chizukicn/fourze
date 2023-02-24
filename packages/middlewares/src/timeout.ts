import type { FourzeMiddleware } from "@fourze/core";
import { defineMiddleware } from "@fourze/core";

export function createTimeoutMiddleware(timeout = 5000): FourzeMiddleware {
  return defineMiddleware("Timeout", -1, async (req, res, next) => {
    const timer = setTimeout(() => {
      res.sendError(408, `Request Timeout for ${req.url} with ${timeout}ms.`);
    }, timeout);

    try {
      await next();
    } finally {
      await res.done();
      clearTimeout(timer);
    }
  });
}
