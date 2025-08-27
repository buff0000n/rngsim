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

    function defaultResultCallback(value) {
        function expectedValueResult(value) {
            console.log("Mean: " + value);
        }
        function varianceResult(value) {
            console.log("Variance: " + value);
            console.log("Std Dev: " + Math.sqrt(value));
        }
        return {
            expectedValueResult: expectedValueResult,
            varianceResult: varianceResult
        };
    }

    function defaultProgressCallback(fraction) {
        console.log("Progress: " + (fraction * 100).toFixed(2));
    }

    function expectedValue(expCallback, probs, index, nnz, fnzi) {
        if (nnz == 0) {
            // degenerate case, shouldn't actually reach this
            return 0;

        } else if (nnz == 1) {
            // easy base case
            // expected trials for 1 success = 1.0/prob
            // if n successes are required then just multiply the expected trials for 1 success by n
            return index[fnzi]/probs[fnzi];

        } else {
            // This is made more complicated by the fact that the drop table probabilities typically do not add
            // up to 100%, so we have to account for the "nothing changed" result
            // I've derived the generalized negative binomial expected trials formula as this:
            // expected trials = (1 + prob(A)*(expected trials given A)
            //                      + prob(B)*(expected trials given B)
            //                      + prob(C)*(expected trials given C)
            //                      + ...
            //                    ) / (prob(A) + prob(B) + prob(C) + ... )
            // where
            //   prob(X): probably of X result
            //   expected trials given X: expected value of the state where X has occurred one more time
            // If the remaining successes required for an item is zero then that item
            // and its probability are ignored
            // If all the remaining successes are zero then the expected trials is 0.
            // This reduces to the base case if only one index is non-zero.

            // accumulates the weighted expected trials for each possible success
            var caseSum = 0;
            // accumulates the total probability of the possible successes
            var probSum = 0;
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
                    caseSum += probs[i] * expCallback(index);
                    // last, revert the index change
                    index[i] += 1;
                }
            }
            // finish the calculation
            return (1 + caseSum) / probSum;
        }
    }

    function variance(varCallback, expCallback, probs, index, nnz, fnzi) {
        if (nnz == 0) {
            // degenerate case, shouldn't actually reach this
            return 0;

        } else if (nnz == 1) {
            // not as easy base case
            // negative binomial variance formula is this:
            // r(1-p)/(r^2)
            //   r: required successes
            //   p: success probability
            return (index[fnzi]*(1-probs[fnzi]))/(probs[fnzi] * probs[fnzi]);

        } else {
            // Variance is more complicated to combine
            // big thanks to this guy https://math.stackexchange.com/a/3275586
            // and the Law of Total Variance
            // This is made more complicated by the fact that the drop table probabilities typically do not add
            // up to 100%, so we have to account for the "nothing changed" result
            // The general formula is:
            // variance = (
            //                prob(A)*(variance given A)
            //              + prob(B)*(variance given B)
            //              + prob(C)*(variance given C)
            //              + ...
            //              + prob(A)*(expected trials given A)^2
            //              + prob(B)*(expected trials given B)^2
            //              + prob(C)*(expected trials given C)^2
            //              + ...
            //              + (1 - (prob(A) + prob(B) + prob(C) + ... )) * (expected trials in the current state)^2
            //              - (
            //                    prob(A)*(expected trials given A)
            //                  + prob(B)*(expected trials given B)
            //                  + prob(C)*(expected trials given C)
            //                  + ...
            //                  + (1 - (prob(A) + prob(B) + prob(C) + ... )) * (expected trials in the current state)
            //                )^2
            //            ) / (prob(A) + prob(B) + prob(C) + ... )
            // where
            //   prob(X): probably of X result
            //   variance given X: variance of the state where X has occurred one more time
            //   expected trials given X: expected value of the state where X has occurred one more time
            //   expected trials in the current state: expected trials in the current state

            // variance sum
            var vSum = 0;
            // expected value squared sum
            var esSum = 0;
            // expected value sum
            var eSum = 0;
            // probability sum
            var probSum = 0;
            // loop over the index
            for (var i = 0; i < index.length; i++) {
                // skip over items with zero required success remaining
                if (index[i] > 0) {
                    // add to prob sum
                    probSum += probs[i];
                    // reuse index object
                    index[i] -= 1;
                    // add dependent variable to sums
                    vSum += probs[i] * varCallback(index);
                    var e = expCallback(index);
                    esSum += probs[i] * e * e;
                    eSum += probs[i] * e;
                    // last, revert the index change
                    index[i] += 1;
                }
            }
            var eThis = expCallback(index);
            esSum += (1-probSum) * eThis * eThis;
            eSum += (1-probSum) * eThis;
            // finish the calculation
            return (vSum + esSum - (eSum * eSum)) / probSum;
        }
    }

    /**
     * probs: Array of probabilities for each item
     * nums: Array of required number of successes for each item
     *       If omitted then assumed to be 1 of each
     * progressCallback: callback function to display progress, takes a fraction between 0 and 1
     * resultCallback: callback object with expectedValueResult() and varianceResult()
     * returns: expected average number of trials for full success
     **/
    function calculateStats(probs, nums=null, progressCallback=defaultProgressCallback, resultCallback=defaultResultCallback()) {
        // todo: there are a lot of optimizations that can be done if all the probabilities and nums are equal
        // not to do: skew, excess kurtosis, probably feasible but not worth the trouble
        // very not to do: The median, 90th percentile, and 99th percentile are apparently not
        // feasible to calculate analytically

        // apply default nums if necessary
        if (nums == null) {
            nums = fillArray(probs.length, 1);
        }
        // track the total number of sub-calculations
        var totalCalcs = 1;
        // the dimensions of the cache array are 1 more than each of the
        // item's required successes
        var dims = fillArray(nums.length, 0);
        for (var i = 0; i < nums.length; i++) {
            dims[i] = nums[i] + 1;
            // calculate the total number of sub-calculations
            totalCalcs *= dims[i];
        }
        // one more level to store mean and variance
        dims.push(2);
        // create the cache
        var array = createArray(dims);

        // track some calculation stats
        var calcs = 0;
        var cacheHits = 0;
        var depth = 0;
        var maxDepth = 0;
        var numBatches = 0;

        function runCalc(index, result) {
            // find how many indexes are non-zero
            var nnz = 0; // number of non-zero indices
            var fnzi = -1; // first non-zero index
            for (var i = 0; i < index.length; i++) {
                if (index[i] > 0) {
                    nnz++;
                    if (fnzi == -1) fnzi = i;
                }
            }

            calcs++;
            result[0] = expectedValue(getExpectedValue, probs, index, nnz, fnzi)
            calcs++;
            result[1] = variance(getVariance, getExpectedValue, probs, index, nnz, fnzi)
        }

        // recursive implementation
        function getFromArray(index, avgOrVar) {
            // look for cached value
            var value = getArrayValue(array, index);
            if (value[avgOrVar] > 0) {
                cacheHits++;
                return value[avgOrVar];
            }
            depth++;
            if (depth > maxDepth) maxDepth = depth;
            runCalc(index, value);
            depth--;
            return value[avgOrVar];
        }

        function getExpectedValue(index) { return getFromArray(index, 0); }
        function getVariance(index) { return getFromArray(index, 1); }

        function finish() {
            // start at the specified numbers of successes and let it work its way
            // down recursively to the base cases and add everything up
            var expectedValue = getExpectedValue(nums);
            var variance = getVariance(nums);
            // log some stats
            console.log("finished with " + calcs + " sub-calculations and " + cacheHits + " cache hits, max recursive depth: " + maxDepth + ", batches: " + numBatches);
            // holy crap that's it
            progressCallback(1);
            resultCallback.expectedValueResult(expectedValue);
            resultCallback.varianceResult(variance);
        }

        // seed the intermediate calculations in a way I can easily partition into batches
        // start with an index at all 0's
        var index = fillArray(nums.length, 0);
        // number of calculations to perform per batch
        // wild-ass guess based on my local testing
        var batchSize = 50000;

        // batch function
        function runBatch() {
            // increment stats
            numBatches++;
            // run one batch's worth of calculations
            for (var b = 0; b < batchSize; b++) {
                // increment the lowest index, bubbling up to higher indices
                // if an index exceeds its respective max number
                for (var i = 0;; i++) {
                    // bubbled up past the end of the array, we are done.
                    if (i >= nums.length) {
                        // run the finish function
                        finish();
                        // exit the calculation
                        return;
                    }
                    // increment the current index
                    index[i]++;
                    // check if the index has gone past its respective max number
                    if (index[i] > nums[i]) {
                        // reset to 0
                        index[i] = 0;
                        // continue iterating to bubble up to the next index
                    } else {
                        // current index is fine, don't continue bubbling up
                        break;
                    }
                }
                // seed the expected value and variance at this index
                getExpectedValue(index);
                getVariance(index);
            }
            progressCallback(calcs / totalCalcs);
            // yield and run another batch ASAP
            setTimeout(runBatch, 1);
        }

        // start the batches
        progressCallback(0);
        runBatch();
    }

    function test3() {
        calculateStats([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1], [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    }

    return  {
        /**
         * probs: Array of probabilities for each item
         * nums: Array of required number of successes for each item
         *       If omitted then assumed to be 1 of each
         * progressCallback: callback function to display progress, takes a fraction between 0 and 1
         * resultCallback: callback object with expectedValueResult() and varianceResult()
         **/
        calculateStats: calculateStats, // (probs, nums=null, progressCallback=defaultProgressCallback, resultCallback=defaultResultCallback)
        test3: test3
    };
})();


