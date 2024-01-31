import { expect, it } from "vitest";
import {
  isArray,
  isBoolean,
  isBuffer,
  isConstructor,
  isDef,
  isError,
  isFalse,
  isFalsy,
  isFunction,
  isNode,
  isNull,
  isNumber,
  isObject,
  isPlainObject,
  isPrimitive,
  isPromise,
  isRegExp,
  isString,
  isSymbol,
  isTrue,
  isTruthy,
  isURL,
  isUint8Array,
  isUndef,
  isUndefined,
  toRawType
} from "../../src/utils/is";

it("is-type", () => {
  expect(isNumber(1)).toBe(true);
  expect(isNumber("1")).toBe(false);
  expect(isString("1")).toBe(true);
  expect(isString(1)).toBe(false);
  expect(isBoolean(true)).toBe(true);
  expect(isBoolean(false)).toBe(true);
  expect(isBoolean(1)).toBe(false);

  expect(isDef(1)).toBe(true);
  expect(isDef(undefined)).toBe(false);

  expect([1, 0, "1", "0", {}, true, false].every(isDef)).toBe(true);
  expect([1, 0, "1", "0", {}, true, false].every(isUndef)).toBe(false);
  expect([1, 0, "1", "0", {}, true, false].every(isUndefined)).toBe(false);
  expect([null, undefined].every(isUndef)).toBe(true);
  expect([null, undefined].every(isUndefined)).toBe(false);
  expect(isUndefined(undefined)).toBe(true);
  expect(isUndefined(null)).toBe(false);
  expect(isNull(undefined)).toBe(false);
  expect(isNull(null)).toBe(true);

  expect([1, true, "3", {}].every(isTruthy)).toBe(true);
  expect([1, true, "3", {}].every(isFalsy)).toBe(false);
  expect([0, false, undefined, null, ""].every(isFalsy)).toBe(true);
  expect([0, false, undefined, null, ""].every(isTruthy)).toBe(false);

  expect(isTrue(true)).toBe(true);
  expect(isTrue(false)).toBe(false);
  expect(isFalse(true)).toBe(false);
  expect(isFalse(false)).toBe(true);
  expect([1, 0, "1", "0", null, undefined, {}].every(isTrue)).toBe(false);
  expect([1, 0, "1", "0", null, undefined, {}].every(isFalse)).toBe(false);

  expect([1, "3", true, false].every(isPrimitive)).toBe(true);
  expect([{}, [], null, undefined].every(isPrimitive)).toBe(false);

  expect(isArray([])).toBe(true);
  expect(isArray({})).toBe(false);
  expect(isArray(1)).toBe(false);
  expect(isArray("1")).toBe(false);

  expect(isPlainObject({})).toBe(true);
  expect(isPlainObject([])).toBe(false);

  expect(isFunction(() => {})).toBe(true);
  expect(isFunction({})).toBe(false);

  expect(isPromise(Promise.resolve())).toBe(true);
  expect(isPromise({})).toBe(false);

  expect(isError(new Error("error"))).toBe(true);
  expect(isError({})).toBe(false);

  expect(isBuffer(Buffer.from("test"))).toBe(true);
  expect(isBuffer({})).toBe(false);
  expect(isUint8Array(new Uint8Array())).toBe(true);
  expect(isUint8Array({})).toBe(false);
  expect(isUint8Array(Buffer.from("test"))).toBe(true);

  expect(isRegExp(/test/)).toBe(true);
  expect(isRegExp({})).toBe(false);

  expect(isSymbol(Symbol("test"))).toBe(true);
  expect(isSymbol({})).toBe(false);

  expect(isConstructor(class {})).toBe(true);
  expect(isConstructor(String)).toBe(true);
  expect(isConstructor(Number)).toBe(true);
  expect(isConstructor(Boolean)).toBe(true);
  expect(isConstructor({})).toBe(false);

  expect(isObject({})).toBe(true);
  expect(isObject([])).toBe(true);
  expect(isObject(null)).toBe(false);
  expect(isObject(1)).toBe(false);

  expect(isURL(new URL("http://www.baidu.com"))).toBe(true);
  expect(isNode()).toBe(true);
});

it("toRawType", () => {
  expect(toRawType(1)).toBe("Number");
  expect(toRawType("1")).toBe("String");
  expect(toRawType(true)).toBe("Boolean");
  expect(toRawType(false)).toBe("Boolean");
  expect(toRawType(null)).toBe("Null");
  expect(toRawType(undefined)).toBe("Undefined");
  expect(toRawType({})).toBe("Object");
  expect(toRawType([])).toBe("Array");
  expect(toRawType(() => {})).toBe("Function");
  expect(toRawType(Promise.resolve())).toBe("Promise");
  expect(toRawType(new Error("error"))).toBe("Error");
  expect(toRawType(Buffer.from("test"))).toBe("Uint8Array");
  expect(toRawType(new Uint8Array())).toBe("Uint8Array");
});
