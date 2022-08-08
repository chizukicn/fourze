import { FourzeRouter } from "../router"
import { createRequest, createResponse, FourzeRequest, FourzeResponse } from "../shared"

const originalFetch = globalThis.fetch

class ProxyFetchResponse implements Response {
    url: string = ""

    body: ReadableStream<Uint8Array> | null = null

    bodyUsed: boolean = false

    statusText: string = "OK"

    status: number = 200

    ok: boolean = true

    redirected: boolean = false

    type: ResponseType = "basic"

    headers: Headers = new Headers()

    data: any

    _response: FourzeResponse
    _request: FourzeRequest

    constructor(request: FourzeRequest, response: FourzeResponse) {
        this.url = request.url!
        this.data = response.result
        for (let [key, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) {
                value = value.join(",")
            }
            this.headers.append(key, value ?? "")
        }
        this._response = response
        this._request = request
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
        return typeof this.data == "string" ? JSON.parse(this.data) : this.data
    }

    clone(): Response {
        return new ProxyFetchResponse(this._request, this._response)
    }

    async text() {
        return String(this.data)
    }

    async raw() {
        return this.data
    }
}

export function createProxyFetch(router: FourzeRouter) {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
        let url: string
        let method: string = "GET"
        let body: any
        if (typeof input === "string" || input instanceof URL) {
            url = input.toString()
            method = init?.method ?? method
            body = init?.body ?? {}
        } else {
            url = input.url
            method = input.method ?? init?.method ?? method
            body = input.body ?? init?.body ?? {}
        }

        const route = router.match(url, method)

        if (route) {
            const headers: Record<string, string[]> = {}
            new Headers(init?.headers ?? {}).forEach((value, key) => {
                if (headers[key]) {
                    headers[key].push(value)
                } else {
                    headers[key] = [value]
                }
            })

            headers["X-Request-With"] = ["Fourze Fetch Proxy"]
            const request = createRequest({ url, method, body, headers })
            const response = createResponse()
            await router(request, response)
            return new ProxyFetchResponse(request, response)
        }
        return originalFetch(input, init)
    }
}
