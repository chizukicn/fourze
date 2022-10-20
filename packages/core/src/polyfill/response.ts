import { getHeaderRawValue } from "./header"

export class PolyfillServerResponse {
    headers: Record<string, string>
    _ended: boolean
    matched: boolean
    statusCode: number

    constructor() {
        this.headers = {}
        this._ended = false
        this.matched = false
        this.statusCode = 200
    }

    get writableEnded() {
        return this._ended
    }

    end() {
        this.statusCode = 200
        this._ended = true
    }

    getHeaders() {
        return this.headers
    }

    getHeaderNames() {
        return Object.keys(this.headers)
    }

    hasHeader(name: string, value?: string | number) {
        if (value) {
            const v = this.headers[name]
            const arr = Array.isArray(v) ? v : v?.split(",") ?? []
            return arr.includes(String(value))
        }
        return !!this.headers[name]
    }

    getHeader(name: string) {
        const value = this.headers[name]
        return getHeaderRawValue(value)
    }

    setHeader(name: string, value: string | ReadonlyArray<string> | number) {
        if (Array.isArray(value)) {
            value = value.join(",")
        }
        this.headers[name] = value ? String(value) : ""
        return this
    }

    removeHeader(name: string) {
        delete this.headers[name]
        return this
    }
}
