import type { MaybePromise } from "maybe-types";
import { isFunction, isPromise, renderElement } from "./utils";

async function resolveElement(ele: any) {
  if (isPromise(ele)) {
    ele = await ele;
  }
  if (isFourzeComponent(ele)) {
    return await ele.render?.();
  }
  if (isFunction(ele)) {
    await ele();
  }
  return ele;
}

export async function createElement(
  tag: string,
  props: any = {},
  ...children: (string | JSX.Element)[]
) {
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    props = {};
  }

  if (props.class && Array.isArray(props.class)) {
    props.class = props.class.join(" ");
  }

  async function renderChildren(
    children: (string | JSX.Element)[]
  ): Promise<string> {
    if (Array.isArray(children)) {
      const tasks = children.map(async (c) =>
        Array.isArray(c) ? renderChildren(c) : resolveElement(c)
      );
      return await Promise.all(tasks).then(r => r.join(""));
    }
    return children;
  }

  const content = await renderChildren(children);

  return renderElement(tag, props, content);
}

export const h = createElement;

export const FourzeComponentSymbol = Symbol("FourzeComponent");

export interface FourzeComponentOption {
  name?: string
  setup?: () => MaybePromise<this["render"] | Record<string, any>>
  render?: () => MaybePromise<JSX.Element>
}

export interface FourzeComponent extends FourzeComponentOption {
  [FourzeComponentSymbol]: true
}

export function defineFourzeComponent(
  setup: FourzeComponentOption | FourzeComponentOption["setup"]
): FourzeComponent {
  if (isFunction(setup)) {
    setup = { setup };
  }
  return {
    ...setup,
    [FourzeComponentSymbol]: true
  };
}

export function isFourzeComponent(
  component: any
): component is FourzeComponent {
  return component && component[FourzeComponentSymbol];
}

