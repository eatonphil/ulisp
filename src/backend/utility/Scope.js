class Scope {
  constructor() {
    this.locals = {};
  }

  symbol(prefix = 'sym') {
    const nth = Object.keys(this.locals).length + 1;
    return this.register(prefix + nth);
  }

  get(i) {
    return this.locals[i];
  }

  register(local) {
    let copy = local.replace('-', '_');
    let n = 1;
    while (this.locals[copy]) {
      copy = local + n++;
    }

    this.locals[local] = {
      value: copy,
      type: 'i64',
    };
    return this.locals[local];
  }

  copy() {
    const c = new Scope();
    c.locals = { ...this.locals };
    return c;
  }
}

module.exports.Scope = Scope;
