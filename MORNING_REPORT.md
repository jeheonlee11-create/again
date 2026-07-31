# Again — Morning Report

**Core promise:** Remember what your household actually liked and always know what to cook next.
**Core loop:** Cook → log → compare → rank → recommend → cook again.

## 1. Public URL

**Not deployed — external blocker.** The machine has no authenticated Vercel session (the CLI printed a device-auth prompt that was never completed; there is no token in `~/.vercel`). Signing in requires your account and cannot be done for you.

The project is fully deployment-ready as a static site. To deploy:

```bash
cd "/Users/jeheonlee/Documents/Claude Code/again" && npx vercel login && npx vercel --prod --yes
```

(First command opens browser auth; second deploys and prints the public URL. No build step — it's a static directory.)

## 2. What works

Everything in the definition of done except the public URL:

1. ✅ First-time onboarding (name household → members → 3 meals → 2 comparisons → ranked list → first suggestion)
2. ✅ Add three household meals during onboarding
3. ✅ Initial ranking via pairwise comparisons (win / lose / about-the-same / skip all handled)
4. ✅ Ranked rotation with natural labels (Household staple / Worth repeating / Mixed response / Special occasion / Retired) — no fake 9.4 scores as the primary signal
5. ✅ Log a new meal (type name → who ate → would-you-make-it-again → save; optional photo/URL/note/time/effort behind a disclosure)
6. ✅ Repeat cook logs a new cook event — never a duplicate meal; repeat count and last-cooked update
7. ✅ Who-ate + lightweight reactions (Loved it / Fine / Not again), optional, on the confirmation screen
8. ✅ Complete, tie, or skip comparisons (placement after new meals, "Refine rankings" on Rotation)
9. ✅ Three transparent recommendations with human-readable reasons; graceful states with little history
10. ✅ Meal detail (hero/monogram, rank, repeat count, last reactions, source link, modifications, cook history, Cooked-it-again)
11. ✅ Save a recipe to try later (name or URL)
12. ✅ Saved recipe graduates to cooked history when logged
13. ✅ Reload without data loss (all state in localStorage under `again.v3`, saved on every mutation)
14. ✅ PWA: manifest, service worker (cache-first, offline after first https load), icons, safe-area insets
15. ⛔ Public Vercel URL — blocked on your login (one command, above)

## 3. Main user flows tested

Tap counts measured by driving the real UI:

- **Couple after work:** Tonight → "Cooked this tonight" → Yes → Save = **3 taps**, who-ate preselected from last time
- **Tired parent, new meal:** + → type name → Add → Yes → Save = **4 taps + typing**; placement matchup after is optional/skippable
- **New user:** onboarding start → first recommendation in ~60 seconds (2 text fields, 3 meal names, 2 comparisons)

## 4. Tests and checks performed

See PRODUCT_TEST.md for the full checklist. Summary: 320px / 375px / 1280px widths, reload persistence, empty states, duplicate-name prevention, tied and skipped comparisons, long names with special characters (escaped, no overflow), keyboard focus + Enter/Escape paths, zero console errors, `node --check` on all JS. No lint/type/test infrastructure exists in this repo (static zero-build stack) — nothing else to run.

## 5. Files changed

- `index.html` — full rewrite: teal editorial design system, 5-destination nav, all screens
- `app.js` — full rewrite: v3 data model, ranking, recommendations, onboarding, analytics
- `sw.js` — cache version bump (v4)
- `manifest.webmanifest` — palette update
- `icon.svg`, `icon-180.png`, `icon-512.png` — rebrand (serif "a." on dark teal)
- `pitch.html` — earlier investor-style pitch page, kept as-is (reachable only by URL)
- `MORNING_REPORT.md`, `PRODUCT_TEST.md` — this report and the test log

Git history: pre-rebuild snapshot at `d5e18b8`, final state committed on `main`.

## 6. Data storage

Single localStorage key `again.v3`: `household {name, members[]}`, `meals[]` (persistent items), `events[]` (one per cook — repeat cooking appends events), `comparisons[]`, `saved[]`, `order {yes/maybe/no}` (ranking as ordered id lists), `analytics[]` (ring buffer, console sink, swappable abstraction in `track()`), `fb` (feedback prompts shown/answers). Best-effort migration from the previous `again.rotation.v2` format. All data is device-local; no server.

## 7. Known limitations

- **Household sync is device-local.** The invite link sets up the household name on the invitee's device; each device keeps its own log. The UI says this honestly. Real sync needs a backend.
- Recipe URL import stores link + hostname only — no scraping (by design, per spec).
- The service worker only activates over https (so: after deploy, not on localhost/file).
- Photos are stored as small compressed thumbnails in localStorage (~15KB each); hundreds of photos would eventually hit the ~5MB quota.
- Comparisons refine only the "yes" band via Refine; maybe/no bands order by recency of placement.

## 8. Bugs remaining

None known. Three found during QA, all fixed and re-verified: household name lost when adding a member mid-onboarding; onboarding step 2 preempted by the Tonight fallback state; bottom nav visible at desktop widths (CSS cascade).

## 9. Intentionally deferred

Social feed, friend graph, match percentages, streak gamification beyond one quiet line, wrapped/annual stats, shopping list, grocery/affiliate anything, nutritional data, AI features, native iOS, subscriptions. The earlier requested marketing demo video was superseded by your later spec (interactive onboarding instead of video; "do not spend the night on promotional sections") — say the word if you still want it.

## 10. Run locally

```bash
cd "/Users/jeheonlee/Documents/Claude Code/again" && python3 -m http.server 4173
```

Then open http://localhost:4173. (Any static server works.)

## 11. Redeploy

Same as deploy: `npx vercel --prod --yes` from the project directory (after one-time `npx vercel login`).

## 12. Five highest-priority next tasks

1. **Real household sync** — smallest viable backend (e.g. one KV namespace keyed by household id) so an invite actually shares one log across devices. This is the product's biggest honest gap.
2. **Recommendation quality loop** — "not tonight / show another" action on rec cards, feeding back into the engine; currently the three slots are static per render.
3. **Comparison scheduling** — track per-pair uncertainty and surface Refine only when it will actually change the order; cap at one prompt per session.
4. **Recipe URL metadata** — fetch page title + og:image on save so Saved items and meal tiles get real names/photos without a full import system.
5. **Beta analytics review** — wire `track()` to a real sink (Plausible/PostHog), then read the three validation questions' answers against the funnel events they instrument.
