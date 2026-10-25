/* again — pure logic shared by the page (app.js) and the tests (tests/*.test.js).
   Nothing in this file touches the DOM, localStorage or the clock directly:
   the store and "now" are always passed in, so every function can run under `node --test`. */

export var DAY = 864e5;
export var WEEK = 7 * DAY;
export var TIERS = ["yes", "maybe", "no"];

/* ================================================================ STORE SHAPE */

export function blankStore() {
  return {
    household: null,                 // {name, members:[names]} — null → onboarding
    meals: [],                       // {id,name,url,thumb,timeMins,effort,tags[],createdAt,mods}
    events: [],                      // {mealId,ts,ate[],reactions{},note,again}
    comparisons: [],                 // {a,b,result:'a'|'b'|'same'|'skip',ts}
    saved: [],                       // {id,title,url,from,status:'queued'|'cooked'}
    order: { yes: [], maybe: [], no: [] },
    analytics: [],
    fb: { shown: {}, answers: {} }
  };
}

export function uid() {
  return "m" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/* best-effort migration from the pre-pivot store (`again.rotation.v2`, an array of dishes) */
export function migrateV2(rot, now, makeId) {
  if (!Array.isArray(rot) || !rot.length) return null;
  makeId = makeId || uid;
  var s = blankStore();
  s.household = { name: "Our household", members: ["You"] };
  rot.forEach(function (d) {
    var id = makeId();
    s.meals.push({ id: id, name: d.name, url: "", thumb: d.thumb || null,
      timeMins: null, effort: null, tags: d.tags || [], createdAt: now, mods: d.mods || "" });
    var tier = d.tier === "no" ? "no" : (d.tier === "maybe" ? "maybe" : "yes");
    s.order[tier].push(id);
    var n = Math.max(1, d.reps || 1);
    for (var i = 0; i < n; i++) {
      s.events.push({ mealId: id, ts: (d.lastTs || now) - i * 9 * DAY,
        ate: ["You"], reactions: {}, note: "", again: tier });
    }
  });
  return s;
}

/* ================================================================ DERIVED */

export function mealById(S, id) { return S.meals.filter(function (m) { return m.id === id; })[0] || null; }

export function mealByName(S, name) {
  var q = String(name).trim().toLowerCase();
  return S.meals.filter(function (m) { return m.name.trim().toLowerCase() === q; })[0] || null;
}

/* newest first */
export function eventsOf(S, id) {
  return S.events.filter(function (e) { return e.mealId === id; })
    .sort(function (a, b) { return b.ts - a.ts; });
}
export function repsOf(S, id) { return eventsOf(S, id).length; }
export function lastEvent(S, id) { return eventsOf(S, id)[0] || null; }
export function lastTsOf(S, id) { var e = lastEvent(S, id); return e ? e.ts : null; }

export function tierOf(S, id) {
  for (var i = 0; i < TIERS.length; i++) if (S.order[TIERS[i]].indexOf(id) >= 0) return TIERS[i];
  return null;
}

/* the whole ranking, best first: yes band, then maybe, then no */
export function orderedIds(S) { return S.order.yes.concat(S.order.maybe, S.order.no); }
export function rankOf(S, id) { return orderedIds(S).indexOf(id) + 1; }

export function members(S) { return (S.household && S.household.members) || ["You"]; }

/* everyone currently in the household ate it last time and nobody said "not again" */
export function everyoneOK(S, id) {
  var e = lastEvent(S, id);
  if (!e) return false;
  var ms = members(S);
  var allAte = ms.every(function (m) { return e.ate.indexOf(m) >= 0; });
  var noNever = ms.every(function (m) { return e.reactions[m] !== "never"; });
  return allAte && noNever;
}

export function hasNever(S, id) {
  var e = lastEvent(S, id);
  if (!e) return false;
  return Object.keys(e.reactions).some(function (k) { return e.reactions[k] === "never"; });
}

export function labelOf(S, id) {
  var t = tierOf(S, id);
  if (t === "no") return { k: "retired", txt: "Retired" };
  if (t === "yes" && repsOf(S, id) >= 4 && everyoneOK(S, id)) return { k: "staple", txt: "Household staple" };
  var m = mealById(S, id);
  if (t === "yes" && m && m.effort === "involved") return { k: "occasion", txt: "Special occasion" };
  if (t === "maybe" || hasNever(S, id)) return { k: "mixed", txt: "Mixed response" };
  if (t === "yes") return { k: "repeat", txt: "Worth repeating" };
  return { k: "mixed", txt: "Unranked" };
}

export function ago(ts, now) {
  if (!ts) return "never";
  var days = Math.round((now - ts) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return days + " days ago";
  if (days < 60) { var w = Math.round(days / 7); return w === 1 ? "last week" : w + " weeks ago"; }
  var mo = Math.round(days / 30); return mo === 1 ? "last month" : mo + " months ago";
}

/* consecutive rolling 7-day windows with at least one cook, counting back from this week
   (or last week, so the streak doesn't vanish the moment a new week starts) */
export function streakWeeks(events, now) {
  if (!events.length) return 0;
  var weeks = {};
  events.forEach(function (e) { weeks[Math.floor((now - e.ts) / WEEK)] = true; });
  var start = weeks[0] ? 0 : (weeks[1] ? 1 : -1);
  if (start < 0) return 0;
  var n = 0, w = start;
  while (weeks[w]) { n++; w++; }
  return n;
}

/* ================================================================ SUGGESTIONS */

export function recReliable(S, now) {
  var pool = S.order.yes.filter(function (id) { return repsOf(S, id) >= 2; });
  if (!pool.length) pool = S.order.yes.slice();
  if (!pool.length) return null;
  var scored = pool.map(function (id) {
    var last = lastTsOf(S, id);
    var days = last ? (now - last) / DAY : 30;
    return { id: id, s: Math.min(repsOf(S, id), 10) * 2 + (everyoneOK(S, id) ? 6 : 0) + Math.min(days, 56) / 7 };
  }).sort(function (a, b) { return b.s - a.s; });
  return scored[0].id;
}

export function recQuick(S, excl) {
  var pool = orderedIds(S).filter(function (id) {
    if (id === excl || tierOf(S, id) === "no") return false;
    var m = mealById(S, id);
    return (m.timeMins && m.timeMins <= 30) || m.effort === "easy";
  });
  return pool[0] || null;
}

export function recNew(S) {
  var q = S.saved.filter(function (s) { return s.status === "queued"; })[0];
  if (q) return { saved: q };
  var once = orderedIds(S).filter(function (id) { return repsOf(S, id) === 1 && tierOf(S, id) !== "no"; });
  if (once.length) return { meal: once[once.length - 1] };
  return null;
}

/* the human-readable reasons shown under a suggestion */
export function whyFor(S, id, now) {
  var out = [], m = mealById(S, id), reps = repsOf(S, id), last = lastTsOf(S, id);
  if (everyoneOK(S, id)) out.push("Everyone liked it last time");
  if (reps >= 4 && labelOf(S, id).k === "staple") out.push("A household staple");
  if (reps > 1) out.push("Cooked " + reps + "×");
  if (m.timeMins) out.push("Takes " + m.timeMins + " min");
  if (last && now - last > 3 * WEEK) out.push("Not made in " + ago(last, now).replace(" ago", ""));
  else if (last) out.push("Last made " + ago(last, now));
  return out.slice(0, 4);
}

/* ================================================================ OUTPUT SAFETY */

/* escape for HTML text and double-quoted attribute values */
export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
