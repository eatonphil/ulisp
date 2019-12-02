const cp = require('child_process');
const fs = require('fs');
const os = require('os');

function range(n) {
  return Array.from(Array(n).keys());
}

let GLOBAL_COUNTER = 0;

const SYSCALL_MAP = {
  'darwin': {
    exit: '0x2000001',
    write: '0x2000004',
  },
  'linux': {
    exit: 60,
    write: 1,    
  },
}[os.platform()];

class Scope {
  localOffset = 1;
  map = {};

  assign(name) {
    const safe = name.replace('-', '_');
    this.map[name] = this.localOffset++;
    return safe;
  }

  symbol() {
    return this.localOffset++;
  }

  lookup(name) {
    const safe = name.replace('-', '_');
    return this.map[name];
  }

  copy() {
    const s = new Scope();
    // In the future we may need to store s.scopeOffset = this.scopeOffset + 1
    // so we can read outer-scoped values at runtime.
    s.map = { ...this.map };
    return s;
  }
}

class Compiler {
  constructor() {
    this.outBuffer = [];
    this.primitiveFunctions = {
      def: this.compileDefine.bind(this),
      begin: this.compileBegin.bind(this),
      'if': this.compileIf.bind(this),
      ...this.prepareInstructionWrappers(),
      ...this.prepareSyscallWrappers(),
    };
  }

  prepareInstructionWrappers() {
    // General operatations
    const prepare = (instruction) => (arg, scope, depth) => {
      depth++;
      this.emit(depth, `# ${instruction.toUpperCase()}`);

      // Compile first argument
      this.compileExpression(arg[0], scope, depth);

      // Compile second argument
      this.compileExpression(arg[1], scope, depth);
      this.emit(depth, `POP RAX`);

      // Compile operation
      this.emit(depth, `${instruction.toUpperCase()} [RSP], RAX`);

      this.emit(depth, `# End ${instruction.toUpperCase()}`);
    }

    // Operations that use RAX implicitly
    const prepareRax = (instruction) => (arg, scope, depth) => {
      depth++;
      this.emit(depth, `# ${instruction.toUpperCase()}`);

      // Compile first argument, store in RAX
      this.compileExpression(arg[0], scope, depth);

      // Compile second argument
      this.compileExpression(arg[1], scope, depth);

      // Must POP _after_ both have been compiled
      this.emit(depth, `POP RAX`);
      this.emit(depth, `XCHG [RSP], RAX`);

      // Compiler operation
      this.emit(depth, `${instruction.toUpperCase()} QWORD PTR [RSP]`);

      // Swap the top of the stack
      this.emit(depth, `MOV [RSP], RAX`);
    }

    const prepareComparison = (operator) => (arg, scope, depth) => {
      depth++;
      this.emit(depth, `# ${operator}`);

      // Compile first argument, store in RAX
      this.compileExpression(arg[0], scope, depth);

      // Compile second argument
      this.compileExpression(arg[1], scope, depth);
      this.emit(depth, `POP RAX`);

      // Compile operation
      this.emit(depth, `CMP [RSP], RAX`);

      // Reset RAX to serve as CMOV* dest, MOV to keep flags (vs. XOR)
      this.emit(depth, `MOV RAX, 0`);

      // Conditional set [RSP]
      const operation = {
	'>': 'CMOVA',
	'>=': 'CMOVAE',
	'<': 'CMOVB',
	'<=': 'CMOVBE',
	'==': 'CMOVE',
	'!=': 'CMOVNE',
      }[operator];
      // CMOV* requires the source to be memory or register
      this.emit(depth, `MOV DWORD PTR [RSP], 1`);
      // CMOV* requires the dest to be a register
      this.emit(depth, `${operation} RAX, [RSP]`);
      this.emit(depth, `MOV [RSP], RAX`);
      this.emit(depth, `# End ${operator}`);
    };

    return {
      '+': prepare('add'),
      '-': prepare('sub'),
      '&': prepare('and'),
      '|': prepare('or'),
      '=': prepare('mov'),
      '*': prepareRax('mul'),
      '/': prepareRax('div'),
      '>': prepareComparison('>'),
      '>=': prepareComparison('>='),
      '<': prepareComparison('<'),
      '<=': prepareComparison('<='),
      '==': prepareComparison('=='),
      '!=': prepareComparison('!='),
    };
  }

  prepareSyscallWrappers() {
    const registers = ['RDI', 'RSI', 'RDX', 'R10', 'R8', 'R9'];

    const wrappers = {};
    Object.keys(SYSCALL_MAP).forEach((key, obj) => {
      wrappers[`syscall/${key}`] = (args, scope, depth) => {
	if (args.length > registers.length) {
	  throw new Error(`Too many arguments to syscall/${key}`);
	}

	// Compile first
	args.forEach((arg) => this.compileExpression(arg, scope, depth));

	// Then pop to avoid possible register contention
	args.forEach((_, i) => this.emit(depth, `POP ${registers[args.length - i - 1]}`))

	this.emit(depth, `MOV RAX, ${SYSCALL_MAP[key]}`);
	this.emit(depth, 'SYSCALL');
	this.emit(depth, `PUSH RAX`);
      };
    });

    return wrappers;
  }

  emit(depth, args) {
    if (depth === undefined || args === undefined) {
      throw new Error('Invalid call to emit');
    }

    const indent = new Array(depth + 1).join('  ');
    this.outBuffer.push(indent + args);
  }

  store(name, scope) {
    // Store parameter mapped to associated local
    scope.map[name] = scope.localOffset++;
    return scope.map[name];
  }

  compileExpression(arg, scope, depth) {
    // Is a nested function call, compile it
    if (Array.isArray(arg)) {
      this.compileCall(arg[0], arg.slice(1), scope, depth);
      return;
    }

    if (Number.isInteger(arg)) {
      this.emit(depth, `PUSH ${arg}`);
      return;
    }

    if (arg.startsWith('&')) {
      const localOffset = scope.lookup(arg.substring(1));
      // Copy the frame pointer so we can return an offset from it
      this.emit(depth, `MOV RAX, RBP`);
      const operation = localOffset < 0 ? 'ADD' : 'SUB';
      this.emit(depth, `${operation} RAX, ${Math.abs(localOffset * 8)} # ${arg}`);
      this.emit(depth, `PUSH `);
      return;
    }

    const localOffset = scope.lookup(arg);
    if (localOffset) {
      const operation = localOffset < 0 ? '+' : '-';
      this.emit(depth, `PUSH [RBP ${operation} ${Math.abs(localOffset * 8)}] # ${arg}`);
    } else {
      throw new Error(
        'Attempt to reference undefined variable or unsupported literal: ' +
        arg,
      );
    }
  }

  compileIf([test, then, els], scope, depth) {
    this.emit(depth, '# If');
    // Compile test
    this.compileExpression(test, scope, depth);
    const branch = `else_branch` + GLOBAL_COUNTER++;
    // Must pop/use up argument in test
    this.emit(0, '');
    this.emit(depth, `POP RAX`);
    this.emit(depth, `TEST RAX, RAX`);
    this.emit(depth, `JZ .${branch}\n`);

    // Compile then section
    this.emit(depth, `# If then`);
    this.compileExpression(then, scope, depth);
    this.emit(depth, `JMP .after_${branch}\n`);

    // Compile else section
    this.emit(depth, `# If else`);
    this.emit(0, `.${branch}:`);
    if (els) {
      this.compileExpression(els, scope, depth);
    }
    this.emit(0, `.after_${branch}:`);
    this.emit(depth, '# End if');
  }

  compileBegin(body, scope, depth) {
    body.forEach((expression) =>
      this.compileExpression(expression, scope, depth));
  }

  compileDefine([name, params, ...body], scope, depth) {
    // Add this function to outer scope
    const safe = scope.assign(name);

    // Copy outer scope so parameter mappings aren't exposed in outer scope.
    const childScope = scope.copy();

    this.emit(0, `${safe}:`);
    this.emit(depth, `PUSH RBP`);
    this.emit(depth, `MOV RBP, RSP\n`);

    // Copy params into local stack
    // NOTE: this doesn't actually copy into the local stack, it
    // just references them from the caller. They will need to
    // be copied in to support mutation of arguments if that's
    // ever a desire.
    params.forEach((param, i) => {
      childScope.map[param] = -1 * (params.length - i - 1 + 2);
    });

    // Pass childScope in for reference when body is compiled.
    this.compileBegin(body, childScope, depth);

    // Save the return value
    this.emit(0, '');
    this.emit(depth, `POP RAX`);
    this.emit(depth, `POP RBP\n`);

    this.emit(depth, 'RET\n');
  }

  compileCall(fun, args, scope, depth) {
    if (this.primitiveFunctions[fun]) {
      this.primitiveFunctions[fun](args, scope, depth);
      return;
    }

    // Compile registers and store on the stack
    args.map((arg, i) =>
      this.compileExpression(arg, scope, depth));

    const validFunction = scope.lookup(fun);
    if (validFunction) {
      this.emit(depth, `CALL ${fun}`);
    } else {
      throw new Error('Attempt to call undefined function: ' + fun);
    }

    if (args.length > 1) {
      // Drop the args
      this.emit(depth, `ADD RSP, ${args.length * 8}`);
    }

    if (args.length === 1) {
      this.emit(depth, `MOV [RSP], RAX\n`);
    } else {
      this.emit(depth, 'PUSH RAX\n');
    }
  }

  emitPrefix() {
    this.emit(1, '.global _main\n');

    this.emit(1, '.text\n');
  }

  emitPostfix() {
    this.emit(0, '_main:');
    this.emit(1, 'CALL main');
    this.emit(1, 'MOV RDI, RAX'); // Set exit arg
    this.emit(1, `MOV RAX, ${SYSCALL_MAP['exit']}`);
    this.emit(1, 'SYSCALL');
  }

  getOutput() {
    const output = this.outBuffer.join('\n');

    // Leave at most one empty line
    return output.replace(/\n\n\n+/g, '\n\n');
  }
}

module.exports.compile = function(ast) {
  const c = new Compiler();
  c.emitPrefix();
  const s = new Scope();
  c.compileCall('begin', ast, s, 1);
  c.emitPostfix();
  return c.getOutput();
};

module.exports.build = function(buildDir, program) {
  const prog = 'prog';
  fs.writeFileSync(`${buildDir}/${prog}.s`, program);
  cp.execSync(
    `gcc -mstackrealign -masm=intel -o ${buildDir}/${prog} ${buildDir}/${prog}.s`,
  );
};
