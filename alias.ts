import { resolve } from "node:path";

function r(p: string) {
  return resolve(__dirname, p);
}

export const alias: Record<string, string> = {
  "@fourze/core": r("./packages/core/src/index"),
  "@fourze/server": r("./packages/server/src/index"),
  "@fourze/mock": r("./packages/mock/src/index")
};
