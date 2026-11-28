/* FootballCoachHub — aparte gsm-app voor wie fysieke testen afneemt.
   Zelfde aanmelding en database als de trainersapp. Toegang met de testcode van de club (Beheer › Instellingen › Fysieke testen);
   een beheerder laat nieuwe testafnemers eerst toe. Resultaten gaan naar fit_results en staan meteen in de trainersapp. */
"use strict";
const BFN = "https://intswyovpwiigdwmgjfz.supabase.co/functions/v1/brand";
const SB_URL = "https://intswyovpwiigdwmgjfz.supabase.co", SB_KEY = "sb_publishable_mGTwxXL1HjKgnJcgSATtxQ_6CvHJ-3W";
const OGV = "00000000-0000-4000-8000-000000000001";
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "tb_auth", lock: async (_n, _t, fn) => await fn() } });
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
const tlbl = t => String(t?.name || "").replace(new RegExp("^(OGV|" + (CLUB.short || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\s+", "i"), "").trim() || t?.category || "Ploeg";
const HERE = location.origin + location.pathname;

let CLUB = {}, TESTS = [], TEAMS = [], ST = ls.get("fch-test-st", {}), PL = [], RES = new Map(), PREV = new Map();
/* wachtrij voor resultaten zonder bereik: [{rec}] of [{del:{player_id,test_id,date}}] */
const Q = { get: () => ls.get("fch-test-q", []), set: q => ls.set("fch-test-q", q) };

/* ---------- huisstijl van de club ---------- */
function brandIcons(id) { try { localStorage.setItem("fch-test-club", id); } catch (e) {} const q = "?club=" + id;
  const L = (rel, href) => { let l = document.querySelector('link[rel="' + rel + '"]'); if (!l) { l = document.createElement("link"); l.rel = rel; document.head.appendChild(l); } if (l.getAttribute("href") !== href) l.href = href; };
  L("manifest", BFN + q + "&app=test"); L("icon", BFN + q + "&icon=1"); L("apple-touch-icon", BFN + q + "&icon=1"); }
function paint(color, logo, short, id) { const R = document.documentElement.style, ogv = id === OGV, lg = $("#hlogo");
  if (lg) lg.src = ogv ? "../icons/ogv-192.png" : logo && /^(https?:|data:|\.\.\/)/.test(logo) ? logo : "../icons/icon-192.png";
  if (color && !ogv) { const h = color.replace("#", ""), [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); R.setProperty("--yellow", color); R.setProperty("--onY", .2126 * r + .7152 * g + .0722 * b > .5 ? "#111" : "#fff"); }
  if (short) { document.title = "Testen · " + short; $("#hclub").textContent = "Testen afnemen · " + short; } }
(function () { const u = new URLSearchParams(location.search); try { const k = u.get("k"); if (k) localStorage.setItem("ogv-testcode", JSON.stringify(k.trim().toUpperCase())); } catch (e) {}
  let id = u.get("c"); try { id = id || localStorage.getItem("fch-test-club"); } catch (e) {}
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return; brandIcons(id);
  fetch(BFN + "?club=" + id + "&info=1").then(r => r.ok ? r.json() : null).then(c => { if (c) { window.LINKC = c; paint(c.color, c.logo, c.short || c.name, c.id); } }).catch(() => {}); })();

/* ---------- aanmelden en toegang ---------- */
const codeForm = (title, txt) => `<form class="card center" id="jf"><h2>${title}</h2><p>${txt}</p>
  <label>Testcode<input name="code" required autocomplete="off" placeholder="bv. T1A2B3C4" style="text-transform:uppercase"></label><div id="jerr"></div><button class="btn" type="submit">Toegang vragen</button>
  <p class="hint" style="text-align:center;margin-top:14px"><button type="button" class="lnk" id="jother">Ander account gebruiken</button></p></form>`;
function bindCode() {
  $("#jother").onclick = async () => { await sb.auth.signOut(); login("", "in"); };
  $("#jf").onsubmit = async e => { e.preventDefault(); const j = await sb.rpc("join_test", { code: e.target.code.value.trim() });
    if (j.data) { ls.set("ogv-testcode", ""); start(); } else $("#jerr").innerHTML = `<div class="msg">${j.error ? esc(j.error.message) : "Deze testcode klopt niet. Vraag de juiste code aan de beheerder van de club."}</div>`; }; }

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return login();
  $("#out").hidden = false;
  let d = (await sb.rpc("club_status")).data || {};
  const mag = x => x.member && (x.admin || (x.rechten || []).includes("tester"));
  const pend = ls.get("ogv-testcode", "");
  if (pend && !mag(d)) { const j = await sb.rpc("join_test", { code: pend }); if (j.data) { ls.set("ogv-testcode", ""); d = (await sb.rpc("club_status")).data || {}; } }
  /* de club van de link gaat voor */
  let want = null; try { want = new URLSearchParams(location.search).get("c") || localStorage.getItem("fch-test-club"); } catch (e) {}
  if (want && /^[0-9a-f-]{36}$/i.test(want) && d.club && d.club.id !== want) { const sw = await sb.rpc("switch_club", { c: want }); if (sw.data) d = (await sb.rpc("club_status")).data || {}; }
  if (!d.member && d.pending) {
    app.innerHTML = `<div class="card center"><h2>Wacht op goedkeuring</h2><p>Je bent aangemeld als <b>${esc(session.user.email)}</b>. De beheerder van de club moet je nog toelaten als testafnemer. Zodra dat gebeurd is, kan je hier testen invullen.</p>
      <button class="btn" type="button" id="re">Opnieuw kijken</button><p class="hint" style="text-align:center;margin-top:14px"><button type="button" class="lnk" id="jother">Ander account gebruiken</button></p></div>`;
    $("#re").onclick = start; $("#jother").onclick = async () => { await sb.auth.signOut(); login("", "in"); }; return; }
  if (!mag(d)) { app.innerHTML = codeForm("Nog geen toegang", `Je bent aangemeld als <b>${esc(session.user.email)}</b>. Vul de testcode in die je van de club kreeg.`); bindCode(); return; }
  CLUB = d.club || {}; const st = CLUB.settings || {};
  brandIcons(CLUB.id); paint(st.color, st.logo, CLUB.short || CLUB.name, CLUB.id);
  if ((st.hidden || []).includes("testen")) { app.innerHTML = `<div class="card center"><h2>Fysieke testen staan uit</h2><p>De club gebruikt de fysieke testen niet. Vraag de beheerder om ze aan te zetten.</p></div>`; return; }
  TESTS = (Array.isArray(st.tests) ? st.tests : []).filter(t => t && t.id && t.name && !t.off);
  const tr = await sb.from("teams").select("id,name,category").eq("club_id", CLUB.id);
  TEAMS = (tr.data || []).sort((a, b) => (parseInt(String(a.category || a.name).replace(/\D+/g, "")) || 99) - (parseInt(String(b.category || b.name).replace(/\D+/g, "")) || 99) || a.name.localeCompare(b.name));
  flush(); setup();
}

function login(err, tab = "in", ok) {
  $("#out").hidden = true;
  const tabs = `<div class="chips" style="margin-bottom:14px">${[["in", "Aanmelden"], ["nieuw", "Account aanmaken"]].map(([k, l]) => `<button type="button" class="chip${tab === k ? " on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>`;
  const msg = (err ? `<div class="msg">${esc(err)}</div>` : "") + (ok ? `<div class="msg" style="background:#DCF5E3;color:var(--ok)">${esc(ok)}</div>` : "");
  const code = ls.get("ogv-testcode", "");
  if (tab === "nieuw") app.innerHTML = `<form class="card center" id="rf">${tabs}<h2>Account aanmaken</h2><p class="hint" style="margin:-4px 0 14px">Je hebt de testcode nodig die je van de club kreeg. Daarna laat de beheerder je toe.</p>${msg}
    <label>Voornaam en naam<input name="nm" required maxlength="60" autocomplete="name"></label><label>E-mailadres<input name="email" type="email" required autocomplete="email"></label>
    <label>Wachtwoord <span class="hint">minstens 8 tekens</span><input name="pw" type="password" required minlength="8" autocomplete="new-password"></label>
    <label>Testcode<input name="code" required autocomplete="off" placeholder="bv. T1A2B3C4" value="${esc(code)}" style="text-transform:uppercase"></label><button class="btn" type="submit">Account aanmaken</button></form>`;
  else if (tab === "reset") app.innerHTML = `<form class="card center" id="pf"><h2>Nieuw wachtwoord</h2>${msg}<label>Nieuw wachtwoord <span class="hint">minstens 8 tekens</span><input name="pw" type="password" required minlength="8" autocomplete="new-password"></label><button class="btn" type="submit">Opslaan</button></form>`;
  else app.innerHTML = `<form class="card center" id="lf">${tabs}<h2>Aanmelden</h2>${msg}<p class="hint" style="margin:-4px 0 14px">Heb je al een account voor de trainersapp of de scoutapp? Meld je dan hier aan met hetzelfde account.</p>
    <label>E-mailadres<input name="email" type="email" autocomplete="email" required></label><label>Wachtwoord<input name="pw" type="password" autocomplete="current-password" required></label>
    <button class="btn" type="submit">Aanmelden</button><p class="hint" style="text-align:center;margin-top:14px"><button type="button" class="lnk" id="forgot">Wachtwoord vergeten?</button></p></form>`;
  $$("[data-tab]").forEach(b => b.onclick = () => login("", b.dataset.tab));
  const lf = $("#lf"); if (lf) { lf.onsubmit = async e => { e.preventDefault(); e.target.querySelector("button[type=submit]").textContent = "Even geduld…";
      const { error } = await sb.auth.signInWithPassword({ email: e.target.email.value.trim(), password: e.target.pw.value });
      if (error) login(/confirm/i.test(error.message) ? "Bevestig eerst je e-mailadres via de link in de mail die je kreeg." : "Aanmelden lukt niet. Controleer je e-mailadres en wachtwoord."); else start(); };
    $("#forgot").onclick = async () => { const m = lf.email.value.trim(); if (!m) { login("Vul eerst je e-mailadres in."); return; }
      await sb.auth.resetPasswordForEmail(m, { redirectTo: HERE }); login("", "in", "Als dit adres een account heeft, staat er nu een mail met een link om een nieuw wachtwoord te kiezen."); }; }
  const rf = $("#rf"); if (rf) rf.onsubmit = async e => { e.preventDefault(); const f = e.target, c = f.code.value.trim().toUpperCase(); f.querySelector("button[type=submit]").textContent = "Even geduld…";
    ls.set("ogv-testcode", c);
    const { data, error } = await sb.auth.signUp({ email: f.email.value.trim(), password: f.pw.value, options: { data: { full_name: f.nm.value.trim(), testcode: c }, emailRedirectTo: HERE } });
    if (error) { const ex = /already|exists/i.test(error.message); login(ex ? "Er bestaat al een account met dit e-mailadres. Meld je aan." : /password/i.test(error.message) ? "Kies een sterker wachtwoord (minstens 8 tekens)." : "Account aanmaken lukt niet: " + error.message, ex ? "in" : "nieuw"); return; }
    if (data.session) start(); else login("", "in", "Bijna klaar: klik op de link in de mail die we je stuurden en meld je daarna hier aan."); };
  const pf = $("#pf"); if (pf) pf.onsubmit = async e => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: e.target.pw.value }); if (error) login("Dat lukte niet: " + error.message, "reset"); else start(); };
}

/* ---------- stap 1: ploeg, test en datum ---------- */
function setup(err) {
  if (!TESTS.length) { app.innerHTML = `<div class="card center"><h2>Nog geen testen</h2><p>De beheerder maakt eerst de testen van de club aan in Beheer › Instellingen › Fysieke testen.</p><button class="btn" type="button" id="re">Opnieuw kijken</button></div>`; $("#re").onclick = start; return; }
  if (!TEAMS.length) { app.innerHTML = `<div class="card center"><h2>Geen ploegen</h2><p>De club heeft nog geen ploegen in de app.</p></div>`; return; }
  if (!TEAMS.some(t => t.id === ST.team)) ST.team = TEAMS[0].id;
  if (!TESTS.some(t => t.id === ST.test)) ST.test = TESTS[0].id;
  if (!ST.date || ST.dateSet !== today()) { ST.date = today(); ST.dateSet = today(); }
  const t = TESTS.find(x => x.id === ST.test), q = Q.get().length;
  app.innerHTML = `${err ? `<div class="msg">${esc(err)}</div>` : ""}${q ? `<div class="q">${q} resultaat${q > 1 ? "en wachten" : " wacht"} op bereik en ${q > 1 ? "worden" : "wordt"} vanzelf verstuurd.</div>` : ""}
  <section class="card"><h2><span class="no">1</span>Ploeg</h2><div class="tchips">${TEAMS.map(x => `<button type="button" class="chip${x.id === ST.team ? " on" : ""}" data-team="${x.id}">${esc(tlbl(x))}</button>`).join("")}</div><p></p></section>
  <section class="card"><h2><span class="no">2</span>Test</h2><div class="tchips">${TESTS.map(x => `<button type="button" class="chip${x.id === ST.test ? " on" : ""}" data-test="${x.id}">${esc(x.name)}</button>`).join("")}</div><p></p>
    ${t.uitleg ? `<div class="uitl">${esc(t.uitleg)}</div>` : ""}<p class="hint" style="margin:0 0 14px">${esc(t.unit ? "Eenheid: " + t.unit + " · " : "")}${low(t) ? "lager is beter" : "hoger is beter"}${(+t.tries || 1) > 1 ? ` · ${+t.tries} pogingen, de beste telt` : ""}</p></section>
  <section class="card"><h2><span class="no">3</span>Datum</h2><label>Testdag<input type="date" id="dt" value="${esc(ST.date)}" max="${today()}"></label></section>
  <div class="bar"><button class="btn" type="button" id="go">Start met ${esc(t.name)}</button></div>`;
  $$("[data-team]").forEach(b => b.onclick = () => { ST.team = b.dataset.team; ls.set("fch-test-st", ST); setup(); });
  $$("[data-test]").forEach(b => b.onclick = () => { ST.test = b.dataset.test; ls.set("fch-test-st", ST); setup(); });
  $("#dt").onchange = e => { ST.date = e.target.value || today(); ls.set("fch-test-st", ST); };
  $("#go").onclick = run;
}

/* ---------- stap 2: invullen per speler ---------- */
async function run() {
  ls.set("fch-test-st", ST); scrollTo(0, 0);
  app.innerHTML = `<p class="hint" style="text-align:center;margin-top:20vh">Spelers laden…</p>`;
  const cache = ls.get("fch-test-pl", {});
  try {
    const r = await sb.rpc("test_spelers", { t: ST.team }); if (r.error) throw r.error;
    PL = r.data || []; cache[ST.team] = PL; ls.set("fch-test-pl", cache);
    const rs = await sb.from("fit_results").select("player_id,date,value,tries").eq("team_id", ST.team).eq("test_id", ST.test); if (rs.error) throw rs.error;
    RES = new Map(); PREV = new Map();
    for (const x of rs.data || []) { if (x.date === ST.date) RES.set(x.player_id, x); else if (x.date < ST.date) { const o = PREV.get(x.player_id); if (!o || o.date < x.date) PREV.set(x.player_id, x); } }
  } catch (e) {
    if (!navigator.onLine && cache[ST.team]) { PL = cache[ST.team]; RES = new Map(); PREV = new Map(); }
    else { setup(/Geen toegang/i.test(e.message || "") ? "Je hebt geen toegang meer tot deze ploeg. Vraag het na bij de beheerder." : "Laden lukt niet. Controleer je verbinding en probeer opnieuw."); return; } }
  for (const it of Q.get()) { const r = it.rec || it.del; if (r.test_id === ST.test && r.date === ST.date && PL.some(p => p.id === r.player_id)) { if (it.rec) RES.set(r.player_id, it.rec); else RES.delete(r.player_id); } }
  draw();
}
function draw() {
  const t = TESTS.find(x => x.id === ST.test), team = TEAMS.find(x => x.id === ST.team), n = Math.max(1, Math.min(5, +t.tries || 1)), timed = /^(s|sec|seconden?)$/i.test(t.unit || "");
  const done = () => PL.filter(p => RES.has(p.id)).length;
  const info = p => { const r = RES.get(p.id), pv = PREV.get(p.id); return r ? "Resultaat: " + fmt(t, r.value) + (pv ? ` · vorige keer ${fmt(t, pv.value)}` : "") : pv ? `Vorige keer: ${fmt(t, pv.value)}` : ""; };
  app.innerHTML = `<div class="tbar"><button class="back" type="button" id="bk" aria-label="Andere test kiezen">‹</button><div><b>${esc(t.name)}</b><small>${esc(tlbl(team))} · ${esc(dNice(ST.date))}</small></div><span class="sp"></span><span class="cnt" id="cnt">${done()}/${PL.length}</span></div>
    ${navigator.onLine ? "" : `<div class="q">Geen bereik: je resultaten worden bewaard en later verstuurd.</div>`}
    ${t.uitleg ? `<details class="uitl" style="margin:0 0 12px"><summary><b>Hoe werkt deze test?</b></summary><p style="margin:8px 0 0">${esc(t.uitleg)}</p></details>` : ""}
    ${timed ? `<div class="sw"><span id="swt">0,00</span><button type="button" id="swgo">Start</button><button type="button" class="z" id="swz">Nul</button><small>Stop zet de tijd bij de gekozen speler.</small></div>` : ""}
    ${PL.length ? PL.map((p, i) => { const r = RES.get(p.id), tr = r ? (r.tries?.length ? r.tries : [r.value]) : [];
      return `<div class="pr${r ? " ok" : ""}" data-p="${p.id}"><div class="pn"><i>${p.number ?? "–"}</i><div style="min-width:0"><b>${esc(pname(p))}</b><small class="inf">${esc(info(p))}</small></div></div>
        <div class="ins${n > 2 ? " m" : ""}">${Array.from({ length: n }, (_, k) => `<input type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="${esc(pname(p))}${n > 1 ? " poging " + (k + 1) : ""}" placeholder="${n > 1 ? "P" + (k + 1) : esc(t.unit || "…")}" value="${tr[k] != null ? String(tr[k]).replace(".", ",") : ""}">`).join("")}</div></div>`; }).join("") : `<div class="card"><p>Deze ploeg heeft nog geen spelers.</p></div>`}
    <div class="bar"><button class="btn" type="button" id="klaar">Klaar met deze test</button></div>`;
  const ins = $$(".ins input"); let cur = null; const tm = {};
  const save = row => { const p = PL.find(x => x.id === row.dataset.p), els = $$("input", row), vals = els.map(i => num(i.value));
    const bad = els.some(i => i.value.trim() && num(i.value) == null); row.classList.toggle("bad", bad);
    if (bad) { $(".inf", row).textContent = "Enkel cijfers, bv. 3,45"; return; }
    const b = best(t, vals), key = { player_id: p.id, test_id: t.id, date: ST.date };
    if (b == null) { if (!RES.has(p.id)) return; RES.delete(p.id); push({ del: key }); row.classList.remove("ok"); }
    else { const tries = n > 1 ? vals.filter(x => x != null) : null, old = RES.get(p.id);
      if (old && old.value === b && JSON.stringify(old.tries || null) === JSON.stringify(tries)) return;
      const rec = { ...key, team_id: ST.team, value: b, tries, updated_at: new Date().toISOString() }; RES.set(p.id, rec); push({ rec }); row.classList.add("ok"); }
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
  const vs = PL.map(p => RES.get(p.id)?.value).filter(v => v != null), q = Q.get().length;
  const top = PL.filter(p => RES.has(p.id)).sort((a, b) => low(t) ? RES.get(a.id).value - RES.get(b.id).value : RES.get(b.id).value - RES.get(a.id).value).slice(0, 3);
  app.innerHTML = `<div class="card done"><div class="ok">✓</div><h2 style="justify-content:center">${esc(t.name)} bewaard</h2><p class="hint">${esc(tlbl(team))} · ${esc(dNice(ST.date))}. De resultaten staan nu bij de ploeg en in het dossier van elke speler.</p></div>
    ${q && !navigator.onLine ? `<div class="q">${q} resultaat${q > 1 ? "en wachten" : " wacht"} nog op bereik en ${q > 1 ? "worden" : "wordt"} vanzelf verstuurd.</div>` : ""}
    <div class="card"><div class="sum"><div><b>${vs.length}/${PL.length}</b><small>getest</small></div><div><b>${vs.length ? fmt({ ...t, unit: "" }, best(t, vs)) : "–"}</b><small>beste</small></div><div><b>${vs.length ? fmt({ ...t, unit: "" }, vs.reduce((a, b) => a + b, 0) / vs.length) : "–"}</b><small>gemiddeld</small></div></div>
      ${top.length ? `<ul class="list">${top.map((p, i) => `<li><b>${i + 1}. ${esc(pname(p))}</b><small>${esc(fmt(t, RES.get(p.id).value))}</small></li>`).join("")}</ul>` : ""}
      ${PL.length > vs.length ? `<p class="hint">Nog niet getest: ${PL.filter(p => !RES.has(p.id)).map(p => esc(pname(p).split(" ")[0])).join(", ")}</p>` : ""}<p></p></div>
    <div class="steps"><button class="btn" type="button" id="nx">Volgende test</button><button class="btn ghost" type="button" id="ed">Terug naar de lijst</button></div>`;
  scrollTo(0, 0); $("#nx").onclick = () => { const i = TESTS.findIndex(x => x.id === ST.test); ST.test = TESTS[(i + 1) % TESTS.length].id; setup(); }; $("#ed").onclick = draw;
}

/* ---------- versturen, ook als er even geen bereik is ---------- */
function push(it) { const k = it.rec || it.del, q = Q.get().filter(x => { const r = x.rec || x.del; return !(r.player_id === k.player_id && r.test_id === k.test_id && r.date === k.date); }); q.push(it); Q.set(q); flush(); }
let busy = false;
async function flush() { if (busy || !navigator.onLine) return; busy = true;
  try { let q = Q.get();
    while (q.length) { const it = q[0];
      const r = it.rec ? await sb.from("fit_results").upsert(it.rec, { onConflict: "player_id,test_id,date" }) : await sb.from("fit_results").delete().match(it.del);
      if (r.error) { if (/fetch|network|Failed/i.test(r.error.message || "")) break; console.warn(r.error); markErr(it, r.error.message); }
      q = Q.get().filter(x => JSON.stringify(x) !== JSON.stringify(it)); Q.set(q); }
  } finally { busy = false; } }
function markErr(it, m) { const k = it.rec || it.del, row = $(`.pr[data-p="${k.player_id}"]`); if (row) { row.classList.add("bad"); inf.textContent = "Niet bewaard: " + (/row-level|policy|permission/i.test(m) ? "geen toegang" : m); } }
addEventListener("online", flush); setInterval(flush, 20000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

$("#out").onclick = async () => { await sb.auth.signOut(); login(); };
let RECOVERY = /type=recovery/.test(location.hash);
sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") { RECOVERY = true; setTimeout(() => login("", "reset"), 0); } });
(RECOVERY ? Promise.resolve(setTimeout(() => login("", "reset"), 300)) : start()).catch(() => login("Er ging iets mis bij het laden. Probeer opnieuw."));
/* zelfde service worker als de trainersapp: de testapp opent ook zonder bereik, als je ze al eens opende */
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("../sw.js").catch(() => {}));
