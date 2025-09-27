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
        // explicit count of distinct drops, easier than calling this.dropKeyList.length
        this.numDrops = 0;

        // mercy rule configuration, if specified
        this.mercyGrid = null;

        // bail early rule, only applicable when there are more than one rotation
        this.bailEarly = false;
        // list of the highest rotation containing each drop
        this.bailEarlyRotationList = null;

        // drop rotations
        this.rotations = Array();
        // keep track of non-empty rotations
        this.numNonEmptyRotations = 0;

        // populated lazily
        this.flattenedRotations = null;

        // add the default rotation
        this.rotations.push(new DropRotation(this, null));
        // convenience count
        this.numRotations = 1;

        // reusable filtered version
        this.filteredClone = null;
    }

    // convert a drop key to an index in the drop list, creating one if it's not present
    getDropId(key, allowAdd=true) {
        // check if we already have the drop key
        if (!this.dropIdMap.has(key)) {
            // if it's a new drop key and we aren't allowed to add more then it's an error
            if (!allowAdd) {
                throw new Error("Drop key " + key + " not found in drop table");
            }
            // create new entries for this drop key
            this.dropIdMap.set(key, this.dropKeyList.length);
            this.dropKeyList.push(key);
            // increase number of distinct drops
            this.numDrops++;
            // propagate the additional drop to all rotation tables
            for (var i = 0; i < this.numRotations; i++) {
                this.rotations[i].addDrop();
            }
        }
        // oh yeah, I guess we have to return something
        return this.dropIdMap.get(key);
    }

    // convert required drop map into an array, applying defaults and mercy rules.
    // requiredDrops: IntMap
    // returns: IntSumArray
    toRequiredDropArray(requiredDrops) {
        // apply default required drops if necessary
        if (requiredDrops == null) {
            // create a new array of 1's for each drop
            return IntUtils.newIntSumArray(this.getNumDrops(), 1);

        } else {
            // convert provided drop IntMap to an array for the given drop table
            // if any of the drops in the map are not found in the drop table then throw an error
            // This also applies any mercy rules to the required drops, if present
            return this.convertDropMapToFullArray(requiredDrops, false);
        }
    }

    // convert a drop IntMap to a drop array, with values in the right indices
    // corresponding to drops from the drop map.
    // if this drop table has mercy rules then they will be added into the drop array
    // dropMap: IntMap containing drop info
    // allowAdd: Whether it's allowed to add new drop keys/ids
    // returns: IntSumArray
    convertDropMapToFullArray(dropMap, allowAdd=true) {
        var a = this.convertDropMapToArray(dropMap, allowAdd);

        // apply mercy rules if present
        if (this.mercyGrid != null) {
            // loop over possible mercy drops
            for (var mercyId = 0; mercyId < this.numDrops; mercyId++) {
                if (this.mercyGrid[mercyId].total == 0) continue;
                var total = 0;
                // loop over drops
                for (var j = 0; j < this.numDrops; j++) {
                    // see if there's a mercy rule for this drop and mercy drop
                    if (this.mercyGrid[mercyId].list[j] > 0) {
                        // calculate the amount of mercy drops required to meet the drop amount
                        var mercyAmount = a.list[j] * this.mercyGrid[mercyId].list[j]
                        // increment the required mercy drops
                        a.add(mercyId, mercyAmount);
                    }
                }
            }

            // oh shit this is a huge hack
            this.originalRequiredDropArray = a;
        }

        return a;
    }

    // dropMap: map of drops
    // allowAdd: true if unknown drop names should be added to this drop table
    // returns: IntSumArray
    convertDropMapToArray(dropMap, allowAdd=true) {
        // create blank array with one entry for each distinct drop
        var a = IntUtils.newIntSumArray(this.numDrops, 0);

        // loop over the IntMap
        for (var [key, value] of dropMap.map.entries()) {
            // get the id for this drop key
            var dropId = this.getDropId(key, allowAdd);
            // if this.getDropId() increased the dropNum this should be fine because it will
            // append to the immediate end of the array
            a.set(dropId, value);
        }
        // return both the total and the array
        return a;
    }

    // Add a new entry to the default rotation, or the last rotation that was added
    // dropTableEntry: DropTableEntry object containing the probability and drops
    addEntry(dropTableEntry) {
        // get the last rotation that was added
        this.rotations[this.rotations.length - 1].addEntry(dropTableEntry);

        // return this to support chaining
        return this;
    }

    addRotation(name) {
        // if all we have is a default rotation then convert it to a named rotation
        if (this.numRotations == 1 && this.rotations[0].name == null) {
            this.rotations[0].name = name;
            return this;
        }
        // else add a rotation
        var rotation = new DropRotation(this, name);
        this.rotations.push(rotation);
        this.numRotations += 1;

        return this;
    }

    getRotation(name) {
        // worth optimizing?
        for (var r = 0; r < this.numRotations; r++) {
            if (this.rotations[i].name == name) return this.rotations[i];
        }
        return null;
    }

    clone() {
        // create a new drop table with the same drop key mapping
        // create a new object using this one as the template, preserving any overridden functions or attributes
        var clone = Object.create(this);
//        // copy other variables
//        clone.numDrops = this.numDrops;

        // deep clone the flattened rotation array, this is the only thing we might need to change with clones
        var fr = this.getFlattenedRotations();
        clone.flattenedRotations = new Array();
        for (var i = 0; i < fr.length; i++) {
            clone.flattenedRotations[i] = fr[i].clone(clone);
        }
//        clone.numRotations = this.numRotations;

        return clone;
    }

    // create a filtered version of this drop table for the given required drop amounts
    // requiredDropArray: IntSumArray giving the required amounts of each drop
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
        var fc = this.filteredClone;

//        // re-init number of non-empty drop rotations
//        fc.numNonEmptyRotations = this.numNonEmptyRotations;
        // reset rotation clones and filter them again
        var frs = this.getFlattenedRotations();
        for (var i = 0; i < frs.length; i++) {
            fc.flattenedRotations[i] = frs[i].filtered(fc, requiredDropArray);
        }

        return fc;
    }

    // add a mercy rule to the drop table
    // mercyDropName: the drop name of the mercy drop, must already be in this drop table
    // requiredMercyDropAmount: the amount of mercy drops required
    // dropName: the regular drop that amount of mercy drops can be exchanged for.
    //           It's assumed that the drop can be exchanged for one at a time
    addMercyRule(mercyDropName, requiredMercyDropAmount, dropName) {
        // initialize the mercy state if this is our first mercy rule
        if (this.mercyGrid == null) {
            this.mercyGrid = new Array(this.numDrops);
            for (var i = 0; i < this.numDrops; i++) {
                this.mercyGrid[i] = IntUtils.newIntSumArray(this.numDrops, 0);
            }
        }
        // get the ids of the mercy drop and the result drop
        var mercyId = this.getDropId(mercyDropName, false);
        var dropId = this.getDropId(dropName, false);
        // update the mercy grid
        this.mercyGrid[mercyId].add(dropId, requiredMercyDropAmount);
        // todo: checks, you can't have a mercy rule for another mercy drop
        // return this to support chaining
        return this;
    }

    reduceRequiredDropArray(requiredDropArray, dropArray, tempDropArray, truncate=true) {
        if (this.mercyGrid == null) {
            // if there are no mercy rules then just do a basic subtraction
            return requiredDropArray.subtractAllTo(dropArray, tempDropArray, truncate);
        } else {
            // we have to evaluate the mercy rules
            return this.reduceRequiredDropArrayWithMercyRule(requiredDropArray, dropArray, tempDropArray, truncate)
        }
    }

    reduceRequiredDropArrayWithMercyRule(requiredDropArray, dropArray, tempDropArray, truncate=true) {
        // go through and decrement the required mercy drops first
        for (var mercyId = 0; mercyId < this.numDrops; mercyId++) {
            if (this.mercyGrid[mercyId].total > 0) {
                tempDropArray.set(mercyId, requiredDropArray.list[mercyId] - dropArray.list[mercyId]);
                // cut off at zero
                if (truncate && tempDropArray.list[mercyId] < 0) {
                    tempDropArray.set(mercyId) = 0;
                }
            }
        }

        // loop over the non-mercy drops
        for (var i = 0; i < this.numDrops; i++) {
            if (this.mercyGrid[i].total > 0) continue;
            if (dropArray.list[i] > 0) {
                // truncate to required amount
                var dropped = dropArray.list[i] > requiredDropArray.list[i] ? requiredDropArray.list[i] : dropArray.list[i];
                // save to result
                tempDropArray.set(i, requiredDropArray.list[i] - dropped);
                // loop over the mercy rules
                for (var mercyId = 0; mercyId < this.numDrops; mercyId++) {
                    // if there's a mercy rule for this drop
                    if (this.mercyGrid[mercyId].list[i] > 0) {
                        // decrement the required mercy drop amount by the amount for this drop
                        tempDropArray.add(mercyId, -this.mercyGrid[mercyId].list[i] * dropped);
                        // cut off at zero
                        if (truncate && tempDropArray.list[mercyId] < 0) {
                            tempDropArray.set(mercyId, 0);
                        }
                    }
                }
            } else {
                // no amount was dropped for this drop, copy the required amount over to the
                // result unchanged
                tempDropArray.set(i, requiredDropArray.list[i]);
            }
        }

        // calculate if there are no more required mercy drops
        var mercyHit = true;
        for (var mercyId = 0; mercyId < this.numDrops; mercyId++) {
            if (this.mercyGrid[mercyId].total > 0 && tempDropArray.list[mercyId] > 0) {
                // One mercy drop is still pending, prevent the mercy rule from triggering
                mercyHit = false;
                break;
            }
        }
        // if we've hit the mercy requirement then we're done
        if (mercyHit) {
            // console.log("Mercy rule: " + tempDropArray[mercyId] + " >= " + mercyRequired);
            // reduce all remaining drops.  we've accumulated enough mercy drops to exchange for anything
            // outstanding
            if (truncate) {
                for (var i = 0; i < this.numDrops; i++) {
                    tempDropArray.set(i, 0);
                }
            } else {
                // add back mercy drops that we used
                for (var i = 0; i < this.numDrops; i++) {
                    if (this.mercyGrid[i].total > 0) continue;
                    if (tempDropArray.list[i] > 0) {
                        for (var mercyId = 0; mercyId < this.numDrops; mercyId++) {
                            // if there's a mercy rule for this drop
                            if (this.mercyGrid[mercyId].list[i] > 0) {
                                // re-increment the required mercy drop amount by the amount for this drop
                                tempDropArray.add(mercyId, this.mercyGrid[mercyId].list[i] * tempDropArray.list[i]);
                            }
                        }
                    }
                }
                // invert with the original required mercy drop amount
                for (var mercyId = 0; mercyId < this.numDrops; mercyId++) {
                    if (this.mercyGrid[mercyId].total > 0) {
                        // this is all so we can subtract this from the original drop amount and get the actual
                        // mercy drops that were dropped.
                        tempDropArray.set(mercyId, this.originalRequiredDropArray.list[mercyId] - tempDropArray.list[mercyId]);
                    }
                }
                // hack IntSumArray
                // fine as long as there are absolutely no follow-up questions
                tempDropArray.numPos = 0;
            }
        }
        // otherwise what we have is the new remaining drop amounts.
        // console.log("Reduce: " + ArrayUtils.arrayToString(requiredDropArray) + " - " + ArrayUtils.arrayToString(dropArray) + " = " + ArrayUtils.arrayToString(tempDropArray));
    }

    setBailEarly(newBailEarly=true) {
        if (newBailEarly != this.bailEarly) {
            this.bailEarly = newBailEarly;
            if (!this.bailEarly) {
                this.bailEarlyRotationList = null;
            } else {
                var berl = ArrayUtils.fillArray(this.numDrops, -1);
                // todo: each rotation keeps a list of drops that drop from it?
                for (var r = 0; r < this.numRotations; r++) {
                    this.rotations[r].forEachDropEntry((_, dropArray) => {
                        for (var i = 0; i < this.numDrops; i++) {
                            if (dropArray.list[i] > 0) berl[i] = r;
                        }
                    });
                }
                this.bailEarlyRotationList = berl;
            }
        }
        return this;
    }

    getBailEarlyRotation(requiredDropArray) {
        var highestRotation = -1;
        for (var i = 0; i < this.numDrops; i++) {
            if (requiredDropArray.list[i] > 0 && this.bailEarlyRotationList[i] > highestRotation) {
                highestRotation = this.bailEarlyRotationList[i];
            }
        }
        return highestRotation;
    }

    // get the list of drop keys
    getDropKeyList() {
        return this.dropKeyList;
    }

    // get how many drop keys are in this table
    getNumDrops() {
        return this.dropKeyList.length;
    }

    // might as well support converting drop arrays back to drop maps
    convertDropArrayToMap(dropArray) {
        var dropMap = new IntMap();
        for (var i = 0; i < dropArray.list.length; i++) {
            if (dropArray.list[i] > 0) {
                dropMap.add(this.dropKeyList[i], dropArray.list[i]);
            }
        }
        return dropMap;
    }

    getRotations() {
        return this.rotations;
    }

    getFlattenedRotations() {
        if (this.flattenedRotations == null) {
            if (this.numRotations == 1 || !this.bailEarly) {
                this.flattenedRotations = [this.flatten(this.rotations)];

            } else {
                this.flattenedRotations = new Array();
                for (var i = 0; i < this.numRotations; i++) {
                    this.flattenedRotations[i] = this.flatten(this.rotations.slice(0, i + 1));
                }
            }
        }
        return this.flattenedRotations;
    }

    getFlattenedRotation(requiredDropArray) {
        var frs = this.getFlattenedRotations();
        if (this.numRotations == 1 || !this.bailEarly) {
            return frs[0];

        } else {
            return frs[this.getBailEarlyRotation(requiredDropArray)];
        }
    }

    flatten(rotations) {
        // if there's only one, we're done
        if (rotations.length == 1) {
            return rotations[0];
        }

        // new drop table
        var newRotation = new DropRotation(this);
        // construct a name
        var name = "Flattened (";
        for (var i = 0; i < rotations.length; i++) {
            if (i > 0) name += ", ";
            name += rotations[i].name;
        }
        name += ")";
        newRotation.name = name;

        // build an multi-dimensional index we can use to iterate over every combinations of drops, one
        // from each drop table.
        var dropIndex = new Array();
        // start the first index at -1 to make things easier
        dropIndex.push(-1);
        // fill in the rest with zeroes.
        for (var i = 1; i < rotations.length; i++) dropIndex.push(0);

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
                if (dropIndex[i] >= rotations[i].numDropTableEntries) {
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
            // start with a base probability, this will be the product of the probabilities of
            // all the entries we're combining.
            var prob = 1;
            // build this an an IntMap so we can just call addEntry()
            var dropArray = IntUtils.newIntSumArray(this.numDrops, 0);
            // loop over the drop tables
            for (var i = 0; i < rotations.length; i++) {
                var dt = rotations[i];
                // pick out the probability of this table's current entry and multiply it in
                prob *= dt.probArray[dropIndex[i]];
                dropArray.addAll(dt.dropGrid[dropIndex[i]]);
            }
            // add the new combined drop entry to the new drop map
            newRotation.addArrayEntry(prob, dropArray);
        }
        // done
        return newRotation;
    }

    // this table is empty if it doesn't have any non-empty drop entries
    isEmpty() {
        return this.numNonEmptyRotations == 0;
    }

    // size is the number of non-empty rotations
    size() {
        return this.numNonEmptyRotations;
    }

    /**
     * run a function for each non-empty drop entry in this table.  this is easier than writing the code to
     * poke into the state of this drop table in half a dozen places
     * requiredDropArray: current require drop array, may change the results if bailEarly is enabled
     * callback: function(prob, dropArray)
     **/
    forEachDropEntry(requiredDropArray, callback) {
        // pick correct rotation
        this.getFlattenedRotation(requiredDropArray).forEachDropEntry(callback);
    }

    // return a random drop, weighted by drop chance
    // returns: IntSumArray
    randomDrop(requiredDropArray) {
        return this.getFlattenedRotation(requiredDropArray).randomDrop();
    }

    toString() {
        var s = "Rotations:";

        for (var i = 0; i < this.numRotations; i++) {
            s += "\n" + this.rotations[i].toString("  ");
        }
        s += "\nFlattened:";

        if (this.numRotations > 1) {
            var frs = this.getFlattenedRotations();
            for (var i = 0; i < frs.length; i++) {
                s += "\n" + frs[i].toString("  ");
            }
        }

        if (this.mercyGrid != null) {
            s += "\nMercy rules: ";
            for (var mercyId = 0; mercyId < this.numDrops; mercyId++) {
                if (this.mercyGrid[mercyId].total > 0) {
                    for (var i = 0; i < this.numDrops; i++) {
                        if (this.mercyGrid[mercyId].list[i] > 0) {
                            s += "\n  " + this.mercyGrid[mercyId].list[i] + "x" + this.dropKeyList[mercyId] + " = " + this.dropKeyList[i];
                        }
                    }
                }
            }
        }

        return s;
    }
}

class DropRotation {
    // parent: back-reference to the containing DropTable
    constructor(dropTable, name) {
        this.dropTable = dropTable;
        this.name = name;

        // array of IntSumArray: (num drop table entries) x (num drop Ids)
        // a non-zero element in the dropGrid denotes the number of the drop with that ID are dropped from that entry
        this.dropGrid = new Array();

        // array, one for each drop table entry, of floats 0-1
        this.probArray = new Array();

        // first drop is the null drop, no items dropped.  Starts at 100%
        this.dropGrid.push(IntUtils.newIntSumArray(dropTable.numDrops, 0));
        this.probArray.push(1);

        // explicit count of the drop table entries,
        // easier than calling .length on any of the three arrays we could use
        this.numDropTableEntries = 1;

        // number of non-empty drop entries in the table
        this.numNonemptyDropTableEntries = 0;

        // random drop support, initialized on first use
        this.cumulativeDropProb = null;

        // if there is a time component to this drop table
        this.time = 0;

        // reusable filtered version
        this.filteredClone = null;
    }


    addDrop() {
        // expand the drop grid
        for (var i = 0; i < this.numDropTableEntries; i++) {
            this.dropGrid[i].push(0);
        }
    }

    // Add a new drop table entry
    // dropTableEntry: DropTableEntry object containing the probability and drops
    addEntry(dropTableEntry) {
        // filter out empty drops
        if (dropTableEntry.prob == 0 || dropTableEntry.dropMap.size() == 0) {
            return;
        }

        // convert to a drop total and a drop array, adding any drop keys as necessary
        var dropArray = this.dropTable.convertDropMapToArray(dropTableEntry.dropMap);
        return this.addArrayEntry(dropTableEntry.prob, dropArray);
    }

    addArrayEntry(prob, dropArray) {
        // might as well see if this duplicates an existing drop
        var match = -1;
        for (var i = 0; i < this.numDropTableEntries; i++) {
            // check if any existing drop entry has the exact same drops as this one
            if (this.dropGrid[i].equals(dropArray)) {
                // found one, there should only be one
                match = i;
                break;
            }
        }
        if (match != -1) {
            // if there's a match, then just add to that drop entry's probability
            this.probArray[match] += prob;

        } else {
            // create a new drop entry, with a probability, drop grid, and total amount
            this.probArray.push(prob);
            this.dropGrid.push(dropArray);
            // keep the number of non-empty drops up to date
            if (dropArray.total> 0) {
                this.numNonemptyDropTableEntries++;
                // propagate to drop table
                if (this.numNonemptyDropTableEntries == 1) {
                    this.dropTable.numNonEmptyRotations++;
                }
            }

            // increase the count of drop table entries
            this.numDropTableEntries++;
        }
        // decrement the null drop's probability
        this.probArray[0] -= prob;
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
            // just scale each drop probability by the factor
            for (var i = 1; i < this.numDropTableEntries; i++) {
                this.probArray[i] *= factor;
            }
            // set the null entry's probability to 0
            this.probArray[0] = 0;
        }
    }

    clone(cloneDropTable) {
        // create a new object using this one as the template, preserving any overridden functions or attributes
        var clone = Object.create(this);
        clone.dropTable = cloneDropTable;
        // copy a bunch of arrays
        clone.dropGrid = new Array(this.numDropTableEntries);
        for (var i = 0; i < this.numDropTableEntries; i++) {
            clone.dropGrid[i] = this.dropGrid[i].clone();
        }
        clone.probArray = ArrayUtils.arrayCopy(this.probArray);
        // copy other variables
        clone.numDropTableEntries = this.numDropTableEntries;
        clone.numNonemptyDropTableEntries = this.numNonemptyDropTableEntries;
        return clone;
    }

    // create a filtered version of this drop table for the given required drop amounts
    // requiredDropArray: IntSumArray giving the required amounts of each drop
    // returns: a separate DropTable instance with the drop amounts truncated to the given
    //          required drops.
    //          This may leave some drop entries with zero drops
    //          For performance reasons, this is a cached object.  Calling this again on the same DropTable
    //          will result in the same object being reused to reflect the new requiredDropArray.
    filtered(filteredDropTable, requiredDropArray) {
        // create the cached clone if necessary;
        if (this.filteredClone == null) {
            this.filteredClone = this.clone(filteredDropTable);
        }
        // shortcut
        var fc = this.filteredClone;

        fc.dropTable = filteredDropTable;

        // reset the count of non-empty drop table entries
        fc.numNonemptyDropTableEntries = this.numNonemptyDropTableEntries;
        // loop over the drop table entries
        for (var i = 0; i < this.numDropTableEntries; i++) {
            // skip entries in this drop table that are already empty
            if (this.dropGrid[i].total > 0) {
                // shortcuts to this drop table's data
                var te = this.dropGrid[i];
                var fe = fc.dropGrid[i];
                // loop over the drops
                for (var j = 0; j < this.dropTable.numDrops; j++) {
                    // check if this object's drop amount is greater than the required amount
                    if (te.list[j] > requiredDropArray.list[j]) {
                        // set the target objects drop amount to the required amount
                        fe.set(j, requiredDropArray.list[j]);
                        // we need to check the non-empty drop count
                    } else {
                        // otherwise just copy over the drop amount
                        fe.set(j, te.list[j]);
                    }
                }
                // if we decreased this drop's total amount to zero then decrement the
                // number of non-empty drops
                if (fe.total == 0) {
                    fc.numNonemptyDropTableEntries--;
                    // propagate to drop table
                    if (this.numNonemptyDropTableEntries == 0) {
                        this.dropTable.numNonEmptyRotations--;
                    }
                }
            }
        }
        // that was a lot
        return fc;
    }

    /**
     * run a function for each non-empty drop entry in this table.  this is easier than writing the code to
     * poke into the state of this drop table in half a dozen places
     * requiredDropArray: current require drop array, may change the results if bailEarly is enabled
     * callback: function(prob, dropArray)
     **/
    forEachDropEntry(callback) {
        // loop over the entries
        for (var i = 0; i < this.numDropTableEntries; i++) {
            // skip empty ones
            if (this.probArray[i] == 0 || this.dropGrid[i].total <= 0) continue;
            // run the callback with the drop entry's probability and drop amounts.
            callback(this.probArray[i], this.dropGrid[i]);
        }
    }

    // return a random drop, weighted by drop chance
    // returns: IntSumArray
    randomDrop() {
        // initialize the cumulative drop array if this is the first time
        if (this.cumulativeDropProb == null) {
            this.cumulativeDropProb = Array(this.numDropTableEntries);
            for (var i = 0; i < this.numDropTableEntries; i++) {
                this.cumulativeDropProb[i] = (i == 0 ? 0 : this.cumulativeDropProb[i - 1]) + this.probArray[i];
            }
        }

        var r = Math.random();
        // search our cumulative probability list for where the RNG decimal would be inserted
        var i = MathUtils.binarySearch(this.cumulativeDropProb, r);
        // convert the "not found" result to an index
        if (i < 0) {
            i = -(i + 1);
        }

        // result drop table entry
        return this.dropGrid[i];
    }

    // this table is empty if it doesn't have any non-empty drop entries
    isEmpty() {
        return this.numNonemptyDropTableEntries == 0;
    }

    // size is the number of non-empty drop entries
    size() {
        return this.numNonemptyDropTableEntries;
    }

    toString(indent="") {
        var s = indent + "Rotation" + (this.name != null ? (" " + this.name) : "") + ":";
        // might as well use forEachDropEntry()
        this.forEachDropEntry((prob, dropArray) => {
            s += "\n" + indent + "  " + (100 * prob).toFixed(2) + "%: ";
            var num = 0;
            for (var j = 0; j < dropArray.list.length; j++) {
                var amount = dropArray.list[j];
                if (amount > 0) {
                    if (num > 0) s += ", ";
                    if (amount > 1) s += amount + "x";
                    s += this.dropTable.dropKeyList[j];
                    num++;
                }
            }
        });
        s += "\n" + indent + "  total entries: " + this.numDropTableEntries + ", nonempty: " + this.numNonemptyDropTableEntries;
        return s;
    }
}

var DropTableUtils = (function() {
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
        console.log("Original:\n" + d.toString());

        var dropArray = d.convertDropMapToArray(new IntMap());
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

        var dropArray = d.convertDropMapToArray(new IntMap().add("B", 5));
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

        var dropArray = d.convertDropMapToArray(new IntMap().add("B", 5).add("C", 5));
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

        var dropArray = d.convertDropMapToArray(new IntMap().add("A", 1).add("B", 5).add("C", 5));
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

        var dropArray = d.convertDropMapToArray(new IntMap().add("A", 5).add("B", 5).add("C", 5));
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

    }

    function test3() {
        var d = new DropTable().
            addRotation("rot A").addEntry(new DropTableEntry(0.1).addDrop("A", 1)).
            addRotation("rot B").addEntry(new DropTableEntry(0.1).addDrop("B", 1)).
            addRotation("rot C").addEntry(new DropTableEntry(0.1).addDrop("C", 1));
        d.getFlattenedRotations();

        console.log(d.toString());

        var d = new DropTable().
            addRotation("rot A1").addEntry(new DropTableEntry(0.1).addDrop("A", 1)).
            addRotation("rot A2").addEntry(new DropTableEntry(0.1).addDrop("A", 1)).
            addRotation("rot B").addEntry(new DropTableEntry(0.1).addDrop("B", 1)).
            addRotation("rot C").addEntry(new DropTableEntry(0.1).addDrop("C", 1));
        d.getFlattenedRotations();

        console.log(d.toString());
    }

    function test4() {
        var d = new DropTable().
            addRotation("Rot A").addEntry(new DropTableEntry(0.1).addDrop("A", 1)).
            addRotation("Rot B").addEntry(new DropTableEntry(0.2).addDrop("B", 1)).
            addRotation("Rot C").addEntry(new DropTableEntry(0.3).addDrop("C", 1)).
            setBailEarly(true);

        console.log("Original:\n" + d.toString());

        var dropArray = d.convertDropMapToArray(new IntMap());
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

        var dropArray = d.convertDropMapToArray(new IntMap().add("B", 5));
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

        var dropArray = d.convertDropMapToArray(new IntMap().add("B", 5).add("C", 5));
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

        var dropArray = d.convertDropMapToArray(new IntMap().add("A", 1).add("B", 5).add("C", 5));
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

        var dropArray = d.convertDropMapToArray(new IntMap().add("A", 5).add("B", 5).add("C", 5));
        var d2 = d.filtered(dropArray);
        console.log(dropArray.toString() + "\n" + d2.toString());

    }

    return  {
        test1: test1
        , test2: test2
        , test3: test3
        , test4: test4
    };
})();
