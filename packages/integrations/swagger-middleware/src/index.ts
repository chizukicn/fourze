import type { FourzeApp, FourzeMiddleware, FourzeRouteMeta, FourzeRouter, ObjectProps, PropType, RequestMethod } from "@fourze/core";
import type { OpenAPIV2 } from "openapi-types";
import type { SwaggerOptions, SwaggerPathSchema } from "./types";
import { createQuery, isFunction, isRouter, normalizeProps } from "@fourze/core";

function getParameterType(type: PropType<any>): string | string[] {
  if (Array.isArray(type)) {
    return type.map(getParameterType).flat();
  }
  if (isFunction(type)) {
    return type.name.toLowerCase();
  }
  return type;
}

function getParameter<P extends ObjectProps = ObjectProps>(props: P) {
  const parameters: OpenAPIV2.ParameterObject[] = [];
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
  return path.replaceAll("/", "_");
}

// 创建swagger文档服务
export function createSwaggerMiddleware(
  app: FourzeApp,
  options: SwaggerOptions = {}
): FourzeMiddleware {
  return async (req, res) => {
    await app.ready();
    const routers = createQuery(app.middlewares)
      .where((r) => isRouter(r) && r.meta.swagger !== false)
      .select((r) => r as FourzeRouter);

    const tags = routers.select((e) => {
      return {
        name: e.name,
        ...e.meta
      };
    });

    const routes = routers
      .select((router) => {
        return router.routes
          .filter((r) => r.meta.swagger !== false)
          .map((r) => {
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

    function getDefinitions(baseDefinitions?: Record<string, any>) {
      const definitionsMap = new Map<string, Record<string, any>>(
        Object.entries(baseDefinitions ?? {})
      );

      const applyDefinitions = (def?: Record<string, any>) => {
        if (def) {
          for (const [name, schema] of Object.entries(def)) {
            definitionsMap.set(name, schema as Record<string, any>);
          }
        }
      };

      for (const router of routers) {
        applyDefinitions(router.meta?.definitions);
        for (const route of routes) {
          applyDefinitions(route.meta?.definitions);
        }
      }

      return Object.fromEntries(definitionsMap.entries());
    }

    function getPaths() {
      const paths = new Map<
        string,
      Record<RequestMethod, SwaggerPathSchema> | SwaggerPathSchema
      >();
      const groups = routes.groupBy((e) => e.path);
      for (const [path, routes] of groups) {
        const map = new Map<RequestMethod, FourzeRouteMeta>();
        for (const route of routes) {
          const { method = options.defaultMethod, meta, props } = route;
          const parameters = getParameter(props);
          const {
            summary,
            description,
            tags,
            responses = {},
            produces = ["application/json"],
            consumes = ["application/json"],
            operationId = normalizeOperationId(path)
          } = meta;
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
            paths.set(path, { ...schema });
          } else {
            map.set(method, { ...schema });
          }
        }
        const newPath = Object.fromEntries(map.entries()) as Record<RequestMethod, SwaggerPathSchema>;
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

    const docs = {
      swagger: "2.0",
      info: app.meta.info ?? options.info,
      host: app.meta.host ?? options.host,
      basePath: app.meta.basePath ?? options.basePath,
      schemes: app.meta.schemas ?? options.schemas ?? ["http", "https"],
      consumes: app.meta.consumes ?? options.consumes ?? ["application/json"],
      produces: app.meta.produces ?? options.produces ?? ["application/json"],
      definitions: getDefinitions(app.meta.definitions),
      paths: getPaths(),
      tags
    };
    res.setHeader("Fourze-Response-Resolve", "off");
    res.send(docs, "application/json");
  };
}

export * from "./types";
