const cp = require("child_process");
const fs = require("fs");

const { parse } = require("./parser");
const { compile } = require("./compiler");

function main(args) {
  const input = fs.readFileSync(args[2]).toString();
  const [ast] = parse(input);
  const program = compile(ast);

  try {
    fs.mkdirSync("build");
  } catch (e) {}
  fs.writeFileSync("build/prog.s", program);
  cp.execSync("gcc -mstackrealign -masm=intel -o build/a.out build/prog.s");
}

main(process.argv);
