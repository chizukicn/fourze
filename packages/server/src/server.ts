import type EventEmitter from "events";
import type { IncomingMessage, OutgoingMessage, Server } from "http";
import http from "http";
import https from "https";
import {
  FOURZE_VERSION,
  createApp,
  createLogger,
  createServiceContext,
  isMatch,
  overload
} from "@fourze/core";
import type {
  CommonMiddleware,
  FourzeApp,
  FourzeLogger,
  FourzeMiddleware,
  FourzeMiddlewareHandler,
  FourzeServiceContext
  ,
  PropType
} from "@fourze/core";
import { injectEventEmitter, normalizeAddress } from "./utils";

export interface FourzeServerOptions {
  host?: string
  port?: number
  server?: Server
  protocol?: "http" | "https"
  logger?: FourzeLogger
}

export interface FourzeServer extends EventEmitter, CommonMiddleware {

  host: string
  port: number

  readonly origin: string

  readonly server?: Server
  readonly protocol: "http" | "https"

  listen(port?: number, host?: string): Promise<Server>

  use(path: string, ...middlewares: FourzeMiddleware[]): this

  use(...middleware: FourzeMiddleware[]): this

  close(): Promise<void>
}

export function createServer(): FourzeServer;

export function createServer(app: FourzeApp): FourzeServer;

export function createServer(options: FourzeServerOptions): FourzeServer;

export function createServer(app: FourzeApp, options: FourzeServerOptions): FourzeServer;

export function createServer(...args: [FourzeApp, FourzeServerOptions] | [FourzeApp] | [FourzeServerOptions]): FourzeServer {
  const { app, options } = overload({
    app: {
      type: Function as PropType<FourzeApp>,
      default() {
        return createApp();
      }
    },
    options: {
      type: Object as PropType<FourzeServerOptions>,
      default() {
        return {};
      }
    }
  }, args);

  let _host = options.host ?? "localhost";
  let _port = options.port ?? 7609;
  let _server = options.server;

  const _protocol = options.protocol ?? "http";

  const logger = options.logger ?? createLogger("@fourze/server");

  const serverApp = connect(async (request, response, next) => {
    try {
      await app(request, response, async () => {
        if (next) {
          await next();
        } else if (!response.writableEnded) {
          response.sendError(
            404,
            `Cannot ${request.method} ${request.url ?? "/"}`
          );
          response.end();
        }
      });

      serverApp.emit("request", { request, response });
    } catch (error) {
      serverApp.emit("error", error, { request, response });
      if (!response.writableEnded) {
        response.sendError(500, "Internal Server Error");
        response.end();
      }
    }
  }) as FourzeServer;

  injectEventEmitter(serverApp);

  serverApp.on("error", (error) => {
    logger.error(error);
  });

  const _createServer = function () {
    switch (_protocol) {
      case "https":
        _server = https.createServer(serverApp);
        break;
      case "http":
      default:
        _server = http.createServer(serverApp);
        break;
    }
    return _server;
  };

  serverApp.listen = async function (port: number, hostname = "localhost") {
    _port = port ?? _port;
    _host = hostname ?? _host;
    _server = _server ?? _createServer();

    await app.ready();

    return new Promise((resolve, reject) => {
      logger.info(`Start server process [${process.pid}]`);
      const server = this.server;
      if (server) {
        if (!server.listening) {
          server.listen(_port, _host, () => {
            const address = server.address();
            if (typeof address === "object" && !!address) {
              serverApp.host = address.address;
              serverApp.port = address.port;
            }
            logger.info(`Fourze Server v${FOURZE_VERSION} listening on ${normalizeAddress(address, _protocol)}}.`);
            resolve(server);
            serverApp.emit("ready");
          });
        } else {
          reject(
            new Error(
              `Server is already listening on ${normalizeAddress(server.address(), _protocol)}`
            )
          );
        }
      } else {
        reject(new Error("Server is not defined"));
      }
    });
  };

  serverApp.use = function (
    ...args: [string, ...FourzeMiddleware[]] | FourzeMiddleware[]
  ) {
    app.use(...args as FourzeMiddleware[]);
    return this;
  };

  serverApp.close = function () {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error("Server is not defined"));
      }
    });
  };

  Object.defineProperties(serverApp, {
    port: {
      get() {
        return _port;
      },
      set(port: string | number) {
        _port = Number(port);
      },
      enumerable: true
    },
    origin: {
      get() {
        return `${_protocol}://${_host}:${_port}`;
      },
      enumerable: true
    },

    server: {
      get() {
        return _server;
      },
      enumerable: true
    },
    protocol: {
      get() {
        return _protocol;
      },
      enumerable: true
    }
  });

  return serverApp;
}

export function createServerContext(
  req: IncomingMessage,
  res: OutgoingMessage
): Promise<FourzeServiceContext> {
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

export function connect(path: string, handler: FourzeMiddlewareHandler): CommonMiddleware;

export function connect(handler: FourzeMiddlewareHandler): CommonMiddleware;

export function connect(...args: [string, FourzeMiddleware] | [FourzeMiddlewareHandler]): CommonMiddleware {
  const { path, handler } = overload({
    path: {
      type: String,
      default: "/"
    },
    handler: {
      type: Function as PropType<FourzeMiddlewareHandler>,
      required: true
    }
  }, args);
  return async (request, response, next) => {
    if (isMatch(request.url!, path)) {
      const context = await createServerContext(request, response);
      return handler(context.request, context.response, next!);
    }
    await next?.();
  };
}
