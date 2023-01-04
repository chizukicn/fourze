import { createRouter, groupBy, isConstructor } from "@fourze/core";
import type { FourzeRouter, ObjectProps, RequestMethod } from "@fourze/core";

interface SwaggerPathSchema {
  summary?: string
  description?: string
  tags?: string[]
  operationId?: string
  deprecated?: boolean
  responses?: Record<
    string,
    {
      description: string
      schema?: Record<string, any>
    }
  >
}

interface SwaggerParameter {
  in?: "body" | "path" | "query"
  name: string
  description?: string
  required?: boolean
}

function getParameter<P extends ObjectProps = ObjectProps>(props: P) {
  const parameters: SwaggerParameter[] = [];

  for (const [name, prop] of Object.entries(props)) {
    if (isConstructor(prop)) {
      // TODO
    } else if (Array.isArray(prop)) {
      // TODO
    } else {
      parameters.push({
        in: prop?.in,
        name,
        description: prop?.meta?.description,
        required: prop?.required
      });
    }
  }
  return parameters;
}

export function createSwaggerRouter(baseRouter: FourzeRouter): FourzeRouter {
  const swaggerRouter = createRouter({
    base: "/v2"
  });
  swaggerRouter.use((route) => {
    route("/api-docs", async (req) => {
      await baseRouter.setup();
      const routes = baseRouter.routes;

      function getPaths() {
        const paths = new Map<
          string,
          Record<RequestMethod, SwaggerPathSchema> | SwaggerPathSchema
        >();
        const groups = groupBy(routes, (r) => r.path);
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

      return {
        swagger: "2.0",
        info: {
          version: "1.0.0",
          title: "Swagger Petstore",
          description:
            "A sample API that uses a petstore as an example to demonstrate features in the swagger-2.0 specification",
          termsOfService: "http://swagger.io/terms/",
          contact: {
            name: "Swagger API Team"
          },
          license: {
            name: "MIT"
          }
        },
        host: req.headers.Host,
        basePath: "/v2",
        schemes: ["http"],
        consumes: ["application/json"],
        produces: ["application/json"],
        paths: getPaths()
      };
    });
  });

  return swaggerRouter;
}
