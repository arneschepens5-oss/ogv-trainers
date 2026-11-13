/* OGV Platform — clubtoegang (registreren met clubcode, clubbeheer), ouders bevestigen aanwezigheid,
   en een ploeg doorschuiven naar een nieuw seizoen. */
"use strict";

/* ============ registreren met de clubcode ============ */
function viewRegister(v) {
  document.body.classList.add("authpage");
  v.innerHTML = `<div class="authbox">${AUTHHEAD()}<p class="muted">Maak je trainersaccount aan. Je hebt de clubcode nodig die je van de jeugdcoördinator kreeg.</p>
  <form id="rf" class="authcard"><label class="f">Voornaam en naam<input name="nm" required maxlength="60" autocomplete="name" placeholder="bv. Jelle Lauwers"></label>
   <label class="f">E-mailadres<input type="email" name="email" required autocomplete="username"></label>
   <label class="f">Wachtwoord <span class="hint">minstens 8 tekens</span><input type="password" name="pw" required minlength="8" autocomplete="new-password"></label>
   <label class="f">Clubcode<input name="code" autocomplete="off" placeholder="bv. ABCD1234" style="text-transform:uppercase"></label>
   <div class="err" id="rerr"></div><button class="btn">Account aanmaken</button></form>
  <div class="row"><button class="link" type="button" id="toLogin">Ik heb al een account</button></div></div>`;
  $("#toLogin").onclick = () => viewLogin(v);
  $("#rf").onsubmit = async e => { e.preventDefault(); const f = e.target, btn = $("button.btn", f), err = $("#rerr"); err.textContent = "";
    if (!sb) { err.textContent = "Geen verbinding met de database."; return; }
    btn.disabled = true; btn.textContent = "Bezig…";
    const code = f.code.value.trim().toUpperCase();
    /* het beheeraccount van het platform hoort bij geen enkele club en heeft dus geen clubcode nodig */
    if (!code && f.email.value.trim().toLowerCase() !== CONTACT_MAIL) { err.textContent = "Vul de clubcode in die je van de jeugdcoördinator kreeg."; btn.disabled = false; btn.textContent = "Account aanmaken"; f.code.focus(); return; }
    try { if (code) localStorage.setItem("ogv-invite", code); else localStorage.removeItem("ogv-invite"); } catch (x) {}
    try { const { data, error } = await sb.auth.signUp({ email: f.email.value.trim(), password: f.pw.value, options: { data: { invite: code, full_name: f.nm.value.trim().replace(/\s+/g, " ") }, emailRedirectTo: location.origin + location.pathname } });
      if (error) err.textContent = /not allowed|disabled/i.test(error.message) ? "Registreren staat nog uit. Vraag de beheerder om het aan te zetten in Supabase." : /already registered|exists/i.test(error.message) ? "Er bestaat al een account met dit e-mailadres. Meld je aan." : /password/i.test(error.message) ? "Kies een sterker wachtwoord (minstens 8 tekens)." : error.message;
      else if (!data.session) v.innerHTML = `<div class="authbox">${AUTHHEAD()}<div class="panel"><h2 style="margin-top:0">Bevestig je e-mailadres</h2><p class="muted" style="margin:0">We stuurden een mail naar <b style="color:var(--ink)">${esc(f.email.value.trim())}</b>. Klik op de link in die mail en meld je daarna aan.</p></div><button class="btn ghost" type="button" onclick="viewLogin($('#view'))">Naar aanmelden</button></div>`; }
    catch (x) { err.textContent = "Registreren lukt niet: controleer je internetverbinding."; }
    finally { if (err.textContent) { btn.disabled = false; btn.textContent = "Account aanmaken"; } } };
}
/* account bestaat maar is nog geen lid van de club */
function viewJoin(v) {
  document.body.classList.add("authpage");
  let saved = ""; try { saved = localStorage.getItem("ogv-invite") || ""; } catch (x) {}
  v.innerHTML = `<div class="authbox">${AUTHHEAD()}<p class="muted">Je bent aangemeld als <b style="color:var(--ink)">${esc(user?.email || "")}</b>, maar je account heeft nog geen toegang tot de club. Vul de clubcode in die je van de jeugdcoördinator kreeg.</p>
  <form id="jf" class="authcard"><label class="f">Clubcode<input name="code" required autocomplete="off" value="${esc(saved)}" placeholder="bv. ABCD1234" style="text-transform:uppercase"></label><div class="err" id="jerr"></div><button class="btn">Toegang krijgen</button></form>
  <div class="row"><button class="link" type="button" data-logout>Afmelden</button></div></div>`;
  $("[data-logout]", v).onclick = logout;
  $("#jf").onsubmit = async e => { e.preventDefault(); const btn = $("button.btn", e.target); btn.disabled = true;
    const { data, error } = await sb.rpc("join_club", { code: e.target.code.value.trim() });
    if (error || !data) { $("#jerr").textContent = error ? error.message : "Deze clubcode klopt niet."; btn.disabled = false; return; }
    try { localStorage.removeItem("ogv-invite"); } catch (x) {}
    S.member = true; toast("Welkom bij " + APPNAME() + "."); startCloud(); };
}
async function clubStatus() {
  if (mode === "demo") { S.member = true; S.admin = true; S.rechten = ["scouting", "terreinen"]; return; }
  try { const { data, error } = await sb.rpc("club_status"); if (error) throw error; S.member = !!data.member; S.admin = !!data.admin; S.allTeams = !!data.all_teams; S.teamAccess = Array.isArray(data.team_access) ? data.team_access : []; S.functie = data.functie || ""; S.platform = !!data.platform; S.clubs = Array.isArray(data.clubs) ? data.clubs : []; if (data.club && !ADMIN_APP) { if (CLUB_KNOWN && CLUB.id && CLUB.id !== data.club.id) { /* ander club dan vorige keer op dit toestel: niets van de vorige club laten staan */ try { localStorage.removeItem(TEAM_KEY); } catch (x) {} S.team = null; S.club = null; }
    Object.assign(CLUB, data.club, { settings: data.club.settings || {} }); KEYS.club_docs = ["club_id", "key"]; rememberClub(); applyClubTheme(); }
    else if (data.platform) { Object.assign(CLUB, { id: "platform", name: PRODUCT, short: "FCH", settings: { color: "#F5C542", color2: "#0F4A33" } }); /* huisstijl van het platform */ applyClubTheme(); } /* account van het platform zonder club */
    S.rechten = Array.isArray(data.rechten) ? data.rechten : [];
    if (!S.member) { try { const cl = await sb.rpc("claim_club_admin"); if (cl.data) return clubStatus(); } catch (x) {} }
    if (!S.member) { const code = (() => { try { return localStorage.getItem("ogv-invite"); } catch (x) {} })(); /* code die bij registreren werd ingevuld */
      if (code) { const r = await sb.rpc("join_club", { code }); if (r.data) { S.member = true; try { localStorage.removeItem("ogv-invite"); } catch (x) {} } } } }
  catch (e) { S.member = true; S.admin = false; /* databaseversie 5 nog niet uitgevoerd: gedrag zoals vroeger */ }
}

/* ============ clubbeheer ============ */
/* ============ beheer: aparte pagina's voor meldingen, toegang, ploegen en systeem ============ */
const ADM_TABS = [["meldingen", "Meldingen"], ["instellingen", "Instellingen"], ["toegang", "Toegang<span class=\"hm\"> en leden</span>"], ["ploegen", "Ploegen<span class=\"hm\"> en trainers</span>"], ["planning", "Trainingen"], ["systeem", "Systeem"]];
async function fbCount() { if (!S.admin || mode !== "cloud") return; try { const { count } = await sb.from("feedback").select("id", { count: "exact", head: true }).neq("status", "afgehandeld"); const c = count || 0; if (c !== S.fbOpen) { S.fbOpen = c; if (cur().page !== "clubbeheer") shell(); } } catch (e) {} }
route("clubbeheer", { title: "Beheer", auth: true, render: async (v, id) => {
  if (!S.admin) { v.innerHTML = `<div class="empty"><b>Alleen voor beheerders</b>Vraag de jeugdcoördinator als je hier iets wil aanpassen.</div>`; return; }
  const TABS = ADM_TABS.concat([["club", "Club"]]);
  if (id === "instellingen") { location.replace("#/clubinstellingen"); return; }
  const tab = TABS.some(t => t[0] === id) ? id : "meldingen";
  v.innerHTML = `<div class="admhead"><div><small class="admkick">${IC.gear} Beheer · ${esc(clubName())}</small><h1 class="pg">${{ meldingen: "Meldingen", toegang: "Toegang en leden", ploegen: "Ploegen en trainers", planning: "Trainingen inplannen", systeem: "Systeem", club: "Club", platform: "Alle clubs" }[tab]}${helpLink("clubbeheer")}</h1></div></div>
    <nav class="admtabs" aria-label="Beheer">${TABS.map(([k, l]) => `<a href="#/clubbeheer/${k}"${k === tab ? ' aria-current="page"' : ""}>${l}${k === "meldingen" && S.fbOpen ? `<span class="bdgn">${S.fbOpen}</span>` : ""}</a>`).join("")}</nav><div id="admv"><p class="hint">Laden…</p></div>`;
  const host = $("#admv"); try { $(".admtabs a[aria-current]")?.scrollIntoView({ inline: "center", block: "nearest" }); } catch (x) {}
  const getInfo = async () => { if (mode === "demo") return { code: "OGV-DEMO42", members: [{ user_id: "demo", email: "demo@ogvorselaar.be", name: "Demo Trainer", role: "admin", teams: "Demoploeg U9" }, { user_id: "x", email: "trainer.u11@ogvorselaar.be", role: "trainer", teams: "Demoploeg U11" }], waiting: [{ user_id: "y", email: "nieuwe.trainer@gmail.com", created_at: new Date().toISOString() }] };
    const { data, error } = await sb.rpc("club_admin_info"); if (error) throw error; return data; };
  if (tab === "meldingen") return adminFeedback(host);
  if (tab === "planning") return adminPlanning(host);
  if (tab === "club") return adminClub(host);
  if (tab === "systeem") { host.innerHTML = `<div class="panel" id="adm-db"></div>
    <div class="grid2 sec"><div class="panel"><h2>Back-up</h2><p class="hint" style="margin-top:0">Download alle gegevens van de club (ploegen, spelers, kalender, verslagen, evaluaties…) als één bestand. Doe dit minstens één keer per maand en bewaar het op een veilige plaats: het bevat gegevens van kinderen.</p>
      <button class="btn" type="button" id="bk">${IC.out}Back-up downloaden</button><p class="hint" id="bkl" style="margin-bottom:0"></p></div>
    <div class="panel"><h2>Gratis Supabase: aandachtspunten</h2><ul class="tight">
      <li><b>Pauzeren na 7 dagen zonder gebruik:</b> een geplande taak op GitHub houdt het project dagelijks wakker (zie de overdrachtsnota).</li>
      <li><b>Mails:</b> zonder eigen mailserver stuurt Supabase maar enkele mails per uur. Stel een eigen SMTP in (bv. Brevo of Resend) vóór je veel trainers tegelijk uitnodigt.</li>
      <li><b>Back-ups:</b> het gratis plan heeft geen terugzetpunt. Download daarom zelf regelmatig een back-up.</li></ul></div></div>`;
    try { const l = localStorage.getItem("ogv-last-backup"); if (l) $("#bkl").textContent = "Laatste back-up op dit toestel: " + new Date(l).toLocaleString("nl-BE"); } catch (x) {}
    $("#bk").onclick = async () => { if (mode === "demo") { download("ogv-backup-demo.json", JSON.stringify(DEMODB._load(), null, 1), "application/json"); return; }
      const r = await sb.rpc("club_backup"); if (r.error) { toast(/club_backup|function/i.test(r.error.message) ? "Voer eerst ogv-database.sql uit (versie 14)." : r.error.message); return; }
      download("ogv-backup-" + todayIso() + ".json", JSON.stringify(r.data), "application/json"); try { localStorage.setItem("ogv-last-backup", new Date().toISOString()); } catch (x) {} toast("Back-up gedownload."); };
    return dbCheck($("#adm-db")); }
  let info; try { info = await getInfo(); } catch (e) { host.innerHTML = `<div class="empty"><b>Laden mislukt</b>${esc(e.message)}</div>`; return; }
  if (tab === "ploegen") {
    host.innerHTML = `<div class="panel"><div class="row"><div style="flex:1;min-width:220px"><h2 style="margin:0">Ploegen van de club aanmaken</h2><p class="hint" style="margin:4px 0 0">Haal alle ploegen van ${esc(clubName())} op bij RBFA en maak ze in één keer aan, gekoppeld aan hun wedstrijdkalender. Trainers hoeven dan zelf geen ploeg meer te maken.</p></div><button class="btn" type="button" id="rbfaTeams">${IC.rotate}Ploegen ophalen van RBFA</button></div></div>
      ${V14() ? `<div class="panel sec"><div class="row"><div style="flex:1;min-width:220px"><h2 style="margin:0">Spelers importeren uit PSD</h2><p class="hint" style="margin:4px 0 0">Exporteer de spelerslijst van de hele club uit PSD als Excel, met een kolom voor de ploeg. Alle spelers komen in één keer in de juiste ploeg, met de gsm-nummers van de ouders.</p></div><button class="btn ghost" type="button" id="impAll">${IC.out}Excel kiezen</button></div></div>` : ""}
      <div class="sec" id="adm-teams"><p class="hint">Laden…</p></div>`;
    $("#rbfaTeams").onclick = () => rbfaCreateTeams(() => render()); const ia = $("#impAll"); if (ia) ia.onclick = () => importPlayers(true); return adminTeams($("#adm-teams"), info); }
  const link = location.origin + location.pathname + "#/aanmelden";
  host.innerHTML = `<div class="grid2"><div class="panel"><h2>Clubcode</h2><p class="hint" style="margin-top:0">Nieuwe trainers maken zelf een account aan met deze code. Deel ze alleen met trainers van de club.</p>
      <div class="codebox"><b id="code" translate="no">${esc(info.code || "–")}</b><button class="btn ghost small" type="button" id="cpy">${IC.copy}Kopiëren</button></div>
      <div class="row" style="margin-top:12px"><a class="btn small" id="wa" target="_blank" rel="noopener">${IC.wa}Delen via WhatsApp</a><button class="btn ghost small" type="button" id="share">${IC.out}Anders delen</button><button class="link" type="button" id="newcode">Nieuwe code maken</button><a class="link" href="handleiding/" target="_blank" rel="noopener">Handleiding</a></div>
      <p class="hint">Een nieuwe code maken stopt de oude. Wie al lid is, blijft lid.</p></div>
    <div class="panel"><div class="row"><h2 style="margin:0">Wachten op toegang</h2>${info.waiting?.length ? `<span class="pill w">${info.waiting.length}</span>` : ""}</div>${info.waiting?.length ? `<div class="list" style="margin-top:10px">${info.waiting.map(w => `<div class="item static"><span class="main"><b>${esc(w.name || w.email)}</b><small>${w.name ? esc(w.email) + " · " : ""}account sinds ${new Date(w.created_at).toLocaleDateString("nl-BE")}</small></span><button class="btn small" type="button" data-ok="${w.user_id}">Toelaten</button></div>`).join("")}</div>`
      : `<p class="hint" style="margin:8px 0 0">Niemand. Accounts zonder clubcode verschijnen hier, zodat je ze kan toelaten.</p>`}</div></div>
    <div class="sec"><div class="row"><h2 style="margin:0">Leden (${info.members.length})</h2><span class="spacer"></span><span class="hint">Geef iemand een functie (bv. TVJO, scout) en de rechten die nodig zijn. Iemand hoeft geen trainer van een ploeg te zijn.</span></div>
    <div class="list memlist" style="margin-top:10px">${info.members.map(m => `<div class="item static"><span class="av sm" aria-hidden="true">${esc((m.name || m.email || "?")[0].toUpperCase())}</span><span class="main"><b>${esc(m.name || m.email || "")}${m.functie ? ` <span class="pill fn">${esc(m.functie)}</span>` : ""}${(m.rechten || []).map(r => ` <span class="pill">${esc(RECHTEN.find(x => x[0] === r)?.[1] || r)}</span>`).join("")}</b><small>${m.name ? esc(m.email || "") + " · " : ""}${m.all_teams ? "toegang tot alle ploegen" : (m.team_access || []).length ? "toegang tot " + (m.team_access.length) + " ploegen" + (m.teams ? " · trainer van " + esc(m.teams) : "") : esc(m.teams || "nog geen ploeg")}</small></span>
      ${m.role === "admin" ? `<span class="pill w">Beheerder</span>` : ""}${m.user_id === user?.id ? `<span class="hint">jij</span>` : ""}<button class="btn ghost small" type="button" data-edm="${m.user_id}">Bewerken</button></div>`).join("")}</div></div>`;
  const rpc = async (fn, args, ok) => { if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; } const { error } = await sb.rpc(fn, args); if (error) toast(error.message); else { toast(ok); render(); } };
  $("#cpy").onclick = () => { navigator.clipboard?.writeText(info.code); toast("Clubcode gekopieerd."); };
  const txt = `Je bent uitgenodigd voor ${APPNAME()}, het trainersplatform van ${clubName()}.\n\n1. Open ${link}\n2. Tik op Account aanmaken\n3. Vul deze clubcode in: ${info.code}\n\nDeel deze code niet buiten de club.`;
  $("#wa").href = "https://wa.me/?text=" + encodeURIComponent(txt);
  $("#share").onclick = () => {
    if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else { navigator.clipboard?.writeText(txt); toast("Uitnodiging gekopieerd."); } };
  $("#newcode").onclick = () => { const c = prompt("Nieuwe clubcode (minstens 6 tekens):", String(clubShort()).replace(/\W/g, "").toUpperCase().slice(0, 4) + "-" + Math.random().toString(36).slice(2, 8).toUpperCase()); if (c) rpc("club_set_code", { code: c }, "Nieuwe clubcode ingesteld."); };
  $$("[data-ok]", v).forEach(b => b.onclick = () => rpc("club_set_member", { uid: b.dataset.ok, r: "trainer" }, "Toegelaten."));
  $$("[data-edm]", v).forEach(b => b.onclick = () => memberForm(info.members.find(m => m.user_id === b.dataset.edm), rpc));
} });

/* lid bewerken: functie, beheerder en toegang tot alle ploegen */
const FUNCTIES = ["Trainer", "TVJO", "AVJO", "Jeugdcoördinator", "Coördinator onderbouw", "Coördinator middenbouw", "Coördinator bovenbouw", "Scout", "Terreinverantwoordelijke", "ICT", "Bestuur", "Clubkinesist", "API"];
const RECHTEN = [["scouting", "Scoutingsdatabase", "Spelers van andere clubs bekijken, toevoegen en beoordelen."], ["terreinen", "Terreinen indelen", "Terrein, uur, helft of kwart, kleedkamers en scheidsrechter van alle ploegen aanpassen."]];
function memberForm(m, rpc) {
  const me = m.user_id === user?.id;
  const d = dialog(`<form><h2>${esc(m.name || m.email)}</h2><p class="muted" style="margin:0">${esc(m.email || "")}${m.teams ? " · trainer van " + esc(m.teams) : ""}</p>
    <label class="f">Functie in de club<input name="fn" list="fnl" value="${esc(m.functie || "")}" placeholder="bv. TVJO, ICT, Coördinator onderbouw"><datalist id="fnl">${FUNCTIES.map(f => `<option value="${f}">`).join("")}</datalist></label>
    <label class="check"><input type="checkbox" name="all"${m.all_teams ? " checked" : ""}> <span><b>Toegang tot alle ploegen</b><br><small class="muted">Voor de TVJO of coördinatoren: alle spelers, evaluaties, trainingen en verslagen van elke ploeg bekijken en aanpassen, zonder trainer van een ploeg te zijn.</small></span></label>
    ${V14() ? `<div class="f full" id="taw"${m.all_teams ? " hidden" : ""}><span>Of toegang tot bepaalde ploegen <small class="muted" style="font-weight:400">— bv. de coördinator onderbouw</small></span>
      <div class="chips" style="margin:6px 0">${BOUW.slice(1).map(([k, l]) => `<button class="chip" type="button" data-bw="${k}">${l}</button>`).join("")}<button class="chip" type="button" data-bw="none">Geen</button></div>
      <div class="plteams">${S.teams.map(t => `<button type="button" class="chip" data-ta="${t.id}" aria-pressed="${(m.team_access || []).includes(t.id)}">${esc(t.name)}</button>`).join("")}</div></div>` : ""}
    <div class="f full"><span>Rechten <small class="muted" style="font-weight:400">— een beheerder heeft altijd alle rechten</small></span>${RECHTEN.map(([k, l, t]) => `<label class="check" style="margin-top:6px"><input type="checkbox" name="r_${k}"${(m.rechten || []).includes(k) ? " checked" : ""}> <span><b>${l}</b><br><small class="muted">${t}</small></span></label>`).join("")}</div>
    <label class="check"><input type="checkbox" name="adm"${m.role === "admin" ? " checked" : ""}${me ? " disabled" : ""}> <span><b>Beheerder</b><br><small class="muted">Toegang tot Beheer: meldingen, leden, ploegen, trainers koppelen en contactpersonen. Bv. voor het ICT-team.</small></span></label>
    <div class="row">${me ? "" : `<button class="link danger" type="button" id="rmm">Toegang intrekken</button>`}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  const rm = $("#rmm", d); if (rm) rm.onclick = () => { if (confirm(`Toegang intrekken voor ${m.name || m.email}? Die persoon is dan ook geen trainer meer van zijn ploegen.`)) { d.close(); rpc("club_set_member", { uid: m.user_id, r: null }, "Toegang ingetrokken."); } };
  const ta = new Set(m.team_access || []), tap = () => $$("[data-ta]", d).forEach(b => b.setAttribute("aria-pressed", ta.has(b.dataset.ta)));
  $$("[data-ta]", d).forEach(b => b.onclick = () => { ta.has(b.dataset.ta) ? ta.delete(b.dataset.ta) : ta.add(b.dataset.ta); tap(); });
  $$("[data-bw]", d).forEach(b => b.onclick = () => { if (b.dataset.bw === "none") ta.clear(); else S.teams.filter(t => bouwOf(t) === b.dataset.bw).forEach(t => ta.add(t.id)); tap(); });
  const allBox = $("[name=all]", d), taw = $("#taw", d); if (allBox && taw) allBox.onchange = () => taw.hidden = allBox.checked;
  $("form", d).onsubmit = async ev => { ev.preventDefault(); const f = ev.target; if (mode === "demo") { d.close(); toast("In de demo wordt dit niet bewaard."); return; }
    const role = me ? m.role : (f.adm.checked ? "admin" : "trainer");
    if (role !== m.role) { const r = await sb.rpc("club_set_member", { uid: m.user_id, r: role }); if (r.error) { toast(r.error.message); return; } }
    const r2 = await sb.rpc("club_set_access", { uid: m.user_id, alle: f.all.checked, fn: f.fn.value.trim() });
    if (r2.error) { toast(/club_set_access|function/i.test(r2.error.message) ? "Voer eerst ogv-database.sql uit (versie 12)." : r2.error.message); return; }
    if (V14()) { const r3 = await sb.rpc("club_set_team_access", { uid: m.user_id, teams: f.all.checked ? [] : [...ta] }); if (r3.error) { toast(r3.error.message); return; } }
    const rr = RECHTEN.map(([k]) => k).filter(k => f["r_" + k].checked), had = (m.rechten || []).slice().sort().join();
    if (rr.slice().sort().join() !== had || rr.length) { const r4 = await sb.rpc("club_set_rechten", { uid: m.user_id, r: rr });
      if (r4.error) { toast(/club_set_rechten|function/i.test(r4.error.message) ? "Voer eerst supabase-rechten-v24.sql uit in Supabase." : r4.error.message); return; } }
    d.close(); toast("Opgeslagen."); render(); };
}

/* meldingen van trainers */
let FB_F = "open";
/* ============ club: naam, logo en kleur ============ */
const CLUB_PALETTES = [["Geel", "#FFD100", "#111111"], ["Blauw", "#2F6FED", "#0B1E46"], ["Lichtblauw", "#38BDF8", "#0B2233"], ["Rood", "#E03131", "#3A0B0B"], ["Bordeaux", "#B0123F", "#2A0A14"], ["Groen", "#2FB344", "#0B2E17"], ["Paars", "#8E1A92", "#22082A"], ["Oranje", "#FF8A00", "#1A1208"]];
/* gedeelde velden voor naam, kleuren en logo: gebruikt in Beheer > Club en in het platformbeheer */
function clubFieldsHtml(c, st, o = {}) {
  return `<label class="f">Officiële naam<input name="nm" required maxlength="80" value="${esc(c.name || "")}"></label>
    <div class="row"><label class="f" style="flex:1">Korte naam (bv. KFCV)<input name="sh" maxlength="12" value="${esc(c.short || "")}"></label>
      <label class="f" style="flex:2">Naam in de app (bv. KFC Voorbeeld)<input name="full" maxlength="60" value="${esc(st.full || "")}" placeholder="${esc(c.name || "")}"></label></div>
    ${o.fixed ? `<p class="hint">OG Vorselaar gebruikt altijd de vaste clubkleuren geel en zwart.</p>` : ""}<div${o.fixed ? " hidden" : ""}><h3 style="margin:22px 0 4px">Kleuren van de app</h3><p class="hint" style="margin-top:0">${o.hint || "Kies de kleuren van je club. De hele app past zich meteen aan, zodat je het resultaat ziet. Met Bewaren geldt het voor iedereen van de club."}</p>
    <div class="palgrid" role="group" aria-label="Kant-en-klare kleuren">${CLUB_PALETTES.map(([l, a, b]) => `<button type="button" class="pal" data-pal="${a},${b}" aria-pressed="false"><span class="sw" style="background:${b}"><i style="background:${a}"></i><i style="background:${a};opacity:.45"></i></span><b>${l}</b></button>`).join("")}</div>
    <div class="colf"><div class="cbox"><span class="cl">Hoofdkleur</span><small>Knoppen, accenten en het actieve menu</small><div class="cin"><input name="color" type="color" value="${esc(st.color || "#FFD100")}" aria-label="Hoofdkleur"><input name="colorx" class="hex" maxlength="7" spellcheck="false" value="${esc((st.color || "#FFD100").toUpperCase())}" aria-label="Hoofdkleur als code"></div></div>
      <div class="cbox"><span class="cl">Tweede kleur</span><small>Kleurt achtergrond en zijbalk een beetje</small><div class="cin"><input name="color2" type="color" value="${esc(st.color2 || "#111111")}" aria-label="Tweede kleur"><input name="color2x" class="hex" maxlength="7" spellcheck="false" value="${esc((st.color2 || "#111111").toUpperCase())}" aria-label="Tweede kleur als code"></div>
        <label class="tgl"><input type="checkbox" name="use2"${st.color2 ? " checked" : ""}><span></span>Tweede kleur gebruiken</label></div></div></div>
    <h3 style="margin:4px 0 4px">Clublogo</h3><p class="hint" style="margin-top:0">PNG of JPG, een vierkant beeld werkt het best. Zonder logo maakt de app een schild in de clubkleuren.</p>
    <div class="row" style="align-items:center;gap:14px"><span data-lprev></span><label class="btn ghost small" style="cursor:pointer">${IC.plus}Logo kiezen<input name="logo" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="link" type="button" data-lx${st.logo ? "" : " hidden"}>Logo verwijderen</button></div>`;
}
/* koppelt de velden; onChange(settings) bij elke wijziging; geeft een functie terug die de nieuwe instellingen geeft */
function bindClubFields(f, c, st, onChange) {
  let logo = st.logo || "";
  const cur = () => ({ ...st, full: f.full.value.trim() || undefined, color: f.color.value, color2: f.use2.checked ? f.color2.value : undefined, logo: logo || undefined });
  const shield = () => { const keep = { id: CLUB.id, short: CLUB.short, name: CLUB.name, settings: CLUB.settings };
    Object.assign(CLUB, { id: c.id, short: f.sh.value.trim() || c.short, name: f.nm.value.trim() || c.name, settings: cur() }); const h = LOGO("big"); Object.assign(CLUB, keep); $("[data-lprev]", f).innerHTML = h; };
  const sync = () => { f.colorx.value = f.color.value.toUpperCase(); f.color2x.value = f.color2.value.toUpperCase(); f.color2.closest(".cbox").classList.toggle("off", !f.use2.checked);
    $$("[data-pal]", f).forEach(x => x.setAttribute("aria-pressed", String(x.dataset.pal.toLowerCase() === (f.color.value + "," + f.color2.value).toLowerCase() && f.use2.checked))); };
  const upd = () => { sync(); shield(); onChange?.(cur()); };
  f.color.oninput = upd; f.color2.oninput = () => { f.use2.checked = true; upd(); }; f.use2.onchange = upd; f.sh.oninput = shield;
  const hexIn = (x, el, two) => x.oninput = () => { let h = x.value.trim(); if (h[0] !== "#") h = "#" + h; if (/^#[0-9a-f]{6}$/i.test(h)) { el.value = h.toLowerCase(); if (two) f.use2.checked = true; upd(); x.value = h.toUpperCase(); } };
  hexIn(f.colorx, f.color); hexIn(f.color2x, f.color2, true); [f.colorx, f.color2x].forEach(x => x.onblur = sync);
  $$("[data-pal]", f).forEach(b => b.onclick = () => { const [a, k] = b.dataset.pal.split(","); f.color.value = a.toLowerCase(); f.color2.value = k.toLowerCase(); f.use2.checked = true; upd(); });
  const lx = $("[data-lx]", f);
  f.logo.onchange = async () => { const file = f.logo.files[0]; if (!file) return;
    try { const img = await createImageBitmap(file), S2 = 160, cv = document.createElement("canvas"); cv.width = cv.height = S2; const k = Math.min(S2 / img.width, S2 / img.height);
      cv.getContext("2d").drawImage(img, (S2 - img.width * k) / 2, (S2 - img.height * k) / 2, img.width * k, img.height * k); logo = cv.toDataURL("image/png"); lx.hidden = false; upd(); } catch (e) { toast("Dit beeld kan niet gelezen worden."); } };
  lx.onclick = () => { logo = ""; lx.hidden = true; upd(); };
  sync(); shield();
  return cur;
}
function adminClub(host) {
  const st = CLUB.settings || {};
  host.innerHTML = `<form class="panel" id="clf" style="max-width:640px"><h2 style="margin-top:0">Gegevens van de club</h2>
    <p class="hint" style="margin-top:0">Naam en logo staan in het menu, op afdrukken en op de ouderpagina's.</p>${clubFieldsHtml(CLUB, st, { fixed: isOGV() })}
    <div class="row" style="justify-content:flex-end"><button class="btn">Bewaren</button></div></form>`;
  const f = $("#clf"), orig = CLUB.settings;
  const cur = bindClubFields(f, CLUB, st, s => { CLUB.settings = s; applyClubTheme(); });
  const restore = () => { if (!f.isConnected && CLUB.settings !== orig && !f.dataset.saved) { CLUB.settings = orig; applyClubTheme(); removeEventListener("hashchange", restore); } };
  addEventListener("hashchange", () => setTimeout(restore, 0));
  f.onsubmit = async e => { e.preventDefault(); if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; }
    const settings = cur();
    const { error } = await sb.rpc("club_save_settings", { nm: f.nm.value, sh: f.sh.value, s: settings });
    if (error) { toast(/club_save_settings|function/i.test(error.message) ? "Voer eerst het databasescript v29 uit." : error.message); return; }
    f.dataset.saved = "1"; Object.assign(CLUB, { name: f.nm.value.trim(), short: f.sh.value.trim() || CLUB.short, settings }); rememberClub(); applyClubTheme(); toast("Clubgegevens bewaard."); shell(); };
}

/* ============ platform: clubs beheren zonder in hun gegevens te kijken (enkel voor de beheerder van het platform) ============ */
const appLink = () => location.origin + location.pathname;
const inviteText = (name, code, mail) => `Welkom bij ${PRODUCT}!\n\nJe club ${name} staat klaar.\n\n1. Open ${appLink()}\n2. Tik op Account aanmaken${mail ? " met " + mail : ""}\n3. Clubcode: ${code}\n\nAls beheerder deel je daarna de clubcode met je trainers.\n\nVragen? Mail naar ${CONTACT_MAIL}.`;
const PLATFORM_DEMO = () => [{ id: OGV_ID, name: "KVV OG Vorselaar", short: "OGV", settings: {}, code: "OGV-DEMO42", admins: ["demo@ogvorselaar.be"], members: 14, teams: 12, players: 160, feedback_open: 2 },
  { id: "demo-b", name: "KFC Voorbeeld", short: "KFCV", settings: { color: "#2F6FED", color2: "#0B1E46" }, code: "7F3A9C21", admins: [], pending_admin: "tvjo@kfcvoorbeeld.be", members: 0, teams: 0, players: 0, feedback_open: 0 }];
/* demo-cijfers voor het platformoverzicht (verzonnen) */
const PLATFORM_STATS_DEMO = () => { const wk = new Date(); wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7));
  return { generated_at: new Date().toISOString(), users: 31, active_7: 17, active_30: 26, new_30: 6, waiting: 1, feedback_open: 2, db_bytes: 61e6,
    weeks: Array.from({ length: 12 }, (_, i) => { const d = new Date(wk); d.setDate(d.getDate() - 7 * (11 - i)); return { week: d.toISOString().slice(0, 10), accounts: [0, 1, 0, 2, 3, 1, 0, 4, 2, 1, 3, 2][i], events: [18, 22, 25, 31, 28, 35, 40, 38, 44, 41, 47, 52][i] }; }),
    clubs: [{ id: OGV_ID, members: 14, active_7: 11, last_login: new Date(Date.now() - 36e5).toISOString(), trainings_30: 64, matches_30: 38, reports_30: 31, evals_season: 120, setup_done: true },
      { id: "demo-b", members: 0, active_7: 0, last_login: null, trainings_30: 0, matches_30: 0, reports_30: 0, evals_season: 0, setup_done: false }] }; };
const agoTxt = iso => { if (!iso) return "nog nooit"; const h = (Date.now() - new Date(iso)) / 36e5; return h < 1 ? "net nog" : h < 24 ? Math.round(h) + " uur geleden" : Math.round(h / 24) === 1 ? "gisteren" : Math.round(h / 24) + " dagen geleden"; };
/* kleine staafgrafiek: één reeks, waarde-labels enkel bij de laatste week, hover toont de week */
function pbars(rows, key, unit) {
  const max = Math.max(1, ...rows.map(r => +r[key] || 0)), W = 100 / rows.length;
  return `<div class="pbars" role="img" aria-label="${esc(unit)} per week, laatste 12 weken">${rows.map((r, i) => { const v = +r[key] || 0, d = new Date(r.week);
    return `<span class="pb" style="left:${i * W}%;width:${W}%" title="Week van ${d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}: ${v} ${esc(unit)}"><i style="height:${Math.max(v ? 4 : 0, v / max * 100)}%"></i>${i === rows.length - 1 ? `<em>${v}</em>` : ""}</span>`; }).join("")}</div>
    <div class="pbx"><span>${new Date(rows[0].week).toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}</span><span>deze week</span></div>`;
}
route("platform", { title: "Platform", auth: true, render: async (v, sub) => {
  if (!S.platform && mode !== "demo") { v.innerHTML = `<div class="empty"><b>Alleen voor de beheerder van het platform</b></div>`; return; }
  if (sub === "meldingen") { v.innerHTML = head("Meldingen van alle clubs", "Problemen en vragen die trainers doorstuurden met de knop Probleem melden.", `<a class="btn ghost" href="#/platform">Terug</a>`) + `<div id="pfb"></div>`; return adminFeedback($("#pfb")); }
  v.innerHTML = head("Platform", "Laden…");
  let data, st = null;
  if (mode === "demo") { data = PLATFORM_DEMO(); st = PLATFORM_STATS_DEMO(); }
  else { const [r, s] = await Promise.all([sb.rpc("platform_clubs"), sb.rpc("platform_stats")]);
    if (r.error) { v.innerHTML = head("Platform", "") + `<div class="empty"><b>Nog niet klaar</b>${/platform_clubs|function/i.test(r.error.message) ? "Voer eerst het databasescript v33 uit in Supabase." : esc(r.error.message)}</div>`; return; }
    data = r.data || []; if (!s.error) st = s.data; }
  const sc = id => st?.clubs?.find(x => x.id === id) || {};
  data.forEach(c => Object.assign(c, { ...sc(c.id), name: c.name, settings: c.settings }));
  const sum = k => data.reduce((a, c) => a + (+c[k] || 0), 0);
  const badge = c => { const keep = { id: CLUB.id, short: CLUB.short, name: CLUB.name, settings: CLUB.settings }; Object.assign(CLUB, { id: c.id, short: c.short, name: c.name, settings: c.settings || {} }); const h = LOGO("plat"); Object.assign(CLUB, keep); return h; };
  const days = iso => iso ? (Date.now() - new Date(iso)) / 864e5 : Infinity;
  const status = c => !(c.admins || []).length ? (c.pending_admin ? ["w", "Wacht op beheerder"] : ["loss", "Geen beheerder"])
    : c.setup_done === false && !(c.settings || {}).setup_done && c.id !== OGV_ID ? ["w", "Opstart bezig"]
    : st && days(c.last_login) > 14 ? ["loss", "Stil sinds " + Math.round(days(c.last_login)) + " dagen"] : ["win", "Actief"];
  const mb = st ? st.db_bytes / 1e6 : 0, mbMax = 500, attention = data.filter(c => status(c)[0] !== "win");
  v.innerHTML = head("Platform", st ? `Overzicht van ${PRODUCT}, bijgewerkt om ${new Date(st.generated_at).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}. Enkel tellingen: spelers, ploegen en verslagen van een club zie je hier niet.` : "Clubs aanmaken en instellen.",
      `<button class="btn" type="button" id="pnew">${IC.plus}Nieuwe club</button>`) +
    (st ? "" : `<div class="share sec">${IC.eye}<div>Voer het databasescript <b>v36</b> uit in Supabase om hier ook het gebruik per club en per week te zien.</div></div>`) +
    `<div class="sec kpis">
      <div class="kpi"><small>Clubs</small><b>${data.length}</b><span>${data.filter(c => status(c)[0] === "win").length} actief</span></div>
      <div class="kpi"><small>Actief deze week</small><b>${st ? st.active_7 : "–"}</b><span>${st ? `van ${st.users} accounts · ${st.active_30} deze maand` : "voer v36 uit"}</span></div>
      <div class="kpi"><small>Spelers in de app</small><b>${sum("players")}</b><span>in ${sum("teams")} ploegen</span></div>
      <a class="kpi kpil" href="#/platform/meldingen"><small>Open meldingen</small><b>${st ? st.feedback_open : sum("feedback_open")}</b><span>bekijken ›</span></a></div>
    ${attention.length ? `<div class="sec pattn"><h2>Aandacht nodig</h2>${attention.map(c => { const [k, l] = status(c); return `<a class="pat" href="#/platformclub/${esc(c.id)}/club"><span class="pill ${k}">${esc(l)}</span><b>${esc(c.name)}</b><span class="hint">${
      l === "Geen beheerder" ? "Duid een beheerder aan en stuur de uitnodiging." : l === "Wacht op beheerder" ? "De beheerder heeft nog geen account. Stuur de uitnodiging opnieuw." : l === "Opstart bezig" ? "De club heeft de vijf opstartstappen nog niet afgerond." : "Niemand van de club logde de laatste twee weken in. Even bellen?"}</span></a>`; }).join("")}</div>` : ""}
    ${st ? `<div class="sec pgrid">
      <div class="panel"><h2>Activiteiten gepland</h2><p class="hint" style="margin-top:0">Trainingen en wedstrijden die trainers per week aanmaakten.</p>${pbars(st.weeks, "events", "activiteiten")}</div>
      <div class="panel"><h2>Nieuwe accounts</h2><p class="hint" style="margin-top:0">Trainers en beheerders die per week een account maakten.</p>${pbars(st.weeks, "accounts", "accounts")}</div>
      <div class="panel"><h2>Database</h2><p class="hint" style="margin-top:0">Gebruikte ruimte van het gratis plan (${mbMax} MB). Ruim voor 80% overstappen naar Pro.</p>
        <div class="pmeter"><i style="width:${Math.min(100, mb / mbMax * 100)}%"></i></div><p class="pmv"><b>${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB</b> van ${mbMax} MB · ${Math.round(mb / mbMax * 100)}%</p>
        <p class="hint" style="margin-bottom:0">${st.waiting ? `${st.waiting} account${st.waiting > 1 ? "s" : ""} zonder club: wie zich aanmeldde zonder clubcode.` : "Geen accounts zonder club."}</p></div></div>` : ""}
    <div class="sec"><h2>Clubs</h2><div class="plist">${data.map(c => { const [k, l] = status(c); return `<article class="pclub">
      <div class="ph1">${badge(c)}<span class="pn"><b>${esc(c.name)}</b><small>${c.teams} ploegen · ${c.players} spelers · ${c.members} leden</small></span><span class="pill ${k}">${esc(l)}</span></div>
      ${st ? `<div class="pmet"><div><b>${c.active_7 ?? 0}</b><small>actief deze week</small></div><div><b>${c.trainings_30 ?? 0}</b><small>trainingen</small></div><div><b>${c.matches_30 ?? 0}</b><small>wedstrijden</small></div><div><b>${c.evals_season ?? 0}</b><small>evaluaties</small></div></div>
        <p class="hint" style="margin:0">Trainingen en wedstrijden van de laatste 30 dagen, evaluaties van dit seizoen. Laatst iemand ingelogd: ${agoTxt(c.last_login)}${c.matches_30 ? ` · ${Math.round((c.reports_30 || 0) / c.matches_30 * 100)}% wedstrijden met uitslag` : ""}</p>` : ""}
      <dl><div><dt>Beheerder</dt><dd>${(c.admins || []).length ? (c.admins || []).map(esc).join(", ") : c.pending_admin ? esc(c.pending_admin) + ` <span class="hint">(nog geen account)</span>` : `<button class="link" type="button" data-edit="${esc(c.id)}">Aanduiden</button>`}</dd></div>
        <div><dt>Clubcode</dt><dd><b translate="no">${esc(c.code || "–")}</b></dd></div></dl>
      <div class="pact"><a class="btn small" href="#/platformclub/${esc(c.id)}/club">${IC.gear}Instellingen</a><button class="btn ghost small" type="button" data-edit="${esc(c.id)}">Beheerder en code</button><button class="ib" type="button" data-inv="${esc(c.id)}" title="Uitnodiging voor de beheerder kopiëren" aria-label="Uitnodiging kopiëren">${IC.copy}</button></div></article>`; }).join("")}</div></div>
    <details class="sec pdet"><summary><h2 style="display:inline">Zo start een nieuwe club</h2></summary><ol class="psteps">
      <li><b>Club aanmaken</b><span>Met de naam en het e-mailadres van de beheerder (bv. de TVJO). Jij wordt geen lid.</span></li>
      <li><b>Uitnodiging sturen</b><span>Kopieer de uitnodiging en mail ze naar de beheerder. Daarin staan de link en de clubcode.</span></li>
      <li><b>De club zet zichzelf klaar</b><span>Na het aanmelden leidt de app de beheerder door vijf stappen: kleuren, evaluaties, onderdelen, ploegen en trainers uitnodigen.</span></li>
      <li><b>Trainers aan de slag</b><span>Trainers maken een account met de clubcode. Bij elke pagina staat een vraagteken dat naar de uitleg in de handleiding gaat.</span></li></ol></details>`;
  $("#pnew").onclick = () => newClubDialog(() => render());
  $$("[data-inv]", v).forEach(b => b.onclick = () => { const c = data.find(x => x.id === b.dataset.inv); navigator.clipboard?.writeText(inviteText(c.name, c.code, c.pending_admin || (c.admins || [])[0])).then(() => toast("Uitnodiging gekopieerd. Plak ze in een mail aan de beheerder.")); });
  $$("[data-edit]", v).forEach(b => b.onclick = () => editClubDialog(data.find(x => x.id === b.dataset.edit), () => render()));
} });
function newClubDialog(done) {
  const d = dialog(`<form class="dlg" id="pcf"><h2>Nieuwe club</h2><p class="muted" style="margin-top:0">De club krijgt een eigen clubcode en ziet niets van andere clubs. Jij wordt geen lid van de club. Heeft de beheerder nog geen account, dan wordt hij beheerder zodra hij er een maakt met dit e-mailadres.</p>
    <label class="f">Officiële naam<input name="nm" required maxlength="80" placeholder="bv. KFC Voorbeeld"></label>
    <div class="row"><label class="f" style="flex:1">Korte naam<input name="sh" maxlength="12" placeholder="bv. KFCV"></label><label class="f" style="flex:2">E-mail van de beheerder<input name="mail" type="email" required placeholder="tvjo@club.be"></label></div>
    <div id="pcres"></div><div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Club aanmaken</button></div></form>`);
  const f = $("#pcf", d);
  f.onsubmit = async e => { e.preventDefault(); if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; }
    const r = await sb.rpc("create_club", { nm: f.nm.value, sh: f.sh.value, admin_mail: f.mail.value }); if (r.error) { toast(r.error.message); return; }
    const txt = inviteText(r.data.name, r.data.code, f.mail.value.trim());
    f.innerHTML = `<h2>${esc(r.data.name)} staat klaar</h2><p>Clubcode: <b>${esc(r.data.code)}</b>${r.data.admin ? ". De beheerder had al een account en is meteen beheerder." : ". De beheerder wordt dat zodra hij een account maakt."}</p>
      <label class="f">Uitnodiging voor de beheerder<textarea readonly rows="9">${esc(txt)}</textarea></label><div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" id="pccopy">Tekst kopiëren</button><button class="btn" type="button" data-close>Klaar</button></div>`;
    $("#pccopy", f).onclick = () => navigator.clipboard?.writeText(txt).then(() => toast("Gekopieerd."));
    $$("[data-close]", f).forEach(b => b.onclick = () => d.close()); done?.(); };
}
function editClubDialog(c, done) {
  const st = c.settings || {}, fixed = c.id === OGV_ID;
  const d = dialog(`<form class="dlg" id="pef"><h2>${esc(c.name)}</h2><p class="muted" style="margin-top:0">Wat je hier aanpast, ziet iedereen van deze club meteen bij het openen van de app.</p>
    ${clubFieldsHtml(c, st, { fixed, hint: "Het voorbeeld hieronder toont hoe de app er voor deze club uitziet." })}
    ${fixed ? "" : `<div class="pmock" id="pmock"><span class="ms"><i></i><i></i><i></i></span><span class="mm"><b>Goeiemiddag, trainer</b><span class="mb">Volgende training</span><span class="mc"><i></i>Aanwezigheden</span></span></div>`}
    <h3 style="margin:18px 0 4px">Beheerder van de club</h3><p class="hint" style="margin-top:0">Huidig: ${(c.admins || []).length ? (c.admins || []).map(esc).join(", ") : c.pending_admin ? esc(c.pending_admin) + " (wacht op account)" : "nog geen"}. Een extra beheerder aanduiden kan hier; trainers voegt de club zelf toe.</p>
    <div class="row"><label class="f" style="flex:1;margin:0"><span class="sr">E-mail van de beheerder</span><input name="amail" type="email" placeholder="tvjo@club.be"></label><button class="btn ghost" type="button" id="pset">Aanduiden</button></div>
    <h3 style="margin:18px 0 4px">Koppeling met RBFA</h3><p class="hint" style="margin-top:0">Het nummer van de club in de link van haar clubpagina op rbfa.be. Daarmee halen trainers hun wedstrijden automatisch op.</p>
    <label class="f" style="max-width:220px"><span class="sr">Clubnummer bij RBFA</span><input name="rbfa" inputmode="numeric" value="${esc(st.rbfa || (fixed ? "1126" : ""))}" placeholder="bv. 1126"></label>
    <h3 style="margin:18px 0 4px">Clubcode</h3><div class="row" style="align-items:center"><b style="font-size:18px;letter-spacing:.06em" id="pcode">${esc(c.code || "–")}</b><span class="spacer"></span><button class="btn ghost small" type="button" id="pcodenew">Nieuwe code maken</button></div>
    <p class="hint">Een nieuwe code is nodig als de oude bij mensen buiten de club terechtkwam. Wie al lid is, blijft lid.</p>
    ${fixed ? "" : `<details class="pdanger"><summary>Club verwijderen</summary><p>Alles van ${esc(c.name)} wordt <b>definitief</b> gewist: ${c.teams ?? 0} ploegen, ${c.players ?? 0} spelers met hun aanwezigheden, verslagen en evaluaties, scouting, berichten en instellingen. De ${c.members ?? 0} accounts blijven bestaan, maar horen daarna bij geen club meer. Dit kan niet ongedaan gemaakt worden.</p>
      <label class="f"><span>Typ <b>${esc(c.name)}</b> om te bevestigen</span><input name="delname" autocomplete="off" spellcheck="false"></label><div class="row" style="justify-content:flex-end"><button class="btn danger" type="button" id="pdel" disabled>Club definitief verwijderen</button></div></details>`}
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" type="button" data-close>Sluiten</button><button class="btn">Bewaren</button></div></form>`, "xl");
  const f = $("#pef", d), mock = $("#pmock", d);
  const del = $("#pdel", d); if (del) { f.delname.oninput = () => { del.disabled = f.delname.value.trim() !== c.name; };
    del.onclick = async () => { if (f.delname.value.trim() !== c.name) return; if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; }
      del.disabled = true; del.textContent = "Verwijderen…";
      const r = await sb.rpc("platform_delete_club", { c: c.id, confirm_name: f.delname.value.trim() });
      if (r.error) { del.disabled = false; del.textContent = "Club definitief verwijderen"; toast(/platform_delete_club|function/i.test(r.error.message) ? "Voer eerst het databasescript v37 uit." : r.error.message); return; }
      d.close(); toast(`${r.data.name} is verwijderd (${r.data.teams} ploegen, ${r.data.players} spelers).`); done?.(); }; }
  const paint = s => { if (!mock) return; const a = s.color || "#FFD100", b = s.color2, on = lumRgb(hexRgb(a)) > .38 ? "#111" : "#fff";
    mock.style.setProperty("--ma", a); mock.style.setProperty("--mon", on); mock.style.setProperty("--mb", b ? rgbHex(mixRgb([13, 14, 12], hexRgb(b), .2)) : "#121311"); mock.style.setProperty("--mg", b ? rgbHex(mixRgb([13, 14, 12], hexRgb(b), .1)) : "#0D0E0C"); };
  const cur = bindClubFields(f, c, st, paint); paint(cur());
  $("#pset", f).onclick = async () => { const m = f.amail.value.trim(); if (!m) { f.amail.focus(); return; } if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; }
    const r = await sb.rpc("platform_set_admin", { c: c.id, mail: m }); if (r.error) { toast(r.error.message); return; }
    toast(r.data === "klaar" ? `${m} is nu beheerder van ${c.name}.` : `${m} wordt beheerder zodra hij een account maakt.`); f.amail.value = ""; done?.(); };
  $("#pcodenew", f).onclick = async e => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Zeker? De oude code werkt dan niet meer"; return; } if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; }
    const r = await sb.rpc("platform_new_code", { c: c.id }); if (r.error) { toast(r.error.message); return; } $("#pcode", f).textContent = r.data; c.code = r.data; b.textContent = "Nieuwe code maken"; delete b.dataset.sure; toast("Nieuwe clubcode gemaakt."); done?.(); };
  f.onsubmit = async e => { e.preventDefault(); if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; }
    const s = cur(); if (fixed) { delete s.color; delete s.color2; }
    const rb = f.rbfa.value.replace(/\D/g, ""); if (rb) s.rbfa = rb; else delete s.rbfa;
    const r = await sb.rpc("platform_update_club", { c: c.id, nm: f.nm.value, sh: f.sh.value, s }); if (r.error) { toast(/platform_update_club|function/i.test(r.error.message) ? "Voer eerst het databasescript v33 uit." : r.error.message); return; }
    if (c.id === CLUB.id) { Object.assign(CLUB, { name: f.nm.value.trim(), short: f.sh.value.trim() || CLUB.short, settings: s }); rememberClub(); applyClubTheme(); shell(); }
    d.close(); toast("Bewaard."); done?.(); };
}

async function adminFeedback(host) {
  let data = [];
  if (mode === "demo") data = [{ id: "1", kind: "Er werkt iets niet", name: "Jelle Lauwers", email: "jelle@voorbeeld.be", page: "#/trainingen", message: "Als ik op Bewaren tik bij een oefening, gebeurt er niets.", info: { versie: "38", toestel: "iPhone Safari", scherm: "390×844" }, status: "nieuw", created_at: new Date(Date.now() - 36e5).toISOString() },
    { id: "2", kind: "Idee of wens", name: "Steven Deneef", email: "steven@voorbeeld.be", page: "#/bibliotheek", message: "Kunnen we oefeningen ook per seizoen markeren?", info: {}, status: "afgehandeld", created_at: new Date(Date.now() - 864e5 * 3).toISOString() }];
  else { const r = await sb.from("feedback").select("*").order("created_at", { ascending: false }).limit(200);
    if (r.error) { host.innerHTML = `<div class="share">${IC.eye}<div>${/feedback|relation|schema/i.test(r.error.message) ? "Meldingen staan nog niet klaar in de database. Voer <b>ogv-database.sql</b> uit in Supabase (zie Systeem)." : esc(r.error.message)}</div></div>`; return; } data = r.data; }
  const open = data.filter(x => x.status !== "afgehandeld"), done = data.length - open.length; S.fbOpen = open.length;
  const list = FB_F === "open" ? open : FB_F === "klaar" ? data.filter(x => x.status === "afgehandeld") : data;
  const KC = { "Er werkt iets niet": "var(--s-bad,#E11D48)", "Idee of wens": "var(--yellow)", "Vraag": "#38BDF8", "Toegang tot ploeg": "#22C55E" };
  const ago = d => { const m = Math.round((Date.now() - new Date(d)) / 6e4); return m < 60 ? `${Math.max(1, m)} min geleden` : m < 1440 ? `${Math.round(m / 60)} u geleden` : new Date(d).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }); };
  host.innerHTML = `<div class="fbtop"><div class="seg fbseg" role="group" aria-label="Filter">${[["open", `Open (${open.length})`], ["klaar", `Afgehandeld (${done})`], ["alle", `Alle (${data.length})`]].map(([k, l]) => `<button type="button" data-fbf="${k}" aria-pressed="${FB_F === k}">${l}</button>`).join("")}</div>
      <span class="hint">Trainers melden iets via <b>Probleem melden</b> onderaan hun menu.</span></div>
    ${list.length ? `<div class="fbcards">${list.map(x => `<article class="fbcard${x.status === "afgehandeld" ? " done" : ""}" style="--kc:${KC[x.kind] || "var(--muted)"}">
        <header><span class="fbkind">${esc(x.kind || "Melding")}</span><span class="hint">${ago(x.created_at)}</span></header>
        <p class="fbmsg">${esc(x.message)}</p>
        <div class="fbmeta"><span class="av sm" aria-hidden="true">${esc((x.name || x.email || "?")[0].toUpperCase())}</span><span><b>${esc(x.name || x.email || "Trainer")}</b>${x.name && x.email ? `<small>${esc(x.email)}</small>` : ""}</span></div>
        <div class="fbacts">${x.kind === "Toegang tot ploeg" && x.info?.ploeg && x.user_id && x.status !== "afgehandeld" ? `<button class="btn small" type="button" data-link="${x.id}">Koppelen aan ${esc(x.info.ploegnaam || "ploeg")}</button>` : ""}${x.page ? `<a class="btn ghost small" href="${esc(x.page)}">${x.kind === "Toegang tot ploeg" ? "Ploegen en trainers" : "Open pagina"}</a>` : ""}${x.email ? `<a class="btn ghost small" href="mailto:${esc(x.email)}?subject=${encodeURIComponent("Je melding in " + APPNAME())}&body=${encodeURIComponent("Dag " + (x.name || "") + ",\n\nBedankt voor je melding:\n\"" + x.message + "\"\n\n")}">Antwoorden</a>` : ""}
          ${Object.keys(x.info || {}).length ? `<button class="link" type="button" data-inf="${x.id}">Technische info</button>` : ""}<span class="spacer"></span><button class="btn small${x.status === "afgehandeld" ? " ghost" : ""}" type="button" data-st="${x.id}">${x.status === "afgehandeld" ? "Heropenen" : "Afgehandeld"}</button></div></article>`).join("")}</div>`
      : `<div class="empty"><b>${FB_F === "open" ? "Geen open meldingen" : "Niets gevonden"}</b>${FB_F === "open" ? "Alles is afgehandeld. Nieuwe meldingen verschijnen hier en als getal in het menu." : ""}</div>`}`;
  $$("[data-fbf]", host).forEach(b => b.onclick = () => { FB_F = b.dataset.fbf; adminFeedback(host); });
  $$("[data-st]", host).forEach(b => b.onclick = async () => { const x = data.find(z => z.id === b.dataset.st), st = x.status === "afgehandeld" ? "nieuw" : "afgehandeld";
    if (mode === "demo") { x.status = st; toast("In de demo wordt dit niet bewaard."); return; }
    const { error } = await sb.from("feedback").update({ status: st }).eq("id", x.id); if (error) toast(error.message); else { await adminFeedback(host); shell(); render(); } });
  $$("[data-link]", host).forEach(b => b.onclick = async () => { const x = data.find(z => z.id === b.dataset.link);
    if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; }
    const r = await sb.rpc("admin_set_trainer", { t: x.info.ploeg, uid: x.user_id, on_team: true }); if (r.error) { toast(r.error.message); return; }
    await sb.from("feedback").update({ status: "afgehandeld" }).eq("id", x.id); toast(`${x.name || x.email} is nu trainer van ${x.info.ploegnaam}.`); await adminFeedback(host); shell(); render(); });
  $$("[data-inf]", host).forEach(b => b.onclick = () => { const x = data.find(z => z.id === b.dataset.inf);
    dialog(`<div class="dlg"><h2>Technische info</h2><dl class="fbinfo">${Object.entries(x.info || {}).map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(Array.isArray(val) ? (val.join(" · ") || "–") : String(val))}</dd>`).join("")}</dl><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Sluiten</button></div></div>`); });
}
/* databasecontrole: welke onderdelen staan klaar in Supabase? */
async function dbCheck(host) {
  if (mode === "demo") { host.innerHTML = `<h2>Databasecontrole</h2><p class="hint">In de demo is er geen database om te controleren.</p>`; return; }
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
    ["Probleem melden", () => sb.from("feedback").select("id").limit(1)],
    ["Functies en contactlijst", () => sb.from("club_contacts").select("id").limit(1)],
    ["Vaste trainingen inplannen", () => sb.from("events").select("series").limit(1)],
    ["Convocaties, berichten, oudercontacten en clubdashboard", () => sb.from("messages").select("id").limit(1)],
    ["Velden verdelen (helft of kwart) en einduren", () => sb.from("events").select("field_part").limit(1)],
    ["Kleedkamers en scheidsrechters", () => sb.from("events").select("kk_home,kk_away,referee").limit(1)]];
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
    return { r, linked, same, cat, name: clubShort() + " " + rbfaName(r.name), format: formatFor(r.name) }; })
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
  host.innerHTML = `<p class="hint" style="margin-top:0">Voeg trainers toe aan een ploeg, verplaats ze naar een andere ploeg of haal ze weg. Een trainer die je weghaalt, blijft lid van de club en houdt zijn eigen oefeningen.</p>
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
let PL_MODE = "ouder";
const playerUrl = p => location.origin + location.pathname.replace(/index\.html$/, "") + "ouder/" + (mode === "demo" ? "?demo" : "") + "#" + p.player_token;
async function parentLinks() {
  const ps = active(); if (!ps.length) { toast("Voeg eerst spelers toe."); return; }
  if (mode === "demo") for (const p of ps) { await ensureToken(p); if (!p.player_token) { p.player_token = uid(); await db.save("players", p); } }
  if (ps.some(p => !p.parent_token)) { toast("Voer eerst het databasescript ogv-database.sql uit in Supabase."); return; }
  const kidOK = ps.every(p => p.player_token);
  const msgO = p => `Dag ouders van ${p.first_name}! 👋\nVia de app ${clubShort()} Ouders zien jullie de trainingen, wedstrijden en convocaties van ${S.team.name}, laten jullie weten of ${p.first_name} komt en vullen jullie je contactgegevens in.\n\nOpen deze link één keer en zet de app op je beginscherm: ${parentUrl(p)}\n\nHeb je nog een kind bij de club? Open ook die link: het komt er gewoon bij. Deze link is persoonlijk, stuur hem niet door.`;
  const msgS = p => `Hey ${p.first_name}! ⚽\nMet deze link zie je al je trainingen en wedstrijden van ${S.team.name}, of je geselecteerd bent en hoe je seizoen loopt. Je kan ook zelf zeggen of je komt.\n\nOpen hem op je gsm en zet hem op je beginscherm: ${playerUrl(p)}\n\nDeze link is alleen voor jou: stuur hem niet door.`;
  const d = dialog(`<div class="dlg"><h2>Links voor ${esc(clubShort())} Ouders</h2>
    <div class="chips" style="margin:8px 0 10px"><button class="chip" type="button" data-plm="ouder">Voor ouders</button><button class="chip" type="button" data-plm="speler"${kidOK ? "" : " disabled title=\"Voer eerst ogv-database.sql (versie 18) uit\""}>Voor spelers met een eigen gsm</button></div>
    <p class="hint" style="margin:0" id="plh"></p><div class="list" id="pll" style="margin-top:10px"></div>
    <div class="row"><span class="spacer"></span><button class="btn" type="button" data-close>Klaar</button></div></div>`, "wide");
  const draw = () => { const kid = PL_MODE === "speler" && kidOK, url = kid ? playerUrl : parentUrl, msg = kid ? msgS : msgO;
    $$("[data-plm]", d).forEach(b => b.setAttribute("aria-pressed", b.dataset.plm === (kid ? "speler" : "ouder")));
    $("#plh", d).innerHTML = kid ? `Spelers met een eigen gsm (meestal vanaf U12) krijgen hun eigen link: agenda, convocaties, hun seizoen en het nieuws, en ze geven zelf door of ze komen. Ze zien <b style="color:var(--ink)">geen</b> contactgegevens, medische info of toestemmingen en kunnen de trainer geen berichten sturen; dat blijft bij de ouders. <b style="color:var(--ink)">Stuur elke link apart</b>, liefst via de ouders.`
      : `Elke speler heeft een eigen link naar de app <b>${esc(clubShort())} Ouders</b>. Ouders zien daarin de activiteiten van de komende 6 weken, convocaties, het seizoen en berichten, tikken aan of hun kind komt, sturen de trainer een bericht en vullen zelf hun contactgegevens, medische info en toestemming voor beeldmateriaal in.<br><b style="color:var(--ink)">Stuur elke link apart</b>, niet in de groepschat: wie de link heeft, kan antwoorden voor die speler.`;
    $("#pll", d).innerHTML = ps.map(p => `<div class="item static plink" data-p="${p.id}"><span class="main"><b>${esc(pname(p))}</b><small>${esc(url(p))}</small></span>
      <a class="btn small" href="https://wa.me/?text=${encodeURIComponent(msg(p))}" target="_blank" rel="noopener">WhatsApp</a><a class="btn ghost small" href="${esc(url(p))}" target="_blank" rel="noopener" title="Zie wat ${kid ? "de speler" : "de ouders"} ziet">Bekijk</a><button class="btn ghost small" type="button" data-cp="${p.id}">${IC.copy}Kopiëren</button><button class="link" type="button" data-new="${p.id}" title="Maak een nieuwe link; de oude werkt dan niet meer">Nieuwe link</button></div>`).join("");
    $$("[data-cp]", d).forEach(b => b.onclick = () => { const p = S.players.find(x => x.id === b.dataset.cp); navigator.clipboard?.writeText(msg(p)).then(() => toast("Bericht met link gekopieerd."), () => toast(url(p))); });
    $$("[data-new]", d).forEach(b => b.onclick = async () => { const p = S.players.find(x => x.id === b.dataset.new);
      if (!confirm(`Nieuwe ${kid ? "spelerslink" : "ouderlink"} maken voor ${p.first_name}? De oude link werkt dan niet meer.`)) return;
      p[kid ? "player_token" : "parent_token"] = uid(); if (await safe(async () => { await db.save("players", p); return true; }, "Nieuwe link gemaakt.")) draw(); }); };
  $$("[data-plm]", d).forEach(b => b.onclick = () => { PL_MODE = b.dataset.plm; draw(); }); draw();
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
    <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Nieuwe ploeg maken</button></div></form>`, "xl");
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

/* ============ wie contacteer ik? — de club vult zelf in wie je bij welk probleem bereikt ============ */
const CT_CATS = ["Administratie", "Sportief", "Medisch en welzijn", "Praktisch", "Algemeen"];
const CT_COL = { Administratie: "#38BDF8", Sportief: "#FFD100", "Medisch en welzijn": "#FB7185", Praktisch: "#22C55E", Algemeen: "#A78BFA" };
const telHref = p => "tel:" + String(p || "").replace(/[^\d+]/g, "");
const waHref = p => { let n = String(p || "").replace(/[^\d+]/g, ""); if (n.startsWith("+")) n = n.slice(1); else if (n.startsWith("00")) n = n.slice(2); else if (n.startsWith("0")) n = "32" + n.slice(1); return "https://wa.me/" + n; };
let CT_Q = "";
route("contacten", { title: "Wie contacteer ik?", auth: true, render: async v => {
  v.innerHTML = head("Wie contacteer ik?", "Laden…");
  let list = [];
  if (mode === "demo") list = [{ id: "d1", cat: "Administratie", topic: "Administratie en algemene organisatie", name: "Voorbeeld Persoon", functie: "AVJO", phone: "0470 00 00 00", note: "Wedstrijdverplaatsingen\nAttesten" }, { id: "d2", cat: "Medisch en welzijn", topic: "Blessures en kine", name: "Voorbeeld Kine", functie: "Clubkinesist", phone: "0470 11 11 11", note: "Elke dinsdag op de club" }];
  else { const r = await sb.from("club_contacts").select("*").order("sort").order("topic");
    if (r.error) { v.innerHTML = head("Wie contacteer ik?", "") + `<div class="empty"><b>Nog niet beschikbaar</b>${S.admin ? "Voer ogv-database.sql (versie 12) uit in Supabase." : "De beheerder zet deze lijst binnenkort klaar."}</div>`; return; } list = r.data; }
  const draw = () => {
    const t = CT_Q.trim().toLowerCase(), shown = list.filter(c => !t || [c.topic, c.name, c.functie, c.note, c.cat].filter(Boolean).join(" ").toLowerCase().includes(t));
    const cats = [...new Set([...CT_CATS, ...list.map(c => c.cat)])].filter(c => shown.some(x => x.cat === c));
    $("#ctl", v).innerHTML = shown.length ? cats.map(c => `<section class="ctcat" style="--cc:${CT_COL[c] || "var(--muted)"}"><h2><i aria-hidden="true"></i>${esc(c)}</h2><div class="ctgrid">${shown.filter(x => x.cat === c).map(x => `<article class="ctcard">
        <div class="cthd"><small class="cttopic">${esc(x.topic)}</small>${S.admin ? `<button class="link" type="button" data-ce="${x.id}">Bewerken</button>` : ""}</div><b class="ctname">${esc(x.name || "–")}</b>
        <span class="ctline">${x.functie ? `<span class="ctfn">${esc(x.functie)}</span>` : ""}${x.phone ? `<span class="ctphone">${esc(x.phone)}</span>` : ""}${x.email ? `<span class="ctphone">${esc(x.email)}</span>` : ""}</span>
        ${x.note ? `<ul class="ctnote">${x.note.split("\n").filter(Boolean).map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
        <div class="ctacts">${x.phone ? `<a class="btn small" href="${telHref(x.phone)}">${IC.phone}Bellen</a><a class="btn ghost small" href="${waHref(x.phone)}" target="_blank" rel="noopener">${IC.wa}WhatsApp</a>` : ""}${x.email ? `<a class="btn ghost small" href="mailto:${esc(x.email)}">${IC.mail}Mail</a>` : ""}
          ${!x.phone && !x.email ? `<span class="hint">Nog geen gegevens</span>` : ""}</div></article>`).join("")}</div></section>`).join("")
      : `<div class="empty"><b>${list.length ? "Niets gevonden" : "Nog geen contactpersonen"}</b>${list.length ? "Probeer een ander woord." : S.admin ? "Voeg de contactpersonen van de club toe met de knop hierboven." : "De beheerder vult deze lijst aan."}</div>`;
    $$("[data-ce]", v).forEach(b => b.onclick = () => contactForm(list.find(x => x.id === b.dataset.ce), list, () => render())); };
  v.innerHTML = head("Wie contacteer ik?", "Bij wie kan je terecht voor welke vraag? Zoek op een woord of bel, app of mail meteen.", S.admin ? `<button class="btn" type="button" id="ctadd">${IC.plus}Contactpersoon</button>` : "") +
    `<div class="ct112"><b>Noodgeval?</b> <span>Bel eerst <a href="tel:112">112</a>.</span> <span>Verwittig daarna de ouders en de club.</span></div>
     <div class="filters" style="margin-bottom:16px"><label class="flt grow"><span>Waarvoor zoek je iemand?</span><input type="search" id="ctq" value="${esc(CT_Q)}" placeholder="bv. attest, blessure, wedstrijd verplaatsen, PSD, pesten…"></label></div><div id="ctl"></div>`;
  $("#ctq", v).oninput = e => { CT_Q = e.target.value; draw(); };
  const a = $("#ctadd", v); if (a) a.onclick = () => contactForm(null, list, () => render());
  draw();
} });
function contactForm(c, list, done) {
  const n = !c; c = c || { cat: "Algemeen", topic: "", sort: (Math.max(0, ...list.map(x => x.sort || 0)) + 10) };
  const d = dialog(`<form><h2>${n ? "Contactpersoon toevoegen" : "Contactpersoon bewerken"}</h2><div class="fields">
    <label class="f full">Waarvoor? <span class="hint">het onderwerp, bv. Blessures en kine</span><input name="topic" required value="${esc(c.topic || "")}"></label>
    <label class="f">Groep<input name="cat" list="ctcats" value="${esc(c.cat || "")}"><datalist id="ctcats">${CT_CATS.map(x => `<option value="${x}">`).join("")}</datalist></label>
    <label class="f">Volgorde<input name="sort" type="number" value="${c.sort ?? 100}"></label>
    <label class="f">Naam<input name="name" value="${esc(c.name || "")}"></label>
    <label class="f">Functie<input name="functie" value="${esc(c.functie || "")}" placeholder="bv. AVJO"></label>
    <label class="f">Telefoon<input name="phone" type="tel" value="${esc(c.phone || "")}" placeholder="0470 12 34 56"></label>
    <label class="f">E-mail<input name="email" type="email" value="${esc(c.email || "")}"></label>
    <label class="f full">Waarmee kan je bij deze persoon terecht? <span class="hint">één ding per regel</span><textarea name="note" rows="4">${esc(c.note || "")}</textarea></label></div>
    <div class="row">${n ? "" : `<button class="link danger" type="button" id="ctdel">Verwijderen</button>`}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  const del = $("#ctdel", d); if (del) del.onclick = async () => { if (!confirm(`"${c.topic}" verwijderen?`)) return; if (mode === "demo") { toast("In de demo wordt dit niet bewaard."); return; }
    const { error } = await sb.from("club_contacts").delete().eq("id", c.id); if (error) toast(error.message); else { d.close(); toast("Verwijderd."); done(); } };
  $("form", d).onsubmit = async ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target)); if (mode === "demo") { d.close(); toast("In de demo wordt dit niet bewaard."); return; }
    const row = { ...(n ? {} : { id: c.id }), topic: f.topic.trim(), cat: f.cat.trim() || "Algemeen", sort: +f.sort || 100, name: f.name.trim() || null, functie: f.functie.trim() || null, phone: f.phone.trim() || null, email: f.email.trim() || null, note: f.note.trim() || null, updated_at: new Date().toISOString() };
    const { error } = await sb.from("club_contacts").upsert(row); if (error) toast(error.message); else { d.close(); toast("Opgeslagen."); done(); } };
}

/* ============ beheer: vaste trainingen inplannen voor ploegen ============
   De beheerder zet bv. elke maandag en woensdag 18:00–19:15 een training in de kalender van een ploeg.
   Alle trainingen van één keer inplannen delen een reeks-id (events.series). Trainers kunnen ze nadien
   gewoon aanpassen of verwijderen en zelf extra trainingen toevoegen. */
const WD = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"], WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
/* standaardperiode: van de laatste week van juli tot en met de laatste week van april */
const lastMonday = (y, m) => { const x = new Date(y, m + 1, 0, 12); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const seasonStartIso = () => { const y = +seasonNow().slice(0, 4), a = iso(lastMonday(y, 6)), t = todayIso(); return a > t ? a : t; }; /* nooit trainingen in het verleden */
const seasonEndIso = () => { const y = +seasonNow().slice(5); return iso(addDays(lastMonday(y, 3), 6)); };
async function planEvents() {
  if (mode === "demo") return (await db.list("events", { type: "training" })).filter(e => e.series);
  const r = await sb.from("events").select("id,team_id,date,start_time,end_time,location,series").eq("type", "training").not("series", "is", null).order("date");
  if (r.error) throw r.error; return r.data;
}
async function adminPlanning(host) {
  let evs; try { evs = await planEvents(); } catch (e) {
    host.innerHTML = `<div class="empty"><b>Nog niet beschikbaar</b>Voer eerst ogv-database.sql (versie 13) uit in Supabase. Daarna kan je hier trainingen inplannen.<br><small class="muted">${esc(e.message || "")}</small></div>`; return; }
  const tName = id => S.teams.find(t => t.id === id)?.name || "Onbekende ploeg", today = todayIso();
  const groups = {}; for (const e of evs) (groups[e.series] = groups[e.series] || []).push(e);
  const series = Object.entries(groups).map(([id, xs]) => { const days = [...new Set(xs.map(e => new Date(e.date + "T12:00").getDay()))].sort((a, b) => WD_ORDER.indexOf(a) - WD_ORDER.indexOf(b));
    const teams = [...new Set(xs.map(e => e.team_id))]; return { id, xs, days, teams, from: xs[0].date, to: xs[xs.length - 1].date, f: xs[0], left: xs.filter(e => e.date >= today).length }; })
    .sort((a, b) => tName(a.teams[0]).localeCompare(tName(b.teams[0]), "nl", { numeric: true }));
  host.innerHTML = `<div class="panel"><div class="row"><div style="flex:1;min-width:220px"><h2 style="margin:0">Vaste trainingen</h2><p class="hint" style="margin:4px 0 0">Zet de trainingen van een ploeg in één keer in haar kalender, bv. maandag van 18:00 tot 19:30 op het E-plein en donderdag van 17:30 tot 19:00 op terrein 3. Trainers zien ze meteen, kunnen er één aanpassen of schrappen en voegen zelf extra trainingen toe.</p></div>
      <button class="btn" type="button" id="plnew">${IC.plus}Trainingen inplannen</button></div></div>
    ${series.length ? `<div class="list sec">${series.map(x => `<div class="item static plser"><span class="ic plic">${IC.cal}</span><span class="main"><b>${esc(x.teams.map(tName).join(", "))}</b>
        ${x.days.map(dn => { const e0 = x.xs.find(e => new Date(e.date + "T12:00").getDay() === dn); return `<small>Elke ${WD[dn].toLowerCase()} · ${tm(e0.start_time) || "?"}${e0.end_time ? "–" + tm(e0.end_time) : ""}${e0.location ? " · " + esc(e0.location) : ""}</small>`; }).join("")}
        <small>${dShort(x.from)} tot ${dShort(x.to)} · ${x.xs.length} trainingen, nog ${x.left} gepland</small></span>
        <button class="btn ghost small" type="button" data-pldel="${x.id}">Verwijderen</button></div>`).join("")}</div>`
      : `<div class="empty sec"><b>Nog niets ingepland</b>Tik op <b>Trainingen inplannen</b> om de vaste trainingen van een ploeg in haar kalender te zetten.</div>`}`;
  $("#plnew").onclick = () => planForm(() => adminPlanning(host));
  $$("[data-pldel]", host).forEach(b => b.onclick = () => { const x = series.find(y => y.id === b.dataset.pldel), fut = x.xs.filter(e => e.date >= today);
    const d = dialog(`<div class="dlg"><h2>Ingeplande trainingen verwijderen?</h2><p class="muted" style="margin-top:0">De <b style="color:var(--ink)">${fut.length} trainingen vanaf vandaag</b> van ${esc(x.teams.map(tName).join(", "))} verdwijnen uit de kalender, ook als een trainer er al een trainingsplan aan gekoppeld heeft. Voorbije trainingen met hun aanwezigheden blijven staan.</p>
      <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" type="button" id="pldok">Verwijderen</button></div></div>`);
    $("#pldok", d).onclick = async () => { $("#pldok", d).disabled = true;
      try { if (mode === "demo") { for (const e of fut) await db.del("events", { id: e.id }); }
        else { const ids = fut.map(e => e.id); for (let i = 0; i < ids.length; i += 200) { const r = await sb.from("events").delete().in("id", ids.slice(i, i + 200)); if (r.error) throw r.error; } }
        d.close(); toast(fut.length + " trainingen verwijderd."); await planRefresh(x.teams); adminPlanning(host); }
      catch (e) { toast("Verwijderen lukte niet: " + (e.message || e)); $("#pldok", d).disabled = false; } }; });
}
async function planRefresh(teamIds) { if (S.team && teamIds.includes(S.team.id)) { try { await loadTeam(S.team.id); } catch (e) {} } }
function planForm(done) {
  const teams = S.teams.slice(), locs = [...new Set([...FIELD_NAMES, ...S.events.filter(e => e.type === "training").map(e => e.location).filter(Boolean)])];
  const st = { teams: new Set(S.team ? [S.team.id] : []), days: new Map([[1, { st: "18:00", et: "19:15", loc: "" }]]), skip: [] };
  const d = dialog(`<form class="dlg plform"><h2>Trainingen inplannen</h2>
    <label class="f full">Ploegen<span class="hint" style="font-weight:400">Kies er meerdere als ze op hetzelfde moment trainen.</span></label>
    <div class="plteams">${teams.map(t => `<button type="button" class="chip" data-tm="${t.id}">${esc(t.name)}</button>`).join("") || '<p class="hint">Maak eerst ploegen aan bij Ploegen en trainers.</p>'}</div>
    <label class="f full" style="margin-top:12px">Dagen<span class="hint" style="font-weight:400">Per dag een eigen uur en terrein.</span></label>
    <div class="pldays">${WD_ORDER.map(dn => `<button type="button" class="chip" data-wd="${dn}">${WD[dn].slice(0, 2)}</button>`).join("")}</div>
    <div class="pldayrows" id="pldr"></div><datalist id="pllocs">${locs.map(l => `<option value="${esc(l)}">`).join("")}</datalist>
    <div class="fields" style="margin-top:12px">
      <label class="f">Vanaf<input type="date" name="from" value="${seasonStartIso()}" required></label><label class="f">Tot en met<input type="date" name="to" value="${seasonEndIso()}" required></label></div>
    <label class="f full" style="margin-top:12px">Niet trainen (vakanties, feestdagen)</label>
    <div class="plskip"><input type="date" id="sk1" aria-label="Van"><span>tot</span><input type="date" id="sk2" aria-label="Tot (mag leeg)"><button class="btn ghost small" type="button" id="skadd">${IC.plus}Toevoegen</button></div>
    <div class="plskips" id="skl"></div>
    <div class="plsum" id="plsum"></div>
    <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" id="plok">Inplannen</button></div></form>`);
  const f = $("form", d);
  const dates = () => { const a = f.from.value, b = f.to.value; if (!a || !b || b < a) return [];
    const out = []; let x = new Date(a + "T12:00"); const end = new Date(b + "T12:00");
    while (x <= end && out.length < 800) { const k = iso(x); if (st.days.has(x.getDay()) && !st.skip.some(([s1, s2]) => k >= s1 && k <= (s2 || s1))) out.push(k); x = addDays(x, 1); }
    return out; };
  const sum = () => { const n = dates().length, t = st.teams.size; delete f.dataset.ok; $("#plok", d).textContent = "Inplannen";
    $("#plsum", d).innerHTML = !t ? "Kies minstens één ploeg." : !st.days.size ? "Kies minstens één dag." : !n ? "Er valt geen enkele training in deze periode."
      : `Dit zet <b>${n} trainingen</b>${t > 1 ? ` in de kalender van elk van de <b>${t} ploegen</b> (${n * t} in totaal)` : " in de kalender"}. Bestaat er op die dag al een training op hetzelfde uur, dan wordt ze overgeslagen.`;
    $("#plok", d).disabled = !(n && t); };
  const paint = () => { $$("[data-tm]", d).forEach(b => b.setAttribute("aria-pressed", st.teams.has(b.dataset.tm)));
    $$("[data-wd]", d).forEach(b => b.setAttribute("aria-pressed", st.days.has(+b.dataset.wd)));
    $("#pldr", d).innerHTML = WD_ORDER.filter(dn => st.days.has(dn)).map(dn => { const x = st.days.get(dn); return `<div class="pldr" data-dr="${dn}"><b>${WD[dn]}</b>
      <label class="f">Van<input type="time" data-k="st" value="${esc(x.st)}" required></label><label class="f">Tot<input type="time" data-k="et" value="${esc(x.et)}"></label>
      <label class="f plloc">Terrein<input data-k="loc" list="pllocs" value="${esc(x.loc)}" placeholder="bv. Terrein E of KGV"></label>${V19() ? `<label class="f plpart">Deel<select data-k="part">${partOpts(x.part, fieldOf(x.loc))}</select></label>` : ""}</div>`; }).join("");
    $$("[data-dr] input, [data-dr] select", d).forEach(i => i.oninput = i.onchange = () => { st.days.get(+i.closest("[data-dr]").dataset.dr)[i.dataset.k] = i.value; delete f.dataset.ok; $("#plok", d).textContent = "Inplannen"; });
    $("#skl", d).innerHTML = st.skip.map(([a, b], i) => `<span class="chip on">${dShort(a)}${b && b !== a ? " – " + dShort(b) : ""}<button type="button" data-sk="${i}" aria-label="Weg">✕</button></span>`).join("");
    $$("[data-sk]", d).forEach(b => b.onclick = () => { st.skip.splice(+b.dataset.sk, 1); paint(); }); sum(); };
  $$("[data-tm]", d).forEach(b => b.onclick = () => { const k = b.dataset.tm; st.teams.has(k) ? st.teams.delete(k) : st.teams.add(k); paint(); });
  $$("[data-wd]", d).forEach(b => b.onclick = () => { const k = +b.dataset.wd;
    if (st.days.has(k)) st.days.delete(k); else { const prev = [...st.days.values()].pop() || { st: "18:00", et: "19:15", loc: "" }; st.days.set(k, { ...prev }); } paint(); }); /* nieuwe dag neemt het uur van de vorige over */
  $("#skadd", d).onclick = () => { const a = $("#sk1", d).value, b = $("#sk2", d).value; if (!a) { toast("Kies eerst een datum."); return; } st.skip.push(b && b > a ? [a, b] : [a, null]); $("#sk1", d).value = $("#sk2", d).value = ""; paint(); };
  f.from.onchange = f.to.onchange = sum; paint();
  f.onsubmit = async ev => { ev.preventDefault(); const ds = dates(), tIds = [...st.teams]; if (!ds.length || !tIds.length) return;
    const btn = $("#plok", d); btn.disabled = true; btn.textContent = "Bezig…";
    const series = uid(), slot = dt => st.days.get(new Date(dt + "T12:00").getDay());
    if ([...st.days.values()].some(x => !x.st)) { btn.disabled = false; btn.textContent = "Inplannen"; toast("Vul bij elke dag een beginuur in."); return; }
    try {
      let have = [];
      if (mode === "demo") have = (await db.list("events", { type: "training" })).filter(e => tIds.includes(e.team_id));
      else { const r = await sb.from("events").select("team_id,date,start_time").eq("type", "training").in("team_id", tIds).gte("date", ds[0]).lte("date", ds[ds.length - 1]); if (r.error) throw r.error; have = r.data; }
      const key = (t, dt, s) => t + "|" + dt + "|" + String(s || "").slice(0, 5), seen = new Set(have.map(e => key(e.team_id, e.date, e.start_time)));
      const rows = []; for (const t of tIds) for (const dt of ds) { const x = slot(dt); if (!seen.has(key(t, dt, x.st))) rows.push({ id: uid(), team_id: t, type: "training", date: dt, start_time: x.st, end_time: x.et || null, location: (x.loc || "").trim() || null, series, report: {}, ...(V19() && x.part && fieldOf(x.loc) ? { field_part: x.part } : {}) }); }
      if (!rows.length) { toast("Alles stond al in de kalender."); d.close(); return; }
      if (!f.dataset.ok && V14()) { /* overlap met andere ploegen op hetzelfde terrein? */
        let ex = []; try { ex = await fieldsData(ds[0], ds[ds.length - 1]); } catch (x) {}
        const nw = rows.filter(r => r.location).map(r => ({ id: r.id, team: S.teams.find(t => t.id === r.team_id)?.name, date: r.date, start: r.start_time, end: r.end_time, location: r.location, part: r.field_part || null, mine: true }));
        const bad = overlaps([...ex.filter(x => !tIds.includes(x.team_id)), ...nw]), hits = nw.filter(x => bad.has(x.id));
        if (hits.length) { const other = ex.filter(x => bad.has(x.id)), teamsHit = [...new Set(other.map(x => x.team))];
          $("#plsum", d).innerHTML = `<b style="color:var(--warn)">Let op: ${hits.length} trainingen overlappen</b> met ${esc(teamsHit.join(", "))} op hetzelfde terrein, bv. ${dShort(hits[0].date)} op ${esc(hits[0].location)}. Pas het uur of het terrein aan, geef elke ploeg een helft of een vak (kolom Deel), of plan toch in als dat zo afgesproken is.`;
          f.dataset.ok = "1"; btn.disabled = false; btn.textContent = "Toch inplannen"; return; } }
      if (mode === "demo") { for (const r of rows) await db.insert("events", r); }
      else for (let i = 0; i < rows.length; i += 200) { const r = await sb.from("events").insert(rows.slice(i, i + 200)); if (r.error) throw r.error; }
      d.close(); toast(`${rows.length} trainingen ingepland.`); await planRefresh(tIds); done && done();
    } catch (e) { btn.disabled = false; btn.textContent = "Inplannen"; toast(/series|column|policy|row-level/i.test(e.message || "") ? "Voer eerst ogv-database.sql (versie 13) uit." : "Inplannen lukte niet: " + (e.message || e)); } };
}

/* ============ mijn account: naam, wachtwoord, account verwijderen ============ */
function accountDialog() {
  const d = dialog(`<div class="dlg"><h2>Mijn account</h2><p class="muted" style="margin-top:0">${esc(user?.email || "")} · ${esc(clubName())}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn ghost" type="button" id="acname">Naam wijzigen</button><button class="btn ghost" type="button" id="acpw">Wachtwoord wijzigen</button></div>
    <form id="acpwf" hidden style="margin-top:14px"><label class="f">Nieuw wachtwoord <span class="hint">minstens 8 tekens</span><input type="password" name="pw" minlength="8" required autocomplete="new-password"></label><div class="row" style="justify-content:flex-end"><button class="btn">Wachtwoord bewaren</button></div></form>
    <h3 style="margin:24px 0 4px">Account verwijderen</h3><p class="hint" style="margin-top:0">Je account, je eigen oefeningen, trainingen en borden worden definitief gewist. Gegevens van de club (spelers, verslagen, evaluaties) blijven van de club. Dit kan je niet ongedaan maken.</p>
    <form id="acdel"><label class="f">Typ VERWIJDER om te bevestigen<input name="ok" autocomplete="off" spellcheck="false"></label><div class="row" style="justify-content:space-between;align-items:center"><a class="link" href="${esc(PRIVACY_URL)}" target="_blank" rel="noopener">Privacyverklaring</a><button class="btn danger" disabled>Account verwijderen</button></div></form>
    <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn ghost" type="button" data-close>Sluiten</button></div></div>`);
  $("#acname", d).onclick = () => { d.close(); nameForm(); };
  $("#acpw", d).onclick = () => { const f = $("#acpwf", d); f.hidden = !f.hidden; if (!f.hidden) f.pw.focus(); };
  $("#acpwf", d).onsubmit = async e => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: e.target.pw.value });
    if (error) { toast(error.message); return; } e.target.reset(); e.target.hidden = true; toast("Nieuw wachtwoord bewaard."); };
  const del = $("#acdel", d), go = $("button", del);
  del.ok.oninput = () => { go.disabled = del.ok.value.trim().toUpperCase() !== "VERWIJDER"; };
  del.onsubmit = async e => { e.preventDefault(); if (go.disabled) return; go.disabled = true; go.textContent = "Verwijderen…";
    const r = await sb.rpc("delete_my_account");
    if (r.error) { go.disabled = false; go.textContent = "Account verwijderen"; toast(/delete_my_account|function/i.test(r.error.message) ? "Dit kan nog niet: de beheerder moet eerst een update uitvoeren." : r.error.message); return; }
    try { localStorage.removeItem("ogv-club"); localStorage.removeItem(TEAM_KEY); } catch (err) {}
    await sb.auth.signOut().catch(() => {}); d.close(); toast("Je account is verwijderd."); location.hash = "#/start"; location.reload(); };
}

/* ============ clubinstellingen: bij de opstart stap voor stap, daarna altijd aan te passen ============ */
const CS_STEPS = [["club", "Club"], ["evaluaties", "Evaluaties"], ["onderdelen", "Onderdelen"], ["ploegen", "Ploegen"], ["trainers", "Trainers"]];
/* onderdelen die een club kan uitzetten; de basis (start, kalender, spelers, trainingen) staat altijd aan */
const CS_MODULES = [["evaluaties", "Evaluaties", "Spelers evalueren op vaste momenten"], ["dossier", "Spelersdossier", "Alles van een speler op één pagina"], ["cijfers", "Cijfers", "Statistieken van de ploeg"],
  ["live", "Live coachen", "Klok, doelpunten en wissels langs de lijn"], ["matchday", "Wedstrijdblad", "Opstelling om af te drukken"], ["videoanalyse", "Videoanalyse", "Videostudio met spelersherkenning"],
  ["animatiebord", "Animatiebord", "Bewegende spelpatronen"], ["mixschema", "Mixschema", "Rotatieschema voor gemengde ploegen"], ["principes", "Mijn spelprincipes", "Eigen video's per principe"],
  ["berichten", "Berichten", "Mededelingen aan trainers"], ["terreinen", "Terreinen", "Veldindeling en plattegrond"], ["contacten", "Wie contacteer ik?", "Contactlijst van de club"],
  ["scouting", "Scoutingsdatabase", "Spelers van andere clubs volgen"], ["clubdashboard", "Clubdashboard", "Overzicht voor de jeugdcoördinator"]];
const CS_CATS = [["U6", "2v2"], ["U7", "3v3"], ["U8", "5v5"], ["U9", "5v5"], ["U10", "8v8"], ["U11", "8v8"], ["U12", "8v8"], ["U13", "8v8"], ["U14", "11v11"], ["U15", "11v11"], ["U16", "11v11"], ["U17", "11v11"], ["U19", "11v11"], ["U21", "11v11"]];
/* opslaan: de eigen club via club_save_settings, een andere club (platformbeheer) via platform_update_club */
function csCtxOwn() { return { club: CLUB, base: "#/clubinstellingen", steps: CS_STEPS, platform: false, done: "#/start",
  async saveAll(nm, sh, s, msg) { if (mode !== "demo") { const { error } = await sb.rpc("club_save_settings", { nm, sh, s }); if (error) { toast(error.message); return false; } }
    Object.assign(CLUB, { name: (nm || "").trim() || CLUB.name, short: (sh || "").trim() || CLUB.short, settings: s }); rememberClub(); applyClubTheme(); shell(); if (msg) toast(msg + (mode === "demo" ? " (in de demo enkel op dit toestel)" : "")); return true; } }; }
function csCtxPlatform(c) { return { club: c, base: "#/platformclub/" + c.id, steps: CS_STEPS.filter(x => x[0] !== "ploegen"), platform: true, done: "#/platform",
  async saveAll(nm, sh, s, msg) { if (mode !== "demo") { const { error } = await sb.rpc("platform_update_club", { c: c.id, nm, sh, s }); if (error) { toast(/platform_update_club|function/i.test(error.message) ? "Voer eerst het databasescript v33 uit." : error.message); return false; } }
    Object.assign(c, { name: (nm || "").trim() || c.name, short: (sh || "").trim() || c.short, settings: s }); if (msg) toast(msg); return true; } }; }
route("clubinstellingen", { title: "Instellingen van de club", auth: true, render: async (v, id) => {
  if (!S.admin) { v.innerHTML = `<div class="empty"><b>Alleen voor beheerders</b>Vraag de jeugdcoördinator als je hier iets wil aanpassen.</div>`; return; }
  return csPage(v, id, csCtxOwn()); } });
/* platformbeheer: dezelfde instellingen voor elke club, zonder toegang tot spelers of verslagen */
route("platformclub", { title: "Club instellen", auth: true, render: async (v, cid, step) => {
  if (!S.platform && mode !== "demo") { v.innerHTML = `<div class="empty"><b>Alleen voor de beheerder van het platform</b></div>`; return; }
  let list; if (mode === "demo") list = PLATFORM_DEMO(); else { const r = await sb.rpc("platform_clubs"); if (r.error) { v.innerHTML = `<div class="empty"><b>Laden mislukt</b>${esc(r.error.message)}</div>`; return; } list = r.data || []; }
  const c = list.find(x => x.id === cid); if (!c) { v.innerHTML = `<div class="empty"><b>Club niet gevonden</b><a class="link" href="#/platform">Terug naar Platform</a></div>`; return; }
  c.settings = c.settings || {}; return csPage(v, step, csCtxPlatform(c)); } });
async function csPage(v, id, ctx) {
  const C = ctx.club, STEPS = ctx.steps, st = C.settings || {}, step = STEPS.some(x => x[0] === id) ? id : "club", i = STEPS.findIndex(x => x[0] === step), first = !st.setup_done && !ctx.platform;
  const csSave = (patch, msg) => ctx.saveAll(C.name, C.short, { ...(C.settings || {}), ...patch }, msg);
  const nextHref = i < STEPS.length - 1 ? ctx.base + "/" + STEPS[i + 1][0] : ctx.done;
  v.innerHTML = `<div class="admhead"><div><small class="admkick">${IC.gear} ${ctx.platform ? `<a class="link" href="#/platform">Platform</a> › ` : ""}${first ? "Je club instellen" : "Instellingen"} · ${esc(ctx.platform ? C.name : clubName())}</small><h1 class="pg">${first ? "Zet je club klaar" : ctx.platform ? esc(C.name) : "Instellingen van de club"}${ctx.platform ? "" : helpLink("clubinstellingen")}</h1>
      <p class="sub" style="margin:4px 0 0">${ctx.platform ? "Je past de instellingen van deze club aan. Spelers, ploegen en verslagen van de club zie je niet." : first ? "Vijf korte stappen. Je kan alles later nog aanpassen via Beheer › Instellingen." : "Kies zelf hoe jullie club werkt. Wijzigingen gelden meteen voor alle trainers."}</p></div></div>
    <ol class="csteps">${STEPS.map(([k, l], n) => `<li><a href="${ctx.base}/${k}"${k === step ? ' aria-current="step"' : ""}${n < i ? ' class="done"' : ""}><span>${n + 1}</span>${l}</a></li>`).join("")}</ol><div id="csv"></div>`;
  const host = $("#csv"), foot = (label = "Bewaren en verder") => `<div class="row csfoot"><a class="btn ghost" href="${i ? ctx.base + "/" + STEPS[i - 1][0] : ctx.done}">${i ? "Vorige" : ctx.platform ? "Terug" : "Later"}</a><span class="spacer"></span><button class="btn">${label}</button></div>`;
  const go = () => { location.hash = nextHref; };

  if (step === "club") {
    host.innerHTML = `<form class="panel" id="csf" style="max-width:700px">${clubFieldsHtml(C, st, { fixed: C.id === OGV_ID, hint: ctx.platform ? "De kleuren gelden voor iedereen van deze club." : undefined })}${foot()}</form>`;
    const f = $("#csf"), orig = CLUB.settings, cur = bindClubFields(f, C, st, s => { if (!ctx.platform) { CLUB.settings = s; applyClubTheme(); } });
    f.onsubmit = async e => { e.preventDefault(); const s = cur(); if (C.id === OGV_ID) { delete s.color; delete s.color2; }
      if (!(await ctx.saveAll(f.nm.value, f.sh.value, s, "Bewaard."))) { if (!ctx.platform) { CLUB.settings = orig; applyClubTheme(); } return; } go(); };
    return; }

  if (step === "evaluaties") {
    const ev = st.eval || {}, ms = (Array.isArray(ev.moments) && ev.moments.length ? ev.moments : EV_PRESETS.vijf.moments).map(x => ({ ...x }));
    const rowHtml = (x, n) => `<div class="csm" data-r="${n}"><input name="naam" value="${esc(x.naam || "")}" placeholder="Naam" aria-label="Naam moment ${n + 1}" maxlength="30">
      <label><span class="hint">van</span><input name="from" value="${esc(x.from || "")}" placeholder="MM-DD" maxlength="5" inputmode="numeric" aria-label="Van (maand-dag)"></label>
      <label><span class="hint">tot</span><input name="to" value="${esc(x.to || "")}" placeholder="MM-DD" maxlength="5" inputmode="numeric" aria-label="Tot (maand-dag)"></label>
      <label class="tgl sm"><input type="checkbox" name="verplicht"${x.verplicht ? " checked" : ""}><span></span>verplicht</label><button class="ib" type="button" data-del title="Moment verwijderen" aria-label="Moment verwijderen">${IC.x || "×"}</button></div>`;
    host.innerHTML = `<form class="panel" id="cse" style="max-width:820px">
      <h2 style="margin-top:0">Wanneer evalueren jullie?</h2><p class="hint" style="margin-top:0">Trainers zien per moment wanneer de evaluaties klaar moeten zijn. Data als maand-dag, bv. 12-01 voor 1 december. Het seizoen start in juli.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">${Object.entries(EV_PRESETS).map(([k, p]) => `<button class="btn ghost small" type="button" data-pre="${k}">${p.naam}</button>`).join("")}</div>
      <div id="csms">${ms.map(rowHtml).join("")}</div><button class="link" type="button" id="csadd" style="margin:4px 0 8px">${IC.plus}Moment toevoegen</button>
      <h2>Schaal</h2><div class="row" style="gap:18px;flex-wrap:wrap">
        <label class="chkl"><input type="radio" name="scale" value="woorden"${ev.scale !== "cijfers" ? " checked" : ""}><span>Woorden <span class="hint">(nog niet, soms, meestal, bijna altijd, uitblinker)</span></span></label>
        <label class="chkl"><input type="radio" name="scale" value="cijfers"${ev.scale === "cijfers" ? " checked" : ""}><span>Cijfers 1 tot 5</span></label></div>
      <h2>Wat evalueren jullie?</h2><p class="hint" style="margin-top:0">Eén onderdeel per regel. Een regel die begint met # is een groep. Na een | volgt de uitleg voor de trainer. Dit wordt de standaard voor nieuwe ploegen; een trainer kan het voor zijn ploeg nog aanpassen.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn ghost small" type="button" data-tpl="std">Uitgebreid (21 onderdelen)</button><button class="btn ghost small" type="button" data-tpl="kort">Kort, voor de jongsten (9 onderdelen)</button></div>
      <textarea name="tpl" rows="14" spellcheck="false" style="width:100%;font-family:inherit">${esc((Array.isArray(ev.template) && ev.template.length ? ev.template : EV_TEMPLATE_DEFAULT).join("\n"))}</textarea>
      ${!ctx.platform && S.teams?.length ? `<label class="chkl" style="margin-top:8px"><input type="checkbox" name="all"> Ook toepassen op de ${S.teams.length} bestaande ploegen <span class="hint">(evaluaties die al ingevuld zijn blijven bewaard)</span></label>` : ""}
      ${foot()}</form>`;
    const f = $("#cse"), list = $("#csms", f);
    const wire = () => $$("[data-del]", list).forEach(b => b.onclick = () => { if ($$(".csm", list).length > 1) b.closest(".csm").remove(); else toast("Hou minstens één moment."); });
    wire();
    $$("[data-pre]", f).forEach(b => b.onclick = () => { list.innerHTML = EV_PRESETS[b.dataset.pre].moments.map(rowHtml).join(""); wire(); });
    $("#csadd", f).onclick = () => { list.insertAdjacentHTML("beforeend", rowHtml({ naam: "", from: "", to: "" }, $$(".csm", list).length)); wire(); };
    $$("[data-tpl]", f).forEach(b => b.onclick = () => { f.tpl.value = (b.dataset.tpl === "kort" ? EV_TEMPLATE_SHORT : EV_TEMPLATE_DEFAULT).join("\n"); });
    f.onsubmit = async e => { e.preventDefault();
      const moments = $$(".csm", list).map(r => ({ naam: $("[name=naam]", r).value.trim(), from: $("[name=from]", r).value.trim(), to: $("[name=to]", r).value.trim(), verplicht: $("[name=verplicht]", r).checked }));
      const bad = moments.find(x => !x.naam || !evMd(x.from) || !evMd(x.to)); if (bad) { toast("Geef elk moment een naam en een datum als maand-dag, bv. 12-01."); return; }
      const template = f.tpl.value.split("\n").map(x => x.trim()).filter(Boolean); if (!template.some(l => !l.startsWith("#"))) { toast("Vul minstens één onderdeel in."); return; }
      if (!(await csSave({ eval: { moments, scale: f.scale.value, template } }, "Evaluaties ingesteld."))) return;
      if (f.all?.checked) { let n = 0; for (const t of S.teams) { try { await db.save("teams", { ...t, criteria: template.slice() }); t.criteria = template.slice(); n++; } catch (x) {} } toast(`Toegepast op ${n} ploegen.`); }
      go(); };
    return; }

  if (step === "onderdelen") {
    const off = new Set(st.hidden || []);
    host.innerHTML = `<form class="panel" id="cso" style="max-width:820px"><h2 style="margin-top:0">Welke onderdelen gebruiken jullie?</h2>
      <p class="hint" style="margin-top:0">Wat uit staat, verdwijnt uit het menu voor iedereen van de club. Start, kalender, spelers en trainingen staan altijd aan.</p>
      <div class="csmods">${CS_MODULES.map(([k, l, d]) => `<label class="csmod"><span><b>${esc(l)}</b><small>${esc(d)}</small></span><span class="tgl"><input type="checkbox" name="${k}"${off.has(k) ? "" : " checked"}><span></span></span></label>`).join("")}</div>${foot()}</form>`;
    const f = $("#cso");
    f.onsubmit = async e => { e.preventDefault(); const hidden = CS_MODULES.map(m => m[0]).filter(k => !f[k].checked);
      if (await csSave({ hidden }, "Onderdelen bewaard.")) { if (!ctx.platform) shell(); go(); } };
    return; }

  if (step === "ploegen") {
    const have = new Set((S.teams || []).map(t => (t.category || t.name || "").toUpperCase()));
    host.innerHTML = `<form class="panel" id="csp" style="max-width:820px"><h2 style="margin-top:0">Ploegen</h2>
      ${(S.teams || []).length ? `<p>De club heeft al ${S.teams.length} ploegen: ${S.teams.map(t => esc(t.name)).join(", ")}.</p>` : `<p class="hint" style="margin-top:0">Vink aan welke ploegen jullie hebben. Het speelformat volgt de regels van Voetbal Vlaanderen; je kan het per ploeg nog wijzigen. Heeft een leeftijd meerdere ploegen, pas dan de naam aan (bv. U9 A en U9 B) in Beheer › Ploegen.</p>`}
      <div class="cscats">${CS_CATS.map(([c, fm]) => `<label class="chkl cscat"><input type="checkbox" name="c" value="${c}"${have.has(c) ? " disabled" : ""}> <b>${c}</b> <span class="hint">${fm.replace("v", " tegen ")}</span></label>`).join("")}</div>
      <p class="hint">${rbfaClub() ? `Ploegen ophalen bij RBFA, met hun wedstrijden, kan ook: <a class="link" href="#/clubbeheer/ploegen">Beheer › Ploegen</a>.` : "Koppeling met RBFA: vraag ze aan bij FootballCoachHub, dan komen wedstrijden vanzelf in de kalender."}</p>
      <p id="csps" class="hint"></p>${foot("Aanmaken en verder")}</form>`;
    const f = $("#csp");
    f.onsubmit = async e => { e.preventDefault(); const pick = $$("input[name=c]:checked", f).map(x => x.value); if (!pick.length) { go(); return; }
      if (mode === "demo") { toast("In de demo worden geen ploegen aangemaakt."); go(); return; }
      const btn = $("button.btn:not(.ghost)", f); btn.disabled = true; let made = 0, warn = "";
      for (const c of pick) { const format = (CS_CATS.find(x => x[0] === c) || [])[1] || "8v8"; $("#csps", f).textContent = `${c} aanmaken…`;
        const row = { id: uid(), name: c, category: c, format, season: seasonNow(), criteria: EV_TEMPLATE.slice(), periods: FORMAT_DEF[format][0], period_minutes: FORMAT_DEF[format][1] };
        try { await db.insert("teams", row); made++; await sb.rpc("admin_set_trainer", { t: row.id, uid: user.id, on_team: false }); } catch (x) { warn = x.message || String(x); } }
      await loadTeams().catch(() => {}); btn.disabled = false; toast(`${made} ploegen aangemaakt.` + (warn ? " " + warn : "")); if (made) go(); };
    return; }

  if (step === "trainers") {
    let code = ctx.platform ? C.code || "–" : "–"; if (!ctx.platform) try { code = mode === "demo" ? "DEMO-1234" : (await sb.rpc("club_admin_info")).data?.code || "–"; } catch (x) {}
    const link = location.origin + location.pathname + "#/aanmelden";
    const txt = `Je bent uitgenodigd voor ${ctx.platform ? PRODUCT : APPNAME()}, het trainersplatform van ${ctx.platform ? (C.settings?.full || C.name) : clubName()}.\n\n1. Open ${link}\n2. Tik op Account aanmaken\n3. Vul deze clubcode in: ${code}\n\nDeel deze code niet buiten de club.`;
    host.innerHTML = `<form class="panel" id="cst" style="max-width:820px"><h2 style="margin-top:0">Trainers uitnodigen</h2><p class="hint" style="margin-top:0">Trainers maken zelf een account met de clubcode en komen meteen in jullie club. Daarna koppel je ze aan hun ploeg in Beheer › Ploegen, en geef je in Beheer › Toegang extra rechten (bv. scouting).</p>
      <div class="codebox"><b translate="no">${esc(code)}</b><button class="btn ghost small" type="button" id="cscp">${IC.copy}Uitnodiging kopiëren</button><a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">${IC.wa}Via WhatsApp</a></div>
      ${foot(first ? "Klaar" : ctx.platform ? "Klaar" : "Bewaren")}</form>`;
    $("#cscp").onclick = () => navigator.clipboard?.writeText(txt).then(() => toast("Uitnodiging gekopieerd."));
    $("#cst").onsubmit = async e => { e.preventDefault(); if (ctx.platform) { location.hash = ctx.done; return; } if (await csSave({ setup_done: true }, first ? "Je club staat klaar." : "Bewaard.")) { shell(); location.hash = "#/start"; } };
  }
}
