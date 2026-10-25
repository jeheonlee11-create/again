/* again — pure logic shared by the page (app.js) and the tests (tests/*.test.js).
   Nothing in this file touches the DOM, localStorage or the clock directly:
   the store and "now" are always passed in, so every function can run under `node --test`. */

export var DAY = 864e5;
export var WEEK = 7 * DAY;
export var TIERS = ["yes", "maybe", "no"];

/* ================================================================ STORE SHAPE */

export function blankStore() {
  return {
    v: SCHEMA_VERSION,
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

export var STORE_KEY = "again.v3";
export var LEGACY_KEY = "again.rotation.v2";
export var SCHEMA_VERSION = 3;

function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
function arr(x) { return Array.isArray(x) ? x : []; }

/* Repair a parsed store into the shape the app expects, without dropping user data.
   Returns null when the value is not recognisably an `again` store.
   - fills in any missing top-level fields (older v3 saves lack some)
   - drops meals without an id or name, and order entries that point at no meal
   - de-duplicates ids that ended up in two bands (first band wins)
   - puts any meal missing from every band back into one (its last answer, else "yes"),
     so no meal silently disappears from the ranking */
export function normalizeStore(v) {
  if (!isObj(v) || !Array.isArray(v.meals)) return null;
  var s = blankStore();
  s.household = isObj(v.household) && typeof v.household.name === "string"
    ? { name: v.household.name, members: arr(v.household.members).filter(function (m) { return typeof m === "string" && m.trim(); }) }
    : null;
  if (s.household && !s.household.members.length) s.household.members = ["You"];

  var seen = {};
  s.meals = v.meals.filter(function (m) {
    if (!isObj(m) || typeof m.id !== "string" || typeof m.name !== "string" || !m.name.trim() || seen[m.id]) return false;
    seen[m.id] = true;
    return true;
  }).map(function (m) {
    return { id: m.id, name: m.name, url: typeof m.url === "string" ? m.url : "", thumb: m.thumb || null,
      timeMins: typeof m.timeMins === "number" ? m.timeMins : null, effort: m.effort || null,
      tags: arr(m.tags), createdAt: typeof m.createdAt === "number" ? m.createdAt : 0, mods: typeof m.mods === "string" ? m.mods : "" };
  });

  s.events = arr(v.events).filter(function (e) {
    return isObj(e) && typeof e.mealId === "string" && typeof e.ts === "number";
  }).map(function (e) {
    return { mealId: e.mealId, ts: e.ts, ate: arr(e.ate), reactions: isObj(e.reactions) ? e.reactions : {},
      note: typeof e.note === "string" ? e.note : "", again: e.again || null };
  });
  s.comparisons = arr(v.comparisons).filter(isObj);
  s.saved = arr(v.saved).filter(function (x) { return isObj(x) && typeof x.id === "string" && typeof x.title === "string"; });
  s.analytics = arr(v.analytics).filter(isObj).slice(-400);
  s.fb = isObj(v.fb) ? { shown: isObj(v.fb.shown) ? v.fb.shown : {}, answers: isObj(v.fb.answers) ? v.fb.answers : {} } : s.fb;

  var placed = {};
  var order = isObj(v.order) ? v.order : {};
  TIERS.forEach(function (t) {
    s.order[t] = arr(order[t]).filter(function (id) {
      if (!seen[id] || placed[id]) return false;
      placed[id] = true;
      return true;
    });
  });
  s.meals.forEach(function (m) {
    if (placed[m.id]) return;
    var last = s.events.filter(function (e) { return e.mealId === m.id; })
      .sort(function (a, b) { return b.ts - a.ts; })[0];
    var tier = last && TIERS.indexOf(last.again) >= 0 ? last.again : "yes";
    s.order[tier].push(m.id);
    placed[m.id] = true;
  });
  s.v = SCHEMA_VERSION;
  return s;
}

/* Load the store from a Storage-like object ({getItem,setItem}).
   If the saved value can't be read, it is copied to a backup key *before* anything can
   overwrite it, and `notice` tells the UI to say so. */
export function readStore(storage, now) {
  var raw = null;
  try { raw = storage.getItem(STORE_KEY); } catch (e) { return { store: blankStore(), notice: "unavailable" }; }
  if (raw) {
    var parsed = null;
    try { parsed = normalizeStore(JSON.parse(raw)); } catch (e) { parsed = null; }
    if (parsed) return { store: parsed, notice: null };
    var backupKey = STORE_KEY + ".unreadable-" + now;
    try { storage.setItem(backupKey, raw); }
    catch (e) { return { store: blankStore(), notice: "unreadable", backupKey: null }; }
    return { store: blankStore(), notice: "unreadable", backupKey: backupKey };
  }
  try {
    var legacy = migrateV2(JSON.parse(storage.getItem(LEGACY_KEY) || "null"), now);
    if (legacy) return { store: normalizeStore(legacy), notice: "migrated" };
  } catch (e) {}
  return { store: blankStore(), notice: null };
}

/* Returns true when the write landed. localStorage throws when the ~5 MB quota is full;
   the caller must tell the user instead of carrying on as if it saved. */
export function writeStore(storage, store) {
  try { storage.setItem(STORE_KEY, JSON.stringify(store)); return true; }
  catch (e) { return false; }
}

export function exportStore(store, now) {
  return JSON.stringify({ app: "again", schema: SCHEMA_VERSION, exportedAt: new Date(now).toISOString(), data: store }, null, 1);
}

/* Parse a file produced by exportStore (or a raw store). Throws an Error with a readable message. */
export function importStore(text) {
  var v;
  try { v = JSON.parse(text); } catch (e) { throw new Error("That file isn't valid JSON."); }
  var data = isObj(v) && v.app === "again" ? v.data : v;
  var s = normalizeStore(data);
  if (!s) throw new Error("That file isn't an again export.");
  return s;
}

export function uid() {
  return "m" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/* best-effort migration from the pre-pivot store (`again.rotation.v2`, an array of dishes) */
export function migrateV2(rot, now, makeId) {
  if (!Array.isArray(rot)) return null;
  rot = rot.filter(function (d) { return d && typeof d.name === "string" && d.name.trim(); });
  if (!rot.length) return null;
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

/* ================================================================ RANKING: BINARY INSERTION
   A band is an array of meal ids, best first. A new (or moved) meal is placed by asking
   "which would you rather make again?" against the middle of the range it could still be in,
   halving that range each time. Placing into a band of n meals takes at most
   ceil(log2(n + 1)) answers (e.g. 4 for 10 meals, 7 for 100), versus up to n when you
   walk down the list one by one.

   The state is a plain object so it can live in UI state between taps:
     { id, others, lo, hi, steps, done }
   `others` is the band without the meal; the meal belongs somewhere in others[lo..hi].
   Until the search finishes, the meal sits at index `hi` (bottom of its possible range),
   so stopping early ("Skip" or leaving the screen) never ranks it higher than the answers support. */

export function maxComparisons(n) { return n <= 0 ? 0 : Math.ceil(Math.log2(n + 1)); }

export function startInsertion(band, id) {
  var others = band.filter(function (x) { return x !== id; });
  return { id: id, others: others, lo: 0, hi: others.length, steps: 0, done: others.length === 0 };
}

/* the meal to compare against next, or null when placement is finished */
export function opponent(ins) {
  return ins.done ? null : ins.others[(ins.lo + ins.hi) >> 1];
}

/* result is from the placed meal's side: "a" = it wins, "b" = the opponent wins,
   "same" = about equal (goes directly below the opponent), "skip" = stop asking */
export function answer(ins, result) {
  if (ins.done) return ins;
  var mid = (ins.lo + ins.hi) >> 1;
  var next = { id: ins.id, others: ins.others, lo: ins.lo, hi: ins.hi, steps: ins.steps + 1, done: false };
  if (result === "a") next.hi = mid;
  else if (result === "b") next.lo = mid + 1;
  else if (result === "same") { next.lo = mid + 1; next.hi = mid + 1; }
  else { next.steps = ins.steps; next.done = true; return next; }
  if (next.lo >= next.hi) next.done = true;
  return next;
}

/* the band with the meal at its current best-supported position */
export function placed(ins) {
  var out = ins.others.slice();
  out.splice(ins.hi, 0, ins.id);
  return out;
}

/* Apply an insertion to the band as it is *now*. If the band changed underneath the
   insertion (e.g. another tab added a meal), leave the order alone rather than risk
   dropping or duplicating anything. */
export function applyInsertion(band, ins) {
  var others = band.filter(function (x) { return x !== ins.id; });
  var same = others.length === ins.others.length &&
    others.every(function (x, i) { return x === ins.others[i]; });
  if (!same) return band.indexOf(ins.id) >= 0 ? band.slice() : band.concat([ins.id]);
  return placed(ins);
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

/* Recipe links are free text. Only http(s) links are ever rendered as an href, so a pasted
   "javascript:..." or "data:..." link cannot run script when tapped. Bare "www." / "example.com/x"
   links get https:// added. Returns "" when the value should not be linked. */
export function safeUrl(raw) {
  var s = String(raw == null ? "" : raw).trim();
  if (!s) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    if (!/^[^\s/]+\.[^\s/]+/.test(s)) return "";
    s = "https://" + s.replace(/^\/+/, "");
  }
  try {
    var u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch (e) { return ""; }
}

/* Photos are stored as JPEG data URLs made by a canvas; anything else is not rendered. */
export function safeImageSrc(raw) {
  var s = String(raw == null ? "" : raw);
  return /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(s) ? s : "";
}
