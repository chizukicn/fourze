import type { MaybePromise, MaybeRegex } from "maybe-types";
import { delay, isMatch, overload } from "../utils";
import type { FourzeMiddleware, PropType } from "../shared";
import { defineMiddleware } from "../shared";
import type { DelayMsType } from "../utils";

export const DELAY_HEADER = "Fourze-Delay";

export const DISABLE_JSON_WRAPPER_HEADER = "Fourze-Disable-Json-Wrapper";

export function delayHook(ms: DelayMsType): FourzeMiddleware {
  return defineMiddleware("Delay", async (req, res, next) => {
    await next?.();
    const delayMs
      = res.getHeader(DELAY_HEADER) ?? req.headers[DELAY_HEADER] ?? ms;
    const time = await delay(delayMs);
    res.setHeader(DELAY_HEADER, time);
  });
}

export type JsonWrapperResolveFunction = (data: any) => MaybePromise<any>;

export interface JsonWrapperOptions {
  resolve: JsonWrapperResolveFunction
  reject?: JsonWrapperResolveFunction
  includes?: MaybeRegex[]
  excludes?: MaybeRegex[]
}

export function jsonWrapperHook(options: JsonWrapperOptions): FourzeMiddleware;

export function jsonWrapperHook(
  resolve: (data: any) => MaybePromise<any>,
  reject?: (error: any) => MaybePromise<any>
): FourzeMiddleware;

export function jsonWrapperHook(
  ...args: [JsonWrapperOptions] | [JsonWrapperResolveFunction, JsonWrapperResolveFunction?]
): FourzeMiddleware {
  const excludes: MaybeRegex[] = [];
  const includes: MaybeRegex[] = [];

  const { resolve: argResolve, reject: argReject, options } = overload({
    resolve: {
      type: Function as PropType<JsonWrapperResolveFunction>
    },
    reject: {
      type: Function as PropType<JsonWrapperResolveFunction>
    },
    options: {
      type: Object as PropType<JsonWrapperOptions>
    }
  }, args);

  const resolve = options?.resolve ?? argResolve;
  const reject = options?.reject ?? argReject;

  if (options?.excludes?.length) {
    excludes.push(...options.excludes);
  }
  if (options?.includes?.length) {
    includes.push(...options.includes);
  }

  if (!resolve) {
    throw new Error("Missing resolve function");
  }

  function isExclude(path: string) {
    if (includes.length) {
      return !isMatch(path, ...includes);
    }
    if (excludes.length) {
      return isMatch(path, ...excludes);
    }
    return false;
  }

  return defineMiddleware("JsonWrapper", -1, async (req, res, next) => {
    const disableJsonWrapper = res.getHeader(DISABLE_JSON_WRAPPER_HEADER) as string;
    const isAllow = (!disableJsonWrapper || ["false", "0", "off"].includes(disableJsonWrapper)) && !isExclude(req.path);

    if (isAllow) {
      const _send = res.send.bind(res);
      res.send = function (payload, contentType) {
        contentType = contentType ?? req.meta.contentType ?? res.getContentType(payload);
        if (contentType?.startsWith("application/json")) {
          payload = resolve(payload) ?? payload;
        }
        _send(payload, contentType);
        return res;
      };

      if (reject) {
        const _sendError = res.sendError.bind(res);
        res.sendError = function (code, message) {
          _sendError(code, message);
          _send(reject(message), "application/json");
          return this;
        };
      }
    }

    await next();
  });
}

