/* Small builders for test stores. Not a test file itself (no .test.js suffix). */
import { blankStore, DAY } from "../core.js";

export var NOW = Date.UTC(2026, 9, 1, 18, 0, 0); // fixed clock: 2026-10-01 18:00 UTC

/* meals: [{id, name, tier, reps, daysAgo, timeMins, effort, ate, reactions}] */
export function storeWith(meals, opts) {
  opts = opts || {};
  var S = blankStore();
  S.household = { name: "Test house", members: opts.members || ["You"] };
  meals.forEach(function (d) {
    S.meals.push({ id: d.id, name: d.name || d.id, url: "", thumb: null,
      timeMins: d.timeMins || null, effort: d.effort || null, tags: [], createdAt: NOW - 100 * DAY, mods: "" });
    S.order[d.tier || "yes"].push(d.id);
    var reps = d.reps == null ? 1 : d.reps;
    for (var i = 0; i < reps; i++) {
      S.events.push({ mealId: d.id, ts: NOW - ((d.daysAgo == null ? 10 : d.daysAgo) + i * 7) * DAY,
        ate: d.ate || S.household.members.slice(), reactions: i === 0 ? (d.reactions || {}) : {},
        note: "", again: d.tier || "yes" });
    }
  });
  return S;
}
