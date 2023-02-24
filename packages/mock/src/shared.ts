import type http from "http";
import type https from "https";
import type { DelayMsType, FourzeApp, FourzeAppOptions } from "@fourze/core";

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

  delay?: DelayMsType

  timeout?: number
}

export const FOURZE_MOCK_APP_SYMBOL = Symbol("FOURZE_MOCK_APP_SYMBOL");

export interface FourzeMockApp extends FourzeApp {
  originalFetch: typeof fetch
  originalXMLHttpRequest: typeof XMLHttpRequest
  originalHttpRequest: typeof http.request
  originalHttpsRequest: typeof https.request

  XMLHttpRequest: typeof XMLHttpRequest
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

