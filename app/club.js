/* OGV Platform — clubtoegang (registreren met clubcode, clubbeheer), ouders bevestigen aanwezigheid,
   en een ploeg doorschuiven naar een nieuw seizoen. */
"use strict";

/* ============ registreren met de clubcode ============ */
function viewRegister(v) {
  v.innerHTML = `<div class="authbox"><h1>OGV<span>Trainers</span></h1><p class="muted">Maak je trainersaccount aan. Je hebt de clubcode nodig die je van de jeugdcoördinator kreeg.</p>
  <form id="rf" style="display:flex;flex-direction:column;gap:12px"><label class="f">Voornaam en naam<input name="nm" required maxlength="60" autocomplete="name" placeholder="bv. Jelle Lauwers"></label>
   <label class="f">E-mailadres<input type="email" name="email" required autocomplete="username"></label>
   <label class="f">Wachtwoord <span class="hint">minstens 8 tekens</span><input type="password" name="pw" required minlength="8" autocomplete="new-password"></label>
   <label class="f">Clubcode<input name="code" required autocomplete="off" placeholder="OGV-…" style="text-transform:uppercase"></label>
   <div class="err" id="rerr"></div><button class="btn">Account aanmaken</button></form>
  <div class="row"><button class="link" type="button" id="toLogin">Ik heb al een account</button></div></div>`;
  $("#toLogin").onclick = () => viewLogin(v);
  $("#rf").onsubmit = async e => { e.preventDefault(); const f = e.target, btn = $("button.btn", f), err = $("#rerr"); err.textContent = "";
    if (!sb) { err.textContent = "Geen verbinding met de database."; return; }
    btn.disabled = true; btn.textContent = "Bezig…";
    const code = f.code.value.trim().toUpperCase(); try { localStorage.setItem("ogv-invite", code); } catch (x) {}
    try { const { data, error } = await sb.auth.signUp({ email: f.email.value.trim(), password: f.pw.value, options: { data: { invite: code, full_name: f.nm.value.trim().replace(/\s+/g, " ") }, emailRedirectTo: location.origin + location.pathname } });
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
  <div class="panel"><h2>Wachten op toegang</h2>${info.waiting?.length ? `<div class="list">${info.waiting.map(w => `<div class="item static"><span class="main"><b>${esc(w.name || w.email)}</b><small>${w.name ? esc(w.email) + " · " : ""}account sinds ${new Date(w.created_at).toLocaleDateString("nl-BE")}</small></span><button class="btn small" type="button" data-ok="${w.user_id}">Toelaten</button></div>`).join("")}</div>`
    : `<p class="hint" style="margin:0">Niemand. Accounts zonder clubcode verschijnen hier, zodat je ze kan toelaten.</p>`}</div></div>
  <div class="sec"><h2>Leden (${info.members.length})</h2><div class="list">${info.members.map(m => `<div class="item static"><span class="av sm" aria-hidden="true">${esc((m.email || "?")[0].toUpperCase())}</span><span class="main"><b>${esc(m.name || m.email || "")}</b><small>${m.name ? esc(m.email || "") + " · " : ""}${esc(m.teams || "nog geen ploeg")}</small></span>
    ${m.role === "admin" ? `<span class="pill w">Beheerder</span>` : ""}${m.user_id === user?.id ? `<span class="hint">jij</span>` : `<button class="link" type="button" data-role="${m.user_id}" data-r="${m.role === "admin" ? "trainer" : "admin"}">${m.role === "admin" ? "Geen beheerder meer" : "Beheerder maken"}</button><button class="link danger" type="button" data-rm="${m.user_id}" data-mail="${esc(m.email || "")}">Toegang intrekken</button>`}</div>`).join("")}</div></div>`;
  v.insertAdjacentHTML("afterbegin", `<div id="adm-fb"></div>`); adminFeedback($("#adm-fb"));
  v.insertAdjacentHTML("beforeend", `<div class="sec panel" id="adm-db"></div>`); dbCheck($("#adm-db"));
  v.insertAdjacentHTML("beforeend", `<div class="sec panel" id="adm-rbfa"><div class="row"><div style="flex:1;min-width:220px"><h2 style="margin:0">Ploegen van de club aanmaken</h2><p class="hint" style="margin:4px 0 0">Haal alle ploegen van OG Vorselaar op bij RBFA en maak ze in één keer aan, gekoppeld aan hun wedstrijdkalender. Trainers hoeven dan zelf geen ploeg meer te maken.</p></div><button class="btn" type="button" id="rbfaTeams">${IC.rotate}Ploegen ophalen van RBFA</button></div></div>
    <div class="sec" id="adm-teams"><h2>Ploegen en trainers</h2><p class="hint" style="margin-top:0">Laden…</p></div>`);
  $("#rbfaTeams").onclick = () => rbfaCreateTeams(() => render());
  adminTeams($("#adm-teams"), info);
  const rpc = async (fn, args, ok) => { if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; } const { error } = await sb.rpc(fn, args); if (error) toast(error.message); else { toast(ok); render(); } };
  $("#cpy").onclick = () => { navigator.clipboard?.writeText(info.code); toast("Clubcode gekopieerd."); };
  $("#share").onclick = () => { const txt = `Je bent uitgenodigd voor OGV Trainers, het trainersplatform van OG Vorselaar.\nMaak je account aan op ${link} met de clubcode ${info.code}`;
    if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else { navigator.clipboard?.writeText(txt); toast("Uitnodiging gekopieerd."); } };
  $("#newcode").onclick = () => { const c = prompt("Nieuwe clubcode (minstens 6 tekens):", "OGV-" + Math.random().toString(36).slice(2, 8).toUpperCase()); if (c) rpc("club_set_code", { code: c }, "Nieuwe clubcode ingesteld."); };
  $$("[data-ok]", v).forEach(b => b.onclick = () => rpc("club_set_member", { uid: b.dataset.ok, r: "trainer" }, "Toegelaten."));
  $$("[data-role]", v).forEach(b => b.onclick = () => rpc("club_set_member", { uid: b.dataset.role, r: b.dataset.r }, "Rol aangepast."));
  $$("[data-rm]", v).forEach(b => b.onclick = () => { if (confirm(`Toegang intrekken voor ${b.dataset.mail}? Die persoon is dan ook geen trainer meer van zijn ploegen.`)) rpc("club_set_member", { uid: b.dataset.rm, r: null }, "Toegang ingetrokken."); });
} });

/* meldingen van trainers */
async function adminFeedback(host) {
  if (mode === "demo") return;
  const { data, error } = await sb.from("feedback").select("*").order("created_at", { ascending: false }).limit(60);
  if (error) { host.innerHTML = ""; return; }
  const open = data.filter(x => x.status !== "afgehandeld"), show = host.dataset.all ? data : open;
  host.innerHTML = `<div class="panel sec fbpanel" style="margin-top:0"><div class="row"><h2 style="margin:0">Meldingen van trainers</h2>${open.length ? `<span class="pill w">${open.length} nieuw</span>` : ""}<span class="spacer"></span>${data.length > open.length ? `<button class="link" type="button" id="fball">${host.dataset.all ? "Alleen open meldingen" : "Ook afgehandelde tonen"}</button>` : ""}</div>
    ${show.length ? `<div class="list" style="margin-top:10px">${show.map(x => `<div class="item static fbit${x.status === "afgehandeld" ? " done" : ""}"><span class="main"><b>${esc(x.kind || "Melding")} · ${esc(x.name || x.email || "Trainer")}</b>
      <span class="fbmsg">${esc(x.message)}</span><small>${new Date(x.created_at).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" })} · ${esc(x.page || "")}${x.info?.versie ? " · versie " + esc(x.info.versie) : ""}${x.info?.toestel ? ` · <button class="link" type="button" data-inf="${x.id}">technische info</button>` : ""}</small></span>
      <button class="btn ghost small" type="button" data-st="${x.id}">${x.status === "afgehandeld" ? "Heropenen" : "Afgehandeld"}</button></div>`).join("")}</div>` : `<p class="hint" style="margin:8px 0 0">Geen open meldingen. Trainers melden iets via "Probleem melden" onderaan het menu.</p>`}</div>`;
  const all = $("#fball", host); if (all) all.onclick = () => { if (host.dataset.all) delete host.dataset.all; else host.dataset.all = "1"; adminFeedback(host); };
  $$("[data-st]", host).forEach(b => b.onclick = async () => { const x = data.find(z => z.id === b.dataset.st), st = x.status === "afgehandeld" ? "nieuw" : "afgehandeld";
    const { error: e2 } = await sb.from("feedback").update({ status: st }).eq("id", x.id); if (e2) toast(e2.message); else adminFeedback(host); });
  $$("[data-inf]", host).forEach(b => b.onclick = () => { const x = data.find(z => z.id === b.dataset.inf);
    dialog(`<div class="dlg"><h2>Technische info</h2><pre class="fbpre">${esc(JSON.stringify(x.info, null, 2))}</pre><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Sluiten</button></div></div>`); });
}
/* databasecontrole: welke onderdelen staan klaar in Supabase? */
async function dbCheck(host) {
  if (mode === "demo") { host.remove(); return; }
  const C = [
    ["Ploegen, spelers en kalender", () => sb.from("teams").select("id").limit(1)],
    ["Trainingsplan, verslagen en scouting", () => sb.from("events").select("plan,report,lineup").limit(1)],
    ["Mijn opslag en oefeningen", () => sb.from("trainer_items").select("id").limit(1)],
    ["Bestanden en afbeeldingen", () => sb.storage.from("trainer-files").list(user.id, { limit: 1 })],
    ["RBFA-koppeling", () => sb.from("teams").select("rbfa_team_id,sheet_url").limit(1)],
    ["Clubcode, ouderlinks en aanwezigheid van ouders", () => sb.from("players").select("parent_token").limit(1)],
    ["Uitgebreide evaluaties", () => sb.from("evaluations").select("details").limit(1)],
    ["Oefenstof delen met de club", () => sb.from("trainer_items").select("shared").limit(1)],
    ["Trainers beheren per ploeg", () => sb.rpc("admin_teams")],
    ["Namen van trainers", async () => { const r = await sb.rpc("club_admin_info"); if (r.error) return r; return (r.data?.members || []).every(m => "name" in m) ? r : { error: { message: "oude versie" } }; }],
    ["Probleem melden", () => sb.from("feedback").select("id").limit(1)]];
  host.innerHTML = `<h2>Databasecontrole</h2><p class="hint" style="margin-top:0">Bezig met controleren…</p>`;
  const res = []; for (const [l, fn] of C) { let ok = false; try { const r = await fn(); ok = !r.error; } catch (e) { ok = false; } res.push([l, ok]); }
  const bad = res.filter(r => !r[1]).length;
  host.innerHTML = `<div class="row"><h2 style="margin:0">Databasecontrole</h2><span class="pill ${bad ? "loss" : "w"}">${bad ? bad + " ontbreekt" : "alles in orde"}</span></div>
    <div class="dbchk">${res.map(([l, ok]) => `<span class="${ok ? "ok" : "bad"}">${ok ? "✓" : "✕"} ${esc(l)}</span>`).join("")}</div>
    ${bad ? `<div class="share">${IC.eye}<div><b style="color:var(--ink)">Er ontbreekt iets in de database.</b> Voer het volledige script <a href="ploeg/supabase-setup.sql" download="ogv-database.sql">ogv-database.sql</a> uit in Supabase (SQL Editor → plakken → Run). Het is veilig om dit opnieuw te doen: wat al bestaat, blijft bestaan. Ververs daarna deze pagina.</div></div>` : `<p class="hint" style="margin:8px 0 0">De database is volledig bijgewerkt.</p>`}`;
}

/* beheerder: alle ploegen van de club aanmaken op basis van RBFA */
const ageOf = n => { const m = String(n || "").match(/U\s?(\d{1,2})/i); return m ? +m[1] : null; };
const formatFor = n => { const a = ageOf(n); return a == null ? "11v11" : a <= 7 ? "3v3" : a <= 9 ? "5v5" : a <= 13 ? "8v8" : "11v11"; };
async function rbfaCreateTeams(done) {
  const d = dialog(`<div class="dlg"><h2>Ploegen van RBFA</h2><p class="muted" style="margin:0">Laden…</p></div>`, "wide");
  let list; try { list = await rbfaTeams(); } catch (e) { d.querySelector(".dlg").innerHTML = `<h2>Ploegen van RBFA</h2><p class="err">RBFA is niet bereikbaar: ${esc(e.message)}</p><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Sluiten</button></div>`; $$("[data-close]", d).forEach(b => b.onclick = () => d.close()); return; }
  const teams = S.teams || [], season = seasonNow();
  const rows = list.map(r => { const linked = teams.find(t => String(t.rbfa_team_id || "") === String(r.id)), cat = ageOf(r.name) ? "U" + ageOf(r.name) : "",
      same = !linked && cat && teams.find(t => (t.category || "").toUpperCase().replace(/^P/, "") === cat.toUpperCase() || ageOf(t.name) === ageOf(r.name));
    return { r, linked, same, cat, name: "OGV " + rbfaName(r.name), format: formatFor(r.name) }; })
    .sort((a, b) => (ageOf(a.r.name) ?? 99) - (ageOf(b.r.name) ?? 99) || a.r.name.localeCompare(b.r.name, "nl"));
  d.querySelector(".dlg").innerHTML = `<h2>Ploegen van RBFA</h2><p class="muted" style="margin:0">${rows.length} ploegen gevonden bij RBFA voor seizoen ${season}. Vink aan welke je wil aanmaken. Ploegen die al bestaan of die bij een bestaande ploeg lijken te horen, staan uitgevinkt.</p>
    <div class="rbfalist">${rows.map((x, i) => `<label class="rbfarow${x.linked ? " done" : ""}"><input type="checkbox" data-i="${i}"${x.linked || x.same ? "" : " checked"}${x.linked ? " disabled" : ""}>
      <span class="main"><input class="rbn" data-n="${i}" value="${esc(x.name)}" aria-label="Naam in de app"${x.linked ? " disabled" : ""}><small>RBFA: ${esc(x.r.name)}${x.linked ? ` · bestaat al als <b>${esc(x.linked.name)}</b>` : x.same ? ` · lijkt op <b>${esc(x.same.name)}</b>` : ""}</small></span>
      <select data-f="${i}" aria-label="Spelvorm"${x.linked ? " disabled" : ""}>${["2v2", "3v3", "5v5", "8v8", "11v11"].map(f => `<option${f === x.format ? " selected" : ""}>${f}</option>`).join("")}</select></label>`).join("")}</div>
    <label class="check"><input type="checkbox" id="rbSync" checked> Wedstrijden meteen ophalen in de kalender van elke ploeg</label>
    <label class="check"><input type="checkbox" id="rbMe"> Mezelf als trainer toevoegen aan deze ploegen</label>
    <p class="hint" style="margin:0">Daarna wijs je bij "Ploegen en trainers" de trainers toe. Zij zien hun ploeg dan meteen na het aanmelden.</p>
    <div class="row"><span class="hint" id="rbst"></span><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" type="button" id="rbgo">Ploegen aanmaken</button></div>`;
  $$("[data-close]", d).forEach(b => b.onclick = () => d.close());
  const cnt = () => { const n = $$("input[data-i]:checked", d).length; $("#rbgo", d).textContent = n ? `${n} ${n === 1 ? "ploeg" : "ploegen"} aanmaken` : "Ploegen aanmaken"; $("#rbgo", d).disabled = !n; };
  $$("input[data-i]", d).forEach(c => c.onchange = cnt); cnt();
  $("#rbgo", d).onclick = async () => {
    if (mode === "demo") { toast("In de demo worden geen ploegen aangemaakt."); return; }
    const pick = $$("input[data-i]:checked", d).map(c => +c.dataset.i), sync = $("#rbSync", d).checked, keepMe = $("#rbMe", d).checked, st = $("#rbst", d), btn = $("#rbgo", d);
    btn.disabled = true; let made = 0, games = 0, warn = "";
    for (const i of pick) { const x = rows[i], name = $(`[data-n="${i}"]`, d).value.trim() || x.name, format = $(`[data-f="${i}"]`, d).value;
      st.textContent = `Bezig met ${name} (${made + 1} van ${pick.length})…`;
      const row = { id: uid(), name, category: x.cat || null, format, season, criteria: EV_TEMPLATE.slice(), rbfa_team_id: String(x.r.id) };
      try { await db.insert("teams", row); made++;
        if (sync) { try { const r = await rbfaSync(row); games += r.added || 0; } catch (e) { warn = "Niet alle kalenders konden opgehaald worden."; } }
        if (!keepMe) { const { error } = await sb.rpc("admin_set_trainer", { t: row.id, uid: user.id, on_team: false }); if (error) warn = /admin_set_trainer|function/i.test(error.message) ? "Je staat nog als trainer bij de nieuwe ploegen: voer eerst ogv-update-v9.sql uit om dat te kunnen wijzigen." : error.message; }
      } catch (e) { warn = /rbfa_team_id|column/i.test(e.message || "") ? "Voer eerst het databasescript ogv-update-v5.sql uit." : (e.message || String(e)); break; } }
    await loadTeams().catch(() => {}); if (S.team) await loadTeam(S.team.id).catch(() => {});
    d.close(); toast(`${made} ${made === 1 ? "ploeg" : "ploegen"} aangemaakt${sync ? `, ${games} wedstrijden opgehaald` : ""}.${warn ? " " + warn : ""}`); done && done(); };
}

/* beheerder: trainers toevoegen, verplaatsen naar een andere ploeg of verwijderen bij een ploeg */
async function adminTeams(host, info) {
  let teams;
  if (mode === "demo") teams = [{ id: "a", name: "Demoploeg U9", category: "U9", season: "2026-2027", trainers: [{ user_id: "demo", email: "demo@ogvorselaar.be", name: "Demo Trainer" }] }, { id: "b", name: "Demoploeg U11", category: "U11", season: "2026-2027", trainers: [{ user_id: "x", email: "trainer.u11@ogvorselaar.be" }] }];
  else { const { data, error } = await sb.rpc("admin_teams"); if (error) { host.innerHTML = `<h2>Ploegen en trainers</h2><div class="share">${IC.eye}<div>${/admin_teams|function/i.test(error.message) ? "Voer eerst het databasescript <b>ogv-update-v8.sql</b> uit in Supabase om trainers van ploegen te beheren." : esc(error.message)}</div></div>`; return; } teams = data || []; }
  const members = info.members || [];
  host.innerHTML = `<h2>Ploegen en trainers</h2><p class="hint" style="margin-top:0">Voeg trainers toe aan een ploeg, verplaats ze naar een andere ploeg of haal ze weg. Een trainer die je weghaalt, blijft lid van de club en houdt zijn eigen oefeningen.</p>
    <div class="admteams">${teams.map(t => { const ids = new Set(t.trainers.map(x => x.user_id)), free = members.filter(m => !ids.has(m.user_id));
      return `<div class="panel admteam"><div class="row"><h3>${esc(t.name)}</h3><span class="hint">${esc([t.category, t.season].filter(Boolean).join(" · "))}</span></div>
        <div class="list">${t.trainers.map(x => `<div class="item static"><span class="av sm" aria-hidden="true">${esc((x.email || "?")[0].toUpperCase())}</span><span class="main"><b>${esc(x.name || x.email || "")}</b><small>${x.name ? esc(x.email || "") : ""}${x.user_id === user?.id ? (x.name ? " · " : "") + "jij" : ""}</small></span>
          <select data-mv="${x.user_id}" data-from="${t.id}" aria-label="Verplaatsen naar een andere ploeg"><option value="">Verplaatsen naar…</option>${teams.filter(o => o.id !== t.id).map(o => `<option value="${o.id}">${esc(o.name)}${o.season ? " (" + esc(o.season) + ")" : ""}</option>`).join("")}</select>
          <button class="ib" type="button" data-del="${x.user_id}" data-t="${t.id}" data-mail="${esc(x.name || x.email || "")}" data-last="${t.trainers.length === 1}" title="Weghalen bij deze ploeg" aria-label="Weghalen bij deze ploeg">${IC.trash}</button></div>`).join("") || `<p class="hint" style="margin:6px 0">Geen trainers. Alleen beheerders zien deze ploeg nog.</p>`}</div>
        ${free.length ? `<select class="admadd" data-add="${t.id}" aria-label="Trainer toevoegen"><option value="">+ Trainer toevoegen…</option>${free.map(m => `<option value="${m.user_id}">${esc(m.name ? m.name + " – " + m.email : m.email)}</option>`).join("")}</select>` : ""}</div>`; }).join("") || `<p class="muted">Nog geen ploegen.</p>`}</div>`;
  const call = async (fn, args, ok) => { if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; } const { error } = await sb.rpc(fn, args); if (error) { toast(error.message); return; } toast(ok); if (fn !== "admin_teams") { await loadTeams().catch(() => {}); } adminTeams(host, info); };
  const tName = id => teams.find(t => t.id === id)?.name || "de ploeg";
  $$("[data-mv]", host).forEach(sel => sel.onchange = () => { const to = sel.value; if (!to) return; const mail = sel.closest(".item").querySelector("b").textContent;
    if (!confirm(`${mail} verplaatsen van ${tName(sel.dataset.from)} naar ${tName(to)}?`)) { sel.value = ""; return; }
    call("admin_move_trainer", { uid: sel.dataset.mv, from_t: sel.dataset.from, to_t: to }, `Verplaatst naar ${tName(to)}.`); });
  $$("[data-del]", host).forEach(b => b.onclick = () => { const last = b.dataset.last === "true";
    if (!confirm(`${b.dataset.mail} weghalen bij ${tName(b.dataset.t)}?${last ? "\n\nDit is de laatste trainer van deze ploeg: daarna ziet niemand behalve de beheerders de ploeg nog." : ""}`)) return;
    call("admin_set_trainer", { t: b.dataset.t, uid: b.dataset.del, on_team: false }, "Weggehaald bij de ploeg."); });
  $$("[data-add]", host).forEach(sel => sel.onchange = () => { if (!sel.value) return; const mail = sel.selectedOptions[0].textContent;
    call("admin_set_trainer", { t: sel.dataset.add, uid: sel.value, on_team: true }, `${mail} is nu trainer van ${tName(sel.dataset.add)}.`); });
}

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
    ${x.evals?.length ? `<p class="hint" style="margin:10px 0 4px">Evaluaties (gemiddelde op 5)</p><div class="chips">${x.evals.map(e => `<span class="pill g">${EV_MOMENTS[e.moment - 1]?.naam || "E" + e.moment}: ${f1(avgE(e))}</span>`).join("")}</div>` : ""}</div>`).join("")}</div></div>`;
}
