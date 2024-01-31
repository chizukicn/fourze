// @vitest-environment jsdom

import { expect, it } from "vitest";
import {
  isBrowser,
  isFormData
} from "../../src/utils/is";

it("is-type-dom", () => {
  expect(isFormData(new FormData())).toBe(true);
  expect(isBrowser()).toBe(true);
});
