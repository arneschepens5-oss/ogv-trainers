/* OGV Platform — start, ploeg, spelers, evaluaties, cijfers, ploeginstellingen. */
"use strict";

/* ============ start ============ */
route("start", { title: "Start", render: async v => {
  const logged = !!db && (mode === "demo" || !!user), t = S.team, now = new Date();
  const greet = (h => h < 12 ? "Goeiemorgen" : h < 18 ? "Goeiemiddag" : "Goeieavond")(now.getHours());
  const next = t ? S.events.find(e => e.date >= todayIso()) : null;
  let recent = [];
  if (logged) { try { recent = (await loadClub()).filter(e => e.date <= todayIso() && e.score_for != null).slice(0, 6); } catch (e) {} }
  const todo = t ? past().filter(e => !S.att.some(a => a.event_id === e.id)).slice(-3).reverse() : [];
  v.innerHTML = `<section class="hero"><canvas id="pitch3d" aria-hidden="true"></canvas>
    <p class="date-l">${cap(now.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }))}${t ? " · " + esc(t.name) : ""}</p>
    <h1>${greet},<span>trainer</span></h1>
    <div class="quick">${next ? `<a href="#/activiteit/${next.id}">${next.type === "wedstrijd" ? IC.ball : IC.check}${next.date === todayIso() ? (next.type === "wedstrijd" ? "Wedstrijd van vandaag" : "Aanwezigheden van vandaag") : (next.type === "wedstrijd" ? "Volgende wedstrijd" : "Volgende training")}</a>` : ""}
      ${next && next.type === "wedstrijd" ? `<a href="#/live/${next.id}">${IC.mic}Live coachen</a>` : `<a href="#/bibliotheek">${IC.book}Trainingsbibliotheek</a>`}
      <a href="#/uitslagen">${IC.trophy}Uitslagen club</a>${logged ? "" : `<a href="#/aanmelden">Aanmelden</a>`}</div></section>
  ${todo.length ? `<div class="sec"><h2>Nog in te vullen</h2><div class="list">${todo.map(e => evItem(e)).join("")}</div></div>` : ""}
  ${recent.length ? `<div class="sec"><div class="row" style="margin-bottom:12px"><h2 style="margin:0;margin-right:auto">Laatste uitslagen van de club</h2><a class="link" href="#/uitslagen">Alle uitslagen</a></div><div class="list">${recent.map(clubItem).join("")}</div></div>` : ""}
  <div class="sec"><h2>Alles op één plek</h2><div class="tiles">${[
    ["kalender", "cal", "Kalender en aanwezigheden", "Trainingen en wedstrijden plannen, aanwezigheden afvinken."],
    ["live", "mic", "Live coachen", "Klok, goals en wissels tijdens de match, met spraak. Speeltijd wordt vanzelf berekend."],
    ["uitslagen", "trophy", "Uitslagen en verslagen", "Alle wedstrijden van de club met het verslag erbij."],
    ["evaluaties", "star", "Evaluaties", "Vier momenten per seizoen, met de groei per speler."],
    ["bibliotheek", "book", "Trainingsbibliotheek", "Alle clubtrainingen per leeftijd, met PDF en aanpasbare versie."],
    ["trainingen", "plan", "Trainingen maken", "Volledige trainingsfiches met veldtekening, belasting en duur per oefening."],
    ["videoanalyse", "cam", "Videoanalyse", "Teken pijlen, zones en spotlights op je eigen beelden en exporteer als video."],
    ["principes", "video", "Mijn spelprincipes", "Jouw speelwijze als animatie of video, met kernpunten."],
    ["opslag", "folder", "Mijn opslag", "Je eigen documenten, video's, links en notities."],
    ["animatiebord", "board", "Animatiebord", "Teken en animeer tactieken en exporteer als video."],
    ["matchday", "sheet", "Wedstrijdblad", "Opstelling, kapitein en opdrachten voor de kleedkamer."],
    ["scouting", "scout", "Scouting", "De gedeelde scoutingsdatabase van de club."]
  ].map(([h, i, b, s]) => `<a class="tile" href="#/${h}"><span class="ic">${IC[i]}</span><span><b>${b}</b><small>${s}</small></span></a>`).join("")}</div></div>`;
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
  return window.mountPitch ? window.mountPitch($("#pitch3d")) : null;
} });

function evItem(e) {
  const as = S.att.filter(a => a.event_id === e.id), inn = as.filter(a => a.status === "aanwezig" || a.status === "te laat").length, r = res(e);
  const right = e.rbfa_state === "afgelast" ? `<span class="pill loss">Afgelast</span>` : e.type === "wedstrijd" && r ? `<b>${e.score_for} - ${e.score_against}</b><span class="pill ${r}">${RES_L[r]}</span>`
    : as.length ? `<b>${inn}/${active().length}</b>aanwezig` : e.date <= todayIso() ? `<b style="color:var(--warn)">Invullen</b>aanwezigheden` : "";
  return `<div class="item" data-go="#/activiteit/${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span>
    <span class="main"><b>${e.type === "wedstrijd" ? matchTitle(e, "OGV") : "Training"} <span class="pill ${e.type === "wedstrijd" ? "w" : "t"}">${e.type === "wedstrijd" ? "Match" : "Training"}</span></b>
    <small>${dShort(e.date)}${e.start_time ? " · " + tm(e.start_time) : ""}${e.theme ? " · " + esc(e.theme) : e.location ? " · " + esc(e.location) : ""}</small></span><span class="val">${right}</span></div>`;
}
function clubItem(e) {
  const r = res(e), tn = teamName(e.team_id);
  return `<div class="item" data-go="#/verslag/${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span>
    <span class="main"><b>${matchTitle(e, tn)}</b><small>${esc(S.teams.find(t => t.id === e.team_id)?.category || "")} · ${dShort(e.date)}${e.report?.goals?.length ? " · " + e.report.goals.filter(g => g.side === "for" && g.name).map(g => esc(g.name.split(" ")[0])).join(", ") : ""}</small></span>
    <span class="val">${r ? `<b>${e.home === false ? e.score_against + " - " + e.score_for : e.score_for + " - " + e.score_against}</b><span class="pill ${r}">${RES_L[r]}</span>` : `<b>–</b>`}</span></div>`;
}

/* ============ ploegoverzicht ============ */
route("ploeg", { title: "Mijn ploeg", auth: true, team: true, render: v => {
  const t = todayIso(), next = S.events.find(e => e.date >= t), ms = past("wedstrijd").filter(e => e.score_for != null);
  const W = ms.filter(e => res(e) === "win").length, G = ms.filter(e => res(e) === "draw").length;
  const tr = past("training").filter(e => S.att.some(a => a.event_id === e.id)).slice(-8);
  const presence = avg(tr.map(e => { const as = S.att.filter(a => a.event_id === e.id); return pct(as.filter(a => a.status === "aanwezig" || a.status === "te laat").length, as.length); }));
  const rows = active().map(p => ({ p, ...playerStats(p) }));
  const scorers = rows.filter(r => r.goals).sort((a, b) => b.goals - a.goals).slice(0, 3);
  const best = rows.filter(r => r.rating).sort((a, b) => b.rating - a.rating).slice(0, 3);
  const lastM = [...ms].reverse()[0];
  v.innerHTML = head(esc(S.team.name), `${active().length} spelers · ${esc(S.team.format || "")} · seizoen ${esc(S.team.season || "")}`, `<a class="btn ghost" href="#/ploeg-instellingen">${IC.gear}Ploeg en trainers</a>`) +
  (next ? `<div class="panel hl"><div class="row"><span class="date"><b>${dDay(next.date)}</b><small>${dMon(next.date)}</small></span>
    <span style="flex:1;min-width:0"><small class="muted">${next.date === t ? "Vandaag" : "Volgende activiteit"}</small><b style="display:block;font-size:19px">${next.type === "wedstrijd" ? "Wedstrijd: " + matchTitle(next, "OGV") : "Training" + (next.theme ? ": " + esc(next.theme) : "")}</b>
    <small class="muted">${dLong(next.date)}${next.start_time ? ", " + tm(next.start_time) : ""}${next.location ? " · " + esc(next.location) : ""}</small></span>
    <a class="btn" href="#/activiteit/${next.id}">${next.type === "wedstrijd" ? "Voorbereiden" : "Openen"}</a>${next.type === "wedstrijd" ? `<a class="btn ghost" href="#/live/${next.id}">${IC.mic}Live</a>` : ""}</div></div>`
   : `<div class="empty"><b>Niets gepland</b>Zet je trainingen en wedstrijden in de kalender.<br><a class="btn" href="#/kalender">Naar de kalender</a></div>`) +
  `<div class="sec kpis">
    <div class="kpi"><small>Aanwezigheid training</small><b>${presence == null ? "–" : Math.round(presence) + "%"}</b><span>laatste ${tr.length} trainingen</span></div>
    <div class="kpi"><small>Wedstrijden</small><b>${W}-${G}-${ms.length - W - G}</b><span>gewonnen · gelijk · verloren</span></div>
    <div class="kpi"><small>Doelsaldo</small><b>${ms.reduce((s, e) => s + e.score_for, 0)}-${ms.reduce((s, e) => s + e.score_against, 0)}</b><span>${ms.length} wedstrijden</span></div>
    <div class="kpi"><small>Lopende doelen</small><b>${S.goals.filter(g => g.status === "bezig").length}</b><span>persoonlijke doelen</span></div></div>
  <div class="grid2 sec">
    <div class="panel"><h2>Topschutters</h2>${scorers.length ? `<div class="list">${scorers.map(r => `<div class="item" data-go="#/speler/${r.p.id}"><span class="num">${r.p.number ?? ""}</span><span class="main"><b>${esc(pname(r.p))}</b><small>${r.assists} assists · ${r.matches} wedstrijden</small></span><span class="val"><b>${r.goals}</b>goals</span></div>`).join("")}</div>` : '<p class="muted">Nog geen doelpunten geregistreerd.</p>'}</div>
    <div class="panel"><h2>Beste gemiddelde cijfers</h2>${best.length ? `<div class="list">${best.map(r => `<div class="item" data-go="#/speler/${r.p.id}"><span class="num">${r.p.number ?? ""}</span><span class="main"><b>${esc(pname(r.p))}</b><small>${r.motm ? r.motm + "× man van de match" : r.matches + " wedstrijden"}</small></span><span class="val"><b>${f1(r.rating)}</b>op 10</span></div>`).join("")}</div>` : '<p class="muted">Nog geen beoordelingen.</p>'}</div></div>
  ${lastM ? `<div class="sec"><h2>Laatste wedstrijd</h2><div class="list">${evItem(lastM)}</div></div>` : ""}`;
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
} });

/* ============ spelers ============ */
route("spelers", { title: "Spelers", auth: true, team: true, render: v => {
  const ps = active(), old = S.players.filter(p => p.active === false);
  const it = p => { const s = playerStats(p); return `<div class="item" data-go="#/speler/${p.id}"><span class="num">${p.number ?? ""}</span><span class="main"><b>${esc(pname(p))}</b><small>${esc([p.position, p.foot ? p.foot + "voetig" : ""].filter(Boolean).join(" · ") || "Geen positie")}</small></span>
    <span class="val hide-m"><b>${s.trTot ? s.trPct + "%" : "–"}</b>aanwezig</span><span class="val hide-m"><b>${s.minutes}</b>minuten</span><span class="val"><b>${f1(s.rating)}</b>gem. cijfer</span></div>`; };
  v.innerHTML = head("Spelers", `${ps.length} spelers in ${esc(S.team.name)}`, `<button class="btn ghost" type="button" id="bulk">Lijst plakken</button><button class="btn" type="button" id="addP">${IC.plus}Speler</button>`) +
    (ps.length ? `<div class="list">${ps.map(it).join("")}</div>` : `<div class="empty"><b>Nog geen spelers</b>Voeg ze één voor één toe, of plak in één keer een lijst met namen uit PSD of Excel.</div>`) +
    (old.length ? `<div class="sec"><h2>Niet meer actief</h2><div class="list">${old.map(it).join("")}</div></div>` : "");
  $("#addP").onclick = () => playerForm(); $("#bulk").onclick = bulkForm;
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
} });
function playerForm(p) {
  const n = !p; p = p || { first_name: "", last_name: "", active: true };
  const d = dialog(`<form><h2>${n ? "Speler toevoegen" : "Fiche bewerken"}</h2><div class="fields">
  <label class="f">Voornaam<input name="first_name" required value="${esc(p.first_name)}"></label><label class="f">Achternaam<input name="last_name" value="${esc(p.last_name)}"></label>
  <label class="f">Rugnummer<input name="number" type="number" min="0" inputmode="numeric" value="${p.number ?? ""}"></label><label class="f">Geboortedatum<input name="birthdate" type="date" value="${esc(p.birthdate || "")}"></label>
  <label class="f">Positie<select name="position">${["","Keeper","Verdediger","Middenvelder","Aanvaller"].map(x => `<option${x === (p.position || "") ? " selected" : ""}>${x}</option>`).join("")}</select></label>
  <label class="f">Voorkeursvoet<select name="foot">${["","Rechts","Links","Beide"].map(x => `<option${x === (p.foot || "") ? " selected" : ""}>${x}</option>`).join("")}</select></label>
  <label class="f full">Contact ouders<input name="parent_contact" value="${esc(p.parent_contact || "")}" placeholder="Naam en gsm-nummer"></label>
  <label class="f full">Notities<textarea name="notes">${esc(p.notes || "")}</textarea></label>
  ${n ? "" : `<label class="f full check"><input type="checkbox" name="active"${p.active !== false ? " checked" : ""}> Speelt nog in deze ploeg</label>`}</div>
  <div class="row">${n ? "" : `<button class="btn danger" type="button" id="del">Verwijderen</button>`}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  if (!n) $("#del", d).onclick = async () => { if (!confirm(`${pname(p)} en al zijn gegevens definitief verwijderen? Zet hem liever op niet actief als hij de ploeg verlaat.`)) return;
    await safe(async () => { await db.del("players", { id: p.id }); S.players = S.players.filter(x => x.id !== p.id); S.att = S.att.filter(a => a.player_id !== p.id); S.evals = S.evals.filter(a => a.player_id !== p.id); S.goals = S.goals.filter(a => a.player_id !== p.id); d.close(); go("#/spelers"); }, "Speler verwijderd."); };
  $("form", d).onsubmit = async e => { e.preventDefault(); const fd = new FormData(e.target), f = Object.fromEntries(fd);
    const row = { ...(n ? { id: uid(), team_id: S.team.id } : p), first_name: f.first_name.trim(), last_name: (f.last_name || "").trim(), number: f.number === "" ? null : +f.number, birthdate: f.birthdate || null,
      position: f.position || null, foot: f.foot || null, parent_contact: f.parent_contact || null, notes: f.notes || null, active: n ? true : fd.has("active") };
    await safe(async () => { await db.save("players", row); const i = S.players.findIndex(x => x.id === row.id); if (i >= 0) S.players[i] = row; else S.players.push(row); sortPlayers(); d.close(); render(); }, "Speler opgeslagen."); };
}
function bulkForm() {
  const d = dialog(`<form><h2>Lijst met spelers plakken</h2><p class="hint" style="margin:0">Eén speler per regel. Een rugnummer vooraan mag, bijvoorbeeld "7 Lio Peeters". Kopieer de lijst uit PSD of Excel.</p>
  <textarea id="bl" style="min-height:220px" placeholder="1 Lio Peeters&#10;2 Mats Janssens&#10;Odin Maes"></textarea>
  <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Spelers toevoegen</button></div></form>`);
  $("form", d).onsubmit = async e => { e.preventDefault(); const lines = $("#bl", d).value.split(/\r?\n/).map(l => l.replace(/\t/g, " ").trim()).filter(Boolean);
    await safe(async () => { for (const l of lines) { const m = l.match(/^(\d{1,3})[\s.)-]+(.*)$/), rest = (m ? m[2] : l).trim().split(/\s+/);
      const row = { id: uid(), team_id: S.team.id, first_name: rest.shift(), last_name: rest.join(" "), number: m ? +m[1] : null, active: true }; await db.save("players", row); S.players.push(row); }
      sortPlayers(); d.close(); render(); }, lines.length + " spelers toegevoegd."); };
}
route("speler", { title: "Speler", auth: true, team: true, render: (v, id) => {
  const p = S.players.find(x => x.id === id); if (!p) { v.innerHTML = `<div class="empty"><b>Speler niet gevonden</b><a class="link" href="#/spelers">Terug naar spelers</a></div>`; return; }
  const s = playerStats(p), ev = S.evals.filter(x => x.player_id === p.id).sort((a, b) => a.moment - b.moment), gs = S.goals.filter(g => g.player_id === p.id);
  const ms = past("wedstrijd").map(e => ({ e, a: attOf(e.id, p.id) })).filter(x => x.a && x.a.status === "aanwezig").reverse().slice(0, 10);
  const age = p.birthdate ? Math.floor((Date.now() - parse(p.birthdate)) / 3.15576e10) : null;
  const pil = PILLARS.map(k => [k, avg(ms.map(x => +x.a.scores?.[k]).filter(Boolean))]);
  v.innerHTML = backLink("#/spelers", "Spelers") + `<div class="ph"><span class="num" style="width:60px;height:60px;border-radius:16px;background:var(--yellow);color:#000;font-size:26px;border:0">${p.number ?? ""}</span>
   <div class="t"><h1 class="pg">${esc(pname(p))}</h1><p class="sub">${esc([p.position, p.foot ? p.foot + "voetig" : "", age != null ? age + " jaar" : ""].filter(Boolean).join(" · "))}</p></div>
   <button class="btn ghost" type="button" id="editP">Fiche bewerken</button></div>
  <div class="kpis">
    <div class="kpi"><small>Aanwezig op training</small><b>${s.trTot ? s.trPct + "%" : "–"}</b><span>${s.trIn} van ${s.trTot}</span></div>
    <div class="kpi"><small>Wedstrijden</small><b>${s.matches}</b><span>${s.basis}× basis · ${s.minutes} min</span></div>
    <div class="kpi"><small>Goals · assists</small><b>${s.goals} · ${s.assists}</b><span>${s.motm ? s.motm + "× man van de match" : "dit seizoen"}</span></div>
    <div class="kpi"><small>Gemiddeld cijfer</small><b>${f1(s.rating)}</b><span>${s.topTag ? "werkpunt: " + esc(s.topTag) : "op 10"}</span></div></div>
  ${pil.some(x => x[1] != null) ? `<div class="sec panel"><h2>Wedstrijdbeoordeling per pijler</h2><div class="kpis">${pil.map(([k, val]) => `<div><small class="muted">${k}</small><div class="row" style="gap:8px"><b style="font-size:22px;font-weight:900">${f1(val)}</b><span class="bar" style="width:100%;flex:1"><i style="width:${(val || 0) * 20}%"></i></span></div></div>`).join("")}</div><p class="hint" style="margin:10px 0 0">Gemiddelde score op 5 uit de wedstrijdverslagen.</p></div>` : ""}
  <div class="grid2 sec">
   <div class="panel"><h2>Evaluaties</h2>${ev.length ? evalChart(ev) + evalDetail(ev) : `<div class="empty"><b>Nog niet geëvalueerd</b><a class="link" href="#/evaluaties">Naar de evaluaties</a></div>`}</div>
   <div class="panel"><div class="row"><h2 style="margin:0;margin-right:auto">Doelen</h2><button class="btn small" type="button" id="addG">${IC.plus}Doel</button></div>
    ${gs.length ? `<div class="list" style="margin-top:10px">${gs.map(g => `<div class="item static"><span class="main"><b style="white-space:normal">${esc(g.text)}</b><small>${esc([g.area, g.term ? g.term + "e termijn" : ""].filter(Boolean).join(" · "))}</small></span>
      <select data-gs="${g.id}" style="width:auto;padding:6px 8px;font-size:14px">${["bezig","gehaald","gestopt"].map(x => `<option${x === g.status ? " selected" : ""}>${x}</option>`).join("")}</select></div>`).join("")}</div>`
     : `<p class="hint">Zet een of twee concrete doelen per periode, bijvoorbeeld "met links leren passen over 10 meter".</p>`}</div></div>
  ${ms.length ? `<div class="sec"><h2>Wedstrijden</h2><div class="list">${ms.map(({ e, a }) => `<div class="item" data-go="#/activiteit/${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span>
    <span class="main"><b>${esc(e.opponent || "Wedstrijd")}${e.report?.motm === p.id ? ' <span class="pill w">Man van de match</span>' : ""}</b><small>${esc([a.role, a.minutes != null ? a.minutes + " min" : "", a.goals ? a.goals + " goal" : "", a.assists ? a.assists + " assist" : ""].filter(Boolean).join(" · "))}${a.note ? " · " + esc(a.note) : ""}</small></span><span class="val"><b>${a.rating ?? "–"}</b>cijfer</span></div>`).join("")}</div></div>` : ""}
  ${p.notes || p.parent_contact ? `<div class="sec panel"><h2>Fiche</h2>${p.parent_contact ? `<p style="margin:0 0 6px"><span class="muted">Contact ouders:</span> ${esc(p.parent_contact)}</p>` : ""}${p.notes ? `<p style="margin:0;white-space:pre-wrap">${esc(p.notes)}</p>` : ""}</div>` : ""}`;
  $("#editP").onclick = () => playerForm(p); $("#addG").onclick = () => goalForm(p);
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
  $$("[data-gs]", v).forEach(sel => sel.onchange = async () => { const g = S.goals.find(x => x.id === sel.dataset.gs); g.status = sel.value; await safe(() => db.save("goals", g), "Doel bijgewerkt."); });
} });
function goalForm(p) {
  const d = dialog(`<form><h2>Doel voor ${esc(p.first_name)}</h2><div class="fields"><label class="f full">Doel<input name="text" required placeholder="Wat moet de speler kunnen?"></label>
  <label class="f">Onderdeel<select name="area"><option>Techniek</option><option>Tactiek</option><option>Fysiek</option><option>Mentaal</option></select></label>
  <label class="f">Termijn<select name="term"><option value="kort">Korte termijn</option><option value="middellang">Middellange termijn</option><option value="lang">Lange termijn</option></select></label></div>
  <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Doel toevoegen</button></div></form>`);
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    const g = { id: uid(), team_id: S.team.id, player_id: p.id, text: f.text, area: f.area, term: f.term, status: "bezig" };
    await safe(async () => { await db.save("goals", g); S.goals.push(g); d.close(); render(); }, "Doel toegevoegd."); };
}
const evalAvg = e => avg(Object.values(e.scores || {}).map(Number));
function evalChart(ev) {
  const W = 320, H = 130, pad = 26, xs = m => pad + (m - 1) * (W - 2 * pad) / 3, ys = val => H - 18 - (val - 1) * (H - 36) / 4;
  const pts = ev.map(e => [e.moment, evalAvg(e)]).filter(x => x[1] != null);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Evolutie gemiddelde evaluatie">
  ${[1,2,3,4,5].map(n => `<line x1="${pad}" x2="${W - pad}" y1="${ys(n)}" y2="${ys(n)}" style="stroke:var(--line)"/><text x="6" y="${ys(n) + 4}" style="fill:var(--dim)" font-size="10">${n}</text>`).join("")}
  ${[1,2,3,4].map(m => `<text x="${xs(m)}" y="${H - 2}" text-anchor="middle" style="fill:var(--dim)" font-size="10">Eval ${m}</text>`).join("")}
  <polyline fill="none" stroke="#FFD500" stroke-width="2.5" points="${pts.map(([m, n]) => xs(m) + "," + ys(n)).join(" ")}"/>
  ${pts.map(([m, n]) => `<circle cx="${xs(m)}" cy="${ys(n)}" r="4" fill="#FFD500"/><text x="${xs(m)}" y="${ys(n) - 9}" text-anchor="middle" style="fill:var(--ink)" font-size="11" font-weight="700">${f1(n)}</text>`).join("")}</svg>`;
}
function evalDetail(ev) { const a0 = ev[0], b0 = ev[ev.length - 1];
  return `<table class="tbl" style="margin-top:8px"><tr><th>Onderdeel</th><th>Eval ${a0.moment}</th>${ev.length > 1 ? `<th>Eval ${b0.moment}</th><th>Groei</th>` : ""}</tr>
  ${(S.team.criteria || DEF_CRIT).map(c => { const a = +a0.scores?.[c], b = +b0.scores?.[c], dl = ev.length > 1 && !isNaN(a) && !isNaN(b) ? b - a : null;
    return `<tr><td>${esc(c)}</td><td>${isNaN(a) ? "–" : f1(a)}</td>${ev.length > 1 ? `<td>${isNaN(b) ? "–" : f1(b)}</td><td style="color:${dl > 0 ? "var(--ok)" : dl < 0 ? "var(--bad)" : "var(--muted)"}">${dl == null ? "–" : (dl > 0 ? "+" : "") + f1(dl)}</td>` : ""}</tr>`; }).join("")}</table>`; }

/* ============ evaluaties ============ */
let evMoment = 1;
route("evaluaties", { title: "Evaluaties", auth: true, team: true, render: v => {
  const cr = S.team.criteria || DEF_CRIT, ps = active(), opts = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const done = ps.filter(p => S.evals.some(e => e.player_id === p.id && e.moment === evMoment && Object.keys(e.scores || {}).length)).length;
  v.innerHTML = head("Evaluaties", "Vier keer per seizoen een score van 1 tot 5 per onderdeel. Elke wijziging wordt meteen bewaard.") +
  `<div class="chips">${[1,2,3,4].map(m => `<button class="chip" type="button" data-m="${m}" aria-pressed="${m === evMoment}">Evaluatie ${m}</button>`).join("")}</div>
  <p class="hint" style="margin:10px 0 16px">${done} van ${ps.length} spelers ingevuld voor evaluatie ${evMoment}.</p>
  ${ps.length ? `<div class="panel wrapx" style="padding:8px 12px"><table class="tbl"><thead><tr><th>Speler</th>${cr.map(c => `<th style="white-space:normal;min-width:80px;text-align:center">${esc(c)}</th>`).join("")}<th>Gem.</th><th></th></tr></thead><tbody>
  ${ps.map(p => { const e = S.evals.find(x => x.player_id === p.id && x.moment === evMoment);
    return `<tr data-p="${p.id}"><td><a href="#/speler/${p.id}">${esc(pname(p))}</a></td>${cr.map(c => `<td style="text-align:center"><select data-c="${esc(c)}" aria-label="${esc(c)} voor ${esc(pname(p))}"><option value="">–</option>${opts.map(o => `<option value="${o}"${+e?.scores?.[c] === o ? " selected" : ""}>${String(o).replace(".", ",")}</option>`).join("")}</select></td>`).join("")}
    <td class="avg" style="font-weight:800">${f1(e ? evalAvg(e) : null)}</td><td><button class="link" type="button" data-cm="${p.id}">${e?.comment ? "Opmerking" : "+ opmerking"}</button></td></tr>`; }).join("")}</tbody></table></div>`
  : `<div class="empty"><b>Nog geen spelers</b><a class="link" href="#/spelers">Voeg eerst je spelers toe</a></div>`}
  <p class="hint" style="margin-top:12px">De onderdelen pas je aan bij <a class="link" href="#/ploeg-instellingen">Ploeg en trainers</a>.</p>`;
  $$("[data-m]", v).forEach(b => b.onclick = () => { evMoment = +b.dataset.m; render(); });
  const getE = pid => S.evals.find(x => x.player_id === pid && x.moment === evMoment) || null;
  const put = async e => { await db.save("evaluations", e); const i = S.evals.findIndex(x => x.player_id === e.player_id && x.moment === e.moment); if (i >= 0) S.evals[i] = e; else S.evals.push(e); };
  $$("tr[data-p] select", v).forEach(sel => sel.onchange = async () => { const tr = sel.closest("tr"), pid = tr.dataset.p, old = getE(pid);
    const e = old ? { ...old, scores: { ...old.scores } } : { id: uid(), team_id: S.team.id, player_id: pid, moment: evMoment, date: todayIso(), scores: {}, comment: null };
    if (sel.value === "") delete e.scores[sel.dataset.c]; else e.scores[sel.dataset.c] = +sel.value;
    await safe(async () => { await put(e); $(".avg", tr).textContent = f1(evalAvg(e)); }); });
  $$("[data-cm]", v).forEach(b => b.onclick = () => { const pid = b.dataset.cm, p = S.players.find(x => x.id === pid), e = getE(pid);
    const d = dialog(`<form><h2>Opmerking bij evaluatie ${evMoment}</h2><p class="muted" style="margin:0">${esc(pname(p))}</p><textarea id="cmt">${esc(e?.comment || "")}</textarea>
      <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
    $("form", d).onsubmit = async ev => { ev.preventDefault(); const c = $("#cmt", d).value.trim();
      const row = e ? { ...e, comment: c || null } : { id: uid(), team_id: S.team.id, player_id: pid, moment: evMoment, date: todayIso(), scores: {}, comment: c || null };
      await safe(async () => { await put(row); d.close(); b.textContent = row.comment ? "Opmerking" : "+ opmerking"; }, "Opmerking bewaard."); }; });
} });

/* ============ cijfers ============ */
let sortK = "name", sortD = 1;
route("cijfers", { title: "Cijfers", auth: true, team: true, render: v => {
  const rows = active().map(p => ({ p, ...playerStats(p) }));
  const cols = [["name","Speler"],["trPct","Aanw. %"],["matches","Wedstr."],["basis","Basis"],["minutes","Minuten"],["goals","Goals"],["assists","Assists"],["rating","Cijfer"],["motm","MVP"],["evalAvg","Evaluatie"]];
  rows.sort((a, b) => { const x = sortK === "name" ? pname(a.p) : a[sortK] ?? -1, y = sortK === "name" ? pname(b.p) : b[sortK] ?? -1; return (x > y ? 1 : x < y ? -1 : 0) * sortD; });
  const ms = past("wedstrijd").filter(e => e.score_for != null);
  v.innerHTML = head("Cijfers", "Automatisch berekend uit aanwezigheden, wedstrijdverslagen en evaluaties. Tik op een kolom om te sorteren.", `<button class="btn ghost" type="button" id="csv">${IC.dl}Exporteren naar Excel</button>`) +
  `<div class="kpis"><div class="kpi"><small>Trainingen</small><b>${past("training").length}</b></div><div class="kpi"><small>Wedstrijden</small><b>${past("wedstrijd").length}</b></div>
   <div class="kpi"><small>Gescoord</small><b>${ms.reduce((s, e) => s + e.score_for, 0)}</b><span>${f1(avg(ms.map(e => e.score_for)))} per match</span></div><div class="kpi"><small>Tegengekregen</small><b>${ms.reduce((s, e) => s + e.score_against, 0)}</b><span>${f1(avg(ms.map(e => e.score_against)))} per match</span></div></div>
  <div class="panel wrapx sec" style="padding:6px 12px"><table class="tbl"><thead><tr>${cols.map(([k, l]) => `<th data-k="${k}">${l}${sortK === k ? (sortD > 0 ? " ↑" : " ↓") : ""}</th>`).join("")}</tr></thead><tbody>
  ${rows.map(r => `<tr class="go" data-go="#/speler/${r.p.id}"><td>${esc(pname(r.p))}</td><td>${r.trTot ? r.trPct + "%" : "–"}<span class="bar hide-m"><i style="width:${r.trPct}%"></i></span></td><td>${r.matches}</td><td>${r.basis}</td><td>${r.minutes}</td><td>${r.goals}</td><td>${r.assists}</td><td>${f1(r.rating)}</td><td>${r.motm || "–"}</td><td>${f1(r.evalAvg)}</td></tr>`).join("")}</tbody></table></div>`;
  $$("th[data-k]", v).forEach(th => th.onclick = () => { if (sortK === th.dataset.k) sortD *= -1; else { sortK = th.dataset.k; sortD = th.dataset.k === "name" ? 1 : -1; } render(); });
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
  $("#csv").onclick = () => download(`${S.team.name.replace(/[^\w-]+/g, "_")}_cijfers_${todayIso()}.csv`, "﻿" + [
    ["Speler","Rugnummer","Aanwezig training %","Trainingen aanwezig","Trainingen totaal","Wedstrijden","Basis","Minuten","Goals","Assists","Gem. cijfer","Man van de match","Laatste evaluatie","Meest genoteerd werkpunt"].map(csvCell).join(";"),
    ...rows.map(r => [pname(r.p), r.p.number, r.trTot ? r.trPct : "", r.trIn, r.trTot, r.matches, r.basis, r.minutes, r.goals, r.assists, r.rating ? f1(r.rating) : "", r.motm, r.evalAvg ? f1(r.evalAvg) : "", r.topTag].map(csvCell).join(";"))].join("\r\n"));
} });

/* ============ ploeg en trainers ============ */
route("ploeg-instellingen", { title: "Ploeg en trainers", auth: true, team: true, render: v => {
  const t = S.team, mf = matchFormat(t);
  v.innerHTML = head("Ploeg en trainers", `${esc(t.name)} · ${esc([t.category, t.format, t.season].filter(Boolean).join(" · "))} · ${mf.periods} × ${mf.minutes} minuten`, `<button class="btn ghost" type="button" id="editT">Ploeg bewerken</button>`) +
  `<div class="share" style="margin-bottom:14px">${IC.eye}<div><b style="color:var(--ink)">Wat zien andere trainers?</b><br>De uitslag en het wedstrijdverslag van elke wedstrijd zijn zichtbaar voor alle trainers van de club. Spelersfiches, trainingen, aanwezigheden en evaluaties blijven privé voor de trainers van deze ploeg.
    <label class="check" style="margin-top:10px"><input type="checkbox" id="shareR"${t.share_ratings ? " checked" : ""}> Ook de spelersbeoordelingen van wedstrijden (cijfer, pijlers, notities) delen met alle trainers</label></div></div>
  <div class="grid2"><div class="panel"><h2>Trainers van deze ploeg</h2><div class="list">${S.trainers.map(x => `<div class="item static"><span class="main"><b>${esc(x.email || "Trainer")}</b>${x.user_id === user?.id ? "<small>jij</small>" : ""}</span></div>`).join("")}</div>
    <form id="addTr" class="row" style="margin-top:12px"><input type="email" name="mail" required placeholder="e-mailadres co-trainer" style="flex:1;min-width:180px"><button class="btn">Toevoegen</button></form>
    <p class="hint">De co-trainer moet al een account hebben. Accounts maakt de beheerder aan in Supabase.</p></div>
   <div class="panel"><h2>Evaluatie-onderdelen</h2><textarea id="crit" style="min-height:150px">${esc((t.criteria || DEF_CRIT).join("\n"))}</textarea><p class="hint">Eén onderdeel per regel.</p>
    <h2 style="margin-top:14px">Werkpunten bij wedstrijden</h2><textarea id="tags" style="min-height:150px">${esc((t.worktags || DEF_TAGS).join("\n"))}</textarea>
    <div class="row" style="margin-top:10px"><span class="spacer"></span><button class="btn" type="button" id="saveLists">Opslaan</button></div></div></div>
  <div class="sec panel" id="rbfaP"></div>
  <div class="sec panel"><h2>Ploeg verwijderen</h2><p class="hint">Verwijdert de ploeg met alle spelers, activiteiten, aanwezigheden, evaluaties en doelen. Dit kan je niet ongedaan maken.</p><button class="btn danger" type="button" id="delT">Ploeg verwijderen</button></div>`;
  $("#editT").onclick = () => teamForm(t); rbfaPanel($("#rbfaP"));
  $("#shareR").onchange = e => { t.share_ratings = e.target.checked; safe(() => db.save("teams", t), t.share_ratings ? "Spelersbeoordelingen worden gedeeld met alle trainers." : "Spelersbeoordelingen blijven privé."); };
  $("#saveLists").onclick = () => { t.criteria = $("#crit").value.split("\n").map(s => s.trim()).filter(Boolean); t.worktags = $("#tags").value.split("\n").map(s => s.trim()).filter(Boolean); safe(() => db.save("teams", t), "Opgeslagen."); };
  $("#addTr").onsubmit = async e => { e.preventDefault(); const mail = e.target.mail.value.trim();
    await safe(async () => { const r = await db.addTrainer(t.id, mail); if (r === "geen_account") { toast(mode === "demo" ? "In de demo kan je geen trainers toevoegen." : "Geen account gevonden voor " + mail + ". Vraag de beheerder om er een aan te maken."); return; }
      S.trainers = await db.list("team_trainers", { team_id: t.id }); render(); toast(mail + " is nu trainer van deze ploeg."); }); };
  $("#delT").onclick = async () => { if (prompt(`Typ de naam van de ploeg (${t.name}) om te bevestigen:`) !== t.name) return;
    await safe(async () => { await db.del("teams", { id: t.id }); try { localStorage.removeItem(TEAM_KEY); } catch (e) {} await loadTeams(); S.team = null; go("#/start"); }, "Ploeg verwijderd."); };
} });
