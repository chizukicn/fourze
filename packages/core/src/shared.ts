import type { IncomingMessage, OutgoingMessage, ServerResponse } from "http"
import type { MaybePromise } from "maybe-types"
import qs from "query-string"

import { version } from "../package.json"
import { decodeFormData } from "./polyfill/form-data"
import { flatHeaders, getHeaderRawValue, getHeaderValue, PolyfillHeaderInit } from "./polyfill/header"
import { PolyfillServerResponse } from "./polyfill/response"
import { resolvePath } from "./utils"

export const FOURZE_VERSION = version

const FOURZE_ROUTE_SYMBOL = Symbol("FourzeRoute")
const FOURZE_HOOK_SYMBOL = Symbol("FourzeInterceptor")
const FOURZE_REQUEST_SYMBOL = Symbol("FourzeRequest")
const FOURZE_RESPONSE_SYMBOL = Symbol("FourzeResponse")

export interface FourzeRequest extends IncomingMessage {
    url: string
    method: string
    headers: Record<string, string | string[] | undefined>

    route: FourzeRoute
    relativePath: string

    params: Record<string, any>

    meta: Record<string, any>

    readonly query: Record<string, any>

    readonly body: Record<string, any>
    /**
     *  {...query, ...params, ...body}
     */
    readonly data: Record<string, any>

    readonly raw: string

    readonly path: string

    readonly [FOURZE_REQUEST_SYMBOL]: true
}

export interface FourzeBaseResponse extends ServerResponse {
    result?: any
    method?: string
    matched?: boolean
}
export interface FourzeResponse extends FourzeBaseResponse {
    json(data?: any): this

    image(data?: any): this

    text(data?: string): this

    binary(data?: any): this

    redirect(url: string): this

    appendHeader(key: string, value: string | string[]): this

    removeHeader(key: string): this

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
    readonly pathParams: RegExpMatchArray
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
    let { handle, method, path, meta = {}, base } = route

    if (REQUEST_PATH_REGEX.test(path)) {
        const arr = path.split(/\s+/)
        const m = arr[0].toLowerCase() as RequestMethod
        if (FOURZE_METHODS.includes(m)) {
            method = m
            path = arr[1].trim()
        }
    }

    path = resolvePath(path, base)

    return {
        method,
        path,
        meta,
        handle,
        match(this: FourzeRoute, url: string, method?: string) {
            if (!this.method || !method || this.method.toLowerCase() === method.toLowerCase()) {
                const regex = new RegExp(`^${path.replace(PARAM_KEY_REGEX, "([a-zA-Z0-9_-\\s]+)?")}$`, "i")
                return url.match(regex)
            }
            return null
        },
        get pathParams() {
            return this.path.match(PARAM_KEY_REGEX) ?? []
        },
        get [FOURZE_ROUTE_SYMBOL](): true {
            return true
        }
    }
}

export interface FourzeBaseHook extends FourzeMiddleware<any> {
    path?: string
}

export interface FourzeHook {
    handle: FourzeMiddleware<any>
    path: string
    readonly [FOURZE_HOOK_SYMBOL]: true
}

export function defineFourzeHook(base: string, interceptor: FourzeBaseHook): FourzeHook

export function defineFourzeHook(interceptor: FourzeBaseHook): FourzeHook

export function defineFourzeHook(interceptor: DefineFourzeHook): FourzeHook

export function defineFourzeHook(param0: string | DefineFourzeHook | FourzeBaseHook, param1?: FourzeBaseHook) {
    const path = typeof param0 === "string" ? param0 : param0.path ?? ""

    const hook = {
        path,
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

    Object.defineProperty(hook, FOURZE_HOOK_SYMBOL, {
        get() {
            return true
        }
    })
    return hook
}

export type DefineFourzeHook = {
    path?: string
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

export interface FourzeResponseOptions {
    url: string
    method: string
    response?: OutgoingMessage
}

export function createResponse(options: FourzeResponseOptions) {
    const response = (options?.response ?? new PolyfillServerResponse()) as FourzeResponse

    const _end = response.end.bind(response)

    response.end = (data: any) => {
        response.result = data ?? response.result

        if (!!response.result) {
            let contentType = getHeaderRawValue(response.getHeader("content-type"))

            if (!contentType) {
                contentType = "application/json"
                response.setHeader("content-type", contentType)
            }
            if (contentType.startsWith("application/json")) {
                response.json(response.result)
            }
        }

        _end(response.result)
        return response
    }

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
        return this
    }

    response.json = function (data: any) {
        this.result = JSON.stringify(data)
        this.setHeader("Content-Type", "application/json")
        return this
    }

    response.binary = function (data: any) {
        this.result = data
        this.setHeader("Content-Type", "application/octet-stream")
        return this
    }

    response.image = function (data: any) {
        this.result = data
        this.setHeader("Content-Type", "image/jpeg")
        return this
    }

    response.text = function (data: string) {
        this.result = data
        this.setHeader("Content-Type", "text/plain")
        return this
    }

    response.redirect = function (url: string) {
        this.statusCode = 302
        this.setHeader("Location", url)
        return this
    }

    response.setHeader("X-Powered-By", `Fourze Server/v${FOURZE_VERSION}`)

    let _result: any

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
        result: {
            set(val) {
                _result = val
            },
            get() {
                return _result
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

export interface FourzeContextOptions {
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

export function createServiceContext(options: FourzeContextOptions) {
    const { url, method = "GET", headers = {}, body } = options
    const request = createRequest({
        url,
        method,
        headers: flatHeaders(headers),
        body,
        request: options.request
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

export interface FourzeRequestOptions {
    url: string
    method?: string
    headers?: PolyfillHeaderInit
    body?: any
    params?: Record<string, any>
    request?: IncomingMessage
}

export function createRequest(options: FourzeRequestOptions) {
    const request = (options?.request ?? {
        url: options.url,
        method: options.method
    }) as FourzeRequest

    request.url = options.url ?? request.url
    request.method = request.method ?? "GET"

    const headers = {
        ...flatHeaders(request.headers),
        ...flatHeaders(options.headers)
    }

    request.headers = headers

    const { query = {}, url: path } = qs.parseUrl(request.url, {
        parseBooleans: true
    })

    const contentType = getHeaderValue(headers, "content-type", "application/json")

    if (typeof options.body === "string") {
        if (contentType.startsWith("application/json")) {
            options.body = JSON.parse(options.body)
        } else if (contentType.startsWith("application/x-www-form-urlencoded")) {
            options.body = qs.parse(options.body)
        }
    }

    if (contentType.startsWith("multipart/form-data")) {
        const boundary = contentType.split("=")[1]
        options.body = decodeFormData(options.body, boundary)
    }

    request.params = options.params ?? {}

    Object.defineProperties(request, {
        [FOURZE_REQUEST_SYMBOL]: {
            get() {
                return true
            }
        },
        data: {
            get() {
                return {
                    ...request.query,
                    ...(request.body ?? {}),
                    ...(request.params ?? {})
                }
            }
        },
        body: {
            get() {
                return options.body ?? {}
            }
        },
        query: {
            get() {
                return query
            }
        },

        path: {
            get() {
                return path
            }
        }
    })

    return request
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
