import { curev } from "@curev/eslint-config";

export default curev({
  rules: {
    "ts/no-var-requires": "off",
    "ts/no-require-imports": "off",
    "node/prefer-global/buffer": "off"
  },
  unocss: false
});
