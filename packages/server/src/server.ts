import type EventEmitter from "events";
import type { IncomingMessage, OutgoingMessage, Server } from "http";
import http from "http";
import https from "https";
import type { AddressInfo } from "net";
import {
  FOURZE_VERSION,
  createApp,
  createLogger,
  createServiceContext,
  isString,
  overload
} from "@fourze/core";
import type {
  FourzeApp,
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

  listen(port?: number, host?: string): Promise<Server>

  use(path: string, ...middlewares: FourzeMiddleware[]): this

  use(...middleware: FourzeMiddleware[]): this

  close(): Promise<void>
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

export function createServer(): FourzeServer;

export function createServer(app: FourzeApp): FourzeServer;

export function createServer(options: FourzeServerOptions): FourzeServer;

export function createServer(app: FourzeApp, options: FourzeServerOptions): FourzeServer;

export function createServer(...args: [FourzeApp, FourzeServerOptions] | [FourzeApp] | [FourzeServerOptions]): FourzeServer {
  const { app = createApp(), options = {} } = overload<{ app?: FourzeApp; options?: FourzeServerOptions }>([
    {
      name: "app",
      type: "function"
    }, {
      name: "options",
      type: "object"
    }
  ], args);

  let _host = options.host ?? "localhost";
  let _port = options.port ?? 7609;
  let _server = options.server;

  const _protocol = options.protocol ?? "http";

  const logger = options.logger ?? createLogger("@fourze/server");

  const serverApp = async function (
    req: IncomingMessage,
    res: OutgoingMessage,
    next?: FourzeNext
  ) {
    const context = await createServerContext(req, res);
    const { request, response } = context;

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

      serverApp.emit("request", context);
    } catch (error) {
      serverApp.emit("error", error, context);
      if (!response.writableEnded) {
        response.sendError(500, "Internal Server Error");
        response.end();
      }
    }
  } as FourzeServer;

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
            serverApp.emit("ready");
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

  return serverApp;
}
