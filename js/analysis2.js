var Analysis2 = (function() {

    function createArray(dims) {
        return createArray0(dims, 0);
    }

    function createArray0(dims, start) {
        if (start == dims.length) {
            return -1;
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

    function singleDropToBaseNBCase(dropTable, requiredDrops) {
        var [dropKey, requiredAmount] = requiredDrops.map.entries().next().value;
        var dropEntry = dropTable.table[0];
        var dropAmount = dropEntry.dropMap.get(dropKey);
        if (dropAmount == 0) throw new Error("Table does not contain drop for " + dropKey);

        var dropProb = dropEntry.prob;
        var dropsRequired = Math.ceil(requiredAmount / dropAmount);

        return [dropProb, dropsRequired];
    }

    function expectedValueBaseCase(dropProb, numDropsRequired) {
        // easy base case
        // negative binomial expected value formula is just this:
        // r/p
        //   r: required successes
        //   p: success probability
        return numDropsRequired/dropProb;
    }

    /**
     * dropTable: DropTable Object
     * requiredDrops: IntMap object
     **/
    function expectedValue(expCallback, dropTable, requiredDrops) {
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
        for (var i = 0; i < dropTable.table.length; i++) {
            var dropTableEntry = dropTable.table[i];
            // add to prob sum
            probSum += dropTableEntry.prob;
            // Add weighted success case, reusing the index object
            // to calculate the expected trials given the success
            // get the remaining expected trials given the success
            var reducedRequiredDrops = requiredDrops.clone().subtractAll(dropTableEntry.dropMap, true);
            caseSum += dropTableEntry.prob * expCallback(reducedRequiredDrops);
        }
        // finish the calculation
        return (1 + caseSum) / probSum;
    }

    function varianceBaseCase(dropProb, numDropsRequired) {
        // not as easy base case
        // negative binomial variance formula is this:
        // r(1-p)/(p^2)
        //   r: required successes
        //   p: success probability
        return (numDropsRequired * (1-dropProb)) / (dropProb * dropProb);
    }

    function variance(varCallback, expCallback, dropTable, requiredDrops) {
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
        for (var i = 0; i < dropTable.table.length; i++) {
            var dropTableEntry = dropTable.table[i];
            // add to prob sum
            probSum += dropTableEntry.prob;
            var reducedRequiredDrops = requiredDrops.clone().subtractAll(dropTableEntry.dropMap, true);
            // add dependent variable to sums
            vSum += dropTableEntry.prob * varCallback(reducedRequiredDrops);
            var e = expCallback(reducedRequiredDrops);
            esSum += dropTableEntry.prob * e * e;
            eSum += dropTableEntry.prob * e;
        }
        var eThis = expCallback(requiredDrops);
        esSum += (1-probSum) * eThis * eThis;
        eSum += (1-probSum) * eThis;
        // finish the calculation
        return (vSum + esSum - (eSum * eSum)) / probSum;
    }

    /**
     * dropTable: a DropTable object.  If there are more than one drop table per trial then use
     *            DropTableScenario.flatten()
     * requiredDrops: an IntMap object containing the required drop keys and respective amounts.
     *                if omitted then all the distinct drop keys in the drop table are assumed to have a required
     *                amount of 1.
     * progressCallback: callback function to display progress, takes a fraction between 0 and 1
     * resultCallback: callback object with expectedValueResult() and varianceResult()
     **/
    function calculateStats(dropTable, requiredDrops, progressCallback=defaultProgressCallback, resultCallback=defaultResultCallback()) {
        // todo: there are a lot of optimizations that can be done if all the probabilities and nums are equal
        // not to do: skew, excess kurtosis, probably feasible but not worth the trouble
        // very not to do: The median, 90th percentile, and 99th percentile are apparently not
        // feasible to calculate analytically

        // apply default nums if necessary
        if (requiredDrops == null) {
            requiredDrops = new IntMap();
            for (var key of dropTable.getDropKeySet()) {
                requiredDrops.add(key, 1);
            }
        } else {
            var dropKeySet = dropTable.getDropKeySet();
            var missingDropKeyList = new Array();
            for (var [key, amount] of requiredDrops.map.entries()) {
                if (!dropKeySet.has(key)) missingDropKeyList.push(key);
            }
            if (missingDropKeyList.length > 0) {
                throw new Error("Drop table is missing drop keys: " + missingDropKeyList);
            }
        }

        var dropKeyToIndex = new Map();
        var dropKeys = new Array();
        var nums = new Array();
        for (var [key, amount] of requiredDrops.map.entries()) {
            dropKeyToIndex.set(key, dropKeys.length);
            dropKeys.push(key);
            nums.push(amount);
        }

        function toDropMap(index) {
            var dropMap = new IntMap();
            for (var i = 0; i < index.length; i++) {
                if (index[i] > 0) dropMap.add(dropKeys[i], index[i]);
            }
            return dropMap;
        }

        function toIndex(dropMap) {
            var index = fillArray(dropKeys.length, 0);
            for (var [key, amount] of dropMap.map.entries()) {
                index[dropKeyToIndex.get(key)] = amount;
            }
            return index;
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
        var cache = createArray(dims);

        // track some calculation stats
        var calcs = 0;
        var cacheHits = 0;
        var depth = 0;
        var maxDepth = 0;
        var numBatches = 0;

        function runCalc(requiredDrops, resultArray) {
            // console.log("Calc: " + requiredDrops.toString());
            if (requiredDrops.isEmpty()) {
                // BASE base case for both expected value and variance.
                // this only gets hit when the drop table contains a possible drop that can fulfill two
                // or more required drops at the same time.
                resultArray[0] = 0;
                resultArray[1] = 0;
            } else {
                var filteredDropTable = dropTable.createFiltered(requiredDrops);
                if (filteredDropTable.size() == 1 && requiredDrops.size() == 1) {
                    var [dropProb, numDropsRequired] = singleDropToBaseNBCase(filteredDropTable, requiredDrops);
                    resultArray[0] = expectedValueBaseCase(dropProb, numDropsRequired);
                    resultArray[1] = varianceBaseCase(dropProb, numDropsRequired);
                } else {
                    resultArray[0] = expectedValue(getExpectedValue, filteredDropTable, requiredDrops);
                    resultArray[1] = variance(getVariance, getExpectedValue, filteredDropTable, requiredDrops);
                }
                calcs++;
            }
        }

        // recursive implementation
        function getCachedOrCalculate(dropMap, avgOrVar) {
            // look for cached value
            var index = toIndex(dropMap);
            var value = getArrayValue(cache, index);
            if (value[avgOrVar] > -1) {
                cacheHits++;
                return value[avgOrVar];
            }
            depth++;
            if (depth > maxDepth) maxDepth = depth;
            runCalc(dropMap, value);
            depth--;
            return value[avgOrVar];
        }

        function getExpectedValue(dropMap) { return getCachedOrCalculate(dropMap, 0); }
        function getVariance(dropMap) { return getCachedOrCalculate(dropMap, 1); }

        function finish() {
            // start at the specified numbers of successes and let it work its way
            // down recursively to the base cases and add everything up
            var expectedValue = getExpectedValue(requiredDrops);
            var variance = getVariance(requiredDrops);
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
        index[0] = -1;
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
                var dropMap = toDropMap(index);
                getExpectedValue(dropMap);
                getVariance(dropMap);
            }
            progressCallback(calcs / totalCalcs);
            // yield and run another batch ASAP
            setTimeout(runBatch, 1);
        }

        // start the batches
        progressCallback(0);
        runBatch();
    }

    function test1() {
        var dropTable = new DropTable()
            .addEntry(new DropTableEntry(0.1).addDrop("A", 1))
            .addEntry(new DropTableEntry(0.2).addDrop("B", 1))
            .addEntry(new DropTableEntry(0.3).addDrop("C", 1));
        var requiredDrops = new IntMap().add("A", 1).add("B", 2).add("C", 3);

        calculateStats(dropTable, requiredDrops);
        // Average:	16.56
        // Standard Deviation:	7.77
    }

    function test2() {
        var dropTable = new DropTableScenario()
            .addDropTable(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("A", 1)))
            .addDropTable(new DropTable().addEntry(new DropTableEntry(0.2).addDrop("B", 1)))
            .addDropTable(new DropTable().addEntry(new DropTableEntry(0.3).addDrop("C", 1)))
            .flattenDropTables()
        var requiredDrops = new IntMap().add("A", 1).add("B", 2).add("C", 3);

        calculateStats(dropTable, requiredDrops);
        // Average:	15.96
        // Standard Deviation:	8.12
    }

    function test3() {
        var dropTable = new DropTable()
            .addEntry(new DropTableEntry(0.1).addDrop("A", 1))
            .addEntry(new DropTableEntry(0.1).addDrop("B", 1))
            .addEntry(new DropTableEntry(0.1).addDrop("C", 1))
            .addEntry(new DropTableEntry(0.1).addDrop("D", 1))
            .addEntry(new DropTableEntry(0.1).addDrop("E", 1))
            .addEntry(new DropTableEntry(0.1).addDrop("F", 1))
            .addEntry(new DropTableEntry(0.1).addDrop("G", 1))
            .addEntry(new DropTableEntry(0.1).addDrop("H", 1))
            .addEntry(new DropTableEntry(0.1).addDrop("I", 1))
            .addEntry(new DropTableEntry(0.1).addDrop("J", 1));
        var requiredDrops = new IntMap()
            .add("A", 3)
            .add("B", 3)
            .add("C", 3)
            .add("D", 3)
            .add("E", 3)
            .add("F", 3)
            .add("G", 3)
            .add("H", 3)
            .add("I", 3)
            .add("J", 3);

        calculateStats(dropTable, requiredDrops);
        // Average:	16.56
        // Standard Deviation:	7.77
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
        test1: test1,
        test2: test2,
        test3: test3
    };
})();


