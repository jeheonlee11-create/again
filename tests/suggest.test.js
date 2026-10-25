import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../core.js";
import { NOW, storeWith } from "./helpers.js";

test("reliable favorite is never last night's dinner when something else qualifies", function () {
  var S = storeWith([
    { id: "staple", reps: 10, daysAgo: 1 },   // cooked yesterday, otherwise the top score
    { id: "other", reps: 3, daysAgo: 20 }
  ]);
  assert.equal(core.recReliable(S, NOW), "other");
});

test("reliable favorite falls back to a recent meal when it is the only candidate", function () {
  var S = storeWith([{ id: "only", reps: 3, daysAgo: 0 }]);
  assert.equal(core.recReliable(S, NOW), "only");
});

test("with equal history, the meal you ranked higher is suggested", function () {
  var S = storeWith([{ id: "second", reps: 3, daysAgo: 14 }, { id: "first", reps: 3, daysAgo: 14 }]);
  S.order.yes = ["first", "second"];
  assert.equal(core.recReliable(S, NOW), "first");
  S.order.yes = ["second", "first"];
  assert.equal(core.recReliable(S, NOW), "second");
});

test("reliable favorite only comes from the yes band and prefers meals cooked twice", function () {
  var S = storeWith([
    { id: "maybe", tier: "maybe", reps: 9, daysAgo: 30 },
    { id: "retired", tier: "no", reps: 9, daysAgo: 30 },
    { id: "once", reps: 1, daysAgo: 40 },
    { id: "twice", reps: 2, daysAgo: 10 }
  ]);
  S.order.yes = ["once", "twice"];
  assert.equal(core.recReliable(S, NOW), "twice");
  assert.equal(core.recReliable(storeWith([{ id: "m", tier: "maybe" }]), NOW), null);
});

test("reliableScore adds up the four documented signals", function () {
  var S = storeWith([{ id: "a", reps: 2, daysAgo: 14, reactions: {} }, { id: "b" }]);
  // rank #1 of 2 → 6; 2 cooks → 4; everyone (just "You") ate it → 6; 14 days → 2
  assert.equal(core.reliableScore(S, "a", NOW), 6 + 4 + 6 + 2);
});

test("quick option skips a meal cooked in the last few days", function () {
  var S = storeWith([
    { id: "quickRecent", timeMins: 20, daysAgo: 1 },
    { id: "quickOld", timeMins: 25, daysAgo: 9 }
  ]);
  assert.equal(core.recQuick(S, null, NOW), "quickOld");
});

test("something new does not repeat a meal already shown in another card", function () {
  var S = storeWith([{ id: "a", reps: 1 }, { id: "b", reps: 1 }]);
  assert.deepEqual(core.recNew(S, []), { meal: "b" });
  assert.deepEqual(core.recNew(S, ["b"]), { meal: "a" });
  assert.equal(core.recNew(S, ["a", "b"]), null);
});
