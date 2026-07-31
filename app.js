/* again — app logic. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var K_ROT = "again.rotation.v2";
  var K_WANT = "again.want.v2";
  var K_LOG = "again.cooklog.v2";
  var K_LIST = "again.shoplist.v1";

  var DAY = 864e5, WEEK = 7 * DAY;

  /* ================= data ================= */

  var BANDS = {
    yes:   { lo: 7.0, hi: 10.0, label: "Would make again" },
    maybe: { lo: 4.0, hi: 6.9,  label: "On the fence" },
    no:    { lo: 0.0, hi: 3.9,  label: "Not making that twice" }
  };
  var TIER_ORDER = ["yes", "maybe", "no"];
  var HOUSEHOLD = ["You", "Sam", "The kids"];

  function d(name, src, occ, tier, reps, extra) {
    var base = {
      name: name, src: src, occ: occ, tier: tier, reps: reps,
      cuisine: "", tags: [], hh: [], mods: "", thumb: null,
      lastTs: Date.now() - 3 * DAY,
      hist: []
    };
    Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
    if (!base.hist.length) {
      for (var i = 0; i < reps; i++) base.hist.push(base.lastTs - i * 9 * DAY);
    }
    return base;
  }

  var SEED = [
    d("Marcella's tomato, butter and onion sauce", "NYT Cooking", "weeknight", "yes", 11,
      { cuisine: "Italian", tags: ["quick", "cheap"], hh: ["You", "Sam", "The kids"], lastTs: Date.now() - 2 * DAY, mods: "Half the butter. Nobody has ever noticed." }),
    d("Cast-iron pan pizza", "Serious Eats", "project", "yes", 6,
      { cuisine: "Italian", tags: [], hh: ["You", "Sam", "The kids"], lastTs: Date.now() - 6 * DAY }),
    d("Gochujang buttered noodles", "NYT Cooking", "weeknight", "yes", 9,
      { cuisine: "Korean", tags: ["quick"], hh: ["You", "Sam"], lastTs: Date.now() - 4 * DAY, mods: "Extra butter, scallions from the garden." }),
    d("Sheet-pan chicken thighs with lemon", "Mine", "weeknight", "yes", 14,
      { cuisine: "American", tags: ["quick", "cheap", "healthy"], hh: ["You", "Sam", "The kids"], lastTs: Date.now() - 1 * DAY }),
    d("Roasted cauliflower with tahini", "Ottolenghi", "hosting", "yes", 4,
      { cuisine: "Middle Eastern", tags: ["healthy"], hh: ["You", "Sam"], lastTs: Date.now() - 12 * DAY }),
    d("Green chile mac", "TikTok", "weeknight", "yes", 3,
      { cuisine: "Tex-Mex", tags: ["quick", "cheap"], hh: ["You", "The kids"], lastTs: Date.now() - 9 * DAY }),
    d("Ragù bolognese", "Marcella Hazan", "project", "yes", 2,
      { cuisine: "Italian", tags: [], hh: ["You", "Sam", "The kids"], lastTs: Date.now() - 20 * DAY }),
    d("Shrimp scampi", "Mom", "weeknight", "yes", 5,
      { cuisine: "Italian", tags: ["quick"], hh: ["You", "Sam"], lastTs: Date.now() - 8 * DAY }),
    d("Miso-glazed salmon", "TikTok", "weeknight", "maybe", 3,
      { cuisine: "Japanese", tags: ["quick", "healthy"], hh: ["You"], lastTs: Date.now() - 15 * DAY }),
    d("Braised short ribs", "NYT Cooking", "hosting", "maybe", 1,
      { cuisine: "French", tags: [], hh: ["You", "Sam"], lastTs: Date.now() - 30 * DAY }),
    d("Cacio e pepe", "Improvised", "weeknight", "maybe", 4,
      { cuisine: "Italian", tags: ["quick", "cheap"], hh: ["You"], lastTs: Date.now() - 11 * DAY, mods: "Broke twice out of four. Technique, not recipe." }),
    d("Air-fryer salmon bites", "TikTok", "weeknight", "maybe", 1,
      { cuisine: "American", tags: ["quick", "healthy"], hh: ["You", "The kids"], lastTs: Date.now() - 25 * DAY })
  ];

  var SEED_WANT = [
    { name: "Marry-me chicken", src: "TikTok", occ: "weeknight", from: "Nadia" },
    { name: "Weeknight red lentil soup", src: "NYT Cooking", occ: "weeknight", from: "Trending" },
    { name: "Birria tacos", src: "YouTube", occ: "project", from: "Theo" },
    { name: "Salt-crust branzino", src: "Cookbook", occ: "hosting", from: "Priya" }
  ];

  var FRIENDS = [
    { who: "Nadia", init: "NK",
      table: { "Gochujang buttered noodles": 9.0, "Cacio e pepe": 8.9, "Sheet-pan chicken thighs with lemon": 8.1, "Miso-glazed salmon": 6.2 },
      feed: [
        { dish: "Gochujang buttered noodles", src: "NYT Cooking", score: 9.0, when: "2h", occ: "weeknight", move: "Moved to #4 on her list", reps: 6 },
        { dish: "Cacio e pepe", src: "Improvised", score: 8.9, when: "3d", occ: "weeknight", reps: 3 }
      ] },
    { who: "Theo", init: "TM",
      table: { "Cast-iron pan pizza": 9.6, "Ragù bolognese": 8.8, "Green chile mac": 5.4 },
      feed: [
        { dish: "Cast-iron pan pizza", src: "Serious Eats", score: 9.6, when: "Yesterday", occ: "project", move: "Still #1 after 11 cooks", reps: 11 }
      ] },
    { who: "Priya", init: "PR",
      table: { "Salt-crust branzino": 8.7, "Roasted cauliflower with tahini": 8.9, "Braised short ribs": 7.6 },
      feed: [
        { dish: "Salt-crust branzino", src: "Cookbook", score: 8.7, when: "Yesterday", occ: "hosting", move: "New at #6", reps: 1 }
      ] }
  ];

  var GOAL = { label: "New dishes in 2026", target: 50 };

  function seedCookLog() {
    var now = Date.now(), out = [], w, i, perWeek = [3, 2, 3, 2, 2, 2];
    for (w = 0; w < perWeek.length; w++) {
      for (i = 0; i < perWeek[w]; i++) out.push(now - w * WEEK - (i + 1) * 1.1 * DAY);
    }
    for (w = 8; w < 20; w += 2) out.push(now - w * WEEK - 2 * DAY);
    return out;
  }

  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }

  function save(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }

  var rotation = (load(K_ROT) || SEED.map(function (x) { return Object.assign({}, x); }))
    .filter(function (x) { return x && typeof x.name === "string" && BANDS[x.tier]; });
  var wantList = load(K_WANT) || SEED_WANT.map(function (x) { return Object.assign({}, x); });
  var cookLog = load(K_LOG) || seedCookLog();
  var shopList = load(K_LIST) || [];

  function persist() { save(K_ROT, rotation); save(K_WANT, wantList); save(K_LOG, cookLog); save(K_LIST, shopList); }

  /* ================= model helpers ================= */

  function tierItems(t) { return rotation.filter(function (x) { return x.tier === t; }); }

  function bandScore(band, i, n) {
    var span = band.hi - band.lo;
    var hi = band.hi - span * 0.04;
    var lo = band.lo + span * 0.06;
    if (n <= 1) return lo + (hi - lo) * 0.72;
    return hi - (i / (n - 1)) * (hi - lo);
  }

  function scoreOf(x) {
    var items = tierItems(x.tier);
    return bandScore(BANDS[x.tier], items.indexOf(x), items.length);
  }

  var fmt = function (n) { return n.toFixed(1); };

  function totalCooks() { return rotation.reduce(function (a, x) { return a + (x.reps || 1); }, 0); }

  function findDish(name) {
    var q = String(name).toLowerCase();
    return rotation.filter(function (x) { return x.name.toLowerCase() === q; })[0] || null;
  }

  function streakWeeks() {
    if (!cookLog.length) return 0;
    var now = Date.now(), weeks = {};
    cookLog.forEach(function (ts) { weeks[Math.floor((now - ts) / WEEK)] = true; });
    var start = weeks[0] ? 0 : (weeks[1] ? 1 : -1);
    if (start < 0) return 0;
    var n = 0, w = start;
    while (weeks[w]) { n++; w++; }
    return n;
  }

  function matchPct(friend) {
    var diffs = [];
    Object.keys(friend.table).forEach(function (name) {
      var mine = findDish(name);
      if (mine) diffs.push(Math.abs(friend.table[name] - scoreOf(mine)));
    });
    if (!diffs.length) return null;
    var avg = diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length;
    return Math.max(0, Math.min(100, Math.round(100 - avg * 10)));
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function ago(ts) {
    var days = Math.round((Date.now() - ts) / DAY);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return days + "d ago";
    if (days < 30) return Math.round(days / 7) + "w ago";
    return Math.round(days / 30) + "mo ago";
  }

  function dateShort(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ================= shared components ================= */

  function tile(x, size) {
    var initial = esc((x.name || "?").trim().charAt(0));
    if (x.thumb) return '<span class="tile tile-' + size + '"><img src="' + x.thumb + '" alt=""></span>';
    return '<span class="tile tile-' + size + '" aria-hidden="true">' + initial + "</span>";
  }

  function hhScore(x) {
    if (!x.hh || !x.hh.length) return null;
    return x.hh.length + "/" + HOUSEHOLD.length;
  }

  function mealRow(x) {
    var overall = rotation.indexOf(x) + 1;
    var hh = hhScore(x);
    return '<button class="mrow' + (overall <= 3 ? " top3" : "") +
      (x.name === st.fresh ? " fresh" : "") + '" data-detail="' + esc(x.name) + '">' +
      '<span class="rank">' + overall + "</span>" +
      tile(x, "sm") +
      "<span><span class=\"name\">" + esc(x.name) + "</span>" +
      '<span class="meta2"><span>' + (x.reps || 1) + "× cooked</span>" +
      "<span>" + ago(x.lastTs || Date.now()) + "</span>" +
      (hh ? '<span class="hh">' + hh + " household</span>" : "") +
      "</span></span>" +
      '<span class="score">' + fmt(scoreOf(x)) + "</span></button>";
  }

  function emptyState(title, body, cta) {
    return '<div class="empty"><span class="brand">' + title + "</span><p>" + body + "</p>" +
      (cta ? '<button class="btn btn-primary btn-sm" data-tab-go="log">' + cta + "</button>" : "") + "</div>";
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("on"); }, 2200);
  }

  /* ================= state ================= */

  var st = {
    tab: "home",
    filter: "all",
    fresh: null,
    wantDraft: "",
    homeLoaded: false,
    log: null
  };

  function newLog() {
    return { step: "pick", draft: "", url: "", occ: "weeknight", tags: [], hh: ["You"], mods: "",
             thumb: null, dish: null, tier: null, lo: 0, hi: 0, seen: 0, est: 1, skips: 0 };
  }
  st.log = newLog();

  /* ================= HOME ================= */

  function skeletonFeed() {
    var one = '<div class="card fcard skel" aria-hidden="true">' +
      '<div class="fhead"><span class="sk" style="width:28px;height:28px;border-radius:50%"></span>' +
      '<span class="sk" style="width:120px;height:12px"></span></div>' +
      '<div class="fbody"><span class="sk" style="width:44px;height:44px"></span>' +
      '<span style="flex:1"><span class="sk" style="display:block;width:70%;height:13px;margin-bottom:6px"></span>' +
      '<span class="sk" style="display:block;width:40%;height:11px"></span></span></div></div>';
    return '<div class="feed">' + one + one + one + "</div>";
  }

  function renderHome() {
    var el = $("screen-home");

    if (!st.homeLoaded) {
      el.innerHTML = '<div class="shead"><h2>This week</h2></div>' + skeletonFeed();
      setTimeout(function () {
        st.homeLoaded = true;
        if (st.tab === "home") renderHome();
      }, 350);
      return;
    }

    var sk = streakWeeks();
    var html = "";

    /* your own latest movement */
    var mine = st.fresh ? findDish(st.fresh) : null;
    html += '<div class="shead"><h2>This week</h2><span class="sub">' +
      (sk > 0 ? sk + "-week streak" : "no streak yet") + "</span></div>";

    html += '<div class="feed">';

    if (mine) {
      html += '<div class="card fcard">' +
        '<div class="fhead"><span class="avatar">You</span><span class="who"><b>You</b> cooked</span>' +
        "<time>" + ago(mine.lastTs) + "</time></div>" +
        '<div class="fbody">' + tile(mine, "md") +
        "<span><span class=\"name\">" + esc(mine.name) + '</span><div class="src">' + esc(mine.src) + "</div></span></div>" +
        '<div class="badges"><span class="badge badge-move">Moved to #' + (rotation.indexOf(mine) + 1) + "</span>" +
        '<span class="badge badge-rep">Cooked ' + (mine.reps || 1) + "×</span></div></div>";
    }

    FRIENDS.forEach(function (f) {
      f.feed.forEach(function (item, ii) {
        var have = findDish(item.dish);
        var inWant = wantList.some(function (w) { return w.name.toLowerCase() === item.dish.toLowerCase(); });
        html += '<div class="card fcard">' +
          '<div class="fhead"><span class="avatar">' + f.init + "</span>" +
          '<span class="who"><b>' + f.who + "</b> cooked</span><time>" + item.when + "</time></div>" +
          '<div class="fbody">' + tile({ name: item.dish }, "md") +
          "<span><span class=\"name\">" + esc(item.dish) + '</span><div class="src">' +
          esc(item.src) + " · " + item.occ + "</div></span></div>" +
          '<div class="badges">' +
          (item.move ? '<span class="badge badge-move">' + esc(item.move) + "</span>" : "") +
          '<span class="badge badge-rep">Cooked ' + item.reps + "×</span>" +
          (have ? '<span class="badge badge-plain">On your list at ' + fmt(scoreOf(have)) + "</span>" : "") +
          "</div>" +
          (!have && !inWant
            ? '<div class="factions"><button class="btn btn-secondary btn-sm" data-savefeed="' +
              esc(f.who) + ":" + ii + '">Save to cook</button></div>'
            : (!have && inWant ? '<div class="factions"><span class="badge badge-plain">Saved to your queue</span></div>' : "")) +
          "</div>";
      });
    });

    html += "</div>";
    el.innerHTML = html;
  }

  /* ================= RANKINGS ================= */

  var FILTERS = [
    { k: "all", label: "Overall" },
    { k: "weeknight", label: "Weeknight" },
    { k: "quick", label: "Quick" },
    { k: "cheap", label: "Cheap" },
    { k: "healthy", label: "Healthy" },
    { k: "fav", label: "Household favorites" }
  ];

  function passesFilter(x) {
    if (st.filter === "all") return true;
    if (st.filter === "weeknight") return x.occ === "weeknight";
    if (st.filter === "fav") return (x.hh || []).length >= HOUSEHOLD.length;
    return (x.tags || []).indexOf(st.filter) >= 0;
  }

  function renderRankings() {
    var el = $("screen-rankings");
    var html = '<div class="chiprow" role="group" aria-label="Filters">' +
      FILTERS.map(function (f) {
        return '<button class="chip" data-filter="' + f.k + '" aria-pressed="' + (st.filter === f.k) + '">' + f.label + "</button>";
      }).join("") + "</div>";

    var shown = 0;
    TIER_ORDER.forEach(function (t) {
      var items = tierItems(t).filter(passesFilter);
      if (!items.length) return;
      html += '<div class="shead"><h2>' + BANDS[t].label + '</h2><span class="sub">' +
        fmt(BANDS[t].lo) + " – " + fmt(BANDS[t].hi) + "</span></div>";
      html += items.map(mealRow).join("");
      shown += items.length;
    });

    if (!shown) html += emptyState("nothing here yet", "No dishes match this filter. Cook something and log it.", "Log a meal");
    el.innerHTML = html;
  }

  /* ================= QUEUE ================= */

  function renderQueue() {
    var el = $("screen-queue");
    var html = '<div class="shead"><h2>To cook</h2><span class="sub">' + wantList.length + " saved</span></div>";
    html += '<div class="pagepad" style="padding-top:4px;padding-bottom:12px;display:flex;gap:8px">' +
      '<input class="field" id="want-draft" placeholder="Save something to cook later" value="' + esc(st.wantDraft) + '" autocomplete="off" enterkeyhint="done" style="flex:1">' +
      '<button class="btn btn-secondary" id="want-add"' + (st.wantDraft.trim() ? "" : " disabled") + ">Save</button></div>";

    if (!wantList.length) {
      html += emptyState("an empty queue", "Save dishes from your friends&rsquo; cooking on Home, or type one above.");
    } else {
      html += wantList.map(function (w, i) {
        return '<div class="mrow" style="cursor:default">' +
          '<span class="rank" style="font-size:13px">·</span>' +
          tile({ name: w.name }, "sm") +
          "<span><span class=\"name\">" + esc(w.name) + "</span>" +
          '<span class="meta2"><span>' + esc(w.src) + "</span><span>" + w.occ + "</span><span>from " + esc(w.from) + "</span></span></span>" +
          '<span style="display:flex;gap:6px">' +
          '<button class="btn btn-primary btn-sm" data-cookwant="' + i + '">Cooked it</button>' +
          '<button class="btn btn-quiet btn-sm" data-dropwant="' + i + '" aria-label="Remove ' + esc(w.name) + '">✕</button></span></div>';
      }).join("");
    }
    el.innerHTML = html;
  }

  /* ================= LOG FLOW ================= */

  function renderLog() {
    var L = st.log, el = $("screen-log"), html = "";

    if (L.step === "pick") {
      html = '<div class="flow">' +
        '<div class="step">Log a meal</div>' +
        "<h2>What did you cook?</h2>" +
        '<p class="lede">Name it, or paste a recipe link. No review to write — one question and a couple of taps.</p>' +

        '<div class="fgroup"><input class="field" id="draft" placeholder="e.g. marry-me chicken" value="' + esc(L.draft) + '" autocomplete="off" enterkeyhint="next"></div>' +
        '<div class="fgroup"><input class="field" id="url" inputmode="url" placeholder="Recipe link (optional)" value="' + esc(L.url) + '" autocomplete="off"></div>' +

        '<div class="fgroup"><label>Photo (optional)</label>' +
        '<button class="photobtn" id="photo-pick" type="button">' +
        (L.thumb ? '<img src="' + L.thumb + '" alt="">Photo added — tap to replace' : "Add a photo of the plate") +
        '</button><input type="file" id="photo-file" accept="image/*" hidden></div>' +

        '<div class="fgroup"><label>What kind of cook was it?</label><div class="chiprow">' +
        [["weeknight", "Weeknight"], ["project", "Project"], ["hosting", "Hosting"]].map(function (o) {
          return '<button class="chip" data-occ="' + o[0] + '" aria-pressed="' + (L.occ === o[0]) + '">' + o[1] + "</button>";
        }).join("") + "</div></div>" +

        '<div class="fgroup"><label>Tags</label><div class="chiprow">' +
        [["quick", "Quick"], ["cheap", "Cheap"], ["healthy", "Healthy"]].map(function (o) {
          return '<button class="chip" data-tag="' + o[0] + '" aria-pressed="' + (L.tags.indexOf(o[0]) >= 0) + '">' + o[1] + "</button>";
        }).join("") + "</div></div>" +

        '<div class="fgroup"><label>Who ate it?</label><div class="chiprow">' +
        HOUSEHOLD.map(function (m) {
          return '<button class="chip" data-hh="' + m + '" aria-pressed="' + (L.hh.indexOf(m) >= 0) + '">' + m + "</button>";
        }).join("") + "</div></div>" +

        '<div class="fgroup"><label>Modifications (optional)</label>' +
        '<textarea class="field" id="mods" placeholder="e.g. half the butter, doubled the garlic">' + esc(L.mods) + "</textarea></div>" +

        '<button class="btn btn-primary btn-block" id="go-tier"' + (L.draft.trim() ? "" : " disabled") + ">Continue</button>";

      if (wantList.length) {
        html += '<div class="shead" style="padding-left:0;padding-right:0"><h2 style="font-size:14px">From your queue</h2></div>' +
          '<div style="display:flex;flex-direction:column;gap:8px">' +
          wantList.slice(0, 3).map(function (c, i) {
            return '<button class="btn btn-secondary" style="justify-content:flex-start" data-want="' + i + '">' +
              esc(c.name) + '&nbsp;<span style="color:var(--muted);font-weight:400">· ' + esc(c.src) + "</span></button>";
          }).join("") + "</div>";
      }
      html += "</div>";
    }

    if (L.step === "tier") {
      html = '<div class="flow">' +
        '<div class="step">One question</div>' +
        "<h2>Would you make " + esc(L.dish.name) + " again?</h2>" +
        '<p class="lede">Not &ldquo;was it good.&rdquo; Would you spend an evening on it again. Your answer already accounts for how it went.</p>' +
        '<div class="tiers">' +
          '<button class="tierbtn" data-tier="yes"><span><strong>Yes</strong><span class="d">It&rsquo;s earning a place in the rotation</span></span><span class="bn">7.0–10.0</span></button>' +
          '<button class="tierbtn" data-tier="maybe"><span><strong>Maybe</strong><span class="d">Fine, but I&rsquo;d need a reason</span></span><span class="bn">4.0–6.9</span></button>' +
          '<button class="tierbtn" data-tier="no"><span><strong>No</strong><span class="d">Not making that twice</span></span><span class="bn">0.0–3.9</span></button>' +
        "</div></div>";
    }

    if (L.step === "compare") {
      var items = tierItems(L.tier);
      var against = items[Math.floor((L.lo + L.hi) / 2)];
      var bars = "";
      for (var i = 0; i < L.est; i++) bars += '<i class="' + (i < L.seen ? "on" : "") + '"></i>';
      html = '<div class="flow">' +
        '<div class="step">Comparison ' + (L.seen + 1) + " of ~" + L.est + "</div>" +
        '<div class="pbar">' + bars + "</div>" +
        "<h2>Which would you rather make again?</h2>" +
        '<p class="lede">A couple of these and it&rsquo;s placed — no stars involved.</p>' +
        '<div class="duelwrap">' +
          '<button class="duel" data-win="new">' + tile(L.dish, "lg") +
            '<span class="dinfo"><span class="dlabel">The new one</span>' +
            '<span class="dname">' + esc(L.dish.name) + '</span>' +
            '<span class="dctx">' + esc(L.dish.src) + "</span></span></button>" +
          '<div class="duel-or">or</div>' +
          '<button class="duel" data-win="old">' + tile(against, "lg") +
            '<span class="dinfo"><span class="dlabel">Ranked ' + fmt(scoreOf(against)) + "</span>" +
            '<span class="dname">' + esc(against.name) + '</span>' +
            '<span class="dctx">' + esc(against.src) + " · cooked " + (against.reps || 1) + "×</span></span></button>" +
        "</div>" +
        '<div class="duel-alts">' +
          '<button class="btn btn-quiet btn-sm" data-same="1">About the same</button>' +
          '<button class="btn btn-quiet btn-sm" data-skip="1">Skip</button>' +
        "</div></div>";
    }

    if (L.step === "reveal") {
      var x = L.dish, idx = rotation.indexOf(x);
      var win = rotation.slice(Math.max(0, idx - 2), idx + 3);
      var sk2 = streakWeeks();
      html = '<div class="reveal">' +
        '<div class="step">Placed</div>' +
        '<div class="big">' + fmt(scoreOf(x)) + "</div>" +
        '<div class="dn">' + esc(x.name) + "</div>" +
        '<div class="pl">#' + (idx + 1) + " of " + rotation.length + " in your rotation</div>" +
        (sk2 > 1 ? '<div class="streakline">' + sk2 + "-week streak — still going</div>" : "") +
        '<div class="nbs">' + win.map(function (y) {
          return '<div class="nb' + (y === x ? " isnew" : "") + '">' +
            "<span>" + (rotation.indexOf(y) + 1) + ". " + esc(y.name) +
            '</span><span class="n">' + fmt(scoreOf(y)) + "</span></div>";
        }).join("") + "</div>" +
        '<button class="btn btn-primary btn-block" id="see-rank">See the rankings</button>' +
        '<div style="height:8px"></div>' +
        '<button class="btn btn-secondary btn-block" id="log-another">Log another</button></div>';
    }

    el.innerHTML = html;
  }

  function beginCompare() {
    var L = st.log, items = tierItems(L.tier);
    L.lo = 0; L.hi = items.length; L.seen = 0; L.skips = 0;
    L.est = Math.max(1, Math.ceil(Math.log(items.length + 1) / Math.log(2)));
    if (!items.length) { finishInsert(); return; }
    L.step = "compare";
    renderLog();
  }

  function stepCompare(newWins) {
    var L = st.log, mid = Math.floor((L.lo + L.hi) / 2);
    if (newWins) L.hi = mid; else L.lo = mid + 1;
    L.seen++;
    if (L.lo >= L.hi) { finishInsert(); return; }
    renderLog();
  }

  function sameCompare() {
    /* "About the same" — settle right here, next to the anchor */
    var L = st.log;
    L.lo = Math.floor((L.lo + L.hi) / 2);
    finishInsert();
  }

  function skipCompare() {
    /* Skip this pairing without information; give up after 2 skips */
    var L = st.log;
    L.skips++;
    if (L.skips >= 2) { L.lo = Math.floor((L.lo + L.hi) / 2); finishInsert(); return; }
    /* nudge the window one step so a different anchor appears */
    if (L.hi - L.lo > 1) L.hi--;
    renderLog();
  }

  function lastIndexOfTier(t) {
    var order = TIER_ORDER.indexOf(t);
    for (var i = 0; i < rotation.length; i++) {
      if (TIER_ORDER.indexOf(rotation[i].tier) > order) return i;
    }
    return rotation.length;
  }

  function finishInsert() {
    var L = st.log, items = tierItems(L.tier), anchor = items[L.lo];
    var gi = anchor ? rotation.indexOf(anchor) : lastIndexOfTier(L.tier);

    var existing = rotation.filter(function (x) {
      return x !== L.dish && x.name.toLowerCase() === L.dish.name.toLowerCase();
    })[0];
    if (existing) {
      L.dish.reps = (existing.reps || 1) + 1;
      L.dish.hist = [Date.now()].concat(existing.hist || []);
      L.dish.thumb = L.dish.thumb || existing.thumb;
      L.dish.mods = L.dish.mods || existing.mods;
      var ei = rotation.indexOf(existing);
      rotation.splice(ei, 1);
      if (ei < gi) gi--;
    } else {
      L.dish.hist = [Date.now()];
    }
    L.dish.lastTs = Date.now();
    rotation.splice(gi, 0, L.dish);

    wantList = wantList.filter(function (w) {
      return w.name.toLowerCase() !== L.dish.name.toLowerCase();
    });

    cookLog.push(Date.now());
    st.fresh = L.dish.name;
    persist();
    L.step = "reveal";
    renderLog(); renderBar();
  }

  function startLogWith(dish) {
    st.log = newLog();
    st.log.dish = dish;
    st.log.step = "tier";
    setTab("log");
  }

  function buildDishFromForm() {
    var L = st.log;
    return {
      name: L.draft.trim(), src: L.url.trim() ? hostOf(L.url) : "Logged by you",
      occ: L.occ, tier: null, reps: 1, cuisine: "", tags: L.tags.slice(),
      hh: L.hh.slice(), mods: L.mods, thumb: L.thumb,
      lastTs: Date.now(), hist: []
    };
  }

  function hostOf(u) {
    try { return new URL(u.indexOf("http") === 0 ? u : "https://" + u).hostname.replace(/^www\./, ""); }
    catch (e) { return "Link"; }
  }

  /* photo → small dataURL thumbnail */
  function fileToThumb(file, cb) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas");
      var s = Math.min(img.width, img.height);
      c.width = 240; c.height = 144;
      var ctx = c.getContext("2d");
      var sw = img.width, sh = sw * 0.6;
      if (sh > img.height) { sh = img.height; sw = sh / 0.6; }
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, 240, 144);
      cb(c.toDataURL("image/jpeg", 0.78));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  /* ================= DETAIL ================= */

  var detailName = null;

  function openDetail(name) {
    var x = findDish(name);
    if (!x) return;
    detailName = name;
    renderDetail(x);
    var el = $("detail");
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add("on"); });
    var back = $("detail-back");
    if (back) back.focus();
  }

  function closeDetail() {
    var el = $("detail");
    el.classList.remove("on");
    detailName = null;
    setTimeout(function () { el.hidden = true; }, 200);
  }

  function renderDetail(x) {
    var idx = rotation.indexOf(x) + 1;
    var hh = x.hh || [];
    $("detail-in").innerHTML =
      '<div class="detail-bar">' +
        '<button class="btn btn-quiet btn-sm" id="detail-back">&larr; Back</button>' +
        '<button class="btn btn-quiet btn-sm" id="detail-close" aria-label="Close">✕</button>' +
      "</div>" +
      tile(x, "lg") +
      "<h1>" + esc(x.name) + "</h1>" +
      '<div class="dsub">' + esc(x.src) + (x.cuisine ? " · " + esc(x.cuisine) : "") + " · " + x.occ + "</div>" +

      '<div class="dstats">' +
        '<div class="card dstat"><div class="k">#' + idx + '</div><div class="l">your rank</div></div>' +
        '<div class="card dstat"><div class="k">' + (x.reps || 1) + '×</div><div class="l">times cooked</div></div>' +
        '<div class="card dstat"><div class="k">' + fmt(scoreOf(x)) + '</div><div class="l">score</div></div>' +
      "</div>" +

      '<div class="dsection"><h3>Household</h3><div class="hhrow">' +
        HOUSEHOLD.map(function (m) {
          var on = hh.indexOf(m) >= 0;
          return '<button class="hhbtn" data-hhtoggle="' + m + '" aria-pressed="' + on + '">' +
            m + (on ? " · would eat again" : "") + "</button>";
        }).join("") +
      "</div></div>" +

      '<div class="dsection"><h3>Your modifications</h3>' +
        '<textarea class="field" id="detail-mods" placeholder="e.g. half the butter, double the garlic">' + esc(x.mods || "") + "</textarea>" +
      "</div>" +

      '<div class="dsection"><h3>Cooking history</h3><ul class="hist">' +
        (x.hist || []).slice(0, 6).map(function (ts) {
          return "<li><b>" + dateShort(ts) + "</b><span>" + x.occ + "</span></li>";
        }).join("") +
      "</ul></div>" +

      '<div class="dactions">' +
        '<button class="btn btn-primary btn-block" id="detail-cook">Cook again</button>' +
        '<button class="btn btn-secondary btn-block" id="detail-ingr">Add ingredients</button>' +
      "</div>";
  }

  /* ================= PROFILE ================= */

  function renderProfile() {
    var el = $("screen-profile");
    var sk = streakWeeks();
    var dishes = rotation.length;
    var cooks = totalCooks();
    var repeaters = rotation.filter(function (x) { return (x.reps || 1) > 1; }).length;
    var repeatRate = dishes ? Math.round(100 * repeaters / dishes) : 0;

    var most = rotation.slice().sort(function (a, b) { return (b.reps || 1) - (a.reps || 1); })[0];
    var top3 = rotation.slice(0, 3);

    var cui = {};
    rotation.forEach(function (x) { if (x.cuisine) cui[x.cuisine] = (cui[x.cuisine] || 0) + (x.reps || 1); });
    var topCuisines = Object.keys(cui).sort(function (a, b) { return cui[b] - cui[a]; }).slice(0, 3);

    var yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    var thisYear = cookLog.filter(function (ts) { return ts >= yearStart; }).length;

    el.innerHTML = '<div class="profile">' +
      '<span class="brand pbrand">again</span>' +
      '<div class="psub">Your year in cooking, so far</div>' +

      '<div class="pgrid">' +
        '<div class="card pstat hero"><div><div class="k">' + sk + ' <span class="u">weeks</span></div>' +
        '<div class="l">cooking streak — one cook a week keeps it</div></div></div>' +
        '<div class="card pstat"><div class="k">' + cooks + '</div><div class="l">cooks logged</div></div>' +
        '<div class="card pstat"><div class="k">' + dishes + '</div><div class="l">dishes ranked</div></div>' +
        '<div class="card pstat"><div class="k">' + repeatRate + '%</div><div class="l">earn a repeat</div></div>' +
        '<div class="card pstat"><div class="k">' + thisYear + '<span class="u"> / ' + GOAL.target + '</span></div><div class="l">' + GOAL.label.toLowerCase() + "</div></div>" +
      "</div>" +

      '<div class="shead" style="padding-left:0;padding-right:0"><h2>Top of your table</h2></div>' +
      '<div class="plist">' + top3.map(function (x, i) {
        return '<div class="pl-row"><b>' + (i + 1) + ". " + esc(x.name) + "</b><span>" + fmt(scoreOf(x)) + "</span></div>";
      }).join("") + "</div>" +

      '<div class="shead" style="padding-left:0;padding-right:0"><h2>Habits</h2></div>' +
      '<div class="plist">' +
        '<div class="pl-row"><b>Most repeated</b><span>' + (most ? esc(most.name) + " · " + (most.reps || 1) + "×" : "—") + "</span></div>" +
        '<div class="pl-row"><b>Favorite cuisines</b><span>' + (topCuisines.length ? topCuisines.join(", ") : "—") + "</span></div>" +
      "</div>" +

      '<div class="shead" style="padding-left:0;padding-right:0"><h2>Taste compatibility</h2></div>' +
      '<div class="matchgrid">' + FRIENDS.map(function (f) {
        var m = matchPct(f);
        return '<div class="card matchcard"><span class="avatar">' + f.init + "</span>" +
          '<span class="nm">' + f.who + '</span><span class="pct">' + (m === null ? "—" : m + "%") + "</span>" +
          '<span class="lbl">taste match</span></div>';
      }).join("") + "</div>" +

      (shopList.length
        ? '<div class="shead" style="padding-left:0;padding-right:0"><h2>Shopping list</h2></div>' +
          '<div class="plist">' + shopList.map(function (s, i) {
            return '<div class="pl-row"><b>' + esc(s) + '</b><span><button class="btn btn-quiet btn-sm" data-droplist="' + i + '">✕</button></span></div>';
          }).join("") + "</div>"
        : "") +

      '<div class="reset-row"><button id="reset-data">Restore demo data</button></div>' +
    "</div>";
  }

  /* ================= CHROME ================= */

  function renderBar() {
    var sk = streakWeeks();
    $("bar-meta").textContent =
      (sk > 0 ? sk + "-wk streak · " : "") + rotation.length + " dishes · " + totalCooks() + " cooks";
  }

  var TABS = ["home", "rankings", "log", "queue", "profile"];

  function setTab(t) {
    st.tab = t;
    TABS.forEach(function (k) { $("screen-" + k).hidden = k !== t; });
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      if (b.classList.contains("logbtn")) return;
      b.setAttribute("aria-selected", String(b.dataset.tab === t));
    });
    if (t === "home") renderHome();
    if (t === "rankings") renderRankings();
    if (t === "queue") renderQueue();
    if (t === "log") renderLog();
    if (t === "profile") renderProfile();
    renderBar();
    window.scrollTo(0, 0);
  }

  /* ================= EVENTS ================= */

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, a");
    if (!t) return;

    if (t.id === "top-brand") { e.preventDefault(); setTab("home"); return; }
    if (t.dataset.tab) { setTab(t.dataset.tab); return; }
    if (t.dataset.tabGo) { setTab(t.dataset.tabGo); return; }

    if (t.dataset.filter) { st.filter = t.dataset.filter; renderRankings(); return; }

    if (t.dataset.detail) { openDetail(t.dataset.detail); return; }
    if (t.id === "detail-back" || t.id === "detail-close") {
      var x0 = detailName ? findDish(detailName) : null;
      var modsEl = $("detail-mods");
      if (x0 && modsEl) { x0.mods = modsEl.value; persist(); }
      closeDetail();
      if (st.tab === "rankings") renderRankings();
      return;
    }
    if (t.dataset.hhtoggle && detailName) {
      var xd = findDish(detailName);
      if (xd) {
        var m = t.dataset.hhtoggle;
        var pos = (xd.hh = xd.hh || []).indexOf(m);
        if (pos >= 0) xd.hh.splice(pos, 1); else xd.hh.push(m);
        persist(); renderDetail(xd);
      }
      return;
    }
    if (t.id === "detail-cook" && detailName) {
      var xc = findDish(detailName);
      var modsEl2 = $("detail-mods");
      if (xc && modsEl2) xc.mods = modsEl2.value;
      closeDetail();
      if (xc) startLogWith({ name: xc.name, src: xc.src, occ: xc.occ, tier: null, reps: 1,
        cuisine: xc.cuisine, tags: (xc.tags || []).slice(), hh: (xc.hh || []).slice(),
        mods: xc.mods, thumb: xc.thumb, lastTs: Date.now(), hist: [] });
      return;
    }
    if (t.id === "detail-ingr" && detailName) {
      if (shopList.indexOf(detailName) < 0) { shopList.unshift(detailName); persist(); }
      toast("Ingredients saved to your list");
      return;
    }
    if (t.dataset.droplist !== undefined) {
      shopList.splice(parseInt(t.dataset.droplist, 10), 1);
      persist(); renderProfile(); return;
    }

    if (t.dataset.occ) { st.log.occ = t.dataset.occ; syncFormState(); renderLog(); return; }
    if (t.dataset.tag) {
      var tg = t.dataset.tag, ti = st.log.tags.indexOf(tg);
      if (ti >= 0) st.log.tags.splice(ti, 1); else st.log.tags.push(tg);
      syncFormState(); renderLog(); return;
    }
    if (t.dataset.hh) {
      var hm = t.dataset.hh, hi = st.log.hh.indexOf(hm);
      if (hi >= 0) st.log.hh.splice(hi, 1); else st.log.hh.push(hm);
      syncFormState(); renderLog(); return;
    }

    if (t.id === "photo-pick") { $("photo-file").click(); return; }

    if (t.dataset.want !== undefined) {
      var w = wantList[parseInt(t.dataset.want, 10)];
      if (w) startLogWith({ name: w.name, src: w.src, occ: w.occ, tier: null, reps: 1,
        cuisine: "", tags: [], hh: ["You"], mods: "", thumb: null, lastTs: Date.now(), hist: [] });
      return;
    }
    if (t.dataset.cookwant !== undefined) {
      var cw = wantList[parseInt(t.dataset.cookwant, 10)];
      if (cw) startLogWith({ name: cw.name, src: cw.src, occ: cw.occ, tier: null, reps: 1,
        cuisine: "", tags: [], hh: ["You"], mods: "", thumb: null, lastTs: Date.now(), hist: [] });
      return;
    }
    if (t.dataset.dropwant !== undefined) {
      wantList.splice(parseInt(t.dataset.dropwant, 10), 1);
      persist(); renderQueue(); return;
    }
    if (t.id === "want-add") {
      var wv = st.wantDraft.trim(); if (!wv) return;
      wantList.unshift({ name: wv, src: "Saved by you", occ: "weeknight", from: "you" });
      st.wantDraft = "";
      persist(); renderQueue(); toast("Saved to your queue"); return;
    }
    if (t.dataset.savefeed) {
      var parts = t.dataset.savefeed.split(":");
      var fr = FRIENDS.filter(function (f) { return f.who === parts[0]; })[0];
      var it = fr && fr.feed[+parts[1]];
      if (it && !wantList.some(function (q) { return q.name.toLowerCase() === it.dish.toLowerCase(); })) {
        wantList.unshift({ name: it.dish, src: it.src, occ: it.occ, from: fr.who });
        persist(); toast("Saved to your queue");
      }
      renderHome(); return;
    }

    if (t.id === "go-tier") {
      syncFormState();
      if (!st.log.draft.trim()) return;
      st.log.dish = buildDishFromForm();
      st.log.step = "tier"; renderLog(); return;
    }
    if (t.dataset.tier) {
      st.log.tier = t.dataset.tier; st.log.dish.tier = t.dataset.tier; beginCompare(); return;
    }
    if (t.dataset.win) { stepCompare(t.dataset.win === "new"); return; }
    if (t.dataset.same) { sameCompare(); return; }
    if (t.dataset.skip) { skipCompare(); return; }
    if (t.id === "see-rank") { st.log = newLog(); setTab("rankings"); return; }
    if (t.id === "log-another") { st.log = newLog(); st.fresh = null; renderLog(); return; }

    if (t.id === "reset-data") {
      rotation = SEED.map(function (x) { return Object.assign({}, x); });
      wantList = SEED_WANT.map(function (x) { return Object.assign({}, x); });
      cookLog = seedCookLog();
      shopList = [];
      st.fresh = null;
      persist(); renderProfile(); renderBar(); toast("Demo data restored");
      return;
    }
  });

  function syncFormState() {
    var dr = $("draft"), ur = $("url"), mo = $("mods");
    if (dr) st.log.draft = dr.value;
    if (ur) st.log.url = ur.value;
    if (mo) st.log.mods = mo.value;
  }

  document.addEventListener("input", function (e) {
    if (e.target.id === "draft") {
      st.log.draft = e.target.value;
      var b = $("go-tier"); if (b) b.disabled = !e.target.value.trim();
    }
    if (e.target.id === "url") st.log.url = e.target.value;
    if (e.target.id === "mods") st.log.mods = e.target.value;
    if (e.target.id === "want-draft") {
      st.wantDraft = e.target.value;
      var wb = $("want-add"); if (wb) wb.disabled = !e.target.value.trim();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "photo-file" && e.target.files && e.target.files[0]) {
      syncFormState();
      fileToThumb(e.target.files[0], function (url) {
        st.log.thumb = url;
        renderLog();
      });
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && detailName) { closeDetail(); return; }
    if (e.key !== "Enter") return;
    if (e.target.id === "draft" && e.target.value.trim()) {
      syncFormState();
      st.log.dish = buildDishFromForm();
      st.log.step = "tier"; renderLog();
    }
    if (e.target.id === "want-draft" && e.target.value.trim()) {
      wantList.unshift({ name: e.target.value.trim(), src: "Saved by you", occ: "weeknight", from: "you" });
      st.wantDraft = "";
      persist(); renderQueue(); toast("Saved to your queue");
    }
  });

  /* ================= BOOT ================= */

  renderBar();
  renderHome();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
