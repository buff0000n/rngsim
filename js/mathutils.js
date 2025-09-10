var MathUtils = (function() {
    function binarySearch(a, key) {
        return binarySearch0(a, 0, a.length, key);
    }

    function binarySearch0(a, fromIndex, toIndex, key) {
        // this is translated directly from Java's binary search implementation, because that's what I originally wrote
        // this program in

        var low = fromIndex;
        var high = toIndex - 1;

        while (low <= high) {
            var mid = (low + high) >>> 1;
            var midVal = a[mid];

            if (midVal < key)
                low = mid + 1;  // Neither val is NaN, thisVal is smaller
            else if (midVal > key)
                high = mid - 1; // Neither val is NaN, thisVal is larger
            else {
                if (midVal == key)     // Values are equal
                    return mid;             // Key found
                else if (midVal < key) // (-0.0, 0.0) or (!NaN, NaN)
                    low = mid + 1;
                else                        // (0.0, -0.0) or (NaN, !NaN)
                    high = mid - 1;
            }
        }
        return -(low + 1);  // key not found.
    }

    function getGcd(a, b) {
        // easy case a == b
        if (a == b) {
            return a;
        }
        // make a > b
        if (a < b) {
            var c = a;
            a = b;
            b = c;
        }
        // oh look it's the Euclidean algorithm
        for (;;) {
            var c = a % b;
            if (c == 0) {
                return b;
            }
            if (c == 1) {
                return 1;
            }
            a = b;
            b = c;
        }
    }

    return {
        binarySearch: binarySearch,
        getGcd: getGcd
    }
})()