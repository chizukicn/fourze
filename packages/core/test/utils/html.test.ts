import { expect, it } from "vitest";
import { renderElement } from "../../src/utils/html";

it("test-utils-html", () => {
  expect(renderElement("div", { class: "test" }, "hello")).toBe("<div class=\"test\">hello</div>");
  expect(renderElement("div", { class: "test" }, "hello", "world")).toBe("<div class=\"test\">helloworld</div>");
});
