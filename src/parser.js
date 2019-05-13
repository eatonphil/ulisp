const WHITESPACE = [' ', '\n', '\t'];

module.exports.parse = function parse(program = '') {
  const tokens = [];
  let currentToken = '';

  for (let i = 0; i < program.length; i++) {
    const char = program.charAt(i);

    if (char === '(') {
      const [parsed, rest] = parse(program.substring(i + 1));
      tokens.push(parsed);
      program = rest;
      i = -1;
    } else if (char === ')') {
      if (currentToken.length) {
        tokens.push(+currentToken || currentToken);
      }

      return [tokens, program.substring(i + 1)];
    } else if (char === ';') {
      while (program.charAt(i) !== '\n') {
	i++;
      }
    } else if (WHITESPACE.includes(char)) {
      if (currentToken.length) {
        tokens.push(+currentToken || currentToken);
      }
      currentToken = '';
    } else {
      currentToken += char;
    }
  }

  return [tokens, ''];
};
