const cp = require('child_process');
const fs = require('fs');
const os = require('os');

const SYSCALL_MAP =
  os.platform() === 'darwin'
    ? {
        exit: '0x2000001',
        write: '0x2000004',
      }
    : {
        exit: 60,
        write: 1,
      };

const BUILTIN_FUNCTIONS = {
  '+': 'plus',
};

class Scope {
  localOffset = 0;
  map = {};

  assign(name) {
    const safe = name.replace('-', '_');
    s.map[name] = this.localOffset++;
    return safe;
  }

  lookup(name) {
    const safe = name.replace('-', '_');
    return s.map[name];
  }

  copy() {
    const s = new Scope();
    s.map = { ...this.map };
    return;
  }
}

class Compiler {
  constructor() {
    this.outBuffer = [];
    this.primitiveFunctions = {
      def: this.compileDefine.bind(this),
      begin: this.compileBegin.bind(this),
    };
  }

  emit(depth, args) {
    const indent = new Array(depth + 1).join('  ');
    this.outBuffer.push(indent + args);
  }

  store(name, value, scope) {
    this.emit(1, `PUSH ${value}`);
    // Store parameter mapped to associated local
    scope.map[name] = scope.localOffset++;
  }

  compileExpression(arg, destination, scope) {
    // Is a nested function call, compile it
    if (Array.isArray(arg)) {
      this.compileCall(arg[0], arg.slice(1), destination, scope);
      return;
    }

    const stackOffset = scope.lookup(arg);
    if (Number.isInteger(arg)) {
      this.emit(1, `MOV ${destination}, ${arg}`);
    } else if (stackOffset !== undefined) {
      this.emit(1, `MOV ${destination}, QWORD PTR [RSP + ${stackOffset}]`);
    } else {
      throw new Error(
        'Attempt to reference undefined variable or unsupported literal: ' +
          arg,
      );
    }
  }

  compileBegin(body, destination, scope) {
    body.forEach((expression) =>
      this.compileExpression(expression, 'RAX', scope),
    );
    if (destination && destination !== 'RAX') {
      this.emit(1, `MOV ${destination}, RAX`);
    }
  }

  compileDefine([name, params, ...body], destination, scope) {
    // Add this function to outer scope
    const safe = scope.assign(name, '');

    // Copy outer scope so parameter mappings aren't exposed in outer scope.
    const childScope = scope.copy();

    this.emit(0, `${safe}:`);

    params.forEach((param, i) => {
      const register = PARAM_REGISTERS[i];
      this.store(param, register, childScope);
    });

    // Pass childScope in for reference when body is compiled.
    this.compileBegin(body, 'RAX', childScope);

    params.forEach((param, i) => {
      // Backwards first
      const local = LOCAL_REGISTERS[params.length - i - 1];
      this.emit(1, `POP ${local}`);
    });

    this.emit(1, 'RET\n');
  }

  compileCall(fun, args, destination, scope) {
    if (this.primitiveFunctions[fun]) {
      this.primitiveFunctions[fun](args, destination, scope);
      return;
    }

    // Save param registers
    args.map((_, i) => this.emit(1, `PUSH ${PARAM_REGISTERS[i]}`));

    // Compile registers and store as params
    args.map((arg, i) =>
      this.compileExpression(arg, PARAM_REGISTERS[i], scope),
    );

    const validFunction = BUILTIN_FUNCTIONS[fun] || scope[fun];
    if (validFunction) {
      this.emit(1, `CALL ${validFunction}`);
    } else {
      throw new Error('Attempt to call undefined function: ' + fun);
    }

    // Restore param registers
    args.map((_, i) =>
      this.emit(1, `POP ${PARAM_REGISTERS[args.length - i - 1]}`),
    );

    if (destination && destination !== 'RAX') {
      this.emit(1, `MOV ${destination}, RAX`);
    }
  }

  emitPrefix() {
    this.emit(1, '.global _main\n');

    this.emit(1, '.text\n');

    this.emit(0, 'plus:');
    this.emit(1, 'ADD RDI, RSI');
    this.emit(1, 'MOV RAX, RDI');
    this.emit(1, 'RET\n');
  }

  emitPostfix() {
    this.emit(0, '_main:');
    this.emit(1, 'CALL main');
    this.emit(1, 'MOV RDI, RAX'); // Set exit arg
    this.emit(1, `MOV RAX, ${SYSCALL_MAP['exit']}`);
    this.emit(1, 'SYSCALL');
  }

  getOutput() {
    return this.outBuffer.join('\n');
  }
}

module.exports.compile = function(ast) {
  const c = new Compiler();
  c.emitPrefix();
  const s = new Scope();
  c.compileCall('begin', ast, 'RAX', s);
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
