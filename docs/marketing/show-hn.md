**Title:** Show HN: again – rank your home cooking with pairwise choices instead of stars

**URL:** https://again-app.higgsfield.app

**Body:**

My household has the "what should we make tonight" argument roughly three times a week, so I built a small tool around a single post-dinner question: would you make this again? That, plus occasional head-to-head matchups ("which would you rather make again?"), produces a ranked rotation of what you actually like cooking — not what you bookmarked once. A Tonight screen suggests three options and shows its reasoning ("everyone liked it · takes 25 min · not made in 6 weeks"). Logging a repeat meal is three taps, and there's an "explore with demo data" button if you want to see it working before entering anything.

Technically it's as boring as I could make it: vanilla JS PWA, no framework, no backend. Everything lives in localStorage, which is a privacy feature and an honest limitation — nothing syncs yet. The household invite gets your household set up on a second device, but each device keeps its own logs. Ranking is binary insertion: when a dish earns its first "yes," it's placed into your existing order via O(log n) pairwise matchups rather than by asking for a score. There are no stars anywhere in the product. Free, no signup, and "install" means add-to-home-screen, since it's a PWA rather than an App Store app. Beta, built solo.

**First comment (from the maker):**

Maker here. The reason there are no stars anywhere: recipe-site ratings are broken by selection bias. The only people who rate a recipe are the ones who already wanted to make it, and they mostly rate after it went fine, so everything converges on ~4.7 and the number carries almost no information. A forced choice between two dishes you've actually cooked can't inflate — one of them has to lose. That's the entire premise.

One known limitation, stated plainly: binary insertion trusts each answer. Preferences aren't reliably transitive — you'll answer the same matchup differently depending on the weather and what you had for lunch — so one off answer can slot a dish into the wrong place, and it stays wrong until a later matchup happens to involve it. I resurface occasional matchups to correct for this, but correction is slow on purpose; nobody wants a nightly quiz. If you know a cheap approach to noisy pairwise ranking that doesn't turn into homework, I'd genuinely like to hear it.
