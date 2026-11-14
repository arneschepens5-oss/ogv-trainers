/* FootballCoachHub — interne scouting: alle spelers van de club op één plek, met zoeken en filteren.
   Beheerders en coördinatoren met toegang tot alle ploegen zien de hele club, een trainer ziet de spelers van zijn eigen ploegen. */
"use strict";
let IS = { q: "", team: "", pos: "", foot: "", quarter: "", half: "", year: "", mat: "", pot: "", min: "", sort: "ploeg", open: false };
const isAge = p => p.birthdate ? Math.floor((Date.now() - parse(p.birthdate)) / 3.15576e10) : null;
/* wie mag het dossier zelf openen? (eigen ploeg, coördinator of beheerder) — anderen krijgen een scoutingfiche zonder privégegevens */
const isOwn = tid => !!(S.admin || myTeams().some(t => t.id === tid));
/* gegevens: beheerders lezen de tabellen rechtstreeks; andere trainers via club_intscout (databaseversie 43), tenzij de beheerder het uitzette */
async function isData() {
  if (mode !== "demo" && !S.admin && !S.allTeams && S.intscout !== false) {
    const r = await sb.rpc("club_intscout");
    if (!r.error && r.data) return { all: true, T: r.data.teams || [], P: r.data.players || [], R: r.data.reports || [], M: r.data.measures || [] };
    if (r.error && !/club_intscout|function/i.test(r.error.message)) toast(r.error.message);
  }
  const all = !!(S.admin || S.allTeams) || mode === "demo", T = all ? S.teams.slice() : myTeams();
  const [P, R, M] = await Promise.all([db.list("players"), db.list("player_scout").catch(() => []), db.list("player_measures").catch(() => [])]);
  return { all, T, P, R, M };
}
const IS_F = [["team", "Ploeg"], ["pos", "Positie"], ["foot", "Voet"], ["year", "Geboortejaar"], ["quarter", "Kwartaal"], ["half", "Jaarhelft"], ["mat", "Maturiteit"], ["pot", "Potentieel"], ["min", "Score"]];
const IS_MAT = { vroeg: ["Vroegmatuur", "#F59E0B"], normaal: ["Normaal matuur", "#10B981"], laat: ["Laatmatuur", "#3B82F6"] };

route("intscouting", { title: "Interne scouting", auth: true, render: async v => {
  v.innerHTML = head("Interne scouting", "Laden…");
  const D = await isData(), teamsAll = D.T, ids = new Set(teamsAll.map(t => t.id)), T = Object.fromEntries(teamsAll.map(t => [t.id, t])), P = D.P, R = D.R, M = D.M;
  const all = P.filter(p => ids.has(p.team_id) && p.active !== false).map(p => {
    const sp = scProf(p), reps = R.filter(r => r.player_id === p.id), ms = M.filter(m => m.player_id === p.id && m.height_cm != null).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const pos = [sp.p1, sp.p2, sp.p3].filter(Boolean), q = p.birthdate ? Math.floor(parse(p.birthdate).getMonth() / 3) + 1 : 0;
    const fichePos = String(p.position || "").replace(/^\d+\s*·\s*/, "");
    return { p, sp, repsL: reps, msL: M.filter(m => m.player_id === p.id).sort((a, b) => String(a.date).localeCompare(String(b.date))), name: pname(p), team: T[p.team_id], pos, fichePos, q, half: q ? (q <= 2 ? 1 : 2) : 0, year: p.birthdate ? parse(p.birthdate).getFullYear() : 0, age: isAge(p), avg: scAvg(sp), reps: reps.length,
      len: ms.length ? ms[ms.length - 1].height_cm : (+sp.len || null),
      hay: [pname(p), p.position, p.foot, p.notes, sp.sterk, sp.werk, sp.ctx, sp.p1, sp.p2, sp.p3, sp.pot, T[p.team_id]?.name, ...reps.flatMap(r => [r.title, r.notes, r.strengths, r.workpoints])].filter(Boolean).join(" ").toLowerCase() }; });
  const years = [...new Set(all.map(x => x.year).filter(Boolean))].sort((a, b) => b - a);
  const teams = teamsAll.filter(t => all.some(x => x.p.team_id === t.id)).sort((a, b) => ((typeof ageOfTeam === "function" ? ageOfTeam(a) : null) ?? 99) - ((typeof ageOfTeam === "function" ? ageOfTeam(b) : null) ?? 99) || teamLbl(a).localeCompare(teamLbl(b), "nl", { numeric: true }));
  const OPTS = { team: [["", "Alle ploegen"], ...teams.map(t => [t.id, teamLbl(t)])], pos: [["", "Alle posities"], ...Object.keys(SC_POS).map(k => [k, k])], foot: [["", "Beide voeten"], ["Rechts", "Rechtsvoetig"], ["Links", "Linksvoetig"], ["Beide", "Tweevoetig"]],
    year: [["", "Alle jaren"], ...years.map(y => [y, "Geboren in " + y])], quarter: [["", "Alle kwartalen"], [1, "Q1 · jan–mrt"], [2, "Q2 · apr–jun"], [3, "Q3 · jul–sep"], [4, "Q4 · okt–dec"]], half: [["", "Hele jaar"], [1, "Eerste jaarhelft"], [2, "Tweede jaarhelft"]],
    mat: [["", "Alle maturiteit"], ["vroeg", "Vroegmatuur"], ["normaal", "Normaal matuur"], ["laat", "Laatmatuur"], ["geen", "Maturiteit niet ingeschat"]], pot: [["", "Alle potentieel"], ...SC_POT.map(x => [x, "Potentieel " + x.toLowerCase()])],
    min: [["", "Elke score"], [5, "Score 5+"], [6, "Score 6+"], [7, "Score 7+"], [8, "Score 8+"]] };
  const lbl = (k, val) => (OPTS[k].find(o => String(o[0]) === String(val)) || [, val])[1];
  const nAct = () => IS_F.filter(([k]) => k !== "team" && IS[k]).length;

  v.innerHTML = `<div class="isc">
    <div class="isc-top"><div><h1 class="pg">Interne scouting${typeof helpLink === "function" ? helpLink() : ""}</h1>
      <p class="sub">${D.all ? "Alle spelers van " + esc(typeof clubName === "function" ? clubName() : "de club") : "De spelers van jouw ploegen"}, met hun scoutingprofiel, groei en rapporten. Alleen voor trainers.</p></div>
      <a class="btn ghost" href="#/scouting">${IC.scout}Scoutingsdatabase</a></div>
    <div class="isc-search"><span class="isc-ic">${IC.scout}</span><input type="search" id="isQ" placeholder="Zoek op naam, positie, kwaliteit of notitie, bv. 'linksachter snel'" value="${esc(IS.q)}" aria-label="Zoeken" autocomplete="off">
      <button type="button" class="isc-fbtn" id="isF" aria-expanded="${IS.open}">Filters<b id="isFn"${nAct() ? "" : " hidden"}>${nAct()}</b></button></div>
    <div class="isc-panel" id="isP"${IS.open ? "" : " hidden"}>${IS_F.filter(([k]) => k !== "team").map(([k, l]) => `<label><span>${l}</span><select data-f="${k}">${OPTS[k].map(([a, b]) => `<option value="${a}"${String(IS[k]) === String(a) ? " selected" : ""}>${esc(b)}</option>`).join("")}</select></label>`).join("")}
      <label><span>Sorteren</span><select id="isS">${[["ploeg", "Per ploeg"], ["naam", "Op naam"], ["oud", "Oudste eerst"], ["score", "Hoogste score"], ["pot", "Meeste potentieel"]].map(([a, b]) => `<option value="${a}"${IS.sort === a ? " selected" : ""}>${b}</option>`).join("")}</select></label></div>
    ${teams.length > 1 ? `<div class="isc-teams" role="tablist" aria-label="Ploeg">${[["", "Alle"], ...teams.map(t => [t.id, teamLbl(t)])].map(([id, l]) => `<button type="button" role="tab" data-tm="${id}" aria-selected="${IS.team === id}">${esc(l)}<small>${id ? all.filter(x => x.p.team_id === id).length : all.length}</small></button>`).join("")}</div>` : ""}
    <div class="isc-act" id="isA"></div>
    <div id="isL"></div></div>`;

  const card = x => { const m = IS_MAT[x.p.maturity], pi = SC_POT.indexOf(x.sp.pot || ""), posTag = x.pos[0] ? SC_POS[x.pos[0]]?.[0] : "";
    return `<button type="button" class="isc-card" data-open="${x.p.id}" data-t="${x.p.team_id}">
      <span class="isc-av">${x.p.photo ? `<img data-pp="${esc(x.p.photo)}" alt="" draggable="false">` : `<b>${esc((x.p.first_name || "?").slice(0, 1).toUpperCase())}</b>`}${x.p.number != null ? `<i>${x.p.number}</i>` : ""}</span>
      <span class="isc-main"><b>${esc(x.name)}</b><small>${esc([IS.sort === "ploeg" ? "" : x.team ? teamLbl(x.team) : "", x.age != null ? x.age + " jaar" : "", x.q ? "Q" + x.q : "", x.len ? Math.round(x.len) + " cm" : ""].filter(Boolean).join(" · "))}</small>
        <span class="isc-tags">${posTag ? `<em title="${esc(x.pos.join(", "))}">${esc(posTag)}</em>` : x.fichePos ? `<em class="soft">${esc(x.fichePos)}</em>` : ""}${m ? `<span class="isc-mat" style="--c:${m[1]}">${m[0]}</span>` : ""}${x.reps ? `<span class="isc-rep">${x.reps} ${x.reps === 1 ? "rapport" : "rapporten"}</span>` : ""}</span>
        ${pi >= 0 ? `<span class="isc-pot" title="Potentieel: ${esc(x.sp.pot)}">${SC_POT.map((_, i) => `<i${i <= pi ? " class=on" : ""}></i>`).join("")}<span>${esc(x.sp.pot)}</span></span>` : ""}</span>
      <span class="isc-score${x.avg == null ? " none" : ""}" style="--v:${x.avg == null ? 0 : x.avg * 10}">${x.avg == null ? "–" : f1(x.avg)}</span></button>`; };

  const draw = () => {
    const words = IS.q.toLowerCase().split(/\s+/).filter(Boolean), res = all.filter(x => (!words.length || words.every(w => x.hay.includes(w))) && (!IS.team || x.p.team_id === IS.team)
      && (!IS.pos || x.pos.includes(IS.pos)) && (!IS.foot || x.p.foot === IS.foot) && (!IS.quarter || x.q === +IS.quarter) && (!IS.half || x.half === +IS.half)
      && (!IS.year || x.year === +IS.year) && (!IS.mat || (IS.mat === "geen" ? !x.p.maturity : x.p.maturity === IS.mat)) && (!IS.pot || x.sp.pot === IS.pot) && (!IS.min || (x.avg != null && x.avg >= +IS.min)));
    const byName = (a, b) => a.name.localeCompare(b.name, "nl");
    res.sort({ ploeg: byName, naam: byName, oud: (a, b) => (a.p.birthdate || "9").localeCompare(b.p.birthdate || "9"), score: (a, b) => (b.avg ?? -1) - (a.avg ?? -1) || byName(a, b), pot: (a, b) => SC_POT.indexOf(b.sp.pot || "") - SC_POT.indexOf(a.sp.pot || "") || byName(a, b) }[IS.sort]);
    const act = IS_F.filter(([k]) => k !== "team" && IS[k]);
    $("#isA").innerHTML = `<span class="isc-n"><b>${res.length}</b> ${res.length === 1 ? "speler" : "spelers"}${res.length !== all.length ? " van " + all.length : ""}</span>${act.map(([k]) => `<button type="button" class="isc-chip" data-x="${k}">${esc(lbl(k, IS[k]))}${IC.x}</button>`).join("")}${act.length || IS.q ? `<button type="button" class="isc-clear" id="isC">Alles wissen</button>` : ""}`;
    const fn = $("#isFn"); fn.textContent = nAct(); fn.hidden = !nAct();
    const grid = xs => `<div class="isc-grid">${xs.map(card).join("")}</div>`;
    $("#isL").innerHTML = !all.length ? `<div class="empty"><b>Nog geen spelers</b>Voeg spelers toe aan een ploeg, dan verschijnen ze hier.</div>`
      : !res.length ? `<div class="empty"><b>Geen spelers gevonden</b>Probeer een ander zoekwoord of wis een filter.</div>`
      : IS.sort === "ploeg" && !IS.team ? teams.map(t => { const xs = res.filter(x => x.p.team_id === t.id); return xs.length ? `<section class="isc-grp"><h2>${esc(teamLbl(t))}<small>${xs.length}</small></h2>${grid(xs)}</section>` : ""; }).join("")
      : grid(res);
    $$("[data-x]", $("#isA")).forEach(b => b.onclick = () => { IS[b.dataset.x] = ""; const s = $(`[data-f="${b.dataset.x}"]`); if (s) s.value = ""; draw(); });
    if ($("#isC")) $("#isC").onclick = () => { IS_F.forEach(([k]) => { if (k !== "team") IS[k] = ""; }); IS.q = ""; $("#isQ").value = ""; $$("[data-f]", v).forEach(s => s.value = ""); draw(); };
    $$("[data-open]", $("#isL")).forEach(el => el.onclick = async () => { if (!isOwn(el.dataset.t)) { isFiche(all.find(x => x.p.id === el.dataset.open)); return; } if (S.team?.id !== el.dataset.t) await loadTeam(el.dataset.t); dosTab = "overzicht"; go("#/dossier/" + el.dataset.open); });
  };
  $("#isQ").oninput = e => { IS.q = e.target.value; draw(); };
  $("#isF").onclick = () => { IS.open = !IS.open; $("#isP").hidden = !IS.open; $("#isF").setAttribute("aria-expanded", IS.open); };
  $$("[data-f]", v).forEach(s => s.onchange = () => { IS[s.dataset.f] = s.value; draw(); });
  $("#isS").onchange = e => { IS.sort = e.target.value; draw(); };
  $$("[data-tm]", v).forEach(b => b.onclick = () => { IS.team = b.dataset.tm; $$("[data-tm]", v).forEach(x => x.setAttribute("aria-selected", x === b)); draw(); });
  draw();
} });

/* scoutingfiche van een speler van een andere ploeg: alleen-lezen, zonder contactgegevens, notities of foto */
function isFiche(x) {
  if (!x) return; const sp = x.sp, m = IS_MAT[x.p.maturity], pi = SC_POT.indexOf(sp.pot || ""), pos = [sp.p1, sp.p2, sp.p3].filter(Boolean);
  const k = SC_COMP.map((c, i) => [c, sp["k" + i]]).filter(([, n]) => scNum(n)), txt = t => esc(t).replace(/\n/g, "<br>");
  const d = dialog(`<form class="isf" onsubmit="return false"><div class="isf-head"><span class="isc-av"><b>${esc((x.p.first_name || "?").slice(0, 1).toUpperCase())}</b>${x.p.number != null ? `<i>${x.p.number}</i>` : ""}</span>
      <div><h2 style="margin:0">${esc(x.name)}</h2><p class="muted" style="margin:2px 0 0">${esc([x.team ? teamLbl(x.team) : "", x.age != null ? x.age + " jaar" : "", x.q ? "Q" + x.q : "", x.p.foot ? x.p.foot.toLowerCase() + "voetig" : ""].filter(Boolean).join(" · "))}</p></div>
      ${x.avg != null ? `<span class="isc-score" style="--v:${x.avg * 10};margin-left:auto">${f1(x.avg)}</span>` : ""}</div>
    <div class="isf-tags">${pos.map((p0, i) => `<span class="pill${i ? " g" : " w"}">${esc(p0)}</span>`).join("")}${!pos.length && x.fichePos ? `<span class="pill g">${esc(x.fichePos)}</span>` : ""}${m ? `<span class="isc-mat" style="--c:${m[1]}">${m[0]}</span>` : ""}${pi >= 0 ? `<span class="isc-pot">${SC_POT.map((_, i) => `<i${i <= pi ? " class=on" : ""}></i>`).join("")}<span>Potentieel ${esc(sp.pot.toLowerCase())}</span></span>` : ""}</div>
    ${k.length ? `<h3 class="dosh">Scoutingprofiel</h3><div class="isf-bars">${k.map(([c, n]) => `<div><span>${esc(c)}</span><b><i style="width:${n * 10}%"></i></b><em>${f1(n)}</em></div>`).join("")}</div>` : ""}
    ${sp.sterk ? `<h3 class="dosh">Sterktes</h3><p>${txt(sp.sterk)}</p>` : ""}${sp.werk ? `<h3 class="dosh">Werkpunten</h3><p>${txt(sp.werk)}</p>` : ""}${sp.ctx ? `<h3 class="dosh">Extra info</h3><p>${txt(sp.ctx)}</p>` : ""}
    ${x.msL.some(q => q.height_cm != null) ? `<h3 class="dosh">Lengte</h3>${gChart(x.msL, "height_cm", "cm", "#FFD100")}` : ""}
    ${x.repsL.length ? `<h3 class="dosh">Scoutingrapporten</h3><div class="dosnotes">${x.repsL.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(r => `<div class="dosnote"><div style="flex:1"><div class="dosmeta"><b>${esc(dShort(r.date))}</b>${r.title ? " · " + esc(r.title) : ""}${r.by_name ? ` <small class="muted">· ${esc(r.by_name)}</small>` : ""}</div>${r.notes ? `<p>${txt(r.notes)}</p>` : ""}${r.strengths ? `<p><b>Sterk:</b> ${esc(r.strengths)}</p>` : ""}${r.workpoints ? `<p><b>Werkpunt:</b> ${esc(r.workpoints)}</p>` : ""}</div></div>`).join("")}</div>` : ""}
    ${!k.length && !sp.sterk && !sp.werk && !sp.ctx && !x.repsL.length ? `<p class="hint">Er is nog geen scoutingprofiel ingevuld voor deze speler.</p>` : ""}
    <p class="hint" style="margin:14px 0 0">Scoutingfiche van een speler van een andere ploeg. Contactgegevens, notities en aanwezigheden zie je enkel als trainer van die ploeg.</p>
    <div class="row"><span class="spacer"></span><button class="btn" type="button" data-close>Sluiten</button></div></form>`);
  return d;
}
