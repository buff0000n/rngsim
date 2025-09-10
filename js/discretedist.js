// this class encapsulates the actual run data, along with some basic statistical analysis
class DiscreteDist {
    constructor() {
        // The raw data distribution.  This array represents a list of buckets, one for each possible number of
        // runs a trial took.  The value of each bucket is the total number of trials that took that number of
        // runs to complete.
        this.dist = Array();

        // The cumulative distribution.  Each bucket represents the number of trails that took less than or equal
        // to that number of runs to complete.
        this.cDist = Array();

        // In most of the cases with the time data, we don't need a bucket for each integer minute.  We just need
        // buckets for every five minute interval, or 20 minute intervals, etc.  This tracks the scaling
        // relationship between the distribution bucket indices and the actual result data.  When we get a result
        // that doesn't fit exactly into an existing bucket we will re-scale the distribution so it fits.
        // a value of 0 means the scale hasn't been initialized.  We'll initialize it when we receive the first
        // result.
        this.scale = 0;

        // sum of the runs from all the trials
        this.total = 0;

        // the smallest number of runs in any trial
        this.min = Number.MAX_SAFE_INTEGER;
        // A descriptive string from the trial with the smallest number of runs.
        this.minString = null;

        // the largest number of runs in any trial
        this.max = 0;
        // A descriptive string from the trial with the largest number of runs.
        this.maxString = null;

        // keep track of the largest bucket value
        this.maxBucketValue = -1;

        // the total number of trials.
        this.numTrials = 0;

        // statistics.  If the average is then zero it means these have not been calculated
        this.average = 0;
        this.standardDeviation;
        this.skew;
        this.kurtosis;
    }

    addResult(result, descCallback) {
        // add the result from a single trial

        // sanity check
        if (!Number.isInteger(result)) {
            throw "Invalid result: " + result;
        }

        // make sure our distribution arrays are big enough and scaled appropriately for this trial's bucket
        this.ensureScaleAndSize(result);
        var bucket = result/this.scale;
        // increment our distribution's bucket corresponding to this trial's number of runs
        this.dist[bucket] += 1;
        // track the largest bucket
        if (this.maxBucketValue < this.dist[bucket]) {
            this.maxBucketValue = this.dist[bucket];
        }
        // increment our cumulative distribution's bucket corresponding to this trial's number of runs, along with
        // every bucket greater than that.
        for (var i = bucket; i < this.cDist.length; i++) {
            this.cDist[i] += 1;
        }
        // add to our sum of all trials' runs
        this.total += result;
        // track the minimum number of runs
        if (result < this.min) {
            this.min = result;
            // store a string description of the minimum run
            this.minString = descCallback();
        }
        // max is already set by ensureSize()
        if (result >= this.max) {
            // track the maximum number of runs
            this.max = result;
            // store a string description of the maximum run
            this.maxString = descCallback();
        }
        // increment the total number of trials
        this.numTrials++;

        // reset stats
        this.average = 0;
    }

    percentileToResult(fraction) {
        // given a percentile as a fraction between 0 and 1, use our cumulative distribution to determine
        // the number of runs corresponding to that percentile.

        // determine the cutoff point in number of trials
        var lookup = Math.round(this.numTrials * fraction);
        // if the cutoff is greater or equal to the total number of trials, then it's beyond our data set
        // just return the maximum number of runs
        if (lookup >= this.numTrials) {
            return this.max;
        }
        // search for either the exact cutoff value in our cumulative distribution, or the index where the cutoff
        // value would be inserted to remain sorted.
        var i = MathUtils.binarySearch(this.cDist, lookup);

        // found the exact cutoff in our cumulative distribution, this usually doesn't happen
        if (i >= 0) {
            return this.scale * (i + 0.5);
        }

        // found an insertion point, convert back to the index
        i = -(i + 1);
        // insertion point is index 0, so just return that, this also usually doesn't happen
        if (i == 0) {
            return this.scale * (this.cDist[0] / lookup);
        }

        // i is ths insertion point, so cDist[i] > lookup, and cDist[i - 1] < lookup
        // do a linear interpolation between the two, based on how far i is from one to the other.
        // finally, multiple by the scale since it's based on the bucket index
        return this.scale * ((i - 1) + ((lookup - this.cDist[i - 1]) / (this.cDist[i] - this.cDist[i - 1])));
    }

    resultToPercentile(result) {
        // given a specific number of runs, determine how likely is is for a trial to take that number of
        // runs or fewer.  Essentially, what percentile is this result?

        // beyond the end of our data: 100%
        if (result >= this.max) {
            return 1.0;
        }
        // get the cumulative number of trials that took that number of runs or fewer, divided by the total
        // number of trials
        var trials = this.cDist[result/this.scale];
        return trials / this.numTrials;
    }

    reCalc() {
        // calculate statistics of the distribution

        // already calculated
        if (this.average != 0) {
            return;
        }

        // average is easy, the total number of runs over all trials divided by the number of trials
        this.average = (this.total) / this.numTrials;

        // standard deviation is the square root of variance, which is the second moment
        // this describes how spread out the data is from the average
        this.standardDeviation = Math.sqrt(this.moment(2));

        // skew is the third moment divided by the cube of the standard deviation
        // this describes how far away the 50th percentile is from the average
        this.skew = this.moment(3) / Math.pow(this.standardDeviation, 3);

        // kurtosis is the fourth moment divided by the 4th power of the standard deviation, minus 3 for Excess Kurtosis
        // this basically describes how many extreme outliers there are compared to a normal distribution
        this.kurtosis = this.moment(4) / Math.pow(this.standardDeviation, 4) - 3;

        // mode is the most commonly occurring result.  in our case it's the largest bucket
        // This isn't very useful for huge, varied data sets like most RNG simulator results
        this.mode = this.calcMode()
    }

    moment(m) {
        // basically, the mth moment is the average of the mth powers of the differences between each data value and the average.

        // keep a sum
        var sum = 0;
        // iterate over each data value
        for (var t = 0; t <= this.max; t+=this.scale) {
            // start with the difference from the average, which can be negative
            var d = (t - this.average);
            // raise the difference to the mth power
            var p = d;
            for (var i = 1; i < m; i++) {
                p *= d;
            }
            // add to the sum, we have to multiply by the number of results in the Tth bucket
            sum += (p * this.dist[t/this.scale]);
        }
        // divide by the number of data values for the average
        return sum / this.numTrials;
    }

    calcMode() {
        // track the current mode and its value
        var mode = 0;
        var modeValue = 0;
        // iterate over each data value
        for (var t = 1; t <= this.max; t+=this.scale) {
            var value = this.dist[t/this.scale];
            if (value > modeValue) {
                mode = t;
                modeValue = value;
            }
        }
        return mode;
    }

    ensureScaleAndSize(index) {
        if (this.scale == 0) {
            // scale is not initialized, let's start somewhere

            // ugh the first result is zero.  Let's handle this the lazy way and just set the scale to 1.
            if (index == 0) {
                this.scale = 1;

            } else {
                // initialize the scale so it contains the first result in bucket 1.
                this.scale = index;
            }

            // assuming dist and cDist are still empty
        }

        // see if we have to rescale

        if ((index % this.scale) != 0) {
            // calculate a new scale that will hold all existing buckets and the new one by just finding the
            // greatest common divisor of the current scale and the new bucket.

            var newScale = MathUtils.getGcd(index, this.scale);

            // rescale the distribution, filling new buckets with zeros
            this.dist = this.ensureScale0(this.dist, this.scale, newScale, false);

            // rescale the cumulative distribution, filling new buckets with the cumulative value before them in the array
            this.cDist = this.ensureScale0(this.cDist, this.scale, newScale, true);

            // set the new scale
            this.scale = newScale;
        }

        // make sure our dist and cumulative dist are bigh enough for the given bucket index

        // fill any added buckets of the distribution with zeros
        this.dist = this.ensureSize0(this.dist, (index/this.scale) + 1, false);

        // fill any added buckets of the cumulative distribution with the current last value
        this.cDist = this.ensureSize0(this.cDist, (index/this.scale) + 1, true);

        // update the maximum bucket
        if (index > this.max) {
            this.max = index;
        }
    }

    ensureScale0(list, scale, newScale, copyFill) {
        var multiple = scale / newScale;
        var newList = new Array();
        for (var i = 0; i < list.length; i++) {
            newList.push(list[i]);
            var fill = copyFill ? list[i] : 0;
            for (var j = 1; j < multiple; j++) {
                newList.push(fill);
            }
        }
        return newList;
    }

    ensureSize0(list, size, copyFill) {
        // if we're copying the last value in the array to fill it and there actually is a last value,
        // then use that to fill the added indices, otherwise use zero
        var fill = (copyFill && list.length > 0) ? list[list.length - 1] : 0;

        // not sure how arrays in Javascript actually work.  Does this create a new internal array each time
        // we push an element?
        while (list.length < size) {
            list.push(fill);
        }
        return list;
    }

    toString() {
        return      "total              : " + this.numTrials + "\n" +
                    "  average          : " + this.average.toFixed(2) + "\n" +
                    "  standardDeviation: " + this.standardDeviation.toFixed(2) + "\n" +
                    "  skew             : " + this.skew.toFixed(2) + "\n" +
                    "  kurtosis         : " + this.kurtosis.toFixed(2) + "\n" +
                    "  min              : " + this.min + "(" + this.dist[this.min] + ") (" + this.minString + ")\n" +
                    "  max              : " + this.max + "(" + this.dist[this.max] + ") (" + this.maxString + ")";
    }

    histogramToString() {
        var barScale = 80.0 / this.maxBucketValue;
        var bar = "|";

        var s = "";
        for (var i = 0; i < this.max; i++) {
            if (s != "") s += "\n";
            var w = Math.ceil(this.dist[i] * barScale);
            s += ("" + (i * this.scale)).padStart(10, " ") + " " + bar.repeat(w);
        }
        return s;
    }

}
