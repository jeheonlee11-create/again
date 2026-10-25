import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../core.js";

/* Drive an insertion with an oracle that knows the "true" preference order.
   rank[id] lower = better. Returns { band, steps }. */
function insertWithOracle(band, id, rank) {
  var ins = core.startInsertion(band.concat([id]), id);
  while (!ins.done) {
    var opp = core.opponent(ins);
    ins = core.answer(ins, rank[id] < rank[opp] ? "a" : "b");
  }
  return { band: core.placed(ins), steps: ins.steps };
}

function shuffled(n, seed) {
  var a = [], x = seed;
  for (var i = 0; i < n; i++) a.push("m" + i);
  for (var j = n - 1; j > 0; j--) {
    x = (x * 1103515245 + 12345) % 2147483648;      // tiny deterministic LCG
    var k = x % (j + 1), t = a[j]; a[j] = a[k]; a[k] = t;
  }
  return a;
}

test("binary insertion places a meal exactly where the answers say", function () {
  var band = ["a", "b", "c", "d", "e"];
  var rank = { a: 0, b: 1, c: 2, x: 2.5, d: 3, e: 4 };
  assert.deepEqual(insertWithOracle(band, "x", rank).band, ["a", "b", "c", "x", "d", "e"]);
  rank.x = -1;
  assert.deepEqual(insertWithOracle(band, "x", rank).band, ["x", "a", "b", "c", "d", "e"]);
  rank.x = 9;
  assert.deepEqual(insertWithOracle(band, "x", rank).band, ["a", "b", "c", "d", "e", "x"]);
});

test("repeated insertion fully sorts random meal lists (onboarding builds a ranking this way)", function () {
  for (var seed = 1; seed <= 30; seed++) {
    var n = 1 + (seed % 25);
    var items = shuffled(n, seed), rank = {};
    items.forEach(function (id) { rank[id] = Number(id.slice(1)); });
    var band = [];
    items.forEach(function (id) { band = insertWithOracle(band, id, rank).band; });
    var expected = items.slice().sort(function (p, q) { return rank[p] - rank[q]; });
    assert.deepEqual(band, expected, "seed " + seed);
  }
});

test("worst case is ceil(log2(n+1)) comparisons, checked at every possible position", function () {
  var table = {};
  for (var n = 0; n <= 128; n++) {
    var band = [], rank = {};
    for (var i = 0; i < n; i++) { band.push("m" + i); rank["m" + i] = i; }
    var worst = 0, total = 0;
    for (var pos = 0; pos <= n; pos++) {          // the new meal truly belongs at `pos`
      rank.x = pos - 0.5;
      var r = insertWithOracle(band, "x", rank);
      assert.equal(r.band.indexOf("x"), pos);
      worst = Math.max(worst, r.steps);
      total += r.steps;
    }
    assert.equal(worst, core.maxComparisons(n), "n=" + n);
    table[n] = { worst: worst, avg: total / (n + 1) };
  }
  // Figures quoted in the README's Results section.
  assert.deepEqual([5, 10, 20, 50, 100].map(function (n) { return table[n].worst; }), [3, 4, 5, 6, 7]);
  assert.deepEqual([5, 10, 20, 50, 100].map(function (n) { return Math.round(table[n].avg * 10) / 10; }),
    [2.7, 3.5, 4.5, 5.7, 6.7]);
});

test("'same' puts the meal directly below the meal it tied with and stops", function () {
  var ins = core.startInsertion(["a", "b", "c", "d", "x"], "x");
  assert.equal(core.opponent(ins), "c");
  ins = core.answer(ins, "same");
  assert.equal(ins.done, true);
  assert.deepEqual(core.placed(ins), ["a", "b", "c", "x", "d"]);
});

test("'skip' stops early and leaves the meal at the bottom of its possible range", function () {
  var ins = core.startInsertion(["a", "b", "c", "d", "x"], "x");
  ins = core.answer(ins, "a");                       // beat "c" → somewhere in a..c
  assert.deepEqual(core.placed(ins), ["a", "b", "x", "c", "d"]);
  ins = core.answer(ins, "skip");
  assert.equal(ins.done, true);
  assert.equal(ins.steps, 1);
  assert.deepEqual(core.placed(ins), ["a", "b", "x", "c", "d"]);
});

test("a meal alone in its band needs no comparisons", function () {
  var ins = core.startInsertion(["x"], "x");
  assert.equal(ins.done, true);
  assert.equal(core.opponent(ins), null);
  assert.deepEqual(core.placed(ins), ["x"]);
});

test("answering after done is a no-op", function () {
  var ins = core.answer(core.startInsertion(["a", "x"], "x"), "b");
  assert.equal(ins.done, true);
  assert.deepEqual(core.answer(ins, "a"), ins);
});

test("applyInsertion never drops or duplicates meals when the band changed meanwhile", function () {
  var ins = core.answer(core.startInsertion(["a", "b", "c", "x"], "x"), "a");
  assert.deepEqual(core.applyInsertion(["a", "b", "c", "x"], ins), ["a", "x", "b", "c"]);
  // another tab added "d" in the meantime
  var changed = core.applyInsertion(["a", "b", "c", "d", "x"], ins);
  assert.deepEqual(changed.slice().sort(), ["a", "b", "c", "d", "x"]);
  // the meal vanished from the band (e.g. moved by another tab): it is put back, once
  assert.deepEqual(core.applyInsertion(["a", "b"], ins), ["a", "b", "x"]);
});
