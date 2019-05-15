(def digits (n c)
     (if (< n 10)
	 (+ c 1)
       (digits (/ n 10) (+ c 1))))

(def main ()
     (digits 10234 0))
