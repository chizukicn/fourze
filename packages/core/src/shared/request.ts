import type { MaybeRegex } from "maybe-types";
import type { IncomingMessage } from "node:http";
import type { PolyfillHeaderInit } from "../polyfill";
import type { FourzeApp, FourzeHandle } from "./interface";
import type { FourzeRouteMeta } from "./meta";
import type { DefaultData, ExtractPropTypes, ExtractPropTypesWithIn, ObjectProps } from "./props";
import { safeParse } from "fast-content-type-parse";
import { getQuery, parseQuery, parseURL, withBase, withoutBase } from "ufo";
import { decodeFormData, flatHeaders, getHeaderValue } from "../polyfill";
import { isString, isUint8Array, parseJson } from "../utils";
import { validateProps, withDefaults } from "./props";

const FourzeRequestFlag = "__isFourzeRequest";

export const FOURZE_METHODS = [
  "get",
  "post",
  "delete",
  "put",
  "patch",
  "options",
  "head",
  "trace",
  "connect"
] as const;

export type RequestMethod = typeof FOURZE_METHODS[number];

export interface FourzeRequestOptions {
  url: string;
  method?: string;
  headers?: PolyfillHeaderInit;
  body?: any;
  params?: Record<string, any>;
  query?: Record<string, any>;
  meta?: Record<string, any>;
  request?: IncomingMessage;
  contentTypeParsers?: Map<MaybeRegex, (body: any) => any>;
}

export interface FourzeRequest<
  Props extends ObjectProps = DefaultData,
  Meta = FourzeRouteMeta,
  Data = ExtractPropTypes<Props>,
  Query = ExtractPropTypesWithIn<Props, "query">,
  Body = ExtractPropTypesWithIn<Props, "body">,
  Params = ExtractPropTypesWithIn<Props, "path">
> extends IncomingMessage {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;

  route: FourzeRoute;

  app?: FourzeApp;

  meta: Meta & FourzeRouteMeta;

  contextPath: string;

  setRoute: (route: FourzeRoute, matchParams?: Record<string, any> | null) => void;

  withScope: (scope: string) => FourzeRequest<Props, Meta, Data, Query, Body, Params>;

  readonly contentType: string;

  readonly req?: IncomingMessage;

  readonly originalPath: string;

  readonly params: Params;

  readonly query: Query;

  readonly body: Body;
  /**
   *  {...query, ...params, ...body}
   */
  readonly data: Data;

  readonly raw: string;

  readonly path: string;

  readonly [FourzeRequestFlag]: true;
}

export function createRequest(options: FourzeRequestOptions) {
  const request = ({
    url: options.url ?? options.request?.url,
    method: options.method ?? options.request?.method
  }) as FourzeRequest;

  request.url = options.url ?? request.url;
  request.method = request.method ?? "GET";

  request.meta = options.meta ?? {};

  const headers = {
    ...flatHeaders(request.headers),
    ...flatHeaders(options.headers)
  };

  request.headers = headers;

  const { search, pathname } = parseURL(request.url);

  const query = getQuery(search);

  const { type: contentType, parameters } = safeParse(getHeaderValue(
    headers,
    "Content-Type",
    "application/json"
  ));

  const charset = (parameters.charset ?? "utf-8") as BufferEncoding;

  const bodyRaw: Buffer | string | Record<string, any>
    = options.body ?? request.body ?? {};
  let body: Record<string, any> = {};
  if (isUint8Array(bodyRaw) || isString(bodyRaw)) {
    if (bodyRaw.length > 0) {
      switch (contentType) {
        case "application/json":{
          body = parseJson(bodyRaw.toString(charset));
          break;
        }
        case "application/x-www-form-urlencoded":{
          body = parseQuery(bodyRaw.toString(charset));
          break;
        }
        case "multipart/form-data": {
          const boundary = parameters.boundary;
          body = decodeFormData(bodyRaw, boundary);
          break;
        }
        default:
          break;
      }
    }
  } else {
    body = { ...bodyRaw };
  }

  body = body ?? {};

  const params = { ...options.params };

  let _route: FourzeRoute | undefined;

  /**
   *  默认值
   */
  const _defaultsProps = {};

  request.setRoute = (route, matches) => {
    _route = route;
    if (matches) {
      Object.assign(params, matches);
    }
    withDefaults(params, route.props, "path");
    withDefaults(query, route.props, "query");
    withDefaults(body, route.props, "body");
    const data = withDefaults(request.data, route.props);
    Object.assign(_defaultsProps, data);
    validateProps(route.props, data);
  };

  request.withScope = (scope) => {
    return createRequest({
      ...options,
      meta: request.meta,
      url: withoutBase(request.url, scope) ?? request.url
    });
  };

  Object.defineProperties(request, {
    [FourzeRequestFlag]: {
      get() {
        return true;
      },
      enumerable: true
    },
    req: {
      get() {
        return options.request;
      }
    },
    contentType: {
      get() {
        return contentType;
      }
    },
    data: {
      get() {
        return {
          ..._defaultsProps,
          ...query,
          ...body,
          ...params
        };
      },
      enumerable: true
    },
    body: {
      get() {
        return body;
      },
      enumerable: true
    },
    bodyRaw: {
      get() {
        return bodyRaw;
      },
      enumerable: true
    },
    params: {
      get() {
        return params;
      },
      enumerable: true
    },
    query: {
      get() {
        return query;
      },
      enumerable: true
    },
    route: {
      get() {
        return _route;
      },
      enumerable: true
    },
    path: {
      get() {
        return pathname;
      },
      enumerable: true
    },
    originalPath: {
      get() {
        return pathname;
      },
      enumerable: true
    }
  });

  return request;
}

export function isFourzeRequest(obj: any): obj is FourzeRequest {
  return !!obj && !!obj[FourzeRequestFlag];
}

const FourzeRouteFlag = "__isFourzeRoute";

export interface FourzeRouteOptions<Props extends ObjectProps = ObjectProps, Meta = FourzeRouteMeta> {
  method?: RequestMethod;
  props?: Props;
  meta?: Meta & FourzeRouteMeta;
}

export interface FourzeBaseRoute<
  Result = unknown,
  Props extends ObjectProps = DefaultData,
  Meta = FourzeRouteMeta
> {
  path: string;
  method?: RequestMethod;
  handle: FourzeHandle<Result, Props, Meta>;
  meta?: Meta;
  props?: Props;
}

export interface FourzeRoute<
  Result = unknown,
  Props extends ObjectProps = DefaultData,
  Meta = FourzeRouteMeta
> extends FourzeBaseRoute<Result, Props, Meta> {
  readonly [FourzeRouteFlag]: true;
  readonly props: Props;
  readonly meta: Meta;
}

export type FourzeRouteGenerator<This> = {
  [K in RequestMethod]: {
    <
      Result = any,
      Props extends ObjectProps = DefaultData,
      Meta = FourzeRouteMeta
    >(
      path: string,
      options: FourzeRouteOptions<Props, Meta>,
      handle: FourzeHandle<Result, Props, Meta>
    ): This;
    <Result>(path: string, handle: FourzeHandle<Result>): This;
  };
};

export function isRoute(route: any): route is FourzeRoute<unknown> {
  return !!route && !!route[FourzeRouteFlag];
}

const REQUEST_PATH_REGEX = new RegExp(
  `^(${FOURZE_METHODS.join("|")})\\s+`,
  "i"
);

export function defineRouteProps<Props extends ObjectProps = DefaultData>(
  props: Props
) {
  return props;
}

export function defineRoute<
  Result = unknown,
  Props extends ObjectProps = DefaultData,
  Meta = FourzeRouteMeta
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

  path = base ? withBase(path, base) : path;

  return {
    method,
    path,
    meta,
    handle,
    get props() {
      return props;
    },
    get [FourzeRouteFlag](): true {
      return true;
    }
  };
}
