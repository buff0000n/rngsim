const DropTableUtils = (function() {

    return  {
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
        for (const [key, value] of this.map.entries()) {
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
    constructor(table = new Array()) {
        this.table = table;
        this.totalProb = 0;
        for (var i = 0; i < this.table.length; i++) {
            this.totalProb += this.table[i].prob;
        }
        this.checkInvalid();
    }

    addEntry(dropTableEntry) {
        // filter out empty drops
        if (dropTableEntry.prob > 0 && dropTableEntry.dropMap.size() > 0) {
            var match = null;
            for (var i = 0; i < this.table.length; i++) {
                if (this.table[i].dropMap.equals(dropTableEntry.dropMap)) {
                    match = this.table[i];
                    break;
                }
            }
            if (match != null) {
                match.prob += dropTableEntry.prob;
            } else {
                this.table.push(dropTableEntry);
            }
            this.totalProb += dropTableEntry.prob;
            this.checkInvalid();
        }
        return this;
    }

    checkInvalid() {
        // floating point math is a b*tch
        if (this.totalProb > 1.000001) {
            throw new Error("Total probability exceeds 1: " + this.totalProb)
        }
    }

    getNullDrop() {
        // floating point math is a b*tch
        if (this.totalProb > 0.999999) return null;
        return new DropTableEntry(1 - this.totalProb, new IntMap());
    }

    getDrop(index) {
        if (index > this.table.length) return null;
        else if (index == this.table.length) return this.getNullDrop();
        else return this.table[index];
    }

    createFiltered(requiredDrops) {
        var newDropTable = new DropTable();
        for (var i = 0; i < this.table.length; i++) {
            var entry = this.table[i];
            var newDropMap = entry.dropMap.clone().minAll(requiredDrops);
            if (!newDropMap.isEmpty()) {
                newDropTable.addEntry(new DropTableEntry(entry.prob, newDropMap));
            }
        }
        return newDropTable;
    }

    getDropKeySet() {
        var set = new Set();
        for (var i = 0; i < this.table.length; i++) {
            for (const [key, amount] of this.table[i].dropMap.map.entries()) {
                set.add(key);
            }
        }
        return set;
    }

    isEmpty() {
        return this.table.length == 0;
    }

    size() {
        return this.table.length;
    }

    toString() {
        var s = "";
        for (var i = 0; i < this.table.length; i++) {
            if (i > 0) s += "\n";
            s += this.table[i].prob.toFixed(4) + ": " + this.table[i].dropMap.toString();
        }
        return s;
    }
}

class DropTableScenario {
    constructor(dropTables = Array(), requiredDrops = new IntMap()) {
        this.dropTables = dropTables;
        this.requiredDrops = requiredDrops;
    }

    addDropTable(dropTable) {
        this.dropTables.push(dropTable);
        return this;
    }

    addRequiredDrop(key, amount) {
        this.requiredDrops.add(key, amount);
        return this;
    }

    flattenDropTables() {
        if (this.dropTables.length == 1) {
            return this;
        }

        var newDropTable = new DropTable();

        var dropIndex = Array();
        dropIndex.push(-1);
        for (var i = 1; i < this.dropTables.length; i++) dropIndex.push(0);

        // todo: there's gotta be a better way to code this
        for (;;) {
            var prob = 1;
            var dropMap = new IntMap();
            var increment = true;
            var done = false;
            for (var i = 0; i < dropIndex.length; i++) {
                var dropTable = this.dropTables[i];
                var entry = null;
                if (increment) {
                    dropIndex[i]++;
                    entry = dropTable.getDrop(dropIndex[i]);
                    if (entry == null) {
                        dropIndex[i] = 0;
                        if (i >= dropIndex.length - 1) {
                            done = true;
                            break;
                        }
                        entry = dropTable.getDrop(dropIndex[i]);
                    } else {
                        increment = false;
                    }
                } else {
                    entry = dropTable.getDrop(dropIndex[i]);
                }
                prob *= entry.prob;
                dropMap.addAll(entry.dropMap);
            }
            if (done) {
                break;
            }
            newDropTable.addEntry(new DropTableEntry(prob, dropMap));
        }
        return newDropTable;
    }

    createFiltered(newRequiredDrops = this.requiredDrops) {
        var newDropTables = Array();
        for (var i = 0; i < this.dropTables.length; i++) {
            var newDropTable = this.dropTables[i].createFiltered(newRequiredDrops);
            if (!newDropTable.isEmpty()) {
                newDropTables.push(newDropTable);
            }
        }
        return new DropTableScenario(newDropTables, newRequiredDrops);
    }

    toString() {
        var s = "";
        for (var i = 0; i < this.dropTables.length; i++) {
            if (i > 0) s += "\n--\n";
            s += this.dropTables[i].toString();
        }
        s += "\nRequired: " + this.requiredDrops.toString();
        return s;
    }
}

/*

var s = new DropTableScenario().addDropTable(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("A", 1))).addDropTable(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("A", 1))).addDropTable(new DropTable().addEntry(new DropTableEntry(0.1).addDrop("A", 1))).addRequiredDrop("A", 1).flatten().createFiltered(new IntMap().add("A", 5))
console.log(s.toString())

*/