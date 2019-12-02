const cp = require('child_process');
const fs = require('fs');

const { parse } = require('./parser');
const backends = require('./backend');

function main(args) {
  const kernel = fs.readFileSync(__dirname + '/../lib/kernel.lisp').toString();
  let input = kernel + '\n' + fs.readFileSync(args[2]).toString();

  let backend = backends.llvm;

  const restArgs = args.slice(3);
  for (let i = 0; i < restArgs.length; i++) {
    switch (restArgs[i]) {
      case '--no-kernel':
	input = input.substring(kernel.length + 1);
	break;
      case '--backend':
      case '-b':
	backend = backends[restArgs[i + 1]];
	if (!backend) {
	  console.log('Unsupported backend ' + restArgs[i+1]);
	  process.exit(1);
	}
	i++;
	break;
      case '--no-tail-call':
      case '-n':
	backend.TAIL_CALL_ENABLED = false;
	break;
    }
  }

  const [ast] = parse(input);
  const program = backend.compile(ast);

  try {
    fs.mkdirSync('build');
  } catch (e) {}
  backend.build('build', program);
}

main(process.argv);
