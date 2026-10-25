/* again — UI layer: rendering, event handling and persistence.
   Pure logic (ranking, suggestions, storage shape) lives in core.js so it can be tested in Node.
   Core loop: cook → log → compare → rank → recommend → cook again. */
import * as core from "./core.js";

  var $ = function (id) { return document.getElementById(id); };
  var KEY = "again.v3";
  var DAY = core.DAY;
  var blankStore = core.blankStore, uid = core.uid, esc = core.esc;

  /* ================================================================ STORE */

  var S = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var v = JSON.parse(raw);
        if (v && v.order && v.meals) return v;
      }
    } catch (e) {}
    try {
      return core.migrateV2(JSON.parse(localStorage.getItem("again.rotation.v2") || "null"), Date.now()) || blankStore();
    } catch (e) { return blankStore(); }
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ================================================================ ANALYTICS
     Thin abstraction — swap the sink later without touching call sites. */

  function track(event, props) {
    var rec = { e: event, ts: Date.now(), p: props || {} };
    S.analytics.push(rec);
    if (S.analytics.length > 500) S.analytics = S.analytics.slice(-400);
    try { console.debug("[analytics]", event, props || {}); } catch (e) {}
    save();
  }

  function countEv(name) {
    return S.analytics.filter(function (a) { return a.e === name; }).length;
  }

  /* ================================================================ DERIVED
     Thin bindings of core.js to the live store and clock. */

  function mealById(id) { return core.mealById(S, id); }
  function mealByName(name) { return core.mealByName(S, name); }
  function eventsOf(id) { return core.eventsOf(S, id); }
  function repsOf(id) { return core.repsOf(S, id); }
  function lastTsOf(id) { return core.lastTsOf(S, id); }
  function lastEvent(id) { return core.lastEvent(S, id); }
  function tierOf(id) { return core.tierOf(S, id); }
  function orderedIds() { return core.orderedIds(S); }
  function rankOf(id) { return core.rankOf(S, id); }
  function members() { return core.members(S); }
  function everyoneOK(id) { return core.everyoneOK(S, id); }
  function labelOf(id) { return core.labelOf(S, id); }
  function ago(ts) { return core.ago(ts, Date.now()); }
  function streakWeeks() { return core.streakWeeks(S.events, Date.now()); }
  function whyFor(id) { return core.whyFor(S, id, Date.now()); }

  function dateShort(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ================================================================ ORDER OPS */

  function removeFromOrder(id) {
    ["yes", "maybe", "no"].forEach(function (t) {
      var i = S.order[t].indexOf(id);
      if (i >= 0) S.order[t].splice(i, 1);
    });
  }

  function placeInBand(id, tier, pos) {
    removeFromOrder(id);
    if (pos == null || pos < 0 || pos > S.order[tier].length) S.order[tier].push(id);
    else S.order[tier].splice(pos, 0, id);
  }

  /* ================================================================ COMPONENTS */

  function tile(m, size) {
    var name = m && m.name ? m.name : "?";
    if (m && m.thumb) return '<span class="tile tile-' + size + '"><img src="' + m.thumb + '" alt=""></span>';
    return '<span class="tile tile-' + size + '" aria-hidden="true">' + esc(name.trim().charAt(0) || "?") + "</span>";
  }

  function labelHtml(id) {
    var l = labelOf(id);
    return '<span class="label label-' + l.k + '">' + l.txt + "</span>";
  }

  function mealRow(id, opts) {
    var m = mealById(id);
    if (!m) return "";
    var r = rankOf(id), reps = repsOf(id), last = lastTsOf(id);
    return '<button class="mrow' + (r <= 3 && tierOf(id) === "yes" ? " top3" : "") +
      (st.fresh === id ? " fresh" : "") + '" data-detail="' + id + '">' +
      '<span class="rank">' + r + "</span>" +
      tile(m, "sm") +
      "<span><span class=\"name\">" + esc(m.name) + "</span>" +
      '<span class="meta2"><span>' + reps + "× cooked</span><span>" + ago(last) + "</span>" +
      (m.timeMins ? "<span>" + m.timeMins + " min</span>" : "") +
      "</span></span>" +
      '<span class="rowlabel">' + labelHtml(id) + "</span></button>";
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("on"); }, 2200);
  }

  /* single comparison card. cb(result) with 'a'|'b'|'same'|'skip' */
  function duelHtml(aMeal, bMeal, aCtx, bCtx) {
    return '<div class="duelwrap">' +
      '<button class="duel" data-duel="a">' + tile(aMeal, "lg") +
        '<span class="dinfo"><span class="dlabel">' + esc(aCtx || "") + '</span>' +
        '<span class="dname">' + esc(aMeal.name) + "</span></span></button>" +
      '<div class="duel-or">or</div>' +
      '<button class="duel" data-duel="b">' + tile(bMeal, "lg") +
        '<span class="dinfo"><span class="dlabel">' + esc(bCtx || "") + '</span>' +
        '<span class="dname">' + esc(bMeal.name) + "</span></span></button>" +
      "</div>" +
      '<div class="duel-alts">' +
        '<button class="btn btn-quiet btn-sm" data-duel="same">About the same</button>' +
        '<button class="btn btn-quiet btn-sm" data-duel="skip">Skip</button>' +
      "</div>";
  }

  /* ================================================================ STATE */

  var st = {
    tab: "tonight",
    view: "all",
    fresh: null,
    onb: null,          // {step, name, members, mealNames[], mealIds[], duelN}
    log: null,          // see newLog()
    duelCb: null,       // active duel resolver
    savedDraft: ""
  };

  function newLog(prefill) {
    return {
      step: "search", q: "",
      mealId: null,               // existing meal being re-logged
      name: prefill && prefill.name || "",
      url: prefill && prefill.url || "",
      thumb: null, note: "", timeMins: null, effort: null,
      ate: members().slice(),
      again: null,
      savedId: prefill && prefill.savedId || null,
      reactions: {},
      placedId: null, comparePending: false
    };
  }

  /* ================================================================ TONIGHT */

  function recReliable() { return core.recReliable(S, Date.now()); }
  function recQuick(excl) { return core.recQuick(S, excl); }
  function recNew() { return core.recNew(S); }

  function recCard(kind, id, savedItem) {
    if (savedItem) {
      return '<div class="card rec">' +
        '<div class="rhead"><span class="rkind">' + kind + "</span></div>" +
        '<div class="rbody">' + tile({ name: savedItem.title }, "md") +
        "<span><div class=\"rname\">" + esc(savedItem.title) + '</div><div class="rsrc">Saved from ' + esc(savedItem.from || savedItem.url || "your list") + "</div></span></div>" +
        '<ul class="why"><li>Never tried</li><li>The queue is where staples come from</li></ul>' +
        '<div class="ractions"><button class="btn btn-primary btn-sm" data-cooksaved="' + savedItem.id + '">Cook this tonight</button></div></div>';
    }
    var m = mealById(id);
    if (!m) return "";
    return '<div class="card rec">' +
      '<div class="rhead"><span class="rkind">' + kind + "</span>" + labelHtml(id) + "</div>" +
      '<div class="rbody">' + tile(m, "md") +
      "<span><div class=\"rname\">" + esc(m.name) + '</div><div class="rsrc">#' + rankOf(id) + " in your rotation</div></span></div>" +
      '<ul class="why">' + whyFor(id).map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul>" +
      '<div class="ractions">' +
        '<button class="btn btn-primary btn-sm" data-cookrec="' + id + '">Cooked this tonight</button>' +
        '<button class="btn btn-quiet btn-sm" data-detail="' + id + '">Details</button>' +
      "</div></div>";
  }

  function feedbackCard() {
    var fb = S.fb;
    function card(key, q) {
      return '<div class="card fbcard"><p>' + q + '</p><span class="fbb">' +
        '<button class="btn btn-secondary btn-sm" data-fb="' + key + ':yes">Yes</button>' +
        '<button class="btn btn-secondary btn-sm" data-fb="' + key + ':no">Not really</button>' +
        "</span></div>";
    }
    if (countEv("meal_logged") >= 3 && !fb.shown.logfast) return card("logfast", "Quick check — does logging a meal feel fast enough?");
    if (countEv("recommendation_selected") >= 1 && !fb.shown.rechelp) return card("rechelp", "Did this recommendation help you decide dinner?");
    if (S.comparisons.length >= 5 && !fb.shown.duels) return card("duels", "Do the head-to-head matchups feel meaningful?");
    return "";
  }

  function renderTonight() {
    var el = $("screen-tonight");

    if (!S.household || st.onb) { renderOnboarding(el); return; }

    if (S.meals.length < 3) {
      el.innerHTML =
        '<div class="onb"><span class="brand obrand">again</span>' +
        '<p class="promise">Remember what your household actually liked — and always know what to cook next.</p>' +
        "<h2>Add a few meals you already make</h2>" +
        '<p class="lede">Three is enough to build your first ranking and get a real recommendation.</p>' +
        '<button class="btn btn-primary" data-tab-go="log">Add a meal</button>' +
        "</div>";
      return;
    }

    var rel = recReliable();
    var quick = recQuick(rel);
    var nw = recNew();

    track("recommendation_viewed", { reliable: !!rel, quick: !!quick, fresh: !!nw });

    var html = '<div class="shead"><h2>What should we cook tonight?</h2>' +
      '<span class="sub">' + (streakWeeks() > 0 ? streakWeeks() + "-week streak" : "") + "</span></div>";

    html += feedbackCard();

    html += '<div class="recwrap">';
    if (rel) html += recCard("Reliable favorite", rel);
    if (quick && quick !== rel) html += recCard("Quick option", quick);
    else if (!quick) html += '<div class="card rec"><div class="rhead"><span class="rkind">Quick option</span></div>' +
      '<p style="margin:0;font-size:13.5px;color:var(--muted)">Add cooking times to your meals and quick picks will show up here.</p></div>';
    if (nw && nw.saved) html += recCard("Something new", null, nw.saved);
    else if (nw && nw.meal && nw.meal !== rel && nw.meal !== quick) html += recCard("Something new", nw.meal);
    else html += '<div class="card rec"><div class="rhead"><span class="rkind">Something new</span></div>' +
      '<p style="margin:0;font-size:13.5px;color:var(--muted)">Nothing saved to try. Add a recipe on the Saved tab and it will appear here.</p>' +
      '<div class="ractions"><button class="btn btn-secondary btn-sm" data-tab-go="saved">Open Saved</button></div></div>';
    html += "</div>";

    el.innerHTML = html;
  }

  /* ================================================================ ONBOARDING */

  function renderOnboarding(el) {
    if (!st.onb) {
      st.onb = { step: 1, name: "", members: ["You"], mealNames: [], mealIds: [], duelN: 0 };
      track("onboarding_started", {});
      var joinName = new URLSearchParams(location.search).get("join");
      if (joinName) { st.onb.name = joinName; st.onb.joined = true; }
    }
    var o = st.onb, html = "";

    if (o.step === 1) {
      html = '<div class="onb"><span class="brand obrand">again</span>' +
        '<p class="promise">Remember what your household actually liked — and always know what to cook next.</p>' +
        '<div class="steps">Step 1 of 3 — your household</div>' +
        "<h2>" + (o.joined ? "You&rsquo;ve been invited to " + esc(o.name) : "Who eats with you?") + "</h2>" +
        '<p class="lede">Name the household and list who&rsquo;s usually at the table.</p>' +
        '<div class="fgroup"><label for="onb-name">Household name</label>' +
        '<input class="field" id="onb-name" placeholder="e.g. The Lees, Apartment 4B" value="' + esc(o.name) + '"></div>' +
        '<div class="fgroup"><label>People</label><div class="chiprow">' +
        o.members.map(function (m, i) {
          return '<button class="chip" aria-pressed="true" data-onb-member="' + i + '">' + esc(m) + (i > 0 ? " ✕" : "") + "</button>";
        }).join("") + "</div>" +
        '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<input class="field" id="onb-member" placeholder="Add a person" style="flex:1">' +
        '<button class="btn btn-secondary" id="onb-member-add">Add</button></div></div>' +
        '<button class="btn btn-primary btn-block" id="onb-next1">Continue</button>' +
        '<div style="height:8px"></div>' +
        '<button class="btn btn-quiet btn-block" id="onb-demo">Explore with demo data instead</button>' +
        "</div>";
    }

    if (o.step === 2) {
      html = '<div class="onb">' +
        '<div class="steps">Step 2 of 3 — your current rotation</div>' +
        "<h2>Add three meals you already make</h2>" +
        '<p class="lede">Whatever&rsquo;s actually in the rotation — not aspirations.</p>' +
        '<div style="display:flex;gap:8px"><input class="field" id="onb-meal" placeholder="e.g. sheet-pan chicken" style="flex:1">' +
        '<button class="btn btn-secondary" id="onb-meal-add">Add</button></div>' +
        '<div class="addedlist">' + o.mealNames.map(function (n, i) {
          return '<div class="ai"><span>' + esc(n) + '</span><button class="btn btn-quiet btn-sm" data-onb-meal-del="' + i + '">✕</button></div>';
        }).join("") + "</div>" +
        '<button class="btn btn-primary btn-block" id="onb-next2"' + (o.mealNames.length >= 3 ? "" : " disabled") + ">" +
        (o.mealNames.length >= 3 ? "Rank them" : "Add " + (3 - o.mealNames.length) + " more") + "</button></div>";
    }

    if (o.step === 3) {
      var pair = onbPair();
      html = '<div class="onb">' +
        '<div class="steps">Step 3 of 3 — first ranking</div>' +
        "<h2>Which would you rather make again?</h2>" +
        '<p class="lede">Two quick matchups. No stars, no scores to invent.</p>' +
        duelHtml(mealById(pair[0]), mealById(pair[1]), "", "") +
        "</div>";
    }

    if (o.step === 4) {
      var rel = recReliable();
      html = '<div class="onb"><div class="steps">Done</div>' +
        "<h2>" + esc(S.household.name) + "&rsquo;s first rotation</h2>" +
        '<p class="lede">Log meals as you cook and this list starts earning its keep.</p>' +
        '<div style="border-top:1px solid var(--border);margin-bottom:16px">' +
        orderedIds().map(function (id, i) {
          return '<div class="nb"><span>' + (i + 1) + ". " + esc(mealById(id).name) + "</span><span class=\"n\">" + labelOf(id).txt + "</span></div>";
        }).join("") + "</div>" +
        (rel ? '<div class="card rec">' +
          '<div class="rhead"><span class="rkind">Tonight&rsquo;s suggestion</span></div>' +
          '<div class="rbody">' + tile(mealById(rel), "md") + "<span><div class=\"rname\">" + esc(mealById(rel).name) + "</div></span></div>" +
          '<ul class="why">' + whyFor(rel).map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul></div>" : "") +
        '<div style="height:16px"></div>' +
        '<button class="btn btn-primary btn-block" id="onb-finish">Start using again</button></div>';
    }

    el.innerHTML = html;
    var f = $("onb-name") || $("onb-meal");
    if (f && o.step < 3) f.focus();
  }

  function onbPair() {
    var o = st.onb;
    if (o.duelN === 0) return [o.mealIds[0], o.mealIds[1]];
    return [S.order.yes[0], o.mealIds[2]];
  }

  function onbDuel(result) {
    var o = st.onb, ids = o.mealIds, pair = onbPair();
    S.comparisons.push({ a: pair[0], b: pair[1], result: result, ts: Date.now() });
    if (result === "skip") track("comparison_skipped", { where: "onboarding" });
    else track("comparison_completed", { where: "onboarding", result: result });

    if (o.duelN === 0) {
      /* order the first two; the rest keep their entry order behind them */
      var rest = ids.slice(2);
      S.order.yes = (result === "b" ? [ids[1], ids[0]] : [ids[0], ids[1]]).concat(rest);
      o.duelN = 1;
    } else {
      /* place the third against the current winner */
      var C = ids[2];
      var band = S.order.yes.filter(function (id) { return id !== C; });
      if (result === "b") S.order.yes = [C].concat(band);                       /* C beats the winner */
      else if (result === "skip") S.order.yes = band.concat([C]);               /* no signal — end */
      else S.order.yes = [band[0], C].concat(band.slice(1));                    /* lost or tied — middle */
      o.step = 4;
    }
    save();
    renderTonight();
  }

  function finishOnboarding() {
    track("onboarding_completed", { meals: S.meals.length, joined: !!st.onb.joined });
    if (st.onb.joined) track("household_invite_accepted", {});
    st.onb = null;
    if (history.replaceState) history.replaceState(null, "", location.pathname);
    setTab("tonight");
    toast("You're set. Log meals as you cook.");
  }

  function loadDemo() {
    var s = blankStore();
    s.household = { name: "The demo household", members: ["You", "Sam", "The kids"] };
    var defs = [
      ["Sheet-pan chicken thighs with lemon", 30, "easy", 6, ["You", "Sam", "The kids"], { You: "loved", Sam: "loved", "The kids": "fine" }],
      ["Marcella's tomato, butter and onion sauce", 45, "easy", 5, ["You", "Sam", "The kids"], { You: "loved", Sam: "loved", "The kids": "loved" }],
      ["Gochujang buttered noodles", 20, "easy", 4, ["You", "Sam"], { You: "loved", Sam: "fine" }],
      ["Cast-iron pan pizza", 90, "involved", 3, ["You", "Sam", "The kids"], { You: "loved", Sam: "loved", "The kids": "loved" }],
      ["Miso-glazed salmon", 25, "medium", 2, ["You", "Sam"], { You: "fine", Sam: "fine" }],
      ["Cacio e pepe", 25, "medium", 2, ["You"], { You: "fine" }],
      ["Braised short ribs", 180, "involved", 1, ["You", "Sam"], { You: "loved", Sam: "fine" }]
    ];
    var tiers = ["yes", "yes", "yes", "yes", "maybe", "maybe", "yes"];
    defs.forEach(function (d, i) {
      var id = uid();
      s.meals.push({ id: id, name: d[0], url: "", thumb: null, timeMins: d[1], effort: d[2],
        tags: [], createdAt: Date.now() - 90 * DAY, mods: i === 1 ? "Half the butter — nobody noticed." : "" });
      s.order[tiers[i]].push(id);
      for (var k = 0; k < d[3]; k++) {
        s.events.push({ mealId: id, ts: Date.now() - (k * 12 + i * 2 + 1) * DAY,
          ate: d[4], reactions: k === 0 ? d[5] : {}, note: "", again: tiers[i] });
      }
    });
    s.saved = [
      { id: uid(), title: "Marry-me chicken", url: "", from: "TikTok", status: "queued" },
      { id: uid(), title: "Birria tacos", url: "", from: "YouTube", status: "queued" }
    ];
    s.analytics = S.analytics;
    S = s;
    save();
    st.onb = null;
    track("onboarding_completed", { demo: true });
    setTab("tonight");
    toast("Demo household loaded — explore freely");
  }

  /* ================================================================ ROTATION */

  var VIEWS = [
    { k: "all", label: "Best overall", f: function () { return true; } },
    { k: "weeknight", label: "Weeknight", f: function (m) { return (m.timeMins && m.timeMins <= 45) && m.effort !== "involved"; } },
    { k: "quick", label: "Quick", f: function (m) { return m.timeMins && m.timeMins <= 25; } },
    { k: "easy", label: "Low effort", f: function (m) { return m.effort === "easy"; } },
    { k: "fav", label: "Household favorites", f: function (m) { return everyoneOK(m.id); } },
    { k: "occasion", label: "Special occasion", f: function (m) { return m.effort === "involved"; } }
  ];

  function renderRotation() {
    var el = $("screen-rotation");
    var html = '<div class="chiprow" role="group" aria-label="Views">' +
      VIEWS.map(function (v) {
        return '<button class="chip" data-view="' + v.k + '" aria-pressed="' + (st.view === v.k) + '">' + v.label + "</button>";
      }).join("") + "</div>";

    var view = VIEWS.filter(function (v) { return v.k === st.view; })[0] || VIEWS[0];
    var ids = orderedIds().filter(function (id) {
      var m = mealById(id);
      return m && view.f(Object.assign({ id: id }, m));
    });

    if (!S.meals.length) {
      html += '<div class="empty"><span class="brand">nothing logged yet</span>' +
        "<p>Log your first meal and the rotation starts here.</p>" +
        '<button class="btn btn-primary btn-sm" data-tab-go="log">Log a meal</button></div>';
    } else if (!ids.length) {
      html += '<div class="empty"><p>No meals match this view yet. Cooking times and effort are set on each meal&rsquo;s detail page.</p></div>';
    } else {
      html += ids.map(function (id) { return mealRow(id); }).join("");
      if (S.order.yes.length >= 4) {
        html += '<div style="padding:16px;text-align:center">' +
          '<button class="btn btn-secondary btn-sm" id="refine-btn">Refine rankings — one quick matchup</button></div>';
      }
    }
    el.innerHTML = html;
  }

  /* refine: compare a random adjacent pair in the yes band */
  function refinePair() {
    var band = S.order.yes;
    if (band.length < 2) return null;
    var i = Math.floor(Math.random() * (band.length - 1));
    return [band[i], band[i + 1]];
  }

  var refineIds = null;
  function startRefine() {
    refineIds = refinePair();
    if (!refineIds) return;
    var el = $("screen-rotation");
    el.innerHTML = '<div class="flow">' +
      '<div class="step">Refine rankings</div>' +
      "<h2>Which would you rather make again?</h2>" +
      duelHtml(mealById(refineIds[0]), mealById(refineIds[1]),
        "#" + rankOf(refineIds[0]), "#" + rankOf(refineIds[1])) +
      "</div>";
    st.duelCb = function (result) {
      S.comparisons.push({ a: refineIds[0], b: refineIds[1], result: result, ts: Date.now() });
      if (result === "b") {
        var band = S.order.yes;
        var i = band.indexOf(refineIds[0]), j = band.indexOf(refineIds[1]);
        if (i >= 0 && j >= 0) { band[i] = refineIds[1]; band[j] = refineIds[0]; }
        track("comparison_completed", { where: "refine", result: "b" });
      } else if (result === "a" || result === "same") {
        track("comparison_completed", { where: "refine", result: result });
      } else {
        track("comparison_skipped", { where: "refine" });
      }
      save();
      st.duelCb = null;
      renderRotation();
      if (result !== "skip") toast("Noted");
    };
  }

  /* ================================================================ LOG */

  function renderLog() {
    var L = st.log || (st.log = newLog());
    var el = $("screen-log"), html = "";

    if (L.step === "search") {
      var q = L.q.trim().toLowerCase();
      var hits = S.meals.filter(function (m) {
        return !q || m.name.toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return (lastTsOf(b.id) || 0) - (lastTsOf(a.id) || 0); }).slice(0, 5);

      html = '<div class="flow">' +
        '<div class="step">Log a meal</div>' +
        "<h2>What did you cook?</h2>" +
        '<p class="lede">Pick a meal you&rsquo;ve made before, or type a new one.</p>' +
        '<input class="field" id="log-q" placeholder="Search or add a meal" value="' + esc(L.q) + '" autocomplete="off" enterkeyhint="go">' +
        '<div class="hitlist">' +
        hits.map(function (m) {
          return '<button class="hit" data-loghit="' + m.id + '">' + tile(m, "sm") +
            "<span><span class=\"hn\">" + esc(m.name) + '</span><div class="hm">' + repsOf(m.id) + "× · " + ago(lastTsOf(m.id)) + '</div></span><span class="htag">Cooked again</span></button>';
        }).join("") +
        (q && !mealByName(L.q)
          ? '<button class="hit" data-lognew="1"><span class="tile tile-sm">+</span>' +
            "<span><span class=\"hn\">Add &ldquo;" + esc(L.q.trim()) + "&rdquo;</span><div class=\"hm\">New meal</div></span><span class=\"htag\">Add</span></button>"
          : "") +
        "</div></div>";
    }

    if (L.step === "ctx") {
      var isRepeat = !!L.mealId;
      var name = isRepeat ? mealById(L.mealId).name : L.name;
      html = '<div class="flow">' +
        '<div class="step">' + (isRepeat ? "Cooked again" : "New meal") + "</div>" +
        "<h2>" + esc(name) + "</h2>" +

        '<div class="fgroup"><label>Who ate it?</label><div class="chiprow">' +
        members().map(function (m) {
          return '<button class="chip" data-ate="' + esc(m) + '" aria-pressed="' + (L.ate.indexOf(m) >= 0) + '">' + esc(m) + "</button>";
        }).join("") + "</div></div>" +

        '<div class="fgroup"><label>Would you make it again?</label><div class="tiers horiz">' +
          '<button class="tierbtn" data-again="yes" aria-pressed="' + (L.again === "yes") + '"><strong>Yes</strong><span class="d">Keep it coming</span></button>' +
          '<button class="tierbtn" data-again="maybe" aria-pressed="' + (L.again === "maybe") + '"><strong>Maybe</strong><span class="d">With a reason</span></button>' +
          '<button class="tierbtn" data-again="no" aria-pressed="' + (L.again === "no") + '"><strong>No</strong><span class="d">Retire it</span></button>' +
        "</div></div>" +

        '<details class="moredetails"><summary>Add details (photo, link, note, time)</summary><div>' +
          '<div class="fgroup"><button class="photobtn" id="photo-pick" type="button">' +
          (L.thumb ? '<img src="' + L.thumb + '" alt="">Photo added — tap to replace' : "Add a photo (optional)") +
          '</button><input type="file" id="photo-file" accept="image/*" hidden></div>' +
          '<div class="fgroup"><input class="field" id="log-url" inputmode="url" placeholder="Recipe link (optional)" value="' + esc(L.url) + '"></div>' +
          '<div class="fgroup"><input class="field" id="log-note" placeholder="Modification note — e.g. used less sugar" value="' + esc(L.note) + '"></div>' +
          '<div class="fgroup"><label>Cooking time</label><div class="chiprow">' +
            [15, 25, 40, 60].map(function (t) {
              return '<button class="chip" data-time="' + t + '" aria-pressed="' + (L.timeMins === t) + '">' + (t === 60 ? "60+ min" : t + " min") + "</button>";
            }).join("") + "</div></div>" +
          '<div class="fgroup"><label>Effort</label><div class="chiprow">' +
            [["easy", "Easy"], ["medium", "Medium"], ["involved", "A project"]].map(function (o) {
              return '<button class="chip" data-effort="' + o[0] + '" aria-pressed="' + (L.effort === o[0]) + '">' + o[1] + "</button>";
            }).join("") + "</div></div>" +
        "</div></details>" +

        '<button class="btn btn-primary btn-block" id="log-save"' + (L.again ? "" : " disabled") + ">Save</button>" +
        '<div style="height:8px"></div>' +
        '<button class="btn btn-quiet btn-block" id="log-cancel">Cancel</button>' +
        "</div>";
    }

    if (L.step === "confirm") {
      var id = L.placedId, m2 = mealById(id);
      var sk = streakWeeks();
      html = '<div class="reveal">' +
        '<div class="headline">Logged.</div>' +
        '<div class="dn">' + esc(m2.name) + "</div>" +
        '<div class="pl">#' + rankOf(id) + " of " + S.meals.length + " · " + repsOf(id) + "× cooked · " + labelOf(id).txt + "</div>" +
        (sk > 1 ? '<div class="streakline">' + sk + "-week cooking streak</div>" : "") +

        '<div class="reactblock"><h3>How did it go over? <span style="font-weight:400;text-transform:none">(optional)</span></h3>' +
        L.ate.map(function (mem) {
          var r = L.reactions[mem] || "";
          return '<div class="reactrow"><span class="rn">' + esc(mem) + '</span><span class="seg">' +
            '<button class="s-loved" data-react="' + esc(mem) + ':loved" aria-pressed="' + (r === "loved") + '">Loved it</button>' +
            '<button class="s-fine" data-react="' + esc(mem) + ':fine" aria-pressed="' + (r === "fine") + '">Fine</button>' +
            '<button class="s-never" data-react="' + esc(mem) + ':never" aria-pressed="' + (r === "never") + '">Not again</button>' +
            "</span></div>";
        }).join("") + "</div>" +

        (L.comparePending
          ? '<div class="reactblock"><h3>One quick matchup? <span style="font-weight:400;text-transform:none">(optional)</span></h3>' +
            (function () {
              var band = S.order[tierOf(id)];
              var others = band.filter(function (x) { return x !== id; });
              if (!others.length) return "";
              var mid = others[Math.floor(others.length / 2)];
              L.compareWith = mid;
              return duelHtml(m2, mealById(mid), "Just cooked", "#" + rankOf(mid));
            })() + "</div>"
          : "") +

        '<button class="btn btn-primary btn-block" id="log-done">Done</button>' +
        "</div>";
    }

    el.innerHTML = html;
    if (L.step === "search") { var qf = $("log-q"); if (qf) { qf.focus(); qf.setSelectionRange(qf.value.length, qf.value.length); } }
  }

  function saveLogEvent() {
    var L = st.log;
    var m;
    if (L.mealId) {
      m = mealById(L.mealId);
      if (L.url) m.url = L.url;
      if (L.thumb) m.thumb = L.thumb;
      if (L.timeMins) m.timeMins = L.timeMins;
      if (L.effort) m.effort = L.effort;
      if (L.note) m.mods = L.note;
    } else {
      m = { id: uid(), name: L.name.trim(), url: L.url, thumb: L.thumb,
        timeMins: L.timeMins, effort: L.effort, tags: [], createdAt: Date.now(), mods: L.note };
      S.meals.push(m);
    }

    S.events.push({ mealId: m.id, ts: Date.now(), ate: L.ate.slice(),
      reactions: {}, note: L.note, again: L.again });

    var prevTier = tierOf(m.id);
    var isRepeat = !!L.mealId;

    if (!prevTier) {
      /* new meal: append to chosen band; offer one placement comparison */
      placeInBand(m.id, L.again, null);
      L.comparePending = S.order[L.again].length > 1;
    } else if (prevTier !== L.again) {
      /* answer changed: move bands, keep it simple — append; offer comparison */
      placeInBand(m.id, L.again, null);
      L.comparePending = S.order[L.again].length > 1;
    } else {
      L.comparePending = false;
    }

    /* saved recipe graduates */
    if (L.savedId) {
      S.saved.forEach(function (s) { if (s.id === L.savedId) s.status = "cooked"; });
    } else {
      S.saved.forEach(function (s) {
        if (s.title.trim().toLowerCase() === m.name.trim().toLowerCase()) s.status = "cooked";
      });
    }

    st.fresh = m.id;
    L.placedId = m.id;
    L.step = "confirm";
    save();

    track(isRepeat ? "repeat_cook_logged" : "meal_logged", { mealId: m.id });
    renderLog();
    renderBar();
  }

  function applyConfirmReactions() {
    var L = st.log;
    if (!L || !L.placedId) return;
    var evs = eventsOf(L.placedId);
    if (evs[0]) { evs[0].reactions = L.reactions; }
    save();
  }

  function confirmDuel(result) {
    var L = st.log;
    var id = L.placedId, other = L.compareWith;
    S.comparisons.push({ a: id, b: other, result: result, ts: Date.now() });
    if (result === "skip") { track("comparison_skipped", { where: "placement" }); }
    else {
      track("comparison_completed", { where: "placement", result: result });
      var band = S.order[tierOf(id)];
      band.splice(band.indexOf(id), 1);
      var oi = band.indexOf(other);
      if (result === "a") band.splice(oi, 0, id);          /* new wins → above anchor */
      else if (result === "b") band.splice(oi + 1, 0, id);  /* anchor wins → below */
      else band.splice(oi + 1, 0, id);                      /* same → adjacent */
    }
    save();
    L.comparePending = false;
    renderLog();
  }

  /* photo → small dataURL thumbnail */
  function fileToThumb(file, cb) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = 280; c.height = 168;
      var ctx = c.getContext("2d");
      var sw = img.width, sh = sw * 0.6;
      if (sh > img.height) { sh = img.height; sw = sh / 0.6; }
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, 280, 168);
      cb(c.toDataURL("image/jpeg", 0.78));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = function () { cb(null); };
    img.src = URL.createObjectURL(file);
  }

  /* ================================================================ SAVED */

  function renderSaved() {
    var el = $("screen-saved");
    var queued = S.saved.filter(function (s) { return s.status === "queued"; });
    var cooked = S.saved.filter(function (s) { return s.status === "cooked"; });

    var html = '<div class="shead"><h2>Saved to try</h2><span class="sub">' + queued.length + " waiting</span></div>" +
      '<div class="pagepad" style="display:flex;gap:8px;padding-bottom:8px">' +
      '<input class="field" id="saved-draft" placeholder="Meal name or recipe link" value="' + esc(st.savedDraft) + '" style="flex:1" enterkeyhint="done">' +
      '<button class="btn btn-secondary" id="saved-add"' + (st.savedDraft.trim() ? "" : " disabled") + ">Save</button></div>";

    if (!queued.length && !cooked.length) {
      html += '<div class="empty"><span class="brand">nothing saved yet</span>' +
        "<p>Paste a link or name any dish you want to try. Tonight&rsquo;s &ldquo;something new&rdquo; comes from here.</p></div>";
    } else {
      html += '<div class="plainlist">' + queued.map(function (s) {
        return '<div class="prow"><span><span class="pn">' + esc(s.title) + '</span><div class="pm">' +
          esc(s.from || s.url || "saved by you") + '</div></span><span class="pa">' +
          '<button class="btn btn-primary btn-sm" data-cooksaved="' + s.id + '">Cooked it</button>' +
          '<button class="btn btn-quiet btn-sm" data-dropsaved="' + s.id + '" aria-label="Remove ' + esc(s.title) + '">✕</button></span></div>';
      }).join("") + "</div>";
      if (cooked.length) {
        html += '<div class="shead"><h2>Already tried</h2></div><div class="plainlist">' +
          cooked.map(function (s) {
            return '<div class="prow"><span class="pn" style="color:var(--muted)">' + esc(s.title) + '</span><span class="pm">moved into your rotation</span></div>';
          }).join("") + "</div>";
      }
    }
    el.innerHTML = html;
  }

  /* ================================================================ HOUSEHOLD */

  function renderHousehold() {
    var el = $("screen-household");
    if (!S.household) { el.innerHTML = '<div class="empty"><p>Finish setup on the Tonight tab first.</p></div>'; return; }

    var agree = orderedIds().filter(function (id) { return everyoneOK(id) && tierOf(id) !== "no"; });

    el.innerHTML = '<div class="pagepad" style="padding-top:24px">' +
      '<span class="brand" style="font-size:34px">' + esc(S.household.name) + "</span>" +
      '<div style="font-size:13px;color:var(--muted);margin-bottom:24px">' +
        S.meals.length + " meals · " + S.events.length + " cooks logged · data lives on this device</div>" +

      "<h3 style='font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:0 0 8px'>Members</h3>" +
      S.household.members.map(function (m, i) {
        return '<div class="hh-member"><span class="avatar">' + esc(m.slice(0, 2).toUpperCase()) + "</span>" +
          '<span class="mn">' + esc(m) + "</span>" +
          (i > 0 ? '<button class="btn btn-quiet btn-sm" data-delmember="' + i + '" aria-label="Remove ' + esc(m) + '">✕</button>' : "") +
          "</div>";
      }).join("") +
      '<div style="display:flex;gap:8px;margin:12px 0 24px">' +
        '<input class="field" id="hh-member" placeholder="Add a person" style="flex:1">' +
        '<button class="btn btn-secondary" id="hh-member-add">Add</button></div>' +

      '<button class="btn btn-primary btn-block" id="hh-invite">Invite someone — share a link</button>' +
      '<div style="font-size:12px;color:var(--muted);margin:8px 0 24px">They&rsquo;ll get a link that sets this household name up on their device. Shared syncing is on the roadmap — today each device keeps its own log.</div>' +

      "<h3 style='font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:0 0 8px'>What everyone will eat</h3>" +
      (agree.length
        ? agree.slice(0, 6).map(function (id) { return mealRow(id); }).join("")
        : '<p style="font-size:13px;color:var(--muted)">Log who ate each meal and their reactions — meals the whole household accepts will collect here.</p>') +

      '<div style="text-align:center;padding:24px 0">' +
        '<button class="btn btn-quiet btn-sm" id="share-list">Share your ranked list</button> ' +
        '<button class="btn btn-quiet btn-sm" id="reset-data">Start over</button></div>' +
      "</div>";
  }

  function inviteLink() {
    return location.origin + location.pathname + "?join=" + encodeURIComponent(S.household.name);
  }

  function shareText(title, text, url) {
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function () {});
      return true;
    }
    try {
      navigator.clipboard.writeText(url ? text + " " + url : text);
      return true;
    } catch (e) { return false; }
  }

  /* ================================================================ DETAIL */

  var detailId = null;

  function openDetail(id) {
    var m = mealById(id);
    if (!m) return;
    detailId = id;
    renderDetail(m);
    var el = $("detail");
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add("on"); });
    var back = $("detail-back");
    if (back) back.focus();
  }

  function closeDetail() {
    var noteEl = $("detail-mods");
    if (noteEl && detailId) { var m = mealById(detailId); if (m) { m.mods = noteEl.value; save(); } }
    var el = $("detail");
    el.classList.remove("on");
    detailId = null;
    setTimeout(function () { el.hidden = true; }, 200);
  }

  function renderDetail(m) {
    var id = m.id;
    var last = lastEvent(id);
    var reactions = last ? last.reactions : {};
    $("detail-in").innerHTML =
      '<div class="detail-bar">' +
        '<button class="btn btn-quiet btn-sm" id="detail-back">&larr; Back</button>' +
        labelHtml(id) +
      "</div>" +
      tile(m, "lg") +
      "<h1>" + esc(m.name) + "</h1>" +
      '<div class="dsub">' +
        (m.url ? '<a href="' + esc(m.url) + '" target="_blank" rel="noopener">Recipe source</a> · ' : "") +
        (m.timeMins ? m.timeMins + " min · " : "") + (m.effort ? m.effort : "effort not set") +
      "</div>" +

      '<div class="dstats">' +
        '<div class="card dstat"><div class="k">#' + rankOf(id) + '</div><div class="l">rank</div></div>' +
        '<div class="card dstat"><div class="k">' + repsOf(id) + '×</div><div class="l">cooked</div></div>' +
        '<div class="card dstat"><div class="k">' + esc(ago(lastTsOf(id)).replace(" ago", "")) + '</div><div class="l">last made</div></div>' +
      "</div>" +

      '<div class="dsection"><h3>Last reactions</h3>' +
        (last && Object.keys(reactions).length
          ? Object.keys(reactions).map(function (mem) {
              var r = reactions[mem];
              var cls = r === "loved" ? "label-repeat" : (r === "never" ? "label-retired" : "label-mixed");
              var txt = r === "loved" ? "Loved it" : (r === "never" ? "Not again" : "Fine");
              return '<span class="label ' + cls + '" style="margin-right:6px">' + esc(mem) + " · " + txt + "</span>";
            }).join("")
          : '<p style="font-size:13px;color:var(--muted);margin:0">No reactions recorded yet — they&rsquo;re asked right after you log a cook.</p>') +
      "</div>" +

      '<div class="dsection"><h3>Your modifications</h3>' +
        '<textarea class="field" id="detail-mods" placeholder="e.g. used less sugar, doubled the sauce">' + esc(m.mods || "") + "</textarea>" +
      "</div>" +

      '<div class="dsection"><h3>Cooking history</h3><ul class="hist">' +
        eventsOf(id).slice(0, 8).map(function (e) {
          return "<li><b>" + dateShort(e.ts) + "</b><span>" + esc((e.ate || []).join(", ") || "—") + "</span></li>";
        }).join("") +
      "</ul></div>" +

      '<div class="dactions">' +
        '<button class="btn btn-primary btn-block" id="detail-cook">Cooked it again</button>' +
      "</div>";
  }

  /* ================================================================ CHROME */

  function renderBar() {
    var sk = streakWeeks();
    $("bar-meta").textContent = S.household
      ? (sk > 0 ? sk + "-wk streak · " : "") + S.meals.length + " meals"
      : "";
  }

  var TABS = ["tonight", "rotation", "log", "saved", "household"];

  function setTab(t) {
    st.tab = t;
    TABS.forEach(function (k) { $("screen-" + k).hidden = k !== t; });
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      if (b.classList.contains("logbtn")) return;
      b.setAttribute("aria-selected", String(b.dataset.tab === t));
    });
    if (t === "tonight") renderTonight();
    if (t === "rotation") renderRotation();
    if (t === "log") { if (!st.log || st.log.step === "confirm") st.log = newLog(); renderLog(); }
    if (t === "saved") renderSaved();
    if (t === "household") renderHousehold();
    renderBar();
    window.scrollTo(0, 0);
  }

  /* ================================================================ EVENTS */

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, a");
    if (!t) return;

    /* --- nav --- */
    if (t.id === "top-brand") { e.preventDefault(); setTab("tonight"); return; }
    if (t.dataset.tab) { setTab(t.dataset.tab); return; }
    if (t.dataset.tabGo) { setTab(t.dataset.tabGo); return; }

    /* --- onboarding --- */
    if (t.id === "onb-demo") { loadDemo(); return; }
    if (t.id === "onb-member-add") {
      var mi = $("onb-member");
      if (mi && mi.value.trim()) { st.onb.members.push(mi.value.trim()); renderTonight(); }
      return;
    }
    if (t.dataset.onbMember !== undefined) {
      var idx = parseInt(t.dataset.onbMember, 10);
      if (idx > 0) { st.onb.members.splice(idx, 1); renderTonight(); }
      return;
    }
    if (t.id === "onb-next1") {
      var nameEl = $("onb-name");
      st.onb.name = (nameEl && nameEl.value.trim()) || "Our household";
      S.household = { name: st.onb.name, members: st.onb.members.slice() };
      save();
      st.onb.step = 2;
      renderTonight();
      return;
    }
    if (t.id === "onb-meal-add") {
      var me = $("onb-meal");
      if (me && me.value.trim()) { st.onb.mealNames.push(me.value.trim()); renderTonight(); }
      return;
    }
    if (t.dataset.onbMealDel !== undefined) {
      st.onb.mealNames.splice(parseInt(t.dataset.onbMealDel, 10), 1);
      renderTonight(); return;
    }
    if (t.id === "onb-next2") {
      st.onb.mealIds = st.onb.mealNames.slice(0, 12).map(function (n) {
        var m = { id: uid(), name: n, url: "", thumb: null, timeMins: null, effort: null,
          tags: [], createdAt: Date.now(), mods: "" };
        S.meals.push(m);
        S.events.push({ mealId: m.id, ts: Date.now() - 7 * DAY, ate: members().slice(), reactions: {}, note: "", again: "yes" });
        return m.id;
      });
      /* everything starts in yes; ordering set by the duels */
      S.order.yes = st.onb.mealIds.slice(0, 2);
      st.onb.mealIds.slice(2).forEach(function (id) { if (S.order.yes.indexOf(id) < 0) S.order.yes.push(id); });
      S.order.yes = st.onb.mealIds.slice();
      save();
      st.onb.step = 3; st.onb.duelN = 0;
      renderTonight();
      return;
    }
    if (t.id === "onb-finish") { finishOnboarding(); return; }

    /* --- duels (onboarding + refine + placement share the buttons) --- */
    if (t.dataset.duel) {
      var res = t.dataset.duel;
      if (st.onb && st.onb.step === 3) { onbDuel(res); return; }
      if (st.duelCb) { st.duelCb(res); return; }
      if (st.log && st.log.step === "confirm" && st.log.comparePending) { confirmDuel(res); return; }
      return;
    }

    /* --- tonight --- */
    if (t.dataset.cookrec) {
      track("recommendation_selected", { mealId: t.dataset.cookrec });
      st.log = newLog();
      st.log.mealId = t.dataset.cookrec;
      var lastE = lastEvent(t.dataset.cookrec);
      if (lastE && lastE.ate && lastE.ate.length) st.log.ate = lastE.ate.slice();
      st.log.step = "ctx";
      setTab("log");
      return;
    }
    if (t.dataset.cooksaved) {
      var sv = S.saved.filter(function (s) { return s.id === t.dataset.cooksaved; })[0];
      if (sv) {
        track("recommendation_selected", { saved: sv.title });
        var existing = mealByName(sv.title);
        st.log = newLog({ name: sv.title, url: sv.url, savedId: sv.id });
        if (existing) st.log.mealId = existing.id;
        st.log.step = "ctx";
        setTab("log");
      }
      return;
    }
    if (t.dataset.fb) {
      var parts = t.dataset.fb.split(":");
      S.fb.shown[parts[0]] = true;
      S.fb.answers[parts[0]] = parts[1];
      track("feedback_answered", { q: parts[0], a: parts[1] });
      save();
      toast("Thanks — noted");
      renderTonight();
      return;
    }

    /* --- rotation --- */
    if (t.dataset.view) { st.view = t.dataset.view; renderRotation(); return; }
    if (t.id === "refine-btn") { startRefine(); return; }

    /* --- log --- */
    if (t.dataset.loghit) {
      st.log.mealId = t.dataset.loghit;
      var le = lastEvent(t.dataset.loghit);
      if (le && le.ate && le.ate.length) st.log.ate = le.ate.slice();
      st.log.step = "ctx";
      renderLog();
      return;
    }
    if (t.dataset.lognew) {
      st.log.name = st.log.q.trim();
      st.log.step = "ctx";
      renderLog();
      return;
    }
    if (t.dataset.ate) {
      var a = t.dataset.ate, ai = st.log.ate.indexOf(a);
      if (ai >= 0) st.log.ate.splice(ai, 1); else st.log.ate.push(a);
      syncLogFields(); renderLog(); return;
    }
    if (t.dataset.again) { st.log.again = t.dataset.again; syncLogFields(); renderLog(); return; }
    if (t.dataset.time) { st.log.timeMins = parseInt(t.dataset.time, 10); syncLogFields(); renderLog(); keepDetailsOpen(); return; }
    if (t.dataset.effort) { st.log.effort = t.dataset.effort; syncLogFields(); renderLog(); keepDetailsOpen(); return; }
    if (t.id === "photo-pick") { $("photo-file").click(); return; }
    if (t.id === "log-save") { syncLogFields(); if (st.log.again) saveLogEvent(); return; }
    if (t.id === "log-cancel") { st.log = newLog(); renderLog(); return; }
    if (t.dataset.react) {
      var rp = t.dataset.react.split(":");
      st.log.reactions[rp[0]] = st.log.reactions[rp[0]] === rp[1] ? undefined : rp[1];
      if (!st.log.reactions[rp[0]]) delete st.log.reactions[rp[0]];
      applyConfirmReactions();
      renderLog();
      return;
    }
    if (t.id === "log-done") {
      applyConfirmReactions();
      st.log = newLog();
      setTab("tonight");
      return;
    }

    /* --- saved --- */
    if (t.id === "saved-add") {
      var sd = st.savedDraft.trim();
      if (!sd) return;
      var isUrl = /^(https?:\/\/|www\.)/i.test(sd);
      S.saved.unshift({ id: uid(), title: isUrl ? hostOf(sd) + " recipe" : sd,
        url: isUrl ? sd : "", from: isUrl ? hostOf(sd) : "you", status: "queued" });
      st.savedDraft = "";
      save();
      track("saved_recipe_added", {});
      renderSaved();
      toast("Saved — it'll show up under Something new");
      return;
    }
    if (t.dataset.dropsaved) {
      S.saved = S.saved.filter(function (s) { return s.id !== t.dataset.dropsaved; });
      save(); renderSaved(); return;
    }

    /* --- household --- */
    if (t.id === "hh-member-add") {
      var he = $("hh-member");
      if (he && he.value.trim()) {
        S.household.members.push(he.value.trim());
        save(); renderHousehold();
      }
      return;
    }
    if (t.dataset.delmember !== undefined) {
      S.household.members.splice(parseInt(t.dataset.delmember, 10), 1);
      save(); renderHousehold(); return;
    }
    if (t.id === "hh-invite") {
      var ok = shareText("Join " + S.household.name + " on again",
        "Track what our household actually likes to eat:", inviteLink());
      track("household_invite_sent", {});
      toast(ok ? (navigator.share ? "Share sheet opened" : "Invite link copied") : "Copy failed — link: " + inviteLink());
      return;
    }
    if (t.id === "share-list") {
      var lines = orderedIds().slice(0, 10).map(function (id, i) {
        return (i + 1) + ". " + mealById(id).name + " (" + repsOf(id) + "× cooked)";
      });
      var ok2 = shareText("Our dinner rotation", S.household.name + "'s rotation:\n" + lines.join("\n"), "");
      toast(ok2 ? (navigator.share ? "Share sheet opened" : "List copied to clipboard") : "Could not share");
      return;
    }
    if (t.id === "reset-data") {
      localStorage.removeItem(KEY);
      S = blankStore();
      st.onb = null; st.log = newLog(); st.fresh = null;
      setTab("tonight");
      toast("Fresh start");
      return;
    }

    /* --- detail --- */
    if (t.dataset.detail) { openDetail(t.dataset.detail); return; }
    if (t.id === "detail-back") {
      closeDetail();
      if (st.tab === "rotation") renderRotation();
      if (st.tab === "tonight") renderTonight();
      if (st.tab === "household") renderHousehold();
      return;
    }
    if (t.id === "detail-cook") {
      var did = detailId;
      closeDetail();
      if (did) {
        st.log = newLog();
        st.log.mealId = did;
        var lev = lastEvent(did);
        if (lev && lev.ate && lev.ate.length) st.log.ate = lev.ate.slice();
        st.log.step = "ctx";
        setTab("log");
      }
      return;
    }
  });

  function keepDetailsOpen() {
    var det = document.querySelector("details.moredetails");
    if (det) det.open = true;
  }

  function syncLogFields() {
    if (!st.log) return;
    var u = $("log-url"), n = $("log-note"), q = $("log-q");
    if (u) st.log.url = u.value;
    if (n) st.log.note = n.value;
    if (q) st.log.q = q.value;
  }

  function hostOf(u) {
    try { return new URL(u.indexOf("http") === 0 ? u : "https://" + u).hostname.replace(/^www\./, ""); }
    catch (e) { return "link"; }
  }

  document.addEventListener("input", function (e) {
    if (e.target.id === "onb-name" && st.onb) st.onb.name = e.target.value;
    if (e.target.id === "log-q") { st.log.q = e.target.value; renderLog(); }
    if (e.target.id === "log-url") st.log.url = e.target.value;
    if (e.target.id === "log-note") st.log.note = e.target.value;
    if (e.target.id === "saved-draft") {
      st.savedDraft = e.target.value;
      var sb = $("saved-add"); if (sb) sb.disabled = !e.target.value.trim();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "photo-file" && e.target.files && e.target.files[0]) {
      syncLogFields();
      fileToThumb(e.target.files[0], function (url) {
        if (url) st.log.thumb = url;
        renderLog();
        keepDetailsOpen();
      });
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && detailId) { closeDetail(); return; }
    if (e.key !== "Enter") return;
    var id = e.target.id;
    if (id === "log-q" && st.log && st.log.q.trim()) {
      var hit = mealByName(st.log.q);
      if (hit) {
        st.log.mealId = hit.id;
        var le2 = lastEvent(hit.id);
        if (le2 && le2.ate && le2.ate.length) st.log.ate = le2.ate.slice();
      } else {
        st.log.name = st.log.q.trim();
      }
      st.log.step = "ctx";
      renderLog();
    }
    if (id === "onb-member") { var b1 = $("onb-member-add"); if (b1) b1.click(); }
    if (id === "onb-meal") { var b2 = $("onb-meal-add"); if (b2) b2.click(); }
    if (id === "hh-member") { var b3 = $("hh-member-add"); if (b3) b3.click(); }
    if (id === "saved-draft") { var b4 = $("saved-add"); if (b4) b4.click(); }
  });

  /* ================================================================ BOOT */

  (function boot() {
    var join = new URLSearchParams(location.search).get("join");
    if (join && S.household) {
      track("household_invite_accepted", { existing: true });
      toast("Invite noted — this device already has a household");
      if (history.replaceState) history.replaceState(null, "", location.pathname);
    }
    st.log = newLog();
    renderBar();
    renderTonight();


  /* ---- anonymous visit beacon: path, referrer host, opaque random id. No IP/UA stored. ---- */
  (function () {
    if (location.protocol !== "https:") return;
    try {
      var vid = localStorage.getItem("again.vid");
      if (!vid) { vid = crypto.randomUUID(); localStorage.setItem("again.vid", vid); }
      var ref = "";
      try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) {}
      fetch("/api/hit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ p: location.pathname, r: ref, v: vid }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  })();

    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  })();
