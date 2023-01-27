import { DISABLE_JSON_WRAPPER_HEADER, createQuery, definePlugin, defineRouter, isRouter, normalizeProps } from "@fourze/core";
import type {
  FourzeRouter,
  ObjectProps,
  PropType,
  RequestMethod
} from "@fourze/core";
import type {
  SwaggerDocument,
  SwaggerInfo,
  SwaggerParameter,
  SwaggerPathSchema
} from "./types";
import { service } from "./ui";

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

export interface SwaggerOptions {
  info?: SwaggerInfo
  schemas?: string[]
  consumes?: string[]
  produces?: string[]
}

export function createSwaggerPlugin(options: SwaggerOptions = {}) {
  return definePlugin(async (app) => {
    const router = createSwaggerRouter(options);
    app.use(router);
  });
}

export function createSwaggerRouter(
  options: SwaggerOptions = {}
): FourzeRouter {
  return defineRouter({
    name: "SwaggerRouter",
    setup(router, app) {
      router.route(service({
        routePath: "/swagger-ui/",
        documentUrl: "/api-docs",
        base: app.base
      }));
      router.get<SwaggerDocument>("/api-docs", async (req, res) => {
        const routes = createQuery(app.middlewares).select(r => {
          if (isRouter(r) && r !== router) {
            return r.routes;
          }
          return [];
        }).flat()
          .select((r) => {
            return {
              ...r,
              meta: {
                ...r.meta,
                tags: r.meta.tags ?? []
              } as Record<string, any>
            };
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
              const { summary, description, tags, responses } = meta;
              const schema = {
                summary,
                description,
                tags,
                responses,
                parameters
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

        res.setHeader(DISABLE_JSON_WRAPPER_HEADER, "true");

        return {
          swagger: "2.0",
          info: options.info,
          host: req.headers.Hosta as string,
          basePath: app.base,
          schemes: options.schemas ?? ["http"],
          consumes: options.consumes ?? ["application/json"],
          produces: options.produces ?? ["application/json"],
          paths: getPaths()
        };
      });
    }
  });
}
