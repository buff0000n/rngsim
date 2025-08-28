var DropTableUtils = (function() {
    // flatten an array of DropTable objects to a single DropTable.
    // this is used when a single trial has multiple independent drop tables.  We have to combine them
    // into one before we can put it through analysis.  This basically involves doing a cartesian product
    // of all combinations of drops from each table.
    function flatten(dropTableArray) {
        // if there's only one, we're done
        if (dropTableArray.length == 1) {
            return dropTableArray[0];
        }

        // new drop table
        var newDropTable = new DropTable();

        // build an multi-dimensional index we can use to iterate over every combinations of drops, one
        // from each drop table.
        var dropIndex = new Array();
        // start the first index at -1 to make things easier
        dropIndex.push(-1);
        // fill in the rest with zeroes.
        for (var i = 1; i < dropTableArray.length; i++) dropIndex.push(0);

        // break flag
        var done = false;
        for (;;) {
            // increment the index like a CS101 adder, rolling over a lower ones increments the next one up.
            // loop over the indices until we find one that doesn't have to be rolled over.
            for (var i = 0;; i++) {
                // if we're overflowed past the end of the index then we're done.
                if (i >= dropIndex.length) {
                    done = true;
                    break;
                }
                // increment this index value
                dropIndex[i]++;
                // if this index value has gone past the drops in this drop table
                if (dropIndex[i] >= dropTableArray[i].numDropTableEntries) {
                    // reset it
                    dropIndex[i] = 0;
                    // and let the for loop takes us to the next higher up index value
                } else {
                    // otherwise we're done looping over the index
                    break;
                }
            }
            // check if we're done
            if (done) {
                break;
            }

            // finally, can actually build a drop table entry
            // start with a base probability, this will the product of the probabilities of
            // all the entries we're combining.
            var prob = 1;
            // build this an an IntMap so we can just call addEntry()
            var dropMap = new IntMap();
            // loop over the drop tables
            for (var i = 0; i < dropTableArray.length; i++) {
                var dt = dropTableArray[i];
                // pick out the probability of this table's current entry and multiply it in
                prob *= dt.probArray[dropIndex[i]];
                // loop over this drop table's entry's drops
                for (var j = 0; j < dt.numDrops; j++) {
                    // get the drop amount
                    var dropAmount = dt.dropGrid[dropIndex[i]][j];
                    // check if it's nonzero
                    if (dropAmount > 0) {
                        // map the drop id back to the drop key
                        var dropKey = dt.dropKeyList[j];
                        // add it to the IntMap
                        dropMap.add(dropKey, dropAmount);
                    }
                }
            }
            // add the new combined drop entry to the new drop map
            newDropTable.addEntry(new DropTableEntry(prob, dropMap));
        }
        // done
        return newDropTable;
    }

    function test1() {
        var d = new DropTable()
            .addEntry(new DropTableEntry(0.1).addDrop("A", 1))
            .addEntry(new DropTableEntry(0.2).addDrop("B", 1))
            .addEntry(new DropTableEntry(0.3).addDrop("C", 1).addDrop("A", 1));
        console.log(d.toString());
    }

    function test2() {
        var d = new DropTable()
            .addEntry(new DropTableEntry(0.1).addDrop("A", 2))
            .addEntry(new DropTableEntry(0.2).addDrop("B", 1))
            .addEntry(new DropTableEntry(0.3).addDrop("C", 1).addDrop("A", 1));
        console.log(d.toString());

        var [x, dropArray] = d.convertDropMapToArray(new IntMap().add("A", 5).add("B", 5).add("C", 5));
        var d2 = d.filtered(dropArray);
        console.log(d2.toString());

        var [x, dropArray] = d.convertDropMapToArray(new IntMap().add("A", 1).add("B", 5).add("C", 5));
        var d2 = d.filtered(dropArray);
        console.log(d2.toString());

        var [x, dropArray] = d.convertDropMapToArray(new IntMap().add("B", 5).add("C", 5));
        var d2 = d.filtered(dropArray);
        console.log(d2.toString());
    }

    function test3() {
        var da = new Array();
        da.push(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("A", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("B", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("C", 1)));

        var d = flatten(da);
        console.log(d.toString());

        var da = new Array();
        da.push(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("A", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("A", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("B", 1)));
        da.push(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("C", 1)));

        var d = flatten(da);
        console.log(d.toString());
    }

    return  {
        flatten: flatten
        , test1: test1
        , test2: test2
        , test3: test3
    };
})();


/**
 * Basic utility object for mapping string to integers.
 **/
class IntMap {
    constructor(map = new Map()) {
        this.map = map;
    }

    // gets the value associated with the give key, or 0 if it's not present.
    get(key) {
        return this.map.has(key) ? this.map.get(key) : 0;
    }

    // sets a value directly for the given key, removing it if the value is 0
    set(key, amount) {
        if (amount == 0) this.map.delete(key)
        else this.map.set(key, amount);
        // support chaining
        return this;
    }

    // add a value to the map, if this map already has a value for the given key then it will be added to
    add(key, amount) {
        var prevAmount = 0;
        if (this.map.has(key)) {
            prevAmount = this.map.get(key);
        }
        this.set(key, prevAmount + amount);
        // support chaining
        return this;
    }

    // create a deep copy of this IntMap
    clone() {
        var newIntMap = new IntMap();
        for (var [key, value] of this.map.entries()) {
            newIntMap.map.set(key, value);
        }
        return newIntMap;
    }

    // add all the entries in another IntMap to this one
    addAll(otherIntMap) {
        for (var [key, value] of otherIntMap.map.entries()) {
            this.add(key, value);
        }
        // support chaining
        return this;
    }

    // number of entries in the IntMap
    size() {
        return this.map.size;
    }

    // whether there are no entries in this IntMap
    isEmpty() {
        return this.map.size == 0;
    }

    // check against another IntMap for equality
    equals(otherIntMap) {
        // compare sizes
        if (otherIntMap.map.size != this.map.size) return false;
        // compare entry by entry, it doesn't matter which IntMap's entries we use to iterate
        for (var [key, amount] of this.map.entries()) {
            if (!otherIntMap.map.has(key)) return false;
            if (otherIntMap.map.get(key) != amount) return false;
        }
        // shouldn't have to check anything else
        return true;
    }

    toString() {
        var s = "";
        for (var [key, amount] of this.map.entries()) {
            if (s != "") s += ", ";
            if (amount != 1) s += amount + "x";
            s += key;
        }
        return s;
    }
}

// basic struct to hold a probability and a dropMap
class DropTableEntry {
    constructor(prob, dropMap = new IntMap) {
        this.prob = prob;
        this.dropMap = dropMap;
    }

    addDrop(key, amount) {
        this.dropMap.add(key, amount);
        // support chaining
        return this;
    }
}

class DropTable {
    // Look, converting everything from objects to arrays and avoiding creating new arrays/objects
    // makes analysis run about 5x faster.  It's just gonna be really ugly to look at.

    constructor(dropKeyList = new Array(), dropIdMap = new Map()) {
        // array of drop keys, the index is the id
        this.dropKeyList = dropKeyList;

        // reverse mapping from drop keys to their id
        this.dropIdMap = dropIdMap;

        // 2-dimensional array: (num drop table entries) x (num drop Ids)
        // a non-zero element in the dropGrid denotes the number of the drop with that ID are dropped from that entry
        this.dropGrid = new Array();

        // array, one for each drop table entry, of the total number of drops for that entry
        this.dropTotalArray = new Array();

        // array, one for each drop table entry, of floats 0-1
        this.probArray = new Array();

        // first drop is the null drop, no items dropped.  Starts at 100%
        this.dropGrid.push(new Array(0));
        this.dropTotalArray.push(0);
        this.probArray.push(1);

        // explicit count of distinct drops, easier than calling this.dropKeyList.length
        this.numDrops = 0;

        // explicit count of the drop table entries,
        // easier than calling .length on any of the three arrays we could use
        this.numDropTableEntries = 1;

        // number of non-empty drop entries in the table
        this.numNonemptyDropTableEntries = 0;

        // reusable filtered version
        this.filteredClone = null;
    }

    // convert a drop key to an index in the drop list, creating one if it's not present
    getDropId(key) {
        // check if we already have the drop key
        if (!this.dropIdMap.has(key)) {
            // create new entries for this drop key
            this.dropIdMap.set(key, this.dropKeyList.length);
            this.dropKeyList.push(key);
            // increase number of distinct drops
            this.numDrops++;
            // expand the drop grid
            for (var i = 0; i < this.numDropTableEntries; i++) {
                this.dropGrid[i].push(0);
            }
        }
        // oh yeah, I guess we have to return something
        return this.dropIdMap.get(key);
    }

    // convert a drop IntMap to a drop array, with values in the right indices
    // corresponding to drops from the drop map
    // dropMap: IntMap containing drop info
    // allowAdd: Whether it's allowed to add new drop keys/ids
    // returns: [total count of drops, drop array]
    convertDropMapToArray(dropMap, allowAdd=true) {
        // create blank array with one entry for each distinct drop
        var t = new Array(this.numDrops);
        for (var i = 0; i < this.numDrops; i++) t[i] = 0;

        // running total
        var dropTotal = 0;
        // loop over the IntMap
        for (var [key, value] of dropMap.map.entries()) {
            // if it's a new drop key and we aren't allowed to add more then it's an error
            if (!allowAdd && !this.dropIdMap.has(key)) {
                throw new Error("Drop key " + key + " not found in drop table");
            }
            // get the id for thsi drop key
            var dropId = this.getDropId(key);
            // if this.getDropId() increased the dropNum this should be fine because it will
            // append to the immediate end of the array
            t[dropId] = value;
            // increment the running total
            dropTotal += value;
        }
        // return both the total and the array
        return [dropTotal, t];
    }

    // Add a new drop table entry
    // dropTableEntry: DropTableEntry object containing the probability and drops
    addEntry(dropTableEntry) {
        // filter out empty drops
        if (dropTableEntry.prob == 0 || dropTableEntry.dropMap.size() == 0) {
            return;
        }

        // convert to a drop total and a drop array, adding any drop keys as necessary
        var [dropTotal, dropArray] = this.convertDropMapToArray(dropTableEntry.dropMap);

        // might as well see if this duplicates an existing drop
        var match = -1;
        for (var i = 0; i < this.numDropTableEntries; i++) {
            // check if any existing drop entry has the exact same drops as this one
            if (this.dropTotalArray[i] == dropTotal && ArrayUtils.arrayEquals(this.dropGrid[i], dropArray)) {
                // found one, there should only be one
                match = i;
                break;
            }
        }
        if (match != -1) {
            // if there's a match, then just add to that drop entry's probability
            this.probArray[match] += dropTableEntry.prob;

        } else {
            // create a new drop entry, with a probability, drop grid, and total amount
            this.probArray.push(dropTableEntry.prob);
            this.dropGrid.push(dropArray);
            this.dropTotalArray.push(dropTotal);
            // keep the number of non-empty drops up to date
            if (dropTotal > 0) this.numNonemptyDropTableEntries++;

            // increase the count of drop table entries
            this.numDropTableEntries++;
        }
        // decrement the null drop's probability
        this.probArray[0] -= dropTableEntry.prob;
        // check for validity
        this.checkInvalid();

        // return this to support chaining
        return this;
    }

    checkInvalid() {
        // allow up to a 1% rounding error
        if (this.probArray[0] < -0.01) {
            throw new Error("Total probability exceeds 1: " + (1 - this.probArray[0]))

        // correct any error below 1%, this is usually rounding in the source drop tables
        } else if (this.probArray[0] < 0) {
            // calculate the correction factor
            var big = (1 - this.probArray[0]);
            var factor = 1.0/big;
            console.log("Fixing rounding error: " + (1 - this.probArray[0]).toFixed(4) + " -> 1.0");
            // just scale each drop probabiltiy by the factor
            for (var i = 1; i < this.numDropTableEntries; i++) {
                this.probArray[i] *= factor;
            }
            // set the null entry's probability to 0
            this.probArray[0] = 0;
        }
    }

    clone() {
        // create a new drop table with the same drop key mapping
        var clone = new DropTable(this.dropKeyList, this.dropIdMap);
        // copy a bunch of arrays
        clone.dropGrid = ArrayUtils.arrayCopy(this.dropGrid, 2);
        clone.dropTotalArray = ArrayUtils.arrayCopy(this.dropTotalArray);
        clone.probArray = ArrayUtils.arrayCopy(this.probArray);
        // copy other variables
        clone.numDrops = this.numDrops;
        clone.numDropTableEntries = this.numDropTableEntries;
        clone.numNonemptyDropTableEntries = this.numNonemptyDropTableEntries;
        return clone;
    }

    // create a filtered version of this drop table for the given required drop amounts
    // requiredDropArray: drop array giving the required amounts of each drop
    // returns: a separate DropTable instance with the drop amounts truncated to the given
    //          required drops.
    //          This may leave some drop entries with zero drops
    //          For performance reasons, this is a cached object.  Calling this again on the same DropTable
    //          will result in the same object being reused to reflect the new requiredDropArray.
    filtered(requiredDropArray) {
        // create the cached clone if necessary;
        if (this.filteredClone == null) {
            this.filteredClone = this.clone();
        }
        // shortcut
        var f = this.filteredClone;

        // reset the count of non-empty drop table entries
        f.numNonemptyDropTableEntries = this.numNonemptyDropTableEntries;
        // loop over the drop table entries
        for (var i = 0; i < this.numDropTableEntries; i++) {
            // skip entries in this drop table that are already empty
            if (this.dropTotalArray[i] > 0) {
                // shortcuts to this drop table's data
                f.dropTotalArray[i] = this.dropTotalArray[i];
                var dropEntry = this.dropGrid[i];
                // keep track of whether we had to truncate any drop amounts
                var decreased = false;
                // loop over the drops
                for (var j = 0; j < this.numDrops; j++) {
                    // check if this object's drop amount is greater than the required amount
                    if (dropEntry[j] > requiredDropArray[j]) {
                        // set the target objects drop amount to the required amount
                        f.dropGrid[i][j] = requiredDropArray[j];
                        // figure out how much we decreased the total drops by and decrease the target
                        // object's total drop amount for this drop by that amount
                        f.dropTotalArray[i] -= (dropEntry[j] - requiredDropArray[j]);
                        // we need to check the non-empty drop count
                        decreased = true;
                    } else {
                        // otherwise just copy over the drop amount
                        f.dropGrid[i][j] = dropEntry[j];
                    }
                }
                // if we decreased this drop's total amount to zero then decrement the
                // number of non-empty drops
                if (decreased && f.dropTotalArray[i] == 0) f.numNonemptyDropTableEntries--;
            }
        }
        // that was a lot
        return f;
    }

    // get the list of drop keys
    getDropKeyList() {
        return this.dropKeyList;
    }

    // get how many drop keys are in this table
    getNumDrops() {
        return this.dropKeyList.length;
    }

    // this table is empty if it doesn't have any non-empty drop entries
    isEmpty() {
        return this.numNonemptyDropTableEntries == 0;
    }

    // size is the number of non-empty drop entries
    size() {
        return this.numNonemptyDropTableEntries;
    }

    // might as well support converting drop arrays back to drop maps
    convertDropArrayToMap(dropArray) {
        var dropMap = new IntMap();
        for (var i = 0; i < dropArray.length; i++) {
            if (dropArray[i] > 0) {
                dropMap.add(this.dropKeyList[i], dropArray[i]);
            }
        }
        return dropMap;
    }

    // might as well support converting back to entry objects
    getEntries() {
        var entries = new Array();
        this.forEachDropEntry((prob, dropArray) => {
            entries.push(new DropTableEntry(prob, convertDropArrayToMap(dropArray)));
        });
        return entries;
    }

    /**
     * run a function for each non-empty drop entry in this table.  this is easier than writing the code to
     * poke into the state of this drop table in half a dozen places
     * callback: function(prob, dropArray)
     **/
    forEachDropEntry(callback) {
        // loop over the entries
        for (var i = 0; i < this.numDropTableEntries; i++) {
            // skip empty ones
            if (this.probArray[i] == 0 || this.dropTotalArray[i] == 0) continue;
            // run the callback with the drop entry's probability and drop amounts.
            callback(this.probArray[i], this.dropGrid[i]);
        }
    }

    toString() {
        var s = "";
        // might as well use forEachDropEntry()
        this.forEachDropEntry((prob, dropArray) => {
            s += (100 * prob).toFixed(2) + "%: ";
            var num = 0;
            for (var j = 0; j < dropArray.length; j++) {
                var amount = dropArray[j];
                if (amount > 0) {
                    if (num > 0) s += ", ";
                    if (amount > 1) s += amount + "x";
                    s += this.dropKeyList[j];
                    num++;
                }
            }
            s += "\n";
        });

        s += "total entries: " + this.numDropTableEntries + ", nonempty: " + this.numNonemptyDropTableEntries;
        return s;
    }
}
