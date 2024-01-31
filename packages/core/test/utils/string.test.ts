import { expect, it } from "vitest";
import { escapeStringRegexp, normalizeRoute, parseJson, stringifyJson, transformTemplate } from "../../src/utils/string";

it("test-utils-normalizeRoute", () => {
  expect(normalizeRoute("/api/hello", "get")).toBe("[GET] /api/hello");
});

it("test-utils-string-template", () => {
  expect(transformTemplate("hello, <% name %><%empty%>, age is <% age %>", { name: "world", age: 13 })).toBe("hello, world, age is 13");
});

it("test-utils-string-escapeStringRegexp", () => {
  expect(escapeStringRegexp("How much $ for a 🦄?")).toBe("How much \\$ for a 🦄\\?");
});

it("test-utils-string-json", () => {
  const original = {
    name: "test",
    age: 12,
    children: [
      {
        name: "test2",
        age: 13
      }
    ],
    parent: {
      name: "test3",
      age: 14
    },
    und: undefined,
    nil: null,
    bt: true,
    bf: false
  };
  const str = stringifyJson(original);
  expect(str).toBe(JSON.stringify(original));
  const obj = parseJson(str);
  expect(obj).toEqual(original);
});
