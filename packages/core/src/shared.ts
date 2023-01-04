import type { IncomingMessage, OutgoingMessage, ServerResponse } from "http";
import type { MaybePromise } from "maybe-types";
import qs from "query-string";

import { version } from "../package.json";
import { decodeFormData } from "./polyfill/form-data";
import type { PolyfillHeaderInit } from "./polyfill/header";
import {
  flatHeaders,
  getHeaderRawValue,
  getHeaderValue
} from "./polyfill/header";
import { PolyfillServerResponse } from "./polyfill/response";
import { isBuffer, isDef, isFunction, isString, resolvePath } from "./utils";

export const FOURZE_VERSION = version;

const FOURZE_ROUTE_SYMBOL = Symbol("FourzeRoute");
const FOURZE_HOOK_SYMBOL = Symbol("FourzeInterceptor");
const FOURZE_REQUEST_SYMBOL = Symbol("FourzeRequest");
const FOURZE_RESPONSE_SYMBOL = Symbol("FourzeResponse");

export type DefaultData = Record<string, unknown>;

export interface FourzeRequest<
  Props extends ObjectProps = ObjectProps,
  Meta = Record<string, any>,
  Data = ExtractPropTypes<Props>,
  Query = ExtractPropTypes<Props, "query">,
  Body = ExtractPropTypes<Props, "body">,
  Params = ExtractPropTypes<Props, "path">
> extends IncomingMessage {
  url: string
  method: string
  headers: Record<string, string | string[] | undefined>

  route: FourzeRoute
  relativePath: string

  readonly params: Params

  meta: Meta

  readonly query: Query

  readonly body: Body
  /**
   *  {...query, ...params, ...body}
   */
  readonly data: Data

  readonly raw: string

  readonly path: string

  readonly [FOURZE_REQUEST_SYMBOL]: true
}

export interface FourzeBaseResponse extends ServerResponse {
  result?: any
  method?: string
  matched?: boolean
}
export interface FourzeResponse extends FourzeBaseResponse {
  json(data?: any): this

  image(data?: any): this

  text(data?: string): this

  binary(data?: any): this

  redirect(url: string): this

  appendHeader(key: string, value: string | string[]): this

  removeHeader(key: string): this

  readonly url: string

  readonly [FOURZE_RESPONSE_SYMBOL]: true
}

export interface FourzeBaseRoute<
  Props extends ObjectProps = ObjectProps,
  Meta = Record<string, any>
> {
  path: string
  base?: string
  method?: RequestMethod
  handle: FourzeHandle<Props, Meta>
  meta?: Meta
  props?: Props
}

// #region  Props
/**
 *  inspired by vue props
 */

export type PropIn = "body" | "query" | "path";

export type ExtractPropTypes<
  P extends Record<string, any>,
  In extends PropIn | "any" = "any",
  O = In extends PropIn ? Pick<P, InKeys<P, In>> : P
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
  [K in keyof P]: PropOptions<P[K]> | null;
};

type Prop<T, D = T> = PropOptions<T, D> | PropType<T>;

type PropConstructor<T = any> =
  | {
    new (...args: any[]): T & {}
  }
  | {
    (): T
  }
  | PropMethod<T>;

type PropMethod<T, TConstructor = any> = [T] extends [
  ((...args: any) => any) | undefined
]
  ? {
      new (): TConstructor
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

export interface NormalizedProps<Type = any, Default = Type> {
  name: string
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
  Props extends ObjectProps = ObjectProps,
  Meta = Record<string, any>
> extends FourzeBaseRoute<Props, Meta> {
  readonly [FOURZE_ROUTE_SYMBOL]: true
  readonly pathParams: RegExpMatchArray | string[]
  props: Props
  meta: Meta
  match: (
    url: string,
    method?: string,
    base?: string
  ) => RegExpMatchArray | null
}

export type FourzeNext = (rs?: boolean) => MaybePromise<void>;

export type FourzeHandle<
  Props extends ObjectProps = ObjectProps,
  Meta = Record<string, any>,
  R = any
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

export function isRoute(route: any): route is FourzeRoute<any> {
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
  Props extends ObjectProps = ObjectProps,
  Meta = Record<string, any>
>(route: FourzeBaseRoute<Props, Meta>): FourzeRoute<Props, Meta> {
  const { handle, meta = {} as Meta, base, props = {} as Props } = route;
  let { method, path } = route;

  if (REQUEST_PATH_REGEX.test(path)) {
    const arr = path.split(/\s+/);
    const m = arr[0].toLowerCase() as RequestMethod;
    if (FOURZE_METHODS.includes(m)) {
      method = m;
      path = arr[1].trim();
    }
  }

  path = resolvePath(path, base);

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
        const regex = new RegExp(
          `^${path.replace(PARAM_KEY_REGEX, "([a-zA-Z0-9_-\\s]+)?")}$`,
          "i"
        );
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

export interface FourzeBaseHook extends FourzeMiddleware<any> {
  path?: string
}

export interface FourzeHook {
  handle: FourzeMiddleware<any>
  path: string
  readonly [FOURZE_HOOK_SYMBOL]: true
}

export function defineFourzeHook(
  base: string,
  interceptor: FourzeBaseHook
): FourzeHook;

export function defineFourzeHook(interceptor: FourzeBaseHook): FourzeHook;

export function defineFourzeHook(interceptor: DefineFourzeHook): FourzeHook;

export function defineFourzeHook(
  param0: string | DefineFourzeHook | FourzeBaseHook,
  param1?: FourzeBaseHook
) {
  const isStr = isString(param0);
  const path = isStr ? param0 : param0.path ?? "";

  const hook = {
    path,
    handle:
      param1 ?? isStr
        ? param1
        : typeof param0 === "function"
          ? param0
          : async (
            request: FourzeRequest,
            response: FourzeResponse,
            handle: FourzeHandle
          ) => {
            await param0.before?.(request, response);
            const result = await handle(request, response);
            await param0.after?.(request, response);
            return result;
          }
  } as FourzeHook;

  Object.defineProperty(hook, FOURZE_HOOK_SYMBOL, {
    get() {
      return true;
    }
  });
  return hook;
}

export interface DefineFourzeHook {
  path?: string
  before?: FourzeHandle
  handle?: FourzeHandle<any>
  after?: FourzeHandle
}

export interface FourzeInstance {
  base?: string
  routes: FourzeRoute[]
  hooks: FourzeHook[]
}

export interface CommonMiddleware {
  (
    req: IncomingMessage,
    res: OutgoingMessage,
    next?: FourzeNext
  ): MaybePromise<void>
}

export interface FourzeMiddleware<T = void> {
  (req: FourzeRequest, res: FourzeResponse, next?: FourzeNext): MaybePromise<T>
  name?: string
  setup?: () => MaybePromise<void>
}

export interface FourzeResponseOptions {
  url: string
  method: string
  response?: OutgoingMessage
}

export function normalizeProps<Props extends ObjectProps = ObjectProps>(
  props: Props
): NormalizedObjectProps {
  const result: NormalizedObjectProps = {};
  for (const name in props) {
    const prop = props[name];
    if (!isFunction(prop) && !Array.isArray(prop) && !!prop) {
      result[name] = {
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

  const _end = response.end.bind(response);

  response.end = (data: any) => {
    response.result = data ?? response.result;

    if (response.result) {
      let contentType = getHeaderRawValue(response.getHeader("content-type"));

      if (!contentType) {
        contentType = "application/json";
        response.setHeader("content-type", contentType);
      }
      if (contentType.startsWith("application/json")) {
        response.json(response.result);
      }
    }

    _end(response.result);
    return response;
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

  response.json = function (data: any) {
    this.result = JSON.stringify(data);
    this.setHeader("Content-Type", "application/json");
    return this;
  };

  response.binary = function (data: any) {
    this.result = data;
    this.setHeader("Content-Type", "application/octet-stream");
    return this;
  };

  response.image = function (data: any) {
    this.result = data;
    this.setHeader("Content-Type", "image/jpeg");
    return this;
  };

  response.text = function (data: string) {
    this.result = data;
    this.setHeader("Content-Type", "text/plain");
    return this;
  };

  response.redirect = function (url: string) {
    this.statusCode = 302;
    this.setHeader("Location", url);
    return this;
  };

  response.setHeader("X-Powered-By", `Fourze Server/v${FOURZE_VERSION}`);

  let _result: any;

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
    result: {
      set(val) {
        _result = val;
      },
      get() {
        return _result;
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
  const request = (options?.request ?? {
    url: options.url,
    method: options.method
  }) as FourzeRequest;

  request.url = options.url ?? request.url;
  request.method = request.method ?? "GET";

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
    "content-type",
    "application/json"
  );

  const bodyRaw: Buffer | string | Record<string, any>
    = options.body ?? request.body ?? {};
  let body: Record<string, any> = {};
  if (isBuffer(bodyRaw) || isString(bodyRaw)) {
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
    }
  });

  return request;
}

export function isFourzeResponse(obj: any): obj is FourzeResponse {
  return !!obj && !!obj[FOURZE_RESPONSE_SYMBOL];
}

export function isFourzeRequest(obj: any): obj is FourzeRequest {
  return !!obj && !!obj[FOURZE_REQUEST_SYMBOL];
}

export function isFourzeHook(hook: any): hook is FourzeHook {
  return !!hook && !!hook[FOURZE_HOOK_SYMBOL];
}
