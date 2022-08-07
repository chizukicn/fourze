import type { FourzeHandle, FourzeRequest, FourzeResponse } from "./shared"

const FOURZE_INTERCEPTOR_SYMBOL = Symbol("FourzeInterceptor")

export function defineInterceptor(around: DefineFourzeInterceptor | AroundInterceptor) {
    const interceptor =
        typeof around === "function"
            ? around
            : async (request: FourzeRequest, response: FourzeResponse, handle: FourzeHandle) => {
                  await around.before?.(request, response)
                  const result = await handle(request, response)
                  await around.after?.(request, response)
                  return result
              }
    Object.defineProperty(interceptor, FOURZE_INTERCEPTOR_SYMBOL, {
        get() {
            return true
        }
    })
    return interceptor
}

export interface DefineFourzeInterceptor {
    before?: FourzeHandle<void>

    after?: FourzeHandle<void>
}

export type AroundInterceptor = (request: FourzeRequest, response: FourzeResponse, handle: FourzeHandle) => any | Promise<any>

export interface FourzeInterceptor extends AroundInterceptor {
    [FOURZE_INTERCEPTOR_SYMBOL]: true
}

export function isInterceptor(interceptor: any): interceptor is FourzeInterceptor {
    return !!interceptor && !!interceptor[FOURZE_INTERCEPTOR_SYMBOL]
}
