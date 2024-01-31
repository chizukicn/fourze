import { expect, it } from "vitest";
import { randomArray, randomBoolean, randomDate, randomInt, randomItem, randomUnique } from "../../src/utils/random";

it("random-array", () => {
  const array = randomArray(
    (index) => {
      return {
        name: `item-${index}`,
        count: randomInt("200-500")
      };
    },
    12,
    30
  );
  const item = randomItem(array);
  expect(array).length.greaterThanOrEqual(12).lessThanOrEqual(30);
  expect(array).include(item);
});

it("random-int", () => {
  // by string template
  const num = randomInt("200-500");
  expect(num).toBeGreaterThanOrEqual(200);
  expect(num).toBeLessThanOrEqual(500);

  // by number
  const num2 = randomInt(200, 500);
  expect(num2).toBeGreaterThanOrEqual(200);
  expect(num2).toBeLessThanOrEqual(500);
});

it("random-date", () => {
  const date = randomDate("2020-01-01", "2022-01-01");
  expect(date.getTime()).toBeGreaterThanOrEqual(new Date("2020-01-01").getTime());
});

it("random-unique", () => {
  const random = randomUnique([1, 2, 2, 3, 3, 3]);
  const r1 = random();
  const r2 = random();
  const r3 = random();
  expect(r1).not.toBe(r2);
  expect(r2).not.toBe(r3);
  expect(r1).not.toBe(r3);
});

it("random-boolean", () => {
  const bool = randomBoolean();
  expect(bool).toBeTypeOf("boolean");
});
