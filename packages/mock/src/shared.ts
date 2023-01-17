/* eslint-disable vars-on-top */
/* eslint-disable no-var */
import type http from "http";
import type https from "https";
import type { FourzeApp, FourzeAppOptions } from "@fourze/core";

declare global {
  var __FOURZE_MOCK_APP__: FourzeMockApp;

  var __FOURZE_VERSION__: string;
}

export type FourzeMockRequestMode = "xhr" | "fetch" | "request";

export interface FourzeMockAppOptions extends Exclude<FourzeAppOptions, "setup"> {
  base?: string
  /**
   * @default ["xhr","fetch"]
   */
  mode?: FourzeMockRequestMode[]

  origin?: string

  port?: string

  host?: string

  autoEnable?: boolean

  global?: boolean
}

export const FOURZE_MOCK_APP_SYMBOL = Symbol("FOURZE_MOCK_APP_SYMBOL");

export interface FourzeMockApp extends FourzeApp {
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

  [FOURZE_MOCK_APP_SYMBOL]: true
}

export {};
