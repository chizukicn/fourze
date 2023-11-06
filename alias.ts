import { resolve } from "node:path";
import tsconfig from "./tsconfig.json";

const paths = tsconfig.compilerOptions.paths;

function r(p: string) {
  return resolve(__dirname, p);
}

export const alias: Record<string, string> = Object.keys(paths).reduce(
  (acc, key) => {
    const value = paths[key as keyof typeof paths][0];
    const aliasKey = key.replace("/*", "");
    const aliasValue = r(value.replace("/*", ""));
    return { ...acc, [aliasKey]: aliasValue };
  },
  {}
);

