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

class IntSumArray {
    constructor(total=0, list=new Array(0)) {
        this.total = total;
        this.list = list;
        if (!Array.isArray(this.list)) {
            throw "OOPS";
        }
    }

    set(index, value) {
        if (!Array.isArray(this.list)) {
            throw "OOPS";
        }
        while (this.list.length <= index) {
            this.list.push(0);
        }
        this.total += value - this.list[index];
        this.list[index] = value;
        return this;
    }

    add(index, value) {
        if (!Array.isArray(this.list)) {
            throw "OOPS";
        }
        while (this.list.size < index - 1) {
            this.list.push(0);
        }
        this.total += value;
        this.list[index] += value;
        return this;
    }

    push(value) {
        if (!Array.isArray(this.list)) {
            throw "OOPS";
        }
        this.list.push(value);
        this.total += value;
    }

    copyTo(other) {
        if (!Array.isArray(this.list)) {
            throw "OOPS";
        }
        other.total = this.total;
        for (var i = 0; i < this.list.length; i++) {
            other.list[i] = this.list[i];
        }
        return this;
    }

    subtractAllTo(s, d) {
        if (!Array.isArray(this.list)) {
            throw "OOPS";
        }
        d.total = this.total - s.total;
        for (var i = 0; i < this.list.length; i++) {
            d.list[i] = this.list[i] - s.list[i];
        }
        return d;
    }

    subtractAllTruncateTo(s, d) {
        if (!Array.isArray(this.list)) {
            throw "OOPS";
        }
        d.total = this.total - s.total;
        for (var i = 0; i < this.list.length; i++) {
            d.list[i] = this.list[i] - s.list[i];
            if (d.list[i] < 0) {
                d.total -= d.list[i];
                d.list[i] = 0;
            }
        }
        return d;
    }

    clone() {
        return new IntSumArray(this.total, ArrayUtils.arrayCopy(this.list));
    }

    equals(other) {
        return (this.total == other.total && ArrayUtils.arrayEquals(this.list, other.list));
    }

    toString() {
        return "(" + this.total + "):" + ArrayUtils.arrayToString(this.list);
    }
}

var MathUtils = (function() {
    function binarySearch(a, key) {
        return binarySearch0(a, 0, a.length, key);
    }

    function binarySearch0(a, fromIndex, toIndex, key) {
        // this is translated directly from Java's binary search implementation, because that's what I originally wrote
        // this program in

        var low = fromIndex;
        var high = toIndex - 1;

        while (low <= high) {
            var mid = (low + high) >>> 1;
            var midVal = a[mid];

            if (midVal < key)
                low = mid + 1;  // Neither val is NaN, thisVal is smaller
            else if (midVal > key)
                high = mid - 1; // Neither val is NaN, thisVal is larger
            else {
                if (midVal == key)     // Values are equal
                    return mid;             // Key found
                else if (midVal < key) // (-0.0, 0.0) or (!NaN, NaN)
                    low = mid + 1;
                else                        // (0.0, -0.0) or (NaN, !NaN)
                    high = mid - 1;
            }
        }
        return -(low + 1);  // key not found.
    }

    return {
        binarySearch: binarySearch
    }
})()