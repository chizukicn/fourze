const { curev } = require("@curev/eslint-config");

module.exports = curev({
  rules: {
    "ts/no-var-requires": "off",
    "ts/no-require-imports": "off",
    "node/prefer-global/buffer": "off"
  }
});
