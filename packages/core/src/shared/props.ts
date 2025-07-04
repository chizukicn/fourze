import { isArray, isConstructor, isFunction, isPlainObject, isUndef } from "../utils";
import { FourzeError } from "./error";

export interface GlobalProps extends Record<string, any> {}

export type DefaultData = Record<string, any>;

export type PropIn = "body" | "query" | "path";

export declare type ExtractPropTypes<O> = {
  [K in keyof Pick<O, RequiredKeys<O>>]: InferPropType<O[K]>;
} & {
  [K in keyof Pick<O, OptionalKeys<O>>]?: InferPropType<O[K]>;
} & GlobalProps;

export type ExtractPropTypesWithIn<
  O,
  In extends PropIn
> = ExtractPropTypes<Pick<O, InKeys<O, In>>>;

export type ExtractDefaultPropTypes<P extends Record<string, any>> = {
  [K in keyof Pick<P, DefaultKeys<P>>]: InferPropType<P[K]>;
};

export type LooseRequired<T> = {
  [P in string & keyof T]: T[P];
};

export type DefaultKeys<T> = {
  [K in keyof T]: T[K] extends {
    default: any;
  } | BooleanConstructor | {
    type: BooleanConstructor;
  } ? T[K] extends {
      type: BooleanConstructor;
      required: true;
    } ? never : K : never;
}[keyof T];

export type RequiredKeys<T> = {
  [K in keyof T]: T[K] extends
  | {
    required: true;
  }
  | {
    default: any;
  }
  | BooleanConstructor
  | {
    type: BooleanConstructor;
  }
    ? T[K] extends {
      default: undefined | (() => undefined);
    }
      ? never
      : K
    : never;
}[keyof T];

export type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>;

export type InKeys<T, In extends PropIn> = {
  [K in keyof T]: T[K] extends {
    in: In;
  }
    ? K
    : never;
}[keyof T];

export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;

export type InferPropType<T> = [T] extends [null]
  ? any
  : [T] extends [
      {
        type: null | true;
      }
    ]
      ? any
      : [T] extends [
        | ObjectConstructor
        | {
          type: ObjectConstructor;
        }
        ]
          ? Record<string, any>
          : [T] extends [
            | BooleanConstructor
            | {
              type: BooleanConstructor;
            }
            ]
              ? boolean
              : [T] extends [
                | DateConstructor
                | {
                  type: DateConstructor;
                }
                ]
                  ? Date
                  : [T] extends [
                    | (infer U)[]
                    | {
                      type: (infer U)[];
                    }
                    ]
                      ? U extends DateConstructor
                        ? Date | InferPropType<U>
                        : InferPropType<U>
                      : [T] extends [Prop<infer V, infer D>]
                          ? unknown extends V
                            ? IfAny<V, V, D>
                            : V
                          : T;

export type ObjectProps<P = Record<string, unknown>> = {
  [K in keyof P]: Prop<P[K]> | null;
};

export type NormalizedObjectProps<P = Record<string, unknown>> = {
  [K in keyof P]: NormalizedProps<P[K]> | null;
};

type Prop<T, D = T> = PropOptions<T, D> | PropType<T>;

type PropConstructor<T = any>
  = | {
    new(...args: any[]): NonNullable<T>;
  }
  | {
    (): T;
  }
  | PropMethod<T>;

type PropMethod<T, TConstructor = any> = [T] extends [
  ((...args: any) => any) | undefined
]
  ? {
      new(): TConstructor;
      (): T;
      readonly prototype: TConstructor;
    }
  : never;

export interface PropOptions<Type = any, Default = Type> {
  type: PropType<Type>;
  required?: boolean;
  default?: Default | DefaultFactory<Default> | null | undefined | object;
  validator?: (value: unknown) => boolean;
  transform?: (value: unknown) => Type;
  meta?: Record<string, any>;
  in?: PropIn;
}

export interface NormalizedProps<Type = any, Default = Type>
  extends PropOptions<Type, Default> {
  meta: Record<string, any>;
  in?: PropIn;
  required: boolean;
  type: PropType<any>;
  default?: Default | DefaultFactory<Default> | null | undefined | object;
}

declare type DefaultFactory<T> = (props: DefaultData) => T | null | undefined;

export type PropType<T> = PropConstructor<T> | PropConstructor<T>[];

export function isExtends(types: PropType<any>, value: PropType<any>): boolean {
  if (Array.isArray(types)) {
    return types.some((e) => isExtends(e, value));
  }
  return value === types;
}

const simpleCheckRE = /^(?:String|Number|Boolean|Function|Symbol|BigInt)$/;
const functionTypeCheckRE = /^\s*function (\w+)/;

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType(fn: PropType<any>) {
  const match = fn && fn.toString().match(functionTypeCheckRE);
  return match ? match[1] : "";
}

/**
 * Check if a value is an instance of a Prop constructor.
 * @param type
 * @param value
 * @returns
 */
export function isInstanceOf<D = any>(type: PropType<D> | PropType<D>[], value: any): value is D {
  if (Array.isArray(type)) {
    return type.some((e) => isInstanceOf(e, value));
  }
  const expectedType = getType(type);
  let valid = true;
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value;
    valid = t === expectedType.toLowerCase();
    // for primitive wrapper objects
    if (!valid && t === "object") {
      valid = value instanceof type;
    }
  } else if (expectedType === "Object") {
    valid = isPlainObject(value);
  } else if (expectedType === "Array") {
    valid = isArray(value);
  } else {
    try {
      valid = value instanceof type;
    } catch {
      valid = false;
    }
  }
  return valid;
}

export function normalizeProps<T>(
  props: ObjectProps<T>
): NormalizedObjectProps<T> {
  const result = {} as NormalizedObjectProps<T>;
  for (const name in props) {
    const key = name;
    const prop = props[name];

    if (isFunction(prop)) {
      result[key] = {
        type: prop,
        in: "query",
        required: isExtends(prop as PropType<any>, Boolean),
        meta: {}
      };
      continue;
    }

    if (Array.isArray(prop)) {
      result[key] = {
        type: prop,
        in: "query",
        required: prop.some((p) => isExtends(p as PropType<any>, Boolean)),
        meta: {}
      };
      continue;
    }

    if (!isFunction(prop) && !Array.isArray(prop) && !!prop) {
      result[key] = {
        type: prop.type,
        meta: {
          ...prop.meta
        },
        in: prop.in ?? "query",
        default: prop.default,
        required: prop.default ? false : prop.required ?? false
      };
    }
  }
  return result;
}

export function withDefaults<
  T = Record<string, any>,
  P extends ObjectProps<T> = ObjectProps<T>,
  D = ExtractPropTypes<P>,
  Defaults = ExtractDefaultPropTypes<P>
>(props: Partial<Defaults> & Omit<D, keyof Defaults>, propsOptions: P, propIn?: PropIn): D {
  if (Array.isArray(propsOptions)) {
    return props as D;
  }
  const rs = (props ?? {}) as D;
  const options = propsOptions;
  for (const key in options) {
    const k = key as unknown as keyof D;
    const opt = options[key as keyof P] as Prop<D> | null;
    if (opt === null) {
      continue;
    }
    if (isConstructor(opt)) {
      if (propIn) {
        continue;
      }
      if (isExtends(opt, Boolean)) {
        rs[k] = false as D[typeof k];
      }
      continue;
    }
    if (Array.isArray(opt)) {
      if (propIn) {
        continue;
      }
      if (opt.some((e) => isExtends(e, Boolean))) {
        rs[k] = false as D[typeof k];
      }
      continue;
    }
    if (opt.in !== propIn) {
      continue;
    }
    if (isFunction(opt.default)) {
      rs[k] = opt.default(props) as D[typeof k];
    } else if (opt.default !== undefined) {
      rs[k] = opt.default as D[typeof k];
    }
  }
  return rs;
}

export function validateProps(
  props: ObjectProps,
  data: Record<string, unknown>
) {
  for (const [key, propsOption] of Object.entries(props)) {
    let value = data[key];
    if (propsOption != null) {
      if (isConstructor(propsOption) || Array.isArray(propsOption)) {
        // todo: validate
      } else {
        const required = propsOption.required;
        if (isExtends(propsOption.type, Boolean)) {
          value = value ?? false;
        }
        if (required && isUndef(value)) {
          throw new FourzeError(405, `Property '${key}' is required.`);
        }
      }
    }
  }
}

export function defineExtends<P extends object>(props: P): ({
  (): P;
  <E>(extraProps: E): P & E;
}) {
  return <E extends object>(extraProps?: E) => {
    return {
      ...props,
      ...extraProps
    };
  };
}
