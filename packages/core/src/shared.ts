import type { IncomingMessage, OutgoingMessage, ServerResponse } from "http"

import { version as FOURZE_VERSION } from "../package.json"

export { FOURZE_VERSION }

const FOURZE_ROUTE_SYMBOL = Symbol("FourzeRoute")
const FOURZE_HOOK_SYMBOL = Symbol("FourzeInterceptor")

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
        match,
        get [FOURZE_ROUTE_SYMBOL](): true {
            return true
        }
    }
}

export type FourzeHookHandler = (request: FourzeRequest, response: FourzeResponse, handle: FourzeHandle) => any | Promise<any>

export interface FourzeBaseHook extends FourzeHookHandler {
    base?: string
}

export interface FourzeHook {
    handle: FourzeHookHandler
    base?: string
    [FOURZE_HOOK_SYMBOL]: true
}

export function defineFourzeHook(base: string, interceptor: FourzeBaseHook): FourzeHook

export function defineFourzeHook(interceptor: FourzeBaseHook): FourzeHook

export function defineFourzeHook(interceptor: DefineFourzeHook): FourzeHook

export function defineFourzeHook(param0: string | DefineFourzeHook | FourzeBaseHook, param1?: FourzeBaseHook) {
    const base = typeof param0 === "string" ? param0 : param0.base

    const hook = {
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
    } as FourzeHook

    Object.defineProperty(hook, "base", {
        get() {
            return base
        }
    })

    Object.defineProperty(hook, FOURZE_HOOK_SYMBOL, {
        get() {
            return true
        }
    })
    return hook
}

export type DefineFourzeHook = {
    base?: string
    before?: FourzeHandle<void>
    handle?: FourzeHandle<any>
    after?: FourzeHandle<void>
}

export interface FourzeInstance {
    routes: FourzeRoute[]
    hooks: FourzeHook[]
}

export interface CommonMiddleware {
    (req: IncomingMessage, res: OutgoingMessage, next?: () => void | Promise<void>): void | Promise<void>
}

export interface FourzeMiddleware {
    (req: FourzeRequest, res: FourzeResponse, next?: () => void | Promise<void>): void | Promise<void>
    name?: string
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

export function isFourzeHook(hook: any): hook is FourzeHook {
    return !!hook && !!hook[FOURZE_HOOK_SYMBOL]
}
