import type { DelayMsType, FourzeApp, FourzeAppOptions } from "@fourze/core";
import type http from "node:http";
import type https from "node:https";

export type FourzeMockRequestMode = "xhr" | "fetch" | "request";

export interface FourzeMockAppOptions extends Exclude<FourzeAppOptions, "setup"> {
  base?: string;
  /**
   * @default ["xhr","fetch"]
   */
  mode?: FourzeMockRequestMode[];

  host?: string | string[];

  protocol?: "http" | "https";

  autoEnable?: boolean;

  global?: boolean;

  delay?: DelayMsType;

  timeout?: number;
}

export const FourzeMockAppFlag = "__isFourzeMockApp";

export interface FourzeMockApp extends FourzeApp {
  originalFetch: typeof fetch;
  originalXMLHttpRequest: typeof XMLHttpRequest;
  originalHttpRequest: typeof http.request;
  originalHttpsRequest: typeof https.request;

  XMLHttpRequest: typeof XMLHttpRequest;
  fetch: typeof fetch;
  request: typeof http.request;

  enabled: boolean;

  enable: (() => this) & ((modes: FourzeMockRequestMode[]) => this);

  disable: (() => this) & ((modes: FourzeMockRequestMode[]) => this);

  activeModes: FourzeMockRequestMode[];

  [FourzeMockAppFlag]: true;
}
