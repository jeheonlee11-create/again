import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../core.js";
import { NOW, storeWith } from "./helpers.js";

/* in-memory stand-in for window.localStorage */
function fakeStorage(init, quotaBytes) {
  var data = Object.assign({}, init || {});
  return {
    data: data,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) {
      if (quotaBytes != null && String(v).length > quotaBytes) {
        var err = new Error("QuotaExceededError"); err.name = "QuotaExceededError"; throw err;
      }
      data[k] = String(v);
    },
    removeItem: function (k) { delete data[k]; }
  };
}

test("readStore round-trips what writeStore saved", function () {
  var ls = fakeStorage();
  var S = storeWith([{ id: "a" }, { id: "b", tier: "maybe" }]);
  assert.equal(core.writeStore(ls, S), true);
  var back = core.readStore(ls, NOW);
  assert.equal(back.notice, null);
  assert.deepEqual(back.store.order, S.order);
  assert.equal(back.store.meals.length, 2);
  assert.equal(back.store.v, core.SCHEMA_VERSION);
});

test("an unreadable save is backed up before anything can overwrite it", function () {
  var ls = fakeStorage({ "again.v3": "{not json" });
  var r = core.readStore(ls, NOW);
  assert.equal(r.notice, "unreadable");
  assert.equal(r.backupKey, "again.v3.unreadable-" + NOW);
  assert.equal(ls.data[r.backupKey], "{not json");
  assert.equal(r.store.meals.length, 0);
});

test("if the backup itself can't be written, readStore reports no backup key", function () {
  var ls = fakeStorage({ "again.v3": "[1,2,3]" }, 0);
  var r = core.readStore(ls, NOW);
  assert.equal(r.notice, "unreadable");
  assert.equal(r.backupKey, null);
  assert.equal(ls.data["again.v3"], "[1,2,3]"); // original untouched
});

test("writeStore reports a full quota instead of failing silently", function () {
  var ls = fakeStorage({}, 10);
  assert.equal(core.writeStore(ls, storeWith([{ id: "a" }])), false);
});

test("readStore migrates the legacy v2 rotation when there is no v3 save", function () {
  var ls = fakeStorage({ "again.rotation.v2": JSON.stringify([{ name: "Tacos", tier: "yes" }, { name: "" }, null]) });
  var r = core.readStore(ls, NOW);
  assert.equal(r.notice, "migrated");
  assert.equal(r.store.meals.length, 1);
  assert.equal(r.store.meals[0].name, "Tacos");
  assert.equal(ls.data["again.rotation.v2"] != null, true); // legacy data left in place
});

test("normalizeStore fills fields missing from older saves", function () {
  var s = core.normalizeStore({ meals: [{ id: "a", name: "Soup" }], order: { yes: ["a"] } });
  assert.deepEqual(s.order, { yes: ["a"], maybe: [], no: [] });
  assert.deepEqual(s.saved, []);
  assert.deepEqual(s.analytics, []);
  assert.deepEqual(s.fb, { shown: {}, answers: {} });
  assert.equal(s.household, null);
});

test("normalizeStore never drops a meal from the ranking", function () {
  var s = core.normalizeStore({
    meals: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "bad" }],
    events: [{ mealId: "c", ts: 5, again: "no" }],
    order: { yes: ["a", "ghost", "a"], maybe: ["a"], no: [] }
  });
  assert.deepEqual(s.meals.map(function (m) { return m.id; }), ["a", "b", "c"]);
  assert.deepEqual(s.order, { yes: ["a", "b"], maybe: [], no: ["c"] });
  var all = core.orderedIds(s);
  assert.equal(new Set(all).size, all.length);
});

test("normalizeStore rejects things that aren't a store", function () {
  assert.equal(core.normalizeStore(null), null);
  assert.equal(core.normalizeStore([1, 2]), null);
  assert.equal(core.normalizeStore({ household: {} }), null);
});

test("export then import gives back the same meals, events and ranking", function () {
  var S = storeWith([{ id: "a", reps: 3 }, { id: "b", tier: "no" }], { members: ["You", "Sam"] });
  var back = core.importStore(core.exportStore(S, NOW));
  assert.deepEqual(back.order, S.order);
  assert.deepEqual(back.meals, S.meals);
  assert.equal(back.events.length, S.events.length);
  assert.deepEqual(back.household, S.household);
});

test("importStore explains bad files", function () {
  assert.throws(function () { core.importStore("nope"); }, /valid JSON/);
  assert.throws(function () { core.importStore('{"app":"other"}'); }, /again export/);
});
