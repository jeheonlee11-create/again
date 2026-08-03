# Reddit Launch Kit — again

---

## 1. r/SideProject — Text Post

**Title:**
I got tired of the "what should we make tonight" argument, so I built an app that asks one question after you cook — "would you make it again?" — and ranks your household's real dinner rotation

**Body:**

Recipe-site star ratings are broken for deciding what to cook. Everything is 4.7 stars, because the only people who rate a recipe are the ones who already wanted to make it. That tells you nothing about whether *your* household will eat it twice.

So I built **again**. The whole mechanic:

- After you cook, it asks one question: **would you make it again?**
- Occasionally it asks a head-to-head: "Which would you rather make again — the tacos or the lentil soup?" Forced choice. No fence-sitting, no stars anywhere in the product.
- Those answers build a ranked rotation of what your household actually likes, not what looked good when you saved it.
- The Tonight screen gives you 3 suggestions and shows its work: "Everyone liked it · takes 25 min · not made in 6 weeks."
- Logging a repeat meal is 3 taps.

Honest notes, because I'd rather you hear them from me:

- It's a beta, built by one person (me).
- Your data is stored on your device only. Privacy upside; the tradeoff is no sync yet. A household invite carries your household's setup to another device, but logs don't sync between devices.
- It's a PWA, not an App Store app — "install" means add to home screen.
- No AI, no account, no signup, free.

There's an **"Explore with demo data"** button on the first screen, so you can see the whole product in about 10 seconds without logging anything.

Link: https://again-app.higgsfield.app

Feedback I'd especially value: if you cook at home most nights, is the one-question mechanic enough signal, or does it need more? And is the Tonight screen's reasoning actually useful or just decoration?

---

## 2. r/InternetIsBeautiful — Link-Post Title Options

1. A site that learns what your household actually likes to eat by asking one question after dinner — "would you make it again?" — then tells you what to cook tonight, with reasons. Free, no signup, works instantly.

2. Recipe star ratings are useless (everything is 4.7), so this site ranks your own dinners with head-to-head matchups instead — "which would you rather make again?" No account needed; a demo-data button shows the whole thing in 10 seconds.

3. again — log what you cooked, answer "would you make it again?", and it builds your household's real ranked dinner rotation and suggests tonight's meal with transparent reasons. No signup, data stays on your device.

---

## 3. Cooking-Sub Weekly-Thread Blurb (r/MealPrepSunday, r/EatCheapAndHealthy)

Something that got us out of a months-long planning rut: after dinner, we answer exactly one question — would we make this again? — and once in a while pick between two past meals head-to-head. A few weeks of that produced an honest ranked list of our actual rotation, which turned out to be about 12 meals, not the 60 recipes we had saved. Now when it's 5pm and nobody has an opinion, we pull from the top of the list instead of scrolling recipe sites where everything is rated 4.7 stars by people who were already excited to make it. The forced yes/no is the useful part — star ratings just made us give everything a 4. Disclosure: I'm the solo maker of the little free app we use for this (again-app.higgsfield.app — no signup, data stays on your device), but honestly the habit works in a notes app too.

---

## 4. Reply Drafts for Predictable Comments

### "Why is there no sync?"

Fair hit — it's the biggest limitation right now. Local-only storage was the fastest way to ship something private and free without running accounts and a server, but I know a shared dinner list that doesn't sync between two phones is missing part of the point. The household invite currently carries your setup (household name, members) to another device; logs don't follow yet. Sync is at the top of the roadmap, and I'd rather do it properly than bolt on something leaky. In the meantime the honest workaround is one designated "logging phone" per household — clunky, but it's what my own household does.

### "Why isn't this an App Store app?"

Solo maker math. A PWA lets me ship fixes the same day instead of waiting on review, works on iPhone and Android from one codebase, and keeps the app free without pressure to monetize around a 30% cut. The tradeoffs are real: "add to home screen" is clunkier than an install button, and discoverability is worse. Once installed it behaves like a normal app — icon, full screen, and your data is on-device either way. If the product earns it, a native app isn't ruled out; it's just not where a one-person beta should spend its time.

### "How is this different from Paprika / Pepper / Beli?"

Different job. Paprika is a recipe manager — a filing cabinet for recipes you might make, and it's good at that. Pepper is social recipe sharing. Beli is head-to-head ranking, but for restaurants. again is closest in spirit to Beli, pointed at home cooking, and it's built around one decision: what should we make tonight. It barely stores recipes at all — it tracks what you actually cooked, whether your household would make it again, and uses that to recommend, with the reasoning shown ("everyone liked it · 25 min · not made in 6 weeks"). It works fine alongside Paprika: Paprika holds the recipe, again knows whether anyone wants it twice.

### "Is my data private?"

Yes, in the bluntest way available: it never leaves your device. There's no account, no signup, and no server holding your meal logs — everything is stored locally. I couldn't read your dinner history if I wanted to. The honest flip side is that this is also why there's no sync yet: your logs live on that device, so during the beta treat it accordingly. Privacy here isn't a policy promise you have to trust, it's an architecture — there's simply nothing on my end to leak.

### "Will you add AI?"

No plans, and I'm a bit stubborn about it. The whole premise is that your household's actual answers — a forced yes/no after a real dinner — are a better signal than any model's guess about what you'd like. The recommendations are transparent rules you can read on the screen ("everyone liked it, takes 25 min, not made in 6 weeks"), and I'd rather keep it a system you can predict than a black box that's occasionally impressive. If some future feature genuinely needs it, I'll say so plainly at the time. "AI-powered" as a marketing line is not on the roadmap.
