(def fib (n)
     (if (< n 2)
	 n
       (+ (fib (- n 1)) (fib (- n 2)))))

(def main ()
     (fib 10))
