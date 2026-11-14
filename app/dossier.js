/* OGV Platform — spelersdossier: alles wat de trainers over één speler noteerden, op één pagina.
   Bedoeld om samen (bv. twee trainers die elk een groepje doen) een oudergesprek voor te bereiden.
   Wedstrijden tellen per speeldag maar één keer, ook als de speler vroeger dubbel in A en B stond. */
"use strict";
const DOS_MAX_NOTES = 60;
const qOf = d => d ? "Q" + (Math.floor(parse(d).getMonth() / 3) + 1) : "";
const dosCount = arr => { const m = {}; arr.forEach(t => { if (t) m[t] = (m[t] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
const rateCol = r => r >= 8 ? "#34D17A" : r >= 6 ? "#A3D63B" : r >= 5 ? "#FFD100" : "#F2615A";

function dosChart(rows) {
  const pts = rows.filter(x => x.a.rating != null); if (pts.length < 2) return "";
  const W = 640, H = 150, pl = 26, pr = 10, n = pts.length, xs = i => pl + i * (W - pl - pr) / Math.max(1, n - 1), ys = v => H - 22 - (v - 1) * (H - 40) / 9;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Verloop van het wedstrijdcijfer">
    ${[2, 4, 6, 8, 10].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${ys(v)}" y2="${ys(v)}" style="stroke:var(--line)"/><text x="4" y="${ys(v) + 4}" font-size="10" style="fill:var(--dim)">${v}</text>`).join("")}
    <polyline fill="none" stroke="#FFD100" stroke-width="2" points="${pts.map((x, i) => xs(i) + "," + ys(x.a.rating)).join(" ")}"/>
    ${pts.map((x, i) => `<circle cx="${xs(i)}" cy="${ys(x.a.rating)}" r="4.5" fill="${rateCol(x.a.rating)}"><title>${esc(dShort(x.e.date))} · ${esc(x.e.opponent || "Wedstrijd")} · ${x.a.rating}${x.a.rated_by ? " (" + esc(x.a.rated_by) + ")" : ""}</title></circle>
      ${n <= 16 ? `<text x="${xs(i)}" y="${H - 6}" text-anchor="middle" font-size="9.5" style="fill:var(--dim)">${dDay(x.e.date)}/${parse(x.e.date).getMonth() + 1}</text>` : ""}`).join("")}</svg>`;
}

const DOS_TABS = [["overzicht", "Startblad"], ["persoonlijk", "Persoonlijk en contact"], ["groei", "Groei"], ["trainingen", "Trainingen"], ["wedstrijden", "Wedstrijden"], ["evaluaties", "Evaluaties"], ["scouting", "Scouting"]];
let dosTab = "overzicht";
/* scoutingprofiel van een eigen speler: dezelfde 5 onderdelen en posities als de scoutingdatabase, zodat eigen en externe spelers vergelijkbaar zijn */
const SC_POT = ["Beperkt", "Gemiddeld", "Groot", "Zeer groot"];
const scProf = p => p?.scout && typeof p.scout === "object" ? p.scout : {};
function scProfForm(p) {
  const sp = scProf(p), pos = Object.keys(SC_POS), opt = (cur, list) => `<option value=""></option>` + list.map(x => `<option${x === cur ? " selected" : ""}>${esc(x)}</option>`).join("");
  const d = dialog(`<form><h2>Scoutingprofiel · ${esc(p.first_name)}</h2><p class="hint" style="margin:0">Dezelfde onderdelen als in de scoutingdatabase. Alleen zichtbaar voor de trainers van deze ploeg. Laat een score leeg als je het nog niet weet.</p><div class="fields">
    <label class="f">Hoofdpositie<select name="p1">${opt(sp.p1 || "", pos)}</select></label><label class="f">Alternatieve positie<select name="p2">${opt(sp.p2 || "", pos)}</select></label>
    <label class="f">Tweede alternatief<select name="p3">${opt(sp.p3 || "", pos)}</select></label><label class="f">Lengte (cm)<input name="len" type="number" min="80" max="220" value="${esc(sp.len || "")}"></label>
    <label class="f">Potentieel<select name="pot">${opt(sp.pot || "", SC_POT)}</select></label>
    ${SC_COMP.map((c, i) => `<label class="f">${esc(c)} (1 tot 10)<input name="k${i}" type="number" min="1" max="10" step="0.5" value="${scNum(sp["k" + i]) ? sp["k" + i] : ""}"></label>`).join("")}
    <label class="f full">Sterktes en spelbeschrijving<textarea name="sterk" rows="3" maxlength="1500">${esc(sp.sterk || "")}</textarea></label>
    <label class="f full">Werkpunten<textarea name="werk" rows="3" maxlength="1500">${esc(sp.werk || "")}</textarea></label>
    <label class="f full">Extra info over de speler<textarea name="ctx" rows="3" maxlength="1500" placeholder="Bv. matuur, speelt graag op links, familie, wat hem motiveert…">${esc(sp.ctx || "")}</textarea></label></div>
    <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), o = {};
    for (const k of ["p1", "p2", "p3", "pot"]) if (f[k]) o[k] = f[k];
    if (f.len) o.len = Math.max(80, Math.min(220, +f.len)); SC_COMP.forEach((c, i) => { const n = parseFloat(f["k" + i]); if (!isNaN(n)) o["k" + i] = Math.max(1, Math.min(10, n)); });
    for (const k of ["sterk", "werk", "ctx"]) if (f[k].trim()) o[k] = f[k].trim();
    o.upd = new Date().toISOString().slice(0, 10); o.by = typeof tpOf === "function" ? (tpOf(user?.id)?.name || tNice(user?.email)) : "";
    const row = { ...p, scout: o };
    await safe(async () => { await db.save("players", row); const i = S.players.findIndex(x => x.id === row.id); if (i >= 0) S.players[i] = row; d.close(); render(); }, "Profiel opgeslagen."); };
}
/* rapport van een trainer over een speler (interne scouting) */
function pScoutForm(p, r) {
  const n = !r; r = r || { date: new Date().toISOString().slice(0, 10) };
  const d = dialog(`<form><h2>${n ? "Scoutingrapport" : "Rapport bewerken"} · ${esc(p.first_name)}</h2><div class="fields">
    <label class="f">Datum<input name="date" type="date" required value="${esc(r.date || "")}"></label><label class="f">Titel<input name="title" maxlength="80" value="${esc(r.title || "")}" placeholder="bv. Wedstrijd tegen Zoersel"></label>
    <label class="f full">Notities<textarea name="notes" rows="5" maxlength="2000">${esc(r.notes || "")}</textarea></label>
    <label class="f">Sterk in<input name="strengths" maxlength="200" value="${esc(r.strengths || "")}"></label><label class="f">Werkpunt<input name="workpoints" maxlength="200" value="${esc(r.workpoints || "")}"></label></div>
    <div class="row">${n ? "" : `<button class="btn danger" type="button" id="scDel">Verwijderen</button>`}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  if (!n) $("#scDel", d).onclick = async () => { if (!confirm("Dit rapport definitief verwijderen?")) return;
    await safe(async () => { await db.del("player_scout", { id: r.id }); S.pscout = S.pscout.filter(x => x.id !== r.id); d.close(); render(); }, "Rapport verwijderd."); };
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    const me = typeof tpOf === "function" ? (tpOf(user?.id)?.name || tNice(user?.email)) : (user?.email || "");
    const row = { ...(n ? { id: uid(), team_id: S.team.id, player_id: p.id, scores: {}, by_name: me } : r), date: f.date, title: f.title.trim() || null, notes: f.notes.trim() || null, strengths: f.strengths.trim() || null, workpoints: f.workpoints.trim() || null };
    await safe(async () => { await db.save("player_scout", row); const i = S.pscout.findIndex(x => x.id === row.id); if (i >= 0) S.pscout[i] = row; else S.pscout.push(row); d.close(); render(); }, "Rapport opgeslagen."); };
}
route("dossier", { title: "Spelersdossier", auth: true, team: true, render: (v, id) => {
  const ps = active();
  if (!id) {
    v.innerHTML = head("Spelersdossier", "Alles wat jullie over een speler noteerden op één pagina: speeltijd en cijfers over alle groepjes, aanwezigheid, evaluaties en elke opmerking met de naam van de trainer. Om samen een oudergesprek voor te bereiden.") +
      (ps.length ? `<div class="pgrid">${ps.map(p => { const s = playerStats(p), g = dosCount(matchRows(p.id).map(x => groupOf(x.e)).filter(Boolean)), sp = scProf(p);
        return pCard(p, { href: "#/dossier/" + p.id, sub: [pPos(p), p.birthdate ? pAge(p) + " jaar · " + qOf(p.birthdate) : "", g.length ? g.map(([k, c]) => `${k} ${c}×`).join(", ") : ""].filter(Boolean).join(" · ") || "Dossier openen",
          extra: sp.pot ? `<span class="pc-tag">Potentieel ${esc(sp.pot.toLowerCase())}</span>` : "", stats: [[s.matches, "matchen"], [s.minutes, "minuten"], [f1(s.rating), "cijfer"]] }); }).join("")}</div>`
       : `<div class="empty"><b>Nog geen spelers</b></div>`);
    return;
  }
  const p = S.players.find(x => x.id === id);
  if (!p) { v.innerHTML = `<div class="empty"><b>Speler niet gevonden</b><a class="link" href="#/dossier">Terug</a></div>`; return; }
  const s = playerStats(p), rows = matchRows(p.id), A = rows.map(x => x.a), idx = ps.findIndex(x => x.id === p.id);
  const prevP = idx > 0 ? ps[idx - 1] : null, nextP = idx >= 0 && idx < ps.length - 1 ? ps[idx + 1] : null;
  const age = p.birthdate ? Math.floor((Date.now() - parse(p.birthdate)) / 3.15576e10) : null;
  /* per groepje en per trainer */
  const bySquad = dosCount(rows.map(x => groupOf(x.e) || "Zonder groepje"));
  const raters = [...new Set(A.map(a => a.rated_by).filter(Boolean))];
  const byRater = raters.map(r => { const xs = A.filter(a => a.rated_by === r); return { r, n: xs.length, avg: avg(xs.map(a => a.rating).filter(x => x != null)) }; });
  const unknownN = A.filter(a => !a.rated_by && (a.rating != null || a.note)).length;
  /* team-gemiddelden als vergelijkingspunt */
  const teamRate = avg(ps.map(q => playerStats(q).rating).filter(x => x != null));
  /* tags */
  const work = dosCount(A.flatMap(a => a.tags || [])), str = dosCount(A.flatMap(a => (a.strengths || []).filter(t => t !== "Kapitein")));
  /* evaluaties */
  const ev = S.evals.filter(x => x.player_id === p.id).sort((a, b) => a.moment - b.moment), groups = evGroups(), names = evItems();
  const evMs = EV_MOMENTS.filter(m => ev.some(e => e.moment === m.m && Object.keys(e.scores || {}).length));
  const evTexts = ev.flatMap(e => { const D = e.details || {}, mo = EV_MOMENTS[e.moment - 1]; return [["Sterktes", D.strengths], ["Werkpunten", D.workpoints], ["Doelen", D.goals], ["Niveau", D.level], ["Positie", D.position], ["Boodschap voor de ouders", D.parents]]
    .filter(x => x[1]).map(([k, t]) => ({ mo, k, t, by: (D.by_all || (D.by ? [D.by] : [])).join(", ") })); });
  const notes = rows.filter(x => x.a.note || x.a.rating != null).slice().reverse();
  const gs = S.goals.filter(g => g.player_id === p.id);

  /* extra onderdelen van het dossier: zelfevaluatie, wedstrijden, persoonlijk en contact, trainingen, interne scouting */
  const zelfHtml = (typeof evZelf === "function" ? EV_MOMENTS.filter(m => evZelf(p.id, m.m)).map(m => `<div class="sec" data-t="evaluaties"><h3 class="dosh">Zelfevaluatie · ${esc(m.naam)}</h3>${evSelfPanel(evZelf(p.id, m.m), evOf(p.id, m.m), m.m)}</div>`).join("") : "");
  const isPres = st => st === "aanwezig" || st === "te laat";
  const evMatchesPlayed = rows.filter(({ a }) => isPres(a.status));
  /* wedstrijden: één kaart per wedstrijd met uitslag en cijfer; klik voor meer */
  const resOf = e => e.score_for == null ? null : e.score_for > e.score_against ? "w" : e.score_for < e.score_against ? "l" : "g";
  const mRows = rows.slice().reverse(), W = mRows.filter(x => resOf(x.e) === "w").length, G = mRows.filter(x => resOf(x.e) === "g").length, L = mRows.filter(x => resOf(x.e) === "l").length;
  const totMin = Math.round(mRows.reduce((t, x) => t + (x.a.minutes || 0), 0));
  const matchPane = `<div class="sec" data-t="wedstrijden"><div class="dkpis"><div><small>Wedstrijden</small><b>${mRows.length}</b></div><div><small>Uitslagen</small><b>${W}-${G}-${L}</b><span>gewonnen · gelijk · verloren</span></div><div><small>Speeltijd</small><b>${totMin}</b><span>minuten</span></div><div><small>Goals · assists</small><b>${s.goals} · ${s.assists}</b></div><div><small>Gem. cijfer</small><b>${f1(s.rating)}</b></div></div>
    ${mRows.length ? `<div class="dmlist">${mRows.map(({ e, a }) => { const r = resOf(e), tg = a.tags || [], st = (a.strengths || []).filter(t => t !== "Kapitein");
      return `<details class="dmatch"><summary><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span>${matchCrests(e)}
        <span class="main"><b>${esc(e.opponent || "Wedstrijd")}</b><small>${esc([e.home === false ? "Uit" : "Thuis", groupOf(e), a.minutes != null ? Math.round(a.minutes) + " min" : "", a.goals ? a.goals + (a.goals === 1 ? " goal" : " goals") : "", a.assists ? a.assists + (a.assists === 1 ? " assist" : " assists") : ""].filter(Boolean).join(" · "))}</small></span>
        ${e.report?.motm === p.id ? '<span class="pill w dmx">Man v/d match</span>' : ""}${r ? `<span class="dmres ${r}">${e.score_for}–${e.score_against}</span>` : ""}
        <span class="dmrate" style="--rc:${a.rating != null ? rateCol(a.rating) : "var(--card3)"}" title="Cijfer voor ${esc(p.first_name)}">${a.rating ?? "–"}</span></summary>
        <div class="dmbody">
          <div class="dmfacts">${a.role ? `<span><small>Rol</small><b>${esc(a.role)}</b></span>` : ""}${a.minutes != null ? `<span><small>Speeltijd</small><b>${Math.round(a.minutes)} min</b></span>` : ""}<span><small>Doelpunten</small><b>${a.goals || 0}</b></span><span><small>Assists</small><b>${a.assists || 0}</b></span>${isCaptain(e, p, a) ? '<span><small>Kapitein</small><b>Ja</b></span>' : ""}</div>
          ${a.note ? `<p class="dmnote">${esc(a.note).replace(/\n/g, "<br>")}</p>` : `<p class="hint" style="margin:0">Geen opmerking bij deze wedstrijd.</p>`}
          ${st.length || tg.length ? `<div class="chips">${st.map(t => `<span class="tag good" aria-pressed="true">${esc(t)}</span>`).join("")}${tg.map(t => `<span class="tag" aria-pressed="true">${esc(t)}</span>`).join("")}</div>` : ""}
          <div class="row dmfoot"><small class="muted">${a.rated_by ? "Beoordeeld door " + esc(a.rated_by) : "Trainer niet gekend"}</small><span class="spacer"></span><a class="btn ghost small noprint" href="#/activiteit/${e.id}">Open wedstrijd</a></div></div></details>`; }).join("")}</div>`
      : `<div class="empty"><b>Nog geen wedstrijden</b></div>`}</div>`;
  /* trainingen: eerst het beeld (maand per maand), daarna enkel wat gemist werd */
  const todayS = new Date().toISOString().slice(0, 10);
  const trs = S.events.filter(e => e.type === "training" && !e.cancelled && e.date <= todayS && S.att.some(a => a.event_id === e.id)).sort((a, b) => a.date.localeCompare(b.date));
  const tr = trs.map(e => { const a = S.att.find(x => x.event_id === e.id && x.player_id === p.id); return { e, a, st: a?.status || "niet genoteerd" }; });
  const nPres = tr.filter(x => x.st === "aanwezig").length, nLate = tr.filter(x => x.st === "te laat").length, nMiss = tr.filter(x => !isPres(x.st)).length;
  let streak = 0; for (let i = tr.length - 1; i >= 0 && isPres(tr[i].st); i--) streak++;
  const byMonth = [...tr.reduce((m, x) => m.set(x.e.date.slice(0, 7), [...(m.get(x.e.date.slice(0, 7)) || []), x]), new Map())].reverse();
  const monName = k => { const d = new Date(k + "-01T12:00"); return d.toLocaleDateString("nl-BE", { month: "long" }) + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""); };
  const missed = tr.filter(x => !isPres(x.st)).reverse();
  const trainingPane = `<div class="sec" data-t="trainingen"><div class="dkpis"><div><small>Aanwezig</small><b>${s.trTot ? s.trPct + "%" : "–"}</b><span>${s.trIn} van ${s.trTot}</span></div><div><small>Op tijd</small><b>${nPres}</b></div><div><small>Te laat</small><b>${nLate}</b></div><div><small>Gemist</small><b>${nMiss}</b></div><div><small>Reeks</small><b>${streak}</b><span>keer na elkaar</span></div></div>
    ${tr.length ? `<div class="panel sec"><div class="row" style="margin-bottom:10px"><h2 style="margin:0;margin-right:auto">Per maand</h2><span class="tleg"><i class="tdot ok"></i>aanwezig <i class="tdot late"></i>te laat <i class="tdot no"></i>gemist</span></div>
      ${byMonth.map(([k, xs]) => `<div class="tmonth"><div class="tm"><b>${esc(monName(k))}</b><small>${xs.filter(x => isPres(x.st)).length} van ${xs.length}</small></div><div class="tdots">${xs.map(x => `<span class="tdot ${x.st === "aanwezig" ? "ok" : x.st === "te laat" ? "late" : "no"}" title="${esc(dShort(x.e.date) + " · " + x.st + (x.a?.note ? " · " + x.a.note : ""))}">${dDay(x.e.date)}</span>`).join("")}</div></div>`).join("")}</div>
      ${missed.length ? `<div class="panel sec"><h2>Gemist</h2><div class="list">${missed.slice(0, 12).map(x => `<div class="item static"><span class="date"><b>${dDay(x.e.date)}</b><small>${dMon(x.e.date)}</small></span><span class="main"><b>${esc(x.e.title || "Training")}</b><small>${esc([x.e.location, x.a?.note].filter(Boolean).join(" · "))}</small></span><span class="pill">${esc(x.st)}</span></div>`).join("")}</div>${missed.length > 12 ? `<p class="hint" style="margin:8px 0 0">En nog ${missed.length - 12} oudere.</p>` : ""}</div>` : `<p class="hint">Nog geen training gemist.</p>`}`
      : `<div class="empty"><b>Nog geen trainingen met aanwezigheden</b></div>`}</div>`;
  const idRow = (k, val) => val ? `<div class="dosid"><span>${k}</span><b>${esc(val)}</b></div>` : "";
  const persoonlijkPane = `<div class="sec panel" data-t="persoonlijk"><div class="row" style="margin-bottom:8px"><h2 style="margin:0;margin-right:auto">Persoonlijk</h2><button class="btn ghost small noprint" type="button" id="dosEdit">Fiche bewerken</button></div>
    <div class="dospers">${p.photo ? `<img class="dosphoto" data-pp="${esc(p.photo)}" alt="">` : ""}<div class="dosfacts">${idRow("Ploeg", S.team.name)}${idRow("Rugnummer", p.number)}${idRow("Positie", p.position)}${idRow("Voorkeursvoet", p.foot)}${idRow("Geboortedatum", p.birthdate ? parse(p.birthdate).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" }) : "")}${idRow("Leeftijd", age != null ? age + " jaar" : "")}${idRow("Status", p.active === false ? "Niet meer actief" : "Actief")}</div></div></div>
    <div data-t="persoonlijk">${typeof contactsPanel === "function" ? contactsPanel(p) : ""}</div>`;
  const sc = (S.pscout || []).filter(x => x.player_id === p.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const scoutPane = `<div class="sec panel" data-t="scouting"><div class="row" style="margin-bottom:6px"><h2 style="margin:0;margin-right:auto">Interne scouting</h2>${S.pscoutOk === false ? "" : `<button class="btn small noprint" type="button" id="scAdd">${IC.plus}Rapport</button>`}</div>
    <p class="hint" style="margin-top:0">Rapporten van trainers van de club over deze speler. Alleen zichtbaar voor de trainers van deze ploeg, nooit voor ouders of spelers.</p>
    ${S.pscoutOk === false ? `<p class="hint">Dit onderdeel werkt zodra de beheerder <b>supabase-dossiers-v40.sql</b> uitvoert.</p>`
      : sc.length ? `<div class="dosnotes">${sc.map(r => `<div class="dosnote"><div style="flex:1"><div class="dosmeta"><b>${esc(dShort(r.date))}</b>${r.title ? " · " + esc(r.title) : ""} <small class="muted">${r.by_name ? "door " + esc(r.by_name) : ""}</small>
        <button class="btn ghost small noprint" type="button" data-scE="${r.id}" style="float:right">Bewerken</button></div>
        ${r.notes ? `<p>${esc(r.notes).replace(/\n/g, "<br>")}</p>` : ""}${r.strengths ? `<div class="chips"><span class="tag good" aria-pressed="true">Sterk: ${esc(r.strengths)}</span></div>` : ""}${r.workpoints ? `<div class="chips"><span class="tag" aria-pressed="true">Werkpunt: ${esc(r.workpoints)}</span></div>` : ""}</div></div>`).join("")}</div>`
      : `<p class="hint">Nog geen rapporten. Voeg er een toe na een training of wedstrijd.</p>`}</div>`;

  /* startblad: positie, leeftijd, potentieel en wat de trainers verder over de speler weten */
  const sp = scProf(p), has = [sp.p1, sp.p2, sp.p3, sp.pot, sp.sterk, sp.werk, sp.ctx, sp.len].some(Boolean) || scAvg(sp) != null;
  const fichePos = Object.keys(SC_POS).find(k => String(p.position || "").toLowerCase().includes(k.toLowerCase()));
  const spPos = [sp.p1, sp.p2, sp.p3].filter(Boolean), pitchPos = spPos.length ? spPos : fichePos ? [fichePos] : [], spAvg = scAvg(sp);
  const big = (k, val, sub) => `<div class="spk"><small>${k}</small><b>${val ? esc(val) : "–"}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div>`;
  const note = (cls, t, txt) => txt ? `<div class="spn ${cls}"><h3>${t}</h3><p>${esc(txt)}</p></div>` : "";
  const startblad = `<div class="sec panel startblad" data-t="overzicht"><div class="row" style="margin-bottom:14px"><h2 style="margin:0;margin-right:auto">Scoutingprofiel</h2><button class="btn small noprint${has ? " ghost" : ""}" type="button" id="spEdit">${has ? "Profiel aanpassen" : "Profiel invullen"}</button></div>
    <div class="spgrid"><div class="pitchpick sm" role="img" aria-label="Positie op het veld: ${esc(pitchPos.join(", ") || "nog niet ingevuld")}">${Object.entries(SC_POS).map(([n, [ab, x, y]]) => { const i = pitchPos.indexOf(n); return `<span class="pp ${i >= 0 ? "s" + (i + 1) : ""}" style="left:${x}%;top:${y}%" title="${esc(n)}">${ab}</span>`; }).join("")}</div>
     <div class="spmain">
      <div class="spks">${big("Hoofdpositie", sp.p1 || fichePos || String(p.position || "").replace(/^\d+\s*·\s*/, ""), spPos.length > 1 ? "ook " + spPos.slice(1).join(", ").toLowerCase() : "")}${big("Leeftijd", age != null ? age + " jaar" : "", p.foot ? p.foot + "voetig" : "")}${big("Potentieel", sp.pot, sp.len ? sp.len + " cm" : "")}${big("Algemeen", spAvg != null ? f1(spAvg) : "", spAvg != null ? "op 10" : "")}</div>
      ${SC_COMP.some((c, i) => scNum(sp["k" + i])) ? `<div class="spbars">${SC_COMP.map((c, i) => { const val = sp["k" + i]; return `<div class="mbar"><span>${SC_SH[i]}</span><span class="b"><i style="width:${scNum(val) ? val * 10 : 0}%;background:${scNum(val) ? scCol(val) : "transparent"}"></i></span><b style="color:var(--ink);text-align:right">${scNum(val) ? f1(val) : "–"}</b></div>`; }).join("")}</div>` : ""}</div></div>
    ${sp.sterk || sp.werk || sp.ctx ? `<div class="spnotes">${note("good", "Sterktes", sp.sterk)}${note("work", "Werkpunten", sp.werk)}${note("", "Extra info", sp.ctx)}</div>` : ""}
    <p class="hint" style="margin:14px 0 0">${has ? `Enkel zichtbaar voor de trainers van deze ploeg${sp.upd ? " · bijgewerkt op " + esc(dShort(sp.upd)) : ""}${sp.by ? " door " + esc(sp.by) : ""}.` : "Nog niet ingevuld. Noteer positie, potentieel, sterktes en wat je verder over de speler weet."}</p></div>`;

  v.innerHTML = `<div class="row noprint" style="margin-bottom:10px;gap:8px">${backLink("#/dossier", "Alle dossiers")}<span class="spacer"></span>
      ${prevP ? `<a class="btn ghost small" href="#/dossier/${prevP.id}" title="${esc(pname(prevP))}">‹ Vorige</a>` : ""}${nextP ? `<a class="btn ghost small" href="#/dossier/${nextP.id}" title="${esc(pname(nextP))}">Volgende ›</a>` : ""}
      <a class="btn ghost small" href="#/speler/${p.id}">Spelerskaart</a><button class="btn small" type="button" onclick="print()">${IC.print}Afdrukken</button></div>
  <div class="dos" data-tab="${dosTab}">
  <div class="ph">${pAv(p, "width:60px;height:60px;border-radius:16px;background:var(--yellow);color:#000;font-size:26px;border:0")}
    <div class="t"><h1 class="pg">${esc(pname(p))}</h1><p class="sub">${esc([S.team.name, p.position, age != null ? age + " jaar" : "", p.birthdate ? "geboren " + parse(p.birthdate).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" }) + " (" + qOf(p.birthdate) + ")" : ""].filter(Boolean).join(" · "))}</p>
    <p class="hint" style="margin:2px 0 0">Spelersdossier voor intern gebruik door de trainers · ${new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" })}</p></div></div>
  <div class="kpis dos3">
    <div class="kpi"><small>Aanwezig op training</small><b>${s.trTot ? s.trPct + "%" : "–"}</b><span>${s.trIn} van ${s.trTot}</span></div>
    <div class="kpi"><small>Wedstrijden</small><b>${s.matches}</b><span>${s.basis}× basis${s.matches ? " (" + pct(s.basis, s.matches) + "%)" : ""}</span></div>
    <div class="kpi"><small>Gemiddeld cijfer</small><b>${f1(s.rating)}</b><span>ploeg ${f1(teamRate)}${s.motm ? " · " + s.motm + "× man van de match" : ""}</span></div></div>

  <div class="dtabs noprint" role="tablist" aria-label="Onderdelen van het dossier">${DOS_TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === dosTab}">${l}</button>`).join("")}</div>
  ${startblad}
  <details class="sec dmore" data-t="overzicht"><summary>Meer statistieken: groepjes, werkpunten en cijfers</summary><div class="grid2 sec">
    <div class="panel"><h2>Per groepje en per trainer</h2>
      ${bySquad.some(([k]) => k !== "Zonder groepje") ? `<div class="dosrow">${bySquad.map(([k, c]) => `<span class="pill g">${esc(k)}: ${c}×</span>`).join(" ")}</div>` : rows.length ? "" : `<p class="hint">Nog geen wedstrijden.</p>`}
      ${byRater.length ? `<div class="list" style="margin-top:10px">${byRater.map(x => `<div class="item static"><span class="main"><b>${esc(x.r)}</b><small>${x.n} ${x.n === 1 ? "wedstrijd" : "wedstrijden"} beoordeeld</small></span><span class="val"><b>${f1(x.avg)}</b>gem. cijfer</span></div>`).join("")}</div>` : ""}
      ${unknownN ? `<p class="hint" style="margin:8px 0 0">${unknownN} oudere beoordelingen zonder naam van de trainer (van voor deze functie bestond).</p>` : ""}
      ${byRater.length > 1 && byRater.every(x => x.avg != null) && Math.abs(byRater[0].avg - byRater[1].avg) >= 1 ? `<p class="grpwarn" style="margin-top:10px">Jullie cijfers liggen meer dan 1 punt uit elkaar. Bespreek of het aan de speler ligt (ander groepje, andere positie) of aan hoe streng jullie quoteren.</p>` : ""}</div>
    <div class="panel"><h2>Wat komt het vaakst terug?</h2>
      <h3 class="dosh">Werkpunten uit wedstrijden</h3>${work.length ? `<div class="chips">${work.slice(0, 8).map(([k, c]) => `<span class="tag" aria-pressed="true">${esc(k)} · ${c}×</span>`).join("")}</div>` : `<p class="hint">Nog geen werkpunten aangeduid bij wedstrijden.</p>`}
      <h3 class="dosh">Sterke punten uit wedstrijden</h3>${str.length ? `<div class="chips">${str.slice(0, 8).map(([k, c]) => `<span class="tag good" aria-pressed="true">${esc(k)} · ${c}×</span>`).join("")}</div>` : `<p class="hint">Nog geen sterke punten aangeduid bij wedstrijden.</p>`}</div></div>

  ${dosChart(rows) ? `<div class="sec panel"><h2>Verloop wedstrijdcijfer</h2>${dosChart(rows)}<p class="hint" style="margin:6px 0 0">Eén punt per speeldag. Ga met de muis over een punt voor de tegenstander en wie quoteerde.</p></div>` : ""}</details>

  <div class="sec panel" data-t="evaluaties"><h2>Evaluaties</h2>
    ${evMs.length ? `<div class="tblwrap"><table class="dostbl"><thead><tr><th>Onderdeel</th>${evMs.map(m => `<th>${esc(m.kort)}</th>`).join("")}</tr></thead><tbody>
      ${groups.map(g => `<tr class="g"><td>${esc(g.name)}</td>${evMs.map(m => `<td>${f1(evAvgOf(ev.find(e => e.moment === m.m), g.items.map(i => i.name)))}</td>`).join("")}</tr>
        ${g.items.map(i => `<tr><td>${esc(i.name)}</td>${evMs.map(m => { const c = evScore(ev.find(e => e.moment === m.m), i.name); return `<td${c != null ? ` style="color:${evColor(c)}"` : ""}>${c == null ? "–" : f1(c)}</td>`; }).join("")}</tr>`).join("")}`).join("")}
      <tr class="g"><td>Gemiddelde</td>${evMs.map(m => `<td>${f1(evAvgOf(ev.find(e => e.moment === m.m), names))}</td>`).join("")}</tr></tbody></table></div>
      ${evMs.length > 1 && ev.some(e => Object.keys(e.scores || {}).length < names.length) ? `<p class="hint" style="margin:8px 0 0">Niet elke evaluatie telde evenveel onderdelen. Vergelijk dus per onderdeel, niet enkel het gemiddelde.</p>` : ""}`
     : `<p class="hint">Nog geen evaluatie. <a class="link" href="#/evaluaties">Naar de evaluaties</a></p>`}
    ${evTexts.length ? `<div class="dostexts">${evTexts.map(x => `<div><h3>${esc(x.k)} <span class="muted">· ${esc(x.mo.naam)}${x.by ? " · " + esc(x.by) : ""}</span></h3><p>${esc(x.t).replace(/\n/g, "<br>")}</p></div>`).join("")}</div>` : ""}</div>

  ${zelfHtml}

  <div class="sec panel" data-t="evaluaties"><div class="row" style="margin-bottom:6px"><h2 style="margin:0;margin-right:auto">Doelen</h2><button class="btn small noprint" type="button" id="dosG">${IC.plus}Doel</button></div>
    ${gs.length ? `<div class="list">${gs.map(g => `<div class="item static"><span class="main"><b style="white-space:normal">${esc(g.text)}</b><small>${esc([g.area, g.status].filter(Boolean).join(" · "))}</small></span></div>`).join("")}</div>` : `<p class="hint">Nog geen doelen. Spreek er tijdens het gesprek één of twee af die je op het veld kunt zien.</p>`}
    <div class="doslines print-only-lines"><b>Afspraken uit het gesprek</b><i></i><i></i><i></i><i></i></div></div>

  ${matchPane}
  ${persoonlijkPane}${groeiPane(p)}${trainingPane}${scoutPane}
  </div>`;
  $("#dosG").onclick = () => goalForm(p);
  $$(".dtabs [data-tab]", v).forEach(b => b.onclick = () => { dosTab = b.dataset.tab; $(".dos", v).dataset.tab = dosTab; $$(".dtabs [data-tab]", v).forEach(x => x.setAttribute("aria-selected", x === b)); });
  if ($("#dosEdit")) $("#dosEdit").onclick = () => playerForm(p);
  $("#spEdit").onclick = () => scProfForm(p);
  if ($("#gAdd")) $("#gAdd").onclick = () => groeiForm(p);
  $$("[data-gE]", v).forEach(b => b.onclick = () => groeiForm(p, S.pmeas.find(x => x.id === b.dataset.gE)));
  if ($("#scAdd")) $("#scAdd").onclick = () => pScoutForm(p);
  $$("[data-scE]", v).forEach(b => b.onclick = () => pScoutForm(p, S.pscout.find(x => x.id === b.dataset.scE)));
} });

/* bij afdrukken staan ook de uitklapbare statistieken open */
window.addEventListener("beforeprint", () => document.querySelectorAll("details.dmore, details.dmatch").forEach(d => d.open = true));
