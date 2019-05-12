; Returns the number of digits in an integer
(def digits (n c)
     (if (< n 10)
	 (+ c 1)
       (digits (/ n 10) (+ c 1))))

; Writes a number to stdout
(def print (n)
     (let ((prevDigits (digits n 0)))
       (while (!= n 0)
	 (let ((power (pow 10 (- (digits n 0) 1)))
	       (tmp (/ n power)))
	   (set n (- n (* power tmp)))
	   ; Write the current number as ASCII
	   (set tmp (+ 48 n))
	   (syscall/write 1 (& tmp) 1)

	   ; Fill in any zeros skipped
	   (while (< (+ 1 (digits n 0)) prevDigits)
	     (set prevDigits (- prevDigits 1))
	     (set tmp 48)
	     (syscall/write 1 (& tmp) 1))))))
