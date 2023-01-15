import type { FourzeContextOptions } from "@fourze/core";
import {
  FOURZE_VERSION,
  createApp,
  createLogger,
  isDef,
  isNode
} from "@fourze/core";
import { createProxyFetch } from "./fetch";
import { createProxyRequest } from "./request";
import type {
  FourzeMockApp,
  FourzeMockAppOptions,
  FourzeMockRequestMode
} from "./shared";
import { FOURZE_MOCK_APP_SYMBOL } from "./shared";
import { createProxyXMLHttpRequest } from "./xhr";

export function createMockApp(
  options: FourzeMockAppOptions = {}
): FourzeMockApp {
  const logger = createLogger("@fourze/mock");

  const app = createApp(options) as FourzeMockApp;

  logger.info("Fourze Mock is starting...");
  logger.info(`Powered by Fourze v${FOURZE_VERSION}`);

  const mode = options.mode ?? (isNode() ? ["request"] : ["xhr", "fetch"]);
  const autoEnable = options.autoEnable ?? true;
  const activeMode = new Set<FourzeMockRequestMode>(mode);

  const origin = options.origin ?? globalThis.location?.origin ?? "";

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

  if (mode.includes("request") && isNode()) {
    const http = require("http");
    const https = require("https");

    app.originalHttpRequest = http.request;
    app.originalHttpsRequest = https.request;

    app.request = createProxyRequest(app) as typeof http.request;
  }

  if (mode.includes("xhr")) {
    const XMLHttpRequest = globalThis.XMLHttpRequest;
    app.originalXMLHttpRequest = XMLHttpRequest;
    app.XmlHttpRequest = createProxyXMLHttpRequest(
      app
    ) as unknown as typeof XMLHttpRequest;
  }

  if (mode.includes("fetch")) {
    app.originalFetch = globalThis.fetch;
    app.fetch = createProxyFetch(app) as typeof fetch;
  }

  app.enable = function (_mode?: FourzeMockRequestMode[]) {
    _mode = _mode ?? Array.from(mode);
    _mode.forEach((m) => activeMode.add(m));

    if (mode.includes("fetch")) {
      globalThis.fetch = this.fetch;
    }
    if (mode.includes("xhr")) {
      globalThis.XMLHttpRequest = this.XmlHttpRequest;
    }
    if (mode.includes("request")) {
      const http = require("http") as typeof import("http");
      const https = require("https") as typeof import("https");
      http.request = this.request;
      https.request = this.request;
    }
    logger.success(`Fourze Mock is enabled for [${_mode.join(",")}]`);
    return this;
  };

  app.disable = function (_mode?: FourzeMockRequestMode[]) {
    _mode = _mode ?? Array.from(mode);
    _mode.forEach((m) => activeMode.delete(m));

    if (_mode.includes("fetch")) {
      globalThis.fetch = this.originalFetch;
    }
    if (_mode.includes("xhr")) {
      globalThis.XMLHttpRequest = this.originalXMLHttpRequest;
    }
    if (_mode.includes("request") && isNode()) {
      const http = require("http") as typeof import("http");
      const https = require("https") as typeof import("https");
      http.request = this.originalHttpRequest;
      https.request = this.originalHttpsRequest;
    }
    logger.success(`Fourze Mock is disabled for [${_mode.join(",")}]`);
    return this;
  };

  const _service = app.service.bind(app);

  app.service = function (context: FourzeContextOptions, fallback) {
    return _service({
      ...context,
      url: context.url.replace(origin, "")
    }, fallback);
  };

  Object.defineProperties(app, {
    activeModes: {
      get() {
        return Array.from(activeMode);
      }
    },
    enabled: {
      get() {
        return app.activeModes.length > 0;
      }
    },
    [FOURZE_MOCK_APP_SYMBOL]: {
      get() {
        return true;
      }
    }
  });

  if (autoEnable) {
    app.enable();
  }

  app.use(async (req, res, next) => {
    if (!req.headers["X-Fourze-Mock"]) {
      req.headers["X-Fourze-Mock"] = "on";
    }
    await next?.();
  });

  return app;
}

export function getGlobalMockRouter() {
  return globalThis.__FOURZE_MOCK_APP__;
}

export function isMockRouter(router: any): router is FourzeMockApp {
  return !!router && router[FOURZE_MOCK_APP_SYMBOL];
}
