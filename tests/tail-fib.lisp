(def fib-help (a b n)
     (if (= n 0)
	 a
       (fib-help b (+ a b) (- n 1))))

(def fib (n)
     (fib-help 0 1 n))

(def main ()
     (print (fib 45)))
