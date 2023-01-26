import type { IncomingMessage, OutgoingMessage, ServerResponse } from "http";
import type { MaybePromise, MaybeRegex } from "maybe-types";
import qs from "query-string";

import { version } from "../package.json";
import {
  isDef,
  isFunction,
  isObject,
  isString,
  isUint8Array,
  overload,
  relativePath,
  resolvePath
} from "./utils";
import { decodeFormData } from "./polyfill/form-data";
import type { PolyfillHeaderInit } from "./polyfill/header";
import { flatHeaders, getHeaderValue } from "./polyfill/header";
import { PolyfillServerResponse } from "./polyfill/response";
import { createLogger } from "./logger";
import type { FourzeMiddlewareNode } from "./app";

export const FOURZE_VERSION = version;

const FOURZE_ROUTE_SYMBOL = Symbol("FourzeRoute");
const FOURZE_REQUEST_SYMBOL = Symbol("FourzeRequest");
const FOURZE_RESPONSE_SYMBOL = Symbol("FourzeResponse");

export type DefaultData = Record<string, unknown>;

export interface FourzeRouteOptions<Props extends ObjectProps = ObjectProps, Meta = Record<string, unknown>> {
  method?: RequestMethod
  props: Props
  meta?: Meta
}

export interface FourzeRouteFunction<This> {

  <
    Method extends RequestMethod, Result = unknown, Props extends ObjectProps = ObjectProps, Meta = Record<string, unknown>
  >(
    path: string,
    method: Method,
    options: FourzeRouteOptions<Props, Meta>,
    handle: FourzeHandle<Result, Props, Meta>
  ): This

  <
    Result = unknown, Props extends ObjectProps = ObjectProps, Meta = Record<string, unknown>
  >(
    path: string,
    options: FourzeRouteOptions<Props, Meta>,
    handle: FourzeHandle<Result, Props, Meta>
  ): This

  <Method extends RequestMethod, Result = unknown>(
    path: string,
    method: Method,
    handle: FourzeHandle<Result>
  ): This

  <Result = unknown>(path: string, handle: FourzeHandle<Result>): This

  <
    Result = unknown, Props extends ObjectProps = ObjectProps, Meta = Record<string, unknown>
  >(
    route: FourzeBaseRoute<Result, Props, Meta>
  ): This
}

export type FourzeRouteGenerator<This> = {
  [K in RequestMethod]: {
    <
      Result = any, Props extends ObjectProps = ObjectProps, Meta = Record<string, any>
    >(
      path: string,
      options: FourzeRouteOptions<Props, Meta>,
      handle: FourzeHandle<Result, Props, Meta>
    ): This
    <Result>(path: string, handle: FourzeHandle<Result>): This
  };
};

export interface FourzeRequest<
  Props extends ObjectProps = ObjectProps, Meta = Record<string, any>, Data = ExtractPropTypes<Props>, Query = ExtractPropTypes<Props, "query">, Body = ExtractPropTypes<Props, "body">, Params = ExtractPropTypes<Props, "path">
> extends IncomingMessage {
  url: string
  method: string
  headers: Record<string, string | string[] | undefined>

  route: FourzeRoute
  meta: Meta

  relative(path: string): string | null

  resolve(path: string): string

  contextPath: string

  readonly params: Params

  readonly query: Query

  readonly body: Body
  /**
   *  {...query, ...params, ...body}
   */
  readonly data: Data

  readonly raw: string

  readonly path: string

  readonly relativePath: string

  readonly [FOURZE_REQUEST_SYMBOL]: true
}

export interface FourzeBaseResponse extends ServerResponse {
  method?: string
}
export interface FourzeResponse extends FourzeBaseResponse {
  json(payload: any): this

  image(payload: Buffer): this

  text(payload: string): this

  binary(payload: Buffer): this

  redirect(url: string): this

  appendHeader(key: string, value: string | string[]): this

  removeHeader(key: string): this

  send(payload: any, contentType?: string | null): this

  getContentType(payload?: any): string | undefined

  setContentType(contentType: string): this

  sendError(code: number, error?: string | Error): this

  readonly url: string

  readonly payload: any

  readonly error: Error | undefined

  readonly [FOURZE_RESPONSE_SYMBOL]: true
}

export interface FourzeBaseRoute<
  Result = unknown, Props extends ObjectProps = ObjectProps, Meta = Record<string, unknown>
> {
  path: string
  method?: RequestMethod
  handle: FourzeHandle<Result, Props, Meta>
  meta?: Meta
  props?: Props
}

// #region  Props
/**
 *  inspired by vue props
 */

export type PropIn = "body" | "query" | "path";

export type ExtractPropTypes<
  P extends Record<string, any>, In extends PropIn | "any" = "any", O = In extends PropIn ? Pick<P, InKeys<P, In>> : P
> = {
  [K in keyof Pick<O, RequiredKeys<O>>]: InferPropType<O[K]>;
} & {
  [K in keyof Pick<O, OptionalKeys<O>>]?: InferPropType<O[K]>;
} & DefaultData;

export type LooseRequired<T> = {
  [P in string & keyof T]: T[P];
};

type RequiredKeys<T> = {
  [K in keyof T]: T[K] extends
  | {
    required: true
  }
  | {
    default: any
  }
  | BooleanConstructor
  | {
    type: BooleanConstructor
  }
    ? T[K] extends {
      default: undefined | (() => undefined)
    }
      ? never
      : K
    : never;
}[keyof T];

type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>;

type InKeys<T, In extends PropIn> = {
  [K in keyof T]: T[K] extends {
    in: In
  }
    ? K
    : never;
}[keyof T];

type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;

type InferPropType<T> = [T] extends [null]
  ? any
  : [T] extends [
      {
        type: null | true
      }
    ]
      ? any
      : [T] extends [
          | ObjectConstructor
          | {
            type: ObjectConstructor
          }
        ]
          ? Record<string, any>
          : [T] extends [
              | BooleanConstructor
              | {
                type: BooleanConstructor
              }
            ]
              ? boolean
              : [T] extends [
                  | DateConstructor
                  | {
                    type: DateConstructor
                  }
                ]
                  ? Date
                  : [T] extends [
                      | (infer U)[]
                      | {
                        type: (infer U)[]
                      }
                    ]
                      ? U extends DateConstructor
                        ? Date | InferPropType<U>
                        : InferPropType<U>
                      : [T] extends [Prop<infer V, infer D>]
                          ? unknown extends V
                            ? IfAny<V, V, D>
                            : V
                          : T;

export type ObjectProps<P = Record<string, unknown>> = {
  [K in keyof P]: Prop<P[K]> | null;
};

export type NormalizedObjectProps<P = Record<string, unknown>> = {
  [K in keyof P]: NormalizedProps<P[K]> | null;
};

type Prop<T, D = T> = PropOptions<T, D> | PropType<T>;

type PropConstructor<T = any> =
  | {
    new(...args: any[]): T & {}
  }
  | {
    (): T
  }
  | PropMethod<T>;

type PropMethod<T, TConstructor = any> = [T] extends [
  ((...args: any) => any) | undefined
]
  ? {
      new(): TConstructor
      (): T
      readonly prototype: TConstructor
    }
  : never;

interface PropOptions<Type = any, Default = Type> {
  type: PropType<Type>
  required?: boolean
  default?: Default | DefaultFactory<Default> | null | undefined | object
  validator?(value: unknown): boolean
  transform?(value: unknown): Type
  meta?: Record<string, any>
  in?: PropIn
}

export interface NormalizedProps<Type = any, Default = Type>
  extends PropOptions<Type, Default> {
  meta: Record<string, any>
  in?: PropIn
  required: boolean
  type: PropType<any>
  default?: Default | DefaultFactory<Default> | null | undefined | object
}

declare type DefaultFactory<T> = (props: DefaultData) => T | null | undefined;

export type PropType<T> = PropConstructor<T> | PropConstructor<T>[];

// #endregion

export interface FourzeRoute<
  Result = unknown, Props extends ObjectProps = ObjectProps, Meta = Record<string, unknown>
> extends FourzeBaseRoute<Result, Props, Meta> {
  readonly [FOURZE_ROUTE_SYMBOL]: true
  readonly pathParams: RegExpMatchArray | string[]
  readonly props: Props
  readonly meta: Meta
  match: (
    url: string,
    method?: string,
    base?: string
  ) => RegExpMatchArray | null
}

export type FourzeNext<T = any> = () => MaybePromise<T>;

export type FourzeHandle<
  R = unknown, Props extends ObjectProps = ObjectProps, Meta = Record<string, unknown>
> = (
  request: FourzeRequest<Props, Meta>,
  response: FourzeResponse
) => MaybePromise<R>;

export const FOURZE_METHODS: RequestMethod[] = [
  "get",
  "post",
  "delete",
  "put",
  "patch",
  "options",
  "head",
  "trace",
  "connect"
];

export type RequestMethod =
  | "get"
  | "post"
  | "delete"
  | "put"
  | "patch"
  | "head"
  | "options"
  | "trace"
  | "connect";

export function isRoute(route: any): route is FourzeRoute<unknown> {
  return !!route && !!route[FOURZE_ROUTE_SYMBOL];
}

const REQUEST_PATH_REGEX = new RegExp(
  `^(${FOURZE_METHODS.join("|")})\\s+`,
  "i"
);

const PARAM_KEY_REGEX = /\{[\w_-]+\}/g;

export function defineRouteProps<Props extends ObjectProps = ObjectProps>(
  props: Props
) {
  return props;
}

export function defineRoute<
  Result = unknown, Props extends ObjectProps = ObjectProps, Meta = Record<string, unknown>
>(
  route: FourzeBaseRoute<Result, Props, Meta> & { base?: string }
): FourzeRoute<Result, Props, Meta> {
  const { handle, meta = {} as Meta, props = {} as Props, base } = route;
  let { method, path } = route;

  if (REQUEST_PATH_REGEX.test(path)) {
    const arr = path.split(/\s+/);
    const m = arr[0].toLowerCase() as RequestMethod;
    if (FOURZE_METHODS.includes(m)) {
      method = m;
      path = arr[1].trim();
    }
  }

  path = resolvePath(path, base ?? "/");

  return {
    method,
    path,
    meta,
    handle,
    match(this: FourzeRoute, url: string, method?: string) {
      if (
        !this.method
        || !method
        || this.method.toLowerCase() === method.toLowerCase()
      ) {
        let pattern = path.replace(PARAM_KEY_REGEX, "([a-zA-Z0-9_-\\s]+)?");
        if (!pattern.startsWith("*")) {
          pattern = `^${pattern}`;
        }
        if (!pattern.endsWith("*")) {
          pattern = `${pattern}$`;
        }
        const regex = new RegExp(pattern, "i");
        return url.match(regex);
      }
      return null;
    },
    get pathParams() {
      return this.path.match(PARAM_KEY_REGEX) ?? [];
    },
    get props() {
      return props;
    },
    get [FOURZE_ROUTE_SYMBOL](): true {
      return true;
    }
  };
}

export interface FourzeInstance {
  name?: string
  base?: string
  routes: FourzeRoute[]
}

export interface FourzeApp extends FourzeMiddleware {
  use(path: string, ...middlewares: FourzeMiddleware[]): this

  use(...middleware: FourzeMiddleware[]): this

  use(plugin: FourzePlugin): this

  remove(name: string): this

  /**
   *  是否允许
   * @param url
   */
  isAllow(url: string): boolean

  allow(...rules: MaybeRegex[]): this

  deny(...rules: MaybeRegex[]): this

  relative(url: string): string | null

  getMiddlewares(): FourzeMiddlewareNode[]

  match(url: string): FourzeMiddleware[]

  service(context: FourzeContextOptions, fallback?: FourzeHandle): Promise<FourzeContext>

  ready(): Promise<void>

  readonly base: string

  readonly middlewares: FourzeMiddleware[]

  readonly isReady: boolean

}

export interface CommonMiddleware {
  (
    req: IncomingMessage,
    res: OutgoingMessage,
    next?: FourzeNext
  ): MaybePromise<void>
}

export interface FourzeMiddlewareHandler<T = any> {
  (
    req: FourzeRequest,
    res: FourzeResponse,
    next: FourzeNext<T>
  ): MaybePromise<T>
}

export interface FourzeMiddleware<T = any> extends FourzeMiddlewareHandler<T> {
  name?: string
  base?: string
  setup?: (app: FourzeApp) => MaybePromise<void>
  readonly order?: number
}

export interface FourzeResponseOptions {
  url: string
  method: string
  response?: OutgoingMessage
}

export function normalizeProps<T>(
  props: ObjectProps<T>
): NormalizedObjectProps<T> {
  const result = {} as NormalizedObjectProps<T>;
  for (const name in props) {
    const key = name;
    const prop = props[name];
    if (!isFunction(prop) && !Array.isArray(prop) && !!prop) {
      result[key] = {
        type: prop.type,
        meta: {
          ...prop.meta
        },
        default: prop.default,
        required: prop.default ? false : prop.required ?? false
      };
    }
  }
  return result;
}

export function createResponse(options: FourzeResponseOptions) {
  const response = (options?.response
    ?? new PolyfillServerResponse()) as FourzeResponse;
  const logger = createLogger("@fourze/core");

  let _payload: any;
  let _error: Error;

  response.setContentType = function (contentType) {
    if (!response.headersSent) {
      response.setHeader("Content-Type", contentType);
    }
    return this;
  };

  response.getContentType = function (data) {
    let contentType: string = getHeaderValue(this.getHeaders(), "Content-Type");
    if (!contentType && isDef(data)) {
      if (isUint8Array(data)) {
        contentType = "application/octet-stream";
      } else if (isObject(data)) {
        contentType = "application/json";
      } else if (isString(data)) {
        contentType = "text/plain";
      }
    }
    return contentType;
  };

  response.send = function (payload: any, contentType?: string) {
    contentType = contentType ?? this.getContentType(payload);
    switch (contentType) {
      case "application/json":
        payload = JSON.stringify(payload);
        break;
      case "text/plain":
      case "text/html":
        payload = payload.toString();
        break;
      default:
        break;
    }
    if (contentType) {
      response.setContentType(contentType);
    }
    _payload = payload;
    this.end(_payload);
    return this;
  };

  response.sendError = function (code = 500, error: Error | string) {
    _error = typeof error === "string" ? new Error(error) : error;
    this.statusCode = code;
    logger.error(error);
    return this;
  };

  response.appendHeader = function (
    name: string,
    value: string | ReadonlyArray<string> | number
  ) {
    const oldValue = this.getHeader(name);
    if (isDef(oldValue)) {
      this.setHeader(
        name,
        [oldValue, value]
          .flat()
          .filter((r) => !!r)
          .join(",")
      );
    } else {
      this.setHeader(name, value);
    }
    return this;
  };

  response.json = function (payload: any) {
    return this.send(payload, "application/json");
  };

  response.binary = function (payload: Buffer) {
    return this.send(payload, "application/octet-stream");
  };

  response.image = function (payload: Buffer) {
    return this.send(payload, "image/jpeg");
  };

  response.text = function (payload: string) {
    return this.send(payload, "text/plain");
  };

  response.redirect = function (url: string) {
    this.statusCode = 302;
    this.setHeader("Location", url);
    return this;
  };

  response.setHeader("X-Powered-By", `Fourze Server/v${FOURZE_VERSION}`);

  Object.defineProperties(response, {
    [FOURZE_RESPONSE_SYMBOL]: {
      get() {
        return true;
      }
    },
    url: {
      get() {
        return options.url;
      }
    },
    payload: {
      get() {
        return _payload;
      }
    },
    error: {
      get() {
        return _error;
      }
    },

    method: {
      get() {
        return options.method;
      }
    }
  });

  return response;
}

export interface FourzeContextOptions {
  url: string
  method?: string
  headers?: Record<string, string | string[] | number | undefined>
  body?: any
  request?: IncomingMessage
  response?: OutgoingMessage
  contextPath?: string
}

export interface FourzeContext {
  request: FourzeRequest
  response: FourzeResponse
}

export function createServiceContext(options: FourzeContextOptions) {
  const { url, method = "GET", headers = {}, body } = options;
  const request = createRequest({
    url,
    method,
    headers: flatHeaders(headers),
    body,
    request: options.request
  });
  const response = createResponse({
    url,
    method,
    response: options.response
  });

  return {
    request,
    response
  };
}

export interface FourzeRequestOptions {
  url: string
  method?: string
  headers?: PolyfillHeaderInit
  body?: any
  params?: Record<string, any>
  request?: IncomingMessage
}

export function createRequest(options: FourzeRequestOptions) {
  const request = ({
    url: options.url ?? options.request?.url,
    method: options.method ?? options.request?.method
  }) as FourzeRequest;

  request.url = options.url ?? request.url;
  request.method = request.method ?? "GET";

  request.meta = {};

  const headers = {
    ...flatHeaders(request.headers),
    ...flatHeaders(options.headers)
  };

  request.headers = headers;

  const { query = {}, url: path } = qs.parseUrl(request.url, {
    parseBooleans: true
  });

  const contentType = getHeaderValue(
    headers,
    "Content-Type",
    "application/json"
  );

  const bodyRaw: Buffer | string | Record<string, any>
    = options.body ?? request.body ?? {};
  let body: Record<string, any> = {};
  if (isUint8Array(bodyRaw) || isString(bodyRaw)) {
    if (bodyRaw.length > 0) {
      if (contentType.startsWith("application/json")) {
        body = JSON.parse(bodyRaw.toString("utf-8"));
      } else if (contentType.startsWith("application/x-www-form-urlencoded")) {
        body = qs.parse(bodyRaw.toString("utf-8"));
      }

      if (contentType.startsWith("multipart/form-data")) {
        const boundary = contentType.split("=")[1];
        body = decodeFormData(bodyRaw, boundary);
      }
    }
  } else {
    body = { ...bodyRaw };
  }

  body = body ?? {};

  const params = { ...options.params };

  let _contextPath = "/";

  request.relative = function (path: string) {
    return relativePath(path, this.contextPath);
  };

  request.resolve = function (path: string) {
    return resolvePath(path, this.contextPath);
  };

  Object.defineProperties(request, {
    [FOURZE_REQUEST_SYMBOL]: {
      get() {
        return true;
      }
    },
    data: {
      get() {
        return {
          ...query,
          ...body,
          ...params
        };
      }
    },
    body: {
      get() {
        return body;
      }
    },
    bodyRaw: {
      get() {
        return bodyRaw;
      }
    },
    params: {
      get() {
        return params;
      }
    },
    query: {
      get() {
        return query;
      }
    },
    path: {
      get() {
        return path;
      }
    },
    contextPath: {
      get() {
        return _contextPath ?? "/";
      },
      set(val) {
        _contextPath = val;
      }
    },
    relativePath: {
      get() {
        return relativePath(this.path, this.contextPath);
      }
    }
  });

  return request;
}

const FOURZE_MIDDLEWARE_SYMBOL = Symbol("FOURZE_MIDDLEWARE_SYMBOL");

export function defineMiddleware(name: string, order: number, handler: FourzeMiddlewareHandler): FourzeMiddleware;

export function defineMiddleware(name: string, handler: FourzeMiddlewareHandler): FourzeMiddleware;

export function defineMiddleware(handler: FourzeMiddlewareHandler): FourzeMiddleware;

export function defineMiddleware(...args: [string, number, FourzeMiddlewareHandler] | [string, FourzeMiddlewareHandler] | [FourzeMiddlewareHandler]): FourzeMiddleware {
  const { name, order, handler } = overload([
    {
      name: "name",
      type: "string"
    },
    {
      name: "order",
      type: "number"
    },
    {
      name: "handler",
      type: "function",
      required: true
    }
  ], args);

  Object.defineProperties(handler, {
    name: {
      value: name,
      configurable: true
    },
    order: {
      value: order,
      configurable: true
    },
    [FOURZE_MIDDLEWARE_SYMBOL]: {
      get() {
        return true;
      },
      configurable: true
    }
  });
  return handler;
}

export function isFourzeMiddleware(obj: any): obj is FourzeMiddleware {
  return obj && obj[FOURZE_MIDDLEWARE_SYMBOL];
}

const FOURZE_PLUGIN_SYMBOL = Symbol("FOURZE_PLUGIN_SYMBOL");
export interface FourzePluginInstall {
  (app: FourzeApp): MaybePromise<void>
}

export interface FourzePlugin {
  name: string
  install: FourzePluginInstall
  readonly [FOURZE_PLUGIN_SYMBOL]: boolean
}

export function definePlugin(install: FourzePluginInstall): FourzePlugin;
export function definePlugin(name: string, install: FourzePluginInstall): FourzePlugin;

export function definePlugin(...args: [FourzePluginInstall] | [string, FourzePluginInstall]): FourzePlugin {
  const { name, install } = overload([
    {
      name: "name",
      type: "string",
      required: false
    },
    {
      name: "install",
      type: "function",
      required: true
    }
  ], args);
  return {
    name,
    install,
    get [FOURZE_PLUGIN_SYMBOL]() {
      return true;
    }
  };
}

export function isFourzePlugin(obj: any): obj is FourzePlugin {
  return !!obj && !!obj[FOURZE_PLUGIN_SYMBOL];
}

export function isFourzeResponse(obj: any): obj is FourzeResponse {
  return !!obj && !!obj[FOURZE_RESPONSE_SYMBOL];
}

export function isFourzeRequest(obj: any): obj is FourzeRequest {
  return !!obj && !!obj[FOURZE_REQUEST_SYMBOL];
}
