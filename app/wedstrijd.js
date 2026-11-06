/* OGV Platform — kalender, activiteiten (training en wedstrijd), uitgebreid wedstrijdverslag,
   opstelling per kwart, live coachen en de uitslagen van de hele club. */
"use strict";

/* ============ kalender ============ */
let calFilter = "week", calType = "", calWeek = 0;
function weekView(evs) { /* "Mijn planning": vier weken onder elkaar, maandag tot zondag, zoals in PSD */
  const now = new Date(), t = todayIso(), N = 4;
  const mon0 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + calWeek * 7);
  const wkNr = mon => { const d = new Date(Date.UTC(mon.getFullYear(), mon.getMonth(), mon.getDate() + 3)), y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - y) / 864e5 - 3 + (y.getUTCDay() + 6) % 7) / 7); };
  const weeks = [...Array(N)].map((_, w) => { const mon = new Date(mon0.getFullYear(), mon0.getMonth(), mon0.getDate() + w * 7);
    return { mon, days: [...Array(7)].map((_, i) => iso(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i))) }; });
  const first = weeks[0].days[0], last = weeks[N - 1].days[6];
  const day = d => { const es = evs.filter(e => e.date === d).sort((a, b) => tm(a.start_time).localeCompare(tm(b.start_time)));
    return `<div class="wd${d === t ? " today" : ""}${d < t ? " past" : ""}${es.length ? "" : " empty"}"><div class="wh"><span>${parse(d).toLocaleDateString("nl-BE", { weekday: "short" })}</span><b>${dDay(d)}</b></div>${es.map(e => { const r = res(e);
      return `<button type="button" class="wev ${e.type}${e.cancelled || e.rbfa_state === "afgelast" ? " off" : ""}" data-go="#/activiteit/${e.id}"><small>${tm(e.start_time)}${e.end_time ? "–" + tm(e.end_time) : ""}${e.series ? ` · <span title="Ingepland door de club">vast</span>` : ""}</small><b>${e.type === "wedstrijd" ? esc((e.home === false ? "@ " : "vs ") + (e.opponent || "Wedstrijd")) : esc(e.theme || "Training")}</b>${r ? `<span class="pill ${r}">${e.score_for}-${e.score_against}</span>` : e.location ? `<small>${esc(e.location)}</small>` : ""}</button>`; }).join("")}</div>`; };
  return `<div class="row" style="margin-bottom:10px"><button class="btn ghost small" type="button" data-wk="-${N}" aria-label="Vorige vier weken">‹</button><b style="font-size:17px">${dShort(first)} – ${dShort(last)}</b><button class="btn ghost small" type="button" data-wk="${N}" aria-label="Volgende vier weken">›</button>${calWeek ? `<button class="link" type="button" data-wk="0">Vandaag</button>` : ""}</div>
  ${weeks.map(w => `<div class="wkblock"><h3 class="wkh">Week ${wkNr(w.mon)} <small>${dShort(w.days[0])} – ${dShort(w.days[6])}</small></h3><div class="week">${w.days.map(day).join("")}</div></div>`).join("")}`;
}
route("kalender", { title: "Kalender", auth: true, team: true, render: v => {
  const t = todayIso();
  let list = calFilter !== "voorbij" ? S.events.filter(e => e.date >= t) : [...S.events.filter(e => e.date < t)].reverse();
  if (calType) list = list.filter(e => e.type === calType);
  v.innerHTML = head("Kalender", "Trainingen en wedstrijden. Open een activiteit voor aanwezigheden, trainingsplan of wedstrijdverslag.", (S.team.rbfa_team_id ? `<button class="btn ghost" type="button" id="rbSync">${IC.rotate}RBFA bijwerken</button>` : `<a class="btn ghost" href="#/ploeg-instellingen">${IC.rotate}Wedstrijden van RBFA</a>`) + `<button class="btn" type="button" id="addEv">${IC.plus}Activiteit</button>`) +
  `<div class="row" style="margin-bottom:14px"><div class="chips"><button class="chip" type="button" data-f="week" aria-pressed="${calFilter === "week"}">Mijn planning</button><button class="chip" type="button" data-f="komend" aria-pressed="${calFilter === "komend"}">Komend</button><button class="chip" type="button" data-f="voorbij" aria-pressed="${calFilter === "voorbij"}">Voorbij</button></div>
   <span class="spacer"></span><div class="chips"><button class="chip" type="button" data-t="" aria-pressed="${!calType}">Alles</button><button class="chip" type="button" data-t="training" aria-pressed="${calType === "training"}">Trainingen</button><button class="chip" type="button" data-t="wedstrijd" aria-pressed="${calType === "wedstrijd"}">Wedstrijden</button></div></div>
  ${calFilter === "week" ? weekView(calType ? S.events.filter(e => e.type === calType) : S.events) : list.length ? `<div class="list">${list.map(e => evItem(e)).join("")}</div>` : `<div class="empty"><b>${calFilter === "komend" ? "Niets gepland" : "Nog niets voorbij"}</b>Voeg een training of wedstrijd toe. Trainingen herhaal je meteen voor het hele seizoen.</div>`}`;
  $$("[data-f]", v).forEach(b => b.onclick = () => { calFilter = b.dataset.f; render(); });
  $$("[data-t]", v).forEach(b => b.onclick = () => { calType = b.dataset.t; render(); });
  $$("[data-wk]", v).forEach(b => b.onclick = () => { calWeek = b.dataset.wk === "0" ? 0 : calWeek + +b.dataset.wk; render(); });
  $("#addEv").onclick = () => eventForm();
  const rs = $("#rbSync"); if (rs) rs.onclick = async () => { rs.disabled = true; rs.innerHTML = '<span class="spin"></span>Ophalen…'; const r = await safe(() => rbfaSync(S.team)); if (r) { toast(r.added || r.changed ? `${r.added} nieuw, ${r.changed} bijgewerkt.` : "Alles is al up-to-date."); render(); } else { rs.disabled = false; rs.innerHTML = IC.rotate + "RBFA bijwerken"; } }; $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
} });
function eventForm(e, forceNew) {
  const n = !e || forceNew; e = e || { type: "training", date: todayIso(), start_time: "18:00", end_time: "19:15" };
  const d = dialog(`<form><h2>${n ? "Activiteit toevoegen" : "Activiteit bewerken"}</h2>
  <div class="chips" id="typ"><button class="chip" type="button" data-t="training">Training</button><button class="chip" type="button" data-t="wedstrijd">Wedstrijd</button></div>
  <div class="fields"><label class="f">Datum<input type="date" name="date" required value="${esc(e.date)}"></label>
  <label class="f">Begin<input type="time" name="start_time" value="${esc(tm(e.start_time))}"></label><label class="f">Einde<input type="time" name="end_time" value="${esc(tm(e.end_time))}"></label>
  <label class="f">Plaats<input name="location" list="fldnames" value="${esc(e.location || "")}" placeholder="bv. Terrein A of KGV"><datalist id="fldnames">${(typeof FIELD_NAMES !== "undefined" ? FIELD_NAMES : []).map(x => `<option value="${esc(x)}">`).join("")}</datalist></label>
  ${V19() ? `<label class="f">Deel van het veld<select name="field_part">${partOpts(e.field_part, fieldOf(e.location) || "A")}</select></label>` : ""}
  <label class="f wo">Tegenstander<input name="opponent" value="${esc(e.opponent || "")}"></label>
  <label class="f wo">Thuis of uit<select name="home"><option value="1"${e.home !== false ? " selected" : ""}>Thuis</option><option value="0"${e.home === false ? " selected" : ""}>Uit</option></select></label>
  <label class="f full to">Thema<input name="theme" list="themes" value="${esc(e.theme || "")}" placeholder="bv. 1A Opbouw van achteruit"><datalist id="themes">${THEMES.map(x => `<option value="${esc(x)}">`).join("")}</datalist></label>
  ${n ? `<label class="f full to">Wekelijks herhalen tot <span class="hint">(leeg laten voor één keer)</span><input type="date" name="until"></label>` : ""}
  ${!n && V14() ? `<label class="f full check"><input type="checkbox" name="cancelled"${e.cancelled ? " checked" : ""}> <span><b>Afgelast</b> <span class="muted" style="font-weight:400">— blijft in de kalender en ouders zien dat het niet doorgaat</span></span></label>` : ""}</div>
  <div class="row">${n ? "" : `<button class="btn danger" type="button" id="del">Verwijderen</button>`}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  let type = e.type; const sync = () => { $$(".wo", d).forEach(x => x.hidden = type !== "wedstrijd"); $$(".to", d).forEach(x => x.hidden = type !== "training"); $$("#typ button", d).forEach(b => b.setAttribute("aria-pressed", b.dataset.t === type)); };
  $$("#typ button", d).forEach(b => b.onclick = () => { type = b.dataset.t; sync(); }); sync();
  if (!n) $("#del", d).onclick = async () => { if (!confirm("Deze activiteit met aanwezigheden en verslag verwijderen?")) return;
    await safe(async () => { await db.del("events", { id: e.id }); S.events = S.events.filter(x => x.id !== e.id); S.att = S.att.filter(a => a.event_id !== e.id); S.club = null; d.close(); go("#/kalender"); }, "Activiteit verwijderd."); };
  $("form", d).onsubmit = async ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target));
    const base = { team_id: S.team.id, type, start_time: f.start_time || null, end_time: f.end_time || null, location: f.location || null, ...(V19() ? { field_part: fieldOf(f.location) ? f.field_part || null : null } : {}),
      opponent: type === "wedstrijd" ? f.opponent || null : null, home: type === "wedstrijd" ? f.home === "1" : null, theme: type === "training" ? f.theme || null : null,
      ...(!n && V14() ? { cancelled: !!f.cancelled } : {}) };
    const before = n ? null : { ...e };
    const dates = [f.date]; if (n && type === "training" && f.until) { let x = parse(f.date); for (;;) { x = addDays(x, 7); if (iso(x) > f.until || dates.length > 60) break; dates.push(iso(x)); } }
    let firstId;
    await safe(async () => { for (const dt of dates) { const row = { ...(n ? { id: uid(), report: {} } : e), ...base, date: dt }; firstId = firstId || row.id; await putEvent(row); }
      d.close(); if (n && dates.length === 1) go("#/activiteit/" + firstId + (type === "training" ? "/plan" : "")); else render();
      if (before) notifyChange(before, S.events.find(x => x.id === e.id) || { ...e, ...base }); }, dates.length > 1 ? dates.length + " trainingen toegevoegd." : "Opgeslagen."); };
}

/* ============ activiteit ============ */
route("activiteit", { title: "Activiteit", auth: true, team: true, keepScroll: true, render: (v, id, sub) => {
  const e = S.events.find(x => x.id === id);
  if (!e) { v.innerHTML = `<div class="empty"><b>Activiteit niet gevonden</b>Ze hoort misschien bij een andere ploeg.<br><a class="btn" href="#/kalender">Naar de kalender</a></div>`; return; }
  e.report = e.report || {};
  return e.type === "wedstrijd" ? viewMatch(v, e, sub || (e.date >= todayIso() && !e.cancelled ? "convocatie" : "verslag")) : viewTraining(v, e, sub || "aanwezig");
} });
function tabsHtml(base, tabs, curT) { return `<div class="ptabs noprint" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === curT}" data-tab="${base}/${k}">${l}</button>`).join("")}</div>`; }
function bindTabs(v) { $$("[data-tab]", v).forEach(b => b.onclick = () => { history.replaceState(null, "", "#/activiteit/" + b.dataset.tab); render(); }); }
const saver = (e, msg) => debounce(async () => { await safe(() => putEvent(e)); const s = $("#saved"); if (s) { s.textContent = msg || "Opgeslagen"; setTimeout(() => s && (s.textContent = ""), 1500); } }, 700);

/* ---------- training ---------- */
function viewTraining(v, e, tab) {
  v.innerHTML = backLink("#/kalender", "Kalender") + head("Training" + (e.theme ? ": " + esc(e.theme) : ""),
    `${cap(dLong(e.date))}${e.start_time ? ", " + tm(e.start_time) + (e.end_time ? "–" + tm(e.end_time) : "") : ""}${e.location ? " · " + esc(e.location) + (e.field_part && fieldOf(e.location) ? " (" + esc(partLong(e.field_part, fieldOf(e.location))) + ")" : "") : ""}`,
    `<span class="hint" id="saved"></span><button class="btn ghost small noprint" type="button" id="editEv">Bewerken</button><button class="btn ghost small noprint" type="button" onclick="print()">${IC.print}Afdrukken</button>`) +
    (e.cancelled ? `<div class="share" style="margin-bottom:14px">${IC.eye}<div><b style="color:var(--ink)">Afgelast.</b> Ouders zien deze training als afgelast. Via Bewerken zet je ze terug aan.</div></div>` : "") +
    tabsHtml(e.id, [["aanwezig", "Aanwezigheden"], ["plan", "Trainingsplan"], ["verslag", "Verslag"]], tab) + `<div id="tabv"></div>`;
  $("#editEv").onclick = () => eventForm(e); bindTabs(v);
  const tv = $("#tabv");
  if (tab === "plan") planEditor(tv, e);
  else if (tab === "verslag") { tv.innerHTML = `<div class="panel"><div class="fields">
      <label class="f full">Wat ging goed?<textarea data-r="good">${esc(e.report.good || e.report_good || "")}</textarea></label>
      <label class="f full">Wat kan beter?<textarea data-r="better">${esc(e.report.better || e.report_better || "")}</textarea></label>
      <label class="f full">Notities en afspraken<textarea data-r="notes">${esc(e.report.notes || e.report_notes || "")}</textarea></label></div><p class="hint" style="margin:10px 0 0">Wordt automatisch bewaard.</p></div>`;
    const sv = saver(e); $$("[data-r]", tv).forEach(x => x.oninput = () => { e.report[x.dataset.r] = x.value; sv(); }); }
  else attendanceView(tv, e);
}
function attendanceView(tv, e) {
  const ps = active(), as = S.att.filter(a => a.event_id === e.id), c = s => as.filter(a => a.status === s).length;
  tv.innerHTML = `<div class="row" style="margin-bottom:12px"><span class="muted" style="margin-right:auto" id="cnts">${c("aanwezig") + c("te laat")} aanwezig · ${c("verwittigd")} verwittigd · ${c("afwezig")} afwezig · ${c("geblesseerd")} geblesseerd · ${ps.length - as.length} nog niet ingevuld</span>
    ${(rs => rs ? `<button class="btn ghost small" type="button" id="rsApply" title="Wie nog niet ingevuld is: komt = aanwezig, komt niet = verwittigd">Antwoorden ouders overnemen</button>` : "")(rsvpSummary(e))}<button class="btn small" type="button" id="allIn">Iedereen aanwezig</button></div>
    ${(rs => rs ? `<div class="rsvpbar"><b>Ouders:</b> <span class="rsvp ja">${rs.ja} komen</span> <span class="rsvp nee">${rs.nee} komen niet</span> <span class="rsvp none">${rs.open} geen antwoord</span></div>` : "")(rsvpSummary(e))}
    ${ps.length ? `<div class="list">${ps.map(p => { const a = attOf(e.id, p.id);
      return `<div class="item static" data-p="${p.id}" style="flex-wrap:wrap"><span class="num">${p.number ?? ""}</span><span class="main" style="min-width:140px"><b>${esc(pname(p))}</b>${rsvpSummary(e) ? rsvpBadge(e, p) : ""}</span>
      <div class="seg">${STATUS.map(s => `<button type="button" data-s="${s}" aria-pressed="${a?.status === s}">${STATUS_L[s]}</button>`).join("")}</div></div>`; }).join("")}</div>`
     : `<div class="empty"><b>Nog geen spelers</b><a class="link" href="#/spelers">Voeg eerst je spelers toe</a></div>`}`;
  const recount = () => { const as2 = S.att.filter(a => a.event_id === e.id), c2 = s => as2.filter(a => a.status === s).length;
    $("#cnts").textContent = `${c2("aanwezig") + c2("te laat")} aanwezig · ${c2("verwittigd")} verwittigd · ${c2("afwezig")} afwezig · ${c2("geblesseerd")} geblesseerd · ${ps.length - as2.length} nog niet ingevuld`; };
  $$("[data-p]", tv).forEach(row => $$(".seg button", row).forEach(b => b.onclick = async () => { const pid = row.dataset.p, old = attOf(e.id, pid) || { event_id: e.id, player_id: pid, team_id: S.team.id, tags: [], strengths: [], scores: {} };
    const a = { ...old, status: b.dataset.s }; await safe(async () => { await putAtt(a); $$(".seg button", row).forEach(x => x.setAttribute("aria-pressed", x === b)); recount(); }); }));
  const ra = $("#rsApply"); if (ra) ra.onclick = async () => { const n = await safe(() => rsvpApply(e)); if (n != null) { toast(n ? n + (n === 1 ? " antwoord" : " antwoorden") + " overgenomen." : "Iedereen met een antwoord is al ingevuld."); render(); } };
  $("#allIn").onclick = () => safe(async () => { for (const p of ps) { const a = attOf(e.id, p.id); if (!a || a.status !== "aanwezig") await putAtt({ ...(a || { event_id: e.id, player_id: p.id, team_id: S.team.id, tags: [], strengths: [], scores: {} }), status: "aanwezig" }); } render(); }, "Iedereen staat op aanwezig.");
}

/* ---------- wedstrijd ---------- */
function viewMatch(v, e, tab) {
  const r = res(e);
  v.innerHTML = backLink("#/kalender", "Kalender") + head(matchTitle(e, S.team.name),
    `${cap(dLong(e.date))}${e.start_time ? ", " + tm(e.start_time) : ""}${e.location ? " · " + esc(e.location) + (e.field_part && fieldOf(e.location) ? " (" + esc(partLong(e.field_part, fieldOf(e.location))) + ")" : "") : ""}${r ? ` · <span class="pill ${r}">${RES_L[r]}</span>` : ""}`,
    `<span class="hint" id="saved"></span><a class="btn noprint" href="#/live/${e.id}">${IC.mic}Live coachen</a><button class="btn ghost small noprint" type="button" id="editEv">Bewerken</button><button class="btn ghost small noprint" type="button" onclick="print()">${IC.print}Afdrukken</button>`) +
    matchLinks(e) + (e.cancelled ? `<div class="share" style="margin-bottom:14px">${IC.eye}<div><b style="color:var(--ink)">Afgelast.</b> Ouders zien deze wedstrijd als afgelast. Via Bewerken zet je ze terug aan.</div></div>` : "") + tabsHtml(e.id, [...(e.date >= todayIso() ? [["convocatie", "Convocatie"]] : []), ["verslag", "Verslag"], ["spelers", "Spelers beoordelen"], ["momenten", "Hoofdmomenten"], ["opstelling", "Opstelling per kwart"], ["aanwezig", "Selectie"], ...(e.date < todayIso() ? [["convocatie", "Convocatie"]] : [])], tab || (e.date >= todayIso() ? "convocatie" : "verslag")) + `<div id="tabv"></div>`;
  $("#editEv").onclick = () => eventForm(e); bindTabs(v);
  const tv = $("#tabv");
  ({ convocatie: convoTab, verslag: reportTab, spelers: playersTab, momenten: momentsTab, opstelling: lineupTab, aanwezig: attendanceView }[tab || (e.date >= todayIso() ? "convocatie" : "verslag")] || reportTab)(tv, e);
}
function reportTab(tv, e) {
  const R = e.report, sv = saver(e), ps = S.players;
  R.goals = R.goals || [];
  const present = active().filter(p => { const a = attOf(e.id, p.id); return !a || a.status === "aanwezig" || a.status === "te laat"; });
  const opt = (sel) => `<option value="">–</option>${present.map(p => `<option value="${p.id}"${sel === p.id ? " selected" : ""}>${esc(pname(p))}</option>`).join("")}`;
  const draw = () => {
    const gf = R.goals.filter(g => g.side === "for").length, ga = R.goals.filter(g => g.side === "against").length;
    tv.innerHTML = `<div class="share noprint" style="margin-bottom:14px">${IC.eye}<div>De uitslag, dit verslag en de cijfers en notities per speler zijn zichtbaar voor alle trainers van de club. Ouders zien ze niet.</div></div>
    <div class="score"><div class="side-t"><b>${e.home === false ? esc(e.opponent || "Tegenstander") : esc(e.report?.squad ? "OGV " + e.report.squad : S.team.name)}</b><small>${e.home === false ? "Thuis" : "OGV"}</small></div>
      <div><div class="nums"><input type="number" min="0" inputmode="numeric" id="s1" value="${(e.home === false ? e.score_against : e.score_for) ?? ""}" aria-label="Score thuisploeg"><span>–</span><input type="number" min="0" inputmode="numeric" id="s2" value="${(e.home === false ? e.score_for : e.score_against) ?? ""}" aria-label="Score bezoekers"></div>
      <div class="half">Rust <input id="h1" type="number" min="0" style="width:52px;padding:4px;font-size:14px;text-align:center" value="${(e.home === false ? R.half_against : R.half_for) ?? ""}"> – <input id="h2" type="number" min="0" style="width:52px;padding:4px;font-size:14px;text-align:center" value="${(e.home === false ? R.half_for : R.half_against) ?? ""}"></div></div>
      <div class="side-t"><b>${e.home === false ? esc(e.report?.squad ? "OGV " + e.report.squad : S.team.name) : esc(e.opponent || "Tegenstander")}</b><small>${e.home === false ? "OGV" : "Bezoekers"}</small></div></div>
    ${R.goals.length && (gf !== (e.score_for ?? gf) || ga !== (e.score_against ?? ga)) ? `<p class="hint" style="color:var(--warn);text-align:center">Let op: de doelpunten hieronder (${gf}-${ga}) komen niet overeen met de uitslag. <button class="link" type="button" id="fixsc">Uitslag gelijkzetten</button></p>` : ""}
    ${matchPlayersPanel(e)}
    <div class="grid2 sec">
      <div class="panel"><h2>Wedstrijdgegevens</h2><div class="fields">
        <label class="f">Soort<select data-r="kind">${["","Competitie","Beker","Vriendschappelijk","Tornooi"].map(x => `<option${(R.kind || "") === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>
        <label class="f">Formatie<input data-r="formation" list="forms" value="${esc(R.formation || "")}" placeholder="bv. 1-3-3-1"><datalist id="forms">${["1-2-1-1","1-1-2-1","1-3-3-1","1-3-2-2","1-2-3-2","1-4-3-3","1-4-4-2","1-4-2-3-1"].map(x => `<option value="${x}">`).join("")}</datalist></label>
        <label class="f">Veld<select data-r="pitch">${["","Kunstgras","Natuurgras","Zaal"].map(x => `<option${(R.pitch || "") === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>
        <label class="f">Weer<select data-r="weather">${["","Droog","Zon","Regen","Wind","Koud","Warm"].map(x => `<option${(R.weather || "") === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>
        <label class="f">Man van de match<select id="motm">${opt(R.motm)}</select></label>
        <label class="f">Ploegcijfer (op 10)<select data-r="team_rating" data-num>${["", 1,2,3,4,5,6,7,8,9,10].map(x => `<option${String(R.team_rating ?? "") === String(x) ? " selected" : ""}>${x}</option>`).join("")}</select></label></div></div>
      <div class="panel"><div class="row" style="margin-bottom:8px"><h2 style="margin:0;margin-right:auto">Doelpunten</h2><button class="btn small noprint" type="button" data-add="for">${IC.plus}Goal OGV</button><button class="btn ghost small noprint" type="button" data-add="against">Tegengoal</button></div>
        ${R.goals.length ? `<div class="goals">${R.goals.map((g, i) => `<div class="g"><input type="number" min="0" max="130" value="${g.min ?? ""}" data-gm="${i}" aria-label="Minuut" placeholder="min'">
          ${g.side === "for" ? `<span class="pill w">OGV</span><select data-gp="${i}" aria-label="Doelpuntenmaker">${opt(g.player_id)}</select><select data-ga="${i}" class="wide" aria-label="Assist"><option value="">Geen assist</option>${present.map(p => `<option value="${p.id}"${g.assist_id === p.id ? " selected" : ""}>Assist ${esc(pname(p))}</option>`).join("")}</select>`
           : `<span class="pill loss">Tegen</span><span class="muted" style="grid-column:span 2">Tegendoelpunt</span>`}
          <select data-gt="${i}" aria-label="Soort">${["Open spel","Counter","Stilstaande fase","Penalty","Eigen doelpunt"].map(x => `<option${g.type === x ? " selected" : ""}>${x}</option>`).join("")}</select>
          <button class="link noprint" type="button" data-gx="${i}" aria-label="Verwijderen">✕</button></div>`).join("")}</div>` : `<p class="hint">Nog geen doelpunten. Bij live coachen komen ze hier vanzelf.</p>`}</div></div>
    <div class="grid2 sec">
      <div class="panel"><h2>Analyse</h2><div class="fields">
        <label class="f full">Wat ging goed?<textarea data-r="good">${esc(R.good || e.report_good || "")}</textarea></label>
        <label class="f full">Wat kan beter?<textarea data-r="better">${esc(R.better || e.report_better || "")}</textarea></label></div></div>
      <div class="panel"><h2>Tegenstander en vervolg</h2><div class="fields">
        <label class="f full">Tegenstander: sterktes en zwaktes<textarea data-r="opponent">${esc(R.opponent || "")}</textarea></label>
        <label class="f full">Actiepunten voor de training<textarea data-r="actions" placeholder="bv. Woensdag 3B omschakeling B+ naar B- trainen">${esc(R.actions || "")}</textarea></label>
        <label class="f full">Notities<textarea data-r="notes">${esc(R.notes || e.report_notes || "")}</textarea></label></div></div></div>
    ${R.live_log ? `<div class="sec panel"><h2>Notities uit live coachen</h2><p style="white-space:pre-wrap;margin:0">${esc(R.live_log)}</p></div>` : ""}`;
    const setScore = () => { const a = $("#s1").value, b = $("#s2").value; const [f, g] = e.home === false ? [b, a] : [a, b]; e.score_for = f === "" ? null : +f; e.score_against = g === "" ? null : +g; sv(); };
    $("#s1").oninput = setScore; $("#s2").oninput = setScore;
    const setHalf = () => { const a = $("#h1").value, b = $("#h2").value; const [f, g] = e.home === false ? [b, a] : [a, b]; R.half_for = f === "" ? null : +f; R.half_against = g === "" ? null : +g; sv(); };
    $("#h1").oninput = setHalf; $("#h2").oninput = setHalf;
    $$("[data-r]", tv).forEach(x => x.oninput = x.onchange = () => { R[x.dataset.r] = x.hasAttribute("data-num") ? (x.value === "" ? null : +x.value) : x.value; sv(); });
    $("#motm").onchange = ev => { R.motm = ev.target.value || null; R.motm_name = R.motm ? pname(ps.find(p => p.id === R.motm)) : ""; sv(); };
    $$("[data-add]", tv).forEach(b => b.onclick = () => { R.goals.push({ id: uid(), side: b.dataset.add, min: null, type: "Open spel" }); syncGoalStats(e); sv(); draw(); });
    $$("[data-gx]", tv).forEach(b => b.onclick = () => { R.goals.splice(+b.dataset.gx, 1); syncGoalStats(e); sv(); draw(); });
    $$("[data-gm]", tv).forEach(x => x.onchange = () => { R.goals[+x.dataset.gm].min = x.value === "" ? null : +x.value; R.goals.sort((a, b) => (a.min ?? 999) - (b.min ?? 999)); sv(); draw(); });
    $$("[data-gt]", tv).forEach(x => x.onchange = () => { R.goals[+x.dataset.gt].type = x.value; sv(); });
    $$("[data-gp]", tv).forEach(x => x.onchange = () => { const g = R.goals[+x.dataset.gp]; g.player_id = x.value || null; g.name = g.player_id ? pname(ps.find(p => p.id === g.player_id)) : ""; syncGoalStats(e); sv(); });
    $$("[data-ga]", tv).forEach(x => x.onchange = () => { const g = R.goals[+x.dataset.ga]; g.assist_id = x.value || null; g.assist_name = g.assist_id ? pname(ps.find(p => p.id === g.assist_id)) : ""; syncGoalStats(e); sv(); });
    const fx = $("#fixsc"); if (fx) fx.onclick = () => { e.score_for = R.goals.filter(g => g.side === "for").length; e.score_against = R.goals.filter(g => g.side === "against").length; sv(); draw(); };
  };
  draw();
}
/* overzicht van cijfer, minuten en commentaar per speler, bovenaan het verslag */
const isCaptain = (e, p, a) => e.report?.captain === p.id || (a?.strengths || []).includes("Kapitein");
function matchPlayersPanel(e) {
  const rows = active().map(p => ({ p, a: attOf(e.id, p.id) })).filter(x => x.a && (x.a.status === "aanwezig" || x.a.status === "te laat"));
  if (!rows.length) return "";
  const rated = rows.filter(x => x.a.rating), av = rated.length ? rated.reduce((s, x) => s + x.a.rating, 0) / rated.length : null;
  rows.sort((x, y) => (y.a.rating || 0) - (x.a.rating || 0) || pname(x.p).localeCompare(pname(y.p)));
  return `<div class="sec panel mplayers"><div class="row" style="margin-bottom:6px"><h2 style="margin:0;margin-right:auto">Spelers</h2><span class="hint">${rows.length} gespeeld${av != null ? " · gemiddeld cijfer " + f1(av) : ""}</span><a class="btn ghost small noprint" href="#/activiteit/${e.id}/spelers">${IC.pen}Beoordelen</a></div>
    ${rows.map(({ p, a }) => `<div class="mp"><span class="rate${a.rating ? " on" : ""}" style="${a.rating ? `--rc:${a.rating >= 8 ? "#34D17A" : a.rating >= 6 ? "#A3D63B" : a.rating >= 5 ? "#FFD100" : "#F2615A"}` : ""}">${a.rating ?? "–"}</span>
      <div class="mpb"><div class="mph"><b>${esc(pname(p))}</b>${isCaptain(e, p, a) ? '<span class="pill w">Kapitein</span>' : ""}${e.report?.motm === p.id ? '<span class="pill w">Man van de match</span>' : ""}<small class="muted">${esc([a.role, a.minutes != null ? a.minutes + " min" : "", a.goals ? a.goals + " goal" : ""].filter(Boolean).join(" · "))}</small></div>
      ${a.note ? `<p>${esc(a.note).replace(/\n/g, "<br>")}</p>` : `<p class="hint">Nog geen commentaar.</p>`}</div></div>`).join("")}</div>`;
}
/* doelpunten en assists uit de lijst overnemen bij de spelers */
async function syncGoalStats(e) {
  const R = e.report, cnt = (k) => { const m = {}; R.goals.forEach(g => { if (g.side === "for" && g[k]) m[g[k]] = (m[g[k]] || 0) + 1; }); return m; };
  const G = cnt("player_id"), A = cnt("assist_id");
  for (const p of active()) { const a = attOf(e.id, p.id); const g = G[p.id] || 0, as = A[p.id] || 0;
    if (!a && !g && !as) continue; const row = { ...(a || { event_id: e.id, player_id: p.id, team_id: S.team.id, status: "aanwezig", tags: [], strengths: [], scores: {} }) };
    if ((row.goals || 0) !== g || (row.assists || 0) !== as) { row.goals = g || null; row.assists = as || null; await safe(() => putAtt(row)); } }
}
function playersTab(tv, e) {
  const ps = active().filter(p => { const a = attOf(e.id, p.id); return !a || a.status === "aanwezig" || a.status === "te laat"; });
  const absent = active().filter(p => !ps.includes(p));
  const card = p => { const a = attOf(e.id, p.id) || {};
    return `<details class="pcard" data-p="${p.id}"><summary><span class="num">${p.number ?? ""}</span><span style="flex:1;min-width:0"><b style="display:block">${esc(pname(p))}${e.report.motm === p.id ? ' <span class="pill w">Man van de match</span>' : ""}${isCaptain(e, p, a) ? ' <span class="pill w">Kapitein</span>' : ""}</b>
      ${a.note ? `<span class="notepv">${esc(a.note)}</span>` : ""}<small class="muted">${esc([a.role, a.position, a.minutes != null ? a.minutes + " min" : "", a.goals ? a.goals + " goal" : "", a.assists ? a.assists + " assist" : ""].filter(Boolean).join(" · ") || "Nog niet beoordeeld")}</small></span>
      <span class="rate${a.rating ? " on" : ""}">${a.rating ?? "–"}</span></summary>
    <div class="bd"><div class="stats">
      <label class="f">Rol<select data-k="role"><option value="">–</option><option${a.role === "basis" ? " selected" : ""}>basis</option><option${a.role === "wissel" ? " selected" : ""}>wissel</option></select></label>
      <label class="f">Positie<input data-k="position" value="${esc(a.position || "")}" placeholder="bv. LV"></label>
      <label class="f">Minuten<input data-k="minutes" data-n type="number" min="0" inputmode="numeric" value="${a.minutes ?? ""}"></label>
      <label class="f">Goals<input data-k="goals" data-n type="number" min="0" inputmode="numeric" value="${a.goals ?? ""}"></label>
      <label class="f">Assists<input data-k="assists" data-n type="number" min="0" inputmode="numeric" value="${a.assists ?? ""}"></label></div>
      <div><span class="muted" style="font-size:13.5px;font-weight:600">Cijfer op 10</span><div class="scale" style="margin-top:6px">${[1,2,3,4,5,6,7,8,9,10].map(n => `<button type="button" data-rate="${n}" aria-pressed="${a.rating === n}">${n}</button>`).join("")}</div></div>
      <div><span class="muted" style="font-size:13.5px;font-weight:600">Sterke punten</span><div class="chips" style="margin-top:6px">${STRENGTHS.map(t => `<button type="button" class="tag good" data-str="${esc(t)}" aria-pressed="${(a.strengths || []).includes(t)}">${esc(t)}</button>`).join("")}</div></div>
      <div><span class="muted" style="font-size:13.5px;font-weight:600">Werkpunten</span><div class="chips" style="margin-top:6px">${(S.team.worktags || DEF_TAGS).map(t => `<button type="button" class="tag" data-tag="${esc(t)}" aria-pressed="${(a.tags || []).includes(t)}">${esc(t)}</button>`).join("")}</div></div>
      <label class="f">Notities over deze speler<textarea data-k="note" placeholder="Wat viel op? Wat bespreek je met hem of haar?">${esc(a.note || "")}</textarea></label></div></details>`; };
  tv.innerHTML = `<p class="muted" style="margin:0 0 14px">Open een speler om hem te beoordelen: cijfer, de vier pijlers, sterke punten, werkpunten en notities. Alles wordt meteen bewaard.</p>
    ${ps.length ? `<div style="display:flex;flex-direction:column;gap:10px">${ps.map(card).join("")}</div>` : `<div class="empty"><b>Geen spelers in de selectie</b>Vul eerst de selectie in.</div>`}
    ${absent.length ? `<p class="hint" style="margin-top:14px">Niet in de selectie: ${absent.map(p => esc(pname(p))).join(", ")}.</p>` : ""}`;
  $$(".pcard", tv).forEach(c => {
    const pid = c.dataset.p, get = () => ({ ...(attOf(e.id, pid) || { event_id: e.id, player_id: pid, team_id: S.team.id, status: "aanwezig", tags: [], strengths: [], scores: {} }) });
    const refresh = () => { const a = attOf(e.id, pid) || {}; $("summary small", c).textContent = [a.role, a.position, a.minutes != null ? a.minutes + " min" : "", a.goals ? a.goals + " goal" : "", a.assists ? a.assists + " assist" : ""].filter(Boolean).join(" · ") || "Nog niet beoordeeld";
      const rt = $(".rate", c); rt.textContent = a.rating ?? "–"; rt.classList.toggle("on", !!a.rating); };
    /* elke wijziging meteen lokaal bewaren, zodat snelle opeenvolgende tikken elkaar niet overschrijven */
    const local = a => { if (a.status !== "aanwezig" && a.status !== "te laat") a.status = "aanwezig"; S.att = S.att.filter(z => !(z.event_id === e.id && z.player_id === pid)).concat([a]); refresh(); };
    const save = debounce(() => safe(() => putAtt({ ...attOf(e.id, pid) })), 500);
    $$("[data-k]", c).forEach(x => x.oninput = x.onchange = () => { const a = get(); a[x.dataset.k] = x.hasAttribute("data-n") ? (x.value === "" ? null : +x.value) : (x.value || null); local(a); save(); });
    $$("[data-rate]", c).forEach(b => b.onclick = () => { const a = get(); a.rating = a.rating === +b.dataset.rate ? null : +b.dataset.rate; $$("[data-rate]", c).forEach(x => x.setAttribute("aria-pressed", +x.dataset.rate === a.rating)); local(a); save(); });
    const tog = (attr, field) => $$(`[${attr}]`, c).forEach(b => b.onclick = () => { const a = get(), t = b.getAttribute(attr); a[field] = (a[field] || []).includes(t) ? a[field].filter(x => x !== t) : [...(a[field] || []), t]; b.setAttribute("aria-pressed", a[field].includes(t)); local(a); save(); });
    tog("data-str", "strengths"); tog("data-tag", "tags");
  });
}
function momentsTab(tv, e) {
  const R = e.report, sv = saver(e); R.moments = R.moments || {};
  tv.innerHTML = `<p class="muted" style="margin:0 0 14px">Hoe speelde de ploeg in elk hoofdmoment van het opleidingsplan? Score van 1 (zwak) tot 5 (sterk), met een korte toelichting.</p>
  <div class="moments">${Object.entries(PRINC).map(([k, l]) => { const m = R.moments[k] || {};
    return `<div class="moment"><div class="h"><span class="code">${k}</span><b>${l}</b></div><div class="scale five">${[1,2,3,4,5].map(n => `<button type="button" data-m="${k}" data-v="${n}" aria-pressed="${m.score === n}">${n}</button>`).join("")}</div>
    <textarea data-mn="${k}" placeholder="Wat zag je?">${esc(m.note || "")}</textarea></div>`; }).join("")}</div>`;
  $$("[data-m]", tv).forEach(b => b.onclick = () => { const k = b.dataset.m, n = +b.dataset.v; R.moments[k] = R.moments[k] || {}; R.moments[k].score = R.moments[k].score === n ? null : n;
    $$(`[data-m="${k}"]`, tv).forEach(x => x.setAttribute("aria-pressed", +x.dataset.v === R.moments[k].score)); sv(); });
  $$("[data-mn]", tv).forEach(x => x.oninput = () => { const k = x.dataset.mn; R.moments[k] = R.moments[k] || {}; R.moments[k].note = x.value; sv(); });
}

/* ---------- opstelling per kwart ---------- */
const POSLIST = { "2v2": ["A","B"], "3v3": ["L","M","R"], "5v5": ["1","3","7","11","9"], "8v8": ["1","2","3","5","7","8","11","9"], "11v11": ["1","2","3","4","5","6","8","10","7","9","11"] };
/* oude posities (letters) uit eerdere opstellingen omzetten naar nummers */
const POS_OLD = { "5v5": { K: "1", LV: "3", RV: "7", M: "11", SP: "9" }, "8v8": { K: "1", LB: "5", CV: "3", RB: "2", LM: "11", CM: "8", RM: "7", SP: "9" },
  "11v11": { K: "1", RB: "2", RCV: "3", LCV: "4", LB: "5", RW: "7", SP: "9", LW: "11" } };
function lineupTab(tv, e) {
  const mf = matchFormat(S.team), pos = POSLIST[S.team.format] || POSLIST["5v5"];
  e.lineup = e.lineup && e.lineup.grid ? e.lineup : { periods: mf.periods, minutes: mf.minutes, grid: {} };
  const L = e.lineup, sv = saver(e), om = POS_OLD[S.team.format] || {};
  for (const id in L.grid) L.grid[id] = (L.grid[id] || []).map(x => om[x] || x);
  const ps = active().filter(p => { const a = attOf(e.id, p.id); return !a || a.status === "aanwezig" || a.status === "te laat"; });
  const draw = () => {
    const n = L.periods, half = n * L.minutes / 2;
    const issues = []; for (let k = 0; k < n; k++) { const used = ps.map(p => (L.grid[p.id] || [])[k]).filter(Boolean); const dup = used.filter((x, i) => used.indexOf(x) !== i); const miss = pos.filter(x => !used.includes(x));
      if (dup.length) issues.push(`Kwart ${k + 1}: ${[...new Set(dup)].join(", ")} dubbel`); if (miss.length) issues.push(`Kwart ${k + 1}: ${miss.join(", ")} niet ingevuld`); }
    tv.innerHTML = `<div class="row noprint" style="margin-bottom:12px"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Periodes<input type="number" id="lp" min="1" max="8" value="${n}" style="width:70px"></label>
      <label class="f" style="flex-direction:row;align-items:center;gap:8px">Minuten<input type="number" id="lm" min="5" max="60" value="${L.minutes}" style="width:70px"></label><span class="spacer"></span>
      <button class="btn ghost small" type="button" id="auto">Eerlijk verdelen</button><button class="btn ghost small" type="button" id="clear">Leegmaken</button></div>
      <div class="panel wrapx" style="padding:6px 10px"><table class="tbl lineup"><thead><tr><th>Speler</th>${Array.from({ length: n }, (_, k) => `<th>Kwart ${k + 1}</th>`).join("")}<th>Speeltijd</th></tr></thead><tbody>
      ${ps.map(p => { const row = L.grid[p.id] || [], played = row.filter(Boolean).length * L.minutes;
        return `<tr><td>${esc(pname(p))}</td>${Array.from({ length: n }, (_, k) => `<td><select data-c="${p.id}:${k}" aria-label="${esc(pname(p))} kwart ${k + 1}"><option value="">Bank</option>${pos.map(x => `<option value="${x}"${row[k] === x ? " selected" : ""}>${x}${posLabel(x) ? " · " + posLabel(x).split(" · ")[1].toLowerCase() : ""}</option>`).join("")}</select></td>`).join("")}
        <td class="${played < half ? "warn" : ""}">${played} min</td></tr>`; }).join("")}</tbody></table></div>
      ${issues.length ? `<p class="hint" style="color:var(--warn)">${issues.map(esc).join(" · ")}</p>` : ps.length ? `<p class="hint" style="color:var(--ok)">Elke positie is in elk kwart ingevuld.</p>` : ""}
      <p class="hint">Oranje speeltijd = minder dan de helft van de wedstrijd. Bij live coachen start kwart 1 automatisch als basisopstelling.</p>`;
    $("#lp").onchange = ev => { L.periods = Math.max(1, +ev.target.value || 1); sv(); draw(); }; $("#lm").onchange = ev => { L.minutes = +ev.target.value || L.minutes; sv(); draw(); };
    $$("[data-c]", tv).forEach(s => s.onchange = () => { const [pid, k] = s.dataset.c.split(":"); L.grid[pid] = L.grid[pid] || []; L.grid[pid][+k] = s.value || null; sv(); draw(); });
    $("#clear").onclick = () => { L.grid = {}; sv(); draw(); };
    $("#auto").onclick = () => { /* elke speler evenveel kwarten op het veld, posities roteren */
      L.grid = {}; const order = ps.slice(); let off = 0;
      for (let k = 0; k < L.periods; k++) { const on = []; for (let j = 0; j < Math.min(pos.length, order.length); j++) on.push(order[(off + j) % order.length]); off = (off + pos.length) % Math.max(order.length, 1);
        const keeper = on.find(isKeeper) || null; const rest = on.filter(p => p !== keeper); const slots = pos.slice();
        if (keeper && slots[0] === "1") { (L.grid[keeper.id] = L.grid[keeper.id] || [])[k] = slots.shift(); }
        rest.forEach((p, j) => (L.grid[p.id] = L.grid[p.id] || [])[k] = slots[(j + k) % slots.length]); }
      sv(); draw(); toast("Speeltijd eerlijk verdeeld. Pas aan waar nodig."); };
  };
  draw();
}

/* ============ live coachen (vervangt Coach Mic) ============ */
route("live", { title: "Live coachen", auth: true, team: true, render: (v, id) => {
  if (!id) { const t = todayIso(), up = S.events.filter(e => e.type === "wedstrijd" && e.date >= addDaysIso(-1)).slice(0, 6), pastM = [...past("wedstrijd")].reverse().slice(0, 4);
    v.innerHTML = head("Live coachen", "Kies de wedstrijd. Tijdens de match houd je klok, doelpunten en wissels bij, met de knoppen of met je stem. Speeltijd per speler wordt vanzelf berekend.") +
      (up.length ? `<div class="list">${up.map(e => `<div class="item" data-go="#/live/${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span><span class="main"><b>${matchTitle(e, "OGV")}</b><small>${dShort(e.date)}${e.start_time ? " · " + tm(e.start_time) : ""}${e.live?.log?.length ? " · bezig of gespeeld" : ""}</small></span>${IC.mic}</div>`).join("")}</div>`
       : `<div class="empty"><b>Geen wedstrijd gepland</b>Zet je wedstrijd eerst in de kalender.<br><a class="btn" href="#/kalender">Naar de kalender</a></div>`) +
      (pastM.length ? `<div class="sec"><h2>Gespeeld</h2><div class="list">${pastM.map(e => `<div class="item" data-go="#/live/${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span><span class="main"><b>${matchTitle(e, "OGV")}</b><small>${e.score_for != null ? e.score_for + " - " + e.score_against : ""}</small></span>${IC.chev}</div>`).join("")}</div></div>` : "");
    $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go)); return; }
  const e = S.events.find(x => x.id === id); if (!e) { v.innerHTML = `<div class="empty"><b>Wedstrijd niet gevonden</b><a class="btn" href="#/live">Terug</a></div>`; return; }
  return liveView(v, e);
} });
const addDaysIso = n => iso(addDays(new Date(), n));
function liveSave(e) { try { localStorage.setItem("ogv-live-" + e.id, JSON.stringify(e.live)); } catch (x) {} }
const liveSaveRemote = debounce(e => safe(() => putEvent(e)), 900);

/* Alles wordt herberekend uit het logboek: start/pauze/hervat/einde met echte tijdstippen,
   zodat de klok klopt na herladen of als de gsm vergrendeld was. */
function replay(L, now = Date.now()) {
  let period = 0, running = false, segStart = null, before = 0, cur = 0, ended = false, inPeriod = false;
  const on = new Set(L.start), stints = {}; L.start.forEach(p => stints[p] = [[0, null]]);
  const gf = [], ga = [], rows = [];
  const sec = ts => before + cur + (running ? (ts - segStart) / 1000 : 0);
  for (const ev of L.log) {
    const s = sec(ev.ts);
    if (ev.type === "start") { period = ev.period; cur = 0; running = true; segStart = ev.ts; inPeriod = true; }
    else if (ev.type === "pause" && running) { cur += (ev.ts - segStart) / 1000; running = false; }
    else if (ev.type === "resume" && inPeriod && !running) { running = true; segStart = ev.ts; }
    else if (ev.type === "adjust" && inPeriod) { const run = running ? (ev.ts - segStart) / 1000 : 0; cur = Math.max(-run, cur + (ev.d || 0)); continue; } /* klok bijgesteld */
    else if (ev.type === "end") { if (running) cur += (ev.ts - segStart) / 1000; running = false; before += cur; cur = 0; inPeriod = false; if (period >= L.periods) ended = true; }
    else if (ev.type === "sub") { if (ev.out && on.has(ev.out)) { on.delete(ev.out); const st = stints[ev.out]; if (st && st.length) st[st.length - 1][1] = s; }
      if (ev.in && !on.has(ev.in)) { on.add(ev.in); (stints[ev.in] = stints[ev.in] || []).push([s, null]); } }
    else if (ev.type === "goal") gf.push({ ...ev, s }); else if (ev.type === "against") ga.push({ ...ev, s });
    rows.push({ ...ev, s, period: ev.type === "start" ? ev.period : period });
  }
  const nowS = sec(now), play = {};
  for (const [p, st] of Object.entries(stints)) play[p] = st.reduce((t, [a, b]) => t + ((b ?? nowS) - a), 0);
  return { period, running, inPeriod, ended, nowS, perS: cur + (running ? (now - segStart) / 1000 : 0), on: [...on], play, gf, ga, rows };
}
const mmss = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
function liveView(v, e) {
  const team = S.team, mf = matchFormat(team), squad = active().filter(p => { const a = attOf(e.id, p.id); return !a || a.status === "aanwezig" || a.status === "te laat"; });
  try { const loc = JSON.parse(localStorage.getItem("ogv-live-" + e.id) || "null"); if (loc && (!e.live || (loc.log?.length || 0) > (e.live.log?.length || 0))) e.live = loc; } catch (x) {}
  const nOn = (POSLIST[team.format] || POSLIST["5v5"]).length;
  if (!e.live || !e.live.start) {
    const fromLineup = e.lineup?.grid ? squad.filter(p => (e.lineup.grid[p.id] || [])[0]).map(p => p.id) : [];
    let sel = new Set(fromLineup.length ? fromLineup : squad.slice(0, nOn).map(p => p.id));
    const draw = () => { v.innerHTML = backLink("#/activiteit/" + e.id, "Wedstrijd") + head("Live: " + matchTitle(e, "OGV"), cap(dLong(e.date))) +
      `<div class="panel"><h2>Wedstrijdduur</h2><div class="row"><label class="f" style="width:120px">Periodes<input type="number" id="pp" min="1" max="8" value="${mf.periods}"></label><label class="f" style="width:150px">Minuten per periode<input type="number" id="pm" min="1" max="60" value="${mf.minutes}"></label></div></div>
      <div class="panel"><div class="row"><h2 style="margin:0;margin-right:auto">Basisspelers</h2><span class="muted">${sel.size} gekozen${nOn ? " · " + nOn + " op het veld" : ""}</span></div>
        <p class="hint">Tik op de spelers die beginnen.${fromLineup.length ? " Overgenomen uit kwart 1 van de opstelling." : ""}</p>
        <div class="field">${squad.map(p => `<button type="button" data-p="${p.id}" aria-pressed="${sel.has(p.id)}"><span class="n">${p.number ?? ""}</span>${esc(p.first_name)}</button>`).join("")}</div></div>
      <button class="btn" type="button" id="go" style="width:100%;padding:16px;font-size:17px;margin-top:14px">${IC.play}Wedstrijd starten</button>`;
      $$("[data-p]", v).forEach(b => b.onclick = () => { sel.has(b.dataset.p) ? sel.delete(b.dataset.p) : sel.add(b.dataset.p); draw(); });
      $("#go").onclick = () => { e.live = { periods: +$("#pp").value || mf.periods, minutes: +$("#pm").value || mf.minutes, start: [...sel], log: [{ id: uid(), ts: Date.now(), type: "start", period: 1 }] };
        liveSave(e); liveSaveRemote(e); liveView(v, e); }; };
    draw(); return;
  }
  const L = e.live, byId = id => S.players.find(p => p.id === id), nm = id => byId(id)?.first_name || "?";
  const push = ev => { L.log.push({ id: uid(), ts: Date.now(), ...ev }); liveSave(e); liveSaveRemote(e); paint(); };
  /* klok bijstellen zonder iets te wissen: bv. te vroeg of te laat op start gedrukt */
  const clockAdjust = () => { const R0 = replay(L); let t = Math.floor(R0.perS);
    const d = dialog(`<div class="dlg"><h2>Klok aanpassen</h2><p class="muted" style="margin-top:0">Zet de klok van ${L.periods === 4 ? "dit kwart" : "deze periode"} juist. Goals, wissels en notities blijven staan; de speeltijd rekent mee.</p>
      <div class="clkset"><button type="button" class="btn ghost" data-d="-60">−1 min</button><button type="button" class="btn ghost" data-d="-10">−10 s</button><b id="clkv">${mmss(t)}</b><button type="button" class="btn ghost" data-d="10">+10 s</button><button type="button" class="btn ghost" data-d="60">+1 min</button></div>
      <div class="row" style="justify-content:center;margin-top:8px"><button class="link" type="button" id="clk0">Terug op 0:00</button></div>
      <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" type="button" id="clkok">Opslaan</button></div></div>`);
    const show = () => $("#clkv", d).textContent = mmss(t);
    $$("[data-d]", d).forEach(b => b.onclick = () => { t = Math.max(0, t + +b.dataset.d); show(); });
    $("#clk0", d).onclick = () => { t = 0; show(); };
    $("#clkok", d).onclick = () => { const now = replay(L).perS, delta = Math.round(t - now); d.close(); if (Math.abs(delta) < 1) return; push({ type: "adjust", d: delta }); toast("Klok aangepast."); }; };
  /* per ongeluk gestart of opnieuw beginnen: terug naar het kiezen van de basisspelers, het logboek wordt gewist */
  const liveReset = fromUndo => { const n = L.log.filter(x => x.type !== "start" || x.period > 1).length;
    const d = dialog(`<div class="dlg"><h2>${fromUndo ? "Start ongedaan maken?" : "Opnieuw beginnen?"}</h2>
      <p class="muted" style="margin-top:0">De klok gaat terug naar 0 en je kiest opnieuw de basisspelers.${n ? ` <b style="color:var(--ink)">${n} genoteerde ${n === 1 ? "actie wordt" : "acties worden"} gewist</b> (goals, wissels, notities).` : " Er is nog niets genoteerd."}</p>
      <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" type="button" id="rsok">${fromUndo ? "Ja, ongedaan maken" : "Ja, opnieuw beginnen"}</button></div></div>`);
    $("#rsok", d).onclick = () => { d.close(); micStop(); e.live = null; try { localStorage.removeItem("ogv-live-" + e.id); } catch (x) {} liveSaveRemote(e); toast("Live coachen staat terug op het begin."); liveView(v, e); }; };
  let pickMode = null, pickData = {};
  const paint = () => {
    const R = replay(L), bench = squad.filter(p => !R.on.includes(p.id)).map(p => p.id);
    const minute = Math.floor(R.nowS / 60) + 1, perLabel = L.periods === 2 ? (R.period === 1 ? "Eerste helft" : "Tweede helft") : (L.periods === 4 ? "Kwart " : "Periode ") + R.period;
    const over = R.inPeriod && R.perS >= L.minutes * 60;
    v.innerHTML = `<div class="live">${backLink("#/activiteit/" + e.id, "Wedstrijdverslag")}
    <div class="clock"><span class="per">${R.ended ? "Wedstrijd afgelopen" : R.inPeriod ? perLabel + (R.running ? "" : " · gepauzeerd") : "Rust · " + (R.period ? "na " + perLabel.toLowerCase() : "")}</span>
      <span class="time${R.running ? " run" : ""}" id="clk">${mmss(R.perS)}</span><span class="per">${over ? '<span style="color:var(--warn)">Tijd is om</span>' : `van ${L.minutes}:00 · minuut ${minute}`}</span>
      <span class="sc">${esc(team.name.split(" ")[0])} ${R.gf.length} – ${R.ga.length} ${esc(e.opponent || "")}</span>${R.inPeriod ? `<button class="clkadj" type="button" data-a="adjust">${IC.clock || IC.cal}Klok aanpassen</button>` : ""}</div>
    ${pickMode ? pickPanel(R, bench) : `<div class="lbtns">
      <button type="button" class="y" data-a="goal">${IC.ball}Goal OGV</button><button type="button" class="r" data-a="against">${IC.ball}Tegengoal</button>
      <button type="button" data-a="sub">${IC.swap}Wissel</button><button type="button" data-a="note">${IC.note}Notitie</button>
      ${R.ended ? "" : R.inPeriod ? `<button type="button" data-a="${R.running ? "pause" : "resume"}">${R.running ? IC.pause + "Pauze" : IC.play + "Hervat"}</button><button type="button" data-a="end">${IC.flag}${R.period >= L.periods ? "Einde wedstrijd" : "Einde " + (L.periods === 4 ? "kwart" : "periode")}</button>`
        : `<button type="button" class="y" data-a="next">${IC.play}Start ${L.periods === 4 ? "kwart" : "periode"} ${R.period + 1}</button>`}
      <button type="button" data-a="chance">${IC.star}Kans</button><button type="button" data-a="undo">${IC.undo}Ongedaan</button></div>
    ${"webkitSpeechRecognition" in window || "SpeechRecognition" in window ? `<div class="microw"><button class="mic" type="button" id="mic">${IC.mic}<span>Houd ingedrukt en spreek</span></button><button class="micset" type="button" id="micset" title="Microfoon en handsfree" aria-label="Microfoon en handsfree instellen">${IC.gear}</button></div><p class="hint" id="micinfo" style="text-align:center;margin:6px 0 0"></p><p class="hint" style="text-align:center;margin:4px 0 0">Bijvoorbeeld: "goal Lio assist Mats", "tegendoelpunt", "wissel Odin eruit Remi erin", "pauze timer", "einde kwart".</p>` : ""}`}
    ${R.ended ? `<button class="btn" type="button" id="finish" style="width:100%;padding:16px;margin-top:14px">${IC.check}Verwerken in het wedstrijdverslag</button>` : ""}
    <div class="sec"><h2>Op het veld</h2><div class="field">${R.on.map(id => `<button type="button" class="on" disabled><span class="n">${byId(id)?.number ?? ""}</span>${esc(nm(id))}<em>${Math.round((R.play[id] || 0) / 60)}'</em></button>`).join("")}</div>
      <h2 style="margin-top:16px">Bank</h2><div class="field">${bench.map(id => `<button type="button" disabled><span class="n">${byId(id)?.number ?? ""}</span>${esc(nm(id))}<em>${Math.round((R.play[id] || 0) / 60)}'</em></button>`).join("") || '<span class="muted">Niemand</span>'}</div></div>
    <div class="sec"><div class="row" style="margin-bottom:8px"><h2 style="margin:0;margin-right:auto">Verloop</h2><button class="link" type="button" data-a="reset">${IC.undo}Opnieuw beginnen</button></div><div class="list log">${R.rows.slice().reverse().filter(r => !["pause","resume","adjust"].includes(r.type)).map(r => `<div class="item static"><span class="num">${Math.floor(r.s / 60) + 1}'</span><span class="main"><b>${liveLabel(r, nm)}</b></span></div>`).join("") || '<p class="muted">Nog niets.</p>'}</div></div></div>`;
    bind(R, bench);
  };
  const pickPanel = (R, bench) => {
    const list = (ids, k) => `<div class="field">${ids.map(id => `<button type="button" data-pk="${k}" data-id="${id}" aria-pressed="${pickData[k] === id}"><span class="n">${byId(id)?.number ?? ""}</span>${esc(nm(id))}</button>`).join("")}</div>`;
    if (pickMode === "goal") return `<div class="panel" style="margin-top:14px"><h2>Wie scoorde?</h2>${list(R.on, "pid")}<h3 style="margin-top:14px">Assist</h3>${list(R.on.filter(i => i !== pickData.pid), "aid")}
      <div class="row" style="margin-top:14px"><button class="btn ghost" type="button" data-cancel>Annuleren</button><span class="spacer"></span><button class="btn" type="button" data-ok ${pickData.pid ? "" : "disabled"}>Goal opslaan</button></div></div>`;
    if (pickMode === "sub") return `<div class="panel" style="margin-top:14px"><h2>Wie gaat eruit?</h2>${list(R.on, "out")}<h3 style="margin-top:14px">Wie komt erin?</h3>${list(bench, "in")}
      <div class="row" style="margin-top:14px"><button class="btn ghost" type="button" data-cancel>Annuleren</button><span class="spacer"></span><button class="btn" type="button" data-ok ${pickData.out && pickData.in ? "" : "disabled"}>Wissel opslaan</button></div></div>`;
    if (pickMode === "note") return `<div class="panel" style="margin-top:14px"><h2>Notitie</h2><textarea id="nt" placeholder="Wat wil je onthouden?"></textarea>${list(squad.map(p => p.id), "pid")}
      <div class="row" style="margin-top:14px"><button class="btn ghost" type="button" data-cancel>Annuleren</button><span class="spacer"></span><button class="btn" type="button" data-ok>Notitie opslaan</button></div></div>`;
    return "";
  };
  const bind = (R) => {
    $$("[data-a]", v).forEach(b => b.onclick = () => { const a = b.dataset.a;
      if (a === "goal" || a === "sub" || a === "note") { pickMode = a; pickData = {}; paint(); }
      else if (a === "against") push({ type: "against" }); else if (a === "chance") push({ type: "chance" });
      else if (a === "pause" || a === "resume") push({ type: a }); else if (a === "end") push({ type: "end", period: R.period });
      else if (a === "next") push({ type: "start", period: R.period + 1 });
      else if (a === "undo") { const last = L.log[L.log.length - 1]; if (!last || (last.type === "start" && last.period === 1)) { liveReset(true); return; } L.log.pop(); liveSave(e); liveSaveRemote(e); toast("Laatste actie ongedaan gemaakt."); paint(); }
      else if (a === "reset") liveReset(false);
      else if (a === "adjust") clockAdjust(); });
    $$("[data-pk]", v).forEach(b => b.onclick = () => { const k = b.dataset.pk; pickData[k] = pickData[k] === b.dataset.id ? null : b.dataset.id; paint(); const nt = $("#nt"); if (nt && pickData._t) nt.value = pickData._t; });
    const nt = $("#nt"); if (nt) nt.oninput = () => pickData._t = nt.value;
    const c = $("[data-cancel]", v); if (c) c.onclick = () => { pickMode = null; paint(); };
    const ok = $("[data-ok]", v); if (ok) ok.onclick = () => { const m = pickMode; pickMode = null;
      if (m === "goal") push({ type: "goal", pid: pickData.pid, aid: pickData.aid || null });
      else if (m === "sub") push({ type: "sub", out: pickData.out, in: pickData.in });
      else if (m === "note") { const t = (pickData._t || "").trim(); if (t) push({ type: "note", text: t, pid: pickData.pid || null }); else paint(); } };
    const fin = $("#finish"); if (fin) fin.onclick = () => finishLive(e, squad);
    const mic = $("#mic"); if (mic) setupMic(mic, squad, cmd => { for (const c of cmd) push(c); });
  };
  paint();
  const tick = setInterval(() => { const el = $("#clk"); if (!el) return; const R = replay(L); el.textContent = mmss(R.perS); }, 500);
  let wake = null; try { navigator.wakeLock?.request("screen").then(w => wake = w).catch(() => {}); } catch (x) {}
  return () => { clearInterval(tick); micStop(); try { wake?.release(); } catch (x) {} };
}
function liveLabel(r, nm) {
  return ({ start: `Start ${r.period === 1 ? "wedstrijd" : "periode " + r.period}`, end: `Einde periode ${r.period}`,
    goal: `⚽ Goal ${esc(nm(r.pid))}${r.aid ? " (assist " + esc(nm(r.aid)) + ")" : ""}`, against: "Tegendoelpunt", chance: "Grote kans",
    sub: `Wissel: ${esc(nm(r.out))} eruit, ${esc(nm(r.in))} erin`, note: `Notitie${r.pid ? " (" + esc(nm(r.pid)) + ")" : ""}: ${esc(r.text)}` })[r.type] || esc(r.type);
}
async function finishLive(e, squad) {
  const L = e.live, R = replay(L), nm = id => pname(S.players.find(p => p.id === id));
  e.score_for = R.gf.length; e.score_against = R.ga.length;
  const halfS = (L.periods * L.minutes * 60) / 2;
  e.report = e.report || {};
  e.report.goals = [...R.gf.map(g => ({ id: g.id, side: "for", min: Math.floor(g.s / 60) + 1, player_id: g.pid, name: nm(g.pid), assist_id: g.aid, assist_name: g.aid ? nm(g.aid) : "", type: "Open spel" })),
    ...R.ga.map(g => ({ id: g.id, side: "against", min: Math.floor(g.s / 60) + 1, type: "Open spel" }))].sort((a, b) => a.min - b.min);
  e.report.half_for = R.gf.filter(g => g.s <= halfS).length; e.report.half_against = R.ga.filter(g => g.s <= halfS).length;
  const notes = R.rows.filter(r => r.type === "note").map(r => `${Math.floor(r.s / 60) + 1}' ${r.pid ? nm(r.pid) + ": " : ""}${r.text}`);
  if (notes.length) e.report.live_log = notes.join("\n");
  e.report.chances = R.rows.filter(r => r.type === "chance").length;
  await safe(async () => {
    await putEvent(e);
    for (const p of squad) { const played = R.play[p.id]; if (played == null) continue;
      const a = { ...(attOf(e.id, p.id) || { event_id: e.id, player_id: p.id, team_id: S.team.id, tags: [], strengths: [], scores: {} }), status: "aanwezig",
        role: L.start.includes(p.id) ? "basis" : "wissel", minutes: Math.round(played / 60), goals: R.gf.filter(g => g.pid === p.id).length || null, assists: R.gf.filter(g => g.aid === p.id).length || null };
      await putAtt(a); }
  }, "Uitslag, doelpunten en speeltijd staan in het verslag.");
  go("#/activiteit/" + e.id + "/spelers");
}
/* spraak: Nederlandse commando's, zoals in Coach Mic.
   Microfoon: standaard die van de gsm; een verbonden bluetooth-microfoon of oortjes kan je kiezen bij het tandwiel.
   Handsfree: de app luistert doorlopend en noteert elk herkend commando meteen (handig met een bluetooth-microfoon, gsm in je zak). */
const MIC = { rec: null, on: false, cont: false, stream: null, btn: null, squad: [], onCmd: null, txt: "" };
const micPref = () => { try { return JSON.parse(localStorage.getItem("ogv-mic") || "{}") || {}; } catch (x) { return {}; } };
const micSave = o => { try { localStorage.setItem("ogv-mic", JSON.stringify({ ...micPref(), ...o })); } catch (x) {} };
const isBT = l => /bluetooth|airpods|headset|hands-?free|buds|\bbt\b|draadloos|wireless|jabra|rode|dji|boya|hollyland/i.test(l || "");
const micTrackOK = () => !!(navigator.mediaDevices?.getUserMedia && navigator.userAgentData); /* Chrome/Edge: een gekozen microfoon doorgeven aan de spraakherkenning */
function micInfo() { const el = $("#micinfo"); if (!el) return; const p = micPref();
  el.innerHTML = `${IC.mic} ${esc(p.label || "Microfoon van je gsm")}${isBT(p.label) ? " · bluetooth" : ""}${p.handsfree ? " · <b>handsfree</b>" : ""}`; }
function micPaint(interim) { const b = MIC.btn; if (!b || !b.isConnected) return; const hf = !!micPref().handsfree;
  b.classList.toggle("on", MIC.on); b.classList.toggle("hf", hf);
  $("span", b).textContent = interim || (MIC.on ? (hf ? "Ik luister mee… tik om te stoppen" : "Ik luister…") : hf ? "Tik om handsfree te luisteren" : "Houd ingedrukt en spreek"); }
function micHandle(t) { t = (t || "").trim(); if (!t || !MIC.onCmd) return; const cmds = parseSpeech(t, MIC.squad);
  if (cmds.length) { MIC.onCmd(cmds); toast("Genoteerd: " + t); } else if (!MIC.cont) toast("Niet begrepen: " + t); }
function micStopStream() { try { MIC.stream?.getTracks().forEach(t => t.stop()); } catch (x) {} MIC.stream = null; }
async function micStart(cont) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR || MIC.rec) return;
  MIC.on = true; MIC.cont = cont; MIC.txt = ""; micPaint();
  const dev = micPref().device; let track = null;
  if (dev && micTrackOK()) { try { if (!MIC.stream) MIC.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: dev }, echoCancellation: true, noiseSuppression: true } }); track = MIC.stream.getAudioTracks()[0] || null; }
    catch (x) { toast("De gekozen microfoon is niet gevonden. Is hij nog verbonden? Ik gebruik de microfoon van je gsm."); } }
  if (!MIC.on) { micStopStream(); micPaint(); return; } /* intussen al losgelaten */
  const rec = new SR(); rec.lang = "nl-BE"; rec.interimResults = true; rec.continuous = true; MIC.rec = rec;
  rec.onresult = r => { let interim = "";
    for (let i = r.resultIndex; i < r.results.length; i++) { const x = r.results[i];
      if (x.isFinal) { if (MIC.cont) micHandle(x[0].transcript); else MIC.txt += " " + x[0].transcript; } else interim += x[0].transcript; }
    micPaint(((MIC.cont ? "" : MIC.txt) + " " + interim).trim() || null); };
  rec.onerror = x => { if (x.error === "no-speech" || x.error === "aborted") return;
    if (x.error === "not-allowed" || x.error === "service-not-allowed") { MIC.on = false; toast("Geef de app toegang tot je microfoon (instellingen van je browser)."); }
    else if (x.error === "audio-capture") { MIC.on = false; toast("Geen microfoon gevonden. Verbind je bluetooth-microfoon opnieuw of kies een andere bij het tandwiel."); }
    else if (x.error === "network") toast("Spraakherkenning heeft internet nodig."); else if (!MIC.cont) toast("Spraak niet herkend. Probeer opnieuw."); };
  rec.onend = () => { MIC.rec = null;
    if (MIC.cont && MIC.on) { setTimeout(() => { if (MIC.on && !MIC.rec) micStart(true); }, 250); return; } /* handsfree: meteen verder luisteren */
    MIC.on = false; micStopStream(); const t = MIC.txt; MIC.txt = ""; micPaint(); if (!MIC.cont) micHandle(t); };
  try { if (track) rec.start(track); else rec.start(); } catch (x) { try { rec.start(); } catch (y) { MIC.rec = null; MIC.on = false; micStopStream(); micPaint(); } }
}
function micStop() { MIC.on = false; if (MIC.rec) { try { MIC.rec.stop(); } catch (x) {} } else micStopStream(); micPaint(); }
function setupMic(btn, squad, onCmd) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
  MIC.btn = btn; MIC.squad = squad; MIC.onCmd = onCmd; micPaint(); micInfo();
  if (micPref().handsfree) btn.onclick = () => MIC.on ? micStop() : micStart(true);
  else { const down = ev => { ev.preventDefault(); if (!MIC.on) micStart(false); }, up = () => { if (MIC.on && !MIC.cont) micStop(); };
    btn.addEventListener("pointerdown", down); btn.addEventListener("pointerup", up); btn.addEventListener("pointerleave", up); btn.addEventListener("pointercancel", up); }
  const set = $("#micset"); if (set) set.onclick = () => micSettings(() => { const nb = btn.cloneNode(true); btn.replaceWith(nb); setupMic(nb, squad, onCmd); });
}
/* venster: microfoon kiezen, testen met een geluidsmeter, handsfree aan of uit */
function micSettings(done) {
  if (MIC.on) micStop();
  const p = micPref(), canPick = micTrackOK();
  const d = dialog(`<div class="dlg micdlg"><h2>Microfoon</h2>
    <p class="hint" style="margin-top:0">Verbind eerst je bluetooth-microfoon of oortjes met je gsm, via de bluetooth-instellingen van je gsm. Kies hem daarna hieronder en praat even: de balk moet bewegen.</p>
    ${canPick ? `<div class="list" id="mlist"><p class="hint">Microfoons zoeken…</p></div>` : `<div class="panel" style="padding:12px 14px"><b>Op iPhone en in Safari</b><p class="hint" style="margin:4px 0 0">De app gebruikt altijd de microfoon die je gsm kiest. Is je bluetooth-microfoon verbonden, dan neemt je gsm die meestal vanzelf. Kijk met de balk hieronder of hij geluid opvangt.</p></div>`}
    <div class="meter" aria-label="Geluidsniveau"><i id="mlvl"></i></div><p class="hint" id="mname" style="margin:4px 0 0"></p>
    <label class="check" style="margin-top:14px"><input type="checkbox" id="mhf"${p.handsfree ? " checked" : ""}><span><b>Handsfree</b><br><span class="muted">De app luistert doorlopend en noteert elk commando meteen. Tik één keer op de microfoonknop om te starten en te stoppen. Ideaal met een bluetooth-microfoon en je gsm in je zak.</span></span></label>
    <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn" type="button" data-close>Klaar</button></div></div>`);
  let stream = null, ctx = null, raf = 0;
  const stopMeter = () => { cancelAnimationFrame(raf); try { stream?.getTracks().forEach(t => t.stop()); } catch (x) {} try { ctx?.close(); } catch (x) {} stream = null; ctx = null; };
  const meter = async devId => { stopMeter();
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: devId ? { deviceId: { exact: devId } } : true }); }
    catch (x) { $("#mname", d).textContent = x.name === "NotAllowedError" ? "Geef de app toegang tot je microfoon." : "Deze microfoon is niet bereikbaar. Is hij nog verbonden?"; return; }
    const tr = stream.getAudioTracks()[0]; $("#mname", d).textContent = "Luistert via: " + (tr?.label || "microfoon van je gsm");
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize), bar = $("#mlvl", d);
    const loop = () => { an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); bar.style.width = Math.min(100, m / 128 * 260) + "%"; raf = requestAnimationFrame(loop); }; loop(); };
  const list = async () => { const host = $("#mlist", d); if (!host) return;
    let devs = []; try { devs = (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind === "audioinput" && x.deviceId !== "default" && x.deviceId !== "communications"); } catch (x) {}
    const cur = micPref().device || "";
    host.innerHTML = [{ deviceId: "", label: "Microfoon van je gsm (standaard)" }, ...devs].map(x => `<label class="item mpick"><input type="radio" name="mdev" value="${esc(x.deviceId)}"${x.deviceId === cur ? " checked" : ""}><span class="main"><b>${esc(x.label || "Microfoon")}</b>${isBT(x.label) ? `<small>Bluetooth</small>` : ""}</span></label>`).join("")
      + (devs.some(x => isBT(x.label)) ? "" : `<p class="hint" style="margin:8px 2px 0">Zie je je bluetooth-microfoon niet? Verbind hem met je gsm en tik op <button class="link" type="button" id="mre">opnieuw zoeken</button>.</p>`);
    $$("[name=mdev]", host).forEach(r => r.onchange = () => { const lab = r.closest("label").querySelector("b").textContent; micSave({ device: r.value || null, label: r.value ? lab : null }); meter(r.value); });
    const re = $("#mre", host); if (re) re.onclick = async () => { await meter(micPref().device); list(); }; };
  (async () => { await meter(canPick ? micPref().device : null); if (canPick) list(); })();
  try { navigator.mediaDevices?.addEventListener?.("devicechange", list); } catch (x) {}
  $("#mhf", d).onchange = e => micSave({ handsfree: e.target.checked });
  d.addEventListener("close", () => { stopMeter(); try { navigator.mediaDevices?.removeEventListener?.("devicechange", list); } catch (x) {} done && done(); }, { once: true });
}
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
function findP(t, squad) { t = ` ${norm(t)} `; const m = squad.filter(p => [p.first_name, pname(p), p.number != null ? "nummer " + p.number : null].some(n => n && t.includes(` ${norm(n)} `))); return m.length === 1 ? m[0].id : null; }
function parseSpeech(text, squad) {
  return text.split(/(?:[.;\n]|\ben dan\b)/i).flatMap(raw => { const t = norm(raw); if (!t) return [];
    if (/^(pauze|pauzeer|stop)( de)? timer$|^timer (pauze|pauzeren|stop)$/.test(t)) return [{ type: "pause" }];
    if (/^timer (verder|hervatten|hervat)$|^hervat( de)? timer$|^verder$/.test(t)) return [{ type: "resume" }];
    if (/\b(goal tegen|tegendoelpunt|doelpunt tegen|tegengoal)\b/.test(t)) return [{ type: "against" }];
    if (/\b(wissel|eruit|er uit)\b/.test(t) && /\b(erin|er in|voor|vervangt)\b/.test(t)) {
      const pair = t.match(/^(?:wissel )?(.+?) (?:eruit|er uit)(?: en)? (.+?) (?:erin|er in)$/), rep = t.match(/^(?:wissel )?(.+?) vervangt (.+)$/), fr = t.match(/^wissel (.+?) voor (.+)$/);
      const out = findP(pair?.[1] ?? rep?.[2] ?? fr?.[1] ?? "", squad), inn = findP(pair?.[2] ?? rep?.[1] ?? fr?.[2] ?? "", squad);
      return out && inn ? [{ type: "sub", out, in: inn }] : [{ type: "note", text: raw.trim() }]; }
    if (/\b(goal|doelpunt|scoort|scoorde)\b/.test(t)) { const [sc, as] = t.split(/\bassist(?: van)?\b/); const pid = findP(sc || "", squad);
      return pid ? [{ type: "goal", pid, aid: findP(as || "", squad) }] : [{ type: "note", text: raw.trim() }]; }
    if (/\b(grote kans|kans|doelpoging)\b/.test(t)) return [{ type: "chance" }];
    return [{ type: "note", text: raw.trim(), pid: findP(t, squad) }]; });
}

/* ============ uitslagen van de club ============ */
let clubTeam = "", clubTab = "uitslagen";
route("uitslagen", { title: "Uitslagen club", auth: true, render: async v => {
  v.innerHTML = head("Uitslagen club", "Alle wedstrijden van OG Vorselaar met uitslag en verslag. Zichtbaar voor alle trainers.") + `<p class="muted">Laden…</p>`;
  const all = await loadClub(true), t = todayIso();
  const teamsWith = S.teams.filter(tm => all.some(e => e.team_id === tm.id));
  const list = all.filter(e => (!clubTeam || e.team_id === clubTeam) && (clubTab === "uitslagen" ? e.date <= t : e.date > t));
  if (clubTab === "programma") list.reverse();
  const groups = {}; list.forEach(e => { const k = iso(monday(parse(e.date))); (groups[k] = groups[k] || []).push(e); });
  v.innerHTML = head("Uitslagen club", "Alle wedstrijden van OG Vorselaar met uitslag en verslag. Zichtbaar voor alle trainers.") +
  `<div class="ptabs" role="tablist"><button type="button" role="tab" data-ct="uitslagen" aria-selected="${clubTab === "uitslagen"}">Uitslagen</button><button type="button" role="tab" data-ct="programma" aria-selected="${clubTab === "programma"}">Programma</button></div>
  <div class="scrollx" style="margin-bottom:16px"><button class="chip" type="button" data-tm="" aria-pressed="${!clubTeam}">Alle ploegen</button>${teamsWith.map(tm => `<button class="chip" type="button" data-tm="${tm.id}" aria-pressed="${clubTeam === tm.id}">${esc(teamLbl(tm))}</button>`).join("")}</div>
  ${Object.keys(groups).length ? Object.entries(groups).map(([wk, es]) => `<div class="sec" style="margin-top:20px"><h3 class="muted" style="font-weight:600">Week van ${parse(wk).toLocaleDateString("nl-BE", { day: "numeric", month: "long" })}</h3><div class="list">${es.map(clubItem).join("")}</div></div>`).join("")
    : `<div class="empty"><b>${clubTab === "uitslagen" ? "Nog geen uitslagen" : "Geen wedstrijden gepland"}</b>Wedstrijden verschijnen hier zodra een trainer ze in de kalender zet.</div>`}`;
  $$("[data-ct]", v).forEach(b => b.onclick = () => { clubTab = b.dataset.ct; render(); });
  $$("[data-tm]", v).forEach(b => b.onclick = () => { clubTeam = b.dataset.tm; render(); });
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
} });
route("verslag", { title: "Wedstrijdverslag", auth: true, render: async (v, id) => {
  const all = await loadClub(); const e = all.find(x => x.id === id) || S.events.find(x => x.id === id);
  if (!e) { v.innerHTML = `<div class="empty"><b>Wedstrijd niet gevonden</b><a class="btn" href="#/uitslagen">Naar de uitslagen</a></div>`; return; }
  const mine = S.allTeams || S.myTeamIds.includes(e.team_id), tn = teamName(e.team_id), R = e.report || {}, r = res(e);
  let att = []; try { att = mine && S.team?.id === e.team_id ? S.att.filter(a => a.event_id === e.id) : await db.list("attendance", { event_id: e.id }); } catch (x) {}
  const pl = att.filter(a => a.status === "aanwezig" && (a.rating || a.note || a.minutes != null)).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const goals = (R.goals || []).slice().sort((a, b) => (a.min ?? 999) - (b.min ?? 999));
  const L = e.home === false ? [esc(e.opponent || "Tegenstander"), esc(tn), e.score_against, e.score_for] : [esc(tn), esc(e.opponent || "Tegenstander"), e.score_for, e.score_against];
  v.innerHTML = backLink("#/uitslagen", "Uitslagen club") + head(matchTitle(e, tn), `${cap(dLong(e.date))}${e.start_time ? ", " + tm(e.start_time) : ""}${R.kind ? " · " + esc(R.kind) : ""}${r ? ` · <span class="pill ${r}">${RES_L[r]}</span>` : ""}`,
    `${mine ? `<button class="btn noprint" type="button" id="edit">Verslag bewerken</button>` : ""}<button class="btn ghost small noprint" type="button" onclick="print()">${IC.print}Afdrukken</button>`) +
  `<div class="score"><div class="side-t"><b>${L[0]}</b></div><div><div class="nums">${L[2] ?? "–"}<span>–</span>${L[3] ?? "–"}</div>${R.half_for != null ? `<div class="half">Rust ${e.home === false ? R.half_against + " – " + R.half_for : R.half_for + " – " + R.half_against}</div>` : ""}</div><div class="side-t"><b>${L[1]}</b></div></div>
  <div class="grid2 sec">
    <div class="panel"><h2>Doelpunten</h2>${goals.length ? `<div class="timeline">${goals.map(g => `<div class="tl ${g.side === "for" ? "for" : "ag"}"><span class="m">${g.min != null ? g.min + "'" : ""}</span><span class="d">⚽</span><span>${g.side === "for" ? `<b>${esc(g.name || "OGV")}</b>${g.assist_name ? ` <span class="muted">assist ${esc(g.assist_name)}</span>` : ""}` : `<span class="muted">${esc(e.opponent || "Tegenstander")}</span>`}${g.type && g.type !== "Open spel" ? ` <span class="pill g">${esc(g.type)}</span>` : ""}</span></div>`).join("")}</div>` : '<p class="muted">Geen doelpunten geregistreerd.</p>'}</div>
    <div class="panel"><h2>Gegevens</h2><dl class="facts">${[["Man van de match", R.motm_name], ["Ploegcijfer", R.team_rating ? R.team_rating + " op 10" : ""], ["Formatie", R.formation], ["Veld", R.pitch], ["Weer", R.weather], ["Grote kansen", R.chances], ["Plaats", e.location]].filter(x => x[1] != null && x[1] !== "").map(([k, x]) => `<dt>${k}</dt><dd>${esc(x)}</dd>`).join("") || "<dd class='muted'>Nog niet ingevuld.</dd>"}</dl></div></div>
  ${R.moments && Object.values(R.moments).some(m => m && (m.score || m.note)) ? `<div class="sec"><h2>Hoofdmomenten</h2><div class="moments">${Object.entries(PRINC).filter(([k]) => R.moments[k] && (R.moments[k].score || R.moments[k].note)).map(([k, l]) => `<div class="moment"><div class="h"><span class="code">${k}</span><b>${l}</b><span class="spacer"></span><b style="font-size:20px">${R.moments[k].score ?? "–"}<span class="muted" style="font-size:13px">/5</span></b></div>${R.moments[k].note ? `<p style="margin:0">${esc(R.moments[k].note)}</p>` : ""}</div>`).join("")}</div></div>` : ""}
  <div class="grid2 sec">${[["Wat ging goed", R.good || e.report_good], ["Wat kan beter", R.better || e.report_better], ["Tegenstander", R.opponent], ["Actiepunten voor de training", R.actions]].filter(x => x[1]).map(([k, x]) => `<div class="panel"><h2>${k}</h2><p style="margin:0;white-space:pre-wrap">${esc(x)}</p></div>`).join("")}</div>
  ${pl.length ? `<div class="sec"><h2>Spelers</h2><div class="list">${pl.map(a => `<div class="item static"><span class="num">${a.rating ?? "–"}</span><span class="main"><b>${esc(a.player_name || "Speler")}${R.motm === a.player_id ? ' <span class="pill w">Man van de match</span>' : ""}</b><small>${esc([a.role, a.minutes != null ? a.minutes + " min" : "", a.goals ? a.goals + " goal" : "", a.assists ? a.assists + " assist" : "", ...(a.strengths || [])].filter(Boolean).join(" · "))}${a.note ? " · " + esc(a.note) : ""}</small></span></div>`).join("")}</div></div>`
    : !mine ? `<p class="hint sec">De spelersbeoordelingen van deze ploeg zijn privé.</p>` : ""}`;
  const ed = $("#edit"); if (ed) ed.onclick = async () => { if (S.team?.id !== e.team_id) await loadTeam(e.team_id); go("#/activiteit/" + e.id); };
} });
