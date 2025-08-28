var Analysis3 = (function() {
    var defaultResultCallback = (function() {
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
    })();

    function defaultProgressCallback(fraction) {
        console.log("Progress: " + (fraction * 100).toFixed(2));
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
    function expectedValue(expCallback, dropTable, requiredDropArrayStack) {
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

        var requiredDropArray = requiredDropArrayStack.pop();
        if (requiredDropArrayStack.length == 0) {
            requiredDropArrayStack.push(ArrayUtils.fillArray(requiredDropArray.length));
        }
        var tempDropArray = requiredDropArrayStack[requiredDropArrayStack.length - 1];

        // accumulates the weighted expected trials for each possible success
        var caseSum = 0;
        // accumulates the total probability of the possible successes
        var probSum = 0;
        // loop over the index
        dropTable.forEachDropEntry((dropProb, dropArray) => {
            // add to prob sum
            probSum += dropProb;
            // get the remaining expected trials given the success
            var reducedRequiredDropArray = ArrayUtils.arraySubtract(requiredDropArray, dropArray, tempDropArray);
            // Add weighted success case, reusing the index object
            // to calculate the expected trials given the success
            caseSum += dropProb * expCallback(dropTable, requiredDropArrayStack);
        });
        requiredDropArrayStack.push(requiredDropArray);
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

    function variance(varCallback, expCallback, dropTable, requiredDropArrayStack) {
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

        var requiredDropArray = requiredDropArrayStack.pop();
        if (requiredDropArrayStack.length == 0) {
            requiredDropArrayStack.push(ArrayUtils.fillArray(requiredDropArray.length));
        }
        var tempDropArray = requiredDropArrayStack[requiredDropArrayStack.length - 1];

        // variance sum
        var vSum = 0;
        // expected value squared sum
        var esSum = 0;
        // expected value sum
        var eSum = 0;
        // probability sum
        var probSum = 0;
        // loop over the index
        dropTable.forEachDropEntry((dropProb, dropArray) => {
            // add to prob sum
            probSum += dropProb;
            // get the remaining expected trials given the success
            var reducedRequiredDropArray = ArrayUtils.arraySubtract(requiredDropArray, dropArray, tempDropArray);
            // add dependent variable to sums
            vSum += dropProb * varCallback(dropTable, requiredDropArrayStack);
            var e = expCallback(dropTable, requiredDropArrayStack);
            esSum += dropProb * e * e;
            eSum += dropProb * e;
        });
        requiredDropArrayStack.push(requiredDropArray);
        var eThis = expCallback(dropTable, requiredDropArrayStack);
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
    function calculateStats(dropTable, requiredDrops, progressCallback=defaultProgressCallback, resultCallback=defaultResultCallback) {
        // todo: there are a lot of optimizations that can be done if all the probabilities and required Drops are equal
        // not to do: skew, excess kurtosis, probably feasible but not worth the trouble
        // very not to do: The median, 90th percentile, and 99th percentile are apparently not
        // feasible to calculate analytically

        var start = Date.now();
        var requiredDropArray = null;

        // apply default required drops if necessary
        if (requiredDrops == null) {
            requiredDropArray = new Array(dropTable.getNumDrops());
            for (var i = 0; i < dropTable.getNumDrops(); i++) {
                requiredDropArray.push(1);
            }

        } else {
            var [x, requiredDropArray] = dropTable.convertDropMapToArray(requiredDrops, false);
        }

        // track the total number of sub-calculations
        var totalCalcs = 1;
        // the dimensions of the cache array are 1 more than each of the
        // item's required successes
        var dims = new Array(requiredDropArray.length + 1);
        for (var i = 0; i < requiredDropArray.length; i++) {
            dims[i] = requiredDropArray[i] + 1;
            // calculate the total number of sub-calculations
            totalCalcs *= dims[i];
        }
        // one more level to store mean and variance
        dims.push(2);
        // create the cache
        var cache = ArrayUtils.createArray(dims);

        // track some calculation stats
        var calcs = 0;
        var cacheHits = 0;
        var depth = 0;
        var maxDepth = 0;
        var numBatches = 0;

        function runCalc(currentDropTable, indexStack, resultArray) {
            //console.log("Calc: " + ArrayUtils.arrayToString(index));

            var index = indexStack[indexStack.length - 1];

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
                // BASE base case for both expected value and variance.
                // this only gets hit when the drop table contains a possible drop that can fulfill two
                // or more required drops at the same time.
                resultArray[0] = 0;
                resultArray[1] = 0;

            } else {
                var filteredDropTable = dropTable.filtered(index);

                if (filteredDropTable.size() == 1 && nnz == 1) {

                    filteredDropTable.forEachDropEntry((dropProb, dropArray) => {
                        var dropAmount = dropArray[fnzi];
                        var numDropsRequired = Math.ceil(index[fnzi] / dropAmount);
                        resultArray[0] = expectedValueBaseCase(dropProb, numDropsRequired);
                        resultArray[1] = varianceBaseCase(dropProb, numDropsRequired);
                    });

                } else {
                    resultArray[0] = expectedValue(getExpectedValue, filteredDropTable, indexStack);
                    resultArray[1] = variance(getVariance, getExpectedValue, filteredDropTable, indexStack);
                }
                calcs++;
            }
        }

        // recursive implementation
        function getCachedOrCalculate(dropTable, indexStack, avgOrVar) {
            var index = indexStack[indexStack.length - 1];
            var value = ArrayUtils.getArrayValue(cache, index);
            if (value[avgOrVar] > -1) {
                cacheHits++;
                return value[avgOrVar];
            }
            depth++;
            if (depth > maxDepth) maxDepth = depth;
            runCalc(dropTable, indexStack, value);
            depth--;
            return value[avgOrVar];
        }

        function getExpectedValue(dropTable, indexStack) { return getCachedOrCalculate(dropTable, indexStack, 0); }
        function getVariance(dropTable, indexStack) { return getCachedOrCalculate(dropTable, indexStack, 1); }

        function finish() {
            // start at the specified numbers of successes and let it work its way
            // down recursively to the base cases and add everything up
            var expectedValue = getExpectedValue(dropTable, [requiredDropArray]);
            var variance = getVariance(dropTable, [requiredDropArray]);

            var end = Date.now();
            var time = ((end - start) / 1000).toFixed(2);
            // log some stats
            console.log("finished with " + calcs + " sub-calculations and " + cacheHits + " cache hits, max recursive depth: " + maxDepth + ", batches: " + numBatches + ", time: " + time + "s");
            // holy crap that's it
            progressCallback(1);
            resultCallback.expectedValueResult(expectedValue);
            resultCallback.varianceResult(variance);
        }

        // seed the intermediate calculations in a way I can easily partition into batches
        // start with an index at all 0's
        var calcIndex = ArrayUtils.fillArray(requiredDropArray.length, 0);
        calcIndex[0] = -1;
        var calcIndexStack = new Array();
        calcIndexStack.push(calcIndex);
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
                    if (i >= requiredDropArray.length) {
                        // run the finish function
                        finish();
                        // exit the calculation
                        return;
                    }
                    // increment the current index
                    calcIndex[i]++;
                    // check if the index has gone past its respective max number
                    if (calcIndex[i] > requiredDropArray[i]) {
                        // reset to 0
                        calcIndex[i] = 0;
                        // continue iterating to bubble up to the next index
                    } else {
                        // current index is fine, don't continue bubbling up
                        break;
                    }
                }
                // seed the expected value and variance at this index
                getExpectedValue(dropTable, calcIndexStack);
                getVariance(dropTable, calcIndexStack);
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

        console.log(dropTable.toString());

        calculateStats(dropTable, requiredDrops);
        // Average:	16.56
        // Standard Deviation:	7.77
    }

    function test2() {
        var dropTables = Array()
        dropTables.push(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("A", 1)));
        dropTables.push(new DropTable().addEntry(new DropTableEntry(0.2).addDrop("B", 1)));
        dropTables.push(new DropTable().addEntry(new DropTableEntry(0.3).addDrop("C", 1)));

        var dropTable = DropTableUtils.flatten(dropTables);
        var requiredDrops = new IntMap().add("A", 1).add("B", 2).add("C", 3);

        console.log(dropTable.toString());
        calculateStats(dropTable, requiredDrops);
        // Average:	15.96
        // Standard Deviation:	8.12
    }

    function test3(numDrops=10, numRequired=3) {
        var dropTable = new DropTable();
        var requiredDrops = new IntMap();

        for (var i = 1; i <= numDrops; i++) {
            var key = "D" + i;
            dropTable.addEntry(new DropTableEntry(0.1).addDrop(key, 1))
            requiredDrops.add(key, numRequired)
        }

        console.log(dropTable.toString());
        calculateStats(dropTable, requiredDrops);
        // Average:	61.37
        // Standard Deviation:	14.87
    }

    function test4() {
        // khora
        var da = Array()
        da.push(new DropTable().addEntry(new DropTableEntry(0.0833).addDrop("Chassis", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.0833).addDrop("Chassis", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.0769).addDrop("Helmet", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.0564).addDrop("Systems", 1)).addEntry(new DropTableEntry(0.0564).addDrop("BP", 1)));

        var d = DropTableUtils.flatten(da);
        var r = new IntMap().add("Chassis", 1).add("Helmet", 1).add("Systems", 1).add("BP", 1);

        console.log(d.toString());
        calculateStats(d, r);
    }

    function test4b() {
        // khora
        var da = Array()
        da.push(new DropTable().addEntry(new DropTableEntry(0.10).addDrop("Chassis", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.10).addDrop("Helmet", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.10).addDrop("Systems", 1)).addEntry(new DropTableEntry(0.10).addDrop("BP", 1)));

        var d = DropTableUtils.flatten(da);
        var r = new IntMap().add("Chassis", 1).add("Helmet", 1).add("Systems", 1).add("BP", 1);

        console.log(d.toString());
        Analysis3.calculateStats(d, r);
        //Average:	18.50
        //Standard Deviation:	10.78
    }

    function test5() {
        // equinox
        var d = new DropTable()
            .addEntry(new DropTableEntry(0.1128).addDrop("NBP", 1))
            .addEntry(new DropTableEntry(0.1291).addDrop("NC", 1))
            .addEntry(new DropTableEntry(0.1291).addDrop("NS", 1))
            .addEntry(new DropTableEntry(0.1291).addDrop("NH", 1))
            .addEntry(new DropTableEntry(0.1128).addDrop("DBP", 1))
            .addEntry(new DropTableEntry(0.1291).addDrop("DC", 1))
            .addEntry(new DropTableEntry(0.1291).addDrop("DS", 1))
            .addEntry(new DropTableEntry(0.1291).addDrop("DH", 1));

        var r = new IntMap().add("NBP", 1).add("NC", 1).add("NS", 1).add("NH", 1)
                                        .add("DBP", 1).add("DC", 1).add("DS", 1).add("DH", 1);

        console.log(d.toString());
        calculateStats(d, r);

    }

    return  {
        /**
         * probs: Array of probabilities for each item
         * nums: Array of required number of successes for each item
         *       If omitted then assumed to be 1 of each
         * progressCallback: callback function to display progress, takes a fraction between 0 and 1
         * resultCallback: callback object with expectedValueResult() and varianceResult()
         **/
        calculateStats: calculateStats // (probs, nums=null, progressCallback=defaultProgressCallback, resultCallback=defaultResultCallback)
        , test1: test1
        , test2: test2
        , test3: test3
        , test4: test4
        , test4b: test4b
        , test5: test5
    };
})();


