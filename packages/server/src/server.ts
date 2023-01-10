import type EventEmitter from "events";
import type { IncomingMessage, OutgoingMessage, Server } from "http";
import http from "http";
import https from "https";
import type { AddressInfo } from "net";
import {
  FOURZE_VERSION,
  createLogger,
  createServiceContext,
  isFunction,
  isString
} from "@fourze/core";
import type {
  CommonMiddleware,
  FourzeContext,
  FourzeLogger,
  FourzeMiddleware,
  FourzeNext
} from "@fourze/core";
import { injectEventEmitter } from "./utils";

export interface FourzeServerOptions {
  host?: string
  port?: number
  server?: Server
  protocol?: "http" | "https"
  logger?: FourzeLogger
}

export interface FourzeServer extends EventEmitter {
  (
    req: IncomingMessage,
    res: OutgoingMessage,
    next?: () => void | Promise<void>
  ): Promise<void>

  host: string
  port: number

  readonly origin: string

  readonly server?: Server
  readonly protocol: "http" | "https"

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

  close(): this
}

export function createServerContext(
  req: IncomingMessage,
  res: OutgoingMessage
): Promise<FourzeContext> {
  return new Promise((resolve, reject) => {
    let body: Buffer = Buffer.alloc(0);

    req.on("data", (chunk: Buffer) => {
      body = Buffer.concat([body, chunk]);
    });

    req.on("end", () => {
      const context = createServiceContext({
        url: req.url!,
        method: req.method ?? "GET",
        headers: req.headers,
        body,
        request: req,
        response: res
      });

      resolve(context);
    });

    req.on("error", reject);
  });
}

function normalizeAddress(address?: AddressInfo | string | null): string {
  if (address) {
    if (isString(address)) {
      return address;
    }
    return `${address.address}:${address.port}`;
  }
  return "unknown";
}

export function createFourzeServer(options: FourzeServerOptions = {}) {
  let _host = options.host ?? "localhost";
  let _port = options.port ?? 7609;
  let _server = options.server;

  const _protocol = options.protocol ?? "http";

  const logger = options.logger ?? createLogger("@fourze/server");

  const middlewareMap = new Map<string, FourzeMiddleware[]>();

  const app = async function (
    req: IncomingMessage,
    res: OutgoingMessage,
    next?: FourzeNext
  ) {
    const context = await createServerContext(req, res);
    const { request, response } = context;
    try {
      const middlewares = Array.from(middlewareMap.entries())
        .map(([key, value]) => (request.url.startsWith(key) ? value : []))
        .reduce((a, b) => a.concat(b), []);

      let i = 0;
      const fn = async () => {
        const middleware = middlewares[i++];
        if (middleware) {
          Object.defineProperties(request, {
            contextPath: {
              get() {
                return middleware.base;
              },
              configurable: true
            }
          });

          await middleware(request, response, fn);
        } else if (isFunction(next)) {
          await next();
        } else if (!response.writableEnded) {
          response.sendError(
            404,
            `Cannot ${request.method} ${request.url ?? "/"}`
          );
        }
      };
      app.emit("request", context);
      await fn();
    } catch (error) {
      app.emit("error", error, context);
      if (!response.writableEnded) {
        response.sendError(500, "Internal Server Error");
      }
    }
  } as FourzeServer;

  injectEventEmitter(app);

  app.on("error", (error) => {
    logger.error(error);
  });

  app.use = function (
    param0: FourzeMiddleware | string,
    ...params: FourzeMiddleware[]
  ) {
    const isStr = isString(param0);
    const base = isStr ? param0 : "/";
    const arr = (isStr ? params : [param0, ...params]).filter(isFunction);
    const middlewares = middlewareMap.get(base) ?? [];
    middlewareMap.set(base, middlewares.concat(arr));

    for (const middleware of arr) {
      if (!middleware.name) {
        Object.defineProperty(middleware, "name", {
          value: `anonymous@${Math.random().toString(36).slice(2, 8)}`
        });
      }
      Object.defineProperty(middleware, "base", {
        get: () => base
      });

      app.emit(`use:${middleware.name}`, middleware);
      logger.info(
        "Middleware",
        `[${middleware.name}]`,
        `was registered on '${base}'.`
      );
    }

    return this;
  };

  app.createServer = function () {
    switch (_protocol) {
      case "https":
        _server = https.createServer(app);
        break;
      case "http":
      default:
        _server = http.createServer(app);
        break;
    }
    return _server;
  };

  app.listen = async function (port: number, hostname = "localhost") {
    _port = port ?? _port;
    _host = hostname ?? _host;
    _server = _server ?? this.createServer();

    const middlewares = Array.from(middlewareMap.values()).flat();

    await Promise.all(middlewares.flatMap((r) => r.setup?.()));

    return new Promise((resolve, reject) => {
      logger.info(`Start server process [${process.pid}]`);
      const server = this.server;
      if (server) {
        if (!server.listening) {
          server.listen(_port, _host, () => {
            const address = server.address();
            let rawAddress = "unknown";
            if (address) {
              if (isString(address)) {
                rawAddress = address;
              } else {
                rawAddress = `${address.address}:${address.port}`;
                _port = address.port;
              }
            }
            logger.info(`Server listening on ${_protocol}://${rawAddress}`);
            logger.info(
              `Application ready for Fourze Server v${FOURZE_VERSION}`
            );
            resolve(server);
            app.emit("ready");
          });
        } else {
          reject(
            new Error(
              `Server is already listening on ${_protocol}://${normalizeAddress(
                server.address()
              )}`
            )
          );
        }
      } else {
        reject(new Error("Server is not defined"));
      }
    });
  };

  app.close = function () {
    this.server?.close();
    return this;
  };

  Object.defineProperties(app, {
    port: {
      get() {
        return _port;
      },
      set(port: string | number) {
        _port = Number(port);
      }
    },
    origin: {
      get() {
        return `${_protocol}://${_host}:${_port}`;
      }
    },

    server: {
      get() {
        return _server;
      }
    },
    protocol: {
      get() {
        return _protocol;
      }
    }
  });

  return app;
}
