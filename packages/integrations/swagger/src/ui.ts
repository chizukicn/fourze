import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { defineRoute, relativePath, resolvePath, slash } from "@fourze/core";
import { getAbsoluteFSPath } from "swagger-ui-dist";
import mime from "mime";
import type { SwaggerUIInitOptions } from "./types";

const htmlTemplateString = `
<!-- HTML for static distribution bundle build -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title><% title %></title>
  <link rel="stylesheet" type="text/css" href="./swagger-ui.css" >
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }

    *,
    *:before,
    *:after {
      box-sizing: inherit;
    }

    body {
      margin:0;
      background: #fafafa;
    }

    .swagger-ui .topbar .download-url-wrapper {
      display: none
    }
    <% inlineStyleCode %>
  </style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="./swagger-ui-bundle.js"> </script>
<script src="./swagger-ui-standalone-preset.js"> </script>
<script>
  <% inlineScriptCode %>
</script>
</body>
</html>
`;

const defaultScriptTemplate = `

window.onload = function() {
  // Build a system
  const options  = <% initOptions %>;
  url = options.url ?? url;
  const customOptions = options.customOptions ?? {};
  const swaggerOptions = {
    url,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  };
  console.log("swaggerOptions",swaggerOptions);
  for (let attr in customOptions) {
    swaggerOptions[attr] = customOptions[attr];
  }
  const ui = SwaggerUIBundle(swaggerOptions);
  if (customOptions.oauth) {
    ui.initOAuth(customOptions.oauth);
  }
  if (customOptions.authAction) {
    ui.authActions.authorize(customOptions.authAction);
  }
  window.ui = ui;
}
`;

export function toExternalScriptTag(url: string) {
  return `<script src='${url}'></script>`;
}

export function toInlineScriptTag(scriptCode: string) {
  return `<script>${scriptCode}</script>`;
}

export function toExternalStylesheetTag(url: string) {
  return `<link href='${url}' rel='stylesheet'>`;
}

function transformTemplate(
  template: string,
  data: Record<string, any>
): string {
  return template.replace(/<% (.+?) %>/g, (_, name) => {
    return data[name] ?? "";
  });
}

interface HtmlTag {
  tag: string
  attributes?: Record<string, any>
  content?: string
  in?: "body" | "head"
}

export interface GenerateHtmlOptions {
  initOptions?: SwaggerUIInitOptions
  inlineStyle?: string
  inlineScript?: string
  favicon?: string
  title?: string
  tags?: HtmlTag[]
  htmlTemplate?: string
  scriptTemplate?: string
}

function stringifyOptions(obj: Record<string, any>): string {
  const placeholder = "____FUNCTION_PLACEHOLDER____";
  const fns: Function[] = [];
  let json = JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "function") {
        fns.push(value);
        return placeholder;
      }
      return value;
    },
    2
  );
  json = json.replace(new RegExp(`"${placeholder}"`, "g"), (_) => {
    return String(fns.shift());
  });
  return json;
}

export function generateHtmlString(options: GenerateHtmlOptions = {}) {
  const scriptTemplate = options.scriptTemplate ?? defaultScriptTemplate;

  const inlineScriptCode = transformTemplate(scriptTemplate, {
    initOptions: stringifyOptions({
      ...options.initOptions
    })
  });
  const htmlString = transformTemplate(htmlTemplateString, {
    inlineScriptCode,
    favicon: "<meta></meta>"
  });
  return htmlString;
}

export interface SwaggerUIServiceOptions {
  documentUrl?: string
}

export function service(
  routePath = "/swagger-ui/",
  options: SwaggerUIServiceOptions = {}
) {
  if (!routePath.endsWith("/*")) {
    routePath = `${slash(routePath.concat("/"))}*`;
  }
  const swaggerUIPath = getAbsoluteFSPath();
  return defineRoute({
    path: routePath,
    handle: async (req, res) => {
      const documentUrl = resolvePath(
        options.documentUrl ?? "/api-docs",
        req.contextPath
      );
      const filename = relativePath(req.relativePath, routePath);
      const filePath = resolvePath(filename, swaggerUIPath);
      if (existsSync(filePath)) {
        const data = await readFile(filePath, "utf-8");
        res.send(data, mime.getType(filePath) ?? "text/plain");
        return;
      }
      const htmlString = generateHtmlString({
        initOptions: {
          url: documentUrl
        }
      });
      res.send(htmlString, "text/html");
    }
  });
}
