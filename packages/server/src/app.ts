import { CommonMiddleware, createLogger, createRequestContext, FourzeLogger, FourzeMiddleware, FourzeNext, FourzeRequest, FourzeResponse, FOURZE_VERSION } from "@fourze/core"
import EventEmitter from "events"
import type { IncomingMessage, OutgoingMessage, Server } from "http"
import http from "http"
import https from "https"
import { AddressInfo } from "net"

export interface FourzeServerOptions {
    host?: string
    port?: number
    server?: Server
    protocol?: "http" | "https"
    logger?: FourzeLogger
}

export interface FourzeServer extends EventEmitter {
    (req: IncomingMessage, res: OutgoingMessage, next?: () => void | Promise<void>): Promise<void>

    host: string
    port: number

    readonly origin: string

    readonly server?: Server
    readonly serverMode: "http" | "https"

    use(middleware: CommonMiddleware): this
    use(middleware: FourzeMiddleware): this
    use(path: string, middleware: CommonMiddleware): this
    use(path: string, middlewares: FourzeMiddleware): this

    use(path: string, ...middlewares: CommonMiddleware[]): this
    use(path: string, ...middlewares: FourzeMiddleware[]): this

    use(...middlewares: CommonMiddleware[]): this

    use(...middlewares: FourzeMiddleware[]): this

    createServer(): Server

    listen(port?: number, host?: string): Promise<Server>

    close(): void
}

export interface FouzeServerContext {
    request: FourzeRequest
    response: FourzeResponse
}

export function createServerContext(req: IncomingMessage, res: OutgoingMessage): Promise<FouzeServerContext> {
    return new Promise((resolve, reject) => {
        let body: any = ""

        req.on("data", chunk => {
            body += chunk
        })

        req.on("end", () => {
            const context = createRequestContext({
                url: req.url!,
                method: req.method ?? "GET",
                headers: req.headers,
                body,
                request: req,
                response: res
            })

            resolve(context)
        })

        req.on("error", reject)
    })
}

function injectEventEmitter(app: FourzeServer) {
    const _emitter = new EventEmitter()
    app.addListener = function (event: string, listener: (...args: any[]) => void) {
        _emitter.addListener(event, listener)
        return this
    }

    app.on = function (event: string, listener: (...args: any[]) => void) {
        _emitter.on(event, listener)
        return this
    }

    app.emit = function (event: string, ...args: any[]) {
        return _emitter.emit(event, ...args)
    }

    app.once = function (event: string, listener: (...args: any[]) => void) {
        _emitter.once(event, listener)
        return this
    }

    app.removeListener = function (event: string, listener: (...args: any[]) => void) {
        _emitter.removeListener(event, listener)
        return this
    }

    app.removeAllListeners = function (event?: string) {
        _emitter.removeAllListeners(event)
        return this
    }

    app.listeners = function (event: string) {
        return _emitter.listeners(event)
    }
}

function normalizeAddress(address?: AddressInfo | string | null): string {
    if (address) {
        if (typeof address === "string") {
            return address
        }
        return `${address.address}:${address.port}`
    }
    return "unknown"
}

function injectSeverEvents(app: FourzeServer, server: Server) {}

export function createFourzeServer(options: FourzeServerOptions = {}) {
    let _host = options.host ?? "localhost"
    let _port = options.port ?? 7609
    let _server = options.server

    let _protocol = options.protocol ?? "http"

    const logger = options.logger ?? createLogger("@fourze/server")

    const middlewareMap = new Map<string, FourzeMiddleware[]>()

    const app = async function (req: IncomingMessage, res: OutgoingMessage, next?: FourzeNext) {
        const context = await createServerContext(req, res)
        const { request, response } = context
        try {
            const middlewares = Array.from(middlewareMap.entries())
                .map(([key, value]) => (request.url.startsWith(key) ? value : []))
                .reduce((a, b) => a.concat(b), [])

            let i = 0
            const fn = async () => {
                const middleware = middlewares[i++]
                if (middleware) {
                    await middleware(request, response, fn)
                } else if (next && typeof next === "function") {
                    await next()
                } else if (!response.writableEnded) {
                    response.statusCode = 404
                    response.end(`Cannot ${req.method ?? "GET"} ${req.url ?? "/"}`)
                }
            }
            app.emit("request", context)
            await fn()
        } catch (error) {
            app.emit("error", error, context)
            if (!response.writableEnded) {
                response.statusCode = 500
                response.end(`Internal Server Error`)
            }
        }
    } as FourzeServer

    injectEventEmitter(app)

    app.on("error", error => {
        logger.error(error)
    })

    app.use = function (param0: FourzeMiddleware | string, ...params: FourzeMiddleware[]) {
        const base = typeof param0 === "string" ? param0 : "/"
        const arr = (typeof param0 === "string" ? params : [param0, ...params]).filter(e => typeof e == "function")
        const middlewares = middlewareMap.get(base) ?? []
        middlewareMap.set(base, middlewares.concat(arr))

        for (const middleware of arr) {
            if (!middleware.name) {
                Object.defineProperty(middleware, "name", {
                    value: `anonymous@${Math.random().toString(36).slice(2, 8)}`
                })
            }

            app.emit(`use:${middleware.name}`, middleware)
            logger.info("Middleware", `[${middleware.name}]`, `was registered on '${base}'.`)
        }

        return this
    }

    app.createServer = function () {
        switch (_protocol) {
            case "https":
                _server = https.createServer(app)
                break
            case "http":
            default:
                _server = http.createServer(app)
                break
        }
        return _server
    }

    app.listen = async function (port: number, hostname: string = "localhost") {
        _port = port ?? _port
        _host = hostname ?? _host
        _server = _server ?? this.createServer()

        injectSeverEvents(app, _server)

        const middlewares = Array.from(middlewareMap.values()).flat()

        await Promise.all(middlewares.flatMap(r => r.setup?.()))

        return new Promise((resolve, reject) => {
            logger.info(`Start server process [${process.pid}]`)
            const server = this.server
            if (server) {
                if (!server.listening) {
                    server.listen(_port, _host, () => {
                        const address = server.address()
                        let rawAddress = "unknown"
                        if (address) {
                            if (typeof address === "string") {
                                rawAddress = address
                            } else {
                                rawAddress = `${address.address}:${address.port}`
                                _port = address.port
                            }
                        }
                        logger.info(`Server listening on ${_protocol}://${rawAddress}`)
                        logger.info(`Application ready for Fourze Server v${FOURZE_VERSION}`)
                        resolve(server)
                        app.emit("ready")
                    })
                } else {
                    reject(new Error(`Server is already listening on ${_protocol}://${normalizeAddress(server.address())}`))
                }
            } else {
                reject(new Error("Server is not defined"))
            }
        })
    }

    app.close = function () {
        this.server?.close()
    }

    Object.defineProperties(app, {
        port: {
            get() {
                return _port
            },
            set(port: string | number) {
                _port = Number(port)
            }
        },
        origin: {
            get() {
                return `${_protocol}://${_host}:${_port}`
            }
        },

        server: {
            get() {
                return _server
            }
        },
        serverMode: {
            get() {
                return _protocol
            }
        }
    })

    return app
}
