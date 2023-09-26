import { withBase } from "../utils";
import type { DefaultData, ObjectProps } from "./props";
import type { RequestMethod } from "./request";
import { FOURZE_METHODS } from "./request";
import type { FourzeRouteMeta } from "./meta";
import type { FourzeHandle } from "./interface";

const FourzeRouteFlag = "__isFourzeRoute";

export interface FourzeRouteOptions<Props extends ObjectProps = ObjectProps, Meta = FourzeRouteMeta> {
  method?: RequestMethod
  props?: Props
  meta?: Meta & FourzeRouteMeta
}

export interface FourzeBaseRoute<
  Result = unknown, Props extends ObjectProps = DefaultData, Meta = FourzeRouteMeta
> {
  path: string
  method?: RequestMethod
  handle: FourzeHandle<Result, Props, Meta>
  meta?: Meta
  props?: Props
}

export interface FourzeRoute<
  Result = unknown, Props extends ObjectProps = DefaultData, Meta = FourzeRouteMeta
> extends FourzeBaseRoute<Result, Props, Meta> {
  readonly [FourzeRouteFlag]: true
  readonly props: Props
  readonly meta: Meta
}

export type FourzeRouteGenerator<This> = {
  [K in RequestMethod]: {
    <
      Result = any, Props extends ObjectProps = DefaultData, Meta = FourzeRouteMeta
    >(
      path: string,
      options: FourzeRouteOptions<Props, Meta>,
      handle: FourzeHandle<Result, Props, Meta>
    ): This
    <Result>(path: string, handle: FourzeHandle<Result>): This
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
  Result = unknown, Props extends ObjectProps = DefaultData, Meta = FourzeRouteMeta
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

