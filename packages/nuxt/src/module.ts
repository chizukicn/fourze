import fourzeUnplugin, { UnpluginFourzeOptions } from "@fourze/unplugin"
import { addServerHandler, addTemplate, addVitePlugin, defineNuxtModule } from "@nuxt/kit"
import dedent from "dedent"
import { join } from "pathe"
import { fileURLToPath } from "url"

export interface ModuleOptions extends UnpluginFourzeOptions {}

export interface ModuleHooks {}

export default defineNuxtModule<ModuleOptions>({
    meta: {
        name: "@fourze/nuxt",
        configKey: "fourze"
    },
    defaults: {
        base: "/api",
        dir: "mock",
        mock: false
    },
    setup(options, nuxt) {
        const runtimeDir = fileURLToPath(new URL("./runtime", import.meta.url))
        nuxt.options.build.transpile.push(runtimeDir)

        if (nuxt.options.target == "static") {
            addVitePlugin(fourzeUnplugin.vite(options))
        } else {
            const mockHandlerPath = join(nuxt.options.buildDir, "fourze-mock.ts")

            addTemplate({
                filename: "fourze-mock.ts",
                write: true,
                getContents() {
                    return dedent`
                    import pkg from "@fourze/server"
                    import { defineEventHandler } from "h3"
                    
                    const { createFourzeServer, createHotRouter } = pkg
                    const fourzeServer = createFourzeServer()
                    const hotRouter = createHotRouter({
                        base: "${options.base ?? "/api"}",
                        dir: "${options.dir ?? "./mock"}",
                        delay: ${JSON.stringify(options.delay ?? 0)},
                    })
                    fourzeServer.use(hotRouter)
                    const onNotFound = () => {
                        /** empty */
                    }

                    export default defineEventHandler(async event => {
                        await fourzeServer(event.req, event.res, onNotFound)
                    })
                  `
                }
            })

            addServerHandler({
                middleware: true,
                handler: mockHandlerPath
            })
        }
    }
})
