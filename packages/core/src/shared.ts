import type { IncomingMessage, ServerResponse } from "http"
import { parseUrl } from "query-string"

import { version as FOURZE_VERSION } from "../package.json"

export { FOURZE_VERSION }

const FOURZE_ROUTE_SYMBOL = Symbol("FourzeRoute")
const FOURZE_INTERCEPTOR_SYMBOL = Symbol("FourzeInterceptor")

export interface FourzeRequest extends IncomingMessage {
    url: string
    method?: string
    route: FourzeRoute
    relativePath: string
    query: Record<string, any>
    params: Record<string, any>
    body: Record<string, any>
    /**
     *  {...query, ...params, ...body}
     */
    data: Record<string, any>
    headers: Record<string, string | string[] | undefined>
}

export interface FourzeBaseResponse extends ServerResponse {
    result: any
    headers: Record<string, string | string[] | undefined>
    matched?: boolean
}
export interface FourzeResponse extends FourzeBaseResponse {
    json(data?: any): void
    image(data?: any): void
    text(data?: string): void
    binary(data?: any): void
    redirect(url: string): void
}

export interface FourzeBaseRoute {
    path: string
    base?: string
    method?: RequestMethod
    handle: FourzeHandle
}

export interface FourzeRoute extends FourzeBaseRoute {
    [FOURZE_ROUTE_SYMBOL]: true
    pathRegex: RegExp
    pathParams: RegExpMatchArray
    dispatch: FourzeDispatch
    match: (url: string, method?: string) => boolean
}

export type FourzeHandle<R = any> = (request: FourzeRequest, response: FourzeResponse) => R | Promise<R>

export type FourzeDispatch = (request: FourzeRequest, response: FourzeResponse, next?: () => void | Promise<void>) => void | Promise<void>

export const FOURZE_METHODS: RequestMethod[] = ["get", "post", "delete", "put", "patch", "options", "head", "trace", "connect"]

export type RequestMethod = "get" | "post" | "delete" | "put" | "patch" | "head" | "options" | "trace" | "connect"

export function isRoute(route: any): route is FourzeRoute {
    return !!route && !!route[FOURZE_ROUTE_SYMBOL]
}

const REQUEST_PATH_REGEX = new RegExp(`^(${FOURZE_METHODS.join("|")}):.*`, "i")

const PARAM_KEY_REGEX = /(\:[\w_-]+)|(\{[\w_-]+\})/g

const NOT_NEED_BASE = /^((https?|file):)?\/\//gi

export function defineRoute(route: FourzeBaseRoute): FourzeRoute {
    let { handle, method, path, base } = route

    if (!method && REQUEST_PATH_REGEX.test(route.path)) {
        const index = route.path.indexOf(":")
        method = route.path.slice(0, index) as RequestMethod
        path = path.slice(index + 1).trim()
    }

    if (!NOT_NEED_BASE.test(path)) {
        path = (base ?? "/").concat(path)
    } else {
        base = path.match(NOT_NEED_BASE)?.[0] ?? "//"
    }

    path = path.replace(/^\/+/, "/")

    const pathRegex = new RegExp(`^${path.replace(PARAM_KEY_REGEX, "([a-zA-Z0-9_-\\s]+)?")}`.concat("(.*)([?&#].*)?$"), "i")

    const pathParams = path.match(PARAM_KEY_REGEX) || []

    async function dispatch(this: FourzeRoute, request: FourzeRequest, response: FourzeResponse, next?: () => void | Promise<void>) {
        if (!method || !request.method || request.method.toLowerCase() === method.toLowerCase()) {
            const { url } = request

            const matches = url.match(pathRegex)

            if (matches) {
                const params: Record<string, any> = {}
                for (let i = 0; i < pathParams.length; i++) {
                    const key = pathParams[i].replace(/^[\:\{]/g, "").replace(/\}$/g, "")
                    const value = matches[i + 1]
                    params[key] = value
                }
                request.route = this
                request.query = parseUrl(url, {
                    parseNumbers: true,
                    parseBooleans: true
                }).query

                if (matches.length > pathParams.length) {
                    request.relativePath = matches[matches.length - 2]
                }
                request.params = params
                request.data = {
                    ...request.body,
                    ...request.query,
                    ...request.params
                }

                const result = await handle(request, response)
                response.result = result ?? response.result
                response.matched = true
                if (!response.writableEnded && !response.hasHeader("Content-Type")) {
                    response.json(response.result)
                }
                return
            }
        }
        await next?.()
    }

    function match(this: FourzeRoute, url: string, method?: string) {
        return (!route.method || !method || route.method.toLowerCase() === method.toLowerCase()) && this.pathRegex.test(url)
    }

    return {
        method,
        path,
        base,
        pathRegex,
        pathParams,
        handle,
        dispatch,
        match,
        get [FOURZE_ROUTE_SYMBOL](): true {
            return true
        }
    }
}

export type FourzeInterceptorHandler = (request: FourzeRequest, response: FourzeResponse, handle: FourzeHandle) => any | Promise<any>

export interface FourzeBaseInterceptor extends FourzeInterceptorHandler {
    base?: string
}

export interface FourzeInterceptor {
    handle: FourzeInterceptorHandler
    base?: string
    [FOURZE_INTERCEPTOR_SYMBOL]: true
}

export function defineInterceptor(base: string, interceptor: FourzeBaseInterceptor): FourzeInterceptor

export function defineInterceptor(interceptor: FourzeBaseInterceptor): FourzeInterceptor

export function defineInterceptor(interceptor: DefineFourzeInterceptor): FourzeInterceptor

export function defineInterceptor(param0: string | DefineFourzeInterceptor | FourzeBaseInterceptor, param1?: FourzeBaseInterceptor) {
    const base = typeof param0 === "string" ? param0 : param0.base

    const interceptor = {
        base,
        handle:
            param1 ?? typeof param0 === "string"
                ? param1
                : typeof param0 == "function"
                ? param0
                : async (request: FourzeRequest, response: FourzeResponse, handle: FourzeHandle) => {
                      await param0.before?.(request, response)
                      const result = await handle(request, response)
                      await param0.after?.(request, response)
                      return result
                  }
    } as FourzeInterceptor

    Object.defineProperty(interceptor, "base", {
        get() {
            return base
        }
    })

    Object.defineProperty(interceptor, FOURZE_INTERCEPTOR_SYMBOL, {
        get() {
            return true
        }
    })
    return interceptor
}

export type DefineFourzeInterceptor = {
    base?: string
    before?: FourzeHandle<void>
    handle?: FourzeHandle<any>
    after?: FourzeHandle<void>
}

export interface FourzeInstance {
    routes: FourzeRoute[]
    interceptors?: FourzeInterceptor[]
}

const FOURZE_RESPONSE_SYMBOL = Symbol("FourzeResponse")

export function createResponse(res?: FourzeBaseResponse) {
    const response = (res ?? {
        headers: {},
        writableEnded: false,
        matched: false,
        setHeader(name: string, value: string) {
            if (this.hasHeader(name)) {
                this.headers[name] += `,${value}`
            } else {
                this.headers[name] = value
            }
        },
        getHeader(name: string) {
            return this.headers[name]
        },
        getHeaderNames() {
            return Object.keys(this.headers)
        },
        hasHeader(name) {
            return !!this.headers[name]
        },
        end(data: any) {
            this.result = data
        }
    }) as FourzeResponse

    response.json = function (data: any) {
        data = typeof data == "string" ? data : JSON.stringify(data)
        this.result = data
        this.setHeader("Content-Type", "application/json")
    }

    response.binary = function (data: any) {
        this.result = data
        this.setHeader("Content-Type", "application/octet-stream")
    }

    response.image = function (data: any) {
        this.result = data
        this.setHeader("Content-Type", "image/jpeg")
    }

    response.text = function (data: string) {
        this.result = data
        this.setHeader("Content-Type", "text/plain")
        this.end(data)
    }

    response.redirect = function (url: string) {
        this.statusCode = 302
        this.setHeader("Location", url)
    }

    response.setHeader("X-Powered-By", `Fourze Server/v${FOURZE_VERSION}`)

    Object.defineProperty(response, FOURZE_RESPONSE_SYMBOL, {
        get() {
            return true
        }
    })

    return response
}

const FOURZE_REQUEST_SYMBOL = Symbol("FourzeRequest")

export function createRequest(options: Partial<FourzeRequest>) {
    if (typeof options.body === "string") {
        options.body = JSON.parse(options.body)
    }

    return {
        relativePath: options.url,
        query: {},
        body: {},
        params: {},
        data: {},
        headers: {},
        ...options,
        get [FOURZE_REQUEST_SYMBOL]() {
            return true
        }
    } as FourzeRequest
}

export function isFourzeResponse(obj: any): obj is FourzeResponse {
    return !!obj && !!obj[FOURZE_RESPONSE_SYMBOL]
}

export function isFourzeRequest(obj: any): obj is FourzeRequest {
    return !!obj && !!obj[FOURZE_REQUEST_SYMBOL]
}

export function isFourzeInterceptor(interceptor: any): interceptor is FourzeInterceptor {
    return !!interceptor && !!interceptor[FOURZE_INTERCEPTOR_SYMBOL]
}
