module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "refactor", "test", "build", "ci", "chore"],
    ],
    "scope-case": [0, "always"],
    "scope-empty": [0, "always"],
  },
};
