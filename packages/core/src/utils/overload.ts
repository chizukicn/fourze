import { isUndef } from "./is";

export type OverloadConfig<T = object, V = T[keyof T]> = {
  name: keyof T
  required?: boolean
  type: "string" | "number" | "boolean" | "array" | "object" | "function"
  default?: any
  transform?: (value: V) => any
  match?: (value: V) => boolean
}[];

export function overload<T>(config: OverloadConfig<T>, args: any[]) {
  const result = {} as T;

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

    const value = args.shift();

    if (matchValue(value)) {
      result[name] = transform ? transform(value) : value;
      continue;
    } else {
      result[name] = defaultValue;
    }

    args.unshift(value);
  }
  return result;
}
