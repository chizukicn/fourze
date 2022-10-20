import { appendHeader, createLogger, flatHeaders, FourzeRoute, getHeader, getHeaderValue, toRawHeaders } from "@fourze/core"
import { HTTP_STATUS_CODES } from "./code"
import { FourzeMockRouter } from "./shared"

const XHR_EVENTS = "readystatechange loadstart progress abort error load timeout loadend".split(" ")

export function createProxyXMLHttpRequest(router: FourzeMockRouter) {
    const OriginalXmlHttpRequest = router.originalXMLHttpRequest
    const logger = createLogger("@fourze/mock")

    return class {
        $base: XMLHttpRequest | null = null
        $route: FourzeRoute | undefined

        readonly UNSENT: number = 0
        readonly OPENED: number = 1
        readonly HEADERS_RECEIVED: number = 2
        readonly LOADING: number = 3
        readonly DONE: number = 4

        get $routes() {
            return router.routes
        }

        url: string = ""

        method: string = "GET"

        constructor() {
            this.requestHeaders = {}
            this.responseHeaders = {}
            this.response = null
            this.responseText = ""
            this.responseXML = null
            this.responseType = "json"
            this.responseURL = ""
            this.headers = {}

            this.upload = null

            this.readyState = this.UNSENT

            this.async = true

            this.status = 0
            this.statusText = ""

            this.timeout = 0

            this.withCredentials = false

            this.events = {}

            this.$base = null
        }

        onreadystatechange: ((ev: Event) => any) | null = null

        onabort: ((ev: ProgressEvent) => any) | null = null
        onerror: ((ev: ProgressEvent) => any) | null = null
        onload: ((ev: ProgressEvent) => any) | null = null
        onloadend: ((ev: ProgressEvent) => any) | null = null
        onloadstart: ((ev: ProgressEvent) => any) | null = null
        onprogress: ((ev: ProgressEvent) => any) | null = null
        ontimeout: ((ev: ProgressEvent) => any) | null = null

        upload: XMLHttpRequestUpload | null

        readyState: number

        status: number

        statusText: string

        response: any

        headers: Record<string, string>

        body: any

        async: boolean

        matched: boolean = false

        requestHeaders: Record<string, string>

        responseHeaders: Record<string, string>

        events: Record<string, EventListener[]>

        responseText: string

        responseType: XMLHttpRequestResponseType

        responseURL: string

        responseXML: Document | null

        timeout: number

        withCredentials: boolean

        getAllResponseHeaders() {
            if (!this.matched) {
                return this.$base?.getAllResponseHeaders()
            }
            return toRawHeaders(this.responseHeaders)
        }

        setRequestHeader(name: string, value: string) {
            if (!!this.$base) {
                this.$base.setRequestHeader(name, value)
            }
            console.log("setRequestHeader", name, value)
            appendHeader(this.requestHeaders, name, value)
        }

        overrideMimeType(mime: string) {
            this.$base?.overrideMimeType(mime)
        }

        removeEventListener(type: string, listener: EventListener) {
            const handles = this.events[type]
            if (handles) {
                const index = handles.indexOf(listener)
                if (index > -1) {
                    handles.splice(index, 1)
                }
            }
        }

        open(method: string, url: URL | string, async: boolean = true, username?: string, password?: string) {
            const handle = (event: Event) => {
                if (this.$base) {
                    this.responseType = this.$base.responseType
                    this.response = this.$base.response
                    this.responseText = this.$base.responseText
                    this.responseXML = this.$base.responseXML
                    this.responseURL = this.$base.responseURL
                    this.status = this.$base.status
                    this.statusText = this.$base.statusText
                    this.readyState = this.$base.readyState
                }

                this.dispatchEvent(new Event(event.type))
            }

            if (OriginalXmlHttpRequest) {
                this.$base = new OriginalXmlHttpRequest()
                for (let event of XHR_EVENTS) {
                    this.$base.addEventListener(event, handle)
                }
                this.$base.open(method, url, async, username, password)
            }

            this.url = url.toString()
            this.method = method
            this.async = async

            logger.info("mock url ->", url)

            this.readyState = this.OPENED

            this.dispatchEvent(new Event("readystatechange"))
        }

        async originalSend(data: any) {
            if (!!this.$base) {
                this.$base.timeout = this.timeout
                this.$base.responseType = this.responseType
                this.$base.withCredentials = this.withCredentials
                this.$base.send(data)
            }
        }

        async mockSend(data: any) {
            const { url, method } = this

            this.setRequestHeader("X-Requested-With", "Fourze XHR Proxy")
            this.setRequestHeader("Origin", location.origin)
            this.setRequestHeader("Host", location.host)
            this.dispatchEvent(new Event("loadstart"))

            this.readyState = this.HEADERS_RECEIVED
            this.dispatchEvent(new Event("readystatechange"))
            this.readyState = this.LOADING

            console.log("url", url, this.requestHeaders)

            const { response } = await router.service({
                url,
                method,
                headers: this.requestHeaders,
                body: data
            })

            this.matched = !!response.matched

            if (this.matched) {
                logger.success(`Found route by [${method}] -> "${url}"`)

                this.$base?.abort()

                this.dispatchEvent(new ProgressEvent("readystatechange"))
                this.status = 200
                this.statusText = HTTP_STATUS_CODES[200]

                this.response = response.result

                this.responseText = response.result

                this.responseHeaders = flatHeaders(response.getHeaders())

                this.readyState = this.DONE

                this.dispatchEvent(new Event("readystatechange"))

                this.dispatchEvent(new Event("load"))
                this.dispatchEvent(new Event("loadend"))
            } else {
                logger.debug(`Not found route by [${method}] -> "${url}"`)
                this.originalSend(data)
            }
        }

        async send(data?: Document | XMLHttpRequestBodyInit | null | undefined) {
            const useMock = getHeaderValue(this.requestHeaders, "X-Fourze-Mock")
            const { url, method } = this

            if (useMock === "off") {
                logger.debug(`X-Fourze-Mock is off, fallback to original -> [${method}] ${url}`)
                await this.originalSend(data)
            } else {
                await this.mockSend(data)
            }
        }

        abort() {
            if (!this.matched) {
                this.$base?.abort()
                return
            }

            this.readyState = this.UNSENT
            this.dispatchEvent(new Event("abort"))
            this.dispatchEvent(new Event("error"))
        }

        getResponseHeader(name: string) {
            if (!this.matched) {
                return this.$base?.getResponseHeader(name)
            }
            return getHeader(this.responseHeaders, name)
        }

        addEventListener(type: string, listener: EventListener) {
            if (!this.events[type]) {
                this.events[type] = []
            }
            this.events[type].push(listener)
        }

        dispatchEvent(event: Event): boolean {
            const handles = this.events[event.type] || []
            for (let i = 0; i < handles.length; i++) {
                handles[i].call(this, event)
            }
            const e = event as ProgressEvent
            switch (event.type) {
                case "load":
                    this.onload?.(e)
                    break
                case "error":
                    this.onerror?.(e)
                    break
                case "abort":
                    this.onabort?.(e)
                    break
                case "timeout":
                    this.ontimeout?.(e)
                    break
                case "progress":
                    this.onprogress?.(e)
                    break
                case "loadstart":
                    this.onloadstart?.(e)
                    break
                case "loadend":
                    this.onloadend?.(e)
                    break
                case "readystatechange":
                    this.onreadystatechange?.(e)
                    break
            }

            return handles.length > 0
        }
    }
}
