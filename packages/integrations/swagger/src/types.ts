export interface SwaggerPathSchema {
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

export interface SwaggerParameter {
  in?: "body" | "path" | "query"
  name: string
  type: string | string[]
  description?: string
  required?: boolean
}

export interface SwaggerInfo extends Record<string, any> {
  version?: string
  title?: string
  description?: string
  termsOfService?: string
  contact?: {
    name: string
  } & Record<string, any>
  license?: {
    name?: string
  } & Record<string, any>
}

export interface SwaggerDocument extends Record<string, any> {
  swagger: string
  info?: SwaggerInfo
  host?: string
  basePath?: string
  schemes?: string[]
  consumes?: string[]
  produces?: string[]
}

export interface SwaggerUIInitOptions {
  url?: string
  urls?: string[]
}
