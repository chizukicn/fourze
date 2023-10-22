import { defineConfig } from "vitest/config";
import { alias } from "./alias";

export default defineConfig({
  test: {
    testTimeout: 1000 * 60 * 3
  },
  resolve: {
    alias
  }
});
