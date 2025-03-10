import type { UnpluginFourzeOptions } from "@fourze/unplugin";
import { createFourzePlugin } from "@fourze/unplugin";

const createFourzeVitePlugin = createFourzePlugin.vite;

export type { UnpluginFourzeOptions };

export { createFourzeVitePlugin, createFourzeVitePlugin as default };
