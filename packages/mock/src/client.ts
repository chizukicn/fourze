import type { FourzeMockAppOptions } from "./shared";
import dedent from "dedent";

export function createMockClient(
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
      ...${JSON.stringify(options)},
      modules:[${names.join(",")}].flat(),
    });
  `;
  return code;
}
