module.exports = {
  extends: [
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    "arrow-parens": [
      1,
      "always"
    ],
    "class-methods-use-this": 1,
    "func-names": 0,
    "function-paren-newline": 0,
    "no-plusplus": 0,
    "object-curly-newline": 0,
    "prefer-arrow-callback": 0,
  }
};
