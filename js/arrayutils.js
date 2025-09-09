var ArrayUtils = (function() {

    function createArray(dims, fillValue=0) {
        return createArray0(dims, 0, fillValue);
    }

    function createArray0(dims, start, fillValue) {
        if (start == dims.length) {
            return fillValue;
        }
        var a = Array();
        for (var i = 0; i < dims[start]; i++) {
            a.push(createArray0(dims, start + 1, fillValue));
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

    function fillArray(size, value=0) {
        var a = Array();
        for (var i = 0; i < size; i++) {
            a.push(value);
        }
        return a;
    }

    function arrayToString(array) {
        return "(" + array.join(", ") + ")";
    }

    function arrayEquals(a1, a2) {
        if (a1.length != a2.length) return false;
        for (var i = 0; i < a1.length; i++) {
            if (a1[i] != a2[i]) return false;
        }
        return true;
    }

    function arrayCopy(a1, dims=1) {
        // console.log("new array: arrayCopy");
        var a2 = new Array(a1.length);
        for (var i = 0; i < a1.length; i++) {
            a2[i] = dims == 1 ? a1[i] : arrayCopy(a1[i], dims-1);
        }
        return a2;
    }

    return {
        createArray: createArray,
        getArrayValue: getArrayValue,
        setArrayValue: setArrayValue,

        fillArray: fillArray,
        arrayEquals: arrayEquals,
        arrayCopy: arrayCopy,
        arrayToString:arrayToString
    }
})();