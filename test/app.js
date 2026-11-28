/* FootballCoachHub — aparte gsm-app voor wie fysieke testen afneemt. Zonder account: enkel met een geheime testlink (?s=...)
   die de beheerder maakt in Beheer › Instellingen › Fysieke testen. Via de link kan je enkel resultaten invullen:
   spelers verschijnen met voornaam, eerste letter van de achternaam en rugnummer; vroegere resultaten zie je nooit.
   Alles loopt via de RPC's test_link_* (databaseversie 63). */
"use strict";
const BFN = "https://intswyovpwiigdwmgjfz.supabase.co/functions/v1/brand";
const SB_URL = "https://intswyovpwiigdwmgjfz.supabase.co", SB_KEY = "sb_publishable_mGTwxXL1HjKgnJcgSATtxQ_6CvHJ-3W";
const OGV = "00000000-0000-4000-8000-000000000001";
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "fch_test_noauth" } });
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)], app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const dNice = d => new Date(d + "T12:00").toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" });
const num = s => { const x = String(s ?? "").trim().replace(",", "."); return x === "" || !isFinite(x) ? null : Number(x); };
const low = t => t?.dir === "laag";
const best = (t, xs) => { const v = xs.filter(x => x != null && isFinite(x)).map(Number); return v.length ? (low(t) ? Math.min(...v) : Math.max(...v)) : null; };
const fmt = (t, v) => v == null ? "–" : Number(v).toFixed(Math.max(0, Math.min(3, t?.dec ?? 1))).replace(".", ",") + (t?.unit ? " " + t.unit : "");
const pname = p => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Speler";
const minDate = () => { const d = new Date(); d.setDate(d.getDate() - 7); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const tlbl = t => String(t?.name || "").replace(new RegExp("^(OGV|" + (CLUB.short || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\s+", "i"), "").trim() || t?.category || "Ploeg";
const HERE = location.origin + location.pathname;

let CLUB = {}, TESTS = [], TEAMS = [], ST = ls.get("fch-test-st", {}), PL = [], RES = new Map(), TOK = "", NAAM = ls.get("fch-test-naam", "");
/* wachtrij voor resultaten zonder bereik */
const Q = { get: () => ls.get("fch-test-q2", []), set: q => ls.set("fch-test-q2", q) };

/* ---------- huisstijl van de club ---------- */
function brandIcons(id) { const q = "?club=" + id;
  const L = (rel, href) => { let l = document.querySelector('link[rel="' + rel + '"]'); if (!l) { l = document.createElement("link"); l.rel = rel; document.head.appendChild(l); } if (l.getAttribute("href") !== href) l.href = href; };
  L("icon", BFN + q + "&icon=1"); L("apple-touch-icon", BFN + q + "&icon=1"); }
function paint(c) { const R = document.documentElement.style, ogv = c.id === OGV, lg = $("#hlogo");
  if (lg) lg.src = ogv ? "../icons/ogv-192.png" : c.logo && /^(https?:|data:|\.\.\/)/.test(c.logo) ? c.logo : "../icons/icon-192.png";
  if (c.color && !ogv) { const h = c.color.replace("#", ""), [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); R.setProperty("--yellow", c.color); R.setProperty("--onY", .2126 * r + .7152 * g + .0722 * b > .5 ? "#111" : "#fff"); }
  const short = c.short || c.name; if (short) { document.title = "Testen · " + short; $("#hclub").textContent = "Testen afnemen · " + short; } }

/* ---------- de testlink ---------- */
(function () { const u = new URLSearchParams(location.search), s = u.get("s"); if (s && /^[a-z0-9_]{24,}$/i.test(s)) { ls.set("fch-test-tok", s); TOK = s; } else TOK = ls.get("fch-test-tok", ""); })();
const msgCard = (t, x) => { app.innerHTML = `<div class="card center"><h2>${t}</h2><p>${x}</p></div>`; };

async function start() {
  if (!TOK) return msgCard("Open je testlink", "Deze app werkt met een testlink die je van de club kreeg (via WhatsApp of mail). Tik op die link om te beginnen. Een account is niet nodig.");
  let r; try { r = await sb.rpc("test_link_info", { tok: TOK }); } catch (e) { r = { error: e }; }
  if (r.error) { const c = ls.get("fch-test-info", null); if (!navigator.onLine && c) r = { data: c }; else return msgCard("Geen verbinding", `Laden lukt niet. Controleer je verbinding.<br><br><button class="btn" type="button" onclick="start()">Opnieuw</button>`); }
  if (!r.data) { ls.set("fch-test-info", null); return msgCard("Deze testlink werkt niet meer", "De link is verlopen of ingetrokken. Vraag een nieuwe link aan de club."); }
  ls.set("fch-test-info", r.data);
  CLUB = r.data.club || {}; TESTS = r.data.tests || []; TEAMS = (r.data.teams || []).sort((a, b) => (parseInt(String(a.category || a.name).replace(/\D+/g, "")) || 99) - (parseInt(String(b.category || b.name).replace(/\D+/g, "")) || 99) || a.name.localeCompare(b.name));
  if (CLUB.id) { brandIcons(CLUB.id); paint(CLUB); }
  /* op het beginscherm zetten: de link (met de sleutel) wordt de startpagina, ook op iPhone */
  try { const u = location.origin + location.pathname + "?s=" + encodeURIComponent(TOK), sh = CLUB.short || CLUB.name || "";
    const m = { name: "Testen" + (sh ? " · " + sh : ""), short_name: "Testen", start_url: u, scope: location.origin + location.pathname, display: "standalone", background_color: "#0E0F0C", theme_color: "#121311",
      icons: [{ src: CLUB.id ? BFN + "?club=" + CLUB.id + "&icon=1" : location.origin + "/icons/icon-512.png", sizes: "512x512", type: "image/png" }] };
    let l = document.querySelector('link[rel="manifest"]'); if (l) l.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: "application/manifest+json" }));
    if (!new URLSearchParams(location.search).get("s") && history.replaceState) history.replaceState(null, "", u); } catch (e) {}
  $("#out").hidden = false; $("#out").textContent = NAAM ? NAAM.split(" ")[0] : "Naam";
  flush();
  if (!NAAM) return askName(); setup();
}
function askName() {
  app.innerHTML = `<form class="card center" id="nf"><h2>Wie neemt de testen af?</h2><p class="hint" style="margin:-4px 0 14px">Je naam wordt bij elk resultaat bewaard, zodat de club weet wie het invulde. Een account is niet nodig.</p>
    <label>Voornaam en naam<input name="nm" required maxlength="60" autocomplete="name" value="${esc(NAAM)}"></label><button class="btn" type="submit">Verder</button></form>`;
  $("#nf").onsubmit = e => { e.preventDefault(); NAAM = e.target.nm.value.trim(); ls.set("fch-test-naam", NAAM); $("#out").textContent = NAAM.split(" ")[0]; setup(); };
}

/* ---------- stap 1: ploeg, test en datum ---------- */
function setup(err) {
  if (!TESTS.length) { app.innerHTML = `<div class="card center"><h2>Nog geen testen</h2><p>De club heeft nog geen testen aangemaakt.</p><button class="btn" type="button" id="re">Opnieuw kijken</button></div>`; $("#re").onclick = start; return; }
  if (!TEAMS.length) { app.innerHTML = `<div class="card center"><h2>Geen ploegen</h2><p>Deze testlink geeft geen toegang tot een ploeg.</p></div>`; return; }
  if (!TEAMS.some(t => t.id === ST.team)) ST.team = TEAMS[0].id;
  if (!TESTS.some(t => t.id === ST.test)) ST.test = TESTS[0].id;
  if (!ST.date || ST.dateSet !== today() || ST.date < minDate()) { ST.date = today(); ST.dateSet = today(); }
  const t = TESTS.find(x => x.id === ST.test), q = Q.get().length;
  app.innerHTML = `${err ? `<div class="msg">${esc(err)}</div>` : ""}${q ? `<div class="q">${q} resultaat${q > 1 ? "en wachten" : " wacht"} op bereik en ${q > 1 ? "worden" : "wordt"} vanzelf verstuurd.</div>` : ""}
  ${TEAMS.length > 1 ? `<section class="card"><h2><span class="no">1</span>Ploeg</h2><div class="tchips">${TEAMS.map(x => `<button type="button" class="chip${x.id === ST.team ? " on" : ""}" data-team="${x.id}">${esc(tlbl(x))}</button>`).join("")}</div><p></p></section>` : `<section class="card"><h2><span class="no">1</span>${esc(TEAMS[0].name)}</h2></section>`}
  <section class="card"><h2><span class="no">2</span>Test</h2><div class="tchips">${TESTS.map(x => `<button type="button" class="chip${x.id === ST.test ? " on" : ""}" data-test="${x.id}">${esc(x.name)}</button>`).join("")}</div><p></p>
    ${t.uitleg ? `<div class="uitl">${esc(t.uitleg)}</div>` : ""}<p class="hint" style="margin:0 0 14px">${esc(t.unit ? "Eenheid: " + t.unit + " · " : "")}${low(t) ? "lager is beter" : "hoger is beter"}${(+t.tries || 1) > 1 ? ` · ${+t.tries} pogingen, de beste telt` : ""}</p></section>
  <section class="card"><h2><span class="no">3</span>Datum</h2><label>Testdag<input type="date" id="dt" value="${esc(ST.date)}" min="${minDate()}" max="${today()}"></label></section>
  <div class="bar"><button class="btn" type="button" id="go">Start met ${esc(t.name)}</button></div>`;
  $$("[data-team]").forEach(b => b.onclick = () => { ST.team = b.dataset.team; ls.set("fch-test-st", ST); setup(); });
  $$("[data-test]").forEach(b => b.onclick = () => { ST.test = b.dataset.test; ls.set("fch-test-st", ST); setup(); });
  $("#dt").onchange = e => { const v = e.target.value; ST.date = v && v <= today() && v >= minDate() ? v : today(); ls.set("fch-test-st", ST); };
  $("#go").onclick = run;
}

/* ---------- stap 2: invullen per speler ---------- */
async function run() {
  ls.set("fch-test-st", ST); scrollTo(0, 0);
  app.innerHTML = `<p class="hint" style="text-align:center;margin-top:20vh">Spelers laden…</p>`;
  const cache = ls.get("fch-test-pl2", {});
  try {
    const r = await sb.rpc("test_link_spelers", { tok: TOK, t: ST.team }); if (r.error) throw r.error;
    PL = r.data || []; cache[ST.team] = PL; ls.set("fch-test-pl2", cache);
    const m = await sb.rpc("test_link_mine", { tok: TOK, t: ST.team, test: ST.test, d: ST.date }); if (m.error) throw m.error;
    RES = new Map((m.data || []).map(x => [x.player_id, { value: +x.value, tries: x.tries ? x.tries.map(Number) : null }]));
  } catch (e) {
    if (/niet \(meer\) geldig/i.test(e.message || "")) return start();
    if (!navigator.onLine && cache[ST.team]) { PL = cache[ST.team]; RES = new Map(); }
    else { setup("Laden lukt niet. Controleer je verbinding en probeer opnieuw."); return; } }
  for (const it of Q.get()) if (it.t === ST.team && it.test === ST.test && it.d === ST.date) { if (it.val == null) RES.delete(it.player); else RES.set(it.player, { value: it.val, tries: it.tr }); }
  draw();
}
function draw() {
  const t = TESTS.find(x => x.id === ST.test), team = TEAMS.find(x => x.id === ST.team), n = Math.max(1, Math.min(5, +t.tries || 1)), timed = /^(s|sec|seconden?)$/i.test(t.unit || "");
  const done = () => PL.filter(p => RES.has(p.id)).length;
  const info = p => { const r = RES.get(p.id); return r ? "Ingevuld: " + fmt(t, r.value) : ""; };
  app.innerHTML = `<div class="tbar"><button class="back" type="button" id="bk" aria-label="Andere test kiezen">‹</button><div><b>${esc(t.name)}</b><small>${esc(tlbl(team))} · ${esc(dNice(ST.date))}</small></div><span class="sp"></span><span class="cnt" id="cnt">${done()}/${PL.length}</span></div>
    ${navigator.onLine ? "" : `<div class="q">Geen bereik: je resultaten worden bewaard en later verstuurd.</div>`}
    ${t.uitleg ? `<details class="uitl" style="margin:0 0 12px"><summary><b>Hoe werkt deze test?</b></summary><p style="margin:8px 0 0">${esc(t.uitleg)}</p></details>` : ""}
    ${timed ? `<div class="sw"><span id="swt">0,00</span><button type="button" id="swgo">Start</button><button type="button" class="z" id="swz">Nul</button><small>Stop zet de tijd bij de gekozen speler.</small></div>` : ""}
    ${PL.length ? PL.map(p => { const r = RES.get(p.id), tr = r ? (r.tries?.length ? r.tries : [r.value]) : [];
      return `<div class="pr${r ? " ok" : ""}" data-p="${p.id}"><div class="pn"><i>${p.number ?? "–"}</i><div style="min-width:0"><b>${esc(pname(p))}</b><small class="inf">${esc(info(p))}</small></div></div>
        <div class="ins${n > 2 ? " m" : ""}">${Array.from({ length: n }, (_, k) => `<input type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="${esc(pname(p))}${n > 1 ? " poging " + (k + 1) : ""}" placeholder="${n > 1 ? "P" + (k + 1) : esc(t.unit || "…")}" value="${tr[k] != null ? String(tr[k]).replace(".", ",") : ""}">`).join("")}</div></div>`; }).join("") : `<div class="card"><p>Deze ploeg heeft nog geen spelers.</p></div>`}
    <div class="bar"><button class="btn" type="button" id="klaar">Klaar met deze test</button></div>`;
  const ins = $$(".ins input"); let cur = null; const tm = {};
  const save = row => { const p = PL.find(x => x.id === row.dataset.p), els = $$("input", row), vals = els.map(i => num(i.value));
    const bad = els.some(i => i.value.trim() && num(i.value) == null); row.classList.toggle("bad", bad);
    if (bad) { $(".inf", row).textContent = "Enkel cijfers, bv. 3,45"; return; }
    const b = best(t, vals), tries = n > 1 ? vals.filter(x => x != null) : null, old = RES.get(p.id);
    if (b == null) { if (!old) return; RES.delete(p.id); row.classList.remove("ok"); }
    else { if (old && old.value === b && JSON.stringify(old.tries || null) === JSON.stringify(tries)) return; RES.set(p.id, { value: b, tries }); row.classList.add("ok"); }
    push({ t: ST.team, player: p.id, test: t.id, d: ST.date, val: b, tr: tries });
    $(".inf", row).textContent = info(p) + (navigator.onLine ? "" : " · wacht op bereik"); const c = $("#cnt"); if (c) c.textContent = done() + "/" + PL.length; };
  ins.forEach((inp, j) => {
    inp.onfocus = () => { cur = inp; $$(".pr.cur").forEach(r => r.classList.remove("cur")); inp.closest(".pr").classList.add("cur"); };
    inp.oninput = () => { const row = inp.closest(".pr"); clearTimeout(tm[row.dataset.p]); tm[row.dataset.p] = setTimeout(() => save(row), 700); };
    inp.onblur = () => { const row = inp.closest(".pr"); setTimeout(() => { if (!row.contains(document.activeElement)) { clearTimeout(tm[row.dataset.p]); save(row); } }, 0); };
    inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const nx = ins[j + 1]; if (nx) nx.focus(); else inp.blur(); } }; });
  $("#bk").onclick = () => { $$(".pr").forEach(save); setup(); scrollTo(0, 0); };
  $("#klaar").onclick = () => { $$(".pr").forEach(save); summary(t, team); };
  if (timed) { const out = $("#swt"), go = $("#swgo"); let t0 = 0, raf = 0;
    const tick = () => { out.textContent = ((performance.now() - t0) / 1000).toFixed(2).replace(".", ","); raf = requestAnimationFrame(tick); };
    go.onmousedown = e => e.preventDefault();
    go.onclick = () => { if (!raf) { t0 = performance.now(); tick(); go.textContent = "Stop"; go.classList.add("stop"); return; }
      cancelAnimationFrame(raf); raf = 0; go.textContent = "Start"; go.classList.remove("stop"); const s = ((performance.now() - t0) / 1000).toFixed(2).replace(".", ",");
      const tg = cur && !cur.value.trim() ? cur : ins.find(i => !i.value.trim()); if (tg) { tg.value = s; tg.focus(); save(tg.closest(".pr")); const nx = ins[ins.indexOf(tg) + 1]; if (nx) setTimeout(() => nx.focus(), 60); } };
    $("#swz").onclick = () => { cancelAnimationFrame(raf); raf = 0; out.textContent = "0,00"; go.textContent = "Start"; go.classList.remove("stop"); }; }
  (ins.find(i => !i.value.trim()))?.closest(".pr")?.scrollIntoView({ block: "center" });
}

function summary(t, team) {
  const n = PL.filter(p => RES.has(p.id)).length, q = Q.get().length, miss = PL.filter(p => !RES.has(p.id));
  app.innerHTML = `<div class="card done"><div class="ok">✓</div><h2 style="justify-content:center">${esc(t.name)} doorgestuurd</h2><p class="hint">${esc(tlbl(team))} · ${esc(dNice(ST.date))}. ${n} van ${PL.length} spelers getest. De trainers zien de resultaten nu in hun app.</p></div>
    ${q && !navigator.onLine ? `<div class="q">${q} resultaat${q > 1 ? "en wachten" : " wacht"} nog op bereik en ${q > 1 ? "worden" : "wordt"} vanzelf verstuurd.</div>` : ""}
    ${miss.length ? `<div class="card"><h2>Nog niet getest</h2><p>${miss.map(p => esc(pname(p))).join(", ")}</p></div>` : ""}
    <div class="steps"><button class="btn" type="button" id="nx">Volgende test</button><button class="btn ghost" type="button" id="ed">Terug naar de lijst</button></div>`;
  scrollTo(0, 0); $("#nx").onclick = () => { const i = TESTS.findIndex(x => x.id === ST.test); ST.test = TESTS[(i + 1) % TESTS.length].id; setup(); }; $("#ed").onclick = draw;
}

/* ---------- versturen, ook als er even geen bereik is ---------- */
const key = x => [x.t, x.player, x.test, x.d].join("|");
function push(it) { const q = Q.get().filter(x => key(x) !== key(it)); q.push(it); Q.set(q); flush(); }
let busy = false;
async function flush() { if (busy || !navigator.onLine || !TOK) return; busy = true;
  try { let q = Q.get();
    while (q.length) { const it = q[0];
      const r = await sb.rpc("test_link_save", { tok: TOK, t: it.t, player: it.player, test: it.test, d: it.d, val: it.val, tr: it.tr, naam: NAAM || null });
      if (r.error && /fetch|network|Failed/i.test(r.error.message || "")) break;
      if (r.error) markErr(it, r.error.message);
      q = Q.get().filter(x => JSON.stringify(x) !== JSON.stringify(it)); Q.set(q); }
  } finally { busy = false; } }
function markErr(it, m) { const row = $(`.pr[data-p="${it.player}"]`), inf = row && $(".inf", row); if (inf) { row.classList.add("bad"); row.classList.remove("ok"); inf.textContent = "Niet bewaard: " + m; } }
addEventListener("online", flush); setInterval(flush, 20000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

$("#out").onclick = askName; $("#out").title = "Naam wijzigen";
start();
/* zelfde service worker als de trainersapp: de testapp opent ook zonder bereik, als je ze al eens opende */
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("../sw.js").catch(() => {}));
