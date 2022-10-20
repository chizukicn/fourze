import { FourzeMockRouterOptions } from "@fourze/mock"
import type { FourzeHotRouter } from "@fourze/server"
import { normalizePath } from "@fourze/server"

const TEMPORARY_FILE_SUFFIX = ".tmp.js"

export function defaultMockCode(router: FourzeHotRouter, options: FourzeMockRouterOptions) {
    let code = `import {createMockRouter} from "@fourze/mock"`

    const names: string[] = []
    for (let i = 0; i < router.moduleNames.length; i++) {
        let modName = router.moduleNames[i]
        names[i] = `fourze_module_${i}`
        modName = modName.replace(TEMPORARY_FILE_SUFFIX, "")
        modName = normalizePath(modName)

        code += `
        import ${names[i]} from "${modName}"`
    }
    code += `
  createMockRouter({
    base:"${router.base}",
    modules:[${names.join(",")}].flat(),
    delay:${JSON.stringify(options.delay)},
    mode:${JSON.stringify(options.mode)},
    allow:${JSON.stringify(options.allow)},
    global:true
  })`
    return code
}
