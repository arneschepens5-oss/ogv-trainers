/* OGV Platform — clubtoegang (registreren met clubcode, clubbeheer), ouders bevestigen aanwezigheid,
   en een ploeg doorschuiven naar een nieuw seizoen. */
"use strict";

/* ============ registreren met de clubcode ============ */
function viewRegister(v) {
  v.innerHTML = `<div class="authbox"><h1>OGV<span>Trainers</span></h1><p class="muted">Maak je trainersaccount aan. Je hebt de clubcode nodig die je van de jeugdcoördinator kreeg.</p>
  <form id="rf" style="display:flex;flex-direction:column;gap:12px"><label class="f">E-mailadres<input type="email" name="email" required autocomplete="username"></label>
   <label class="f">Wachtwoord <span class="hint">minstens 8 tekens</span><input type="password" name="pw" required minlength="8" autocomplete="new-password"></label>
   <label class="f">Clubcode<input name="code" required autocomplete="off" placeholder="OGV-…" style="text-transform:uppercase"></label>
   <div class="err" id="rerr"></div><button class="btn">Account aanmaken</button></form>
  <div class="row"><button class="link" type="button" id="toLogin">Ik heb al een account</button></div></div>`;
  $("#toLogin").onclick = () => viewLogin(v);
  $("#rf").onsubmit = async e => { e.preventDefault(); const f = e.target, btn = $("button.btn", f), err = $("#rerr"); err.textContent = "";
    if (!sb) { err.textContent = "Geen verbinding met de database."; return; }
    btn.disabled = true; btn.textContent = "Bezig…";
    const code = f.code.value.trim().toUpperCase(); try { localStorage.setItem("ogv-invite", code); } catch (x) {}
    try { const { data, error } = await sb.auth.signUp({ email: f.email.value.trim(), password: f.pw.value, options: { data: { invite: code }, emailRedirectTo: location.origin + location.pathname } });
      if (error) err.textContent = /not allowed|disabled/i.test(error.message) ? "Registreren staat nog uit. Vraag de beheerder om het aan te zetten in Supabase." : /already registered|exists/i.test(error.message) ? "Er bestaat al een account met dit e-mailadres. Meld je aan." : /password/i.test(error.message) ? "Kies een sterker wachtwoord (minstens 8 tekens)." : error.message;
      else if (!data.session) v.innerHTML = `<div class="authbox"><h1>OGV<span>Trainers</span></h1><div class="panel"><h2 style="margin-top:0">Bevestig je e-mailadres</h2><p class="muted" style="margin:0">We stuurden een mail naar <b style="color:var(--ink)">${esc(f.email.value.trim())}</b>. Klik op de link in die mail en meld je daarna aan.</p></div><button class="btn ghost" type="button" onclick="viewLogin($('#view'))">Naar aanmelden</button></div>`; }
    catch (x) { err.textContent = "Registreren lukt niet: controleer je internetverbinding."; }
    finally { if (err.textContent) { btn.disabled = false; btn.textContent = "Account aanmaken"; } } };
}
/* account bestaat maar is nog geen lid van de club */
function viewJoin(v) {
  let saved = ""; try { saved = localStorage.getItem("ogv-invite") || ""; } catch (x) {}
  v.innerHTML = `<div class="authbox"><h1>OGV<span>Trainers</span></h1><p class="muted">Je bent aangemeld als <b style="color:var(--ink)">${esc(user?.email || "")}</b>, maar je account heeft nog geen toegang tot de club. Vul de clubcode in die je van de jeugdcoördinator kreeg.</p>
  <form id="jf" style="display:flex;flex-direction:column;gap:12px"><label class="f">Clubcode<input name="code" required autocomplete="off" value="${esc(saved)}" placeholder="OGV-…" style="text-transform:uppercase"></label><div class="err" id="jerr"></div><button class="btn">Toegang krijgen</button></form>
  <div class="row"><button class="link" type="button" data-logout>Afmelden</button></div></div>`;
  $("[data-logout]", v).onclick = logout;
  $("#jf").onsubmit = async e => { e.preventDefault(); const btn = $("button.btn", e.target); btn.disabled = true;
    const { data, error } = await sb.rpc("join_club", { code: e.target.code.value.trim() });
    if (error || !data) { $("#jerr").textContent = error ? error.message : "Deze clubcode klopt niet."; btn.disabled = false; return; }
    try { localStorage.removeItem("ogv-invite"); } catch (x) {}
    S.member = true; toast("Welkom bij OGV Trainers."); startCloud(); };
}
async function clubStatus() {
  if (mode === "demo") { S.member = true; S.admin = true; return; }
  try { const { data, error } = await sb.rpc("club_status"); if (error) throw error; S.member = !!data.member; S.admin = !!data.admin;
    if (!S.member) { const code = (() => { try { return localStorage.getItem("ogv-invite"); } catch (x) {} })(); /* code die bij registreren werd ingevuld */
      if (code) { const r = await sb.rpc("join_club", { code }); if (r.data) { S.member = true; try { localStorage.removeItem("ogv-invite"); } catch (x) {} } } } }
  catch (e) { S.member = true; S.admin = false; /* databaseversie 5 nog niet uitgevoerd: gedrag zoals vroeger */ }
}

/* ============ clubbeheer ============ */
route("clubbeheer", { title: "Clubbeheer", auth: true, render: async v => {
  if (!S.admin) { v.innerHTML = `<div class="empty"><b>Alleen voor beheerders</b>Vraag de jeugdcoördinator als je hier iets wil aanpassen.</div>`; return; }
  v.innerHTML = head("Clubbeheer", "Laden…");
  let info; if (mode === "demo") info = { code: "OGV-DEMO42", members: [{ user_id: "demo", email: "demo@ogvorselaar.be", role: "admin", teams: "Demoploeg U9" }, { user_id: "x", email: "trainer.u11@ogvorselaar.be", role: "trainer", teams: "Demoploeg U11" }], waiting: [{ user_id: "y", email: "nieuwe.trainer@gmail.com", created_at: new Date().toISOString() }] };
  else { const { data, error } = await sb.rpc("club_admin_info"); if (error) { v.innerHTML = head("Clubbeheer", "") + `<div class="empty"><b>Laden mislukt</b>${esc(error.message)}</div>`; return; } info = data; }
  const link = location.origin + location.pathname + "#/aanmelden";
  v.innerHTML = head("Clubbeheer", "Wie toegang heeft tot de clubgegevens: uitslagen, verslagen en de scoutingsdatabase.") +
  `<div class="grid2"><div class="panel"><h2>Clubcode</h2><p class="hint" style="margin-top:0">Nieuwe trainers maken zelf een account aan op ${esc(location.host)} met deze code. Deel ze alleen met trainers van de club.</p>
    <div class="codebox"><b id="code">${esc(info.code || "–")}</b><button class="btn ghost small" type="button" id="cpy">${IC.copy}Kopiëren</button></div>
    <div class="row" style="margin-top:12px"><button class="btn ghost small" type="button" id="share">${IC.out}Uitnodiging delen</button><button class="link" type="button" id="newcode">Nieuwe code maken</button></div>
    <p class="hint">Een nieuwe code maken stopt de oude. Wie al lid is, blijft lid.</p></div>
  <div class="panel"><h2>Wachten op toegang</h2>${info.waiting?.length ? `<div class="list">${info.waiting.map(w => `<div class="item static"><span class="main"><b>${esc(w.email)}</b><small>account sinds ${new Date(w.created_at).toLocaleDateString("nl-BE")}</small></span><button class="btn small" type="button" data-ok="${w.user_id}">Toelaten</button></div>`).join("")}</div>`
    : `<p class="hint" style="margin:0">Niemand. Accounts zonder clubcode verschijnen hier, zodat je ze kan toelaten.</p>`}</div></div>
  <div class="sec"><h2>Leden (${info.members.length})</h2><div class="list">${info.members.map(m => `<div class="item static"><span class="av sm" aria-hidden="true">${esc((m.email || "?")[0].toUpperCase())}</span><span class="main"><b>${esc(m.email || "")}</b><small>${esc(m.teams || "nog geen ploeg")}</small></span>
    ${m.role === "admin" ? `<span class="pill w">Beheerder</span>` : ""}${m.user_id === user?.id ? `<span class="hint">jij</span>` : `<button class="link" type="button" data-role="${m.user_id}" data-r="${m.role === "admin" ? "trainer" : "admin"}">${m.role === "admin" ? "Geen beheerder meer" : "Beheerder maken"}</button><button class="link danger" type="button" data-rm="${m.user_id}" data-mail="${esc(m.email || "")}">Toegang intrekken</button>`}</div>`).join("")}</div></div>`;
  const rpc = async (fn, args, ok) => { if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; } const { error } = await sb.rpc(fn, args); if (error) toast(error.message); else { toast(ok); render(); } };
  $("#cpy").onclick = () => { navigator.clipboard?.writeText(info.code); toast("Clubcode gekopieerd."); };
  $("#share").onclick = () => { const txt = `Je bent uitgenodigd voor OGV Trainers, het trainersplatform van OG Vorselaar.\nMaak je account aan op ${link} met de clubcode ${info.code}`;
    if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else { navigator.clipboard?.writeText(txt); toast("Uitnodiging gekopieerd."); } };
  $("#newcode").onclick = () => { const c = prompt("Nieuwe clubcode (minstens 6 tekens):", "OGV-" + Math.random().toString(36).slice(2, 8).toUpperCase()); if (c) rpc("club_set_code", { code: c }, "Nieuwe clubcode ingesteld."); };
  $$("[data-ok]", v).forEach(b => b.onclick = () => rpc("club_set_member", { uid: b.dataset.ok, r: "trainer" }, "Toegelaten."));
  $$("[data-role]", v).forEach(b => b.onclick = () => rpc("club_set_member", { uid: b.dataset.role, r: b.dataset.r }, "Rol aangepast."));
  $$("[data-rm]", v).forEach(b => b.onclick = () => { if (confirm(`Toegang intrekken voor ${b.dataset.mail}? Die persoon is dan ook geen trainer meer van zijn ploegen.`)) rpc("club_set_member", { uid: b.dataset.rm, r: null }, "Toegang ingetrokken."); });
} });

/* ============ ouders bevestigen aanwezigheid ============ */
const rsvpOf = (eid, pid) => (S.rsvp || []).find(r => r.event_id === eid && r.player_id === pid);
const parentUrl = p => location.origin + location.pathname.replace(/index\.html$/, "") + "ouder/" + (mode === "demo" ? "?demo" : "") + "#" + p.parent_token;
async function ensureToken(p) { if (p.parent_token) return p; p.parent_token = uid(); await db.save("players", p); return p; }
async function parentLinks() {
  const ps = active(); if (!ps.length) { toast("Voeg eerst spelers toe."); return; }
  if (mode === "demo") for (const p of ps) await ensureToken(p);
  if (ps.some(p => !p.parent_token)) { toast("Voer eerst het databasescript ogv-update-v5.sql uit in Supabase."); return; }
  const msg = p => `Dag ouders van ${p.first_name}! Via deze link laten jullie weten of ${p.first_name} komt naar de trainingen en wedstrijden van ${S.team.name}: ${parentUrl(p)}\nDeze link is persoonlijk, stuur hem niet door.`;
  const d = dialog(`<div class="dlg"><h2>Ouderlinks</h2><p class="hint" style="margin:0">Elke speler heeft een eigen link. Ouders zien daarop de activiteiten van de komende 6 weken en tikken aan of hun kind komt. Je ziet de antwoorden bij Aanwezigheden.<br><b style="color:var(--ink)">Stuur elke link apart</b>, niet in de groepschat: wie de link heeft, kan antwoorden voor die speler.</p>
    <div class="list">${ps.map(p => `<div class="item static plink" data-p="${p.id}"><span class="main"><b>${esc(pname(p))}</b><small>${esc(parentUrl(p))}</small></span>
      <a class="btn small" href="https://wa.me/?text=${encodeURIComponent(msg(p))}" target="_blank" rel="noopener">WhatsApp</a><button class="btn ghost small" type="button" data-cp="${p.id}">${IC.copy}Kopiëren</button><button class="link" type="button" data-new="${p.id}" title="Maak een nieuwe link; de oude werkt dan niet meer">Nieuwe link</button></div>`).join("")}</div>
    <div class="row"><span class="spacer"></span><button class="btn" type="button" data-close>Klaar</button></div></div>`, "wide");
  $$("[data-cp]", d).forEach(b => b.onclick = () => { const p = S.players.find(x => x.id === b.dataset.cp); navigator.clipboard?.writeText(msg(p)).then(() => toast("Bericht met link gekopieerd."), () => toast(parentUrl(p))); });
  $$("[data-new]", d).forEach(b => b.onclick = async () => { const p = S.players.find(x => x.id === b.dataset.new);
    if (!confirm(`Nieuwe link maken voor ${p.first_name}? De oude link werkt dan niet meer.`)) return;
    p.parent_token = uid(); if (await safe(async () => { await db.save("players", p); return true; }, "Nieuwe link gemaakt.")) { d.close(); parentLinks(); } });
}
/* samenvatting van de antwoorden voor een activiteit */
function rsvpSummary(e) {
  const ps = active(), rs = ps.map(p => rsvpOf(e.id, p.id)).filter(Boolean);
  if (!rs.length) return null;
  return { ja: rs.filter(r => r.status === "ja").length, nee: rs.filter(r => r.status === "nee").length, open: ps.length - rs.length };
}
function rsvpBadge(e, p) {
  const r = rsvpOf(e.id, p.id); if (!r) return `<span class="rsvp none" title="Ouders hebben nog niet geantwoord">geen antwoord</span>`;
  return `<span class="rsvp ${r.status}" title="${r.note ? esc(r.note) : ""}">${r.status === "ja" ? "komt" : "komt niet"}${r.note ? ": " + esc(r.note) : ""}</span>`;
}
async function rsvpApply(e) { /* antwoorden overnemen in de aanwezigheden waar nog niets staat */
  let n = 0; for (const p of active()) { const r = rsvpOf(e.id, p.id); if (!r || attOf(e.id, p.id)) continue;
    await putAtt({ event_id: e.id, player_id: p.id, team_id: S.team.id, tags: [], strengths: [], scores: {}, status: r.status === "ja" ? "aanwezig" : "verwittigd", ...(r.note ? { note: r.note } : {}) }); n++; }
  return n;
}

/* ============ nieuw seizoen ============ */
const nextSeason = s => { const m = String(s || "").match(/(\d{4})\D+(\d{4})/); if (m) return (+m[1] + 1) + "-" + (+m[2] + 1); const y = new Date().getFullYear(); return y + "-" + (y + 1); };
const nextCat = c => String(c || "").replace(/(\d+)/, n => +n + 1);
function seasonForm() {
  const t = S.team, ps = active();
  const d = dialog(`<form class="dlg"><h2>Naar een nieuw seizoen</h2><p class="hint" style="margin:0">Maakt een nieuwe ploeg aan met de spelers die je aanvinkt. Hun evaluaties en cijfers van dit seizoen gaan mee als geschiedenis, en de ouderlinks blijven werken. De huidige ploeg blijft bewaard.</p>
    <div class="fields"><label class="f full">Naam nieuwe ploeg<input name="name" required value="${esc(nextCat(t.name))}"></label>
    <label class="f">Categorie<input name="category" value="${esc(nextCat(t.category))}"></label><label class="f">Seizoen<input name="season" value="${esc(nextSeason(t.season))}"></label>
    <label class="f">Spelvorm<select name="format">${["2v2", "3v3", "5v5", "8v8", "11v11"].map(f => `<option${f === t.format ? " selected" : ""}>${f}</option>`).join("")}</select></label></div>
    <div class="f"><span>Spelers die meegaan</span><div class="pchecks">${ps.map(p => `<label class="check"><input type="checkbox" name="p" value="${p.id}" checked> ${esc(pname(p))}</label>`).join("")}</div></div>
    ${S.trainers.length > 1 ? `<label class="check"><input type="checkbox" name="co" checked> Ook mijn co-trainers toevoegen</label>` : ""}
    <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Nieuwe ploeg maken</button></div></form>`, "wide");
  $("form", d).onsubmit = async ev => { ev.preventDefault(); const f = ev.target, btn = $("button.btn:not(.ghost)", f); btn.disabled = true; btn.textContent = "Bezig…";
    const fmt = f.format.value, nt = { id: uid(), name: f.name.value.trim(), category: f.category.value.trim(), format: fmt, season: f.season.value.trim(), criteria: t.criteria || DEF_CRIT, worktags: t.worktags || DEF_TAGS,
      share_ratings: !!t.share_ratings, periods: fmt === t.format ? t.periods : (FORMAT_DEF[fmt] || [])[0] || null, period_minutes: fmt === t.format ? t.period_minutes : (FORMAT_DEF[fmt] || [])[1] || null };
    const keep = $$("input[name=p]:checked", f).map(x => S.players.find(p => p.id === x.value));
    const ok = await safe(async () => {
      await db.insert("teams", nt); if (mode === "demo") await db.save("team_trainers", { team_id: nt.id, user_id: "demo", email: "demo@ogvorselaar.be" });
      if (f.co?.checked) for (const tr of S.trainers) if (tr.user_id !== user?.id && tr.email) await db.addTrainer(nt.id, tr.email).catch(() => {});
      for (const p of keep) {
        const s = playerStats(p), evs = S.evals.filter(x => x.player_id === p.id && Object.keys(x.scores || {}).length).sort((a, b) => a.moment - b.moment).map(x => ({ moment: x.moment, date: x.date || null, scores: x.scores }));
        const hist = [...(p.history || []), { season: t.season || "", team: t.name, category: t.category || "", evals: evs,
          stats: { trainingPct: s.trTot ? s.trPct : null, matches: s.matches, minutes: s.minutes, goals: s.goals, assists: s.assists, rating: s.rating ?? null } }];
        const token = p.parent_token; if (token) { p.parent_token = uid(); await db.save("players", p); } /* de ouderlink verhuist mee naar de nieuwe ploeg */
        const np = { id: uid(), team_id: nt.id, first_name: p.first_name, last_name: p.last_name || "", birthdate: p.birthdate || null, number: p.number ?? null, position: p.position || null,
          foot: p.foot || null, parent_contact: p.parent_contact || null, notes: p.notes || null, active: true, history: hist, ...(token ? { parent_token: token } : {}) };
        await db.save("players", np);
      }
      return true; });
    if (!ok) { btn.disabled = false; btn.textContent = "Nieuwe ploeg maken"; return; }
    d.close(); await loadTeams(); await loadTeam(nt.id); toast(`${nt.name} is klaar met ${keep.length} spelers.`); go("#/spelers"); };
}
function historyHtml(p) {
  const h = p.history || []; if (!h.length) return "";
  const avgE = e => { const v = Object.values(e.scores || {}).map(Number).filter(x => !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return `<div class="sec"><h2>Vorige seizoenen</h2><div class="grid2">${h.slice().reverse().map(x => `<div class="panel"><div class="row" style="margin-bottom:8px"><b style="font-size:17px">${esc(x.team)}</b><span class="spacer"></span><span class="pill g">${esc(x.season)}</span></div>
    <div class="hstats">${[["Training", x.stats?.trainingPct != null ? x.stats.trainingPct + "%" : "–"], ["Wedstrijden", x.stats?.matches ?? "–"], ["Minuten", x.stats?.minutes ?? "–"], ["Goals", x.stats?.goals ?? "–"], ["Gem. cijfer", f1(x.stats?.rating)]].map(([k, val]) => `<div><small>${k}</small><b>${val}</b></div>`).join("")}</div>
    ${x.evals?.length ? `<p class="hint" style="margin:10px 0 4px">Evaluaties (gemiddelde op 5)</p><div class="chips">${x.evals.map(e => `<span class="pill g">E${e.moment}: ${f1(avgE(e))}</span>`).join("")}</div>` : ""}</div>`).join("")}</div></div>`;
}
