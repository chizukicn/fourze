import type { FourzeMockRouterOptions } from "@fourze/mock";
import type { FourzeHmrApp } from "@fourze/server";
import { normalizePath } from "@fourze/server";
import dedent from "dedent";

const TEMPORARY_FILE_SUFFIX = ".tmp.js";

export function defaultMockCode(
  router: FourzeHmrApp,
  options: FourzeMockRouterOptions
) {
  let code = "import {createMockRouter} from \"@fourze/mock\";";

  const names: string[] = [];
  for (let i = 0; i < router.moduleNames.length; i++) {
    let modName = router.moduleNames[i];
    names[i] = `fourze_module_${i}`;
    modName = modName.replace(TEMPORARY_FILE_SUFFIX, "");
    modName = normalizePath(modName);

    code += dedent`
      \nimport ${names[i]} from "${modName}";\n
    `;
  }
  code += dedent`
  createMockRouter({
    base:"${router.base}",
    modules:[${names.join(",")}].flat(),
    delay:${JSON.stringify(options.delay)},
    mode:${JSON.stringify(options.mode)},
    allow:${JSON.stringify(options.allow)},
    global:true
  });`;
  return code;
}
