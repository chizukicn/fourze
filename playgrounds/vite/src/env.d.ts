/// <reference types="vite/client" />

import type { defineComponent, Events } from "vue";

declare module "*.vue" {
  const component: ReturnType<typeof defineComponent>;
  export default component;
}

interface ImportMetaEnv {
  readonly APP_TOKEN: string;
  PROD: boolean;
  DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type EventHandlers<E> = {
  [K in keyof E]?: E[K] extends (...args: any) => any
    ? E[K]
    : (payload: E[K]) => void;
};

declare module "vue" {
  interface ComponentCustomProps extends EventHandlers<Events> {}
}

declare module "vue" {
  interface ComponentCustomProperties {

  }
}
