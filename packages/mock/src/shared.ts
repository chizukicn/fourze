import type { FourzeRouter, FourzeRouterOptions } from "@fourze/core"
import type http from "http"
import type https from "https"

export type FourzeMockRequestMode = "xhr" | "fetch" | "request"

export interface FourzeMockRouterOptions extends FourzeRouterOptions {
    /**
     * @default ["xhr","fetch"]
     */
    mode?: FourzeMockRequestMode[]

    port?: string

    host?: string

    autoEnable?: boolean

    global?: boolean
}

export const FOURZE_MOCK_ROUTER_SYMBOL = Symbol("FOURZE_MOCK_ROUTER_SYMBOL")

export interface FourzeMockRouter extends FourzeRouter {
    originalFetch: typeof fetch
    originalXMLHttpRequest: typeof XMLHttpRequest
    originalHttpRequest: typeof http.request
    originalHttpsRequest: typeof https.request

    XmlHttpRequest: typeof XMLHttpRequest
    fetch: typeof fetch
    request: typeof http.request

    enabled: boolean

    enable(): void

    disable(): void

    activeModes: FourzeMockRequestMode[]

    [FOURZE_MOCK_ROUTER_SYMBOL]: true
}

declare global {
    var __FOURZE_MOCK_ROUTER__: FourzeMockRouter
}
