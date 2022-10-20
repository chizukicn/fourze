import { createLogger, flatHeaders, FourzeResponse, getHeaderValue, isString, isURL, normalizeRoute, PolyfillHeaders } from "@fourze/core"
import { FourzeMockRouter } from "./shared"

class ProxyFetchResponse implements Response {
    readonly url: string

    readonly statusText: string = "OK"

    readonly status: number = 200

    readonly headers: Headers

    readonly ok: boolean = true

    readonly body: ReadableStream<Uint8Array> | null = null

    readonly data: any

    bodyUsed: boolean = false

    redirected: boolean = false

    type: ResponseType = "basic"

    _response: FourzeResponse

    constructor(response: FourzeResponse) {
        this.url = response.url!
        this.status = response.statusCode
        this.statusText = response.statusMessage
        this.data = response.result
        this.headers = new PolyfillHeaders(response.getHeaders())
        this._response = response
    }

    async arrayBuffer() {
        return new Blob([this.data]).arrayBuffer()
    }

    async blob(): Promise<Blob> {
        return new Blob([this.data])
    }

    async formData() {
        const formData = new FormData()
        for (let [key, value] of Object.entries(this.data)) {
            formData.append(key, value as any)
        }
        return formData
    }

    async json() {
        return isString(this.data) ? JSON.parse(this.data) : this.data
    }

    clone(): Response {
        return new ProxyFetchResponse(this._response)
    }

    async text() {
        return String(this.data)
    }

    async raw() {
        return this.data
    }
}

export function createProxyFetch(router: FourzeMockRouter) {
    const logger = createLogger("@fourze/mock")
    const originalFetch = router.originalFetch

    if (!originalFetch) {
        logger.warn("globalThis.fetch is not defined")
    }

    return async (input: RequestInfo | URL, init?: RequestInit) => {
        let url: string
        let method: string = "GET"
        let body: any
        if (isString(input) || isURL(input)) {
            url = input.toString()
            method = init?.method ?? method
            body = init?.body ?? {}
        } else {
            url = input.url
            method = input.method ?? init?.method ?? method
            body = input.body ?? init?.body ?? {}
        }

        const headers = flatHeaders(init?.headers)
        const useMock = getHeaderValue(headers, "X-Fourze-Mock")

        async function mockRequest() {
            headers["X-Request-With"] = "Fourze Fetch Proxy"
            const { response } = await router.service({
                url,
                method,
                body,
                headers
            })
            if (response.matched) {
                logger.success(`Found route by -> ${normalizeRoute(url, method)}.`)
                return new ProxyFetchResponse(response)
            }
            logger.debug(`Not found route, fallback to original -> ${normalizeRoute(url, method)}.`)
            return originalFetch(input, init)
        }

        if (useMock === "off") {
            logger.debug(`X-Fourze-Mock is off, fallback to original ${normalizeRoute(url, method)}.`)
            const res = await originalFetch(input, init)
            return res
        } else {
            return mockRequest()
        }
    }
}
