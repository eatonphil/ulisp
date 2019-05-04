# ulisp

A compiler for a lisp-like language written in JavaScript targeting LLVM, x86 assembly.

### Tutorials

1. [Lisp to assembly](http://notes.eatonphil.com/compiler-basics-lisp-to-assembly.html)
2. [User-defined functions and variables](http://notes.eatonphil.com/compiler-basics-functions.html)
3. [LLVM](http://notes.eatonphil.com/compiler-basics-llvm.html)

### Example

The following program:

```
$ cat tests/fib.lisp
(def fib (n)
     (if (< n 2)
	 n
       (+ (fib (- n 1)) (fib (- n 2)))))

(def main ()
     (fib 8))
```

Returns 21 as its exit code when compiled:

```
$ node src/ulisp.js tests/fib.lisp
$ ./build/prog
$ echo $?
21
```

By generating this LLVM IR:

```llvm
define i32 @fib(i32 %n) {
  %ifresult7 = alloca i32, align 4
  %sym8 = add i32 %n, 0
  %sym9 = add i32 2, 0
  %sym6 = icmp slt i32 %sym8, %sym9
  br i1 %sym6, label %iftrue10, label %iffalse11
iftrue10:
  %sym12 = add i32 %n, 0
  store i32 %sym12, i32* %ifresult7, align 4
  br label %ifend13
iffalse11:
  %sym18 = add i32 %n, 0
  %sym19 = add i32 1, 0
  %sym17 = sub i32 %sym18, %sym19
  %sym15 = call i32 @fib(i32 %sym17)
  %sym21 = add i32 %n, 0
  %sym22 = add i32 2, 0
  %sym20 = sub i32 %sym21, %sym22
  %sym16 = call i32 @fib(i32 %sym20)
  %sym14 = add i32 %sym15, %sym16
  store i32 %sym14, i32* %ifresult7, align 4
  br label %ifend13
ifend13:
  %sym5 = load i32, i32* %ifresult7, align 4
  ret i32 %sym5
}

define i32 @main() {
  %sym6 = add i32 8, 0
  %sym5 = call i32 @fib(i32 %sym6)
  ret i32 %sym5
}
```
