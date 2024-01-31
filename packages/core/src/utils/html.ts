import { isObject, isString } from "./is";
import { transformTemplate } from "./string";

const htmlTemplateString = `
<!-- HTML for static distribution bundle build -->
<!DOCTYPE html>
<html lang="<% language %>">
  <head>
    <% headTags %>
  </head>
  <body>
    <% bodyTags %>
  </body>
  <% htmlTags %>
</html>
`;

export interface ScriptTagAttributes extends Record<string, any> {
  src: string;
  lang?: string;
  type?: string;
}

export interface StyleTagAttributes extends Record<string, any> {
  type?: string;
  media?: string;
  rel?: string;
  href?: string;
}

export interface HtmlTag {
  tag: string;
  attributes?: Record<string, any>;
  content?: string;
  in?: "body" | "head" | "html";
}

export interface HtmlHeadTag extends Omit<HtmlTag, "in"> {
}

export interface HtmlBodyTag extends Omit<HtmlTag, "in"> {
}
export interface RenderHtmlOptions {
  language?: string;
  favicon?: string | string[];
  title?: string;
  meta?: Record<string, any>[];
  tags?: HtmlTag[];
  head?: HtmlHeadTag[];
  body?: HtmlBodyTag[];
  script?: (string | ScriptTagAttributes)[];
  style?: (string | StyleTagAttributes)[];
}

const notCloseTags = ["img", "br", "hr", "input", "meta", "link", "area"];

export function renderElement(tag: string, props: any = {}, ...children: any[]) {
  if (!props || !isObject(props) || Array.isArray(props)) {
    props = {};
  }

  if (props.class && Array.isArray(props.class)) {
    props.class = props.class.join(" ");
  }

  function renderChildren(children: any[]): string {
    if (Array.isArray(children)) {
      return children.map(c => (Array.isArray(c) ? renderChildren(c) : c)).join("");
    }
    return children;
  }

  const content = renderChildren(children);
  const attrs = Object.entries(props)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join("");

  if (tag.toLowerCase() === "fragment") {
    return content;
  }

  if (notCloseTags.includes(tag)) {
    return `<${tag}${attrs}/>`;
  }

  return `<${tag}${attrs}>${content}</${tag}>`;
}

export function renderHtml(options: RenderHtmlOptions = {}) {
  const tags = options.tags ?? [];

  const headTags: HtmlTag[] = [...tags.filter(r => r.in === "head"), ...options.head ?? []];

  if (options.title) {
    headTags.push({ tag: "title", content: options.title });
  }

  if (options.meta?.length) {
    headTags.push(...options.meta.map((r) => {
      return { tag: "meta", attributes: r };
    }));
  }

  if (options.favicon) {
    const favicon = Array.isArray(options.favicon) ? options.favicon : [options.favicon];
    headTags.push(...favicon.map((r) => {
      return { tag: "link", attributes: { rel: "icon", href: r } };
    }));
  }

  if (options.style?.length) {
    headTags.push(...options.style.map((r) => {
      if (isString(r)) {
        return { tag: "link", attributes: { href: r, rel: "stylesheet" } };
      }
      return { tag: "link", attributes: { ...r } };
    }));
  }

  const bodyTags: HtmlTag[] = [...tags.filter(r => r.in === "body"), ...options.body ?? []];

  if (options.script?.length) {
    bodyTags.push(...options.script.map((r) => {
      if (isString(r)) {
        return { tag: "script", attributes: { src: r } };
      }
      return { tag: "script", attributes: r };
    }));
  }

  return transformTemplate(htmlTemplateString, {
    headTags: headTags.map(r => renderElement(r.tag, r.attributes, r.content ?? "")).join("\n"),
    bodyTags: bodyTags.map(r => renderElement(r.tag, r.attributes, r.content ?? "")).join("\n"),
    favicon: "<meta></meta>"
  });
}
