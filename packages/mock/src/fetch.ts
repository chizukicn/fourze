import type { FourzeResponse } from "@fourze/core";
import type { FourzeMockApp } from "./shared";
import {
  createLogger,
  flatHeaders,
  getHeaderValue,
  isString,
  isURL,
  normalizeRoute,
  parseJson,
  PolyfillHeaders
} from "@fourze/core";

class ProxyFetchResponse implements Response {
  readonly url: string;

  readonly statusText: string = "OK";

  readonly status: number = 200;

  readonly headers: Headers;

  readonly ok: boolean = true;

  readonly body: ReadableStream<Uint8Array> | null = null;

  readonly payload: any;

  bodyUsed = false;

  redirected = false;

  type: ResponseType = "basic";

  _response: FourzeResponse;

  constructor(response: FourzeResponse) {
    this.url = response.url;
    this.status = response.statusCode;
    this.statusText = response.statusMessage;
    this.payload = response.payload ?? "";
    this.headers = new PolyfillHeaders(response.getHeaders());
    this._response = response;
  }

  async arrayBuffer() {
    return new Blob([this.payload]).arrayBuffer();
  }

  async blob(): Promise<Blob> {
    return new Blob([this.payload]);
  }

  async formData() {
    const formData = new FormData();
    for (const [key, value] of Object.entries(this.payload)) {
      formData.append(key, value as any);
    }
    return formData;
  }

  async json() {
    return parseJson(String(this.payload));
  }

  clone(): Response {
    return new ProxyFetchResponse(this._response);
  }

  async text() {
    return String(this.payload);
  }

  async raw() {
    return this.payload;
  }
}

export function createProxyFetch(app: FourzeMockApp) {
  const logger = createLogger("@fourze/mock");
  const originalFetch = app.originalFetch;

  if (!originalFetch) {
    logger.warn("globalThis.fetch is not defined");
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    let method = "GET";
    let body: any;
    if (isString(input) || isURL(input)) {
      url = input.toString();
      method = init?.method ?? method;
      body = init?.body ?? {};
    } else {
      url = input.url;
      method = input.method ?? init?.method ?? method;
      body = input.body ?? init?.body ?? {};
    }

    const headers = flatHeaders(init?.headers);
    const useMock = getHeaderValue(headers, "X-Fourze-Mock");
    if (["0", "off", "false"].includes(useMock)) {
      logger.debug(
        `X-Fourze-Mock is off, fallback to original ${normalizeRoute(
          url,
          method
        )}.`
      );
    } else {
      headers["X-Request-With"] = "Fourze Fetch Proxy";
      let isMatched = true;
      const { response } = await app.service({
        url,
        method,
        body,
        headers
      }, async () => {
        isMatched = false;
      });

      if (isMatched) {
        return new ProxyFetchResponse(response);
      }
      logger.debug(
        `No matched mock for ${normalizeRoute(url, method)}, fallback to original.`
      );
    }
    return originalFetch(input, init);
  };
}
