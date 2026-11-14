/* OGV Platform — start, ploeg, spelers, evaluaties, cijfers, ploeginstellingen. */
"use strict";

/* ============ start ============ */
route("start", { title: "Vandaag", render: async v => {
  const logged = !!db && (mode === "demo" || !!user), t = S.team, now = new Date(), today = todayIso();
  const greet = (h => h < 12 ? "Goeiemorgen" : h < 18 ? "Goeiemiddag" : "Goeieavond")(now.getHours());
  const first = (myName() || "").trim().split(/\s+/)[0];
  const upcoming = t ? S.events.filter(e => e.date >= today && !e.cancelled) : [], next = upcoming[0] || null;
  const week = upcoming.slice(1).filter(e => (parse(e.date) - parse(today)) / 864e5 <= 7).slice(0, 4);
  const recentOf = c => (c || []).filter(e => e.date <= today && e.score_for != null).slice(0, 4);
  const recentHtml = rs => rs.length ? `<section class="tsec"><div class="tsh"><h2>Uitslagen van de club</h2><a class="link" href="#/uitslagen">Alles</a></div><div class="list">${rs.map(clubItem).join("")}</div></section>` : "";
  const todo = t ? past().filter(e => !e.cancelled && !S.att.some(a => a.event_id === e.id)).slice(-3).reverse() : [];
  const setup = logged && S.admin && !isOGV() && !CLUB.settings?.setup_done ? `<a class="panel setupbar" href="#/clubinstellingen"><span class="bdg">${IC.gear}</span><span><b>Zet je club klaar</b><small>Kies in vijf stappen jullie kleuren, evaluaties, onderdelen en ploegen, en nodig trainers uit.</small></span><span class="btn small">Beginnen</span></a>` : "";
  const when = e => { const d = Math.round((parse(e.date) - parse(today)) / 864e5); return d === 0 ? "Vandaag" : d === 1 ? "Morgen" : cap(parse(e.date).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })); };
  const initials = s => String(s || "?").replace(/\b(K|R|FC|VC|KFC|KVV|SK|VV|KSK|KV|SV|FCO)\b\.?/g, "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  const crestOpp = name => `<span class="crest opp" aria-hidden="true">${esc(initials(name))}</span>`;
  /* de volgende activiteit, groot bovenaan */
  const nextCard = e => { if (!e) return "";
    const match = e.type === "wedstrijd", rs = rsvpSummary(e), home = e.home !== false, tname = teamLbl(t) || t.name;
    const meta = [e.start_time ? tm(e.start_time) + (e.end_time ? "–" + tm(e.end_time) : "") : "", e.location || (match ? (home ? "Thuis" : "Uit") : ""), e.convo?.meet ? "verzamelen " + esc(e.convo.meet) : ""].filter(Boolean);
    const rsHtml = rs ? `<div class="nrs"><span><b>${rs.ja}</b> komen</span><span><b>${rs.nee}</b> niet</span><span><b>${rs.open}</b> geen antwoord</span></div>` : "";
    if (match) { const us = `<span class="crest us">${LOGO("crest")}</span>`, them = crestOpp(e.opponent);
      return `<section class="nextcard match"><p class="nk">${when(e)} · ${home ? "thuis" : "uit"}</p>
        <div class="nvs"><div class="nt">${home ? us : them}<b>${esc(home ? tname : e.opponent || "Tegenstander")}</b></div><div class="nmid"><b>${tm(e.start_time) || "–"}</b><small>${esc(dShort(e.date))}</small></div><div class="nt">${home ? them : us}<b>${esc(home ? e.opponent || "Tegenstander" : tname)}</b></div></div>
        ${e.location ? `<p class="nloc">${IC.pin || ""}${esc(e.location)}</p>` : ""}${rsHtml}
        <div class="nact"><a class="btn" href="#/activiteit/${e.id}">${IC.ppl}Selectie</a>${clubOff("live") ? "" : `<a class="btn ghost" href="#/live/${e.id}">${IC.mic}Live coachen</a>`}${clubOff("matchday") ? "" : `<a class="btn ghost" href="#/matchday">${IC.sheet}Wedstrijdblad</a>`}</div></section>`; }
    return `<section class="nextcard"><p class="nk">${when(e)} · training</p><h2 class="ntitle">${esc(e.theme || "Training")}</h2>
      <p class="nmeta">${meta.map(esc).join(" · ")}</p>${rsHtml}
      <div class="nact"><a class="btn" href="#/activiteit/${e.id}">${IC.check}Aanwezigheden</a><a class="btn ghost" href="#/trainingen">${IC.plan}Training voorbereiden</a></div></section>`; };
  const todoRows = [
    ...todo.map(e => `<a class="trow" href="#/activiteit/${e.id}"><span class="ti warn">${IC.check}</span><span><b>Aanwezigheden invullen</b><small>${e.type === "wedstrijd" ? "Wedstrijd" : "Training"} van ${esc(dShort(e.date))}</small></span>${IC.chev || "›"}</a>`)];
  const evr = t && !clubOff("evaluaties") ? evReminder() : "";
  const noTeam = `<section class="nextcard empty"><p class="nk">${logged ? "Nog geen ploeg gekozen" : "Welkom"}</p><h2 class="ntitle">${logged ? "Kies je ploeg om te beginnen" : "Meld je aan om te beginnen"}</h2>
    <p class="nmeta">Daarna zie je hier je volgende training of wedstrijd, wat je nog moet invullen en de uitslagen van de club.</p><div class="nact">${logged ? `<button class="btn" type="button" data-pick>${IC.ppl}Ploeg kiezen</button>` : `<a class="btn" href="#/aanmelden">Aanmelden</a>`}</div></section>`;
  v.innerHTML = `${setup}<header class="today-h"><p>${cap(now.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }))}${t ? " · " + esc(t.name) : ""}</p>
      <h1>${greet}${logged && mode !== "demo" && first ? ", " + esc(first) : ""}</h1></header>
    <div class="vdgrid">
      <div class="vdcol">${t ? (next ? nextCard(next) : `<section class="nextcard empty"><p class="nk">Niets gepland</p><h2 class="ntitle">Geen trainingen of wedstrijden in de kalender</h2><div class="nact"><a class="btn" href="#/kalender">${IC.plus}Activiteit toevoegen</a></div></section>`) : noTeam}
        ${todoRows.length || evr ? `<section class="tsec"><div class="tsh"><h2>Te doen</h2></div><div class="tlist">${evr}${todoRows.join("")}</div></section>` : ""}
        <div id="msgBox"></div>
        ${week.length ? `<section class="tsec"><div class="tsh"><h2>Deze week</h2><a class="link" href="#/kalender">Kalender</a></div><div class="list">${week.map(e => evItem(e)).join("")}</div></section>` : ""}</div>
      <div class="vdcol"><div id="recentBox">${recentHtml(recentOf(S.club))}</div></div></div>`;
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
  $$("[data-pick]", v).forEach(b => b.onclick = pickTeam);
  $$("[data-em]", v).forEach(a => a.onclick = () => { evMoment = +a.dataset.em; });
  if (logged && typeof startMessages === "function") startMessages($("#msgBox", v));
  if (logged) loadClub().then(c => { const box = $("#recentBox", v); if (!box || !v.isConnected) return; box.innerHTML = recentHtml(recentOf(c)); $$("[data-go]", box).forEach(x => x.onclick = () => go(x.dataset.go)); }).catch(() => {});
} });

function evItem(e) {
  const as = S.att.filter(a => a.event_id === e.id), inn = as.filter(a => a.status === "aanwezig" || a.status === "te laat").length, r = res(e);
  const right = e.rbfa_state === "afgelast" ? `<span class="pill loss">Afgelast</span>` : e.type === "wedstrijd" && r ? `<b>${e.score_for} - ${e.score_against}</b><span class="pill ${r}">${RES_L[r]}</span>`
    : as.length ? `<b>${inn}/${active().length}</b>aanwezig` : ((rs => rs && e.date >= todayIso() ? `<b style="color:var(--ok)">${rs.ja} komen</b>${rs.nee ? rs.nee + " niet · " : ""}${rs.open} open` : "")(rsvpSummary(e)) || (e.date <= todayIso() ? `<b style="color:var(--warn)">Invullen</b>aanwezigheden` : ""));
  return `<div class="item" data-go="#/activiteit/${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span>
    <span class="main"><b>${e.type === "wedstrijd" ? matchTitle(e, clubShort()) : "Training"} <span class="pill ${e.type === "wedstrijd" ? "w" : "t"}">${e.type === "wedstrijd" ? "Match" : "Training"}</span>${e.series ? ` <span class="pill" title="Ingepland door de club">Vast</span>` : ""}${e.cancelled ? ` <span class="pill loss">Afgelast</span>` : ""}</b>
    <small>${dShort(e.date)}${e.start_time ? " · " + tm(e.start_time) : ""}${e.theme ? " · " + esc(e.theme) : e.location ? " · " + esc(e.location) : ""}</small></span><span class="val">${right}</span></div>`;
}
function clubItem(e) {
  const r = res(e), tn = teamName(e.team_id);
  return `<div class="item" data-go="#/verslag/${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span>
    <span class="main"><b>${matchTitle(e, tn)}</b><small>${esc(teamLbl(S.teams.find(t => t.id === e.team_id)))} · ${dShort(e.date)}${e.report?.goals?.length ? " · " + e.report.goals.filter(g => g.side === "for" && g.name).map(g => esc(g.name.split(" ")[0])).join(", ") : ""}</small></span>
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
  (next ? `<div class="panel hl"><div class="row nextact"><span class="date"><b>${dDay(next.date)}</b><small>${dMon(next.date)}</small></span>
    <span class="nxt"><small class="muted">${next.date === t ? "Vandaag" : "Volgende activiteit"}</small><b style="display:block;font-size:19px">${next.type === "wedstrijd" ? "Wedstrijd: " + matchTitle(next, clubShort()) : "Training" + (next.theme ? ": " + esc(next.theme) : "")}</b>
    <small class="muted">${dLong(next.date)}${next.start_time ? ", " + tm(next.start_time) : ""}${next.location ? " · " + esc(next.location) : ""}</small></span>
    <a class="btn" href="#/activiteit/${next.id}">${next.type === "wedstrijd" ? "Voorbereiden" : "Openen"}</a>${next.type === "wedstrijd" ? `<a class="btn ghost" href="#/live/${next.id}">${IC.mic}Live</a>` : ""}</div></div>`
   : `<div class="empty"><b>Niets gepland</b>Zet je trainingen en wedstrijden in de kalender.<br><a class="btn" href="#/kalender">Naar de kalender</a></div>`) +
  `<div class="sec kpis">
    <div class="kpi"><small>Aanwezigheid training</small><b>${presence == null ? "–" : Math.round(presence) + "%"}</b><span>laatste ${tr.length} trainingen</span></div>
    <div class="kpi"><small>Wedstrijden</small><b>${W}-${G}-${ms.length - W - G}</b><span>gewonnen · gelijk · verloren</span></div>
    <div class="kpi"><small>Doelsaldo</small><b>${ms.reduce((s, e) => s + e.score_for, 0)}-${ms.reduce((s, e) => s + e.score_against, 0)}</b><span>${ms.length} wedstrijden</span></div>
    <div class="kpi"><small>Lopende doelen</small><b>${S.goals.filter(g => g.status === "bezig").length}</b><span>persoonlijke doelen</span></div></div>
  <div class="grid2 sec">
    <div class="panel"><h2>Topschutters</h2>${scorers.length ? `<div class="list">${scorers.map(r => `<div class="item" data-go="#/speler/${r.p.id}">${pAv(r.p)}<span class="main"><b>${esc(pname(r.p))}</b><small>${r.assists} assists · ${r.matches} wedstrijden</small></span><span class="val"><b>${r.goals}</b>goals</span></div>`).join("")}</div>` : '<p class="muted">Nog geen doelpunten geregistreerd.</p>'}</div>
    <div class="panel"><h2>Beste gemiddelde cijfers</h2>${best.length ? `<div class="list">${best.map(r => `<div class="item" data-go="#/speler/${r.p.id}">${pAv(r.p)}<span class="main"><b>${esc(pname(r.p))}</b><small>${r.motm ? r.motm + "× man van de match" : r.matches + " wedstrijden"}</small></span><span class="val"><b>${f1(r.rating)}</b>op 10</span></div>`).join("")}</div>` : '<p class="muted">Nog geen beoordelingen.</p>'}</div></div>
  ${lastM ? `<div class="sec"><h2>Laatste wedstrijd</h2><div class="list">${evItem(lastM)}</div></div>` : ""}`;
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
} });

/* ============ spelers ============ */
route("spelers", { title: "Spelers", auth: true, team: true, render: v => {
  const ps = active(), old = S.players.filter(p => p.active === false);
  const it = p => { const s = playerStats(p); return `<div class="item" data-go="#/speler/${p.id}">${pAv(p)}<span class="main"><b>${esc(pname(p))}</b><small>${esc([p.position, p.foot ? p.foot + "voetig" : ""].filter(Boolean).join(" · ") || "Geen positie")}</small></span>
    <span class="val hide-m"><b>${s.trTot ? s.trPct + "%" : "–"}</b>aanwezig</span><span class="val hide-m"><b>${s.minutes}</b>minuten</span><span class="val"><b>${f1(s.rating)}</b>gem. cijfer</span></div>`; };
  v.innerHTML = head("Spelers", `${ps.length} spelers in ${esc(S.team.name)}`, `<button class="btn ghost" type="button" id="pcont">${IC.phone}Contacten</button><button class="btn ghost" type="button" id="plinks">${IC.link}Ouderlinks</button><button class="btn ghost" type="button" id="imp">${IC.out}Importeren</button><button class="btn ghost" type="button" id="bulk">Lijst plakken</button><button class="btn" type="button" id="addP">${IC.plus}Speler</button>`) +
    (ps.length ? `<div class="list">${ps.map(it).join("")}</div>` : `<div class="empty"><b>Nog geen spelers</b>Voeg ze één voor één toe, of plak in één keer een lijst met namen uit PSD of Excel.</div>`) +
    (old.length ? `<div class="sec"><h2>Niet meer actief</h2><div class="list">${old.map(it).join("")}</div></div>` : "");
  $("#addP").onclick = () => playerForm(); $("#bulk").onclick = bulkForm; $("#plinks").onclick = parentLinks; $("#pcont").onclick = teamContacts; $("#imp").onclick = () => importPlayers(false);
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
} });
function playerForm(p) {
  const n = !p; p = p || { first_name: "", last_name: "", active: true };
  const ph = { blob: null, url: null, remove: false };
  const d = dialog(`<form><h2>${n ? "Speler toevoegen" : "Fiche bewerken"}</h2><div class="fields">
  <div class="f full pfoto"><span class="pfimg" id="pfImg">${p.photo ? `<img data-pp="${esc(p.photo)}" alt="">` : `<b>${esc((p.first_name || "?").slice(0, 1).toUpperCase())}</b>`}</span>
    <div class="pfc"><div class="row" style="gap:8px;flex-wrap:wrap"><label class="btn ghost small" style="cursor:pointer">${p.photo ? "Andere foto" : "Foto toevoegen"}<input type="file" id="pfFile" accept="image/*" hidden></label>${p.photo ? `<button class="btn ghost small" type="button" id="pfDel">Foto verwijderen</button>` : ""}</div>
    <label class="check" id="pfOkL" style="margin-top:8px;font-size:13.5px" hidden><input type="checkbox" id="pfOk"${p.photo_ok ? " checked" : ""}> <span>De ouders gaven toestemming voor een foto van hun kind in de app.</span></label>
    <small class="hint" id="pfHint">De foto wordt verkleind en privé bewaard. Enkel de trainers van de ploeg zien ze.</small></div></div>
  <label class="f">Voornaam<input name="first_name" required value="${esc(p.first_name)}"></label><label class="f">Achternaam<input name="last_name" value="${esc(p.last_name)}"></label>
  <label class="f">Rugnummer<input name="number" type="number" min="0" inputmode="numeric" value="${p.number ?? ""}"></label><label class="f">Geboortedatum<input name="birthdate" type="date" value="${esc(p.birthdate || "")}"></label>
  <label class="f">Positie<select name="position"><option value="">–</option>${p.position && !POSNUM.some(q => posLabel(q[0]) === p.position) ? `<option selected>${esc(p.position)}</option>` : ""}${POSNUM.map(q => `<option value="${posLabel(q[0])}"${posLabel(q[0]) === p.position ? " selected" : ""}>${q[0]} · ${q[1]}</option>`).join("")}</select></label>
  <label class="f">Maturiteit<select name="maturity"><option value="">Niet ingeschat</option>${[["vroeg", "Vroegmatuur"], ["normaal", "Normaal matuur"], ["laat", "Laatmatuur"]].map(([k, l]) => `<option value="${k}"${p.maturity === k ? " selected" : ""}>${l}</option>`).join("")}</select><small class="hint">Inschatting t.o.v. leeftijdsgenoten, enkel voor de trainers.</small></label>
  <label class="f">Voorkeursvoet<select name="foot">${["","Rechts","Links","Beide"].map(x => `<option${x === (p.foot || "") ? " selected" : ""}>${x}</option>`).join("")}</select></label>
  ${V14() ? contactFields(p) : `<label class="f full">Contact ouders<input name="parent_contact" value="${esc(p.parent_contact || "")}" placeholder="Naam en gsm-nummer"></label>`}
  <label class="f full">Notities<textarea name="notes">${esc(p.notes || "")}</textarea></label>
  ${n ? "" : `<label class="f full check"><input type="checkbox" name="active"${p.active !== false ? " checked" : ""}> Speelt nog in deze ploeg</label>`}</div>
  <div class="row">${n ? "" : `<button class="btn danger" type="button" id="del">Verwijderen</button>`}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  $("#pfFile", d).onchange = async e => { const f = e.target.files[0]; if (!f) return;
    try { ph.blob = await photos.shrink(f); ph.remove = false; if (ph.url) URL.revokeObjectURL(ph.url); ph.url = URL.createObjectURL(ph.blob);
      $("#pfImg", d).innerHTML = `<img src="${ph.url}" alt="">`; $("#pfOkL", d).hidden = false; $("#pfHint", d).textContent = "Controleer de uitsnede en vink de toestemming aan."; }
    catch (err) { toast(err.message || "Foto kiezen is niet gelukt."); e.target.value = ""; } };
  if ($("#pfDel", d)) $("#pfDel", d).onclick = () => { ph.blob = null; ph.remove = true; $("#pfImg", d).innerHTML = `<b>${esc((p.first_name || "?").slice(0, 1).toUpperCase())}</b>`; $("#pfOkL", d).hidden = true; $("#pfHint", d).textContent = "De foto wordt verwijderd als je opslaat."; $("#pfDel", d).hidden = true; };
  if (!n) $("#del", d).onclick = async () => { if (!confirm(`${pname(p)} en al zijn gegevens definitief verwijderen? Zet hem liever op niet actief als hij de ploeg verlaat.`)) return;
    await safe(async () => { await db.del("players", { id: p.id }); photos.remove(p.photo); S.players = S.players.filter(x => x.id !== p.id); S.att = S.att.filter(a => a.player_id !== p.id); S.evals = S.evals.filter(a => a.player_id !== p.id); S.goals = S.goals.filter(a => a.player_id !== p.id); d.close(); go("#/spelers"); }, "Speler verwijderd."); };
  $("form", d).onsubmit = async e => { e.preventDefault(); const fd = new FormData(e.target), f = Object.fromEntries(fd);
    if (ph.blob && !$("#pfOk", d).checked) { toast("Vink eerst aan dat de ouders toestemming gaven voor de foto."); return; }
    const row = { ...(n ? { id: uid(), team_id: S.team.id } : p), first_name: f.first_name.trim(), last_name: (f.last_name || "").trim(), number: f.number === "" ? null : +f.number, birthdate: f.birthdate || null,
      position: f.position || null, foot: f.foot || null, ...(f.maturity || "maturity" in p ? { maturity: f.maturity || null } : {}), parent_contact: f.parent_contact || null, notes: f.notes || null, active: n ? true : fd.has("active"), ...(V14() ? readContacts(f) : {}) };
    await safe(async () => { const oldPhoto = p.photo || null;
      if (ph.blob) { row.photo = await photos.save(row.team_id, row.id, ph.blob); row.photo_ok = true; }
      else if (ph.remove) { row.photo = null; row.photo_ok = null; }
      await db.save("players", row); if ((ph.blob || ph.remove) && oldPhoto) photos.remove(oldPhoto);
      const i = S.players.findIndex(x => x.id === row.id); if (i >= 0) S.players[i] = row; else S.players.push(row); sortPlayers(); d.close(); render(); }, "Speler opgeslagen."); };
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
  const ms = matchRows(p.id).reverse();
  const age = p.birthdate ? Math.floor((Date.now() - parse(p.birthdate)) / 3.15576e10) : null;
  const pil = PILLARS.map(k => [k, avg(ms.map(x => +x.a.scores?.[k]).filter(Boolean))]);
  v.innerHTML = backLink("#/spelers", "Spelers") + `<div class="ph">${pAv(p, "width:60px;height:60px;border-radius:16px;background:var(--yellow);color:#000;font-size:26px;border:0")}
   <div class="t"><h1 class="pg">${esc(pname(p))}</h1><p class="sub">${esc([p.position, p.foot ? p.foot + "voetig" : "", age != null ? age + " jaar" : ""].filter(Boolean).join(" · "))}</p></div>
   <a class="btn" href="#/dossier/${p.id}">${IC.book}Dossier</a><button class="btn ghost" type="button" id="editP">Fiche bewerken</button></div>
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
    <span class="main"><b>${e.report?.squad ? `<span class="pill g">${esc(e.report.squad)}</span> ` : ""}${esc(e.opponent || "Wedstrijd")}${e.report?.motm === p.id ? ' <span class="pill w">Man van de match</span>' : ""}${isCaptain(e, p, a) ? ' <span class="pill w">Kapitein</span>' : ""}</b><small>${esc([a.role, a.minutes != null ? a.minutes + " min" : "", a.goals ? a.goals + " goal" : "", a.assists ? a.assists + " assist" : ""].filter(Boolean).join(" · "))}</small>${a.note ? `<span class="notefull">${esc(a.note)}</span>` : ""}${a.rated_by ? `<span class="rby">door ${esc(a.rated_by)}</span>` : ""}</span><span class="val"><b>${a.rating ?? "–"}</b>cijfer</span></div>`).join("")}</div></div>` : ""}
  ${contactsPanel(p)}${historyHtml(p)}`;
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
  const names = evItems(), W = 320, H = 130, pad = 26, xs = m => pad + (m - 1) * (W - 2 * pad) / (EV_MOMENTS.length - 1), ys = val => H - 18 - (val - 1) * (H - 36) / 4;
  const pts = ev.map(e => [e.moment, evAvgOf(e, names)]).filter(x => x[1] != null);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Evolutie gemiddelde evaluatie">
  ${[1,2,3,4,5].map(n => `<line x1="${pad}" x2="${W - pad}" y1="${ys(n)}" y2="${ys(n)}" style="stroke:var(--line)"/><text x="6" y="${ys(n) + 4}" style="fill:var(--dim)" font-size="10">${n}</text>`).join("")}
  ${EV_MOMENTS.map(x => `<text x="${xs(x.m)}" y="${H - 2}" text-anchor="middle" style="fill:var(--dim)" font-size="10">${x.kort}</text>`).join("")}
  <polyline fill="none" stroke="#FFD100" stroke-width="2.5" points="${pts.map(([m, n]) => xs(m) + "," + ys(n)).join(" ")}"/>
  ${pts.map(([m, n]) => `<circle cx="${xs(m)}" cy="${ys(n)}" r="4" fill="#FFD100"/><text x="${xs(m)}" y="${ys(n) - 9}" text-anchor="middle" style="fill:var(--ink)" font-size="11" font-weight="700">${f1(n)}</text>`).join("")}</svg>`;
}
function evalDetail(ev) { const a0 = ev[0], b0 = ev[ev.length - 1], two = ev.length > 1, nm = m => EV_MOMENTS[m - 1].kort;
  const cell = (a, b) => { const dl = two && a != null && b != null ? b - a : null; return `<td>${a == null ? "–" : f1(a)}</td>${two ? `<td>${b == null ? "–" : f1(b)}</td><td style="color:${dl > 0 ? "var(--ok)" : dl < 0 ? "var(--bad)" : "var(--muted)"}">${dl == null ? "–" : (dl > 0 ? "+" : "") + f1(dl)}</td>` : ""}`; };
  return `<div class="tblwrap"><table class="tbl evtbl" style="margin-top:8px"><tr><th style="text-align:left">Onderdeel</th><th>${nm(a0.moment)}</th>${two ? `<th>${nm(b0.moment)}</th><th>Groei</th>` : ""}</tr>
  ${evGroups().map(g => { const n = g.items.map(i => i.name); return `<tr class="grow"><td style="text-align:left"><b>${esc(g.name)}</b></td>${cell(evAvgOf(a0, n), evAvgOf(b0, n))}</tr>` +
    g.items.map(i => `<tr><td style="text-align:left;padding-left:18px" class="muted">${esc(i.name)}</td>${cell(evScore(a0, i.name), evScore(b0, i.name))}</tr>`).join(""); }).join("")}</table></div>
  <a class="btn ghost small" style="margin-top:10px" href="#/evaluaties/${a0.player_id}/${b0.moment}">Evaluatie openen</a>`; }

/* ============ cijfers ============ */
/* ============ ploeg en trainers ============ */
route("ploeg-instellingen", { title: "Ploeg en trainers", auth: true, team: true, render: v => {
  const t = S.team, mf = matchFormat(t);
  v.innerHTML = head("Ploeg en trainers", `${esc(t.name)} · ${esc([t.category, t.format, t.season].filter(Boolean).join(" · "))} · ${mf.periods} × ${mf.minutes} minuten`, `<button class="btn ghost" type="button" id="editT">Ploeg bewerken</button>`) +
  `<div class="share" style="margin-bottom:14px">${IC.eye}<div><b style="color:var(--ink)">Wat zien andere trainers?</b><br>De uitslag en het wedstrijdverslag van elke wedstrijd zijn zichtbaar voor alle trainers van de club. Spelersfiches, trainingen, aanwezigheden en evaluaties blijven privé voor de trainers van deze ploeg.
    <p style="margin:8px 0 0">Ook de cijfers en notities per speler bij wedstrijden zijn zichtbaar voor alle trainers van de club. Ouders en leden zonder ploeg (bv. een scout) zien ze niet.</p></div></div>
  <div class="grid2"><div class="panel"><h2>Trainers van deze ploeg</h2><div class="list">${S.trainers.map(x => `<a class="item" href="#/trainer/${encodeURIComponent(x.user_id || x.email || "")}"><span class="main"><b>${esc((typeof tpOf === "function" && tpOf(x.user_id)?.name) || x.email || "Trainer")}</b><small>${x.user_id === user?.id ? "jij · " : ""}bekijk dossier</small></span></a>`).join("")}</div>
    ${S.admin ? `<form id="addTr" class="row" style="margin-top:12px"><input type="email" name="mail" required placeholder="e-mailadres co-trainer" style="flex:1;min-width:180px"><button class="btn">Toevoegen</button></form>
    <p class="hint">Als beheerder kan je ook alle ploegen beheren via <a href="#/clubbeheer/ploegen">Beheer → Ploegen en trainers</a>.</p>` : `<p class="hint" style="margin-bottom:0">Trainers toevoegen of weghalen doet de beheerder van de club. Stuur een melding via <b>Probleem melden</b> als er iemand bij moet of weg moet.</p>`}</div>
   <div class="panel"><h2>Evaluatie-onderdelen</h2><p class="hint" style="margin-top:0">Eén onderdeel per regel. Begin een regel met # voor een groep, en zet uitleg achter een |, bv. "Passing | zuiver passen met beide voeten".</p><textarea id="crit" style="min-height:220px">${esc((t.criteria || DEF_CRIT).join("\n"))}</textarea>
    <h2 style="margin-top:14px">Werkpunten bij wedstrijden</h2><textarea id="tags" style="min-height:150px">${esc((t.worktags || DEF_TAGS).join("\n"))}</textarea>
    <div class="row" style="margin-top:10px"><span class="spacer"></span><button class="btn" type="button" id="saveLists">Opslaan</button></div></div></div>
  <div class="sec panel" id="rbfaP"></div>
  ${S.admin ? `<div class="sec panel"><h2>Nieuw seizoen</h2><p class="hint" style="margin-top:0">Schuif je spelers door naar een nieuwe ploeg voor volgend seizoen. Evaluaties en cijfers gaan mee als geschiedenis; deze ploeg blijft bewaard.</p><button class="btn ghost" type="button" id="season">${IC.rotate}Naar een nieuw seizoen</button></div>
  <div class="sec panel"><h2>Ploeg verwijderen</h2><p class="hint">Verwijdert de ploeg met alle spelers, activiteiten, aanwezigheden, evaluaties en doelen. Dit kan je niet ongedaan maken.</p><button class="btn danger" type="button" id="delT">Ploeg verwijderen</button></div>` : ""}`;
  $("#editT").onclick = () => teamForm(t); const se = $("#season"); if (se) se.onclick = seasonForm; rbfaPanel($("#rbfaP"));

  $("#saveLists").onclick = () => { t.criteria = $("#crit").value.split("\n").map(s => s.trim()).filter(Boolean); t.worktags = $("#tags").value.split("\n").map(s => s.trim()).filter(Boolean); safe(() => db.save("teams", t), "Opgeslagen."); };
  const at = $("#addTr"); if (at) at.onsubmit = async e => { e.preventDefault(); const mail = e.target.mail.value.trim();
    await safe(async () => { const r = await db.addTrainer(t.id, mail); if (r === "geen_account") { toast(mode === "demo" ? "In de demo kan je geen trainers toevoegen." : "Geen account gevonden voor " + mail + ". Vraag de beheerder om er een aan te maken."); return; }
      S.trainers = await db.list("team_trainers", { team_id: t.id }); render(); toast(mail + " is nu trainer van deze ploeg."); }); };
  const dt = $("#delT"); if (dt) dt.onclick = async () => { if (prompt(`Typ de naam van de ploeg (${t.name}) om te bevestigen:`) !== t.name) return;
    await safe(async () => { await db.del("teams", { id: t.id }); try { localStorage.removeItem(TEAM_KEY); } catch (e) {} await loadTeams(); S.team = null; go("#/start"); }, "Ploeg verwijderd."); };
} });
