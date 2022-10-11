import fourzeUnplugin, { UnpluginFourzeOptions } from "@fourze/unplugin"
import { addPlugin, defineNuxtModule, extendViteConfig } from "@nuxt/kit"
import { resolve } from "path"
import { fileURLToPath } from "url"

export interface ModuleOptions extends UnpluginFourzeOptions {}

export interface ModuleHooks {}

export default defineNuxtModule<ModuleOptions>({
    meta: {
        name: "@fourze/nuxt",
        configKey: "fourze"
    },
    defaults: {},
    setup(options, nuxt) {
        if (nuxt.options.dev) {
            extendViteConfig(config => {
                config.plugins?.push(fourzeUnplugin.vite(options))
            })
        }
        const runtimeDir = fileURLToPath(new URL("./runtime", import.meta.url))
        nuxt.options.build.transpile.push(runtimeDir)
        addPlugin(resolve(runtimeDir, "plugin"))
    }
})
