import { Logger } from "../logger"
import { FourzeRouter } from "../router"
import type { FourzeRequest, FourzeRoute } from "../shared"
import { createRequest, createResponse } from "../shared"
import { HTTP_STATUS_CODES } from "./code"

type XHR_RESPONSE_PROPERTY = "readyState" | "responseURL" | "status" | "statusText" | "responseType" | "response" | "responseText" | "responseXML"
type XHR_REQUEST_PROPERTY = "timeout" | "withCredentitals"

const XHR_EVENTS = "readystatechange loadstart progress abort error load timeout loadend".split(" ")
const XHR_REQUEST_PROPERTIES: XHR_REQUEST_PROPERTY[] = ["timeout", "withCredentitals"]
const XHR_RESPONSE_PROPERTIES: XHR_RESPONSE_PROPERTY[] = ["readyState", "response", "responseText", "responseType", "responseURL", "responseXML", "status", "statusText"]

const OriginalXmlHttpRequest = globalThis.XMLHttpRequest

interface MockXmlHttpRequest extends XMLHttpRequestEventTarget {
    new (): MockXmlHttpRequest
    $base: XMLHttpRequest | null

    $route: FourzeRoute | undefined
    $routes: FourzeRoute[]
    request: FourzeRequest

    readyState: number
    status: number
    statusText: string
    response: any
    headers: Record<string, string>
    body: any
    async: boolean

    requestHeaders: Record<string, string>
    responseHeaders: Record<string, string>

    events: Record<string, EventListener[]>

    onreadystatechange: ((ev: Event) => any) | null
    /** Returns client's state. */
    /** Returns the response body. */
    /**
     * Returns response as text.
     *
     * Throws an "InvalidStateError" DOMException if responseType is not the empty string or "text".
     */
    responseText: string
    /**
     * Returns the response type.
     *
     * Can be set to change the response type. Values are: the empty string (default), "arraybuffer", "blob", "document", "json", and "text".
     *
     * When set: setting to "document" is ignored if current global object is not a Window object.
     *
     * When set: throws an "InvalidStateError" DOMException if state is loading or done.
     *
     * When set: throws an "InvalidAccessError" DOMException if the synchronous flag is set and current global object is a Window object.
     */
    responseType: XMLHttpRequestResponseType
    responseURL: string
    /**
     * Returns the response as document.
     *
     * Throws an "InvalidStateError" DOMException if responseType is not the empty string or "document".
     */
    responseXML: Document | null
    /**
     * Can be set to a time in milliseconds. When set to a non-zero value will cause fetching to terminate after the given time has passed. When the time has passed, the request has not yet completed, and this's synchronous flag is unset, a timeout event will then be dispatched, or a "TimeoutError" DOMException will be thrown otherwise (for the send() method).
     *
     * When set: throws an "InvalidAccessError" DOMException if the synchronous flag is set and current global object is a Window object.
     */
    timeout: number
    /** Returns the associated XMLHttpRequestUpload object. It can be used to gather transmission information when data is transferred to a server. */
    upload: XMLHttpRequestUpload
    /**
     * True when credentials are to be included in a cross-origin request. False when they are to be excluded in a cross-origin request and when cookies are to be ignored in its response. Initially false.
     *
     * When set: throws an "InvalidStateError" DOMException if state is not unsent or opened, or if the send() flag is set.
     */
    withCredentials: boolean
    /** Cancels any network activity. */
    abort(): void
    getAllResponseHeaders(): string
    getResponseHeader(name: string): string | null
    /**
     * Sets the request method, request URL, and synchronous flag.
     *
     * Throws a "SyntaxError" DOMException if either method is not a valid method or url cannot be parsed.
     *
     * Throws a "SecurityError" DOMException if method is a case-insensitive match for `CONNECT`, `TRACE`, or `TRACK`.
     *
     * Throws an "InvalidAccessError" DOMException if async is false, current global object is a Window object, and the timeout attribute is not zero or the responseType attribute is not the empty string.
     */
    open(method: string, url: string | URL): void
    open(method: string, url: string | URL, async: boolean, username?: string | null, password?: string | null): void
    /**
     * Acts as if the `Content-Type` header value for a response is mime. (It does not change the header.)
     *
     * Throws an "InvalidStateError" DOMException if state is loading or done.
     */
    overrideMimeType(mime: string): void
    /**
     * Initiates the request. The body argument provides the request body, if any, and is ignored if the request method is GET or HEAD.
     *
     * Throws an "InvalidStateError" DOMException if either state is not opened or the send() flag is set.
     */
    send(body?: Document | XMLHttpRequestBodyInit | null): void
    /**
     * Combines a header in author request headers.
     *
     * Throws an "InvalidStateError" DOMException if either state is not opened or the send() flag is set.
     *
     * Throws a "SyntaxError" DOMException if name is not a header name or if value is not a header value.
     */
    setRequestHeader(name: string, value: string): void
    DONE: number
    HEADERS_RECEIVED: number
    LOADING: number
    OPENED: number
    UNSENT: number
    addEventListener<K extends keyof XMLHttpRequestEventMap>(type: K, listener: (this: XMLHttpRequest, ev: XMLHttpRequestEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void
    removeEventListener<K extends keyof XMLHttpRequestEventMap>(type: K, listener: (this: XMLHttpRequest, ev: XMLHttpRequestEventMap[K]) => any, options?: boolean | EventListenerOptions): void
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void
}

export function createProxyXHR(router: FourzeRouter) {
    const logger = new Logger("@fourze/mock")
    const MockXHR = function (this: MockXmlHttpRequest) {
        this.requestHeaders = {}
        this.responseHeaders = {}
        this.response = null
        this.responseText = ""
        this.responseXML = null
        this.responseType = "json"
        this.responseURL = ""

        this.readyState = MockXHR.UNSENT

        this.async = true

        this.status = 0
        this.statusText = ""

        this.timeout = 0

        this.withCredentials = false

        this.events = {}

        this.$base = null

        return this
    }

    Object.defineProperty(MockXHR.prototype, "$routes", () => router.routes)

    MockXHR.UNSENT = 0
    MockXHR.OPENED = 1
    MockXHR.HEADERS_RECEIVED = 2
    MockXHR.LOADING = 3
    MockXHR.DONE = 4

    MockXHR.prototype.setRequestHeader = function (this: MockXmlHttpRequest, name: string, value: string) {
        if (!!this.$base) {
            this.$base.setRequestHeader(name, value)
            return
        }

        let existValue = this.requestHeaders[name]
        if (existValue) {
            value = existValue.concat(",").concat(value)
        }
        this.requestHeaders[name] = value
    }

    MockXHR.prototype.getResponseHeader = function (this: MockXmlHttpRequest, name: string) {
        if (!!this.$base) {
            return this.$base.getResponseHeader(name)
        }
        return this.responseHeaders[name]
    }

    MockXHR.prototype.getAllResponseHeaders = function (this: MockXmlHttpRequest) {
        if (!!this.$base) {
            return this.$base.getAllResponseHeaders()
        }
        // 拦截 XHR
        return Object.entries(this.responseHeaders)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\r\n")
    }

    MockXHR.prototype.overrideMimeType = function (this: MockXmlHttpRequest, mime: string) {
        this.$base?.overrideMimeType(mime)
    }

    MockXHR.prototype.open = function (this: MockXmlHttpRequest, method: string, url: URL | string, async: boolean = true, username?: string, password?: string) {
        const handle = (event: Event) => {
            if (this.$base) {
                for (let resp of XHR_RESPONSE_PROPERTIES) {
                    try {
                        //@ts-ignore
                        this[resp] = this.$base[resp]
                    } catch {}
                }
            }

            this.dispatchEvent(new Event(event.type))
        }

        this.$route = router.match(url.toString(), method)
        this.$base = null

        if (!this.$route) {
            this.$base = new OriginalXmlHttpRequest()
            for (let event of XHR_EVENTS) {
                this.$base.addEventListener(event, handle)
            }
            this.$base.open(method, url, async, username, password)
            return
        }

        logger.info("mock url ->", url, router.routes)
        this.request = createRequest({
            url: url.toString(),
            method,
            headers: this.requestHeaders
        })

        this.readyState = this.OPENED
        this.dispatchEvent(new Event("readystatechange"))
    }

    MockXHR.prototype.send = function (this: MockXmlHttpRequest, data?: any) {
        if (!!this.$base) {
            this.$base.timeout = this.timeout
            this.$base.responseType = this.responseType
            this.$base.withCredentials = this.withCredentials
            this.$base.send(data)
            return
        }

        logger.info("send request", this.request.url, this.request.method, data)
        this.request.body = (typeof data === "string" ? JSON.parse(data) : data) ?? this.request.body ?? {}

        this.setRequestHeader("X-Requested-With", "Fourze XHR Proxy")
        this.dispatchEvent(new Event("loadstart"))

        const done = async () => {
            this.readyState = MockXHR.HEADERS_RECEIVED
            this.dispatchEvent(new Event("readystatechange"))
            this.readyState = MockXHR.LOADING
            this.dispatchEvent(new Event("readystatechange"))
            this.status = 200
            this.statusText = HTTP_STATUS_CODES[200]

            const response = createResponse()

            await router(this.request, response)

            this.response = response.result

            this.responseText = response.result

            this.readyState = MockXHR.DONE

            this.dispatchEvent(new Event("readystatechange"))

            console.log("readystate", this.readyState)

            this.dispatchEvent(new Event("load"))
            this.dispatchEvent(new Event("loadend"))
        }

        done()
    }

    MockXHR.prototype.abort = function (this: MockXmlHttpRequest) {
        if (!!this.$base) {
            this.$base.abort()
            return
        }

        this.readyState = MockXHR.UNSENT
        this.dispatchEvent(new Event("abort"))
        this.dispatchEvent(new Event("error"))
    }

    MockXHR.prototype.addEventListener = function (this: MockXmlHttpRequest, type: string, listener: EventListener) {
        if (!this.events[type]) {
            this.events[type] = []
        }
        this.events[type].push(listener)
    }

    MockXHR.prototype.removeEventListener = function (this: MockXmlHttpRequest, type: string, listener: EventListener) {
        const handles = this.events[type]
        if (handles) {
            const index = handles.indexOf(listener)
            if (index > -1) {
                handles.splice(index, 1)
            }
        }
    }

    MockXHR.prototype.dispatchEvent = function (this: MockXmlHttpRequest, event: Event): boolean {
        const handles = this.events[event.type] || []
        for (let i = 0; i < handles.length; i++) {
            handles[i].call(this, event)
        }

        var ontype = "on" + event.type
        //@ts-ignore
        const listener = this[ontype]
        listener?.(event)

        return handles.length > 0
    }
    return MockXHR as unknown as MockXmlHttpRequest
}
