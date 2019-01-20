# ulisp

A minimal, mostly wrong assembly compiler for a lisp-like language
written in Javascript.

### Tutorials

1. [Lisp to Assembly](http://notes.eatonphil.com/compiler-basics-lisp-to-assembly.html)
2. [User-defined functions and variables](http://notes.eatonphil.com/compiler-basics-functions.html)

### Example

The following program:

```
$ cat tests/two_function_calls.js
(def main ()
     (+ 1 (+ 2 9)))
```

Returns 12 as its exit code when compiled:

```
$ node ulisp.js tests/two_function_calls.js
$ ./build/a.out
$ echo $?
12
```

By generating this assembly:

```
  .global _main

  .text

plus:
  ADD RDI, RSI
  MOV RAX, RDI
  RET

main:
  PUSH RDI
  PUSH RSI
  MOV RDI, 1
  PUSH RDI
  PUSH RSI
  MOV RDI, 2
  MOV RSI, 9
  CALL plus
  POP RSI
  POP RDI
  MOV RSI, RAX
  CALL plus
  POP RSI
  POP RDI
  RET

_main:
  CALL main
  MOV RDI, RAX
  MOV RAX, 0x2000001
  SYSCALL
```
