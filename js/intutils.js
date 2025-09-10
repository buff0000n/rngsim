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

    // check against another IntMap for equality
    dotProduct(otherIntMap) {
        var total = 0;
        for (var [key, amount] of this.map.entries()) {
            if (otherIntMap.map.has(key)) {
                total += amount * otherIntMap.get(key);
            };
        }
        return total;
    }

    total(forKey=null) {
        total = 0;
        for (var [key, amount] of this.map.entries()) {
            if (forKey == null || forKey == key) total += amount;
        }
        return total;
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

// holds a list of integers and some state about that list
// list: the list of integers
// total: the sum of the integer list
// numPos: the number of entries in the integer list that are greater than zero
class IntSumArray {
    // default copy constructor, use IntUtils. for more ways to construct an IntSumArray
    constructor(total=0, numPos=0, list=new Array(0)) {
        this.total = total;
        this.numPos = numPos;
        this.list = list;
    }

    // set the value at an index and update state
    set(index, value) {
        // ensure size
        while (this.list.length <= index) {
            this.list.push(0);
        }
        // save the previous value
        var prevValue = this.list[index];
        // update the total
        this.total += value - prevValue;
        // check if the positive status changed
        if (prevValue <= 0 ^ value <= 0) {
            // update the num positive
            this.numPos += value <= 0 ? -1 : 1;
        }
        // set the value
        this.list[index] = value;
        // return this to support chaining
        return this;
    }

    // add to the value at an index and update state
    add(index, value) {
        this.set(index, (this.list[index] ? this.list[index] : 0) + value);
    }

    // add a value to the end of the list and update state
    push(value) {
        this.set(this.list.length, value);
    }

    // copy this object's state and list to another
    // other: should be the same length as this
    copyTo(other) {
        other.total = this.total;
        other.numPos = this.numPos;
        for (var i = 0; i < this.list.length; i++) {
            other.list[i] = this.list[i];
        }
        return this;
    }

    // subtract another IntSumMap from this, and save the result in a third IntSumMap
    // s: subtractor
    // d: holds the result
    // trunc: if true then any entry that goes below 0 will be set to 0
    subtractAllTo(s, d, trunc=false) {
        // init the subtracted total, we'll adjust this below if trunc=true
        d.total = this.total - s.total;
        // copy the num positive, we have to adjust this below
        d.numPos = this.numPos;
        for (var i = 0; i < this.list.length; i++) {
            // subtract entry
            d.list[i] = this.list[i] - s.list[i];
            // check for truncation
            if (trunc && d.list[i] < 0) {
                // adjust the total
                d.total -= d.list[i];
                // truncate
                d.list[i] = 0;
            }
            // check if the negative status of this entry has changed
            if (this.list[i] <= 0 ^ d.list[i] <= 0) {
                // adjust the num positive
                d.numPos += d.list[i] <= 0 ? -1 : 1;
            }
        }
        return d;
    }

    subtractAllTruncateTo(s, d) {
        return this.subtractAllTo(s, d, true);
    }

    // returns: deep copy
    clone() {
        return new IntSumArray(this.total, this.numPos, ArrayUtils.arrayCopy(this.list));
    }

    equals(other) {
        return (this.total == other.total && ArrayUtils.arrayEquals(this.list, other.list));
    }

    toString() {
        return "(" + this.total + "):" + ArrayUtils.arrayToString(this.list);
    }
}

var IntUtils = (function() {
    // create a new IntSumArray with the given size and starting values
    function newIntSumArray(size, fillValue=0) {
        return new IntSumArray(fillValue*size, fillValue > 0 ? size : 0, ArrayUtils.fillArray(size, fillValue));
    }

    function assert(msg, ...b) {
        var failed = "";
        for (var i = 0; i < b.length; i++) {
            if (!b[i]) {
                if (failed != "") failed += ", ";
                failed += "" + i;
            }
        }
        if (failed != "") {
            throw new Error("(" + failed +"): " + msg);
        }
    }

    function test1() {
        a = new IntSumArray();
        assert("blank", a.total == 0, a.numPos == 0);
        a.set(0, 1);
        assert("one", a.total == 1, a.numPos == 1, a.list[0] == 1);
        a.set(1, 2);
        assert("two", a.total == 3, a.numPos == 2, a.list[1] == 2);
        a.set(1, -2);
        assert("-2", a.total == -1, a.numPos == 1, a.list[1] == -2);
        var b = a.clone();
        assert("clone", b.total == -1, b.numPos == 1, b.list[0] == 1,b.list[1] == -2);
        var c = a.clone();
        a.subtractAllTo(b, c);
        assert("subtractAll", c.total == 0, c.numPos == 0);
    }

    return {
        // create a new IntSumArray with the given size and starting values
        newIntSumArray: newIntSumArray
        // test functions
        , test1: test1
    }
})();