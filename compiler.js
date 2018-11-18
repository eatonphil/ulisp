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
    const indent = new Array(depth + 1).map(() => '').join('  ');
    OUT += `${indent}${args}\n`;
}

function compile_argument(arg, destination) {
    if (Array.isArray(arg)) {
	compile_call(arg[0], arg.slice(1), destination);
	return;
    }

    // Is primitive
    emit(1, `MOV ${destination}, ${arg}`);
}

const PARAM_REGISTERS = [
    'RDI',
    'RSI',
    'RDX',
];

function compile_call(fun, args, destination) {
    // Save param registers
    args.map((_, i) => emit(1, `PUSH ${PARAM_REGISTERS[i]}`));

    // Compile registers and store as params
    args.map((arg, i) => compile_argument(arg, PARAM_REGISTERS[i]));

    emit(1, `CALL ${BUILTIN_FUNCTIONS[fun] || fun}`);

    // Restore param registers
    args.map((_, i) => emit(1, `POP ${PARAM_REGISTERS[args.length - i - 1]}`));

    if (destination) {
	emit(1, `MOV ${destination}, RAX`);
    }

    emit(0, '');
}

function emit_prefix() {
    emit(1, '.global _main\n');

    emit(1, '.text\n');

    emit(0, 'plus:');
    emit(1, 'ADD RDI, RSI');
    emit(1, 'MOV RAX, RDI');
    emit(1, 'RET\n');

    emit(0, '_main:');
}

function emit_postfix() {
    emit(1, 'MOV RDI, RAX'); // Set exit arg
    emit(1, `MOV RAX, ${SYSCALL_MAP['exit']}`);
    emit(1, 'SYSCALL');
}

module.exports.compile = function (ast) {
    OUT = '';

    emit_prefix();
    compile_call(ast[0], ast.slice(1));
    emit_postfix();

    return OUT;
}
