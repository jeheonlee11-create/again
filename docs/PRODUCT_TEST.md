# Again — Product Test Log

All tests driven through the real UI in a Chromium browser against `http://localhost:4173`, mobile viewport unless noted. Every row re-verified after its fix where one was needed.

## Onboarding (new user, no history)

| Test | Result |
|---|---|
| Fresh load with empty localStorage shows onboarding, not an empty app | ✅ |
| Household name survives adding a member mid-form | ✅ (fixed: input listener; was wiped by re-render) |
| Member chips: add via button and Enter; remove non-You members | ✅ |
| Step 2 reached after step 1 (not the "add meals" fallback) | ✅ (fixed: onboarding guard) |
| "Rank them" disabled until 3 meals; label counts remaining | ✅ |
| Duel 1 orders first two meals correctly (B-win verified) | ✅ |
| Duel 2 places third meal (about-the-same → middle slot verified) | ✅ |
| Skip on either duel still produces a complete ranking | ✅ (skip → end of band) |
| Step 4 shows ranked list + first suggestion with reasons | ✅ |
| "Explore with demo data instead" loads a full household | ✅ |
| First recommendation reachable in ~60s from cold start | ✅ |

## Logging

| Test | Result |
|---|---|
| Repeat cook from Tonight rec card: 3 taps (Cooked this → Yes → Save) | ✅ |
| Repeat cook creates a new event, not a duplicate meal (meals 3→3, events 3→4) | ✅ |
| Repeat count and last-cooked update after repeat | ✅ (2×, "today") |
| Who-ate chips preselected from the meal's last event | ✅ |
| New meal: search shows "Add" row only when no exact match exists | ✅ |
| Exact existing name (case-insensitive) routes to the existing meal | ✅ |
| New meal via + tab: 4 taps + typing | ✅ |
| Save disabled until the again-question is answered | ✅ |
| Optional details (photo, URL, note, time, effort) collapsed by default; none required | ✅ |
| Reactions on confirm screen write to the just-created event | ✅ |
| Reaction buttons toggle (tap again to clear) | ✅ |
| Placement duel offered for new meals only when the band has a peer | ✅ |
| Placement duel: win moves above anchor (verified order change) | ✅ |
| Placement duel: skip leaves order unchanged | ✅ |
| Cancel from the context step returns to search cleanly | ✅ |

## Rotation & ranking

| Test | Result |
|---|---|
| Rows show rank, monogram/thumb, times cooked, last cooked, natural label | ✅ |
| No numeric score presented as primary signal | ✅ |
| Views: Best overall / Weeknight / Quick / Low effort / Household favorites / Special occasion | ✅ (empty views explain how to populate) |
| Refine rankings: adjacent-pair duel; tie keeps order; B-win swaps | ✅ |
| Long meal name with quotes, ampersand, `<secret>` renders escaped, wraps, no overflow at 320px | ✅ |

## Tonight

| Test | Result |
|---|---|
| Three slots: Reliable favorite / Quick option / Something new | ✅ |
| Every populated card lists human-readable reasons | ✅ |
| Quick slot with no timed meals: honest empty card, no fake rec | ✅ |
| Something-new pulls from Saved queue first | ✅ |
| <3 meals: onboarding-style CTA state instead of recs | ✅ |
| recommendation_viewed / recommendation_selected events fire | ✅ |

## Saved

| Test | Result |
|---|---|
| Add by name; add button disabled when empty | ✅ |
| URL input creates hostname-labeled item | ✅ |
| "Cooked it" flows into logging prefilled | ✅ |
| Status flips to cooked and item moves to "Already tried" after logging | ✅ |
| Remove works | ✅ |

## Household

| Test | Result |
|---|---|
| Members add/remove ("You" not removable) | ✅ |
| Adding a member correctly empties "What everyone will eat" until they've eaten | ✅ |
| Invite: share sheet where supported, clipboard fallback, honest device-local wording | ✅ |
| Share ranked list: text export of top 10 with repeat counts | ✅ |
| Start over wipes state and returns to onboarding | ✅ |

## Meal detail

| Test | Result |
|---|---|
| Opens from any row; Back and Escape both close; focus moves to Back | ✅ |
| Shows rank, repeat count, last-made, label, last reactions, history with who ate | ✅ |
| Modifications note persists on close | ✅ |
| "Cooked it again" flows into logging prefilled | ✅ |

## Platform

| Test | Result |
|---|---|
| 320px: no horizontal scroll anywhere exercised | ✅ |
| 375×812: primary target, all flows | ✅ |
| 1280px: top nav shown, bottom nav hidden, centered column | ✅ (fixed: cascade bug had bottom nav visible) |
| Reload persistence: household, meals, events, comparisons, saved, analytics all survive | ✅ |
| Zero console errors across every flow above | ✅ |
| `node --check` on app.js and sw.js | ✅ |
| Feedback card triggers: 3rd meal logged, first rec selected; answer stores + hides | ✅ |
| Analytics taxonomy observed: onboarding_started/completed, meal_logged, repeat_cook_logged, comparison_completed/skipped, recommendation_viewed/selected, saved_recipe_added, household_invite_sent, feedback_answered | ✅ |

## Not testable in this environment

| Test | Why |
|---|---|
| Service worker / offline | Only registers over https; verify after deploy |
| navigator.share sheet | Desktop Chromium falls back to clipboard (fallback verified) |
| Real iOS home-screen install | Requires deployed https URL on a device |
