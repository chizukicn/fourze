import type { FourzeMiddleware } from "@fourze/core";
import type { MaybeRegex } from "maybe-types";
import { createFilter, defineMiddleware } from "@fourze/core";

interface MatchMiddlewareOptions {
  includes?: MaybeRegex[];
  excludes?: MaybeRegex[];
}
export function createFilterMiddleware<T>(
  middleware: FourzeMiddleware<T>,
  options: MatchMiddlewareOptions
): FourzeMiddleware {
  const { includes = [], excludes = [] } = options;
  const match = createFilter(includes, excludes);

  return defineMiddleware(middleware.name ?? "Filter", middleware.order ?? -1, async (req, res, next) => {
    const { path } = req;
    const isMatched = match(path);
    await (isMatched ? middleware(req, res, next) : next?.());
  });
}
