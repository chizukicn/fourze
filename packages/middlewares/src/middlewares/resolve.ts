import type { MaybePromise } from "maybe-types";
import type { FourzeMiddleware, PropType } from "@fourze/core";
import { assert, defineMiddleware, defineOverload, isError, isUndef, overload } from "@fourze/core";

type ResolveFunction = (data: any, contentType?: string | null) => MaybePromise<any>;

type RejectFunction = (error: any) => MaybePromise<any>;

export const RESOLVE_HEADER = "Fourze-Response-Resolve";

export interface ResolveHookOptions {
  resolve: ResolveFunction;
  reject?: RejectFunction;
}

export function createResolveMiddleware(options: ResolveHookOptions): FourzeMiddleware;

export function createResolveMiddleware(
  resolve: ResolveFunction,
  reject?: RejectFunction
): FourzeMiddleware;

export function createResolveMiddleware(
  ...args: [ResolveHookOptions] | [ResolveFunction, RejectFunction?]
): FourzeMiddleware {
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

  assert(!!resolve, "Missing resolve function");

  const overloadSend = defineOverload({
    statusCode: {
      type: Number
    },
    contentType: {
      type: String
    }
  });

  return defineMiddleware("Response-Resolve", -1, async (req, res, next) => {
    const _send = res.send.bind(res);
    res.send = function (payload, ...args: any[]) {
      let { statusCode, contentType } = overloadSend(args);

      statusCode ??= res.statusCode;
      contentType ??= res.getContentType(payload);

      const useResolve = res.getHeader(RESOLVE_HEADER) as string;
      const isAllow = (isUndef(useResolve) || !["false", "0", "off"].includes(useResolve));

      if (isAllow) {
        payload = isError(payload) && reject ? reject(payload) ?? payload : resolve(payload, contentType) ?? payload;
      }

      _send(payload, statusCode, contentType);
      return res;
    };

    await next();
  });
}
