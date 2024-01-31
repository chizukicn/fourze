import { isDef, isNode } from "./is";
import { parseJson } from "./string";

export interface Storage {
  readonly length: number;
  clear(): void;
  getItem(key: string): any;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: any): void;
  hasItem(key: string): boolean;
  [name: string]: any;
}

interface StorageOptions {
  id?: string;
  persistence?: boolean;
  /**
   * only for browser
   */
  target?: "local" | "session";
  /**
   *  only for node
   */
  dir?: string;
}

export function createStorage(options: StorageOptions = {}): Storage {
  const { id = "app.storage", target = "local", persistence = true, dir = ".fourze" } = options;

  const storage = new Proxy({} as Storage, {
    set(target, key, value) {
      const result = Reflect.set(target, key, value);
      emitChange();
      return result;
    },
    get(target, key) {
      switch (key) {
        case "length":
          return Object.keys(target).length;
        case "hasItem":
          return (key: string) => isDef(target[key]);
        case "removeItem":
          return (key: string) => {
            Reflect.deleteProperty(target, key);
            emitChange();
          };
        case "getItem":
          return (key: string) => target[key];
        case "setItem":
          return (key: string, value: any) => {
            Reflect.set(target, key, value);
            emitChange();
          };
        case "clear":
          return () => {
            Object.keys(target).forEach(key =>
              Reflect.deleteProperty(target, key)
            );
            emitChange();
          };
        case "key":
          return (index: number) => {
            const keys = Object.keys(target);
            return keys[index];
          };
        default:
          return Reflect.get(target, key);
      }
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      emitChange();
      return result;
    }
  });

  function emitChange() {
    if (persistence) {
      if (isNode()) {
        const fs = require("node:fs") as typeof import("fs");
        fs.writeFileSync(`${dir}/${id}`, JSON.stringify(storage));
      } else {
        const _store = target === "local" ? localStorage : sessionStorage;
        _store.setItem(`fourze.${id}`, JSON.stringify(storage));
      }
    }
  }

  function initStorage() {
    if (isNode()) {
      const fs = require("node:fs") as typeof import("fs");
      const path = require("node:path") as typeof import("path");
      const storagePath = path.resolve(dir);
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath);
      }
      if (fs.existsSync(`${dir}/${id}`)) {
        Object.assign(
          storage,
          parseJson(fs.readFileSync(`.fourze/${id}`, "utf8"))
        );
      }
    } else {
      const _storage = target === "local" ? localStorage : sessionStorage;
      if (_storage.getItem(`fourze.${id}`)) {
        Object.assign(
          storage,
          parseJson(_storage.getItem(`fourze.${id}`) as string)
        );
      }
    }
  }

  initStorage();

  return storage;
}
