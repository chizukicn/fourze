import type { FourzeMockAppOptions } from "@fourze/mock";
import dedent from "dedent";

export function defaultMockCode(
  moduleNames: string[],
  options: FourzeMockAppOptions = {}
) {
  let code = "import {createMockApp} from \"@fourze/mock\";";

  const names: string[] = [];
  for (let i = 0; i < moduleNames.length; i++) {
    const modName = moduleNames[i];
    names[i] = `fourze_module_${i}`;

    code += dedent`
      \nimport ${names[i]} from "${modName}";\n
    `;
  }

  code += dedent`
  createMockApp({
    base:"${options.base}",
    modules:[${names.join(",")}].flat(),
    delay:${JSON.stringify(options.delay)},
    mode:${JSON.stringify(options.mode)},
    allow:${JSON.stringify(options.allow)},
  }).ready();`;
  return code;
}
