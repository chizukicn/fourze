import type { FourzeApp, FourzeRouter, ObjectProps, PropType, RequestMethod } from "@fourze/core";
import { createQuery, isRouter, normalizeProps } from "@fourze/core";
import type { SwaggerDocument, SwaggerOptions, SwaggerParameter, SwaggerPathSchema } from "./types";

function getParameterType(type: PropType<any>): string | string[] {
  if (Array.isArray(type)) {
    return type.map(getParameterType).flat();
  }
  if (typeof type === "function") {
    return type.name.toLowerCase();
  }
  return type;
}

function getParameter<P extends ObjectProps = ObjectProps>(props: P) {
  const parameters: SwaggerParameter[] = [];
  const normalizedProps = normalizeProps(props);

  for (const [name, prop] of Object.entries(normalizedProps)) {
    if (prop) {
      parameters.push({
        in: prop.in ?? "query",
        name,
        type: getParameterType(prop.type),
        description: prop.meta?.description,
        required: prop.required
      });
    }
  }
  return parameters;
}

function normalizeOperationId(path: string) {
  return path.replace("/", "_");
}

export function createApiDocs(app: FourzeApp, options: SwaggerOptions = {}): SwaggerDocument {
  const routers = createQuery(app.middlewares).where(r => {
    return isRouter(r) && r.meta.swagger !== false;
  }).select(r => r as FourzeRouter);

  const tags = routers.select((e) => {
    return {
      name: e.name,
      ...e.meta
    };
  });

  const routes = routers
    .select((router) => {
      return router.routes.filter(r => r.meta.swagger !== false).map((r) => {
        const tags = Array.isArray(r.meta.tags) ? r.meta.tags : [];
        return {
          ...r,
          meta: {
            ...r.meta,
            tags: [router.meta.name ?? router.name, ...tags]
          } as Record<string, any>
        };
      });
    })
    .flat();

  function getPaths() {
    const paths = new Map<
      string,
      Record<RequestMethod, SwaggerPathSchema> | SwaggerPathSchema
    >();
    const groups = routes.groupBy((e) => e.path);
    for (const [path, routes] of groups) {
      const map = new Map<RequestMethod, SwaggerPathSchema>();
      for (const route of routes) {
        const { method, meta, props } = route;
        const parameters = getParameter(props);
        const { summary, description, tags, responses = {}, produces = ["application/json"], consumes = ["application/json"], operationId = normalizeOperationId(path) } = meta as SwaggerPathSchema;
        const schema = {
          summary,
          description,
          tags,
          responses,
          parameters,
          produces,
          consumes,
          operationId
        };
        if (!method) {
          paths.set(path, schema);
        } else {
          map.set(method, schema);
        }
      }
      const newPath = Object.fromEntries(map.entries()) as Record<
        RequestMethod,
        SwaggerPathSchema
      >;
      let exist = paths.get(path);
      if (exist) {
        Object.assign(exist, newPath);
      } else {
        exist = newPath;
      }
      paths.set(path, exist);
    }
    return Object.fromEntries(paths.entries());
  }

  return {
    swagger: "2.0",
    info: options.info,
    host: options.host,
    basePath: app.base,
    schemes: options.schemas ?? ["http", "https"],
    consumes: options.consumes ?? ["application/json"],
    produces: options.produces ?? ["application/json"],
    paths: getPaths(),
    tags
  };
}
