import { normalizeURL, withoutBase } from "@fourze/core";
import { suite } from "../lib/suite";

// const source = new Array(100).fill(0).map((_, i) => i);
suite("relativePath", 100000, () => {
  withoutBase("/api/abc", "/api");
});

suite("replace", 100000, () => {
  const a = "/api/abc";
  const b = "/api";
  normalizeURL((a.replace(b, "")));
});
