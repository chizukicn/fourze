import type { IncomingMessage, OutgoingMessage, ServerResponse } from "http"
import type { MaybePromise } from "maybe-types"

import { version } from "../package.json"
import { flatHeaders } from "./polyfill/header"
import { parseFormdata as parseFormData, resolvePath } from "./utils"

export const FOURZE_VERSION = version

const FOURZE_ROUTE_SYMBOL = Symbol("FourzeRoute")
const FOURZE_HOOK_SYMBOL = Symbol("FourzeInterceptor")
const FOURZE_REQUEST_SYMBOL = Symbol("FourzeRequest")
const FOURZE_RESPONSE_SYMBOL = Symbol("FourzeResponse")

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

    meta: Record<string, any>

    headers: Record<string, string | string[] | undefined>

    readonly [FOURZE_REQUEST_SYMBOL]: true
}

export interface FourzeBaseResponse extends ServerResponse {
    result?: any
    method?: string
    matched?: boolean
}
export interface FourzeResponse extends FourzeBaseResponse {
    json(data?: any): void

    image(data?: any): void

    text(data?: string): void

    binary(data?: any): void

    redirect(url: string): void

    appendHeader(key: string, value: string | string[]): void

    removeHeader(key: string): void

    readonly url: string

    readonly [FOURZE_RESPONSE_SYMBOL]: true
}

export interface FourzeBaseRoute {
    path: string
    base?: string
    method?: RequestMethod
    handle: FourzeHandle
    meta?: Record<string, any>
}

export interface FourzeRoute extends FourzeBaseRoute {
    readonly [FOURZE_ROUTE_SYMBOL]: true
    readonly pathRegex: RegExp
    readonly pathParams: RegExpMatchArray
    readonly finalPath: string
    meta: Record<string, any>
    match: (url: string, method?: string, base?: string) => RegExpMatchArray | null
}

export type FourzeNext = (rs?: boolean) => MaybePromise<void>

export type FourzeHandle<R = any> = (request: FourzeRequest, response: FourzeResponse) => MaybePromise<R>

export const FOURZE_METHODS: RequestMethod[] = ["get", "post", "delete", "put", "patch", "options", "head", "trace", "connect"]

export type RequestMethod = "get" | "post" | "delete" | "put" | "patch" | "head" | "options" | "trace" | "connect"

export function isRoute(route: any): route is FourzeRoute {
    return !!route && !!route[FOURZE_ROUTE_SYMBOL]
}

const REQUEST_PATH_REGEX = new RegExp(`^(${FOURZE_METHODS.join("|")})\\s+`, "i")

const PARAM_KEY_REGEX = /\{[\w_-]+\}/g

export function defineRoute(route: FourzeBaseRoute): FourzeRoute {
    let { handle, method, path, base = "/", meta = {} } = route

    if (REQUEST_PATH_REGEX.test(path)) {
        const arr = path.split(/\s+/)
        const m = arr[0].toLowerCase() as RequestMethod
        if (FOURZE_METHODS.includes(m)) {
            method = m
            path = arr[1].trim()
        }
    }

    function getPathRegex(_path: string, _base: string) {
        const finalPath = resolvePath(_path, _base)
        return new RegExp(`^${finalPath.replace(PARAM_KEY_REGEX, "([a-zA-Z0-9_-\\s]+)?")}`.concat("(.*)([?&#].*)?$"), "i")
    }

    return {
        method,
        path,
        base,
        meta,
        handle,
        match(this: FourzeRoute, url: string, method?: string, _base?: string) {
            _base = _base ?? "/"
            if (!this.method || !method || this.method.toLowerCase() === method.toLowerCase()) {
                const regex = getPathRegex(resolvePath(path, base), _base)
                const match = url.match(regex)
                return match
            }
            return null
        },
        get finalPath() {
            return resolvePath(path, base)
        },
        get pathParams() {
            return this.finalPath.match(PARAM_KEY_REGEX) ?? []
        },
        get pathRegex() {
            return getPathRegex(path, base)
        },
        get [FOURZE_ROUTE_SYMBOL](): true {
            return true
        }
    }
}

export interface FourzeBaseHook extends FourzeMiddleware<any> {
    base?: string
}

export interface FourzeHook {
    handle: FourzeMiddleware<any>
    base?: string
    readonly [FOURZE_HOOK_SYMBOL]: true
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
    base?: string
    routes: FourzeRoute[]
    hooks: FourzeHook[]
}

export interface CommonMiddleware {
    (req: IncomingMessage, res: OutgoingMessage, next?: FourzeNext): MaybePromise<void>
}

export interface FourzeMiddleware<T = void> {
    (req: FourzeRequest, res: FourzeResponse, next?: FourzeNext): MaybePromise<T>
    name?: string
    setup?: () => MaybePromise<void>
}

export interface FourzeSetupContext {
    host: string
    origin: string
}

export interface FourzeResponseOptions {
    url: string
    method: string
    response?: OutgoingMessage
}

export function createResponse(options: FourzeResponseOptions) {
    const _headers: Record<string, string> = flatHeaders(options.response?.getHeaders() ?? {})

    const response = (options?.response ?? {
        headers: {},
        writableEnded: false,
        matched: false,
        statusCode: 200,

        end(data: any) {
            this.result = data
            this.statusCode = 200
        },

        getHeaders() {
            return _headers
        },

        getHeaderNames() {
            return Object.keys(_headers)
        },

        hasHeader(name: string, value?: string | number) {
            if (value) {
                const v = _headers[name]
                const arr = Array.isArray(v) ? v : v?.split(",") ?? []
                return arr.includes(String(value))
            }
            return !!_headers[name]
        },

        getHeader(name: string) {
            const value = _headers[name]
            return Array.isArray(value) ? value.join(",") : String(value)
        },

        setHeader(name: string, value: string | ReadonlyArray<string> | number) {
            if (Array.isArray(value)) {
                value = value.join(",")
            }
            _headers[name] = String(value)
            return this
        },
        removeHeader(name: string) {
            delete _headers[name]
            return this
        }
    }) as FourzeResponse

    response.appendHeader = function (name: string, value: string | ReadonlyArray<string> | number) {
        if (this.hasHeader(name)) {
            let oldValue = this.getHeader(name)!
            if (Array.isArray(oldValue)) {
                oldValue = oldValue.join(",")
            }
            if (Array.isArray(value)) {
                value = value.join(",")
            }
            this.setHeader(name, `${oldValue},${value}`)
        } else {
            this.setHeader(name, value)
        }
    }

    response.json = function (data: any) {
        data = typeof data == "string" ? data : JSON.stringify(data)
        this.result = data
        this.setHeader("Content-Type", "application/json")
        this.end(data)
    }

    response.binary = function (data: any) {
        this.result = data
        this.setHeader("Content-Type", "application/octet-stream")
        this.end(data)
    }

    response.image = function (data: any) {
        this.result = data
        this.setHeader("Content-Type", "image/jpeg")
        this.end(data)
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

    Object.defineProperties(response, {
        [FOURZE_RESPONSE_SYMBOL]: {
            get() {
                return true
            }
        },
        url: {
            get() {
                return options.url
            }
        },
        method: {
            get() {
                return options.method
            }
        }
    })

    return response
}

export interface FourzeRequestContextOptions {
    url: string
    method?: string
    headers?: Record<string, string | string[] | number | undefined>
    body?: any
    request?: IncomingMessage
    response?: OutgoingMessage
}

export interface FourzeContext {
    request: FourzeRequest
    response: FourzeResponse
}

export function createRequestContext(options: FourzeRequestContextOptions) {
    const { url, method = "GET", headers = {}, body } = options
    const request = createRequest({
        ...(options.request as Partial<FourzeRequest>),
        url,
        method,
        headers: flatHeaders(headers),
        body
    })
    const response = createResponse({
        url,
        method,
        response: options.response
    })
    return {
        request,
        response
    }
}

export function createRequest(options: Partial<FourzeRequest>) {
    const headers = flatHeaders(options.headers)

    const contentType = headers["content-type"]

    if (typeof options.body === "string" && contentType) {
        if (contentType.startsWith("application/json")) {
            options.body = JSON.parse(options.body)
        } else if (contentType.startsWith("multipart/form-data")) {
            options.body = parseFormData(options.body)
        }
    }

    return {
        relativePath: options.url,
        query: {},
        body: {},
        params: {},
        data: {},
        meta: {},
        ...options,
        headers,
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
