const os = require('os');

let OUT = '';

const SYSCALL_MAP = os.platform() === 'darwin' ? {
  'exit': '0x2000001',
  'write': '0x2000004'
} : {
  'exit': 60,
  'write': 1,
};

const BUILTIN_FUNCTIONS = {
  '+': 'plus',
};

function emit(depth, args) {
  const indent = new Array(depth + 1).join('  ');
  OUT += `${indent}${args}\n`;
}

function compile_expression(arg, destination, scope) {
  // Is a nested function call, compile it
  if (Array.isArray(arg)) {
    compile_call(arg[0], arg.slice(1), destination, scope);
    return;
  }

  if (scope[arg] || Number.isInteger(arg)) {
    emit(1, `MOV ${destination}, ${scope[arg] || arg}`);
  } else {
    throw new Error('Attempt to reference undefined variable or unsupported literal: ' + arg);
  }
}

const PARAM_REGISTERS = [
  'RDI',
  'RSI',
  'RDX',
];

const LOCAL_REGISTERS = [
  'RBX',
  'RBP',
  'R12',
];

function compile_begin(body, destination, scope) {
  body.forEach((expression) => compile_expression(expression, 'RAX', scope));
  if (destination && destination !== 'RAX') {
    emit(1, `MOV ${destination}, RAX`);
  }
}

function compile_define([name, params, ...body], destination, scope) {
  // Add this function to outer scope
  scope[name] = name.replace('-', '_');

  // Copy outer scope so parameter mappings aren't exposed in outer scope.
  const childScope = { ...scope };

  emit(0, `${scope[name]}:`);

  params.forEach(function (param, i) {
    const register = PARAM_REGISTERS[i];
    const local = LOCAL_REGISTERS[i];
    emit(1, `PUSH ${local}`);
    emit(1, `MOV ${local}, ${register}`);
    // Store parameter mapped to associated local
    childScope[param] = local;
  });

  // Pass childScope in for reference when body is compiled.
  compile_expression(body[0], 'RAX', childScope);

  params.forEach(function (param, i) {
    // Backwards first
    const local = LOCAL_REGISTERS[params.length - i - 1];
    emit(1, `POP ${local}`);
  });

  emit(1, 'RET\n');
}

const primitive_functions = {
  def: compile_define,
  begin: compile_begin,
};

function compile_call(fun, args, destination, scope) {
  if (primitive_functions[fun]) {
    primitive_functions[fun](args, destination, scope);
    return;
  }

  // Save param registers
  args.map((_, i) => emit(1, `PUSH ${PARAM_REGISTERS[i]}`));

  // Compile registers and store as params
  args.map((arg, i) => compile_expression(arg, PARAM_REGISTERS[i], scope));

  const validFunction = BUILTIN_FUNCTIONS[fun] || scope[fun];
  if (validFunction) {
    emit(1, `CALL ${validFunction}`);
  } else {
    throw new Error('Attempt to call undefined function: ' + fun);
  }

  // Restore param registers
  args.map((_, i) => emit(1, `POP ${PARAM_REGISTERS[args.length - i - 1]}`));

  if (destination && destination !== 'RAX') {
    emit(1, `MOV ${destination}, RAX`);
  }
}

function emit_prefix() {
  emit(1, '.global _main\n');

  emit(1, '.text\n');

  emit(0, 'plus:');
  emit(1, 'ADD RDI, RSI');
  emit(1, 'MOV RAX, RDI');
  emit(1, 'RET\n');
}

function emit_postfix() {
  emit(0, '_main:');
  emit(1, 'CALL main');
  emit(1, 'MOV RDI, RAX'); // Set exit arg
  emit(1, `MOV RAX, ${SYSCALL_MAP['exit']}`);
  emit(1, 'SYSCALL');
}

module.exports.compile = function (ast) {
  OUT = '';

  emit_prefix();
  compile_call('begin', ast, 'RAX', {});
  emit_postfix();

  return OUT;
}
