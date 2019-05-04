const cp = require('child_process');
const fs = require('fs');

const { Scope } = require('./utility/Scope');

class Compiler {
  constructor() {
    this.outBuffer = [];
    this.primitiveFunctions = {
      def: this.compileDefine.bind(this),
      begin: this.compileBegin.bind(this),
      'if': this.compileIf.bind(this),
      '+': this.compileOp('add'),
      '-': this.compileOp('sub'),
      '*': this.compileOp('mul'),
      '<': this.compileOp('icmp slt'),
      '=': this.compileOp('icmp eq'),
    };
  }

  emit(depth, args) {
    const indent = new Array(depth + 1).join('  ');
    this.outBuffer.push(indent + args);
  }

  compileOp(op) {
    return ([a, b], destination, scope) => {
      const arg1 = scope.symbol();
      const arg2 = scope.symbol();
      this.compileExpression(a, arg1, scope);
      this.compileExpression(b, arg2, scope);
      this.emit(1, `%${destination} = ${op} i32 %${arg1}, %${arg2}`);
    };
  }

  compileExpression(exp, destination, scope) {
    // Is a nested function call, compile it
    if (Array.isArray(exp)) {
      this.compileCall(exp[0], exp.slice(1), destination, scope);
      return;
    }

    const res = scope.get(exp);
    if (Number.isInteger(exp)) {
      this.emit(1, `%${destination} = add i32 ${exp}, 0`);
      return;
    }

    if (res) {
      this.emit(1, `%${destination} = add i32 %${res}, 0`);
    } else {
      throw new Error(
        'Attempt to reference undefined variable or unsupported literal: ' +
          exp,
      );
    }
  }

  compileBegin(body, destination, scope) {
    body.forEach((expression, i) =>
      this.compileExpression(
        expression,
        i === body.length - 1 ? destination : scope.symbol(),
        scope,
      ),
    );
  }

  compileIf([test, thenBlock, elseBlock], destination, scope) {
    const testVariable = scope.symbol();
    const result = scope.symbol('ifresult');
    // Space for result
    this.emit(1, `%${result} = alloca i32, align 4`);

    // Compile expression and branch
    this.compileExpression(test, testVariable, scope);
    const trueLabel = scope.symbol('iftrue');
    const falseLabel = scope.symbol('iffalse');
    this.emit(1, `br i1 %${testVariable}, label %${trueLabel}, label %${falseLabel}`);

    // Compile true section
    this.emit(0, trueLabel + ':');
    const tmp1 = scope.symbol();
    this.compileExpression(thenBlock, tmp1, scope);
    this.emit(1, `store i32 %${tmp1}, i32* %${result}, align 4`);
    const endLabel = scope.symbol('ifend');
    this.emit(1, 'br label %' + endLabel);
    this.emit(0, falseLabel + ':');

    // Compile false section
    const tmp2 = scope.symbol();
    this.compileExpression(elseBlock, tmp2, scope);
    this.emit(1, `store i32 %${tmp2}, i32* %${result}, align 4`);
    this.emit(1, 'br label %' + endLabel);

    // Compile cleanup
    this.emit(0, endLabel + ':');
    this.emit(1, `%${destination} = load i32, i32* %${result}, align 4`);
  }

  compileDefine([name, params, ...body], destination, scope) {
    // Add this function to outer scope
    const safeName = scope.register(name);

    // Copy outer scope so parameter mappings aren't exposed in outer scope.
    const childScope = scope.copy();

    const safeParams = params.map((param) =>
      // Store parameter mapped to associated local
      childScope.register(param),
    );

    this.emit(
      0,
      `define i32 @${safeName}(${safeParams
        .map((p) => `i32 %${p}`)
        .join(', ')}) {`,
    );

    // Pass childScope in for reference when body is compiled.
    const ret = childScope.symbol();
    this.compileExpression(body[0], ret, childScope);

    this.emit(1, `ret i32 %${ret}`);
    this.emit(0, '}\n');
  }

  compileCall(fun, args, destination, scope) {
    if (this.primitiveFunctions[fun]) {
      this.primitiveFunctions[fun](args, destination, scope);
      return;
    }

    const validFunction = scope.get(fun);
    if (validFunction) {
      const safeArgs = args
        .map((a) => {
          const res = scope.symbol();
          this.compileExpression(a, res, scope);
          return 'i32 %' + res;
        })
        .join(', ');
      this.emit(1, `%${destination} = call i32 @${validFunction}(${safeArgs})`);
    } else {
      throw new Error('Attempt to call undefined function: ' + fun);
    }
  }

  getOutput() {
    return this.outBuffer.join('\n');
  }
}

module.exports.compile = function(ast) {
  const c = new Compiler();
  const scope = new Scope();
  c.compileCall('begin', ast, scope.symbol(), scope);
  return c.getOutput();
};

module.exports.build = function(buildDir, program) {
  const prog = 'prog';
  fs.writeFileSync(buildDir + `/${prog}.ll`, program);
  cp.execSync(`llc -o ${buildDir}/${prog}.s ${buildDir}/${prog}.ll`);
  cp.execSync(`gcc -o ${buildDir}/${prog} ${buildDir}/${prog}.s`);
};
