import type { IncomingMessage, OutgoingMessage } from "http";
import type { FourzeRequest } from "./request";
import { createRequest } from "./request";
import type { FourzeResponse } from "./response";
import { createResponse } from "./response";

export interface FourzeContextOptions {
  url: string
  method?: string
  headers?: Record<string, string | string[] | number | undefined>
  body?: any
  request?: IncomingMessage
  response?: OutgoingMessage
  contextPath?: string
}

export interface FourzeServiceContext {
  request: FourzeRequest
  response: FourzeResponse
}

export function createServiceContext(options: FourzeContextOptions) {
  const { url, method = "GET", headers = {}, body } = options;
  const request = createRequest({
    url,
    method,
    headers,
    body,
    request: options.request
  });
  const response = createResponse({
    url,
    method,
    request,
    response: options.response
  });

  return {
    request,
    response
  };
}
