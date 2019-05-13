const cp = require('child_process');
const fs = require('fs');

const { parse } = require('./parser');
const backends = require('./backend');

function main(args) {
  const kernel = fs.readFileSync(__dirname + '/../lib/kernel.lisp').toString();
  const input = kernel + '\n' + fs.readFileSync(args[2]).toString();

  let backend;
  switch (args[3]) {
    case 'llvm':
    case undefined:
      backend = backends.llvm;
      break;
    case 'x86':
      backend = backends.x86;
      break;
    default:
      console.log('Unsupported backend ' + args[3]);
  }

  const [ast] = parse(input);
  const program = backend.compile(ast);

  try {
    fs.mkdirSync('build');
  } catch (e) {}
  backend.build('build', program);
}

main(process.argv);
