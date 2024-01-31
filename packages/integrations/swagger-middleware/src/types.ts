import type { RequestMethod } from "@fourze/core";
import type { OpenAPIV2 } from "openapi-types";

export interface SwaggerPathSchema {
  swagger?: boolean;
  tags?: string[];
  responses?: OpenAPIV2.ResponsesObject;
  description?: string;
  summary?: string;
  operationId?: string;
  produces?: string[];
  consumes?: string[];
  deprecated?: boolean;
}

export interface SwaggerUIInitOptions {
  url?: string;
  urls?: string[];
}

export interface SwaggerOptions {
  defaultMethod?: RequestMethod;
  info?: OpenAPIV2.InfoObject;
  schemas?: string[];
  consumes?: string[];
  produces?: string[];
  host?: string;
  basePath?: string;
}

declare module "@fourze/core" {
  interface FourzeRouteMeta extends SwaggerPathSchema {
  }

  interface FourzeAppMeta {
    definitions?: OpenAPIV2.DefinitionsObject;
    info?: OpenAPIV2.InfoObject;
    host?: string;
    basePath?: string;
    schemas?: string[];
    consumes?: string[];
    produces?: string[];
  }
}
