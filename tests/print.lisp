(def print-char1 (c)
     (syscall/write 1 &c 1))

(def print1 (n)
     (if (> n 9)
	 (print1 (/ n 10)))
     (print-char1 (+ 48 (% n 10))))

(def main ()
     (print1 123))
