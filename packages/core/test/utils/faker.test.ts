import { expect, it } from "vitest";
import { parseFakerNumber, parseFakerObject } from "../../src/utils/faker";

it("test-faker-number", () => {
  expect(parseFakerNumber("200")).toBe(200);
  expect(parseFakerNumber(300)).toBe(300);
  expect(parseFakerNumber("abc")).toBeNaN();
  expect(parseFakerNumber("300-600")).greaterThan(200).lessThanOrEqual(600);
  expect(parseFakerNumber("600-900")).toBeLessThanOrEqual(900);
  const tmp = parseFakerNumber(["200", 600, "900-1200"]);
  expect(tmp).greaterThanOrEqual(200).lessThanOrEqual(1200);
});

it("test-faker-object", () => {
  const [obj] = parseFakerObject([{
    a: "{100}",
    b: "{300-600}",
    c: 8799,
    d: [100, 30, "{400-900}"],
    e: "{$a}",
    f: "{true}",
    g: "{false}",
    h: "{null}",
    i: "{undefined}",
    j: {
      $type: "number"
    },
    tof: "{true|false}",
    num: "{100|200|300}",
    mixin: "{'a'|b|c}-{100-200|300-600|700-900}"
  }], {
    context: {
      a: "123412"
    }
  });
  expect(obj.a).toBe(100);
  expect(obj.b).toBeLessThan(600);
  expect(obj.b).toBeGreaterThan(300);
  expect(obj.d[2]).toBeLessThan(900);
  expect(obj.d[2]).toBeGreaterThan(400);
  expect(obj.e).toBe("123412");
  expect(obj.f).toBe(true);
  expect(obj.g).toBe(false);
  expect(obj.h).toBe(null);
  expect(obj.i).toBe(undefined);
  expect(obj.tof).toBeTypeOf("boolean");
  expect(obj.num).toSatisfy((num: number) => [100, 200, 300].includes(num));
  expect(obj.mixin).toSatisfy((str: string) => {
    const [a, b] = str.split("-");
    const num = Number(b);
    return ["a", "b", "c"].includes(a) && ((num >= 100 && num <= 200) || (num >= 300 && num <= 600) || (num >= 700 && num <= 900));
  });
});
