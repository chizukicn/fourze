import type http from "node:http";
import type { FourzeContextOptions } from "@fourze/core";
import {
  FOURZE_VERSION,
  createApp,
  createLogger,
  defineMiddleware,
  isArray,
  isDef,
  isNode
} from "@fourze/core";
import { createDelayMiddleware, createTimeoutMiddleware } from "@fourze/middlewares";
import { createProxyRequest } from "./request";

import type {
  FourzeMockApp,
  FourzeMockAppOptions,
  FourzeMockRequestMode
} from "./shared";
import { FOURZE_MOCK_APP_SYMBOL } from "./shared";
import { createProxyFetch } from "./fetch";
import { createProxyXMLHttpRequest } from "./xhr";

export function createMockApp(
  options: FourzeMockAppOptions = {}
): FourzeMockApp {
  const logger = createLogger("@fourze/mock");

  const app = createApp(options) as FourzeMockApp;

  logger.info(`Fourze Mock is ready on ${FOURZE_VERSION}`);

  const mode = options.mode ?? (isNode() ? ["request"] : ["xhr", "fetch"]);
  const autoEnable = options.autoEnable ?? true;
  const activeMode = new Set<FourzeMockRequestMode>(mode);

  const _host = options.host ?? globalThis.location?.host ?? "http://localhost";

  const hosts = isArray(_host) ? _host : [_host];

  const protocol = options.protocol;

  const injectGlobal = options.global ?? true;

  if (injectGlobal) {
    if (isDef(globalThis.__FOURZE_MOCK_APP__)) {
      logger.warn(
        "Fourze Mock is already started, please do not start it again."
      );
    }
    globalThis.__FOURZE_MOCK_APP__ = app;
    globalThis.__FOURZE_VERSION__ = FOURZE_VERSION;
  }

  if (options.timeout) {
    app.use(createTimeoutMiddleware(options.timeout));
  }

  if (options.delay) {
    app.use(createDelayMiddleware(options.delay));
  }

  const notSupport = () => {
    throw new Error("Not support request in browser.");
  };

  let _request: typeof http.request;

  if (isNode()) {
    const http = require("node:http");
    const https = require("node:https");

    app.originalHttpRequest = http.request;
    app.originalHttpsRequest = https.request;
    _request = createProxyRequest(app) as typeof http.request;
  } else {
    app.originalHttpRequest = notSupport;
    app.originalHttpsRequest = notSupport;
    _request = notSupport;
  }

  app.originalFetch = globalThis.fetch;
  const _fetch = createProxyFetch(app) as typeof globalThis.fetch;

  app.originalXMLHttpRequest = globalThis.XMLHttpRequest;
  const _xhr = createProxyXMLHttpRequest(app) as unknown as typeof globalThis.XMLHttpRequest;

  Object.defineProperties(app, {
    XMLHttpRequest: {
      get() {
        if (activeMode.has("xhr")) {
          return _xhr;
        }
        return app.originalXMLHttpRequest;
      },
      enumerable: true
    },
    request: {
      get() {
        if (activeMode.has("request")) {
          return _request;
        }
        return app.originalHttpRequest;
      },
      enumerable: true
    },
    fetch: {
      get() {
        if (activeMode.has("fetch")) {
          return _fetch;
        }
        return app.originalFetch;
      },
      enumerable: true
    },
    activeModes: {
      get() {
        return Array.from(activeMode);
      },
      enumerable: true
    },
    enabled: {
      get() {
        return app.activeModes.length > 0;
      },
      enumerable: true
    },
    [FOURZE_MOCK_APP_SYMBOL]: {
      get() {
        return true;
      },
      enumerable: true
    }
  });

  app.enable = (_mode?: FourzeMockRequestMode[]) => {
    _mode = _mode ?? Array.from(mode);
    _mode.forEach((m) => activeMode.add(m));

    if (injectGlobal) {
      if (_mode.includes("xhr")) {
        globalThis.XMLHttpRequest = app.XMLHttpRequest;
      }
      if (_mode.includes("fetch")) {
        globalThis.fetch = app.fetch;
      }
      if (isNode() && activeMode.has("request")) {
        const http = require("node:http") as typeof import("http");
        const https = require("node:https") as typeof import("https");
        http.request = app.request;
        https.request = app.request;
      }
    }
    logger.success(`Fourze Mock is enabled for [${_mode.join(",")}]`);
    return app;
  };

  app.disable = function (_mode?: FourzeMockRequestMode[]) {
    _mode = _mode ?? Array.from(mode);
    _mode.forEach((m) => activeMode.delete(m));
    if (injectGlobal) {
      if (_mode.includes("xhr")) {
        globalThis.XMLHttpRequest = app.originalXMLHttpRequest;
      }
      if (_mode.includes("fetch")) {
        globalThis.fetch = app.originalFetch;
      }
      if (_mode.includes("request") && isNode()) {
        const http = require("node:http") as typeof import("http");
        const https = require("node:https") as typeof import("https");
        http.request = this.originalHttpRequest;
        https.request = this.originalHttpsRequest;
      }
    }
    logger.success(`Fourze Mock is disabled for [${_mode.join(",")}]`);
    return this;
  };

  const _service = app.service.bind(app);

  const resolveUrl = (_url: string) => {
    const url = new URL(_url, globalThis.location?.origin ?? "http://localhost");
    if ((hosts.includes(url.host) || hosts.includes(url.origin)) && (!protocol || url.protocol === protocol)) {
      _url = `${url.pathname}${url.search}${url.hash}`;
    }
    return _url;
  };

  app.service = async function (context: FourzeContextOptions, fallback) {
    logger.debug(`Fourze Mock is processing [${context.url}]`, resolveUrl(context.url));
    return _service({
      ...context,
      url: resolveUrl(context.url)
    }, fallback);
  };

  if (autoEnable) {
    app.enable();
  }

  app.use(defineMiddleware("FourzeMockHeader", async (req, res, next) => {
    if (!req.headers["X-Fourze-Mock"]) {
      req.headers["X-Fourze-Mock"] = "on";
    }
    await next?.();
  }));

  return app;
}

export function getGlobalMockApp() {
  return globalThis.__FOURZE_MOCK_APP__;
}

export function isMockApp(app: any): app is FourzeMockApp {
  return !!app && app[FOURZE_MOCK_APP_SYMBOL];
}

