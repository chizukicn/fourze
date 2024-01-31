import { expect, it } from "vitest";
import type { DelayMsType } from "../../src/utils/promise";
import { createSingletonPromise, delay, memoize } from "../../src/utils/promise";
import { randomInt } from "../../src/utils/random";

it("test-utils-promise-delay", async () => {
  const start = performance.now();
  await delay("200-300");
  const end = performance.now();
  const time = Math.round(end - start);
  expect(time).toBeGreaterThanOrEqual(200);
  expect(time).toBeLessThanOrEqual(300);
});

it("test-utils-promise-createSingletonPromise", async () => {
  const createInstance = () => randomInt("374-9197");

  const fn = createSingletonPromise(createInstance);

  const delayFn = function (ms: DelayMsType) {
    return async () => {
      await delay(ms);
      return fn();
    };
  };

  const r = await fn();

  fn.reset();

  const [r0, r1] = await Promise.all(
    [delayFn(300), delayFn("200-700")].map(r => r())
  );

  expect(r0).not.toBe(r);

  expect(r0).toBe(r1);
  const r2 = await delayFn("300-700")();
  expect(r2).toBe(r0);
});

it("memoize", async () => {
  const fn = async (a: number, b: number) => performance.now() + a + b;
  const memoized = memoize(fn);
  const r = await memoized(1, 2);
  const r2 = await memoized(1, 2);
  const r3 = await memoized(2, 3);
  expect(r).toBe(r2);
  expect(r).not.toBe(r3);
  memoized.delete([1, 2]);
  const r4 = await memoized(1, 2);
  expect(r4).not.toBe(r);
});
