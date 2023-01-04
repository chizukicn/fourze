import { defineBuildConfig } from "unbuild";
import { devDependencies } from "./package.json";

const externals = [...Object.keys(devDependencies ?? {})];

export default defineBuildConfig({
  entries: ["src/index"],
  clean: true,
  declaration: true,
  failOnWarn: false,
  externals,
  rollup: {
    emitCJS: true,
    dts: {
      respectExternal: false
    }
  }
});
