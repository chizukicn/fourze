import { createLogger, createRouter, isNode } from "@fourze/core"
import { createProxyFetch } from "./fetch"
import { createProxyRequest } from "./request"
import { FourzeMockRequestMode, FourzeMockRouter, FourzeMockRouterOptions, FOURZE_MOCK_ROUTER_SYMBOL } from "./shared"
import { createProxyXMLHttpRequest } from "./xhr"

export function createMockRouter(options: FourzeMockRouterOptions = {}): FourzeMockRouter {
    const logger = createLogger("@fourze/mock")

    const instance = createRouter(options) as FourzeMockRouter

    logger.info("Fourze Mock is starting...")

    const mode = options.mode ?? (isNode() ? ["request"] : ["xhr", "fetch"])
    const autoEnable = options.autoEnable ?? true
    const activeMode = new Set<FourzeMockRequestMode>(mode)

    if (options.global) {
        if (!!globalThis.__FOURZE_MOCK_ROUTER__) {
            logger.warn("Fourze Mock is already started, please do not start it again.")
        }
        globalThis.__FOURZE_MOCK_ROUTER__ = instance
    }

    if (mode.includes("request") && isNode()) {
        const http = require("http")
        const https = require("https")

        instance.originalHttpRequest = http.request
        instance.originalHttpsRequest = https.request

        instance.request = createProxyRequest(instance) as typeof http.request
    }

    if (mode.includes("xhr")) {
        const XMLHttpRequest = globalThis.XMLHttpRequest
        instance.originalXMLHttpRequest = XMLHttpRequest
        instance.XmlHttpRequest = createProxyXMLHttpRequest(instance) as unknown as typeof XMLHttpRequest
    }

    if (mode.includes("fetch")) {
        instance.originalFetch = globalThis.fetch
        instance.fetch = createProxyFetch(instance) as typeof fetch
    }

    instance.enable = function (_mode?: FourzeMockRequestMode[]) {
        _mode = _mode ?? Array.from(mode)
        _mode.forEach(m => activeMode.add(m))

        if (mode.includes("fetch")) {
            globalThis.fetch = this.fetch
        }
        if (mode.includes("xhr")) {
            globalThis.XMLHttpRequest = this.XmlHttpRequest
        }
        if (mode.includes("request")) {
            const http = require("http") as typeof import("http")
            const https = require("https") as typeof import("https")
            http.request = this.request
            https.request = this.request
        }
        logger.info(`Fourze Mock is enabled for [${_mode.join(",")}]`)
    }

    instance.disable = function (_mode?: FourzeMockRequestMode[]) {
        _mode = _mode ?? Array.from(mode)
        _mode.forEach(m => activeMode.delete(m))

        if (_mode.includes("fetch")) {
            globalThis.fetch = this.originalFetch
        }
        if (_mode.includes("xhr")) {
            globalThis.XMLHttpRequest = this.originalXMLHttpRequest
        }
        if (_mode.includes("request") && isNode()) {
            const http = require("http") as typeof import("http")
            const https = require("https") as typeof import("https")
            http.request = this.originalHttpRequest
            https.request = this.originalHttpsRequest
        }
        logger.success(`Fourze Mock is disabled for [${_mode.join(",")}]`)
    }

    Object.defineProperties(instance, {
        activeModes: {
            get() {
                return Array.from(activeMode)
            }
        },
        enabled: {
            get() {
                return instance.activeModes.length > 0
            }
        },
        [FOURZE_MOCK_ROUTER_SYMBOL]: {
            get() {
                return true
            }
        }
    })

    if (autoEnable) {
        instance.enable()
    }

    instance.use(r => {
        r.hook(async (req, res, next) => {
            req.headers["X-Fourze-Mock"] = "on"
            await next?.()
        })
    })

    return instance
}

export function getGlobalMockRouter() {
    return globalThis.__FOURZE_MOCK_ROUTER__
}

export function isMockRouter(router: any): router is FourzeMockRouter {
    return !!router && router[FOURZE_MOCK_ROUTER_SYMBOL]
}

export * from "@fourze/core"
export * from "./shared"
