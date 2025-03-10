import type {
  CommonMiddleware,
  FourzeApp,
  FourzeLogger,
  FourzeMiddleware,
  FourzeMiddlewareHandler,
  FourzeModule,
  FourzeServiceContext,
  PropType
} from "@fourze/core";
import type EventEmitter from "node:events";
import type { IncomingMessage, OutgoingMessage, Server } from "node:http";
import http from "node:http";
import https from "node:https";
import process from "node:process";
import {
  createApp,
  createLogger,
  createServiceContext,
  FOURZE_VERSION,
  injectEventEmitter,
  overload
} from "@fourze/core";
import { isAddressInfo, normalizeAddress } from "./utils";

export interface FourzeServerOptions {
  host?: string;
  port?: number;
  server?: Server;
  protocol?: "http" | "https";
  logger?: FourzeLogger;
}

export interface FourzeServer extends EventEmitter, CommonMiddleware {

  host: string;
  port: number;

  readonly origin: string;

  readonly server?: Server;

  readonly protocol: "http" | "https";

  listen: (port?: number, host?: string) => Promise<Server>;

  use: ((path: string, ...modules: FourzeModule[]) => this) & ((...modules: FourzeModule[]) => this);

  close: () => Promise<void>;
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

  let _host = options.host;
  let _port = options.port;
  let _server = options.server;
  let _origin: string | null = null;

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
        }
      });

      serverApp.emit("request", { request, response });
    } catch (error: any) {
      serverApp.emit("error", error, { request, response });
      if (!response.writableEnded) {
        response.sendError(500, "Internal Server Error");
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

  serverApp.listen = async function (port?: number, hostname?: string) {
    _port = port ?? _port;
    _host = hostname ?? _host;
    _server = _server ?? _createServer();

    await app.ready();

    return new Promise((resolve, reject) => {
      logger.info(`Start server process [${process.pid}]`);
      const server = this.server;
      if (server) {
        if (!server.listening) {
          server.listen(_port, _host, async () => {
            const address = server.address();
            if (isAddressInfo(address)) {
              _host = address.address;
              _port = address.port;
              _origin = normalizeAddress(address, {
                protocol: _protocol
              });
            }

            logger.info(`Fourze Server v${FOURZE_VERSION} listening on ${serverApp.origin}.`);
            resolve(server);
            serverApp.emit("ready");
          });
        } else {
          reject(
            new Error(
              `Server is already listening on ${_port}`
            )
          );
        }
      } else {
        reject(new Error("Server is not defined"));
      }
    });
  };

  serverApp.use = function (
    ...args: [string, ...FourzeModule[]] | FourzeModule[]
  ) {
    app.use(...args as FourzeModule[]);
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
        return _origin || `${_protocol}://${_host}:${_port}`;
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

    const readBody = (chunk: Buffer) => {
      body = Buffer.concat([body, chunk]);
    };

    req.on("data", readBody);

    req.once("end", () => {
      const context = createServiceContext({
        url: req.url!,
        method: req.method ?? "GET",
        headers: req.headers,
        body,
        request: req,
        response: res
      });
      req.off("data", readBody);
      resolve(context);
    });

    req.once("error", reject);
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
    if (request.url?.match(path)) {
      const context = await createServerContext(request, response);
      return handler(context.request, context.response, next!);
    }
    await next?.();
  };
}
