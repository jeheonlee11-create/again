import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../core.js";
import { NOW, storeWith } from "./helpers.js";

var DAY = core.DAY;

test("orderedIds ranks yes, then maybe, then no", function () {
  var S = storeWith([{ id: "a", tier: "no" }, { id: "b", tier: "maybe" }, { id: "c" }, { id: "d" }]);
  assert.deepEqual(core.orderedIds(S), ["c", "d", "b", "a"]);
  assert.equal(core.rankOf(S, "c"), 1);
  assert.equal(core.rankOf(S, "a"), 4);
  assert.equal(core.rankOf(S, "missing"), 0);
});

test("eventsOf is newest first and drives reps / last cooked", function () {
  var S = storeWith([{ id: "a", reps: 3, daysAgo: 2 }]);
  var evs = core.eventsOf(S, "a");
  assert.equal(evs.length, 3);
  assert.ok(evs[0].ts > evs[1].ts && evs[1].ts > evs[2].ts);
  assert.equal(core.repsOf(S, "a"), 3);
  assert.equal(core.lastTsOf(S, "a"), NOW - 2 * DAY);
});

test("mealByName matches case- and whitespace-insensitively", function () {
  var S = storeWith([{ id: "a", name: "Cacio e Pepe" }]);
  assert.equal(core.mealByName(S, "  cacio E pepe ").id, "a");
  assert.equal(core.mealByName(S, "cacio"), null);
});

test("everyoneOK needs every current member to have eaten it and nobody to say never", function () {
  var S = storeWith([
    { id: "all", reactions: { You: "loved", Sam: "fine" } },
    { id: "never", reactions: { You: "loved", Sam: "never" } },
    { id: "partial", ate: ["You"] }
  ], { members: ["You", "Sam"] });
  assert.equal(core.everyoneOK(S, "all"), true);
  assert.equal(core.everyoneOK(S, "never"), false);
  assert.equal(core.everyoneOK(S, "partial"), false);
});

test("labelOf maps tier, history and effort to a plain-language label", function () {
  var S = storeWith([
    { id: "staple", reps: 4 },
    { id: "repeat", reps: 1 },
    { id: "occasion", effort: "involved" },
    { id: "maybe", tier: "maybe" },
    { id: "retired", tier: "no" }
  ]);
  assert.equal(core.labelOf(S, "staple").k, "staple");
  assert.equal(core.labelOf(S, "repeat").k, "repeat");
  assert.equal(core.labelOf(S, "occasion").k, "occasion");
  assert.equal(core.labelOf(S, "maybe").k, "mixed");
  assert.equal(core.labelOf(S, "retired").k, "retired");
});

test("ago produces friendly relative dates", function () {
  assert.equal(core.ago(null, NOW), "never");
  assert.equal(core.ago(NOW, NOW), "today");
  assert.equal(core.ago(NOW - DAY, NOW), "yesterday");
  assert.equal(core.ago(NOW - 3 * DAY, NOW), "3 days ago");
  assert.equal(core.ago(NOW - 7 * DAY, NOW), "last week");
  assert.equal(core.ago(NOW - 21 * DAY, NOW), "3 weeks ago");
  assert.equal(core.ago(NOW - 90 * DAY, NOW), "3 months ago");
});

test("streakWeeks counts consecutive cooking weeks and tolerates an empty current week", function () {
  var ev = function (d) { return { ts: NOW - d * DAY }; };
  assert.equal(core.streakWeeks([], NOW), 0);
  assert.equal(core.streakWeeks([ev(1), ev(8), ev(15)], NOW), 3);
  assert.equal(core.streakWeeks([ev(8), ev(15)], NOW), 2);   // nothing this week yet
  assert.equal(core.streakWeeks([ev(1), ev(15)], NOW), 1);   // gap breaks it
  assert.equal(core.streakWeeks([ev(20)], NOW), 0);
});

test("recQuick picks the best-ranked quick or easy meal, never a retired one", function () {
  var S = storeWith([
    { id: "slow" , timeMins: 90 },
    { id: "quick", timeMins: 20 },
    { id: "easy", effort: "easy" },
    { id: "retiredQuick", tier: "no", timeMins: 10 }
  ]);
  assert.equal(core.recQuick(S, null), "quick");
  assert.equal(core.recQuick(S, "quick"), "easy");
  var S2 = storeWith([{ id: "slow", timeMins: 90 }]);
  assert.equal(core.recQuick(S2, null), null);
});

test("recNew prefers the saved queue, then a meal cooked only once", function () {
  var S = storeWith([{ id: "a", reps: 3 }, { id: "b", reps: 1 }]);
  assert.deepEqual(core.recNew(S), { meal: "b" });
  S.saved.push({ id: "s1", title: "Birria", url: "", from: "you", status: "queued" });
  assert.equal(core.recNew(S).saved.id, "s1");
});

test("whyFor explains a suggestion in at most four reasons", function () {
  var S = storeWith([{ id: "a", reps: 5, daysAgo: 30, timeMins: 25, reactions: { You: "loved" } }]);
  var why = core.whyFor(S, "a", NOW);
  assert.ok(why.length <= 4);
  assert.ok(why.indexOf("Everyone liked it last time") >= 0);
  assert.ok(why.indexOf("Takes 25 min") >= 0);
});

test("migrateV2 turns the old rotation array into a v3 store without losing dishes", function () {
  var n = 0;
  var s = core.migrateV2([
    { name: "Tacos", tier: "yes", reps: 3, lastTs: NOW - DAY },
    { name: "Soup", tier: "maybe" },
    { name: "Liver", tier: "no" }
  ], NOW, function () { return "id" + (n++); });
  assert.equal(s.meals.length, 3);
  assert.deepEqual(s.order, { yes: ["id0"], maybe: ["id1"], no: ["id2"] });
  assert.equal(core.repsOf(s, "id0"), 3);
  assert.equal(core.lastTsOf(s, "id0"), NOW - DAY);
  assert.equal(core.migrateV2([], NOW), null);
  assert.equal(core.migrateV2(null, NOW), null);
});

test("esc neutralises HTML in user-entered names", function () {
  assert.equal(core.esc('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(core.esc("Tom's & Jerry's"), "Tom&#39;s &amp; Jerry&#39;s");
  assert.equal(core.esc(null), "");
});

test("safeUrl only lets http(s) links through", function () {
  assert.equal(core.safeUrl("https://cooking.example/recipe?id=1"), "https://cooking.example/recipe?id=1");
  assert.equal(core.safeUrl("http://example.com"), "http://example.com/");
  assert.equal(core.safeUrl("www.example.com/soup"), "https://www.example.com/soup");
  assert.equal(core.safeUrl("example.com"), "https://example.com/");
  assert.equal(core.safeUrl("javascript:alert(1)"), "");
  assert.equal(core.safeUrl(" JavaScript:alert(document.cookie)"), "");
  assert.equal(core.safeUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(core.safeUrl("vbscript:msgbox"), "");
  assert.equal(core.safeUrl("grandma's notebook"), "");
  assert.equal(core.safeUrl(""), "");
});

test("safeImageSrc only accepts image data URLs", function () {
  assert.equal(core.safeImageSrc("data:image/jpeg;base64,/9j/4AAQ=="), "data:image/jpeg;base64,/9j/4AAQ==");
  assert.equal(core.safeImageSrc('x" onerror="alert(1)'), "");
  assert.equal(core.safeImageSrc("https://tracker.example/pixel.gif"), "");
  assert.equal(core.safeImageSrc(null), "");
});
