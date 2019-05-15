(def print (n)
     (syscall/sys_write 1 &n 1))

(def main ()
     (print (+ 1 48))
     (print (+ 2 48))
     (print (+ 3 48))
     (print (+ 4 48))
     10)
