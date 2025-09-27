var MonteCarlo = (function() {

    // dist: DiscreteDist
    // dropTable: DropTable
    // requiredDrops: IntMap or null
    // numSamples: total number of samples to gather
    // batchSize: size of each batch of samples
    // batchCallback: function() => called when a batch is finished
    // finishCallback: function() => called when finished
    // returns: function() => called to stop early
    function runDropTable(dist, dropTable, requiredDrops, numSamples, batchSize, batchCallback, finishCallback) {
        // convert required drop map into an array, applying defaults and mercy rules.
        var requiredDropArray = dropTable.toRequiredDropArray(requiredDrops);

        // allocate some temp arrays
        var tempDropArray = IntUtils.newIntSumArray(requiredDropArray.list.length);
        var resultDropArray = IntUtils.newIntSumArray(requiredDropArray.list.length);

        // basic toString() for a drop array for the min and max result
        function resultToString() {
            return dropTable.convertDropArrayToMap(resultDropArray).toString();
        }

        // state
        // we can't use the dist's total sample count because we may be running extra batches
        // on a run that already finished once.
        var totalSamples = 0;
        // cancel flag
        var canceled = false;

        // run a batch
        function runBatch() {
            // check the canceled flag
            if (canceled) {
                // might as well finish
                finishCallback();
                // do not continue
                return;
            }
            // run a batch
            for (var i = 0; i < batchSize; i++) {
                // run a drop table sample and add its result to the dist
                dist.addResult(runDropTableTrials(dropTable, requiredDropArray, tempDropArray, resultDropArray), resultToString);
                // increment the total runs in this run
                totalSamples += 1;
            }

            // call the batch callback
            batchCallback();

            // check the goal total samples
            if (totalSamples >= numSamples) {
                // finished
                finishCallback();
            } else {
                // schedule another batch
                setTimeout(runBatch, 1);
            }
        }

        // cancel callback
        function cancel() {
            canceled = true;
        }

        // schedule the first batch
        setTimeout(runBatch, 1);

        // return the cancel callback
        return cancel;
    }

    /**
     * dropTable: a DropTable object
     * requiredDrops: an IntMap object containing the required drop keys and respective amounts.
     *                If omitted then all the distinct drops in the drop table are assumed to have a required
     *                amount of 1.
     * resultDrops: dropArray for the required drops
     * tempDropArray: array for holding temporary data, must be the same size as dropArray
     * resultArray: array for holding the final drop amounts, including any extras,
                    must be the same size as dropArray
     * returns: the number of trials necessary to reach the result
     **/
    function runDropTableTrials(dropTable, requiredDropArray, tempDropArray, resultDropArray) {
        // count number of trials
        var trials = 0;
        // initialize state
        requiredDropArray.copyTo(tempDropArray);

        // run until there are no more positive required drops
        while (tempDropArray.numPos > 0) {
            // get a random drop from the table, weighted by drop chance
            var dropArray = dropTable.randomDrop();
            // check if it's a non-empty drop
            if (dropArray.total > 0) {
                // reduce the required drops, extra drops will cause counts to go negative
                // use the result drop array as temp storage
                dropTable.reduceRequiredDropArray(tempDropArray, dropArray, resultDropArray, false);
                // copy back to the other temp storage
                resultDropArray.copyTo(tempDropArray);
            }
            // increment the trials
            trials += 1;
        }

        // add the extra drops to the original required drops to get the total drops
        // extra drops in tempDropArray are negative, so subtract them
        requiredDropArray.subtractAllTo(tempDropArray, resultDropArray);

        // result
        return trials;
    }

    ///////////////////////////
    // Tests
    ///////////////////////////

    function runTest(dropTable, requiredDrops) {
        var dist = new DiscreteDist();

        function logState() {
            dist.reCalc();
            console.log(dist.toString());
        }

        var start;

        function finish() {
            var end = Date.now();
            var time = ((end - start) / 1000).toFixed(2);

            console.log(dist.histogramToString());
            console.log("finished in " + time + "s");
        }

        var start = Date.now();
        var cancel = runDropTable(dist, dropTable, requiredDrops, 1000000, 100000, logState, finish);
    }

    function test1() {
        var dropTable = new DropTable()
            .addEntry(new DropTableEntry(0.1).addDrop("A", 1))
            .addEntry(new DropTableEntry(0.2).addDrop("B", 1))
            .addEntry(new DropTableEntry(0.3).addDrop("C", 1));
        var requiredDrops = new IntMap().add("A", 1).add("B", 2).add("C", 3);

        console.log(dropTable.toString());

        runTest(dropTable, requiredDrops);
        // Average:	16.56
        // Standard Deviation:	7.77
    }

    function test2() {
        var dropTable = new DropTable().
            addRotation("A").addEntry(new DropTableEntry(0.1).addDrop("A", 1)).
            addRotation("B").addEntry(new DropTableEntry(0.2).addDrop("B", 1)).
            addRotation("C").addEntry(new DropTableEntry(0.3).addDrop("C", 1));

        var requiredDrops = new IntMap().add("A", 1).add("B", 2).add("C", 3);

        console.log(dropTable.toString());
        runTest(dropTable, requiredDrops);
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
        runTest(dropTable, requiredDrops);
        // Average:	61.37
        // Standard Deviation:	14.87
    }

    function test4() {
        // khora
        var d = new DropTable().
            addRotation("A").addEntry(new DropTableEntry(0.0833).addDrop("Chassis", 1)).
            addRotation("A").addEntry(new DropTableEntry(0.0833).addDrop("Chassis", 1)).
            addRotation("B").addEntry(new DropTableEntry(0.0769).addDrop("Helmet", 1)).
            addRotation("C").addEntry(new DropTableEntry(0.0564).addDrop("Systems", 1))
                            .addEntry(new DropTableEntry(0.0564).addDrop("BP", 1));

        var r = new IntMap().add("Chassis", 1).add("Helmet", 1).add("Systems", 1).add("BP", 1);

        console.log(d.toString());
        runTest(d, r);
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
        runTest(d, r);

    }

    function test6() {
        // oraxia
        var d = new DropTable()
            .addRotation("A")
                .addEntry(new DropTableEntry(0.0769).addDrop("BP", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("H", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("C", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("S", 1))
            .addRotation("Husk")
                .addEntry(new DropTableEntry(0.195).addDrop("Husk", 16))
                .addEntry(new DropTableEntry(0.195).addDrop("Husk", 17))
                .addEntry(new DropTableEntry(0.220).addDrop("Husk", 18))
                .addEntry(new DropTableEntry(0.195).addDrop("Husk", 19))
                .addEntry(new DropTableEntry(0.195).addDrop("Husk", 20))
            .addMercyRule("Husk", 60, "BP")
            .addMercyRule("Husk", 20, "H")
            .addMercyRule("Husk", 20, "C")
            .addMercyRule("Husk", 20, "S")
        ;

        var r = new IntMap().add("BP", 2).add("H", 2).add("C", 2).add("S", 2);

        console.log(d.toString());
        runTest(d, r);
    }

    function test7(mercy=true) {
        // isleweaver
        var d = new DropTable()
            .addRotation("A")
                .addEntry(new DropTableEntry(0.0769).addDrop("OBP", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("OH", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("OC", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("OS", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("ScBP", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("ScG", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("ScB", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("SpBP", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("SpBP", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("SpB", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("SpH", 1))
                .addEntry(new DropTableEntry(0.0769).addDrop("SpS", 1))
            .addRotation("Husk")
                .addEntry(new DropTableEntry(0.195).addDrop("Husk", 16))
                .addEntry(new DropTableEntry(0.195).addDrop("Husk", 17))
                .addEntry(new DropTableEntry(0.220).addDrop("Husk", 18))
                .addEntry(new DropTableEntry(0.195).addDrop("Husk", 19))
                .addEntry(new DropTableEntry(0.195).addDrop("Husk", 20));

        if (mercy) {
            d = d
                .addMercyRule("Husk", 60, "OBP")
                .addMercyRule("Husk", 20, "OH")
                .addMercyRule("Husk", 20, "OC")
                .addMercyRule("Husk", 20, "OS")
                .addMercyRule("Husk", 48, "ScBP")
                .addMercyRule("Husk", 12, "ScG")
                .addMercyRule("Husk", 12, "ScB")
                .addMercyRule("Husk", 12, "SpBP")
                .addMercyRule("Husk", 16, "SpB")
                .addMercyRule("Husk", 16, "SpH")
                .addMercyRule("Husk", 16, "SpS")
            ;
        }

        var r = new IntMap()
            .add("OBP", 2)
            .add("OH", 2)
            .add("OC", 2)
            .add("OS", 2)
            .add("ScBP", 1)
            .add("ScG", 2)
            .add("ScB", 2)
            .add("SpBP", 1)
            .add("SpB", 1)
            .add("SpH", 1)
            .add("SpS", 1)
        ;

        console.log(d.toString());
        runTest(d, r);

    }

    return  {
        // dist: DiscreteDist
        // dropTable: DropTable
        // requiredDrops: IntMap or null
        // numTrails: total number of trials to run
        // batchSize: size of each batch of trials
        // finishCallback: function() => called when finished
        // returns: function() => called to stop early
        runDropTable: runDropTableTrials // (dropTable, requiredDropArray, resultDropArray)
        , test1: test1
        , test2: test2
        , test3: test3
        , test4: test4
        , test5: test5
        , test6: test6
        , test7: test7
    };
})();


