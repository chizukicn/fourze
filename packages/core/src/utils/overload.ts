import { isUndef } from "./is";

export type OverloadConfig<T = object, V = T[keyof T]> = {
  name: keyof T
  required?: boolean
  type: "string" | "number" | "boolean" | "array" | "object" | "function"
  default?: any
  transform?: (value: V) => any
  match?: (value: V) => boolean
  rest?: boolean
}[];

export function defineOverload<T extends Record<string, any>>(
  ...configs: OverloadConfig<T>[]
) {
  return (args: any[]) => {
    const result = {} as T;

    for (const config of configs) {
      const parameters = Array.from(args);

      for (const {
        name,
        required = false,
        type,
        default: defaultValue,
        match,
        transform
      } of config) {
        function matchValue(value: any) {
          if (match) {
            return match(value);
          }
          if (isUndef(value)) {
            return !required;
          }
          if (type === "array") {
            return Array.isArray(value);
          }
          return typeof value === type;
        }

        const value = parameters.shift();

        if (matchValue(value)) {
          result[name] = transform ? transform(value) : value;
          continue;
        } else {
          result[name] = defaultValue;
        }

        parameters.unshift(value);
      }
      if (Object.keys(result).length === config.length) {
        return result;
      }
    }
    return result;
  };
}

export function overload<T extends Record<string, any>>(
  config: OverloadConfig<T>,
  args: any[]
) {
  const overloadFn = defineOverload(config);
  return overloadFn(args);
}
