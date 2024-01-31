import type { RenderHtmlOptions } from "@fourze/core";
import { isFunction, renderHtml, transformTemplate, withBase } from "@fourze/core";

const defaultStyleTemplate = `
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
  display: none !important;
}`;

const defaultScriptTemplate = `

window.onload = function() {
  // Build a system
  const options  = <% initOptions %>;
  url = options?.url ?? url;
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

function stringifyOptions(obj: Record<string, any>): string {
  const placeholder = "____FUNCTION_PLACEHOLDER____";
  const fns: Function[] = [];
  let json = JSON.stringify(
    obj,
    (key, value) => {
      if (isFunction(value)) {
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

export interface RenderSwaggerUIOptions extends RenderHtmlOptions {
  url?: string;
}

export function renderIndexHtml(root: string, options: RenderSwaggerUIOptions = {}) {
  const scriptContent = transformTemplate(defaultScriptTemplate, {
    initOptions: stringifyOptions({
      url: options.url ?? withBase("/api-docs", root)
    })
  });

  return renderHtml({
    language: options.language ?? "en",
    favicon: options.favicon ?? withBase("/favicon-32x32.png", root),
    script: [
      withBase("/swagger-ui-bundle.js", root),
      withBase("/swagger-ui-standalone-preset.js", root),
      ...(options.script ?? [])
    ],
    style: [
      withBase("/favicon-16x16.png", root),
      withBase("/favicon-32x32.png", root),
      withBase("/swagger-ui.css", root),
      ...(options.style ?? [])
    ],
    title: options.title ?? "Swagger UI",
    tags: [...options.tags ?? []],
    meta: [
      { name: "description", content: "Swagger UI" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { charset: "UTF-8" },
      ...(options.meta ?? [])
    ],
    head: [
      {
        tag: "style",
        content: defaultStyleTemplate
      },
      ...(options.head ?? [])
    ],
    body: [
      { tag: "div", attributes: { id: "swagger-ui" } },
      {
        tag: "script",
        content: scriptContent
      },
      ...(options.body ?? [])
    ]
  });
}
