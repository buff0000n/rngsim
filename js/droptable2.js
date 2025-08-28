const DropTableUtils = (function() {
    function flatten(dropTableArray) {
        if (dropTableArray.length == 1) {
            return dropTableArray[0];
        }

        var newDropTable = new DropTable();

        var dropIndex = new Array();
        dropIndex.push(-1);
        for (var i = 1; i < dropTableArray.length; i++) dropIndex.push(0);

        var done = false;
        for (;;) {
            for (var i = 0;; i++) {
                if (i >= dropIndex.length) {
                    done = true;
                    break;
                }
                dropIndex[i]++;
                if (dropIndex[i] >= dropTableArray[i].numDropTableEntries) {
                    dropIndex[i] = 0;
                } else {
                    break;
                }
            }
            if (done) {
                break;
            }

            var prob = 1;
            var dropMap = new IntMap();
            for (var i = 0; i < dropTableArray.length; i++) {
                var dt = dropTableArray[i];
                prob *= dt.probArray[dropIndex[i]];
                for (var j = 0; j < dt.numDrops; j++) {
                    var dropAmount = dt.dropGrid[dropIndex[i]][j];
                    if (dropAmount > 0) {
                        var dropKey = dt.dropKeyList[j];
                        dropMap.add(dropKey, dropAmount);
                    }
                }
            }
            newDropTable.addEntry(new DropTableEntry(prob, dropMap));
        }
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


class IntMap {
    constructor(map = new Map()) {
        this.map = map;
    }

    get(key) {
        return this.map.has(key) ? this.map.get(key) : 0;
    }

    set(key, amount) {
        if (amount == 0) this.map.delete(key)
        else this.map.set(key, amount);
    }

    add(key, amount) {
        var prevAmount = 0;
        if (this.map.has(key)) {
            prevAmount = this.map.get(key);
        }
        this.set(key, prevAmount + amount);
        return this;
    }

    subtract(key, amount, stopAtZero=true) {
        var prevAmount = 0;
        if (this.map.has(key)) {
            prevAmount = this.map.get(key);
        }
        var newAmount = prevAmount - amount;
        if (newAmount < 0 && stopAtZero) newAmount = 0;
        this.set(key, newAmount);
        return this;
    }

    clone() {
        var newIntMap = new IntMap();
        for (var [key, value] of this.map.entries()) {
            newIntMap.map.set(key, value);
        }
        return newIntMap;
    }

    addAll(otherIntMap) {
        for (const [key, value] of otherIntMap.map.entries()) {
            this.add(key, value);
        }
        return this;
    }

    subtractAll(otherIntMap, stopAtZero=true) {
        for (const [key, amount] of otherIntMap.map.entries()) {
            this.subtract(key, amount, stopAtZero);
        }
        return this;
    }

    minAll(otherIntMap) {
        for (const [key, amount] of this.map.entries()) {
            var otherAmount = otherIntMap.get(key);
            if (this.get(key) > otherAmount) {
                this.set(key, otherAmount);
            }
        }
        return this;
    }

    size() {
        return this.map.size;
    }

    isEmpty() {
        return this.map.size == 0;
    }

    equals(otherIntMap) {
        if (otherIntMap.map.size != this.map.size) return false;
        for (const [key, amount] of this.map.entries()) {
            if (!otherIntMap.map.has(key)) return false;
            if (otherIntMap.map.get(key) != amount) return false;
        }
        return true;
    }

    toString() {
        var s = "";
        var j = 0;
        for (const [key, amount] of this.map.entries()) {
            if (j > 0) s += ", ";
            s += key;
            if (amount != 1) s += " x" + amount;
            j++;
        }
        return s;
    }
}

class DropTableEntry {
    constructor(prob, dropMap = new IntMap) {
        this.prob = prob;
        this.dropMap = dropMap;
    }

    addDrop(key, amount) {
        this.dropMap.add(key, amount);
        return this;
    }
}

class DropTable {
    constructor(dropKeyList = new Array(), dropIdMap = new Map()) {
        // console.log("new array: DropTable");
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

        // explicit count of distinct drops
        this.numDrops = 0;

        // explicit count of the drop table entries
        this.numDropTableEntries = 1;

        // number of non-empty drop entries in the table
        this.numNonemptyDropTableEntries = 0;

        // reusable filtered version
        this.filteredClone = null;
    }
    
    getDropId(key) {
        // check if we already have the drop key
        if (!this.dropIdMap.has(key)) {
            this.dropIdMap.set(key, this.dropKeyList.length);
            this.dropKeyList.push(key);
            // increase number of distinct drops
            this.numDrops++;
            // increase the drop grid size
            for (var i = 0; i < this.numDropTableEntries; i++) {
                this.dropGrid[i].push(0);
            }
        }
        return this.dropIdMap.get(key);
    }

    convertDropMapToArray(dropMap, allowAdd=true) {
        // create blank array with one entry for each distinct drop
        // console.log("new array: convertDropMapToArray");
        var t = new Array(this.numDrops);
        for (var i = 0; i < this.numDrops; i++) t[i] = 0;

        var dropTotal = 0;
        for (var [key, value] of dropMap.map.entries()) {
            if (!allowAdd && !this.dropIdMap.has(key)) {
                throw new Error("Drop key " + key + " not found in drop table");
            }
            var dropId = this.getDropId(key);
            // if this.getDropId() increased the dropNum this should be fine because it will
            // append to the immediate end of the array
            t[dropId] = value;
            dropTotal += value;
        }
        return [dropTotal, t];
    }
    
    addEntry(dropTableEntry) {
        // filter out empty drops
        if (dropTableEntry.prob == 0 || dropTableEntry.dropMap.size() == 0) {
            return;
        }

        var [dropTotal, dropArray] = this.convertDropMapToArray(dropTableEntry.dropMap);

        var match = -1;
        for (var i = 0; i < this.numDropTableEntries; i++) {
            if (this.dropTotalArray[i] == dropTotal && ArrayUtils.arrayEquals(this.dropGrid[i], dropArray)) {
                match = i;
                break;
            }
        }
        if (match != -1) {
            this.probArray[match] += dropTableEntry.prob;

        } else {
            this.probArray.push(dropTableEntry.prob);
            this.dropGrid.push(dropArray);
            this.dropTotalArray.push(dropTotal);
            if (dropTotal > 0) this.numNonemptyDropTableEntries++;

            this.numDropTableEntries++;
        }
        this.probArray[0] -= dropTableEntry.prob;
        this.checkInvalid();

        return this;
    }

    checkInvalid() {
        // allow 1% rounding error
        if (this.probArray[0] < -0.01) {
            throw new Error("Total probability exceeds 1: " + (1 - this.probArray[0]))
        } else if (this.probArray[0] < 0) {
            var big = (1 - this.probArray[0]);
            var factor = 1.0/big;
            console.log("Fixing rounding error: " + (1 - this.probArray[0]).toFixed(4) + " -> 1.0");
            for (var i = 1; i < this.numDropTableEntries; i++) {
                this.probArray[i] *= factor;
            }
            this.probArray[0] = 0;
        }
    }

    clone() {
        // todo: need to clone the key mapping?
        var clone = new DropTable(this.dropKeyList, this.dropIdMap);
        clone.dropGrid = ArrayUtils.arrayCopy(this.dropGrid, 2);
        clone.dropTotalArray = ArrayUtils.arrayCopy(this.dropTotalArray);
        clone.probArray = ArrayUtils.arrayCopy(this.probArray);
        clone.numDrops = this.numDrops;
        clone.numDropTableEntries = this.numDropTableEntries;
        clone.numNonemptyDropTableEntries = this.numNonemptyDropTableEntries;
        return clone;
    }

    filtered(requiredDropArray) {
        if (this.filteredClone == null) {
            this.filteredClone = this.clone();
        }
        var f = this.filteredClone;

        f.numNonemptyDropTableEntries = this.numNonemptyDropTableEntries;
        for (var i = 0; i < this.numDropTableEntries; i++) {
            if (this.dropTotalArray[i] > 0) {
                f.dropTotalArray[i] = this.dropTotalArray[i];
                var dropEntry = this.dropGrid[i];
                var decreased = false;
                for (var j = 0; j < this.numDrops; j++) {
                    if (dropEntry[j] > requiredDropArray[j]) {
                        f.dropGrid[i][j] = requiredDropArray[j];
                        var minusDrops = dropEntry[j] - requiredDropArray[j];
                        f.dropTotalArray[i] -= minusDrops;
                        decreased = true;
                    } else {
                        f.dropGrid[i][j] = dropEntry[j];
                    }
                }
                if (decreased && f.dropTotalArray[i] == 0) f.numNonemptyDropTableEntries--;
            }
        }
        return f;
    }

    getDropKeyList() {
        return this.dropKeyList;
    }

    getNumDrops() {
        return this.dropKeyList.length;
    }

    isEmpty() {
        return this.numNonemptyDropTableEntries == 0;
    }

    size() {
        return this.numNonemptyDropTableEntries;
    }

    /**
     * callback: function(prob, dropArray)
     **/
    forEachDropEntry(callback) {
        for (var i = 0; i < this.numDropTableEntries; i++) {
            if (this.probArray[i] == 0 || this.dropTotalArray[i] == 0) continue;
            callback(this.probArray[i], this.dropGrid[i]);
        }
    }

    toString() {
        var s = "";
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
