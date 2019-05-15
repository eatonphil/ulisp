(def print-char (c)
     (syscall/sys_write 1 &c 1))

(def print (n)
     (if (> n 9)
	 (print (/ n 10)))

     (print-char (+ 48 (% n 10))))
