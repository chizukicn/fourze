import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import pkgJson from "../package.json";

const packages: Record<string, {
  checked?: boolean;
  hasRouter?: boolean;
  package?: string;
  version?: string;
  extra?: boolean;
}> = {
  "fourze": { checked: true, hasRouter: true, package: "@fourze/core" },
  "fourze-router": { checked: true, hasRouter: true, package: "@fourze/core" },
  "express": { checked: true, hasRouter: true },
  "fastify": { checked: true, hasRouter: true },
  "koa": { checked: true, hasRouter: true },
  "connect": { hasRouter: true },
  "h3": { checked: true, hasRouter: false },
  "nodehttp": { checked: true, hasRouter: false, version: process.version.slice(1) }
};

const require = createRequire(import.meta.url);

const _choices: string[] = [];
Object.keys(packages).forEach((pkg) => {
  if (!packages[pkg].version) {
    const module = pkgJson.dependencies[pkg as keyof typeof pkgJson.dependencies] ? pkg : packages[pkg].package;
    if (!module) {
      console.warn(`No package found for ${pkg}`);
      return;
    }
    const version = require(path.resolve(
      `node_modules/${module}/package.json`
    )).version;
    packages[pkg].version = version;
  }
  _choices.push(pkg);
});

export const choices = _choices.sort();
export function list(extra = false) {
  return _choices
    .map((c) => {
      return extra === !!packages[c].extra
        ? Object.assign({}, packages[c], { name: c })
        : null;
      return null;
    })
    .filter((c) => c);
}
export function info(module: string) {
  return packages[module];
}
