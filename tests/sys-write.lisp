(def print (n)
     (syscall/sys_write 1 &n 1))

(def main ()
     (print 9)
     10)
