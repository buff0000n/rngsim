var Analysis = (function() {
    // default callback that just logs results to the console
    function defaultResultCallback(expectedValue, variance) {
        console.log("Average: " + expectedValue);
        console.log("Variance: " + variance);
        console.log("Std Dev: " + Math.sqrt(variance));
    }

    // default callback that just logs progress to the console
    function defaultProgressCallback(fraction) {
        console.log("Progress: " + (fraction * 100).toFixed(2));
    }

    // okay statistics time.  start with an easy one
    function expectedValueBaseCase(dropProb, numDropsRequired) {
        // easy base case
        // negative binomial expected value formula is just this:
        // r/p
        //   r: required successes
        //   p: success probability
        return numDropsRequired/dropProb;
    }

    /**
     * expCallBack: function(dropTable, dropArrayStack), recursive call to get the expected value for a filtered
     *              drop table and a reduced drop array.
     * dropTable: DropTable object
     * requiredDropArrayStack: Ugh, a stack of dropArray arrays, the top of which is the current required drop array
     * returns: the calculated expected number of trials for the given drop table and required drop array
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
        //   expected trials given X: expected value of the state where X has occurred one additional time
        // If the remaining successes required for an item is zero then that item
        // and its probability are ignored
        // If all the remaining successes are zero then the expected trials is 0.
        // This reduces to the base case if only one required drop is non-zero.

        // sigh, caching the drop arrays really does make a difference so here we are
        // the top of the stack is the current required drop array
        var requiredDropArray = requiredDropArrayStack.pop();
        // the next to last item on the stack is a temp array we can toy with.  make sure it's there.
        if (requiredDropArrayStack.length == 0) {
            requiredDropArrayStack.push(ArrayUtils.fillArray(requiredDropArray.length));
        }
        var tempDropArray = requiredDropArrayStack[requiredDropArrayStack.length - 1];

        // accumulates the weighted expected trials for each possible success
        var caseSum = 0;
        // accumulates the total probability of the possible successes
        var probSum = 0;
        // loop over each non-empty drop table entry
        dropTable.forEachDropEntry((dropProb, dropArray) => {
            // add to prob sum
            probSum += dropProb;
            // reduce the current required drops by the outcome of this drop entry and put the result in the
            // temp array.  The temp array is already the top of the stack.
            ArrayUtils.arraySubtract(requiredDropArray, dropArray, tempDropArray);
            // calculate the expected trials given the outcome of this drop entry, weight it by the
            // drop entry's probability, and add to the total.
            caseSum += dropProb * expCallback(dropTable, requiredDropArrayStack);
        });
        // add the original drop array back to the stack
        requiredDropArrayStack.push(requiredDropArray);
        // finish the calculation
        return (1 + caseSum) / probSum;
    }

    // now for variance
    function varianceBaseCase(dropProb, numDropsRequired) {
        // not as easy base case
        // negative binomial variance formula is this:
        // r(1-p)/(p^2)
        //   r: required successes
        //   p: success probability
        return (numDropsRequired * (1-dropProb)) / (dropProb * dropProb);
    }

    /**
     * expCallBack: function(dropTable, dropArrayStack), recursive call to get the expected value for a filtered
     *              drop table and a reduced drop array.
     * varCallBack: function(dropTable, dropArrayStack), recursive call to get the variance for a filtered
     *              drop table and a reduced drop array.
     * dropTable: DropTable object
     * requiredDropArrayStack: Ugh, a stack of dropArray arrays, the top of which is the current required drop array
     * returns: the calculated variance for the given drop table and required drop array
     **/
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

        // sigh, caching the drop arrays really does make a difference so here we are
        // the top of the stack is the current required drop array
        var requiredDropArray = requiredDropArrayStack.pop();
        // the next to last item on the stack is a temp array we can toy with.  make sure it's there.
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
        // loop over each non-empty drop table entry
        dropTable.forEachDropEntry((dropProb, dropArray) => {
            // add to prob sum
            probSum += dropProb;
            // reduce the current required drops by the outcome of this drop entry and put the result in the
            // temp array.  The temp array is already the top of the stack.
            var reducedRequiredDropArray = ArrayUtils.arraySubtract(requiredDropArray, dropArray, tempDropArray);
            // calculate the variance given the outcome of this drop entry, weight it by the
            // drop entry's probability, and add to the total.
            vSum += dropProb * varCallback(dropTable, requiredDropArrayStack);
            // calculate the expected trials given the outcome of this drop entry
            var e = expCallback(dropTable, requiredDropArrayStack);
            // weight by the entry's probability
            var pe = dropProb * e;
            // add to the regular sum
            eSum += pe;
            // add to the squared sum, multiplied by another e
            esSum += pe * e;
        });
        // add the original drop array back to the stack
        requiredDropArrayStack.push(requiredDropArray);
        // we need this state's expected value
        var eThis = expCallback(dropTable, requiredDropArrayStack);
        // weighted by the empty drop's probability
        var peThis = (1-probSum) * eThis;
        // add to the regular sum
        eSum += peThis;
        // add to the squared sum, multiplied by another eThis
        esSum += peThis * eThis;
        // finish the calculation
        return (vSum + esSum - (eSum * eSum)) / probSum;
    }

    /**
     * dropTable: a DropTable object.  If there are more than one drop table per trial then use
     *            DropTableScenario.flatten()
     * requiredDrops: an IntMap object containing the required drop keys and respective amounts.
     *                If omitted then all the distinct drops in the drop table are assumed to have a required
     *                amount of 1.
     * progressCallback: function(progress), with progress a number between 0 and 1
     *                   by default, will log to the console
     * resultCallback: function(expectedValue, variance), takes the result of this calculation
     *                 by default, will log to the console
     **/
    function calculateStats(dropTable, requiredDrops, progressCallback=defaultProgressCallback, resultCallback=defaultResultCallback) {
        // todo: there are a lot of optimizations that can be done if all the probabilities and required Drops are equal
        // not to do: skew, excess kurtosis, probably feasible but not worth the trouble
        // very not to do: The median, 90th percentile, and 99th percentile are apparently not
        // feasible to calculate analytically

        // might as well time it
        var start = Date.now();

        // will need the required drops in array form
        var requiredDropArray = null;
        // apply default required drops if necessary
        if (requiredDrops == null) {
            // create a new array of 1's for each drop
            requiredDropArray = ArrayUtils.fillArray(dropTable.getNumDrops(), 1);

        } else {
            // convert provided drop IntMap to an array for teh given drop table
            // if any of the drops in the map are not found in the drop table then throw an error
            var [_, requiredDropArray] = dropTable.convertDropMapToArray(requiredDrops, false);
        }

        // track the total number of sub-calculations
        var totalCalcs = 1;
        // the dimensions of the cache array are 1 more than each of the
        // drop array's required amounts
        var dims = new Array(requiredDropArray.length + 1);
        for (var i = 0; i < requiredDropArray.length; i++) {
            dims[i] = requiredDropArray[i] + 1;
            // calculate the total number of sub-calculations, we'll need this for showing progress
            totalCalcs *= dims[i];
        }
        // one more cache level to store mean and variance in the same place
        dims.push(2);
        // create the cache
        var cache = ArrayUtils.createArray(dims);

        // track some calculation stats
        var calcs = 0;
        var cacheHits = 0;
        var depth = 0;
        var maxDepth = 0;
        var numBatches = 0;

        // function to run an actual calculation
        // takes the current drop table, an index stack containing the current required drops state on its top,
        // and an array to put the results in
        function runCalc(currentDropTable, indexStack, resultArray) {
            //console.log("Calc: " + ArrayUtils.arrayToString(index));

            // peek the required drops off the top of the stack
            var index = indexStack[indexStack.length - 1];

            // find how many required drops are non-zero
            var nnz = 0; // number of non-zero indices
            var fnzi = -1; // first non-zero index
            for (var i = 0; i < index.length; i++) {
                if (index[i] > 0) {
                    nnz++;
                    if (fnzi == -1) fnzi = i;
                }
            }

            if (nnz == 0) {
                // Base base case, no required drops remaining
                // this only gets hit in a couple of edge case when it goes directly to the success state without going
                // through an intermediate base case.
                // the results for both expected value and variance are 0
                resultArray[0] = 0;
                resultArray[1] = 0;

            } else {
                // filter the drop table by the required drops
                var filteredDropTable = dropTable.filtered(index);

                // check if the filtered drop table only has a single drop entry and we only have a single required
                // drop left
                if (filteredDropTable.size() == 1 && nnz == 1) {
                    // easy way to get to the lone drop entry, just assume this callback only gets called once
                    filteredDropTable.forEachDropEntry((dropProb, dropArray) => {
                        // get the drop amount for the lone remaining required drop
                        var dropAmount = dropArray[fnzi];
                        // calculate the actual number of drops required, both the required amount and the
                        // drop outcome amount may be greater than 1
                        var numDropsRequired = Math.ceil(index[fnzi] / dropAmount);
                        // calculate the expected value base case
                        resultArray[0] = expectedValueBaseCase(dropProb, numDropsRequired);
                        // calculate the variance base case
                        resultArray[1] = varianceBaseCase(dropProb, numDropsRequired);
                    });

                } else {
                    // otherwise we have to get nasty
                    // calculate this state's expected value, providing a callback to recursively get expected
                    // values for subsequent states
                    resultArray[0] = expectedValue(getExpectedValue, filteredDropTable, indexStack);
                    // calculate this state's variance, providing recursive callbacks for expected value and variance
                    resultArray[1] = variance(getVariance, getExpectedValue, filteredDropTable, indexStack);
                }
                // we did a numbers
                calcs++;
            }
        }

        // caching layer, because we absolutely need it
        // get the expected value or variance value for the required drop state at the top of the given stack,
        // using the given possibly filtered drop table
        function getCachedOrCalculate(dropTable, indexStack, avgOrVar) {
            // peek the required drops off the top of the stack
            var index = indexStack[indexStack.length - 1];
            // I keep calling it an index because it's literally an index into the cache
            // this will return a 2-element array possibly containing the expected value and variance
            var value = ArrayUtils.getArrayValue(cache, index);
            // check if the cache value is populated
            if (value[avgOrVar] > -1) {
                // oh good, it is
                cacheHits++;
                // return whichever value is being asked for
                return value[avgOrVar];
            }
            // gotta fall back to calculation.
            // Track recursion depth.  Because of how we're ordering the calculations below, this should never
            // be greater than one.
            depth++;
            if (depth > maxDepth) maxDepth = depth;
            // run the calculation and put the result directly into the cache array.
            // Note that this always calculates both expected value and variance, we'll need both of them
            // eventually.
            runCalc(dropTable, indexStack, value);
            depth--;
            // return whichever value is being asked for
            return value[avgOrVar];
        }

        // callbacks to specifically get the cached or calculated expected value and variance
        function getExpectedValue(dropTable, indexStack) { return getCachedOrCalculate(dropTable, indexStack, 0); }
        function getVariance(dropTable, indexStack) { return getCachedOrCalculate(dropTable, indexStack, 1); }

        // completion callback
        function finish() {
            // get the final expected value and variance for the drop table and original required drops.
            // Note that we could just start with this immediately, and everything would be calculated recursively.
            // However, there's no way to break that work up into chunks, and you can't really do calculations
            // in the background in javascript. So the nasty business below is all there to prime the cache so that
            // this returns instantly.
            var expectedValue = getExpectedValue(dropTable, [requiredDropArray]);
            var variance = getVariance(dropTable, [requiredDropArray]);

            // calculate run time
            var end = Date.now();
            var time = ((end - start) / 1000).toFixed(2);
            // log some stats
            console.log("finished with " + calcs + " sub-calculations and " + cacheHits + " cache hits, max recursive depth: " + maxDepth + ", batches: " + numBatches + ", time: " + time + "s");
            // set progress to 100%
            progressCallback(1);
            // send the results
            resultCallback(expectedValue, variance);
            // holy crap that's it
        }

        // seed the intermediate calculations in a way I can easily partition into batches
        // start with an index array at all 0's, one for each required drop, and iterate through every combinations
        // by incrementing the lowest index element and incrementing higher ones as lower ones roll over.
        // this ensures we'll never have to actually do a recursive calculation: The calculations any given state
        // depends on should already be in the cache.  That being said, this is overengineered to support a full
        // recursive calculation because why not.
        var calcIndex = ArrayUtils.fillArray(requiredDropArray.length, 0);
        // set the first index to -1 to make things easier.
        calcIndex[0] = -1;
        // start a stack and put the index on it.  This should get expanded exactly once during the course of the
        // calculation.
        var calcIndexStack = new Array();
        calcIndexStack.push(calcIndex);
        // number of calculations to perform per batch to avoid typing up javascript's event thread for too long
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
                // not really necessary? The first one will calculate both
                getVariance(dropTable, calcIndexStack);
            }
            // send progress
            progressCallback(calcs / totalCalcs);
            // yield and run another batch ASAP
            setTimeout(runBatch, 1);
        }

        // start at 0% progress
        progressCallback(0);
        // start the batches
        runBatch();
        // good luck!
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
     * dropTable: a DropTable object.  If there are more than one drop table per trial then use
     *            DropTableScenario.flatten()
     * requiredDrops: an IntMap object containing the required drop keys and respective amounts.
     *                If omitted then all the distinct drops in the drop table are assumed to have a required
     *                amount of 1.
     * progressCallback: function(progress), with progress a number between 0 and 1
     *                   by default, will log to the console
     * resultCallback: function(expectedValue, variance), takes the result of this calculation
     *                 by default, will log to the console
     **/
        calculateStats: calculateStats // (dropTable, requiredDrops, progressCallback=defaultProgressCallback, resultCallback=defaultResultCallback)
        , test1: test1
        , test2: test2
        , test3: test3
        , test4: test4
        , test4b: test4b
        , test5: test5
    };
})();


