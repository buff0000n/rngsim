var Analysis = (function() {

    function createArray(dims) {
        return createArray0(dims, 0);
    }

    function createArray0(dims, start) {
        if (start == dims.length) {
            return 0;
        }
        var a = Array();
        for (var i = 0; i < dims[start]; i++) {
            a.push(createArray0(dims, start + 1));
        }
        return a;
    }

    function getArrayValue(array, indices) {
        // probably worth optimizing instead of the lazy recursive method
        var a = array;
        for (var i = 0; i < indices.length; i++) {
            a = a[indices[i]];
        }
        return a;
    }

    function setArrayValue(array, indices, value) {
        // probably worth optimizing instead of the lazy recursive method
        var a = array;
        for (var i = 0; i < indices.length - 1; i++) {
            a = a[indices[i]];
        }
        a[indices[indices.length - 1]] = value;
    }

    function fillArray(size, value) {
        var a = Array();
        for (var i = 0; i < size; i++) {
            a.push(value);
        }
        return a;
    }

    function arrayToString(array) {
        return "(" + array.join(", ") + ")";
    }

    /**
     * probs: Array of probabilities for each item
     * nums: Array of required number of successes for each item
     *       If omitted then assumed to be 1 of each
     * returns: expected average number of trials for full success
     **/
    function calculateExpectedTrials(probs, nums=null) {
        // apply default nums if necessary
        if (nums == null) {
            nums = fillArray(probs.length, 1);
        }
        // the dimensions of the cache array are 1 more than each of the
        // item's required successes
        var dims = fillArray(nums.length, 0);
        for (var i = 0; i < nums.length; i++) {
            dims[i] = nums[i] + 1;
        }
        // create the cache
        var array = createArray(dims);

        // track some calculation stats
        var calcs = 0;
        var cacheHits = 0;
        var maxDepth = 0;

        // recursive implementation
        // todo: iterative instead of recursive implementation
        function getExpected(index, depth=1) {
            // look for cached value
            var value = getArrayValue(array, index);
            if (value > 0) {
                cacheHits++;
                return value
            }
            calcs++;
            if (depth > maxDepth) maxDepth = depth;

            // find how many indexes are non-zero
            var nnz = 0; // number of non-zero indices
            var fnzi = -1; // first non-zero index
            for (var i = 0; i < index.length; i++) {
                if (index[i] > 0) {
                    nnz++;
                    if (fnzi == -1) fnzi = i;
                }
            }
            if (nnz == 0) {
                // degenerate case, shouldn't actually reach this
                value = 0;

            } else if (nnz == 1) {
                // easy base case
                // expected trials for 1 success = 1.0/prob
                // if n successes are required then just multiply the expected trials for 1 success by n
                value = index[fnzi]/probs[fnzi];

            } else {
                // The generalized binomial expected trials formula is this:
                // expected trials = (1 + prob(A)*(expected trials given A)
                //                      + prob(B)*(expected trials given B)
                //                      + prob(C)*(expected trials given C)
                //                      + ...
                //                      + prob(Z)*(expected trials given Z)
                //                    ) / (prob(A) + prob(B) + prob(C) + ... + prob(Z) )
                // If the remaining successes required for an item is zero then that item
                // and its probability are ignored
                // If all the remaining successes are zero then the expected trials is 0.
                // This reduces to the base case if only one index is non-zero.

                // accumulates the weighted expected trials for each possible success
                var caseSum = 0;
                // accumulates the total probability of the possible successes
                var probSum = 0
                // loop over the index
                for (var i = 0; i < index.length; i++) {
                    // skip over items with zero required success remaining
                    if (index[i] > 0) {
                        // add to prob sum
                        probSum += probs[i];
                        // Add weighted success case, reusing the index object
                        // to calculate the expected trials given the success
                        // First, reduce the required successes for this item by 1
                        index[i] -= 1;
                        // get the remaining expected trials given the success
                        caseSum += probs[i] * getExpected(index, depth + 1);
                        // last, revert the index change
                        index[i] += 1;
                    }
                }
                // finish the calculation
                value = (1 + caseSum) / probSum;
            }

            setArrayValue(array, index, value);
            return value;
        }

        // start at the specified numbers of successes and let it work its way
        // down recursively to the base cases and add everything up
        var value = getExpected(nums);
        // log some stats
        console.log("finished with " + calcs + " sub-calculations and " + cacheHits + " cache hits, max recursive depth: " + maxDepth);
        // holy crap that's it
        return value;
    }

    return  {
        /**
         * probs: Array of probabilities for each item
         * nums: Array of required number of successes for each item
         *       If omitted then assumed to be 1 of each
         * returns: expected average number of trials for full success
         **/
        calculateExpectedTrials: calculateExpectedTrials // (probs, nums=null)
    };
})();


