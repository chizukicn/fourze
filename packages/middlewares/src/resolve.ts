import type { MaybePromise, MaybeRegex } from "maybe-types";
import type { FourzeMiddleware, PropType } from "@fourze/core";
import { defineMiddleware, isError, isMatch, isUndef, overload } from "@fourze/core";

type ResolveFunction = (data: any, contentType?: string | null) => MaybePromise<any>;

type RejectFunction = (error: any) => MaybePromise<any>;

export const RESOLVE_HEADER = "Fourze-Response-Resolve";

export interface ResolveHookOptions {
  resolve: ResolveFunction
  reject?: RejectFunction
  includes?: MaybeRegex[]
  excludes?: MaybeRegex[]
}

export function createResolveMiddleware(options: ResolveHookOptions): FourzeMiddleware;

export function createResolveMiddleware(
  resolve: ResolveFunction,
  reject?: RejectFunction
): FourzeMiddleware;

export function createResolveMiddleware(
  ...args: [ResolveHookOptions] | [ResolveFunction, RejectFunction?]
): FourzeMiddleware {
  const excludes: MaybeRegex[] = [];
  const includes: MaybeRegex[] = [];

  const { resolve: argResolve, reject: argReject, options } = overload({
    resolve: {
      type: Function as PropType<ResolveFunction>
    },
    reject: {
      type: Function as PropType<RejectFunction>
    },
    options: {
      type: Object as PropType<ResolveHookOptions>
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

  return defineMiddleware("Response-Resolve", -1, async (req, res, next) => {
    const _send = res.send.bind(res);
    res.send = function (payload, contentType) {
      contentType = contentType ?? req.meta.contentType ?? res.getContentType(payload);
      const useResolve = res.getHeader(RESOLVE_HEADER) as string;
      const isAllow = (isUndef(useResolve) || !["false", "0", "off"].includes(useResolve)) && !isExclude(req.path);

      if (isAllow) {
        if (isError(payload) && reject) {
          payload = reject(payload) ?? payload;
        } else {
          payload = resolve(payload, contentType) ?? payload;
        }
      }

      _send(payload, contentType);
      return res;
    };

    await next();
  });
}

