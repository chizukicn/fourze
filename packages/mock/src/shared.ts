/* eslint-disable vars-on-top */
/* eslint-disable no-var */
import type http from "http";
import type https from "https";
import type { FourzeRouter, FourzeRouterOptions } from "@fourze/core";

declare global {
  var __FOURZE_MOCK_ROUTER__: FourzeMockRouter;

  var __FOURZE_VERSION__: string;
}

export type FourzeMockRequestMode = "xhr" | "fetch" | "request";

export interface FourzeMockRouterOptions extends FourzeRouterOptions {
  base?: string
  /**
   * @default ["xhr","fetch"]
   */
  mode?: FourzeMockRequestMode[]

  port?: string

  host?: string

  autoEnable?: boolean

  global?: boolean
}

export const FOURZE_MOCK_ROUTER_SYMBOL = Symbol("FOURZE_MOCK_ROUTER_SYMBOL");

export interface FourzeMockRouter extends FourzeRouter {
  originalFetch: typeof fetch
  originalXMLHttpRequest: typeof XMLHttpRequest
  originalHttpRequest: typeof http.request
  originalHttpsRequest: typeof https.request

  XmlHttpRequest: typeof XMLHttpRequest
  fetch: typeof fetch
  request: typeof http.request

  enabled: boolean

  enable(): this

  enable(modes: FourzeMockRequestMode[]): this

  disable(): this

  disable(modes: FourzeMockRequestMode[]): this

  activeModes: FourzeMockRequestMode[]

  [FOURZE_MOCK_ROUTER_SYMBOL]: true
}

export {};
