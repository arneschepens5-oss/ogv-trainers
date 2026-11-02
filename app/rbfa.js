/* OGV Platform — wedstrijden automatisch overnemen van RBFA / Voetbal Vlaanderen.
   Gebruikt de publieke GraphQL-achterkant van het RBFA-matchcenter. Die is niet officieel gedocumenteerd:
   als RBFA hem wijzigt, valt de synchronisatie stil maar blijven alle wedstrijden in de app gewoon staan. */
"use strict";
const RBFA_API = "https://datalake-prod2018.rbfa.be/graphql", RBFA_CLUB = "1126"; /* K.V.V. O.G. Vorselaar, stamnummer 00402 */
const RBFA_SYNC_MS = 6 * 3600e3;
async function rbfaQ(query, variables) {
  const r = await fetch(RBFA_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
  if (!r.ok) throw new Error("RBFA antwoordde met foutcode " + r.status);
  const j = await r.json(); if (j.errors?.length) throw new Error("RBFA: " + j.errors[0].message); return j.data;
}
const rbfaTeams = () => rbfaQ(`query($clubId: ID!, $language: Language!) { clubTeams(clubId: $clubId, language: $language) { id name } }`, { clubId: RBFA_CLUB, language: "nl" }).then(d => d.clubTeams || []);
const rbfaCalendar = teamId => rbfaQ(`query($teamId: ID!, $language: Language!, $sortByDate: SortDirection) { teamCalendar(teamId: $teamId, language: $language, sortByDate: $sortByDate) {
  id startTime title state showScore homeTeam { id name clubId } awayTeam { id name clubId } outcome { status homeTeamGoals awayTeamGoals } location { name address postalCode city } } }`,
  { teamId: String(teamId), language: "nl", sortByDate: "asc" }).then(d => d.teamCalendar || []);
const rbfaMatchUrl = id => "https://www.rbfa.be/nl/wedstrijd/" + encodeURIComponent(id);
const RBFA_SHEET_DEFAULT = "https://www.wedstrijdbladen.be/astm/faces/login.jspx";
/* "KFC ZWARTE LEEUW" → "KFC Zwarte Leeuw"; afkortingen zoals KFC, VV, OG blijven in hoofdletters */
const rbfaName = s => { s = String(s || "").trim(); if (s !== s.toUpperCase()) return s;
  return s.split(/\s+/).map(w => /^[A-Z.]{1,4}$/.test(w) && !/^(DE|HET|EN|VAN)$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()).join(" "); };
const rbfaCancelled = m => /cancel|postpon|afgelast|uitgesteld|forfait/i.test((m.state || "") + " " + (m.outcome?.status || ""));
const rbfaKind = t => !t ? "" : /beker/i.test(t) ? "Beker" : /tornooi|toernooi/i.test(t) ? "Tornooi" : /provinciaal|gewestelijk|nationaal|reeks/i.test(t) ? "Competitie" : "Vriendschappelijk";
const normOpp = s => String(s || "").toLowerCase().replace(/\b(k?v?v|k?fc|sk|vc|ksk|kvc|kfc|sc|fc|vv)\b/g, "").replace(/[^a-z]/g, "");

/* Haalt de kalender op en zet nieuwe of gewijzigde wedstrijden in de app. Eigen gegevens (verslag, score, opstelling) blijven onaangeroerd. */
async function rbfaSync(team) {
  if (!team?.rbfa_team_id) return { added: 0, changed: 0 };
  const cal = await rbfaCalendar(team.rbfa_team_id), events = mode === "demo" || S.team?.id === team.id ? S.events : await db.list("events", { team_id: team.id });
  let added = 0, changed = 0;
  for (const m of cal) {
    if (!m?.id || !m.startTime) continue;
    const ourHome = String(m.homeTeam?.clubId) === RBFA_CLUB, ourAway = String(m.awayTeam?.clubId) === RBFA_CLUB;
    const home = ourHome || !ourAway, opp = rbfaName((home ? m.awayTeam : m.homeTeam)?.name);
    const [date, time] = String(m.startTime).split("T"), L = m.location || {};
    const loc = [rbfaName(L.name), [L.address, [L.postalCode, L.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || null;
    const state = rbfaCancelled(m) ? "afgelast" : null, series = m.title || null;
    let e = events.find(x => x.rbfa_id === String(m.id));
    if (!e) e = events.find(x => x.type === "wedstrijd" && !x.rbfa_id && x.date === date && (!x.opponent || normOpp(x.opponent) === normOpp(opp) || normOpp(opp).includes(normOpp(x.opponent))));
    if (e) {
      const before = JSON.stringify([e.rbfa_id, e.date, tm(e.start_time), e.home, e.opponent, e.location, e.rbfa_state, e.score_for, e.score_against, e.report?.series, e.report?.kind]);
      e.rbfa_id = String(m.id); e.date = date; e.start_time = (time || "").slice(0, 5) || e.start_time; e.home = home; e.rbfa_state = state;
      if (!e.opponent) e.opponent = opp; if (!e.location || e.rbfa_loc) { e.location = loc; e.rbfa_loc = true; }
      if (m.showScore && m.outcome?.homeTeamGoals != null && e.score_for == null) { e.score_for = home ? m.outcome.homeTeamGoals : m.outcome.awayTeamGoals; e.score_against = home ? m.outcome.awayTeamGoals : m.outcome.homeTeamGoals; }
      e.report = e.report || {}; if (series && !e.report.series) e.report.series = series; if (series && !e.report.kind) e.report.kind = rbfaKind(series);
      if (JSON.stringify([e.rbfa_id, e.date, tm(e.start_time), e.home, e.opponent, e.location, e.rbfa_state, e.score_for, e.score_against, e.report?.series, e.report?.kind]) !== before) { await rbfaPut(e); changed++; }
    } else if (!state) {
      const row = { id: uid(), team_id: team.id, type: "wedstrijd", date, start_time: (time || "").slice(0, 5) || null, end_time: null, location: loc, opponent: opp, home,
        rbfa_id: String(m.id), rbfa_state: null, rbfa_loc: true, report: series ? { series, kind: rbfaKind(series) } : {} };
      if (m.showScore && m.outcome?.homeTeamGoals != null) { row.score_for = home ? m.outcome.homeTeamGoals : m.outcome.awayTeamGoals; row.score_against = home ? m.outcome.awayTeamGoals : m.outcome.homeTeamGoals; }
      await rbfaPut(row); if (events !== S.events) events.push(row); added++;
    }
  }
  team.rbfa_synced_at = new Date().toISOString(); await db.save("teams", team);
  return { added, changed, total: cal.length };
}
async function rbfaPut(e) { try { await putEvent(e); } catch (err) { throw /rbfa_|sheet_url|column/i.test(err.message || "") ? new Error("Voer eerst het databasescript ogv-update-v4.sql uit in Supabase.") : err; } }
/* stil op de achtergrond bijwerken als de laatste synchronisatie meer dan 6 uur oud is */
let rbfaBusy = false;
function rbfaAuto() {
  const t = S.team; if (!t?.rbfa_team_id || rbfaBusy) return;
  if (t.rbfa_synced_at && Date.now() - new Date(t.rbfa_synced_at).getTime() < RBFA_SYNC_MS) return;
  rbfaBusy = true;
  rbfaSync(t).then(r => { if (r.added || r.changed) { toast(r.added ? `${r.added} nieuwe ${r.added === 1 ? "wedstrijd" : "wedstrijden"} overgenomen van RBFA.` : "Wedstrijden bijgewerkt volgens RBFA.");
    if (["kalender", "start", "ploeg", "uitslagen"].includes(cur().page)) render(); } }).catch(e => console.warn("RBFA", e)).finally(() => { rbfaBusy = false; });
}
/* paneel in "Ploeg en trainers" */
async function rbfaPanel(host) {
  const t = S.team;
  host.innerHTML = `<h2>Wedstrijden van RBFA</h2><p class="hint" style="margin-top:0">Koppel je ploeg aan haar ploeg op de RBFA-website. De wedstrijden komen dan vanzelf in je kalender, met uur en adres, en wijzigingen (verplaatst, afgelast) worden overgenomen. Je verslag en opstelling blijven altijd van jou.</p>
    <div class="fields"><label class="f full">Ploeg bij RBFA<select id="rbt"><option value="">Laden…</option></select></label>
    <label class="f full">Link officieel wedstrijdblad <span class="hint">voor alle wedstrijden van deze ploeg</span><input id="rbs" type="url" value="${esc(t.sheet_url || "")}" placeholder="${RBFA_SHEET_DEFAULT}"></label></div>
    <div class="row" style="margin-top:12px"><button class="btn" type="button" id="rbgo">${IC.rotate}${t.rbfa_team_id ? "Nu bijwerken" : "Koppelen en wedstrijden ophalen"}</button>${t.rbfa_team_id ? `<button class="link" type="button" id="rboff">Ontkoppelen</button>` : ""}<span class="spacer"></span><span class="hint" id="rbst">${t.rbfa_synced_at ? "Laatst bijgewerkt " + new Date(t.rbfa_synced_at).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" }) : ""}</span></div>`;
  const sel = $("#rbt", host);
  try { const ts = await rbfaTeams(), guess = !t.rbfa_team_id && ts.find(x => (t.category || t.name || "").toUpperCase().includes(x.name.split(" ")[0].toUpperCase()));
    sel.innerHTML = `<option value="">Kies je ploeg</option>` + ts.map(x => `<option value="${esc(x.id)}"${(t.rbfa_team_id || guess?.id) === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join(""); }
  catch (e) { sel.innerHTML = `<option value="">RBFA is niet bereikbaar</option>`; }
  $("#rbs", host).onchange = e => { const u = e.target.value.trim(); t.sheet_url = u ? (/^https?:\/\//i.test(u) ? u : "https://" + u) : null; safe(() => db.save("teams", t).catch(err => { throw /column/i.test(err.message) ? new Error("voer eerst ogv-update-v4.sql uit in Supabase") : err; }), "Link bewaard."); };
  $("#rbgo", host).onclick = async ev => { const id = sel.value; if (!id) { toast("Kies eerst je ploeg bij RBFA."); return; }
    const b = ev.currentTarget; b.disabled = true; b.innerHTML = `<span class="spin"></span>Ophalen…`;
    const old = t.rbfa_team_id; t.rbfa_team_id = id;
    const r = await safe(() => rbfaSync(t)); b.disabled = false;
    if (!r) { t.rbfa_team_id = old; rbfaPanel(host); return; }
    toast(`${r.total} wedstrijden bij RBFA: ${r.added} nieuw, ${r.changed} bijgewerkt.`); rbfaPanel(host); };
  const off = $("#rboff", host); if (off) off.onclick = async () => { t.rbfa_team_id = null; await safe(() => db.save("teams", t), "Ontkoppeld. De wedstrijden blijven in je kalender staan."); rbfaPanel(host); };
}
/* knoppen bovenaan een wedstrijd */
function matchLinks(e) {
  const sheet = e.sheet_url || S.team?.sheet_url;
  return `<div class="mlinks noprint"><a class="btn ghost small" href="#/matchday/${e.id}">${IC.sheet}Wedstrijdblad invullen</a>
    ${sheet ? `<a class="btn ghost small" href="${esc(sheet)}" target="_blank" rel="noopener">${IC.out}Officieel wedstrijdblad</a>` : `<button class="btn ghost small" type="button" id="addSheet">${IC.plus}Link officieel wedstrijdblad</button>`}
    ${e.rbfa_id ? `<a class="btn ghost small" href="${rbfaMatchUrl(e.rbfa_id)}" target="_blank" rel="noopener">${IC.out}Bekijk op RBFA</a>` : ""}
    ${e.rbfa_state === "afgelast" ? `<span class="pill loss">Afgelast volgens RBFA</span>` : ""}</div>`;
}
