!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Kraken=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var Shim = require("./shim");
var GenericCollection = require("./generic-collection");
var GenericMap = require("./generic-map");
var PropertyChanges = require("./listen/property-changes");

// Burgled from https://github.com/domenic/dict

module.exports = Dict;
function Dict(values, getDefault) {
    if (!(this instanceof Dict)) {
        return new Dict(values, getDefault);
    }
    getDefault = getDefault || Function.noop;
    this.getDefault = getDefault;
    this.store = {};
    this.length = 0;
    this.addEach(values);
}

Dict.Dict = Dict; // hack so require("dict").Dict will work in MontageJS.

function mangle(key) {
    // Use "$" as the mangle prefix so dictionaries of valid identifiers can
    // take advantage of optimizations for objects containing only valid
    // identifiers. I have not verified that this makes a difference.
    return "$" + key;
}

function unmangle(mangled) {
    return mangled.slice(1);
}

Object.addEach(Dict.prototype, GenericCollection.prototype);
Object.addEach(Dict.prototype, GenericMap.prototype);
Object.addEach(Dict.prototype, PropertyChanges.prototype);

Dict.prototype.constructClone = function (values) {
    return new this.constructor(values, this.getDefault);
};

Dict.prototype.assertString = function (key) {
    if (typeof key !== "string") {
        throw new TypeError("key must be a string but Got " + key);
    }
}

Dict.prototype.get = function (key, defaultValue) {
    this.assertString(key);
    var mangled = mangle(key);
    if (mangled in this.store) {
        return this.store[mangled];
    } else if (arguments.length > 1) {
        return defaultValue;
    } else {
        return this.getDefault(key);
    }
};

Dict.prototype.set = function (key, value) {
    this.assertString(key);
    var mangled = mangle(key);
    if (mangled in this.store) { // update
        if (this.dispatchesBeforeMapChanges) {
            this.dispatchBeforeMapChange(key, this.store[mangled]);
        }
        this.store[mangled] = value;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange(key, value);
        }
        return false;
    } else { // create
        if (this.dispatchesMapChanges) {
            this.dispatchBeforeMapChange(key, undefined);
        }
        this.length++;
        this.store[mangled] = value;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange(key, value);
        }
        return true;
    }
};

Dict.prototype.has = function (key) {
    this.assertString(key);
    var mangled = mangle(key);
    return mangled in this.store;
};

Dict.prototype["delete"] = function (key) {
    this.assertString(key);
    var mangled = mangle(key);
    if (mangled in this.store) {
        if (this.dispatchesMapChanges) {
            this.dispatchBeforeMapChange(key, this.store[mangled]);
        }
        delete this.store[mangle(key)];
        this.length--;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange(key, undefined);
        }
        return true;
    }
    return false;
};

Dict.prototype.clear = function () {
    var key, mangled;
    for (mangled in this.store) {
        key = unmangle(mangled);
        if (this.dispatchesMapChanges) {
            this.dispatchBeforeMapChange(key, this.store[mangled]);
        }
        delete this.store[mangled];
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange(key, undefined);
        }
    }
    this.length = 0;
};

Dict.prototype.reduce = function (callback, basis, thisp) {
    for (var mangled in this.store) {
        basis = callback.call(thisp, basis, this.store[mangled], unmangle(mangled), this);
    }
    return basis;
};

Dict.prototype.reduceRight = function (callback, basis, thisp) {
    var self = this;
    var store = this.store;
    return Object.keys(this.store).reduceRight(function (basis, mangled) {
        return callback.call(thisp, basis, store[mangled], unmangle(mangled), self);
    }, basis);
};

Dict.prototype.one = function () {
    var key;
    for (key in this.store) {
        return this.store[key];
    }
};

Dict.prototype.toJSON = function () {
    return this.toObject();
};

},{"./generic-collection":4,"./generic-map":5,"./listen/property-changes":12,"./shim":20}],2:[function(require,module,exports){
"use strict";

var Shim = require("./shim");
var Set = require("./fast-set");
var GenericCollection = require("./generic-collection");
var GenericMap = require("./generic-map");
var PropertyChanges = require("./listen/property-changes");

module.exports = FastMap;

function FastMap(values, equals, hash, getDefault) {
    if (!(this instanceof FastMap)) {
        return new FastMap(values, equals, hash, getDefault);
    }
    equals = equals || Object.equals;
    hash = hash || Object.hash;
    getDefault = getDefault || Function.noop;
    this.contentEquals = equals;
    this.contentHash = hash;
    this.getDefault = getDefault;
    this.store = new Set(
        undefined,
        function keysEqual(a, b) {
            return equals(a.key, b.key);
        },
        function keyHash(item) {
            return hash(item.key);
        }
    );
    this.length = 0;
    this.addEach(values);
}

FastMap.FastMap = FastMap; // hack so require("fast-map").FastMap will work in MontageJS

Object.addEach(FastMap.prototype, GenericCollection.prototype);
Object.addEach(FastMap.prototype, GenericMap.prototype);
Object.addEach(FastMap.prototype, PropertyChanges.prototype);

FastMap.prototype.constructClone = function (values) {
    return new this.constructor(
        values,
        this.contentEquals,
        this.contentHash,
        this.getDefault
    );
};

FastMap.prototype.log = function (charmap, stringify) {
    stringify = stringify || this.stringify;
    this.store.log(charmap, stringify);
};

FastMap.prototype.stringify = function (item, leader) {
    return leader + JSON.stringify(item.key) + ": " + JSON.stringify(item.value);
}


},{"./fast-set":3,"./generic-collection":4,"./generic-map":5,"./listen/property-changes":12,"./shim":20}],3:[function(require,module,exports){
"use strict";

var Shim = require("./shim");
var Dict = require("./dict");
var List = require("./list");
var GenericCollection = require("./generic-collection");
var GenericSet = require("./generic-set");
var TreeLog = require("./tree-log");
var PropertyChanges = require("./listen/property-changes");

var object_has = Object.prototype.hasOwnProperty;

module.exports = FastSet;

function FastSet(values, equals, hash, getDefault) {
    if (!(this instanceof FastSet)) {
        return new FastSet(values, equals, hash, getDefault);
    }
    equals = equals || Object.equals;
    hash = hash || Object.hash;
    getDefault = getDefault || Function.noop;
    this.contentEquals = equals;
    this.contentHash = hash;
    this.getDefault = getDefault;
    this.buckets = new this.Buckets(null, this.Bucket);
    this.length = 0;
    this.addEach(values);
}

FastSet.FastSet = FastSet; // hack so require("fast-set").FastSet will work in MontageJS

Object.addEach(FastSet.prototype, GenericCollection.prototype);
Object.addEach(FastSet.prototype, GenericSet.prototype);
Object.addEach(FastSet.prototype, PropertyChanges.prototype);

FastSet.prototype.Buckets = Dict;
FastSet.prototype.Bucket = List;

FastSet.prototype.constructClone = function (values) {
    return new this.constructor(
        values,
        this.contentEquals,
        this.contentHash,
        this.getDefault
    );
};

FastSet.prototype.has = function (value) {
    var hash = this.contentHash(value);
    return this.buckets.get(hash).has(value);
};

FastSet.prototype.get = function (value, equals) {
    if (equals) {
        throw new Error("FastSet#get does not support second argument: equals");
    }
    var hash = this.contentHash(value);
    var buckets = this.buckets;
    if (buckets.has(hash)) {
        return buckets.get(hash).get(value);
    } else {
        return this.getDefault(value);
    }
};

FastSet.prototype["delete"] = function (value, equals) {
    if (equals) {
        throw new Error("FastSet#delete does not support second argument: equals");
    }
    var hash = this.contentHash(value);
    var buckets = this.buckets;
    if (buckets.has(hash)) {
        var bucket = buckets.get(hash);
        if (bucket["delete"](value)) {
            this.length--;
            if (bucket.length === 0) {
                buckets["delete"](hash);
            }
            return true;
        }
    }
    return false;
};

FastSet.prototype.clear = function () {
    this.buckets.clear();
    this.length = 0;
};

FastSet.prototype.add = function (value) {
    var hash = this.contentHash(value);
    var buckets = this.buckets;
    if (!buckets.has(hash)) {
        buckets.set(hash, new this.Bucket(null, this.contentEquals));
    }
    if (!buckets.get(hash).has(value)) {
        buckets.get(hash).add(value);
        this.length++;
        return true;
    }
    return false;
};

FastSet.prototype.reduce = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    var buckets = this.buckets;
    var index = 0;
    return buckets.reduce(function (basis, bucket) {
        return bucket.reduce(function (basis, value) {
            return callback.call(thisp, basis, value, index++, this);
        }, basis, this);
    }, basis, this);
};

FastSet.prototype.one = function () {
    if (this.length > 0) {
        return this.buckets.one().one();
    }
};

FastSet.prototype.iterate = function () {
    return this.buckets.values().flatten().iterate();
};

FastSet.prototype.log = function (charmap, logNode, callback, thisp) {
    charmap = charmap || TreeLog.unicodeSharp;
    logNode = logNode || this.logNode;
    if (!callback) {
        callback = console.log;
        thisp = console;
    }
    callback = callback.bind(thisp);

    var buckets = this.buckets;
    var hashes = buckets.keys();
    hashes.forEach(function (hash, index) {
        var branch;
        var leader;
        if (index === hashes.length - 1) {
            branch = charmap.fromAbove;
            leader = ' ';
        } else if (index === 0) {
            branch = charmap.branchDown;
            leader = charmap.strafe;
        } else {
            branch = charmap.fromBoth;
            leader = charmap.strafe;
        }
        var bucket = buckets.get(hash);
        callback.call(thisp, branch + charmap.through + charmap.branchDown + ' ' + hash);
        bucket.forEach(function (value, node) {
            var branch, below;
            if (node === bucket.head.prev) {
                branch = charmap.fromAbove;
                below = ' ';
            } else {
                branch = charmap.fromBoth;
                below = charmap.strafe;
            }
            var written;
            logNode(
                node,
                function (line) {
                    if (!written) {
                        callback.call(thisp, leader + ' ' + branch + charmap.through + charmap.through + line);
                        written = true;
                    } else {
                        callback.call(thisp, leader + ' ' + below + '  ' + line);
                    }
                },
                function (line) {
                    callback.call(thisp, leader + ' ' + charmap.strafe + '  ' + line);
                }
            );
        });
    });
};

FastSet.prototype.logNode = function (node, write) {
    var value = node.value;
    if (Object(value) === value) {
        JSON.stringify(value, null, 4).split("\n").forEach(function (line) {
            write(" " + line);
        });
    } else {
        write(" " + value);
    }
};


},{"./dict":1,"./generic-collection":4,"./generic-set":7,"./list":9,"./listen/property-changes":12,"./shim":20,"./tree-log":21}],4:[function(require,module,exports){
"use strict";

module.exports = GenericCollection;
function GenericCollection() {
    throw new Error("Can't construct. GenericCollection is a mixin.");
}

GenericCollection.prototype.addEach = function (values) {
    if (values && Object(values) === values) {
        if (typeof values.forEach === "function") {
            values.forEach(this.add, this);
        } else if (typeof values.length === "number") {
            // Array-like objects that do not implement forEach, ergo,
            // Arguments
            for (var i = 0; i < values.length; i++) {
                this.add(values[i], i);
            }
        } else {
            Object.keys(values).forEach(function (key) {
                this.add(values[key], key);
            }, this);
        }
    } else if (values && typeof values.length === "number") {
        // Strings
        for (var i = 0; i < values.length; i++) {
            this.add(values[i], i);
        }
    }
    return this;
};

// This is sufficiently generic for Map (since the value may be a key)
// and ordered collections (since it forwards the equals argument)
GenericCollection.prototype.deleteEach = function (values, equals) {
    values.forEach(function (value) {
        this["delete"](value, equals);
    }, this);
    return this;
};

// all of the following functions are implemented in terms of "reduce".
// some need "constructClone".

GenericCollection.prototype.forEach = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    return this.reduce(function (undefined, value, key, object, depth) {
        callback.call(thisp, value, key, object, depth);
    }, undefined);
};

GenericCollection.prototype.map = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    var result = [];
    this.reduce(function (undefined, value, key, object, depth) {
        result.push(callback.call(thisp, value, key, object, depth));
    }, undefined);
    return result;
};

GenericCollection.prototype.enumerate = function (start) {
    if (start == null) {
        start = 0;
    }
    var result = [];
    this.reduce(function (undefined, value) {
        result.push([start++, value]);
    }, undefined);
    return result;
};

GenericCollection.prototype.group = function (callback, thisp, equals) {
    equals = equals || Object.equals;
    var groups = [];
    var keys = [];
    this.forEach(function (value, key, object) {
        var key = callback.call(thisp, value, key, object);
        var index = keys.indexOf(key, equals);
        var group;
        if (index === -1) {
            group = [];
            groups.push([key, group]);
            keys.push(key);
        } else {
            group = groups[index][1];
        }
        group.push(value);
    });
    return groups;
};

GenericCollection.prototype.toArray = function () {
    return this.map(Function.identity);
};

// this depends on stringable keys, which apply to Array and Iterator
// because they have numeric keys and all Maps since they may use
// strings as keys.  List, Set, and SortedSet have nodes for keys, so
// toObject would not be meaningful.
GenericCollection.prototype.toObject = function () {
    var object = {};
    this.reduce(function (undefined, value, key) {
        object[key] = value;
    }, undefined);
    return object;
};

GenericCollection.prototype.filter = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    var result = this.constructClone();
    this.reduce(function (undefined, value, key, object, depth) {
        if (callback.call(thisp, value, key, object, depth)) {
            result.add(value, key);
        }
    }, undefined);
    return result;
};

GenericCollection.prototype.every = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    return this.reduce(function (result, value, key, object, depth) {
        return result && callback.call(thisp, value, key, object, depth);
    }, true);
};

GenericCollection.prototype.some = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    return this.reduce(function (result, value, key, object, depth) {
        return result || callback.call(thisp, value, key, object, depth);
    }, false);
};

GenericCollection.prototype.all = function () {
    return this.every(Boolean);
};

GenericCollection.prototype.any = function () {
    return this.some(Boolean);
};

GenericCollection.prototype.min = function (compare) {
    compare = compare || this.contentCompare || Object.compare;
    var first = true;
    return this.reduce(function (result, value) {
        if (first) {
            first = false;
            return value;
        } else {
            return compare(value, result) < 0 ? value : result;
        }
    }, undefined);
};

GenericCollection.prototype.max = function (compare) {
    compare = compare || this.contentCompare || Object.compare;
    var first = true;
    return this.reduce(function (result, value) {
        if (first) {
            first = false;
            return value;
        } else {
            return compare(value, result) > 0 ? value : result;
        }
    }, undefined);
};

GenericCollection.prototype.sum = function (zero) {
    zero = zero === undefined ? 0 : zero;
    return this.reduce(function (a, b) {
        return a + b;
    }, zero);
};

GenericCollection.prototype.average = function (zero) {
    var sum = zero === undefined ? 0 : zero;
    var count = zero === undefined ? 0 : zero;
    this.reduce(function (undefined, value) {
        sum += value;
        count += 1;
    }, undefined);
    return sum / count;
};

GenericCollection.prototype.concat = function () {
    var result = this.constructClone(this);
    for (var i = 0; i < arguments.length; i++) {
        result.addEach(arguments[i]);
    }
    return result;
};

GenericCollection.prototype.flatten = function () {
    var self = this;
    return this.reduce(function (result, array) {
        array.forEach(function (value) {
            this.push(value);
        }, result, self);
        return result;
    }, []);
};

GenericCollection.prototype.zip = function () {
    var table = Array.prototype.slice.call(arguments);
    table.unshift(this);
    return Array.unzip(table);
}

GenericCollection.prototype.join = function (delimiter) {
    return this.reduce(function (result, string) {
        // work-around for reduce that does not support no-basis form
        if (result === void 0) {
            return string;
        } else {
            return result + delimiter + string;
        }
    }, void 0);
};

GenericCollection.prototype.sorted = function (compare, by, order) {
    compare = compare || this.contentCompare || Object.compare;
    // account for comparators generated by Function.by
    if (compare.by) {
        by = compare.by;
        compare = compare.compare || this.contentCompare || Object.compare;
    } else {
        by = by || Function.identity;
    }
    if (order === undefined)
        order = 1;
    return this.map(function (item) {
        return {
            by: by(item),
            value: item
        };
    })
    .sort(function (a, b) {
        return compare(a.by, b.by) * order;
    })
    .map(function (pair) {
        return pair.value;
    });
};

GenericCollection.prototype.reversed = function () {
    return this.constructClone(this).reverse();
};

GenericCollection.prototype.clone = function (depth, memo) {
    if (depth === undefined) {
        depth = Infinity;
    } else if (depth === 0) {
        return this;
    }
    var clone = this.constructClone();
    this.forEach(function (value, key) {
        clone.add(Object.clone(value, depth - 1, memo), key);
    }, this);
    return clone;
};

GenericCollection.prototype.only = function () {
    if (this.length === 1) {
        return this.one();
    }
};

GenericCollection.prototype.iterator = function () {
    return this.iterate.apply(this, arguments);
};

require("./shim-array");


},{"./shim-array":16}],5:[function(require,module,exports){
"use strict";

var Object = require("./shim-object");
var MapChanges = require("./listen/map-changes");
var PropertyChanges = require("./listen/property-changes");

module.exports = GenericMap;
function GenericMap() {
    throw new Error("Can't construct. GenericMap is a mixin.");
}

Object.addEach(GenericMap.prototype, MapChanges.prototype);
Object.addEach(GenericMap.prototype, PropertyChanges.prototype);

// all of these methods depend on the constructor providing a `store` set

GenericMap.prototype.isMap = true;

GenericMap.prototype.addEach = function (values) {
    if (values && Object(values) === values) {
        if (typeof values.forEach === "function") {
            // copy map-alikes
            if (values.isMap === true) {
                values.forEach(function (value, key) {
                    this.set(key, value);
                }, this);
            // iterate key value pairs of other iterables
            } else {
                values.forEach(function (pair) {
                    this.set(pair[0], pair[1]);
                }, this);
            }
        } else if (typeof values.length === "number") {
            // Array-like objects that do not implement forEach, ergo,
            // Arguments
            for (var i = 0; i < values.length; i++) {
                this.add(values[i], i);
            }
        } else {
            // copy other objects as map-alikes
            Object.keys(values).forEach(function (key) {
                this.set(key, values[key]);
            }, this);
        }
    } else if (values && typeof values.length === "number") {
        // String
        for (var i = 0; i < values.length; i++) {
            this.add(values[i], i);
        }
    }
    return this;
}

GenericMap.prototype.get = function (key, defaultValue) {
    var item = this.store.get(new this.Item(key));
    if (item) {
        return item.value;
    } else if (arguments.length > 1) {
        return defaultValue;
    } else {
        return this.getDefault(key);
    }
};

GenericMap.prototype.set = function (key, value) {
    var item = new this.Item(key, value);
    var found = this.store.get(item);
    var grew = false;
    if (found) { // update
        if (this.dispatchesMapChanges) {
            this.dispatchBeforeMapChange(key, found.value);
        }
        found.value = value;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange(key, value);
        }
    } else { // create
        if (this.dispatchesMapChanges) {
            this.dispatchBeforeMapChange(key, undefined);
        }
        if (this.store.add(item)) {
            this.length++;
            grew = true;
        }
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange(key, value);
        }
    }
    return grew;
};

GenericMap.prototype.add = function (value, key) {
    return this.set(key, value);
};

GenericMap.prototype.has = function (key) {
    return this.store.has(new this.Item(key));
};

GenericMap.prototype['delete'] = function (key) {
    var item = new this.Item(key);
    if (this.store.has(item)) {
        var from = this.store.get(item).value;
        if (this.dispatchesMapChanges) {
            this.dispatchBeforeMapChange(key, from);
        }
        this.store["delete"](item);
        this.length--;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange(key, undefined);
        }
        return true;
    }
    return false;
};

GenericMap.prototype.clear = function () {
    var keys;
    if (this.dispatchesMapChanges) {
        this.forEach(function (value, key) {
            this.dispatchBeforeMapChange(key, value);
        }, this);
        keys = this.keys();
    }
    this.store.clear();
    this.length = 0;
    if (this.dispatchesMapChanges) {
        keys.forEach(function (key) {
            this.dispatchMapChange(key);
        }, this);
    }
};

GenericMap.prototype.reduce = function (callback, basis, thisp) {
    return this.store.reduce(function (basis, item) {
        return callback.call(thisp, basis, item.value, item.key, this);
    }, basis, this);
};

GenericMap.prototype.reduceRight = function (callback, basis, thisp) {
    return this.store.reduceRight(function (basis, item) {
        return callback.call(thisp, basis, item.value, item.key, this);
    }, basis, this);
};

GenericMap.prototype.keys = function () {
    return this.map(function (value, key) {
        return key;
    });
};

GenericMap.prototype.values = function () {
    return this.map(Function.identity);
};

GenericMap.prototype.entries = function () {
    return this.map(function (value, key) {
        return [key, value];
    });
};

// XXX deprecated
GenericMap.prototype.items = function () {
    return this.entries();
};

GenericMap.prototype.equals = function (that, equals) {
    equals = equals || Object.equals;
    if (this === that) {
        return true;
    } else if (that && typeof that.every === "function") {
        return that.length === this.length && that.every(function (value, key) {
            return equals(this.get(key), value);
        }, this);
    } else {
        var keys = Object.keys(that);
        return keys.length === this.length && Object.keys(that).every(function (key) {
            return equals(this.get(key), that[key]);
        }, this);
    }
};

GenericMap.prototype.toJSON = function () {
    return this.entries();
};

GenericMap.prototype.Item = Item;

function Item(key, value) {
    this.key = key;
    this.value = value;
}

Item.prototype.equals = function (that) {
    return Object.equals(this.key, that.key) && Object.equals(this.value, that.value);
};

Item.prototype.compare = function (that) {
    return Object.compare(this.key, that.key);
};


},{"./listen/map-changes":11,"./listen/property-changes":12,"./shim-object":18}],6:[function(require,module,exports){

var Object = require("./shim-object");

module.exports = GenericOrder;
function GenericOrder() {
    throw new Error("Can't construct. GenericOrder is a mixin.");
}

GenericOrder.prototype.equals = function (that, equals) {
    equals = equals || this.contentEquals || Object.equals;

    if (this === that) {
        return true;
    }
    if (!that) {
        return false;
    }

    var self = this;
    return (
        this.length === that.length &&
        this.zip(that).every(function (pair) {
            return equals(pair[0], pair[1]);
        })
    );
};

GenericOrder.prototype.compare = function (that, compare) {
    compare = compare || this.contentCompare || Object.compare;

    if (this === that) {
        return 0;
    }
    if (!that) {
        return 1;
    }

    var length = Math.min(this.length, that.length);
    var comparison = this.zip(that).reduce(function (comparison, pair, index) {
        if (comparison === 0) {
            if (index >= length) {
                return comparison;
            } else {
                return compare(pair[0], pair[1]);
            }
        } else {
            return comparison;
        }
    }, 0);
    if (comparison === 0) {
        return this.length - that.length;
    }
    return comparison;
};

GenericOrder.prototype.toJSON = function () {
    return this.toArray();
};

},{"./shim-object":18}],7:[function(require,module,exports){

module.exports = GenericSet;
function GenericSet() {
    throw new Error("Can't construct. GenericSet is a mixin.");
}

GenericSet.prototype.isSet = true;

GenericSet.prototype.union = function (that) {
    var union =  this.constructClone(this);
    union.addEach(that);
    return union;
};

GenericSet.prototype.intersection = function (that) {
    return this.constructClone(this.filter(function (value) {
        return that.has(value);
    }));
};

GenericSet.prototype.difference = function (that) {
    var union =  this.constructClone(this);
    union.deleteEach(that);
    return union;
};

GenericSet.prototype.symmetricDifference = function (that) {
    var union = this.union(that);
    var intersection = this.intersection(that);
    return union.difference(intersection);
};

GenericSet.prototype.deleteAll = function (value) {
    // deleteAll is equivalent to delete for sets since they guarantee that
    // only one value exists for an equivalence class, but deleteAll returns
    // the count of deleted values instead of whether a value was deleted.
    return +this["delete"](value);
};

GenericSet.prototype.equals = function (that, equals) {
    var self = this;
    return (
        that && typeof that.reduce === "function" &&
        this.length === that.length &&
        that.reduce(function (equal, value) {
            return equal && self.has(value, equals);
        }, true)
    );
};

GenericSet.prototype.toJSON = function () {
    return this.toArray();
};

// W3C DOMTokenList API overlap (does not handle variadic arguments)

GenericSet.prototype.contains = function (value) {
    return this.has(value);
};

GenericSet.prototype.remove = function (value) {
    return this["delete"](value);
};

GenericSet.prototype.toggle = function (value) {
    if (this.has(value)) {
        this["delete"](value);
    } else {
        this.add(value);
    }
};


},{}],8:[function(require,module,exports){

// Adapted from Eloquent JavaScript by Marijn Haverbeke
// http://eloquentjavascript.net/appendix2.html

var ArrayChanges = require("./listen/array-changes");
var Shim = require("./shim");
var GenericCollection = require("./generic-collection");
var MapChanges = require("./listen/map-changes");
var RangeChanges = require("./listen/range-changes");
var PropertyChanges = require("./listen/property-changes");

// Max Heap by default.  Comparison can be reversed to produce a Min Heap.

module.exports = Heap;

function Heap(values, equals, compare) {
    if (!(this instanceof Heap)) {
        return new Heap(values, equals, compare);
    }
    this.contentEquals = equals || Object.equals;
    this.contentCompare = compare || Object.compare;
    this.content = [];
    this.length = 0;
    this.addEach(values);
}

Heap.Heap = Heap; // hack so require("heap").Heap will work in MontageJS

Object.addEach(Heap.prototype, GenericCollection.prototype);
Object.addEach(Heap.prototype, PropertyChanges.prototype);
Object.addEach(Heap.prototype, RangeChanges.prototype);
Object.addEach(Heap.prototype, MapChanges.prototype);

Heap.prototype.constructClone = function (values) {
    return new this.constructor(
        values,
        this.contentEquals,
        this.contentCompare
    );
};

// TODO variadic
Heap.prototype.push = function (value) {
    this.content.push(value);
    this.float(this.content.length - 1);
    this.length++;
};

Heap.prototype.pop = function () {
    // Store the first value so we can return it later.  This will leave a gap
    // at index 0 that must be filled.
    var result = this.content[0];
    // Remove the value at the end of the array.  The value most be removed
    // from the end to preserve the completness of the tree, despite that the
    // last child is also among the most likely to need to sink back to the
    // bottom.
    var top = this.content.pop();
    // If there are any values remaining, put the last value on the top and
    // let it sink back down.
    if (this.content.length > 0) {
        this.content.set(0, top);
        this.sink(0);
    }
    this.length--;
    return result;
};

Heap.prototype.add = function (value) {
    this.push(value);
};

// indexOf must do a linear search since a binary heap does not preserve a
// strict sort order.  Thus, deletion takes linear time for all values except
// for the max value.

Heap.prototype.indexOf = function (value) {
    for (var index = 0; index < this.length; index++) {
        if (this.contentEquals(this.content[index], value)) {
            return index;
        }
    }
    return -1;
};

Heap.prototype["delete"] = function (value, equals) {
    if (equals) {
        throw new Error("Heap#delete does not support second argument: equals");
    }
    var index = this.indexOf(value);
    if (index === -1)
        return false;
    var top = this.content.pop();
    this.length = this.content.length;
    if (index === this.content.length)
        return true;
    this.content.set(index, top);
    var comparison = this.contentCompare(top, value);
    if (comparison > 0) {
        this.float(index);
    } else if (comparison < 0) {
        this.sink(index);
    }
    return true;
};

Heap.prototype.peek = function () {
    if (this.length) {
        return this.content[0];
    }
};

Heap.prototype.max = function () {
    return this.peek();
};

Heap.prototype.one = function () {
    return this.peek();
};

// Brings a value up until its parent is greater than it
Heap.prototype.float = function (index) {
    // Grab the value that is being adjusted
    var value = this.content[index];
    // A value can go no higher that the top: index 0
    while (index > 0) {
        // Compute the parent value's index and fetch it
        var parentIndex = Math.floor((index + 1) / 2) - 1;
        var parent = this.content[parentIndex];
        // If the parent is less than it
        if (this.contentCompare(parent, value) < 0) {
            this.content.set(parentIndex, value);
            this.content.set(index, parent);
        } else {
            // Stop propagating if the parent is greater than the value.
            break;
        }
        // Proceed upward
        index = parentIndex;
    }
};

// Brings a value down until its children are both less than it
Heap.prototype.sink = function (index) {
    // Moves a value downward until it is greater than its children.
    var length = this.content.length;
    var value = this.content[index];
    var left, right, leftIndex, rightIndex, swapIndex, needsSwap;

    while (true) {
        // Invariant: the value is at index.
        // Variant: the index proceedes down the tree.

        // Compute the indicies of the children.
        rightIndex = (index + 1) * 2;
        leftIndex = rightIndex - 1;

        // If the left child exists, determine whether it is greater than the
        // parent (value) and thus whether it can be floated upward.
        needsSwap = false;
        if (leftIndex < length) {
            // Look it up and compare it.
            var left = this.content[leftIndex];
            var comparison = this.contentCompare(left, value);
            // If the child is greater than the parent, it can be floated.
            if (comparison > 0) {
                swapIndex = leftIndex;
                needsSwap = true;
            }
        }

        // If the right child exists, determine whether it is greater than the
        // parent (value), or even greater than the left child.
        if (rightIndex < length) {
            var right = this.content[rightIndex];
            var comparison = this.contentCompare(right, needsSwap ? left : value);
            if (comparison > 0) {
                swapIndex = rightIndex;
                needsSwap = true;
            }
        }

        // if there is a child that is less than the value, float the child and
        // sink the value.
        if (needsSwap) {
            this.content.set(index, this.content[swapIndex]);
            this.content.set(swapIndex, value);
            index = swapIndex;
            // and continue sinking
        } else {
            // if the children are both less than the value
            break;
        }

    }

};

Heap.prototype.clear = function () {
    this.content.clear();
    this.length = 0;
};

Heap.prototype.reduce = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    return this.content.reduce(function (basis, value, key) {
        return callback.call(thisp, basis, value, key, this);
    }, basis, this);
};

Heap.prototype.reduceRight = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    return this.content.reduceRight(function (basis, value, key) {
        return callback.call(thisp, basis, value, key, this);
    }, basis, this);
};

Heap.prototype.toJSON = function () {
    return this.toArray();
};

Heap.prototype.makeObservable = function () {
    // TODO refactor dispatchers to allow direct forwarding
    this.content.addRangeChangeListener(this, "content");
    this.content.addBeforeRangeChangeListener(this, "content");
    this.content.addMapChangeListener(this, "content");
    this.content.addBeforeMapChangeListener(this, "content");
};

Heap.prototype.handleContentRangeChange = function (plus, minus, index) {
    this.dispatchRangeChange(plus, minus, index);
};

Heap.prototype.handleContentRangeWillChange = function (plus, minus, index) {
    this.dispatchBeforeRangeChange(plus, minus, index);
};

Heap.prototype.handleContentMapChange = function (value, key) {
    this.dispatchMapChange(key, value);
};

Heap.prototype.handleContentMapWillChange = function (value, key) {
    this.dispatchBeforeMapChange(key, value);
};


},{"./generic-collection":4,"./listen/array-changes":10,"./listen/map-changes":11,"./listen/property-changes":12,"./listen/range-changes":13,"./shim":20}],9:[function(require,module,exports){
"use strict";

module.exports = List;

var Shim = require("./shim");
var GenericCollection = require("./generic-collection");
var GenericOrder = require("./generic-order");
var PropertyChanges = require("./listen/property-changes");
var RangeChanges = require("./listen/range-changes");

function List(values, equals, getDefault) {
    if (!(this instanceof List)) {
        return new List(values, equals, getDefault);
    }
    var head = this.head = new this.Node();
    head.next = head;
    head.prev = head;
    this.contentEquals = equals || Object.equals;
    this.getDefault = getDefault || Function.noop;
    this.length = 0;
    this.addEach(values);
}

List.List = List; // hack so require("list").List will work in MontageJS

Object.addEach(List.prototype, GenericCollection.prototype);
Object.addEach(List.prototype, GenericOrder.prototype);
Object.addEach(List.prototype, PropertyChanges.prototype);
Object.addEach(List.prototype, RangeChanges.prototype);

List.prototype.constructClone = function (values) {
    return new this.constructor(values, this.contentEquals, this.getDefault);
};

List.prototype.find = function (value, equals, index) {
    equals = equals || this.contentEquals;
    var head = this.head;
    var at = this.scan(index, head.next);
    while (at !== head) {
        if (equals(at.value, value)) {
            return at;
        }
        at = at.next;
    }
};

List.prototype.findLast = function (value, equals, index) {
    equals = equals || this.contentEquals;
    var head = this.head;
    var at = this.scan(index, head.prev);
    while (at !== head) {
        if (equals(at.value, value)) {
            return at;
        }
        at = at.prev;
    }
};

List.prototype.has = function (value, equals) {
    return !!this.find(value, equals);
};

List.prototype.get = function (value, equals) {
    var found = this.find(value, equals);
    if (found) {
        return found.value;
    }
    return this.getDefault(value);
};

// LIFO (delete removes the most recently added equivalent value)
List.prototype["delete"] = function (value, equals) {
    var found = this.findLast(value, equals);
    if (found) {
        if (this.dispatchesRangeChanges) {
            var plus = [];
            var minus = [value];
            this.dispatchBeforeRangeChange(plus, minus, found.index);
        }
        found["delete"]();
        this.length--;
        if (this.dispatchesRangeChanges) {
            this.updateIndexes(found.next, found.index);
            this.dispatchRangeChange(plus, minus, found.index);
        }
        return true;
    }
    return false;
};

List.prototype.deleteAll = function (value, equals) {
    equals = equals || this.contentEquals;
    var head = this.head;
    var at = head.next;
    var count = 0;
    while (at !== head) {
        if (equals(value, at.value)) {
            at["delete"]();
            count++;
        }
        at = at.next;
    }
    this.length -= count;
    return count;
};

List.prototype.clear = function () {
    var plus, minus;
    if (this.dispatchesRangeChanges) {
        minus = this.toArray();
        plus = [];
        this.dispatchBeforeRangeChange(plus, minus, 0);
    }
    this.head.next = this.head.prev = this.head;
    this.length = 0;
    if (this.dispatchesRangeChanges) {
        this.dispatchRangeChange(plus, minus, 0);
    }
};

List.prototype.add = function (value) {
    var node = new this.Node(value)
    if (this.dispatchesRangeChanges) {
        node.index = this.length;
        this.dispatchBeforeRangeChange([value], [], node.index);
    }
    this.head.addBefore(node);
    this.length++;
    if (this.dispatchesRangeChanges) {
        this.dispatchRangeChange([value], [], node.index);
    }
    return true;
};

List.prototype.push = function () {
    var head = this.head;
    if (this.dispatchesRangeChanges) {
        var plus = Array.prototype.slice.call(arguments);
        var minus = []
        var index = this.length;
        this.dispatchBeforeRangeChange(plus, minus, index);
        var start = this.head.prev;
    }
    for (var i = 0; i < arguments.length; i++) {
        var value = arguments[i];
        var node = new this.Node(value);
        head.addBefore(node);
    }
    this.length += arguments.length;
    if (this.dispatchesRangeChanges) {
        this.updateIndexes(start.next, start.index === undefined ? 0 : start.index + 1);
        this.dispatchRangeChange(plus, minus, index);
    }
};

List.prototype.unshift = function () {
    if (this.dispatchesRangeChanges) {
        var plus = Array.prototype.slice.call(arguments);
        var minus = [];
        this.dispatchBeforeRangeChange(plus, minus, 0);
    }
    var at = this.head;
    for (var i = 0; i < arguments.length; i++) {
        var value = arguments[i];
        var node = new this.Node(value);
        at.addAfter(node);
        at = node;
    }
    this.length += arguments.length;
    if (this.dispatchesRangeChanges) {
        this.updateIndexes(this.head.next, 0);
        this.dispatchRangeChange(plus, minus, 0);
    }
};

List.prototype.pop = function () {
    var value;
    var head = this.head;
    if (head.prev !== head) {
        value = head.prev.value;
        if (this.dispatchesRangeChanges) {
            var plus = [];
            var minus = [value];
            var index = this.length - 1;
            this.dispatchBeforeRangeChange(plus, minus, index);
        }
        head.prev['delete']();
        this.length--;
        if (this.dispatchesRangeChanges) {
            this.dispatchRangeChange(plus, minus, index);
        }
    }
    return value;
};

List.prototype.shift = function () {
    var value;
    var head = this.head;
    if (head.prev !== head) {
        value = head.next.value;
        if (this.dispatchesRangeChanges) {
            var plus = [];
            var minus = [value];
            this.dispatchBeforeRangeChange(plus, minus, 0);
        }
        head.next['delete']();
        this.length--;
        if (this.dispatchesRangeChanges) {
            this.updateIndexes(this.head.next, 0);
            this.dispatchRangeChange(plus, minus, 0);
        }
    }
    return value;
};

List.prototype.peek = function () {
    if (this.head !== this.head.next) {
        return this.head.next.value;
    }
};

List.prototype.poke = function (value) {
    if (this.head !== this.head.next) {
        this.head.next.value = value;
    } else {
        this.push(value);
    }
};

List.prototype.one = function () {
    return this.peek();
};

// TODO
// List.prototype.indexOf = function (value) {
// };

// TODO
// List.prototype.lastIndexOf = function (value) {
// };

// an internal utility for coercing index offsets to nodes
List.prototype.scan = function (at, fallback) {
    var head = this.head;
    if (typeof at === "number") {
        var count = at;
        if (count >= 0) {
            at = head.next;
            while (count) {
                count--;
                at = at.next;
                if (at == head) {
                    break;
                }
            }
        } else {
            at = head;
            while (count < 0) {
                count++;
                at = at.prev;
                if (at == head) {
                    break;
                }
            }
        }
        return at;
    } else {
        return at || fallback;
    }
};

// at and end may both be positive or negative numbers (in which cases they
// correspond to numeric indicies, or nodes)
List.prototype.slice = function (at, end) {
    var sliced = [];
    var head = this.head;
    at = this.scan(at, head.next);
    end = this.scan(end, head);

    while (at !== end && at !== head) {
        sliced.push(at.value);
        at = at.next;
    }

    return sliced;
};

List.prototype.splice = function (at, length /*...plus*/) {
    return this.swap(at, length, Array.prototype.slice.call(arguments, 2));
};

List.prototype.swap = function (start, length, plus) {
    var initial = start;
    // start will be head if start is null or -1 (meaning from the end), but
    // will be head.next if start is 0 (meaning from the beginning)
    start = this.scan(start, this.head);
    if (length == null) {
        length = Infinity;
    }
    plus = Array.from(plus);

    // collect the minus array
    var minus = [];
    var at = start;
    while (length-- && length >= 0 && at !== this.head) {
        minus.push(at.value);
        at = at.next;
    }

    // before range change
    var index, startNode;
    if (this.dispatchesRangeChanges) {
        if (start === this.head) {
            index = this.length;
        } else if (start.prev === this.head) {
            index = 0;
        } else {
            index = start.index;
        }
        startNode = start.prev;
        this.dispatchBeforeRangeChange(plus, minus, index);
    }

    // delete minus
    var at = start;
    for (var i = 0, at = start; i < minus.length; i++, at = at.next) {
        at["delete"]();
    }
    // add plus
    if (initial == null && at === this.head) {
        at = this.head.next;
    }
    for (var i = 0; i < plus.length; i++) {
        var node = new this.Node(plus[i]);
        at.addBefore(node);
    }
    // adjust length
    this.length += plus.length - minus.length;

    // after range change
    if (this.dispatchesRangeChanges) {
        if (start === this.head) {
            this.updateIndexes(this.head.next, 0);
        } else {
            this.updateIndexes(startNode.next, startNode.index + 1);
        }
        this.dispatchRangeChange(plus, minus, index);
    }

    return minus;
};

List.prototype.reverse = function () {
    if (this.dispatchesRangeChanges) {
        var minus = this.toArray();
        var plus = minus.reversed();
        this.dispatchBeforeRangeChange(plus, minus, 0);
    }
    var at = this.head;
    do {
        var temp = at.next;
        at.next = at.prev;
        at.prev = temp;
        at = at.next;
    } while (at !== this.head);
    if (this.dispatchesRangeChanges) {
        this.dispatchRangeChange(plus, minus, 0);
    }
    return this;
};

List.prototype.sort = function () {
    this.swap(0, this.length, this.sorted());
};

// TODO account for missing basis argument
List.prototype.reduce = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    var head = this.head;
    var at = head.next;
    while (at !== head) {
        basis = callback.call(thisp, basis, at.value, at, this);
        at = at.next;
    }
    return basis;
};

List.prototype.reduceRight = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    var head = this.head;
    var at = head.prev;
    while (at !== head) {
        basis = callback.call(thisp, basis, at.value, at, this);
        at = at.prev;
    }
    return basis;
};

List.prototype.updateIndexes = function (node, index) {
    while (node !== this.head) {
        node.index = index++;
        node = node.next;
    }
};

List.prototype.makeObservable = function () {
    this.head.index = -1;
    this.updateIndexes(this.head.next, 0);
    this.dispatchesRangeChanges = true;
};

List.prototype.iterate = function () {
    return new ListIterator(this.head);
};

function ListIterator(head) {
    this.head = head;
    this.at = head.next;
};

ListIterator.prototype.next = function () {
    if (this.at === this.head) {
        throw StopIteration;
    } else {
        var value = this.at.value;
        this.at = this.at.next;
        return value;
    }
};

List.prototype.Node = Node;

function Node(value) {
    this.value = value;
    this.prev = null;
    this.next = null;
};

Node.prototype["delete"] = function () {
    this.prev.next = this.next;
    this.next.prev = this.prev;
};

Node.prototype.addBefore = function (node) {
    var prev = this.prev;
    this.prev = node;
    node.prev = prev;
    prev.next = node;
    node.next = this;
};

Node.prototype.addAfter = function (node) {
    var next = this.next;
    this.next = node;
    node.next = next;
    next.prev = node;
    node.prev = this;
};


},{"./generic-collection":4,"./generic-order":6,"./listen/property-changes":12,"./listen/range-changes":13,"./shim":20}],10:[function(require,module,exports){
/*
    Based in part on observable arrays from Motorola Mobility’s Montage
    Copyright (c) 2012, Motorola Mobility LLC. All Rights Reserved.
    3-Clause BSD License
    https://github.com/motorola-mobility/montage/blob/master/LICENSE.md
*/

/*
    This module is responsible for observing changes to owned properties of
    objects and changes to the content of arrays caused by method calls.
    The interface for observing array content changes establishes the methods
    necessary for any collection with observable content.
*/

require("../shim");
var List = require("../list");
var WeakMap = require("weak-map");
var PropertyChanges = require("./property-changes");
var RangeChanges = require("./range-changes");
var MapChanges = require("./map-changes");

var array_splice = Array.prototype.splice;
var array_slice = Array.prototype.slice;
var array_reverse = Array.prototype.reverse;
var array_sort = Array.prototype.sort;
var array_swap = Array.prototype.swap;

var EMPTY_ARRAY = [];

// use different strategies for making arrays observable between Internet
// Explorer and other browsers.
var protoIsSupported = {}.__proto__ === Object.prototype;
var array_makeObservable;
if (protoIsSupported) {
    array_makeObservable = function () {
        this.__proto__ = ChangeDispatchArray;
    };
} else {
    array_makeObservable = function () {
        Object.defineProperties(this, observableArrayProperties);
    };
}

Object.defineProperty(Array.prototype, "makeObservable", {
    value: array_makeObservable,
    writable: true,
    configurable: true,
    enumerable: false
});

function defineEach(prototype) {
    for (var name in prototype) {
        Object.defineProperty(Array.prototype, name, {
            value: prototype[name],
            writable: true,
            configurable: true,
            enumerable: false
        });
    }
}

defineEach(PropertyChanges.prototype);
defineEach(RangeChanges.prototype);
defineEach(MapChanges.prototype);

var observableArrayProperties = {

    isObservable: {
        value: true,
        writable: true,
        configurable: true
    },

    makeObservable: {
        value: Function.noop, // idempotent
        writable: true,
        configurable: true
    },

    reverse: {
        value: function reverse() {

            var reversed = this.constructClone(this);
            reversed.reverse();
            this.swap(0, this.length, reversed);

            return this;
        },
        writable: true,
        configurable: true
    },

    sort: {
        value: function sort() {

            // dispatch before change events
            this.dispatchBeforeRangeChange(this, this, 0);
            for (var i = 0; i < this.length; i++) {
                PropertyChanges.dispatchBeforeOwnPropertyChange(this, i, this[i]);
                this.dispatchBeforeMapChange(i, this[i]);
            }

            // actual work
            array_sort.apply(this, arguments);

            // dispatch after change events
            for (var i = 0; i < this.length; i++) {
                PropertyChanges.dispatchOwnPropertyChange(this, i, this[i]);
                this.dispatchMapChange(i, this[i]);
            }
            this.dispatchRangeChange(this, this, 0);

            return this;
        },
        writable: true,
        configurable: true
    },

    swap: {
        value: function swap(start, length, plus) {
            if (plus) {
                if (!Array.isArray(plus)) {
                    plus = array_slice.call(plus);
                }
            } else {
                plus = EMPTY_ARRAY;
            }

            if (start < 0) {
                start = this.length + start;
            } else if (start > this.length) {
                var holes = start - this.length;
                var newPlus = Array(holes + plus.length);
                for (var i = 0, j = holes; i < plus.length; i++, j++) {
                    if (i in plus) {
                        newPlus[j] = plus[i];
                    }
                }
                plus = newPlus;
                start = this.length;
            }

            var minus;
            if (length === 0) {
                // minus will be empty
                if (plus.length === 0) {
                    // at this point if plus is empty there is nothing to do.
                    return []; // [], but spare us an instantiation
                }
                minus = EMPTY_ARRAY;
            } else {
                minus = array_slice.call(this, start, start + length);
            }
            var diff = plus.length - minus.length;
            var oldLength = this.length;
            var newLength = Math.max(this.length + diff, start + plus.length);
            var longest = Math.max(oldLength, newLength);

            // dispatch before change events
            if (diff) {
                PropertyChanges.dispatchBeforeOwnPropertyChange(this, "length", this.length);
            }
            this.dispatchBeforeRangeChange(plus, minus, start);
            if (diff === 0) { // substring replacement
                for (var i = start; i < start + plus.length; i++) {
                    PropertyChanges.dispatchBeforeOwnPropertyChange(this, i, this[i]);
                    this.dispatchBeforeMapChange(i, this[i]);
                }
            } else if (PropertyChanges.hasOwnPropertyChangeDescriptor(this)) {
                // all subsequent values changed or shifted.
                // avoid (longest - start) long walks if there are no
                // registered descriptors.
                for (var i = start; i < longest; i++) {
                    PropertyChanges.dispatchBeforeOwnPropertyChange(this, i, this[i]);
                    this.dispatchBeforeMapChange(i, this[i]);
                }
            }

            // actual work
            if (start > oldLength) {
                this.length = start;
            }
            var result = array_swap.call(this, start, length, plus);

            // dispatch after change events
            if (diff === 0) { // substring replacement
                for (var i = start; i < start + plus.length; i++) {
                    PropertyChanges.dispatchOwnPropertyChange(this, i, this[i]);
                    this.dispatchMapChange(i, this[i]);
                }
            } else if (PropertyChanges.hasOwnPropertyChangeDescriptor(this)) {
                // all subsequent values changed or shifted.
                // avoid (longest - start) long walks if there are no
                // registered descriptors.
                for (var i = start; i < longest; i++) {
                    PropertyChanges.dispatchOwnPropertyChange(this, i, this[i]);
                    this.dispatchMapChange(i, this[i]);
                }
            }
            this.dispatchRangeChange(plus, minus, start);
            if (diff) {
                PropertyChanges.dispatchOwnPropertyChange(this, "length", this.length);
            }

            return result;
        },
        writable: true,
        configurable: true
    },

    splice: {
        value: function splice(start, length) {
            // start parameter should be min(start, this.length)
            // http://www.ecma-international.org/ecma-262/5.1/#sec-15.4.4.12
            if (start > this.length) {
                start = this.length;
            }
            return this.swap.call(this, start, length, array_slice.call(arguments, 2));
        },
        writable: true,
        configurable: true
    },

    // splice is the array content change utility belt.  forward all other
    // content changes to splice so we only have to write observer code in one
    // place

    set: {
        value: function set(index, value) {
            this.swap(index, index >= this.length ? 0 : 1, [value]);
            return true;
        },
        writable: true,
        configurable: true
    },

    shift: {
        value: function shift() {
            return this.splice(0, 1)[0];
        },
        writable: true,
        configurable: true
    },

    pop: {
        value: function pop() {
            if (this.length) {
                return this.splice(this.length - 1, 1)[0];
            }
        },
        writable: true,
        configurable: true
    },

    push: {
        value: function push(arg) {
            if (arguments.length === 1) {
                return this.splice(this.length, 0, arg);
            } else {
                var args = array_slice.call(arguments);
                return this.swap(this.length, 0, args);
            }
        },
        writable: true,
        configurable: true
    },

    unshift: {
        value: function unshift(arg) {
            if (arguments.length === 1) {
                return this.splice(0, 0, arg);
            } else {
                var args = array_slice.call(arguments);
                return this.swap(0, 0, args);
            }
        },
        writable: true,
        configurable: true
    },

    clear: {
        value: function clear() {
            return this.splice(0, this.length);
        },
        writable: true,
        configurable: true
    }

};

var ChangeDispatchArray = Object.create(Array.prototype, observableArrayProperties);


},{"../list":9,"../shim":20,"./map-changes":11,"./property-changes":12,"./range-changes":13,"weak-map":14}],11:[function(require,module,exports){
"use strict";

var WeakMap = require("weak-map");
var List = require("../list");

module.exports = MapChanges;
function MapChanges() {
    throw new Error("Can't construct. MapChanges is a mixin.");
}

var object_owns = Object.prototype.hasOwnProperty;

/*
    Object map change descriptors carry information necessary for adding,
    removing, dispatching, and shorting events to listeners for map changes
    for a particular key on a particular object.  These descriptors are used
    here for shallow map changes.

    {
        willChangeListeners:Array(Function)
        changeListeners:Array(Function)
    }
*/

var mapChangeDescriptors = new WeakMap();

MapChanges.prototype.getAllMapChangeDescriptors = function () {
    var Dict = require("../dict");
    if (!mapChangeDescriptors.has(this)) {
        mapChangeDescriptors.set(this, Dict());
    }
    return mapChangeDescriptors.get(this);
};

MapChanges.prototype.getMapChangeDescriptor = function (token) {
    var tokenChangeDescriptors = this.getAllMapChangeDescriptors();
    token = token || "";
    if (!tokenChangeDescriptors.has(token)) {
        tokenChangeDescriptors.set(token, {
            willChangeListeners: new List(),
            changeListeners: new List()
        });
    }
    return tokenChangeDescriptors.get(token);
};

MapChanges.prototype.addMapChangeListener = function (listener, token, beforeChange) {
    if (!this.isObservable && this.makeObservable) {
        // for Array
        this.makeObservable();
    }
    var descriptor = this.getMapChangeDescriptor(token);
    var listeners;
    if (beforeChange) {
        listeners = descriptor.willChangeListeners;
    } else {
        listeners = descriptor.changeListeners;
    }
    listeners.push(listener);
    Object.defineProperty(this, "dispatchesMapChanges", {
        value: true,
        writable: true,
        configurable: true,
        enumerable: false
    });

    var self = this;
    return function cancelMapChangeListener() {
        if (!self) {
            // TODO throw new Error("Can't remove map change listener again");
            return;
        }
        self.removeMapChangeListener(listener, token, beforeChange);
        self = null;
    };
};

MapChanges.prototype.removeMapChangeListener = function (listener, token, beforeChange) {
    var descriptor = this.getMapChangeDescriptor(token);

    var listeners;
    if (beforeChange) {
        listeners = descriptor.willChangeListeners;
    } else {
        listeners = descriptor.changeListeners;
    }

    var node = listeners.findLast(listener);
    if (!node) {
        throw new Error("Can't remove map change listener: does not exist: token " + JSON.stringify(token));
    }
    node["delete"]();
};

MapChanges.prototype.dispatchMapChange = function (key, value, beforeChange) {
    var descriptors = this.getAllMapChangeDescriptors();
    var changeName = "Map" + (beforeChange ? "WillChange" : "Change");
    descriptors.forEach(function (descriptor, token) {

        if (descriptor.isActive) {
            return;
        } else {
            descriptor.isActive = true;
        }

        var listeners;
        if (beforeChange) {
            listeners = descriptor.willChangeListeners;
        } else {
            listeners = descriptor.changeListeners;
        }

        var tokenName = "handle" + (
            token.slice(0, 1).toUpperCase() +
            token.slice(1)
        ) + changeName;

        try {
            // dispatch to each listener
            listeners.forEach(function (listener) {
                if (listener[tokenName]) {
                    listener[tokenName](value, key, this);
                } else if (listener.call) {
                    listener.call(listener, value, key, this);
                } else {
                    throw new Error("Handler " + listener + " has no method " + tokenName + " and is not callable");
                }
            }, this);
        } finally {
            descriptor.isActive = false;
        }

    }, this);
};

MapChanges.prototype.addBeforeMapChangeListener = function (listener, token) {
    return this.addMapChangeListener(listener, token, true);
};

MapChanges.prototype.removeBeforeMapChangeListener = function (listener, token) {
    return this.removeMapChangeListener(listener, token, true);
};

MapChanges.prototype.dispatchBeforeMapChange = function (key, value) {
    return this.dispatchMapChange(key, value, true);
};


},{"../dict":1,"../list":9,"weak-map":14}],12:[function(require,module,exports){
/*
    Based in part on observable arrays from Motorola Mobility’s Montage
    Copyright (c) 2012, Motorola Mobility LLC. All Rights Reserved.
    3-Clause BSD License
    https://github.com/motorola-mobility/montage/blob/master/LICENSE.md
*/

/*
    This module is responsible for observing changes to owned properties of
    objects and changes to the content of arrays caused by method calls.
    The interface for observing array content changes establishes the methods
    necessary for any collection with observable content.
*/

require("../shim");

var object_owns = Object.prototype.hasOwnProperty;

// Object property descriptors carry information necessary for adding,
// removing, dispatching, and shorting events to listeners for property changes
// for a particular key on a particular object.  These descriptors are used
// here for shallow property changes.  The current listeners are the ones
// modified by add and remove own property change listener methods.  During
// property change dispatch, we capture a snapshot of the current listeners in
// the active change listeners array.  The descriptor also keeps a memo of the
// corresponding handler method names.
//
// {
//     willChangeListeners:{current, active:Array<Function>, ...method names}
//     changeListeners:{current, active:Array<Function>, ...method names}
// }

// Maybe remove entries from this table if the corresponding object no longer
// has any property change listeners for any key.  However, the cost of
// book-keeping is probably not warranted since it would be rare for an
// observed object to no longer be observed unless it was about to be disposed
// of or reused as an observable.  The only benefit would be in avoiding bulk
// calls to dispatchOwnPropertyChange events on objects that have no listeners.

//  To observe shallow property changes for a particular key of a particular
//  object, we install a property descriptor on the object that overrides the previous
//  descriptor.  The overridden descriptors are stored in this weak map.  The
//  weak map associates an object with another object that maps property names
//  to property descriptors.
//
//  object.__overriddenPropertyDescriptors__[key]
//
//  We retain the old descriptor for various purposes.  For one, if the property
//  is no longer being observed by anyone, we revert the property descriptor to
//  the original.  For "value" descriptors, we store the actual value of the
//  descriptor on the overridden descriptor, so when the property is reverted, it
//  retains the most recently set value.  For "get" and "set" descriptors,
//  we observe then forward "get" and "set" operations to the original descriptor.

module.exports = PropertyChanges;

function PropertyChanges() {
    throw new Error("This is an abstract interface. Mix it. Don't construct it");
}

PropertyChanges.debug = true;

PropertyChanges.prototype.getOwnPropertyChangeDescriptor = function (key) {
    if (!this.__propertyChangeListeners__) {
        Object.defineProperty(this, "__propertyChangeListeners__", {
            value: {},
            enumerable: false,
            configurable: true,
            writable: true
        });
    }
    var objectPropertyChangeDescriptors = this.__propertyChangeListeners__;
    if (!object_owns.call(objectPropertyChangeDescriptors, key)) {
        var propertyName = String(key);
        propertyName = propertyName && propertyName[0].toUpperCase() + propertyName.slice(1);
        objectPropertyChangeDescriptors[key] = {
            willChangeListeners: {
                current: [],
                active: [],
                specificHandlerMethodName: "handle" + propertyName + "WillChange",
                genericHandlerMethodName: "handlePropertyWillChange"
            },
            changeListeners: {
                current: [],
                active: [],
                specificHandlerMethodName: "handle" + propertyName + "Change",
                genericHandlerMethodName: "handlePropertyChange"
            }
        };
    }
    return objectPropertyChangeDescriptors[key];
};

PropertyChanges.prototype.hasOwnPropertyChangeDescriptor = function (key) {
    if (!this.__propertyChangeListeners__) {
        return false;
    }
    if (!key) {
        return true;
    }
    var objectPropertyChangeDescriptors = this.__propertyChangeListeners__;
    if (!object_owns.call(objectPropertyChangeDescriptors, key)) {
        return false;
    }
    return true;
};

PropertyChanges.prototype.addOwnPropertyChangeListener = function (key, listener, beforeChange) {
    if (this.makeObservable && !this.isObservable) {
        this.makeObservable(); // particularly for observable arrays, for
        // their length property
    }
    var descriptor = PropertyChanges.getOwnPropertyChangeDescriptor(this, key);
    var listeners;
    if (beforeChange) {
        listeners = descriptor.willChangeListeners;
    } else {
        listeners = descriptor.changeListeners;
    }
    PropertyChanges.makePropertyObservable(this, key);
    listeners.current.push(listener);

    var self = this;
    return function cancelOwnPropertyChangeListener() {
        PropertyChanges.removeOwnPropertyChangeListener(self, key, listener, beforeChange);
        self = null;
    };
};

PropertyChanges.prototype.addBeforeOwnPropertyChangeListener = function (key, listener) {
    return PropertyChanges.addOwnPropertyChangeListener(this, key, listener, true);
};

PropertyChanges.prototype.removeOwnPropertyChangeListener = function (key, listener, beforeChange) {
    var descriptor = PropertyChanges.getOwnPropertyChangeDescriptor(this, key);

    var listeners;
    if (beforeChange) {
        listeners = descriptor.willChangeListeners;
    } else {
        listeners = descriptor.changeListeners;
    }

    var index = listeners.current.lastIndexOf(listener);
    if (index === -1) {
        throw new Error("Can't remove property change listener: does not exist: property name" + JSON.stringify(key));
    }
    listeners.current.splice(index, 1);
};

PropertyChanges.prototype.removeBeforeOwnPropertyChangeListener = function (key, listener) {
    return PropertyChanges.removeOwnPropertyChangeListener(this, key, listener, true);
};

PropertyChanges.prototype.dispatchOwnPropertyChange = function (key, value, beforeChange) {
    var descriptor = PropertyChanges.getOwnPropertyChangeDescriptor(this, key);

    if (descriptor.isActive) {
        return;
    }
    descriptor.isActive = true;

    var listeners;
    if (beforeChange) {
        listeners = descriptor.willChangeListeners;
    } else {
        listeners = descriptor.changeListeners;
    }

    try {
        // dispatch to each listener
        dispatchEach.call(this, listeners, key, value);
    } finally {
        descriptor.isActive = false;
    }
};

// Factored out of parent to avoid try/catch deoptimization
function dispatchEach(listeners, key, value) {
    // copy snapshot of current listeners to active listeners
    var active = listeners.active;
    var current = listeners.current;
    var index = active.length = current.length;
    while (index--) {
        active[index] = current[index];
    }
    for (var index = 0, length = active.length; index < length; index++) {
        var listener = active[index];
        if (current.indexOf(listener) < 0) {
            return;
        }
        var thisp = listener;
        listener = (
            listener[listeners.specificHandlerMethodName] ||
            listener[listeners.genericHandlerMethodName] ||
            listener
        );
        if (!listener.call) {
            throw new Error("No event listener for " + listeners.specificHandlerName + " or " + listeners.genericHandlerName + " or call on " + listener);
        }
        listener.call(thisp, value, key, this);
    }
}

PropertyChanges.prototype.dispatchBeforeOwnPropertyChange = function (key, listener) {
    return PropertyChanges.dispatchOwnPropertyChange(this, key, listener, true);
};

PropertyChanges.prototype.makePropertyObservable = function (key) {
    // arrays are special.  we do not support direct setting of properties
    // on an array.  instead, call .set(index, value).  this is observable.
    // 'length' property is observable for all mutating methods because
    // our overrides explicitly dispatch that change.
    if (Array.isArray(this)) {
        return;
    }

    if (!Object.isExtensible(this, key)) {
        throw new Error("Can't make property " + JSON.stringify(key) + " observable on " + this + " because object is not extensible");
    }

    var state;
    if (typeof this.__state__ === "object") {
        state = this.__state__;
    } else {
        state = {};
        if (Object.isExtensible(this, "__state__")) {
            Object.defineProperty(this, "__state__", {
                value: state,
                writable: true,
                enumerable: false
            });
        }
    }
    state[key] = this[key];

    // memoize overridden property descriptor table
    if (!this.__overriddenPropertyDescriptors__) {
        overriddenPropertyDescriptors = {};
        Object.defineProperty(this, "__overriddenPropertyDescriptors__", {
            value: {},
            enumerable: false,
            writable: true,
            configurable: true
        });
    }
    var overriddenPropertyDescriptors = this.__overriddenPropertyDescriptors__;

    if (object_owns.call(overriddenPropertyDescriptors, key)) {
        // if we have already recorded an overridden property descriptor,
        // we have already installed the observer, so short-here
        return;
    }

    // walk up the prototype chain to find a property descriptor for
    // the property name
    var overriddenDescriptor;
    var attached = this;
    var formerDescriptor = Object.getOwnPropertyDescriptor(attached, key);
    do {
        overriddenDescriptor = Object.getOwnPropertyDescriptor(attached, key);
        if (overriddenDescriptor) {
            break;
        }
        attached = Object.getPrototypeOf(attached);
    } while (attached);
    // or default to an undefined value
    overriddenDescriptor = overriddenDescriptor || {
        value: undefined,
        enumerable: true,
        writable: true,
        configurable: true
    };

    if (!overriddenDescriptor.configurable) {
        return;
    }

    // memoize the descriptor so we know not to install another layer,
    // and so we can reuse the overridden descriptor when uninstalling
    overriddenPropertyDescriptors[key] = overriddenDescriptor;

    // give up *after* storing the overridden property descriptor so it
    // can be restored by uninstall.  Unwritable properties are
    // silently not overriden.  Since success is indistinguishable from
    // failure, we let it pass but don't waste time on intercepting
    // get/set.
    if (!overriddenDescriptor.writable && !overriddenDescriptor.set) {
        return;
    }

    // TODO reflect current value on a displayed property

    var propertyListener;
    // in both of these new descriptor variants, we reuse the overridden
    // descriptor to either store the current value or apply getters
    // and setters.  this is handy since we can reuse the overridden
    // descriptor if we uninstall the observer.  We even preserve the
    // assignment semantics, where we get the value from up the
    // prototype chain, and set as an owned property.
    if ('value' in overriddenDescriptor) {
        propertyListener = {
            get: function () {
                return overriddenDescriptor.value
            },
            set: function (value) {
                if (value === overriddenDescriptor.value) {
                    return value;
                }
                PropertyChanges.dispatchBeforeOwnPropertyChange(this, key, overriddenDescriptor.value);
                overriddenDescriptor.value = value;
                state[key] = value;
                PropertyChanges.dispatchOwnPropertyChange(this, key, value);
                return value;
            },
            enumerable: overriddenDescriptor.enumerable,
            configurable: true
        };
    } else { // 'get' or 'set', but not necessarily both
        propertyListener = {
            get: function () {
                if (overriddenDescriptor.get) {
                    return overriddenDescriptor.get.apply(this, arguments);
                }
            },
            set: function (value) {
                var formerValue;

                // get the actual former value if possible
                if (overriddenDescriptor.get) {
                    formerValue = overriddenDescriptor.get.apply(this, arguments);
                }
                // call through to actual setter
                if (overriddenDescriptor.set) {
                    overriddenDescriptor.set.apply(this, arguments)
                }
                // use getter, if possible, to discover whether the set
                // was successful
                if (overriddenDescriptor.get) {
                    value = overriddenDescriptor.get.apply(this, arguments);
                    state[key] = value;
                }
                // if it has not changed, suppress a notification
                if (value === formerValue) {
                    return value;
                }
                PropertyChanges.dispatchBeforeOwnPropertyChange(this, key, formerValue);

                // dispatch the new value: the given value if there is
                // no getter, or the actual value if there is one
                PropertyChanges.dispatchOwnPropertyChange(this, key, value);
                return value;
            },
            enumerable: overriddenDescriptor.enumerable,
            configurable: true
        };
    }

    Object.defineProperty(this, key, propertyListener);
};

// constructor functions

PropertyChanges.getOwnPropertyChangeDescriptor = function (object, key) {
    if (object.getOwnPropertyChangeDescriptor) {
        return object.getOwnPropertyChangeDescriptor(key);
    } else {
        return PropertyChanges.prototype.getOwnPropertyChangeDescriptor.call(object, key);
    }
};

PropertyChanges.hasOwnPropertyChangeDescriptor = function (object, key) {
    if (object.hasOwnPropertyChangeDescriptor) {
        return object.hasOwnPropertyChangeDescriptor(key);
    } else {
        return PropertyChanges.prototype.hasOwnPropertyChangeDescriptor.call(object, key);
    }
};

PropertyChanges.addOwnPropertyChangeListener = function (object, key, listener, beforeChange) {
    if (!Object.isObject(object)) {
    } else if (object.addOwnPropertyChangeListener) {
        return object.addOwnPropertyChangeListener(key, listener, beforeChange);
    } else {
        return PropertyChanges.prototype.addOwnPropertyChangeListener.call(object, key, listener, beforeChange);
    }
};

PropertyChanges.removeOwnPropertyChangeListener = function (object, key, listener, beforeChange) {
    if (!Object.isObject(object)) {
    } else if (object.removeOwnPropertyChangeListener) {
        return object.removeOwnPropertyChangeListener(key, listener, beforeChange);
    } else {
        return PropertyChanges.prototype.removeOwnPropertyChangeListener.call(object, key, listener, beforeChange);
    }
};

PropertyChanges.dispatchOwnPropertyChange = function (object, key, value, beforeChange) {
    if (!Object.isObject(object)) {
    } else if (object.dispatchOwnPropertyChange) {
        return object.dispatchOwnPropertyChange(key, value, beforeChange);
    } else {
        return PropertyChanges.prototype.dispatchOwnPropertyChange.call(object, key, value, beforeChange);
    }
};

PropertyChanges.addBeforeOwnPropertyChangeListener = function (object, key, listener) {
    return PropertyChanges.addOwnPropertyChangeListener(object, key, listener, true);
};

PropertyChanges.removeBeforeOwnPropertyChangeListener = function (object, key, listener) {
    return PropertyChanges.removeOwnPropertyChangeListener(object, key, listener, true);
};

PropertyChanges.dispatchBeforeOwnPropertyChange = function (object, key, value) {
    return PropertyChanges.dispatchOwnPropertyChange(object, key, value, true);
};

PropertyChanges.makePropertyObservable = function (object, key) {
    if (object.makePropertyObservable) {
        return object.makePropertyObservable(key);
    } else {
        return PropertyChanges.prototype.makePropertyObservable.call(object, key);
    }
};


},{"../shim":20}],13:[function(require,module,exports){
"use strict";

var WeakMap = require("weak-map");
var Dict = require("../dict");

var rangeChangeDescriptors = new WeakMap(); // {isActive, willChangeListeners, changeListeners}

module.exports = RangeChanges;
function RangeChanges() {
    throw new Error("Can't construct. RangeChanges is a mixin.");
}

RangeChanges.prototype.getAllRangeChangeDescriptors = function () {
    if (!rangeChangeDescriptors.has(this)) {
        rangeChangeDescriptors.set(this, Dict());
    }
    return rangeChangeDescriptors.get(this);
};

RangeChanges.prototype.getRangeChangeDescriptor = function (token) {
    var tokenChangeDescriptors = this.getAllRangeChangeDescriptors();
    token = token || "";
    if (!tokenChangeDescriptors.has(token)) {
        tokenChangeDescriptors.set(token, {
            isActive: false,
            changeListeners: [],
            willChangeListeners: []
        });
    }
    return tokenChangeDescriptors.get(token);
};

RangeChanges.prototype.addRangeChangeListener = function (listener, token, beforeChange) {
    // a concession for objects like Array that are not inherently observable
    if (!this.isObservable && this.makeObservable) {
        this.makeObservable();
    }

    var descriptor = this.getRangeChangeDescriptor(token);

    var listeners;
    if (beforeChange) {
        listeners = descriptor.willChangeListeners;
    } else {
        listeners = descriptor.changeListeners;
    }

    // even if already registered
    listeners.push(listener);
    Object.defineProperty(this, "dispatchesRangeChanges", {
        value: true,
        writable: true,
        configurable: true,
        enumerable: false
    });

    var self = this;
    return function cancelRangeChangeListener() {
        if (!self) {
            // TODO throw new Error("Range change listener " + JSON.stringify(token) + " has already been canceled");
            return;
        }
        self.removeRangeChangeListener(listener, token, beforeChange);
        self = null;
    };
};

RangeChanges.prototype.removeRangeChangeListener = function (listener, token, beforeChange) {
    var descriptor = this.getRangeChangeDescriptor(token);

    var listeners;
    if (beforeChange) {
        listeners = descriptor.willChangeListeners;
    } else {
        listeners = descriptor.changeListeners;
    }

    var index = listeners.lastIndexOf(listener);
    if (index === -1) {
        throw new Error("Can't remove range change listener: does not exist: token " + JSON.stringify(token));
    }
    listeners.splice(index, 1);
};

RangeChanges.prototype.dispatchRangeChange = function (plus, minus, index, beforeChange) {
    var descriptors = this.getAllRangeChangeDescriptors();
    var changeName = "Range" + (beforeChange ? "WillChange" : "Change");
    descriptors.forEach(function (descriptor, token) {

        if (descriptor.isActive) {
            return;
        } else {
            descriptor.isActive = true;
        }

        // before or after
        var listeners;
        if (beforeChange) {
            listeners = descriptor.willChangeListeners;
        } else {
            listeners = descriptor.changeListeners;
        }

        var tokenName = "handle" + (
            token.slice(0, 1).toUpperCase() +
            token.slice(1)
        ) + changeName;
        // notably, defaults to "handleRangeChange" or "handleRangeWillChange"
        // if token is "" (the default)

        // dispatch each listener
        try {
            listeners.slice().forEach(function (listener) {
                if (listeners.indexOf(listener) < 0) {
                    return;
                }
                if (listener[tokenName]) {
                    listener[tokenName](plus, minus, index, this, beforeChange);
                } else if (listener.call) {
                    listener.call(this, plus, minus, index, this, beforeChange);
                } else {
                    throw new Error("Handler " + listener + " has no method " + tokenName + " and is not callable");
                }
            }, this);
        } finally {
            descriptor.isActive = false;
        }
    }, this);
};

RangeChanges.prototype.addBeforeRangeChangeListener = function (listener, token) {
    return this.addRangeChangeListener(listener, token, true);
};

RangeChanges.prototype.removeBeforeRangeChangeListener = function (listener, token) {
    return this.removeRangeChangeListener(listener, token, true);
};

RangeChanges.prototype.dispatchBeforeRangeChange = function (plus, minus, index) {
    return this.dispatchRangeChange(plus, minus, index, true);
};


},{"../dict":1,"weak-map":14}],14:[function(require,module,exports){
// Copyright (C) 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Install a leaky WeakMap emulation on platforms that
 * don't provide a built-in one.
 *
 * <p>Assumes that an ES5 platform where, if {@code WeakMap} is
 * already present, then it conforms to the anticipated ES6
 * specification. To run this file on an ES5 or almost ES5
 * implementation where the {@code WeakMap} specification does not
 * quite conform, run <code>repairES5.js</code> first.
 *
 * <p> Even though WeakMapModule is not global, the linter thinks it
 * is, which is why it is in the overrides list below.
 *
 * @author Mark S. Miller
 * @requires crypto, ArrayBuffer, Uint8Array, navigator
 * @overrides WeakMap, ses, Proxy
 * @overrides WeakMapModule
 */

/**
 * This {@code WeakMap} emulation is observably equivalent to the
 * ES-Harmony WeakMap, but with leakier garbage collection properties.
 *
 * <p>As with true WeakMaps, in this emulation, a key does not
 * retain maps indexed by that key and (crucially) a map does not
 * retain the keys it indexes. A map by itself also does not retain
 * the values associated with that map.
 *
 * <p>However, the values associated with a key in some map are
 * retained so long as that key is retained and those associations are
 * not overridden. For example, when used to support membranes, all
 * values exported from a given membrane will live for the lifetime
 * they would have had in the absence of an interposed membrane. Even
 * when the membrane is revoked, all objects that would have been
 * reachable in the absence of revocation will still be reachable, as
 * far as the GC can tell, even though they will no longer be relevant
 * to ongoing computation.
 *
 * <p>The API implemented here is approximately the API as implemented
 * in FF6.0a1 and agreed to by MarkM, Andreas Gal, and Dave Herman,
 * rather than the offially approved proposal page. TODO(erights):
 * upgrade the ecmascript WeakMap proposal page to explain this API
 * change and present to EcmaScript committee for their approval.
 *
 * <p>The first difference between the emulation here and that in
 * FF6.0a1 is the presence of non enumerable {@code get___, has___,
 * set___, and delete___} methods on WeakMap instances to represent
 * what would be the hidden internal properties of a primitive
 * implementation. Whereas the FF6.0a1 WeakMap.prototype methods
 * require their {@code this} to be a genuine WeakMap instance (i.e.,
 * an object of {@code [[Class]]} "WeakMap}), since there is nothing
 * unforgeable about the pseudo-internal method names used here,
 * nothing prevents these emulated prototype methods from being
 * applied to non-WeakMaps with pseudo-internal methods of the same
 * names.
 *
 * <p>Another difference is that our emulated {@code
 * WeakMap.prototype} is not itself a WeakMap. A problem with the
 * current FF6.0a1 API is that WeakMap.prototype is itself a WeakMap
 * providing ambient mutability and an ambient communications
 * channel. Thus, if a WeakMap is already present and has this
 * problem, repairES5.js wraps it in a safe wrappper in order to
 * prevent access to this channel. (See
 * PATCH_MUTABLE_FROZEN_WEAKMAP_PROTO in repairES5.js).
 */

/**
 * If this is a full <a href=
 * "http://code.google.com/p/es-lab/wiki/SecureableES5"
 * >secureable ES5</a> platform and the ES-Harmony {@code WeakMap} is
 * absent, install an approximate emulation.
 *
 * <p>If WeakMap is present but cannot store some objects, use our approximate
 * emulation as a wrapper.
 *
 * <p>If this is almost a secureable ES5 platform, then WeakMap.js
 * should be run after repairES5.js.
 *
 * <p>See {@code WeakMap} for documentation of the garbage collection
 * properties of this WeakMap emulation.
 */
(function WeakMapModule() {
  "use strict";

  if (typeof ses !== 'undefined' && ses.ok && !ses.ok()) {
    // already too broken, so give up
    return;
  }

  /**
   * In some cases (current Firefox), we must make a choice betweeen a
   * WeakMap which is capable of using all varieties of host objects as
   * keys and one which is capable of safely using proxies as keys. See
   * comments below about HostWeakMap and DoubleWeakMap for details.
   *
   * This function (which is a global, not exposed to guests) marks a
   * WeakMap as permitted to do what is necessary to index all host
   * objects, at the cost of making it unsafe for proxies.
   *
   * Do not apply this function to anything which is not a genuine
   * fresh WeakMap.
   */
  function weakMapPermitHostObjects(map) {
    // identity of function used as a secret -- good enough and cheap
    if (map.permitHostObjects___) {
      map.permitHostObjects___(weakMapPermitHostObjects);
    }
  }
  if (typeof ses !== 'undefined') {
    ses.weakMapPermitHostObjects = weakMapPermitHostObjects;
  }

  // Check if there is already a good-enough WeakMap implementation, and if so
  // exit without replacing it.
  if (typeof WeakMap === 'function') {
    var HostWeakMap = WeakMap;
    // There is a WeakMap -- is it good enough?
    if (typeof navigator !== 'undefined' &&
        /Firefox/.test(navigator.userAgent)) {
      // We're now *assuming not*, because as of this writing (2013-05-06)
      // Firefox's WeakMaps have a miscellany of objects they won't accept, and
      // we don't want to make an exhaustive list, and testing for just one
      // will be a problem if that one is fixed alone (as they did for Event).

      // If there is a platform that we *can* reliably test on, here's how to
      // do it:
      //  var problematic = ... ;
      //  var testHostMap = new HostWeakMap();
      //  try {
      //    testHostMap.set(problematic, 1);  // Firefox 20 will throw here
      //    if (testHostMap.get(problematic) === 1) {
      //      return;
      //    }
      //  } catch (e) {}

      // Fall through to installing our WeakMap.
    } else {
      module.exports = WeakMap;
      return;
    }
  }

  var hop = Object.prototype.hasOwnProperty;
  var gopn = Object.getOwnPropertyNames;
  var defProp = Object.defineProperty;
  var isExtensible = Object.isExtensible;

  /**
   * Security depends on HIDDEN_NAME being both <i>unguessable</i> and
   * <i>undiscoverable</i> by untrusted code.
   *
   * <p>Given the known weaknesses of Math.random() on existing
   * browsers, it does not generate unguessability we can be confident
   * of.
   *
   * <p>It is the monkey patching logic in this file that is intended
   * to ensure undiscoverability. The basic idea is that there are
   * three fundamental means of discovering properties of an object:
   * The for/in loop, Object.keys(), and Object.getOwnPropertyNames(),
   * as well as some proposed ES6 extensions that appear on our
   * whitelist. The first two only discover enumerable properties, and
   * we only use HIDDEN_NAME to name a non-enumerable property, so the
   * only remaining threat should be getOwnPropertyNames and some
   * proposed ES6 extensions that appear on our whitelist. We monkey
   * patch them to remove HIDDEN_NAME from the list of properties they
   * returns.
   *
   * <p>TODO(erights): On a platform with built-in Proxies, proxies
   * could be used to trap and thereby discover the HIDDEN_NAME, so we
   * need to monkey patch Proxy.create, Proxy.createFunction, etc, in
   * order to wrap the provided handler with the real handler which
   * filters out all traps using HIDDEN_NAME.
   *
   * <p>TODO(erights): Revisit Mike Stay's suggestion that we use an
   * encapsulated function at a not-necessarily-secret name, which
   * uses the Stiegler shared-state rights amplification pattern to
   * reveal the associated value only to the WeakMap in which this key
   * is associated with that value. Since only the key retains the
   * function, the function can also remember the key without causing
   * leakage of the key, so this doesn't violate our general gc
   * goals. In addition, because the name need not be a guarded
   * secret, we could efficiently handle cross-frame frozen keys.
   */
  var HIDDEN_NAME_PREFIX = 'weakmap:';
  var HIDDEN_NAME = HIDDEN_NAME_PREFIX + 'ident:' + Math.random() + '___';

  if (typeof crypto !== 'undefined' &&
      typeof crypto.getRandomValues === 'function' &&
      typeof ArrayBuffer === 'function' &&
      typeof Uint8Array === 'function') {
    var ab = new ArrayBuffer(25);
    var u8s = new Uint8Array(ab);
    crypto.getRandomValues(u8s);
    HIDDEN_NAME = HIDDEN_NAME_PREFIX + 'rand:' +
      Array.prototype.map.call(u8s, function(u8) {
        return (u8 % 36).toString(36);
      }).join('') + '___';
  }

  function isNotHiddenName(name) {
    return !(
        name.substr(0, HIDDEN_NAME_PREFIX.length) == HIDDEN_NAME_PREFIX &&
        name.substr(name.length - 3) === '___');
  }

  /**
   * Monkey patch getOwnPropertyNames to avoid revealing the
   * HIDDEN_NAME.
   *
   * <p>The ES5.1 spec requires each name to appear only once, but as
   * of this writing, this requirement is controversial for ES6, so we
   * made this code robust against this case. If the resulting extra
   * search turns out to be expensive, we can probably relax this once
   * ES6 is adequately supported on all major browsers, iff no browser
   * versions we support at that time have relaxed this constraint
   * without providing built-in ES6 WeakMaps.
   */
  defProp(Object, 'getOwnPropertyNames', {
    value: function fakeGetOwnPropertyNames(obj) {
      return gopn(obj).filter(isNotHiddenName);
    }
  });

  /**
   * getPropertyNames is not in ES5 but it is proposed for ES6 and
   * does appear in our whitelist, so we need to clean it too.
   */
  if ('getPropertyNames' in Object) {
    var originalGetPropertyNames = Object.getPropertyNames;
    defProp(Object, 'getPropertyNames', {
      value: function fakeGetPropertyNames(obj) {
        return originalGetPropertyNames(obj).filter(isNotHiddenName);
      }
    });
  }

  /**
   * <p>To treat objects as identity-keys with reasonable efficiency
   * on ES5 by itself (i.e., without any object-keyed collections), we
   * need to add a hidden property to such key objects when we
   * can. This raises several issues:
   * <ul>
   * <li>Arranging to add this property to objects before we lose the
   *     chance, and
   * <li>Hiding the existence of this new property from most
   *     JavaScript code.
   * <li>Preventing <i>certification theft</i>, where one object is
   *     created falsely claiming to be the key of an association
   *     actually keyed by another object.
   * <li>Preventing <i>value theft</i>, where untrusted code with
   *     access to a key object but not a weak map nevertheless
   *     obtains access to the value associated with that key in that
   *     weak map.
   * </ul>
   * We do so by
   * <ul>
   * <li>Making the name of the hidden property unguessable, so "[]"
   *     indexing, which we cannot intercept, cannot be used to access
   *     a property without knowing the name.
   * <li>Making the hidden property non-enumerable, so we need not
   *     worry about for-in loops or {@code Object.keys},
   * <li>monkey patching those reflective methods that would
   *     prevent extensions, to add this hidden property first,
   * <li>monkey patching those methods that would reveal this
   *     hidden property.
   * </ul>
   * Unfortunately, because of same-origin iframes, we cannot reliably
   * add this hidden property before an object becomes
   * non-extensible. Instead, if we encounter a non-extensible object
   * without a hidden record that we can detect (whether or not it has
   * a hidden record stored under a name secret to us), then we just
   * use the key object itself to represent its identity in a brute
   * force leaky map stored in the weak map, losing all the advantages
   * of weakness for these.
   */
  function getHiddenRecord(key) {
    if (key !== Object(key)) {
      throw new TypeError('Not an object: ' + key);
    }
    var hiddenRecord = key[HIDDEN_NAME];
    if (hiddenRecord && hiddenRecord.key === key) { return hiddenRecord; }
    if (!isExtensible(key)) {
      // Weak map must brute force, as explained in doc-comment above.
      return void 0;
    }
    var gets = [];
    var vals = [];
    hiddenRecord = {
      key: key,   // self pointer for quick own check above.
      gets: gets, // get___ methods identifying weak maps
      vals: vals  // values associated with this key in each
                  // corresponding weak map.
    };
    defProp(key, HIDDEN_NAME, {
      value: hiddenRecord,
      writable: false,
      enumerable: false,
      configurable: false
    });
    return hiddenRecord;
  }


  /**
   * Monkey patch operations that would make their argument
   * non-extensible.
   *
   * <p>The monkey patched versions throw a TypeError if their
   * argument is not an object, so it should only be done to functions
   * that should throw a TypeError anyway if their argument is not an
   * object.
   */
  (function(){
    var oldFreeze = Object.freeze;
    defProp(Object, 'freeze', {
      value: function identifyingFreeze(obj) {
        getHiddenRecord(obj);
        return oldFreeze(obj);
      }
    });
    var oldSeal = Object.seal;
    defProp(Object, 'seal', {
      value: function identifyingSeal(obj) {
        getHiddenRecord(obj);
        return oldSeal(obj);
      }
    });
    var oldPreventExtensions = Object.preventExtensions;
    defProp(Object, 'preventExtensions', {
      value: function identifyingPreventExtensions(obj) {
        getHiddenRecord(obj);
        return oldPreventExtensions(obj);
      }
    });
  })();


  function constFunc(func) {
    func.prototype = null;
    return Object.freeze(func);
  }

  // Right now (12/25/2012) the histogram supports the current
  // representation. We should check this occasionally, as a true
  // constant time representation is easy.
  // var histogram = [];

  var OurWeakMap = function() {
    // We are currently (12/25/2012) never encountering any prematurely
    // non-extensible keys.
    var keys = []; // brute force for prematurely non-extensible keys.
    var vals = []; // brute force for corresponding values.

    function get___(key, opt_default) {
      var hr = getHiddenRecord(key);
      var i, vs;
      if (hr) {
        i = hr.gets.indexOf(get___);
        vs = hr.vals;
      } else {
        i = keys.indexOf(key);
        vs = vals;
      }
      return (i >= 0) ? vs[i] : opt_default;
    }

    function has___(key) {
      var hr = getHiddenRecord(key);
      var i;
      if (hr) {
        i = hr.gets.indexOf(get___);
      } else {
        i = keys.indexOf(key);
      }
      return i >= 0;
    }

    function set___(key, value) {
      var hr = getHiddenRecord(key);
      var i;
      if (hr) {
        i = hr.gets.indexOf(get___);
        if (i >= 0) {
          hr.vals[i] = value;
        } else {
//          i = hr.gets.length;
//          histogram[i] = (histogram[i] || 0) + 1;
          hr.gets.push(get___);
          hr.vals.push(value);
        }
      } else {
        i = keys.indexOf(key);
        if (i >= 0) {
          vals[i] = value;
        } else {
          keys.push(key);
          vals.push(value);
        }
      }
    }

    function delete___(key) {
      var hr = getHiddenRecord(key);
      var i;
      if (hr) {
        i = hr.gets.indexOf(get___);
        if (i >= 0) {
          hr.gets.splice(i, 1);
          hr.vals.splice(i, 1);
        }
      } else {
        i = keys.indexOf(key);
        if (i >= 0) {
          keys.splice(i, 1);
          vals.splice(i, 1);
        }
      }
      return true;
    }

    return Object.create(OurWeakMap.prototype, {
      get___:    { value: constFunc(get___) },
      has___:    { value: constFunc(has___) },
      set___:    { value: constFunc(set___) },
      delete___: { value: constFunc(delete___) }
    });
  };
  OurWeakMap.prototype = Object.create(Object.prototype, {
    get: {
      /**
       * Return the value most recently associated with key, or
       * opt_default if none.
       */
      value: function get(key, opt_default) {
        return this.get___(key, opt_default);
      },
      writable: true,
      configurable: true
    },

    has: {
      /**
       * Is there a value associated with key in this WeakMap?
       */
      value: function has(key) {
        return this.has___(key);
      },
      writable: true,
      configurable: true
    },

    set: {
      /**
       * Associate value with key in this WeakMap, overwriting any
       * previous association if present.
       */
      value: function set(key, value) {
        this.set___(key, value);
      },
      writable: true,
      configurable: true
    },

    'delete': {
      /**
       * Remove any association for key in this WeakMap, returning
       * whether there was one.
       *
       * <p>Note that the boolean return here does not work like the
       * {@code delete} operator. The {@code delete} operator returns
       * whether the deletion succeeds at bringing about a state in
       * which the deleted property is absent. The {@code delete}
       * operator therefore returns true if the property was already
       * absent, whereas this {@code delete} method returns false if
       * the association was already absent.
       */
      value: function remove(key) {
        return this.delete___(key);
      },
      writable: true,
      configurable: true
    }
  });

  if (typeof HostWeakMap === 'function') {
    (function() {
      // If we got here, then the platform has a WeakMap but we are concerned
      // that it may refuse to store some key types. Therefore, make a map
      // implementation which makes use of both as possible.

      function DoubleWeakMap() {
        // Preferable, truly weak map.
        var hmap = new HostWeakMap();

        // Our hidden-property-based pseudo-weak-map. Lazily initialized in the
        // 'set' implementation; thus we can avoid performing extra lookups if
        // we know all entries actually stored are entered in 'hmap'.
        var omap = undefined;

        // Hidden-property maps are not compatible with proxies because proxies
        // can observe the hidden name and either accidentally expose it or fail
        // to allow the hidden property to be set. Therefore, we do not allow
        // arbitrary WeakMaps to switch to using hidden properties, but only
        // those which need the ability, and unprivileged code is not allowed
        // to set the flag.
        var enableSwitching = false;

        function dget(key, opt_default) {
          if (omap) {
            return hmap.has(key) ? hmap.get(key)
                : omap.get___(key, opt_default);
          } else {
            return hmap.get(key, opt_default);
          }
        }

        function dhas(key) {
          return hmap.has(key) || (omap ? omap.has___(key) : false);
        }

        function dset(key, value) {
          if (enableSwitching) {
            try {
              hmap.set(key, value);
            } catch (e) {
              if (!omap) { omap = new OurWeakMap(); }
              omap.set___(key, value);
            }
          } else {
            hmap.set(key, value);
          }
        }

        function ddelete(key) {
          hmap['delete'](key);
          if (omap) { omap.delete___(key); }
        }

        return Object.create(OurWeakMap.prototype, {
          get___:    { value: constFunc(dget) },
          has___:    { value: constFunc(dhas) },
          set___:    { value: constFunc(dset) },
          delete___: { value: constFunc(ddelete) },
          permitHostObjects___: { value: constFunc(function(token) {
            if (token === weakMapPermitHostObjects) {
              enableSwitching = true;
            } else {
              throw new Error('bogus call to permitHostObjects___');
            }
          })}
        });
      }
      DoubleWeakMap.prototype = OurWeakMap.prototype;
      module.exports = DoubleWeakMap;

      // define .constructor to hide OurWeakMap ctor
      Object.defineProperty(WeakMap.prototype, 'constructor', {
        value: WeakMap,
        enumerable: false,  // as default .constructor is
        configurable: true,
        writable: true
      });
    })();
  } else {
    // There is no host WeakMap, so we must use the emulation.

    // Emulated WeakMaps are incompatible with native proxies (because proxies
    // can observe the hidden name), so we must disable Proxy usage (in
    // ArrayLike and Domado, currently).
    if (typeof Proxy !== 'undefined') {
      Proxy = undefined;
    }

    module.exports = OurWeakMap;
  }
})();

},{}],15:[function(require,module,exports){
"use strict";

var Shim = require("./shim");
var List = require("./list");
var FastSet = require("./fast-set");
var GenericCollection = require("./generic-collection");
var GenericSet = require("./generic-set");
var PropertyChanges = require("./listen/property-changes");
var RangeChanges = require("./listen/range-changes");

module.exports = Set;

function Set(values, equals, hash, getDefault) {
    if (!(this instanceof Set)) {
        return new Set(values, equals, hash, getDefault);
    }
    equals = equals || Object.equals;
    hash = hash || Object.hash;
    getDefault = getDefault || Function.noop;
    this.contentEquals = equals;
    this.contentHash = hash;
    this.getDefault = getDefault;
    // a list of values in insertion order, used for all operations that depend
    // on iterating in insertion order
    this.order = new this.Order(undefined, equals);
    // a set of nodes from the order list, indexed by the corresponding value,
    // used for all operations that need to quickly seek  value in the list
    this.store = new this.Store(
        undefined,
        function (a, b) {
            return equals(a.value, b.value);
        },
        function (node) {
            return hash(node.value);
        }
    );
    this.length = 0;
    this.addEach(values);
}

Set.Set = Set; // hack so require("set").Set will work in MontageJS

Object.addEach(Set.prototype, GenericCollection.prototype);
Object.addEach(Set.prototype, GenericSet.prototype);
Object.addEach(Set.prototype, PropertyChanges.prototype);
Object.addEach(Set.prototype, RangeChanges.prototype);

Set.prototype.Order = List;
Set.prototype.Store = FastSet;

Set.prototype.constructClone = function (values) {
    return new this.constructor(values, this.contentEquals, this.contentHash, this.getDefault);
};

Set.prototype.has = function (value) {
    var node = new this.order.Node(value);
    return this.store.has(node);
};

Set.prototype.get = function (value, equals) {
    if (equals) {
        throw new Error("Set#get does not support second argument: equals");
    }
    var node = new this.order.Node(value);
    node = this.store.get(node);
    if (node) {
        return node.value;
    } else {
        return this.getDefault(value);
    }
};

Set.prototype.add = function (value) {
    var node = new this.order.Node(value);
    if (!this.store.has(node)) {
        var index = this.length;
        if (this.dispatchesRangeChanges) {
            this.dispatchBeforeRangeChange([value], [], index);
        }
        this.order.add(value);
        node = this.order.head.prev;
        this.store.add(node);
        this.length++;
        if (this.dispatchesRangeChanges) {
            this.dispatchRangeChange([value], [], index);
        }
        return true;
    }
    return false;
};

Set.prototype["delete"] = function (value, equals) {
    if (equals) {
        throw new Error("Set#delete does not support second argument: equals");
    }
    var node = new this.order.Node(value);
    if (this.store.has(node)) {
        node = this.store.get(node);
        if (this.dispatchesRangeChanges) {
            this.dispatchBeforeRangeChange([], [value], node.index);
        }
        this.store["delete"](node); // removes from the set
        this.order.splice(node, 1); // removes the node from the list
        this.length--;
        if (this.dispatchesRangeChanges) {
            this.dispatchRangeChange([], [value], node.index);
        }
        return true;
    }
    return false;
};

Set.prototype.pop = function () {
    if (this.length) {
        var result = this.order.head.prev.value;
        this["delete"](result);
        return result;
    }
};

Set.prototype.shift = function () {
    if (this.length) {
        var result = this.order.head.next.value;
        this["delete"](result);
        return result;
    }
};

Set.prototype.one = function () {
    if (this.length > 0) {
        return this.store.one().value;
    }
};

Set.prototype.clear = function () {
    var clearing;
    if (this.dispatchesRangeChanges) {
        clearing = this.toArray();
        this.dispatchBeforeRangeChange([], clearing, 0);
    }
    this.store.clear();
    this.order.clear();
    this.length = 0;
    if (this.dispatchesRangeChanges) {
        this.dispatchRangeChange([], clearing, 0);
    }
};

Set.prototype.reduce = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    var list = this.order;
    var index = 0;
    return list.reduce(function (basis, value) {
        return callback.call(thisp, basis, value, index++, this);
    }, basis, this);
};

Set.prototype.reduceRight = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    var list = this.order;
    var index = this.length - 1;
    return list.reduceRight(function (basis, value) {
        return callback.call(thisp, basis, value, index--, this);
    }, basis, this);
};

Set.prototype.iterate = function () {
    return this.order.iterate();
};

Set.prototype.log = function () {
    var set = this.store;
    return set.log.apply(set, arguments);
};

Set.prototype.makeObservable = function () {
    this.order.makeObservable();
};


},{"./fast-set":3,"./generic-collection":4,"./generic-set":7,"./list":9,"./listen/property-changes":12,"./listen/range-changes":13,"./shim":20}],16:[function(require,module,exports){
"use strict";

/*
    Based in part on extras from Motorola Mobility’s Montage
    Copyright (c) 2012, Motorola Mobility LLC. All Rights Reserved.
    3-Clause BSD License
    https://github.com/motorola-mobility/montage/blob/master/LICENSE.md
*/

var Function = require("./shim-function");
var GenericCollection = require("./generic-collection");
var GenericOrder = require("./generic-order");
var WeakMap = require("weak-map");

module.exports = Array;

var array_splice = Array.prototype.splice;
var array_slice = Array.prototype.slice;

Array.empty = [];

if (Object.freeze) {
    Object.freeze(Array.empty);
}

Array.from = function (values) {
    var array = [];
    array.addEach(values);
    return array;
};

Array.unzip = function (table) {
    var transpose = [];
    var length = Infinity;
    // compute shortest row
    for (var i = 0; i < table.length; i++) {
        var row = table[i];
        table[i] = row.toArray();
        if (row.length < length) {
            length = row.length;
        }
    }
    for (var i = 0; i < table.length; i++) {
        var row = table[i];
        for (var j = 0; j < row.length; j++) {
            if (j < length && j in row) {
                transpose[j] = transpose[j] || [];
                transpose[j][i] = row[j];
            }
        }
    }
    return transpose;
};

function define(key, value) {
    Object.defineProperty(Array.prototype, key, {
        value: value,
        writable: true,
        configurable: true,
        enumerable: false
    });
}

define("addEach", GenericCollection.prototype.addEach);
define("deleteEach", GenericCollection.prototype.deleteEach);
define("toArray", GenericCollection.prototype.toArray);
define("toObject", GenericCollection.prototype.toObject);
define("all", GenericCollection.prototype.all);
define("any", GenericCollection.prototype.any);
define("min", GenericCollection.prototype.min);
define("max", GenericCollection.prototype.max);
define("sum", GenericCollection.prototype.sum);
define("average", GenericCollection.prototype.average);
define("only", GenericCollection.prototype.only);
define("flatten", GenericCollection.prototype.flatten);
define("zip", GenericCollection.prototype.zip);
define("enumerate", GenericCollection.prototype.enumerate);
define("group", GenericCollection.prototype.group);
define("sorted", GenericCollection.prototype.sorted);
define("reversed", GenericCollection.prototype.reversed);

define("constructClone", function (values) {
    var clone = new this.constructor();
    clone.addEach(values);
    return clone;
});

define("has", function (value, equals) {
    return this.find(value, equals) !== -1;
});

define("get", function (index, defaultValue) {
    if (+index !== index)
        throw new Error("Indicies must be numbers");
    if (!index in this) {
        return defaultValue;
    } else {
        return this[index];
    }
});

define("set", function (index, value) {
    this[index] = value;
    return true;
});

define("add", function (value) {
    this.push(value);
    return true;
});

define("delete", function (value, equals) {
    var index = this.find(value, equals);
    if (index !== -1) {
        this.splice(index, 1);
        return true;
    }
    return false;
});

define("deleteAll", function (value, equals) {
    equals = equals || this.contentEquals || Object.equals;
    var count = 0;
    for (var index = 0; index < this.length;) {
        if (equals(value, this[index])) {
            this.swap(index, 1);
            count++;
        } else {
            index++;
        }
    }
    return count;
});

define("find", function (value, equals) {
    equals = equals || this.contentEquals || Object.equals;
    for (var index = 0; index < this.length; index++) {
        if (index in this && equals(value, this[index])) {
            return index;
        }
    }
    return -1;
});

define("findLast", function (value, equals) {
    equals = equals || this.contentEquals || Object.equals;
    var index = this.length;
    do {
        index--;
        if (index in this && equals(this[index], value)) {
            return index;
        }
    } while (index > 0);
    return -1;
});

define("swap", function (start, length, plus) {
    var args, plusLength, i, j, returnValue;
    if (start > this.length) {
        this.length = start;
    }
    if (typeof plus !== "undefined") {
        args = [start, length];
        if (!Array.isArray(plus)) {
            plus = array_slice.call(plus);
        }
        i = 0;
        plusLength = plus.length;
        // 1000 is a magic number, presumed to be smaller than the remaining
        // stack length. For swaps this small, we take the fast path and just
        // use the underlying Array splice. We could measure the exact size of
        // the remaining stack using a try/catch around an unbounded recursive
        // function, but this would defeat the purpose of short-circuiting in
        // the common case.
        if (plusLength < 1000) {
            for (i; i < plusLength; i++) {
                args[i+2] = plus[i];
            }
            return array_splice.apply(this, args);
        } else {
            // Avoid maximum call stack error.
            // First delete the desired entries.
            returnValue = array_splice.apply(this, args);
            // Second batch in 1000s.
            for (i; i < plusLength;) {
                args = [start+i, 0];
                for (j = 2; j < 1002 && i < plusLength; j++, i++) {
                    args[j] = plus[i];
                }
                array_splice.apply(this, args);
            }
            return returnValue;
        }
    // using call rather than apply to cut down on transient objects
    } else if (typeof length !== "undefined") {
        return array_splice.call(this, start, length);
    }  else if (typeof start !== "undefined") {
        return array_splice.call(this, start);
    } else {
        return [];
    }
});

define("peek", function () {
    return this[0];
});

define("poke", function (value) {
    if (this.length > 0) {
        this[0] = value;
    }
});

define("peekBack", function () {
    if (this.length > 0) {
        return this[this.length - 1];
    }
});

define("pokeBack", function (value) {
    if (this.length > 0) {
        this[this.length - 1] = value;
    }
});

define("one", function () {
    for (var i in this) {
        if (Object.owns(this, i)) {
            return this[i];
        }
    }
});

define("clear", function () {
    this.length = 0;
    return this;
});

define("compare", function (that, compare) {
    compare = compare || Object.compare;
    var i;
    var length;
    var lhs;
    var rhs;
    var relative;

    if (this === that) {
        return 0;
    }

    if (!that || !Array.isArray(that)) {
        return GenericOrder.prototype.compare.call(this, that, compare);
    }

    length = Math.min(this.length, that.length);

    for (i = 0; i < length; i++) {
        if (i in this) {
            if (!(i in that)) {
                return -1;
            } else {
                lhs = this[i];
                rhs = that[i];
                relative = compare(lhs, rhs);
                if (relative) {
                    return relative;
                }
            }
        } else if (i in that) {
            return 1;
        }
    }

    return this.length - that.length;
});

define("equals", function (that, equals) {
    equals = equals || Object.equals;
    var i = 0;
    var length = this.length;
    var left;
    var right;

    if (this === that) {
        return true;
    }
    if (!that || !Array.isArray(that)) {
        return GenericOrder.prototype.equals.call(this, that);
    }

    if (length !== that.length) {
        return false;
    } else {
        for (; i < length; ++i) {
            if (i in this) {
                if (!(i in that)) {
                    return false;
                }
                left = this[i];
                right = that[i];
                if (!equals(left, right)) {
                    return false;
                }
            } else {
                if (i in that) {
                    return false;
                }
            }
        }
    }
    return true;
});

define("clone", function (depth, memo) {
    if (depth == null) {
        depth = Infinity;
    } else if (depth === 0) {
        return this;
    }
    memo = memo || new WeakMap();
    if (memo.has(this)) {
        return memo.get(this);
    }
    var clone = new Array(this.length);
    memo.set(this, clone);
    for (var i in this) {
        clone[i] = Object.clone(this[i], depth - 1, memo);
    };
    return clone;
});

define("iterate", function (start, end) {
    return new ArrayIterator(this, start, end);
});

define("Iterator", ArrayIterator);

function ArrayIterator(array, start, end) {
    this.array = array;
    this.start = start == null ? 0 : start;
    this.end = end;
};

ArrayIterator.prototype.next = function () {
    if (this.start === (this.end == null ? this.array.length : this.end)) {
        throw StopIteration;
    } else {
        return this.array[this.start++];
    }
};


},{"./generic-collection":4,"./generic-order":6,"./shim-function":17,"weak-map":14}],17:[function(require,module,exports){

module.exports = Function;

/**
    A utility to reduce unnecessary allocations of <code>function () {}</code>
    in its many colorful variations.  It does nothing and returns
    <code>undefined</code> thus makes a suitable default in some circumstances.

    @function external:Function.noop
*/
Function.noop = function () {
};

/**
    A utility to reduce unnecessary allocations of <code>function (x) {return
    x}</code> in its many colorful but ultimately wasteful parameter name
    variations.

    @function external:Function.identity
    @param {Any} any value
    @returns {Any} that value
*/
Function.identity = function (value) {
    return value;
};

/**
    A utility for creating a comparator function for a particular aspect of a
    figurative class of objects.

    @function external:Function.by
    @param {Function} relation A function that accepts a value and returns a
    corresponding value to use as a representative when sorting that object.
    @param {Function} compare an alternate comparator for comparing the
    represented values.  The default is <code>Object.compare</code>, which
    does a deep, type-sensitive, polymorphic comparison.
    @returns {Function} a comparator that has been annotated with
    <code>by</code> and <code>compare</code> properties so
    <code>sorted</code> can perform a transform that reduces the need to call
    <code>by</code> on each sorted object to just once.
 */
Function.by = function (by , compare) {
    compare = compare || Object.compare;
    by = by || Function.identity;
    var compareBy = function (a, b) {
        return compare(by(a), by(b));
    };
    compareBy.compare = compare;
    compareBy.by = by;
    return compareBy;
};

// TODO document
Function.get = function (key) {
    return function (object) {
        return Object.get(object, key);
    };
};


},{}],18:[function(require,module,exports){
"use strict";

var WeakMap = require("weak-map");

module.exports = Object;

/*
    Based in part on extras from Motorola Mobility’s Montage
    Copyright (c) 2012, Motorola Mobility LLC. All Rights Reserved.
    3-Clause BSD License
    https://github.com/motorola-mobility/montage/blob/master/LICENSE.md
*/

/**
    Defines extensions to intrinsic <code>Object</code>.
    @see [Object class]{@link external:Object}
*/

/**
    A utility object to avoid unnecessary allocations of an empty object
    <code>{}</code>.  This object is frozen so it is safe to share.

    @object external:Object.empty
*/
Object.empty = Object.freeze(Object.create(null));

/**
    Returns whether the given value is an object, as opposed to a value.
    Unboxed numbers, strings, true, false, undefined, and null are not
    objects.  Arrays are objects.

    @function external:Object.isObject
    @param {Any} value
    @returns {Boolean} whether the given value is an object
*/
Object.isObject = function (object) {
    return Object(object) === object;
};

/**
    Returns the value of an any value, particularly objects that
    implement <code>valueOf</code>.

    <p>Note that, unlike the precedent of methods like
    <code>Object.equals</code> and <code>Object.compare</code> would suggest,
    this method is named <code>Object.getValueOf</code> instead of
    <code>valueOf</code>.  This is a delicate issue, but the basis of this
    decision is that the JavaScript runtime would be far more likely to
    accidentally call this method with no arguments, assuming that it would
    return the value of <code>Object</code> itself in various situations,
    whereas <code>Object.equals(Object, null)</code> protects against this case
    by noting that <code>Object</code> owns the <code>equals</code> property
    and therefore does not delegate to it.

    @function external:Object.getValueOf
    @param {Any} value a value or object wrapping a value
    @returns {Any} the primitive value of that object, if one exists, or passes
    the value through
*/
Object.getValueOf = function (value) {
    if (value && typeof value.valueOf === "function") {
        value = value.valueOf();
    }
    return value;
};

var hashMap = new WeakMap();
Object.hash = function (object) {
    if (object && typeof object.hash === "function") {
        return "" + object.hash();
    } else if (Object(object) === object) {
        if (!hashMap.has(object)) {
            hashMap.set(object, Math.random().toString(36).slice(2));
        }
        return hashMap.get(object);
    } else {
        return "" + object;
    }
};

/**
    A shorthand for <code>Object.prototype.hasOwnProperty.call(object,
    key)</code>.  Returns whether the object owns a property for the given key.
    It does not consult the prototype chain and works for any string (including
    "hasOwnProperty") except "__proto__".

    @function external:Object.owns
    @param {Object} object
    @param {String} key
    @returns {Boolean} whether the object owns a property wfor the given key.
*/
var owns = Object.prototype.hasOwnProperty;
Object.owns = function (object, key) {
    return owns.call(object, key);
};

/**
    A utility that is like Object.owns but is also useful for finding
    properties on the prototype chain, provided that they do not refer to
    methods on the Object prototype.  Works for all strings except "__proto__".

    <p>Alternately, you could use the "in" operator as long as the object
    descends from "null" instead of the Object.prototype, as with
    <code>Object.create(null)</code>.  However,
    <code>Object.create(null)</code> only works in fully compliant EcmaScript 5
    JavaScript engines and cannot be faithfully shimmed.

    <p>If the given object is an instance of a type that implements a method
    named "has", this function defers to the collection, so this method can be
    used to generically handle objects, arrays, or other collections.  In that
    case, the domain of the key depends on the instance.

    @param {Object} object
    @param {String} key
    @returns {Boolean} whether the object, or any of its prototypes except
    <code>Object.prototype</code>
    @function external:Object.has
*/
Object.has = function (object, key) {
    if (typeof object !== "object") {
        throw new Error("Object.has can't accept non-object: " + typeof object);
    }
    // forward to mapped collections that implement "has"
    if (object && typeof object.has === "function") {
        return object.has(key);
    // otherwise report whether the key is on the prototype chain,
    // as long as it is not one of the methods on object.prototype
    } else if (typeof key === "string") {
        return key in object && object[key] !== Object.prototype[key];
    } else {
        throw new Error("Key must be a string for Object.has on plain objects");
    }
};

/**
    Gets the value for a corresponding key from an object.

    <p>Uses Object.has to determine whether there is a corresponding value for
    the given key.  As such, <code>Object.get</code> is capable of retriving
    values from the prototype chain as long as they are not from the
    <code>Object.prototype</code>.

    <p>If there is no corresponding value, returns the given default, which may
    be <code>undefined</code>.

    <p>If the given object is an instance of a type that implements a method
    named "get", this function defers to the collection, so this method can be
    used to generically handle objects, arrays, or other collections.  In that
    case, the domain of the key depends on the implementation.  For a `Map`,
    for example, the key might be any object.

    @param {Object} object
    @param {String} key
    @param {Any} value a default to return, <code>undefined</code> if omitted
    @returns {Any} value for key, or default value
    @function external:Object.get
*/
Object.get = function (object, key, value) {
    if (typeof object !== "object") {
        throw new Error("Object.get can't accept non-object: " + typeof object);
    }
    // forward to mapped collections that implement "get"
    if (object && typeof object.get === "function") {
        return object.get(key, value);
    } else if (Object.has(object, key)) {
        return object[key];
    } else {
        return value;
    }
};

/**
    Sets the value for a given key on an object.

    <p>If the given object is an instance of a type that implements a method
    named "set", this function defers to the collection, so this method can be
    used to generically handle objects, arrays, or other collections.  As such,
    the key domain varies by the object type.

    @param {Object} object
    @param {String} key
    @param {Any} value
    @returns <code>undefined</code>
    @function external:Object.set
*/
Object.set = function (object, key, value) {
    if (object && typeof object.set === "function") {
        object.set(key, value);
    } else {
        object[key] = value;
    }
};

Object.addEach = function (target, source) {
    if (!source) {
    } else if (typeof source.forEach === "function" && !source.hasOwnProperty("forEach")) {
        // copy map-alikes
        if (source.isMap === true) {
            source.forEach(function (value, key) {
                target[key] = value;
            });
        // iterate key value pairs of other iterables
        } else {
            source.forEach(function (pair) {
                target[pair[0]] = pair[1];
            });
        }
    } else if (typeof source.length === "number") {
        // arguments, strings
        for (var index = 0; index < source.length; index++) {
            target[index] = source[index];
        }
    } else {
        // copy other objects as map-alikes
        Object.keys(source).forEach(function (key) {
            target[key] = source[key];
        });
    }
    return target;
};

/**
    Iterates over the owned properties of an object.

    @function external:Object.forEach
    @param {Object} object an object to iterate.
    @param {Function} callback a function to call for every key and value
    pair in the object.  Receives <code>value</code>, <code>key</code>,
    and <code>object</code> as arguments.
    @param {Object} thisp the <code>this</code> to pass through to the
    callback
*/
Object.forEach = function (object, callback, thisp) {
    Object.keys(object).forEach(function (key) {
        callback.call(thisp, object[key], key, object);
    });
};

/**
    Iterates over the owned properties of a map, constructing a new array of
    mapped values.

    @function external:Object.map
    @param {Object} object an object to iterate.
    @param {Function} callback a function to call for every key and value
    pair in the object.  Receives <code>value</code>, <code>key</code>,
    and <code>object</code> as arguments.
    @param {Object} thisp the <code>this</code> to pass through to the
    callback
    @returns {Array} the respective values returned by the callback for each
    item in the object.
*/
Object.map = function (object, callback, thisp) {
    return Object.keys(object).map(function (key) {
        return callback.call(thisp, object[key], key, object);
    });
};

/**
    Returns the values for owned properties of an object.

    @function external:Object.map
    @param {Object} object
    @returns {Array} the respective value for each owned property of the
    object.
*/
Object.values = function (object) {
    return Object.map(object, Function.identity);
};

// TODO inline document concat
Object.concat = function () {
    var object = {};
    for (var i = 0; i < arguments.length; i++) {
        Object.addEach(object, arguments[i]);
    }
    return object;
};

Object.from = Object.concat;

/**
    Returns whether two values are identical.  Any value is identical to itself
    and only itself.  This is much more restictive than equivalence and subtly
    different than strict equality, <code>===</code> because of edge cases
    including negative zero and <code>NaN</code>.  Identity is useful for
    resolving collisions among keys in a mapping where the domain is any value.
    This method does not delgate to any method on an object and cannot be
    overridden.
    @see http://wiki.ecmascript.org/doku.php?id=harmony:egal
    @param {Any} this
    @param {Any} that
    @returns {Boolean} whether this and that are identical
    @function external:Object.is
*/
Object.is = function (x, y) {
    if (x === y) {
        // 0 === -0, but they are not identical
        return x !== 0 || 1 / x === 1 / y;
    }
    // NaN !== NaN, but they are identical.
    // NaNs are the only non-reflexive value, i.e., if x !== x,
    // then x is a NaN.
    // isNaN is broken: it converts its argument to number, so
    // isNaN("foo") => true
    return x !== x && y !== y;
};

/**
    Performs a polymorphic, type-sensitive deep equivalence comparison of any
    two values.

    <p>As a basic principle, any value is equivalent to itself (as in
    identity), any boxed version of itself (as a <code>new Number(10)</code> is
    to 10), and any deep clone of itself.

    <p>Equivalence has the following properties:

    <ul>
        <li><strong>polymorphic:</strong>
            If the given object is an instance of a type that implements a
            methods named "equals", this function defers to the method.  So,
            this function can safely compare any values regardless of type,
            including undefined, null, numbers, strings, any pair of objects
            where either implements "equals", or object literals that may even
            contain an "equals" key.
        <li><strong>type-sensitive:</strong>
            Incomparable types are not equal.  No object is equivalent to any
            array.  No string is equal to any other number.
        <li><strong>deep:</strong>
            Collections with equivalent content are equivalent, recursively.
        <li><strong>equivalence:</strong>
            Identical values and objects are equivalent, but so are collections
            that contain equivalent content.  Whether order is important varies
            by type.  For Arrays and lists, order is important.  For Objects,
            maps, and sets, order is not important.  Boxed objects are mutally
            equivalent with their unboxed values, by virtue of the standard
            <code>valueOf</code> method.
    </ul>
    @param this
    @param that
    @returns {Boolean} whether the values are deeply equivalent
    @function external:Object.equals
*/
Object.equals = function (a, b, equals, memo) {
    equals = equals || Object.equals;
    // unbox objects, but do not confuse object literals
    a = Object.getValueOf(a);
    b = Object.getValueOf(b);
    if (a === b)
        return true;
    if (Object.isObject(a)) {
        memo = memo || new WeakMap();
        if (memo.has(a)) {
            return true;
        }
        memo.set(a, true);
    }
    if (Object.isObject(a) && typeof a.equals === "function") {
        return a.equals(b, equals, memo);
    }
    // commutative
    if (Object.isObject(b) && typeof b.equals === "function") {
        return b.equals(a, equals, memo);
    }
    if (Object.isObject(a) && Object.isObject(b)) {
        if (Object.getPrototypeOf(a) === Object.prototype && Object.getPrototypeOf(b) === Object.prototype) {
            for (var name in a) {
                if (!equals(a[name], b[name], equals, memo)) {
                    return false;
                }
            }
            for (var name in b) {
                if (!(name in a) || !equals(b[name], a[name], equals, memo)) {
                    return false;
                }
            }
            return true;
        }
    }
    // NaN !== NaN, but they are equal.
    // NaNs are the only non-reflexive value, i.e., if x !== x,
    // then x is a NaN.
    // isNaN is broken: it converts its argument to number, so
    // isNaN("foo") => true
    // We have established that a !== b, but if a !== a && b !== b, they are
    // both NaN.
    if (a !== a && b !== b)
        return true;
    if (!a || !b)
        return a === b;
    return false;
};

// Because a return value of 0 from a `compare` function  may mean either
// "equals" or "is incomparable", `equals` cannot be defined in terms of
// `compare`.  However, `compare` *can* be defined in terms of `equals` and
// `lessThan`.  Again however, more often it would be desirable to implement
// all of the comparison functions in terms of compare rather than the other
// way around.

/**
    Determines the order in which any two objects should be sorted by returning
    a number that has an analogous relationship to zero as the left value to
    the right.  That is, if the left is "less than" the right, the returned
    value will be "less than" zero, where "less than" may be any other
    transitive relationship.

    <p>Arrays are compared by the first diverging values, or by length.

    <p>Any two values that are incomparable return zero.  As such,
    <code>equals</code> should not be implemented with <code>compare</code>
    since incomparability is indistinguishable from equality.

    <p>Sorts strings lexicographically.  This is not suitable for any
    particular international setting.  Different locales sort their phone books
    in very different ways, particularly regarding diacritics and ligatures.

    <p>If the given object is an instance of a type that implements a method
    named "compare", this function defers to the instance.  The method does not
    need to be an owned property to distinguish it from an object literal since
    object literals are incomparable.  Unlike <code>Object</code> however,
    <code>Array</code> implements <code>compare</code>.

    @param {Any} left
    @param {Any} right
    @returns {Number} a value having the same transitive relationship to zero
    as the left and right values.
    @function external:Object.compare
*/
Object.compare = function (a, b) {
    // unbox objects, but do not confuse object literals
    // mercifully handles the Date case
    a = Object.getValueOf(a);
    b = Object.getValueOf(b);
    if (a === b)
        return 0;
    var aType = typeof a;
    var bType = typeof b;
    if (aType === "number" && bType === "number")
        return a - b;
    if (aType === "string" && bType === "string")
        return a < b ? -Infinity : Infinity;
        // the possibility of equality elimiated above
    if (a && typeof a.compare === "function")
        return a.compare(b);
    // not commutative, the relationship is reversed
    if (b && typeof b.compare === "function")
        return -b.compare(a);
    return 0;
};

/**
    Creates a deep copy of any value.  Values, being immutable, are
    returned without alternation.  Forwards to <code>clone</code> on
    objects and arrays.

    @function external:Object.clone
    @param {Any} value a value to clone
    @param {Number} depth an optional traversal depth, defaults to infinity.
    A value of <code>0</code> means to make no clone and return the value
    directly.
    @param {Map} memo an optional memo of already visited objects to preserve
    reference cycles.  The cloned object will have the exact same shape as the
    original, but no identical objects.  Te map may be later used to associate
    all objects in the original object graph with their corresponding member of
    the cloned graph.
    @returns a copy of the value
*/
Object.clone = function (value, depth, memo) {
    value = Object.getValueOf(value);
    memo = memo || new WeakMap();
    if (depth === undefined) {
        depth = Infinity;
    } else if (depth === 0) {
        return value;
    }
    if (Object.isObject(value)) {
        if (!memo.has(value)) {
            if (value && typeof value.clone === "function") {
                memo.set(value, value.clone(depth, memo));
            } else {
                var prototype = Object.getPrototypeOf(value);
                if (prototype === null || prototype === Object.prototype) {
                    var clone = Object.create(prototype);
                    memo.set(value, clone);
                    for (var key in value) {
                        clone[key] = Object.clone(value[key], depth - 1, memo);
                    }
                } else {
                    throw new Error("Can't clone " + value);
                }
            }
        }
        return memo.get(value);
    }
    return value;
};

/**
    Removes all properties owned by this object making the object suitable for
    reuse.

    @function external:Object.clear
    @returns this
*/
Object.clear = function (object) {
    if (object && typeof object.clear === "function") {
        object.clear();
    } else {
        var keys = Object.keys(object),
            i = keys.length;
        while (i) {
            i--;
            delete object[keys[i]];
        }
    }
    return object;
};


},{"weak-map":14}],19:[function(require,module,exports){

/**
    accepts a string; returns the string with regex metacharacters escaped.
    the returned string can safely be used within a regex to match a literal
    string. escaped characters are [, ], {, }, (, ), -, *, +, ?, ., \, ^, $,
    |, #, [comma], and whitespace.
*/
if (!RegExp.escape) {
    var special = /[-[\]{}()*+?.\\^$|,#\s]/g;
    RegExp.escape = function (string) {
        return string.replace(special, "\\$&");
    };
}


},{}],20:[function(require,module,exports){

var Array = require("./shim-array");
var Object = require("./shim-object");
var Function = require("./shim-function");
var RegExp = require("./shim-regexp");


},{"./shim-array":16,"./shim-function":17,"./shim-object":18,"./shim-regexp":19}],21:[function(require,module,exports){
"use strict";

module.exports = TreeLog;

function TreeLog() {
}

TreeLog.ascii = {
    intersection: "+",
    through: "-",
    branchUp: "+",
    branchDown: "+",
    fromBelow: ".",
    fromAbove: "'",
    fromBoth: "+",
    strafe: "|"
};

TreeLog.unicodeRound = {
    intersection: "\u254b",
    through: "\u2501",
    branchUp: "\u253b",
    branchDown: "\u2533",
    fromBelow: "\u256d", // round corner
    fromAbove: "\u2570", // round corner
    fromBoth: "\u2523",
    strafe: "\u2503"
};

TreeLog.unicodeSharp = {
    intersection: "\u254b",
    through: "\u2501",
    branchUp: "\u253b",
    branchDown: "\u2533",
    fromBelow: "\u250f", // sharp corner
    fromAbove: "\u2517", // sharp corner
    fromBoth: "\u2523",
    strafe: "\u2503"
};


},{}],22:[function(require,module,exports){

/**
 * Expose `Delegator`.
 */

module.exports = Delegator;

/**
 * Initialize a delegator.
 *
 * @param {Object} proto
 * @param {String} target
 * @api public
 */

function Delegator(proto, target) {
  if (!(this instanceof Delegator)) return new Delegator(proto, target);
  this.proto = proto;
  this.target = target;
  this.methods = [];
  this.getters = [];
  this.setters = [];
}

/**
 * Delegate method `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

Delegator.prototype.method = function(name){
  var proto = this.proto;
  var target = this.target;
  this.methods.push(name);

  proto[name] = function(){
    return this[target][name].apply(this[target], arguments);
  };

  return this;
};

/**
 * Delegator accessor `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

Delegator.prototype.access = function(name){
  return this.getter(name).setter(name);
};

/**
 * Delegator getter `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

Delegator.prototype.getter = function(name){
  var proto = this.proto;
  var target = this.target;
  this.getters.push(name);

  proto.__defineGetter__(name, function(){
    return this[target][name];
  });

  return this;
};

/**
 * Delegator setter `name`.
 *
 * @param {String} name
 * @return {Delegator} self
 * @api public
 */

Delegator.prototype.setter = function(name){
  var proto = this.proto;
  var target = this.target;
  this.setters.push(name);

  proto.__defineSetter__(name, function(val){
    return this[target][name] = val;
  });

  return this;
};
},{}],23:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
	"use strict";
	if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval) {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	"use strict";
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === "boolean") {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if (typeof target !== "object" && typeof target !== "function" || target == undefined) {
			target = {};
	}

	for (; i < length; ++i) {
		// Only deal with non-null/undefined values
		if ((options = arguments[i]) != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && Array.isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],24:[function(require,module,exports){

/**!
 * is
 * the definitive JavaScript type testing library
 * 
 * @copyright 2013 Enrico Marino
 * @license MIT
 */

var objProto = Object.prototype;
var owns = objProto.hasOwnProperty;
var toString = objProto.toString;
var isActualNaN = function (value) {
  return value !== value;
};
var NON_HOST_TYPES = {
  "boolean": 1,
  "number": 1,
  "string": 1,
  "undefined": 1
};

/**
 * Expose `is`
 */

var is = module.exports = {};

/**
 * Test general.
 */

/**
 * is.type
 * Test if `value` is a type of `type`.
 *
 * @param {Mixed} value value to test
 * @param {String} type type
 * @return {Boolean} true if `value` is a type of `type`, false otherwise
 * @api public
 */

is.a =
is.type = function (value, type) {
  return typeof value === type;
};

/**
 * is.defined
 * Test if `value` is defined.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if 'value' is defined, false otherwise
 * @api public
 */

is.defined = function (value) {
  return value !== undefined;
};

/**
 * is.empty
 * Test if `value` is empty.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is empty, false otherwise
 * @api public
 */

is.empty = function (value) {
  var type = toString.call(value);
  var key;

  if ('[object Array]' === type || '[object Arguments]' === type) {
    return value.length === 0;
  }

  if ('[object Object]' === type) {
    for (key in value) if (owns.call(value, key)) return false;
    return true;
  }

  if ('[object String]' === type) {
    return '' === value;
  }

  return false;
};

/**
 * is.equal
 * Test if `value` is equal to `other`.
 *
 * @param {Mixed} value value to test
 * @param {Mixed} other value to compare with
 * @return {Boolean} true if `value` is equal to `other`, false otherwise
 */

is.equal = function (value, other) {
  var strictlyEqual = value === other;
  if (strictlyEqual) {
    return true;
  }

  var type = toString.call(value);
  var key;

  if (type !== toString.call(other)) {
    return false;
  }

  if ('[object Object]' === type) {
    for (key in value) {
      if (!is.equal(value[key], other[key]) || !(key in other)) {
        return false;
      }
    }
    for (key in other) {
      if (!is.equal(value[key], other[key]) || !(key in value)) {
        return false;
      }
    }
    return true;
  }

  if ('[object Array]' === type) {
    key = value.length;
    if (key !== other.length) {
      return false;
    }
    while (--key) {
      if (!is.equal(value[key], other[key])) {
        return false;
      }
    }
    return true;
  }

  if ('[object Function]' === type) {
    return value.prototype === other.prototype;
  }

  if ('[object Date]' === type) {
    return value.getTime() === other.getTime();
  }

  return strictlyEqual;
};

/**
 * is.hosted
 * Test if `value` is hosted by `host`.
 *
 * @param {Mixed} value to test
 * @param {Mixed} host host to test with
 * @return {Boolean} true if `value` is hosted by `host`, false otherwise
 * @api public
 */

is.hosted = function (value, host) {
  var type = typeof host[value];
  return type === 'object' ? !!host[value] : !NON_HOST_TYPES[type];
};

/**
 * is.instance
 * Test if `value` is an instance of `constructor`.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is an instance of `constructor`
 * @api public
 */

is.instance = is['instanceof'] = function (value, constructor) {
  return value instanceof constructor;
};

/**
 * is.null
 * Test if `value` is null.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is null, false otherwise
 * @api public
 */

is['null'] = function (value) {
  return value === null;
};

/**
 * is.undef
 * Test if `value` is undefined.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is undefined, false otherwise
 * @api public
 */

is.undef = is['undefined'] = function (value) {
  return value === undefined;
};

/**
 * Test arguments.
 */

/**
 * is.args
 * Test if `value` is an arguments object.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is an arguments object, false otherwise
 * @api public
 */

is.args = is['arguments'] = function (value) {
  var isStandardArguments = '[object Arguments]' === toString.call(value);
  var isOldArguments = !is.array(value) && is.arraylike(value) && is.object(value) && is.fn(value.callee);
  return isStandardArguments || isOldArguments;
};

/**
 * Test array.
 */

/**
 * is.array
 * Test if 'value' is an array.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is an array, false otherwise
 * @api public
 */

is.array = function (value) {
  return '[object Array]' === toString.call(value);
};

/**
 * is.arguments.empty
 * Test if `value` is an empty arguments object.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is an empty arguments object, false otherwise
 * @api public
 */
is.args.empty = function (value) {
  return is.args(value) && value.length === 0;
};

/**
 * is.array.empty
 * Test if `value` is an empty array.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is an empty array, false otherwise
 * @api public
 */
is.array.empty = function (value) {
  return is.array(value) && value.length === 0;
};

/**
 * is.arraylike
 * Test if `value` is an arraylike object.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is an arguments object, false otherwise
 * @api public
 */

is.arraylike = function (value) {
  return !!value && !is.boolean(value)
    && owns.call(value, 'length')
    && isFinite(value.length)
    && is.number(value.length)
    && value.length >= 0;
};

/**
 * Test boolean.
 */

/**
 * is.boolean
 * Test if `value` is a boolean.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is a boolean, false otherwise
 * @api public
 */

is.boolean = function (value) {
  return '[object Boolean]' === toString.call(value);
};

/**
 * is.false
 * Test if `value` is false.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is false, false otherwise
 * @api public
 */

is['false'] = function (value) {
  return is.boolean(value) && (value === false || value.valueOf() === false);
};

/**
 * is.true
 * Test if `value` is true.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is true, false otherwise
 * @api public
 */

is['true'] = function (value) {
  return is.boolean(value) && (value === true || value.valueOf() === true);
};

/**
 * Test date.
 */

/**
 * is.date
 * Test if `value` is a date.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is a date, false otherwise
 * @api public
 */

is.date = function (value) {
  return '[object Date]' === toString.call(value);
};

/**
 * Test element.
 */

/**
 * is.element
 * Test if `value` is an html element.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is an HTML Element, false otherwise
 * @api public
 */

is.element = function (value) {
  return value !== undefined
    && typeof HTMLElement !== 'undefined'
    && value instanceof HTMLElement
    && value.nodeType === 1;
};

/**
 * Test error.
 */

/**
 * is.error
 * Test if `value` is an error object.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is an error object, false otherwise
 * @api public
 */

is.error = function (value) {
  return '[object Error]' === toString.call(value);
};

/**
 * Test function.
 */

/**
 * is.fn / is.function (deprecated)
 * Test if `value` is a function.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is a function, false otherwise
 * @api public
 */

is.fn = is['function'] = function (value) {
  var isAlert = typeof window !== 'undefined' && value === window.alert;
  return isAlert || '[object Function]' === toString.call(value);
};

/**
 * Test number.
 */

/**
 * is.number
 * Test if `value` is a number.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is a number, false otherwise
 * @api public
 */

is.number = function (value) {
  return '[object Number]' === toString.call(value);
};

/**
 * is.infinite
 * Test if `value` is positive or negative infinity.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is positive or negative Infinity, false otherwise
 * @api public
 */
is.infinite = function (value) {
  return value === Infinity || value === -Infinity;
};

/**
 * is.decimal
 * Test if `value` is a decimal number.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is a decimal number, false otherwise
 * @api public
 */

is.decimal = function (value) {
  return is.number(value) && !isActualNaN(value) && !is.infinite(value) && value % 1 !== 0;
};

/**
 * is.divisibleBy
 * Test if `value` is divisible by `n`.
 *
 * @param {Number} value value to test
 * @param {Number} n dividend
 * @return {Boolean} true if `value` is divisible by `n`, false otherwise
 * @api public
 */

is.divisibleBy = function (value, n) {
  var isDividendInfinite = is.infinite(value);
  var isDivisorInfinite = is.infinite(n);
  var isNonZeroNumber = is.number(value) && !isActualNaN(value) && is.number(n) && !isActualNaN(n) && n !== 0;
  return isDividendInfinite || isDivisorInfinite || (isNonZeroNumber && value % n === 0);
};

/**
 * is.int
 * Test if `value` is an integer.
 *
 * @param value to test
 * @return {Boolean} true if `value` is an integer, false otherwise
 * @api public
 */

is.int = function (value) {
  return is.number(value) && !isActualNaN(value) && value % 1 === 0;
};

/**
 * is.maximum
 * Test if `value` is greater than 'others' values.
 *
 * @param {Number} value value to test
 * @param {Array} others values to compare with
 * @return {Boolean} true if `value` is greater than `others` values
 * @api public
 */

is.maximum = function (value, others) {
  if (isActualNaN(value)) {
    throw new TypeError('NaN is not a valid value');
  } else if (!is.arraylike(others)) {
    throw new TypeError('second argument must be array-like');
  }
  var len = others.length;

  while (--len >= 0) {
    if (value < others[len]) {
      return false;
    }
  }

  return true;
};

/**
 * is.minimum
 * Test if `value` is less than `others` values.
 *
 * @param {Number} value value to test
 * @param {Array} others values to compare with
 * @return {Boolean} true if `value` is less than `others` values
 * @api public
 */

is.minimum = function (value, others) {
  if (isActualNaN(value)) {
    throw new TypeError('NaN is not a valid value');
  } else if (!is.arraylike(others)) {
    throw new TypeError('second argument must be array-like');
  }
  var len = others.length;

  while (--len >= 0) {
    if (value > others[len]) {
      return false;
    }
  }

  return true;
};

/**
 * is.nan
 * Test if `value` is not a number.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is not a number, false otherwise
 * @api public
 */

is.nan = function (value) {
  return !is.number(value) || value !== value;
};

/**
 * is.even
 * Test if `value` is an even number.
 *
 * @param {Number} value value to test
 * @return {Boolean} true if `value` is an even number, false otherwise
 * @api public
 */

is.even = function (value) {
  return is.infinite(value) || (is.number(value) && value === value && value % 2 === 0);
};

/**
 * is.odd
 * Test if `value` is an odd number.
 *
 * @param {Number} value value to test
 * @return {Boolean} true if `value` is an odd number, false otherwise
 * @api public
 */

is.odd = function (value) {
  return is.infinite(value) || (is.number(value) && value === value && value % 2 !== 0);
};

/**
 * is.ge
 * Test if `value` is greater than or equal to `other`.
 *
 * @param {Number} value value to test
 * @param {Number} other value to compare with
 * @return {Boolean}
 * @api public
 */

is.ge = function (value, other) {
  if (isActualNaN(value) || isActualNaN(other)) {
    throw new TypeError('NaN is not a valid value');
  }
  return !is.infinite(value) && !is.infinite(other) && value >= other;
};

/**
 * is.gt
 * Test if `value` is greater than `other`.
 *
 * @param {Number} value value to test
 * @param {Number} other value to compare with
 * @return {Boolean}
 * @api public
 */

is.gt = function (value, other) {
  if (isActualNaN(value) || isActualNaN(other)) {
    throw new TypeError('NaN is not a valid value');
  }
  return !is.infinite(value) && !is.infinite(other) && value > other;
};

/**
 * is.le
 * Test if `value` is less than or equal to `other`.
 *
 * @param {Number} value value to test
 * @param {Number} other value to compare with
 * @return {Boolean} if 'value' is less than or equal to 'other'
 * @api public
 */

is.le = function (value, other) {
  if (isActualNaN(value) || isActualNaN(other)) {
    throw new TypeError('NaN is not a valid value');
  }
  return !is.infinite(value) && !is.infinite(other) && value <= other;
};

/**
 * is.lt
 * Test if `value` is less than `other`.
 *
 * @param {Number} value value to test
 * @param {Number} other value to compare with
 * @return {Boolean} if `value` is less than `other`
 * @api public
 */

is.lt = function (value, other) {
  if (isActualNaN(value) || isActualNaN(other)) {
    throw new TypeError('NaN is not a valid value');
  }
  return !is.infinite(value) && !is.infinite(other) && value < other;
};

/**
 * is.within
 * Test if `value` is within `start` and `finish`.
 *
 * @param {Number} value value to test
 * @param {Number} start lower bound
 * @param {Number} finish upper bound
 * @return {Boolean} true if 'value' is is within 'start' and 'finish'
 * @api public
 */
is.within = function (value, start, finish) {
  if (isActualNaN(value) || isActualNaN(start) || isActualNaN(finish)) {
    throw new TypeError('NaN is not a valid value');
  } else if (!is.number(value) || !is.number(start) || !is.number(finish)) {
    throw new TypeError('all arguments must be numbers');
  }
  var isAnyInfinite = is.infinite(value) || is.infinite(start) || is.infinite(finish);
  return isAnyInfinite || (value >= start && value <= finish);
};

/**
 * Test object.
 */

/**
 * is.object
 * Test if `value` is an object.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is an object, false otherwise
 * @api public
 */

is.object = function (value) {
  return value && '[object Object]' === toString.call(value);
};

/**
 * is.hash
 * Test if `value` is a hash - a plain object literal.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is a hash, false otherwise
 * @api public
 */

is.hash = function (value) {
  return is.object(value) && value.constructor === Object && !value.nodeType && !value.setInterval;
};

/**
 * Test regexp.
 */

/**
 * is.regexp
 * Test if `value` is a regular expression.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if `value` is a regexp, false otherwise
 * @api public
 */

is.regexp = function (value) {
  return '[object RegExp]' === toString.call(value);
};

/**
 * Test string.
 */

/**
 * is.string
 * Test if `value` is a string.
 *
 * @param {Mixed} value value to test
 * @return {Boolean} true if 'value' is a string, false otherwise
 * @api public
 */

is.string = function (value) {
  return '[object String]' === toString.call(value);
};


},{}],25:[function(require,module,exports){
module.exports = require('./lib/math.js');

},{"./lib/math.js":265}],26:[function(require,module,exports){
module.exports = function (math) {
  var string = require('../util/string');

  /**
   * @constructor Selector
   * Wrap any value in a Selector, allowing to perform chained operations on
   * the value.
   *
   * All methods available in the math.js library can be called upon the selector,
   * and then will be evaluated with the value itself as first argument.
   * The selector can be closed by executing selector.done(), which will return
   * the final value.
   *
   * The Selector has a number of special functions:
   * - done()             Finalize the chained operation and return the
   *                      selectors value.
   * - valueOf()          The same as done()
   * - toString()         Returns a string representation of the selectors value.
   *
   * @param {*} [value]
   */
  function Selector (value) {
    if (!(this instanceof Selector)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    if (value instanceof Selector) {
      this.value = value.value;
    }
    else {
      this.value = value;
    }
  }

  /**
   * Close the selector. Returns the final value.
   * Does the same as method valueOf()
   * @returns {*} value
   */
  Selector.prototype.done = function () {
    return this.value;
  };

  /**
   * Close the selector. Returns the final value.
   * Does the same as method done()
   * @returns {*} value
   */
  Selector.prototype.valueOf = function () {
    return this.value;
  };

  /**
   * Get a string representation of the value in the selector
   * @returns {String}
   */
  Selector.prototype.toString = function () {
    return string.format(this.value);
  };

  /**
   * Create a proxy method for the selector
   * @param {String} name
   * @param {*} value       The value or function to be proxied
   */
  function createProxy(name, value) {
    var slice = Array.prototype.slice;
    if (typeof value === 'function') {
      // a function
      Selector.prototype[name] = function () {
        var args = [this.value].concat(slice.call(arguments, 0));
        return new Selector(value.apply(this, args));
      }
    }
    else {
      // a constant
      Selector.prototype[name] = new Selector(value);
    }
  }

  Selector.createProxy = createProxy;

  /**
   * initialise the Chain prototype with all functions and constants in math
   */
  for (var prop in math) {
    if (math.hasOwnProperty(prop)) {
      createProxy(prop, math[prop]);
    }
  }

  return Selector;
};

},{"../util/string":280}],27:[function(require,module,exports){
module.exports = function (math) {
  var Complex = require('./type/Complex');

  math.pi          = Math.PI;
  math.e           = Math.E;
  math.tau         = Math.PI * 2;
  math.i           = new Complex(0, 1);

  math['Infinity'] = Infinity;
  math['NaN']      = NaN;
  math['true']     = true;
  math['false']    = false;

  // uppercase constants (for compatibility with built-in Math)
  math.E           = Math.E;
  math.LN2         = Math.LN2;
  math.LN10        = Math.LN10;
  math.LOG2E       = Math.LOG2E;
  math.LOG10E      = Math.LOG10E;
  math.PI          = Math.PI;
  math.SQRT1_2     = Math.SQRT1_2;
  math.SQRT2       = Math.SQRT2;
};

},{"./type/Complex":266}],28:[function(require,module,exports){
/**
 * Create a syntax error with the message:
 *     'Wrong number of arguments in function <fn> (<count> provided, <min>-<max> expected)'
 * @param {String} fn     Function name
 * @param {Number} count  Actual argument count
 * @param {Number} min    Minimum required argument count
 * @param {Number} [max]  Maximum required argument count
 * @extends Error
 */
function ArgumentsError(fn, count, min, max) {
  if (!(this instanceof ArgumentsError)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  this.fn = fn;
  this.count = count;
  this.min = min;
  this.max = max;

  this.message = 'Wrong number of arguments in function ' + fn +
      ' (' + count + ' provided, ' +
      min + ((max != undefined) ? ('-' + max) : '') + ' expected)';

  this.stack = (new Error()).stack;
}

ArgumentsError.prototype = new Error();
ArgumentsError.prototype.constructor = Error;
ArgumentsError.prototype.name = 'ArgumentsError';

module.exports = ArgumentsError;

},{}],29:[function(require,module,exports){
/**
 * Create a range error with the message:
 *     'Dimension mismatch (<actual size> != <expected size>)'
 * @param {number | number[]} actual        The actual size
 * @param {number | number[]} expected      The expected size
 * @param {string} [relation='!=']          Optional relation between actual
 *                                          and expected size: '!=', '<', etc.
 * @extends RangeError
 */
function DimensionError(actual, expected, relation) {
  if (!(this instanceof DimensionError)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  this.actual   = actual;
  this.expected = expected;
  this.relation = relation;

  this.message = 'Dimension mismatch (' +
      (Array.isArray(actual) ? ('[' + actual.join(', ') + ']') : actual) +
      ' ' + (this.relation || '!=') + ' ' +
      (Array.isArray(expected) ? ('[' + expected.join(', ') + ']') : expected) +
      ')';

  this.stack = (new Error()).stack;
}

DimensionError.prototype = new RangeError();
DimensionError.prototype.constructor = RangeError;
DimensionError.prototype.name = 'DimensionError';

module.exports = DimensionError;

},{}],30:[function(require,module,exports){
/**
 * Create a range error with the message:
 *     'Index out of range (index < min)'
 *     'Index out of range (index < max)'
 *
 * @param {number} index     The actual index
 * @param {number} [min=0]   Minimum index (included)
 * @param {number} [max]     Maximum index (excluded)
 * @extends RangeError
 */
function IndexError(index, min, max) {
  if (!(this instanceof IndexError)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  this.index = index;
  if (arguments.length < 3) {
    this.min = 0;
    this.max = min;
  }
  else {
    this.min = min;
    this.max = max;
  }

  if (this.min !== undefined && this.index < this.min) {
    this.message = 'Index out of range (' + this.index + ' < ' + this.min + ')';
  }
  else if (this.max !== undefined && this.index >= this.max) {
    this.message = 'Index out of range (' + this.index + ' > ' + (this.max - 1) + ')';
  }
  else {
    this.message = 'Index out of range (' + this.index + ')';
  }

  this.stack = (new Error()).stack;
}

IndexError.prototype = new RangeError();
IndexError.prototype.constructor = RangeError;
IndexError.prototype.name = 'IndexError';

module.exports = IndexError;

},{}],31:[function(require,module,exports){
/**
 * Create a TypeError with message:
 *      'Function <fn> does not support a parameter of type <type>';
 * @param {String} fn     Function name
 * @param {*...} [types]  The types of the function arguments
 * @extends TypeError
 */
function UnsupportedTypeError(fn, types) {
  if (!(this instanceof UnsupportedTypeError)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  this.fn = fn;
  this.types = Array.prototype.splice.call(arguments, 1);

  if (!fn) {
    this.message = 'Unsupported type of argument';
  }
  else {
    if (this.types.length == 0) {
      this.message = 'Unsupported type of argument in function ' + fn;
    }
    else {
      this.message = 'Function ' + fn + '(' + this.types.join(', ') + ') not supported';
    }
  }

  this.stack = (new Error()).stack;
}

UnsupportedTypeError.prototype = new TypeError();
UnsupportedTypeError.prototype.constructor = TypeError;
UnsupportedTypeError.prototype.name = 'UnsupportedTypeError';

module.exports = UnsupportedTypeError;

},{}],32:[function(require,module,exports){
exports.ArgumentsError = require('./ArgumentsError');
exports.DimensionError = require('./DimensionError');
exports.IndexError = require('./IndexError');
exports.UnsupportedTypeError = require('./UnsupportedTypeError');

// TODO: implement an InvalidValueError?

},{"./ArgumentsError":28,"./DimensionError":29,"./IndexError":30,"./UnsupportedTypeError":31}],33:[function(require,module,exports){
var _parse = require('./parse');

/**
 * @constructor Parser
 * Parser contains methods to evaluate or parse expressions, and has a number
 * of convenience methods to get, set, and remove variables from memory. Parser
 * keeps a scope containing variables in memory, which is used for all
 * evaluations.
 *
 * Methods:
 *    var result = parser.eval(expr);    // evaluate an expression
 *    var value = parser.get(name);      // retrieve a variable from the parser
 *    parser.set(name, value);           // set a variable in the parser
 *    parser.remove(name);               // clear a variable from the
 *                                       // parsers scope
 *    parser.clear();                    // clear the parsers scope
 *
 * Example usage:
 *    var parser = new Parser(math);
 *    // Note: there is a convenience method which can be used instead:
 *    // var parser = new math.parser();
 *
 *    // evaluate expressions
 *    parser.eval('sqrt(3^2 + 4^2)');         // 5
 *    parser.eval('sqrt(-4)');                // 2i
 *    parser.eval('2 inch in cm');            // 5.08 cm
 *    parser.eval('cos(45 deg)');             // 0.7071067811865476
 *
 *    // define variables and functions
 *    parser.eval('x = 7 / 2');               // 3.5
 *    parser.eval('x + 3');                   // 6.5
 *    parser.eval('function f(x, y) = x^y');  // f(x, y)
 *    parser.eval('f(2, 3)');                 // 8
 *
 *    // get and set variables and functions
 *    var x = parser.get('x');                // 7
 *    var f = parser.get('f');                // function
 *    var g = f(3, 2);                        // 9
 *    parser.set('h', 500);
 *    var i = parser.eval('h / 2');           // 250
 *    parser.set('hello', function (name) {
 *        return 'hello, ' + name + '!';
 *    });
 *    parser.eval('hello("user")');           // "hello, user!"
 *
 *    // clear defined functions and variables
 *    parser.clear();
 *
 *
 * @param {Object} math     Link to the math.js namespace
 */
function Parser(math) {
  if (!(this instanceof Parser)) {
    throw new SyntaxError(
        'Constructor must be called with the new operator');
  }

  if (typeof math !== 'object') {
    throw new TypeError('Object expected as parameter math');
  }

  this.math = math;
  this.scope = {};
}

/**
 * Parse an expression and return the parsed function node.
 * The node tree can be compiled via `code = node.compile(math)`,
 * and the compiled code can be executed as `code.eval([scope])`
 * @param {String} expr
 * @return {Node} node
 * @throws {Error}
 */
Parser.prototype.parse = function (expr) {
  throw new Error('Parser.parse is deprecated. Use math.parse instead.');
};

/**
 * Parse and compile an expression, return the compiled javascript code.
 * The node can be evaluated via code.eval([scope])
 * @param {String} expr
 * @return {{eval: function}} code
 * @throws {Error}
 */
Parser.prototype.compile = function (expr) {
  throw new Error('Parser.compile is deprecated. Use math.compile instead.');
};

/**
 * Parse and evaluate the given expression
 * @param {String} expr   A string containing an expression, for example "2+3"
 * @return {*} result     The result, or undefined when the expression was empty
 * @throws {Error}
 */
Parser.prototype.eval = function (expr) {
  // TODO: validate arguments
  return _parse(expr)
      .compile(this.math)
      .eval(this.scope);
};

/**
 * Get a variable (a function or variable) by name from the parsers scope.
 * Returns undefined when not found
 * @param {String} name
 * @return {* | undefined} value
 */
Parser.prototype.get = function (name) {
  // TODO: validate arguments
  return this.scope[name];
};

/**
 * Set a symbol (a function or variable) by name from the parsers scope.
 * @param {String} name
 * @param {* | undefined} value
 */
Parser.prototype.set = function (name, value) {
  // TODO: validate arguments
  return this.scope[name] = value;
};

/**
 * Remove a variable from the parsers scope
 * @param {String} name
 */
Parser.prototype.remove = function (name) {
  // TODO: validate arguments
  delete this.scope[name];
};

/**
 * Clear the scope with variables and functions
 */
Parser.prototype.clear = function () {
  for (var name in this.scope) {
    if (this.scope.hasOwnProperty(name)) {
      delete this.scope[name];
    }
  }
};

module.exports = Parser;

},{"./parse":163}],34:[function(require,module,exports){
module.exports = {
  'name': 'Infinity',
  'category': 'Constants',
  'syntax': [
    'Infinity'
  ],
  'description': 'Infinity, a number which is larger than the maximum number that can be handled by a floating point number.',
  'examples': [
    'Infinity',
    '1 / 0'
  ],
  'seealso': []
};

},{}],35:[function(require,module,exports){
module.exports = {
  'name': 'LN10',
  'category': 'Constants',
  'syntax': [
    'LN10'
  ],
  'description': 'Returns the natural logarithm of 10, approximately equal to 2.302',
  'examples': [
    'LN10',
    'log(10)'
  ],
  'seealso': []
};

},{}],36:[function(require,module,exports){
module.exports = {
  'name': 'LN2',
  'category': 'Constants',
  'syntax': [
    'LN2'
  ],
  'description': 'Returns the natural logarithm of 2, approximately equal to 0.693',
  'examples': [
    'LN2',
    'log(2)'
  ],
  'seealso': []
};

},{}],37:[function(require,module,exports){
module.exports = {
  'name': 'LOG10E',
  'category': 'Constants',
  'syntax': [
    'LOG10E'
  ],
  'description': 'Returns the base-10 logarithm of E, approximately equal to 0.434',
  'examples': [
    'LOG10E',
    'log(e, 10)'
  ],
  'seealso': []
};

},{}],38:[function(require,module,exports){
module.exports = {
  'name': 'LOG2E',
  'category': 'Constants',
  'syntax': [
    'LOG2E'
  ],
  'description': 'Returns the base-2 logarithm of E, approximately equal to 1.442',
  'examples': [
    'LOG2E',
    'log(e, 2)'
  ],
  'seealso': []
};

},{}],39:[function(require,module,exports){
module.exports = {
  'name': 'NaN',
  'category': 'Constants',
  'syntax': [
    'NaN'
  ],
  'description': 'Not a number',
  'examples': [
    'NaN',
    '0 / 0'
  ],
  'seealso': []
};

},{}],40:[function(require,module,exports){
module.exports = {
  'name': 'SQRT1_2',
  'category': 'Constants',
  'syntax': [
    'SQRT1_2'
  ],
  'description': 'Returns the square root of 1/2, approximately equal to 0.707',
  'examples': [
    'SQRT1_2',
    'sqrt(1/2)'
  ],
  'seealso': []
};

},{}],41:[function(require,module,exports){
module.exports = {
  'name': 'SQRT2',
  'category': 'Constants',
  'syntax': [
    'SQRT2'
  ],
  'description': 'Returns the square root of 2, approximately equal to 1.414',
  'examples': [
    'SQRT2',
    'sqrt(2)'
  ],
  'seealso': []
};

},{}],42:[function(require,module,exports){
module.exports = {
  'name': 'e',
  'category': 'Constants',
  'syntax': [
    'e'
  ],
  'description': 'Euler\'s number, the base of the natural logarithm. Approximately equal to 2.71828',
  'examples': [
    'e',
    'e ^ 2',
    'exp(2)',
    'log(e)'
  ],
  'seealso': ['exp']
};

},{}],43:[function(require,module,exports){
module.exports = {
  'name': 'false',
  'category': 'Constants',
  'syntax': [
    'false'
  ],
  'description': 'Boolean value false',
  'examples': [
    'false'
  ],
  'seealso': ['true']
};

},{}],44:[function(require,module,exports){
module.exports = {
  'name': 'i',
  'category': 'Constants',
  'syntax': [
    'i'
  ],
  'description': 'Imaginary unit, defined as i*i=-1. A complex number is described as a + b*i, where a is the real part, and b is the imaginary part.',
  'examples': [
    'i',
    'i * i',
    'sqrt(-1)'
  ],
  'seealso': []
};

},{}],45:[function(require,module,exports){
module.exports = {
  'name': 'pi',
  'category': 'Constants',
  'syntax': [
    'pi'
  ],
  'description': 'The number pi is a mathematical constant that is the ratio of a circle\'s circumference to its diameter, and is approximately equal to 3.14159',
  'examples': [
    'pi',
    'sin(pi/2)'
  ],
  'seealso': ['tau']
};

},{}],46:[function(require,module,exports){
module.exports = {
  'name': 'tau',
  'category': 'Constants',
  'syntax': [
    'pi'
  ],
  'description': 'Tau is the ratio constant of a circle\'s circumference to radius, equal to 2 * pi, approximately 6.2832.',
  'examples': [
    'tau',
    '2 * pi'
  ],
  'seealso': ['pi']
};

},{}],47:[function(require,module,exports){
module.exports = {
  'name': 'true',
  'category': 'Constants',
  'syntax': [
    'true'
  ],
  'description': 'Boolean value true',
  'examples': [
    'true'
  ],
  'seealso': ['false']
};

},{}],48:[function(require,module,exports){
module.exports = {
  'name': 'abs',
  'category': 'Arithmetic',
  'syntax': [
    'abs(x)'
  ],
  'description': 'Compute the absolute value.',
  'examples': [
    'abs(3.5)',
    'abs(-4.2)'
  ],
  'seealso': ['sign']
};

},{}],49:[function(require,module,exports){
module.exports = {
  'name': 'add',
  'category': 'Operators',
  'syntax': [
    'x + y',
    'add(x, y)'
  ],
  'description': 'Add two values.',
  'examples': [
    '2.1 + 3.6',
    'ans - 3.6',
    '3 + 2i',
    '"hello" + " world"',
    '3 cm + 2 inch'
  ],
  'seealso': [
    'subtract'
  ]
};

},{}],50:[function(require,module,exports){
module.exports = {
  'name': 'ceil',
  'category': 'Arithmetic',
  'syntax': [
    'ceil(x)'
  ],
  'description':
      'Round a value towards plus infinity. If x is complex, both real and imaginary part are rounded towards plus infinity.',
  'examples': [
    'ceil(3.2)',
    'ceil(3.8)',
    'ceil(-4.2)'
  ],
  'seealso': ['floor', 'fix', 'round']
};

},{}],51:[function(require,module,exports){
module.exports = {
  'name': 'compare',
  'category': 'Operators',
  'syntax': [
    'compare(x, y)'
  ],
  'description':
      'Compare two values. Returns 1 if x is larger than y, -1 if x is smaller than y, and 0 if x and y are equal.',
  'examples': [
    'compare(2, 3)',
    'compare(3, 2)',
    'compare(2, 2)',
    'compare(5cm, 40mm)',
    'compare(2, [1, 2, 3])'
  ],
  'seealso': [
    'equal', 'unequal', 'smaller', 'smallereq', 'largereq'
  ]
};

},{}],52:[function(require,module,exports){
module.exports = {
  'name': 'cube',
  'category': 'Arithmetic',
  'syntax': [
    'cube(x)'
  ],
  'description': 'Compute the cube of a value. The cube of x is x * x * x.',
  'examples': [
    'cube(2)',
    '2^3',
    '2 * 2 * 2'
  ],
  'seealso': [
    'multiply',
    'square',
    'pow'
  ]
};

},{}],53:[function(require,module,exports){
module.exports = {
  'name': 'divide',
  'category': 'Operators',
  'syntax': [
    'x / y',
    'divide(x, y)'
  ],
  'description': 'Divide two values.',
  'examples': [
    '2 / 3',
    'ans * 3',
    '4.5 / 2',
    '3 + 4 / 2',
    '(3 + 4) / 2',
    '18 km / 4.5'
  ],
  'seealso': [
    'multiply'
  ]
};

},{}],54:[function(require,module,exports){
module.exports = {
  'name': 'edivide',
  'category': 'Operators',
  'syntax': [
    'x ./ y',
    'edivide(x, y)'
  ],
  'description': 'divide two values element wise.',
  'examples': [
    'a = [1, 2, 3; 4, 5, 6]',
    'b = [2, 1, 1; 3, 2, 5]',
    'a ./ b'
  ],
  'seealso': [
    'multiply',
    'emultiply',
    'divide'
  ]
};

},{}],55:[function(require,module,exports){
module.exports = {
  'name': 'emultiply',
  'category': 'Operators',
  'syntax': [
    'x .* y',
    'emultiply(x, y)'
  ],
  'description': 'multiply two values element wise.',
  'examples': [
    'a = [1, 2, 3; 4, 5, 6]',
    'b = [2, 1, 1; 3, 2, 5]',
    'a .* b'
  ],
  'seealso': [
    'multiply',
    'divide',
    'edivide'
  ]
};

},{}],56:[function(require,module,exports){
module.exports = {
  'name': 'epow',
  'category': 'Operators',
  'syntax': [
    'x .^ y',
    'epow(x, y)'
  ],
  'description':
      'Calculates the power of x to y element wise.',
  'examples': [
    'a = [1, 2, 3; 4, 5, 6]',
    'a .^ 2'
  ],
  'seealso': [
    'pow'
  ]
};

},{}],57:[function(require,module,exports){
module.exports = {
  'name': 'equal',
  'category': 'Operators',
  'syntax': [
    'x == y',
    'equal(x, y)'
  ],
  'description':
      'Check equality of two values. Returns true if the values are equal, and false if not.',
  'examples': [
    '2+2 == 3',
    '2+2 == 4',
    'a = 3.2',
    'b = 6-2.8',
    'a == b',
    '50cm == 0.5m'
  ],
  'seealso': [
    'unequal', 'smaller', 'larger', 'smallereq', 'largereq', 'compare'
  ]
};

},{}],58:[function(require,module,exports){
module.exports = {
  'name': 'exp',
  'category': 'Arithmetic',
  'syntax': [
    'exp(x)'
  ],
  'description': 'Calculate the exponent of a value.',
  'examples': [
    'exp(1.3)',
    'e ^ 1.3',
    'log(exp(1.3))',
    'x = 2.4',
    '(exp(i*x) == cos(x) + i*sin(x))   # Euler\'s formula'
  ],
  'seealso': [
    'pow',
    'log'
  ]
};

},{}],59:[function(require,module,exports){
module.exports = {
  'name': 'fix',
  'category': 'Arithmetic',
  'syntax': [
    'fix(x)'
  ],
  'description':
      'Round a value towards zero. If x is complex, both real and imaginary part are rounded towards zero.',
  'examples': [
    'fix(3.2)',
    'fix(3.8)',
    'fix(-4.2)',
    'fix(-4.8)'
  ],
  'seealso': ['ceil', 'floor', 'round']
};

},{}],60:[function(require,module,exports){
module.exports = {
  'name': 'floor',
  'category': 'Arithmetic',
  'syntax': [
    'floor(x)'
  ],
  'description':
      'Round a value towards minus infinity.If x is complex, both real and imaginary part are rounded towards minus infinity.',
  'examples': [
    'floor(3.2)',
    'floor(3.8)',
    'floor(-4.2)'
  ],
  'seealso': ['ceil', 'fix', 'round']
};

},{}],61:[function(require,module,exports){
module.exports = {
  'name': 'gcd',
  'category': 'Arithmetic',
  'syntax': [
    'gcd(a, b)',
    'gcd(a, b, c, ...)'
  ],
  'description': 'Compute the greatest common divisor.',
  'examples': [
    'gcd(8, 12)',
    'gcd(-4, 6)',
    'gcd(25, 15, -10)'
  ],
  'seealso': [ 'lcm', 'xgcd' ]
};

},{}],62:[function(require,module,exports){
module.exports = {
  'name': 'larger',
  'category': 'Operators',
  'syntax': [
    'x > y',
    'larger(x, y)'
  ],
  'description':
      'Check if value x is larger than y. Returns true if x is larger than y, and false if not.',
  'examples': [
    '2 > 3',
    '5 > 2*2',
    'a = 3.3',
    'b = 6-2.8',
    '(a > b)',
    '(b < a)',
    '5 cm > 2 inch'
  ],
  'seealso': [
    'equal', 'unequal', 'smaller', 'smallereq', 'largereq', 'compare'
  ]
};

},{}],63:[function(require,module,exports){
module.exports = {
  'name': 'largereq',
  'category': 'Operators',
  'syntax': [
    'x >= y',
    'largereq(x, y)'
  ],
  'description':
      'Check if value x is larger or equal to y. Returns true if x is larger or equal to y, and false if not.',
  'examples': [
    '2 > 1+1',
    '2 >= 1+1',
    'a = 3.2',
    'b = 6-2.8',
    '(a > b)'
  ],
  'seealso': [
    'equal', 'unequal', 'smallereq', 'smaller', 'largereq', 'compare'
  ]
};

},{}],64:[function(require,module,exports){
module.exports = {
  'name': 'lcm',
  'category': 'Arithmetic',
  'syntax': [
    'lcm(x, y)'
  ],
  'description': 'Compute the least common multiple.',
  'examples': [
    'lcm(4, 6)',
    'lcm(6, 21)',
    'lcm(6, 21, 5)'
  ],
  'seealso': [ 'gcd' ]
};

},{}],65:[function(require,module,exports){
module.exports = {
  'name': 'log',
  'category': 'Arithmetic',
  'syntax': [
    'log(x)',
    'log(x, base)'
  ],
  'description': 'Compute the logarithm of a value. If no base is provided, the natural logarithm of x is calculated. If base if provided, the logarithm is calculated for the specified base. log(x, base) is defined as log(x) / log(base).',
  'examples': [
    'log(3.5)',
    'a = log(2.4)',
    'exp(a)',
    '10 ^ 4',
    'log(10000, 10)',
    'log(10000) / log(10)',
    'b = log(1024, 2)',
    '2 ^ b'
  ],
  'seealso': [
    'exp',
    'log10'
  ]
};
},{}],66:[function(require,module,exports){
module.exports = {
  'name': 'log10',
  'category': 'Arithmetic',
  'syntax': [
    'log10(x)'
  ],
  'description': 'Compute the 10-base logarithm of a value.',
  'examples': [
    'log10(0.00001)',
    'log10(10000)',
    '10 ^ 4',
    'log(10000) / log(10)',
    'log(10000, 10)'
  ],
  'seealso': [
    'exp',
    'log'
  ]
};

},{}],67:[function(require,module,exports){
module.exports = {
  'name': 'mod',
  'category': 'Operators',
  'syntax': [
    'x % y',
    'x mod y',
    'mod(x, y)'
  ],
  'description':
      'Calculates the modulus, the remainder of an integer division.',
  'examples': [
    '7 % 3',
    '11 % 2',
    '10 mod 4',
    'function isOdd(x) = x % 2',
    'isOdd(2)',
    'isOdd(3)'
  ],
  'seealso': ['divide']
};

},{}],68:[function(require,module,exports){
module.exports = {
  'name': 'multiply',
  'category': 'Operators',
  'syntax': [
    'x * y',
    'multiply(x, y)'
  ],
  'description': 'multiply two values.',
  'examples': [
    '2.1 * 3.4',
    'ans / 3.4',
    '2 * 3 + 4',
    '2 * (3 + 4)',
    '3 * 2.1 km'
  ],
  'seealso': [
    'divide'
  ]
};

},{}],69:[function(require,module,exports){
module.exports = {
  'name': 'norm',
  'category': 'Arithmetic',
  'syntax': [
    'norm(x)',
    'norm(x, p)'
  ],
  'description': 'Calculate the norm of a number, vector or matrix.',
  'examples': [
    'abs(-3.5)',
    'norm(-3.5)',
    'norm(3 - 4i))',
    'norm([1, 2, -3], Infinity)',
    'norm([1, 2, -3], -Infinity)',
    'norm([3, 4], 2)',
    'norm([[1, 2], [3, 4]], 1)',
    'norm([[1, 2], [3, 4]], \'inf\')',
    'norm([[1, 2], [3, 4]], \'fro\')'
  ]
};

},{}],70:[function(require,module,exports){
module.exports = {
  'name': 'pow',
  'category': 'Operators',
  'syntax': [
    'x ^ y',
    'pow(x, y)'
  ],
  'description':
      'Calculates the power of x to y, x^y.',
  'examples': [
    '2^3 = 8',
    '2*2*2',
    '1 + e ^ (pi * i)'
  ],
  'seealso': [ 'multiply' ]
};

},{}],71:[function(require,module,exports){
module.exports = {
  'name': 'round',
  'category': 'Arithmetic',
  'syntax': [
    'round(x)',
    'round(x, n)'
  ],
  'description':
      'round a value towards the nearest integer.If x is complex, both real and imaginary part are rounded towards the nearest integer. When n is specified, the value is rounded to n decimals.',
  'examples': [
    'round(3.2)',
    'round(3.8)',
    'round(-4.2)',
    'round(-4.8)',
    'round(pi, 3)',
    'round(123.45678, 2)'
  ],
  'seealso': ['ceil', 'floor', 'fix']
};

},{}],72:[function(require,module,exports){
module.exports = {
  'name': 'sign',
  'category': 'Arithmetic',
  'syntax': [
    'sign(x)'
  ],
  'description':
      'Compute the sign of a value. The sign of a value x is 1 when x>1, -1 when x<0, and 0 when x=0.',
  'examples': [
    'sign(3.5)',
    'sign(-4.2)',
    'sign(0)'
  ],
  'seealso': [
    'abs'
  ]
};

},{}],73:[function(require,module,exports){
module.exports = {
  'name': 'smaller',
  'category': 'Operators',
  'syntax': [
    'x < y',
    'smaller(x, y)'
  ],
  'description':
      'Check if value x is smaller than value y. Returns true if x is smaller than y, and false if not.',
  'examples': [
    '2 < 3',
    '5 < 2*2',
    'a = 3.3',
    'b = 6-2.8',
    '(a < b)',
    '5 cm < 2 inch'
  ],
  'seealso': [
    'equal', 'unequal', 'larger', 'smallereq', 'largereq', 'compare'
  ]
};

},{}],74:[function(require,module,exports){
module.exports = {
  'name': 'smallereq',
  'category': 'Operators',
  'syntax': [
    'x <= y',
    'smallereq(x, y)'
  ],
  'description':
      'Check if value x is smaller or equal to value y. Returns true if x is smaller than y, and false if not.',
  'examples': [
    '2 < 1+1',
    '2 <= 1+1',
    'a = 3.2',
    'b = 6-2.8',
    '(a < b)'
  ],
  'seealso': [
    'equal', 'unequal', 'larger', 'smaller', 'largereq', 'compare'
  ]
};

},{}],75:[function(require,module,exports){
module.exports = {
  'name': 'sqrt',
  'category': 'Arithmetic',
  'syntax': [
    'sqrt(x)'
  ],
  'description':
      'Compute the square root value. If x = y * y, then y is the square root of x.',
  'examples': [
    'sqrt(25)',
    '5 * 5',
    'sqrt(-1)'
  ],
  'seealso': [
    'square',
    'multiply'
  ]
};

},{}],76:[function(require,module,exports){
module.exports = {
  'name': 'square',
  'category': 'Arithmetic',
  'syntax': [
    'square(x)'
  ],
  'description':
      'Compute the square of a value. The square of x is x * x.',
  'examples': [
    'square(3)',
    'sqrt(9)',
    '3^2',
    '3 * 3'
  ],
  'seealso': [
    'multiply',
    'pow',
    'sqrt',
    'cube'
  ]
};

},{}],77:[function(require,module,exports){
module.exports = {
  'name': 'subtract',
  'category': 'Operators',
  'syntax': [
    'x - y',
    'subtract(x, y)'
  ],
  'description': 'subtract two values.',
  'examples': [
    '5.3 - 2',
    'ans + 2',
    '2/3 - 1/6',
    '2 * 3 - 3',
    '2.1 km - 500m'
  ],
  'seealso': [
    'add'
  ]
};

},{}],78:[function(require,module,exports){
module.exports = {
  'name': 'unary',
  'category': 'Operators',
  'syntax': [
    '-x',
    'unary(x)'
  ],
  'description':
      'Inverse the sign of a value.',
  'examples': [
    '-4.5',
    '-(-5.6)'
  ],
  'seealso': [
    'add', 'subtract'
  ]
};

},{}],79:[function(require,module,exports){
module.exports = {
  'name': 'unequal',
  'category': 'Operators',
  'syntax': [
    'x != y',
    'unequal(x, y)'
  ],
  'description':
      'Check unequality of two values. Returns true if the values are unequal, and false if they are equal.',
  'examples': [
    '2+2 != 3',
    '2+2 != 4',
    'a = 3.2',
    'b = 6-2.8',
    'a != b',
    '50cm != 0.5m',
    '5 cm != 2 inch'
  ],
  'seealso': [
    'equal', 'smaller', 'larger', 'smallereq', 'largereq', 'compare'
  ]
};

},{}],80:[function(require,module,exports){
module.exports = {
  'name': 'xgcd',
  'category': 'Arithmetic',
  'syntax': [
    'xgcd(a, b)'
  ],
  'description': 'Calculate the extended greatest common divisor for two values',
  'examples': [
    'xgcd(8, 12)',
    'gcd(8, 12)',
    'xgcd(36163, 21199)'
  ],
  'seealso': [ 'gcd', 'lcm' ]
};

},{}],81:[function(require,module,exports){
module.exports = {
  'name': 'arg',
  'category': 'Complex',
  'syntax': [
    'arg(x)'
  ],
  'description':
      'Compute the argument of a complex value. If x = a+bi, the argument is computed as atan2(b, a).',
  'examples': [
    'arg(2 + 2i)',
    'atan2(3, 2)',
    'arg(2 + 3i)'
  ],
  'seealso': [
    're',
    'im',
    'conj',
    'abs'
  ]
};

},{}],82:[function(require,module,exports){
module.exports = {
  'name': 'conj',
  'category': 'Complex',
  'syntax': [
    'conj(x)'
  ],
  'description':
      'Compute the complex conjugate of a complex value. If x = a+bi, the complex conjugate is a-bi.',
  'examples': [
    'conj(2 + 3i)',
    'conj(2 - 3i)',
    'conj(-5.2i)'
  ],
  'seealso': [
    're',
    'im',
    'abs',
    'arg'
  ]
};

},{}],83:[function(require,module,exports){
module.exports = {
  'name': 'im',
  'category': 'Complex',
  'syntax': [
    'im(x)'
  ],
  'description': 'Get the imaginary part of a complex number.',
  'examples': [
    'im(2 + 3i)',
    're(2 + 3i)',
    'im(-5.2i)',
    'im(2.4)'
  ],
  'seealso': [
    're',
    'conj',
    'abs',
    'arg'
  ]
};

},{}],84:[function(require,module,exports){
module.exports = {
  'name': 're',
  'category': 'Complex',
  'syntax': [
    're(x)'
  ],
  'description': 'Get the real part of a complex number.',
  'examples': [
    're(2 + 3i)',
    'im(2 + 3i)',
    're(-5.2i)',
    're(2.4)'
  ],
  'seealso': [
    'im',
    'conj',
    'abs',
    'arg'
  ]
};

},{}],85:[function(require,module,exports){
module.exports = {
  'name': 'bignumber',
  'category': 'Type',
  'syntax': [
    'bignumber(x)'
  ],
  'description':
      'Create a big number from a number or string.',
  'examples': [
    '0.1 + 0.2',
    'bignumber(0.1) + bignumber(0.2)',
    'bignumber("7.2")',
    'bignumber("7.2e500")',
    'bignumber([0.1, 0.2, 0.3])'
  ],
  'seealso': [
    'boolean', 'complex', 'index', 'matrix', 'string', 'unit'
  ]
};

},{}],86:[function(require,module,exports){
module.exports = {
  'name': 'boolean',
  'category': 'Type',
  'syntax': [
    'x',
    'boolean(x)'
  ],
  'description':
      'Convert a string or number into a boolean.',
  'examples': [
    'boolean(0)',
    'boolean(1)',
    'boolean(3)',
    'boolean("true")',
    'boolean("false")',
    'boolean([1, 0, 1, 1])'
  ],
  'seealso': [
    'bignumber', 'complex', 'index', 'matrix', 'number', 'string', 'unit'
  ]
};

},{}],87:[function(require,module,exports){
module.exports = {
  'name': 'complex',
  'category': 'Type',
  'syntax': [
    'complex()',
    'complex(re, im)',
    'complex(string)'
  ],
  'description':
      'Create a complex number.',
  'examples': [
    'complex()',
    'complex(2, 3)',
    'complex("7 - 2i")'
  ],
  'seealso': [
    'bignumber', 'boolean', 'index', 'matrix', 'number', 'string', 'unit'
  ]
};

},{}],88:[function(require,module,exports){
module.exports = {
  'name': 'index',
  'category': 'Type',
  'syntax': [
    '[start]',
    '[start:end]',
    '[start:step:end]',
    '[start1, start 2, ...]',
    '[start1:end1, start2:end2, ...]',
    '[start1:step1:end1, start2:step2:end2, ...]'
  ],
  'description':
      'Create an index to get or replace a subset of a matrix',
  'examples': [
    '[]',
    '[1, 2, 3]',
    'A = [1, 2, 3; 4, 5, 6]',
    'A[1, :]',
    'A[1, 2] = 50',
    'A[0:2, 0:2] = ones(2, 2)'
  ],
  'seealso': [
    'bignumber', 'boolean', 'complex', 'matrix,', 'number', 'range', 'string', 'unit'
  ]
};

},{}],89:[function(require,module,exports){
module.exports = {
  'name': 'matrix',
  'category': 'Type',
  'syntax': [
    '[]',
    '[a1, b1, ...; a2, b2, ...]',
    'matrix()',
    'matrix([...])'
  ],
  'description':
      'Create a matrix.',
  'examples': [
    '[]',
    '[1, 2, 3]',
    '[1, 2, 3; 4, 5, 6]',
    'matrix()',
    'matrix([3, 4])'
  ],
  'seealso': [
    'bignumber', 'boolean', 'complex', 'index', 'number', 'string', 'unit'
  ]
};

},{}],90:[function(require,module,exports){
module.exports = {
  'name': 'number',
  'category': 'Type',
  'syntax': [
    'x',
    'number(x)'
  ],
  'description':
      'Create a number or convert a string or boolean into a number.',
  'examples': [
    '2',
    '2e3',
    '4.05',
    'number(2)',
    'number("7.2")',
    'number(true)',
    'number([true, false, true, true])'
  ],
  'seealso': [
    'bignumber', 'boolean', 'complex', 'index', 'matrix', 'string', 'unit'
  ]
};

},{}],91:[function(require,module,exports){
module.exports = {
  'name': 'string',
  'category': 'Type',
  'syntax': [
    '"text"',
    'string(x)'
  ],
  'description':
      'Create a string or convert a value to a string',
  'examples': [
    '"Hello World!"',
    'string(4.2)',
    'string(3 + 2i)'
  ],
  'seealso': [
    'bignumber', 'boolean', 'complex', 'index', 'matrix', 'number', 'unit'
  ]
};

},{}],92:[function(require,module,exports){
module.exports = {
  'name': 'unit',
  'category': 'Type',
  'syntax': [
    'value unit',
    'unit(value, unit)',
    'unit(string)'
  ],
  'description':
      'Create a unit.',
  'examples': [
    '5.5 mm',
    '3 inch',
    'unit(7.1, "kilogram")',
    'unit("23 deg")'
  ],
  'seealso': [
    'bignumber', 'boolean', 'complex', 'index', 'matrix', 'number', 'string'
  ]
};

},{}],93:[function(require,module,exports){
module.exports = {
  'name': 'eval',
  'category': 'Expression',
  'syntax': [
    'eval(expression)',
    'eval([expr1, expr2, expr3, ...])'
  ],
  'description': 'Evaluate an expression or an array with expressions.',
  'examples': [
    'eval("2 + 3")',
    'eval("sqrt(" + 4 + ")")'
  ],
  'seealso': []
};

},{}],94:[function(require,module,exports){
module.exports = {
  'name': 'help',
  'category': 'Expression',
  'syntax': [
    'help(object)',
    'help(string)'
  ],
  'description': 'Display documentation on a function or data type.',
  'examples': [
    'help(sqrt)',
    'help("complex")'
  ],
  'seealso': []
};

},{}],95:[function(require,module,exports){
module.exports = {
  'name': 'concat',
  'category': 'Matrix',
  'syntax': [
    'concat(A, B, C, ...)',
    'concat(A, B, C, ..., dim)'
  ],
  'description': 'Concatenate matrices. By default, the matrices are concatenated by the first dimension. The dimension on which to concatenate can be provided as last argument.',
  'examples': [
    'A = [1, 2; 5, 6]',
    'B = [3, 4; 7, 8]',
    'concat(A, B)',
    '[A, B]',
    'concat(A, B, 1)',
    '[A; B]'
  ],
  'seealso': [
    'det', 'diag', 'eye', 'inv', 'ones', 'range', 'size', 'squeeze', 'subset', 'transpose', 'zeros'
  ]
};

},{}],96:[function(require,module,exports){
module.exports = {
  'name': 'det',
  'category': 'Matrix',
  'syntax': [
    'det(x)'
  ],
  'description': 'Calculate the determinant of a matrix',
  'examples': [
    'det([1, 2; 3, 4])',
    'det([-2, 2, 3; -1, 1, 3; 2, 0, -1])'
  ],
  'seealso': [
    'concat', 'diag', 'eye', 'inv', 'ones', 'range', 'size', 'squeeze', 'subset', 'transpose', 'zeros'
  ]
};

},{}],97:[function(require,module,exports){
module.exports = {
  'name': 'diag',
  'category': 'Matrix',
  'syntax': [
    'diag(x)',
    'diag(x, k)'
  ],
  'description': 'Create a diagonal matrix or retrieve the diagonal of a matrix. When x is a vector, a matrix with the vector values on the diagonal will be returned. When x is a matrix, a vector with the diagonal values of the matrix is returned. When k is provided, the k-th diagonal will be filled in or retrieved, if k is positive, the values are placed on the super diagonal. When k is negative, the values are placed on the sub diagonal.',
  'examples': [
    'diag(1:3)',
    'diag(1:3, 1)',
    'a = [1, 2, 3; 4, 5, 6; 7, 8, 9]',
    'diag(a)'
  ],
  'seealso': [
    'concat', 'det', 'eye', 'inv', 'ones', 'range', 'size', 'squeeze', 'subset', 'transpose', 'zeros'
  ]
};

},{}],98:[function(require,module,exports){
module.exports = {
  'name': 'eye',
  'category': 'Matrix',
  'syntax': [
    'eye(n)',
    'eye(m, n)',
    'eye([m, n])',
    'eye'
  ],
  'description': 'Returns the identity matrix with size m-by-n. The matrix has ones on the diagonal and zeros elsewhere.',
  'examples': [
    'eye(3)',
    'eye(3, 5)',
    'a = [1, 2, 3; 4, 5, 6]',
    'eye(size(a))'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'inv', 'ones', 'range', 'size', 'squeeze', 'subset', 'transpose', 'zeros'
  ]
};

},{}],99:[function(require,module,exports){
module.exports = {
  'name': 'inv',
  'category': 'Matrix',
  'syntax': [
    'inv(x)'
  ],
  'description': 'Calculate the inverse of a matrix',
  'examples': [
    'inv([1, 2; 3, 4])',
    'inv(4)',
    '1 / 4'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'ones', 'range', 'size', 'squeeze', 'subset', 'transpose', 'zeros'
  ]
};

},{}],100:[function(require,module,exports){
module.exports = {
  'name': 'ones',
  'category': 'Matrix',
  'syntax': [
    'ones(m)',
    'ones(m, n)',
    'ones(m, n, p, ...)',
    'ones([m])',
    'ones([m, n])',
    'ones([m, n, p, ...])',
    'ones'
  ],
  'description': 'Create a matrix containing ones.',
  'examples': [
    'ones(3)',
    'ones(3, 5)',
    'ones([2,3]) * 4.5',
    'a = [1, 2, 3; 4, 5, 6]',
    'ones(size(a))'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'range', 'size', 'squeeze', 'subset', 'transpose', 'zeros'
  ]
};

},{}],101:[function(require,module,exports){
module.exports = {
  'name': 'range',
  'category': 'Type',
  'syntax': [
    'start:end',
    'start:step:end',
    'range(start, end)',
    'range(start, end, step)',
    'range(string)'
  ],
  'description':
      'Create a range. Lower bound of the range is included, upper bound is excluded.',
  'examples': [
    '1:5',
    '3:-1:-3',
    'range(3, 7)',
    'range(0, 12, 2)',
    'range("4:10")',
    'a = [1, 2, 3, 4; 5, 6, 7, 8]',
    'a[1:2, 1:2]'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'ones', 'size', 'squeeze', 'subset', 'transpose', 'zeros'
  ]
};

},{}],102:[function(require,module,exports){
module.exports = {
  'name': 'resize',
  'category': 'Matrix',
  'syntax': [
    'resize(x, size)',
    'resize(x, size, defaultValue)'
  ],
  'description': 'Resize a matrix.',
  'examples': [
    'resize([1,2,3,4,5], [3])',
    'resize([1,2,3], [5], 0)',
    'resize(2, [2, 3], 0)',
    'resize("hello", [8], "!")'
  ],
  'seealso': [
    'size', 'subset', 'squeeze'
  ]
};

},{}],103:[function(require,module,exports){
module.exports = {
  'name': 'size',
  'category': 'Matrix',
  'syntax': [
    'size(x)'
  ],
  'description': 'Calculate the size of a matrix.',
  'examples': [
    'size(2.3)',
    'size("hello world")',
    'a = [1, 2; 3, 4; 5, 6]',
    'size(a)',
    'size(1:6)'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'ones', 'range', 'squeeze', 'subset', 'transpose', 'zeros'
  ]
};

},{}],104:[function(require,module,exports){
module.exports = {
  'name': 'squeeze',
  'category': 'Matrix',
  'syntax': [
    'squeeze(x)'
  ],
  'description': 'Remove singleton dimensions from a matrix.',
  'examples': [
    'a = zeros(1,3,2)',
    'size(squeeze(a))',
    'b = zeros(3,1,1)',
    'size(squeeze(b))'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'ones', 'range', 'size', 'subset', 'transpose', 'zeros'
  ]
};

},{}],105:[function(require,module,exports){
module.exports = {
  'name': 'subset',
  'category': 'Matrix',
  'syntax': [
    'value(index)',
    'value(index) = replacement',
    'subset(value, [index])',
    'subset(value, [index], replacement)'
  ],
  'description': 'Get or set a subset of a matrix or string. ' +
      'Indexes are one-based. ' +
      'Both the ranges lower-bound and upper-bound are included.',
  'examples': [
    'd = [1, 2; 3, 4]',
    'e = []',
    'e[1, 1:2] = [5, 6]',
    'e[2, :] = [7, 8]',
    'f = d * e',
    'f[2, 1]',
    'f[:, 1]'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'ones', 'range', 'size', 'squeeze', 'transpose', 'zeros'
  ]
};

},{}],106:[function(require,module,exports){
module.exports = {
  'name': 'transpose',
  'category': 'Matrix',
  'syntax': [
    'x\'',
    'transpose(x)'
  ],
  'description': 'Transpose a matrix',
  'examples': [
    'a = [1, 2, 3; 4, 5, 6]',
    'a\'',
    'transpose(a)'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'ones', 'range', 'size', 'squeeze', 'subset', 'zeros'
  ]
};

},{}],107:[function(require,module,exports){
module.exports = {
  'name': 'zeros',
  'category': 'Matrix',
  'syntax': [
    'zeros(m)',
    'zeros(m, n)',
    'zeros(m, n, p, ...)',
    'zeros([m])',
    'zeros([m, n])',
    'zeros([m, n, p, ...])',
    'zeros'
  ],
  'description': 'Create a matrix containing zeros.',
  'examples': [
    'zeros(3)',
    'zeros(3, 5)',
    'a = [1, 2, 3; 4, 5, 6]',
    'zeros(size(a))'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'ones', 'range', 'size', 'squeeze', 'subset', 'transpose'
  ]
};

},{}],108:[function(require,module,exports){
module.exports = {
  'name': 'combinations',
  'category': 'Probability',
  'syntax': [
    'combinations(n, k)'
  ],
  'description': 'Compute the number of combinations of n items taken k at a time',
  'examples': [
    'combinations(7, 5)'
  ],
  'seealso': ['permutations', 'factorial']
};

},{}],109:[function(require,module,exports){
module.exports = {
  'name': 'distribution',
  'category': 'Probability',
  'syntax': [
    'distribution(name)',
    'distribution(name, arg1, arg2, ...)'
  ],
  'description':
      'Create a distribution object of a specific type. ' +
          'A distribution object contains functions `random([size,] [min,] [max])`, ' +
          '`randomInt([size,] [min,] [max])`, and `pickRandom(array)`. ' +
          'Available types of distributions: "uniform", "normal". ' +
          'Note that the function distribution is currently not available via the expression parser.',
  'examples': [
  ],
  'seealso': ['random', 'randomInt']
};

},{}],110:[function(require,module,exports){
module.exports = {
  'name': 'factorial',
  'category': 'Probability',
  'syntax': [
    'n!',
    'factorial(n)'
  ],
  'description': 'Compute the factorial of a value',
  'examples': [
    '5!',
    '5*4*3*2*1',
    '3!'
  ],
  'seealso': ['combinations', 'permutations']
};

},{}],111:[function(require,module,exports){
module.exports = {
  'name': 'permutations',
  'category': 'Probability',
  'syntax': [
    'permutations(n)',
    'permutations(n, k)'
  ],
  'description': 'Compute the number of permutations of n items taken k at a time',
  'examples': [
    'permutations(5)',
    'permutations(5, 3)'
  ],
  'seealso': ['combinations', 'factorial']
};

},{}],112:[function(require,module,exports){
module.exports = {
  'name': 'pickRandom',
  'category': 'Probability',
  'syntax': [
    'pickRandom(array)'
  ],
  'description':
      'Pick a random entry from a given array.',
  'examples': [
    'pickRandom(0:10)',
    'pickRandom([1, 3, 1, 6])'
  ],
  'seealso': ['distribution', 'random', 'randomInt']
};

},{}],113:[function(require,module,exports){
module.exports = {
  'name': 'random',
  'category': 'Probability',
  'syntax': [
    'random()',
    'random(max)',
    'random(min, max)',
    'random(size)',
    'random(size, max)',
    'random(size, min, max)'
  ],
  'description':
      'Return a random number.',
  'examples': [
    'random()',
    'random(10, 20)',
    'random([2, 3])'
  ],
  'seealso': ['distribution', 'pickRandom', 'randomInt']
};

},{}],114:[function(require,module,exports){
module.exports = {
  'name': 'randInt',
  'category': 'Probability',
  'syntax': [
    'randInt()',
    'randInt(max)',
    'randInt(min, max)',
    'randInt(size)',
    'randInt(size, max)',
    'randInt(size, min, max)'
  ],
  'description':
      'Return a random integer number',
  'examples': [
    'randInt()',
    'randInt(10, 20)',
    'randInt([2, 3], 10)'
  ],
  'seealso': ['distribution', 'pickRandom', 'random']
};
},{}],115:[function(require,module,exports){
module.exports = {
  'name': 'max',
  'category': 'Statistics',
  'syntax': [
    'max(a, b, c, ...)',
    'max(A)',
    'max(A, dim)'
  ],
  'description': 'Compute the maximum value of a list of values.',
  'examples': [
    'max(2, 3, 4, 1)',
    'max([2, 3, 4, 1])',
    'max([2, 5; 4, 3], 0)',
    'max([2, 5; 4, 3], 1)',
    'max(2.7, 7.1, -4.5, 2.0, 4.1)',
    'min(2.7, 7.1, -4.5, 2.0, 4.1)'
  ],
  'seealso': [
    'mean',
    'median',
    'min',
    'prod',
    'std',
    'sum',
    'var'
  ]
};

},{}],116:[function(require,module,exports){
module.exports = {
  'name': 'mean',
  'category': 'Statistics',
  'syntax': [
    'mean(a, b, c, ...)',
    'mean(A)',
    'mean(A, dim)'
  ],
  'description': 'Compute the arithmetic mean of a list of values.',
  'examples': [
    'mean(2, 3, 4, 1)',
    'mean([2, 3, 4, 1])',
    'mean([2, 5; 4, 3], 0)',
    'mean([2, 5; 4, 3], 1)',
    'mean([1.0, 2.7, 3.2, 4.0])'
  ],
  'seealso': [
    'max',
    'median',
    'min',
    'prod',
    'std',
    'sum',
    'var'
  ]
};

},{}],117:[function(require,module,exports){
module.exports = {
  'name': 'median',
  'category': 'Statistics',
  'syntax': [
    'median(a, b, c, ...)',
    'median(A)'
  ],
  'description': 'Compute the median of all values. The values are sorted and the middle value is returned. In case of an even number of values, the average of the two middle values is returned.',
  'examples': [
    'median(5, 2, 7)',
    'median([3, -1, 5, 7])'
  ],
  'seealso': [
    'max',
    'mean',
    'min',
    'prod',
    'std',
    'sum',
    'var'
  ]
};

},{}],118:[function(require,module,exports){
module.exports = {
  'name': 'min',
  'category': 'Statistics',
  'syntax': [
    'min(a, b, c, ...)',
    'min(A)',
    'min(A, dim)'
  ],
  'description': 'Compute the minimum value of a list of values.',
  'examples': [
    'min(2, 3, 4, 1)',
    'min([2, 3, 4, 1])',
    'min([2, 5; 4, 3], 0)',
    'min([2, 5; 4, 3], 1)',
    'min(2.7, 7.1, -4.5, 2.0, 4.1)',
    'max(2.7, 7.1, -4.5, 2.0, 4.1)'
  ],
  'seealso': [
    'max',
    'mean',
    'median',
    'prod',
    'std',
    'sum',
    'var'
  ]
};

},{}],119:[function(require,module,exports){
module.exports = {
  'name': 'prod',
  'category': 'Statistics',
  'syntax': [
    'prod(a, b, c, ...)',
    'prod(A)'
  ],
  'description': 'Compute the product of all values.',
  'examples': [
    'prod(2, 3, 4)',
    'prod([2, 3, 4])',
    'prod([2, 5; 4, 3])'
  ],
  'seealso': [
    'max',
    'mean',
    'min',
    'median',
    'min',
    'std',
    'sum',
    'var'
  ]
};

},{}],120:[function(require,module,exports){
module.exports = {
  'name': 'std',
  'category': 'Statistics',
  'syntax': [
    'std(a, b, c, ...)',
    'std(A)',
    'std(A, normalization)'
  ],
  'description': 'Compute the standard deviation of all values, defined as std(A) = sqrt(var(A)). Optional parameter normalization can be "unbiased" (default), "uncorrected", or "biased".',
  'examples': [
    'std(2, 4, 6)',
    'std([2, 4, 6, 8])',
    'std([2, 4, 6, 8], "uncorrected")',
    'std([2, 4, 6, 8], "biased")',
    'std([1, 2, 3; 4, 5, 6])'
  ],
  'seealso': [
    'max',
    'mean',
    'min',
    'median',
    'min',
    'prod',
    'sum',
    'var'
  ]
};

},{}],121:[function(require,module,exports){
module.exports = {
  'name': 'sum',
  'category': 'Statistics',
  'syntax': [
    'sum(a, b, c, ...)',
    'sum(A)'
  ],
  'description': 'Compute the sum of all values.',
  'examples': [
    'sum(2, 3, 4, 1)',
    'sum([2, 3, 4, 1])',
    'sum([2, 5; 4, 3])'
  ],
  'seealso': [
    'max',
    'mean',
    'median',
    'min',
    'prod',
    'std',
    'sum',
    'var'
  ]
};

},{}],122:[function(require,module,exports){
module.exports = {
  'name': 'var',
  'category': 'Statistics',
  'syntax': [
    'var(a, b, c, ...)',
    'var(A)',
    'var(A, normalization)'
  ],
  'description': 'Compute the variance of all values. Optional parameter normalization can be "unbiased" (default), "uncorrected", or "biased".',
  'examples': [
    'var(2, 4, 6)',
    'var([2, 4, 6, 8])',
    'var([2, 4, 6, 8], "uncorrected")',
    'var([2, 4, 6, 8], "biased")',
    'var([1, 2, 3; 4, 5, 6])'
  ],
  'seealso': [
    'max',
    'mean',
    'min',
    'median',
    'min',
    'prod',
    'std',
    'sum'
  ]
};

},{}],123:[function(require,module,exports){
module.exports = {
  'name': 'acos',
  'category': 'Trigonometry',
  'syntax': [
    'acos(x)'
  ],
  'description': 'Compute the inverse cosine of a value in radians.',
  'examples': [
    'acos(0.5)',
    'acos(cos(2.3))'
  ],
  'seealso': [
    'cos',
    'atan',
    'asin'
  ]
};

},{}],124:[function(require,module,exports){
module.exports = {
  'name': 'asin',
  'category': 'Trigonometry',
  'syntax': [
    'asin(x)'
  ],
  'description': 'Compute the inverse sine of a value in radians.',
  'examples': [
    'asin(0.5)',
    'asin(sin(2.3))'
  ],
  'seealso': [
    'sin',
    'acos',
    'atan'
  ]
};

},{}],125:[function(require,module,exports){
module.exports = {
  'name': 'atan',
  'category': 'Trigonometry',
  'syntax': [
    'atan(x)'
  ],
  'description': 'Compute the inverse tangent of a value in radians.',
  'examples': [
    'atan(0.5)',
    'atan(tan(2.3))'
  ],
  'seealso': [
    'tan',
    'acos',
    'asin'
  ]
};

},{}],126:[function(require,module,exports){
module.exports = {
  'name': 'atan2',
  'category': 'Trigonometry',
  'syntax': [
    'atan2(y, x)'
  ],
  'description':
      'Computes the principal value of the arc tangent of y/x in radians.',
  'examples': [
    'atan2(2, 2) / pi',
    'angle = 60 deg in rad',
    'x = cos(angle)',
    'y = sin(angle)',
    'atan2(y, x)'
  ],
  'seealso': [
    'sin',
    'cos',
    'tan'
  ]
};

},{}],127:[function(require,module,exports){
module.exports = {
  'name': 'cos',
  'category': 'Trigonometry',
  'syntax': [
    'cos(x)'
  ],
  'description': 'Compute the cosine of x in radians.',
  'examples': [
    'cos(2)',
    'cos(pi / 4) ^ 2',
    'cos(180 deg)',
    'cos(60 deg)',
    'sin(0.2)^2 + cos(0.2)^2'
  ],
  'seealso': [
    'acos',
    'sin',
    'tan'
  ]
};

},{}],128:[function(require,module,exports){
module.exports = {
  'name': 'cosh',
  'category': 'Trigonometry',
  'syntax': [
    'cosh(x)'
  ],
  'description': 'Compute the hyperbolic cosine of x in radians.',
  'examples': [
    'cosh(0.5)'
  ],
  'seealso': [
    'sinh',
    'tanh',
    'coth'
  ]
};

},{}],129:[function(require,module,exports){
module.exports = {
  'name': 'cot',
  'category': 'Trigonometry',
  'syntax': [
    'cot(x)'
  ],
  'description': 'Compute the cotangent of x in radians. Defined as 1/tan(x)',
  'examples': [
    'cot(2)',
    '1 / tan(2)'
  ],
  'seealso': [
    'sec',
    'csc',
    'tan'
  ]
};

},{}],130:[function(require,module,exports){
module.exports = {
  'name': 'coth',
  'category': 'Trigonometry',
  'syntax': [
    'coth(x)'
  ],
  'description': 'Compute the hyperbolic cotangent of x in radians.',
  'examples': [
    'coth(2)',
    '1 / tanh(2)'
  ],
  'seealso': [
    'sech',
    'csch',
    'tanh'
  ]
};

},{}],131:[function(require,module,exports){
module.exports = {
  'name': 'csc',
  'category': 'Trigonometry',
  'syntax': [
    'csc(x)'
  ],
  'description': 'Compute the cosecant of x in radians. Defined as 1/sin(x)',
  'examples': [
    'csc(2)',
    '1 / sin(2)'
  ],
  'seealso': [
    'sec',
    'cot',
    'sin'
  ]
};

},{}],132:[function(require,module,exports){
module.exports = {
  'name': 'csch',
  'category': 'Trigonometry',
  'syntax': [
    'csch(x)'
  ],
  'description': 'Compute the hyperbolic cosecant of x in radians. Defined as 1/sinh(x)',
  'examples': [
    'csch(2)',
    '1 / sinh(2)'
  ],
  'seealso': [
    'sech',
    'coth',
    'sinh'
  ]
};

},{}],133:[function(require,module,exports){
module.exports = {
  'name': 'sec',
  'category': 'Trigonometry',
  'syntax': [
    'sec(x)'
  ],
  'description': 'Compute the secant of x in radians. Defined as 1/cos(x)',
  'examples': [
    'sec(2)',
    '1 / cos(2)'
  ],
  'seealso': [
    'cot',
    'csc',
    'cos'
  ]
};

},{}],134:[function(require,module,exports){
module.exports = {
  'name': 'sech',
  'category': 'Trigonometry',
  'syntax': [
    'sech(x)'
  ],
  'description': 'Compute the hyperbolic secant of x in radians. Defined as 1/cosh(x)',
  'examples': [
    'sech(2)',
    '1 / cosh(2)'
  ],
  'seealso': [
    'coth',
    'csch',
    'cosh'
  ]
};

},{}],135:[function(require,module,exports){
module.exports = {
  'name': 'sin',
  'category': 'Trigonometry',
  'syntax': [
    'sin(x)'
  ],
  'description': 'Compute the sine of x in radians.',
  'examples': [
    'sin(2)',
    'sin(pi / 4) ^ 2',
    'sin(90 deg)',
    'sin(30 deg)',
    'sin(0.2)^2 + cos(0.2)^2'
  ],
  'seealso': [
    'asin',
    'cos',
    'tan'
  ]
};

},{}],136:[function(require,module,exports){
module.exports = {
  'name': 'sinh',
  'category': 'Trigonometry',
  'syntax': [
    'sinh(x)'
  ],
  'description': 'Compute the hyperbolic sine of x in radians.',
  'examples': [
    'sinh(0.5)'
  ],
  'seealso': [
    'cosh',
    'tanh'
  ]
};

},{}],137:[function(require,module,exports){
module.exports = {
  'name': 'tan',
  'category': 'Trigonometry',
  'syntax': [
    'tan(x)'
  ],
  'description': 'Compute the tangent of x in radians.',
  'examples': [
    'tan(0.5)',
    'sin(0.5) / cos(0.5)',
    'tan(pi / 4)',
    'tan(45 deg)'
  ],
  'seealso': [
    'atan',
    'sin',
    'cos'
  ]
};

},{}],138:[function(require,module,exports){
module.exports = {
  'name': 'tanh',
  'category': 'Trigonometry',
  'syntax': [
    'tanh(x)'
  ],
  'description': 'Compute the hyperbolic tangent of x in radians.',
  'examples': [
    'tanh(0.5)',
    'sinh(0.5) / cosh(0.5)'
  ],
  'seealso': [
    'sinh',
    'cosh'
  ]
};

},{}],139:[function(require,module,exports){
module.exports = {
  'name': 'to',
  'category': 'Units',
  'syntax': [
    'x to unit',
    'to(x, unit)'
  ],
  'description': 'Change the unit of a value.',
  'examples': [
    '5 inch to cm',
    '3.2kg to g',
    '16 bytes in bits'
  ],
  'seealso': []
};

},{}],140:[function(require,module,exports){
module.exports = {
  'name': 'clone',
  'category': 'Utils',
  'syntax': [
    'clone(x)'
  ],
  'description': 'Clone a variable. Creates a copy of primitive variables,and a deep copy of matrices',
  'examples': [
    'clone(3.5)',
    'clone(2 - 4i)',
    'clone(45 deg)',
    'clone([1, 2; 3, 4])',
    'clone("hello world")'
  ],
  'seealso': []
};

},{}],141:[function(require,module,exports){
module.exports = {
  'name': 'forEach',
  'category': 'Utils',
  'syntax': [
    'forEach(x, callback)'
  ],
  'description': 'Iterates over all elements of a matrix/array, and executes the given callback function.',
  'examples': [
    'forEach([1, 2, 3], function(val) { console.log(val) })'
  ],
  'seealso': ['unit']
};

},{}],142:[function(require,module,exports){
module.exports = {
  'name': 'format',
  'category': 'Utils',
  'syntax': [
    'format(value)',
    'format(value, precision)'
  ],
  'description': 'Format a value of any type as string.',
  'examples': [
    'format(2.3)',
    'format(3 - 4i)',
    'format([])',
    'format(pi, 3)'
  ],
  'seealso': ['print']
};

},{}],143:[function(require,module,exports){
module.exports = {
  'name': 'ifElse',
  'category': 'Utils',
  'syntax': [
    'ifElse(conditional, trueExpr, falseExpr)'
  ],
  'description': 'Executes a conditional expression.',
  'examples': [
    'ifElse(10 > 0, 1, 0)',
    'ifElse("", true, false)',
    'ifElse([4, 6, 0, -1], true, false)'
  ],
  'seealso': []
};

},{}],144:[function(require,module,exports){
module.exports = {
  'name': 'import',
  'category': 'Utils',
  'syntax': [
    'import(string)'
  ],
  'description': 'Import functions from a file.',
  'examples': [
    'import("numbers")',
    'import("./mylib.js")'
  ],
  'seealso': []
};

},{}],145:[function(require,module,exports){
module.exports = {
  'name': 'map',
  'category': 'Utils',
  'syntax': [
    'map(x, callback)'
  ],
  'description': 'Create a new matrix or array with the results of the callback function executed on each entry of the matrix/array.',
  'examples': [
    'map([1, 2, 3], function(val) { return value * value })'
  ],
  'seealso': []
};

},{}],146:[function(require,module,exports){
module.exports = {
  'name': 'typeof',
  'category': 'Utils',
  'syntax': [
    'typeof(x)'
  ],
  'description': 'Get the type of a variable.',
  'examples': [
    'typeof(3.5)',
    'typeof(2 - 4i)',
    'typeof(45 deg)',
    'typeof("hello world")'
  ],
  'seealso': []
};

},{}],147:[function(require,module,exports){
// constants
exports.e = require('./constants/e');
exports.E = require('./constants/e');
exports['false'] = require('./constants/false');
exports.i = require('./constants/i');
exports['Infinity'] = require('./constants/Infinity');
exports.LN2 = require('./constants/LN2');
exports.LN10 = require('./constants/LN10');
exports.LOG2E = require('./constants/LOG2E');
exports.LOG10E = require('./constants/LOG10E');
exports.NaN = require('./constants/NaN');
exports.pi = require('./constants/pi');
exports.PI = require('./constants/pi');
exports.SQRT1_2 = require('./constants/SQRT1_2');
exports.SQRT2 = require('./constants/SQRT2');
exports.tau = require('./constants/tau');
exports['true'] = require('./constants/true');

// functions - arithmetic
exports.abs = require('./function/arithmetic/abs');
exports.add = require('./function/arithmetic/add');
exports.ceil = require('./function/arithmetic/ceil');
exports.compare = require('./function/arithmetic/compare');
exports.cube = require('./function/arithmetic/cube');
exports.divide = require('./function/arithmetic/divide');
exports.edivide = require('./function/arithmetic/edivide');
exports.emultiply = require('./function/arithmetic/emultiply');
exports.epow = require('./function/arithmetic/epow');
exports['equal'] = require('./function/arithmetic/equal');
exports.exp = require('./function/arithmetic/exp');
exports.fix = require('./function/arithmetic/fix');
exports.floor = require('./function/arithmetic/floor');
exports.gcd = require('./function/arithmetic/gcd');
exports.larger = require('./function/arithmetic/larger');
exports.largereq = require('./function/arithmetic/largereq');
exports.lcm = require('./function/arithmetic/lcm');
exports.log = require('./function/arithmetic/log');
exports.log10 = require('./function/arithmetic/log10');
exports.mod = require('./function/arithmetic/mod');
exports.multiply = require('./function/arithmetic/multiply');
exports.norm = require('./function/arithmetic/norm');
exports.pow = require('./function/arithmetic/pow');
exports.round = require('./function/arithmetic/round');
exports.sign = require('./function/arithmetic/sign');
exports.smaller = require('./function/arithmetic/smaller');
exports.smallereq = require('./function/arithmetic/smallereq');
exports.sqrt = require('./function/arithmetic/sqrt');
exports.square = require('./function/arithmetic/square');
exports.subtract = require('./function/arithmetic/subtract');
exports.unary = require('./function/arithmetic/unary');
exports.unequal = require('./function/arithmetic/unequal');
exports.xgcd = require('./function/arithmetic/xgcd');

// functions - complex
exports.arg = require('./function/complex/arg');
exports.conj = require('./function/complex/conj');
exports.re = require('./function/complex/re');
exports.im = require('./function/complex/im');

// functions - construction
exports.bignumber = require('./function/construction/bignumber');
exports['boolean'] = require('./function/construction/boolean');
exports.complex = require('./function/construction/complex');
exports.index = require('./function/construction/index');
exports.matrix = require('./function/construction/matrix');
exports.number = require('./function/construction/number');
exports.string = require('./function/construction/string');
exports.unit = require('./function/construction/unit');

// functions - epxression
exports['eval'] =  require('./function/expression/eval');
exports.help =  require('./function/expression/help');

// functions - matrix
exports['concat'] = require('./function/matrix/concat');
exports.det = require('./function/matrix/det');
exports.diag = require('./function/matrix/diag');
exports.eye = require('./function/matrix/eye');
exports.inv = require('./function/matrix/inv');
exports.ones = require('./function/matrix/ones');
exports.range = require('./function/matrix/range');
exports.resize = require('./function/matrix/resize');
exports.size = require('./function/matrix/size');
exports.squeeze = require('./function/matrix/squeeze');
exports.subset = require('./function/matrix/subset');
exports.transpose = require('./function/matrix/transpose');
exports.zeros = require('./function/matrix/zeros');

// functions - probability
exports.combinations = require('./function/probability/combinations');
exports.distribution = require('./function/probability/distribution');
exports.factorial = require('./function/probability/factorial');
exports.permutations = require('./function/probability/permutations');
exports.pickRandom = require('./function/probability/pickRandom');
exports.random = require('./function/probability/random');
exports.randomInt = require('./function/probability/randomInt');

// functions - statistics
exports.max = require('./function/statistics/max');
exports.mean = require('./function/statistics/mean');
exports.median = require('./function/statistics/median');
exports.min = require('./function/statistics/min');
exports.prod = require('./function/statistics/prod');
exports.std = require('./function/statistics/std');
exports.sum = require('./function/statistics/sum');
exports['var'] = require('./function/statistics/var');

// functions - trigonometry
exports.acos = require('./function/trigonometry/acos');
exports.asin = require('./function/trigonometry/asin');
exports.atan = require('./function/trigonometry/atan');
exports.atan2 = require('./function/trigonometry/atan2');
exports.cos = require('./function/trigonometry/cos');
exports.cosh = require('./function/trigonometry/cosh');
exports.cot = require('./function/trigonometry/cot');
exports.coth = require('./function/trigonometry/coth');
exports.csc = require('./function/trigonometry/csc');
exports.csch = require('./function/trigonometry/csch');
exports.sec = require('./function/trigonometry/sec');
exports.sech = require('./function/trigonometry/sech');
exports.sin = require('./function/trigonometry/sin');
exports.sinh = require('./function/trigonometry/sinh');
exports.tan = require('./function/trigonometry/tan');
exports.tanh = require('./function/trigonometry/tanh');

// functions - units
exports.to = require('./function/units/to');

// functions - utils
exports.clone =  require('./function/utils/clone');
exports.map =  require('./function/utils/map');
exports.forEach =  require('./function/utils/forEach');
exports.format =  require('./function/utils/format');
// exports.print =  require('./function/utils/print'); // TODO: add documentation for print as soon as the parser supports objects.
exports.ifElse =  require('./function/utils/ifElse');
exports['import'] =  require('./function/utils/import');
exports['typeof'] =  require('./function/utils/typeof');

},{"./constants/Infinity":34,"./constants/LN10":35,"./constants/LN2":36,"./constants/LOG10E":37,"./constants/LOG2E":38,"./constants/NaN":39,"./constants/SQRT1_2":40,"./constants/SQRT2":41,"./constants/e":42,"./constants/false":43,"./constants/i":44,"./constants/pi":45,"./constants/tau":46,"./constants/true":47,"./function/arithmetic/abs":48,"./function/arithmetic/add":49,"./function/arithmetic/ceil":50,"./function/arithmetic/compare":51,"./function/arithmetic/cube":52,"./function/arithmetic/divide":53,"./function/arithmetic/edivide":54,"./function/arithmetic/emultiply":55,"./function/arithmetic/epow":56,"./function/arithmetic/equal":57,"./function/arithmetic/exp":58,"./function/arithmetic/fix":59,"./function/arithmetic/floor":60,"./function/arithmetic/gcd":61,"./function/arithmetic/larger":62,"./function/arithmetic/largereq":63,"./function/arithmetic/lcm":64,"./function/arithmetic/log":65,"./function/arithmetic/log10":66,"./function/arithmetic/mod":67,"./function/arithmetic/multiply":68,"./function/arithmetic/norm":69,"./function/arithmetic/pow":70,"./function/arithmetic/round":71,"./function/arithmetic/sign":72,"./function/arithmetic/smaller":73,"./function/arithmetic/smallereq":74,"./function/arithmetic/sqrt":75,"./function/arithmetic/square":76,"./function/arithmetic/subtract":77,"./function/arithmetic/unary":78,"./function/arithmetic/unequal":79,"./function/arithmetic/xgcd":80,"./function/complex/arg":81,"./function/complex/conj":82,"./function/complex/im":83,"./function/complex/re":84,"./function/construction/bignumber":85,"./function/construction/boolean":86,"./function/construction/complex":87,"./function/construction/index":88,"./function/construction/matrix":89,"./function/construction/number":90,"./function/construction/string":91,"./function/construction/unit":92,"./function/expression/eval":93,"./function/expression/help":94,"./function/matrix/concat":95,"./function/matrix/det":96,"./function/matrix/diag":97,"./function/matrix/eye":98,"./function/matrix/inv":99,"./function/matrix/ones":100,"./function/matrix/range":101,"./function/matrix/resize":102,"./function/matrix/size":103,"./function/matrix/squeeze":104,"./function/matrix/subset":105,"./function/matrix/transpose":106,"./function/matrix/zeros":107,"./function/probability/combinations":108,"./function/probability/distribution":109,"./function/probability/factorial":110,"./function/probability/permutations":111,"./function/probability/pickRandom":112,"./function/probability/random":113,"./function/probability/randomInt":114,"./function/statistics/max":115,"./function/statistics/mean":116,"./function/statistics/median":117,"./function/statistics/min":118,"./function/statistics/prod":119,"./function/statistics/std":120,"./function/statistics/sum":121,"./function/statistics/var":122,"./function/trigonometry/acos":123,"./function/trigonometry/asin":124,"./function/trigonometry/atan":125,"./function/trigonometry/atan2":126,"./function/trigonometry/cos":127,"./function/trigonometry/cosh":128,"./function/trigonometry/cot":129,"./function/trigonometry/coth":130,"./function/trigonometry/csc":131,"./function/trigonometry/csch":132,"./function/trigonometry/sec":133,"./function/trigonometry/sech":134,"./function/trigonometry/sin":135,"./function/trigonometry/sinh":136,"./function/trigonometry/tan":137,"./function/trigonometry/tanh":138,"./function/units/to":139,"./function/utils/clone":140,"./function/utils/forEach":141,"./function/utils/format":142,"./function/utils/ifElse":143,"./function/utils/import":144,"./function/utils/map":145,"./function/utils/typeof":146}],148:[function(require,module,exports){
var Node = require('./Node'),
    object = require('../../util/object'),
    string = require('../../util/string'),
    collection = require('../../type/collection'),
    util = require('../../util/index'),

    isArray = Array.isArray,
    isNode = Node.isNode;

/**
 * @constructor ArrayNode
 * @extends {Node}
 * Holds an 1-dimensional array with nodes
 * @param {Node[]} [nodes]   1 dimensional array with nodes
 */
function ArrayNode(nodes) {
  if (!(this instanceof ArrayNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  this.nodes = nodes || [];

  // validate input
  if (!isArray(this.nodes) || !this.nodes.every(isNode)) {
    throw new TypeError('Array containing Nodes expected')
  }
}

ArrayNode.prototype = new Node();

ArrayNode.prototype.type = 'ArrayNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @private
 */
ArrayNode.prototype._compile = function (defs) {
  var asMatrix = (defs.math.config().matrix !== 'array');

  var nodes = this.nodes.map(function (node) {
    return node._compile(defs);
  });

  return (asMatrix ? 'math.matrix([' : '[') +
      nodes.join(',') +
      (asMatrix ? '])' : ']');
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
ArrayNode.prototype.find = function (filter) {
  var results = [];

  // check itself
  if (this.match(filter)) {
    results.push(this);
  }

  // search in all nodes
  var nodes = this.nodes;
  for (var r = 0, rows = nodes.length; r < rows; r++) {
    results = results.concat(nodes[r].find(filter));
  }

  return results;
};

/**
 * Get string representation
 * @return {String} str
 * @override
 */
ArrayNode.prototype.toString = function() {
  return string.format(this.nodes);
};

/**
 * Get LaTeX representation
 * @return {String} str
 */
ArrayNode.prototype.toTex = function(type) {
  type = type || 'bmatrix';
  var s = '\\begin{' + type + '}';

  this.nodes.forEach(function(node) {
    if (node.nodes) {
      s += node.nodes.map(function(childNode) {
        return childNode.toTex();
      }).join('&');
    }
    else {
      s += node.toTex();
    }

    // new line
    s += '\\\\';
  });
  s += '\\end{' + type + '}';
  return s;
};

module.exports = ArrayNode;

},{"../../type/collection":272,"../../util/index":276,"../../util/object":279,"../../util/string":280,"./Node":154}],149:[function(require,module,exports){
var Node = require('./Node'),
    ArrayNode = require('./ArrayNode'),

    latex = require('../../util/latex'),
    isString = require('../../util/string').isString;

/**
 * @constructor AssignmentNode
 * @extends {Node}
 * Define a symbol, like "a = 3.2"
 *
 * @param {String} name       Symbol name
 * @param {Node} expr         The expression defining the symbol
 */
function AssignmentNode(name, expr) {
  if (!(this instanceof AssignmentNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // validate input
  if (!isString(name))         throw new TypeError('String expected for parameter "name"');
  if (!(expr instanceof Node)) throw new TypeError('Node expected for parameter "expr"');

  this.name = name;
  this.expr = expr;
}

AssignmentNode.prototype = new Node();

AssignmentNode.prototype.type = 'AssignmentNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @private
 */
AssignmentNode.prototype._compile = function (defs) {
  return 'scope["' + this.name + '"] = ' + this.expr._compile(defs) + '';
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
AssignmentNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // search in expression
  nodes = nodes.concat(this.expr.find(filter));

  return nodes;
};

/**
 * Get string representation
 * @return {String}
 */
AssignmentNode.prototype.toString = function() {
  return this.name + ' = ' + this.expr.toString();
};

/**
 * Get LaTeX representation
 * @return {String}
 */
AssignmentNode.prototype.toTex = function() {
  var brace;
  if (this.expr instanceof ArrayNode) {
    brace = ['\\mathbf{', '}'];
  }
  return latex.addBraces(latex.toSymbol(this.name), brace) + '=' +
      latex.addBraces(this.expr.toTex());
};

module.exports = AssignmentNode;
},{"../../util/latex":277,"../../util/string":280,"./ArrayNode":148,"./Node":154}],150:[function(require,module,exports){
var Node = require('./Node'),
    isBoolean = require('../../util/boolean').isBoolean;

/**
 * @constructor BlockNode
 * @extends {Node}
 * Holds a set with nodes
 */
function BlockNode() {
  if (!(this instanceof BlockNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  this.params = [];
}

BlockNode.prototype = new Node();

BlockNode.prototype.type = 'BlockNode';

/**
 * Add an expression. If visible = false, the expression will be evaluated
 * but not returned in the output.
 * @param {Node} expr
 * @param {Boolean} [visible=true]
 */
BlockNode.prototype.add = function (expr, visible) {
  if (visible === undefined) visible = true;

  // validate input
  if (!(expr instanceof Node))  throw new TypeError('Node expected for parameter "expr"');
  if (!isBoolean(visible))      throw new TypeError('Boolean expected for parameter "visible"');

  var index = this.params.length;
  this.params[index] = {
    node: expr,
    visible: visible
  };
};

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
BlockNode.prototype._compile = function (defs) {
  var params = this.params.map(function (param) {
    var js = param.node._compile(defs);
    if (param.visible) {
      return 'results.push(' + js + ');';
    }
    else {
      return js + ';';
    }
  });

  return '(function () {' +
      'var results = [];' +
      params.join('') +
      'return results;' +
      '})()';
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
BlockNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // search in parameters
  var params = this.params;
  for (var i = 0, len = params.length; i < len; i++) {
    nodes = nodes.concat(params[i].node.find(filter));
  }

  return nodes;
};

/**
 * Get string representation
 * @return {String} str
 * @override
 */
BlockNode.prototype.toString = function() {
  return this.params.map(function (param) {
    return param.node.toString() + (param.visible ? '' : ';');
  }).join('\n');
};

/**
 * Get LaTeX representation
 * @return {String} str
 */
BlockNode.prototype.toTex = function() {
  return this.params.map(function (param) {
    return param.node.toTex() + (param.visible ? '' : ';');
  }).join('\n');
};

module.exports = BlockNode;

},{"../../util/boolean":275,"./Node":154}],151:[function(require,module,exports){
var Node = require('./Node'),
    string = require('../../util/string'),
    isString = string.isString;

/**
 * @constructor ConstantNode
 * @extends {Node}
 * @param {String} valueType  The type of value. Choose from 'number', 'string',
 *                            'complex', 'boolean', 'undefined', 'null'
 * @param {String} value      An uninterpreted string containing the value
 */
function ConstantNode(valueType, value) {
  if (!(this instanceof ConstantNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  if (!isString(valueType)) throw new TypeError('String expected for parameter "type"');
  if (!isString(value))     throw new TypeError('String expected for parameter "value"');

  this.valueType = valueType;
  this.value = value;
}

ConstantNode.prototype = new Node();

ConstantNode.prototype.type = 'ConstantNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
ConstantNode.prototype._compile = function (defs) {
  switch (this.valueType) {
    case 'number':
      if (defs.math.config().number === 'bignumber') {
        return 'math.bignumber("' + this.value + '")';
      }
      else {
        // remove leading zeros like '003.2'
        return this.value.replace(/^(0*)[0-9]/, function (match, zeros) {
          return match.substring(zeros.length);
        });
      }

    case 'string':
      return '"' + this.value + '"';

    case 'complex':
      return 'math.complex(0, ' + this.value + ')';

    case 'boolean':
      return this.value;

    case 'undefined':
      return this.value;

    case 'null':
      return this.value;

    default:
      throw new TypeError('Unsupported type of constant "' + this.valueType + '"');
  }
};

/**
 * Get string representation
 * @return {String} str
 */
ConstantNode.prototype.toString = function() {
  switch (this.valueType) {
    case 'string':
      return '"' + this.value + '"';

    case 'complex':
      return this.value + 'i';

    default:
      return this.value;
  }
};

/**
 * Get LaTeX representation
 * @return {String} str
 */
ConstantNode.prototype.toTex = function() {
  var value = this.value,
      index;
  switch (this.valueType) {
    case 'string':
      return '\\text{' + value + '}';

    case 'complex':
      return value + 'i';

    case 'number':
      index = value.toLowerCase().indexOf('e');
      if (index !== -1) {
        return value.substring(0, index) + ' \\cdot 10^{' +
            value.substring(index + 1) + '}';
      }
      return value;

    default:
      return value;
  }
};

module.exports = ConstantNode;

},{"../../util/string":280,"./Node":154}],152:[function(require,module,exports){
var Node = require('./Node'),
    latex = require('../../util/latex'),
    isString = require('../../util/string').isString;
    isArray = Array.isArray;

/**
 * @constructor FunctionNode
 * @extends {Node}
 * Function assignment
 *
 * @param {String} name           Function name
 * @param {String[]} args         Function argument names
 * @param {Node} expr             The function expression
 */
function FunctionNode(name, args, expr) {
  if (!(this instanceof FunctionNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // validate input
  if (!isString(name)) throw new TypeError('String expected for parameter "name"');
  if (!isArray(args) || !args.every(isString))  throw new TypeError('Array containing strings expected for parameter "args"');
  if (!(expr instanceof Node)) throw new TypeError('Node expected for parameter "expr"');

  this.name = name;
  this.args = args;
  this.expr = expr;
}

FunctionNode.prototype = new Node();

FunctionNode.prototype.type = 'FunctionNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
FunctionNode.prototype._compile = function (defs) {
  return 'scope["' + this.name + '"] = ' +
      '  (function (scope) {' +
      '    scope = Object.create(scope); ' +
      '    var fn = function ' + this.name + '(' + this.args.join(',') + ') {' +
      '      if (arguments.length != ' + this.args.length + ') {' +
      // TODO: use util.error.ArgumentsError here
      // TODO: test arguments error
      '        throw new SyntaxError("Wrong number of arguments in function ' + this.name + ' (" + arguments.length + " provided, ' + this.args.length + ' expected)");' +
      '      }' +
      this.args.map(function (variable, index) {
        return 'scope["' + variable + '"] = arguments[' + index + '];';
      }).join('') +
      '      return ' + this.expr._compile(defs) + '' +
      '    };' +
      '    fn.syntax = "' + this.name + '(' + this.args.join(', ') + ')";' +
      '    return fn;' +
      '  })(scope);';
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
FunctionNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // search in expression
  nodes = nodes.concat(this.expr.find(filter));

  return nodes;
};

/**
 * get string representation
 * @return {String} str
 */
FunctionNode.prototype.toString = function() {
  return 'function ' + this.name +
      '(' + this.args.join(', ') + ') = ' +
      this.expr.toString();
};

/**
 * get LaTeX representation
 * @return {String} str
 */
FunctionNode.prototype.toTex = function() {
  return this.name +
      latex.addBraces(this.args.map(latex.toSymbol).join(', '), true) + '=' +
      latex.addBraces(this.expr.toTex());
};

module.exports = FunctionNode;

},{"../../util/latex":277,"../../util/string":280,"./Node":154}],153:[function(require,module,exports){
var Node = require('./Node.js'),
    RangeNode = require('./RangeNode'),
    SymbolNode = require('./SymbolNode'),

    isNode = Node.isNode;

/**
 * @constructor IndexNode
 * @extends Node
 *
 * get a subset of a matrix
 *
 * @param {Node} object
 * @param {Node[]} ranges
 */
function IndexNode (object, ranges) {
  if (!(this instanceof IndexNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // validate input
  if (!(object instanceof Node)) throw new TypeError('Node expected for parameter "object"');
  if (!isArray(ranges) || !ranges.every(isNode)) {
    throw new TypeError('Array containing Nodes expected for parameter "ranges"');
  }

  this.object = object;
  this.ranges = ranges;
}

IndexNode.prototype = new Node();

IndexNode.prototype.type = 'IndexNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
IndexNode.prototype._compile = function (defs) {
  return this.compileSubset(defs);
};

/**
 * Compile the node to javascript code
 * @param {Object} defs           Object which can be used to define functions
 *                                or constants globally available for the
 *                                compiled expression
 * @param {String} [replacement]  If provided, the function returns
 *                                  "math.subset(obj, math.index(...), replacement)"
 *                                Else, the function returns
 *                                  "math.subset(obj, math.index(...))"
 * @return {String} js
 * @returns {string}
 */
IndexNode.prototype.compileSubset = function compileIndex (defs, replacement) {
  // check whether any of the ranges expressions uses the context symbol 'end'
  var filter = {
    type: SymbolNode,
    properties: {
      name: 'end'
    }
  };
  var someUseEnd = false;
  var rangesUseEnd = this.ranges.map(function (range) {
    var useEnd = range.find(filter).length > 0;
    someUseEnd = useEnd ? useEnd : someUseEnd;
    return useEnd;
  });

  // TODO: implement support for bignumber (currently bignumbers are silently
  //       reduced to numbers when changing the value to zero-based)

  // TODO: Optimization: when the range values are ConstantNodes,
  //       we can beforehand resolve the zero-based value

  var ranges = this.ranges.map(function(range, i) {
    var useEnd = rangesUseEnd[i];
    if (range instanceof RangeNode) {
      if (useEnd) {
        // resolve end and create range (change from one based to zero based)
        return '(function (scope) {' +
            '  scope = Object.create(scope); ' +
            '  scope["end"] = size[' + i + '];' +
            '  var step = ' + (range.step ? range.step._compile(defs) : '1') + ';' +
            '  return [' +
            '    ' + range.start._compile(defs) + ' - 1, ' +
            '    ' + range.end._compile(defs) + ' - (step > 0 ? 0 : 2), ' +
            '    step' +
            '  ];' +
            '})(scope)';
      }
      else {
        // create range (change from one based to zero based)
        return '(function () {' +
            '  var step = ' + (range.step ? range.step._compile(defs) : '1') + ';' +
            '  return [' +
            '    ' + range.start._compile(defs) + ' - 1, ' +
            '    ' + range.end._compile(defs) + ' - (step > 0 ? 0 : 2), ' +
            '    step' +
            '  ];' +
            '})()';
      }
    }
    else {
      if (useEnd) {
        // resolve the parameter 'end', adjust the index value to zero-based
        return '(function (scope) {' +
            '  scope = Object.create(scope); ' +
            '  scope["end"] = size[' + i + '];' +
            '  return ' + range._compile(defs) + ' - 1;' +
            '})(scope)'
      }
      else {
        // just evaluate the expression, and change from one-based to zero-based
        return range._compile(defs) + ' - 1';
      }
    }
  });

  // if some parameters use the 'end' parameter, we need to calculate the size
  if (someUseEnd) {
    return '(function () {' +
        '  var obj = ' + this.object._compile(defs) + ';' +
        '  var size = math.size(obj).valueOf();' +
        '  return math.subset(' +
        '    obj, ' +
        '    math.index(' + ranges.join(', ') + ')' +
        '    ' + (replacement ? (', ' + replacement) : '') +
        '  );' +
        '})()';
  }
  else {
    return 'math.subset(' +
        this.object._compile(defs) + ',' +
        'math.index(' + ranges.join(', ') + ')' +
        (replacement ? (', ' + replacement) : '') +
        ')';
  }
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
IndexNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // search object
  nodes = nodes.concat(this.object.find(filter));

  // search in parameters
  var ranges = this.ranges;
  for (var i = 0, len = ranges.length; i < len; i++) {
    nodes = nodes.concat(ranges[i].find(filter));
  }

  return nodes;
};

/**
 * Get the name of the object linked to this IndexNode
 * @return {string} name
 */
IndexNode.prototype.objectName = function objectName () {
  return this.object.name;
};

/**
 * Get string representation
 * @return {String} str
 */
IndexNode.prototype.toString = function() {
  // format the parameters like "[1, 0:5]"
  return this.object.toString() + '[' + this.ranges.join(', ') + ']';
};

/**
 * Get LaTeX representation
 * @return {String} str
 */
IndexNode.prototype.toTex = function() {
  return this.object.toTex() + '[' + this.ranges.join(', ') + ']';
};

module.exports = IndexNode;
},{"./Node.js":154,"./RangeNode":157,"./SymbolNode":158}],154:[function(require,module,exports){
var error = require('../../error/index');

    /**
 * Node
 */
function Node() {
  if (!(this instanceof Node)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }
}

/**
 * Evaluate the node
 * @return {*} result
 */
// TODO: cleanup deprecated code one day. Deprecated since version 0.19.0
Node.prototype.eval = function () {
  throw new Error('Node.eval is deprecated. ' +
      'Use Node.compile(math).eval([scope]) instead.');
};

Node.prototype.type = 'Node';

/**
 * Compile the node to javascript code
 * @param {Object} math             math.js instance
 * @return {{eval: function}} expr  Returns an object with a function 'eval',
 *                                  which can be invoked as expr.eval([scope]),
 *                                  where scope is an optional object with
 *                                  variables.
 */
Node.prototype.compile = function (math) {
  if (typeof math !== 'object') {
    throw new TypeError('Object expected for parameter math');
  }

  // definitions globally available inside the closure of the compiled expressions
  var defs = {
    math: math,
    error: error
  };

  var code = this._compile(defs);

  var defsCode = Object.keys(defs).map(function (name) {
    return '    var ' + name + ' = defs["' + name + '"];';
  });

  var factoryCode =
      defsCode.join(' ') +
          'return {' +
          '  "eval": function (scope) {' +
          '    try {' +
          '      scope = scope || {};' +
          '      return ' + code + ';' +
          '    } catch (err) {' +
                 // replace an index-out-of-range-error with a one-based message
          '      if (err instanceof defs.error.IndexError) {' +
          '        err = new defs.error.IndexError(err.index + 1, err.min + 1, err.max + 1);' +
          '      }' +
          '      throw err;' +
          '    }' +
          '  }' +
          '};';

  var factory = new Function ('defs', factoryCode);
  return factory(defs);
};

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          and constants globally available inside the closure
 *                          of the compiled expression
 * @return {String} js
 * @private
 */
Node.prototype._compile = function (defs) {
  throw new Error('Cannot compile a Node interface');
};

/**
 * Find any node in the node tree matching given filter. For example, to
 * find all nodes of type SymbolNode having name 'x':
 *
 *     var results = Node.find({
 *         type: SymbolNode,
 *         properties: {
 *             name: 'x'
 *         }
 *     });
 *
 * @param {Object} filter       Available parameters:
 *                                  {Function} type
 *                                  {Object<String, String>} properties
 * @return {Node[]} nodes       An array with nodes matching given filter criteria
 */
Node.prototype.find = function (filter) {
  return this.match(filter) ? [this] : [];
};

/**
 * Test if this object matches given filter
 * @param {Object} [filter]     Available parameters:
 *                              {Function} type
 *                              {Object<String, *>} properties
 * @return {Boolean} matches    True if there is a match
 */
Node.prototype.match = function (filter) {
  var match = true;

  if (filter) {
    if (filter.type && !(this instanceof filter.type)) {
      match = false;
    }

    var properties = filter.properties;
    if (match && properties) {
      for (var prop in properties) {
        if (properties.hasOwnProperty(prop)) {
          if (this[prop] !== properties[prop]) {
            match = false;
            break;
          }
        }
      }
    }
  }

  return match;
};

/**
 * Get string representation
 * @return {String}
 */
Node.prototype.toString = function() {
  return '';
};

/**
 * Get LaTeX representation
 * @return {String}
 */
Node.prototype.toTex = function() {
  return '';
};

/**
 * Test whether an object is a Node
 * @param {*} object
 * @returns {boolean} isNode
 */
Node.isNode = function isNode (object) {
  return object instanceof Node;
}

module.exports = Node;

},{"../../error/index":32}],155:[function(require,module,exports){
var Node = require('./Node'),
    ConstantNode = require('./ConstantNode'),
    SymbolNode = require('./SymbolNode'),
    ParamsNode = require('./ParamsNode'),
    latex = require('../../util/latex');

/**
 * @constructor OperatorNode
 * @extends {Node}
 * An operator with two arguments, like 2+3
 *
 * @param {String} op       Operator name, for example '+'
 * @param {String} fn       Function name, for example 'add'
 * @param {Node[]} params   Parameters
 */
function OperatorNode (op, fn, params) {
  if (!(this instanceof OperatorNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // TODO: validate input
  this.op = op;
  this.fn = fn;
  this.params = params;
}

OperatorNode.prototype = new Node();

OperatorNode.prototype.type = 'OperatorNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
OperatorNode.prototype._compile = function (defs) {
  if (!(this.fn in defs.math)) {
    throw new Error('Function ' + this.fn + ' missing in provided namespace "math"');
  }

  var params = this.params.map(function (param) {
    return param._compile(defs);
  });
  return 'math.' + this.fn + '(' + params.join(', ') + ')';
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
OperatorNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // search in parameters
  var params = this.params;
  if (params) {
    for (var i = 0, len = params.length; i < len; i++) {
      nodes = nodes.concat(params[i].find(filter));
    }
  }

  return nodes;
};

/**
 * Get string representation
 * @return {String} str
 */
OperatorNode.prototype.toString = function() {
  var params = this.params;

  switch (params.length) {
    case 1:
      if (this.op == '-') {
        // special case: unary minus
        return '-' + params[0].toString();
      }
      else {
        // for example '5!'
        return params[0].toString() + this.op;
      }

    case 2: // for example '2+3'
      var lhs = params[0].toString();
      if (params[0] instanceof OperatorNode) {
        lhs = '(' + lhs + ')';
      }
      var rhs = params[1].toString();
      if (params[1] instanceof OperatorNode) {
        rhs = '(' + rhs + ')';
      }
      return lhs + ' ' + this.op + ' ' + rhs;

    default: // this should not occur. format as a function call
      return this.op + '(' + this.params.join(', ') + ')';
  }
};

/**
 * Get LaTeX representation
 * @return {String} str
 */
OperatorNode.prototype.toTex = function() {
  var params = this.params,
      mop = latex.toOperator(this.op),
      lp = params[0],
      rp = params[1];

  switch (params.length) {
    case 1:
      if (this.op === '-' || this.op === '+') {
        // special case: unary minus
        return this.op + lp.toTex();
      }
      // for example '5!'
      return lp.toTex() + this.op;

    case 2: // for example '2+3'
      var lhs = lp.toTex(),
          lhb = false,
          rhs = rp.toTex(),
          rhb = false,
          lop = '',
          rop = '';

      switch (this.op) {
        case '/':
          lop = mop;
          mop = '';

          break;

        case '*':
          if (lp instanceof OperatorNode) {
            if (lp.op === '+' || lp.op === '-') {
              lhb = true;
            }
          }

          if (rp instanceof OperatorNode) {
            if (rp.op === '+' || rp.op === '-') {
              rhb = true;
            }
            else if (rp.op === '*') {
              rhb = true;
            }
          }

          if ((lp instanceof ConstantNode || lp instanceof OperatorNode) &&
              (rp instanceof ConstantNode || rp instanceof OperatorNode)) {
            mop = ' \\cdot ';
          }
          else {
            mop = ' \\, ';
          }

          break;

        case '^':
          if (lp instanceof OperatorNode || lp instanceof ParamsNode) {
            lhb = true;
          }
          else if (lp instanceof SymbolNode) {
            lhb = null;
          }

          break;

        case 'to':
          rhs = latex.toUnit(rhs, true);
          break;
      }

      lhs = latex.addBraces(lhs, lhb);
      rhs = latex.addBraces(rhs, rhb);

      return lop + lhs + mop + rhs + rop;

    default: // this should not occur. format as a function call
      return mop + '(' + this.params.map(latex.toSymbol).join(', ') + ')';
  }
};

module.exports = OperatorNode;

},{"../../util/latex":277,"./ConstantNode":151,"./Node":154,"./ParamsNode":156,"./SymbolNode":158}],156:[function(require,module,exports){
var Node = require('./Node'),

    latex = require('../../util/latex'),
    isNode = Node.isNode;

/**
 * @constructor ParamsNode
 * @extends {Node}
 * invoke a list with parameters on a node
 * @param {Node} object
 * @param {Node[]} params
 */
function ParamsNode (object, params) {
  if (!(this instanceof ParamsNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // validate input
  if (!(object instanceof Node)) throw new TypeError('Node expected for parameter "object"');
  if (!isArray(params) || !params.every(isNode)) {
    throw new TypeError('Array containing Nodes expected for parameter "params"');
  }

  this.object = object;
  this.params = params;
}

ParamsNode.prototype = new Node();

ParamsNode.prototype.type = 'ParamsNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
ParamsNode.prototype._compile = function (defs) {
  // TODO: implement support for matrix indexes and ranges
  var params = this.params.map(function (param) {
    return param._compile(defs);
  });

  return this.object._compile(defs) + '(' + params.join(', ') + ')';
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
ParamsNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // search object
  nodes = nodes.concat(this.object.find(filter));

  // search in parameters
  var params = this.params;
  for (var i = 0, len = params.length; i < len; i++) {
    nodes = nodes.concat(params[i].find(filter));
  }

  return nodes;
};

/**
 * Get string representation
 * @return {String} str
 */
ParamsNode.prototype.toString = function() {
  // format the parameters like "add(2, 4.2)"
  return this.object.toString() + '(' + this.params.join(', ') + ')';
};

/**
 * Get LaTeX representation
 * @return {String} str
 */
ParamsNode.prototype.toTex = function() {
  return latex.toParams(this);
};

module.exports = ParamsNode;

},{"../../util/latex":277,"./Node":154}],157:[function(require,module,exports){
var Node = require('./Node'),

    isNode = Node.isNode;

/**
 * @constructor RangeNode
 * @extends {Node}
 * create a range
 * @param {Node[]} params           Array [start, end] or [start, end, step]
 */
function RangeNode (params) {
  if (!(this instanceof RangeNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // validate inputs
  if (!Array.isArray(params) ||
      (params.length != 2 && params.length != 3) ||
      !params.every(isNode)) {
    throw new TypeError('Expected an Array containing 2 or 3 Nodes as parameter "params"');
  }

  this.start = params[0];  // included lower-bound
  this.end   = params[1];  // included upper-bound
  this.step  = params[2];  // optional step
}

RangeNode.prototype = new Node();

RangeNode.prototype.type = 'RangeNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
RangeNode.prototype._compile = function (defs) {
  return 'math.range(' +
      this.start._compile(defs) + ', ' +
      this.end._compile(defs) + ', ' +
      (this.step ? (this.step._compile(defs) + ', ') : '') +
      'true)'; // parameter includeEnd = true
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
RangeNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // search in parameters
  nodes = nodes.concat(this.start.find(filter));
  if (this.step) {
    nodes = nodes.concat(this.step.find(filter));
  }
  nodes = nodes.concat(this.end.find(filter));

  return nodes;
};

/**
 * Get string representation
 * @return {String} str
 */
RangeNode.prototype.toString = function() {
  // format the range like "start:step:end"
  var str = this.start.toString();
  if (this.step) {
    str += ':' + this.step.toString();
  }
  str += ':' + this.end.toString();

  return str;
};

/**
 * Get LaTeX representation
 * @return {String} str
 */
RangeNode.prototype.toTex = function() {
  var str = this.start.toTex();
  if (this.step) {
    str += ':' + this.step.toTex();
  }
  str += ':' + this.end.toTex();

  return str;
};

module.exports = RangeNode;

},{"./Node":154}],158:[function(require,module,exports){
var Node = require('./Node'),
    Unit = require('../../type/Unit'),

    latex = require('../../util/latex'),
    isString = require('../../util/string').isString;

/**
 * @constructor SymbolNode
 * @extends {Node}
 * A symbol node can hold and resolve a symbol
 * @param {String} name
 * @extends {Node}
 */
function SymbolNode(name) {
  if (!(this instanceof SymbolNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // validate input
  if (!isString(name))  throw new TypeError('String expected for parameter "name"');

  this.name = name;
}

SymbolNode.prototype = new Node();

SymbolNode.prototype.type = 'SymbolNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
SymbolNode.prototype._compile = function (defs) {
  // add a function to the definitions
  defs['undef'] = undef;
  defs['Unit'] = Unit;

  return '(' +
      'scope["' + this.name + '"] !== undefined ? scope["' + this.name + '"] : ' +
      'math["' + this.name + '"] !== undefined ? math["' + this.name + '"] : ' +
      (Unit.isValuelessUnit(this.name) ?
        'new Unit(null, "' + this.name + '")' :
        'undef("' + this.name + '")') +
      ')';
};

/**
 * Throws an error 'Undefined symbol {name}'
 * @param {String} name
 */
function undef (name) {
  throw new Error('Undefined symbol ' + name);
}

/**
 * Get string representation
 * @return {String} str
 * @override
 */
SymbolNode.prototype.toString = function() {
  return this.name;
};

/**
 * Get LaTeX representation
 * @return {String} str
 * @override
 */
SymbolNode.prototype.toTex = function() {
  return latex.toSymbol(this.name);
};

module.exports = SymbolNode;

},{"../../type/Unit":271,"../../util/latex":277,"../../util/string":280,"./Node":154}],159:[function(require,module,exports){
var OperatorNode = require('./OperatorNode'),

    latex = require('../../util/latex');

/**
 * @constructor TernaryNode
 * @extends {OperatorNode}
 *
 * A conditional expression
 *
 *     condition ? truePart : falsePart
 *
 * @param {String[]} ops  The operator symbols, for example ['?', ':']
 * @param {String} fn     The function name, for example 'ifElse'
 * @param {Node[]} params The operator parameters, should contain three parameters.
 */
function TernaryNode (ops, fn, params) {
  if (!(this instanceof TernaryNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // TODO: validate input
  this.ops = ops;
  this.fn = fn;
  this.params = params;
}

TernaryNode.prototype = new OperatorNode();

TernaryNode.prototype.type = 'TernaryNode';

/**
 * Get string representation
 * @return {String} str
 */
TernaryNode.prototype.toString = function() {
  return this.params[0] + ' ' + this.ops[0] + ' ' +
      this.params[1] + ' ' + this.ops[1] + ' ' +
      this.params[2];
};

/**
 * Get LaTeX representation
 * @return {String} str
 */
TernaryNode.prototype.toTex = function() {
  var s = (
        latex.addBraces(this.params[1].toTex()) +
        ', &\\quad' +
        latex.addBraces('\\text{if}\\;' + this.params[0].toTex())
      ) + '\\\\' + (
        latex.addBraces(this.params[2].toTex()) +
        ', &\\quad' +
        latex.addBraces('\\text{otherwise}')
      );

  return latex.addBraces(s, [
        '\\left\\{\\begin{array}{l l}',
        '\\end{array}\\right.'
      ]);
};

module.exports = TernaryNode;

},{"../../util/latex":277,"./OperatorNode":155}],160:[function(require,module,exports){
var Node = require('./Node'),

    Unit = require('../../type/Unit'),

    latex = require('../../util/latex'),
    isString = require('../../util/string').isString;

/**
 * @constructor UnitNode
 * @extends {Node}
 * Construct a unit, like '3 cm'
 * @param {Node} value
 * @param {String} unit     Unit name, for example  'meter' 'kg'
 */
function UnitNode (value, unit) {
  if (!(this instanceof UnitNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // validate input
  if (!(value instanceof Node)) throw new TypeError('Node expected for parameter "value"');
  if (!isString(unit))          throw new TypeError('String expected for parameter "unit"');

  this.value = value;
  this.unit = unit;
}

UnitNode.prototype = new Node();

UnitNode.prototype.type = 'UnitNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
UnitNode.prototype._compile = function (defs) {
  return 'math.unit(' + this.value._compile(defs) + ', "' + this.unit + '")';
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
UnitNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // check value
  nodes = nodes.concat(this.value.find(filter));

  return nodes;
};

/**
 * Get string representation
 * @return {String} str
 */
UnitNode.prototype.toString = function() {
  return this.value + ' ' + this.unit;
};

/**
 * Get LaTeX representation
 * @return {String} str
 */
UnitNode.prototype.toTex = function() {
  return this.value + latex.toUnit(this.unit);
};

module.exports = UnitNode;

},{"../../type/Unit":271,"../../util/latex":277,"../../util/string":280,"./Node":154}],161:[function(require,module,exports){
var Node = require('./Node'),
    IndexNode = require('./IndexNode');

/**
 * @constructor UpdateNode
 * @extends {Node}
 * Update a symbol value, like a(2,3) = 4.5
 *
 * @param {IndexNode} index             IndexNode containing symbol and ranges
 * @param {Node} expr                   The expression defining the symbol
 */
function UpdateNode(index, expr) {
  if (!(this instanceof UpdateNode)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  if (!(index instanceof IndexNode)) {
    throw new TypeError('Expected IndexNode for parameter "index"');
  }
  if (!(expr instanceof Node)) {
    throw new TypeError('Expected Node for parameter "expr"');
  }

  this.index = index;
  this.expr = expr;
}

UpdateNode.prototype = new Node();

UpdateNode.prototype.type = 'UpdateNode';

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
UpdateNode.prototype._compile = function (defs) {
  return 'scope["' + this.index.objectName() + '\"] = ' +
      this.index.compileSubset(defs,  this.expr._compile(defs));
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
UpdateNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // search in index
  nodes = nodes.concat(this.index.find(filter));

  // search in expression
  nodes = nodes.concat(this.expr.find(filter));

  return nodes;
};

/**
 * Get string representation
 * @return {String}
 */
UpdateNode.prototype.toString = function() {
  return this.index.toString() + ' = ' + this.expr.toString();
};

/**
 * Get LaTeX representation
 * @return {String}
 */
UpdateNode.prototype.toTex = function() {
  return this.index.toTex() + ' = ' + this.expr.toTex();
};

module.exports = UpdateNode;

},{"./IndexNode":153,"./Node":154}],162:[function(require,module,exports){
exports.ArrayNode = require('./ArrayNode');
exports.AssignmentNode = require('./AssignmentNode');
exports.BlockNode = require('./BlockNode');
exports.ConstantNode = require('./ConstantNode');
exports.IndexNode = require('./IndexNode');
exports.FunctionNode = require('./FunctionNode');
exports.Node = require('./Node');
exports.OperatorNode = require('./OperatorNode');
exports.ParamsNode = require('./ParamsNode');
exports.RangeNode = require('./RangeNode');
exports.SymbolNode = require('./SymbolNode');
exports.TernaryNode = require('./TernaryNode');
exports.UnitNode = require('./UnitNode');
exports.UpdateNode = require('./UpdateNode');

},{"./ArrayNode":148,"./AssignmentNode":149,"./BlockNode":150,"./ConstantNode":151,"./FunctionNode":152,"./IndexNode":153,"./Node":154,"./OperatorNode":155,"./ParamsNode":156,"./RangeNode":157,"./SymbolNode":158,"./TernaryNode":159,"./UnitNode":160,"./UpdateNode":161}],163:[function(require,module,exports){
var util = require('../util/index'),

    ArgumentsError = require('../error/ArgumentsError'),

    isString = util.string.isString,
    isArray = Array.isArray,
    type = util.types.type,

    // types
    Complex = require('../type/Complex'),
    Matrix = require('../type/Matrix'),
    Unit = require('../type/Unit'),
    collection = require('../type/collection'),

    // scope and nodes
    ArrayNode = require('./node/ArrayNode'),
    AssignmentNode = require('./node/AssignmentNode'),
    BlockNode = require('./node/BlockNode'),
    ConstantNode = require('./node/ConstantNode'),
    FunctionNode = require('./node/FunctionNode'),
    IndexNode = require('./node/IndexNode'),
    OperatorNode = require('./node/OperatorNode'),
    ParamsNode = require('./node/ParamsNode'),
    RangeNode = require('./node/RangeNode'),
    SymbolNode = require('./node/SymbolNode'),
    TernaryNode = require('./node/TernaryNode'),
    UnitNode = require('./node/UnitNode'),
    UpdateNode = require('./node/UpdateNode');

/**
 * Parse an expression. Returns a node tree, which can be evaluated by
 * invoking node.eval();
 *
 * Syntax:
 *
 *     parse(expr)
 *     parse(expr, nodes)
 *     parse([expr1, expr2, expr3, ...])
 *     parse([expr1, expr2, expr3, ...], nodes)
 *
 * Example:
 *
 *     var node = parse('sqrt(3^2 + 4^2)');
 *     node.compile(math).eval(); // 5
 *
 *     var scope = {a:3, b:4}
 *     var node = parse('a * b'); // 12
 *     var code = node.compile(math);
 *     code.eval(scope); // 12
 *     scope.a = 5;
 *     code.eval(scope); // 20
 *
 *     var nodes = math.parse(['a = 3', 'b = 4', 'a * b']);
 *     nodes[2].compile(math).eval(); // 12
 *
 * @param {String | String[] | Matrix} expr
 * @param {Object<String, Node>} [nodes]    A set of custom nodes
 * @return {Node | Node[]} node
 * @throws {Error}
 */
function parse (expr, nodes) {
  if (arguments.length != 1 && arguments.length != 2) {
    throw new ArgumentsError('parse', arguments.length, 1, 2);
  }

  // pass extra nodes
  extra_nodes = (type(nodes) === 'object') ? nodes : {};

  if (isString(expr)) {
    // parse a single expression
    expression = expr;
    return parseStart();
  }
  else if (isArray(expr) || expr instanceof Matrix) {
    // parse an array or matrix with expressions
    return collection.deepMap(expr, function (elem) {
      if (!isString(elem)) throw new TypeError('String expected');

      expression = elem;
      return parseStart();
    });
  }
  else {
    // oops
    throw new TypeError('String or matrix expected');
  }
}

// token types enumeration
var TOKENTYPE = {
  NULL : 0,
  DELIMITER : 1,
  NUMBER : 2,
  SYMBOL : 3,
  UNKNOWN : 4
};

// map with all delimiters
var DELIMITERS = {
  ',': true,
  '(': true,
  ')': true,
  '[': true,
  ']': true,
  '\"': true,
  '\n': true,
  ';': true,

  '+': true,
  '-': true,
  '*': true,
  '.*': true,
  '/': true,
  './': true,
  '%': true,
  '^': true,
  '.^': true,
  '!': true,
  '\'': true,
  '=': true,
  ':': true,
  '?': true,

  '==': true,
  '!=': true,
  '<': true,
  '>': true,
  '<=': true,
  '>=': true
};

// map with all named delimiters
var NAMED_DELIMITERS = {
  'mod': true,
  'to': true,
  'in': true
};

var extra_nodes = {};             // current extra nodes
var expression = '';              // current expression
var index = 0;                    // current index in expr
var c = '';                       // current token character in expr
var token = '';                   // current token
var token_type = TOKENTYPE.NULL;  // type of the token

/**
 * Get the first character from the expression.
 * The character is stored into the char c. If the end of the expression is
 * reached, the function puts an empty string in c.
 * @private
 */
function first() {
  index = 0;
  c = expression.charAt(0);
}

/**
 * Get the next character from the expression.
 * The character is stored into the char c. If the end of the expression is
 * reached, the function puts an empty string in c.
 * @private
 */
function next() {
  index++;
  c = expression.charAt(index);
}

/**
 * Preview the next character from the expression.
 * @return {String} cNext
 * @private
 */
function nextPreview() {
  return expression.charAt(index + 1);
}

/**
 * Get next token in the current string expr.
 * The token and token type are available as token and token_type
 * @private
 */
function getToken() {
  token_type = TOKENTYPE.NULL;
  token = '';

  // skip over whitespaces
  while (c == ' ' || c == '\t') {  // space, tab
    // TODO: also take '\r' carriage return as newline? Or does that give problems on mac?
    next();
  }

  // skip comment
  if (c == '#') {
    while (c != '\n' && c != '') {
      next();
    }
  }

  // check for end of expression
  if (c == '') {
    // token is still empty
    token_type = TOKENTYPE.DELIMITER;
    return;
  }

  // check for delimiters consisting of 2 characters
  var c2 = c + nextPreview();
  if (DELIMITERS[c2]) {
    token_type = TOKENTYPE.DELIMITER;
    token = c2;
    next();
    next();
    return;
  }

  // check for delimiters consisting of 1 character
  if (DELIMITERS[c]) {
    token_type = TOKENTYPE.DELIMITER;
    token = c;
    next();
    return;
  }

  // check for a number
  if (isDigitDot(c)) {
    token_type = TOKENTYPE.NUMBER;

    // get number, can have a single dot
    if (c == '.') {
      token += c;
      next();

      if (!isDigit(c)) {
        // this is no legal number, it is just a dot
        token_type = TOKENTYPE.UNKNOWN;
      }
    }
    else {
      while (isDigit(c)) {
        token += c;
        next();
      }
      if (c == '.') {
        token += c;
        next();
      }
    }
    while (isDigit(c)) {
      token += c;
      next();
    }

    // check for exponential notation like "2.3e-4" or "1.23e50"
    if (c == 'E' || c == 'e') {
      token += c;
      next();

      if (c == '+' || c == '-') {
        token += c;
        next();
      }

      // Scientific notation MUST be followed by an exponent
      if (!isDigit(c)) {
        // this is no legal number, exponent is missing.
        token_type = TOKENTYPE.UNKNOWN;
      }

      while (isDigit(c)) {
        token += c;
        next();
      }
    }

    return;
  }

  // check for variables, functions, named operators
  if (isAlpha(c)) {
    while (isAlpha(c) || isDigit(c)) {
      token += c;
      next();
    }

    if (NAMED_DELIMITERS[token]) {
      token_type = TOKENTYPE.DELIMITER;
    }
    else {
      token_type = TOKENTYPE.SYMBOL;
    }

    return;
  }

  // something unknown is found, wrong characters -> a syntax error
  token_type = TOKENTYPE.UNKNOWN;
  while (c != '') {
    token += c;
    next();
  }
  throw createSyntaxError('Syntax error in part "' + token + '"');
}

/**
 * Skip newline tokens
 */
function skipNewlines () {
  while (token == '\n') {
    getToken();
  }
}

/**
 * Check if a given name is valid
 * if not, an error is thrown
 * @param {String} name
 * @return {boolean} valid
 * @private
 */
  /** TODO: check for valid symbol name
function isValidSymbolName (name) {
  for (var i = 0, iMax = name.length; i < iMax; i++) {
    var c = name.charAt(i);
    //var valid = (isAlpha(c) || (i > 0 && isDigit(c))); // TODO: allow digits in symbol name
    var valid = (isAlpha(c));
    if (!valid) {
      return false;
    }
  }

  return true;
}
*/

/**
 * checks if the given char c is a letter (upper or lower case)
 * or underscore
 * @param {String} c   a string with one character
 * @return {Boolean}
 * @private
 */
function isAlpha (c) {
  return ((c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      c == '_');
}

/**
 * checks if the given char c is a digit or dot
 * @param {String} c   a string with one character
 * @return {Boolean}
 * @private
 */
function isDigitDot (c) {
  return ((c >= '0' && c <= '9') ||
      c == '.');
}

/**
 * checks if the given char c is a digit
 * @param {String} c   a string with one character
 * @return {Boolean}
 * @private
 */
function isDigit (c) {
  return ((c >= '0' && c <= '9'));
}

/**
 * Start of the parse levels below, in order of precedence
 * @return {Node} node
 * @private
 */
function parseStart () {
  // get the first character in expression
  first();

  getToken();

  var node = parseBlock();

  // check for garbage at the end of the expression
  // an expression ends with a empty character '' and token_type DELIMITER
  if (token != '') {
    if (token_type == TOKENTYPE.DELIMITER) {
      // user entered a not existing operator like "//"

      // TODO: give hints for aliases, for example with "<>" give as hint " did you mean != ?"
      throw createError('Unknown operator ' + token);
    }
    else {
      throw createSyntaxError('Unexpected part "' + token + '"');
    }
  }

  return node;
}

/**
 * Parse a block with expressions. Expressions can be separated by a newline
 * character '\n', or by a semicolon ';'. In case of a semicolon, no output
 * of the preceding line is returned.
 * @return {Node} node
 * @private
 */
function parseBlock () {
  var node, block, visible;

  if (token == '') {
    // empty expression
    return new ConstantNode('undefined', 'undefined');
  }

  if (token != '\n' && token != ';') {
    node = parseAns();
  }

  while (token == '\n' || token == ';') {
    if (!block) {
      // initialize the block
      block = new BlockNode();
      if (node) {
        visible = (token != ';');
        block.add(node, visible);
      }
    }

    getToken();
    if (token != '\n' && token != ';' && token != '') {
      node = parseAns();

      visible = (token != ';');
      block.add(node, visible);
    }
  }

  if (block) {
    return block;
  }

  return node;
}

/**
 * Parse assignment of ans.
 * Ans is assigned when the expression itself is no variable or function
 * assignment
 * @return {Node} node
 * @private
 */
function parseAns () {
  var expression = parseFunctionAssignment();

  // create a variable definition for ans
  var name = 'ans';
  return new AssignmentNode(name, expression);
}

/**
 * Parse a function assignment like "function f(a,b) = a*b"
 * @return {Node} node
 * @private
 */
function parseFunctionAssignment () {
  // TODO: function assignment using keyword 'function' is deprecated since version 0.18.0, cleanup some day
  if (token_type == TOKENTYPE.SYMBOL && token == 'function') {
    throw createSyntaxError('Deprecated keyword "function". ' +
        'Functions can now be assigned without it, like "f(x) = x^2".');
  }

  return parseAssignment();
}

/**
 * Assignment of a variable, can be a variable like "a=2.3" or a updating an
 * existing variable like "matrix(2,3:5)=[6,7,8]"
 * @return {Node} node
 * @private
 */
function parseAssignment () {
  var name, args, expr;

  var node = parseRange();

  if (token == '=') {
    if (node instanceof SymbolNode) {
      // parse a variable assignment like 'a = 2/3'
      name = node.name;
      getToken();
      expr = parseAssignment();
      return new AssignmentNode(name, expr);
    }
    else if (node instanceof IndexNode) {
      // parse a matrix subset assignment like 'A[1,2] = 4'
      getToken();
      expr = parseAssignment();
      return new UpdateNode(node, expr);
    }
    else if (node instanceof ParamsNode) {
      // parse function assignment like 'f(x) = x^2'
      var valid = true;
      args = [];
      if (node.object instanceof SymbolNode) {
        name = node.object.name;
        node.params.forEach(function (param, index) {
          if (param instanceof SymbolNode) {
            args[index] = param.name;
          }
          else {
            valid = false;
          }
        });
      }
      else {
        valid = false;
      }

      if (valid) {
        getToken();
        expr = parseAssignment();
        return new FunctionNode(name, args, expr);
      }
    }

    throw createSyntaxError('Invalid left hand side of assignment operator =');
  }

  return node;
}

/**
 * parse range, "start:end", "start:step:end", ":", "start:", ":end", etc
 * @return {Node} node
 * @private
 */
function parseRange () {
  var node, params = [];

  if (token == ':') {
    // implicit start=1 (one-based)
    node = new ConstantNode('number', '1');
  }
  else {
    // explicit start
    node = parseBitwiseConditions();
  }

  if (token == ':') {
    params.push(node);

    // parse step and end
    while (token == ':') {
      getToken();
      if (token == ')' || token == ']' || token == ',' || token == '') {
        // implicit end
        params.push(new SymbolNode('end'));
      }
      else {
        // explicit end
        params.push(parseBitwiseConditions());
      }
    }

    // swap step and end
    if (params.length == 3) {
      var step = params[2];
      params[2] = params[1];
      params[1] = step;
    }
    node = new RangeNode(params);
  }

  return node;
}

/**
 * conditional operators and bitshift
 * @return {Node} node
 * @private
 */
function parseBitwiseConditions () {
  var node = parseIfElse();

  /* TODO: implement bitwise conditions
   var operators = {
   '&' : 'bitwiseand',
   '|' : 'bitwiseor',
   // todo: bitwise xor?
   '<<': 'bitshiftleft',
   '>>': 'bitshiftright'
   };
   while (token in operators) {
   var name = token;

   getToken();
   var params = [node, parseComparison()];
   node = new OperatorNode(name, fn, params);
   }
   */

  return node;
}

/**
 * conditional operation
 *
 *     condition ? truePart : falsePart
 *
 * Note: conditional operator is right-associative
 *
 * @return {Node} node
 * @private
 */
function parseIfElse () {
  var node = parseComparison();

  while (token == '?') {
    getToken();
    var params = [node];
    params.push(parseComparison());

    if (token != ':') throw createSyntaxError('False part of conditional expression expected');
    getToken();

    params.push(parseIfElse());

    node = new TernaryNode(['?', ':'], 'ifElse', params);
  }

  return node;
}

/**
 * comparison operators
 * @return {Node} node
 * @private
 */
function parseComparison () {
  var node, operators, name, fn, params;

  node = parseConditions();

  operators = {
    '==': 'equal',
    '!=': 'unequal',
    '<': 'smaller',
    '>': 'larger',
    '<=': 'smallereq',
    '>=': 'largereq'
  };
  while (token in operators) {
    name = token;
    fn = operators[name];

    getToken();
    params = [node, parseConditions()];
    node = new OperatorNode(name, fn, params);
  }

  return node;
}

/**
 * conditions like and, or, in
 * @return {Node} node
 * @private
 */
function parseConditions () {
  var node, operators, name, fn, params;

  node = parseAddSubtract();

  // TODO: precedence of And above Or?
  // TODO: implement a method for unit to number conversion
  operators = {
    'to' : 'to',
    'in' : 'to'   // alias of to
    /* TODO: implement conditions
     'and' : 'and',
     '&&' : 'and',
     'or': 'or',
     '||': 'or',
     'xor': 'xor'
     */
  };

  while (token in operators) {
    name = token;
    fn = operators[name];

    getToken();
    params = [node, parseAddSubtract()];
    node = new OperatorNode(name, fn, params);
  }

  return node;
}

/**
 * add or subtract
 * @return {Node} node
 * @private
 */
function parseAddSubtract ()  {
  var node, operators, name, fn, params;

  node = parseMultiplyDivide();

  operators = {
    '+': 'add',
    '-': 'subtract'
  };
  while (token in operators) {
    name = token;
    fn = operators[name];

    getToken();
    params = [node, parseMultiplyDivide()];
    node = new OperatorNode(name, fn, params);
  }

  return node;
}

/**
 * multiply, divide, modulus
 * @return {Node} node
 * @private
 */
function parseMultiplyDivide () {
  var node, operators, name, fn, params;

  node = parseUnit();

  operators = {
    '*': 'multiply',
    '.*': 'emultiply',
    '/': 'divide',
    './': 'edivide',
    '%': 'mod',
    'mod': 'mod'
  };

  while (token in operators) {
    name = token;
    fn = operators[name];

    getToken();
    params = [node, parseUnit()];
    node = new OperatorNode(name, fn, params);
  }

  return node;
}

/**
 * parse units conversion 'in' like '5cm in inch'
 * @return {Node} node
 * @private
 */
function parseUnit() {
  var node, symbol;

  node = parseUnary();

  if (token_type == TOKENTYPE.SYMBOL || token == 'in') {
    // note unit 'in' (inch) is also a conversion operator
    symbol = token;

    getToken();

    node = new UnitNode(node, symbol);
  }

  return node;
}

/**
 * Unary minus
 * @return {Node} node
 * @private
 */
function parseUnary () {
  var name, fn, params;

  if (token == '-') {
    name = token;
    fn = 'unary';
    getToken();
    params = [parseUnary()];

    return new OperatorNode(name, fn, params);
  }

  return parsePow();
}

/**
 * power
 * Note: power operator is right associative
 * @return {Node} node
 * @private
 */
function parsePow () {
  var node, name, fn, params;

  node = parseLeftHandOperators();

  if (token == '^' || token == '.^') {
    name = token;
    fn = (name == '^') ? 'pow' : 'epow';

    getToken();
    params = [node, parseUnary()]; // Go back to unary, we can have '2^-3'
    node = new OperatorNode(name, fn, params);
  }

  return node;
}

/**
 * Left hand operators: factorial x!, transpose x'
 * @return {Node} node
 * @private
 */
function parseLeftHandOperators ()  {
  var node, operators, name, fn, params;

  node = parseCustomNodes();

  operators = {
    '!': 'factorial',
    '\'': 'transpose'
  };

  while (token in operators) {
    name = token;
    fn = operators[name];

    getToken();
    params = [node];

    node = new OperatorNode(name, fn, params);

    node = parseParams(node); // cases like "A'[2,3]"
  }

  return node;
}

/**
 * Parse a custom node handler. A node handler can be used to process
 * nodes in a custom way, for example for handling a plot.
 *
 * A handler must be passed as second argument of the parse function.
 * - must extend math.expression.node.Node
 * - must contain a function _compile(defs: Object) : String
 * - must contain a function find(filter: Object) : Node[]
 * - must contain a function toString() : String
 * - the constructor is called with a single argument containing all parameters
 *
 * For example:
 *
 *     nodes = {
 *       'plot': PlotHandler
 *     };
 *
 * The constructor of the handler is called as:
 *
 *     node = new PlotHandler(params);
 *
 * The handler will be invoked when evaluating an expression like:
 *
 *     node = math.parse('plot(sin(x), x)', nodes);
 *
 * @return {Node} node
 * @private
 */
function parseCustomNodes () {
  var params = [], handler;

  if (token_type == TOKENTYPE.SYMBOL && extra_nodes[token]) {
    handler = extra_nodes[token];

    getToken();

    // parse parameters
    if (token == '(') {
      params = [];

      getToken();

      if (token != ')') {
        params.push(parseRange());

        // parse a list with parameters
        while (token == ',') {
          getToken();

          params.push(parseRange());
        }
      }

      if (token != ')') {
        throw createSyntaxError('Parenthesis ) expected');
      }
      getToken();
    }

    // create a new node handler
    //noinspection JSValidateTypes
    return new handler(params);
  }

  return parseSymbol();
}

/**
 * parse symbols: functions, variables, constants, units
 * @return {Node} node
 * @private
 */
function parseSymbol () {
  var node, name;

  if (token_type == TOKENTYPE.SYMBOL ||
      (token_type == TOKENTYPE.DELIMITER && token in NAMED_DELIMITERS)) {
    name = token;

    getToken();

    // create a symbol
    node = new SymbolNode(name);

    // parse parameters
    return parseParams(node);
  }

  return parseString();
}

/**
 * parse parameters, enclosed in parenthesis. Can be two types:
 * - round brackets (...) will return a ParamsNode
 * - square brackets [...] will return an IndexNode
 * @param {Node} node    Node on which to apply the parameters. If there
 *                       are no parameters in the expression, the node
 *                       itself is returned
 * @return {Node} node
 * @private
 */
function parseParams (node) {
  var bracket, params;

  while (token == '(' || token == '[') {
    bracket = token;
    params = [];

    getToken();

    if (token != ')' && token != ']') {
      params.push(parseRange());

      // parse a list with parameters
      while (token == ',') {
        getToken();
        params.push(parseRange());
      }
    }

    if ((bracket == '(' && token != ')')) {
      throw createSyntaxError('Parenthesis ) expected');
    }
    if ((bracket == '[' && token != ']')) {
      throw createSyntaxError('Parenthesis ] expected');
    }
    getToken();

    if (bracket == '(') {
      node = new ParamsNode(node, params);
    }
    else {
      node = new IndexNode(node, params);
    }
  }

  return node;
}

/**
 * parse a string.
 * A string is enclosed by double quotes
 * @return {Node} node
 * @private
 */
function parseString () {
  var node, str, tPrev;

  if (token == '"') {
    // string "..."
    str = '';
    tPrev = '';
    while (c != '' && (c != '\"' || tPrev == '\\')) { // also handle escape character
      str += c;
      tPrev = c;
      next();
    }

    getToken();
    if (token != '"') {
      throw createSyntaxError('End of string " expected');
    }
    getToken();

    // create constant
    node = new ConstantNode('string', str);

    // parse parameters
    node = parseParams(node);

    return node;
  }

  return parseMatrix();
}

/**
 * parse the matrix
 * @return {Node} node
 * @private
 */
function parseMatrix () {
  var array, params, rows, cols;

  if (token == '[') {
    // matrix [...]
    getToken();
    skipNewlines();

    if (token != ']') {
      // this is a non-empty matrix
      var row = parseRow();

      if (token == ';') {
        // 2 dimensional array
        rows = 1;
        params = [row];

        // the rows of the matrix are separated by dot-comma's
        while (token == ';') {
          getToken();
          skipNewlines();

          params[rows] = parseRow();
          rows++;

          skipNewlines();
        }

        if (token != ']') {
          throw createSyntaxError('End of matrix ] expected');
        }
        getToken();

        // check if the number of columns matches in all rows
        cols = params[0].nodes.length;
        for (var r = 1; r < rows; r++) {
          if (params[r].nodes.length != cols) {
            throw createError('Column dimensions mismatch ' +
                '(' + params[r].nodes.length + ' != ' + cols + ')');
          }
        }

        array = new ArrayNode(params);
      }
      else {
        // 1 dimensional vector
        if (token != ']') {
          throw createSyntaxError('End of matrix ] expected');
        }
        getToken();

        array = row;
      }
    }
    else {
      // this is an empty matrix "[ ]"
      getToken();
      array = new ArrayNode([]);
    }

    // parse parameters
    array = parseParams(array);

    return array;
  }

  return parseNumber();
}

/**
 * Parse a single comma-separated row from a matrix, like 'a, b, c'
 * @return {ArrayNode} node
 */
function parseRow () {
  var params = [parseAssignment()];
  var len = 1;

  while (token == ',') {
    getToken();
    skipNewlines();

    // parse expression
    params[len] = parseAssignment();
    len++;

    skipNewlines();
  }

  return new ArrayNode(params);
}

/**
 * parse a number
 * @return {Node} node
 * @private
 */
function parseNumber () {
  var node, complex, number;

  if (token_type == TOKENTYPE.NUMBER) {
    // this is a number
    number = token;
    getToken();

    if (token == 'i' || token == 'I') {
      // create a complex number
      getToken();
      node = new ConstantNode('complex', number);
    }
    else {
      // a number
      node = new ConstantNode('number', number);
    }

    // parse parameters
    node = parseParams(node);

    return node;
  }

  return parseParentheses();
}

/**
 * parentheses
 * @return {Node} node
 * @private
 */
function parseParentheses () {
  var node;

  // check if it is a parenthesized expression
  if (token == '(') {
    // parentheses (...)
    getToken();
    node = parseAssignment(); // start again

    if (token != ')') {
      throw createSyntaxError('Parenthesis ) expected');
    }
    getToken();

    /* TODO: implicit multiplication?
     // TODO: how to calculate a=3; 2/2a ? is this (2/2)*a or 2/(2*a) ?
     // check for implicit multiplication
     if (token_type == TOKENTYPE.SYMBOL) {
     node = multiply(node, parsePow());
     }
     //*/

    // parse parameters
    node = parseParams(node);

    return node;
  }

  return parseEnd();
}

/**
 * Evaluated when the expression is not yet ended but expected to end
 * @return {Node} res
 * @private
 */
function parseEnd () {
  if (token == '') {
    // syntax error or unexpected end of expression
    throw createSyntaxError('Unexpected end of expression');
  } else {
    throw createSyntaxError('Value expected');
  }
}

/**
 * Shortcut for getting the current row value (one based)
 * Returns the line of the currently handled expression
 * @private
 */
/* TODO: implement keeping track on the row number
function row () {
  return null;
}
*/

/**
 * Shortcut for getting the current col value (one based)
 * Returns the column (position) where the last token starts
 * @private
 */
function col () {
  return index - token.length + 1;
}

/**
 * Create an error
 * @param {String} message
 * @return {SyntaxError} instantiated error
 * @private
 */
function createSyntaxError (message) {
  var c = col();
  var error = new SyntaxError(message + ' (char ' + c + ')');
  error['char'] = c;

  return error;
}

/**
 * Create an error
 * @param {String} message
 * @return {Error} instantiated error
 * @private
 */
function createError (message) {
  var c = col();
  var error = new Error(message + ' (char ' + c + ')');
  error['char'] = c;

  return error;
}

module.exports = parse;

},{"../error/ArgumentsError":28,"../type/Complex":266,"../type/Matrix":269,"../type/Unit":271,"../type/collection":272,"../util/index":276,"./node/ArrayNode":148,"./node/AssignmentNode":149,"./node/BlockNode":150,"./node/ConstantNode":151,"./node/FunctionNode":152,"./node/IndexNode":153,"./node/OperatorNode":155,"./node/ParamsNode":156,"./node/RangeNode":157,"./node/SymbolNode":158,"./node/TernaryNode":159,"./node/UnitNode":160,"./node/UpdateNode":161}],164:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Calculate the absolute value of a number. For matrices, the function is
   * evaluated element wise.
   *
   * Syntax:
   *
   *    math.abs(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.abs(3.5);                // returns Number 3.5
   *    math.abs(-4.2);               // returns Number 4.2
   *
   *    math.abs([3, -5, -1, 0, 2]);  // returns Array [3, 5, 1, 0, 2]
   *
   * See also:
   *
   *    sign
   *
   * @param  {Number | BigNumber | Boolean | Complex | Array | Matrix} x
   *            A number or matrix for which to get the absolute value
   * @return {Number | BigNumber | Complex | Array | Matrix}
   *            Absolute value of `x`
   */
  math.abs = function abs(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('abs', arguments.length, 1);
    }

    if (isNumber(x)) {
      return Math.abs(x);
    }

    if (isComplex(x)) {
      return Math.sqrt(x.re * x.re + x.im * x.im);
    }

    if (x instanceof BigNumber) {
      return x.abs();
    }

    if (isCollection(x)) {
      return collection.deepMap(x, abs);
    }

    if (isBoolean(x)) {
      return Math.abs(x);
    }

    throw new math.error.UnsupportedTypeError('abs', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Matrix":269,"../../type/collection":272,"../../util/index":276}],165:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Matrix = require('../../type/Matrix'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isBoolean = util['boolean'].isBoolean,
      isNumber = util.number.isNumber,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Add two values, `x + y`.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.add(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.add(2, 3);               // returns Number 5
   *
   *    var a = math.complex(2, 3);
   *    var b = math.complex(-4, 1);
   *    math.add(a, b);               // returns Complex -2 + 4i
   *
   *    math.add([1, 2, 3], 4);       // returns Array [5, 6, 7]
   *
   *    var c = math.unit('5 cm');
   *    var d = math.unit('2.1 mm');
   *    math.add(c, d);               // returns Unit 52.1 mm
   *
   * See also:
   *
   *    subtract
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | String | Array | Matrix} x First value to add
   * @param  {Number | BigNumber | Boolean | Complex | Unit | String | Array | Matrix} y Second value to add
   * @return {Number | BigNumber | Complex | Unit | String | Array | Matrix} Sum of `x` and `y`
   */
  math.add = function add(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('add', arguments.length, 2);
    }

    if (isNumber(x)) {
      if (isNumber(y)) {
        // number + number
        return x + y;
      }
      else if (isComplex(y)) {
        // number + complex
        return new Complex(
            x + y.re,
            y.im
        )
      }
    }

    if (isComplex(x)) {
      if (isComplex(y)) {
        // complex + complex
        return new Complex(
            x.re + y.re,
            x.im + y.im
        );
      }
      else if (isNumber(y)) {
        // complex + number
        return new Complex(
            x.re + y,
            x.im
        )
      }
    }

    if (isUnit(x)) {
      if (isUnit(y)) {
        if (x.value == null) {
          throw new Error('Parameter x contains a unit with undefined value');
        }

        if (y.value == null) {
          throw new Error('Parameter y contains a unit with undefined value');
        }

        if (!x.equalBase(y)) {
          throw new Error('Units do not match');
        }

        var res = x.clone();
        res.value += y.value;
        res.fixPrefix = false;
        return res;
      }
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return x.plus(y);
      }

      // downgrade to Number
      return add(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return x.plus(y)
      }

      // downgrade to Number
      return add(x, y.toNumber());
    }

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, add);
    }

    if (isString(x) || isString(y)) {
      return x + y;
    }

    if (isBoolean(x)) {
      return add(+x, y);
    }
    if (isBoolean(y)) {
      return add(x, +y);
    }

    throw new math.error.UnsupportedTypeError('add', math['typeof'](x), math['typeof'](y));
  };
};

},{"../../type/Complex":266,"../../type/Matrix":269,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],166:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isCollection =collection.isCollection,
      isComplex = Complex.isComplex;

  /**
   * Round a value towards plus infinity
   * If `x` is complex, both real and imaginary part are rounded towards plus infinity.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.ceil(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.ceil(3.2);               // returns Number 4
   *    math.ceil(3.8);               // returns Number 4
   *    math.ceil(-4.2);              // returns Number -4
   *    math.ceil(-4.7);              // returns Number -4
   *
   *    var c = math.complex(3.2, -2.7);
   *    math.ceil(c);                 // returns Complex 4 - 2i
   *
   *    math.ceil([3.2, 3.8, -4.7]);  // returns Array [4, 4, -4]
   *
   * See also:
   *
   *    floor, fix, round
   *
   * @param  {Number | BigNumber | Boolean | Complex | Array | Matrix} x  Number to be rounded
   * @return {Number | BigNumber | Complex | Array | Matrix} Rounded value
   */
  math.ceil = function ceil(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('ceil', arguments.length, 1);
    }

    if (isNumber(x)) {
      return Math.ceil(x);
    }

    if (isComplex(x)) {
      return new Complex (
          Math.ceil(x.re),
          Math.ceil(x.im)
      );
    }

    if (x instanceof BigNumber) {
      return x.ceil();
    }

    if (isCollection(x)) {
      return collection.deepMap(x, ceil);
    }

    if (isBoolean(x)) {
      return Math.ceil(x);
    }

    throw new math.error.UnsupportedTypeError('ceil', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],167:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      nearlyEqual = util.number.nearlyEqual,
      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Compare two values. Returns 1 when x > y, -1 when x < y, and 0 when x == y.
   *
   * x and y are considered equal when the relative difference between x and y
   * is smaller than the configured epsilon. The function cannot be used to
   * compare values smaller than approximately 2.22e-16.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.compare(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.compare(6, 1);           // returns 1
   *    math.compare(2, 3);           // returns -1
   *    math.compare(7, 7);           // returns 0
   *
   *    var a = math.unit('5 cm');
   *    var b = math.unit('40 mm');
   *    math.compare(a, b);           // returns 1
   *
   *    math.compare(2, [1, 2, 3]);   // returns [1, 0, -1]
   *
   * See also:
   *
   *    equal, unequal, smaller, smallereq, larger, largereq
   *
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} x First value to compare
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} y Second value to compare
   * @return {Number | BigNumber | Array | Matrix} Returns the result of the comparison: 1, 0 or -1.
   */
  math.compare = function compare(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('compare', arguments.length, 2);
    }

    if (isNumber(x) && isNumber(y)) {
      return nearlyEqual(x, y, config.epsilon) ? 0 : (x > y ? 1 : -1);
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return new BigNumber(x.cmp(y));
      }

      // downgrade to Number
      return compare(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return new BigNumber(x.cmp(y));
      }

      // downgrade to Number
      return compare(x, y.toNumber());
    }

    if ((isUnit(x)) && (isUnit(y))) {
      if (!x.equalBase(y)) {
        throw new Error('Cannot compare units with different base');
      }
      return (x.value > y.value) ? 1 : ((x.value < y.value) ? -1 : 0);
    }

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, compare);
    }

    // Note: test strings after testing collections,
    // else we can't compare a string with a matrix
    if (isString(x) || isString(y)) {
      return (x > y) ? 1 : ((x < y) ? -1 : 0);
    }

    if (isBoolean(x)) {
      return compare(+x, y);
    }
    if (isBoolean(y)) {
      return compare(x, +y);
    }

    if (isComplex(x) || isComplex(y)) {
      throw new TypeError('No ordering relation is defined for complex numbers');
    }

    throw new math.error.UnsupportedTypeError('compare', math['typeof'](x), math['typeof'](y));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],168:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Compute the cube of a value, `x * x * x`.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.cube(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.cube(2);            // returns Number 8
   *    math.pow(2, 3);          // returns Number 8
   *    math.cube(4);            // returns Number 64
   *    4 * 4 * 4;               // returns Number 64
   *
   *    math.cube([1, 2, 3, 4]); // returns Array [1, 8, 27, 64]
   *
   * See also:
   *
   *    multiply, square, pow
   *
   * @param  {Number | BigNumber | Boolean | Complex | Array | Matrix} x  Number for which to calculate the cube
   * @return {Number | BigNumber | Complex | Array | Matrix} Cube of x
   */
  math.cube = function cube(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('cube', arguments.length, 1);
    }

    if (isNumber(x)) {
      return x * x * x;
    }

    if (isComplex(x)) {
      return math.multiply(math.multiply(x, x), x);
    }

    if (x instanceof BigNumber) {
      return x.times(x).times(x);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, cube);
    }

    if (isBoolean(x)) {
      return cube(+x);
    }

    throw new math.error.UnsupportedTypeError('cube', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],169:[function(require,module,exports){
module.exports = function(math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Matrix = require('../../type/Matrix'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Divide two values, `x / y`.
   * To divide matrices, `x` is multiplied with the inverse of `y`: `x * inv(y)`.
   *
   * Syntax:
   *
   *    math.divide(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.divide(2, 3);            // returns Number 0.6666666666666666
   *
   *    var a = math.complex(5, 14);
   *    var b = math.complex(4, 1);
   *    math.divide(a, b);            // returns Complex 2 + 3i
   *
   *    var c = [[7, -6], [13, -4]];
   *    var d = [[1, 2], [4, 3]];
   *    math.divide(c, d);            // returns Array [[-9, 4], [-11, 6]]
   *
   *    var e = math.unit('18 km');
   *    math.divide(e, 4.5);          // returns Unit 4 km
   *
   * See also:
   *
   *    multiply
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} x   Numerator
   * @param  {Number | BigNumber | Boolean | Complex | Array | Matrix} y          Denominator
   * @return {Number | BigNumber | Complex | Unit | Array | Matrix}               Quotient, `x / y`
   */
  math.divide = function divide(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('divide', arguments.length, 2);
    }

    if (isNumber(x)) {
      if (isNumber(y)) {
        // number / number
        return x / y;
      }
      else if (isComplex(y)) {
        // number / complex
        return _divideComplex(new Complex(x, 0), y);
      }
    }

    if (isComplex(x)) {
      if (isComplex(y)) {
        // complex / complex
        return _divideComplex(x, y);
      }
      else if (isNumber(y)) {
        // complex / number
        return _divideComplex(x, new Complex(y, 0));
      }
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return x.div(y);
      }

      // downgrade to Number
      return divide(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return x.div(y)
      }

      // downgrade to Number
      return divide(x, y.toNumber());
    }

    if (isUnit(x)) {
      if (isNumber(y)) {
        var res = x.clone();
        res.value /= y;
        return res;
      }
    }

    if (isCollection(x)) {
      if (isCollection(y)) {
        // TODO: implement matrix right division using pseudo inverse
        // http://www.mathworks.nl/help/matlab/ref/mrdivide.html
        // http://www.gnu.org/software/octave/doc/interpreter/Arithmetic-Ops.html
        // http://stackoverflow.com/questions/12263932/how-does-gnu-octave-matrix-division-work-getting-unexpected-behaviour
        return math.multiply(x, math.inv(y));
      }
      else {
        // matrix / scalar
        return collection.deepMap2(x, y, divide);
      }
    }

    if (isCollection(y)) {
      // TODO: implement matrix right division using pseudo inverse
      return math.multiply(x, math.inv(y));
    }

    if (isBoolean(x)) {
      return divide(+x, y);
    }
    if (isBoolean(y)) {
      return divide(x, +y);
    }

    throw new math.error.UnsupportedTypeError('divide', math['typeof'](x), math['typeof'](y));
  };

  /**
   * Divide two complex numbers. x / y or divide(x, y)
   * @param {Complex} x
   * @param {Complex} y
   * @return {Complex} res
   * @private
   */
  function _divideComplex (x, y) {
    var den = y.re * y.re + y.im * y.im;
    if (den != 0) {
      return new Complex(
          (x.re * y.re + x.im * y.im) / den,
          (x.im * y.re - x.re * y.im) / den
      );
    }
    else {
      // both y.re and y.im are zero
      return new Complex(
          (x.re != 0) ? (x.re / 0) : 0,
          (x.im != 0) ? (x.im / 0) : 0
      );
    }
  }
};

},{"../../type/Complex":266,"../../type/Matrix":269,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],170:[function(require,module,exports){
module.exports = function (math) {
  var collection = require('../../type/collection');

  /**
   * Divide two matrices element wise. The function accepts both matrices and
   * scalar values.
   *
   * Syntax:
   *
   *    math.edivide(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.edivide(2, 4);   // returns 0.5
   *
   *    a = [[9, 5], [6, 1]];
   *    b = [[3, 2], [5, 2]];
   *
   *    math.edivide(a, b);   // returns [[3, 2.5], [1.2, 0.5]]
   *    math.divide(a, b);    // returns [[1.75, 0.75], [-1.75, 2.25]]
   *
   * See also:
   *
   *    divide, multiply, emultiply
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} x Numerator
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} y Denominator
   * @return {Number | BigNumber | Complex | Unit | Array | Matrix}             Quotient, `x ./ y`
   */
  math.edivide = function edivide(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('edivide', arguments.length, 2);
    }

    return collection.deepMap2(x, y, math.divide);
  };
};

},{"../../type/collection":272}],171:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),
      collection = require('../../type/collection');

  /**
   * Multiply two matrices element wise. The function accepts both matrices and
   * scalar values.
   *
   * Syntax:
   *
   *    math.emultiply(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.emultiply(2, 4); // returns 8
   *
   *    a = [[9, 5], [6, 1]];
   *    b = [[3, 2], [5, 2]];
   *
   *    math.emultiply(a, b); // returns [[27, 10], [30, 2]]
   *    math.multiply(a, b);  // returns [[52, 28], [23, 14]]
   *
   * See also:
   *
   *    multiply, divide, edivide
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} x Left hand value
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} y Right hand value
   * @return {Number | BigNumber | Complex | Unit | Array | Matrix}             Multiplication of `x` and `y`
   */
  math.emultiply = function emultiply(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('emultiply', arguments.length, 2);
    }

    return collection.deepMap2(x, y, math.multiply);
  };
};

},{"../../type/collection":272,"../../util/index":276}],172:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),
      collection = require('../../type/collection');

  /**
   * Calculates the power of x to y element wise.
   *
   * Syntax:
   *
   *    math.epow(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.epow(2, 3);              // returns Number 8
   *
   *    var a = [[1, 2], [4, 3]];
   *    math.epow(a, 2);              // returns Array [[1, 4], [16, 9]]
   *    math.pow(a, 2);               // returns Array [[9, 8], [16, 17]]
   *
   * See also:
   *
   *    pow, sqrt, multiply
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} x  The base
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} y  The exponent
   * @return {Number | BigNumber | Complex | Unit | Array | Matrix}              The value of `x` to the power `y`
   */
  math.epow = function epow(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('epow', arguments.length, 2);
    }

    return collection.deepMap2(x, y, math.pow);
  };
};

},{"../../type/collection":272,"../../util/index":276}],173:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      nearlyEqual = util.number.nearlyEqual,
      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Test whether two values are equal.
   *
   * The function tests whether the relative difference between x and y is
   * smaller than the configured epsilon. The function cannot be used to
   * compare values smaller than approximately 2.22e-16.
   *
   * For matrices, the function is evaluated element wise.
   * In case of complex numbers, x.re must equal y.re, and x.im must equal y.im.
   *
   * Syntax:
   *
   *    math.equal(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.equal(2 + 2, 3);         // returns false
   *    math.equal(2 + 2, 4);         // returns true
   *
   *    var a = math.unit('50 cm');
   *    var b = math.unit('5 m');
   *    math.equal(a, b);             // returns true
   *
   * See also:
   *
   *    unequal, smaller, smallereq, larger, largereq, compare
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | String | Array | Matrix} x First value to compare
   * @param  {Number | BigNumber | Boolean | Complex | Unit | String | Array | Matrix} y Second value to compare
   * @return {Boolean | Array | Matrix} Returns true when the compared values are equal, else returns false
   */
  math.equal = function equal(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('equal', arguments.length, 2);
    }

    if (isNumber(x)) {
      if (isNumber(y)) {
        return nearlyEqual(x, y, config.epsilon);
      }
      else if (isComplex(y)) {
        return nearlyEqual(x, y.re, config.epsilon) && nearlyEqual(y.im, 0, config.epsilon);
      }
    }

    if (isComplex(x)) {
      if (isNumber(y)) {
        return nearlyEqual(x.re, y, config.epsilon) && nearlyEqual(x.im, 0, config.epsilon);
      }
      else if (isComplex(y)) {
        return nearlyEqual(x.re, y.re, config.epsilon) && nearlyEqual(x.im, y.im, config.epsilon);
      }
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return x.eq(y);
      }

      // downgrade to Number
      return equal(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return x.eq(y)
      }

      // downgrade to Number
      return equal(x, y.toNumber());
    }

    if ((isUnit(x)) && (isUnit(y))) {
      if (!x.equalBase(y)) {
        throw new Error('Cannot compare units with different base');
      }
      return x.value == y.value;
    }

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, equal);
    }

    // Note: test strings after testing collections,
    // else we can't compare a string with a matrix
    if (isString(x) || isString(y)) {
      return x == y;
    }

    if (isBoolean(x)) {
      return equal(+x, y);
    }
    if (isBoolean(y)) {
      return equal(x, +y);
    }

    throw new math.error.UnsupportedTypeError('equal', math['typeof'](x), math['typeof'](y));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],174:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Calculate the exponent of a value.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.exp(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.exp(2);                  // returns Number 7.3890560989306495
   *    math.pow(math.e, 2);          // returns Number 7.3890560989306495
   *    math.log(math.exp(2));        // returns Number 2
   *
   *    math.exp([1, 2, 3]);
   *    // returns Array [
   *    //   2.718281828459045,
   *    //   7.3890560989306495,
   *    //   20.085536923187668
   *    // ]
   *
   * See also:
   *
   *    log, pow
   *
   * @param {Number | BigNumber | Boolean | Complex | Array | Matrix} x  A number or matrix to exponentiate
   * @return {Number | BigNumber | Complex | Array | Matrix} Exponent of `x`
   */
  math.exp = function exp (x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('exp', arguments.length, 1);
    }

    if (isNumber(x)) {
      return Math.exp(x);
    }

    if (isComplex(x)) {
      var r = Math.exp(x.re);
      return new Complex(
          r * Math.cos(x.im),
          r * Math.sin(x.im)
      );
    }

    if (x instanceof BigNumber) {
      return x.exp();
    }

    if (isCollection(x)) {
      return collection.deepMap(x, exp);
    }

    if (isBoolean(x)) {
      return Math.exp(x);
    }

    throw new math.error.UnsupportedTypeError('exp', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Matrix":269,"../../type/collection":272,"../../util/index":276}],175:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Round a value towards zero.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.fix(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.fix(3.2);                // returns Number 3
   *    math.fix(3.8);                // returns Number 3
   *    math.fix(-4.2);               // returns Number -4
   *    math.fix(-4.7);               // returns Number -4
   *
   *    var c = math.complex(3.2, -2.7);
   *    math.fix(c);                  // returns Complex 3 - 2i
   *
   *    math.fix([3.2, 3.8, -4.7]);   // returns Array [3, 3, -4]
   *
   * See also:
   *
   *    ceil, floor, round
   *
   * @param {Number | BigNumber | Boolean | Complex | Array | Matrix} x Number to be rounded
   * @return {Number | BigNumber | Complex | Array | Matrix}            Rounded value
   */
  math.fix = function fix(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('fix', arguments.length, 1);
    }

    if (isNumber(x)) {
      return (x > 0) ? Math.floor(x) : Math.ceil(x);
    }

    if (isComplex(x)) {
      return new Complex(
          (x.re > 0) ? Math.floor(x.re) : Math.ceil(x.re),
          (x.im > 0) ? Math.floor(x.im) : Math.ceil(x.im)
      );
    }

    if (x instanceof BigNumber) {
      return x.isNegative() ? x.ceil() : x.floor();
    }

    if (isCollection(x)) {
      return collection.deepMap(x, fix);
    }

    if (isBoolean(x)) {
      return fix(+x);
    }

    throw new math.error.UnsupportedTypeError('fix', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],176:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Round a value towards minus infinity.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.floor(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.floor(3.2);              // returns Number 3
   *    math.floor(3.8);              // returns Number 3
   *    math.floor(-4.2);             // returns Number -5
   *    math.floor(-4.7);             // returns Number -5
   *
   *    var c = math.complex(3.2, -2.7);
   *    math.floor(c);                // returns Complex 3 - 3i
   *
   *    math.floor([3.2, 3.8, -4.7]); // returns Array [3, 3, -5]
   *
   * See also:
   *
   *    ceil, fix, round
   *
   * @param  {Number | BigNumber | Boolean | Complex | Array | Matrix} x  Number to be rounded
   * @return {Number | BigNumber | Complex | Array | Matrix} Rounded value
   */
  math.floor = function floor(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('floor', arguments.length, 1);
    }

    if (isNumber(x)) {
      return Math.floor(x);
    }

    if (isComplex(x)) {
      return new Complex (
          Math.floor(x.re),
          Math.floor(x.im)
      );
    }

    if (x instanceof BigNumber) {
      return x.floor();
    }

    if (isCollection(x)) {
      return collection.deepMap(x, floor);
    }

    if (isBoolean(x)) {
      return floor(+x);
    }

    throw new math.error.UnsupportedTypeError('floor', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],177:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isInteger = util.number.isInteger,
      isCollection = collection.isCollection;

  /**
   * Calculate the greatest common divisor for two or more values or arrays.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.gcd(a, b)
   *    math.gcd(a, b, c, ...)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.gcd(8, 12);              // returns 4
   *    math.gcd(-4, 6);              // returns 2
   *    math.gcd(25, 15, -10);        // returns 5
   *
   *    math.gcd([8, -4], [12, 6]);   // returns [4, 2]
   *
   * See also:
   *
   *    lcm, xgcd
   *
   * @param {... Number | Boolean | Array | Matrix} args  Two or more integer numbers
   * @return {Number | Array | Matrix}                    The greatest common divisor
   */
  math.gcd = function gcd(args) {
    var a = arguments[0],
        b = arguments[1],
        r; // remainder

    if (arguments.length == 2) {
      // two arguments
      if (isNumber(a) && isNumber(b)) {
        if (!isInteger(a) || !isInteger(b)) {
          throw new Error('Parameters in function gcd must be integer numbers');
        }

        // http://en.wikipedia.org/wiki/Euclidean_algorithm
        while (b != 0) {
          r = a % b;
          a = b;
          b = r;
        }
        return (a < 0) ? -a : a;
      }

      // evaluate gcd element wise
      if (isCollection(a) || isCollection(b)) {
        return collection.deepMap2(a, b, gcd);
      }

      // TODO: implement BigNumber support for gcd

      // downgrade bignumbers to numbers
      if (a instanceof BigNumber) {
        return gcd(a.toNumber(), b);
      }
      if (b instanceof BigNumber) {
        return gcd(a, b.toNumber());
      }

      if (isBoolean(a)) {
        return gcd(+a, b);
      }
      if (isBoolean(b)) {
        return gcd(a, +b);
      }

      throw new math.error.UnsupportedTypeError('gcd', math['typeof'](a), math['typeof'](b));
    }

    if (arguments.length > 2) {
      // multiple arguments. Evaluate them iteratively
      for (var i = 1; i < arguments.length; i++) {
        a = gcd(a, arguments[i]);
      }
      return a;
    }

    // zero or one argument
    throw new SyntaxError('Function gcd expects two or more arguments');
  };
};

},{"../../type/collection":272,"../../util/index":276}],178:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      nearlyEqual = util.number.nearlyEqual,
      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Test whether value x is larger than y.
   *
   * The function returns true when x is larger than y and the relative
   * difference between x and y is larger than the configured epsilon. The
   * function cannot be used to compare values smaller than approximately 2.22e-16.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.larger(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.larger(2, 3);             // returns false
   *    math.larger(5, 2 + 2);         // returns true
   *
   *    var a = math.unit('5 cm');
   *    var b = math.unit('2 inch');
   *    math.larger(a, b);             // returns false
   *
   * See also:
   *
   *    equal, unequal, smaller, smallereq, largereq, compare
   *
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} x First value to compare
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} y Second value to compare
   * @return {Boolean | Array | Matrix} Returns true when the x is larger than y, else returns false
   */
  math.larger = function larger(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('larger', arguments.length, 2);
    }

    if (isNumber(x) && isNumber(y)) {
      return !nearlyEqual(x, y, config.epsilon) && x > y;
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return x.gt(y);
      }

      // downgrade to Number
      return larger(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return x.gt(y)
      }

      // downgrade to Number
      return larger(x, y.toNumber());
    }

    if ((isUnit(x)) && (isUnit(y))) {
      if (!x.equalBase(y)) {
        throw new Error('Cannot compare units with different base');
      }
      return x.value > y.value;
    }

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, larger);
    }

    // Note: test strings after testing collections,
    // else we can't compare a string with a matrix
    if (isString(x) || isString(y)) {
      return x > y;
    }

    if (isBoolean(x)) {
      return larger(+x, y);
    }
    if (isBoolean(y)) {
      return larger(x, +y);
    }

    if (isComplex(x) || isComplex(y)) {
      throw new TypeError('No ordering relation is defined for complex numbers');
    }

    throw new math.error.UnsupportedTypeError('larger', math['typeof'](x), math['typeof'](y));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],179:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      nearlyEqual = util.number.nearlyEqual,
      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Test whether value x is larger or equal to y.
   *
   * The function returns true when x is larger than y or the relative
   * difference between x and y is smaller than the configured epsilon. The
   * function cannot be used to compare values smaller than approximately 2.22e-16.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.largereq(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.larger(2, 1 + 1);         // returns false
   *    math.largereq(2, 1 + 1);       // returns true
   *
   * See also:
   *
   *    equal, unequal, smaller, smallereq, larger, compare
   *
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} x First value to compare
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} y Second value to compare
   * @return {Boolean | Array | Matrix} Returns true when the x is larger or equal to y, else returns false
   */
  math.largereq = function largereq(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('largereq', arguments.length, 2);
    }

    if (isNumber(x) && isNumber(y)) {
      return nearlyEqual(x, y, config.epsilon) || x > y;
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return x.gte(y);
      }

      // downgrade to Number
      return largereq(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return x.gte(y)
      }

      // downgrade to Number
      return largereq(x, y.toNumber());
    }

    if ((isUnit(x)) && (isUnit(y))) {
      if (!x.equalBase(y)) {
        throw new Error('Cannot compare units with different base');
      }
      return x.value >= y.value;
    }

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, largereq);
    }

    // Note: test strings after testing collections,
    // else we can't compare a string with a matrix
    if (isString(x) || isString(y)) {
      return x >= y;
    }

    if (isBoolean(x)) {
      return largereq(+x, y);
    }
    if (isBoolean(y)) {
      return largereq(x, +y);
    }

    if (isComplex(x) || isComplex(y)) {
      throw new TypeError('No ordering relation is defined for complex numbers');
    }

    throw new math.error.UnsupportedTypeError('largereq', math['typeof'](x), math['typeof'](y));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],180:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isInteger = util.number.isInteger,
      isCollection = collection.isCollection;

  /**
   * Calculate the least common multiple for two or more values or arrays.
   *
   * lcm is defined as:
   *
   *     lcm(a, b) = abs(a * b) / gcd(a, b)
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.lcm(a, b)
   *    math.lcm(a, b, c, ...)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.lcm(4, 6);               // returns 12
   *    math.lcm(6, 21);              // returns 42
   *    math.lcm(6, 21, 5);           // returns 210
   *
   *    math.lcm([4, 6], [6, 21]);    // returns [12, 42]
   *
   * See also:
   *
   *    gcd, xgcd
   *
   * @param {... Number | Boolean | Array | Matrix} args  Two or more integer numbers
   * @return {Number | Array | Matrix}                    The least common multiple
   */
  math.lcm = function lcm(args) {
    var a = arguments[0],
        b = arguments[1],
        t;

    if (arguments.length == 2) {
      // two arguments
      if (isNumber(a) && isNumber(b)) {
        if (!isInteger(a) || !isInteger(b)) {
          throw new Error('Parameters in function lcm must be integer numbers');
        }

        if (a == 0 || b == 0) {
          return 0;
        }

        // http://en.wikipedia.org/wiki/Euclidean_algorithm
        // evaluate gcd here inline to reduce overhead
        var prod = a * b;
        while (b != 0) {
          t = b;
          b = a % t;
          a = t;
        }
        return Math.abs(prod / a);
      }

      // evaluate lcm element wise
      if (isCollection(a) || isCollection(b)) {
        return collection.deepMap2(a, b, lcm);
      }

      if (isBoolean(a)) {
        return lcm(+a, b);
      }
      if (isBoolean(b)) {
        return lcm(a, +b);
      }

      // TODO: implement BigNumber support for lcm

      // downgrade bignumbers to numbers
      if (a instanceof BigNumber) {
        return lcm(a.toNumber(), b);
      }
      if (b instanceof BigNumber) {
        return lcm(a, b.toNumber());
      }

      throw new math.error.UnsupportedTypeError('lcm', math['typeof'](a), math['typeof'](b));
    }

    if (arguments.length > 2) {
      // multiple arguments. Evaluate them iteratively
      for (var i = 1; i < arguments.length; i++) {
        a = lcm(a, arguments[i]);
      }
      return a;
    }

    // zero or one argument
    throw new SyntaxError('Function lcm expects two or more arguments');
  };
};

},{"../../type/collection":272,"../../util/index":276}],181:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Calculate the logarithm of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.log(x)
   *    math.log(x, base)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.log(3.5);                  // returns 1.252762968495368
   *    math.exp(math.log(2.4));        // returns 2.4
   *
   *    math.pow(10, 4);                // returns 10000
   *    math.log(10000, 10);            // returns 4
   *    math.log(10000) / math.log(10); // returns 4
   *
   *    math.log(1024, 2);              // returns 10
   *    math.pow(2, 10);                // returns 1024
   *
   * See also:
   *
   *    exp, log10
   *
   * @param {Number | BigNumber | Boolean | Complex | Array | Matrix} x
   *            Value for which to calculate the logarithm.
   * @param {Number | BigNumber | Boolean | Complex} [base=e]
   *            Optional base for the logarithm. If not provided, the natural
   *            logarithm of `x` is calculated.
   * @return {Number | BigNumber | Complex | Array | Matrix}
   *            Returns the logarithm of `x`
   */
  math.log = function log(x, base) {
    if (arguments.length == 1) {
      // calculate natural logarithm, log(x)
      if (isNumber(x)) {
        if (x >= 0) {
          return Math.log(x);
        }
        else {
          // negative value -> complex value computation
          return log(new Complex(x, 0));
        }
      }

      if (isComplex(x)) {
        return new Complex (
            Math.log(Math.sqrt(x.re * x.re + x.im * x.im)),
            Math.atan2(x.im, x.re)
        );
      }

      if (x instanceof BigNumber) {
        if (x.isNegative()) {
          // negative value -> downgrade to number to do complex value computation
          return log(x.toNumber());
        }
        else {
          return x.ln();
        }
      }

      if (isCollection(x)) {
        return collection.deepMap(x, log);
      }

      if (isBoolean(x)) {
        return log(+x);
      }

      throw new math.error.UnsupportedTypeError('log', math['typeof'](x));
    }
    else if (arguments.length == 2) {
      // calculate logarithm for a specified base, log(x, base)
      return math.divide(log(x), log(base));
    }
    else {
      throw new math.error.ArgumentsError('log', arguments.length, 1, 2);
    }
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],182:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Calculate the 10-base of a value. This is the same as calculating `log(x, 10)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.log10(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.log10(0.00001);            // returns -5
   *    math.log10(10000);              // returns 4
   *    math.log(10000) / math.log(10); // returns 4
   *    math.pow(10, 4);                // returns 10000
   *
   * See also:
   *
   *    exp, log
   *
   * @param {Number | BigNumber | Boolean | Complex | Array | Matrix} x
   *            Value for which to calculate the logarithm.
   * @return {Number | BigNumber | Complex | Array | Matrix}
   *            Returns the 10-base logarithm of `x`
   */
  math.log10 = function log10(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('log10', arguments.length, 1);
    }

    if (isNumber(x)) {
      if (x >= 0) {
        return Math.log(x) / Math.LN10;
      }
      else {
        // negative value -> complex value computation
        return log10(new Complex(x, 0));
      }
    }

    if (x instanceof BigNumber) {
      if (x.isNegative()) {
        // negative value -> downgrade to number to do complex value computation
        return log10(x.toNumber());
      }
      else {
        return x.log();
      }
    }

    if (isComplex(x)) {
      return new Complex (
          Math.log(Math.sqrt(x.re * x.re + x.im * x.im)) / Math.LN10,
          Math.atan2(x.im, x.re) / Math.LN10
      );
    }

    if (isCollection(x)) {
      return collection.deepMap(x, log10);
    }

    if (isBoolean(x)) {
      return log10(+x);
    }

    throw new math.error.UnsupportedTypeError('log10', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],183:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isCollection = collection.isCollection;

  /**
   * Calculates the modulus, the remainder of an integer division.
   *
   * For matrices, the function is evaluated element wise.
   *
   * The modulus is defined as:
   *
   *     x - y * floor(x / y)
   *
   * See http://en.wikipedia.org/wiki/Modulo_operation.
   *
   * Syntax:
   *
   *    math.mod(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.mod(8, 3);                // returns 2
   *    math.mod(11, 2);               // returns 1
   *
   *    function isOdd(x) {
   *      return math.mod(x, 2) != 0;
   *    }
   *
   *    isOdd(2);                      // returns false
   *    isOdd(3);                      // returns true
   *
   * See also:
   *
   *    divide
   *
   * @param  {Number | BigNumber | Boolean | Array | Matrix} x Dividend
   * @param  {Number | BigNumber | Boolean | Array | Matrix} y Divisor
   * @return {Number | BigNumber | Array | Matrix} Returns the remainder of `x` divided by `y`.
   */
  math.mod = function mod(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('mod', arguments.length, 2);
    }

    // see http://functions.wolfram.com/IntegerFunctions/Mod/

    if (isNumber(x)) {
      if (isNumber(y)) {
        // number % number
        return _mod(x, y);
      }
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return y.isZero() ? x : x.mod(y);
      }

      // downgrade x to Number
      return mod(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return y.isZero() ? x : x.mod(y);
      }

      // downgrade y to Number
      return mod(x, y.toNumber());
    }

    // TODO: implement mod for complex values

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, mod);
    }

    if (isBoolean(x)) {
      return mod(+x, y);
    }
    if (isBoolean(y)) {
      return mod(x, +y);
    }

    throw new math.error.UnsupportedTypeError('mod', math['typeof'](x), math['typeof'](y));
  };

  /**
   * Calculate the modulus of two numbers
   * @param {Number} x
   * @param {Number} y
   * @returns {number} res
   * @private
   */
  function _mod(x, y) {
    if (y > 0) {
      // We don't use JavaScript's % operator here as this doesn't work
      // correctly for x < 0 and x == 0
      // see http://en.wikipedia.org/wiki/Modulo_operation
      return x - y * Math.floor(x / y);
    }
    else if (y == 0) {
      return x;
    }
    else { // y < 0
      // TODO: implement mod for a negative divisor
      throw new Error('Cannot calculate mod for a negative divisor');
    }
  }
};

},{"../../type/collection":272,"../../util/index":276}],184:[function(require,module,exports){
module.exports = function(math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Matrix = require('../../type/Matrix'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      array = util.array,
      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isArray = Array.isArray,
      isUnit = Unit.isUnit;

  /**
   * Multiply two values, `x * y`. The result is squeezed.
   * For matrices, the matrix product is calculated.
   *
   * Syntax:
   *
   *    math.multiply(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.multiply(4, 5.2);        // returns Number 20.8
   *
   *    var a = math.complex(2, 3);
   *    var b = math.complex(4, 1);
   *    math.multiply(a, b);          // returns Complex 5 + 14i
   *
   *    var c = [[1, 2], [4, 3]];
   *    var d = [[1, 2, 3], [3, -4, 7]];
   *    math.multiply(c, d);          // returns Array [[7, -6, 17], [13, -4, 33]]
   *
   *    var e = math.unit('2.1 km');
   *    math.multiply(3, e);          // returns Unit 6.3 km
   *
   * See also:
   *
   *    divide
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} x First value to multiply
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} y Second value to multiply
   * @return {Number | BigNumber | Complex | Unit | Array | Matrix} Multiplication of `x` and `y`
   */
  math.multiply = function multiply(x, y) {
    var res;

    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('multiply', arguments.length, 2);
    }

    if (isNumber(x)) {
      if (isNumber(y)) {
        // number * number
        return x * y;
      }
      else if (isComplex(y)) {
        // number * complex
        return _multiplyComplex (new Complex(x, 0), y);
      }
      else if (isUnit(y)) {
        res = y.clone();
        if (res.value === null) res.value = res._normalize(1);
        res.value *= x;
        return res;
      }
    }

    if (isComplex(x)) {
      if (isNumber(y)) {
        // complex * number
        return _multiplyComplex (x, new Complex(y, 0));
      }
      else if (isComplex(y)) {
        // complex * complex
        return _multiplyComplex (x, y);
      }
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return x.times(y);
      }

      // downgrade to Number
      return multiply(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return x.times(y)
      }

      // downgrade to Number
      return multiply(x, y.toNumber());
    }

    if (isUnit(x)) {
      if (isNumber(y)) {
        res = x.clone();
        if (res.value === null) res.value = res._normalize(1);
        res.value *= y;
        return res;
      }
    }

    if (isArray(x)) {
      if (isArray(y)) {
        // array * array
        var sizeX = array.size(x);
        var sizeY = array.size(y);

        if (sizeX.length == 1) {
          if (sizeY.length == 1) {
            // vector * vector
            if (sizeX[0] != sizeY[0]) {
              throw new RangeError('Dimension mismatch in multiplication. ' +
                  'Length of A must match length of B ' +
                  '(A is ' + sizeX[0] +
                  ', B is ' + sizeY[0] +
                  sizeX[0] + ' != ' + sizeY[0] + ')');
            }

            return _multiplyVectorVector(x, y);
          }
          else if (sizeY.length == 2) {
            // vector * matrix
            if (sizeX[0] != sizeY[0]) {
              throw new RangeError('Dimension mismatch in multiplication. ' +
                  'Length of A must match rows of B ' +
                  '(A is ' + sizeX[0] +
                  ', B is ' + sizeY[0] + 'x' + sizeY[1] + ', ' +
                  sizeX[0] + ' != ' + sizeY[0] + ')');
            }

            return _multiplyVectorMatrix(x, y);
          }
          else {
            throw new Error('Can only multiply a 1 or 2 dimensional matrix ' +
                '(B has ' + sizeY.length + ' dimensions)');
          }
        }
        else if (sizeX.length == 2) {
          if (sizeY.length == 1) {
            // matrix * vector
            if (sizeX[1] != sizeY[0]) {
              throw new RangeError('Dimension mismatch in multiplication. ' +
                  'Columns of A must match length of B ' +
                  '(A is ' + sizeX[0] + 'x' + sizeX[0] +
                  ', B is ' + sizeY[0] + ', ' +
                  sizeX[1] + ' != ' + sizeY[0] + ')');
            }

            return _multiplyMatrixVector(x, y);
          }
          else if (sizeY.length == 2) {
            // matrix * matrix
            if (sizeX[1] != sizeY[0]) {
              throw new RangeError('Dimension mismatch in multiplication. ' +
                  'Columns of A must match rows of B ' +
                  '(A is ' + sizeX[0] + 'x' + sizeX[1] +
                  ', B is ' + sizeY[0] + 'x' + sizeY[1] + ', ' +
                  sizeX[1] + ' != ' + sizeY[0] + ')');
            }

            return _multiplyMatrixMatrix(x, y);
          }
          else {
            throw new Error('Can only multiply a 1 or 2 dimensional matrix ' +
                '(B has ' + sizeY.length + ' dimensions)');
          }
        }
        else {
          throw new Error('Can only multiply a 1 or 2 dimensional matrix ' +
              '(A has ' + sizeX.length + ' dimensions)');
        }
      }
      else if (y instanceof Matrix) {
        // array * matrix
        res = multiply(x, y.valueOf());
        return isArray(res) ? new Matrix(res) : res;
      }
      else {
        // array * scalar
        return collection.deepMap2(x, y, multiply);
      }
    }

    if (x instanceof Matrix) {
      if (y instanceof Matrix) {
        // matrix * matrix
        res = multiply(x.valueOf(), y.valueOf());
        return isArray(res) ? new Matrix(res) : res;
      }
      else {
        // matrix * array
        // matrix * scalar
        res = multiply(x.valueOf(), y);
        return isArray(res) ? new Matrix(res) : res;
      }
    }

    if (isArray(y)) {
      // scalar * array
      return collection.deepMap2(x, y, multiply);
    }
    else if (y instanceof Matrix) {
      // scalar * matrix
      return new Matrix(collection.deepMap2(x, y.valueOf(), multiply));
    }

    if (isBoolean(x)) {
      return multiply(+x, y);
    }
    if (isBoolean(y)) {
      return multiply(x, +y);
    }

    throw new math.error.UnsupportedTypeError('multiply', math['typeof'](x), math['typeof'](y));
  };

  /**
   * Multiply two 2-dimensional matrices.
   * The size of the matrices is not validated.
   * @param {Array} x   A 2d matrix
   * @param {Array} y   A 2d matrix
   * @return {Array | Number} result
   * @private
   */
  function _multiplyMatrixMatrix(x, y) {
    // TODO: performance of matrix multiplication can be improved
    var res = [],
        rows = x.length,
        cols = y[0].length,
        num = x[0].length;

    for (var r = 0; r < rows; r++) {
      res[r] = [];
      for (var c = 0; c < cols; c++) {
        var result = null;
        for (var n = 0; n < num; n++) {
          var p = math.multiply(x[r][n], y[n][c]);
          result = (result === null) ? p : math.add(result, p);
        }
        res[r][c] = result;
      }
    }

    return array.squeeze(res);
  }

  /**
   * Multiply a vector with a 2-dimensional matrix
   * The size of the matrices is not validated.
   * @param {Array} x   A vector
   * @param {Array} y   A 2d matrix
   * @return {Array | Number} result
   * @private
   */
  function _multiplyVectorMatrix(x, y) {
    // TODO: performance of matrix multiplication can be improved
    var res = [],
        rows = y.length,
        cols = y[0].length;

    for (var c = 0; c < cols; c++) {
      var result = null;
      for (var r = 0; r < rows; r++) {
        var p = math.multiply(x[r], y[r][c]);
        result = (r === 0) ? p : math.add(result, p);
      }
      res[c] = result;
    }

    return array.squeeze(res);
  }

  /**
   * Multiply a 2-dimensional matrix with a vector
   * The size of the matrices is not validated.
   * @param {Array} x   A 2d matrix
   * @param {Array} y   A vector
   * @return {Array | Number} result
   * @private
   */
  function _multiplyMatrixVector(x, y) {
    // TODO: performance of matrix multiplication can be improved
    var res = [],
        rows = x.length,
        cols = x[0].length;

    for (var r = 0; r < rows; r++) {
      var result = null;
      for (var c = 0; c < cols; c++) {
        var p = math.multiply(x[r][c], y[c]);
        result = (c === 0) ? p : math.add(result, p);
      }
      res[r] = result;
    }

    return array.squeeze(res);
  }

  /**
   * Multiply two vectors, calculate the dot product
   * The size of the matrices is not validated.
   * @param {Array} x   A vector
   * @param {Array} y   A vector
   * @return {Number} dotProduct
   * @private
   */
  function _multiplyVectorVector(x, y) {
    // TODO: performance of matrix multiplication can be improved
    var len = x.length;

    if (!len) {
      throw new Error('Cannot multiply two empty vectors');
    }

    var dot = 0;
    for (var i = 0; i < len; i++) {
      dot = math.add(dot, math.multiply(x[i], y[i]));
    }
    return dot;
  }

  /**
   * Multiply two complex numbers. x * y or multiply(x, y)
   * @param {Complex} x
   * @param {Complex} y
   * @return {Complex | Number} res
   * @private
   */
  function _multiplyComplex (x, y) {
    // Note: we test whether x or y are pure real or pure complex,
    // to prevent unnecessary NaN values. For example, Infinity*i should
    // result in Infinity*i, and not in NaN+Infinity*i

    if (x.im == 0) {
      // x is pure real
      if (y.im == 0) {
        // y is pure real
        return new Complex(x.re * y.re, 0);
      }
      else if (y.re == 0) {
        // y is pure complex
        return new Complex(
            0,
            x.re * y.im
        );
      }
      else {
        // y has a real and complex part
        return new Complex(
            x.re * y.re,
            x.re * y.im
        );
      }
    }
    else if (x.re == 0) {
      // x is pure complex
      if (y.im == 0) {
        // y is pure real
        return new Complex(
            0,
            x.im * y.re
        );
      }
      else if (y.re == 0) {
        // y is pure complex
        return new Complex(-x.im * y.im, 0);
      }
      else {
        // y has a real and complex part
        return new Complex(
            -x.im * y.im,
            x.im * y.re
        );
      }
    }
    else {
      // x has a real and complex part
      if (y.im == 0) {
        // y is pure real
        return new Complex(
            x.re * y.re,
            x.im * y.re
        );
      }
      else if (y.re == 0) {
        // y is pure complex
        return new Complex(
            -x.im * y.im,
            x.re * y.im
        );
      }
      else {
        // y has a real and complex part
        return new Complex(
            x.re * y.re - x.im * y.im,
            x.re * y.im + x.im * y.re
        );
      }
    }
  }
};

},{"../../type/Complex":266,"../../type/Matrix":269,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],185:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

    array = require('../../../lib/util/array'),
          
    BigNumber = math.type.BigNumber,
    Complex = require('../../type/Complex'),
    Matrix = require('../../type/Matrix'),
    collection = require('../../type/collection'),

    isNumber = util.number.isNumber,
    isBoolean = util['boolean'].isBoolean,
    isComplex = Complex.isComplex,
    isCollection = collection.isCollection;

  /**
   * Calculate the norm of a number, vector or matrix.
   *
   * The second parameter p is optional. If not provided, it defaults to 2.
   *
   * Syntax:
   *
   *    math.norm(x)
   *    math.norm(x, p)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.abs(-3.5);                         // returns 3.5
   *    math.norm(-3.5);                        // returns 3.5
   *
   *    math.norm(math.complex(3, -4));         // returns 5
   *
   *    math.norm([1, 2, -3], Infinity);        // returns 3
   *    math.norm([1, 2, -3], -Infinity);       // returns 1
   *
   *    math.norm([3, 4], 2);                   // returns 5
   *
   *    math.norm([[1, 2], [3, 4]], 1)          // returns 6
   *    math.norm([[1, 2], [3, 4]], 'inf');     // returns 7
   *    math.norm([[1, 2], [3, 4]], 'fro');     // returns 5.477225575051661
   *
   * See also:
   *
   *    abs
   *
   * @param  {Number | BigNumber | Complex | Boolean | Array | Matrix} x
   *            Value for which to calculate the norm
   * @param  {Number | String} [p=2]
   *            Vector space.
   *            Supported numbers include Infinity and -Infinity.
   *            Supported strings are: 'inf', '-inf', and 'fro' (The Frobenius norm)
   * @return {Number} the p-norm
   */
  math.norm = function norm(x, p) {
    if (arguments.length < 1 || arguments.length > 2) {
      throw new math.error.ArgumentsError('abs', arguments.length, 1, 2);
    }

    if (isNumber(x)) {
      // norm(x) = abs(x)
      return Math.abs(x);
    }

    if (isComplex(x)) {
      // ignore p, complex numbers
      return Math.sqrt(x.re * x.re + x.im * x.im);
    }

    if (x instanceof BigNumber) {
      // norm(x) = abs(x)
      return x.abs();
    }

    if (isBoolean(x)) {
      // norm(x) = abs(x)
      return Math.abs(x);
    }

    if (isArray(x)) {
      // size
      var sizeX = array.size(x);
      // missing p
      if (p == null)
        p = 2;
      // check it is a Vector
      if (sizeX.length == 1) {
        // check p
        if (p === Number.POSITIVE_INFINITY || p === 'inf') {
          // norm(x, Infinity) = max(abs(x))
          var n;
          math.forEach(x, function (value) {
            var v = math.abs(value);
            if (!n || math.larger(v, n))
              n = v;
          });
          return n;
        }
        if (p === Number.NEGATIVE_INFINITY || p === '-inf') {
          // norm(x, -Infinity) = min(abs(x))
          var n;
          math.forEach(x, function (value) {
            var v = math.abs(value);
            if (!n || math.smaller(v, n))
              n = v;
          });
          return n;
        }
        if (p === 'fro')
            return norm(x);
        if (isNumber(p) && !isNaN(p)) {
          // check p != 0
          if (!math.equal(p, 0)) {
            // norm(x, p) = sum(abs(xi) ^ p) ^ 1/p
            var n = 0;
            math.forEach(x, function (value) {
              n = math.add(math.pow(math.abs(value), p), n);
            });
            return math.pow(n, 1 / p);
          }
          return Number.POSITIVE_INFINITY;
        }
        // invalid parameter value
        throw new Error('Unsupported parameter value');
      }
      else if (sizeX.length == 2) {
        // check p
        if (p == 1) {
          // norm(x) = the largest column sum
          var c = [];
          // loop rows
          for (var i = 0; i < x.length; i++) {
            var r = x[i];
            // loop columns
            for (var j = 0; j < r.length; j++) {
              c[j] = math.add(c[j] || 0, math.abs(r[j]));
            }
          }
          return math.max(c);
        }
        if (p == Number.POSITIVE_INFINITY || p === 'inf') {
          // norm(x) = the largest row sum
          var n = 0;
          // loop rows
          for (var i = 0; i < x.length; i++) {
            var rs = 0;
            var r = x[i];
            // loop columns
            for (var j = 0; j < r.length; j++) {
              rs = math.add(rs, math.abs(r[j]));
            }
            if (math.larger(rs, n))
              n = rs;
          }
          return n;
        }
        if (p === 'fro') {
          // norm(x) = sqrt(sum(diag(x'x)))
          var d = math.diag(math.multiply(math.transpose(x), x));
          var s = 0;
          math.forEach(d, function (value) {
            s = math.add(value, s);
          });
          return math.sqrt(s);
        }
        if (p == 2) {
          // not implemented
          throw new Error('Unsupported parameter value, missing implementation of matrix singular value decomposition');
        }
        // invalid parameter value
        throw new Error('Unsupported parameter value');
      }
    }

    if (x instanceof Matrix) {
      return norm(x.valueOf(), p);
    }

    throw new math.error.UnsupportedTypeError('norm', x);
  };
};

},{"../../../lib/util/array":273,"../../type/Complex":266,"../../type/Matrix":269,"../../type/collection":272,"../../util/index":276}],186:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      array = util.array,
      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isArray = Array.isArray,
      isInteger = util.number.isInteger,
      isComplex = Complex.isComplex;

  /**
   * Calculates the power of x to y, `x ^ y`.
   * Matrix exponentiation is supported for square matrices `x`, and positive
   * integer exponents `y`.
   *
   * Syntax:
   *
   *    math.pow(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.pow(2, 3);               // returns Number 8
   *
   *    var a = math.complex(2, 3);
   *    math.pow(a, 2)                // returns Complex -5 + 12i
   *
   *    var b = [[1, 2], [4, 3]];
   *    math.pow(b, 2);               // returns Array [[9, 8], [16, 17]]
   *
   * See also:
   *
   *    multiply, sqrt
   *
   * @param  {Number | BigNumber | Boolean | Complex | Array | Matrix} x  The base
   * @param  {Number | BigNumber | Boolean | Complex} y                   The exponent
   * @return {Number | BigNumber | Complex | Array | Matrix} The value of `x` to the power `y`
   */
  math.pow = function pow(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('pow', arguments.length, 2);
    }

    if (isNumber(x)) {
      if (isNumber(y)) {
        if (isInteger(y) || x >= 0) {
          // real value computation
          return Math.pow(x, y);
        }
        else {
          return powComplex(new Complex(x, 0), new Complex(y, 0));
        }
      }
      else if (isComplex(y)) {
        return powComplex(new Complex(x, 0), y);
      }
    }

    if (isComplex(x)) {
      if (isNumber(y)) {
        return powComplex(x, new Complex(y, 0));
      }
      else if (isComplex(y)) {
        return powComplex(x, y);
      }
    }

    if (x instanceof BigNumber) {
      // try to upgrade y to to bignumber
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        if (y.isInteger() && !x.isNegative()) {
          return x.pow(y);
        }
        else {
          // downgrade to number to do complex valued computation
          return pow(x.toNumber(), y.toNumber())
        }
      }
      else {
        // failed to upgrade y to bignumber, lets downgrade x to number
        return pow(x.toNumber(), y);
      }
    }

    if (y instanceof BigNumber) {
      // try to convert x to bignumber
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        if (y.isInteger() && !x.isNegative()) {
          return x.pow(y);
        }
        else {
          // downgrade to number to do complex valued computation
          return pow(x.toNumber(), y.toNumber())
        }
      }
      else {
        // failed to upgrade x to bignumber, lets downgrade y to number
        return pow(x, y.toNumber());
      }
    }

    if (isArray(x)) {
      if (!isNumber(y) || !isInteger(y) || y < 0) {
        throw new TypeError('For A^b, b must be a positive integer ' +
            '(value is ' + y + ')');
      }
      // verify that A is a 2 dimensional square matrix
      var s = array.size(x);
      if (s.length != 2) {
        throw new Error('For A^b, A must be 2 dimensional ' +
            '(A has ' + s.length + ' dimensions)');
      }
      if (s[0] != s[1]) {
        throw new Error('For A^b, A must be square ' +
            '(size is ' + s[0] + 'x' + s[1] + ')');
      }

      // compute power of matrix
      var res = math.eye(s[0]).valueOf();
      var px = x;
      while (y >= 1) {
        if ((y & 1) == 1) {
          res = math.multiply(px, res);
        }
        y >>= 1;
        px = math.multiply(px, px);
      }
      return res;
    }
    else if (x instanceof Matrix) {
      return new Matrix(pow(x.valueOf(), y));
    }

    if (isBoolean(x)) {
      return pow(+x, y);
    }
    if (isBoolean(y)) {
      return pow(x, +y);
    }

    throw new math.error.UnsupportedTypeError('pow', math['typeof'](x), math['typeof'](y));
  };

  /**
   * Calculates the power of x to y, x^y, for two complex numbers.
   * @param {Complex} x
   * @param {Complex} y
   * @return {Complex} res
   * @private
   */
  function powComplex (x, y) {
    // complex computation
    // x^y = exp(log(x)*y) = exp((abs(x)+i*arg(x))*y)
    var temp1 = math.log(x);
    var temp2 = math.multiply(temp1, y);
    return math.exp(temp2);
  }
};

},{"../../type/Complex":266,"../../type/Matrix":269,"../../type/collection":272,"../../util/index":276}],187:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isInteger = util.number.isInteger,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Round a value towards the nearest integer.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.round(x)
   *    math.round(x, n)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.round(3.2);              // returns Number 3
   *    math.round(3.8);              // returns Number 4
   *    math.round(-4.2);             // returns Number -4
   *    math.round(-4.7);             // returns Number -5
   *    math.round(math.pi, 3);       // returns Number 3.14
   *    math.round(123.45678, 2);     // returns Number 123.46
   *
   *    var c = math.complex(3.2, -2.7);
   *    math.round(c);                // returns Complex 3 - 3i
   *
   *    math.round([3.2, 3.8, -4.7]); // returns Array [3, 4, -5]
   *
   * See also:
   *
   *    ceil, fix, floor
   *
   * @param  {Number | BigNumber | Boolean | Complex | Array | Matrix} x   Number to be rounded
   * @param  {Number | BigNumber | Boolean | Array} [n=0]                 Number of decimals
   * @return {Number | BigNumber | Complex | Array | Matrix} Rounded value
   */
  math.round = function round(x, n) {
    if (arguments.length != 1 && arguments.length != 2) {
      throw new math.error.ArgumentsError('round', arguments.length, 1, 2);
    }

    if (n == undefined) {
      // round (x)
      if (isNumber(x)) {
        return Math.round(x);
      }

      if (isComplex(x)) {
        return new Complex (
            Math.round(x.re),
            Math.round(x.im)
        );
      }

      if (x instanceof BigNumber) {
        return x.toDecimalPlaces(0);
      }

      if (isCollection(x)) {
        return collection.deepMap(x, round);
      }

      if (isBoolean(x)) {
        return Math.round(x);
      }

      throw new math.error.UnsupportedTypeError('round', math['typeof'](x));
    }
    else {
      // round (x, n)
      if (!isNumber(n) || !isInteger(n)) {
        if (n instanceof BigNumber) {
          n = parseFloat(n.valueOf());
        }
        else if (isBoolean(n)) {
          return round(x, +n);
        }
        else {
          throw new TypeError('Number of decimals in function round must be an integer');
        }
      }
      if (n < 0 || n > 15) {
        throw new Error ('Number of decimals in function round must be in te range of 0-15');
      }

      if (isNumber(x)) {
        return roundNumber(x, n);
      }

      if (isComplex(x)) {
        return new Complex (
            roundNumber(x.re, n),
            roundNumber(x.im, n)
        );
      }

      if (x instanceof BigNumber) {
        return x.toDecimalPlaces(n);
      }

      if (isCollection(x) || isCollection(n)) {
        return collection.deepMap2(x, n, round);
      }

      if (isBoolean(x)) {
        return round(+x, n);
      }

      throw new math.error.UnsupportedTypeError('round', math['typeof'](x), math['typeof'](n));
    }
  };

  /**
   * round a number to the given number of decimals, or to zero if decimals is
   * not provided
   * @param {Number} value
   * @param {Number} decimals       number of decimals, between 0 and 15 (0 by default)
   * @return {Number} roundedValue
   */
  function roundNumber (value, decimals) {
    var p = Math.pow(10, decimals);
    return Math.round(value * p) / p;
  }
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],188:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      number = util.number,
      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Compute the sign of a value. The sign of a value x is:
   *
   * -  1 when x > 1
   * - -1 when x < 0
   * -  0 when x == 0
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.sign(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.sign(3.5);               // returns 1
   *    math.sign(-4.2);              // returns -1
   *    math.sign(0);                 // returns 0
   *
   *    math.sign([3, 5, -2, 0, 2]);  // returns [1, 1, -1, 0, 1]
   *
   * See also:
   *
   *    abs
   *
   * @param  {Number | BigNumber | Boolean | Complex | Array | Matrix} x
   *            The number for which to determine the sign
   * @return {Number | BigNumber | Complex | Array | Matrix}e
   *            The sign of `x`
   */
  math.sign = function sign(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('sign', arguments.length, 1);
    }

    if (isNumber(x)) {
      return number.sign(x);
    }

    if (isComplex(x)) {
      var abs = Math.sqrt(x.re * x.re + x.im * x.im);
      return new Complex(x.re / abs, x.im / abs);
    }

    if (x instanceof BigNumber) {
      return new BigNumber(x.cmp(0));
    }

    if (isCollection(x)) {
      return collection.deepMap(x, sign);
    }

    if (isBoolean(x)) {
      return number.sign(x);
    }

    throw new math.error.UnsupportedTypeError('sign', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],189:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      nearlyEqual = util.number.nearlyEqual,
      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Test whether value x is smaller than y.
   *
   * The function returns true when x is smaller than y and the relative
   * difference between x and y is larger than the configured epsilon. The
   * function cannot be used to compare values smaller than approximately 2.22e-16.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.smaller(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.smaller(2, 3);            // returns true
   *    math.smaller(5, 2 * 2);        // returns false
   *
   *    var a = math.unit('5 cm');
   *    var b = math.unit('2 inch');
   *    math.smaller(a, b);            // returns true
   *
   * See also:
   *
   *    equal, unequal, smallereq, larger, largereq, compare
   *
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} x First value to compare
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} y Second value to compare
   * @return {Boolean | Array | Matrix} Returns true when the x is smaller than y, else returns false
   */
  math.smaller = function smaller(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('smaller', arguments.length, 2);
    }

    if (isNumber(x) && isNumber(y)) {
      return !nearlyEqual(x, y, config.epsilon) && x < y;
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return x.lt(y);
      }

      // downgrade to Number
      return smaller(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return x.lt(y)
      }

      // downgrade to Number
      return smaller(x, y.toNumber());
    }

    if ((isUnit(x)) && (isUnit(y))) {
      if (!x.equalBase(y)) {
        throw new Error('Cannot compare units with different base');
      }
      return x.value < y.value;
    }

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, smaller);
    }

    // Note: test strings after testing collections,
    // else we can't compare a string with a matrix
    if (isString(x) || isString(y)) {
      return x < y;
    }

    if (isBoolean(x)) {
      return smaller(+x, y);
    }
    if (isBoolean(y)) {
      return smaller(x, +y);
    }

    if (isComplex(x) || isComplex(y)) {
      throw new TypeError('No ordering relation is defined for complex numbers');
    }

    throw new math.error.UnsupportedTypeError('smaller', math['typeof'](x), math['typeof'](y));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],190:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      nearlyEqual = util.number.nearlyEqual,
      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Test whether value x is smaller or equal to y.
   *
   * The function returns true when x is smaller than y or the relative
   * difference between x and y is smaller than the configured epsilon. The
   * function cannot be used to compare values smaller than approximately 2.22e-16.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.smallereq(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.smaller(1 + 2, 3);        // returns false
   *    math.smallereq(1 + 2, 3);      // returns true
   *
   * See also:
   *
   *    equal, unequal, smaller, larger, largereq, compare
   *
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} x First value to compare
   * @param  {Number | BigNumber | Boolean | Unit | String | Array | Matrix} y Second value to compare
   * @return {Boolean | Array | Matrix} Returns true when the x is smaller than y, else returns false
   */
  math.smallereq = function smallereq(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('smallereq', arguments.length, 2);
    }

    if (isNumber(x) && isNumber(y)) {
      return nearlyEqual(x, y, config.epsilon) || x < y;
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return x.lte(y);
      }

      // downgrade to Number
      return smallereq(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return x.lte(y)
      }

      // downgrade to Number
      return smallereq(x, y.toNumber());
    }

    if ((isUnit(x)) && (isUnit(y))) {
      if (!x.equalBase(y)) {
        throw new Error('Cannot compare units with different base');
      }
      return x.value <= y.value;
    }

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, smallereq);
    }

    // Note: test strings after testing collections,
    // else we can't compare a string with a matrix
    if (isString(x) || isString(y)) {
      return x <= y;
    }

    if (isBoolean(x)) {
      return smallereq(+x, y);
    }
    if (isBoolean(y)) {
      return smallereq(x, +y);
    }

    if (isComplex(x) || isComplex(y)) {
      throw new TypeError('No ordering relation is defined for complex numbers');
    }

    throw new math.error.UnsupportedTypeError('smallereq', math['typeof'](x), math['typeof'](y));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],191:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Calculate the square root of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.sqrt(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.sqrt(25);                // returns 5
   *    math.square(5);               // returns 25
   *    math.sqrt(-4);                // returns Complex -2i
   *
   * See also:
   *
   *    square, multiply
   *
   * @param {Number | Boolean | Complex | Array | Matrix} x
   *            Value for which to calculate the square root.
   * @return {Number | Complex | Array | Matrix}
   *            Returns the square root of `x`
   */
  math.sqrt = function sqrt (x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('sqrt', arguments.length, 1);
    }

    if (isNumber(x)) {
      if (x >= 0) {
        return Math.sqrt(x);
      }
      else {
        return sqrt(new Complex(x, 0));
      }
    }

    if (isComplex(x)) {
      var r = Math.sqrt(x.re * x.re + x.im * x.im);
      if (x.im >= 0) {
        return new Complex(
            0.5 * Math.sqrt(2.0 * (r + x.re)),
            0.5 * Math.sqrt(2.0 * (r - x.re))
        );
      }
      else {
        return new Complex(
            0.5 * Math.sqrt(2.0 * (r + x.re)),
            -0.5 * Math.sqrt(2.0 * (r - x.re))
        );
      }
    }

    if (x instanceof BigNumber) {
      if (x.isNegative()) {
        // negative value -> downgrade to number to do complex value computation
        return sqrt(x.toNumber());
      }
      else {
        return x.sqrt();
      }
    }

    if (isCollection(x)) {
      return collection.deepMap(x, sqrt);
    }

    if (isBoolean(x)) {
      return sqrt(+x);
    }

    throw new math.error.UnsupportedTypeError('sqrt', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],192:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Compute the square of a value, `x * x`.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.square(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.square(2);           // returns Number 4
   *    math.square(3);           // returns Number 9
   *    math.pow(3, 2);           // returns Number 9
   *    math.multiply(3, 3);      // returns Number 9
   *
   *    math.square([1, 2, 3, 4]);  // returns Array [1, 4, 9, 16]
   *
   * See also:
   *
   *    multiply, cube, sqrt, pow
   *
   * @param  {Number | BigNumber | Boolean | Complex | Array | Matrix} x
   *            Number for which to calculate the square
   * @return {Number | BigNumber | Complex | Array | Matrix}
   *            Squared value
   */
  math.square = function square(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('square', arguments.length, 1);
    }

    if (isNumber(x)) {
      return x * x;
    }

    if (isComplex(x)) {
      return math.multiply(x, x);
    }

    if (x instanceof BigNumber) {
      return x.times(x);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, square);
    }

    if (isBoolean(x)) {
      return x * x;
    }

    throw new math.error.UnsupportedTypeError('square', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],193:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Matrix = require('../../type/Matrix'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isBoolean = util['boolean'].isBoolean,
      isNumber = util.number.isNumber,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Subtract two values, `x - y`.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.subtract(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.subtract(5.3, 2);        // returns Number 3.3
   *
   *    var a = math.complex(2, 3);
   *    var b = math.complex(4, 1);
   *    math.subtract(a, b);          // returns Complex -2 + 2i
   *
   *    math.subtract([5, 7, 4], 4);  // returns Array [1, 3, 0]
   *
   *    var c = math.unit('2.1 km');
   *    var d = math.unit('500m');
   *    math.subtract(c, d);          // returns Unit 1.6 km
   *
   * See also:
   *
   *    add
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} x
   *            Initial value
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} y
   *            Value to subtract from `x`
   * @return {Number | BigNumber | Complex | Unit | Array | Matrix}
   *            Subtraction of `x` and `y`
   */
  math.subtract = function subtract(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('subtract', arguments.length, 2);
    }

    if (isNumber(x)) {
      if (isNumber(y)) {
        // number - number
        return x - y;
      }
      else if (isComplex(y)) {
        // number - complex
        return new Complex (
            x - y.re,
            - y.im
        );
      }
    }
    else if (isComplex(x)) {
      if (isNumber(y)) {
        // complex - number
        return new Complex (
            x.re - y,
            x.im
        )
      }
      else if (isComplex(y)) {
        // complex - complex
        return new Complex (
            x.re - y.re,
            x.im - y.im
        )
      }
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return x.minus(y);
      }

      // downgrade to Number
      return subtract(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return x.minus(y)
      }

      // downgrade to Number
      return subtract(x, y.toNumber());
    }

    if (isUnit(x)) {
      if (isUnit(y)) {
        if (x.value == null) {
          throw new Error('Parameter x contains a unit with undefined value');
        }

        if (y.value == null) {
          throw new Error('Parameter y contains a unit with undefined value');
        }

        if (!x.equalBase(y)) {
          throw new Error('Units do not match');
        }

        var res = x.clone();
        res.value -= y.value;
        res.fixPrefix = false;

        return res;
      }
    }

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, subtract);
    }

    if (isBoolean(x)) {
      return subtract(+x, y);
    }
    if (isBoolean(y)) {
      return subtract(x, +y);
    }

    throw new math.error.UnsupportedTypeError('subtract', math['typeof'](x), math['typeof'](y));
  };
};

},{"../../type/Complex":266,"../../type/Matrix":269,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],194:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Inverse the sign of a value, apply a unary minus operation.
   *
   * For matrices, the function is evaluated element wise. Boolean values will
   * be converted to a number. For complex numbers, both real and complex
   * value are inverted.
   *
   * Syntax:
   *
   *    math.unary(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.unary(3.5);      // returns -3.5
   *    math.unary(-4.2);     // returns 4.2
   *
   * See also:
   *
   *    add, subtract
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | Array | Matrix} x Number to be inverted.
   * @return {Number | BigNumber | Complex | Unit | Array | Matrix} Returns the value with inverted sign.
   */
  math.unary = function unary(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('unary', arguments.length, 1);
    }

    if (isNumber(x)) {
      return -x;
    }

    if (isComplex(x)) {
      return new Complex(
          -x.re,
          -x.im
      );
    }

    if (x instanceof BigNumber) {
      return x.neg();
    }

    if (isUnit(x)) {
      var res = x.clone();
      res.value = -x.value;
      return res;
    }

    if (isCollection(x)) {
      return collection.deepMap(x, unary);
    }

    if (isBoolean(x)) {
      return -x;
    }

    throw new math.error.UnsupportedTypeError('unary', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],195:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      nearlyEqual = util.number.nearlyEqual,
      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Test whether two values are unequal.
   *
   * The function tests whether the relative difference between x and y is
   * larger than the configured epsilon. The function cannot be used to compare
   * values smaller than approximately 2.22e-16.
   *
   * For matrices, the function is evaluated element wise.
   * In case of complex numbers, x.re must unequal y.re, or x.im must unequal y.im.
   *
   * Syntax:
   *
   *    math.unequal(x, y)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.unequal(2 + 2, 3);       // returns true
   *    math.unequal(2 + 2, 4);       // returns false
   *
   *    var a = math.unit('50 cm');
   *    var b = math.unit('5 m');
   *    math.unequal(a, b);           // returns false
   *
   * See also:
   *
   *    equal, smaller, smallereq, larger, largereq, compare
   *
   * @param  {Number | BigNumber | Boolean | Complex | Unit | String | Array | Matrix} x First value to compare
   * @param  {Number | BigNumber | Boolean | Complex | Unit | String | Array | Matrix} y Second value to compare
   * @return {Boolean | Array | Matrix} Returns true when the compared values are unequal, else returns false
   */
  math.unequal = function unequal(x, y) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('unequal', arguments.length, 2);
    }

    if (isNumber(x)) {
      if (isNumber(y)) {
        return !nearlyEqual(x, y, config.epsilon);
      }
      else if (isComplex(y)) {
        return !nearlyEqual(x, y.re, config.epsilon) || !nearlyEqual(y.im, 0, config.epsilon);
      }
    }

    if (isComplex(x)) {
      if (isNumber(y)) {
        return !nearlyEqual(x.re, y, config.epsilon) || !nearlyEqual(x.im, 0, config.epsilon);
      }
      else if (isComplex(y)) {
        return !nearlyEqual(x.re, y.re, config.epsilon) || !nearlyEqual(x.im, y.im, config.epsilon);
      }
    }

    if (x instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(y)) {
        y = BigNumber.convert(y);
      }
      else if (isBoolean(y)) {
        y = new BigNumber(y ? 1 : 0);
      }

      if (y instanceof BigNumber) {
        return !x.eq(y);
      }

      // downgrade to Number
      return unequal(x.toNumber(), y);
    }
    if (y instanceof BigNumber) {
      // try to convert to big number
      if (isNumber(x)) {
        x = BigNumber.convert(x);
      }
      else if (isBoolean(x)) {
        x = new BigNumber(x ? 1 : 0);
      }

      if (x instanceof BigNumber) {
        return !x.eq(y)
      }

      // downgrade to Number
      return unequal(x, y.toNumber());
    }

    if ((isUnit(x)) && (isUnit(y))) {
      if (!x.equalBase(y)) {
        throw new Error('Cannot compare units with different base');
      }
      return x.value != y.value;
    }

    if (isCollection(x) || isCollection(y)) {
      return collection.deepMap2(x, y, unequal);
    }

    // Note: test strings after testing collections,
    // else we can't compare a string with a matrix
    if (isString(x) || isString(y)) {
      return x != y;
    }

    if (isBoolean(x)) {
      return unequal(+x, y);
    }
    if (isBoolean(y)) {
      return unequal(x, +y);
    }

    throw new math.error.UnsupportedTypeError('unequal', math['typeof'](x), math['typeof'](y));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],196:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isInteger = util.number.isInteger;

  /**
   * Calculate the extended greatest common divisor for two values.
   * See http://en.wikipedia.org/wiki/Extended_Euclidean_algorithm.
   *
   * Syntax:
   *
   *    math.xgcd(a, b)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.xgcd(8, 12);             // returns [4, -1, 1]
   *    math.gcd(8, 12);              // returns 4
   *    math.xgcd(36163, 21199);      // returns [1247, -7, 12]
   *
   * See also:
   *
   *    gcd, lcm
   *
   * @param {Number | Boolean} a  An integer number
   * @param {Number | Boolean} b  An integer number
   * @return {Array}              Returns an array containing 3 integers `[div, m, n]`
   *                              where `div = gcd(a, b)` and `a*m + b*n = div`
   */
  math.xgcd = function xgcd(a, b) {
    if (arguments.length == 2) {
      // two arguments
      if (isNumber(a) && isNumber(b)) {
        if (!isInteger(a) || !isInteger(b)) {
          throw new Error('Parameters in function xgcd must be integer numbers');
        }

        return _xgcd(a, b);
      }

      // TODO: implement BigNumber support for xgcd

      // downgrade bignumbers to numbers
      if (a instanceof BigNumber) {
        return xgcd(a.toNumber(), b);
      }
      if (b instanceof BigNumber) {
        return xgcd(a, b.toNumber());
      }

      if (isBoolean(a)) {
        return xgcd(+a, b);
      }
      if (isBoolean(b)) {
        return xgcd(a, +b);
      }

      throw new math.error.UnsupportedTypeError('xgcd', math['typeof'](a), math['typeof'](b));
    }

    // zero or one argument
    throw new SyntaxError('Function xgcd expects two arguments');
  };

  /**
   * Calculate xgcd for two numbers
   * @param {Number} a
   * @param {Number} b
   * @private
   */
  function _xgcd(a, b) {
    // source: http://en.wikipedia.org/wiki/Extended_Euclidean_algorithm
    var t, // used to swap two variables
        q, // quotient
        r, // remainder
        x = 0, lastx = 1,
        y = 1, lasty = 0;

    while (b) {
      q = Math.floor(a / b);
      r = a % b;

      t = x;
      x = lastx - q * x;
      lastx = t;

      t = y;
      y = lasty - q * y;
      lasty = t;

      a = b;
      b = r;
    }

    if (a < 0) {
      return [-a, -lastx, -lasty];
    }
    else {
      return [a, a ? lastx : 0, lasty];
    }
  }
};

},{"../../util/index":276}],197:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isCollection = collection.isCollection,
      isComplex = Complex.isComplex;

  /**
   * Compute the argument of a complex value.
   * For a complex number `a + bi`, the argument is computed as `atan2(b, a)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.arg(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    var a = math.complex(2, 2);
   *    math.arg(a) / math.pi;          // returns Number 0.25
   *
   *    var b = math.complex('2 + 3i');
   *    math.arg(b);                    // returns Number 0.982793723247329
   *    math.atan2(3, 2);               // returns Number 0.982793723247329
   *
   * See also:
   *
   *    re, im, conj, abs
   *
   * @param {Number | Complex | Array | Matrix | Boolean} x
   *            A complex number or array with complex numbers
   * @return {Number | Array | Matrix} The argument of x
   */
  math.arg = function arg(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('arg', arguments.length, 1);
    }

    if (isNumber(x)) {
      return Math.atan2(0, x);
    }

    if (isComplex(x)) {
      return Math.atan2(x.im, x.re);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, arg);
    }

    if (isBoolean(x)) {
      return arg(+x);
    }

    if (x instanceof BigNumber) {
      // downgrade to Number
      // TODO: implement BigNumber support
      return arg(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('arg', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],198:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      object = util.object,
      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isCollection =collection.isCollection,
      isComplex = Complex.isComplex;

  /**
   * Compute the complex conjugate of a complex value.
   * If `x = a+bi`, the complex conjugate of `x` is `a - bi`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.conj(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.conj(math.complex('2 + 3i'));  // returns Complex 2 - 3i
   *    math.conj(math.complex('2 - 3i'));  // returns Complex 2 + 3i
   *    math.conj(math.complex('-5.2i'));  // returns Complex 5.2i
   *
   * See also:
   *
   *    re, im, arg, abs
   *
   * @param {Number | BigNumber | Complex | Array | Matrix | Boolean} x
   *            A complex number or array with complex numbers
   * @return {Number | BigNumber | Complex | Array | Matrix}
   *            The complex conjugate of x
   */
  math.conj = function conj(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('conj', arguments.length, 1);
    }

    if (isNumber(x)) {
      return x;
    }

    if (x instanceof BigNumber) {
      return new BigNumber(x);
    }

    if (isComplex(x)) {
      return new Complex(x.re, -x.im);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, conj);
    }

    if (isBoolean(x)) {
      return +x;
    }

    // return a clone of the value for non-complex values
    return object.clone(x);
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],199:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isCollection =collection.isCollection,
      isComplex = Complex.isComplex;

  /**
   * Get the imaginary part of a complex number.
   * For a complex number `a + bi`, the function returns `b`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.im(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    var a = math.complex(2, 3);
   *    math.re(a);                     // returns Number 2
   *    math.im(a);                     // returns Number 3
   *
   *    math.re(math.complex('-5.2i')); // returns Number -5.2
   *    math.re(math.complex(2.4));     // returns Number 0
   *
   * See also:
   *
   *    re, conj, abs, arg
   *
   * @param {Number | BigNumber | Complex | Array | Matrix | Boolean} x
   *            A complex number or array with complex numbers
   * @return {Number | BigNumber | Array | Matrix} The imaginary part of x
   */
  math.im = function im(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('im', arguments.length, 1);
    }

    if (isNumber(x)) {
      return 0;
    }

    if (x instanceof BigNumber) {
      return new BigNumber(0);
    }

    if (isComplex(x)) {
      return x.im;
    }

    if (isCollection(x)) {
      return collection.deepMap(x, im);
    }

    if (isBoolean(x)) {
      return 0;
    }

    // return 0 for all non-complex values
    return 0;
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],200:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      object = util.object,
      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isCollection = collection.isCollection,
      isComplex = Complex.isComplex;

  /**
   * Get the real part of a complex number.
   * For a complex number `a + bi`, the function returns `a`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.re(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    var a = math.complex(2, 3);
   *    math.re(a);                     // returns Number 2
   *    math.im(a);                     // returns Number 3
   *
   *    math.re(math.complex('-5.2i')); // returns Number 0
   *    math.re(math.complex(2.4));     // returns Number 2.4
   *
   * See also:
   *
   *    im, conj, abs, arg
   *
   * @param {Number | BigNumber | Complex | Array | Matrix | Boolean} x
   *            A complex number or array with complex numbers
   * @return {Number | BigNumber | Array | Matrix} The real part of x
   */
  math.re = function re(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('re', arguments.length, 1);
    }

    if (isNumber(x)) {
      return x;
    }

    if (x instanceof BigNumber) {
      return new BigNumber(x);
    }

    if (isComplex(x)) {
      return x.re;
    }

    if (isCollection(x)) {
      return collection.deepMap(x, re);
    }

    if (isBoolean(x)) {
      return +x;
    }

    // return a clone of the value itself for all non-complex values
    return object.clone(x);
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],201:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      // take the BigNumber instance the provided math.js instance
      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isCollection = collection.isCollection,
      isNumber = util.number.isNumber,
      isString = util.string.isString,
      isBoolean = util['boolean'].isBoolean;

  /**
   * Create a BigNumber, which can store numbers with arbitrary precision.
   * When a matrix is provided, all elements will be converted to BigNumber.
   *
   * Syntax:
   *
   *    math.bignumber(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    0.1 + 0.2;                                  // returns Number 0.30000000000000004
   *    math.bignumber(0.1) + math.bignumber(0.2);  // returns BigNumber 0.3
   *
   *
   *    7.2e500;                                    // returns Number Infinity
   *    math.bignumber('7.2e500');                  // returns BigNumber 7.2e500
   *
   * See also:
   *
   *    boolean, complex, index, matrix, string, unit
   *
   * @param {Number | String | Array | Matrix} [value]  Value for the big number,
   *                                                    0 by default.
   * @returns {BigNumber} The created bignumber
   */
  math.bignumber = function bignumber(value) {
    if (arguments.length > 1) {
      throw new math.error.ArgumentsError('bignumber', arguments.length, 0, 1);
    }

    if ((value instanceof BigNumber) || isNumber(value) || isString(value)) {
      return new BigNumber(value);
    }

    if (isBoolean(value)) {
      return new BigNumber(+value);
    }

    if (isCollection(value)) {
      return collection.deepMap(value, bignumber);
    }

    if (arguments.length == 0) {
      return new BigNumber(0);
    }

    throw new math.error.UnsupportedTypeError('bignumber', math['typeof'](value));
  };
};

},{"../../type/collection":272,"../../util/index":276}],202:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isCollection = collection.isCollection,
      isNumber = util.number.isNumber,
      isString = util.string.isString;

  /**
   * Create a boolean or convert a string or number to a boolean.
   * In case of a number, `true` is returned for non-zero numbers, and `false` in
   * case of zero.
   * Strings can be `'true'` or `'false'`, or can contain a number.
   * When value is a matrix, all elements will be converted to boolean.
   *
   * Syntax:
   *
   *    math.boolean(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.boolean(0);     // returns false
   *    math.boolean(1);     // returns true
   *    math.boolean(-3);     // returns true
   *    math.boolean('true');     // returns true
   *    math.boolean('false');     // returns false
   *    math.boolean([1, 0, 1, 1]);     // returns [true, false, true, true]
   *
   * See also:
   *
   *    bignumber, complex, index, matrix, string, unit
   *
   * @param {String | Number | Boolean | Array | Matrix} value  A value of any type
   * @return {Boolean | Array | Matrix} The boolean value
   */
  math['boolean'] = function bool (value) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('boolean', arguments.length, 0, 1);
    }

    if (value === 'true' || value === true) {
      return true;
    }

    if (value === 'false' || value === false) {
      return false;
    }

    if (value instanceof Boolean) {
      return value == true;
    }

    if (isNumber(value)) {
      return (value !== 0);
    }

    if (value instanceof BigNumber) {
      return !value.isZero();
    }

    if (isString(value)) {
      // try case insensitive
      var lcase = value.toLowerCase();
      if (lcase === 'true') {
        return true;
      }
      else if (lcase === 'false') {
        return false;
      }

      // test whether value is a valid number
      var num = Number(value);
      if (value != '' && !isNaN(num)) {
        return (num !== 0);
      }
    }

    if (isCollection(value)) {
      return collection.deepMap(value, bool);
    }

    throw new SyntaxError(value.toString() + ' is no valid boolean');
  };
};

},{"../../type/collection":272,"../../util/index":276}],203:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isCollection = collection.isCollection,
      isNumber = util.number.isNumber,
      isString = util.string.isString,
      isComplex = Complex.isComplex;

  /**
   * Create a complex value or convert a value to a complex value.
   *
   * Syntax:
   *
   *     math.complex()                           // creates a complex value with zero
   *                                              // as real and imaginary part.
   *     math.complex(re : number, im : string)   // creates a complex value with provided
   *                                              // values for real and imaginary part.
   *     math.complex(re : number)                // creates a complex value with provided
   *                                              // real value and zero imaginary part.
   *     math.complex(complex : Complex)          // clones the provided complex value.
   *     math.complex(arg : string)               // parses a string into a complex value.
   *     math.complex(array : Array)              // converts the elements of the array
   *                                              // or matrix element wise into a
   *                                              // complex value.
   *     math.complex({re: number, im: number})   // creates a complex value with provided
   *                                              // values for real an imaginary part.
   *     math.complex({r: number, phi: number})   // creates a complex value with provided
   *                                              // polar coordinates
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    var a = math.complex(3, -4);     // a = Complex 3 - 4i
   *    a.re = 5;                        // a = Complex 5 - 4i
   *    var i = a.im;                    // Number -4;
   *    var b = math.complex('2 + 6i');  // Complex 2 + 6i
   *    var c = math.complex();          // Complex 0 + 0i
   *    var d = math.add(a, b);          // Complex 5 + 2i
   *
   * See also:
   *
   *    bignumber, boolean, index, matrix, number, string, unit
   *
   * @param {* | Array | Matrix} [args]
   *            Arguments specifying the real and imaginary part of the complex number
   * @return {Complex | Array | Matrix} Returns a complex value
   */
  math.complex = function complex(args) {
    switch (arguments.length) {
      case 0:
        // no parameters. Set re and im zero
        return new Complex(0, 0);

      case 1:
        // parse string into a complex number
        var arg = arguments[0];

        if (isNumber(arg)) {
          return new Complex(arg, 0);
        }

        if (arg instanceof BigNumber) {
          // convert to Number
          return new Complex(arg.toNumber(), 0);
        }

        if (isComplex(arg)) {
          // create a clone
          return arg.clone();
        }

        if (isString(arg)) {
          var c = Complex.parse(arg);
          if (c) {
            return c;
          }
          else {
            throw new SyntaxError('String "' + arg + '" is no valid complex number');
          }
        }

        if (isCollection(arg)) {
          return collection.deepMap(arg, complex);
        }

        if (typeof arg === 'object') {
          if('re' in arg && 'im' in arg) {
            return new Complex(arg.re, arg.im);
          } else if ('r' in arg && 'phi' in arg) {
            return Complex.fromPolar(arg.r, arg.phi);
          }
        } 

        throw new TypeError('Two numbers, single string or an fitting object expected in function complex');

      case 2:
        // re and im provided
        var re = arguments[0],
            im = arguments[1];

        // convert re to number
        if (re instanceof BigNumber) {
          re = re.toNumber();
        }

        // convert im to number
        if (im instanceof BigNumber) {
          im = im.toNumber();
        }

        if (isNumber(re) && isNumber(im)) {
          return new Complex(re, im);
        }
        else {
          throw new TypeError('Two numbers or a single string expected in function complex');
        }

      default:
        throw new math.error.ArgumentsError('complex', arguments.length, 0, 2);
    }
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],204:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Index = require('../../type/Index');

  /**
   * Create an index. An Index can store ranges having start, step, and end
   * for multiple dimensions.
   * Matrix.get, Matrix.set, and math.subset accept an Index as input.
   *
   * Syntax:
   *
   *     math.index(range1, range2, ...);
   *
   * Where:
   *
   * Each range can be any of:
   *
   * - An array [start, end]
   * - An array [start, end, step]
   * - A number
   * - An instance of `Range`
   *
   * The parameters start, end, and step must be integer numbers. Start and end
   * are zero based. The start of a range is included, the end is excluded.
   *
   * Examples:
   *
   *    var math = math.js
   *
   *    var b = [1, 2, 3, 4, 5];
   *    math.subset(b, math.index([1, 3]));     // returns [2, 3]
   *
   *    var a = math.matrix([[1, 2], [3, 4]]);
   *    a.subset(math.index(0, 1));             // returns 2
   *    a.subset(math.index(1, null));          // returns [3, 4]
   *
   * See also:
   *
   *    bignumber, boolean, complex, matrix, number, string, unit
   *
   * @param {...*} ranges   Zero or more ranges or numbers.
   * @return {Index}        Returns the created index
   */
  math.index = function matrix(ranges) {
    var i = new Index();

    // downgrade BigNumber to Number
    var args = Array.prototype.slice.apply(arguments).map(function (arg) {
      if (arg instanceof BigNumber) {
        return arg.toNumber();
      }
      else if (Array.isArray(arg)) {
        return arg.map(function (elem) {
          return (elem instanceof BigNumber) ? elem.toNumber() : elem;
        });
      }
      else {
        return arg;
      }
    });

    Index.apply(i, args);
    return i;
  };
};

},{"../../type/Index":268,"../../util/index":276}],205:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),
      Matrix = require('../../type/Matrix');

  /**
   * Create a Matrix. The function creates a new `math.type.Matrix` object from
   * an `Array`. A Matrix has utility functions to manipulate the data in the
   * matrix, like getting the size and getting or setting values in the matrix.
   *
   * Syntax:
   *
   *    math. matrix()     // creates an empty matrix
   *    math.matrix(data)  // creates a matrix with initial data.
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    var m = math.matrix([[1, 2], [3, 4]);
   *    m.size();                        // Array [2, 2]
   *    m.resize([3, 2], 5);
   *    m.valueOf();                     // Array [[1, 2], [3, 4], [5, 5]]
   *    m.get([1, 0])                    // number 3
   *
   * See also:
   *
   *    bignumber, boolean, complex, index, number, string, unit
   *
   * @param {Array | Matrix} [data]    A multi dimensional array
   * @return {Matrix} The created matrix
   */
  math.matrix = function matrix(data) {
    if (arguments.length > 1) {
      throw new math.error.ArgumentsError('matrix', arguments.length, 0, 1);
    }

    return new Matrix(data);
  };
};

},{"../../type/Matrix":269,"../../util/index":276}],206:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isCollection = collection.isCollection,
      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString;

  /**
   * Create a number or convert a string to a number.
   * When value is a matrix, all elements will be converted to number.
   *
   * Syntax:
   *
   *    math.number(value)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.number(2);                         // returns number 2
   *    math.number('7.2');                     // returns number 7.2
   *    math.number(true);                      // returns number 1
   *    math.number([true, false, true, true]); // returns [1, 0, 1, 1]
   *
   * See also:
   *
   *    bignumber, boolean, complex, index, matrix, string, unit
   *
   * @param {String | Number | Boolean | Array | Matrix} [value]  Value to be converted
   * @return {Number | Array | Matrix} The created number
   */
  math.number = function number (value) {
    switch (arguments.length) {
      case 0:
        return 0;

      case 1:
        if (isCollection(value)) {
          return collection.deepMap(value, number);
        }

        if (value instanceof BigNumber) {
          return value.toNumber();
        }

        if (isString(value)) {
          var num = Number(value);
          if (isNaN(num)) {
            num = Number(value.valueOf());
          }
          if (isNaN(num)) {
            throw new SyntaxError(value.toString() + ' is no valid number');
          }
          return num;
        }

        if (isBoolean(value)) {
          return value + 0;
        }

        if (isNumber(value)) {
          return value;
        }

        throw new math.error.UnsupportedTypeError('number', math['typeof'](value));

      default:
        throw new math.error.ArgumentsError('number', arguments.length, 0, 1);
    }
  };
};

},{"../../type/collection":272,"../../util/index":276}],207:[function(require,module,exports){
module.exports = function (math) {
  var Parser = require('../../expression/Parser');

  /**
   * Create a parser. The function creates a new `math.expression.Parser` object.
   *
   * Syntax:
   *
   *    math.parser()
   *
   * Examples:
   *
   *     var parser = new math.parser();
   *
   *     // evaluate expressions
   *     var a = parser.eval('sqrt(3^2 + 4^2)'); // 5
   *     var b = parser.eval('sqrt(-4)');        // 2i
   *     var c = parser.eval('2 inch in cm');    // 5.08 cm
   *     var d = parser.eval('cos(45 deg)');     // 0.7071067811865476
   *
   *     // define variables and functions
   *     parser.eval('x = 7 / 2');               // 3.5
   *     parser.eval('x + 3');                   // 6.5
   *     parser.eval('function f(x, y) = x^y');  // f(x, y)
   *     parser.eval('f(2, 3)');                 // 8
   *
   *     // get and set variables and functions
   *     var x = parser.get('x');                // 7
   *     var f = parser.get('f');                // function
   *     var g = f(3, 2);                        // 9
   *     parser.set('h', 500);
   *     var i = parser.eval('h / 2');           // 250
   *     parser.set('hello', function (name) {
   *       return 'hello, ' + name + '!';
   *     });
   *     parser.eval('hello("user")');           // "hello, user!"
   *
   *     // clear defined functions and variables
   *     parser.clear();
   *
   * See also:
   *
   *    eval, compile, parse
   *
   * @return {Parser} Parser
   */
  math.parser = function parser() {
    return new Parser(math);
  };
};

},{"../../expression/Parser":33}],208:[function(require,module,exports){
module.exports = function (math) {
  /**
   * Wrap any value in a Selector, allowing to perform chained operations on
   * the value.
   *
   * All methods available in the math.js library can be called upon the selector,
   * and then will be evaluated with the value itself as first argument.
   * The selector can be closed by executing `selector.done()`, which returns
   * the final value.
   *
   * The Selector has a number of special functions:
   *
   * - `done()`     Finalize the chained operation and return the selectors value.
   * - `valueOf()`  The same as `done()`
   * - `toString()` Executes `math.format()` onto the selectors value, returning
   *                a string representation of the value.
   *
   * Syntax:
   *
   *    math.select(value)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.select(3)
   *         .add(4)
   *         .subtract(2)
   *         .done();     // 5
   *
   *     math.select( [[1, 2], [3, 4]] )
   *         .set([1, 1], 8)
   *         .multiply(3)
   *         .done();     // [[24, 6], [9, 12]]
   *
   * @param {*} [value]   A value of any type on which to start a chained operation.
   * @return {math.chaining.Selector} The created selector
   */
  math.select = function select(value) {
    // TODO: check number of arguments
    return new math.chaining.Selector(value);
  };
};

},{}],209:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      collection = require('../../type/collection'),

      number = util.number,
      isNumber = util.number.isNumber,
      isCollection = collection.isCollection;

  /**
   * Create a string or convert any object into a string.
   * Elements of Arrays and Matrices are processed element wise.
   *
   * Syntax:
   *
   *    math.string(value)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.string(4.2);               // returns string '4.2'
   *    math.string(math.complex(3, 2); // returns string '3 + 2i'
   *
   *    var u = math.unit(5, 'km');
   *    math.string(u.to('m'));         // returns string '5000 m'
   *
   *    math.string([true, false]);     // returns ['true', 'false']
   *
   * See also:
   *
   *    bignumber, boolean, complex, index, matrix, number, unit
   *
   * @param {* | Array | Matrix} [value]  A value to convert to a string
   * @return {String | Array | Matrix} The created string
   */
  math.string = function string (value) {
    switch (arguments.length) {
      case 0:
        return '';

      case 1:
        if (isNumber(value)) {
          return number.format(value);
        }

        if (isCollection(value)) {
          return collection.deepMap(value, string);
        }

        if (value === null) {
          return 'null';
        }

        return value.toString();

      default:
        throw new math.error.ArgumentsError('string', arguments.length, 0, 1);
    }
  };
};

},{"../../type/collection":272,"../../util/index":276}],210:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isCollection = collection.isCollection,
      isString = util.string.isString;

  /**
   * Create a unit. Depending on the passed arguments, the function
   * will create and return a new math.type.Unit object.
   * When a matrix is provided, all elements will be converted to units.
   *
   * Syntax:
   *
   *     math.unit(unit : string)
   *     math.unit(value : number, unit : string)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    var a = math.unit(5, 'cm');    // returns Unit 50 mm
   *    var b = math.unit('23 kg');    // returns Unit 23 kg
   *    a.to('m');                     // returns Unit 0.05 m
   *
   * See also:
   *
   *    bignumber, boolean, complex, index, matrix, number, string
   *
   * @param {* | Array | Matrix} args   A number and unit.
   * @return {Unit | Array | Matrix}    The created unit
   */
  math.unit = function unit(args) {
    switch(arguments.length) {
      case 1:
        // parse a string
        var arg = arguments[0];

        if (arg instanceof Unit) {
          // create a clone of the unit
          return arg.clone();
        }

        if (isString(arg)) {
          if (Unit.isValuelessUnit(arg)) {
            return new Unit(null, arg); // a pure unit
          }

          var u = Unit.parse(arg);        // a unit with value, like '5cm'
          if (u) {
            return u;
          }

          throw new SyntaxError('String "' + arg + '" is no valid unit');
        }

        if (isCollection(args)) {
          return collection.deepMap(args, unit);
        }

        throw new TypeError('A string or a number and string expected in function unit');

      case 2:
        // a number and a unit

        if (arguments[0] instanceof BigNumber) {
          // convert value to number
          return new Unit(arguments[0].toNumber(), arguments[1]);
        }
        else {
          return new Unit(arguments[0], arguments[1]);
        }

      default:
        throw new math.error.ArgumentsError('unit', arguments.length, 1, 2);
    }
  };
};

},{"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],211:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),
      _parse = require('../../expression/parse'),

      collection = require('../../type/collection'),

      isString = util.string.isString,
      isCollection = collection.isCollection;

  /**
   * Parse and compile an expression.
   * Returns a an object with a function `eval([scope])` to evaluate the
   * compiled expression.
   *
   * Syntax:
   *
   *     var code = math.compile(expr)
   *     var codes = math.compile([expr1, expr2, expr3, ...])
   *
   * Examples:
   *
   *     var code = math.compile('sqrt(3^2 + 4^2)');
   *     code.eval(); // 5
   *
   *     var scope = {a: 3, b: 4}
   *     var code = math.compile('a * b'); // 12
   *     code.eval(scope); // 12
   *     scope.a = 5;
   *     code.eval(scope); // 20
   *
   *     var nodes = math.compile(['a = 3', 'b = 4', 'a * b']);
   *     nodes[2].eval(); // 12
   *
   * See also:
   *
   *    parse, eval
   *
   * @param {String | String[] | Matrix} expr
   *            The expression to be compiled
   * @return {{eval: Function} | Array.<{eval: Function}>} code
   *            An object with the compiled expression
   * @throws {Error}
   */
  math.compile = function compile (expr) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('compile', arguments.length, 1);
    }

    if (isString(expr)) {
      // evaluate a single expression
      return _parse(expr).compile(math);
    }
    else if (isCollection(expr)) {
      // evaluate an array or matrix with expressions
      return collection.deepMap(expr, function (elem) {
        return _parse(elem).compile(math);
      });
    }
    else {
      // oops
      throw new TypeError('String, array, or matrix expected');
    }
  }
};

},{"../../expression/parse":163,"../../type/collection":272,"../../util/index":276}],212:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),
      _parse = require('../../expression/parse'),

      collection = require('../../type/collection'),

      isString = util.string.isString,
      isCollection = collection.isCollection;

  /**
   * Evaluate an expression.
   *
   * Syntax:
   *
   *     math.eval(expr)
   *     math.eval(expr, scope)
   *     math.eval([expr1, expr2, expr3, ...])
   *     math.eval([expr1, expr2, expr3, ...], scope)
   *
   * Example:
   *
   *     math.eval('(2+3)/4');                // 1.25
   *     math.eval('sqrt(3^2 + 4^2)');        // 5
   *     math.eval('sqrt(-4)');               // 2i
   *     math.eval(['a=3', 'b=4', 'a*b']);,   // [3, 4, 12]
   *
   *     var scope = {a:3, b:4};
   *     math.eval('a * b', scope);           // 12
   *
   * See also:
   *
   *    parse, compile
   *
   * @param {String | String[] | Matrix} expr   The expression to be evaluated
   * @param {Object} [scope]                    Scope to read/write variables
   * @return {*} The result of the expression
   * @throws {Error}
   */
  math.eval = function _eval (expr, scope) {
    if (arguments.length != 1 && arguments.length != 2) {
      throw new math.error.ArgumentsError('eval', arguments.length, 1, 2);
    }

    // instantiate a scope
    scope = scope || {};

    if (isString(expr)) {
      // evaluate a single expression
      return _parse(expr)
          .compile(math)
          .eval(scope);
    }
    else if (isCollection(expr)) {
      // evaluate an array or matrix with expressions
      return collection.deepMap(expr, function (elem) {
        return _parse(elem)
            .compile(math).eval(scope);
      });
    }
    else {
      // oops
      throw new TypeError('String, array, or matrix expected');
    }
  };
};

},{"../../expression/parse":163,"../../type/collection":272,"../../util/index":276}],213:[function(require,module,exports){
module.exports = function (math) {
  var Help = require('../../type/Help');

  /**
   * Retrieve help on a function or data type.
   * Help files are retrieved from the documentation in math.expression.docs.
   *
   * Syntax:
   *
   *    math.help(search)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    console.log(math.help('sin').toString());
   *    console.log(math.help(math.add).toString());
   *    console.log(math.help(math.add).toJSON());
   *
   * @param {function | string | Object} search   A function or function name
   *                                              for which to get help
   * @return {Help} A help object
   */
  math.help = function help(search) {
    if (arguments.length != 1) {
      throw new SyntaxError('Wrong number of arguments in function help ' +
          '(' + arguments.length + ' provided, 1 expected)');
    }

    var text = null;
    if ((search instanceof String) || (typeof(search) === 'string')) {
      text = search;
    }
    else {
      var prop;
      for (prop in math) {
        // search in functions and constants
        if (math.hasOwnProperty(prop) && (search === math[prop])) {
          text = prop;
          break;
        }
      }

      /* TODO: implement help for data types
      if (!text) {
        // search data type
        for (prop in math.type) {
          if (math.type.hasOwnProperty(prop)) {
            if (search === math.type[prop]) {
              text = prop;
              break;
            }
          }
        }
      }
      */
    }

    var doc = math.expression.docs[text];
    if (!text || !doc) {
      throw new Error('No documentation found on "' + text + '"');
    }
    return new Help(math, doc);
  };
};

},{"../../type/Help":267}],214:[function(require,module,exports){
module.exports = function (math, config) {
  var _parse = require('../../expression/parse');

  /**
   * Parse an expression.
   * Returns a node tree which can be compiled and evaluated.
   *
   * Syntax:
   *
   *     math.parse(expr)
   *     math.parse(expr, nodes)
   *     math.parse([expr1, expr2, expr3, ...])
   *     math.parse([expr1, expr2, expr3, ...], nodes)
   *
   * Example:
   *
   *     var math = mathjs();
   *
   *     var node = math.parse('sqrt(3^2 + 4^2)');
   *     node.compile(math).eval(); // 5
   *
   *     var scope = {a: 3, b: 4}
   *     var node = math.parse('a * b'); // 12
   *     var code = node.compile(math);
   *     code.eval(scope); // 12
   *     scope.a = 5;
   *     code.eval(scope); // 20
   *
   *     var nodes = math.parse(['a = 3', 'b = 4', 'a * b']);
   *     var scope2 = {};
   *     nodes.map(function(node) {
   *       return node.compile(math).eval(scope2);
   *     });  // returns [3, 4, 12]
   *
   * @param {String | String[] | Matrix} expr   Expression to be parsed
   * @param {Object<String, Node>} [nodes]      Optional custom nodes
   * @return {Node | Node[]} A node tree
   * @throws {Error}
   */
  math.parse = function parse (expr, nodes) {
    return _parse.apply(_parse, arguments);
  }

};

},{"../../expression/parse":163}],215:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      object = util.object,
      array = util.array,
      isNumber = util.number.isNumber,
      isInteger = util.number.isInteger,
      isCollection = collection.isCollection;

  /**
   * Concatenate two or more matrices.
   *
   * Syntax:
   *
   *     math.concat(A, B, C, ...)
   *     math.concat(A, B, C, ..., dim)
   *
   * Where:
   *
   * - `dim: number` is a zero-based dimension over which to concatenate the matrices.
   *   By default the last dimension of the matrices.
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    var A = [[1, 2], [5, 6]];
   *    var B = [[3, 4], [7, 8]];
   *
   *    math.concat(A, B);      // returns [[1, 2, 3, 4], [5, 6, 7, 8]]
   *    math.concat(A, B, 0);   // returns [[1, 2], [5, 6], [3, 4], [7, 8]]
   *
   * See also:
   *
   *    size, squeeze, subset, transpose
   *
   * @param {... Array | Matrix} args     Two or more matrices
   * @return {Array | Matrix} Concatenated matrix
   */
  math.concat = function concat (args) {
    var i,
        len = arguments.length,
        dim = -1,  // zero-based dimension
        prevDim,
        asMatrix = false,
        matrices = [];  // contains multi dimensional arrays

    for (i = 0; i < len; i++) {
      var arg = arguments[i];

      // test whether we need to return a Matrix (if not we return an Array)
      if (arg instanceof Matrix) {
        asMatrix = true;
      }

      if ((i == len - 1) && isNumber(arg)) {
        // last argument contains the dimension on which to concatenate
        prevDim = dim;
        dim = arg;

        if (!isInteger(dim) || dim < 0) {
          throw new TypeError('Dimension number must be a positive integer ' +
              '(dim = ' + dim + ')');
        }

        if (i > 0 && dim > prevDim) {
          throw new math.error.DimensionError(dim, prevDim, '>');
        }
      }
      else if (isCollection(arg)) {
        // this is a matrix or array
        var matrix = object.clone(arg).valueOf();
        var size = array.size(arg.valueOf());
        matrices[i] = matrix;
        prevDim = dim;
        dim = size.length - 1;

        // verify whether each of the matrices has the same number of dimensions
        if (i > 0 && dim != prevDim) {
          throw new math.error.DimensionError(dim, prevDim);
        }
      }
      else {
        throw new math.error.UnsupportedTypeError('concat', math['typeof'](arg));
      }
    }

    if (matrices.length == 0) {
      throw new SyntaxError('At least one matrix expected');
    }

    var res = matrices.shift();
    while (matrices.length) {
      res = _concat(res, matrices.shift(), dim, 0);
    }

    return asMatrix ? new Matrix(res) : res;
  };

  /**
   * Recursively concatenate two matrices.
   * The contents of the matrices is not cloned.
   * @param {Array} a             Multi dimensional array
   * @param {Array} b             Multi dimensional array
   * @param {Number} concatDim    The dimension on which to concatenate (zero-based)
   * @param {Number} dim          The current dim (zero-based)
   * @return {Array} c            The concatenated matrix
   * @private
   */
  function _concat(a, b, concatDim, dim) {
    if (dim < concatDim) {
      // recurse into next dimension
      if (a.length != b.length) {
        throw new math.error.DimensionError(a.length, b.length);
      }

      var c = [];
      for (var i = 0; i < a.length; i++) {
        c[i] = _concat(a[i], b[i], concatDim, dim + 1);
      }
      return c;
    }
    else {
      // concatenate this dimension
      return a.concat(b);
    }
  }
};

},{"../../type/Matrix":269,"../../type/collection":272,"../../util/index":276}],216:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      Matrix = require('../../type/Matrix'),

      object = util.object,
      string = util.string;

  /**
   * Calculate the determinant of a matrix.
   *
   * Syntax:
   *
   *    math.det(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.det([[1, 2], [3, 4]]); // returns -2
   *
   *    var A = [
   *      [-2, 2, 3],
   *      [-1, 1, 3],
   *      [2, 0, -1]
   *    ]
   *    math.det(A); // returns 6
   *
   * See also:
   *
   *    inv
   *
   * @param {Array | Matrix} x  A matrix
   * @return {Number} The determinant of `x`
   */
  math.det = function det (x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('det', arguments.length, 1);
    }

    var size;
    if (x instanceof Matrix) {
      size = x.size();
    }
    else if (x instanceof Array) {
      x = new Matrix(x);
      size = x.size();
    }
    else {
      // a scalar
      size = [];
    }

    switch (size.length) {
      case 0:
        // scalar
        return object.clone(x);

      case 1:
        // vector
        if (size[0] == 1) {
          return object.clone(x.valueOf()[0]);
        }
        else {
          throw new RangeError('Matrix must be square ' +
              '(size: ' + string.format(size) + ')');
        }

      case 2:
        // two dimensional array
        var rows = size[0];
        var cols = size[1];
        if (rows == cols) {
          return _det(x.clone().valueOf(), rows, cols);
        }
        else {
          throw new RangeError('Matrix must be square ' +
              '(size: ' + string.format(size) + ')');
        }

      default:
        // multi dimensional array
        throw new RangeError('Matrix must be two dimensional ' +
            '(size: ' + string.format(size) + ')');
    }
  };

  /**
   * Calculate the determinant of a matrix
   * @param {Array[]} matrix  A square, two dimensional matrix
   * @param {Number} rows     Number of rows of the matrix (zero-based)
   * @param {Number} cols     Number of columns of the matrix (zero-based)
   * @returns {Number} det
   * @private
   */
  function _det (matrix, rows, cols) {
    if (rows == 1) {
      // this is a 1 x 1 matrix
      return object.clone(matrix[0][0]);
    }
    else if (rows == 2) {
      // this is a 2 x 2 matrix
      // the determinant of [a11,a12;a21,a22] is det = a11*a22-a21*a12
      return math.subtract(
          math.multiply(matrix[0][0], matrix[1][1]),
          math.multiply(matrix[1][0], matrix[0][1])
      );
    }
    else {
      // this is an n x n matrix
      function compute_mu(matrix) {
        var i, j;

        // Compute the matrix with zero lower triangle, same upper triangle,
        // and diagonals given by the negated sum of the below diagonal
        // elements.
        var mu = new Array(matrix.length);
        var sum = 0;
        for (i = 1; i < matrix.length; i++) {
          sum = math.add(sum, matrix[i][i]);
        }

        for (i = 0; i < matrix.length; i++) {
          mu[i] = new Array(matrix.length);
          mu[i][i] = math.unary(sum);

          for (j = 0; j < i; j++) {
            mu[i][j] = 0;
          }

          for (j = i + 1; j < matrix.length; j++) {
            mu[i][j] = matrix[i][j];
          }

          if (i+1 < matrix.length) {
            sum = math.subtract(sum, matrix[i + 1][i + 1]);
          }
        }

        return mu;
      }

      var fa = matrix;
      for (var i = 0; i < rows - 1; i++) {
        fa = math.multiply(compute_mu(fa), matrix);
      }

      if (rows % 2 == 0) {
        return math.unary(fa[0][0]);
      } else {
        return fa[0][0];
      }
    }
  }
};

},{"../../type/Matrix":269,"../../util/index":276}],217:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Matrix = require('../../type/Matrix'),

      object = util.object,
      isArray = util.array.isArray,
      isNumber = util.number.isNumber,
      isInteger = util.number.isInteger;

  /**
   * Create a diagonal matrix or retrieve the diagonal of a matrix
   *
   * When `x` is a vector, a matrix with vector `x` on the diagonal will be returned.
   * When `x` is a two dimensional matrix, the matrixes `k`th diagonal will be returned as vector.
   * When k is positive, the values are placed on the super diagonal.
   * When k is negative, the values are placed on the sub diagonal.
   *
   * Syntax:
   *
   *     math.diag(X)
   *     math.diag(X, k)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     // create a diagonal matrix
   *     math.diag([1, 2, 3]);      // returns [[1, 0, 0], [0, 2, 0], [0, 0, 3]]
   *     math.diag([1, 2, 3], 1);   // returns [[0, 1, 0, 0], [0, 0, 2, 0], [0, 0, 0, 3]]
   *     math.diag([1, 2, 3], -1);  // returns [[0, 0, 0], [1, 0, 0], [0, 2, 0], [0, 0, 3]]
   *
   *    // retrieve the diagonal from a matrix
   *    var a = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
   *    math.diag(a);   // returns [1, 5, 9]
   *
   * See also:
   *
   *     ones, zeros, eye
   *
   * @param {Matrix | Array} x          A two dimensional matrix or a vector
   * @param {Number | BigNumber} [k=0]  The diagonal where the vector will be filled
   *                                    in or retrieved.
   * @returns {Matrix | Array} Diagonal matrix from input vector, or diagonal from input matrix.
   */
  math.diag = function diag (x, k) {
    var data, vector, i, iMax;

    if (arguments.length != 1 && arguments.length != 2) {
      throw new math.error.ArgumentsError('diag', arguments.length, 1, 2);
    }

    if (k) {
      // convert BigNumber to a number
      if (k instanceof BigNumber) k = k.toNumber();

      if (!isNumber(k) || !isInteger(k)) {
        throw new TypeError ('Second parameter in function diag must be an integer');
      }
    }
    else {
      k = 0;
    }
    var kSuper = k > 0 ? k : 0;
    var kSub = k < 0 ? -k : 0;

    // check type of input
    var asArray;
    if (x instanceof Matrix) {
      asArray = false;
    }
    else if (isArray(x)) {
      // convert to matrix
      x = new Matrix(x);
      asArray = true;
    }
    else {
      throw new TypeError ('First parameter in function diag must be a Matrix or Array');
    }

    var s = x.size();
    switch (s.length) {
      case 1:
        // x is a vector. create diagonal matrix
        vector = x.valueOf();
        var matrix = new Matrix();
        var defaultValue = (vector[0] instanceof BigNumber) ? new BigNumber(0) : 0;
        matrix.resize([vector.length + kSub, vector.length + kSuper], defaultValue);
        data = matrix.valueOf();
        iMax = vector.length;
        for (i = 0; i < iMax; i++) {
          data[i + kSub][i + kSuper] = object.clone(vector[i]);
        }
        return asArray ? matrix.valueOf() : matrix;

      case 2:
        // x is a matrix get diagonal from matrix
        vector = [];
        data = x.valueOf();
        iMax = Math.min(s[0] - kSub, s[1] - kSuper);
        for (i = 0; i < iMax; i++) {
          vector[i] = object.clone(data[i + kSub][i + kSuper]);
        }
        return asArray ? vector : new Matrix(vector);

      default:
        throw new RangeError('Matrix for function diag must be 2 dimensional');
    }
  };
};

},{"../../type/Matrix":269,"../../util/index":276}],218:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isInteger = util.number.isInteger,
      isArray = Array.isArray;

  /**
   * Create a 2-dimensional identity matrix with size m x n or n x n.
   * The matrix has ones on the diagonal and zeros elsewhere.
   *
   * Syntax:
   *
   *    math.eye(n)
   *    math.eye(m, n)
   *    math.eye([m, n])
   *
   * Examples:
   *
   *    math.eye(3);                    // returns [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
   *    math.eye(3, 2);                 // returns [[1, 0], [0, 1], [0, 0]]
   *
   *    var A = [[1, 2, 3], [4, 5, 6]];
   *    math.eye(math.size(b));         // returns [[1, 0, 0], [0, 1, 0]]
   *
   * See also:
   *
   *    diag, ones, zeros, size, range
   *
   * @param {...Number | Matrix | Array} size   The size for the matrix
   * @return {Matrix | Array | Number} A matrix with ones on the diagonal.
   */
  math.eye = function eye (size) {
    var args = collection.argsToArray(arguments),
        asMatrix = (size instanceof Matrix) ? true :
        (isArray(size) ? false : (config.matrix === 'matrix'));


    if (args.length == 0) {
      // return an empty array
      return asMatrix ? new Matrix() : [];
    }
    else if (args.length == 1) {
      // change to a 2-dimensional square
      args[1] = args[0];
    }
    else if (args.length > 2) {
      // error in case of an n-dimensional size
      throw new math.error.ArgumentsError('eye', args.length, 0, 2);
    }

    var rows = args[0],
        cols = args[1];

    if (rows instanceof BigNumber) rows = rows.toNumber();
    if (cols instanceof BigNumber) cols = cols.toNumber();

    if (!isNumber(rows) || !isInteger(rows) || rows < 1) {
      throw new Error('Parameters in function eye must be positive integers');
    }
    if (!isNumber(cols) || !isInteger(cols) || cols < 1) {
      throw new Error('Parameters in function eye must be positive integers');
    }

    // convert arguments from bignumber to numbers if needed
    var asBigNumber = false;
    args = args.map(function (value) {
      if (value instanceof BigNumber) {
        asBigNumber = true;
        return value.toNumber();
      } else {
        return value;
      }
    });

    // create the matrix
    var matrix = new Matrix();
    var one = asBigNumber ? new BigNumber(1) : 1;
    var defaultValue = asBigNumber ? new BigNumber(0) : 0;
    matrix.resize(args, defaultValue);

    // fill in ones on the diagonal
    var minimum = math.min(args);
    var data = matrix.valueOf();
    for (var d = 0; d < minimum; d++) {
      data[d][d] = one;
    }

    return asMatrix ? matrix : matrix.valueOf();
  };
};

},{"../../type/Matrix":269,"../../type/collection":272,"../../util/index":276}],219:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),
      string = util.string,

      Matrix = require('../../type/Matrix');

  /**
   * Calculate the inverse of a square matrix.
   *
   * Syntax:
   *
   *     math.inv(x)
   *
   * Examples:
   *
   *     math.inv([[1, 2], [3, 4]]);  // returns [[-2, 1], [1.5, -0.5]]
   *     math.inv(4);                 // returns 0.25
   *     1 / 4;                       // returns 0.25
   *
   * See also:
   *
   *     det, transpose
   *
   * @param {Number | Complex | Array | Matrix} x     Matrix to be inversed
   * @return {Number | Complex | Array | Matrix} The inverse of `x`.
   */
  math.inv = function inv (x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('inv', arguments.length, 1);
    }
    var size = math.size(x).valueOf();
    switch (size.length) {
      case 0:
        // scalar
        return math.divide(1, x);

      case 1:
        // vector
        if (size[0] == 1) {
          if (x instanceof Matrix) {
            return new Matrix([
              math.divide(1, x.valueOf()[0])
            ]);
          }
          else {
            return [
              math.divide(1, x[0])
            ];
          }
        }
        else {
          throw new RangeError('Matrix must be square ' +
              '(size: ' + string.format(size) + ')');
        }

      case 2:
        // two dimensional array
        var rows = size[0];
        var cols = size[1];
        if (rows == cols) {
          if (x instanceof Matrix) {
            return new Matrix(
                _inv(x.valueOf(), rows, cols)
            );
          }
          else {
            // return an Array
            return _inv(x, rows, cols);
          }
        }
        else {
          throw new RangeError('Matrix must be square ' +
              '(size: ' + string.format(size) + ')');
        }

      default:
        // multi dimensional array
        throw new RangeError('Matrix must be two dimensional ' +
            '(size: ' + string.format(size) + ')');
    }
  };

  /**
   * Calculate the inverse of a square matrix
   * @param {Array[]} matrix  A square matrix
   * @param {Number} rows     Number of rows
   * @param {Number} cols     Number of columns, must equal rows
   * @return {Array[]} inv    Inverse matrix
   * @private
   */
  function _inv (matrix, rows, cols){
    var r, s, f, value, temp;

    if (rows == 1) {
      // this is a 1 x 1 matrix
      value = matrix[0][0];
      if (value == 0) {
        throw Error('Cannot calculate inverse, determinant is zero');
      }
      return [[
        math.divide(1, value)
      ]];
    }
    else if (rows == 2) {
      // this is a 2 x 2 matrix
      var d = math.det(matrix);
      if (d == 0) {
        throw Error('Cannot calculate inverse, determinant is zero');
      }
      return [
        [
          math.divide(matrix[1][1], d),
          math.divide(math.unary(matrix[0][1]), d)
        ],
        [
          math.divide(math.unary(matrix[1][0]), d),
          math.divide(matrix[0][0], d)
        ]
      ];
    }
    else {
      // this is a matrix of 3 x 3 or larger
      // calculate inverse using gauss-jordan elimination
      //      http://en.wikipedia.org/wiki/Gaussian_elimination
      //      http://mathworld.wolfram.com/MatrixInverse.html
      //      http://math.uww.edu/~mcfarlat/inverse.htm

      // make a copy of the matrix (only the arrays, not of the elements)
      var A = matrix.concat();
      for (r = 0; r < rows; r++) {
        A[r] = A[r].concat();
      }

      // create an identity matrix which in the end will contain the
      // matrix inverse
      var B = math.eye(rows).valueOf();

      // loop over all columns, and perform row reductions
      for (var c = 0; c < cols; c++) {
        // element Acc should be non zero. if not, swap content
        // with one of the lower rows
        r = c;
        while (r < rows && A[r][c] == 0) {
          r++;
        }
        if (r == rows || A[r][c] == 0) {
          throw Error('Cannot calculate inverse, determinant is zero');
        }
        if (r != c) {
          temp = A[c]; A[c] = A[r]; A[r] = temp;
          temp = B[c]; B[c] = B[r]; B[r] = temp;
        }

        // eliminate non-zero values on the other rows at column c
        var Ac = A[c],
            Bc = B[c];
        for (r = 0; r < rows; r++) {
          var Ar = A[r],
              Br = B[r];
          if(r != c) {
            // eliminate value at column c and row r
            if (Ar[c] != 0) {
              f = math.divide(math.unary(Ar[c]), Ac[c]);

              // add (f * row c) to row r to eliminate the value
              // at column c
              for (s = c; s < cols; s++) {
                Ar[s] = math.add(Ar[s], math.multiply(f, Ac[s]));
              }
              for (s = 0; s < cols; s++) {
                Br[s] = math.add(Br[s],  math.multiply(f, Bc[s]));
              }
            }
          }
          else {
            // normalize value at Acc to 1,
            // divide each value on row r with the value at Acc
            f = Ac[c];
            for (s = c; s < cols; s++) {
              Ar[s] = math.divide(Ar[s], f);
            }
            for (s = 0; s < cols; s++) {
              Br[s] = math.divide(Br[s], f);
            }
          }
        }
      }
      return B;
    }
  }
};

},{"../../type/Matrix":269,"../../util/index":276}],220:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      array = util.array,

      isArray = Array.isArray;

  /**
   * Create a matrix filled with ones. The created matrix can have one or
   * multiple dimensions.
   *
   * Syntax:
   *
   *    math.ones(m)
   *    math.ones(m, n)
   *    math.ones([m, n])
   *    math.ones([m, n, p, ...])
   *
   * Examples:
   *
   *    math.ones(3);                   // returns [1, 1, 1]
   *    math.ones(3, 2);                // returns [[1, 1], [1, 1], [1, 1]]
   *
   *    var A = [[1, 2, 3], [4, 5, 6]];
   *    math.zeros(math.size(A));       // returns [[1, 1, 1], [1, 1, 1]]
   *
   * See also:
   *
   *    zeros, eye, size, range
   *
   * @param {...Number | Array} size    The size of each dimension of the matrix
   * @return {Array | Matrix | Number}  A matrix filled with ones
   */
  math.ones = function ones (size) {
    var args = collection.argsToArray(arguments);
    var asMatrix = (size instanceof Matrix) ? true :
        (isArray(size) ? false : (config.matrix === 'matrix'));

    if (args.length == 0) {
      // output an empty matrix
      return asMatrix ? new Matrix() : [];
    }
    else {
      // output an array or matrix

      // convert arguments from bignumber to numbers if needed
      var asBigNumber = false;
      args = args.map(function (value) {
        if (value instanceof BigNumber) {
          asBigNumber = true;
          return value.toNumber();
        } else {
          return value;
        }
      });

      // resize the matrix
      var res = [];
      var defaultValue = asBigNumber ? new BigNumber(1) : 1;
      res = array.resize(res, args, defaultValue);

      return asMatrix ? new Matrix(res) : res;
    }
  };
};

},{"../../type/Matrix":269,"../../type/collection":272,"../../util/index":276}],221:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString,
      isNumber = util.number.isNumber;

  /**
   * Create an array from a range.
   * By default, the range end is excluded. This can be customized by providing
   * an extra parameter `includeEnd`.
   *
   * Syntax:
   *
   *     range(str [, includeEnd])              // Create a range from a string,
   *                                            // where the string contains the
   *                                            // start, optional step, and end,
   *                                            // separated by a colon.
   *     range(start, end [, includeEnd])       // Create a range with start and
   *                                            // end and a step size of 1.
   *     range(start, end, step [, includeEnd]) // Create a range with start, step,
   *                                            // and end.
   *
   * Where:
   *
   * - `str: String`
   *   A string 'start:end' or 'start:step:end'
   * - `start: {Number | BigNumber}`
   *   Start of the range
   * - `end: Number | BigNumber`
   *   End of the range, excluded by default, included when parameter includeEnd=true
   * - `step: Number | BigNumber`
   *   Step size. Default value is 1.
   * - `includeEnd: boolean`
   *   Option to specify whether to include the end or not. False by default.
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.range(2, 6);        // [2, 3, 4, 5]
   *     math.range(2, -3, -1);   // [2, 1, 0, -1, -2]
   *     math.range('2:1:6');     // [2, 3, 4, 5]
   *     math.range(2, 6, true);  // [2, 3, 4, 5, 6]
   *
   * See also:
   *
   *     ones, zeros, size, subset
   *
   * @param {*} args   Parameters describing the ranges `start`, `end`, and optional `step`.
   * @return {Array | Matrix} range
   */
  math.range = function range(args) {
    var params = Array.prototype.slice.call(arguments),
        start,
        end,
        step,
        includeEnd = false;

    // read the includeEnd parameter
    if (isBoolean(params[params.length - 1])) {
      includeEnd = params.pop() ? true : false;
    }

    switch (params.length) {
      case 1:
        // range(str)
        // parse string into a range
        if (isString(params[0])) {
          var r = _parse(params[0]);
          if (!r){
            throw new SyntaxError('String "' + params[0] + '" is no valid range');
          }

          start = r.start;
          end = r.end;
          step = r.step;
        }
        else {
          throw new TypeError('Two or three numbers or a single string expected in function range');
        }
        break;

      case 2:
        // range(str, end)
        // range(start, end)
        start = params[0];
        end = params[1];
        step = 1;
        break;

      case 3:
        // range(start, end, step)
        start = params[0];
        end = params[1];
        step = params[2];
        break;

      case 4:
        throw new TypeError('Parameter includeEnd must be a boolean');

      default:
        throw new math.error.ArgumentsError('range', arguments.length, 2, 4);
    }

    // verify type of parameters
    if (!isNumber(start) && !(start instanceof BigNumber)) {
      throw new TypeError('Parameter start must be a number');
    }
    if (!isNumber(end) && !(end instanceof BigNumber)) {
      throw new TypeError('Parameter end must be a number');
    }
    if (!isNumber(step) && !(step instanceof BigNumber)) {
      throw new TypeError('Parameter step must be a number');
    }

    // go big
    if (start instanceof BigNumber || end instanceof BigNumber || step instanceof BigNumber) {
      // create a range with big numbers
      var asBigNumber = true;

      // convert start, end, step to BigNumber
      if (!(start instanceof BigNumber)) start = BigNumber.convert(start);
      if (!(end instanceof BigNumber))   end   = BigNumber.convert(end);
      if (!(step instanceof BigNumber))  step  = BigNumber.convert(step);

      if (!(start instanceof BigNumber) || !(end instanceof BigNumber) || !(step instanceof BigNumber)) {
        // not all values can be converted to big number :(
        // fall back to numbers
        asBigNumber = false;
        if (start instanceof BigNumber) start = start.toNumber();
        if (end instanceof BigNumber)   end   = end.toNumber();
        if (step instanceof BigNumber)  step  = step.toNumber();
      }
    }

    // generate the range
    var fn = asBigNumber ?
        (includeEnd ? _bigRangeInc : _bigRange) :
        (includeEnd ? _rangeInc    : _range);
    var array = fn(start, end, step);

    // return as array or matrix
    return (config.matrix === 'array') ? array : new Matrix(array);
  };

  /**
   * Create a range with numbers. End is excluded
   * @param {Number} start
   * @param {Number} end
   * @param {Number} step
   * @returns {Array} range
   * @private
   */
  function _range (start, end, step) {
    var array = [],
        x = start;
    if (step > 0) {
      while (x < end) {
        array.push(x);
        x += step;
      }
    }
    else if (step < 0) {
      while (x > end) {
        array.push(x);
        x += step;
      }
    }

    return array;
  }

  /**
   * Create a range with numbers. End is included
   * @param {Number} start
   * @param {Number} end
   * @param {Number} step
   * @returns {Array} range
   * @private
   */
  function _rangeInc (start, end, step) {
    var array = [],
        x = start;
    if (step > 0) {
      while (x <= end) {
        array.push(x);
        x += step;
      }
    }
    else if (step < 0) {
      while (x >= end) {
        array.push(x);
        x += step;
      }
    }

    return array;
  }

  /**
   * Create a range with big numbers. End is excluded
   * @param {BigNumber} start
   * @param {BigNumber} end
   * @param {BigNumber} step
   * @returns {Array} range
   * @private
   */
  function _bigRange (start, end, step) {
    var array = [],
        x = start.clone(),
        zero = new BigNumber(0);
    if (step.gt(zero)) {
      while (x.lt(end)) {
        array.push(x);
        x = x.plus(step);
      }
    }
    else if (step.lt(zero)) {
      while (x.gt(end)) {
        array.push(x);
        x = x.plus(step);
      }
    }

    return array;
  }

  /**
   * Create a range with big numbers. End is included
   * @param {BigNumber} start
   * @param {BigNumber} end
   * @param {BigNumber} step
   * @returns {Array} range
   * @private
   */
  function _bigRangeInc (start, end, step) {
    var array = [],
        x = start.clone(),
        zero = new BigNumber(0);
    if (step.gt(zero)) {
      while (x.lte(end)) {
        array.push(x);
        x = x.plus(step);
      }
    }
    else if (step.lt(zero)) {
      while (x.gte(end)) {
        array.push(x);
        x = x.plus(step);
      }
    }

    return array;
  }

  /**
   * Parse a string into a range,
   * The string contains the start, optional step, and end, separated by a colon.
   * If the string does not contain a valid range, null is returned.
   * For example str='0:2:11'.
   * @param {String} str
   * @return {Object | null} range Object containing properties start, end, step
   * @private
   */
  function _parse (str) {
    var args = str.split(':'),
        nums = null;

    if (config.number === 'bignumber') {
      // bignumber
      try {
        nums = args.map(function (arg) {
          return new BigNumber(arg);
        });
      }
      catch (err) {
        return null;
      }
    }
    else {
      // number
      nums = args.map(function (arg) {
        // use Number and not parseFloat as Number returns NaN on invalid garbage in the string
        return Number(arg);
      });

      var invalid = nums.some(function (num) {
        return isNaN(num);
      });
      if(invalid) {
        return null;
      }
    }

    switch (nums.length) {
      case 2:
        return {
          start: nums[0],
          end: nums[1],
          step: 1
        };

      case 3:
        return {
          start: nums[0],
          end: nums[2],
          step: nums[1]
        };

      default:
        return null;
    }
  }

};

},{"../../type/Matrix":269,"../../type/collection":272,"../../util/index":276}],222:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Matrix = require('../../type/Matrix'),

      array = util.array,
      clone = util.object.clone,
      string = util.string,
      isString = util.string.isString,
      isNumber = util.number.isNumber,
      isInteger = util.number.isInteger,
      isArray = array.isArray;

  /**
   * Resize a matrix
   *
   * Syntax:
   *
   *     math.resize(x, size)
   *     math.resize(x, size, defaultValue)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.resize([1, 2, 3, 4, 5], [3]); // returns Array  [1, 2, 3]
   *     math.resize([1, 2, 3], [5], 0);    // returns Array  [1, 2, 3, 0, 0]
   *     math.resize(2, [2, 3], 0);         // returns Matrix [[2, 0, 0], [0, 0, 0]]
   *     math.resize("hello", [8], "!");    // returns String 'hello!!!'
   *
   * See also:
   *
   *     size, squeeze, subset
   *
   * @param {* | Array | Matrix} x            Matrix to be resized
   * @param {Array | Matrix} size             One dimensional array with numbers
   * @param {Number | String} [defaultValue]  Undefined by default, except in
   *                                          case of a string, in that case
   *                                          defaultValue = ' '
   * @return {* | Array | Matrix} A resized clone of matrix `x`
   */
  math.resize = function resize (x, size, defaultValue) {
    if (arguments.length != 2 && arguments.length != 3) {
      throw new math.error.ArgumentsError('resize', arguments.length, 2, 3);
    }

    var asMatrix = (x instanceof Matrix) ? true : isArray(x) ? false : (config.matrix !== 'array');

    if (x instanceof Matrix) {
      x = x.valueOf(); // get Array
    }
    if (size instanceof Matrix) {
      size = size.valueOf(); // get Array
    }

    if (size.length && size[0] instanceof BigNumber) {
      // convert bignumbers to numbers
      size = size.map(function (value) {
        return (value instanceof BigNumber) ? value.toNumber() : value;
      });
    }

    if (isString(x)) {
      return _resizeString(x, size, defaultValue);
    }
    else {
      if (size.length == 0) {
        // output a scalar
        while (isArray(x)) {
          x = x[0];
        }

        return clone(x);
      }
      else {
        // output an array/matrix
        if (!isArray(x)) {
          x = [x];
        }
        x = clone(x);

        var res = array.resize(x, size, defaultValue);
        return asMatrix ? new Matrix(res) : res;
      }
    }
  };

  /**
   * Resize a string
   * @param {String} str
   * @param {Number[]} size
   * @param {string} defaultChar
   * @private
   */
  function _resizeString(str, size, defaultChar) {
    if (defaultChar !== undefined) {
      if (!isString(defaultChar) || defaultChar.length !== 1) {
        throw new TypeError('Single character expected as defaultValue');
      }
    }
    else {
      defaultChar = ' ';
    }

    if (size.length !== 1) {
      throw new math.error.DimensionError(size.length, 1);
    }
    var len = size[0];
    if (!isNumber(len) || !isInteger(len)) {
      throw new TypeError('Invalid size, must contain positive integers ' +
          '(size: ' + string.format(size) + ')');
    }

    if (str.length > len) {
      return str.substring(0, len);
    }
    else if (str.length < len) {
      var res = str;
      for (var i = 0, ii = len - str.length; i < ii; i++) {
        res += defaultChar;
      }
      return res;
    }
    else {
      return str;
    }
  }
};

},{"../../type/Matrix":269,"../../util/index":276}],223:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      Matrix = require('../../type/Matrix'),

      array = util.array,
      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit;

  /**
   * Calculate the size of a matrix or scalar.
   *
   * Syntax:
   *
   *     math.size(x)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.size(2.3);                  // returns []
   *     math.size('hello world');        // returns [11]
   *
   *     var A = [[1, 2, 3], [4, 5, 6]];
   *     math.size(A);                    // returns [2, 3]
   *     math.size(math.range(1,6));      // returns [5]
   *
   * See also:
   *
   *     resize, squeeze, subset
   *
   * @param {Boolean | Number | Complex | Unit | String | Array | Matrix} x  A matrix
   * @return {Array | Matrix} A vector with size of `x`.
   */
  math.size = function size (x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('size', arguments.length, 1);
    }

    var asArray = (config.matrix === 'array');

    if (isNumber(x) || isComplex(x) || isUnit(x) || isBoolean(x) ||
        x == null || x instanceof BigNumber) {
      return asArray ? [] : new Matrix([]);
    }

    if (isString(x)) {
      return asArray ? [x.length] : new Matrix([x.length]);
    }

    if (Array.isArray(x)) {
      return array.size(x);
    }

    if (x instanceof Matrix) {
      return new Matrix(x.size());
    }

    throw new math.error.UnsupportedTypeError('size', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Matrix":269,"../../type/Unit":271,"../../util/index":276}],224:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      Matrix = require('../../type/Matrix'),

      object = util.object,
      array = util.array,
      isArray = Array.isArray;

  /**
   * Squeeze a matrix, remove outer singleton dimensions from a matrix.
   *
   * Syntax:
   *
   *     math.squeeze(x)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.squeeze([3]);           // returns 3
   *     math.squeeze([[3]]);         // returns 3
   *
   *     var A = math.zeros(1, 3, 2); // returns [[[0, 0], [0, 0], [0, 0]]] (size 1x3x2)
   *     math.squeeze(A);             // returns [[0, 0], [0, 0], [0, 0]] (size 3x2)
   *
   *     // only outer dimensions will be squeezed, so the following B will be left as as
   *     var B = math.zeros(3, 1, 1); // returns [[[0]], [[0]], [[0]]] (size 3x1x1)
   *     math.squeeze(B);             // returns [[[0]], [[0]], [[0]]] (size 3x1x1)
   *
   * See also:
   *
   *     subset
   *
   * @param {Matrix | Array} x      Matrix to be squeezed
   * @return {Matrix | Array} Squeezed matrix
   */
  math.squeeze = function squeeze (x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('squeeze', arguments.length, 1);
    }

    if (isArray(x)) {
      return array.squeeze(object.clone(x));
    }
    else if (x instanceof Matrix) {
      var res = array.squeeze(x.toArray());
      return isArray(res) ? new Matrix(res) : res;
    }
    else {
      // scalar
      return object.clone(x);
    }
  };
};

},{"../../type/Matrix":269,"../../util/index":276}],225:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      Matrix = require('../../type/Matrix'),
      Index = require('../../type/Index'),

      array = util.array,
      isString = util.string.isString,
      isArray = Array.isArray;

  /**
   * Get or set a subset of a matrix or string.
   *
   * Syntax:
   *     math.subset(value, index)                                // retrieve a subset
   *     math.subset(value, index, replacement [, defaultValue])  // replace a subset
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     // get a subset
   *     var d = [[1, 2], [3, 4]];
   *     math.subset(d, math.index(1, 0));        // returns 3
   *     math.subset(d, math.index([0, 2], 1));   // returns [[2], [4]]
   *
   *     // replace a subset
   *     var e = [];
   *     var f = math.subset(e, math.index(0, [0, 2]), [5, 6]);  // f = [[5, 6]]
   *     var g = math.subset(f, math.index(1, 1), 7, 0);         // g = [[5, 6], [0, 7]]
   *
   * See also:
   *
   *     size, resize, squeeze, index
   *
   * @param {Array | Matrix | String} matrix  An array, matrix, or string
   * @param {Index} index                     An index containing ranges for each
   *                                          dimension
   * @param {*} [replacement]                 An array, matrix, or scalar.
   *                                          If provided, the subset is replaced with replacement.
   *                                          If not provided, the subset is returned
   * @param {*} [defaultValue=undefined]      Default value, filled in on new entries when
   *                                          the matrix is resized. If not provided,
   *                                          new matrix elements will be left undefined.
   * @return {Array | Matrix | String} Either the retrieved subset or the updated matrix.
   */
  math.subset = function subset (matrix, index, replacement, defaultValue) {
    switch (arguments.length) {
      case 2: // get subset
        return _getSubset(arguments[0], arguments[1]);

      // intentional fall through
      case 3: // set subset
      case 4: // set subset with default value
        return _setSubset(arguments[0], arguments[1], arguments[2], arguments[3]);

      default: // wrong number of arguments
        throw new math.error.ArgumentsError('subset', arguments.length, 2, 4);
    }
  };

  /**
   * Retrieve a subset of an value such as an Array, Matrix, or String
   * @param {Array | Matrix | String} value Object from which to get a subset
   * @param {Index} index                   An index containing ranges for each
   *                                        dimension
   * @returns {Array | Matrix | *} subset
   * @private
   */
  function _getSubset(value, index) {
    var m, subset;

    if (isArray(value)) {
      m = new Matrix(value);
      subset = m.subset(index);
      return subset.valueOf();
    }
    else if (value instanceof Matrix) {
      return value.subset(index);
    }
    else if (isString(value)) {
      return _getSubstring(value, index);
    }
    else {
      throw new math.error.UnsupportedTypeError('subset', math['typeof'](value));
    }
  }

  /**
   * Retrieve a subset of a string
   * @param {String} str            String from which to get a substring
   * @param {Index} index           An index containing ranges for each dimension
   * @returns {string} substring
   * @private
   */
  function _getSubstring(str, index) {
    if (!(index instanceof Index)) {
      // TODO: better error message
      throw new TypeError('Index expected');
    }
    if (index.size().length != 1) {
      throw new math.error.DimensionError(index.size().length, 1);
    }

    var range = index.range(0);

    var substr = '';
    var strLen = str.length;
    range.forEach(function (v) {
      array.validateIndex(v, strLen);
      substr += str.charAt(v);
    });

    return substr;
  }

  /**
   * Replace a subset in an value such as an Array, Matrix, or String
   * @param {Array | Matrix | String} value Object to be replaced
   * @param {Index} index                   An index containing ranges for each
   *                                        dimension
   * @param {Array | Matrix | *} replacement
   * @param {*} [defaultValue]        Default value, filled in on new entries when
   *                                  the matrix is resized. If not provided,
   *                                  new matrix elements will be left undefined.
   * @returns {*} result
   * @private
   */
  function _setSubset(value, index, replacement, defaultValue) {
    var m;

    if (isArray(value)) {
      m = new Matrix(math.clone(value));
      m.subset(index, replacement, defaultValue);
      return m.valueOf();
    }
    else if (value instanceof Matrix) {
      return value.clone().subset(index, replacement, defaultValue);
    }
    else if (isString(value)) {
      return _setSubstring(value, index, replacement, defaultValue);
    }
    else {
      throw new math.error.UnsupportedTypeError('subset', math['typeof'](value));
    }
  }

  /**
   * Replace a substring in a string
   * @param {String} str            String to be replaced
   * @param {Index} index           An index containing ranges for each dimension
   * @param {String} replacement    Replacement string
   * @param {String} [defaultValue] Default value to be uses when resizing
   *                                the string. is ' ' by default
   * @returns {string} result
   * @private
   */
  function _setSubstring(str, index, replacement, defaultValue) {
    if (!(index instanceof Index)) {
      // TODO: better error message
      throw new TypeError('Index expected');
    }
    if (index.size().length != 1) {
      throw new math.error.DimensionError(index.size().length, 1);
    }
    if (defaultValue !== undefined) {
      if (!isString(defaultValue) || defaultValue.length !== 1) {
        throw new TypeError('Single character expected as defaultValue');
      }
    }
    else {
      defaultValue = ' ';
    }

    var range = index.range(0);
    var len = range.size()[0];

    if (len != replacement.length) {
      throw new math.error.DimensionError(range.size()[0], replacement.length);
    }

    // copy the string into an array with characters
    var strLen = str.length;
    var chars = [];
    for (var i = 0; i < strLen; i++) {
      chars[i] = str.charAt(i);
    }

    range.forEach(function (v, i) {
      array.validateIndex(v);
      chars[v] = replacement.charAt(i);
    });

    // initialize undefined characters with a space
    if (chars.length > strLen) {
      for (i = strLen - 1, len = chars.length; i < len; i++) {
        if (!chars[i]) {
          chars[i] = defaultValue;
        }
      }
    }

    return chars.join('');
  }
};

},{"../../type/Index":268,"../../type/Matrix":269,"../../util/index":276}],226:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      Matrix = require('../../type/Matrix'),

      object = util.object,
      string = util.string;

  /**
   * Transpose a matrix. All values of the matrix are reflected over its
   * main diagonal. Only two dimensional matrices are supported.
   *
   * Syntax:
   *
   *     math.transpose(x)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     var A = [[1, 2, 3], [4, 5, 6]];
   *     math.transpose(A);               // returns [[1, 4], [2, 5], [3, 6]]
   *
   * See also:
   *
   *     diag, inv, subset, squeeze
   *
   * @param {Array | Matrix} x  Matrix to be transposed
   * @return {Array | Matrix}   The transposed matrix
   */
  math.transpose = function transpose (x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('transpose', arguments.length, 1);
    }

    var size = math.size(x).valueOf();
    switch (size.length) {
      case 0:
        // scalar
        return object.clone(x);

      case 1:
        // vector
        return object.clone(x);

      case 2:
        // two dimensional array
        var rows = size[1],
            cols = size[0],
            asMatrix = (x instanceof Matrix),
            data = x.valueOf(),
            transposed = [],
            transposedRow,
            clone = object.clone;

        if (rows === 0) {
          // whoops
          throw new RangeError('Cannot transpose a 2D matrix with no rows' +
              '(size: ' + string.format(size) + ')');
        }

        for (var r = 0; r < rows; r++) {
          transposedRow = transposed[r] = [];
          for (var c = 0; c < cols; c++) {
            transposedRow[c] = clone(data[c][r]);
          }
        }

        return asMatrix ? new Matrix(transposed) : transposed;

      default:
        // multi dimensional array
        throw new RangeError('Matrix must be two dimensional ' +
            '(size: ' + string.format(size) + ')');
    }
  };
};

},{"../../type/Matrix":269,"../../util/index":276}],227:[function(require,module,exports){
module.exports = function (math, config) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      array = util.array,
      isArray = Array.isArray;

  /**
   * Create a matrix filled with zeros. The created matrix can have one or
   * multiple dimensions.
   *
   * Syntax:
   *
   *    math.zeros(m)
   *    math.zeros(m, n)
   *    math.zeros([m, n])
   *    math.zeros([m, n, p, ...])
   *
   * Examples:
   *
   *    math.zeros(3);                  // returns [0, 0, 0]
   *    math.zeros(3, 2);               // returns [[0, 0], [0, 0], [0, 0]]
   *
   *    var A = [[1, 2, 3], [4, 5, 6]];
   *    math.zeros(math.size(A));       // returns [[0, 0, 0], [0, 0, 0]]
   *
   * See also:
   *
   *    ones, eye, size, range
   *
   * @param {...Number | Array} size    The size of each dimension of the matrix
   * @return {Array | Matrix | Number}  A matrix filled with zeros
   */
  math.zeros = function zeros (size) {
    var args = collection.argsToArray(arguments);
    var asMatrix = (size instanceof Matrix) ? true :
        (isArray(size) ? false : (config.matrix === 'matrix'));

    if (args.length == 0) {
      // output an empty matrix
      return asMatrix ? new Matrix() : [];
    }
    else {
      // output an array or matrix

      // convert arguments from bignumber to numbers if needed
      var asBigNumber = false;
      args = args.map(function (value) {
        if (value instanceof BigNumber) {
          asBigNumber = true;
          return value.toNumber();
        } else {
          return value;
        }
      });

      // resize the matrix
      var res = [];
      var defaultValue = asBigNumber ? new BigNumber(0) : 0;
      res = array.resize(res, args, defaultValue);

      return asMatrix ? new Matrix(res) : res;
    }
  };
};

},{"../../type/Matrix":269,"../../type/collection":272,"../../util/index":276}],228:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isInteger = util.number.isInteger;

  /**
   * Compute the number of ways of picking `k` unordered outcomes from `n`
   * possibilities.
   *
   * Combinations only takes integer arguments.
   * The following condition must be enforced: k <= n.
   *
   * Syntax:
   *
   *     math.combinations(n, k)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.combinations(7, 5); // returns 21
   *
   * See also:
   *
   *    permutations, factorial
   *
   * @param {Number | BigNumber} n    Total number of objects in the set
   * @param {Number | BigNumber} k    Number of objects in the subset
   * @return {Number | BigNumber}     Number of possible combinations.
   */
  math.combinations = function combinations (n, k) {
    var max, result, i,ii;

    var arity = arguments.length;
    if (arity != 2) {
      throw new math.error.ArgumentsError('combinations', arguments.length, 2);
    }

    if (isNumber(n)) {
      if (!isInteger(n) || n < 0) {
        throw new TypeError('Positive integer value enpected in function combinations');
      }
      if (k > n) {
        throw new TypeError('k must be less than or equal to n');
      }

      max = Math.max(k, n - k);
      result = 1;
      for (i = 1; i <= n - max; i++) {
        result = result * (max + i) / i;
      }
      return result;
    }

    if (n instanceof BigNumber) {
      // make sure k is a BigNumber as well
      // not all numbers can be converted to BigNumber
      k = BigNumber.convert(k);

      if (!(k instanceof BigNumber) || !isPositiveInteger(n) || !isPositiveInteger(k)) {
        throw new TypeError('Positive integer value expected in function combinations');
      }
      if (k.gt(n)) {
        throw new TypeError('k must be less than n in function combinations');
      }

      max = n.minus(k);
      if (k.lt(max)) max = k;
      result = new BigNumber(1);
      for (i = new BigNumber(1), ii = n.minus(max); i.lte(ii); i = i.plus(1)) {
        result = result.times(max.plus(i)).dividedBy(i);
      }
      return result;
    }

    throw new math.error.UnsupportedTypeError('combinations', math['typeof'](n));
  };

  /**
   * Test whether BigNumber n is a positive integer
   * @param {BigNumber} n
   * @returns {boolean} isPositiveInteger
   */
  var isPositiveInteger = function(n) {
    return n.isInteger() && n.gte(0);
  };
};

},{"../../type/collection":272,"../../util/index":276}],229:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isInteger = util.number.isInteger,
      isCollection = collection.isCollection;

  /**
   * Compute the factorial of a value
   *
   * Factorial only supports an integer value as argument.
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.factorial(n)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.factorial(5);    // returns 120
   *    math.factorial(3);    // returns 6
   *
   * See also:
   *
   *    combinations, permutations
   *
   * @param {Number | BigNumber | Array | Matrix} n   An integer number
   * @return {Number | BigNumber | Array | Matrix}    The factorial of `n`
   */
  math.factorial = function factorial (n) {
    var value, res;

    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('factorial', arguments.length, 1);
    }

    if (isNumber(n)) {
      if (!isInteger(n) || n < 0) {
        throw new TypeError('Positive integer value expected in function factorial');
      }

      value = n - 1;
      res = n;
      while (value > 1) {
        res *= value;
        value--;
      }

      if (res == 0) {
        res = 1;        // 0! is per definition 1
      }

      return res;
    }

    if (n instanceof BigNumber) {
      if (!(isPositiveInteger(n))) {
        throw new TypeError('Positive integer value expected in function factorial');
      }

      var one = new BigNumber(1);

      value = n.minus(one);
      res = n;
      while (value.gt(one)) {
        res = res.times(value);
        value = value.minus(one);
      }

      if (res.equals(0)) {
        res = one;        // 0! is per definition 1
      }

      return res;
    }

    if (isBoolean(n)) {
      return 1; // factorial(1) = 1, factorial(0) = 1
    }

    if (isCollection(n)) {
      return collection.deepMap(n, factorial);
    }

    throw new math.error.UnsupportedTypeError('factorial', math['typeof'](n));
  };

  /**
   * Test whether BigNumber n is a positive integer
   * @param {BigNumber} n
   * @returns {boolean} isPositiveInteger
   */
  var isPositiveInteger = function(n) {
    return n.isInteger() && n.gte(0);
  };
};

},{"../../type/collection":272,"../../util/index":276}],230:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,

      isNumber = util.number.isNumber,
      isInteger = util.number.isInteger;

  /**
   * Compute the number of ways of obtaining an ordered subset of `k` elements
   * from a set of `n` elements.
   *
   * Permutations only takes integer arguments.
   * The following condition must be enforced: k <= n.
   *
   * Syntax:
   *
   *     math.permutations(n)
   *     math.permutations(n, k)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.permutations(5);     // 120
   *    math.permutations(5, 3);  // 60
   *
   * See also:
   *
   *    combinations, factorial
   *
   * @param {Number | BigNumber} n  The number of objects in total
   * @param {Number | BigNumber} k  The number of objects in the subset
   * @return {Number | BigNumber}   The number of permutations
   */
  math.permutations = function permutations (n, k) {
    var result, i;

    var arity = arguments.length;
    if (arity > 2) {
      throw new math.error.ArgumentsError('permutations', arguments.length, 2);
    }

    if (isNumber(n)) {
      if (!isInteger(n) || n < 0) {
        throw new TypeError('Positive integer value expected in function permutations');
      }
      
      // Permute n objects
      if (arity == 1) {
        return math.factorial(n);
      }
      
      // Permute n objects, k at a time
      if (arity == 2) {
        if (isNumber(k)) {
          if (!isInteger(k) || k < 0) {
            throw new TypeError('Positive integer value expected in function permutations');
          }
          if (k > n) {
            throw new TypeError('second argument k must be less than or equal to first argument n');
          }

          result = 1;
          for (i = n - k + 1; i <= n; i++) {
            result = result * i;
          }
          return result;
        }
      }
    }

    if (n instanceof BigNumber) {
      if (k === undefined && isPositiveInteger(n)) {
        return math.factorial(n);
      }

      // make sure k is a BigNumber as well
      // not all numbers can be converted to BigNumber
      k = BigNumber.convert(k);

      if (!(k instanceof BigNumber) || !isPositiveInteger(n) || !isPositiveInteger(k)) {
        throw new TypeError('Positive integer value expected in function permutations');
      }
      if (k.gt(n)) {
        throw new TypeError('second argument k must be less than or equal to first argument n');
      }

      result = new BigNumber(1);
      for (i = n.minus(k).plus(1); i.lte(n); i = i.plus(1)) {
        result = result.times(i);
      }
      return result;
    }

    throw new math.error.UnsupportedTypeError('permutations', math['typeof'](n));
  };

  /**
   * Test whether BigNumber n is a positive integer
   * @param {BigNumber} n
   * @returns {boolean} isPositiveInteger
   */
  var isPositiveInteger = function(n) {
    return n.isInteger() && n.gte(0);
  };
};

},{"../../util/index":276}],231:[function(require,module,exports){
module.exports = function (math, config) {
  var Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection');

  // TODO: implement BigNumber support for random

  /**
   * Return a random number between `min` and `max` using a uniform distribution.
   *
   * Syntax:
   *
   *     math.random()          // generate a random number between 0 and 1
   *     math.random(max)       // generate a random number between 0 and max
   *     math.random(min, max)  // generate a random number between min and max
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.random();       // returns a random number between 0 and 1
   *     math.random(100);    // returns a random number between 0 and 100
   *     math.random(30, 40); // returns a random number between 30 and 40
   *
   * @param {Number} [min]  Minimum boundary for the random value
   * @param {Number} [max]  Maximum boundary for the random value
   * @return {Number} A random number
   */

  // TODO: improve structure of random.js, split it in one file per function

  // Each distribution is a function that takes no argument and when called returns
  // a number between 0 and 1.
  var distributions = {

    uniform: function() {
      return Math.random;
    },

    // Implementation of normal distribution using Box-Muller transform
    // ref : http://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
    // We take : mean = 0.5, standard deviation = 1/6
    // so that 99.7% values are in [0, 1].
    normal: function() {
      return function() {
        var u1, u2,
            picked = -1;
        // We reject values outside of the interval [0, 1]
        // TODO: check if it is ok to do that?
        while (picked < 0 || picked > 1) {
          u1 = Math.random();
          u2 = Math.random();
          picked = 1/6 * Math.pow(-2 * Math.log(u1), 0.5) * Math.cos(2 * Math.PI * u2) + 0.5;
        }
        return picked;
      }
    }
  };

  /**
   * Create a distribution object.
   * @param {String} name           Name of a distribution.
   *                                Choose from 'uniform', 'normal'.
   * @return {Object} distribution  A distribution object containing functions:
   *                                    random([size, min, max])
   *                                    randomInt([min, max])
   *                                    pickRandom(array)
   */
  math.distribution = function(name) {
    if (!distributions.hasOwnProperty(name))
      throw new Error('unknown distribution ' + name);

    var args = Array.prototype.slice.call(arguments, 1),
        distribution = distributions[name].apply(this, args);

    return (function(distribution) {

      // This is the public API for all distributions
      var randFunctions = {

        random: function(arg1, arg2, arg3) {
          var size, min, max;
          if (arguments.length > 3) {
            throw new math.error.ArgumentsError('random', arguments.length, 0, 3);

          // `random(max)` or `random(size)`
          } else if (arguments.length === 1) {
            if (Array.isArray(arg1))
              size = arg1;
            else
              max = arg1;
          // `random(min, max)` or `random(size, max)`
          } else if (arguments.length === 2) {
            if (Array.isArray(arg1))
              size = arg1;
            else {
              min = arg1;
              max = arg2;
            }
          // `random(size, min, max)`
          } else {
            size = arg1;
            min = arg2;
            max = arg3;
          }

          if (max === undefined) max = 1;
          if (min === undefined) min = 0;
          if (size !== undefined) {
            var res = _randomDataForMatrix(size, min, max, _random);
            return (config.matrix === 'array') ? res : new Matrix(res);
          }
          else return _random(min, max);
        },

        randomInt: function(arg1, arg2, arg3) {
          var size, min, max;
          if (arguments.length > 3 || arguments.length < 1)
            throw new math.error.ArgumentsError('randomInt', arguments.length, 1, 3);

          // `randomInt(max)`
          else if (arguments.length === 1) max = arg1;
          // `randomInt(min, max)` or `randomInt(size, max)`
          else if (arguments.length === 2) {
            if (Object.prototype.toString.call(arg1) === '[object Array]')
              size = arg1;
            else {
              min = arg1;
              max = arg2;
            }
          // `randomInt(size, min, max)`
          } else {
            size = arg1;
            min = arg2;
            max = arg3;
          }

          if (min === undefined) min = 0;
          if (size !== undefined) {
            var res = _randomDataForMatrix(size, min, max, _randomInt);
            return (config.matrix === 'array') ? res : new Matrix(res);
          }
          else return _randomInt(min, max);
        },

        pickRandom: function(possibles) {
          if (arguments.length !== 1) {
            throw new math.error.ArgumentsError('pickRandom', arguments.length, 1);
          }
          if (!Array.isArray(possibles)) {
            throw new math.error.UnsupportedTypeError('pickRandom', math['typeof'](possibles));
          }

          // TODO: add support for matrices
          return possibles[Math.floor(Math.random() * possibles.length)];
        }

      };

      var _random = function(min, max) {
        return min + distribution() * (max - min);
      };

      var _randomInt = function(min, max) {
        return Math.floor(min + distribution() * (max - min));
      };

      // This is a function for generating a random matrix recursively.
      var _randomDataForMatrix = function(size, min, max, randFunc) {
        var data = [], length, i;
        size = size.slice(0);

        if (size.length > 1) {
          for (i = 0, length = size.shift(); i < length; i++)
            data.push(_randomDataForMatrix(size, min, max, randFunc));
        } else {
          for (i = 0, length = size.shift(); i < length; i++)
            data.push(randFunc(min, max));
        }

        return data;
      };

      return randFunctions;

    })(distribution);

  };

  // Default random functions use uniform distribution
  // TODO: put random functions in separate files?
  var uniformRandFunctions = math.distribution('uniform');
  math.random = uniformRandFunctions.random;
  math.randomInt = uniformRandFunctions.randomInt;
  math.pickRandom = uniformRandFunctions.pickRandom;
};

},{"../../type/Matrix":269,"../../type/collection":272}],232:[function(require,module,exports){
module.exports = function (math) {
  var Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      isCollection = collection.isCollection;

  /**
   * Compute the maximum value of a matrix or a  list with values.
   * In case of a multi dimensional array, the maximum of the flattened array
   * will be calculated. When `dim` is provided, the maximum over the selected
   * dimension will be calculated. Parameter `dim` is zero-based.
   *
   * Syntax:
   *
   *     math.max(a, b, c, ...)
   *     math.max(A)
   *     math.max(A, dim)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.max(2, 1, 4, 3);                  // returns 4
   *     math.max([2, 1, 4, 3]);                // returns 4
   *
   *     // maximum over a specified dimension (zero-based)
   *     math.max([[2, 5], [4, 3], [1, 7]], 0); // returns [4, 7]
   *     math.max([[2, 5], [4, 3]], [1, 7], 1); // returns [5, 4, 7]
   *
   *     math.max(2.7, 7.1, -4.5, 2.0, 4.1);    // returns 7.1
   *     math.min(2.7, 7.1, -4.5, 2.0, 4.1);    // returns -4.5
   *
   * See also:
   *
   *    mean, median, min, prod, std, sum, var
   *
   * @param {... *} args  A single matrix or or multiple scalar values
   * @return {*} The maximum value
   */
  math.max = function max(args) {
    if (arguments.length == 0) {
      throw new SyntaxError('Function max requires one or more parameters (0 provided)');
    }

    if (isCollection(args)) {
      if (arguments.length == 1) {
        // max([a, b, c, d, ...])
        return _max(args);
      }
      else if (arguments.length == 2) {
        // max([a, b, c, d, ...], dim)
        return collection.reduce(arguments[0], arguments[1], _getLarger);
      }
      else {
        throw new SyntaxError('Wrong number of parameters');
      }
    }
    else {
      // max(a, b, c, d, ...)
      return _max(arguments);
    }
  };

  function _getLarger(x, y){
	  return math.larger(x, y) ? x : y;
  }

  /**
   * Recursively calculate the maximum value in an n-dimensional array
   * @param {Array} array
   * @return {Number} max
   * @private
   */
  function _max(array) {
    var max = undefined;

    collection.deepForEach(array, function (value) {
      if (max === undefined || math.larger(value, max)) {
        max = value;
      }
    });

    if (max === undefined) {
      throw new Error('Cannot calculate max of an empty array');
    }

    return max;
  }
};

},{"../../type/Matrix":269,"../../type/collection":272}],233:[function(require,module,exports){
module.exports = function (math) {
  var Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      isCollection = collection.isCollection,

      size = require('../../util/array').size;

  /**
   * Compute the mean value of matrix or a list with values.
   * In case of a multi dimensional array, the mean of the flattened array
   * will be calculated. When `dim` is provided, the maximum over the selected
   * dimension will be calculated. Parameter `dim` is zero-based.
   *
   * Syntax:
   *
   *     mean.mean(a, b, c, ...)
   *     mean.mean(A)
   *     mean.mean(A, dim)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.mean(2, 1, 4, 3);                     // returns 2.5
   *     math.mean([1, 2.7, 3.2, 4]);               // returns 2.725
   *
   *     math.mean([[2, 5], [6, 3], [1, 7]], 0);    // returns [3, 5]
   *     math.mean([[2, 5], [6, 3], [1, 7]], 1);    // returns [3.5, 4.5, 4]
   *
   * See also:
   *
   *     median, min, max, sum, prod, std, var
   *
   * @param {... *} args  A single matrix or or multiple scalar values
   * @return {*} The mean of all values
   */
  math.mean = function mean(args) {
    if (arguments.length == 0) {
      throw new SyntaxError('Function mean requires one or more parameters (0 provided)');
    }

    if (isCollection(args)) {
      if (arguments.length == 1) {
        // mean([a, b, c, d, ...])
        return _mean(args);
      }
      else if (arguments.length == 2) {
        // mean([a, b, c, d, ...], dim)
        return _nmean(arguments[0], arguments[1]);
      }
      else {
        throw new SyntaxError('Wrong number of parameters');
      }
    }
    else {
      // mean(a, b, c, d, ...)
      return _mean(arguments);
    }
  };

  /**
   * Calculate the mean value in an n-dimensional array, returning a
   * n-1 dimensional array
   * @param {Array} array
   * @param {Number} dim
   * @return {Number} mean
   * @private
   */
  function _nmean(array, dim){
	  var sum;
	  sum = collection.reduce(array, dim, math.add);
	  return math.divide(sum, size(array)[dim]);
  }

  /**
   * Recursively calculate the mean value in an n-dimensional array
   * @param {Array} array
   * @return {Number} mean
   * @private
   */
  function _mean(array) {
    var sum = 0;
    var num = 0;

    collection.deepForEach(array, function (value) {
      sum = math.add(sum, value);
      num++;
    });

    if (num === 0) {
      throw new Error('Cannot calculate mean of an empty array');
    }

    return math.divide(sum, num);
  }
};

},{"../../type/Matrix":269,"../../type/collection":272,"../../util/array":273}],234:[function(require,module,exports){
module.exports = function (math) {
  var Matrix = require('../../type/Matrix'),
      Unit = require('../../type/Unit'),
      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isNumber = require('../../util/number').isNumber,
      isCollection = collection.isCollection,

      flatten = require('../../util/array').flatten;

  /**
   * Compute the median of a matrix or a list with values. The values are
   * sorted and the middle value is returned. In case of an even number of
   * values, the average of the two middle values is returned.
   * Supported types of values are: Number, BigNumber, Unit
   *
   * In case of a (multi dimensional) array or matrix, the median of all
   * elements will be calculated.
   *
   * Syntax:
   *
   *     mean.median(a, b, c, ...)
   *     mean.median(A)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.median(5, 2, 7);        // returns 5
   *     math.median([3, -1, 5, 7]);  // returns 4
   *
   * See also:
   *
   *     mean, min, max, sum, prod, std, var
   *
   * @param {... *} args  A single matrix or or multiple scalar values
   * @return {*} The median
   */
  math.median = function median(args) {
    if (arguments.length == 0) {
      throw new SyntaxError('Function median requires one or more parameters (0 provided)');
    }

    if (isCollection(args)) {
      if (arguments.length == 1) {
        // median([a, b, c, d, ...])
        return _median(args.valueOf());
      }
      else if (arguments.length == 2) {
        // median([a, b, c, d, ...], dim)
        // TODO: implement median(A, dim)
        throw new Error('median(A, dim) is not yet supported');
        //return collection.reduce(arguments[0], arguments[1], ...);
      }
      else {
        throw new SyntaxError('Wrong number of parameters');
      }
    }
    else {
      // median(a, b, c, d, ...)
      return _median(Array.prototype.slice.call(arguments));
    }
  };

  /**
   * Recursively calculate the median of an n-dimensional array
   * @param {Array} array
   * @return {Number} median
   * @private
   */
  function _median(array) {
    var flat = flatten(array);

    flat.sort(math.compare);

    var num = flat.length;

    if (num == 0) {
      throw new Error('Cannot calculate median of an empty array');
    }

    if (num % 2 == 0) {
      // even: return the average of the two middle values
      var left = flat[num / 2 - 1];
      var right = flat[num / 2];

      if (!isNumber(left) && !(left instanceof BigNumber) && !(left instanceof Unit)) {
        throw new math.error.UnsupportedTypeError('median', math['typeof'](left));
      }
      if (!isNumber(right) && !(right instanceof BigNumber) && !(right instanceof Unit)) {
        throw new math.error.UnsupportedTypeError('median', math['typeof'](right));
      }

      return math.divide(math.add(left, right), 2);
    }
    else {
      // odd: return the middle value
      var middle = flat[(num - 1) / 2];

      if (!isNumber(middle) && !(middle instanceof BigNumber) && !(middle instanceof Unit)) {
        throw new math.error.UnsupportedTypeError('median', math['typeof'](middle));
      }

      return middle;
    }
  }
};

},{"../../type/Matrix":269,"../../type/Unit":271,"../../type/collection":272,"../../util/array":273,"../../util/number":278}],235:[function(require,module,exports){
module.exports = function (math) {
  var Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      isCollection = collection.isCollection;

  /**
   * Compute the maximum value of a matrix or a  list of values.
   * In case of a multi dimensional array, the maximum of the flattened array
   * will be calculated. When `dim` is provided, the maximum over the selected
   * dimension will be calculated. Parameter `dim` is zero-based.
   *
   * Syntax:
   *
   *     math.min(a, b, c, ...)
   *     math.min(A)
   *     math.min(A, dim)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.min(2, 1, 4, 3);                  // returns 1
   *     math.min([2, 1, 4, 3]);                // returns 1
   *
   *     // maximum over a specified dimension (zero-based)
   *     math.min([[2, 5], [4, 3], [1, 7]], 0); // returns [1, 3]
   *     math.min([[2, 5], [4, 3], [1, 7]], 1); // returns [2, 3, 1]
   *
   *     math.max(2.7, 7.1, -4.5, 2.0, 4.1);    // returns 7.1
   *     math.min(2.7, 7.1, -4.5, 2.0, 4.1);    // returns -4.5
   *
   * See also:
   *
   *    mean, median, max, prod, std, sum, var
   *
   * @param {... *} args  A single matrix or or multiple scalar values
   * @return {*} The minimum value
   */
  math.min = function min(args) {
    if (arguments.length == 0) {
      throw new SyntaxError('Function min requires one or more parameters (0 provided)');
    }

    if (isCollection(args)) {
      if (arguments.length == 1) {
        // min([a, b, c, d, ...])
        return _min(args);
      }
      else if (arguments.length == 2) {
        // min([a, b, c, d, ...], dim)
        return collection.reduce(arguments[0], arguments[1], _getSmaller);
      }
      else {
        throw new SyntaxError('Wrong number of parameters');
      }
    }
    else {
      // min(a, b, c, d, ...)
      return _min(arguments);
    }
  };

  function _getSmaller(x, y){
	  return math.smaller(x, y)  ? x : y;
  }

  /**
   * Recursively calculate the minimum value in an n-dimensional array
   * @param {Array} array
   * @return {Number} min
   * @private
   */
  function _min(array) {
    var min = undefined;

    collection.deepForEach(array, function (value) {
      if (min === undefined || math.smaller(value, min)) {
        min = value;
      }
    });

    if (min === undefined) {
      throw new Error('Cannot calculate min of an empty array');
    }

    return min;
  }
};

},{"../../type/Matrix":269,"../../type/collection":272}],236:[function(require,module,exports){
module.exports = function (math) {
  var Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      isCollection = collection.isCollection;

  /**
   * Compute the product of a matrix or a list with values.
   * In case of a (multi dimensional) array or matrix, the sum of all
   * elements will be calculated.
   *
   * Syntax:
   *
   *     math.prod(a, b, c, ...)
   *     math.prod(A)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.multiply(2, 3);           // returns 6
   *     math.prod(2, 3);               // returns 6
   *     math.prod(2, 3, 4);            // returns 24
   *     math.prod([2, 3, 4]);          // returns 24
   *     math.prod([[2, 5], [4, 3]]);   // returns 120
   *
   * See also:
   *
   *    mean, median, min, max, sum, std, var
   *
   * @param {... *} args  A single matrix or or multiple scalar values
   * @return {*} The product of all values
   */
  math.prod = function prod(args) {
    if (arguments.length == 0) {
      throw new SyntaxError('Function prod requires one or more parameters (0 provided)');
    }

    if (isCollection(args)) {
      if (arguments.length == 1) {
        // prod([a, b, c, d, ...])
        return _prod(args);
      }
      else if (arguments.length == 2) {
        // prod([a, b, c, d, ...], dim)
        // TODO: implement prod(A, dim)
        throw new Error('prod(A, dim) is not yet supported');
        //return collection.reduce(arguments[0], arguments[1], math.prod);
      }
      else {
        throw new SyntaxError('Wrong number of parameters');
      }
    }
    else {
      // prod(a, b, c, d, ...)
      return _prod(arguments);
    }
  };

  /**
   * Recursively calculate the product of an n-dimensional array
   * @param {Array} array
   * @return {Number} prod
   * @private
   */
  function _prod(array) {
    var prod = undefined;

    collection.deepForEach(array, function (value) {
      prod = (prod === undefined) ? value : math.multiply(prod, value);
    });

    if (prod === undefined) {
      throw new Error('Cannot calculate prod of an empty array');
    }

    return prod;
  }
};

},{"../../type/Matrix":269,"../../type/collection":272}],237:[function(require,module,exports){
module.exports = function (math) {


  /**
   * Compute the standard deviation of a matrix or a  list with values.
   * The standard deviations is defined as the square root of the variance:
   * `std(A) = sqrt(var(A))`.
   * In case of a (multi dimensional) array or matrix, the standard deviation
   * over all elements will be calculated.
   *
   * Optionally, the type of normalization can be specified as second
   * parameter. The parameter `normalization` can be one of the following values:
   *
   * - 'unbiased' (default) The sum of squared errors is divided by (n - 1)
   * - 'uncorrected'        The sum of squared errors is divided by n
   * - 'biased'             The sum of squared errors is divided by (n + 1)
   *
   * Syntax:
   *
   *     math.std(a, b, c, ...)
   *     math.std(A)
   *     math.std(A, normalization)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.std(2, 4, 6);                     // returns 2
   *     math.std([2, 4, 6, 8]);                // returns 2.581988897471611
   *     math.std([2, 4, 6, 8], 'uncorrected'); // returns 2.23606797749979
   *     math.std([2, 4, 6, 8], 'biased');      // returns 2
   *
   *     math.std([[1, 2, 3], [4, 5, 6]]);      // returns 1.8708286933869707
   *
   * See also:
   *
   *    mean, median, max, min, prod, sum, var
   *
   * @param {Array | Matrix} array
   *                        A single matrix or or multiple scalar values
   * @param {String} [normalization='unbiased']
   *                        Determines how to normalize the variance.
   *                        Choose 'unbiased' (default), 'uncorrected', or 'biased'.
   * @return {*} The standard deviation
   */
  math.std = function std(array, normalization) {
    if (arguments.length == 0) {
      throw new SyntaxError('Function std requires one or more parameters (0 provided)');
    }

    var variance = math['var'].apply(null, arguments);
    return math.sqrt(variance);
  };
};

},{}],238:[function(require,module,exports){
module.exports = function (math) {
  var Matrix = require('../../type/Matrix'),
      collection = require('../../type/collection'),

      isCollection = collection.isCollection;

  /**
   * Compute the sum of a matrix or a list with values.
   * In case of a (multi dimensional) array or matrix, the sum of all
   * elements will be calculated.
   *
   * Syntax:
   *
   *     math.sum(a, b, c, ...)
   *     math.sum(A)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.sum(2, 1, 4, 3);               // returns 10
   *     math.sum([2, 1, 4, 3]);             // returns 10
   *     math.sum([[2, 5], [4, 3], [1, 7]]); // returns 22
   *
   * See also:
   *
   *    mean, median, min, max, prod, std, var
   *
   * @param {... *} args  A single matrix or or multiple scalar values
   * @return {*} The sum of all values
   */
  math.sum = function sum(args) {
    if (arguments.length == 0) {
      throw new SyntaxError('Function sum requires one or more parameters (0 provided)');
    }

    if (isCollection(args)) {
      if (arguments.length == 1) {
        // sum([a, b, c, d, ...])
        return _sum(args);
      }
      else if (arguments.length == 2) {
        // sum([a, b, c, d, ...], dim)
        // TODO: implement sum(A, dim)
        throw new Error('sum(A, dim) is not yet supported');
        //return collection.reduce(arguments[0], arguments[1], math.add);
      }
      else {
        throw new SyntaxError('Wrong number of parameters');
      }
    }
    else {
      // sum(a, b, c, d, ...)
      return _sum(arguments);
    }
  };

  /**
   * Recursively calculate the sum of an n-dimensional array
   * @param {Array} array
   * @return {Number} sum
   * @private
   */
  function _sum(array) {
    var sum = undefined;

    collection.deepForEach(array, function (value) {
      sum = (sum === undefined) ? value : math.add(sum, value);
    });

    if (sum === undefined) {
      throw new Error('Cannot calculate sum of an empty array');
    }

    return sum;
  }
};

},{"../../type/Matrix":269,"../../type/collection":272}],239:[function(require,module,exports){
module.exports = function (math) {
  var Matrix = require('../../type/Matrix'),
      BigNumber = math.type.BigNumber,
      collection = require('../../type/collection'),

      isCollection = collection.isCollection,
      isString = require('../../util/string').isString,

      DEFAULT_NORMALIZATION = 'unbiased';

  /**
   * Compute the variance of a matrix or a  list with values.
   * In case of a (multi dimensional) array or matrix, the variance over all
   * elements will be calculated.
   *
   * Optionally, the type of normalization can be specified as second
   * parameter. The parameter `normalization` can be one of the following values:
   *
   * - 'unbiased' (default) The sum of squared errors is divided by (n - 1)
   * - 'uncorrected'        The sum of squared errors is divided by n
   * - 'biased'             The sum of squared errors is divided by (n + 1)

   * Note that older browser may not like the variable name `var`. In that
   * case, the function can be called as `math['var'](...)` instead of
   * `math.var(...)`.
   *
   * Syntax:
   *
   *     math.var(a, b, c, ...)
   *     math.var(A)
   *     math.var(A, normalization)
   *
   * Examples:
   *
   *     var math = mathjs();
   *
   *     math.var(2, 4, 6);                     // returns 4
   *     math.var([2, 4, 6, 8]);                // returns 6.666666666666667
   *     math.var([2, 4, 6, 8], 'uncorrected'); // returns 5
   *     math.var([2, 4, 6, 8], 'biased');      // returns 4
   *
   *     math.var([[1, 2, 3], [4, 5, 6]]);      // returns 3.5
   *
   * See also:
   *
   *    mean, median, max, min, prod, std, sum
   *
   * @param {Array | Matrix} array
   *                        A single matrix or or multiple scalar values
   * @param {String} [normalization='unbiased']
   *                        Determines how to normalize the variance.
   *                        Choose 'unbiased' (default), 'uncorrected', or 'biased'.
   * @return {*} The variance
   */
  math['var'] = function variance(array, normalization) {
    if (arguments.length == 0) {
      throw new SyntaxError('Function var requires one or more parameters (0 provided)');
    }

    if (isCollection(array)) {
      if (arguments.length == 1) {
        // var([a, b, c, d, ...])
        return _var(array, DEFAULT_NORMALIZATION);
      }
      else if (arguments.length == 2) {
        // var([a, b, c, d, ...], normalization)

        if (!isString(normalization)) {
          throw new Error('String expected for parameter normalization');
        }

        return _var(array, normalization);
      }
      /* TODO: implement var(A [, normalization], dim)
      else if (arguments.length == 3) {
        // var([a, b, c, d, ...], dim)
        // var([a, b, c, d, ...], normalization, dim)
        //return collection.reduce(arguments[0], arguments[1], ...);
      }
      */
      else {
        throw new SyntaxError('Wrong number of parameters');
      }
    }
    else {
      // var(a, b, c, d, ...)
      return _var(arguments, DEFAULT_NORMALIZATION);
    }
  };

  /**
   * Recursively calculate the variance of an n-dimensional array
   * @param {Array} array
   * @param {String} normalization
   *                        Determines how to normalize the variance:
   *                        - 'unbiased'    The sum of squared errors is divided by (n - 1)
   *                        - 'uncorrected' The sum of squared errors is divided by n
   *                        - 'biased'      The sum of squared errors is divided by (n + 1)
   * @return {Number | BigNumber} variance
   * @private
   */
  function _var(array, normalization) {
    var sum = 0;
    var num = 0;

    // calculate the mean and number of elements
    collection.deepForEach(array, function (value) {
      sum = math.add(sum, value);
      num++;
    });
    if (num === 0) throw new Error('Cannot calculate var of an empty array');

    var mean = math.divide(sum, num);

    // calculate the variance
    sum = 0;
    collection.deepForEach(array, function (value) {
      var diff = math.subtract(value, mean);
      sum = math.add(sum, math.multiply(diff, diff));
    });

    switch (normalization) {
      case 'uncorrected':
        return math.divide(sum, num);

      case 'biased':
        return math.divide(sum, num + 1);

      case 'unbiased':
        var zero = (sum instanceof BigNumber) ? new BigNumber(0) : 0;
        return (num == 1) ? zero : math.divide(sum, num - 1);

      default:
        throw new Error('Unknown normalization "' + normalization + '". ' +
            'Choose "unbiased" (default), "uncorrected", or "biased".');
    }
  }
};

},{"../../type/Matrix":269,"../../type/collection":272,"../../util/string":280}],240:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Calculate the inverse cosine of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.acos(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.acos(0.5);           // returns Number 1.0471975511965979
   *    math.acos(math.cos(1.5)); // returns Number 1.5
   *
   *    math.acos(2);             // returns Complex 0 + 1.3169578969248166 i
   *
   * See also:
   *
   *    cos, atan, asin
   *
   * @param {Number | Boolean | Complex | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} The arc cosine of x
   */
  math.acos = function acos(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('acos', arguments.length, 1);
    }

    if (isNumber(x)) {
      if (x >= -1 && x <= 1) {
        return Math.acos(x);
      }
      else {
        return acos(new Complex(x, 0));
      }
    }

    if (isComplex(x)) {
      // acos(z) = 0.5*pi + i*log(iz + sqrt(1-z^2))
      var temp1 = new Complex(
          x.im * x.im - x.re * x.re + 1.0,
          -2.0 * x.re * x.im
      );
      var temp2 = math.sqrt(temp1);
      var temp3 = new Complex(
          temp2.re - x.im,
          temp2.im + x.re
      );
      var temp4 = math.log(temp3);

      // 0.5*pi = 1.5707963267948966192313216916398
      return new Complex(
          1.57079632679489661923 - temp4.im,
          temp4.re
      );
    }

    if (isCollection(x)) {
      return collection.deepMap(x, acos);
    }

    if (isBoolean(x)) {
      return Math.acos(x);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return acos(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('acos', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],241:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Calculate the inverse sine of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.asin(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.asin(0.5);           // returns Number 0.5235987755982989
   *    math.asin(math.sin(1.5)); // returns Number ~1.5
   *
   *    math.asin(2);             // returns Complex 1.5707963267948966 -1.3169578969248166 i
   *
   * See also:
   *
   *    sin, atan, acos
   *
   * @param {Number | Boolean | Complex | Array | Matrix} x   Function input
   * @return {Number | Complex | Array | Matrix} The arc sine of x
   */
  math.asin = function asin(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('asin', arguments.length, 1);
    }

    if (isNumber(x)) {
      if (x >= -1 && x <= 1) {
        return Math.asin(x);
      }
      else {
        return asin(new Complex(x, 0));
      }
    }

    if (isComplex(x)) {
      // asin(z) = -i*log(iz + sqrt(1-z^2))
      var re = x.re;
      var im = x.im;
      var temp1 = new Complex(
          im * im - re * re + 1.0,
          -2.0 * re * im
      );
      var temp2 = math.sqrt(temp1);
      var temp3 = new Complex(
          temp2.re - im,
          temp2.im + re
      );
      var temp4 = math.log(temp3);

      return new Complex(temp4.im, -temp4.re);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, asin);
    }

    if (isBoolean(x)) {
      return Math.asin(x);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return asin(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('asin', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],242:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Calculate the inverse tangent of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.atan(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.atan(0.5);           // returns Number 0.4636476090008061
   *    math.atan(math.tan(1.5)); // returns Number 1.5
   *
   *    math.atan(2);             // returns Complex 1.5707963267948966 -1.3169578969248166 i
   *
   * See also:
   *
   *    tan, asin, acos
   *
   * @param {Number | Boolean | Complex | Array | Matrix} x   Function input
   * @return {Number | Complex | Array | Matrix} The arc tangent of x
   */
  math.atan = function atan(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('atan', arguments.length, 1);
    }

    if (isNumber(x)) {
      return Math.atan(x);
    }

    if (isComplex(x)) {
      // atan(z) = 1/2 * i * (ln(1-iz) - ln(1+iz))
      var re = x.re;
      var im = x.im;
      var den = re * re + (1.0 - im) * (1.0 - im);

      var temp1 = new Complex(
          (1.0 - im * im - re * re) / den,
          (-2.0 * re) / den
      );
      var temp2 = math.log(temp1);

      return new Complex(
          -0.5 * temp2.im,
          0.5 * temp2.re
      );
    }

    if (isCollection(x)) {
      return collection.deepMap(x, atan);
    }

    if (isBoolean(x)) {
      return Math.atan(x);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return atan(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('atan', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],243:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isCollection = collection.isCollection;

  /**
   * Calculate the inverse tangent function with two arguments, y/x.
   * By providing two arguments, the right quadrant of the computed angle can be
   * determined.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.atan2(y, x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.atan2(2, 2) / math.pi;       // returns number 0.25
   *
   *    var angle = math.unit(60, 'deg'); // returns Unit 60 deg
   *    var x = math.cos(angle);
   *    var y = math.sin(angle);
   *
   *    math.atan(2);             // returns Complex 1.5707963267948966 -1.3169578969248166 i
   *
   * See also:
   *
   *    tan, atan, sin, cos
   *
   * @param {Number | Boolean | Complex | Array | Matrix} y  Second dimension
   * @param {Number | Boolean | Complex | Array | Matrix} x  First dimension
   * @return {Number | Complex | Array | Matrix} Four-quadrant inverse tangent
   */
  math.atan2 = function atan2(y, x) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('atan2', arguments.length, 2);
    }

    if (isNumber(y)) {
      if (isNumber(x)) {
        return Math.atan2(y, x);
      }
    }

    // TODO: support for complex computation of atan2

    if (isCollection(y) || isCollection(x)) {
      return collection.deepMap2(y, x, atan2);
    }

    if (isBoolean(y)) {
      return atan2(+y, x);
    }
    if (isBoolean(x)) {
      return atan2(y, +x);
    }

    // TODO: implement bignumber support
    if (y instanceof BigNumber) {
      return atan2(y.toNumber(), x);
    }
    if (x instanceof BigNumber) {
      return atan2(y, x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('atan2', math['typeof'](y), math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/collection":272,"../../util/index":276}],244:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the cosine of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.cos(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.cos(2);                      // returns Number -0.4161468365471422
   *    math.cos(math.pi / 4);            // returns Number  0.7071067811865475
   *    math.cos(math.unit(180, 'deg'));  // returns Number -1
   *    math.cos(math.unit(60, 'deg'));   // returns Number  0.5
   *
   *    var angle = 0.2;
   *    math.pow(math.sin(angle), 2) + math.pow(math.cos(angle), 2); // returns Number ~1
   *
   * See also:
   *
   *    cos, tan
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Cosine of x
   */
  math.cos = function cos(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('cos', arguments.length, 1);
    }

    if (isNumber(x)) {
      return Math.cos(x);
    }

    if (isComplex(x)) {
      // cos(z) = (exp(iz) + exp(-iz)) / 2
      return new Complex(
          0.5 * Math.cos(x.re) * (Math.exp(-x.im) + Math.exp(x.im)),
          0.5 * Math.sin(x.re) * (Math.exp(-x.im) - Math.exp(x.im))
      );
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function cos is no angle');
      }
      return Math.cos(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, cos);
    }

    if (isBoolean(x)) {
      return Math.cos(x);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return cos(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('cos', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],245:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the hyperbolic cosine of a value,
   * defined as `cosh(x) = 1/2 * (exp(x) + exp(-x))`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.cosh(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.cosh(0.5);       // returns Number 1.1276259652063807
   *
   * See also:
   *
   *    sinh, tanh
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Hyperbolic cosine of x
   */
  math.cosh = function cosh(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('cosh', arguments.length, 1);
    }

    if (isNumber(x)) {
      return (Math.exp(x) + Math.exp(-x)) / 2;
    }

    if (isComplex(x)) {
      var ep = Math.exp(x.re);
      var en = Math.exp(-x.re);
      return new Complex(Math.cos(x.im) * (ep + en) / 2, Math.sin(x.im) * (ep - en) / 2);
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function cosh is no angle');
      }
      return cosh(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, cosh);
    }

    if (isBoolean(x)) {
      return cosh(x ? 1 : 0);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return cosh(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('cosh', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],246:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the cotangent of a value. `cot(x)` is defined as `1 / tan(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.cot(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.cot(2);      // returns Number -0.45765755436028577
   *    1 / math.tan(2);  // returns Number -0.45765755436028577
   *
   * See also:
   *
   *    tan, sec, csc
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Cotangent of x
   */
  math.cot = function cot(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('cot', arguments.length, 1);
    }

    if (isNumber(x)) {
      return 1 / Math.tan(x);
    }

    if (isComplex(x)) {
      var den = Math.exp(-4.0 * x.im) -
          2.0 * Math.exp(-2.0 * x.im) * Math.cos(2.0 * x.re) + 1.0;

      return new Complex(
          2.0 * Math.exp(-2.0 * x.im) * Math.sin(2.0 * x.re) / den,
          (Math.exp(-4.0 * x.im) - 1.0) / den
      );
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function cot is no angle');
      }
      return 1 / Math.tan(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, cot);
    }

    if (isBoolean(x)) {
      return cot(+x);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return cot(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('cot', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],247:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the hyperbolic cotangent of a value,
   * defined as `coth(x) = 1 / tanh(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.coth(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    // coth(x) = 1 / tanh(x)
   *    math.coth(2);         // returns 1.0373147207275482
   *    1 / math.tanh(2);     // returns 1.0373147207275482
   *
   * See also:
   *
   *    sinh, tanh, cosh
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Hyperbolic cotangent of x
   */
  math.coth = function coth(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('coth', arguments.length, 1);
    }

    if (isNumber(x)) {
      var e = Math.exp(2 * x);
      return (e + 1) / (e - 1);
    }

    if (isComplex(x)) {
      var r = Math.exp(2 * x.re);
      var re = r * Math.cos(2 * x.im);
      var im = r * Math.sin(2 * x.im);
      var den = (re - 1) * (re - 1) + im * im;
      return new Complex(
        ((re + 1) * (re - 1) + im * im) / den,
        -2 * im / den
      );
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function coth is no angle');
      }
      return coth(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, coth);
    }

    if (isBoolean(x)) {
      return coth(x ? 1 : 0);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return coth(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('coth', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],248:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the cosecant of a value, defined as `csc(x) = 1/sin(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.csc(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.csc(2);      // returns Number 1.099750170294617
   *    1 / math.sin(2);  // returns Number 1.099750170294617
   *
   * See also:
   *
   *    sin, sec, cot
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Cosecant of x
   */
  math.csc = function csc(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('csc', arguments.length, 1);
    }

    if (isNumber(x)) {
      return 1 / Math.sin(x);
    }

    if (isComplex(x)) {
      // csc(z) = 1/sin(z) = (2i) / (exp(iz) - exp(-iz))
      var den = 0.25 * (Math.exp(-2.0 * x.im) + Math.exp(2.0 * x.im)) -
          0.5 * Math.cos(2.0 * x.re);

      return new Complex (
          0.5 * Math.sin(x.re) * (Math.exp(-x.im) + Math.exp(x.im)) / den,
          0.5 * Math.cos(x.re) * (Math.exp(-x.im) - Math.exp(x.im)) / den
      );
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function csc is no angle');
      }
      return 1 / Math.sin(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, csc);
    }

    if (isBoolean(x)) {
      return csc(+x);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return csc(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('csc', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],249:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),
      number = util.number,
      
      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the hyperbolic cosecant of a value,
   * defined as `csch(x) = 1 / sinh(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.csch(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    // csch(x) = 1/ sinh(x)
   *    math.csch(0.5);       // returns 1.9190347513349437
   *    1 / math.sinh(0.5);   // returns 1.9190347513349437
   *
   * See also:
   *
   *    sinh, sech, coth
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Hyperbolic cosecant of x
   */
  math.csch = function csch(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('csch', arguments.length, 1);
    }

    if (isNumber(x)) {
      // x == 0
      if (x == 0) return Number.NaN;
      // consider values close to zero (+/-)
      return Math.abs(2 / (Math.exp(x) - Math.exp(-x))) * number.sign(x);
    }

    if (isComplex(x)) {
      var ep = Math.exp(x.re);
      var en = Math.exp(-x.re);
      var re = Math.cos(x.im) * (ep - en);
      var im = Math.sin(x.im) * (ep + en);
      var den = re * re + im * im;
      return new Complex(2 * re / den, -2 * im /den);
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function csch is no angle');
      }
      return csch(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, csch);
    }

    if (isBoolean(x)) {
      return csch(x ? 1 : 0);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return csch(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('csch', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],250:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the secant of a value, defined as `sec(x) = 1/cos(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.sec(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.sec(2);      // returns Number -2.4029979617223822
   *    1 / math.cos(2);  // returns Number -2.4029979617223822
   *
   * See also:
   *
   *    cos, csc, cot
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Secant of x
   */
  math.sec = function sec(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('sec', arguments.length, 1);
    }

    if (isNumber(x)) {
      return 1 / Math.cos(x);
    }

    if (isComplex(x)) {
      // sec(z) = 1/cos(z) = 2 / (exp(iz) + exp(-iz))
      var den = 0.25 * (Math.exp(-2.0 * x.im) + Math.exp(2.0 * x.im)) +
          0.5 * Math.cos(2.0 * x.re);

      return new Complex(
          0.5 * Math.cos(x.re) * (Math.exp(-x.im) + Math.exp( x.im)) / den,
          0.5 * Math.sin(x.re) * (Math.exp( x.im) - Math.exp(-x.im)) / den
      );
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function sec is no angle');
      }
      return 1 / Math.cos(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, sec);
    }

    if (isBoolean(x)) {
      return sec(+x);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return sec(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('sec', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],251:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the hyperbolic secant of a value,
   * defined as `sech(x) = 1 / cosh(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.sech(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    // sech(x) = 1/ cosh(x)
   *    math.sech(0.5);       // returns 0.886818883970074
   *    1 / math.cosh(0.5);   // returns 1.9190347513349437
   *
   * See also:
   *
   *    cosh, csch, coth
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Hyperbolic secant of x
   */
  math.sech = function sech(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('sech', arguments.length, 1);
    }

    if (isNumber(x)) {
      return 2 / (Math.exp(x) + Math.exp(-x));
    }

    if (isComplex(x)) {
      var ep = Math.exp(x.re);
      var en = Math.exp(-x.re);
      var re = Math.cos(x.im) * (ep + en);
      var im = Math.sin(x.im) * (ep - en);
      var den = re * re + im * im;
      return new Complex(2 * re / den, -2 * im / den);
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function sech is no angle');
      }
      return sech(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, sech);
    }

    if (isBoolean(x)) {
      return sech(x ? 1 : 0);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return sech(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('sech', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],252:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the sine of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.sin(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.sin(2);                      // returns Number 0.9092974268256813
   *    math.sin(math.pi / 4);            // returns Number 0.7071067811865475
   *    math.sin(math.unit(90, 'deg'));   // returns Number 1
   *    math.sin(math.unit(30, 'deg'));   // returns Number 0.5
   *
   *    var angle = 0.2;
   *    math.pow(math.sin(angle), 2) + math.pow(math.cos(angle), 2); // returns Number ~1
   *
   * See also:
   *
   *    cos, tan
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Sine of x
   */
  /**
   * Calculate the sine of a value
   *
   *     sin(x)
   *
   * For matrices, the function is evaluated element wise.
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x
   * @return {Number | Complex | Array | Matrix} res
   *
   * @see http://mathworld.wolfram.com/Sine.html
   */
  math.sin = function sin(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('sin', arguments.length, 1);
    }

    if (isNumber(x)) {
      return Math.sin(x);
    }

    if (isComplex(x)) {
      return new Complex(
          0.5 * Math.sin(x.re) * (Math.exp(-x.im) + Math.exp( x.im)),
          0.5 * Math.cos(x.re) * (Math.exp( x.im) - Math.exp(-x.im))
      );
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function sin is no angle');
      }
      return Math.sin(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, sin);
    }

    if (isBoolean(x)) {
      return Math.sin(x);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return sin(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('sin', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],253:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the hyperbolic sine of a value,
   * defined as `sinh(x) = 1/2 * (exp(x) - exp(-x))`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.sinh(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.sinh(0.5);       // returns Number 0.5210953054937474
   *
   * See also:
   *
   *    cosh, tanh
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Hyperbolic sine of x
   */
  math.sinh = function sinh(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('sinh', arguments.length, 1);
    }

    if (isNumber(x)) {
      return (Math.exp(x) - Math.exp(-x)) / 2;
    }

    if (isComplex(x)) {
      var cim = Math.cos(x.im);
      var sim = Math.sin(x.im);
      var ep = Math.exp(x.re);
      var en = Math.exp(-x.re);
      return new Complex(cim * (ep - en) / 2, sim * (ep + en) / 2);
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function sinh is no angle');
      }
      return sinh(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, sinh);
    }

    if (isBoolean(x)) {
      return sinh(x ? 1 : 0);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return sinh(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('sinh', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],254:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the tangent of a value. `tan(x)` is equal to `sin(x) / cos(x)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.tan(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.tan(0.5);                    // returns Number 0.5463024898437905
   *    math.sin(0.5) / math.cos(0.5);    // returns Number 0.5463024898437905
   *    math.tan(math.pi / 4);            // returns Number 1
   *    math.tan(math.unit(45, 'deg'));   // returns Number 1
   *
   * See also:
   *
   *    atan, sin, cos
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Tangent of x
   */
  math.tan = function tan(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('tan', arguments.length, 1);
    }

    if (isNumber(x)) {
      return Math.tan(x);
    }

    if (isComplex(x)) {
      var den = Math.exp(-4.0 * x.im) +
          2.0 * Math.exp(-2.0 * x.im) * Math.cos(2.0 * x.re) +
          1.0;

      return new Complex(
          2.0 * Math.exp(-2.0 * x.im) * Math.sin(2.0 * x.re) / den,
          (1.0 - Math.exp(-4.0 * x.im)) / den
      );
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function tan is no angle');
      }
      return Math.tan(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, tan);
    }

    if (isBoolean(x)) {
      return Math.tan(x);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return tan(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('tan', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],255:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isNumber = util.number.isNumber,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Calculate the hyperbolic tangent of a value,
   * defined as `tanh(x) = (exp(2 * x) - 1) / (exp(2 * x) + 1)`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.tanh(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    // tanh(x) = sinh(x) / cosh(x) = 1 / coth(x)
   *    math.tanh(0.5);                   // returns 0.46211715726000974
   *    math.sinh(0.5) / math.cosh(0.5);  // returns 0.46211715726000974
   *    1 / math.coth(0.5);               // returns 0.46211715726000974
   *
   * See also:
   *
   *    sinh, cosh, coth
   *
   * @param {Number | Boolean | Complex | Unit | Array | Matrix} x  Function input
   * @return {Number | Complex | Array | Matrix} Hyperbolic tangent of x
   */
  math.tanh = function tanh(x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('tanh', arguments.length, 1);
    }

    if (isNumber(x)) {
      var e = Math.exp(2 * x);
      return (e - 1) / (e + 1);
    }

    if (isComplex(x)) {
      var r = Math.exp(2 * x.re);
      var re = r * Math.cos(2 * x.im);
      var im = r * Math.sin(2 * x.im);
      var den = (re + 1) * (re + 1) + im * im;
      return new Complex(
        ((re - 1) * (re + 1) + im * im) / den,
        im * 2 / den
      );
    }

    if (isUnit(x)) {
      if (!x.hasBase(Unit.BASE_UNITS.ANGLE)) {
        throw new TypeError ('Unit in function tanh is no angle');
      }
      return tanh(x.value);
    }

    if (isCollection(x)) {
      return collection.deepMap(x, tanh);
    }

    if (isBoolean(x)) {
      return tanh(x ? 1 : 0);
    }

    if (x instanceof BigNumber) {
      // TODO: implement BigNumber support
      // downgrade to Number
      return tanh(x.toNumber());
    }

    throw new math.error.UnsupportedTypeError('tanh', math['typeof'](x));
  };
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],256:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      isString = util.string.isString,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Change the unit of a value.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.to(x, unit)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.to(math.unit('2 inch'), 'cm');                   // returns Unit 5.08 cm
   *    math.to(math.unit('2 inch'), math.unit(null, 'cm'));  // returns Unit 5.08 cm
   *    math.to(math.unit(16, 'bytes'), 'bits');              // returns Unit 128 bits
   *
   * See also:
   *
   *    unit
   *
   * @param {Unit | Array | Matrix} x     The unit to be converted.
   * @param {Unit | Array | Matrix} unit  New unit. Can be a string like "cm"
   *                                      or a unit without value.
   * @return {Unit | Array | Matrix} value with changed, fixed unit.
   */
  math.to = function to(x, unit) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('to', arguments.length, 2);
    }

    if (isUnit(x)) {
      if (isUnit(unit) || isString(unit)) {
        return x.to(unit);
      }
    }

    // TODO: add support for string, in that case, convert to unit

    if (isCollection(x) || isCollection(unit)) {
      return collection.deepMap2(x, unit, to);
    }

    throw new math.error.UnsupportedTypeError('to', math['typeof'](x), math['typeof'](unit));
  };
};

},{"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],257:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),
      object = util.object;

  /**
   * Clone an object.
   *
   * Syntax:
   *
   *     math.clone(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.clone(3.5);              // returns number 3.5
   *    math.clone(2 - 4i);           // returns Complex 2 - 4i
   *    math.clone(45 deg);           // returns Unit 45 deg
   *    math.clone([[1, 2], [3, 4]]); // returns Array [[1, 2], [3, 4]]
   *    math.clone("hello world");    // returns string "hello world"
   *
   * @param {*} x   Object to be cloned
   * @return {*} A clone of object x
   */
  math.clone = function clone (x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('clone', arguments.length, 1);
    }

    return object.clone(x);
  };
};

},{"../../util/index":276}],258:[function(require,module,exports){
module.exports = function (math) {
  var isMatrix = require('../../type/Matrix').isMatrix;

  /**
   * Iterate over all elements of a matrix/array, and executes the given callback function.
   *
   * Syntax:
   *
   *    math.forEach(x, callback)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.forEach([1, 2, 3], function(value) {
   *      console.log(value);
   *    });
   *    // outputs 1, 2, 3
   *
   * @param {Matrix | Array} x    The matrix to iterate on.
   * @param {Function} callback   The callback function is invoked with three
   *                              parameters: the value of the element, the index
   *                              of the element, and the Matrix/array being traversed.
   */
  math.forEach = function (x, callback) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('forEach', arguments.length, 2);
    }

    if (Array.isArray(x)) {
      return _forEachArray(x, callback);
    } else if (isMatrix(x)) {
      return x.forEach(callback);
    } else {
      throw new math.error.UnsupportedTypeError('forEach', math['typeof'](x));
    }
  };

  function _forEachArray (array, callback) {
    var index = [];
    var recurse = function (value, dim) {
      if (Array.isArray(value)) {
        value.forEach(function (child, i) {
          index[dim] = i; // zero-based index
          recurse(child, dim + 1);
        });
      }
      else {
        callback(value, index, array);
      }
    };
    recurse(array, 0);
  }

};
},{"../../type/Matrix":269}],259:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),
      string = util.string;

  /**
   * Format a value of any type into a string.
   *
   * Syntax:
   *
   *    math.format(value)
   *    math.format(value, options)
   *    math.format(value, precision)
   *    math.format(value, fn)
   *
   * Where:
   *
   *  - `value: *`
   *    The value to be formatted
   *  - `options: Object`
   *    An object with formatting options. Available options:
   *    - `notation: String`
   *      Number notation. Choose from:
   *      - 'fixed'
   *        Always use regular number notation.
   *        For example '123.40' and '14000000'
   *      - 'exponential'
   *        Always use exponential notation.
   *        For example '1.234e+2' and '1.4e+7'
   *      - 'auto' (default)
   *        Regular number notation for numbers having an absolute value between
   *        `lower` and `upper` bounds, and uses exponential notation elsewhere.
   *        Lower bound is included, upper bound is excluded.
   *        For example '123.4' and '1.4e7'.
   *    - `precision: Number`
   *      A number between 0 and 16 to round the digits of the number. In case
   *      of notations 'exponential' and 'auto', `precision` defines the total
   *      number of significant digits returned and is undefined by default.
   *      In case of notation 'fixed', `precision` defines the number of
   *      significant digits after the decimal point, and is 0 by default.
   *    - `exponential: Object`
   *      An object containing two parameters, {Number} lower and {Number} upper,
   *      used by notation 'auto' to determine when to return exponential
   *      notation. Default values are `lower=1e-3` and `upper=1e5`. Only
   *      applicable for notation `auto`.
   * - `fn: Function`
   *   A custom formatting function. Can be used to override the built-in notations.
   *   Function `fn` is called with `value` as parameter and must return a string.
   *   Is useful for example to format all values inside a matrix in a particular way.
   *
   * Examples:
   *
   *    math.format(6.4);                                        // returns '6.4'
   *    math.format(1240000);                                    // returns '1.24e6'
   *    math.format(1/3);                                        // returns '0.3333333333333333'
   *    math.format(1/3, 3);                                     // returns '0.333'
   *    math.format(21385, 2);                                   // returns '21000'
   *    math.format(12.071, {notation: 'fixed'});                // returns '12'
   *    math.format(2.3,    {notation: 'fixed', precision: 2});  // returns '2.30'
   *    math.format(52.8,   {notation: 'exponential'});          // returns '5.28e+1'
   *
   * See also:
   *
   *    print
   *
   * @param {*} value                               Value to be stringified
   * @param {Object | Function | Number} [options]  Formatting options
   * @return {String} str The formatted value
   */
  math.format = function format (value, options) {
    var num = arguments.length;
    if (num !== 1 && num !== 2) {
      throw new math.error.ArgumentsError('format', num, 1, 2);
    }

    return string.format(value, options);
  };
};

},{"../../util/index":276}],260:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      BigNumber = math.type.BigNumber,
      Matrix = require('../../type/Matrix'),
      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),
      collection = require('../../type/collection'),

      deepEqual = util.object.deepEqual,
      isNumber = util.number.isNumber,
      isString = util.string.isString,
      isBoolean = util['boolean'].isBoolean,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit,
      isCollection = collection.isCollection;

  /**
   * Execute a conditional expression.
   *
   * In case of a matrix or array, the test is done element wise, the
   * true and false part can be either a matrix/array with the same size
   * of the condition, or a scalar value.
   *
   * Syntax:
   *
   *    math.ifElse(condition, trueExpr, falseExpr
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.ifElse(true, 'yes', 'no');           // returns 'yes'
   *    math.ifElse([4, 6, 0, -1], true, false);  // returns [true, true, false, true]
   *
   * @param {Number | Boolean | String | Complex | BigNumber | Unit | Matrix | Array} condition
   *                        The conditional expression
   * @param {*} trueExpr    The true expression
   * @param {*} falseExpr   The false expression
   * @return {*}            The evaluated return expression
   */
  math.ifElse = function ifElse(condition, trueExpr, falseExpr) {
    if (arguments.length != 3) {
      throw new math.error.ArgumentsError('ifElse', arguments.length, 3);
    }

    if (isNumber(condition) || isBoolean(condition)) {
      return condition ? trueExpr : falseExpr;
    }

    if (condition instanceof BigNumber) {
      return condition.isZero() ? falseExpr : trueExpr;
    }

    if (isString(condition)) {
      return condition ? trueExpr : falseExpr;
    }

    if (isComplex(condition)) {
      return (condition.re || condition.im) ? trueExpr : falseExpr;
    }

    if (isUnit(condition)) {
      return condition.value ? trueExpr : falseExpr;
    }

    if (condition === null || condition === undefined) {
      return falseExpr;
    }

    if (isCollection(condition)) {
      return _ifElseCollection(condition, trueExpr, falseExpr);
    }

    throw new math.error.UnsupportedTypeError('ifElse', math['typeof'](condition));
  };

  /**
   * Execute the if-else condition element wise
   * @param {Matrix | Array} condition
   * @param {*} trueExpr
   * @param {*} falseExpr
   * @returns {*}
   * @private
   */
  function _ifElseCollection(condition, trueExpr, falseExpr) {
    var asMatrix = (condition instanceof Matrix) ||
        (trueExpr instanceof Matrix) ||
        (falseExpr instanceof Matrix);

    // change an array into a matrix
    if (!(condition instanceof Matrix)) condition = new Matrix(condition);

    // change the true expression into a matrix and check whether the size
    // matches with the condition matrix
    if (isCollection(trueExpr)) {
      if (!(trueExpr instanceof Matrix)) trueExpr = new Matrix(trueExpr);

      if (!deepEqual(condition.size(), trueExpr.size())) {
        throw new RangeError('Dimension mismatch ([' +
            condition.size().join(', ') + '] != [' +
            trueExpr.size().join(', ')
            + '])');
        throw new math.error.DimensionError(condition.size(), trueExpr.size());
      }
    }

    // change the false expression into a matrix and check whether the size
    // matches with the condition matrix
    if (isCollection(falseExpr)) {
      if (!(falseExpr instanceof Matrix)) falseExpr = new Matrix(falseExpr);

      if (!deepEqual(condition.size(), falseExpr.size())) {
        throw new math.error.DimensionError(condition.size(), falseExpr.size());
      }
    }

    // do the actual conditional test element wise
    var trueIsMatrix = trueExpr instanceof Matrix,
        falseIsMatrix = falseExpr instanceof Matrix;
    var result = condition.map(function (value, index) {
      return math.ifElse(value,
          trueIsMatrix ? trueExpr.get(index) : trueExpr,
          falseIsMatrix ? falseExpr.get(index) : falseExpr
      );
    });

    return asMatrix ? result : result.valueOf();
  }
};

},{"../../type/Complex":266,"../../type/Matrix":269,"../../type/Unit":271,"../../type/collection":272,"../../util/index":276}],261:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      Complex = require('../../type/Complex'),
      Unit = require('../../type/Unit'),

      isNumber = util.number.isNumber,
      isString = util.string.isString,
      isComplex = Complex.isComplex,
      isUnit = Unit.isUnit;

  /**
   * Import functions from an object or a module
   *
   * Syntax:
   *
   *    math.import(object)
   *    math.import(object, options)
   *
   * Where:
   *
   * - `object: Object`
   *   An object with functions to be imported.
   * - `options: Object` An object with import options. Available options:
   *   - `override: boolean`
   *     If true, existing functions will be overwritten. False by default.
   *   - `wrap: boolean`
   *     If true (default), the functions will be wrapped in a wrapper function
   *     which converts data types like Matrix to primitive data types like Array.
   *     The wrapper is needed when extending math.js with libraries which do not
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    // define new functions and variables
   *    math.import({
   *      myvalue: 42,
   *      hello: function (name) {
   *        return 'hello, ' + name + '!';
   *      }
   *    });
   *
   *    // use the imported function and variable
   *    math.myvalue * 2;               // 84
   *    math.hello('user');             // 'hello, user!'
   *
   *    // import the npm module numbers
   *    // (must be installed first with `npm install numbers`)
   *    math.import('numbers');
   *
   *    math.fibonacci(7); // returns 13
   *
   * @param {String | Object} object  Object with functions to be imported.
   * @param {Object} [options]        Import options.
   */
  // TODO: return status information
  math['import'] = function math_import(object, options) {
    var num = arguments.length;
    if (num != 1 && num != 2) {
      throw new math.error.ArgumentsError('import', num, 1, 2);
    }

    var name;
    var opts = {
      override: false,
      wrap: true
    };
    if (options && options instanceof Object) {
      util.object.extend(opts, options);
    }

    if (isString(object)) {
      // a string with a filename

      // istanbul ignore else (we cannot unit test the else case in a node.js environment)
      if (typeof (require) !== 'undefined') {
        // load the file using require
        var _module = require(object);
        math_import(_module);
      }
      else {
        throw new Error('Cannot load module: require not available.');
      }
    }
    else if (typeof object === 'object') {
      // a map with functions
      for (name in object) {
        if (object.hasOwnProperty(name)) {
          var value = object[name];
          if (isSupportedType(value)) {
            _import(name, value, opts);
          }
          else {
            math_import(value);
          }
        }
      }
    }
    else {
      throw new TypeError('Object or module name expected');
    }
  };

  /**
   * Add a property to the math namespace and create a chain proxy for it.
   * @param {String} name
   * @param {*} value
   * @param {Object} options  See import for a description of the options
   * @private
   */
  function _import(name, value, options) {
    if (options.override || math[name] === undefined) {
      // add to math namespace
      if (options.wrap && typeof value === 'function') {
        // create a wrapper around the function
        math[name] = function () {
          var args = [];
          for (var i = 0, len = arguments.length; i < len; i++) {
            args[i] = arguments[i].valueOf();
          }
          return value.apply(math, args);
        };
      }
      else {
        // just create a link to the function or value
        math[name] = value;
      }

      // create a proxy for the Selector
      math.chaining.Selector.createProxy(name, value);
    }
  }

  /**
   * Check whether given object is a supported type
   * @param object
   * @return {Boolean}
   * @private
   */
  function isSupportedType(object) {
    return (typeof object == 'function') ||
        isNumber(object) || isString(object) ||
        isComplex(object) || isUnit(object);
    // TODO: add boolean?
  }
};

},{"../../type/Complex":266,"../../type/Unit":271,"../../util/index":276}],262:[function(require,module,exports){
module.exports = function (math) {
  var isMatrix = require('../../type/Matrix').isMatrix;


  /**
   * Create a new matrix or array with the results of the callback function executed on
   * each entry of the matrix/array.
   *
   * Syntax:
   *
   *    math.map(x, callback)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.map([1, 2, 3], function(value) {
   *      return value * value;
   *    });  // returns [1, 4, 9]
   *
   * @param {Matrix | Array} x    The matrix to iterate on.
   * @param {Function} callback   The callback method is invoked with three
   *                              parameters: the value of the element, the index
   *                              of the element, and the matrix being traversed.
   * @return {Matrix | array}     Transformed map of x
   */
  math.map = function (x, callback) {
    if (arguments.length != 2) {
      throw new math.error.ArgumentsError('map', arguments.length, 2);
    }

    if (Array.isArray(x)) {
      return _mapArray(x, callback);
    } else if (isMatrix(x)) {
      return x.map(callback);
    } else {
      throw new math.error.UnsupportedTypeError('map', math['typeof'](x));
    }
  };

  function _mapArray (arrayIn, callback) {
    var index = [];
    var recurse = function (value, dim) {
      if (Array.isArray(value)) {
        return value.map(function (child, i) {
          index[dim] = i;
          return recurse(child, dim + 1);
        });
      }
      else {
        return callback(value, index, arrayIn);
      }
    };

    return recurse(arrayIn, 0);
  };
};

},{"../../type/Matrix":269}],263:[function(require,module,exports){
module.exports = function (math) {
  var util = require('../../util/index'),

      isString = util.string.isString;

  /**
   * Interpolate values into a string template.
   *
   * Syntax:
   *
   *     math.print(template, values)
   *     math.print(template, values, precision)
   *
   * Example usage:
   *
   *     var math = mathjs();
   *
   *     // the following outputs: 'Lucy is 5 years old'
   *     math.print('Lucy is $age years old', {age: 5});
   *
   *     // the following outputs: 'The value of pi is 3.141592654'
   *     math.print('The value of pi is $pi', {pi: math.pi}, 10);
   *
   *     // the following outputs: 'hello Mary! The date is 2013-03-23'
   *     math.print('Hello $user.name! The date is $date', {
   *       user: {
   *         name: 'Mary',
   *       },
   *       date: new Date(2013, 2, 23).toISOString().substring(0, 10)
   *     });
   *
   * See also:
   *
   *     format
   *
   * @param {String} template     A string containing variable placeholders.
   * @param {Object} values       An object containing variables which will
   *                              be filled in in the template.
   * @param {Number} [precision]  Number of digits to format numbers.
   *                              If not provided, the value will not be rounded.
   * @return {String} Interpolated string
   */
  math.print = function print (template, values, precision) {
    var num = arguments.length;
    if (num != 2 && num != 3) {
      throw new math.error.ArgumentsError('print', num, 2, 3);
    }

    if (!isString(template)) {
      throw new TypeError('String expected as first parameter in function format');
    }
    if (!(values instanceof Object)) {
      throw new TypeError('Object expected as second parameter in function format');
    }

    // format values into a string
    return template.replace(/\$([\w\.]+)/g, function (original, key) {
          var keys = key.split('.');
          var value = values[keys.shift()];
          while (keys.length && value !== undefined) {
            var k = keys.shift();
            value = k ? value[k] : value + '.';
          }

          if (value !== undefined) {
            if (!isString(value)) {
              return math.format(value, precision);
            }
            else {
              return value;
            }
          }

          return original;
        }
    );
  };
};

},{"../../util/index":276}],264:[function(require,module,exports){
module.exports = function (math) {
  var types = require('../../util/types'),

      Complex = require('../../type/Complex'),
      Matrix = require('../../type/Matrix'),
      Unit = require('../../type/Unit'),
      Index = require('../../type/Index'),
      Range = require('../../type/Range'),
      Help = require('../../type/Help');

  /**
   * Determine the type of a variable.
   *
   * Syntax:
   *
   *    math.typeof(x)
   *
   * Examples:
   *
   *    var math = mathjs();
   *
   *    math.typeof(3.5);             // returns 'number'
   *    math.typeof(2 - 4i);          // returns 'complex'
   *    math.typeof(45 deg);          // returns 'unit'
   *    math.typeof("hello world");   // returns 'string'
   *
   * @param {*} x  The variable for which to test the type.
   * @return {String} Lower case type, for example 'number', 'string', 'array'.
   */
  math['typeof'] = function _typeof (x) {
    if (arguments.length != 1) {
      throw new math.error.ArgumentsError('typeof', arguments.length, 1);
    }

    // JavaScript types
    var type = types.type(x);

    // math.js types
    if (type === 'object') {
      if (x instanceof Complex) return 'complex';
      if (x instanceof Matrix) return 'matrix';
      if (x instanceof Unit) return 'unit';
      if (x instanceof Index) return 'index';
      if (x instanceof Range) return 'range';
      if (x instanceof Help) return 'help';

      // the following types are different instances per math.js instance
      if (x instanceof math.type.BigNumber) return 'bignumber';
      if (x instanceof math.chaining.Selector) return 'selector';
    }

    return type;
  };
};

},{"../../type/Complex":266,"../../type/Help":267,"../../type/Index":268,"../../type/Matrix":269,"../../type/Range":270,"../../type/Unit":271,"../../util/types":281}],265:[function(require,module,exports){
var object = require('./util/object');

/**
 * math.js factory function.
 *
 * Usage:
 *
 *     var math = mathjs();
 *     var math = mathjs(config);
 *
 * @param {Object} [config] Available configuration options:
 *                            {String} matrix
 *                              A string 'matrix' (default) or 'array'.
 *                            {String} number
 *                              A string 'number' (default) or 'bignumber'
 *                            {Number} precision
 *                              The number of significant digits for BigNumbers.
 *                              Not applicable for Numbers.
 */
function mathjs (config) {
  // simple test for ES5 support
  if (typeof Object.create !== 'function') {
    throw new Error('ES5 not supported by this JavaScript engine. ' +
        'Please load the es5-shim and es5-sham library for compatibility.');
  }

  // create new namespace
  var math = {};

  // create configuration options. These are private
  var _config = {
    // type of default matrix output. Choose 'matrix' (default) or 'array'
    matrix: 'matrix',

    // type of default number output. Choose 'number' (default) or 'bignumber'
    number: 'number',

    // number of significant digits in BigNumbers
    precision: 20,
    
    // minimum relative difference between two compared values,
    // used by all comparison functions
    epsilon: 1e-14
  };

  /**
   * Set configuration options for math.js, and get current options
   * @param {Object} [options] Available options:
   *                            {String} matrix
   *                              A string 'matrix' (default) or 'array'.
   *                            {String} number
   *                              A string 'number' (default) or 'bignumber'
   *                            {Number} precision
   *                              The number of significant digits for BigNumbers.
   *                              Not applicable for Numbers.
   * @return {Object} Returns the current configuration
   */
  math.config = function config (options) {
    if (options) {
      // merge options
      object.deepExtend(_config, options);

      if (options.precision) {
        math.type.BigNumber.config({
          precision: options.precision
        });
      }

      // TODO: remove deprecated setting some day (deprecated since version 0.17.0)
      if (options.number && options.number.defaultType) {
        throw new Error('setting `number.defaultType` is deprecated. Use `number` instead.')
      }

      // TODO: remove deprecated setting some day (deprecated since version 0.17.0)
      if (options.number && options.number.precision) {
        throw new Error('setting `number.precision` is deprecated. Use `precision` instead.')
      }

      // TODO: remove deprecated setting some day (deprecated since version 0.17.0)
      if (options.matrix && options.matrix.defaultType) {
        throw new Error('setting `matrix.defaultType` is deprecated. Use `matrix` instead.')
      }

      // TODO: remove deprecated setting some day (deprecated since version 0.15.0)
      if (options.matrix && options.matrix['default']) {
        throw new Error('setting `matrix.default` is deprecated. Use `matrix` instead.')
      }

      // TODO: remove deprecated setting some day (deprecated since version 0.20.0)
      if (options.decimals) {
        throw new Error('setting `decimals` is deprecated. Use `precision` instead.')
      }
    }

    // return a clone of the settings
    return object.clone(_config);
  };

  // create a new BigNumber factory for this instance of math.js
  var BigNumber = require('decimal.js').constructor();

  // extend BigNumber with a function clone
  if (typeof BigNumber.prototype.clone !== 'function') {
    /**
     * Clone a bignumber
     * @return {BigNumber} clone
     */
    BigNumber.prototype.clone = function clone () {
      return new BigNumber(this);
    };
  }

  // extend BigNumber with a function convert
  if (typeof BigNumber.convert !== 'function') {
    /**
     * Try to convert a Number in to a BigNumber.
     * If the number has 15 or mor significant digits, the Number cannot be
     * converted to BigNumber and will return the original number.
     * @param {Number} number
     * @return {BigNumber | Number} bignumber
     */
    BigNumber.convert = function convert(number) {
      if (digits(number) > 15) {
        return number;
      }
      else {
        return new BigNumber(number);
      }
    };
  }
  else {
    throw new Error('Cannot add function convert to BigNumber: function already exists');
  }

  // errors
  math.error = require('./error/index');

  // types (Matrix, Complex, Unit, ...)
  math.type = {};
  math.type.Complex = require('./type/Complex');
  math.type.Range = require('./type/Range');
  math.type.Index = require('./type/Index');
  math.type.Matrix = require('./type/Matrix');
  math.type.Unit = require('./type/Unit');
  math.type.Help = require('./type/Help');
  math.type.BigNumber = BigNumber;

  math.collection = require('./type/collection');

  // expression (parse, Parser, nodes, docs)
  math.expression = {};
  math.expression.node = require('./expression/node/index.js');
  math.expression.parse = require('./expression/parse.js');
  math.expression.Parser = require('./expression/Parser.js');
  math.expression.docs = require('./expression/docs/index.js');

  // expression parser
  require('./function/expression/compile.js')(math, _config);
  require('./function/expression/eval.js')(math, _config);
  require('./function/expression/help.js')(math, _config);
  require('./function/expression/parse.js')(math, _config);

  // functions - arithmetic
  require('./function/arithmetic/abs.js')(math, _config);
  require('./function/arithmetic/add.js')(math, _config);
  require('./function/arithmetic/ceil.js')(math, _config);
  require('./function/arithmetic/compare.js')(math, _config);
  require('./function/arithmetic/cube.js')(math, _config);
  require('./function/arithmetic/divide.js')(math, _config);
  require('./function/arithmetic/edivide.js')(math, _config);
  require('./function/arithmetic/emultiply.js')(math, _config);
  require('./function/arithmetic/epow.js')(math, _config);
  require('./function/arithmetic/equal.js')(math, _config);
  require('./function/arithmetic/exp.js')(math, _config);
  require('./function/arithmetic/fix.js')(math, _config);
  require('./function/arithmetic/floor.js')(math, _config);
  require('./function/arithmetic/gcd.js')(math, _config);
  require('./function/arithmetic/larger.js')(math, _config);
  require('./function/arithmetic/largereq.js')(math, _config);
  require('./function/arithmetic/lcm.js')(math, _config);
  require('./function/arithmetic/log.js')(math, _config);
  require('./function/arithmetic/log10.js')(math, _config);
  require('./function/arithmetic/mod.js')(math, _config);
  require('./function/arithmetic/multiply.js')(math, _config);
  require('./function/arithmetic/norm.js')(math, _config);
  require('./function/arithmetic/pow.js')(math, _config);
  require('./function/arithmetic/round.js')(math, _config);
  require('./function/arithmetic/sign.js')(math, _config);
  require('./function/arithmetic/smaller.js')(math, _config);
  require('./function/arithmetic/smallereq.js')(math, _config);
  require('./function/arithmetic/sqrt.js')(math, _config);
  require('./function/arithmetic/square.js')(math, _config);
  require('./function/arithmetic/subtract.js')(math, _config);
  require('./function/arithmetic/unary.js')(math, _config);
  require('./function/arithmetic/unequal.js')(math, _config);
  require('./function/arithmetic/xgcd.js')(math, _config);

  // functions - complex
  require('./function/complex/arg.js')(math, _config);
  require('./function/complex/conj.js')(math, _config);
  require('./function/complex/re.js')(math, _config);
  require('./function/complex/im.js')(math, _config);

  // functions - construction
  require('./function/construction/bignumber')(math, _config);
  require('./function/construction/boolean.js')(math, _config);
  require('./function/construction/complex.js')(math, _config);
  require('./function/construction/index.js')(math, _config);
  require('./function/construction/matrix.js')(math, _config);
  require('./function/construction/number.js')(math, _config);
  require('./function/construction/parser.js')(math, _config);
  require('./function/construction/select.js')(math, _config);
  require('./function/construction/string.js')(math, _config);
  require('./function/construction/unit.js')(math, _config);

  // functions - matrix
  require('./function/matrix/concat.js')(math, _config);
  require('./function/matrix/det.js')(math, _config);
  require('./function/matrix/diag.js')(math, _config);
  require('./function/matrix/eye.js')(math, _config);
  require('./function/matrix/inv.js')(math, _config);
  require('./function/matrix/ones.js')(math, _config);
  require('./function/matrix/range.js')(math, _config);
  require('./function/matrix/resize.js')(math, _config);
  require('./function/matrix/size.js')(math, _config);
  require('./function/matrix/squeeze.js')(math, _config);
  require('./function/matrix/subset.js')(math, _config);
  require('./function/matrix/transpose.js')(math, _config);
  require('./function/matrix/zeros.js')(math, _config);

  // functions - probability
  require('./function/probability/factorial.js')(math, _config);
  require('./function/probability/random.js')(math, _config);
  require('./function/probability/permutations.js')(math, _config);
  require('./function/probability/combinations.js')(math, _config);

  // functions - statistics
  require('./function/statistics/min.js')(math, _config);
  require('./function/statistics/max.js')(math, _config);
  require('./function/statistics/mean.js')(math, _config);
  require('./function/statistics/median.js')(math, _config);
  require('./function/statistics/prod.js')(math, _config);
  require('./function/statistics/std.js')(math, _config);
  require('./function/statistics/sum.js')(math, _config);
  require('./function/statistics/var.js')(math, _config);

  // functions - trigonometry
  require('./function/trigonometry/acos.js')(math, _config);
  require('./function/trigonometry/asin.js')(math, _config);
  require('./function/trigonometry/atan.js')(math, _config);
  require('./function/trigonometry/atan2.js')(math, _config);
  require('./function/trigonometry/cos.js')(math, _config);
  require('./function/trigonometry/cosh.js')(math, _config);
  require('./function/trigonometry/cot.js')(math, _config);
  require('./function/trigonometry/coth.js')(math, _config);
  require('./function/trigonometry/csc.js')(math, _config);
  require('./function/trigonometry/csch.js')(math, _config);
  require('./function/trigonometry/sec.js')(math, _config);
  require('./function/trigonometry/sech.js')(math, _config);
  require('./function/trigonometry/sin.js')(math, _config);
  require('./function/trigonometry/sinh.js')(math, _config);
  require('./function/trigonometry/tan.js')(math, _config);
  require('./function/trigonometry/tanh.js')(math, _config);

  // functions - units
  require('./function/units/to.js')(math, _config);

  // functions - utils
  require('./function/utils/clone.js')(math, _config);
  require('./function/utils/format.js')(math, _config);
  require('./function/utils/ifElse.js')(math, _config);
  require('./function/utils/import.js')(math, _config);
  require('./function/utils/map.js')(math, _config);
  require('./function/utils/print.js')(math, _config);
  require('./function/utils/typeof.js')(math, _config);
  require('./function/utils/forEach.js')(math, _config);

  // constants
  require('./constants.js')(math, _config);

  // selector (we initialize after all functions are loaded)
  math.chaining = {};
  math.chaining.Selector = require('./chaining/Selector.js')(math, _config);

  // apply provided configuration options
  math.config(config);

  // return the new instance
  return math;
}


// return the mathjs factory
module.exports = mathjs;

},{"./chaining/Selector.js":26,"./constants.js":27,"./error/index":32,"./expression/Parser.js":33,"./expression/docs/index.js":147,"./expression/node/index.js":162,"./expression/parse.js":163,"./function/arithmetic/abs.js":164,"./function/arithmetic/add.js":165,"./function/arithmetic/ceil.js":166,"./function/arithmetic/compare.js":167,"./function/arithmetic/cube.js":168,"./function/arithmetic/divide.js":169,"./function/arithmetic/edivide.js":170,"./function/arithmetic/emultiply.js":171,"./function/arithmetic/epow.js":172,"./function/arithmetic/equal.js":173,"./function/arithmetic/exp.js":174,"./function/arithmetic/fix.js":175,"./function/arithmetic/floor.js":176,"./function/arithmetic/gcd.js":177,"./function/arithmetic/larger.js":178,"./function/arithmetic/largereq.js":179,"./function/arithmetic/lcm.js":180,"./function/arithmetic/log.js":181,"./function/arithmetic/log10.js":182,"./function/arithmetic/mod.js":183,"./function/arithmetic/multiply.js":184,"./function/arithmetic/norm.js":185,"./function/arithmetic/pow.js":186,"./function/arithmetic/round.js":187,"./function/arithmetic/sign.js":188,"./function/arithmetic/smaller.js":189,"./function/arithmetic/smallereq.js":190,"./function/arithmetic/sqrt.js":191,"./function/arithmetic/square.js":192,"./function/arithmetic/subtract.js":193,"./function/arithmetic/unary.js":194,"./function/arithmetic/unequal.js":195,"./function/arithmetic/xgcd.js":196,"./function/complex/arg.js":197,"./function/complex/conj.js":198,"./function/complex/im.js":199,"./function/complex/re.js":200,"./function/construction/bignumber":201,"./function/construction/boolean.js":202,"./function/construction/complex.js":203,"./function/construction/index.js":204,"./function/construction/matrix.js":205,"./function/construction/number.js":206,"./function/construction/parser.js":207,"./function/construction/select.js":208,"./function/construction/string.js":209,"./function/construction/unit.js":210,"./function/expression/compile.js":211,"./function/expression/eval.js":212,"./function/expression/help.js":213,"./function/expression/parse.js":214,"./function/matrix/concat.js":215,"./function/matrix/det.js":216,"./function/matrix/diag.js":217,"./function/matrix/eye.js":218,"./function/matrix/inv.js":219,"./function/matrix/ones.js":220,"./function/matrix/range.js":221,"./function/matrix/resize.js":222,"./function/matrix/size.js":223,"./function/matrix/squeeze.js":224,"./function/matrix/subset.js":225,"./function/matrix/transpose.js":226,"./function/matrix/zeros.js":227,"./function/probability/combinations.js":228,"./function/probability/factorial.js":229,"./function/probability/permutations.js":230,"./function/probability/random.js":231,"./function/statistics/max.js":232,"./function/statistics/mean.js":233,"./function/statistics/median.js":234,"./function/statistics/min.js":235,"./function/statistics/prod.js":236,"./function/statistics/std.js":237,"./function/statistics/sum.js":238,"./function/statistics/var.js":239,"./function/trigonometry/acos.js":240,"./function/trigonometry/asin.js":241,"./function/trigonometry/atan.js":242,"./function/trigonometry/atan2.js":243,"./function/trigonometry/cos.js":244,"./function/trigonometry/cosh.js":245,"./function/trigonometry/cot.js":246,"./function/trigonometry/coth.js":247,"./function/trigonometry/csc.js":248,"./function/trigonometry/csch.js":249,"./function/trigonometry/sec.js":250,"./function/trigonometry/sech.js":251,"./function/trigonometry/sin.js":252,"./function/trigonometry/sinh.js":253,"./function/trigonometry/tan.js":254,"./function/trigonometry/tanh.js":255,"./function/units/to.js":256,"./function/utils/clone.js":257,"./function/utils/forEach.js":258,"./function/utils/format.js":259,"./function/utils/ifElse.js":260,"./function/utils/import.js":261,"./function/utils/map.js":262,"./function/utils/print.js":263,"./function/utils/typeof.js":264,"./type/Complex":266,"./type/Help":267,"./type/Index":268,"./type/Matrix":269,"./type/Range":270,"./type/Unit":271,"./type/collection":272,"./util/object":279,"decimal.js":282}],266:[function(require,module,exports){
var util = require('../util/index'),
    Unit = require('./Unit'),
    number = util.number,

    isNumber = util.number.isNumber,
    isUnit = Unit.isUnit,
    isString = util.string.isString;

/**
 * @constructor Complex
 *
 * A complex value can be constructed in the following ways:
 *     var a = new Complex();
 *     var b = new Complex(re, im);
 *     var c = Complex.parse(str);
 *
 * Example usage:
 *     var a = new Complex(3, -4);      // 3 - 4i
 *     a.re = 5;                        // a = 5 - 4i
 *     var i = a.im;                    // -4;
 *     var b = Complex.parse('2 + 6i'); // 2 + 6i
 *     var c = new Complex();           // 0 + 0i
 *     var d = math.add(a, b);          // 5 + 2i
 *
 * @param {Number} re       The real part of the complex value
 * @param {Number} [im]     The imaginary part of the complex value
 */
function Complex(re, im) {
  if (!(this instanceof Complex)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  switch (arguments.length) {
    case 0:
      this.re = 0;
      this.im = 0;
      break;

    case 1:
      var arg = arguments[0];
      if (typeof arg === 'object') {
        if('re' in arg && 'im' in arg) {
          var construct = new Complex(arg.re, arg.im); // pass on input validation
          this.re = construct.re;
          this.im = construct.im;
          break;
        } else if ('r' in arg && 'phi' in arg) {
          var construct = Complex.fromPolar(arg.r, arg.phi);
          this.re = construct.re;
          this.im = construct.im;
          break;
        }
      } 
      throw new SyntaxError('Object with the re and im or r and phi properties expected.');

    case 2:
      if (!isNumber(re) || !isNumber(im)) {
        throw new TypeError('Two numbers expected in Complex constructor');
      }
      this.re = re;
      this.im = im;
      break;

    default:
      throw new SyntaxError('One, two or three arguments expected in Complex constructor');
  }
}

/**
 * Test whether value is a Complex value
 * @param {*} value
 * @return {Boolean} isComplex
 */
Complex.isComplex = function isComplex(value) {
  return (value instanceof Complex);
};

// private variables and functions for the parser
var text, index, c;

function skipWhitespace() {
  while (c == ' ' || c == '\t') {
    next();
  }
}

function isDigitDot (c) {
  return ((c >= '0' && c <= '9') || c == '.');
}

function isDigit (c) {
  return ((c >= '0' && c <= '9'));
}

function next() {
  index++;
  c = text.charAt(index);
}

function revert(oldIndex) {
  index = oldIndex;
  c = text.charAt(index);
}

function parseNumber () {
  var number = '';
  var oldIndex;
  oldIndex = index;

  if (c == '+') {
    next();
  }
  else if (c == '-') {
    number += c;
    next();
  }

  if (!isDigitDot(c)) {
    // a + or - must be followed by a digit
    revert(oldIndex);
    return null;
  }

  // get number, can have a single dot
  if (c == '.') {
    number += c;
    next();
    if (!isDigit(c)) {
      // this is no legal number, it is just a dot
      revert(oldIndex);
      return null;
    }
  }
  else {
    while (isDigit(c)) {
      number += c;
      next();
    }
    if (c == '.') {
      number += c;
      next();
    }
  }
  while (isDigit(c)) {
    number += c;
    next();
  }

  // check for exponential notation like "2.3e-4" or "1.23e50"
  if (c == 'E' || c == 'e') {
    number += c;
    next();

    if (c == '+' || c == '-') {
      number += c;
      next();
    }

    // Scientific notation MUST be followed by an exponent
    if (!isDigit(c)) {
      // this is no legal number, exponent is missing.
      revert(oldIndex);
      return null;
    }

    while (isDigit(c)) {
      number += c;
      next();
    }
  }

  return number;
}

function parseComplex () {
  // check for 'i', '-i', '+i'
  var cnext = text.charAt(index + 1);
  if (c == 'I' || c == 'i') {
    next();
    return '1';
  }
  else if ((c == '+' || c == '-') && (cnext == 'I' || cnext == 'i')) {
    var number = (c == '+') ? '1' : '-1';
    next();
    next();
    return number;
  }

  return null;
}

/**
 * Parse a complex number from a string. For example Complex.parse("2 + 3i")
 * will return a Complex value where re = 2, im = 3.
 * Returns null if provided string does not contain a valid complex number.
 * @param {String} str
 * @returns {Complex | null} complex
 */
Complex.parse = function parse (str) {
  text = str;
  index = -1;
  c = '';

  if (!isString(text)) {
    return null;
  }

  next();
  skipWhitespace();
  var first = parseNumber();
  if (first) {
    if (c == 'I' || c == 'i') {
      // pure imaginary number
      next();
      skipWhitespace();
      if (c) {
        // garbage at the end. not good.
        return null;
      }

      return new Complex(0, Number(first));
    }
    else {
      // complex and real part
      skipWhitespace();
      var separator = c;
      if (separator != '+' && separator != '-') {
        // pure real number
        skipWhitespace();
        if (c) {
          // garbage at the end. not good.
          return null;
        }

        return new Complex(Number(first), 0);
      }
      else {
        // complex and real part
        next();
        skipWhitespace();
        var second = parseNumber();
        if (second) {
          if (c != 'I' && c != 'i') {
            // 'i' missing at the end of the complex number
            return null;
          }
          next();
        }
        else {
          second = parseComplex();
          if (!second) {
            // imaginary number missing after separator
            return null;
          }
        }

        if (separator == '-') {
          if (second[0] == '-') {
            second =  '+' + second.substring(1);
          }
          else {
            second = '-' + second;
          }
        }

        next();
        skipWhitespace();
        if (c) {
          // garbage at the end. not good.
          return null;
        }

        return new Complex(Number(first), Number(second));
      }
    }
  }
  else {
    // check for 'i', '-i', '+i'
    first = parseComplex();
    if (first) {
      skipWhitespace();
      if (c) {
        // garbage at the end. not good.
        return null;
      }

      return new Complex(0, Number(first));
    }
  }

  return null;
};

/**
 * Create a complex number from polar coordinates
 *
 * Usage:
 *
 *     Complex.fromPolar(r: Number, phi: Number) : Complex
 *     Complex.fromPolar({r: Number, phi: Number}) : Complex
 *
 * @param {*} args...
 * @return {Complex}
 */
Complex.fromPolar = function fromPolar(args) {
  switch (arguments.length) {
    case 1:
      var arg = arguments[0];
      if(typeof arg === 'object') {
        return Complex.fromPolar(arg.r, arg.phi);
      }
      throw new TypeError('Input has to be an object with r and phi keys.');

    case 2:
      var r = arguments[0],
        phi = arguments[1];
      if(isNumber(r)) {
        if (isUnit(phi) && phi.hasBase(Unit.BASE_UNITS.ANGLE)) {
          // convert unit to a number in radians
          phi = phi.toNumber('rad');
        }

        if(isNumber(phi)) {
          return new Complex(r * Math.cos(phi), r * Math.sin(phi));
        }

        throw new TypeError('Phi is not a number nor an angle unit.');
      } else {
        throw new TypeError('Radius r is not a number.');
      }

    default:
      throw new SyntaxError('Wrong number of arguments in function fromPolar');
  }
};

/*
 * Return the value of the complex number in polar notation
 * The angle phi will be set in the interval of [-pi, pi].
 * @return {{r: number, phi: number}} Returns and object with properties r and phi.
 */
Complex.prototype.toPolar = function() {
  return {
    r: Math.sqrt(this.re * this.re + this.im * this.im),
    phi: Math.atan2(this.im, this.re)
  };
};

/**
 * Create a copy of the complex value
 * @return {Complex} clone
 */
Complex.prototype.clone = function clone () {
  return new Complex(this.re, this.im);
};

/**
 * Test whether this complex number equals an other complex value.
 * Two complex numbers are equal when both their real and imaginary parts
 * are equal.
 * @param {Complex} other
 * @return {boolean} isEqual
 */
Complex.prototype.equals = function equals (other) {
  return (this.re === other.re) && (this.im === other.im);
};

/**
 * Get a string representation of the complex number,
 * with optional formatting options.
 * @param {Object | Number | Function} [options]  Formatting options. See
 *                                                lib/util/number:format for a
 *                                                description of the available
 *                                                options.
 * @return {String} str
 */
Complex.prototype.format = function format (options) {
  var str = '',
      strRe = number.format(this.re, options),
      strIm = number.format(this.im, options);

  if (this.im == 0) {
    // real value
    str = strRe;
  }
  else if (this.re == 0) {
    // purely complex value
    if (this.im == 1) {
      str = 'i';
    }
    else if (this.im == -1) {
      str = '-i';
    }
    else {
      str = strIm + 'i';
    }
  }
  else {
    // complex value
    if (this.im > 0) {
      if (this.im == 1) {
        str = strRe + ' + i';
      }
      else {
        str = strRe + ' + ' + strIm + 'i';
      }
    }
    else {
      if (this.im == -1) {
        str = strRe + ' - i';
      }
      else {
        str = strRe + ' - ' + strIm.substring(1) + 'i';
      }
    }
  }

  return str;
};

/**
 * Get a string representation of the complex number.
 * @return {String} str
 */
Complex.prototype.toString = function toString () {
  return this.format();
};

// exports
module.exports = Complex;

},{"../util/index":276,"./Unit":271}],267:[function(require,module,exports){
var util = require('../util/index'),
    object = util.object,
    string = util.string;

/**
 * Documentation object
 * @param {Object} math The math.js namespace
 * @param {Object} doc  Object containing properties:
 *                      {String} name
 *                      {String} category
 *                      {String[]} syntax
 *                      {String[]} examples
 *                      {String[]} seealso
 * @constructor
 */
function Help (math, doc) {
  if (!(this instanceof Help)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  // TODO: throw an error when math or doc is not provided

  this.math = math;
  this.doc = doc;
}

/**
 * Test whether a value is an instance of Help
 * @param {*} value
 * @return {Boolean} isHelp
 */
Help.isHelp = function isHelp (value) {
  return (value instanceof Help);
};

/**
 * Generate readable description from a Help object
 * @return {String} readableDoc
 * @private
 */
Help.prototype.toString = function () {
  var doc = this.doc || {};
  var desc = '\n';

  if (doc.name) {
    desc += 'Name: ' + doc.name + '\n\n';
  }
  if (doc.category) {
    desc += 'Category: ' + doc.category + '\n\n';
  }
  if (doc.description) {
    desc += 'Description:\n    ' + doc.description + '\n\n';
  }
  if (doc.syntax) {
    desc += 'Syntax:\n    ' + doc.syntax.join('\n    ') + '\n\n';
  }
  if (doc.examples) {
    var parser = this.math.parser();
    desc += 'Examples:\n';
    for (var i = 0; i < doc.examples.length; i++) {
      var expr = doc.examples[i];
      var res;
      try {
        res = parser.eval(expr);
      }
      catch (e) {
        res = e;
      }
      desc += '    ' + expr + '\n';
      if (res && !(res instanceof Help)) {
        desc += '        ' + string.format(res) + '\n';
      }
    }
    desc += '\n';
  }
  if (doc.seealso) {
    desc += 'See also: ' + doc.seealso.join(', ') + '\n';
  }

  return desc;
};

// TODO: implement a toHTML function in Help

/**
 * Export the help object to JSON
 */
Help.prototype.toJSON = function () {
  return object.clone(this.doc);
};

// exports
module.exports = Help;

},{"../util/index":276}],268:[function(require,module,exports){
var util = require('../util/index'),

    Range = require('./Range'),

    number = util.number,

    isNumber = number.isNumber,
    isInteger = number.isInteger,
    isArray = Array.isArray,
    validateIndex = util.array.validateIndex;

/**
 * @Constructor Index
 * Create an index. An Index can store ranges having start, step, and end
 * for multiple dimensions.
 * Matrix.get, Matrix.set, and math.subset accept an Index as input.
 *
 * Usage:
 *     var index = new Index(range1, range2, ...);
 *
 * Where each range can be any of:
 *     An array [start, end]
 *     An array [start, end, step]
 *     A number
 *     An instance of Range
 *
 * The parameters start, end, and step must be integer numbers.
 *
 * @param {...*} ranges
 */
function Index(ranges) {
  if (!(this instanceof Index)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  this._ranges = [];

  for (var i = 0, ii = arguments.length; i < ii; i++) {
    var arg = arguments[i];

    if (arg instanceof Range) {
      this._ranges.push(arg);
    }
    else {
      if (isArray(arg)) {
        this._ranges.push(_createRange(arg));
      }
      else if (isNumber(arg)) {
        this._ranges.push(_createRange([arg, arg + 1]));
      }
      // TODO: implement support for wildcard '*'
      else {
        throw new TypeError('Ranges must be an Array, Number, or Range');
      }
    }
  }
}

/**
 * Parse an argument into a range and validate the range
 * @param {Array} arg  An array with [start: Number, end: Number] and
 *                     optional a third element step:Number
 * @return {Range} range
 * @private
 */
function _createRange(arg) {
  // TODO: make function _createRange simpler/faster

  // test whether all arguments are integers
  var num = arg.length;
  for (var i = 0; i < num; i++) {
    if (!isNumber(arg[i]) || !isInteger(arg[i])) {
      throw new TypeError('Index parameters must be integer numbers');
    }
  }

  switch (arg.length) {
    case 2:
      return new Range(arg[0], arg[1]); // start, end
    case 3:
      return new Range(arg[0], arg[1], arg[2]); // start, end, step
    default:
      // TODO: improve error message
      throw new SyntaxError('Wrong number of arguments in Index (2 or 3 expected)');
  }
}

/**
 * Create a clone of the index
 * @return {Index} clone
 */
Index.prototype.clone = function clone () {
  var index = new Index();
  index._ranges = util.object.clone(this._ranges);
  return index;
};

/**
 * Test whether an object is an Index
 * @param {*} object
 * @return {Boolean} isIndex
 */
Index.isIndex = function isIndex(object) {
  return (object instanceof Index);
};

/**
 * Create an index from an array with ranges/numbers
 * @param {Array.<Array | Number>} ranges
 * @return {Index} index
 * @private
 */
Index.create = function create(ranges) {
  var index = new Index();
  Index.apply(index, ranges);
  return index;
};

/**
 * Retrieve the size of the index, the number of elements for each dimension.
 * @returns {Number[]} size
 */
Index.prototype.size = function size () {
  var size = [];

  for (var i = 0, ii = this._ranges.length; i < ii; i++) {
    var range = this._ranges[i];

    size[i] = range.size()[0];
  }

  return size;
};

/**
 * Get the maximum value for each of the indexes ranges.
 * @returns {Number[]} max
 */
Index.prototype.max = function max () {
  var values = [];

  for (var i = 0, ii = this._ranges.length; i < ii; i++) {
    var range = this._ranges[i];
    values[i] = range.max();
  }

  return values;
};

/**
 * Get the minimum value for each of the indexes ranges.
 * @returns {Number[]} min
 */
Index.prototype.min = function min () {
  var values = [];

  for (var i = 0, ii = this._ranges.length; i < ii; i++) {
    var range = this._ranges[i];

    values[i] = range.min();
  }

  return values;
};

/**
 * Loop over each of the ranges of the index
 * @param {function} callback   Called for each range with a Range as first
 *                              argument, the dimension as second, and the
 *                              index object as third.
 */
Index.prototype.forEach = function forEach(callback) {
  for (var i = 0, ii = this._ranges.length; i < ii; i++) {
    callback(this._ranges[i], i, this);
  }
};

/**
 * Retrieve the range for a given dimension number from the index
 * @param {Number} dim                  Number of the dimension
 * @returns {Range | null} range
 */
Index.prototype.range = function range (dim) {
  return this._ranges[dim] || null;
};

/**
 * Test whether this index contains only a single value
 * @return {boolean} isScalar
 */
Index.prototype.isScalar = function isScalar () {
  var size = this.size();

  for (var i = 0, ii = size.length; i < ii; i++) {
    if (size[i] !== 1) {
      return false;
    }
  }

  return true;
};

/**
 * Expand the Index into an array.
 * For example new Index([0,3], [2,7]) returns [[0,1,2], [2,3,4,5,6]]
 * @returns {Array} array
 */
Index.prototype.toArray = function toArray() {
  var array = [];
  for (var i = 0, ii = this._ranges.length; i < ii; i++) {
    var range = this._ranges[i],
        row = [],
        x = range.start,
        end = range.end,
        step = range.step;

    if (step > 0) {
      while (x < end) {
        row.push(x);
        x += step;
      }
    }
    else if (step < 0) {
      while (x > end) {
        row.push(x);
        x += step;
      }
    }

    array.push(row);
  }

  return array;
};

/**
 * Get the primitive value of the Index, a two dimensional array.
 * Equivalent to Index.toArray().
 * @returns {Array} array
 */
Index.prototype.valueOf = Index.prototype.toArray;

/**
 * Get the string representation of the index, for example '[2:6]' or '[0:2:10, 4:7]'
 * @returns {String} str
 */
Index.prototype.toString = function () {
  var strings = [];

  for (var i = 0, ii = this._ranges.length; i < ii; i++) {
    var range = this._ranges[i];
    var str = number.format(range.start);
    if (range.step != 1) {
      str += ':' + number.format(range.step);
    }
    str += ':' + number.format(range.end);
    strings.push(str);
  }

  return '[' + strings.join(', ') + ']';
};

// exports
module.exports = Index;

},{"../util/index":276,"./Range":270}],269:[function(require,module,exports){
var util = require('../util/index'),
    DimensionError = require('../error/DimensionError'),

    Index = require('./Index'),

    number = util.number,
    string = util.string,
    array = util.array,
    object = util.object,

    isArray = Array.isArray,
    validateIndex = array.validateIndex;

/**
 * @constructor Matrix
 *
 * A Matrix is a wrapper around an Array. A matrix can hold a multi dimensional
 * array. A matrix can be constructed as:
 *     var matrix = new Matrix(data)
 *
 * Matrix contains the functions to resize, get and set values, get the size,
 * clone the matrix and to convert the matrix to a vector, array, or scalar.
 * Furthermore, one can iterate over the matrix using map and forEach.
 * The internal Array of the Matrix can be accessed using the function valueOf.
 *
 * Example usage:
 *     var matrix = new Matrix([[1, 2], [3, 4]);
 *     matix.size();              // [2, 2]
 *     matrix.resize([3, 2], 5);
 *     matrix.valueOf();          // [[1, 2], [3, 4], [5, 5]]
 *     matrix.subset([1,2])       // 3 (indexes are zero-based)
 *
 * @param {Array | Matrix} [data]    A multi dimensional array
 */
function Matrix(data) {
  if (!(this instanceof Matrix)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  if (data instanceof Matrix) {
    // clone data from a Matrix
    this._data = data.clone()._data;
  }
  else if (isArray(data)) {
    // use array
    // replace nested Matrices with Arrays
    this._data = preprocess(data);
  }
  else if (data != null) {
    // unsupported type
    throw new TypeError('Unsupported type of data (' + util.types.type(data) + ')');
  }
  else {
    // nothing provided
    this._data = [];
  }

  // verify the size of the array
  this._size = array.size(this._data);
}

/**
 * Test whether an object is a Matrix
 * @param {*} object
 * @return {Boolean} isMatrix
 */
Matrix.isMatrix = function isMatrix(object) {
  return (object instanceof Matrix);
};

/**
 * Get a subset of the matrix, or replace a subset of the matrix.
 *
 * Usage:
 *     var subset = matrix.subset(index)               // retrieve subset
 *     var value = matrix.subset(index, replacement)   // replace subset
 *
 * @param {Index} index
 * @param {Array | Matrix | *} [replacement]
 * @param {*} [defaultValue]        Default value, filled in on new entries when
 *                                  the matrix is resized. If not provided,
 *                                  new matrix elements will be left undefined.
 */
Matrix.prototype.subset = function subset(index, replacement, defaultValue) {
  switch (arguments.length) {
    case 1:
      return _get(this, index);

    // intentional fall through
    case 2:
    case 3:
      return _set(this, index, replacement, defaultValue);

    default:
      throw new SyntaxError('Wrong number of arguments');
  }
};

/**
 * Get a single element from the matrix.
 * @param {Number[]} index   Zero-based index
 * @return {*} value
 */
Matrix.prototype.get = function get(index) {
  if (!isArray(index)) {
    throw new TypeError('Array expected');
  }
  if (index.length != this._size.length) {
    throw new DimensionError(index.length, this._size.length);
  }

  var data = this._data;
  for (var i = 0, ii = index.length; i < ii; i++) {
    var index_i = index[i];
    validateIndex(index_i, data.length);
    data = data[index_i];
  }

  return object.clone(data);
};

/**
 * Replace a single element in the matrix.
 * @param {Number[]} index   Zero-based index
 * @param {*} value
 * @param {*} [defaultValue]        Default value, filled in on new entries when
 *                                  the matrix is resized. If not provided,
 *                                  new matrix elements will be left undefined.
 * @return {Matrix} self
 */
Matrix.prototype.set = function set (index, value, defaultValue) {
  var i, ii;

  // validate input type and dimensions
  if (!isArray(index)) {
    throw new Error('Array expected');
  }
  if (index.length < this._size.length) {
    throw new DimensionError(index.length, this._size.length, '<');
  }

  // enlarge matrix when needed
  var size = index.map(function (i) {
    return i + 1;
  });
  _fit(this, size, defaultValue);

  // traverse over the dimensions
  var data = this._data;
  for (i = 0, ii = index.length - 1; i < ii; i++) {
    var index_i = index[i];
    validateIndex(index_i, data.length);
    data = data[index_i];
  }

  // set new value
  index_i = index[index.length - 1];
  validateIndex(index_i, data.length);
  data[index_i] = value;

  return this;
};

/**
 * Get a submatrix of this matrix
 * @param {Matrix} matrix
 * @param {Index} index   Zero-based index
 * @private
 */
function _get (matrix, index) {
  if (!(index instanceof Index)) {
    throw new TypeError('Invalid index');
  }

  var isScalar = index.isScalar();
  if (isScalar) {
    // return a scalar
    return matrix.get(index.min());
  }
  else {
    // validate dimensions
    var size = index.size();
    if (size.length != matrix._size.length) {
      throw new DimensionError(size.length, matrix._size.length);
    }

    // retrieve submatrix
    var submatrix = new Matrix(_getSubmatrix(matrix._data, index, size.length, 0));
    // TODO: more efficient when creating an empty matrix and setting _data and _size manually

    // squeeze matrix output
    while (isArray(submatrix._data) && submatrix._data.length == 1) {
      submatrix._data = submatrix._data[0];
      submatrix._size.shift();
    }

    return submatrix;
  }
}

/**
 * Recursively get a submatrix of a multi dimensional matrix.
 * Index is not checked for correct number of dimensions.
 * @param {Array} data
 * @param {Index} index
 * @param {number} dims   Total number of dimensions
 * @param {number} dim    Current dimension
 * @return {Array} submatrix
 * @private
 */
function _getSubmatrix (data, index, dims, dim) {
  var last = (dim == dims - 1);
  var range = index.range(dim);

  if (last) {
    return range.map(function (i) {
      validateIndex(i, data.length);
      return data[i];
    });
  }
  else {
    return range.map(function (i) {
      validateIndex(i, data.length);
      var child = data[i];
      return _getSubmatrix(child, index, dims, dim + 1);
    });
  }
}

/**
 * Replace a submatrix in this matrix
 * Indexes are zero-based.
 * @param {Matrix} matrix
 * @param {Index} index
 * @param {Matrix | Array | *} submatrix
 * @param {*} [defaultValue]        Default value, filled in on new entries when
 *                                  the matrix is resized. If not provided,
 *                                  new matrix elements will be left undefined.
 * @return {Matrix} matrix
 * @private
 */
function _set (matrix, index, submatrix, defaultValue) {
  if (!(index instanceof Index)) {
    throw new TypeError('Invalid index');
  }

  // get index size and check whether the index contains a single value
  var iSize = index.size(),
      isScalar = index.isScalar();

  // calculate the size of the submatrix, and convert it into an Array if needed
  var sSize;
  if (submatrix instanceof Matrix) {
    sSize = submatrix.size();
    submatrix = submatrix.valueOf();
  }
  else {
    sSize = array.size(submatrix);
  }

  if (isScalar) {
    // set a scalar

    // check whether submatrix is a scalar
    if (sSize.length != 0) {
      throw new TypeError('Scalar expected');
    }

    matrix.set(index.min(), submatrix, defaultValue);
  }
  else {
    // set a submatrix

    // validate dimensions
    if (iSize.length < matrix._size.length) {
      throw new DimensionError(iSize.length, matrix._size.length, '<');
    }

    // unsqueeze the submatrix when needed
    for (var i = 0, ii = iSize.length - sSize.length; i < ii; i++) {
      submatrix = [submatrix];
      sSize.unshift(1);
    }

    // check whether the size of the submatrix matches the index size
    if (!object.deepEqual(iSize, sSize)) {
      throw new DimensionError(iSize, sSize);
    }

    // enlarge matrix when needed
    var size = index.max().map(function (i) {
      return i + 1;
    });
    _fit(matrix, size, defaultValue);

    // insert the sub matrix
    var dims = iSize.length,
        dim = 0;
    _setSubmatrix (matrix._data, index, submatrix, dims, dim);
  }

  return matrix;
}

/**
 * Replace a submatrix of a multi dimensional matrix.
 * @param {Array} data
 * @param {Index} index
 * @param {Array} submatrix
 * @param {number} dims   Total number of dimensions
 * @param {number} dim
 * @private
 */
function _setSubmatrix (data, index, submatrix, dims, dim) {
  var last = (dim == dims - 1),
      range = index.range(dim);

  if (last) {
    range.forEach(function (dataIndex, subIndex) {
      validateIndex(dataIndex);
      data[dataIndex] = submatrix[subIndex];
    });
  }
  else {
    range.forEach(function (dataIndex, subIndex) {
      validateIndex(dataIndex);
      _setSubmatrix(data[dataIndex], index, submatrix[subIndex], dims, dim + 1);
    });
  }
}

/**
 * Resize the matrix
 * @param {Number[]} size
 * @param {*} [defaultValue]        Default value, filled in on new entries.
 *                                  If not provided, the matrix elements will
 *                                  be left undefined.
 * @return {Matrix} self            The matrix itself is returned
 */
Matrix.prototype.resize = function resize(size, defaultValue) {
  this._size = object.clone(size);
  this._data = array.resize(this._data, this._size, defaultValue);

  // return the matrix itself
  return this;
};

/**
 * Enlarge the matrix when it is smaller than given size.
 * If the matrix is larger or equal sized, nothing is done.
 * @param {Matrix} matrix           The matrix to be resized
 * @param {Number[]} size
 * @param {*} [defaultValue]        Default value, filled in on new entries.
 *                                  If not provided, the matrix elements will
 *                                  be left undefined.
 * @private
 */
function _fit(matrix, size, defaultValue) {
  var newSize = object.clone(matrix._size),
      changed = false;

  // add dimensions when needed
  while (newSize.length < size.length) {
    newSize.unshift(0);
    changed = true;
  }

  // enlarge size when needed
  for (var i = 0, ii = size.length; i < ii; i++) {
    if (size[i] > newSize[i]) {
      newSize[i] = size[i];
      changed = true;
    }
  }

  if (changed) {
    // resize only when size is changed
    matrix.resize(newSize, defaultValue);
  }
}

/**
 * Create a clone of the matrix
 * @return {Matrix} clone
 */
Matrix.prototype.clone = function clone() {
  var matrix = new Matrix();
  matrix._data = object.clone(this._data);
  matrix._size = object.clone(this._size);
  return matrix;
};

/**
 * Retrieve the size of the matrix.
 * @returns {Number[]} size
 */
Matrix.prototype.size = function size() {
  return this._size;
};

/**
 * Create a new matrix with the results of the callback function executed on
 * each entry of the matrix.
 * @param {function} callback   The callback function is invoked with three
 *                              parameters: the value of the element, the index
 *                              of the element, and the Matrix being traversed.
 * @return {Matrix} matrix
 */
Matrix.prototype.map = function map(callback) {
  var me = this;
  var matrix = new Matrix();
  var index = [];
  var recurse = function (value, dim) {
    if (isArray(value)) {
      return value.map(function (child, i) {
        index[dim] = i;
        return recurse(child, dim + 1);
      });
    }
    else {
      return callback(value, index, me);
    }
  };
  matrix._data = recurse(this._data, 0);
  matrix._size = object.clone(this._size);

  return matrix;
};

/**
 * Execute a callback function on each entry of the matrix.
 * @param {function} callback   The callback function is invoked with three
 *                              parameters: the value of the element, the index
 *                              of the element, and the Matrix being traversed.
 */
Matrix.prototype.forEach = function forEach(callback) {
  var me = this;
  var index = [];
  var recurse = function (value, dim) {
    if (isArray(value)) {
      value.forEach(function (child, i) {
        index[dim] = i;
        recurse(child, dim + 1);
      });
    }
    else {
      callback(value, index, me);
    }
  };
  recurse(this._data, 0);
};

/**
 * Create an Array with a copy of the data of the Matrix
 * @returns {Array} array
 */
Matrix.prototype.toArray = function toArray() {
  return object.clone(this._data);
};

/**
 * Get the primitive value of the Matrix: a multidimensional array
 * @returns {Array} array
 */
Matrix.prototype.valueOf = function valueOf() {
  return this._data;
};

/**
 * Get a string representation of the matrix, with optional formatting options.
 * @param {Object | Number | Function} [options]  Formatting options. See
 *                                                lib/util/number:format for a
 *                                                description of the available
 *                                                options.
 * @returns {String} str
 */
Matrix.prototype.format = function format(options) {
  return string.format(this._data, options);
};

/**
 * Get a string representation of the matrix
 * @returns {String} str
 */
Matrix.prototype.toString = function toString() {
  return string.format(this._data);
};

/**
 * Preprocess data, which can be an Array or Matrix with nested Arrays and
 * Matrices. Replaces all nested Matrices with Arrays
 * @param {Array} data
 * @return {Array} data
 */
function preprocess(data) {
  for (var i = 0, ii = data.length; i < ii; i++) {
    var elem = data[i];
    if (isArray(elem)) {
      data[i] = preprocess(elem);
    }
    else if (elem instanceof Matrix) {
      data[i] = preprocess(elem._data);
    }
  }

  return data;
}

// exports
module.exports = Matrix;

},{"../error/DimensionError":29,"../util/index":276,"./Index":268}],270:[function(require,module,exports){
var util = require('../util/index'),

    number = util.number,
    string = util.string,
    array = util.array;

/**
 * @constructor Range
 * Create a range. A range has a start, step, and end, and contains functions
 * to iterate over the range.
 *
 * A range can be constructed as:
 *     var range = new Range(start, end);
 *     var range = new Range(start, end, step);
 *
 * To get the result of the range:
 *     range.forEach(function (x) {
 *         console.log(x);
 *     });
 *     range.map(function (x) {
 *         return math.sin(x);
 *     });
 *     range.toArray();
 *
 * Example usage:
 *     var c = new Range(2, 6);         // 2:1:5
 *     c.toArray();                     // [2, 3, 4, 5]
 *     var d = new Range(2, -3, -1);    // 2:-1:-2
 *     d.toArray();                     // [2, 1, 0, -1, -2]
 *
 * @param {Number} start  included lower bound
 * @param {Number} end    excluded upper bound
 * @param {Number} [step] step size, default value is 1
 */
function Range(start, end, step) {
  if (!(this instanceof Range)) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }

  if (start != null && !number.isNumber(start)) {
    throw new TypeError('Parameter start must be a number');
  }
  if (end != null && !number.isNumber(end)) {
    throw new TypeError('Parameter end must be a number');
  }
  if (step != null && !number.isNumber(step)) {
    throw new TypeError('Parameter step must be a number');
  }

  this.start = (start != null) ? parseFloat(start) : 0;
  this.end   = (end != null) ? parseFloat(end) : 0;
  this.step  = (step != null) ? parseFloat(step) : 1;
}

/**
 * Parse a string into a range,
 * The string contains the start, optional step, and end, separated by a colon.
 * If the string does not contain a valid range, null is returned.
 * For example str='0:2:11'.
 * @param {String} str
 * @return {Range | null} range
 */
Range.parse = function parse (str) {
  if (!string.isString(str)) {
    return null;
  }

  var args = str.split(':');
  var nums = args.map(function (arg) {
    return parseFloat(arg);
  });

  var invalid = nums.some(function (num) {
    return isNaN(num);
  });
  if(invalid) {
    return null;
  }

  switch (nums.length) {
    case 2: return new Range(nums[0], nums[1]);
    case 3: return new Range(nums[0], nums[2], nums[1]);
    default: return null;
  }
};

/**
 * Create a clone of the range
 * @return {Range} clone
 */
Range.prototype.clone = function clone() {
  return new Range(this.start, this.end, this.step);
};

/**
 * Test whether an object is a Range
 * @param {*} object
 * @return {Boolean} isRange
 */
Range.isRange = function isRange(object) {
  return (object instanceof Range);
};

/**
 * Retrieve the size of the range.
 * Returns an array containing one number, the number of elements in the range.
 * @returns {Number[]} size
 */
Range.prototype.size = function size() {
  var len = 0,
      start = this.start,
      step = this.step,
      end = this.end,
      diff = end - start;

  if (number.sign(step) == number.sign(diff)) {
    len = Math.ceil((diff) / step);
  }
  else if (diff == 0) {
    len = 0;
  }

  if (isNaN(len)) {
    len = 0;
  }
  return [len];
};

/**
 * Calculate the minimum value in the range
 * @return {Number | undefined} min
 */
Range.prototype.min = function min () {
  var size = this.size()[0];

  if (size > 0) {
    if (this.step > 0) {
      // positive step
      return this.start;
    }
    else {
      // negative step
      return this.start + (size - 1) * this.step;
    }
  }
  else {
    return undefined;
  }
};

/**
 * Calculate the maximum value in the range
 * @return {Number | undefined} max
 */
Range.prototype.max = function max () {
  var size = this.size()[0];

  if (size > 0) {
    if (this.step > 0) {
      // positive step
      return this.start + (size - 1) * this.step;
    }
    else {
      // negative step
      return this.start;
    }
  }
  else {
    return undefined;
  }
};


/**
 * Execute a callback function for each value in the range.
 * @param {function} callback   The callback method is invoked with three
 *                              parameters: the value of the element, the index
 *                              of the element, and the Matrix being traversed.
 */
Range.prototype.forEach = function forEach(callback) {
  var x = this.start;
  var step = this.step;
  var end = this.end;
  var i = 0;

  if (step > 0) {
    while (x < end) {
      callback(x, i, this);
      x += step;
      i++;
    }
  }
  else if (step < 0) {
    while (x > end) {
      callback(x, i, this);
      x += step;
      i++;
    }
  }
};

/**
 * Execute a callback function for each value in the Range, and return the
 * results as an array
 * @param {function} callback   The callback method is invoked with three
 *                              parameters: the value of the element, the index
 *                              of the element, and the Matrix being traversed.
 * @returns {Array} array
 */
Range.prototype.map = function map(callback) {
  var array = [];
  this.forEach(function (value, index, obj) {
    array[index] = callback(value, index, obj);
  });
  return array;
};

/**
 * Create an Array with a copy of the Ranges data
 * @returns {Array} array
 */
Range.prototype.toArray = function toArray() {
  var array = [];
  this.forEach(function (value, index) {
    array[index] = value;
  });
  return array;
};

/**
 * Get the primitive value of the Range, a one dimensional array
 * @returns {Array} array
 */
Range.prototype.valueOf = function valueOf() {
  // TODO: implement a caching mechanism for range.valueOf()
  return this.toArray();
};

/**
 * Get a string representation of the range, with optional formatting options.
 * Output is formatted as 'start:step:end', for example '2:6' or '0:0.2:11'
 * @param {Object | Number | Function} [options]  Formatting options. See
 *                                                lib/util/number:format for a
 *                                                description of the available
 *                                                options.
 * @returns {String} str
 */
Range.prototype.format = function format(options) {
  var str = number.format(this.start, options);

  if (this.step != 1) {
    str += ':' + number.format(this.step, options);
  }
  str += ':' + number.format(this.end, options);
  return str;
};

/**
 * Get a string representation of the range.
 * @returns {String}
 */
Range.prototype.toString = function toString() {
  return this.format();
};

// exports
module.exports = Range;

},{"../util/index":276}],271:[function(require,module,exports){
var util = require('../util/index'),

    number = util.number,
    string = util.string,
    isNumber = util.number.isNumber,
    isString = util.string.isString;

/**
 * @constructor Unit
 *
 * A unit can be constructed in the following ways:
 *     var a = new Unit(value, name);
 *     var b = new Unit(null, name);
 *     var c = Unit.parse(str);
 *
 * Example usage:
 *     var a = new Unit(5, 'cm');               // 50 mm
 *     var b = Unit.parse('23 kg');             // 23 kg
 *     var c = math.in(a, new Unit(null, 'm');  // 0.05 m
 *
 * @param {Number} [value]  A value like 5.2
 * @param {String} [unit]   A unit like "cm" or "inch"
 */
function Unit(value, name) {
  if (!(this instanceof Unit)) {
    throw new Error('Constructor must be called with the new operator');
  }

  if (value != null && !isNumber(value)) {
    throw new TypeError('First parameter in Unit constructor must be a number');
  }
  if (name != null && (!isString(name) || name == '')) {
    throw new TypeError('Second parameter in Unit constructor must be a string');
  }

  if (name != null) {
    // find the unit and prefix from the string
    var res = _findUnit(name);
    if (!res) {
      throw new SyntaxError('Unknown unit "' + name + '"');
    }
    this.unit = res.unit;
    this.prefix = res.prefix;
  }
  else {
    this.unit = UNIT_NONE;
    this.prefix = PREFIX_NONE;  // link to a list with supported prefixes
  }

  if (value != null) {
    this.value = this._normalize(value);
    this.fixPrefix = false;  // is set true by the methods Unit.in and math.in
  }
  else {
    this.value = null;
    this.fixPrefix = true;
  }
}

// private variables and functions for the Unit parser
var text, index, c;

function skipWhitespace() {
  while (c == ' ' || c == '\t') {
    next();
  }
}

function isDigitDot (c) {
  return ((c >= '0' && c <= '9') || c == '.');
}

function isDigit (c) {
  return ((c >= '0' && c <= '9'));
}

function next() {
  index++;
  c = text.charAt(index);
}

function revert(oldIndex) {
  index = oldIndex;
  c = text.charAt(index);
}

function parseNumber () {
  var number = '';
  var oldIndex;
  oldIndex = index;

  if (c == '+') {
    next();
  }
  else if (c == '-') {
    number += c;
    next();
  }

  if (!isDigitDot(c)) {
    // a + or - must be followed by a digit
    revert(oldIndex);
    return null;
  }

  // get number, can have a single dot
  if (c == '.') {
    number += c;
    next();
    if (!isDigit(c)) {
      // this is no legal number, it is just a dot
      revert(oldIndex);
      return null;
    }
  }
  else {
    while (isDigit(c)) {
      number += c;
      next();
    }
    if (c == '.') {
      number += c;
      next();
    }
  }
  while (isDigit(c)) {
    number += c;
    next();
  }

  // check for exponential notation like "2.3e-4" or "1.23e50"
  if (c == 'E' || c == 'e') {
    number += c;
    next();

    if (c == '+' || c == '-') {
      number += c;
      next();
    }

    // Scientific notation MUST be followed by an exponent
    if (!isDigit(c)) {
      // this is no legal number, exponent is missing.
      revert(oldIndex);
      return null;
    }

    while (isDigit(c)) {
      number += c;
      next();
    }
  }

  return number;
}

function parseUnit() {
  var unitName = '';

  skipWhitespace();
  while (c && c != ' ' && c != '\t') {
    unitName += c;
    next();
  }

  return unitName || null;
}

/**
 * Parse a string into a unit. Returns null if the provided string does not
 * contain a valid unit.
 * @param {String} str        A string like "5.2 inch", "4e2 kg"
 * @return {Unit | null} unit
 */
Unit.parse = function parse(str) {
  text = str;
  index = -1;
  c = '';

  if (!isString(text)) {
    return null;
  }

  next();
  skipWhitespace();
  var value = parseNumber();
  var name;
  if (value) {
    name = parseUnit();

    next();
    skipWhitespace();
    if (c) {
      // garbage at the end. not good.
      return null;
    }

    if (value && name) {
      try {
        // constructor will throw an error when unit is not found
        return new Unit(Number(value), name);
      }
      catch (err) {}
    }
  }
  else {
    name = parseUnit();

    next();
    skipWhitespace();
    if (c) {
      // garbage at the end. not good.
      return null;
    }

    if (name) {
      try {
        // constructor will throw an error when unit is not found
        return new Unit(null, name);
      }
      catch (err) {}
    }
  }

  return null;
};

/**
 * Test whether value is of type Unit
 * @param {*} value
 * @return {Boolean} isUnit
 */
Unit.isUnit = function isUnit(value) {
  return (value instanceof Unit);
};

/**
 * create a copy of this unit
 * @return {Unit} clone
 */
Unit.prototype.clone = function () {
  var clone = new Unit();

  for (var p in this) {
    if (this.hasOwnProperty(p)) {
      clone[p] = this[p];
    }
  }

  return clone;
};

/**
 * Normalize a value, based on its currently set unit
 * @param {Number} value
 * @return {Number} normalized value
 * @private
 */
Unit.prototype._normalize = function(value) {
  return (value + this.unit.offset) *
      this.unit.value * this.prefix.value;
};

/**
 * Unnormalize a value, based on its currently set unit
 * @param {Number} value
 * @param {Number} [prefixValue]    Optional prefix value to be used
 * @return {Number} unnormalized value
 * @private
 */
Unit.prototype._unnormalize = function (value, prefixValue) {
  if (prefixValue == undefined) {
    return value / this.unit.value / this.prefix.value -
        this.unit.offset;
  }
  else {
    return value / this.unit.value / prefixValue -
        this.unit.offset;
  }
};

/**
 * Find a unit from a string
 * @param {String} str              A string like 'cm' or 'inch'
 * @returns {Object | null} result  When found, an object with fields unit and
 *                                  prefix is returned. Else, null is returned.
 * @private
 */
function _findUnit(str) {
  for (var name in UNITS) {
    if (UNITS.hasOwnProperty(name)) {
      if (string.endsWith(str, name) ) {
        var unit = UNITS[name];
        var prefixLen = (str.length - name.length);
        var prefixName = str.substring(0, prefixLen);
        var prefix = unit.prefixes[prefixName];
        if (prefix !== undefined) {
          // store unit, prefix, and value
          return {
            unit: unit,
            prefix: prefix
          };
        }
      }
    }
  }

  return null;
}

/**
 * Test if the given expression is a unit.
 * The unit can have a prefix but cannot have a value.
 * @param {String} name   A string to be tested whether it is a value less unit.
 *                        The unit can have prefix, like "cm"
 * @return {Boolean}      true if the given string is a unit
 */
Unit.isValuelessUnit = function (name) {
  return (_findUnit(name) != null);
};

/**
 * check if this unit has given base unit
 * @param {BASE_UNITS | undefined} base
 */
Unit.prototype.hasBase = function(base) {
  return (this.unit.base === base);
};

/**
 * Check if this unit has a base equal to another base
 * @param {Unit} other
 * @return {Boolean} true if equal base
 */
Unit.prototype.equalBase = function(other) {
  return (this.unit.base === other.unit.base);
};

/**
 * Check if this unit equals another unit
 * @param {Unit} other
 * @return {Boolean} true if both units are equal
 */
Unit.prototype.equals = function(other) {
  return (this.equalBase(other) && this.value == other.value);
};

/**
 * Create a clone of this unit with a representation
 * @param {String | Unit} valuelessUnit   A unit without value. Can have prefix, like "cm"
 * @returns {Unit} unit having fixed, specified unit
 */
Unit.prototype.to = function (valuelessUnit) {
  var other;
  if (isString(valuelessUnit)) {
    other = new Unit(null, valuelessUnit);

    if (!this.equalBase(other)) {
      throw new Error('Units do not match');
    }

    other.value = this.value;
    return other;
  }
  else if (valuelessUnit instanceof Unit) {
    if (!this.equalBase(valuelessUnit)) {
      throw new Error('Units do not match');
    }
    if (valuelessUnit.value != null) {
      throw new Error('Cannot convert to a unit with a value');
    }

    other = valuelessUnit.clone();
    other.value = this.value;
    other.fixPrefix = true;
    return other;
  }
  else {
    throw new Error('String or Unit expected as parameter');
  }
};

/**
 * Return the value of the unit when represented with given valueless unit
 * @param {String | Unit} valuelessUnit    For example 'cm' or 'inch'
 * @return {Number} value
 */
Unit.prototype.toNumber = function (valuelessUnit) {
  var other = this.to(valuelessUnit);
  return other._unnormalize(other.value, other.prefix.value);
};


/**
 * Get a string representation of the unit.
 * @return {String}
 */
Unit.prototype.toString = function toString() {
  return this.format();
};

/**
 * Get a string representation of the Unit, with optional formatting options.
 * @param {Object | Number | Function} [options]  Formatting options. See
 *                                                lib/util/number:format for a
 *                                                description of the available
 *                                                options.
 * @return {String}
 */
Unit.prototype.format = function format(options) {
  var value,
      str;

  if (!this.fixPrefix) {
    var bestPrefix = this._bestPrefix();
    value = this._unnormalize(this.value, bestPrefix.value);
    str = number.format(value, options) + ' ';
    str += bestPrefix.name + this.unit.name;
  }
  else {
    value = this._unnormalize(this.value);
    str = (this.value != null) ? number.format(value, options) + ' ' : '';
    str += this.prefix.name + this.unit.name;
  }
  return str;
};

/**
 * Calculate the best prefix using current value.
 * @returns {Object} prefix
 * @private
 */
Unit.prototype._bestPrefix = function () {
  // find the best prefix value (resulting in the value of which
  // the absolute value of the log10 is closest to zero,
  // though with a little offset of 1.2 for nicer values: you get a
  // sequence 1mm 100mm 500mm 0.6m 1m 10m 100m 500m 0.6km 1km ...
  var absValue = Math.abs(this.value / this.unit.value);
  var bestPrefix = PREFIX_NONE;
  var bestDiff = Math.abs(
      Math.log(absValue / bestPrefix.value) / Math.LN10 - 1.2);

  var prefixes = this.unit.prefixes;
  for (var p in prefixes) {
    if (prefixes.hasOwnProperty(p)) {
      var prefix = prefixes[p];
      if (prefix.scientific) {
        var diff = Math.abs(
            Math.log(absValue / prefix.value) / Math.LN10 - 1.2);

        if (diff < bestDiff) {
          bestPrefix = prefix;
          bestDiff = diff;
        }
      }
    }
  }

  return bestPrefix;
};

var PREFIXES = {
  NONE: {
    '': {name: '', value: 1, scientific: true}
  },
  SHORT: {
    '': {name: '', value: 1, scientific: true},

    'da': {name: 'da', value: 1e1, scientific: false},
    'h': {name: 'h', value: 1e2, scientific: false},
    'k': {name: 'k', value: 1e3, scientific: true},
    'M': {name: 'M', value: 1e6, scientific: true},
    'G': {name: 'G', value: 1e9, scientific: true},
    'T': {name: 'T', value: 1e12, scientific: true},
    'P': {name: 'P', value: 1e15, scientific: true},
    'E': {name: 'E', value: 1e18, scientific: true},
    'Z': {name: 'Z', value: 1e21, scientific: true},
    'Y': {name: 'Y', value: 1e24, scientific: true},

    'd': {name: 'd', value: 1e-1, scientific: false},
    'c': {name: 'c', value: 1e-2, scientific: false},
    'm': {name: 'm', value: 1e-3, scientific: true},
    'u': {name: 'u', value: 1e-6, scientific: true},
    'n': {name: 'n', value: 1e-9, scientific: true},
    'p': {name: 'p', value: 1e-12, scientific: true},
    'f': {name: 'f', value: 1e-15, scientific: true},
    'a': {name: 'a', value: 1e-18, scientific: true},
    'z': {name: 'z', value: 1e-21, scientific: true},
    'y': {name: 'y', value: 1e-24, scientific: true}
  },
  LONG: {
    '': {name: '', value: 1, scientific: true},

    'deca': {name: 'deca', value: 1e1, scientific: false},
    'hecto': {name: 'hecto', value: 1e2, scientific: false},
    'kilo': {name: 'kilo', value: 1e3, scientific: true},
    'mega': {name: 'mega', value: 1e6, scientific: true},
    'giga': {name: 'giga', value: 1e9, scientific: true},
    'tera': {name: 'tera', value: 1e12, scientific: true},
    'peta': {name: 'peta', value: 1e15, scientific: true},
    'exa': {name: 'exa', value: 1e18, scientific: true},
    'zetta': {name: 'zetta', value: 1e21, scientific: true},
    'yotta': {name: 'yotta', value: 1e24, scientific: true},

    'deci': {name: 'deci', value: 1e-1, scientific: false},
    'centi': {name: 'centi', value: 1e-2, scientific: false},
    'milli': {name: 'milli', value: 1e-3, scientific: true},
    'micro': {name: 'micro', value: 1e-6, scientific: true},
    'nano': {name: 'nano', value: 1e-9, scientific: true},
    'pico': {name: 'pico', value: 1e-12, scientific: true},
    'femto': {name: 'femto', value: 1e-15, scientific: true},
    'atto': {name: 'atto', value: 1e-18, scientific: true},
    'zepto': {name: 'zepto', value: 1e-21, scientific: true},
    'yocto': {name: 'yocto', value: 1e-24, scientific: true}
  },
  SQUARED: {
    '': {name: '', value: 1, scientific: true},

    'da': {name: 'da', value: 1e2, scientific: false},
    'h': {name: 'h', value: 1e4, scientific: false},
    'k': {name: 'k', value: 1e6, scientific: true},
    'M': {name: 'M', value: 1e12, scientific: true},
    'G': {name: 'G', value: 1e18, scientific: true},
    'T': {name: 'T', value: 1e24, scientific: true},
    'P': {name: 'P', value: 1e30, scientific: true},
    'E': {name: 'E', value: 1e36, scientific: true},
    'Z': {name: 'Z', value: 1e42, scientific: true},
    'Y': {name: 'Y', value: 1e48, scientific: true},

    'd': {name: 'd', value: 1e-2, scientific: false},
    'c': {name: 'c', value: 1e-4, scientific: false},
    'm': {name: 'm', value: 1e-6, scientific: true},
    'u': {name: 'u', value: 1e-12, scientific: true},
    'n': {name: 'n', value: 1e-18, scientific: true},
    'p': {name: 'p', value: 1e-24, scientific: true},
    'f': {name: 'f', value: 1e-30, scientific: true},
    'a': {name: 'a', value: 1e-36, scientific: true},
    'z': {name: 'z', value: 1e-42, scientific: true},
    'y': {name: 'y', value: 1e-42, scientific: true}
  },
  CUBIC: {
    '': {name: '', value: 1, scientific: true},

    'da': {name: 'da', value: 1e3, scientific: false},
    'h': {name: 'h', value: 1e6, scientific: false},
    'k': {name: 'k', value: 1e9, scientific: true},
    'M': {name: 'M', value: 1e18, scientific: true},
    'G': {name: 'G', value: 1e27, scientific: true},
    'T': {name: 'T', value: 1e36, scientific: true},
    'P': {name: 'P', value: 1e45, scientific: true},
    'E': {name: 'E', value: 1e54, scientific: true},
    'Z': {name: 'Z', value: 1e63, scientific: true},
    'Y': {name: 'Y', value: 1e72, scientific: true},

    'd': {name: 'd', value: 1e-3, scientific: false},
    'c': {name: 'c', value: 1e-6, scientific: false},
    'm': {name: 'm', value: 1e-9, scientific: true},
    'u': {name: 'u', value: 1e-18, scientific: true},
    'n': {name: 'n', value: 1e-27, scientific: true},
    'p': {name: 'p', value: 1e-36, scientific: true},
    'f': {name: 'f', value: 1e-45, scientific: true},
    'a': {name: 'a', value: 1e-54, scientific: true},
    'z': {name: 'z', value: 1e-63, scientific: true},
    'y': {name: 'y', value: 1e-72, scientific: true}
  },
  BINARY_SHORT: {
    '': {name: '', value: 1, scientific: true},
    'k': {name: 'k', value: 1024, scientific: true},
    'M': {name: 'M', value: Math.pow(1024, 2), scientific: true},
    'G': {name: 'G', value: Math.pow(1024, 3), scientific: true},
    'T': {name: 'T', value: Math.pow(1024, 4), scientific: true},
    'P': {name: 'P', value: Math.pow(1024, 5), scientific: true},
    'E': {name: 'E', value: Math.pow(1024, 6), scientific: true},
    'Z': {name: 'Z', value: Math.pow(1024, 7), scientific: true},
    'Y': {name: 'Y', value: Math.pow(1024, 8), scientific: true},

    'Ki': {name: 'Ki', value: 1024, scientific: true},
    'Mi': {name: 'Mi', value: Math.pow(1024, 2), scientific: true},
    'Gi': {name: 'Gi', value: Math.pow(1024, 3), scientific: true},
    'Ti': {name: 'Ti', value: Math.pow(1024, 4), scientific: true},
    'Pi': {name: 'Pi', value: Math.pow(1024, 5), scientific: true},
    'Ei': {name: 'Ei', value: Math.pow(1024, 6), scientific: true},
    'Zi': {name: 'Zi', value: Math.pow(1024, 7), scientific: true},
    'Yi': {name: 'Yi', value: Math.pow(1024, 8), scientific: true}
  },
  BINARY_LONG: {
    '': {name: '', value: 1, scientific: true},
    'kilo': {name: 'kilo', value: 1024, scientific: true},
    'mega': {name: 'mega', value: Math.pow(1024, 2), scientific: true},
    'giga': {name: 'giga', value: Math.pow(1024, 3), scientific: true},
    'tera': {name: 'tera', value: Math.pow(1024, 4), scientific: true},
    'peta': {name: 'peta', value: Math.pow(1024, 5), scientific: true},
    'exa': {name: 'exa', value: Math.pow(1024, 6), scientific: true},
    'zetta': {name: 'zetta', value: Math.pow(1024, 7), scientific: true},
    'yotta': {name: 'yotta', value: Math.pow(1024, 8), scientific: true},

    'kibi': {name: 'kibi', value: 1024, scientific: true},
    'mebi': {name: 'mebi', value: Math.pow(1024, 2), scientific: true},
    'gibi': {name: 'gibi', value: Math.pow(1024, 3), scientific: true},
    'tebi': {name: 'tebi', value: Math.pow(1024, 4), scientific: true},
    'pebi': {name: 'pebi', value: Math.pow(1024, 5), scientific: true},
    'exi': {name: 'exi', value: Math.pow(1024, 6), scientific: true},
    'zebi': {name: 'zebi', value: Math.pow(1024, 7), scientific: true},
    'yobi': {name: 'yobi', value: Math.pow(1024, 8), scientific: true}
  }
};

var PREFIX_NONE = {name: '', value: 1, scientific: true};

var BASE_UNITS = {
  NONE: {},

  LENGTH: {},               // meter
  MASS: {},                 // kilogram
  TIME: {},                 // second
  CURRENT: {},              // ampere
  TEMPERATURE: {},          // kelvin
  LUMINOUS_INTENSITY: {},   // candela
  AMOUNT_OF_SUBSTANCE: {},  // mole

  FORCE: {},                // Newton
  SURFACE: {},              // m2
  VOLUME: {},               // m3
  ANGLE: {},                // rad
  BIT: {}                   // bit (digital)
};

BASE_UNIT_NONE = {};

UNIT_NONE = {name: '', base: BASE_UNIT_NONE, value: 1, offset: 0};

var UNITS = {
  // length
  meter: {name: 'meter', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.LONG, value: 1, offset: 0},
  inch: {name: 'inch', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 0.0254, offset: 0},
  foot: {name: 'foot', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 0.3048, offset: 0},
  yard: {name: 'yard', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 0.9144, offset: 0},
  mile: {name: 'mile', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 1609.344, offset: 0},
  link: {name: 'link', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 0.201168, offset: 0},
  rod: {name: 'rod', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 5.029210, offset: 0},
  chain: {name: 'chain', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 20.1168, offset: 0},
  angstrom: {name: 'angstrom', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 1e-10, offset: 0},

  m: {name: 'm', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.SHORT, value: 1, offset: 0},
  'in': {name: 'in', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 0.0254, offset: 0},
  ft: {name: 'ft', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 0.3048, offset: 0},
  yd: {name: 'yd', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 0.9144, offset: 0},
  mi: {name: 'mi', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 1609.344, offset: 0},
  li: {name: 'li', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 0.201168, offset: 0},
  rd: {name: 'rd', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 5.029210, offset: 0},
  ch: {name: 'ch', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 20.1168, offset: 0},
  mil: {name: 'mil', base: BASE_UNITS.LENGTH, prefixes: PREFIXES.NONE, value: 0.0000254, offset: 0}, // 1/1000 inch

  // Surface
  m2: {name: 'm2', base: BASE_UNITS.SURFACE, prefixes: PREFIXES.SQUARED, value: 1, offset: 0},
  sqin: {name: 'sqin', base: BASE_UNITS.SURFACE, prefixes: PREFIXES.NONE, value: 0.00064516, offset: 0}, // 645.16 mm2
  sqft: {name: 'sqft', base: BASE_UNITS.SURFACE, prefixes: PREFIXES.NONE, value: 0.09290304, offset: 0}, // 0.09290304 m2
  sqyd: {name: 'sqyd', base: BASE_UNITS.SURFACE, prefixes: PREFIXES.NONE, value: 0.83612736, offset: 0}, // 0.83612736 m2
  sqmi: {name: 'sqmi', base: BASE_UNITS.SURFACE, prefixes: PREFIXES.NONE, value: 2589988.110336, offset: 0}, // 2.589988110336 km2
  sqrd: {name: 'sqrd', base: BASE_UNITS.SURFACE, prefixes: PREFIXES.NONE, value: 25.29295, offset: 0}, // 25.29295 m2
  sqch: {name: 'sqch', base: BASE_UNITS.SURFACE, prefixes: PREFIXES.NONE, value: 404.6873, offset: 0}, // 404.6873 m2
  sqmil: {name: 'sqmil', base: BASE_UNITS.SURFACE, prefixes: PREFIXES.NONE, value: 6.4516e-10, offset: 0}, // 6.4516 * 10^-10 m2

  // Volume
  m3: {name: 'm3', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.CUBIC, value: 1, offset: 0},
  L: {name: 'L', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.SHORT, value: 0.001, offset: 0}, // litre
  l: {name: 'l', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.SHORT, value: 0.001, offset: 0}, // litre
  litre: {name: 'litre', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.LONG, value: 0.001, offset: 0},
  cuin: {name: 'cuin', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 1.6387064e-5, offset: 0}, // 1.6387064e-5 m3
  cuft: {name: 'cuft', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.028316846592, offset: 0}, // 28.316 846 592 L
  cuyd: {name: 'cuyd', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.764554857984, offset: 0}, // 764.554 857 984 L
  teaspoon: {name: 'teaspoon', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.000005, offset: 0}, // 5 mL
  tablespoon: {name: 'tablespoon', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.000015, offset: 0}, // 15 mL
  //{name: 'cup', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.000240, offset: 0}, // 240 mL  // not possible, we have already another cup

  // Liquid volume
  minim: {name: 'minim', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.00000006161152, offset: 0}, // 0.06161152 mL
  fluiddram: {name: 'fluiddram', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0000036966911, offset: 0},  // 3.696691 mL
  fluidounce: {name: 'fluidounce', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.00002957353, offset: 0}, // 29.57353 mL
  gill: {name: 'gill', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0001182941, offset: 0}, // 118.2941 mL
  cc: {name: 'cc', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 1e-6, offset: 0}, // 1e-6 L
  cup: {name: 'cup', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0002365882, offset: 0}, // 236.5882 mL
  pint: {name: 'pint', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0004731765, offset: 0}, // 473.1765 mL
  quart: {name: 'quart', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0009463529, offset: 0}, // 946.3529 mL
  gallon: {name: 'gallon', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.003785412, offset: 0}, // 3.785412 L
  beerbarrel: {name: 'beerbarrel', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.1173478, offset: 0}, // 117.3478 L
  oilbarrel: {name: 'oilbarrel', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.1589873, offset: 0}, // 158.9873 L
  hogshead: {name: 'hogshead', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.2384810, offset: 0}, // 238.4810 L

  //{name: 'min', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.00000006161152, offset: 0}, // 0.06161152 mL // min is already in use as minute
  fldr: {name: 'fldr', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0000036966911, offset: 0},  // 3.696691 mL
  floz: {name: 'floz', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.00002957353, offset: 0}, // 29.57353 mL
  gi: {name: 'gi', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0001182941, offset: 0}, // 118.2941 mL
  cp: {name: 'cp', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0002365882, offset: 0}, // 236.5882 mL
  pt: {name: 'pt', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0004731765, offset: 0}, // 473.1765 mL
  qt: {name: 'qt', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.0009463529, offset: 0}, // 946.3529 mL
  gal: {name: 'gal', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.003785412, offset: 0}, // 3.785412 L
  bbl: {name: 'bbl', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.1173478, offset: 0}, // 117.3478 L
  obl: {name: 'obl', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.1589873, offset: 0}, // 158.9873 L
  //{name: 'hogshead', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.2384810, offset: 0}, // 238.4810 L // TODO: hh?

  // Mass
  g: {name: 'g', base: BASE_UNITS.MASS, prefixes: PREFIXES.SHORT, value: 0.001, offset: 0},
  gram: {name: 'gram', base: BASE_UNITS.MASS, prefixes: PREFIXES.LONG, value: 0.001, offset: 0},

  ton: {name: 'ton', base: BASE_UNITS.MASS, prefixes: PREFIXES.SHORT, value: 907.18474, offset: 0},
  tonne: {name: 'tonne', base: BASE_UNITS.MASS, prefixes: PREFIXES.SHORT, value: 1000, offset: 0},

  grain: {name: 'grain', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 64.79891e-6, offset: 0},
  dram: {name: 'dram', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 1.7718451953125e-3, offset: 0},
  ounce: {name: 'ounce', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 28.349523125e-3, offset: 0},
  poundmass: {name: 'poundmass', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 453.59237e-3, offset: 0},
  hundredweight: {name: 'hundredweight', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 45.359237, offset: 0},
  stick: {name: 'stick', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 115e-3, offset: 0},

  gr: {name: 'gr', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 64.79891e-6, offset: 0},
  dr: {name: 'dr', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 1.7718451953125e-3, offset: 0},
  oz: {name: 'oz', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 28.349523125e-3, offset: 0},
  lbm: {name: 'lbm', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 453.59237e-3, offset: 0},
  cwt: {name: 'cwt', base: BASE_UNITS.MASS, prefixes: PREFIXES.NONE, value: 45.359237, offset: 0},

  // Time
  s: {name: 's', base: BASE_UNITS.TIME, prefixes: PREFIXES.SHORT, value: 1, offset: 0},
  min: {name: 'min', base: BASE_UNITS.TIME, prefixes: PREFIXES.NONE, value: 60, offset: 0},
  h: {name: 'h', base: BASE_UNITS.TIME, prefixes: PREFIXES.NONE, value: 3600, offset: 0},
  second: {name: 'second', base: BASE_UNITS.TIME, prefixes: PREFIXES.LONG, value: 1, offset: 0},
  sec: {name: 'sec', base: BASE_UNITS.TIME, prefixes: PREFIXES.LONG, value: 1, offset: 0},
  minute: {name: 'minute', base: BASE_UNITS.TIME, prefixes: PREFIXES.NONE, value: 60, offset: 0},
  hour: {name: 'hour', base: BASE_UNITS.TIME, prefixes: PREFIXES.NONE, value: 3600, offset: 0},
  day: {name: 'day', base: BASE_UNITS.TIME, prefixes: PREFIXES.NONE, value: 86400, offset: 0},

  // Angle
  rad: {name: 'rad', base: BASE_UNITS.ANGLE, prefixes: PREFIXES.NONE, value: 1, offset: 0},
  // deg = rad / (2*pi) * 360 = rad / 0.017453292519943295769236907684888
  deg: {name: 'deg', base: BASE_UNITS.ANGLE, prefixes: PREFIXES.NONE, value: 0.017453292519943295769236907684888, offset: 0},
  // grad = rad / (2*pi) * 400  = rad / 0.015707963267948966192313216916399
  grad: {name: 'grad', base: BASE_UNITS.ANGLE, prefixes: PREFIXES.NONE, value: 0.015707963267948966192313216916399, offset: 0},
  // cycle = rad / (2*pi) = rad / 6.2831853071795864769252867665793
  cycle: {name: 'cycle', base: BASE_UNITS.ANGLE, prefixes: PREFIXES.NONE, value: 6.2831853071795864769252867665793, offset: 0},

  // Electric current
  A: {name: 'A', base: BASE_UNITS.CURRENT, prefixes: PREFIXES.SHORT, value: 1, offset: 0},
  ampere: {name: 'ampere', base: BASE_UNITS.CURRENT, prefixes: PREFIXES.LONG, value: 1, offset: 0},

  // Temperature
  // K(C) = °C + 273.15
  // K(F) = (°F + 459.67) / 1.8
  // K(R) = °R / 1.8
  K: {name: 'K', base: BASE_UNITS.TEMPERATURE, prefixes: PREFIXES.NONE, value: 1, offset: 0},
  degC: {name: 'degC', base: BASE_UNITS.TEMPERATURE, prefixes: PREFIXES.NONE, value: 1, offset: 273.15},
  degF: {name: 'degF', base: BASE_UNITS.TEMPERATURE, prefixes: PREFIXES.NONE, value: 1/1.8, offset: 459.67},
  degR: {name: 'degR', base: BASE_UNITS.TEMPERATURE, prefixes: PREFIXES.NONE, value: 1/1.8, offset: 0},
  kelvin: {name: 'kelvin', base: BASE_UNITS.TEMPERATURE, prefixes: PREFIXES.NONE, value: 1, offset: 0},
  celsius: {name: 'celsius', base: BASE_UNITS.TEMPERATURE, prefixes: PREFIXES.NONE, value: 1, offset: 273.15},
  fahrenheit: {name: 'fahrenheit', base: BASE_UNITS.TEMPERATURE, prefixes: PREFIXES.NONE, value: 1/1.8, offset: 459.67},
  rankine: {name: 'rankine', base: BASE_UNITS.TEMPERATURE, prefixes: PREFIXES.NONE, value: 1/1.8, offset: 0},

  // amount of substance
  mol: {name: 'mol', base: BASE_UNITS.AMOUNT_OF_SUBSTANCE, prefixes: PREFIXES.NONE, value: 1, offset: 0},
  mole: {name: 'mole', base: BASE_UNITS.AMOUNT_OF_SUBSTANCE, prefixes: PREFIXES.NONE, value: 1, offset: 0},

  // luminous intensity
  cd: {name: 'cd', base: BASE_UNITS.LUMINOUS_INTENSITY, prefixes: PREFIXES.NONE, value: 1, offset: 0},
  candela: {name: 'candela', base: BASE_UNITS.LUMINOUS_INTENSITY, prefixes: PREFIXES.NONE, value: 1, offset: 0},
  // TODO: units STERADIAN
  //{name: 'sr', base: BASE_UNITS.STERADIAN, prefixes: PREFIXES.NONE, value: 1, offset: 0},
  //{name: 'steradian', base: BASE_UNITS.STERADIAN, prefixes: PREFIXES.NONE, value: 1, offset: 0},

  // Force
  N: {name: 'N', base: BASE_UNITS.FORCE, prefixes: PREFIXES.SHORT, value: 1, offset: 0},
  newton: {name: 'newton', base: BASE_UNITS.FORCE, prefixes: PREFIXES.LONG, value: 1, offset: 0},
  lbf: {name: 'lbf', base: BASE_UNITS.FORCE, prefixes: PREFIXES.NONE, value: 4.4482216152605, offset: 0},
  poundforce: {name: 'poundforce', base: BASE_UNITS.FORCE, prefixes: PREFIXES.NONE, value: 4.4482216152605, offset: 0},

  // Binary
  b: {name: 'b', base: BASE_UNITS.BIT, prefixes: PREFIXES.BINARY_SHORT, value: 1, offset: 0},
  bits: {name: 'bits', base: BASE_UNITS.BIT, prefixes: PREFIXES.BINARY_LONG, value: 1, offset: 0},
  B: {name: 'B', base: BASE_UNITS.BIT, prefixes: PREFIXES.BINARY_SHORT, value: 8, offset: 0},
  bytes: {name: 'bytes', base: BASE_UNITS.BIT, prefixes: PREFIXES.BINARY_LONG, value: 8, offset: 0}
};

// plurals
var PLURALS = {
  meters: 'meter',
  inches: 'inch',
  feet: 'foot',
  yards: 'yard',
  miles: 'mile',
  links: 'link',
  rods: 'rod',
  chains: 'chain',
  angstroms: 'angstrom',

  litres: 'litre',
  teaspoons: 'teaspoon',
  tablespoons: 'tablespoon',
  minims: 'minim',
  fluiddrams: 'fluiddram',
  fluidounces: 'fluidounce',
  gills: 'gill',
  cups: 'cup',
  pints: 'pint',
  quarts: 'quart',
  gallons: 'gallon',
  beerbarrels: 'beerbarrel',
  oilbarrels: 'oilbarrel',
  hogsheads: 'hogshead',

  grams: 'gram',
  tons: 'ton',
  tonnes: 'tonne',
  grains: 'grain',
  drams: 'dram',
  ounces: 'ounce',
  poundmasses: 'poundmass',
  hundredweights: 'hundredweight',
  sticks: 'stick',

  seconds: 'second',
  minutes: 'minute',
  hours: 'hour',
  days: 'day',

  radians: 'rad',
  degrees: 'deg',
  gradients: 'grad',
  cycles: 'cycle',

  amperes: 'ampere',
  moles: 'mole'
};

for (var name in PLURALS) {
  /* istanbul ignore next (we cannot really test next statement) */
  if (PLURALS.hasOwnProperty(name)) {
    var unit = UNITS[PLURALS[name]];
    var plural = Object.create(unit);
    plural.name = name;
    UNITS[name] = plural;
  }
}

// aliases
UNITS.lt = UNITS.l;
UNITS.liter = UNITS.litre;
UNITS.liters = UNITS.litres;
UNITS.lb = UNITS.lbm;
UNITS.lbs = UNITS.lbm;


Unit.PREFIXES = PREFIXES;
Unit.BASE_UNITS = BASE_UNITS;
Unit.UNITS = UNITS;

// end of unit aliases


// exports
module.exports = Unit;

},{"../util/index":276}],272:[function(require,module,exports){
// utility methods for arrays and matrices

var util = require('../util/index'),

    DimensionError = require('../error/DimensionError'),

    Matrix = require('./Matrix'),

    isArray = util.array.isArray,
    isString = util.string.isString;

/**
 * Convert function arguments to an array. Arguments can have the following
 * signature:
 *     fn()
 *     fn(n)
 *     fn(m, n, p, ...)
 *     fn([m, n, p, ...])
 * @param {...Number | Array | Matrix} args
 * @returns {Array} array
 */
exports.argsToArray = function argsToArray(args) {
  var array;
  if (args.length == 0) {
    // fn()
    array = [];
  }
  else if (args.length == 1) {
    // fn(n)
    // fn([m, n, p, ...])
    array = args[0];
    if (array instanceof Matrix) {
      array = array.valueOf();
    }
    if (!isArray(array)) {
      array = [array];
    }
  }
  else {
    // fn(m, n, p, ...)
    array = Array.prototype.slice.apply(args);
  }
  return array;
};


/**
 * Test whether a value is a collection: an Array or Matrix
 * @param {*} x
 * @returns {boolean} isCollection
 */
exports.isCollection = function isCollection (x) {
  return (isArray(x) || (x instanceof Matrix));
};

/**
 * Execute the callback function element wise for each element in array and any
 * nested array
 * Returns an array with the results
 * @param {Array | Matrix} array
 * @param {function} callback   The callback is called with two parameters:
 *                              value1 and value2, which contain the current
 *                              element of both arrays.
 * @return {Array | Matrix} res
 */
exports.deepMap = function deepMap(array, callback) {
  if (array && (typeof array.map === 'function')) {
    return array.map(function (x) {
      return deepMap(x, callback);
    });
  }
  else {
    return callback(array);
  }
};

/**
 * Execute the callback function element wise for each entry in two given arrays,
 * and for any nested array. Objects can also be scalar objects.
 * Returns an array with the results.
 * @param {Array | Matrix | Object} array1
 * @param {Array | Matrix | Object} array2
 * @param {function} callback   The callback is called with two parameters:
 *                              value1 and value2, which contain the current
 *                              element of both arrays.
 * @return {Array | Matrix} res
 */
exports.deepMap2 = function deepMap2(array1, array2, callback) {
  var res, len, i;

  if (isArray(array1)) {
    if (isArray(array2)) {
      // callback(array, array)
      if (array1.length != array2.length) {
        throw new DimensionError(array1.length, array2.length);
      }

      res = [];
      len = array1.length;
      for (i = 0; i < len; i++) {
        res[i] = deepMap2(array1[i], array2[i], callback);
      }
    }
    else if (array2 instanceof Matrix) {
      // callback(array, matrix)
      res = deepMap2(array1, array2.valueOf(), callback);
      return new Matrix(res);
    }
    else {
      // callback(array, object)
      res = [];
      len = array1.length;
      for (i = 0; i < len; i++) {
        res[i] = deepMap2(array1[i], array2, callback);
      }
    }
  }
  else if (array1 instanceof Matrix) {
    if (array2 instanceof Matrix) {
      // callback(matrix, matrix)
      res = deepMap2(array1.valueOf(), array2.valueOf(), callback);
      return new Matrix(res);
    }
    else {
      // callback(matrix, array)
      // callback(matrix, object)
      res = deepMap2(array1.valueOf(), array2, callback);
      return new Matrix(res);
    }
  }
  else {
    if (isArray(array2)) {
      // callback(object, array)
      res = [];
      len = array2.length;
      for (i = 0; i < len; i++) {
        res[i] = deepMap2(array1, array2[i], callback);
      }
    }
    else if (array2 instanceof Matrix) {
      // callback(object, matrix)
      res = deepMap2(array1, array2.valueOf(), callback);
      return new Matrix(res);
    }
    else {
      // callback(object, object)
      res = callback(array1, array2);
    }
  }

  return res;
};

/**
 * Reduce a given matrix or array to a new matrix or
 * array with one less dimension, applying the given
 * callback in the selected dimension.
 * @param {Array | Matrix} mat
 * @param {Number} dim
 * @param {function} callback
 * @return {Array | Matrix} res
 */
exports.reduce = function reduce (mat, dim, callback) {
	if (mat instanceof Matrix) {
		return new Matrix(_reduce(mat.valueOf(), dim, callback));
	}else {
		return _reduce(mat, dim, callback);
	}
};

/**
 * Recursively reduce a matrix
 * @param {Array} mat
 * @param {Number} dim
 * @param {Function} callback
 * @returns {Array} ret
 * @private
 */
function _reduce(mat, dim, callback){
  var i, ret, val, tran;

	if(dim<=0){
		if( !isArray(mat[0]) ){
			val = mat[0];
			for(i=1; i<mat.length; i++){
				val = callback(val, mat[i]);
			}
			return val;
		}else{
			tran = _switch(mat);
			ret = [];
			for(i=0; i<tran.length; i++){
				ret[i] = _reduce(tran[i], dim-1, callback);
			}
			return ret
		}
	}else{
		ret = [];
		for(i=0; i<mat.length; i++){
			ret[i] = _reduce(mat[i], dim-1, callback);
		}
		return ret;
	}
}

/**
 * Transpose a matrix
 * @param {Array} mat
 * @returns {Array} ret
 * @private
 */
function _switch(mat){
  var I = mat.length;
  var J = mat[0].length;
  var i, j;
  var ret = [];
  for( j=0; j<J; j++) {
    var tmp = [];
    for( i=0; i<I; i++) {
      tmp.push(mat[i][j]);
    }
    ret.push(tmp);
  }
  return ret;
}

/**
 * Recursively loop over all elements in a given multi dimensional array
 * and invoke the callback on each of the elements.
 * @param {Array | Matrix} array
 * @param {function} callback     The callback method is invoked with one
 *                                parameter: the current element in the array
 */
exports.deepForEach = function deepForEach (array, callback) {
  if (array instanceof Matrix) {
    array = array.valueOf();
  }

  for (var i = 0, ii = array.length; i < ii; i++) {
    var value = array[i];

    if (isArray(value)) {
      deepForEach(value, callback);
    }
    else {
      callback(value);
    }
  }
};

},{"../error/DimensionError":29,"../util/index":276,"./Matrix":269}],273:[function(require,module,exports){
var number = require('./number'),
    string = require('./string'),
    object = require('./object'),
    types = require('./types'),

    DimensionError = require('../error/DimensionError'),
    IndexError = require('../error/IndexError'),

    isArray = Array.isArray;

/**
 * Calculate the size of a multi dimensional array.
 * @param {Array} x
 * @Return {Number[]} size
 * @private
 */
function _size(x) {
  var size = [];

  while (isArray(x)) {
    size.push(x.length);
    x = x[0];
  }

  return size;
}

/**
 * Calculate the size of a multi dimensional array.
 * All elements in the array are checked for matching dimensions using the
 * method validate
 * @param {Array} x
 * @Return {Number[]} size
 * @throws RangeError
 */
exports.size = function size (x) {
  // calculate the size
  var s = _size(x);

  // verify the size
  exports.validate(x, s);
  // TODO: don't validate here? only in a Matrix constructor?

  return s;
};

/**
 * Recursively validate whether each element in a multi dimensional array
 * has a size corresponding to the provided size array.
 * @param {Array} array    Array to be validated
 * @param {Number[]} size  Array with the size of each dimension
 * @param {Number} dim   Current dimension
 * @throws DimensionError
 * @private
 */
function _validate(array, size, dim) {
  var i;
  var len = array.length;

  if (len != size[dim]) {
    throw new DimensionError(len, size[dim]);
  }

  if (dim < size.length - 1) {
    // recursively validate each child array
    var dimNext = dim + 1;
    for (i = 0; i < len; i++) {
      var child = array[i];
      if (!isArray(child)) {
        throw new DimensionError(size.length - 1, size.length, '<');
      }
      _validate(array[i], size, dimNext);
    }
  }
  else {
    // last dimension. none of the childs may be an array
    for (i = 0; i < len; i++) {
      if (isArray(array[i])) {
        throw new DimensionError(size.length + 1, size.length, '>');
      }
    }
  }
}

/**
 * Validate whether each element in a multi dimensional array has
 * a size corresponding to the provided size array.
 * @param {Array} array    Array to be validated
 * @param {Number[]} size  Array with the size of each dimension
 * @throws DimensionError
 */
exports.validate = function validate(array, size) {
  var isScalar = (size.length == 0);
  if (isScalar) {
    // scalar
    if (isArray(array)) {
      throw new DimensionError(array.length, 0);
    }
  }
  else {
    // array
    _validate(array, size, 0);
  }
};

/**
 * Test whether index is an integer number with index >= 0 and index < length
 * @param {Number} index    Zero-based index
 * @param {Number} [length] Length of the array
 */
exports.validateIndex = function validateIndex (index, length) {
  if (!number.isNumber(index) || !number.isInteger(index)) {
    throw new TypeError('Index must be an integer (value: ' + index + ')');
  }
  if (index < 0) {
    throw new IndexError(index);
  }
  if (length !== undefined && index >= length) {
    throw new IndexError(index, length);
  }
};

/**
 * Resize a multi dimensional array. The resized array is returned.
 * @param {Array} array         Array to be resized
 * @param {Array.<Number>} size Array with the size of each dimension
 * @param {*} [defaultValue]    Value to be filled in in new entries,
 *                              undefined by default
 * @return {Array} array         The resized array
 */
exports.resize = function resize(array, size, defaultValue) {
  // TODO: add support for scalars, having size=[] ?

  // check the type of the arguments
  if (!isArray(array) || !isArray(size)) {
    throw new TypeError('Array expected');
  }
  if (size.length === 0) {
    throw new Error('Resizing to scalar is not supported');
  }

  // check whether size contains positive integers
  size.forEach(function (value) {
    if (!number.isNumber(value) || !number.isInteger(value) || value < 0) {
      throw new TypeError('Invalid size, must contain positive integers ' +
          '(size: ' + string.format(size) + ')');
    }
  });

  // count the current number of dimensions
  var dims = 1;
  var elem = array[0];
  while (isArray(elem)) {
    dims++;
    elem = elem[0];
  }

  // adjust the number of dimensions when needed
  while (dims < size.length) { // add dimensions
    array = [array];
    dims++;
  }
  while (dims > size.length) { // remove dimensions
    array = array[0];
    dims--;
  }

  // recursively resize the array
  _resize(array, size, 0, defaultValue);

  return array;
};

/**
 * Recursively resize a multi dimensional array
 * @param {Array} array         Array to be resized
 * @param {Number[]} size       Array with the size of each dimension
 * @param {Number} dim          Current dimension
 * @param {*} [defaultValue]    Value to be filled in in new entries,
 *                              undefined by default.
 * @private
 */
function _resize (array, size, dim, defaultValue) {
  if (!isArray(array)) throw Error('Array expected');

  var i, elem,
      oldLen = array.length,
      newLen = size[dim],
      minLen = Math.min(oldLen, newLen);

  // apply new length
  array.length = newLen;

  if (dim < size.length - 1) {
    // non-last dimension
    var dimNext = dim + 1;

    // resize existing child arrays
    for (i = 0; i < minLen; i++) {
      // resize child array
      elem = array[i];
      _resize(elem, size, dimNext, defaultValue);
    }

    // create new child arrays
    for (i = minLen; i < newLen; i++) {
      // get child array
      elem = [];
      array[i] = elem;

      // resize new child array
      _resize(elem, size, dimNext, defaultValue);
    }
  }
  else {
    // last dimension
    if(defaultValue !== undefined) {
      // fill new elements with the default value
      for (i = oldLen; i < newLen; i++) {
        array[i] = object.clone(defaultValue);
      }
    }
  }
}

/**
 * Squeeze a multi dimensional array
 * @param {Array} array
 * @return {Array} array
 * @private
 */
exports.squeeze = function squeeze(array) {
  while(isArray(array) && array.length === 1) {
    array = array[0];
  }

  return array;
};

/**
 * Unsqueeze a multi dimensional array: add dimensions when missing
 * @param {Array} array
 * @param {Number} dims   Number of desired dimensions
 * @return {Array} array
 * @private
 */
exports.unsqueeze = function unsqueeze(array, dims) {
  var size = exports.size(array);

  for (var i = 0, ii = (dims - size.length); i < ii; i++) {
    array = [array];
  }

  return array;
};

/**
 * Flatten a multi dimensional array, put all elements in a one dimensional
 * array
 * @param {Array} array   A multi dimensional array
 * @return {Array}        The flattened array (1 dimensional)
 * @private
 */
exports.flatten = function flatten(array) {
  var flat = array,
      isArray = Array.isArray;

  while (isArray(flat[0])) {
    var next = [];
    for (var i = 0, ii = flat.length; i < ii; i++) {
      next = next.concat.apply(next, flat[i]);
    }
    flat = next;
  }

  return flat;
};

/**
 * Test whether an object is an array
 * @param {*} value
 * @return {Boolean} isArray
 */
exports.isArray = isArray;
},{"../error/DimensionError":29,"../error/IndexError":30,"./number":278,"./object":279,"./string":280,"./types":281}],274:[function(require,module,exports){
var BigNumber = require('decimal.js'),
    isNumber = require('./number').isNumber;
    digits = require('./number').digits;

/**
 * Test whether value is a BigNumber
 * @param {*} value
 * @return {Boolean} isBigNumber
 */
exports.isBigNumber = function isBigNumber(value) {
  return (value instanceof BigNumber);
};

/**
 * Convert a number to a formatted string representation.
 *
 * Syntax:
 *
 *    format(value)
 *    format(value, options)
 *    format(value, precision)
 *    format(value, fn)
 *
 * Where:
 *
 *    {Number} value   The value to be formatted
 *    {Object} options An object with formatting options. Available options:
 *                     {String} notation
 *                         Number notation. Choose from:
 *                         'fixed'          Always use regular number notation.
 *                                          For example '123.40' and '14000000'
 *                         'exponential'    Always use exponential notation.
 *                                          For example '1.234e+2' and '1.4e+7'
 *                         'auto' (default) Regular number notation for numbers
 *                                          having an absolute value between
 *                                          `lower` and `upper` bounds, and uses
 *                                          exponential notation elsewhere.
 *                                          Lower bound is included, upper bound
 *                                          is excluded.
 *                                          For example '123.4' and '1.4e7'.
 *                     {Number} precision   A number between 0 and 16 to round
 *                                          the digits of the number.
 *                                          In case of notations 'exponential' and
 *                                          'auto', `precision` defines the total
 *                                          number of significant digits returned
 *                                          and is undefined by default.
 *                                          In case of notation 'fixed',
 *                                          `precision` defines the number of
 *                                          significant digits after the decimal
 *                                          point, and is 0 by default.
 *                     {Object} exponential An object containing two parameters,
 *                                          {Number} lower and {Number} upper,
 *                                          used by notation 'auto' to determine
 *                                          when to return exponential notation.
 *                                          Default values are `lower=1e-3` and
 *                                          `upper=1e5`.
 *                                          Only applicable for notation `auto`.
 *    {Function} fn    A custom formatting function. Can be used to override the
 *                     built-in notations. Function `fn` is called with `value` as
 *                     parameter and must return a string. Is useful for example to
 *                     format all values inside a matrix in a particular way.
 *
 * Examples:
 *
 *    format(6.4);                                        // '6.4'
 *    format(1240000);                                    // '1.24e6'
 *    format(1/3);                                        // '0.3333333333333333'
 *    format(1/3, 3);                                     // '0.333'
 *    format(21385, 2);                                   // '21000'
 *    format(12.071, {notation: 'fixed'});                // '12'
 *    format(2.3,    {notation: 'fixed', precision: 2});  // '2.30'
 *    format(52.8,   {notation: 'exponential'});          // '5.28e+1'
 *
 * @param {BigNumber} value
 * @param {Object | Function | Number} [options]
 * @return {String} str The formatted value
 */
exports.format = function format(value, options) {
  if (typeof options === 'function') {
    // handle format(value, fn)
    return options(value);
  }

  // handle special cases
  if (!value.isFinite()) {
    return value.isNaN() ? 'NaN' : (value.gt(0) ? 'Infinity' : '-Infinity');
  }

  // default values for options
  var notation = 'auto';
  var precision = undefined;

  if (options !== undefined) {
    // determine notation from options
    if (options.notation) {
      notation = options.notation;
    }

    // determine precision from options
    if (isNumber(options)) {
      precision = options;
    }
    else if (options.precision) {
      precision = options.precision;
    }
  }

  // handle the various notations
  switch (notation) {
    case 'fixed':
      return exports.toFixed(value, precision);

    case 'exponential':
      return exports.toExponential(value, precision);

    case 'auto':
      // determine lower and upper bound for exponential notation.
        // TODO: implement support for upper and lower to be BigNumbers themselves
      var lower = 1e-3;
      var upper = 1e5;
      if (options && options.exponential) {
        if (options.exponential.lower !== undefined) {
          lower = options.exponential.lower;
        }
        if (options.exponential.upper !== undefined) {
          upper = options.exponential.upper;
        }
      }

      // adjust the configuration of the BigNumber constructor (yeah, this is quite tricky...)
      var oldConfig = {
        toExpNeg: value.constructor.toExpNeg,
        toExpPos: value.constructor.toExpPos
      };

      value.constructor.config({
        toExpNeg: Math.round(Math.log(lower) / Math.LN10),
        toExpPos: Math.round(Math.log(upper) / Math.LN10)
      });

      // handle special case zero
      if (value.isZero()) return '0';

      // determine whether or not to output exponential notation
      var str;
      var abs = value.abs();
      if (abs.gte(lower) && abs.lt(upper)) {
        // normal number notation
        str = value.toSignificantDigits(precision).toFixed();
      }
      else {
        // exponential notation
        str = exports.toExponential(value, precision);
      }

      // remove trailing zeros after the decimal point
      return str.replace(/((\.\d*?)(0+))($|e)/, function () {
        var digits = arguments[2];
        var e = arguments[4];
        return (digits !== '.') ? digits + e : e;
      });

    default:
      throw new Error('Unknown notation "' + notation + '". ' +
          'Choose "auto", "exponential", or "fixed".');
  }
};

/**
 * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
 * @param {BigNumber} value
 * @param {Number} [precision]  Number of digits in formatted output.
 *                              If not provided, the maximum available digits
 *                              is used.
 * @returns {string} str
 */
exports.toExponential = function toExponential (value, precision) {
  if (precision !== undefined) {
    return value.toExponential(precision - 1); // Note the offset of one
  }
  else {
    return value.toExponential();
  }
};

/**
 * Format a number with fixed notation.
 * @param {BigNumber} value
 * @param {Number} [precision=0]        Optional number of decimals after the
 *                                      decimal point. Zero by default.
 */
exports.toFixed = function toFixed (value, precision) {
  return value.toFixed(precision || 0);
  // Note: the (precision || 0) is needed as the toFixed of BigNumber has an
  // undefined default precision instead of 0.
};

},{"./number":278,"decimal.js":282}],275:[function(require,module,exports){
/**
 * Test whether value is a Boolean
 * @param {*} value
 * @return {Boolean} isBoolean
 */
exports.isBoolean = function isBoolean(value) {
  return (value instanceof Boolean) || (typeof value == 'boolean');
};

},{}],276:[function(require,module,exports){
exports.array = require('./array');
exports['boolean'] = require('./boolean');
exports.number = require('./number');
exports.bignumber = require('./bignumber');
exports.object = require('./object');
exports.string = require('./string');
exports.types = require('./types');

},{"./array":273,"./bignumber":274,"./boolean":275,"./number":278,"./object":279,"./string":280,"./types":281}],277:[function(require,module,exports){
var ArrayNode = require('../expression/node/ArrayNode'),
    OperatorNode = require('../expression/node/OperatorNode');

// GREEK LETTERS
var greek = {
  Alpha: 'A',     alpha: true,
  Beta: 'B',      beta: true,
  Gamma: true,    gamma: true,
  Delta: true,    delta: true,
  Epsilon: 'E',   epsilon: true,  varepsilon: true,
  Zeta: 'Z',      zeta: true,
  Eta: 'H',       eta: true,
  Theta: true,    theta: true,    vartheta: true,
  Iota: 'I',      iota: true,
  Kappa: 'K',     kappa: true,    varkappa: true,
  Lambda: true,   lambda: true,
  Mu: 'M',        mu: true,
  Nu: 'N',        nu: true,
  Xi: true,       xi: true,
  Omicron: 'O',   omicron: true,
  Pi: true,       pi: true,       varpi: true,
  Rho: 'P',       rho: true,      varrho: true,
  Sigma: true,    sigma: true,    varsigma: true,
  Tau: 'T',       tau: true,
  Upsilon: true,  upsilon: true,
  Phi: true,      phi: true,      varphi: true,
  Chi: 'X',       chi: true,
  Psi: true,      psi: true,
  Omega: true,    omega: true
};

var dots = {
  dots: true,
  ldots: true,
  cdots: true,
  vdots: true,
  ddots: true,
  idots: true
};

var logic = {
  'true': '\\mathrm{True}',
  'false': '\\mathrm{False}'
};

var other = {
  inf: '\\infty',
  Inf: '\\infty',
  infinity: '\\infty',
  Infinity: '\\infty',
  oo: '\\infty',
  lim: true,
  'undefined': '\\mathbf{?}'
};

// FUNCTIONS
var functions = {
  acos: '\\cos^{-1}',
  arccos: '\\cos^{-1}',
  cos: true,
  csc: true,
  csch: false,
  exp: true,
  ker: true,
  limsup: true,
  min: true,
  sinh: true,
  asin: '\\sin^{-1}',
  arcsin: '\\sin^{-1}',
  cosh: true,
  deg: true,
  gcd: true,
  lg: true,
  ln: true,
  Pr: true,
  sup: true,
  atan: '\\tan^{-1}',
  atan2: '\\tan2^{-1}',
  arctan: '\\tan^{-1}',
  cot: true,
  det: true,
  hom: true,
  log: true,
  log10: '\\log_{10}',
  sec: true,
  sech: false,
  tan: true,
  arg: true,
  coth: true,
  dim: true,
  inf: true,
  max: true,
  sin: true,
  tanh: true,

  fix: false,
  lcm: false,
  sign: false,
  xgcd: false,
  unary: false,

  // complex
  complex: false,
  conj: false,
  im: false,
  re: false,

  // matrix
  diag: false,
  resize: false,
  size: false,
  squeeze: false,
  subset: false,
  index: false,
  ones: false,
  zeros: false,
  range: false,

  // probability
  random: false,

  // statistics
  mean: '\\mu',
  median: false,
  prod: false,
  std: '\\sigma',
  'var': '\\sigma^2'
};

// CURLY FUNCTIONS
// wrap parameters with {}
var curlyFunctions = {
  sqrt: true,
  inv: true,
  int: '\\int',
  Int: '\\int',
  integrate: '\\int',
  eigenvalues: '\\lambda',
  liminf: true,
  lim: true,
  exp: 'e^',
  sum: true,

  eye: '\\mathbf{I}'
};

var operators = {
  '<=': '\\leq',
  '>=': '\\geq',
  '!=': '\\neq',
  'in': true,
  '*': '\\cdot',
  '/': '\\frac',
  'mod': '\\bmod',
  'to': '\\rightarrow'
};

var units = {
  deg: '^{\\circ}'
};

var symbols = {};

function mapSymbols() {
  var args = Array.prototype.slice.call(arguments),
      obj;
  for (var i = 0, len = args.length; i < len; i++) {
    obj = args[i];
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        symbols[key] = obj[key];
      }
    }
  }
}

mapSymbols(
  functions,
  curlyFunctions,
  greek,
  dots,
  logic,
  other
);

function latexIs(arr, value) {
  return typeof arr[value] !== 'undefined';
}

function latexIsFn(arr) {
  return function(value) {
    return latexIs(arr, value);
  };
}

function latexToFn(arr) {
  return function(value) {
    if (typeof arr[value] === 'boolean') {
      if (arr[value] === true) {
        value = '\\' + value;
      }
      else {
        value = '\\mathrm{' + value + '}';
      }
    }
    else if (typeof arr[value] === 'string') {
      value = arr[value];
    }
    else if (typeof value === 'string') {
      var index = value.indexOf('_');
      if (index !== -1) {
        value = exports.toSymbol(value.substring(0, index)) + '_{' +
            exports.toSymbol(value.substring(index+1)) + '}';
      }
    }

    return value;
  };
}

exports.isSymbol = latexIsFn(symbols);
exports.toSymbol = latexToFn(symbols);

exports.isFunction = latexIsFn(functions);
exports.toFunction = latexToFn(functions);

exports.isCurlyFunction = latexIsFn(curlyFunctions);
exports.toCurlyFunction = latexToFn(curlyFunctions);

exports.isOperator = latexIsFn(operators);
exports.toOperator = latexToFn(operators);

exports.isUnit = latexIsFn(units);
exports.toUnit = (function() {
  var _toUnit = latexToFn(units);

  return function(value, notSpaced) {
    if (exports.isUnit(value)) {
      return _toUnit(value);
    }

    return (notSpaced ? '' : '\\,') + '\\mathrm{' + value + '}';
  };
}());

exports.addBraces = function(s, brace, type) {
  if (brace === null) {
    return s;
  }

  var braces = ['', ''];
  type = type || 'normal';

  if (typeof brace === 'undefined' || brace === false) {
    braces = ['{', '}'];
  }
  else if (brace === true) {
    braces = ['(', ')'];
    type = 'lr';
  }
  else if (Array.isArray(brace) && brace.length === 2) {
    braces = brace;
  }
  else {
    braces = [brace, brace];
  }

  switch (type) {
    case 'normal':
    case false:
      return braces[0] + s + braces[1];

    case 'lr':
      return '\\left' + braces[0] + '{' + s + '}' + '\\right' + braces[1];

    case 'be':
      return '\\begin{' + braces[0] + '}' + s + '\\end{' + braces[1] + '}';
  }

  return braces[0] + s + braces[1];
};

exports.toParams = function(that) {
  var object = that.object,
      params = that.params,
      func = object.toTex(),
      texParams = null,
      brace = null,
      type = false,
      showFunc = false,
      prefix = '',
      suffix = '',
      op = null;

  switch (object.name) {
    // OPERATORS
    case 'add':
      op = '+';
      break;

    case 'subtract':
      op = '-';
      break;

    case 'larger':
      op = '>';
      break;

    case 'largereq':
      op = '>=';
      break;

    case 'smaller':
      op = '<';
      break;

    case 'smallereq':
      op = '<=';
      break;

    case 'unequal':
      op = '!=';
      break;

    case 'equal':
      op = '=';
      break;

    case 'mod':
      op = 'mod';
      break;

    case 'multiply':
      op = '*';
      break;

    case 'pow':
      op = '^';
      break;

    case 'concat':
      op = '||';
      break;

    case 'factorial':
      op = '!';
      break;

    case 'permutations':
      if (params.length === 1) {
        op = '!';
      }
      else {
        // op = 'P';
        var n = params[0].toTex(),
            k = params[1].toTex();
        return '\\frac{' + n + '!}{\\left(' + n + ' - ' + k + '\\right)!}';
      }
      break;

    // probability
    case 'combinations':
      op = '\\choose';
      break;

    // LR BRACES
    case 'abs':
      brace = '|';
      type = 'lr';
      break;

    case 'norm':
      brace = '\\|';
      type = 'lr';

      if (params.length === 2) {
        var tmp = params[1].toTex();

        if (tmp === '\\text{inf}') {
          tmp = '\\infty';
        }
        else if (tmp === '\\text{-inf}') {
          tmp = '{- \\infty}';
        }
        else if (tmp === '\\text{fro}') {
          tmp = 'F';
        }

        suffix = '_{' + tmp + '}';
        params = [params[0]];
      }
      break;

    case 'ceil':
      brace = ['\\lceil', '\\rceil'];
      type = 'lr';
      break;

    case 'floor':
      brace = ['\\lfloor', '\\rfloor'];
      type = 'lr';
      break;

    case 'round':
      brace = ['\\lfloor', '\\rceil'];
      type = 'lr';

      if (params.length === 2) {
        suffix = '_' + exports.addBraces(params[1].toTex());
        params = [params[0]];
      }
      break;


    // NORMAL BRACES
    case 'inv':
      suffix = '^{-1}';
      break;

    case 'transpose':
      suffix = '^{T}';
      brace = false;
      break;

    // SPECIAL NOTATION
    case 'log':
      var base = 'e';
      if (params.length === 2) {
        base = params[1].toTex();
        func = '\\log_{' + base + '}';
        params = [params[0]];
      }
      if (base === 'e') {
        func = '\\ln';
      }

      showFunc = true;
      break;

    case 'square':
      suffix = '^{2}';
      break;

    case 'cube':
      suffix = '^{3}';
      break;


    // MATRICES
    case 'eye':
      showFunc = true;
      brace = false;
      func += '_';
      break;

    case 'det':
      if (that.params[0] instanceof ArrayNode) {
        return that.params[0].toTex('vmatrix');
      }

      brace = 'vmatrix';
      type = 'be';
      break;

    default:
      showFunc = true;
      break;
  }

  if (op !== null) {
    brace = (op === '+' || op === '-');
    texParams = (new OperatorNode(op, object.name, params)).toTex();
  }
  else {
    op = ', ';
  }

  if (brace === null && !exports.isCurlyFunction(object.name)) {
    brace = true;
  }

  texParams = texParams || params.map(function(param) {
    return '{' + param.toTex() + '}'  ;
  }).join(op);

  return prefix + (showFunc ? func : '') +
      exports.addBraces(texParams, brace, type) +
      suffix;
};

},{"../expression/node/ArrayNode":148,"../expression/node/OperatorNode":155}],278:[function(require,module,exports){
/**
 * Test whether value is a Number
 * @param {*} value
 * @return {Boolean} isNumber
 */
exports.isNumber = function isNumber(value) {
  return (value instanceof Number) || (typeof value == 'number');
};

/**
 * Check if a number is integer
 * @param {Number | Boolean} value
 * @return {Boolean} isInteger
 */
exports.isInteger = function isInteger(value) {
  return (value == Math.round(value));
  // Note: we use ==, not ===, as we can have Booleans as well
};

/**
 * Calculate the sign of a number
 * @param {Number} x
 * @returns {*}
 */
exports.sign = function sign (x) {
  if (x > 0) {
    return 1;
  }
  else if (x < 0) {
    return -1;
  }
  else {
    return 0;
  }
};

/**
 * Convert a number to a formatted string representation.
 *
 * Syntax:
 *
 *    format(value)
 *    format(value, options)
 *    format(value, precision)
 *    format(value, fn)
 *
 * Where:
 *
 *    {Number} value   The value to be formatted
 *    {Object} options An object with formatting options. Available options:
 *                     {String} notation
 *                         Number notation. Choose from:
 *                         'fixed'          Always use regular number notation.
 *                                          For example '123.40' and '14000000'
 *                         'exponential'    Always use exponential notation.
 *                                          For example '1.234e+2' and '1.4e+7'
 *                         'auto' (default) Regular number notation for numbers
 *                                          having an absolute value between
 *                                          `lower` and `upper` bounds, and uses
 *                                          exponential notation elsewhere.
 *                                          Lower bound is included, upper bound
 *                                          is excluded.
 *                                          For example '123.4' and '1.4e7'.
 *                     {Number} precision   A number between 0 and 16 to round
 *                                          the digits of the number.
 *                                          In case of notations 'exponential' and
 *                                          'auto', `precision` defines the total
 *                                          number of significant digits returned
 *                                          and is undefined by default.
 *                                          In case of notation 'fixed',
 *                                          `precision` defines the number of
 *                                          significant digits after the decimal
 *                                          point, and is 0 by default.
 *                     {Object} exponential An object containing two parameters,
 *                                          {Number} lower and {Number} upper,
 *                                          used by notation 'auto' to determine
 *                                          when to return exponential notation.
 *                                          Default values are `lower=1e-3` and
 *                                          `upper=1e5`.
 *                                          Only applicable for notation `auto`.
 *    {Function} fn    A custom formatting function. Can be used to override the
 *                     built-in notations. Function `fn` is called with `value` as
 *                     parameter and must return a string. Is useful for example to
 *                     format all values inside a matrix in a particular way.
 *
 * Examples:
 *
 *    format(6.4);                                        // '6.4'
 *    format(1240000);                                    // '1.24e6'
 *    format(1/3);                                        // '0.3333333333333333'
 *    format(1/3, 3);                                     // '0.333'
 *    format(21385, 2);                                   // '21000'
 *    format(12.071, {notation: 'fixed'});                // '12'
 *    format(2.3,    {notation: 'fixed', precision: 2});  // '2.30'
 *    format(52.8,   {notation: 'exponential'});          // '5.28e+1'
 *
 * @param {Number} value
 * @param {Object | Function | Number} [options]
 * @return {String} str The formatted value
 */
exports.format = function format(value, options) {
  if (typeof options === 'function') {
    // handle format(value, fn)
    return options(value);
  }

  // handle special cases
  if (value === Infinity) {
    return 'Infinity';
  }
  else if (value === -Infinity) {
    return '-Infinity';
  }
  else if (isNaN(value)) {
    return 'NaN';
  }

  // default values for options
  var notation = 'auto';
  var precision = undefined;

  if (options !== undefined) {
    // determine notation from options
    if (options.notation) {
      notation = options.notation;
    }

    // determine precision from options
    if (exports.isNumber(options)) {
      precision = options;
    }
    else if (options.precision) {
      precision = options.precision;
    }
  }

  // handle the various notations
  switch (notation) {
    case 'fixed':
      return exports.toFixed(value, precision);

    case 'exponential':
      return exports.toExponential(value, precision);

    case 'auto':
      // determine lower and upper bound for exponential notation.
        // TODO: implement support for upper and lower to be BigNumbers themselves
      var lower = 1e-3;
      var upper = 1e5;
      if (options && options.exponential) {
        if (options.exponential.lower !== undefined) {
          lower = options.exponential.lower;
        }
        if (options.exponential.upper !== undefined) {
          upper = options.exponential.upper;
        }
      }

      // handle special case zero
      if (value === 0) return '0';

      // determine whether or not to output exponential notation
      var str;
      var abs = Math.abs(value);
      if (abs >= lower && abs < upper) {
        // normal number notation
        // Note: IE7 does not allow value.toPrecision(undefined)
        var valueStr = precision ?
            value.toPrecision(Math.min(precision, 21)) :
            value.toPrecision();
        str = parseFloat(valueStr) + '';
      }
      else {
        // exponential notation
        str = exports.toExponential(value, precision);
      }

      // remove trailing zeros after the decimal point
      return str.replace(/((\.\d*?)(0+))($|e)/, function () {
        var digits = arguments[2];
        var e = arguments[4];
        return (digits !== '.') ? digits + e : e;
      });

    default:
      throw new Error('Unknown notation "' + notation + '". ' +
          'Choose "auto", "exponential", or "fixed".');
  }
};

/**
 * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
 * @param {Number} value
 * @param {Number} [precision]  Number of digits in formatted output.
 *                              If not provided, the maximum available digits
 *                              is used.
 * @returns {string} str
 */
exports.toExponential = function toExponential (value, precision) {
  if (precision !== undefined) {
    return value.toExponential(Math.min(precision - 1, 20));
  }
  else {
    return value.toExponential();
  }
};

/**
 * Format a number with fixed notation.
 * @param {Number} value
 * @param {Number} [precision=0]        Optional number of decimals after the
 *                                      decimal point. Zero by default.
 */
exports.toFixed = function toFixed (value, precision) {
  return value.toFixed(Math.min(precision, 20));
};

/**
 * Count the number of significant digits of a number.
 *
 * For example:
 *   2.34 returns 3
 *   0.0034 returns 2
 *   120.5e+30 returns 4
 *
 * @param {Number} value
 * @return {Number} digits   Number of significant digits
 */
exports.digits = function digits (value) {
  return value
      .toExponential()
      .replace(/e.*$/, '')          // remove exponential notation
      .replace( /^0\.?0*|\./, '')   // remove decimal point and leading zeros
      .length
};

/**
 * Minimum number added to one that makes the result different than one
 */
exports.DBL_EPSILON = Number.EPSILON || 2.2204460492503130808472633361816E-16;

/**
 * Compares two floating point numbers.
 * @param {Number} x          First value to compare
 * @param {Number} y          Second value to compare
 * @param {Number} [epsilon]  The maximum relative difference between x and y
 *                            If epsilon is undefined or null, the function will
 *                            test whether x and y are exactly equal.
 * @return {boolean} whether the two numbers are equal
*/
exports.nearlyEqual = function(x, y, epsilon) {
  // if epsilon is null or undefined, test whether x and y are exactly equal
  if (epsilon == null) return x == y;

  // use "==" operator, handles infinities
  if (x == y) return true;

  // NaN
  if (isNaN(x) || isNaN(y)) return false;

  // at this point x and y should be finite
  if(isFinite(x) && isFinite(y)) {
    // check numbers are very close, needed when comparing numbers near zero
    var diff = Math.abs(x - y);
    if (diff < exports.DBL_EPSILON) {
      return true;
    }
    else {
      // use relative error
      return diff <= Math.max(Math.abs(x), Math.abs(y)) * epsilon;
    }
  }

  // Infinite and Number or negative Infinite and positive Infinite cases
  return false;
};

},{}],279:[function(require,module,exports){
/**
 * Clone an object
 *
 *     clone(x)
 *
 * Can clone any primitive type, array, and object.
 * If x has a function clone, this function will be invoked to clone the object.
 *
 * @param {*} x
 * @return {*} clone
 */
exports.clone = function clone(x) {
  var type = typeof x;

  // immutable primitive types
  if (type === 'number' || type === 'string' || type === 'boolean' ||
      x === null || x === undefined) {
    return x;
  }

  // use clone function of the object when available
  if (typeof x.clone === 'function') {
    return x.clone();
  }

  // array
  if (Array.isArray(x)) {
    return x.map(function (value) {
      return clone(value);
    });
  }

  if (x instanceof Number)  return new Number(x.valueOf());
  if (x instanceof String)  return new String(x.valueOf());
  if (x instanceof Boolean) return new Boolean(x.valueOf());
  if (x instanceof Date)    return new Date(x.valueOf());
  if (x instanceof RegExp)  throw new TypeError('Cannot clone ' + x);  // TODO: clone a RegExp

  // object
  var m = {};
  for (var key in x) {
    if (x.hasOwnProperty(key)) {
      m[key] = clone(x[key]);
    }
  }
  return m;
};

/**
 * Extend object a with the properties of object b
 * @param {Object} a
 * @param {Object} b
 * @return {Object} a
 */
exports.extend = function extend (a, b) {
  for (var prop in b) {
    if (b.hasOwnProperty(prop)) {
      a[prop] = b[prop];
    }
  }
  return a;
};

/**
 * Deep extend an object a with the properties of object b
 * @param {Object} a
 * @param {Object} b
 * @returns {Object}
 */
exports.deepExtend = function deepExtend (a, b) {
  // TODO: add support for Arrays to deepExtend
  if (Array.isArray(b)) {
    throw new TypeError('Arrays are not supported by deepExtend');
  }

  for (var prop in b) {
    if (b.hasOwnProperty(prop)) {
      if (b[prop] && b[prop].constructor === Object) {
        if (a[prop] === undefined) {
          a[prop] = {};
        }
        if (a[prop].constructor === Object) {
          deepExtend(a[prop], b[prop]);
        }
        else {
          a[prop] = b[prop];
        }
      } else if (Array.isArray(b[prop])) {
        throw new TypeError('Arrays are not supported by deepExtend');
      } else {
        a[prop] = b[prop];
      }
    }
  }
  return a;
};

/**
 * Deep test equality of all fields in two pairs of arrays or objects.
 * @param {Array | Object} a
 * @param {Array | Object} b
 * @returns {boolean}
 */
exports.deepEqual = function deepEqual (a, b) {
  var prop, i, len;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false;
    }

    if (a.length != b.length) {
      return false;
    }

    for (i = 0, len = a.length; i < len; i++) {
      if (!exports.deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  else if (a instanceof Object) {
    if (Array.isArray(b) || !(b instanceof Object)) {
      return false;
    }

    for (prop in a) {
      //noinspection JSUnfilteredForInLoop
      if (!exports.deepEqual(a[prop], b[prop])) {
        return false;
      }
    }
    for (prop in b) {
      //noinspection JSUnfilteredForInLoop
      if (!exports.deepEqual(a[prop], b[prop])) {
        return false;
      }
    }
    return true;
  }
  else {
    return (typeof a === typeof b) && (a == b);
  }
};

},{}],280:[function(require,module,exports){
var number = require('./number'),
    bignumber = require('./bignumber'),
    BigNumber = require('decimal.js');

/**
 * Test whether value is a String
 * @param {*} value
 * @return {Boolean} isString
 */
exports.isString = function isString(value) {
  return (value instanceof String) || (typeof value == 'string');
};

/**
 * Check if a text ends with a certain string.
 * @param {String} text
 * @param {String} search
 */
exports.endsWith = function endsWith(text, search) {
  var start = text.length - search.length;
  var end = text.length;
  return (text.substring(start, end) === search);
};

/**
 * Format a value of any type into a string.
 *
 * Usage:
 *     math.format(value)
 *     math.format(value, precision)
 *
 * If value is a function, the returned string is 'function' unless the function
 * has a property `description`, in that case this properties value is returned.
 *
 * Example usage:
 *     math.format(2/7);                // '0.2857142857142857'
 *     math.format(math.pi, 3);         // '3.14'
 *     math.format(new Complex(2, 3));  // '2 + 3i'
 *     math.format('hello');            // '"hello"'
 *
 * @param {*} value             Value to be stringified
 * @param {Object | Number | Function} [options]  Formatting options. See
 *                                                lib/util/number:format for a
 *                                                description of the available
 *                                                options.
 * @return {String} str
 */
exports.format = function format(value, options) {
  if (number.isNumber(value)) {
    return number.format(value, options);
  }

  if (value instanceof BigNumber) {
    return bignumber.format(value, options);
  }

  if (Array.isArray(value)) {
    return formatArray(value, options);
  }

  if (exports.isString(value)) {
    return '"' + value + '"';
  }

  if (typeof value === 'function') {
    return value.syntax ? value.syntax + '' : 'function';
  }

  if (value instanceof Object) {
    if (typeof value.format === 'function') {
      return value.format(options);
    }
    else {
      return value.toString();
    }
  }

  return String(value);
};

/**
 * Recursively format an n-dimensional matrix
 * Example output: "[[1, 2], [3, 4]]"
 * @param {Array} array
 * @param {Object | Number | Function} [options]  Formatting options. See
 *                                                lib/util/number:format for a
 *                                                description of the available
 *                                                options.
 * @returns {String} str
 */
function formatArray (array, options) {
  if (Array.isArray(array)) {
    var str = '[';
    var len = array.length;
    for (var i = 0; i < len; i++) {
      if (i != 0) {
        str += ', ';
      }
      str += formatArray(array[i], options);
    }
    str += ']';
    return str;
  }
  else {
    return exports.format(array, options);
  }
}

},{"./bignumber":274,"./number":278,"decimal.js":282}],281:[function(require,module,exports){
/**
 * Determine the type of a variable
 *
 *     typeof(x)
 *
 * @param {*} x
 * @return {String} type  Lower case type, for example 'number', 'string',
 *                        'array', 'date'.
 */
exports.type = function type (x) {
  var type = typeof x;

  if (type === 'object') {
    if (x === null) {
      return 'null';
    }
    if (x instanceof Boolean) {
      return 'boolean';
    }
    if (x instanceof Number) {
      return 'number';
    }
    if (x instanceof String) {
      return 'string';
    }
    if (Array.isArray(x)) {
      return 'array';
    }
    if (x instanceof Date) {
      return 'date';
    }
  }

  return type;
};

},{}],282:[function(require,module,exports){
/*! decimal.js v2.0.3 https://github.com/MikeMcl/decimal.js/LICENCE */
;(function (global) {
    'use strict';


    /*
     *  decimal.js v2.0.3
     *  An arbitrary-precision Decimal type for JavaScript.
     *  https://github.com/MikeMcl/decimal.js
     *  Copyright (c) 2014 Michael Mclaughlin <M8ch88l@gmail.com>
     *  MIT Expat Licence
     */


    var convertBase, crypto, DecimalConstructor, noConflict,
        toString = Object.prototype.toString,
        outOfRange,
        id = 0,
        external = true,
        NUMERALS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_',
        P = {},

        /*
         The maximum exponent magnitude.
         The limit on the value of #toExpNeg, #toExpPos, #minE and #maxE.
         */
        EXP_LIMIT = 9e15,                      // 0 to 9e15

        /*
         The limit on the value of #precision, and on the argument to #toDecimalPlaces,
         #toExponential, #toFixed, #toFormat, #toPrecision and #toSignificantDigits.
         */
        MAX_DIGITS = 1E9,                      // 0 to 1e+9

        /*
         To decide whether or not to calculate x.pow(integer y) using the 'exponentiation by
         squaring' algorithm or by exp(y*ln(x)), the number of significant digits of x is multiplied
         by y. If this number is less than #INT_POW_LIMIT then the former algorithm is used.
         */
        INT_POW_LIMIT = 3000,                  // 0 to 5000

        // The natural logarithm of 10 (1025 digits).
        LN10 = '2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058';


    // Decimal prototype methods


    /*
     * Return a new Decimal whose value is the absolute value of this Decimal.
     *
     */
    P['absoluteValue'] = P['abs'] = function () {
        var x = new this['constructor'](this);

        if ( x['s'] < 0 ) {
            x['s'] = 1;
        }

        return rnd(x);
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal rounded to a whole number in
     * the direction of positive Infinity.
     *
     */
    P['ceil'] = function () {

        return rnd( new this['constructor'](this), this['e'] + 1, 2 );
    };


    /*
     * Return
     *   1    if the value of this Decimal is greater than the value of Decimal(y, b),
     *  -1    if the value of this Decimal is less than the value of Decimal(y, b),
     *   0    if they have the same value,
     *  null  if the value of either Decimal is NaN.
     *
     */
    P['comparedTo'] = P['cmp'] = function ( y, b ) {
        var a,
            x = this,
            xc = x['c'],
            yc = ( id = -id, y = new x['constructor']( y, b ), y['c'] ),
            i = x['s'],
            j = y['s'],
            k = x['e'],
            l = y['e'];

        // Either NaN?
        if ( !i || !j ) {
            return null;
        }

        a = xc && !xc[0];
        b = yc && !yc[0];

        // Either zero?
        if ( a || b ) {
            return a ? b ? 0 : -j : i;
        }

        // Signs differ?
        if ( i != j ) {
            return i;
        }

        a = i < 0;

        // Either Infinity?
        if ( !xc || !yc ) {
            return k == l ? 0 : !xc ^ a ? 1 : -1;
        }

        // Compare exponents.
        if ( k != l ) {
            return k > l ^ a ? 1 : -1;
        }

        // Compare digit by digit.
        for ( i = -1,
              j = ( k = xc.length ) < ( l = yc.length ) ? k : l;
              ++i < j; ) {

            if ( xc[i] != yc[i] ) {
                return xc[i] > yc[i] ^ a ? 1 : -1;
            }
        }

        // Compare lengths.
        return k == l ? 0 : k > l ^ a ? 1 : -1;
    };


    /*
     * Return the number of decimal places of the value of this Decimal.
     *
     */
    P['decimalPlaces'] = P['dp'] = function () {
        var x = this;

        return x['c'] ? Math.max( x['c'].length - x['e'] - 1, 0 ) : null;
    };


    /*
     *  n / 0 = I
     *  n / N = N
     *  n / I = 0
     *  0 / n = 0
     *  0 / 0 = N
     *  0 / N = N
     *  0 / I = 0
     *  N / n = N
     *  N / 0 = N
     *  N / N = N
     *  N / I = N
     *  I / n = I
     *  I / 0 = I
     *  I / N = N
     *  I / I = N
     *
     * Return a new Decimal whose value is the value of this Decimal divided by Decimal(y, b),
     * rounded to #precision significant digits using rounding mode #rounding.
     *
     */
    P['dividedBy'] = P['div'] = function ( y, b ) {
        id = 2;

        return div( this, new this['constructor']( y, b ) );
    };


    /*
     * Return a new Decimal whose value is the integer part of dividing the value of this Decimal by
     * the value of Decimal(y, b), rounded to #precision significant digits using rounding mode
     * #rounding.
     *
     */
    P['dividedToIntegerBy'] = P['divToInt'] = function ( y, b ) {
        var x = this,
            Decimal = x['constructor'];
        id = 18;

        return rnd(
          div( x, new Decimal( y, b ), 0, 1, 1 ), Decimal['precision'], Decimal['rounding']
        );
    };


    /*
     * Return true if the value of this Decimal is equal to the value of Decimal(n, b), otherwise
     * return false.
     *
     */
    P['equals'] = P['eq'] = function ( n, b ) {
        id = 3;

        return this['cmp']( n, b ) === 0;
    };


    /*
     * Return a new Decimal whose value is the exponential of the value of this Decimal, i.e. the
     * base e raised to the power the value of this Decimal, rounded to #precision significant digits
     * using rounding mode #rounding.
     *
     */
    P['exponential'] = P['exp'] = function () {

        return exp(this);
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal rounded to a whole number in
     * the direction of negative Infinity.
     *
     */
    P['floor'] = function () {

        return rnd( new this['constructor'](this), this['e'] + 1, 3 );
    };


    /*
     * Return true if the value of this Decimal is greater than the value of Decimal(n, b), otherwise
     * return false.
     *
     */
    P['greaterThan'] = P['gt'] = function ( n, b ) {
        id = 4;

        return this['cmp']( n, b ) > 0;
    };


    /*
     * Return true if the value of this Decimal is greater than or equal to the value of
     * Decimal(n, b), otherwise return false.
     *
     */
    P['greaterThanOrEqualTo'] = P['gte'] = function ( n, b ) {
        id = 5;
        b = this['cmp']( n, b );

        return b == 1 || b === 0;
    };


    /*
     * Return true if the value of this Decimal is a finite number, otherwise return false.
     *
     */
    P['isFinite'] = function () {

        return !!this['c'];
    };


    /*
     * Return true if the value of this Decimal is an integer, otherwise return false.
     *
     */
    P['isInteger'] = P['isInt'] = function () {

        return !!this['c'] && this['e'] > this['c'].length - 2;
    };


    /*
     * Return true if the value of this Decimal is NaN, otherwise return false.
     *
     */
    P['isNaN'] = function () {

        return !this['s'];
    };


    /*
     * Return true if the value of this Decimal is negative, otherwise return false.
     *
     */
    P['isNegative'] = P['isNeg'] = function () {

        return this['s'] < 0;
    };


    /*
     * Return true if the value of this Decimal is 0 or -0, otherwise return false.
     *
     */
    P['isZero'] = function () {

        return !!this['c'] && this['c'][0] == 0;
    };


    /*
     * Return true if the value of this Decimal is less than Decimal(n, b), otherwise return false.
     *
     */
    P['lessThan'] = P['lt'] = function ( n, b ) {
        id = 6;

        return this['cmp']( n, b ) < 0;
    };


    /*
     * Return true if the value of this Decimal is less than or equal to Decimal(n, b), otherwise
     * return false.
     *
     */
    P['lessThanOrEqualTo'] = P['lte'] = function ( n, b ) {
        id = 7;
        b = this['cmp']( n, b );

        return b == -1 || b === 0;
    };


    /*
     * Return the logarithm of the value of this Decimal to the specified base, rounded
     * to #precision significant digits using rounding mode #rounding.
     *
     * If no base is specified, return log[10](arg).
     *
     * log[base](arg) = ln(arg) / ln(base)
     *
     * The result will always be correctly rounded if the base of the log is 2 or 10, and
     * 'almost always' if not:
     *
     * Depending on the rounding mode, the result may be incorrectly rounded if the first fifteen
     * rounding digits are [49]99999999999999 or [50]00000000000000. In that case, the maximum error
     * between the result and the correctly rounded result will be one ulp (unit in the last place).
     *
     * log[-b](a)       = NaN
     * log[0](a)        = NaN
     * log[1](a)        = NaN
     * log[NaN](a)      = NaN
     * log[Infinity](a) = NaN
     * log[b](0)        = -Infinity
     * log[b](-0)       = -Infinity
     * log[b](-a)       = NaN
     * log[b](1)        = 0
     * log[b](Infinity) = Infinity
     * log[b](NaN)      = NaN
     *
     * [base] {number|string|Decimal} The base of the logarithm.
     * [b] {number} The base of base.
     *
     */
    P['logarithm'] = P['log'] = function ( base, b ) {
        var base10, c, denom, i, inf, num, sd, sd10, r,
            arg = this,
            Decimal = arg['constructor'],
            pr = Decimal['precision'],
            rm = Decimal['rounding'],
            guard = 5;

        // Default base is 10.
        if ( base == null ) {
            base = new Decimal(10);
            base10 = true;
        } else {
            id = 15;
            base = new Decimal( base, b );
            c = base['c'];

            // If #base < 0 or +-Infinity/NaN or 0 or 1.
            if ( base['s'] < 0 || !c || !c[0] || !base['e'] && c[0] == 1 && c.length == 1 ) {

                return new Decimal(NaN);
            }
            base10 = base['eq'](10);
        }
        c = arg['c'];

        // If #arg < 0 or +-Infinity/NaN or 0 or 1.
        if ( arg['s'] < 0 || !c || !c[0] || !arg['e'] && c[0] == 1 && c.length == 1 ) {

            return new Decimal( c && !c[0] ? -1 / 0 : arg['s'] != 1 ? NaN : c ? 0 : 1 / 0 );
        }

        /*
          The result will have an infinite decimal expansion if #base is 10 and #arg is not an
          integer power of 10...
         */
        inf = base10 && ( c[0] != 1 || c.length > 1 ) ||

          // ...or if #base last digit's evenness is not the same as #arg last digit's evenness...
          ( base['c'][ base['c'].length - 1 ] & 1 ) != ( c[ c.length - 1 ] & 1 ) || 0 &&

              // ...or if #base is 2 and there is more than one 1 in #arg in base 2.
              base['eq'](2) && arg.toString(2).replace( /[^1]+/g, '' ) != '1';

        external = false;
        sd = pr + guard;
        sd10 = sd + 10;
        num = ln( arg, sd );

        if (base10) {

            if ( sd10 > LN10.length ) {
                ifExceptionsThrow( Decimal, 1, sd10, 'log' );
            }
            denom = new Decimal( LN10.slice( 0, sd10 ) );
        } else {
            denom = ln( base, sd );
        }

        // The result will have 5 rounding digits.
        r = div( num, denom, sd, 1 );

        /*
         If at a rounding boundary, i.e. the result's rounding digits are [49]9999 or [50]0000,
         calculate 10 further digits.

         If the result is known to have an infinite decimal expansion, repeat this until it is
         clear that the result is above or below the boundary. Otherwise, if after calculating
         the 10 further digits, the last 14 are nines, round up and assume the result is exact.
         Also assume the result is exact if the last 14 are zero.

         Example of a result that will be incorrectly rounded:
         log[1048576](4503599627370502) = 2.60000000000000009610279511444746...
         The above result correctly rounded using ROUND_CEIL to 1 decimal place should be 2.7,
         but it will be given as 2.6 as there are 15 zeros immediately after the requested
         decimal place, so the exact result would be assumed to be 2.6, which rounded using
         ROUND_CEIL to 1 decimal place is still 2.6.
         */
        if ( checkRoundingDigits( r['c'], i = pr, rm ) ) {

            do {
                sd += 10;
                num = ln( arg, sd );

                if (base10) {
                    sd10 = sd + 10;

                    if ( sd10 > LN10.length ) {
                        ifExceptionsThrow( Decimal, 1, sd10, 'log' );
                    }
                    denom = new Decimal( LN10.slice( 0, sd10 ) );
                } else {
                    denom = ln( base, sd );
                }

                r = div( num, denom, sd, 1 );

                if ( !inf ) {

                    // Check for 14 nines from the 2nd rounding digit, as the first may be 4.
                    for ( c = r['c']; c[++i] == 9; ) {
                    }

                    if ( i == pr + guard + 10 ) {
                        r = rnd( r, pr + 1, 0 );
                    }

                    break;
                }
            } while ( checkRoundingDigits( r['c'], i += 10, rm ) );
        }
        external = true;

        return rnd( r, pr, rm );
    };


    /*
     *  n - 0 = n
     *  n - N = N
     *  n - I = -I
     *  0 - n = -n
     *  0 - 0 = 0
     *  0 - N = N
     *  0 - I = -I
     *  N - n = N
     *  N - 0 = N
     *  N - N = N
     *  N - I = N
     *  I - n = I
     *  I - 0 = I
     *  I - N = N
     *  I - I = N
     *
     * Return a new Decimal whose value is the value of this Decimal minus Decimal(y, b), rounded
     * to #precision significant digits using rounding mode #rounding.
     *
     */
    P['minus'] = function ( y, b ) {
        var t, i, j, xLTy,
            x = this,
            Decimal = x['constructor'],
            a = x['s'];

        id = 8;
        y = new Decimal( y, b );
        b = y['s'];

        // Either NaN?
        if ( !a || !b ) {

            return new Decimal(NaN);
        }

        // Signs differ?
        if ( a != b ) {
            y['s'] = -b;

            return x['plus'](y);
        }

        var xc = x['c'],
            xe = x['e'],
            yc = y['c'],
            ye = y['e'],
            pr = Decimal['precision'],
            rm = Decimal['rounding'];

        if ( !xe || !ye ) {

            // Either Infinity?
            if ( !xc || !yc ) {

                return xc ? ( y['s'] = -b, y ) : new Decimal( yc ? x : NaN );
            }

            // Either zero?
            if ( !xc[0] || !yc[0] ) {

                // Return #y if #y is non-zero, #x if #x is non-zero, or zero if both are zero.
                x = yc[0] ? ( y['s'] = -b, y ) : new Decimal( xc[0] ? x :

                  // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
                  rm == 3 ? -0 : 0 );

                return external ? rnd( x, pr, rm ) : x;
            }
        }

        xc = xc.slice();
        i = xc.length;

        // Determine which is the bigger number. Prepend zeros to equalise exponents.
        if ( a = xe - ye ) {

            if ( xLTy = a < 0 ) {
                a = -a;
                t = xc;
                i = yc.length;
            } else {
                ye = xe;
                t = yc;
            }

            if ( pr > i ) {
                i = pr;
            }

            /*
             Numbers with massively different exponents would result in a massive number of
             zeros needing to be prepended, but this can be avoided while still ensuring correct
             rounding by limiting the number of zeros to max( #precision, #i ) + 2, where #pr is
             #precision and #i is the length of the coefficient of whichever is greater #x or #y.
             */
            if ( a > ( i += 2 ) ) {
                a = i;
                t.length = 1;
            }

            for ( t.reverse(), b = a; b--; t.push(0) ) {
            }
            t.reverse();
        } else {

            // Exponents equal. Check digit by digit.
            if ( xLTy = i < ( j = yc.length ) ) {
                j = i;
            }

            for ( a = b = 0; b < j; b++ ) {

                if ( xc[b] != yc[b] ) {
                    xLTy = xc[b] < yc[b];

                    break;
                }
            }
        }

        // #x < #y? Point #xc to the array of the bigger number.
        if ( xLTy ) {
            t = xc, xc = yc, yc = t;
            y['s'] = -y['s'];
        }

        /*
         Append zeros to #xc if shorter. No need to add zeros to #yc if shorter as subtraction only
         needs to start at #yc length.
         */
        if ( ( b = -( ( j = xc.length ) - yc.length ) ) > 0 ) {

            for ( ; b--; xc[j++] = 0 ) {
            }
        }

        // Subtract #yc from #xc.
        for ( b = yc.length; b > a; ){

            if ( xc[--b] < yc[b] ) {

                for ( i = b; i && !xc[--i]; xc[i] = 9 ) {
                }
                --xc[i];
                xc[b] += 10;
            }
            xc[b] -= yc[b];
        }

        // Remove trailing zeros.
        for ( ; xc[--j] == 0; xc.pop() ) {
        }

        // Remove leading zeros and adjust exponent accordingly.
        for ( ; xc[0] == 0; xc.shift(), --ye ) {
        }

        if ( !xc[0] ) {

            // Zero.
            xc = [ ye = 0 ];

            // Following IEEE 754 (2008) 6.3, n - n = -0 when rounding towards -Infinity.
            y['s'] = rm == 3 ? -1 : 1;
        }

        y['c'] = xc;
        y['e'] = ye;

        return external ? rnd( y, pr, rm ) : y;
    };


    /*
     *   n % 0 =  N
     *   n % N =  N
     *   n % I =  n
     *   0 % n =  0
     *  -0 % n = -0
     *   0 % 0 =  N
     *   0 % N =  N
     *   0 % I =  0
     *   N % n =  N
     *   N % 0 =  N
     *   N % N =  N
     *   N % I =  N
     *   I % n =  N
     *   I % 0 =  N
     *   I % N =  N
     *   I % I =  N
     *
     * Return a new Decimal whose value is the value of this Decimal modulo Decimal(y, b), rounded
     * to #precision significant digits using rounding mode #rounding.
     *
     * The result depends on the modulo mode.
     *
     */
    P['modulo'] = P['mod'] = function ( y, b ) {
        var n, q,
            x = this,
            Decimal = x['constructor'],
            m = Decimal['modulo'];

        id = 9;
        y = new Decimal( y, b );
        b = y['s'];
        n = !x['c'] || !b || y['c'] && !y['c'][0];

        /*
         Return NaN if #x is Infinity or NaN, or #y is NaN or zero, else return #x if #y is Infinity
         or #x is zero.
         */
        if ( n || !y['c'] || x['c'] && !x['c'][0] ) {

            return n
              ? new Decimal(NaN)
              : rnd( new Decimal(x), Decimal['precision'], Decimal['rounding'] );
        }

        external = false;

        if ( m == 9 ) {

            // Euclidian division: q = sign(y) * floor(x / abs(y))
            // r = x - qy    where  0 <= r < abs(y)
            y['s'] = 1;
            q = div( x, y, 0, 3, 1 );
            y['s'] = b;
            q['s'] *= b;
        } else {
            q = div( x, y, 0, m, 1 );
        }

        q = q['times'](y);
        external = true;

        return x['minus'](q);
    };


    /*
     * Return a new Decimal whose value is the natural logarithm of the value of this Decimal,
     * rounded to #precision significant digits using rounding mode #rounding.
     *
     */
    P['naturalLogarithm'] = P['ln'] = function () {

        return ln(this);
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal negated, i.e. as if
     * multiplied by -1.
     *
     */
    P['negated'] = P['neg'] = function () {
        var x = new this['constructor'](this);
        x['s'] = -x['s'] || null;

        return rnd(x);
    };


    /*
     *  n + 0 = n
     *  n + N = N
     *  n + I = I
     *  0 + n = n
     *  0 + 0 = 0
     *  0 + N = N
     *  0 + I = I
     *  N + n = N
     *  N + 0 = N
     *  N + N = N
     *  N + I = N
     *  I + n = I
     *  I + 0 = I
     *  I + N = N
     *  I + I = I
     *
     * Return a new Decimal whose value is the value of this Decimal plus Decimal(y, b), rounded
     * to #precision significant digits using rounding mode #rounding.
     *
     */
    P['plus'] = function ( y, b ) {
        var t,
            x = this,
            Decimal = x['constructor'],
            a = x['s'];

        id = 10;
        y = new Decimal( y, b ) ;
        b = y['s'];

        // Either NaN?
        if ( !a || !b ) {

            return new Decimal(NaN);
        }

        // Signs differ?
        if ( a != b ) {
            y['s'] = -b;

            return x['minus'](y);
        }

        var xe = x['e'],
            xc = x['c'],
            ye = y['e'],
            yc = y['c'],
            pr = Decimal['precision'],
            rm = Decimal['rounding'];

        if ( !xe || !ye ) {

            // Either Infinity?
            if ( !xc || !yc ) {

                // Return +-Infinity.
                return new Decimal( a / 0 );
            }

            // Either zero?
            if ( !xc[0] || !yc[0] ) {

                // Return #y if #y is non-zero, #x if #x is non-zero, or zero if both are zero.
                x = yc[0] ? y: new Decimal( xc[0] ? x : a * 0 );

                return external ? rnd( x, pr, rm ) : x;
            }
        }

        xc = xc.slice();

        // Prepend zeros to equalise exponents. Note: Faster to use reverse then do unshifts.
        if ( a = xe - ye ) {

            if ( a < 0 ) {
                a = -a;
                t = xc;
                b = yc.length;
            } else {
                ye = xe;
                t = yc;
                b = xc.length;
            }

            if ( pr > b ) {
                b = pr;
            }

            // Limit number of zeros prepended to max( #pr, #b ) + 1.
            if ( a > ++b ) {
                a = b;
                t.length = 1;
            }

            for ( t.reverse(); a--; t.push(0) ) {
            }
            t.reverse();
        }

        // Point #xc to the longer array.
        if ( xc.length - yc.length < 0 ) {
            t = yc, yc = xc, xc = t;
        }

        // Only start adding at yc.length - 1 as the further digits of #xc can be left as they are.
        for ( a = yc.length, b = 0; a; xc[a] %= 10 ) {
             b = ( xc[--a] = xc[a] + yc[a] + b ) / 10 | 0;
        }

        if (b) {
            xc.unshift(b);
            ++ye;
        }

         // Remove trailing zeros.
        for ( a = xc.length; xc[--a] == 0; xc.pop() ) {
        }

        // No need to check for zero, as +x + +y != 0 && -x + -y != 0

        y['c'] = xc;
        y['e'] = ye;

        return external ? rnd( y, pr, rm ) : y;
    };


    /*
     * Return the number of significant digits of this Decimal.
     *
     * z {boolean|number} Whether to count integer-part trailing zeros: true, false, 1 or 0.
     *
     */
    P['precision'] = P['sd'] = function (z) {
        var x = this;

        if ( z != null ) {

            if ( z !== !!z && z !== 1 && z !== 0 ) {

                // 'precision() argument not a boolean or binary digit: {z}'
                ifExceptionsThrow( x['constructor'], 'argument', z, 'precision', 1 );
            }
        }

        return x['c'] ? z ? Math.max( x['e'] + 1, x['c'].length ) : x['c'].length : null;
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal rounded to a whole number using
     * rounding mode #rounding.
     *
     */
    P['round'] = function () {
        var x = this,
            Decimal = x['constructor'];

        return rnd( new Decimal(x), x['e'] + 1, Decimal['rounding'] );
    };


    /*
     *  sqrt(-n) =  N
     *  sqrt( N) =  N
     *  sqrt(-I) =  N
     *  sqrt( I) =  I
     *  sqrt( 0) =  0
     *  sqrt(-0) = -0
     *
     * Return a new Decimal whose value is the square root of this Decimal, rounded to #precision
     * significant digits using rounding mode #rounding.
     *
     */
    P['squareRoot'] = P['sqrt'] = function () {
        var n, sd, r, rep, t,
            x = this,
            c = x['c'],
            s = x['s'],
            e = x['e'],
            Decimal = x['constructor'],
            half = new Decimal(0.5);

        // Negative/NaN/Infinity/zero?
        if ( s !== 1 || !c || !c[0] ) {

            return new Decimal( !s || s < 0 && ( !c || c[0] ) ? NaN : c ? x : 1 / 0 );
        }

        external = false;

        // Initial estimate.
        s = Math.sqrt( +x );

        /*
         Math.sqrt underflow/overflow?
         Pass x to Math.sqrt as integer, then adjust the exponent of the result.
         */
        if ( s == 0 || s == 1 / 0 ) {
            n = c.join('');

            if ( ( n.length + e ) % 2 == 0 ) {
                n += '0';
            }
            r = new Decimal( Math.sqrt(n) + '' );

            // r may not be finite.
            if ( !r['c'] ) {
                r['c'] = [1];
            }

            r['e'] = Math.floor( ( e + 1 ) / 2 ) - ( e < 0 || e % 2 );
        } else {
            r = new Decimal( s.toString() );
        }

        sd = ( e = Decimal['precision'] ) + 3;

        // Newton-Raphson iteration.
        for ( ; ; ) {
            t = r;
            r = half['times']( t['plus']( div( x, t, sd + 2, 1 ) ) );

            if ( t['c'].slice( 0, sd ).join('') === r['c'].slice( 0, sd ).join('') ) {
                c = r['c'];

                /*
                 The 4th rounding digit may be in error by -1 so if the 4 rounding digits are
                 9999 or 4999 (i.e. approaching a rounding boundary) continue the iteration.
                 */
                if ( ( c[sd - 3] == 9 || !rep && c[sd - 3] == 4 ) &&
                       c[sd - 2] == 9 && c[sd - 1] == 9 && c[sd] == 9 ) {

                    /*
                     On the first run through, check to see if rounding up gives the exact result as
                     the nines may infinitely repeat.
                     */
                    if ( !rep ) {
                        t = rnd( t, e + 1, 0 );

                        if ( t['times'](t)['eq'](x) ) {
                            r = t;

                            break;
                        }
                    }
                    sd += 4;
                    rep = 1;
                } else {

                    /*
                     If the rounding digits are null, 0000 or 5000, check for an exact result.
                     If not, then there are further digits so increment the 1st rounding digit
                     to ensure correct rounding.
                     */
                    if ( ( !c[sd - 3] || c[sd - 3] == 5 ) && !c[sd - 2] &&
                      !c[sd - 1] && !c[sd] ) {

                        // Truncate to the first rounding digit.
                        if ( c.length > e + 1 ) {
                            c.length = e + 1;
                        }

                        if ( !r['times'](r)['eq'](x) ) {

                            while ( c.length < e ) {
                                c.push(0);
                            }
                            c[e]++;
                        }
                    }

                    break;
                }
            }
        }
        external = true;

        return rnd( r, e, Decimal['rounding'] );
    };


    /*
     *  n * 0 = 0
     *  n * N = N
     *  n * I = I
     *  0 * n = 0
     *  0 * 0 = 0
     *  0 * N = N
     *  0 * I = N
     *  N * n = N
     *  N * 0 = N
     *  N * N = N
     *  N * I = N
     *  I * n = I
     *  I * 0 = N
     *  I * N = N
     *  I * I = I
     *
     * Return a new Decimal whose value is this Decimal times Decimal(y), rounded to #precision
     * significant digits using rounding mode #rounding.
     *
     */
    P['times'] = function ( y, b ) {
        var c,
            x = this,
            Decimal = x['constructor'],
            xc = x['c'],
            yc = ( id = 11, y = new Decimal( y, b ), y['c'] ),
            i = x['e'],
            j = y['e'],
            a = x['s'];

        b = y['s'];

        y['s'] = a == b ? 1 : -1;

        // Either NaN/Infinity/0?
        if ( !i && ( !xc || !xc[0] ) || !j && ( !yc || !yc[0] ) ) {

            // Either NaN?
            return new Decimal( !a || !b ||

              // #x is 0 and #y is Infinity  or #y is 0 and #x is Infinity?
              xc && !xc[0] && !yc || yc && !yc[0] && !xc

                // Return NaN.
                ? NaN

                // Either Infinity?
                : !xc || !yc

                  // Return +-Infinity.
                  ? y['s'] / 0

                  // #x or #y is 0. Return +-0.
                  : y['s'] * 0 );
        }

        y['e'] = i + j;
        a = xc.length;
        b = yc.length;

        if ( a < b ) {

            // Swap.
            c = xc, xc = yc, yc = c;
            j = a, a = b, b = j;
        }

        for ( j = a + b, c = []; j--; c.push(0) ) {
        }

        // Multiply!
        for ( i = b - 1; i > -1; i-- ) {

            for ( b = 0, j = a + i; j > i; b = b / 10 | 0 ) {
                  b = c[j] + yc[i] * xc[j - i - 1] + b;
                  c[j--] = b % 10 | 0;
            }

            if (b) {
                c[j] = ( c[j] + b ) % 10;
            }
        }

        if (b) {
            ++y['e'];
        }

        // Remove any leading zero.
        if ( !c[0] ) {
            c.shift();
        }

        // Remove trailing zeros.
        for ( j = c.length; !c[--j]; c.pop() ) {
        }
        y['c'] = c;

        return external ? rnd( y, Decimal['precision'], Decimal['rounding'] ) : y;
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal rounded to a maximum of #dp
     * decimal places using rounding mode #rm or #rounding if #rm is omitted.
     *
     * If #dp is omitted, return a new Decimal whose value is the value of this Decimal.
     *
     * [dp] {number} Decimal places. Integer, 0 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     * 'toDP() dp out of range: {dp}'
     * 'toDP() dp not an integer: {dp}'
     * 'toDP() rounding mode not an integer: {rm}'
     * 'toDP() rounding mode out of range: {rm}'
     *
     */
    P['toDecimalPlaces'] = P['toDP'] = function ( dp, rm ) {
        var x = this;
        x = new x['constructor'](x);

        return dp == null || !checkArg( x, dp, 'toDP' )
          ? x
          : rnd( x, ( dp | 0 ) + x['e'] + 1, checkRM( x, rm, 'toDP' ) );
    };


    /*
     * Return a string representing the value of this Decimal in exponential notation rounded to #dp
     * fixed decimal places using rounding mode #rounding.
     *
     * [dp] {number} Decimal places. Integer, 0 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     * #errors true: Throw if #dp and #rm are not undefined, null or integers in range.
     * #errors false: Ignore #dp and #rm if not numbers or not in range, and truncate non-integers.
     *
     * 'toExponential() dp not an integer: {dp}'
     * 'toExponential() dp out of range: {dp}'
     * 'toExponential() rounding mode not an integer: {rm}'
     * 'toExponential() rounding mode out of range: {rm}'
     *
     */
    P['toExponential'] = function ( dp, rm ) {
        var x = this;

        return format( x, dp != null && checkArg( x, dp, 'toExponential' ) || !x['c']
          ? dp | 0 : x['c'].length - 1, dp != null && checkRM( x, rm, 'toExponential' ), 1 );
    };


    /*
     * Return a string representing the value of this Decimal in normal (fixed-point) notation to
     * #dp fixed decimal places and rounded using rounding mode #rm or #rounding if #rm is omitted.
     *
     * Note: as with JS numbers, (-0).toFixed(0) is '0', but e.g. (-0.00001).toFixed(0) is '-0'.
     *
     * [dp] {number} Decimal places. Integer, -MAX_DIGITS to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     * #errors true: Throw if #dp and #rm are not undefined, null or integers in range.
     * #errors false: Ignore #dp and #rm if not numbers or not in range, and truncate non-integers.
     *
     * 'toFixed() dp not an integer: {dp}'
     * 'toFixed() dp out of range: {dp}'
     * 'toFixed() rounding mode not an integer: {rm}'
     * 'toFixed() rounding mode out of range: {rm}'
     *
     */
    P['toFixed'] = function ( dp, rm ) {
        var str,
            x = this,
            Decimal = x['constructor'],
            neg = Decimal['toExpNeg'],
            pos = Decimal['toExpPos'];

        if ( dp != null ) {
            dp = checkArg( x, dp, str = 'toFixed', -MAX_DIGITS ) ? x['e'] + ( dp | 0 ) : null;
            rm = checkRM( x, rm, str );
        }

        // Prevent #toString returning exponential notation;
        Decimal['toExpNeg'] = -( Decimal['toExpPos'] = 1 / 0 );

        if ( dp == null ) {
            str = x.toString();
        } else {
            str = format( x, dp, rm );

            // (-0).toFixed() is '0', but (-0.1).toFixed() is '-0'.
            // (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
            if ( x['s'] < 0 && x['c'] ) {

                // As e.g. (-0).toFixed(3), will wrongly be returned as -0.000 from toString.
                if ( !x['c'][0] ) {
                    str = str.replace( '-', '' );

                // As e.g. -0.5 if rounded to -0 will cause toString to omit the minus sign.
                } else if ( str.indexOf('-') < 0 ) {
                    str = '-' + str;
                }
            }
        }
        Decimal['toExpNeg'] = neg;
        Decimal['toExpPos'] = pos;

        return str;
    };


    /*
     * Return a string representing the value of this Decimal in normal notation rounded using
     * rounding mode #rounding to #dp fixed decimal places, with the integer part of the number
     * separated into thousands by string #sep1 or ',' if #sep1 is null or undefined, and the fraction
     * part separated into groups of five digits by string #sep2.
     *
     * [sep1] {string} The grouping separator of the integer part of the number.
     * [sep2] {string} The grouping separator of the fraction part of the number.
     * [dp] {number} Decimal places. Integer, -MAX_DIGITS to MAX_DIGITS inclusive.
     *
     * Non-breaking thin-space: \u202f
     *
     * If #dp is invalid the error message will incorrectly give the method as toFixed.
     *
     */
    P['toFormat'] = function ( sep1, dp, sep2 ) {
        var arr = this.toFixed(dp).split('.');

        return arr[0].replace( /\B(?=(\d{3})+$)/g, sep1 == null ? ',' : sep1 + '' ) +
            ( arr[1] ? '.' + ( sep2 ? arr[1].replace( /\d{5}\B/g, '$&' + sep2 ) : arr[1] ) : '' );
    };


    /*
     * Return a string array representing the value of this Decimal as a simple fraction with an
     * integer numerator and an integer denominator.
     *
     * The denominator will be a positive non-zero value less than or equal to the specified
     * maximum denominator. If a maximum denominator is not specified, the denominator will be
     * the lowest value necessary to represent the number exactly.
     *
     * [maxD] {number|string|Decimal} Maximum denominator. Integer >= 1 and < Infinity.
     *
     */
    P['toFraction'] = function (maxD) {
        var d0, d2, e, frac, n, n0, q,
            x = this,
            Decimal = x['constructor'],
            n1 = d0 = new Decimal( Decimal['ONE'] ),
            d1 = n0 = new Decimal(0),
            xc = x['c'],
            d = new Decimal( Decimal['ONE'] ),
            pr = Decimal['precision'];

        // NaN, Infinity.
        if ( !xc ) {

            return x.toString();
        }

        e = d['e'] = xc.length - x['e'] - 1;

        // If #maxD is undefined or null...
        if ( maxD == null ||

             // or NaN...
             ( !( id = 12, n = new Decimal(maxD) )['s'] ||

               // or less than 1, or Infinity...
               ( outOfRange = n['cmp'](n1) < 0 || !n['c'] ) ||

                 // or not an integer...
                 ( Decimal['errors'] && n['e'] < n['c'].length - 1 ) ) &&

                   // 'toFraction() max denominator not an integer: {maxD}'
                   // 'toFraction() max denominator out of range: {maxD}'
                   !ifExceptionsThrow( Decimal, 'max denominator', maxD, 'toFraction', 0 ) ||

                     // or greater than the maximum denominator needed to specify the value exactly.
                     ( maxD = n )['cmp'](d) > 0 ) {

            // d is 10**e, n1 is 1.
            maxD = e > 0 ? d : n1;
        }

        external = false;
        n = new Decimal( xc.join('') );

        // #plus and #minus need #precision to be at least xc.length.
        Decimal['precision'] = xc.length;

        for ( ; ; )  {
            q = div( n, d, 0, 1, 1 );
            d2 = d0['plus']( q['times'](d1) );

            if ( d2['cmp'](maxD) == 1 ) {

                break;
            }
            d0 = d1, d1 = d2;

            n1 = n0['plus']( q['times']( d2 = n1 ) );
            n0 = d2;

            d = n['minus']( q['times']( d2 = d ) );
            n = d2;
        }

        d2 = div( maxD['minus'](d0), d1, 0, 1, 1 );
        n0 = n0['plus']( d2['times'](n1) );
        d0 = d0['plus']( d2['times'](d1) );

        n0['s'] = n1['s'] = x['s'];

        // The required decimal places.
        e *= 2;

        // Determine which fraction is closer to #x, #n0 /# d0 or #n1 / #d1?
        frac = div( n1, d1, e, 1, 1 )['minus'](x)['abs']()['cmp'](
               div( n0, d0, e, 1, 1 )['minus'](x)['abs']() ) < 1
          ? [ n1.toString(), d1.toString() ]
          : [ n0.toString(), d0.toString() ];

        external = true;
        Decimal['precision'] = pr;

        return frac;
    };


    /*
     * Returns a new Decimal whose value is the nearest multiple of the magnitude of #n to the value
     * of this Decimal.
     *
     * If the value of this Decimal is equidistant from two multiples of #n, the rounding mode #rm,
     * or #rounding if #rm is omitted or is null or undefined, determines the direction of the
     * nearest multiple.
     *
     * In the context of this method, rounding mode 4 (ROUND_HALF_UP) is the same as rounding mode 0
     * (ROUND_UP), and so on.
     *
     * The return value will always have the same sign as this Decimal, unless either this Decimal
     * or #n is NaN, in which case the return value will be also be NaN.
     *
     * The return value is not rounded to #precision significant digits.
     *
     * n {number|string|Decimal} The magnitude to round to a multiple of.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     * 'toNearest() rounding mode not an integer: {rm}'
     * 'toNearest() rounding mode out of range: {rm}'
     *
     */
    P['toNearest'] = function ( n, rm ) {
        var x = this,
            Decimal = x['constructor'];

        x = new Decimal(x);

        if ( n == null ) {
            n = new Decimal( Decimal['ONE'] );
            rm = Decimal['rounding'];
        } else {
            id = 17;
            n = new Decimal(n);
            rm = checkRM( x, rm, 'toNearest' );
        }

        // If #n is not NaN/+-Infinity...
        if ( n['c'] ) {

           // If #x is not NaN/+-Infinity...
            if ( x['c'] ) {
                external = false;

                /*
                 4  ROUND_HALF_UP
                 5  ROUND_HALF_DOWN
                 6  ROUND_HALF_EVEN
                 7  ROUND_HALF_CEIL
                 8  ROUND_HALF_FLOOR
                 */
                if ( rm < 4 ) {
                    rm = [4, 5, 7, 8][rm];
                }

                // If #n is a power of 10...
                if ( n['c'][0] == 1 && n['c'].length == 1 ) {
                    x['e'] -= n['e'];

                    // 0 dp
                    rnd( x, x['e'] + 1, rm );

                    if ( x['c'][0] ) {
                        x['e'] += n['e'];
                    }

                // else if #n is not zero...
                } else if ( n['c'][0] ) {
                    x = div( x, n, 0, rm, 1 )['times'](n);
                } else {
                    x['c'] = [ x['e'] = 0 ];
                }

                external = true;
                rnd(x);
            }

        // # is NaN/+-Infinity. If #x is not NaN...
        } else if ( x['s'] ) {

            // If #n is not NaN...
            if ( n['s'] ) {
                n['s'] = x['s'];
            }
            x = n;
        }

        return x;
    };


    /*
     * Return the value of this Decimal converted to a number primitive.
     *
     */
    P['toNumber'] = function () {
        var x = this;

        // Ensure zero has correct sign.
        return +x || ( x['s'] ? 0 * x['s'] : NaN );
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal raised to the power
     * Decimal(y, b), rounded to #precision significant digits using rounding mode #rounding.
     *
     * ECMAScript compliant.
     *
     *   x is any value, including NaN.
     *   n is any number, including �Infinity unless stated.
     *
     *   pow( x, NaN )                           = NaN
     *   pow( x, �0 )                            = 1

     *   pow( NaN, nonzero )                     = NaN
     *   pow( abs(n) > 1, +Infinity )            = +Infinity
     *   pow( abs(n) > 1, -Infinity )            = +0
     *   pow( abs(n) == 1, �Infinity )           = NaN
     *   pow( abs(n) < 1, +Infinity )            = +0
     *   pow( abs(n) < 1, -Infinity )            = +Infinity
     *   pow( +Infinity, n > 0 )                 = +Infinity
     *   pow( +Infinity, n < 0 )                 = +0
     *   pow( -Infinity, odd integer > 0 )       = -Infinity
     *   pow( -Infinity, even integer > 0 )      = +Infinity
     *   pow( -Infinity, odd integer < 0 )       = -0
     *   pow( -Infinity, even integer < 0 )      = +0
     *   pow( +0, n > 0 )                        = +0
     *   pow( +0, n < 0 )                        = +Infinity
     *   pow( -0, odd integer > 0 )              = -0
     *   pow( -0, even integer > 0 )             = +0
     *   pow( -0, odd integer < 0 )              = -Infinity
     *   pow( -0, even integer < 0 )             = +Infinity
     *   pow( finite n < 0, finite non-integer ) = NaN
     *
     * For non-integer and larger exponents pow(x, y) is calculated using
     *
     *   x^y = exp(y*ln(x))
     *
     * Assuming the first 15 rounding digits are each equally likely to be any digit 0-9, the
     * probability of an incorrectly rounded result
     * P( [49]9{14} | [50]0{14} ) = 2 * 0.2 * 10^-14 = 4e-15 = 1/2.5e+14
     * i.e. 1 in 250,000,000,000,000
     *
     * If a result is incorrectly rounded the maximum error will be 1 ulp (unit in last place).
     *
     * y {number|string|Decimal} The power to which to raise this Decimal.
     * [b] {number} The base of y.
     *
     */
    P['toPower'] = P['pow'] = function ( y, b ) {
        var a, e, n, r,
            x = this,
            Decimal = x['constructor'],
            s = x['s'],
            yN = +( id = 13, y = new Decimal( y, b ) ),
            i = yN < 0 ? -yN : yN,
            pr = Decimal['precision'],
            rm = Decimal['rounding'];

        // Handle +-Infinity, NaN and +-0.
        if ( !x['c'] || !y['c'] || ( n = !x['c'][0] ) || !y['c'][0] ) {

            // valueOf -0 is 0, so check for 0 then multiply it by the sign.
            return new Decimal( Math.pow( n ? s * 0 : +x, yN ) );
        }

        x = new Decimal(x);
        a = x['c'].length;

        // if #x == 1
        if ( !x['e'] && x['c'][0] == x['s'] && a == 1 ) {

            return x;
        }

        b = y['c'].length - 1;

        // if #y == 1
        if ( !y['e'] && y['c'][0] == y['s'] && !b ) {
            r = rnd( x, pr, rm );
        } else {
            n = y['e'] >= b;

            // If #y is not an integer and #x is negative, return NaN.
            if ( !n && s < 0 ) {
                r = new Decimal(NaN);
            } else {

                /*
                 If the number of significant digits of #x multiplied by abs(#y) is less than
                 INT_POW_LIMIT use the 'exponentiation by squaring' algorithm.
                 */
                if ( n && a * i < INT_POW_LIMIT ) {
                    r = intPow( Decimal, x, i );

                    if ( y['s'] < 0 ) {

                        return Decimal['ONE']['div'](r);
                    }
                } else {

                    // Result is negative if #x is negative and the last digit of integer #y is odd.
                    s = s < 0 && y['c'][ Math.max( y['e'], b ) ] & 1 ? -1 : 1;

                    b = Math.pow( +x, yN );

                    // Estimate result exponent.
                    e = b == 0 || !isFinite(b)

                      /*
                       x^y = 10^e,  where e = y * log10(x)
                       log10(x) = log10(x_significand) + x_exponent
                       log10(x_significand) = ln(x_significand) / ln(10)
                       */
                      ? Math.floor( yN * (
                        Math.log( '0.' + x['c'].join('') ) / Math.LN10 + x['e'] + 1 ) )
                      : new Decimal( b + '' )['e'];

                    // Estimate may be incorrect e.g.: x: 0.999999999999999999, y: 2.29, e: 0, r.e:-1

                    // Overflow/underflow?
                    if ( e > Decimal['maxE'] + 1 || e < Decimal['minE'] - 1 ) {

                        return new Decimal( e > 0 ? s / 0 : 0 );
                    }

                    external = false;
                    Decimal['rounding'] = x['s'] = 1;

                    /*
                     Estimate extra digits needed from ln(x) to ensure five correct rounding digits
                     in result (#i was unnecessary before max exponent was extended?).
                     Example of failure before #i was introduced: (precision: 10),
                     new Decimal(2.32456).pow('2087987436534566.46411')
                     should be 1.162377823e+764914905173815, but is 1.162355823e+764914905173815
                     */
                    i = Math.min( 12, ( e + '' ).length );

                    // r = x^y = exp(y*ln(x))
                    r = exp( y['times']( ln( x, pr + i ) ), pr );

                    // Truncate to the required precision plus five rounding digits.
                    r = rnd( r, pr + 5, 1 );

                    /*
                     If the rounding digits are [49]9999 or [50]0000 increase the precision by 10
                     and recalculate the result.
                     */
                    if ( checkRoundingDigits( r['c'], pr, rm ) ) {
                        e = pr + 10;

                        // Truncate to the increased precision plus five rounding digits.
                        r = rnd( exp( y['times']( ln( x, e + i ) ), e ), e + 5, 1 );

                        /*
                          Check for 14 nines from the 2nd rounding digit (the first rounding digit
                          may be 4 or 9).
                         */
                        for ( i = pr; r['c'][++i] == 9; ) {
                        }

                        // If there are 14 nines round up the first rounding digit.
                        if ( i == pr + 15 ) {
                            r = rnd( r, pr + 1, 0 );
                        }
                    }

                    r['s'] = s;
                    external = true;
                    Decimal['rounding'] = rm;
                }

                r = rnd( r, pr, rm );
            }
        }

        return r;
    };


    /*
     * Return a string representing the value of this Decimal rounded to #sd significant digits
     * using rounding mode #rounding.
     *
     * Return exponential notation if #sd is less than the number of digits necessary to represent
     * the integer part of the value in normal notation.
     *
     * sd {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     * #errors true: Throw if #sd and #rm are not undefined, null or integers in range.
     * #errors false: Ignore #sd and #rm if not numbers or not in range, and truncate non-integers.
     *
     * 'toPrecision() sd not an integer: {sd}'
     * 'toPrecision() sd out of range: {sd}'
     * 'toPrecision() rounding mode not an integer: {rm}'
     * 'toPrecision() rounding mode out of range: {rm}'
     *
     */
    P['toPrecision'] = function ( sd, rm ) {

        return sd != null && checkArg( this, sd, 'toPrecision', 1 )
          ? format( this, --sd | 0, checkRM( this, rm, 'toPrecision' ), 2 )
          : this.toString();
    };


    /*
     * Return a new Decimal whose value is this Decimal rounded to a maximum of #d significant
     * digits using rounding mode #rm, or to #precision and #rounding respectively if omitted.
     *
     * [d] {number} Significant digits. Integer, 1 to MAX_DIGITS inclusive.
     * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
     *
     * 'toSD() digits out of range: {d}'
     * 'toSD() digits not an integer: {d}'
     * 'toSD() rounding mode not an integer: {rm}'
     * 'toSD() rounding mode out of range: {rm}'
     *
     */
    P['toSignificantDigits'] = P['toSD'] = function ( d, rm ) {
        var x = this,
            Decimal = x['constructor'];

        x = new Decimal(x);

        return d == null || !checkArg( x, d, 'toSD', 1 )
          ? rnd( x, Decimal['precision'], Decimal['rounding'] )
          : rnd( x, d | 0, checkRM( x, rm, 'toSD' ) );
    };


    /*
     * Return a string representing the value of this Decimal in base #b, or base 10 if #b is
     * omitted. If a base is specified, including base 10, round to #precision significant digits
     * using rounding mode #rounding.
     *
     * Return exponential notation if a base is not specified, and this Decimal has a positive
     * exponent equal to or greater than #toExpPos, or a negative exponent equal to or less than
     * #toExpNeg.
     *
     * [b] {number} Base. Integer, 2 to 64 inclusive.
     *
     */
    P['toString'] = function (b) {
        var u, str, strL,
            x = this,
            Decimal = x['constructor'],
            xe = x['e'];

        // Infinity or NaN?
        if ( xe === null ) {
            str = x['s'] ? 'Infinity' : 'NaN';

        // Exponential format?
        } else if ( b === u && ( xe <= Decimal['toExpNeg'] || xe >= Decimal['toExpPos'] ) ) {

            return format( x, x['c'].length - 1, Decimal['rounding'], 1 );
        } else {
            str = x['c'].join('');

            // Negative exponent?
            if ( xe < 0 ) {

                // Prepend zeros.
                for ( ; ++xe; str = '0' + str ) {
                }
                str = '0.' + str;

            // Positive exponent?
            } else if ( strL = str.length, xe > 0 ) {

                if ( ++xe > strL ) {

                    // Append zeros.
                    for ( xe -= strL; xe-- ; str += '0' ) {
                    }

                } else if ( xe < strL ) {
                    str = str.slice( 0, xe ) + '.' + str.slice(xe);
                }

            // Exponent zero.
            } else {
                u = str.charAt(0);

                if ( strL > 1 ) {
                    str = u + '.' + str.slice(1);

                // Avoid '-0'
                } else if ( u == '0' ) {

                    return u;
                }
            }

            if ( b != null ) {

                if ( !( outOfRange = !( b >= 2 && b < 65 ) ) &&
                  ( b == (b | 0) || !Decimal['errors'] ) ) {
                    str = convertBase( Decimal, str, b | 0, 10, x['s'] );

                    // Avoid '-0'
                    if ( str == '0' ) {

                        return str;
                    }
                } else {

                    // 'toString() base not an integer: {b}'
                    // 'toString() base out of range: {b}'
                    ifExceptionsThrow( Decimal, 'base', b, 'toString', 0 );
                }
            }
        }

        return x['s'] < 0 ? '-' + str : str;
    };


    /*
     * Return a new Decimal whose value is the value of this Decimal truncated to a whole number.
     *
     */
    P['truncated'] = P['trunc'] = function () {

        return rnd( new this['constructor'](this), this['e'] + 1, 1 );
    };


    /*
     * Return as #toString, but do not accept a base argument.
     *
     * Ensures that JSON.stringify() uses #toString for serialization.
     *
     */
    P['valueOf'] = P['toJSON'] = function () {

        return this.toString();
    };


    /*
    // Add aliases to match BigDecimal method names.
    P['add'] = P['plus'];
    P['subtract'] = P['minus'];
    P['multiply'] = P['times'];
    P['divide'] = P['div'];
    P['remainder'] = P['mod'];
    P['compareTo'] = P['cmp'];
    P['negate'] = P['neg'];
     */


    // Private functions for Decimal.prototype methods.


    /*
     *  #checkRoundingDigits
     *  #checkRM
     *  #checkArg
     *  #convertBase
     *  #div
     *  #exp
     *  #format
     *  #ifExceptionsThrow
     *  #intPow
     *  #ln
     *  #rnd
     */


    /*
     * Check 5 rounding digits if #repeating is null, 4 otherwise.
     * #repeating == null if caller is #log or #pow,
     * #repeating != null if caller is #ln or #exp.
     */
    function checkRoundingDigits( c, i, rm, repeating ) {

        return ( !repeating && rm > 3 && c[i] == 4 ||
          ( repeating || rm < 4 ) && c[i] == 9 ) && c[i + 1] == 9 && c[i + 2] == 9 &&
            c[i + 3] == 9 && ( repeating != null || c[i + 4] == 9 ) ||
              repeating == null && ( c[i] == 5 || !c[i] ) && !c[i + 1] && !c[i + 2] &&
                !c[i + 3] && !c[i + 4];
    }


    /*
     * Check and return rounding mode. If #rm is invalid, return rounding mode #rounding.
     */
    function checkRM( x, rm, method ) {
        var Decimal = x['constructor'];

        return rm == null || ( ( outOfRange = rm < 0 || rm > 8 ) ||
          rm !== 0 && ( Decimal['errors'] ? parseInt : parseFloat )(rm) != rm ) &&
            !ifExceptionsThrow( Decimal, 'rounding mode', rm, method, 0 )
              ? Decimal['rounding'] : rm | 0;
    }


     /*
      * Check that argument #n is in range, return true or false.
      */
    function checkArg( x, n, method, min ) {
        var Decimal = x['constructor'];

        return !( outOfRange = n < ( min || 0 ) || n >= MAX_DIGITS + 1 ) &&

          /*
           * Include 'n === 0' because Opera has 'parseFloat(-0) == -0' as false
           * despite having 'parseFloat(-0) === -0 && parseFloat('-0') === -0 && 0 == -0' as true.
           */
          ( n === 0 || ( Decimal['errors'] ? parseInt : parseFloat )(n) == n ) ||
            ifExceptionsThrow( Decimal, 'argument', n, method, 0 );
    }


    /*
     * Convert a numeric string of #baseIn to a numeric string of #baseOut.
     */
    convertBase = (function () {

        /*
         * Convert string of #baseIn to an array of numbers of #baseOut.
         * Eg. convertBase('255', 10, 16) returns [15, 15].
         * Eg. convertBase('ff', 16, 10) returns [2, 5, 5].
         */
        function toBaseOut( str, baseIn, baseOut ) {
            var j,
                arr = [0],
                arrL,
                i = 0,
                strL = str.length;

            for ( ; i < strL; ) {

                for ( arrL = arr.length; arrL--; arr[arrL] *= baseIn ) {
                }
                arr[ j = 0 ] += NUMERALS.indexOf( str.charAt( i++ ) );

                for ( ; j < arr.length; j++ ) {

                    if ( arr[j] > baseOut - 1 ) {

                        if ( arr[j + 1] == null ) {
                            arr[j + 1] = 0;
                        }
                        arr[j + 1] += arr[j] / baseOut | 0;
                        arr[j] %= baseOut;
                    }
                }
            }

            return arr.reverse();
        }

        // #sign is needed to enable the correct rounding of the division.
        return function ( Decimal, str, baseOut, baseIn, sign ) {
            var x, xc, yc,
                i = str.indexOf( '.' ),
                y = new Decimal(baseIn);

            if ( baseIn < 37 ) {
                str = str.toLowerCase();
            }

            if ( i < 0 ) {
                x = new Decimal(y);
                yc = [1];
            } else {

                /*
                 Convert the base of #str as if #str is an integer, then divide the result by its
                 base raised to a power such that the fraction part will be restored.
                 Use #toFixed to avoid possible exponential notation.
                 */
                x = intPow( Decimal, y, str.length - i - 1 );
                yc = toBaseOut( x.toFixed(), 10, baseOut );
                str = str.replace( '.', '' );
            }

            // #xc and #yc may have trailing zeros.

            y['c'] = yc;
            y['e'] = yc.length;

            // Convert the number as integer.
            xc = toBaseOut( str, baseIn, baseOut );

            x['c'] = xc;
            x['e'] = xc.length;
            x['s'] = sign;

            x = div( x, y, Decimal['precision'], Decimal['rounding'], 0, baseOut );

            // E.g. [4, 11, 15] becomes [4, b, f].
            for ( xc = x['c'], i = xc.length; i--; ) {
                xc[i] = NUMERALS.charAt( xc[i] );
            }

            // No negative numbers: the caller will add the sign.
            x['s'] = 1;

            return x.toFixed();
        }
    })();


    /*
     * Perform division in the specified base. Called by #div and #convertBase.
     */
    function div( x, y, pr, rm, dp, b ) {
        var Decimal = x['constructor'],
            e = x['e'] - y['e'],
            s = x['s'] == y['s'] ? 1 : -1,
            xc = x['c'],
            yc = y['c'];

        // Either NaN, Infinity or 0?
        if ( !xc || !xc[0] || !yc || !yc[0] ) {

            return new Decimal(

              // Return NaN if either NaN, or both Infinity or 0.
              !x['s'] || !y['s'] || ( xc ? yc && xc[0] == yc[0] : !yc ) ? NaN :

                // Return +-0 if #x is 0 or #y is +-Infinity, or return +-Infinity as y is 0.
                xc && xc[0] == 0 || !yc ? s * 0 : s / 0
            );
        }

        var cmp, i, n, ri, t, yL,
            yz = yc.slice(),
            xi = yL = yc.length,
            xL = xc.length,
            r = xc.slice( 0, yL ),
            rL = r.length,
            q = new Decimal(s),
            qc = q['c'] = [];

        for ( i = s = 0; yc[i] == ( xc[i] || 0 ); i++ ) {
        }

        // Result exponent may be one less then the current value of #e.
        // The coefficients of the Decimals from #convertBase may have trailing zeros.
        if ( yc[i] > ( xc[i] || 0 ) ) {
            e--;

            /*
             The result of the division has a leading zero so an extra digit will be needed to
             maintain the correct precision (plus the rounding digit).
             */
            s = 1;
        }

        q['e'] = e;

        if ( pr == null ) {
            pr = Decimal['precision'];
            rm = Decimal['rounding'];
        } else if (dp) {
            pr += e + 1;
        }

        // Default base is 10.
        b = b || 10;

        if ( pr >= 0 ) {
            s += pr;

            // Add zeros to make remainder as long as divisor.
            for ( ; rL++ < yL; r.push(0) ) {
            }

            // Create version of divisor with leading zero.
            yz.unshift( i = 0 );

            do {

                // #n is how many times the divisor goes into the current remainder.
                for ( n = 0; n < b; n++ ) {

                    // Compare divisor and remainder.
                    if ( yL != ( rL = r.length ) ) {
                        cmp = yL > rL ? 1 : -1;
                    } else {

                        for ( ri = -1, cmp = 0; ++ri < yL; ) {

                            if ( yc[ri] != r[ri] ) {
                                cmp = yc[ri] > r[ri] ? 1 : -1;

                                break;
                            }
                        }
                    }

                    // If divisor < remainder, subtract divisor from remainder.
                    if ( cmp < 0 ) {

                        // Remainder cannot be more than one digit longer than divisor.
                        // Equalise lengths using divisor with extra leading zero?
                        for ( t = rL == yL ? yc : yz; rL; ) {

                            if ( r[--rL] < t[rL] ) {

                                for ( ri = rL;
                                  ri && !r[--ri];
                                    r[ri] = b - 1 ) {
                                }
                                --r[ri];
                                r[rL] += b;
                            }
                            r[rL] -= t[rL];
                        }

                        for ( ; !r[0]; r.shift() ) {
                        }
                    } else {

                        break;
                    }
                }

                // Add the next digit n to the result array.
                qc[i++] = cmp ? n : ++n;

                // Update the remainder.
                if ( r[0] && cmp ) {
                    r[rL] = xc[xi] || 0;
                } else {
                    r = [ xc[xi] ];
                }

            } while ( ( xi++ < xL || r[0] != null ) && s-- );

            // Leading zero? Do not remove if result is simply zero, i.e. i is 1.
            if ( !qc[0] && i > 1 ) {
                qc.shift();
            }

            // No need to round if #i <= #pr, just check for underflow/overflow.
            if ( i <= pr ) {
                pr = null;
            }
        }

        // If #pr < 0, r[0] != null will be true.
        return rnd( q, pr, rm, r[0] != null, b );
    }


    /*
     * Taylor/Maclaurin series.
     *
     * exp(x) = x^0/0! + x^1/1! + x^2/2! + x^3/3! + ...
     *
     * Argument reduction:
     *   Repeat x = x / 32, k += 5, until |x| < 0.1
     *   exp(x) = exp(x / 2^k)^(2^k)
     *
     * Previously, the argument was initially reduced by
     * exp(x) = exp(r) * 10^k  where r = x - k * ln10, k = floor(x / ln10)
     * to first put r in the range [0, ln10], before dividing by 32 until |x| < 0.1, but this was
     * found to be slower than just dividing repeatedly by 32 as above.
     *
     * Max integer argument: exp('20723265836946413') = 6.3e+9000000000000000
     * Min integer argument: exp('-20723265836946411') = 1.2e-9000000000000000
     * ( Math object integer min/max: Math.exp(709) = 8.2e+307, Math.exp(-745) = 5e-324 )
     *
     *  exp(Infinity)  = Infinity
     *  exp(-Infinity) = 0
     *  exp(NaN)       = NaN
     *  exp(+-0)       = 1
     *
     *  exp(x) is non-terminating for any finite, non-zero x.
     *
     *  The result will always be correctly rounded.
     *
     */
    function exp( x, pr ) {
        var denom, guard, j, pow, sd, sum, t,
            rep = 0,
            i = 0,
            k = 0,
            Decimal = x['constructor'],
            one = Decimal['ONE'],
            rm = Decimal['rounding'],
            precision = Decimal['precision'];

        // 0/NaN/Infinity?
        if ( !x['c'] || !x['c'][0] || x['e'] > 17 ) {

            return new Decimal( x['c']
              ? !x['c'][0] ? one : x['s'] < 0 ? 0 : 1 / 0
              : x['s'] ? x['s'] < 0 ? 0 : x : NaN );
        }

        if ( pr == null ) {

            /*
             Estimate result exponent.
             e^x = 10^j, where j = x * log10(e) and
             log10(e) = ln(e) / ln(10) = 1 / ln(10),
             so j = x / ln(10)
            j = Math.floor( x / Math.LN10 );

            // Overflow/underflow? Estimate may be +-1 of true value.
            if ( j > Decimal['maxE'] + 1 || j < Decimal['minE'] - 1 ) {

                return new Decimal( j > 0 ? 1 / 0 : 0 );
            }
             */

            external = false;
            sd = precision;
        } else {
            sd = pr;
        }

        t = new Decimal(0.03125);

        // while abs(x) >= 0.1
        while ( x['e'] > -2 ) {

            // x = x / 2^5
            x = x['times'](t);
            k += 5;
        }

        /*
         Use 2 * log10(2^k) + 5 to estimate the increase in precision necessary to ensure the first
         4 rounding digits are correct.
         */
        guard = Math.log( Math.pow( 2, k ) ) / Math.LN10 * 2 + 5 | 0;
        sd += guard;
        denom = pow = sum = new Decimal(one);
        Decimal['precision'] = sd;

        for( ; ; ) {
            pow = rnd( pow['times'](x), sd, 1 );
            denom = denom['times'](++i);
            t = sum['plus']( div( pow, denom, sd, 1 ) );

            if ( t['c'].slice( 0, sd ).join('') === sum['c'].slice( 0, sd ).join('') ) {
                j = k;

                while ( j-- ) {
                    sum = rnd( sum['times'](sum), sd, 1 );
                }

                /*
                 Check to see if the first 4 rounding digits are [49]999.
                 If so, repeat the summation with a higher precision, otherwise
                 E.g. with #precision: 18, #rounding: 1
                 exp(18.404272462595034083567793919843761) = 98372560.1229999999
                                           when it should be 98372560.123

                 #sd - #guard is the index of first rounding digit.
                 */
                if ( pr == null ) {

                    if ( rep < 3 && checkRoundingDigits( sum['c'], sd - guard, rm, rep ) ) {
                        Decimal['precision'] = sd += 10;
                        denom = pow = t = new Decimal(one);
                        i = 0;
                        rep++;
                    } else {

                        return rnd( sum, Decimal['precision'] = precision, rm, external = true );
                    }
                } else {
                    Decimal['precision'] = precision;

                    return sum;
                }
            }
            sum = t;
        }
    }


    /*
     * Return a string representing the value of Decimal #n in normal or exponential notation
     * rounded to the specified decimal places or significant digits.
     * Called by #toString, #toExponential (#exp is 1), #toFixed, and #toPrecision (#exp is 2).
     * #i is the index (with the value in normal notation) of the digit that may be rounded up.
     */
    function format( n, i, rm, exp ) {
        var Decimal = n['constructor'],
            e = ( n = new Decimal(n) )['e'],
            c = n['c'];

        // +-Infinity or NaN?
        if ( !c ) {

            return n.toString();
        }

        // Round?
        if ( c.length > ++i ) {
            rnd( n, i, rm );
        }

        // If #toFixed, n['e'] may have changed if the value was rounded up.
        e = exp ? i : i + n['e'] - e;

        // Append zeros?
        for ( ; c.length < e; c.push(0) ) {
        }
        e = n['e'];

        /*
         #toPrecision returns exponential notation if the number of significant digits specified
         is less than the number of digits necessary to represent the integer part of the value
         in normal notation.
         */
        return exp == 1 || exp == 2 && ( i <= e || e <= Decimal['toExpNeg'] )

          // Exponential notation.
          ? ( n['s'] < 0 && c[0] ? '-' : '' ) +
            ( c.length > 1 ? c[0] + '.' + c.slice(1).join('') : c[0] ) +
            ( e < 0 ? 'e' : 'e+' ) + e

          // Normal notation.
          : n.toString();
    }


    /*
     * Assemble error messages. Throw Decimal Errors.
     */
    function ifExceptionsThrow( Decimal, message, arg, method, more ) {

        if ( Decimal['errors'] ) {
            var error = new Error( ( method || [
              'new Decimal', 'cmp', 'div', 'eq', 'gt', 'gte', 'lt', 'lte', 'minus', 'mod',
              'plus', 'times', 'toFraction', 'pow', 'random', 'log', 'sqrt', 'toNearest', 'divToInt'
              ][ id ? id < 0 ? -id : id : 1 / id < 0 ? 1 : 0 ] ) + '() ' + ( [
              'number type has more than 15 significant digits', 'LN10 out of digits' ][message]
              || message + ( [ outOfRange ? ' out of range' : ' not an integer',
              ' not a boolean or binary digit' ][more] || '' ) ) + ': ' + arg
            );
            error['name'] = 'Decimal Error';
            outOfRange = id = 0;

            throw error;
        }
    }


    /*
     * Use 'exponentiation by squaring' for small integers. Called by #convertBase and #pow.
     */
    function intPow( Decimal, x, i ) {
        var r = new Decimal( Decimal['ONE'] );

        for ( external = false; ; ) {

            if ( i & 1 ) {
                r = r['times'](x);
            }
            i >>= 1;

            if ( !i ) {


                break;
            }
            x = x['times'](x);
        }
        external = true;

        return r;
    }


    /*
     *  ln(-n)        = NaN
     *  ln(0)         = -Infinity
     *  ln(-0)        = -Infinity
     *  ln(1)         = 0
     *  ln(Infinity)  = Infinity
     *  ln(-Infinity) = NaN
     *  ln(NaN)       = NaN
     *
     *  ln(n) (n != 1) is non-terminating.
     *
     */
    function ln( y, pr ) {
        var denom, e, num, rep, sd, sum, t, x1, x2,
            n = 1,
            guard = 10,
            x = y,
            c = x['c'],
            Decimal = x['constructor'],
            one = Decimal['ONE'],
            rm = Decimal['rounding'],
            precision = Decimal['precision'];

        // #x < 0 or +-Infinity/NaN or 0 or 1.
        if ( x['s'] < 0 || !c || !c[0] || !x['e'] && c[0] == 1 && c.length == 1 ) {

            return new Decimal( c && !c[0] ? -1 / 0 : x['s'] != 1 ? NaN : c ? 0 : x );
        }

        if ( pr == null ) {
            external = false;
            sd = precision;
        } else {
            sd = pr;
        }

        Decimal['precision'] = sd += guard;

        if ( Math.abs( e = x['e'] ) < 1.5e15 ) {

            /*
             Argument reduction.
             The series converges faster the closer the argument is to 1, so using
             ln(a^b) = b * ln(a),   ln(a) = ln(a^b) / b
             multiply the argument by itself until the leading digits of the significand are 7, 8,
             9, 10, 11, 12 or 13 recording the number of multiplications so the sum of the series
             can later be divided by this number, then separate out the power of 10 using
             ln(a*10^b) = ln(a) + b*ln(10).
             */
            // max #n is 6 ( gives 0.7 - 1.3 )
            while ( c[0] < 7 && c[0] != 1 || c[0] == 1 && c[1] > 3 ) {

            // max #n is 21 ( gives 0.9, 1.0 or 1.1 ) ( 9e15 / 21 = 4.2e14 ).
            //while ( c[0] < 9 && c[0] != 1 || c[0] == 1 && c[1] > 1 ) {
                x = x['times'](y);
                c = x['c'];
                n++;
            }

            e = x['e'];

            if ( c[0] > 1 ) {

                if ( n == 1 ) {
                    x = new Decimal( '0.' + c.join('') );
                } else {
                    x['e'] = -1;
                }
                e++;
            } else {
                x = new Decimal( '1.' + c.slice(1).join('') );
            }
        } else {

            /*
             The argument reduction method above may result in overflow if the argument #y is a
             massive number with exponent >= 1500000000000000 ( 9e15 / 6 = 1.5e15 ), so instead
             recall this function using ln(x*10^e) = ln(x) + e*ln(10).
             */
            x = new Decimal(x);
            x['e'] = 0;

            if ( sd + 2 > LN10.length ) {
                ifExceptionsThrow( Decimal, 1, sd + 2, 'ln' );
            }

            x = ln( x, sd - guard )['plus'](
                new Decimal( LN10.slice( 0, sd + 2 ) )['times']( e + '' )
            );

            Decimal['precision'] = precision;

            return pr == null ? rnd( x, precision, rm, external = true ) : x;
        }

        // #x1 is #x reduced to a value near 1.
        x1 = x;

        /*
         Taylor series.
         ln(y) = ln( (1 + x)/(1 - x) ) = 2( x + x^3/3 + x^5/5 + x^7/7 + ... )
         where
         x = (y - 1)/(y + 1)              ( |x| < 1 )
         */
        sum = num = x = div( x['minus'](one), x['plus'](one), sd, 1 );
        x2 = rnd( x['times'](x), sd, 1 );
        denom = 3;

        for( ; ; ) {
            num = rnd( num['times'](x2), sd, 1 );
            t = sum['plus']( div( num, new Decimal(denom), sd, 1 ) );

            if ( t['c'].slice( 0, sd ).join('') === sum['c'].slice( 0, sd ).join('') ) {
                sum = sum['times'](2);

                /*
                 Reverse the argument reduction. Check that #e is not 0 because, as well as
                 preventing an unnecessary calculation, -0 + 0 = +0 and to ensure correct
                 rounding later -0 needs to stay -0.
                 */
                if ( e !== 0 ) {

                    if ( sd + 2 > LN10.length ) {
                        ifExceptionsThrow( Decimal, 1, sd + 2, 'ln' );
                    }

                    sum = sum['plus'](
                        new Decimal( LN10.slice( 0, sd + 2 ) )['times']( e + '' )
                    );
                }

                sum = div( sum, new Decimal(n), sd, 1 );

                /*
                 Is #rm > 3 and the first 4 rounding digits 4999, or #rm < 4 (or the summation has
                 been repeated previously) and the first 4 rounding digits 9999?

                 If so, restart the summation with a higher precision, otherwise
                 E.g. with #precision: 12, #rounding: 1
                 ln(135520028.6126091714265381533) = 18.7246299999 when it should be 18.72463.

                 #sd - #guard is the index of first rounding digit.
                 */
                if ( pr == null ) {

                    if ( checkRoundingDigits( sum['c'], sd - guard, rm, rep ) ) {
                        Decimal['precision'] = sd += guard;
                        t = num = x = div( x1['minus'](one), x1['plus'](one), sd, 1 );
                        x2 = rnd( x['times'](x), sd, 1 );
                        denom = rep = 1;
                    } else {

                        return rnd( sum, Decimal['precision'] = precision, rm, external = true );
                    }
                } else {
                    Decimal['precision'] = precision;

                    return sum;
                }
            }

            sum = t;
            denom += 2;
        }
    }


    /*
     * Round #x to #sd significant digits using rounding mode #rm. Check for over/under-flow.
     */
    function rnd( x, sd, rm, r, b ) {
        var rd, half, isNeg, xc,
            Decimal = x['constructor'];

        // Don't round if #sd is null or undefined.
        if ( sd != rd ) {

            if ( !( xc = x['c'] ) ) {

                return x;
            }

            isNeg = x['s'] < 0,
            half = ( b = b || 10 ) / 2;

            // #rd is the rounding digit, i.e. the digit after the digit that may be rounded up.
            rd = xc[sd];
            r = r || sd < 0 || xc[sd + 1] != null;

            r = rm < 4
              ? ( rd != null || r ) && ( rm == 0 || rm == 2 && !isNeg || rm == 3 && isNeg )
              : rd > half || rd == half && ( rm == 4 || r || rm == 6 && xc[sd - 1] & 1 ||
                rm == 7 && !isNeg || rm == 8 && isNeg );

            if ( sd < 1 || !xc[0] ) {
                xc.length = 0;

                if (r) {

                    // Convert #sd to decimal places.
                    sd = sd - x['e'] - 1;

                    // 1, 0.1, 0.01, 0.001, 0.0001 etc.
                    xc[0] = 1;
                    x['e'] = -sd || 0;
                } else {

                    // Zero.
                    xc[0] = x['e'] = 0;
                }

                return x;
            }

            // Truncate excess digits.
            if ( xc.length > sd ) {
                xc.length = sd;
            }
            sd--;

            // Round up?
            if (r) {

                // Set to zero any undefined elements before the digit to be rounded up.
                // Only used by #ln?
                for ( rd = sd; xc[rd] == null; xc[rd--] = 0 ) {
                }

                // Rounding up may mean the previous digit has to be rounded up and so on.
                for ( --b; ++xc[sd] > b; ) {
                    xc[sd] = 0;

                    if ( !sd-- ) {
                        ++x['e'];
                        xc.unshift(1);
                    }
                }
            }

            // Remove trailing zeros.
            for ( sd = xc.length; !xc[--sd]; xc.pop() ) {
            }
        }

        if (external) {

            // Overflow?
            if ( x['e'] > Decimal['maxE'] ) {

                // Infinity.
                x['c'] = x['e'] = null;

            // Underflow?
            } else if ( x['e'] < Decimal['minE'] ) {

                // Zero.
                x['c'] = [ x['e'] = 0 ];
            }
        }

        return x;
    }


    DecimalConstructor = (function () {


        // Private functions used by static Decimal methods.


        /*
         *  The following emulations or wrappers of #Math object functions are currently
         *  commented-out and not in the public API.
         *
         *  #abs
         *  #acos
         *  #asin
         *  #atan
         *  #atan2
         *  #ceil
         *  #cos
         *  #floor
         *  #round
         *  #sin
         *  #tan
         *  #trunc
         */


        /*
         * Return a new Decimal whose value is the absolute value of #n.
         *
         * n {number|string|Decimal}
         *
        function abs(n) { return new this(n)['abs']() }
         */


        /*
         * Return a new Decimal whose value is the arccosine in radians of #n.
         *
         * n {number|string|Decimal}
         *
        function acos(n) { return new this( Math.acos(n) + '' ) }
         */


        /*
         * Return a new Decimal whose value is the arcsine in radians of #n.
         *
         * n {number|string|Decimal}
         *
        function asin(n) { return new this( Math.asin(n) + '' ) }
         */


        /*
         * Return a new Decimal whose value is the arctangent in radians of #n.
         *
         * n {number|string|Decimal}
         *
        function atan(n) { return new this( Math.atan(n) + '' ) }
         */


        /*
         * Return a new Decimal whose value is the arctangent in radians of #y/#x in the range
         * -PI to PI (inclusive).
         *
         * y {number|string|Decimal} The y-coordinate.
         * x {number|string|Decimal} The x-coordinate.
         *
        function atan2( y, x ) { return new this( Math.atan2( y, x ) + '' ) }
         */


        /*
         * Return a new Decimal whose value is #n round to an integer using ROUND_CEIL.
         *
         * n {number|string|Decimal}
         *
        function ceil(n) { return new this(n)['ceil']() }
         */


        /*
         * Configure global settings for a Decimal constructor.
         *
         * #obj is an object with any of the following properties,
         *
         *   #precision  {number}
         *   #rounding   {number}
         *   #toExpNeg   {number}
         *   #toExpPos   {number}
         *   #minE       {number}
         *   #maxE       {number}
         *   #errors     {boolean|number}
         *   #crypto     {boolean|number}
         *   #modulo     {number}
         *
         * E.g.
         *   Decimal.config({ precision: 20, rounding: 4 })
         *
         */
        function config(obj) {
            var p, u, v,
                Decimal = this,
                c = 'config',
                parse = Decimal['errors'] ? parseInt : parseFloat;

            if ( obj == u || typeof obj != 'object' &&
              !ifExceptionsThrow( Decimal, 'object expected', obj, c ) ) {

                return Decimal;
            }

            // #precision {number|number[]} Integer, 1 to MAX_DIGITS inclusive.
            if ( ( v = obj[ p = 'precision' ] ) != u ) {

                if ( !( outOfRange = v < 1 || v > MAX_DIGITS ) && parse(v) == v ) {
                    Decimal[p] = v | 0;
                } else {

                    // 'config() precision not an integer: {v}'
                    // 'config() precision out of range: {v}'
                    ifExceptionsThrow( Decimal, p, v, c, 0 );
                }
            }

            // #rounding {number} Integer, 0 to 8 inclusive.
            if ( ( v = obj[ p = 'rounding' ] ) != u ) {

                if ( !( outOfRange = v < 0 || v > 8 ) && parse(v) == v ) {
                    Decimal[p] = v | 0;
                } else {

                    // 'config() rounding not an integer: {v}'
                    // 'config() rounding out of range: {v}'
                    ifExceptionsThrow( Decimal, p, v, c, 0 );
                }
            }

            // #toExpNeg {number} Integer, -EXP_LIMIT to 0 inclusive.
            if ( ( v = obj[ p = 'toExpNeg' ] ) != u ) {

                if ( !( outOfRange = v < -EXP_LIMIT || v > 0 ) && parse(v) == v ) {
                    Decimal[p] = Math.floor(v);
                } else {

                    // 'config() toExpNeg not an integer: {v}'
                    // 'config() toExpNeg out of range: {v}'
                    ifExceptionsThrow( Decimal, p, v, c, 0 );
                }
            }

            // #toExpPos {number} Integer, 0 to EXP_LIMIT inclusive.
            if ( ( v = obj[ p = 'toExpPos' ] ) != u ) {

                if ( !( outOfRange = v < 0 || v > EXP_LIMIT ) && parse(v) == v ) {
                    Decimal[p] = Math.floor(v);
                } else {

                    // 'config() toExpPos not an integer: {v}'
                    // 'config() toExpPos out of range: {v}'
                    ifExceptionsThrow( Decimal, p, v, c, 0 );
                }
            }

             // #minE {number} Integer, -EXP_LIMIT to 0 inclusive.
            if ( ( v = obj[ p = 'minE' ] ) != u ) {

                if ( !( outOfRange = v < -EXP_LIMIT || v > 0 ) && parse(v) == v ) {
                    Decimal[p] = Math.floor(v);
                } else {

                    // 'config() minE not an integer: {v}'
                    // 'config() minE out of range: {v}'
                    ifExceptionsThrow( Decimal, p, v, c, 0 );
                }
            }

            // #maxE {number} Integer, 0 to EXP_LIMIT inclusive.
            if ( ( v = obj[ p = 'maxE' ] ) != u ) {

                if ( !( outOfRange = v < 0 || v > EXP_LIMIT ) && parse(v) == v ) {
                    Decimal[p] = Math.floor(v);
                } else {

                    // 'config() maxE not an integer: {v}'
                    // 'config() maxE out of range: {v}'
                    ifExceptionsThrow( Decimal, p, v, c, 0 );
                }
            }

            // #errors {boolean|number} true, false, 1 or 0.
            if ( ( v = obj[ p = 'errors' ] ) != u ) {

                if ( v === !!v || v === 1 || v === 0 ) {
                    outOfRange = id = 0;
                    Decimal[p] = !!v;
                } else {

                    // 'config() errors not a boolean or binary digit: {v}'
                    ifExceptionsThrow( Decimal, p, v, c, 1 );
                }
            }

            // #crypto {boolean|number} true, false, 1 or 0.
            if ( ( v = obj[ p = 'crypto' ] ) != u ) {

                if ( v === !!v || v === 1 || v === 0 ) {
                    Decimal[p] = !!( v && crypto && typeof crypto == 'object' );
                } else {

                    // 'config() crypto not a boolean or binary digit: {v}'
                    ifExceptionsThrow( Decimal, p, v, c, 1 );
                }
            }

            // #modulo {number} Integer, 0 to 9 inclusive.
            if ( ( v = obj[ p = 'modulo' ] ) != u ) {

                if ( !( outOfRange = v < 0 || v > 9 ) && parse(v) == v ) {
                    Decimal[p] = v | 0;
                } else {

                    // 'config() modulo not an integer: {v}'
                    // 'config() modulo out of range: {v}'
                    ifExceptionsThrow( Decimal, p, v, c, 0 );
                }
            }

            return Decimal;
        }


        /*
         * Return a new Decimal whose value is the cosine of #n.
         *
         * n {number|string|Decimal} A number given in radians.
         *
        function cos(n) { return new this( Math.cos(n) + '' ) }
         */


        /*
         * Return a new Decimal whose value is the exponential of #n,
         *
         * n {number|string|Decimal} The power to which to raise the base of the natural log.
         *
         */
        function exp(n) { return new this(n)['exp']() }


        /*
         * Return a new Decimal whose value is #n round to an integer using ROUND_FLOOR.
         *
         * n {number|string|Decimal}
         *
        function floor(n) { return new this(n)['floor']() }
         */


        /*
         * Return a new Decimal whose value is the natural logarithm of #n.
         *
         * n {number|string|Decimal}
         *
         */
        function ln(n) { return new this(n)['ln']() }


        /*
         * Return a new Decimal whose value is the log of #x to the base #y, or to base 10 if no
         * base is specified.
         *
         * log[y](x)
         *
         * x {number|string|Decimal} The argument of the logarithm.
         * y {number|string|Decimal} The base of the logarithm.
         *
         */
        function log( x, y ) { return new this(x)['log'](y) }


        /*
         * Handle #max and #min. #ltgt is 'lt' or 'gt'.
         */
        function maxOrMin( Decimal, args, ltgt ) {
            var m, n,
                i = 0;

            if ( toString.call( args[0] ) == '[object Array]' ) {
                args = args[0];
            }

            m = new Decimal( args[0] );

            for ( ; ++i < args.length; ) {
                n = new Decimal( args[i] );

                if ( !n['s'] ) {
                    m = n;

                    break;
                } else if ( m[ltgt](n) ) {
                    m = n;
                }
            }

            return m;
        }


        /*
         * Return a new Decimal whose value is the maximum of the arguments.
         *
         * arguments {number|string|Decimal}
         *
         */
        function max() { return maxOrMin( this, arguments, 'lt' ) }


        /*
         * Return a new Decimal whose value is the minimum of the arguments.
         *
         * arguments {number|string|Decimal}
         *
         */
        function min() { return maxOrMin( this, arguments, 'gt' ) }


        /*
         * Parse the value of a new Decimal from a number or string.
         */
        var parseDecimal = (function () {
            var isValid = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
                trim = String.prototype.trim || function () {return this.replace(/^\s+|\s+$/g, '')};

            return function ( Decimal, x, n, b ) {
                var d, e, i, isNum, orig, valid;

                if ( typeof n != 'string' ) {

                    // If #n is a number, check if minus zero.
                    n = ( isNum = typeof n == 'number' || toString.call(n) == '[object Number]' ) &&
                        n === 0 && 1 / n < 0 ? '-0' : n + '';
                }
                orig = n;

                if ( b == e && isValid.test(n) ) {

                    // Determine sign.
                    x['s'] = n.charAt(0) == '-' ? ( n = n.slice(1), -1 ) : 1;

                // Either #n is not a valid Decimal or a base has been specified.
                } else {

                    /*
                     Enable exponential notation to be used with base 10 argument.
                     Ensure return value is rounded to #precision as with other bases.
                     */
                    if ( b == 10 ) {

                        return rnd( new Decimal(n), Decimal['precision'], Decimal['rounding'] );
                    }

                    n = trim.call(n).replace( /^\+(?!-)/, '' );

                    x['s'] = n.charAt(0) == '-' ? ( n = n.replace( /^-(?!-)/, '' ), -1 ) : 1;

                    if ( b != e ) {

                        if ( ( b == (b | 0) || !Decimal['errors'] ) &&
                          !( outOfRange = !( b >= 2 && b < 65 ) ) ) {
                            d = '[' + NUMERALS.slice( 0, b = b | 0 ) + ']+';

                           // Remove the `.` from e.g. '1.', and replace e.g. '.1' with '0.1'.
                            n = n.replace( /\.$/, '' ).replace( /^\./, '0.' );


                            // Any number in exponential form will fail due to the e+/-.
                            if ( valid = new RegExp(
                              '^' + d + '(?:\\.' + d + ')?$', b < 37 ? 'i' : '' ).test(n)
                            ) {

                                if (isNum) {

                                    if ( n.replace( /^0\.0*|\./, '' ).length > 15 ) {

                                        // '{method} number type has more than 15 significant digits: {n}'
                                        ifExceptionsThrow( Decimal, 0, orig );
                                    }

                                    // Prevent later check for length on converted number.
                                    isNum = !isNum;
                                }
                                n = convertBase( Decimal, n, 10, b, x['s'] );

                            } else if ( n != 'Infinity' && n != 'NaN' ) {

                                // '{method} not a base {b} number: {n}'
                                ifExceptionsThrow( Decimal, 'not a base ' + b + ' number', orig );
                                n = 'NaN';
                            }
                        } else {

                            // '{method} base not an integer: {b}'
                            // '{method} base out of range: {b}'
                            ifExceptionsThrow( Decimal, 'base', b, 0, 0 );

                            // Ignore base.
                            valid = isValid.test(n);
                        }
                    } else {
                        valid = isValid.test(n);
                    }

                    if ( !valid ) {

                        // Infinity/NaN
                        x['c'] = x['e'] = null;

                        // NaN
                        if ( n != 'Infinity' ) {

                            // No exception on NaN.
                            if ( n != 'NaN' ) {

                                // '{method} not a number: {n}'
                                ifExceptionsThrow( Decimal, 'not a number', orig );
                            }
                            x['s'] = null;
                        }
                        id = 0;

                        return x;
                    }
                }

                // Decimal point?
                if ( ( e = n.indexOf('.') ) > -1 ) {

                    n = n.replace( '.', '' );
                }

                // Exponential form?
                if ( ( i = n.search( /e/i ) ) > 0 ) {

                    // Determine exponent.
                    if ( e < 0 ) {
                        e = i;
                    }
                    e += +n.slice( i + 1 );
                    n = n.substring( 0, i );

                } else if ( e < 0 ) {

                    // Integer.
                    e = n.length;
                }

                // Determine leading zeros.
                for ( i = 0; n.charAt(i) == '0'; i++ ) {
                }

                if ( i == ( b = n.length ) ) {

                    // Zero.
                    x['c'] = [ x['e'] = 0 ];
                } else {

                    // Disallow numbers with over 15 significant digits if number type.
                    if ( isNum && b > 15 && n.slice(i).length > 15 ) {

                        // '{method} number type has more than 15 significant digits: {n}'
                        ifExceptionsThrow( Decimal, 0, orig );
                    }

                    // Determine trailing zeros.
                    for ( ; n.charAt(--b) == '0'; ) {
                    }

                    x['e'] = e - i - 1;
                    x['c'] = [];

                    // Convert string to array of digits (without leading and trailing zeros).
                    for ( e = 0; i <= b; x['c'][e++] = +n.charAt(i++) ) {
                    }

                    if (external) {

                        // Overflow?
                        if ( x['e'] > Decimal['maxE'] ) {

                            // Infinity.
                            x['c'] = x['e'] = null;

                        // Underflow?
                        } else if ( x['e'] < Decimal['minE'] ) {

                            // Zero.
                            x['c'] = [ x['e'] = 0 ];
                        }
                    }
                }
                id = 0;
            }
        })();


        /*
         * Return a new Decimal whose value is #x raised to the power #y.
         *
         * x {number|string|Decimal} The base.
         * y {number|string|Decimal} The exponent.
         *
         */
        function pow( x, y ) { return new this(x)['pow'](y) }


        /*
         * Generate a new Decimal with a random value.
         */
        var random = (function () {

            /*
             * #crypto false.
             *
             * Return a string of random decimal digits.
             * If #max is falsey return up to 14 digits (almost always 13 or 14 digits),
             * else return a number >= 0 and < #max (#max < 256).
             */
            function getMathRandom(max) {
                var r = Math.random();

                /*
                  Add 1 to avoid exponential notation and keep leading zeros. Omit the first and the
                  last two digits for a maximum of 14 significant digits and to ensure that trailing
                  digits can be zero.
                 */
                return max ? ( r * max | 0 ) + '' : ( 1 + r + '' ).slice( 2, -2 );
            }


            /*
             * #crypto true.
             * Browsers supporting crypto.getRandomValues.
             *
             * Return a string of random decimal digits.
             * If #max is falsey return 9 digits, else return a number >= 0 and < #max (#max < 256).
             */
            function getRandomValues(max) {
                var n;

                return max

                  // 0 >= n < 256
                  ? ( n = crypto['getRandomValues']( new global['Uint8Array'](1) )[0],
                      n > ( 256 / max | 0 ) * max - 1

                        // Probability of recall if #max is 10 is 6 / 256 = 0.023 (i.e. 1 in 42.7).
                        ? getRandomValues(max)
                        : n % max + '' )

                  // 0 >= n < 4294967296
                  : ( n = crypto['getRandomValues']( new global['Uint32Array'](1) )[0],
                      n >= 4e9

                        // Probability of recall is 294967297 / 4294967296 = 0.0687 (i.e. 1 in 14.6).
                        ? getRandomValues(max)

                        // Add 1e9 so 1000000000 >= n <= 4999999999 and omit leading digit.
                        : ( n + 1e9 + '' ).slice(1) );
            }


            /*
             * #crypto true.
             * Node.js supporting crypto.randomBytes.
             *
             * Return a string of random decimal digits.
             * If #max is falsey return 14 digits, else return a number >= 0 and < #max (#max < 256).
             */
            function getRandomBytes(max) {
                var buf, n,
                    rb = crypto['randomBytes'];

                return max
                  ? ( n = rb(1)[0], n > ( 256 / max | 0 ) * max - 1
                    ? getRandomBytes(max)
                    : n % max + '' )

                  // 01000011 0011XXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX
                  : ( buf = rb(8), buf[0] = 0x43, buf[1] = buf[1] & 0xf | 0x30,

                      /*
                        (mantissa all zeros) 4503599627370496 >= n <= 9007199254740991 (mantissa all ones).
                        4503599627370496 - 3599627370496 = 4500000000000000
                        9007199254740991 - 3599627370496 = 9003599627370495
                       */
                      n = buf.readDoubleBE(0),
                      n > 9003599627370495

                        /*
                          Probability of recall is
                          3599627370497 / 4503599627370496 = 0.000799 (i.e. 1 in 1251).
                         */
                        ? getRandomBytes(max)

                        /*
                         Subtracting 4503599627370496 gives 0 >= n <= 4499999999999999,
                         so subtracting 1e15 less than that gives
                         1000000000000000 >= n <= 5499999999999999.
                         Return the last 14 digits as a string.
                         */
                        : ( n - 3503599627370496 + '' ).slice(2) );
            }

            /*
             * Returns a new Decimal with a random value equal to or greater than 0 and lower in
             * magnitude than #limit.
             *
             * If #limit is omitted then it will be 1 and the return value will have #precision
             * significant digits (or less if trailing zeros are produced).
             *
             * If #limit is included and #pr is omitted then the return value will be an integer. If
             * #pr is included, the return value will have #pr significant digits (or less if
             * trailing zeros are produced).
             *
             * [limit] {number|string|Decimal}
             * [pr] {number} Significant digits. Integer, 0 to MAX_DIGITS inclusive.
             *
             */
            return function ( limit, pr ) {
                var c, e, i, ld, n, one, rd, str,
                    Decimal = this,
                    r = new Decimal(0),
                    rand = getMathRandom;

                // null/+-Infinity/NaN?
                if ( one = limit == e || !( id = 14, limit = new Decimal(limit) )['c'] &&
                  !ifExceptionsThrow( Decimal, 'limit must be finite', limit, 'random' ) ) {
                    limit = new Decimal( Decimal['ONE'] );

                // Zero?
                } else if ( !limit['c'][0] ) {

                    return r;
                }

                if ( Decimal['crypto'] ) {

                    // Recent browsers.
                    if ( crypto['getRandomValues'] ) {
                        rand = getRandomValues;

                    // Node.js.
                    } else if ( crypto['randomBytes'] ) {
                        rand = getRandomBytes;
                    }
                }

                e = limit['e'];
                n = ( c = limit['c'] ).length;

                // Ensure #r < limit.
                do {
                    i = 0;
                    str = rand( c[0] + 1 ) + rand();

                    do {
                        ld = c[i];               // #limit digit
                        rd = str.charAt(i++);    // random digit
                    } while ( ld == rd );
                } while ( rd > ld || i > n || rd == '' );

                // Decrement exponent of result for every leading zero.
                for ( i = 0; str.charAt(i) == '0'; i++, e-- ) {
                }

                if (one) {
                    pr = Decimal['precision'];
                } else if ( pr == null || !checkArg( limit, pr, 'random', 1 ) ) {
                    pr = e + 1;
                } else {
                    pr |= 0;
                }

                pr += i;

                // Add further random digits.
                while ( str.length < pr ) {
                    str += rand();
                }

                // Determine trailing zeros.
                for ( ; str.charAt(--pr) == '0'; ) {
                }

                if ( ++pr > 0 ) {

                    // Convert #str to number array without leading and trailing zeros.
                    for ( r['c'] = []; i < pr; r['c'].push( +str.charAt(i++) ) ) {
                    }
                } else {

                   // Zero.
                    r['c'] = [ e = 0 ];
                }

                r['e'] = e;
                r['s'] = limit['s'];

                return r;
            }
        })();


        /*
         * Not currently in public api.
         *
         * Generate random numbers for testing purposes.
         *
         * Returns a Decimal with a random sign, a random exponent in the range [-MIN.E, MAX-E]
         * and a random number of significant digits in the range [1, #precision].
         *
         * Within the limits of the #precision setting, this method can produce any finite Decimal.
         * It will not, though, produce a uniform distribution. Intentionally, it is heavily biased
         * toward smaller exponents.
         *
         * Math.random is always used as the source of randomness.
         *
        function randomE() {
            var i,
                Decimal = this,
                // 1 in 4 chance of negative exponent.
                isNeg = Math.random() < 0.25,
                n = Math.floor( Math.random() * ( (
                  isNeg ? -Decimal['minE'] : Decimal['maxE'] ) + 1 ) ) + '',
                c = [ Math.random() * 9 + 1 | 0 ],
                pr = i = Math.random() * Decimal['precision'] | 0,
                r = new Decimal( Decimal['ONE'] );

            while ( i-- ) {
                c.push( Math.random() * 10 | 0 );
            }
            c[pr] = Math.random() * 9 + 1 | 0;

            // Further increase likelihood of smaller exponent. Comment-out if not required.
            while ( Math.random() < 0.9 ) {
                n = n.slice( Math.random() * n.length | 0 );
            }

            r['e'] = ( isNeg ? -1 : 1 ) * n.slice( Math.random() * n.length | 0 );
            r['c'] = r['e'] == Decimal['minE'] ? [1] : c;
            r['s'] = Math.random() < 0.4 ? -1 : 1;

            return r;
        }
         */


        /*
         * Return a new Decimal whose value is #n round to an integer using rounding mode #rounding.
         *
         * To emulate Math.round, set #rounding to 7 (ROUND_HALF_CEIL).
         *
         * n {number|string|Decimal}
         *
        function round(n) {
            var x = new this(n);

            return rnd( x, x['e'] + 1, this['rounding'] );
        }
         */


        /*
         * Return a new Decimal whose value is the sine of #n.
         *
         * n {number|string|Decimal} A number given in radians.
         *
        function sin(n) { return new this( Math.sin(n) + '' ) }
         */


        /*
         * Return a new Decimal whose value is the square root of #n.
         *
         * n {number|string|Decimal}
         *
         */
        function sqrt(n) { return new this(n)['sqrt']() }


        /*
         * Return a new Decimal whose value is the tangent of #n.
         *
         * n {number|string|Decimal} A number given in radians.
         *
        function tan(n) { return new this( Math.tan(n) + '' ) }
         */


        /*
         * Return a new Decimal whose value is #n truncated to an integer.
         *
         * n {number|string|Decimal}
         *
        function trunc(n) { return new this(n)['trunc']() }
         */


        /*
         * Create and return a new Decimal constructor.
         *
         */
        function DecimalFactory(obj) {

            /*
             * The Decimal constructor.
             * Create and return a new instance of a Decimal object.
             *
             * n {number|string|Decimal} A numeric value.
             * [b] {number} The base of n. Integer, 2 to 64 inclusive.
             *
             */
            function Decimal( n, b ) {
                var x = this;

                // Constructor called without new.
                if ( !( x instanceof Decimal ) ) {
                    ifExceptionsThrow( Decimal, 'Decimal called without new', n );

                    return new Decimal( n, b );
                }

                // Duplicate.
                if ( n instanceof Decimal ) {

                    if ( b == null ) {
                        id = 0;
                        x['constructor'] = n['constructor'];
                        x['s'] = n['s'];
                        x['e'] = n['e'];
                        x['c'] = ( n = n['c'] ) ? n.slice() : n;

                        return;
                    } else if ( b == 10 ) {

                        return rnd( new Decimal(n), Decimal['precision'], Decimal['rounding'] );
                    } else {
                        n += '';
                    }
                }

                return parseDecimal( x['constructor'] = Decimal, x, n, b );
            }


            /* ************************ CONSTRUCTOR DEFAULT PROPERTIES *****************************


             These default values must be integers within the stated ranges (inclusive).
             Most of these values can be changed during run-time using Decimal.config.
             */

            /*
             The maximum number of significant digits of the result of a calculation or base
             conversion.
             E.g.  Decimal.config({ precision: 20 })
             */
            Decimal['precision'] = 20;                        // 1 to MAX_DIGITS

            /*
             The rounding mode used when rounding to #precision.

             ROUND_UP         0 Away from zero.
             ROUND_DOWN       1 Towards zero.
             ROUND_CEIL       2 Towards +Infinity.
             ROUND_FLOOR      3 Towards -Infinity.
             ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
             ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
             ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
             ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
             ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.

             E.g.
             Decimal.rounding = 4;
             Decimal.rounding = Decimal.ROUND_HALF_UP;
             */
            Decimal['rounding'] = 4;                          // 0 to 8

            /*
             The modulo mode used when calculating the modulus: a mod n.
             The quotient (q = a / n) is calculated according to the corresponding rounding mode.
             The remainder (r) is calculated as: r = a - n * q.

             UP         0 The remainder is positive if the dividend is negative, else is negative.
             DOWN       1 The remainder has the same sign as the dividend.
                          This modulo mode is commonly known as "truncated division" and matches
                          as closely as possible, the behaviour of JS remainder operator (a % n).
             FLOOR      3 The remainder has the same sign as the divisor (Python %).
             HALF_EVEN  6 This modulo mode implements the IEEE 754 remainder function.
             EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)).
                          The remainder is always positive.

             The above modes - truncated division, floored division, Euclidian division and IEEE 754
             remainder - are commonly used for the modulus operation. Although any other of the
             rounding modes can be used, they may not give useful results.
             */
            Decimal['modulo'] = 1;                            // 0 to 9

            // The exponent value at and beneath which #toString returns exponential notation.
            // Number type: -7
            Decimal['toExpNeg'] = -7;                       // 0 to -EXP_LIMIT

            // The exponent value at and above which #toString returns exponential notation.
            // Number type: 21
            Decimal['toExpPos'] = 21;                       // 0 to EXP_LIMIT

            // The minimum exponent value, beneath which underflow to zero occurs.
            // Number type: -324  (5e-324)
            Decimal['minE'] = -EXP_LIMIT;                    // -1 to -EXP_LIMIT

            // The maximum exponent value, above which overflow to Infinity occurs.
            // Number type:  308  (1.7976931348623157e+308)
            Decimal['maxE'] = EXP_LIMIT;                     // 1 to EXP_LIMIT

            // Whether Decimal Errors are ever thrown.
            Decimal['errors'] = true;                         // true/false

            // Whether to use cryptographically-secure random number generation, if available.
            Decimal['crypto'] = false;                        // true/false


            /* ********************** END OF CONSTRUCTOR DEFAULT PROPERTIES ********************* */


            Decimal.prototype = P;

            Decimal['ONE'] = new Decimal(1);

            /*
            // Pi to 80 s.d.
            Decimal['PI'] = new Decimal(
                '3.1415926535897932384626433832795028841971693993751058209749445923078164062862089'
            );
             */

            Decimal['ROUND_UP'] = 0;
            Decimal['ROUND_DOWN'] = 1;
            Decimal['ROUND_CEIL'] = 2;
            Decimal['ROUND_FLOOR'] = 3;
            Decimal['ROUND_HALF_UP'] = 4;
            Decimal['ROUND_HALF_DOWN'] = 5;
            Decimal['ROUND_HALF_EVEN'] = 6;
            Decimal['ROUND_HALF_CEIL'] = 7;
            Decimal['ROUND_HALF_FLOOR'] = 8;

            // modulo mode
            Decimal['EUCLID'] = 9;

            //Decimal['abs'] = abs;
            //Decimal['acos'] = acos;
            //Decimal['asin'] = asin;
            //Decimal['atan'] = atan;
            //Decimal['atan2'] = atan2;
            //Decimal['ceil'] = ceil;
            //Decimal['cos'] = cos;
            //Decimal['floor'] = floor;
            //Decimal['round'] = round;
            //Decimal['sin'] = sin;
            //Decimal['tan'] = tan;
            //Decimal['trunc'] = trunc;

            Decimal['config'] = config;
            Decimal['constructor'] = DecimalFactory;
            Decimal['exp'] = exp;
            Decimal['ln'] = ln;
            Decimal['log'] = log;
            Decimal['max'] = max;
            Decimal['min'] = min;
            Decimal['pow'] = pow;
            Decimal['sqrt'] = sqrt;
            Decimal['random'] = random;
            //Decimal['randomE'] = randomE;

            if ( obj != null ) {
                Decimal['config'](obj);
            }

            return Decimal;
        }

        return DecimalFactory();
    })();


    // Export.


    // Node and other CommonJS-like environments that support module.exports.
    if ( typeof module != 'undefined' && module && module.exports ) {
        module.exports = DecimalConstructor;

        if ( typeof require == 'function' ) {
            crypto = require('crypto');
        }
    } else {
        crypto = global['crypto'];

        //AMD.
        if ( typeof define == 'function' && define.amd ) {
            define( function () { return DecimalConstructor } );

        //Browser.
        } else {
            noConflict = global['Decimal'];

            DecimalConstructor['noConflict'] = function () {
                global['Decimal'] = noConflict;

                return DecimalConstructor;
            };
            global['Decimal'] = DecimalConstructor;
        }
    }
})(this);

},{"crypto":320}],283:[function(require,module,exports){
(function (Buffer){
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

(function() {
  var _global = this;

  // Unique ID creation requires a high quality random # generator.  We feature
  // detect to determine the best RNG source, normalizing to a function that
  // returns 128-bits of randomness, since that's what's usually required
  var _rng;

  // Node.js crypto-based RNG - http://nodejs.org/docs/v0.6.2/api/crypto.html
  //
  // Moderately fast, high quality
  if (typeof(require) == 'function') {
    try {
      var _rb = require('crypto').randomBytes;
      _rng = _rb && function() {return _rb(16);};
    } catch(e) {}
  }

  if (!_rng && _global.crypto && crypto.getRandomValues) {
    // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
    //
    // Moderately fast, high quality
    var _rnds8 = new Uint8Array(16);
    _rng = function whatwgRNG() {
      crypto.getRandomValues(_rnds8);
      return _rnds8;
    };
  }

  if (!_rng) {
    // Math.random()-based (RNG)
    //
    // If all else fails, use Math.random().  It's fast, but is of unspecified
    // quality.
    var  _rnds = new Array(16);
    _rng = function() {
      for (var i = 0, r; i < 16; i++) {
        if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
        _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }

      return _rnds;
    };
  }

  // Buffer class to use
  var BufferClass = typeof(Buffer) == 'function' ? Buffer : Array;

  // Maps for number <-> hex string conversion
  var _byteToHex = [];
  var _hexToByte = {};
  for (var i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }

  // **`parse()` - Parse a UUID into it's component bytes**
  function parse(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = _hexToByte[oct];
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  }

  // **`unparse()` - Convert UUID byte array (ala parse()) into a string**
  function unparse(buf, offset) {
    var i = offset || 0, bth = _byteToHex;
    return  bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]];
  }

  // **`v1()` - Generate time-based UUID**
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html

  // random #'s we need to init node and clockseq
  var _seedBytes = _rng();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  function v1(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || [];

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    var msecs = options.msecs != null ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    var nsecs = options.nsecs != null ? options.nsecs : _lastNSecs + 1;

    // Time since last uuid creation (in msecs)
    var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq == null) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs == null) {
      nsecs = 0;
    }

    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // `time_low`
    var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // `time_mid`
    var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : unparse(b);
  }

  // **`v4()` - Generate random UUID**

  // See https://github.com/broofa/node-uuid for API details
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;

    if (typeof(options) == 'string') {
      buf = options == 'binary' ? new BufferClass(16) : null;
      options = null;
    }
    options = options || {};

    var rnds = options.random || (options.rng || _rng)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || unparse(rnds);
  }

  // Export public API
  var uuid = v4;
  uuid.v1 = v1;
  uuid.v4 = v4;
  uuid.parse = parse;
  uuid.unparse = unparse;
  uuid.BufferClass = BufferClass;

  if (typeof define === 'function' && define.amd) {
    // Publish as AMD module
    define(function() {return uuid;});
  } else if (typeof(module) != 'undefined' && module.exports) {
    // Publish as node.js module
    module.exports = uuid;
  } else {
    // Publish as global (in browsers)
    var _previousRoot = _global.uuid;

    // **`noConflict()` - (browser only) to reset global 'uuid' var**
    uuid.noConflict = function() {
      _global.uuid = _previousRoot;
      return uuid;
    };

    _global.uuid = uuid;
  }
}).call(this);

}).call(this,require("buffer").Buffer)
},{"buffer":314,"crypto":320}],284:[function(require,module,exports){
// The Bellman–Ford algorithm computes shortest paths from a single source to
// all other nodes in a weighted, directed graph.

var ShortestPathTree = require("../models/shortest-path-tree");

function BellmanFord(graph, source, shortest) {
  var nodes = graph.nodes();
  var n = nodes.length;

  shortest = shortest || new ShortestPathTree();

  nodes.each(function(target) {
    shortest.distance(source, target, target === source ? 0 : Infinity);
  });

  // n-1 times
  for (var i = 1; i < n; i++) {
    eachEdge(graph, function(edge, u, v, w) {
      var distance = shortest.distance(source, u) + w;

      if (shortest.distance(source, v) > distance) {
        shortest.distance(source, v, distance);
        shortest.previous(source, v, u);
      }
    });
  }

  eachEdge(graph, function(edge, u, v, w) {
    if (shortest.distance(source, u) + w < shortest.distance(source, v)) {
      throw new Error("Graph contains a negative-weight cycle");
    }
  });

  return shortest;
}

function eachEdge(graph, callback) {
  graph.edges().each(function(edge) {
    callback(edge, edge.source(), edge.target(), edge.weight());
  });
}


module.exports = BellmanFord;

},{"../models/shortest-path-tree":301}],285:[function(require,module,exports){
var ShortestPathTree = require("../models/shortest-path-tree");
var Heap = require("collections/heap");
var FastMap = require("collections/fast-map");

function Brandes(graph) {
  var options = {normalize: true, endpoints: false, k: Infinity};
  var result = new FastMap();

  // if (graph.multi()) {
  //   graph = branderize(graph.clone());
  // }

  graph.nodes().each(function(source) {
    result.set(source, 0);
  });

  graph.nodes().each(function(source) {
    compute(source, graph, options, result);
  });

  if (options.normalize) normalize(graph, result);

  return result;
}

function compute(source, graph, options, result) {
  // TODO: Pretty sure we can reuse the shortest path tree
  // but resetting it will save us a lot of memory
  var shortest = new ShortestPathTree();
  var stack = [];

  // min priority queue
  // TODO: need to use fibonacci heap instead
  var queue = new Heap(null, null, function (u, v) {
    return shortest.distance(source, v) - shortest.distance(source, u);
  });

  // Initialization

  graph.nodes().each(function(target) {
    shortest.count(source, target, 0);
    shortest.dependency(source, target, 0);
    shortest.distance(source, target, Infinity);
  })

  shortest.count(source, source, 1);
  shortest.distance(source, source, 0);

  queue.push(source);

  var v;
  while ( (v = queue.pop()) ) {
    stack.push(v);

    v.outEdges().forEach(function(edge) {
      var w = edge.target();
      var d = shortest.distance(source, v) + edge.weight();

      // k-betweenness shortcircuit
      if (d > options.k) return;

      // Path discovery
      if (shortest.distance(source, w) > d) {
        shortest.count(source, w, 0); // TODO: 0 or 1?
        shortest.distance(source, w, d);
        shortest.previous(source, w, []);

        // Faster way to trigger resort?
        queue.delete(w); // might not be present
        queue.push(w);
      }

      // Path counting
      if (shortest.distance(source, w) === d) {
        var count = shortest.count(source, w) + shortest.count(source, v);
        shortest.count(source, w, count);

        // TODO: append, not replace, otherwise we only can recall the last path
        shortest.previous(source, w).push(v);
      }
    })
  }

  // accumulation
  if (options.endpoints) {
    result.set(source, result.get(source) + stack.length - 1);
  }

  while ( (w = stack.pop()) ) {
    var predecesors = shortest.previous(source, w);

    if (predecesors) predecesors.forEach(function(v) {
      var dep = shortest.dependency(source, v);
      var frequency = shortest.count(source, v) / shortest.count(source, w);

      // Erratum for edge weight/multiplicity:
      // http://www.inf.uni-konstanz.de/algo/publications/b-vspbc-08.pdf
      //
      // The accumulation part is missing from Alg. 11,
      // where a factor of ω(v,w) should be applied to σ[v]/σ[w].
      //
      // if (graph.multi()) {
      // frequency *= multiplicity(v, w);
      // }

      dep += frequency * (1 + shortest.dependency(source, w));

      // length-scaled betweenness
      // += frequency * (1 / shortest.distance(source, ?) + shortest.dependency(source, w));

      shortest.dependency(source, v, dep);
    });

    // TODO: linearly-scaled betweenness (builds on length-scaled)
    if (w !== source) {
      var betweenness = result.get(w) || 0;
      betweenness += shortest.dependency(source, w);

      if (options.endpoints) betweenness += 1;

      result.set(w, betweenness);
    }
  }
}

// Removes self-loops.
// Replaces duplicate edges in the same direction with a single edge.
// The edge weight is set to the lowest weight of all possible edges.
// The edge multiplicity is set to the number of lowest weight edges.
function branderize(graph) {

}

// undirected: 2/((n−1)(n−2))
// directed: 1/((n−1)(n−2))
function normalize(graph, result) {
  var n = graph.order();
  var normalizer = 1 / ((n - 1) * (n - 2));

  if (!graph.directed()) normalizer *= 2;

  result.forEach(function(value, node) {
    result.set(node, value * normalizer);
  });
}

module.exports = Brandes;

},{"../models/shortest-path-tree":301,"collections/fast-map":2,"collections/heap":8}],286:[function(require,module,exports){
var Heap = require("collections/heap");
var ShortestPathTree = require("../models/shortest-path-tree");

function Dijkstra(graph, source, shortest) {
  shortest = shortest || new ShortestPathTree();

  // Min priority queue implementation for better performance
  //
  // TODO: Pretty sure we need to be using a fibonacci heap to get
  // the performance benefits here. This one is a binary heap.
  var queue = new Heap(null, null, function (u, v) {
    return shortest.distance(source, v) - shortest.distance(source, u);
  });

  graph.nodes().each(function(target) {
    shortest.distance(source, target, Infinity);
    queue.push(target);
  });

  shortest.distance(source, source, 0);

  var u;
  while ( (u = queue.pop()) ) {
    u.outEdges().forEach(function(edge) {
      var v = edge.target();

      if (queue.indexOf(v) != -1) {
        var distance = shortest.distance(source, u) + edge.weight();

        if (shortest.distance(source, v) > distance) {
          shortest.distance(source, v, distance);
          shortest.previous(source, v, u);

          // TODO: Is there a faster way to trigger a re-sort?
          queue.delete(v);
          queue.push(v);
        }
      }
    });
  }

  return shortest;
}


module.exports = Dijkstra;

},{"../models/shortest-path-tree":301,"collections/heap":8}],287:[function(require,module,exports){
var uuid = require("node-uuid").v4;
var FastMap = require("collections/fast-map");
var Dijkstra = require("./dijkstra");
var BellmanFord = require("./bellman-ford");
var ShortestPathTree = require("../models/shortest-path-tree");

function Johnson(graph) {
  var shortest = new ShortestPathTree();
  // var g = graph.clone();
  var q = graph.addNode(uuid());

  // Connect q to all other nodes with weight 0
  graph.nodes().each(function(target) {
    q.connect(target, {id: uuid(), weight: 0});
  });

  // Calculate shortest path distance from q to all other nodes
  BellmanFord(graph, q, shortest);

  // Adjust edge weights
  graph.edges().each(function(edge) {
    var source = edge.source();
    var target = edge.target();
    var weight = edge.weight();

    weight += shortest.distance(q, source) - shortest.distance(q, target);

    edge.weight(weight);
  });

  // Remove q and all related edges from the graph
  q.remove();

  // Reset shortest path calculations
  shortest.reset();

  // Calculate new shortest paths on original graph with adjusted weights
  graph.nodes().each(function(node) {
    Dijkstra(graph, node, shortest);
  });

  return shortest;
}

module.exports = Johnson;

},{"../models/shortest-path-tree":301,"./bellman-ford":284,"./dijkstra":286,"collections/fast-map":2,"node-uuid":283}],288:[function(require,module,exports){
var Kraken = require("../kraken");

var map = [].map;
var slice = [].slice;
var forEach = [].forEach;

var core = module.exports = {
  // Make sure the prototype behaves like an array
  length: 0,
  splice: Array.prototype.splice,
  forEach: Array.prototype.forEach,

  // TODO: jQuery tracks all operations via the stack, even if it results
  // in invalid selectors.  Should we be doing the same?
  pushStack: function(source, context) {
    var kraken = new Kraken(this.graph, source, context);
    kraken.prevObject = this;
    return kraken;
  },

  find: function(selector) {
    // var self = this;
    // var ret = Kraken.push(this, "", "find", selector), length = 0;
    //
    // this.forEach((component, index) {
    //   graph.find(selector, self[index], )
    // })
    // for ( var i = 0, l = this.length; i < l; i++ ) {
    //   length = ret.length;
    //   jQuery.find( selector, this[i], ret );
    //
    //   if ( i > 0 ) {
    //     // Make sure that the results are unique
    //     for ( var n = length; n < ret.length; n++ ) {
    //       for ( var r = 0; r < length; r++ ) {
    //         if ( ret[r] === ret[n] ) {
    //           ret.splice(n--, 1);
    //           break;
    //         }
    //       }
    //     }
    //   }
    // }
    //
    // return ret;
  },

  slice: function() {
    var components = slice.apply(this, arguments);
    // var b = slice.call(arguments).join(",");

    return this.pushStack(components);
    // return this.pushStack(a, "slice", b);
  },

  each: function(callback, context) {
    forEach.call(this, callback); // context?
    return this;
  },

  eachNode: function(callback, context) {
    forEach.call(this, function(component, index, array) {
      if (component.node) callback.call(context, component, index, array);
    });

    return this;
  },

  eachEdge: function(callback, context) {
    forEach.call(this, function(component, index, array) {
      if (component.edge) callback.call(context, component, index, array);
    });

    return this;
  },

  map: function(callback, context) {
    var result = map.call(this, callback, context);
    return this.pushStack(result);
  },

  count: function() {
    return this.length;
  },

  at: function(index) {
    return index === -1 ? this.slice(index) : this.slice(index, +index + 1);
  },

  first: function() {
    return this.at(0);
  },

  last: function() {
    return this.at(-1);
  },

  top: function(count) {
    return this.slice(0, count ? count : 1);
  },

  bottom: function(n) {
    return this.slice(count ? -count : -1);
  },

  toArray: function() {
    // return this.slice(0);
    return slice.call(this, 0);
  }
}

},{"../kraken":296}],289:[function(require,module,exports){
var is = require("is");
var assert = require("assert");
var math = require("mathjs")();
var Metrics = require("../static").metrics;
// var exports = module.exports = {};


// Delegates the getter method to the first item in the list.
function delegateGetter(method) {
  exports[method] = function() {
    var entity = this[0];
    return entity[method].apply(entity, arguments);
  };
}

delegateGetter("size");
delegateGetter("ties");
delegateGetter("pairs");
delegateGetter("reach");
delegateGetter("reachEfficiency");
delegateGetter("inreach");
delegateGetter("degree");
delegateGetter("indegree");
delegateGetter("outdegree");
delegateGetter("farness");

// TODO: Make all calculations async
// graph.calc("degree").then(function(result) { ... })
// graph.calc("rank", "a / b").then(...)
// graph.calc("rank", fn).then(...)
//
// TODO: How can we track progress?
exports.calc = function(property, expression) {
  var callback, options;

  // string expressions are simple component-based evaluations
  if (is.string(expression)) return this.eval(property, expression);

  // everything else is selection-based
  if (is.fn(expression)) {
    callback = expression;
  } else {
    var metric = property;

    if (is.object(expression)) {
      options = expression;
      property = expression.as;
    }

    callback = Metrics[metric];
    assert(callback, "Unknown metric, " + property);
  }

  // Metrics should use the resolve callback to resolve the computed
  // value for each component.
  var resolve = function(component, value) {
    component.prop(property, value);
  }

  // TODO: Should we pass the graph / selection explicitly here instead?
  callback.call(this, resolve, options);

  return this;
}

// We also support `collect(property, true)` to achieve the same behavior.
// Not sure which API we prefer yet.
exports.calcAndCollect = function(property, expression) {
  this.calc(property, expression);
  return this.pick(property);
}

// Expression can be a string-based property expression or a callback.
// Callback will be called for each component.
exports.eval = function(property, callback) {
  if (is.string(callback)) {
    var expr = math.compile(callback);
    callback = function(component) {
      return expr.eval(component.properties);
    }
  }

  this.each(function(component) {
    var value = callback(component);
    component.prop(property, value);
  });

  return this;
}

},{"../static":309,"assert":311,"is":24,"mathjs":25}],290:[function(require,module,exports){
var is = require("is");
var assert = require("assert");
var exports = module.exports = {};

// Get / set property on the selection.
exports.prop = function(property, value) {
  if (arguments.length === 1) return this[0].prop(property);

  this.each(function(component) {
    component.prop(property, value);
  });

  return this;
}

exports.copy = function(sourceProperty, targetProperty) {
  this.each(function(component) {
    var value = component.prop(sourceProperty);
    component.prop(targetProperty, value);
  })
  return this;
}

// rename?
// exports.move = function(sourceProperty, targetProperty) {
//
// }

// Custom getters / setters
exports.tag = function(value) {

}

exports.type = function(value) {

}

exports.label = function(value) {

}

exports.removeType = function() { return this.removeProp("type"); }
exports.removeLabel = function() { return this.removeProp("label"); }
exports.removeTags = function() { return this.removeProp("tags"); }
exports.removeTag = function(value) {

}

exports.removeProp = function(property) {
  return this.prop(property, undefined);
}

// TODO: Possible to allow value to be property or mathematical expression?
exports.weight = function(value) {
  if (is.fn(value)) {
    var callback = value;
    this.eval("weight", callback);
  } else if (is.string(value)) {
    var property = value;
    this.copy(property, "weight");
  } else {
    this.prop("weight", value);
  }

  return this;
}

exports.sortBy = function(property) {

}

exports.pick = function(property) {
  var values = {};
  this.each(function(component) {
    var value = component.prop(property);
    if (value !== null && value !== undefined) values[component.id] = value;
  });
  return values;
}

// Passing an expression to `collect` is a shorthand for calling
// `calc(prop, expr).collect(prop)`. It behaves similar to `pick`, however
// the property can be evaluated.
//
// Pass `true` for the expression to force the property to be recalculated.
//
// Undefined values are omitted from the results.
// TODO: What about NaN?
exports.collect = function(property, expression) {
  if (expression === true) {
    this.calc(property);
  } else if (expression) {
    this.calc(property, expression);
  }

  return this.pick(property);
}

exports.pluck = function(property) {
  return this.map(function(component) {
    return component.prop(property);
  }).toArray();
}

// exports.normalize = function(property) {}

},{"assert":311,"is":24}],291:[function(require,module,exports){
var stats = module.exports = {};

stats.min = function(property) {
  return 0;
}

stats.max = function(property) {
  return 0;
}

stats.avg = function(property) {
  return 0;
}

// stats.nth = function(property) {
//
// }

// stats.rankBy = function(property) {}

},{}],292:[function(require,module,exports){
// var Set = require("set");

// Inspired by sizzle:
// https://github.com/jquery/sizzle/wiki/Sizzle-Documentation
// https://github.com/samleb/bouncer
//
// TODO:
// - lfu selector cache (or heaviest)

// var Kraken = require("./kraken");
var selectors = {match: {}, find: {}, filter: {}, pseudo: {}};

var proto = module.exports = {
  find: function(selector, context) {
    // return Kraken
    // if (selector === "*") {
    //   return this.slice(0);
    // } else {
    //   return
    // }
  },

  closest: function(selector) {
    // var set = new Set();
    // var result = Kraken.push(this, selector);
    //
    // this.each(function(component, index) {
    //   set.add(closest);
    // });
    //
    // return result;
  },

  filter: function(selector) {

  },

  // Public: Tests if the component matches the selector.
  //
  // Examples
  //   test("[label]", node)
  //
  // Returns true if component matches the selector.
  test: function(selector) {

  },

  compile: function(selector) {

  }
};

},{}],293:[function(require,module,exports){
var util = require("util");

function Collection() {
  // TODO: Optimize this for addition, removal, and iteration
  // For now we want collections to behave as arrays
  var models = [];
}

util.inherits(Collection, Array);

// Collection.prototype = Object.create(Array.prototype)
// Collection.prototype.constructor = Collection;

Collection.prototype.add = function(component) {
  return this.push(component);
}

Collection.prototype.remove = function(component) {
  var index = this.indexOf(component);
  return index == -1 ? this : this.splice(index, 1);
}

// TODO: Figure out why concat doesn't just work on its own
Collection.prototype.concat = function(collection) {
  return this.toArray().concat(collection.toArray());
}

Collection.prototype.toArray = function() {
  return this.slice(0);
}

module.exports = Collection;

},{"util":333}],294:[function(require,module,exports){
// The goal of this index is to quickly be able to tell if and how two nodes
// are connected.
//
// TODO: Right now we're storing the actual node and edge references. Would it
// be more efficient to just store ids instead?
//
// TODO: Can we use generators here and possibly a doubly-linked list to make
// the set efficient to iterate AND edit? Removals are expensive with the
// current array-based approach.
//
// TODO: Track edge confirmation?
function EdgeIndex() {
  this.by = {source: {}, target: {}, all: {}};
}

EdgeIndex.prototype.source = function(edge) {

};

EdgeIndex.prototype.target = function(edge) {

};

EdgeIndex.prototype.add = function(source, target, edge) {
  this.from(source).add(edge, target);
  this.to(target).add(edge, source);
  this.all(source).add(edge, target);
  this.all(target).add(edge, source);
};

EdgeIndex.prototype.remove = function(source, target, edge) {
  this.from(source).remove(edge, target);
  this.to(target).remove(edge, source);
  this.all(target).remove(edge, source);
  this.all(source).remove(edge, target);
};

// The edge itself does not store references to source and target so it's
// easy to reverse the graph.
EdgeIndex.prototype.reverse = function() {
  var tmp = this.by.source;
  this.by.source = this.by.target;
  this.by.target = tmp;
};

// has(source)
// has(null, target)
// has(source, target, edge)
//
// or
//
// hasEdgeFrom
// hasEdgeTo
// hasAnyAdge
EdgeIndex.prototype.has = function(edge) {

};

EdgeIndex.prototype.from = function(source, target) {
  var index = this.indexFor(source, "source");
  return target ? index.get(target) : index;
};

EdgeIndex.prototype.to = function(node) {
  return this.indexFor(node, "target");
};

// TODO: all(node, node) for all edges between
EdgeIndex.prototype.all = function(node) {
  return this.indexFor(node, "all");
};

EdgeIndex.prototype.indexFor = function(node, role) {
  var set = this.by[role][node.id] = this.by[role][node.id] || new EdgeSet()
  return set;
};


function EdgeSet(simple) {
  this.length = 0;
  this.edges = [];
  if (!simple) this.byNode = {};
}

EdgeSet.prototype.add = function(edge, node) {
  if (this.byNode) this.addEdgeForNode(edge, node);
  this.edges.push(edge);
  this.length++;
};

EdgeSet.prototype.remove = function(edge, node) {
  if (this.byNode) this.removeEdgeForNode(edge, node);
  this.edges.splice(this.edges.indexOf(edge), 1);
  this.length--;
};

EdgeSet.prototype.addEdgeForNode = function(edge, node) {
  var index = this.byNode[node.id] = this.byNode[node.id] || new EdgeSet(true);
  index.add(edge);
};

EdgeSet.prototype.removeEdgeForNode = function(edge, node) {
  this.byNode[node.id].remove(edge, node);
};

EdgeSet.prototype.get = function(node) {
  return this.byNode[node.id];
};

EdgeSet.prototype.forEach = function(fn, context) {
  return this.edges.forEach(fn, context);
};

module.exports = EdgeIndex;

},{}],295:[function(require,module,exports){
var is = require("is");
var assert = require("assert");
var Set = require("collections/set");
var Collection = require("./collection");
var EdgeIndex = require("./edge_index");
var ShortestPathTree = require("../models/shortest-path-tree");
var Johnson = require("../algorithms/johnson");
var Dijkstra = require("../algorithms/dijkstra");

// An Index represents the backbone of a graph.  It stores the graph structure
// and indexes the contents to enable efficient lookups.
function Index(graph) {
  // TODO: store each property as its own tree
  this.graph = graph;
  this.by = {id: {}};
  this.edges = new EdgeIndex();
  this.collections = {nodes: new Collection(), edges: new Collection()};
  this.shortest = new ShortestPathTree();

  this._order = 0; // number of nodes
  this._size = 0;  // number of edges
}

Index.prototype.order = function() { return this._order; }
Index.prototype.size = function() { return this._size; }

Index.prototype.addNode = function(node) {
  assert(!this.contains(node), "Node already exists, " + node);
  this.by.id[node.id] = node;
  this.collections.nodes.add(node);
  this._order += 1;
  this.shortest.reset();
}

Index.prototype.addEdge = function(source, target, edge) {
  assert(!this.contains(edge), "Edge already exists, " + edge);
  this.by.id[edge.id] = edge;
  this.edges.add(source, target, edge);
  this.collections.edges.add(edge);
  this._size += 1;
  this.shortest.reset();
}

Index.prototype.update = function(component) {

}

Index.prototype.remove = function(component) {
  if (component.type === "node")
    this.removeNode(component);
  else
    this.removeEdge(component);

  delete this.by.id[component.id];
}

Index.prototype.removeNode = function(node) {
  var self = this;

  // Remove all related edges
  this.edges.all(node).forEach(function(edge) {
    self.removeEdge(edge);
  });

  // Remove the node itself
  this.collections.nodes.remove(node);
  this._order -= 1;
  this.shortest.reset();
}

// TODO: invalidate related nodes?
Index.prototype.removeEdge = function(edge) {
  var source = edge.source(), target = edge.target();
  this.edges.remove(source, target, edge);
  this.collections.edges.remove(edge);
  this._size -= 1;
  this.shortest.reset();
}

Index.prototype.reverse = function() {
  this.edges.reverse();
  this.shortest.reset();
}

// Public: Returns the component with the given id.
// Can be called with id, properties object, or Component.
Index.prototype.get = function(id) {
  if (is.object(id)) id = id.id || id.get("id");
  return this.getEntityById(id);
}

// Public: Returns true if component is present.
Index.prototype.contains = function(component) {
  return !!this.get(component);
}

Index.prototype.getEdgeSource = function(edge) {
  // return this.edges.
}

Index.prototype.getEdgeTarget = function(edge) {

}

Index.prototype.getEdgesFor = function(node) {
  return this.edges.all(node) || [];
}

Index.prototype.getOutEdgesFor = function(node) {
  return this.edges.from(node) || [];
}

// alias
Index.prototype.getEdgesFrom = Index.prototype.getOutEdgesFor;

Index.prototype.getInEdgesFor = function(node) {
  return this.edges.to(node) || [];
}

// alias
Index.prototype.getEdgesTo = Index.prototype.getInEdgesFor;



Index.prototype.getEdgeCountFor = function(node) {
  return this.edges.all(node).length;
}

Index.prototype.getInEdgeCountFor = function(node) {
  return this.edges.to(node).length;
}

Index.prototype.getOutEdgeCountFor = function(node) {
  return this.edges.from(node).length;
}

Index.prototype.getNeighbors = function(node) {
  return [];
}

Index.prototype.getNeighborCount = function(node) {
  return this.getNodeSize(node) - 1;
}

Index.prototype.getInNeighborCount = function(node) {
  return -1;
}

Index.prototype.getOutNeighborCount = function(node) {
  return -1;
}

Index.prototype.getDistance = function(source, target) {
  var distance = this.getCachedDistance(source, target);

  if (is.defined(distance)) {
    return distance;
  } else {
    return this.calcDistance(source, target);
  }
}

Index.prototype.getCachedDistance = function(source, target) {
  return this.shortest.distance(source, target);
}

// Right now we calculate all of source's shortest paths instead
// of just the ones to target, expecting additional queries to
// other targets. Values are cached until graph modification.
Index.prototype.calcDistance = function(source, target) {
  Dijkstra(this.graph, source, this.shortest);
  return this.getDistance(source, target);
}

// Use's Johnson's algorithm to compute all-pairs-shortest-paths.
// Values are cached until graph modification.
Index.prototype.calcShortestPaths = function() {
  Johnson(this.graph, this.shortest);
}


// which: nodes or edges
Index.prototype.getEntityById = function(id) { return this.by.id[id]; }
Index.prototype.getEntities = function() { return this.collections.nodes.concat(this.collections.edges); }
Index.prototype.getEntitiesByCollection = function(which) { return this.collections[which]; }
Index.prototype.getEntitiesByTag = function(tag) {}
Index.prototype.getEntitiesByType = function(type) {}
Index.prototype.getEntitiesByLabel = function(label) {}
Index.prototype.getEntitiesByProperty = function(prop, value) {}
Index.prototype.getEntitiesBySource = function(source) {}
Index.prototype.getEntitiesByTarget = function(target) {}


module.exports = Index;

},{"../algorithms/dijkstra":286,"../algorithms/johnson":287,"../models/shortest-path-tree":301,"./collection":293,"./edge_index":294,"assert":311,"collections/set":15,"is":24}],296:[function(require,module,exports){
// Inspired by jquery's wrapped set model
//
// http://www.keyframesandcode.com/resources/javascript/deconstructed/jquery/
//
// TODO: Add utility methods through one of the libs below. Preferably one that
// supports lazy evaluation and generators.
//
// Grunge: https://www.npmjs.org/package/grunge
// Lazy.js: http://danieltao.com/lazy.js
// Underscore: http://underscorejs.org
// Lo-dash: http://lodash.com/docs

// find
// closest
// nodes/edges/neighbors
// set/get/unset (attr?)
// filter
// reject
// each
// map
// every/some
// pluck
// first
// last
// eq/at
// connectTo(target)
// connectFrom(source)
// connectBy(prop)
// remove
// replaceWith
// sortBy
// groupBy
// countBy
// toArray

var is = require("is");
var extend = require("extend");
var utils = require("./utils");
var Graph = require("./models/graph");
var Entity = require("./models/entity");

function Kraken(graph, value, context) {
  if (arguments.length === 0) {
    return new Graph();
  } else if (!is.instance(graph, Graph)) {
    var data = graph;
    return new Graph(data);
  }

  if (!(this instanceof Kraken)) { return new Kraken(graph, value, context); }

  var self = this;
  this.graph = graph;
  this.selector = "";
  this.context = context;

  // [entities]
  if (is.array(value)) {
    var entities = value;
    entities.forEach(function(entity, index) {
      self[index] = entity;
    });
    self.length = entities.length;
    return this;
  }

  // selector
  if (is.string(value)) {
    this.selector = value;
    Kraken.find(graph, this.selector, this.context, this);
    return this;
  }
}

// TODO: context, selector, results instead?
// where context can be selection or graph?
Kraken.find = function(graph, value, context, result) {
  var entities;

  result = result || new Kraken(graph, value, context);

  if (is.string(value)) {
    entities = Kraken.select(result, value);
  } else if (is.array(value)) {
    entities = value;
  } else if (value instanceof Entity) {
    entities = [value];
  }

  if (entities) {
    utils.transfer(entities, result);
  } else {
    result.length = 0;
  }

  return result;
}

extend(Kraken, require("./static"));

Graph.find = Kraken.find;

Kraken.prototype = {};
Kraken.prototype.kraken = "[kraken object]";
extend(Kraken.prototype, require("./api/core"));
extend(Kraken.prototype, require("./api/properties"));
extend(Kraken.prototype, require("./api/statistics"));
extend(Kraken.prototype, require("./api/metrics"));
extend(Kraken.prototype, require("./api/traversal"));

// Allow selection prototype to be extended jQuery style
Kraken.fn = Kraken.prototype;

// Static api
Kraken.register = require("./plugins/register");
Kraken.graph    = function(data) { return new Graph(data); };

// Require core graph plugins
Graph.prototype.components = require("./plugins/graph/components");

// Require core formats
Kraken.register("format", "JSON", require("./plugins/formats/json"));

// TODO: Need a better way of defining metrics so they're added to the
// graph, the entity, and the selection.
// Kraken.register("metric", "degree", require(".."))
// Kraken.register("node:degree")
// Kraken.register("edge:degree")
// Kraken.register("graph:degree")

// Require core metrics
[
  "size",
  "ties",
  "pairs",
  "density",
  "degree",
  "indegree",
  "outdegree",
  "farness",
  "closeness"
].forEach(registerSimpleMetric);

function registerSimpleMetric(metric) {
  console.log("registering metric", metric);

  Kraken.metrics[metric] = function(resolve, options) {
    this.eachNode(function(node) {
      resolve(node, node[metric].call(node));
    });
  }
}

Kraken.metrics["betweenness"] = require("./plugins/metrics/betweenness");

Kraken.metrics["reach"]       = require("./plugins/metrics/reach")(1);
Kraken.metrics["reach1"]      = require("./plugins/metrics/reach")(1);
Kraken.metrics["reach2"]      = require("./plugins/metrics/reach")(2);
Kraken.metrics["reach3"]      = require("./plugins/metrics/reach")(3);

module.exports = Kraken;

},{"./api/core":288,"./api/metrics":289,"./api/properties":290,"./api/statistics":291,"./api/traversal":292,"./models/entity":298,"./models/graph":299,"./plugins/formats/json":303,"./plugins/graph/components":304,"./plugins/metrics/betweenness":305,"./plugins/metrics/reach":306,"./plugins/register":307,"./static":309,"./utils":310,"extend":23,"is":24}],297:[function(require,module,exports){
var Entity = require("./entity");

// We intentionally do not store source and target on the edge itself to
// make shallow graph cloning easier. This also prevents the edge from being
// rebased without the graph being aware of the change.
function Edge(graph, properties) {
  Entity.call(this, graph, properties);
}

Edge.prototype = Object.create(Entity.prototype);
Edge.prototype.constructor = Edge;
Edge.prototype.type = "edge";
Edge.prototype.edge = true;

Edge.prototype.source = function() {
  return this._source; // this.graph.getEdgeSource(this);
}

Edge.prototype.target = function() {
  return this._target; // this.graph.getEdgeTarget(this);
}

Edge.prototype.isSource = function(node) {
  return this.source() === node;
}

Edge.prototype.isTarget = function(node) {
  return this.target() === node;
}

Edge.prototype.rebase = function(source, target) {
  return this.graph.rebaseEdge(this, source, target);
}

// Returns the assigned edge weight or 1 if undefined.
//
// TODO: This approach violates the principle of least surprise.
// Might want to handle this on a case-by-case basis for each algorithm
// or set as default properties instead.
//
// TODO: Consider alternative graph.weight("prop") that can be used to set the
// property used for edge weights. This method would take that setting into
// account when determining edge weight.
Edge.prototype.weight = function(value) {
  if (arguments.length === 0) {
    return this.get("weight", 1);
  } else {
    return this.set("weight", value);
  }
}

// Returns the assigned edge multiplicity or 1 if undefined.
Edge.prototype.multiplicity = function(value) {
  if (arguments.length === 0) {
    return this.get("multiplicity", 1);
  } else {
    return this.set("multiplicity", value);
  }
}

module.exports = Edge;

},{"./entity":298}],298:[function(require,module,exports){
var is = require("is");
var assert = require("assert");
var Graph = require("./graph");

//
// API
//
//   has(prop)
//   get(prop)
//   set(prop, value)
//   unset(prop)
//
//   prop(prop[, value])
//   removeProp(prop)
//
//   push(prop)
//   pop(prop)
//
//   tag(tag)
//   untag(tag) or removeTag(tag)
//
//   calc(metric)
//   compute(prop, expression or function)
//
//   degree()
//   inDegree()
//   outDegree()
//   betweeness()
//   eigen()
//
//   ignore() ?
//   remove()

// Create a new Entity within `graph`.
function Entity(graph, properties) {
  // assert(is.a(graph, Graph), "Graph expected, given: " + graph);
  // assert(is.string(properties.id), "String id expected, given: " + properties.id);

  this.graph = graph;
  this.properties = properties;
  this.id = properties.id; // assumes id is constant
}

Entity.prototype.get = function(property, defaultValue) {
  var value = this.properties[property];
  return value || value === 0 ? value : defaultValue;
}

Entity.prototype.set = function(property, value) {
  this.properties[property] = value;
  return this;
}

Entity.prototype.prop = function(property, value) {
  return arguments.length === 1 ? this.get(property) :
                                  this.set(property, value);
}

propertyAccessor("weight");

function propertyAccessor(prop) {
  Entity.prototype[prop] = function(value) {
    if (arguments.length === 0) {
      return this.prop(prop);
    } else {
      return this.prop(prop, value);
    }
  }
}

module.exports = Entity;

},{"./graph":299,"assert":311,"is":24}],299:[function(require,module,exports){

var is = require("is");
var assert = require("assert");
var delegate = require("delegates");
var utils = require("../utils");
var Node = require("./node");
var Edge = require("./edge");
var GraphIndex = require("../index/graph_index");
var Set = require("collections/set");
// var JohnsonsAllPairsShortestPaths = require("../algorithms/johnsons");
var Brandes = require("../algorithms/brandes");

//
// API
//  add({node_properties})
//  connect({edge_properties})
//  insert(node|edge)
//  remove(node|edge)
//  contains(node|edge|graph)
//  calculate(metric), alias calc
//  compute(property, expression or function), alias comp
//  pluck(prop[, prop...])
//  filter(selector[, context])
//  join(graph)
//  intersect(graph)
//  transform(...), alias x
//  clone()       // alias dup, shallow clone (shared properties)
//  deepClone()   // alias fork, deep clone (unique properties)
//  get(selector or id[, selector or id...]) // assumes unique, returns first match
//  find(selector[, context]) // returns WrappedSet
//  nodes()                   // returns WrappedSet
//  edges()                   // returns WrappedSet
//
// TODO: Which operations return new graph instances and which ones return
// a selection context?
//
// TODO: Does it make more sense to store adjacency centrally on the graph
// or separately on each node?
function Graph(data) {
  this.index = new GraphIndex(this);
  this.options = {
    directed: true,
    weighted: true,
    multi: true,
    strict: true,

    // Default edge id generator
    eid: function(source, target, properties) {
      return source.id + "-" + properties.type + "-" + target.id;
    }
  };

  // TODO: How could we hold onto a permanent kraken ref?
  // this.kraken = new Kraken(this);

  if (data) { this.import(data); }
}

//
// TODO: undirected and unweighted graphs can use much simpler and faster
// algorithms. For instance, Brandes' algorithm for betweenness deteriorates
// from O(nm) to O(nm + n^2logn) for weighted graphs.
//
// By default we should be able to calculate the metrics for any graph.
// Optimizations through simplification would be opt-in.
//
// See: http://en.wikipedia.org/wiki/Shortest_path_problem
//
Graph.prototype.directed = function(directed) {
  return this.option("directed", directed !== false)
}

Graph.prototype.weighted = function(weighted) {
  return this.option("weighted", weighted !== false)
}

// TODO: Automatically track whether the graph is a multi-graph instead.
// Can use multi(false) to disable multi graph support ahead of time and catch
// duplicate edges though.
Graph.prototype.multi = function(multi) {
  return this.option("multi", multi !== false)
}

Graph.prototype.strict = function(strict) {
  return this.option("strict", strict !== false);
};

Graph.prototype.option = function(name, value) {
  if (arguments.length === 2) {
    this.options[name] = value;
    return this;
  } else {
    return this.options[name];
  }
};

Graph.prototype.eid = function(source, target, properties) {
  if (arguments.length === 1) {
    var fn = source;
    this.options.eid = fn;
    return this;
  } else {
    return this.options.eid(source, target, properties);
  }
}

// Graph.prototype.nid = function(node) {
//   assert(false, "All nodes must include an explicit string id");
// }
//
// Graph.prototype.eid = function(edge, source, target) {
//   assert(false, "All edges must include an explicit string id");
// }

// Public: Adds the node to the graph.
// Can be called with single node definition or array of node definitions.
Graph.prototype.add = function(node) {
  if (is.array(node)) {
    var nodes = node;
    for (node in nodes) this.addNode(node);
  } else {
    this.addNode(node);
  }

  return this;
};

// Public: Adds edge between source and target with the given properties.
Graph.prototype.connect = function(sourceID, targetID, edge) {
  this.addEdge(sourceID, targetID, edge);
  return this;
};

// Public: Removes the given node/edge
Graph.prototype.remove = function(component) {
  this.index.remove(component);
  return this;
};

Graph.prototype.addNode = function(value) {
  var properties = is.object(value) ? value : {id: value};
  var node = new Node(this, properties);
  this.insertNode(node);
  return node;
};

Graph.prototype.addEdge = function(sourceID, targetID, value) {
  var source = this.get(sourceID) || this.addNodeLazy(sourceID);
  var target = this.get(targetID) || this.addNodeLazy(targetID);
  var properties = is.object(value) ? value : {type: value};
  properties.id = properties.id || this.eid(source, target, properties);
  var edge = new Edge(this, properties);

  // TODO: We originally didn't want to store the source and target on
  // the edge itself but doing so makes things a hell of a lot easier to follow.
  edge._source = source;
  edge._target = target;

  return this.insertEdge(source, target, edge);
};

Graph.prototype.addNodeLazy = function(id) {
  assert(!this.options.strict, "Node not found, " + id);
  return this.addNode(id);
};

Graph.prototype.insertNode = function(node) {
  this.index.addNode(node);
  return this;
};

Graph.prototype.insertEdge = function(source, target, edge) {
  assert(this.contains(source), "Source must exist in graph, " + source);
  assert(this.contains(target), "Target must exist in graph, " + target);
  this.index.addEdge(source, target, edge);
  return this;
};

Graph.prototype.update = function(component) {
  this.index.update(component);
  return this;
};

Graph.prototype.find = function(selector, context) {
  return Graph.find(this, selector || "*", context);
};

// Convenience finders
Graph.prototype.nodes = function() { return this.find("node"); };
Graph.prototype.edges = function() { return this.find("edge"); };

// Reverse all of the edges within the graph.
Graph.prototype.reverse = function() {
  this.index.reverse();
  return this;
};

Graph.prototype.weight = function(value) {
  this.find().weight(value);
  return this;
};

Graph.prototype.calc = function(property, expression) {
  this.find().calc(property, expression);
  return this;
};

Graph.prototype.eval = function(property, expression) {
  this.find().eval(property, expression);
  return this;
};

Graph.prototype.collect = function(property, expression) {
  return this.find().collect(property, expression);
};

// TODO: Allow data to be promise also
Graph.prototype.load = Graph.prototype.import = function(data) {
  this.importJSON(data);
  return this;
};

// undirected: 2 * E / (N * (N − 1))
// directed: E / (N * (N − 1))
Graph.prototype.density = function() {
  return this.size() / this.getCompleteSize();
}

// undirected: (N * (N-1)) / 2
// directed: N*(N-1)
Graph.prototype.getCompleteSize = function() {
  var order = this.order();
  return order * (order - 1);
};

// TODO: cache the calculation
Graph.prototype.shortestPaths = function() {
  return JohnsonsAllPairsShortestPaths(this);
}

// TODO: Cache
Graph.prototype.betweenness = function() {
  // return this.cache.betweenness || this.calculateBetweenness();
  return Brandes(this);
}

// Undirected: (N * (N-1)) / 2
// Directed: N*(N-1)
// Multigraph: Infinity
// Graph.prototype.getMaxSize = function() {
//   N*(N-1) is number of edges in directed graph. Number of edge in undirected graph is
// }


// Only methods that require an intimate knowledge of the inner workings of
// the index should be delegated.  All others should be defined by the graph
// itself using the exposed api.
delegate(Graph.prototype, "index")
  .method("order")
  .method("size")
  .method("contains")
  .method("get")
  .method("getEdgeSource")
  .method("getEdgeTarget")
  .method("getEdgesFor")
  .method("getEdgeCountFor")
  .method("getInEdgesFor")
  .method("getInEdgeCountFor")
  .method("getOutEdgesFor")
  .method("getOutEdgeCountFor")
  .method("getDistance")
  .method("getEntityById")
  .method("getEntities")
  .method("getEntitiesByCollection")
  .method("getEntitiesByTag")
  .method("getEntitiesByType")
  .method("getEntitiesByLabel")
  .method("getEntitiesByProperty")
  .method("getEntitiesBySource")
  .method("getEntitiesByTarget");


module.exports = Graph;

},{"../algorithms/brandes":285,"../index/graph_index":295,"../utils":310,"./edge":297,"./node":300,"assert":311,"collections/set":15,"delegates":22,"is":24}],300:[function(require,module,exports){
var Set = require("collections/set");
var Entity = require("./entity");
var Dijkstra = require("../algorithms/dijkstra");

function Node(graph, properties) {
  Entity.call(this, graph, properties);
}

Node.prototype = Object.create(Entity.prototype);
Node.prototype.constructor = Node;
Node.prototype.type = "node";
Node.prototype.node = true;

Node.prototype.remove = function() {
  this.graph.remove(this);
  return this;
}

Node.prototype.connect = function(target, edge) {
  this.graph.connect(this, target, edge);
  return this;
}

// Neighborhood size
// Returns the number of nodes connected to node plus the node itself
Node.prototype.size = function() {
  var nodes = new Set();

  this.edges().forEach(function(edge) {
    nodes.add(edge.source());
    nodes.add(edge.target());
  });

  nodes.add(this);

  return nodes.length;
}

// TODO: insize/outsize

// Neighborhood ties
// Returns the number of edges for the node
Node.prototype.ties = function() {
  return this.graph.getEdgeCountFor(this);
}

// Neighborhood pairs
// Assumes directed graph
Node.prototype.pairs = function() {
  var n = this.size();
  return n * (n - 1);
}

// Neighborhood density
Node.prototype.density = function() {
  return this.ties() / this.pairs();
}

// Defaults to two-step reach if distance undefined
Node.prototype.reach = function(distance, visited) {
  if (distance === 0) return 0;

  var reach = 0;
  var self = this;
  var adjust = !visited;

  // Default to two-step reach
  distance = distance || 2;

  visited = visited || new Set();
  visited.add(self);

  this.edges().forEach(function(edge) {
    var target = edge.target();

    if (target !== self && !visited.has(target)) {
      visited.add(target);
      reach += 1 + target.reach(distance - 1, visited);
    }
  });

  if (adjust) {
    var order = this.graph.order();

    if (order > 1) {
      reach = reach / (order - 1);
    } else {
      reach = 0;
    }
  }

  return reach;
}

Node.prototype.reachEfficiency = function() {
  return this.reach(2) / this.size();
}

// Uses a modified approach to calculating closeness that works with
// disconnected graphs. Cloneness is defined as the sum of inversed distances
// to all other nodes.
//
// http://toreopsahl.com/2010/03/20/closeness-centrality-in-networks-with-disconnected-components/
Node.prototype.closeness = function() {
  var self = this;
  var graph = this.graph;
  var closeness = 0;

  graph.nodes().each(function(node) {
    var distance = self.distanceTo(node);

    if (distance !== 0) {
      closeness += 1 / distance;
    }
  });

  // normalize values between 0 and 1
  // NOTE: This will not work for edge weights other than 1
  closeness = closeness / (graph.order() - 1);

  return closeness;
}

// Defined as the inverse of closeness
// TODO: Should we be using the raw closeness value instead?
Node.prototype.farness = function() {
  return 1 / this.closeness();
}

Node.prototype.distance = function(node) {
  return Math.min(this.distanceTo(node), this.distanceFrom(node));
}

Node.prototype.distanceTo = function(node) {
  return this.graph.getDistance(this, node);
}

Node.prototype.distanceFrom = function(node) {
  return this.graph.getDistance(node, this);
}

Node.prototype.neighbors = function() {
  var nodes = new Set();

  this.edges().forEach(function(edge) {
    nodes.add(edge.source());
    nodes.add(edge.target());
  });

  nodes.add(this);

  return nodes.length;
}

Node.prototype.outNeighbors = function() {
  return this.graph.find(":out-neighbors", this).filter(filter);
}

Node.prototype.outNeighborCount = function() {
  return this.graph.getOutNeighborCount(this);
}

Node.prototype.inNeighbors = function(filter) {
  return this.graph.find(":in-neighbors", this).filter(filter);
}

Node.prototype.inNeighborCount = function() {
  return this.graph.getInNeighborCount(this);
}

Node.prototype.degree = function() {
  return this.graph.getEdgeCountFor(this);
}
Node.prototype.getEdgeCount = Node.prototype.degree;

Node.prototype.indegree = function() {
  return this.graph.getInEdgeCountFor(this);
}
Node.prototype.getInEdgeCount = Node.prototype.indegree;

Node.prototype.outdegree = function() {
  return this.graph.getOutEdgeCountFor(this);
}
Node.prototype.getOutEdgeCount = Node.prototype.outdegree;


// return this.graph.find(":edges", this).filter(filter);
Node.prototype.edges = function() {
  return this.graph.getEdgesFor(this);
}

Node.prototype.outEdges = function() {
  return this.graph.getOutEdgesFor(this);
}

// Node.prototype.inEdges = function() {
//   return this.graph.find(":in-edges", this).filter(filter);
// }

// Node.prototype.outEdges = function() {
//   return this.graph.find(":out-edges", this).filter(filter);
// }

Node.prototype.hasEdgeTo = function(node) {
  return this.graph.hasEdgeBetween(this, node);
}

Node.prototype.hasEdgeFrom = function(node) {
  return this.graph.hasEdgeBetween(node, this);
}

// Aliases
Node.prototype.in = Node.prototype.inEdges;
Node.prototype.out = Node.prototype.outEdges;


module.exports = Node;

},{"../algorithms/dijkstra":286,"./entity":298,"collections/set":15}],301:[function(require,module,exports){
var FastMap = require("collections/fast-map");

function ShortestPathTree() {
  this._index = new FastMap();
}

ShortestPathTree.prototype.reset = function() {
  this._index.clear();
}

// Number of shortest paths from source to target
accessor("count");

// Distance of source to target
accessor("distance");

// Predecesors on the shortest paths from source to target
accessor("previous");

// Dependency of source on target
accessor("dependency");

ShortestPathTree.prototype._get = function(source) {
  var values = this._index.get(source);

  if (!values) {
    values = {
      count: new FastMap(),
      distance: new FastMap(),
      previous: new FastMap(),
      dependency: new FastMap()
    };

    this._index.set(source, values);
  }

  return values;
}

function accessor(name) {
  ShortestPathTree.prototype[name] = function(source, target, value) {
    var values = this._get(source);

    if (arguments.length === 3) {
      values[name].set(target, value);
      return this;
    } else {
      return values[name].get(target);
    }
  }
}

// TODO: Return shortest path from source to target
// ShortestPathTree.prototype.path = function(source, target) {}
//
// TODO: Return all shortest paths from source
// ShortestPathTree.prototype.paths = function(source) {}
//
// TODO: Return all shortest paths from source to target
// ShortestPathTree.prototype.paths = function(source, target) {}


module.exports = ShortestPathTree;

},{"collections/fast-map":2}],302:[function(require,module,exports){
// https://github.com/networkx/networkx/blob/master/networkx/algorithms/components/connected.py
// https://github.com/networkx/networkx/blob/master/networkx/algorithms/shortest_paths/generic.py

// module.exports = connectedComponentsFor;

// function connectedComponentsFor(graph) {
//   var components = [];
//   var nodes = graph.nodes().toArray();

//   while ( (node = nodes.pop()) ) {
//     exploreNode(node, component);
//   }

//   nodes.forEach(function(node) {

//   });

//   return components;
// }

// function exploreNode(node, component, nodes) {
//   var edges = node.outEdges();

// }

},{}],303:[function(require,module,exports){
// parse?
var format = {
  accept: function(data) {
    return data && (data.nodes || data.edges);
  },

  load: function(graph, data) {
    data.nodes.forEach(function(def) {
      graph.add(def);
    });

    data.edges.forEach(function(def) {
      graph.connect(def[0], def[1], def[2]);
    });
  },

  dump: function(graph) {
    return {nodes: [], edges: []};
  }
};

module.exports = format;

},{}],304:[function(require,module,exports){
var connected = require("../algorithms/components/connected");

module.exports = function() {
  return connected(this);
};

},{"../algorithms/components/connected":302}],305:[function(require,module,exports){
module.exports = function(resolve, options) {
  var betweenness = this.graph.betweenness();

  this.eachNode(function(node) {
    resolve(node, betweenness.get(node));
  });
};

},{}],306:[function(require,module,exports){
module.exports = function(degree) {
  return function(resolve, options) {
    this.eachNode(function(node) {
      resolve(node, node.reach(degree));
    });
  };
};

},{}],307:[function(require,module,exports){
var Graph = require("../models/graph");
var slice = Array.prototype.slice;

function register(type, args) {
  if (type === "format") {
    registerFormat.apply(null, slice.call(arguments, 1));
  } else {
    throw new Error("Unknown extension point, " + type);
  }
}

// Graph#toX
// Graph#importX
function registerFormat(name, format) {
  var dump = format.dump || unsupportedOperation;
  var load = format.load || unsupportedOperation;

  Graph.prototype["to" + name] = function() {
    return dump(this);
  }

  Graph.prototype["import" + name] = function(data) {
    return load(this, data);
  }
}

function unsupportedOperation() {
  assert(false, "Operation not supported");
}

module.exports = register;

},{"../models/graph":299}],308:[function(require,module,exports){
// *
// node
// edge
// #id
// #id node
// #id:neighbors
// #id:out(1)

var Selectors = require("../static");

function universalSelector(graph) {
  return graph.getEntities();
}


function collectionSelector(graph, which) {
  return graph.getEntitiesByCollection(which + "s");
}

function select(context, selector) {
  var components, graph = context.graph;

  if (selector === "*") {
    components = universalSelector(graph)
  } else if (selector === "node" || selector === "edge") {
    components = collectionSelector(graph, selector);
  }

  return components;
}


module.exports = select;

},{"../static":309}],309:[function(require,module,exports){
exports.metrics = {};
exports.selectors = {};
exports.operators = {};
exports.select = require("./query/select");

},{"./query/select":308}],310:[function(require,module,exports){
var is = require("is");

// Use this to turn arguments into an array when a method can accept a
// single item, multiple items, or array of items.
exports.varg = function(args) {
  if (arguments.length > 1) {
    return args;
  } else {
    var firstArg = arguments[0];
    return is.array(firstArg) ? firstArg : [firstArg];
  }
}

// Transfers the source array's data to target
exports.transfer = function(source, target) {
  var length = target.length = source.length;

  for (var index = 0; index < length; index++) {
    target[index] = source[index];
  }

  return target;
}

// Usage:
// var nextID = require("utils").id;
// nextID()
//
// All nodes and edges get their own unique id.
var id = 1;
exports.id = function() { return id++; }


exports.range = function(a, b) {
  var n;
  var range = [];

  if (arguments.length === 1) {
    n = a;
    a = 0;
  } else {
    n = b - a + 1; // inclusive
  }

  for (var i = 0; i < n; i++) range.push(a + i);
  return range;
}

},{"is":24}],311:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":313}],312:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],313:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":312,"_process":331,"inherits":330}],314:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
var TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str.toString()
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.compare = function (a, b) {
  assert(Buffer.isBuffer(a) && Buffer.isBuffer(b), 'Arguments must be Buffers')
  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) {
    return -1
  }
  if (y < x) {
    return 1
  }
  return 0
}

// BUFFER INSTANCE METHODS
// =======================

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end === undefined) ? self.length : Number(end)

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = asciiSlice(self, start, end)
      break
    case 'binary':
      ret = binarySlice(self, start, end)
      break
    case 'base64':
      ret = base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

Buffer.prototype.equals = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.compare = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return readUInt16(this, offset, false, noAssert)
}

function readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return readInt16(this, offset, false, noAssert)
}

function readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return readInt32(this, offset, false, noAssert)
}

function readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return readFloat(this, offset, false, noAssert)
}

function readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
  return offset + 1
}

function writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
  return offset + 2
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, false, noAssert)
}

function writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
  return offset + 4
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
  return offset + 1
}

function writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
  return offset + 2
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, false, noAssert)
}

function writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
  return offset + 4
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, false, noAssert)
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":315,"ieee754":316}],315:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],316:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],317:[function(require,module,exports){
(function (Buffer){
var createHash = require('sha.js')

var md5 = toConstructor(require('./md5'))
var rmd160 = toConstructor(require('ripemd160'))

function toConstructor (fn) {
  return function () {
    var buffers = []
    var m= {
      update: function (data, enc) {
        if(!Buffer.isBuffer(data)) data = new Buffer(data, enc)
        buffers.push(data)
        return this
      },
      digest: function (enc) {
        var buf = Buffer.concat(buffers)
        var r = fn(buf)
        buffers = null
        return enc ? r.toString(enc) : r
      }
    }
    return m
  }
}

module.exports = function (alg) {
  if('md5' === alg) return new md5()
  if('rmd160' === alg) return new rmd160()
  return createHash(alg)
}

}).call(this,require("buffer").Buffer)
},{"./md5":321,"buffer":314,"ripemd160":322,"sha.js":324}],318:[function(require,module,exports){
(function (Buffer){
var createHash = require('./create-hash')

var blocksize = 64
var zeroBuffer = new Buffer(blocksize); zeroBuffer.fill(0)

module.exports = Hmac

function Hmac (alg, key) {
  if(!(this instanceof Hmac)) return new Hmac(alg, key)
  this._opad = opad
  this._alg = alg

  key = this._key = !Buffer.isBuffer(key) ? new Buffer(key) : key

  if(key.length > blocksize) {
    key = createHash(alg).update(key).digest()
  } else if(key.length < blocksize) {
    key = Buffer.concat([key, zeroBuffer], blocksize)
  }

  var ipad = this._ipad = new Buffer(blocksize)
  var opad = this._opad = new Buffer(blocksize)

  for(var i = 0; i < blocksize; i++) {
    ipad[i] = key[i] ^ 0x36
    opad[i] = key[i] ^ 0x5C
  }

  this._hash = createHash(alg).update(ipad)
}

Hmac.prototype.update = function (data, enc) {
  this._hash.update(data, enc)
  return this
}

Hmac.prototype.digest = function (enc) {
  var h = this._hash.digest()
  return createHash(this._alg).update(this._opad).update(h).digest(enc)
}


}).call(this,require("buffer").Buffer)
},{"./create-hash":317,"buffer":314}],319:[function(require,module,exports){
(function (Buffer){
var intSize = 4;
var zeroBuffer = new Buffer(intSize); zeroBuffer.fill(0);
var chrsz = 8;

function toArray(buf, bigEndian) {
  if ((buf.length % intSize) !== 0) {
    var len = buf.length + (intSize - (buf.length % intSize));
    buf = Buffer.concat([buf, zeroBuffer], len);
  }

  var arr = [];
  var fn = bigEndian ? buf.readInt32BE : buf.readInt32LE;
  for (var i = 0; i < buf.length; i += intSize) {
    arr.push(fn.call(buf, i));
  }
  return arr;
}

function toBuffer(arr, size, bigEndian) {
  var buf = new Buffer(size);
  var fn = bigEndian ? buf.writeInt32BE : buf.writeInt32LE;
  for (var i = 0; i < arr.length; i++) {
    fn.call(buf, arr[i], i * 4, true);
  }
  return buf;
}

function hash(buf, fn, hashSize, bigEndian) {
  if (!Buffer.isBuffer(buf)) buf = new Buffer(buf);
  var arr = fn(toArray(buf, bigEndian), buf.length * chrsz);
  return toBuffer(arr, hashSize, bigEndian);
}

module.exports = { hash: hash };

}).call(this,require("buffer").Buffer)
},{"buffer":314}],320:[function(require,module,exports){
(function (Buffer){
var rng = require('./rng')

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = require('./create-hash')

exports.createHmac = require('./create-hmac')

exports.randomBytes = function(size, callback) {
  if (callback && callback.call) {
    try {
      callback.call(this, undefined, new Buffer(rng(size)))
    } catch (err) { callback(err) }
  } else {
    return new Buffer(rng(size))
  }
}

function each(a, f) {
  for(var i in a)
    f(a[i], i)
}

exports.getHashes = function () {
  return ['sha1', 'sha256', 'md5', 'rmd160']

}

var p = require('./pbkdf2')(exports.createHmac)
exports.pbkdf2 = p.pbkdf2
exports.pbkdf2Sync = p.pbkdf2Sync


// the least I can do is make error messages for the rest of the node.js/crypto api.
each(['createCredentials'
, 'createCipher'
, 'createCipheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDiffieHellman'
], function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})

}).call(this,require("buffer").Buffer)
},{"./create-hash":317,"./create-hmac":318,"./pbkdf2":328,"./rng":329,"buffer":314}],321:[function(require,module,exports){
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

var helpers = require('./helpers');

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);

}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function md5(buf) {
  return helpers.hash(buf, core_md5, 16);
};

},{"./helpers":319}],322:[function(require,module,exports){
(function (Buffer){

module.exports = ripemd160



/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
/** @preserve
(c) 2012 by Cédric Mesnil. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

    - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
    - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// Constants table
var zl = [
    0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,
    7,  4, 13,  1, 10,  6, 15,  3, 12,  0,  9,  5,  2, 14, 11,  8,
    3, 10, 14,  4,  9, 15,  8,  1,  2,  7,  0,  6, 13, 11,  5, 12,
    1,  9, 11, 10,  0,  8, 12,  4, 13,  3,  7, 15, 14,  5,  6,  2,
    4,  0,  5,  9,  7, 12,  2, 10, 14,  1,  3,  8, 11,  6, 15, 13];
var zr = [
    5, 14,  7,  0,  9,  2, 11,  4, 13,  6, 15,  8,  1, 10,  3, 12,
    6, 11,  3,  7,  0, 13,  5, 10, 14, 15,  8, 12,  4,  9,  1,  2,
    15,  5,  1,  3,  7, 14,  6,  9, 11,  8, 12,  2, 10,  0,  4, 13,
    8,  6,  4,  1,  3, 11, 15,  0,  5, 12,  2, 13,  9,  7, 10, 14,
    12, 15, 10,  4,  1,  5,  8,  7,  6,  2, 13, 14,  0,  3,  9, 11];
var sl = [
     11, 14, 15, 12,  5,  8,  7,  9, 11, 13, 14, 15,  6,  7,  9,  8,
    7, 6,   8, 13, 11,  9,  7, 15,  7, 12, 15,  9, 11,  7, 13, 12,
    11, 13,  6,  7, 14,  9, 13, 15, 14,  8, 13,  6,  5, 12,  7,  5,
      11, 12, 14, 15, 14, 15,  9,  8,  9, 14,  5,  6,  8,  6,  5, 12,
    9, 15,  5, 11,  6,  8, 13, 12,  5, 12, 13, 14, 11,  8,  5,  6 ];
var sr = [
    8,  9,  9, 11, 13, 15, 15,  5,  7,  7,  8, 11, 14, 14, 12,  6,
    9, 13, 15,  7, 12,  8,  9, 11,  7,  7, 12,  7,  6, 15, 13, 11,
    9,  7, 15, 11,  8,  6,  6, 14, 12, 13,  5, 14, 13, 13,  7,  5,
    15,  5,  8, 11, 14, 14,  6, 14,  6,  9, 12,  9, 12,  5, 15,  8,
    8,  5, 12,  9, 12,  5, 14,  6,  8, 13,  6,  5, 15, 13, 11, 11 ];

var hl =  [ 0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E];
var hr =  [ 0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0x00000000];

var bytesToWords = function (bytes) {
  var words = [];
  for (var i = 0, b = 0; i < bytes.length; i++, b += 8) {
    words[b >>> 5] |= bytes[i] << (24 - b % 32);
  }
  return words;
};

var wordsToBytes = function (words) {
  var bytes = [];
  for (var b = 0; b < words.length * 32; b += 8) {
    bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
  }
  return bytes;
};

var processBlock = function (H, M, offset) {

  // Swap endian
  for (var i = 0; i < 16; i++) {
    var offset_i = offset + i;
    var M_offset_i = M[offset_i];

    // Swap
    M[offset_i] = (
        (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
        (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
    );
  }

  // Working variables
  var al, bl, cl, dl, el;
  var ar, br, cr, dr, er;

  ar = al = H[0];
  br = bl = H[1];
  cr = cl = H[2];
  dr = dl = H[3];
  er = el = H[4];
  // Computation
  var t;
  for (var i = 0; i < 80; i += 1) {
    t = (al +  M[offset+zl[i]])|0;
    if (i<16){
        t +=  f1(bl,cl,dl) + hl[0];
    } else if (i<32) {
        t +=  f2(bl,cl,dl) + hl[1];
    } else if (i<48) {
        t +=  f3(bl,cl,dl) + hl[2];
    } else if (i<64) {
        t +=  f4(bl,cl,dl) + hl[3];
    } else {// if (i<80) {
        t +=  f5(bl,cl,dl) + hl[4];
    }
    t = t|0;
    t =  rotl(t,sl[i]);
    t = (t+el)|0;
    al = el;
    el = dl;
    dl = rotl(cl, 10);
    cl = bl;
    bl = t;

    t = (ar + M[offset+zr[i]])|0;
    if (i<16){
        t +=  f5(br,cr,dr) + hr[0];
    } else if (i<32) {
        t +=  f4(br,cr,dr) + hr[1];
    } else if (i<48) {
        t +=  f3(br,cr,dr) + hr[2];
    } else if (i<64) {
        t +=  f2(br,cr,dr) + hr[3];
    } else {// if (i<80) {
        t +=  f1(br,cr,dr) + hr[4];
    }
    t = t|0;
    t =  rotl(t,sr[i]) ;
    t = (t+er)|0;
    ar = er;
    er = dr;
    dr = rotl(cr, 10);
    cr = br;
    br = t;
  }
  // Intermediate hash value
  t    = (H[1] + cl + dr)|0;
  H[1] = (H[2] + dl + er)|0;
  H[2] = (H[3] + el + ar)|0;
  H[3] = (H[4] + al + br)|0;
  H[4] = (H[0] + bl + cr)|0;
  H[0] =  t;
};

function f1(x, y, z) {
  return ((x) ^ (y) ^ (z));
}

function f2(x, y, z) {
  return (((x)&(y)) | ((~x)&(z)));
}

function f3(x, y, z) {
  return (((x) | (~(y))) ^ (z));
}

function f4(x, y, z) {
  return (((x) & (z)) | ((y)&(~(z))));
}

function f5(x, y, z) {
  return ((x) ^ ((y) |(~(z))));
}

function rotl(x,n) {
  return (x<<n) | (x>>>(32-n));
}

function ripemd160(message) {
  var H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];

  if (typeof message == 'string')
    message = new Buffer(message, 'utf8');

  var m = bytesToWords(message);

  var nBitsLeft = message.length * 8;
  var nBitsTotal = message.length * 8;

  // Add padding
  m[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
  m[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
      (((nBitsTotal << 8)  | (nBitsTotal >>> 24)) & 0x00ff00ff) |
      (((nBitsTotal << 24) | (nBitsTotal >>> 8))  & 0xff00ff00)
  );

  for (var i=0 ; i<m.length; i += 16) {
    processBlock(H, m, i);
  }

  // Swap endian
  for (var i = 0; i < 5; i++) {
      // Shortcut
    var H_i = H[i];

    // Swap
    H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
          (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
  }

  var digestbytes = wordsToBytes(H);
  return new Buffer(digestbytes);
}



}).call(this,require("buffer").Buffer)
},{"buffer":314}],323:[function(require,module,exports){
var u = require('./util')
var write = u.write
var fill = u.zeroFill

module.exports = function (Buffer) {

  //prototype class for hash functions
  function Hash (blockSize, finalSize) {
    this._block = new Buffer(blockSize) //new Uint32Array(blockSize/4)
    this._finalSize = finalSize
    this._blockSize = blockSize
    this._len = 0
    this._s = 0
  }

  Hash.prototype.init = function () {
    this._s = 0
    this._len = 0
  }

  function lengthOf(data, enc) {
    if(enc == null)     return data.byteLength || data.length
    if(enc == 'ascii' || enc == 'binary')  return data.length
    if(enc == 'hex')    return data.length/2
    if(enc == 'base64') return data.length/3
  }

  Hash.prototype.update = function (data, enc) {
    var bl = this._blockSize

    //I'd rather do this with a streaming encoder, like the opposite of
    //http://nodejs.org/api/string_decoder.html
    var length
      if(!enc && 'string' === typeof data)
        enc = 'utf8'

    if(enc) {
      if(enc === 'utf-8')
        enc = 'utf8'

      if(enc === 'base64' || enc === 'utf8')
        data = new Buffer(data, enc), enc = null

      length = lengthOf(data, enc)
    } else
      length = data.byteLength || data.length

    var l = this._len += length
    var s = this._s = (this._s || 0)
    var f = 0
    var buffer = this._block
    while(s < l) {
      var t = Math.min(length, f + bl - s%bl)
      write(buffer, data, enc, s%bl, f, t)
      var ch = (t - f);
      s += ch; f += ch

      if(!(s%bl))
        this._update(buffer)
    }
    this._s = s

    return this

  }

  Hash.prototype.digest = function (enc) {
    var bl = this._blockSize
    var fl = this._finalSize
    var len = this._len*8

    var x = this._block

    var bits = len % (bl*8)

    //add end marker, so that appending 0's creats a different hash.
    x[this._len % bl] = 0x80
    fill(this._block, this._len % bl + 1)

    if(bits >= fl*8) {
      this._update(this._block)
      u.zeroFill(this._block, 0)
    }

    //TODO: handle case where the bit length is > Math.pow(2, 29)
    x.writeInt32BE(len, fl + 4) //big endian

    var hash = this._update(this._block) || this._hash()
    if(enc == null) return hash
    return hash.toString(enc)
  }

  Hash.prototype._update = function () {
    throw new Error('_update must be implemented by subclass')
  }

  return Hash
}

},{"./util":327}],324:[function(require,module,exports){
var exports = module.exports = function (alg) {
  var Alg = exports[alg]
  if(!Alg) throw new Error(alg + ' is not supported (we accept pull requests)')
  return new Alg()
}

var Buffer = require('buffer').Buffer
var Hash   = require('./hash')(Buffer)

exports.sha =
exports.sha1 = require('./sha1')(Buffer, Hash)
exports.sha256 = require('./sha256')(Buffer, Hash)

},{"./hash":323,"./sha1":325,"./sha256":326,"buffer":314}],325:[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */
module.exports = function (Buffer, Hash) {

  var inherits = require('util').inherits

  inherits(Sha1, Hash)

  var A = 0|0
  var B = 4|0
  var C = 8|0
  var D = 12|0
  var E = 16|0

  var BE = false
  var LE = true

  var W = new Int32Array(80)

  var POOL = []

  function Sha1 () {
    if(POOL.length)
      return POOL.pop().init()

    if(!(this instanceof Sha1)) return new Sha1()
    this._w = W
    Hash.call(this, 16*4, 14*4)
  
    this._h = null
    this.init()
  }

  Sha1.prototype.init = function () {
    this._a = 0x67452301
    this._b = 0xefcdab89
    this._c = 0x98badcfe
    this._d = 0x10325476
    this._e = 0xc3d2e1f0

    Hash.prototype.init.call(this)
    return this
  }

  Sha1.prototype._POOL = POOL

  // assume that array is a Uint32Array with length=16,
  // and that if it is the last block, it already has the length and the 1 bit appended.


  var isDV = new Buffer(1) instanceof DataView
  function readInt32BE (X, i) {
    return isDV
      ? X.getInt32(i, false)
      : X.readInt32BE(i)
  }

  Sha1.prototype._update = function (array) {

    var X = this._block
    var h = this._h
    var a, b, c, d, e, _a, _b, _c, _d, _e

    a = _a = this._a
    b = _b = this._b
    c = _c = this._c
    d = _d = this._d
    e = _e = this._e

    var w = this._w

    for(var j = 0; j < 80; j++) {
      var W = w[j]
        = j < 16
        //? X.getInt32(j*4, false)
        //? readInt32BE(X, j*4) //*/ X.readInt32BE(j*4) //*/
        ? X.readInt32BE(j*4)
        : rol(w[j - 3] ^ w[j -  8] ^ w[j - 14] ^ w[j - 16], 1)

      var t =
        add(
          add(rol(a, 5), sha1_ft(j, b, c, d)),
          add(add(e, W), sha1_kt(j))
        );

      e = d
      d = c
      c = rol(b, 30)
      b = a
      a = t
    }

    this._a = add(a, _a)
    this._b = add(b, _b)
    this._c = add(c, _c)
    this._d = add(d, _d)
    this._e = add(e, _e)
  }

  Sha1.prototype._hash = function () {
    if(POOL.length < 100) POOL.push(this)
    var H = new Buffer(20)
    //console.log(this._a|0, this._b|0, this._c|0, this._d|0, this._e|0)
    H.writeInt32BE(this._a|0, A)
    H.writeInt32BE(this._b|0, B)
    H.writeInt32BE(this._c|0, C)
    H.writeInt32BE(this._d|0, D)
    H.writeInt32BE(this._e|0, E)
    return H
  }

  /*
   * Perform the appropriate triplet combination function for the current
   * iteration
   */
  function sha1_ft(t, b, c, d) {
    if(t < 20) return (b & c) | ((~b) & d);
    if(t < 40) return b ^ c ^ d;
    if(t < 60) return (b & c) | (b & d) | (c & d);
    return b ^ c ^ d;
  }

  /*
   * Determine the appropriate additive constant for the current iteration
   */
  function sha1_kt(t) {
    return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
           (t < 60) ? -1894007588 : -899497514;
  }

  /*
   * Add integers, wrapping at 2^32. This uses 16-bit operations internally
   * to work around bugs in some JS interpreters.
   * //dominictarr: this is 10 years old, so maybe this can be dropped?)
   *
   */
  function add(x, y) {
    return (x + y ) | 0
  //lets see how this goes on testling.
  //  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  //  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  //  return (msw << 16) | (lsw & 0xFFFF);
  }

  /*
   * Bitwise rotate a 32-bit number to the left.
   */
  function rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  return Sha1
}

},{"util":333}],326:[function(require,module,exports){

/**
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *
 */

var inherits = require('util').inherits
var BE       = false
var LE       = true
var u        = require('./util')

module.exports = function (Buffer, Hash) {

  var K = [
      0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
      0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
      0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
      0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
      0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
      0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
      0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
      0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
      0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
      0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
      0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
      0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
      0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
      0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
      0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
      0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
    ]

  inherits(Sha256, Hash)
  var W = new Array(64)
  var POOL = []
  function Sha256() {
    if(POOL.length) {
      //return POOL.shift().init()
    }
    //this._data = new Buffer(32)

    this.init()

    this._w = W //new Array(64)

    Hash.call(this, 16*4, 14*4)
  };

  Sha256.prototype.init = function () {

    this._a = 0x6a09e667|0
    this._b = 0xbb67ae85|0
    this._c = 0x3c6ef372|0
    this._d = 0xa54ff53a|0
    this._e = 0x510e527f|0
    this._f = 0x9b05688c|0
    this._g = 0x1f83d9ab|0
    this._h = 0x5be0cd19|0

    this._len = this._s = 0

    return this
  }

  var safe_add = function(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  function S (X, n) {
    return (X >>> n) | (X << (32 - n));
  }

  function R (X, n) {
    return (X >>> n);
  }

  function Ch (x, y, z) {
    return ((x & y) ^ ((~x) & z));
  }

  function Maj (x, y, z) {
    return ((x & y) ^ (x & z) ^ (y & z));
  }

  function Sigma0256 (x) {
    return (S(x, 2) ^ S(x, 13) ^ S(x, 22));
  }

  function Sigma1256 (x) {
    return (S(x, 6) ^ S(x, 11) ^ S(x, 25));
  }

  function Gamma0256 (x) {
    return (S(x, 7) ^ S(x, 18) ^ R(x, 3));
  }

  function Gamma1256 (x) {
    return (S(x, 17) ^ S(x, 19) ^ R(x, 10));
  }

  Sha256.prototype._update = function(m) {
    var M = this._block
    var W = this._w
    var a, b, c, d, e, f, g, h
    var T1, T2

    a = this._a | 0
    b = this._b | 0
    c = this._c | 0
    d = this._d | 0
    e = this._e | 0
    f = this._f | 0
    g = this._g | 0
    h = this._h | 0

    for (var j = 0; j < 64; j++) {
      var w = W[j] = j < 16
        ? M.readInt32BE(j * 4)
        : Gamma1256(W[j - 2]) + W[j - 7] + Gamma0256(W[j - 15]) + W[j - 16]

      T1 = h + Sigma1256(e) + Ch(e, f, g) + K[j] + w

      T2 = Sigma0256(a) + Maj(a, b, c);
      h = g; g = f; f = e; e = d + T1; d = c; c = b; b = a; a = T1 + T2;
    }

    this._a = (a + this._a) | 0
    this._b = (b + this._b) | 0
    this._c = (c + this._c) | 0
    this._d = (d + this._d) | 0
    this._e = (e + this._e) | 0
    this._f = (f + this._f) | 0
    this._g = (g + this._g) | 0
    this._h = (h + this._h) | 0

  };

  Sha256.prototype._hash = function () {
    if(POOL.length < 10)
      POOL.push(this)

    var H = new Buffer(32)

    H.writeInt32BE(this._a,  0)
    H.writeInt32BE(this._b,  4)
    H.writeInt32BE(this._c,  8)
    H.writeInt32BE(this._d, 12)
    H.writeInt32BE(this._e, 16)
    H.writeInt32BE(this._f, 20)
    H.writeInt32BE(this._g, 24)
    H.writeInt32BE(this._h, 28)

    return H
  }

  return Sha256

}

},{"./util":327,"util":333}],327:[function(require,module,exports){
exports.write = write
exports.zeroFill = zeroFill

exports.toString = toString

function write (buffer, string, enc, start, from, to, LE) {
  var l = (to - from)
  if(enc === 'ascii' || enc === 'binary') {
    for( var i = 0; i < l; i++) {
      buffer[start + i] = string.charCodeAt(i + from)
    }
  }
  else if(enc == null) {
    for( var i = 0; i < l; i++) {
      buffer[start + i] = string[i + from]
    }
  }
  else if(enc === 'hex') {
    for(var i = 0; i < l; i++) {
      var j = from + i
      buffer[start + i] = parseInt(string[j*2] + string[(j*2)+1], 16)
    }
  }
  else if(enc === 'base64') {
    throw new Error('base64 encoding not yet supported')
  }
  else
    throw new Error(enc +' encoding not yet supported')
}

//always fill to the end!
function zeroFill(buf, from) {
  for(var i = from; i < buf.length; i++)
    buf[i] = 0
}


},{}],328:[function(require,module,exports){
(function (Buffer){
// JavaScript PBKDF2 Implementation
// Based on http://git.io/qsv2zw
// Licensed under LGPL v3
// Copyright (c) 2013 jduncanator

var blocksize = 64
var zeroBuffer = new Buffer(blocksize); zeroBuffer.fill(0)

module.exports = function (createHmac, exports) {
  exports = exports || {}

  exports.pbkdf2 = function(password, salt, iterations, keylen, cb) {
    if('function' !== typeof cb)
      throw new Error('No callback provided to pbkdf2');
    setTimeout(function () {
      cb(null, exports.pbkdf2Sync(password, salt, iterations, keylen))
    })
  }

  exports.pbkdf2Sync = function(key, salt, iterations, keylen) {
    if('number' !== typeof iterations)
      throw new TypeError('Iterations not a number')
    if(iterations < 0)
      throw new TypeError('Bad iterations')
    if('number' !== typeof keylen)
      throw new TypeError('Key length not a number')
    if(keylen < 0)
      throw new TypeError('Bad key length')

    //stretch key to the correct length that hmac wants it,
    //otherwise this will happen every time hmac is called
    //twice per iteration.
    var key = !Buffer.isBuffer(key) ? new Buffer(key) : key

    if(key.length > blocksize) {
      key = createHash(alg).update(key).digest()
    } else if(key.length < blocksize) {
      key = Buffer.concat([key, zeroBuffer], blocksize)
    }

    var HMAC;
    var cplen, p = 0, i = 1, itmp = new Buffer(4), digtmp;
    var out = new Buffer(keylen);
    out.fill(0);
    while(keylen) {
      if(keylen > 20)
        cplen = 20;
      else
        cplen = keylen;

      /* We are unlikely to ever use more than 256 blocks (5120 bits!)
         * but just in case...
         */
        itmp[0] = (i >> 24) & 0xff;
        itmp[1] = (i >> 16) & 0xff;
          itmp[2] = (i >> 8) & 0xff;
          itmp[3] = i & 0xff;

          HMAC = createHmac('sha1', key);
          HMAC.update(salt)
          HMAC.update(itmp);
        digtmp = HMAC.digest();
        digtmp.copy(out, p, 0, cplen);

        for(var j = 1; j < iterations; j++) {
          HMAC = createHmac('sha1', key);
          HMAC.update(digtmp);
          digtmp = HMAC.digest();
          for(var k = 0; k < cplen; k++) {
            out[k] ^= digtmp[k];
          }
        }
      keylen -= cplen;
      i++;
      p += cplen;
    }

    return out;
  }

  return exports
}

}).call(this,require("buffer").Buffer)
},{"buffer":314}],329:[function(require,module,exports){
(function (Buffer){
(function() {
  module.exports = function(size) {
    var bytes = new Buffer(size); //in browserify, this is an extended Uint8Array
    /* This will not work in older browsers.
     * See https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
     */
    crypto.getRandomValues(bytes);
    return bytes;
  }
}())

}).call(this,require("buffer").Buffer)
},{"buffer":314}],330:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],331:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],332:[function(require,module,exports){
module.exports=require(312)
},{}],333:[function(require,module,exports){
module.exports=require(313)
},{"./support/isBuffer":332,"_process":331,"inherits":330}]},{},[296])(296)
});