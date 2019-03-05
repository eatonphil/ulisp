# ulisp

A minimal, mostly wrong compiler for a lisp-like language
written in Javascript.

### Tutorials

1. [Lisp to Assembly](http://notes.eatonphil.com/compiler-basics-lisp-to-assembly.html)
2. [User-defined functions and variables](http://notes.eatonphil.com/compiler-basics-functions.html)

### Example

The following program:

```
$ cat tests/function_definition.lisp
(def plus-two (a b)
     (+ a (+ b 2)))
	 
(def main ()
     (plus-two 3 (plus-two 1 1)))
```

Returns 9 as its exit code when compiled:

```
$ node ulisp.js tests/function_definition.lisp
$ ./build/prog
$ echo $?
9
```

By generating this LLVM IR:

```llvm
define i32 @plus_two(i32 %a, i32 %b) {
  %sym7 = add i32 %a, 0
  %sym9 = add i32 %b, 0
  %sym10 = add i32 2, 0
  %sym8 = add i32 %sym9, %sym10
  %sym6 = add i32 %sym7, %sym8
  ret i32 %sym6
}

define i32 @main() {
  %sym6 = add i32 3, 0
  %sym8 = add i32 1, 0
  %sym9 = add i32 1, 0
  %sym7 = call i32 @plus_two(i32 %sym8, i32 %sym9)
  %sym5 = call i32 @plus_two(i32 %sym6, i32 %sym7)
  ret i32 %sym5
}
```
