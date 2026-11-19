/* FootballCoachHub — interne scouting: alle spelers van de club op één plek, met zoeken, filteren en het spelersprofiel.
   Beheerders en coördinatoren met toegang tot alle ploegen zien de hele club, een trainer ziet (tenzij uitgezet) ook de andere ploegen,
   maar dan zonder contactgegevens, notities of foto's. De scores komen uit de evaluaties van de trainers, ook van vorige seizoenen. */
"use strict";
const IS_DEF = { q: "", team: "", cat: "", fmt: "", pos: "", posm: "", foot: "", quarter: "", half: "", year: "", mat: "", opl: "", pot: "", adv: "", min: "", ax: "", axmin: "", ev: "", sort: "ploeg" };
let IS = { ...IS_DEF, open: false };
const isAge = p => p.birthdate ? Math.floor((Date.now() - parse(p.birthdate)) / 3.15576e10) : null;
/* wie mag het dossier zelf openen? (eigen ploeg, coördinator of beheerder) — anderen krijgen een scoutingfiche zonder privégegevens */
const isOwn = tid => !!(S.admin || myTeams().some(t => t.id === tid));
/* gegevens: beheerders lezen de tabellen rechtstreeks; andere trainers via club_intscout (databaseversie 43, evaluaties vanaf 53), tenzij de beheerder het uitzette */
async function isData() {
  if (mode !== "demo" && !S.admin && !S.allTeams && S.intscout !== false) {
    const r = await sb.rpc("club_intscout");
    if (!r.error && r.data) return { all: true, T: r.data.teams || [], P: r.data.players || [], R: r.data.reports || [], M: r.data.measures || [], E: r.data.evals || [], evOk: Array.isArray(r.data.evals) };
    if (r.error && !/club_intscout|function/i.test(r.error.message)) toast(r.error.message);
  }
  const all = !!(S.admin || S.allTeams) || mode === "demo", T = all ? S.teams.slice() : myTeams();
  const [P, R, M, E] = await Promise.all([db.list("players"), db.list("player_scout").catch(() => []), db.list("player_measures").catch(() => []), db.list("evaluations").catch(() => [])]);
  return { all, T, P, R, M, E, evOk: true };
}
const IS_MAT = { vroeg: ["Vroegmatuur", "#F59E0B"], normaal: ["Normaal matuur", "#10B981"], laat: ["Laatmatuur", "#3B82F6"] };
const IS_FOOT = f => /twee|beide/i.test(f || "") ? "Beide" : /links/i.test(f || "") ? "Links" : /rechts/i.test(f || "") ? "Rechts" : "";
const isFmt = t => { const f = String(t?.format || ""); if (f) return f; const a = typeof evAgeOf === "function" ? evAgeOf(t || {}) : 99; return a <= 9 ? "5v5" : a <= 13 ? "8v8" : "11v11"; };
const isCat = t => (String(t?.category || t?.name || "").match(/U\s?\d+/i) || [""])[0].replace(/\s/, "").toUpperCase() || (t?.category || "");
/* potentieel op één ladder van 0 tot 3: eerst uit de laatste evaluatie, anders uit het scoutingprofiel */
const isPotIdx = (lastE, sp) => { const v = lastE?.details?.open?.potentieel; const i = EV_POT.indexOf(v); return i >= 0 ? i : SC_POT.indexOf(sp.pot || ""); };

/* één rij per speler met alles waarop je kan zoeken */
function isRows(D, gm) {
  const T = Object.fromEntries(D.T.map(t => [t.id, t])), ids = new Set(D.T.map(t => t.id));
  const evBy = {}; (D.E || []).forEach(e => (evBy[e.player_id] = evBy[e.player_id] || []).push(e));
  return D.P.filter(p => ids.has(p.team_id) && p.active !== false).map(p => {
    const sp = scProf(p), team = T[p.team_id], reps = D.R.filter(r => r.player_id === p.id), msL = D.M.filter(m => m.player_id === p.id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const list = pfList(p, evBy[p.id] || [], team?.season), scored = list.map(e => ({ ...e, vals: pfVals(e.scores, gm) })).filter(e => Object.keys(e.vals).length);
    const last = scored[scored.length - 1] || null, prev = scored[scored.length - 2] || null, axes = last ? pfAxes(last.vals, gm).filter(a => !gm.keep.has(a) || evIsKeeper(p)) : [];
    const tot = last ? pfTotal(last.vals, axes.length ? axes : Object.keys(last.vals)) : null, ptot = prev ? pfTotal(prev.vals, axes) : null;
    const q = p.birthdate ? Math.floor(parse(p.birthdate).getMonth() / 3) + 1 : 0, ps = posOf(p), lens = msL.filter(m => m.height_cm != null);
    const potI = isPotIdx(last, sp), adv = last?.details?.open?.advies || last?.details?.advice || "";
    return { p, sp, team, list, last, axes, tot, evo: tot != null && ptot != null ? tot - ptot : null, ps, q, half: q ? (q <= 2 ? 1 : 2) : 0, year: p.birthdate ? parse(p.birthdate).getFullYear() : 0, age: isAge(p),
      repsL: reps, msL, reps: reps.length, len: lens.length ? lens[lens.length - 1].height_cm : (+sp.len || null), potI, adv, cat: isCat(team), fmt: isFmt(team), foot: IS_FOOT(p.foot), name: pname(p),
      hay: [pname(p), p.position, p.foot, sp.sterk, sp.werk, sp.ctx, sp.ontw, sp.opm, ...[ps.h, ...ps.n].filter(Boolean).flatMap(n => [posName(n), posAb(n)]), team?.name, adv, last?.details?.strengths, last?.details?.workpoints,
        ...reps.flatMap(r => [r.title, r.notes, r.strengths, r.workpoints])].filter(Boolean).join(" ").toLowerCase() }; });
}

route("intscouting", { title: "Interne scouting", auth: true, render: async v => {
  if (!S.admin && S.intscout === false) { v.innerHTML = head("Interne scouting", "") + `<div class="empty"><b>Geen toegang</b>De beheerder heeft de interne scouting voor jou uitgezet.</div>`; return; }
  v.innerHTML = head("Interne scouting", "Laden…");
  const D = await isData(), gm = pfGroupMap(D.T.map(t => t.criteria || []).filter(c => c.length)), all = isRows(D, gm);
  const teams = D.T.filter(t => all.some(x => x.p.team_id === t.id)).sort((a, b) => (evAgeOf(a) - evAgeOf(b)) || teamLbl(a).localeCompare(teamLbl(b), "nl", { numeric: true }));
  const uniq = f => [...new Set(all.map(f).filter(Boolean))];
  const years = uniq(x => x.year).sort((a, b) => b - a), cats = uniq(x => x.cat).sort((a, b) => (parseInt(a.slice(1)) || 99) - (parseInt(b.slice(1)) || 99)), fmts = ["5v5", "8v8", "11v11"].filter(f => all.some(x => x.fmt === f));
  const axesAll = gm.order.filter(g => !PF_SKIP.test(g) && all.some(x => x.last?.vals[g] != null)), advs = uniq(x => x.adv);
  const advOrder = EV_OPEN_OGV.find(q => q.id === "advies").opts, advList = [...advOrder.filter(a => advs.includes(a)), ...advs.filter(a => !advOrder.includes(a))];
  const mins = [[2, "2 of meer"], [2.5, "2,5 of meer"], [3, "3 of meer"], [3.5, "3,5 of meer"], [4, "4 of meer"], [4.5, "4,5 of meer"]].map(([n, l]) => [n, EV_DISP === 2 ? (n * 2) + " of meer" : l]);
  const OPTS = { cat: [["", "Alle categorieën"], ...cats.map(c => [c, c])], fmt: [["", "Elk speelformaat"], ...fmts.map(f => [f, f])], posm: [["", "Hoofd- of nevenpositie"], ["h", "Enkel hoofdpositie"]],
    foot: [["", "Beide voeten"], ["Rechts", "Rechtsvoetig"], ["Links", "Linksvoetig"], ["Beide", "Tweevoetig"]], year: [["", "Alle jaren"], ...years.map(y => [y, "Geboren in " + y])],
    quarter: [["", "Alle kwartalen"], [1, "Q1 · jan–mrt"], [2, "Q2 · apr–jun"], [3, "Q3 · jul–sep"], [4, "Q4 · okt–dec"]], half: [["", "Hele jaar"], [1, "Eerste jaarhelft"], [2, "Tweede jaarhelft"]],
    mat: [["", "Alle maturiteit"], ["vroeg", "Vroegmatuur"], ["normaal", "Normaal matuur"], ["laat", "Laatmatuur"], ["geen", "Niet ingeschat"]], opl: [["", "Op leeftijd of niet"], ["Ja", "Speelt op leeftijd"], ["Nee - gedispenseerd", "Gedispenseerd"], ["Nee - doorgeschoven", "Doorgeschoven"]],
    pot: [["", "Elk potentieel"], ...EV_POT.map((x, i) => [i, "Minstens " + x.toLowerCase()])], adv: [["", "Elk advies"], ...advList.map(a => [a, a])], min: [["", "Elk gemiddelde"], ...mins],
    ax: [["", "Kies een blok"], ...axesAll.map(a => [a, a])], axmin: [["", "Elke score"], ...mins], ev: [["", "Met en zonder evaluatie"], ["met", "Met evaluatie"], ["zonder", "Nog geen evaluatie"]],
    pos: [["", "Alle posities"], ...POS11.map(([n, ab, nm]) => [n, n + " · " + nm])] };
  const SORTS = [["ploeg", "Per ploeg"], ["naam", "Op naam"], ["oud", "Oudste eerst"], ["jong", "Jongste eerst"], ["score", "Hoogste gemiddelde"], ...axesAll.map(a => ["ax:" + a, "Hoogste " + a.toLowerCase()]), ["evo", "Grootste groei"], ["pot", "Meeste potentieel"], ["laatste", "Laatst geëvalueerd"]];
  if (!SORTS.some(s => s[0] === IS.sort)) IS.sort = "ploeg";
  const FKEYS = ["cat", "fmt", "pos", "foot", "year", "quarter", "half", "mat", "opl", "pot", "adv", "min", "ax", "ev"];
  const lbl = (k, val) => k === "ax" ? `${val} ${(OPTS.axmin.find(o => String(o[0]) === String(IS.axmin)) || [, ""])[1]}`.trim() : k === "pos" ? (IS.posm === "h" ? "Hoofdpositie " : "Positie ") + val + " · " + posAb(+val) : (OPTS[k].find(o => String(o[0]) === String(val)) || [, val])[1];
  const nAct = () => FKEYS.filter(k => IS[k] !== "" && IS[k] != null).length;
  const sel = k => `<select data-f="${k}" aria-label="${k}">${OPTS[k].map(([a, b]) => `<option value="${a}"${String(IS[k]) === String(a) ? " selected" : ""}>${esc(b)}</option>`).join("")}</select>`;
  const fl = (l, k) => `<label><span>${l}</span>${sel(k)}</label>`;

  v.innerHTML = `<div class="isc">
    <div class="isc-top"><div><h1 class="pg">Interne scouting${typeof helpLink === "function" ? helpLink() : ""}</h1>
      <p class="sub">${D.all ? "Alle spelers van " + esc(typeof clubName === "function" ? clubName() : "de club") : "De spelers van jouw ploegen"}, met hun posities, spelersprofiel uit de evaluaties, groei en rapporten. Alleen voor trainers.</p></div>
      <div class="row" style="gap:8px">${S.admin ? `<button class="btn ghost" type="button" id="isImp">${IC.sheet}Excel importeren</button>` : ""}<a class="btn ghost" href="#/scouting">${IC.scout}Externe scouting</a></div></div>
    ${D.evOk === false ? `<p class="grpwarn">De scores van andere ploegen verschijnen zodra de beheerder <b>supabase-interne-scouting-v53.sql</b> uitvoert.</p>` : ""}
    <div class="isc-search"><span class="isc-ic">${IC.scout}</span><input type="search" id="isQ" placeholder="Zoek op naam, positie, kwaliteit of notitie, bv. 'linksachter snel'" value="${esc(IS.q)}" aria-label="Zoeken" autocomplete="off">
      <button type="button" class="isc-fbtn" id="isF" aria-expanded="${IS.open}">Filters<b id="isFn"${nAct() ? "" : " hidden"}>${nAct()}</b></button></div>
    <div class="isc-panel2" id="isP"${IS.open ? "" : " hidden"}>
      <section><h3>Speler</h3><div class="isc-fg">${fl("Leeftijdscategorie", "cat")}${fl("Speelformaat", "fmt")}${fl("Geboortejaar", "year")}${fl("Kwartaal", "quarter")}${fl("Jaarhelft", "half")}${fl("Voorkeursvoet", "foot")}${fl("Maturiteit", "mat")}${fl("Op leeftijd", "opl")}</div></section>
      <section><h3>Positie</h3><div class="isc-posrow"><div class="pos11 pick sm" id="isPos">${POS11.map(([n, ab, nm, x, y]) => `<button type="button" class="pp11${String(IS.pos) === String(n) ? " h" : ""}" data-fp="${n}" style="left:${x}%;top:${y}%" title="${n} · ${esc(nm)}"><b>${n}</b><small>${ab}</small></button>`).join("")}</div>
        <div class="isc-fg one">${fl("Positie", "pos")}${fl("Positie telt als", "posm")}</div></div></section>
      <section><h3>Niveau <small>uit de laatste evaluatie, schaal 1 tot ${evMaxTxt()}</small></h3><div class="isc-fg">${fl("Gemiddelde", "min")}<label><span>Minimum op een blok</span><span class="isc-two">${sel("ax")}${sel("axmin")}</span></label>${fl("Potentieel", "pot")}${fl("Advies", "adv")}${fl("Evaluatie", "ev")}</div></section>
      <section class="isc-sortrow"><label><span>Sorteren</span><select id="isS">${SORTS.map(([a, b]) => `<option value="${esc(a)}"${IS.sort === a ? " selected" : ""}>${esc(b)}</option>`).join("")}</select></label></section></div>
    ${teams.length > 1 ? `<div class="isc-teams" role="tablist" aria-label="Ploeg">${[["", "Alle"], ...teams.map(t => [t.id, teamLbl(t)])].map(([id, l]) => `<button type="button" role="tab" data-tm="${id}" aria-selected="${IS.team === id}">${esc(l)}<small>${id ? all.filter(x => x.p.team_id === id).length : all.length}</small></button>`).join("")}</div>` : ""}
    <div class="isc-act" id="isA"></div>
    <div id="isL"></div></div>`;

  const card = x => { const m = IS_MAT[x.p.maturity], pi = x.potI, h = x.ps.h, mini = x.axes.length >= 3 ? radarSvg(x.axes, x.last.vals, null, { mini: true, size: 64 }) : "";
    const sk = IS.sort.startsWith("ax:") ? IS.sort.slice(3) : "", sv = sk ? x.last?.vals[sk] : x.tot;
    return `<button type="button" class="isc-card" data-open="${x.p.id}" data-t="${x.p.team_id}">
      <span class="isc-av">${x.p.photo ? `<img data-pp="${esc(x.p.photo)}" alt="" draggable="false">` : `<b>${esc((x.p.first_name || "?").slice(0, 1).toUpperCase())}</b>`}${x.p.number != null ? `<i>${x.p.number}</i>` : ""}</span>
      <span class="isc-main"><b>${esc(x.name)}</b><small>${esc([IS.sort === "ploeg" && !IS.team ? "" : x.team ? teamLbl(x.team) : "", x.age != null ? x.age + " jaar" : "", x.q ? "Q" + x.q : "", x.len ? Math.round(x.len) + " cm" : ""].filter(Boolean).join(" · "))}</small>
        <span class="isc-tags">${h ? `<em title="${esc(posName(h))}">${h} ${esc(posAb(h))}</em>` : ""}${x.ps.n.length ? `<em class="soft" title="Ook inzetbaar: ${esc(x.ps.n.map(posName).join(", "))}">+ ${x.ps.n.join(", ")}</em>` : ""}${!h && !x.ps.n.length && x.p.position ? `<em class="soft">${esc(String(x.p.position).replace(/^\d+\s*·\s*/, ""))}</em>` : ""}
          ${m ? `<span class="isc-mat" style="--c:${m[1]}">${m[0]}</span>` : ""}${x.adv && !/behouden/i.test(x.adv) ? `<span class="isc-adv">${esc(x.adv)}</span>` : ""}${x.reps ? `<span class="isc-rep">${x.reps} ${x.reps === 1 ? "rapport" : "rapporten"}</span>` : ""}</span>
        ${pi >= 0 ? `<span class="isc-pot" title="Potentieel: ${esc(EV_POT[pi])}">${EV_POT.map((_, i) => `<i${i <= pi ? " class=on" : ""}></i>`).join("")}<span>${esc(EV_POT[pi])}</span></span>` : ""}</span>
      ${mini ? `<span class="isc-rad" title="Spelersprofiel">${mini}</span>` : ""}
      <span class="isc-sc"><span class="isc-score${sv == null ? " none" : ""}" style="--v:${sv == null ? 0 : sv * 20}" title="${sk ? esc(sk) : "Gemiddelde van de laatste evaluatie"}">${sv == null ? "–" : evF(sv)}</span>${!sk && x.evo != null && Math.abs(x.evo) >= 0.05 ? evDelta(x.evo) : ""}</span></button>`; };

  const match = x => { const words = IS.q.toLowerCase().split(/\s+/).filter(Boolean), pn = +IS.pos;
    return (!words.length || words.every(w => x.hay.includes(w))) && (!IS.team || x.p.team_id === IS.team) && (!IS.cat || x.cat === IS.cat) && (!IS.fmt || x.fmt === IS.fmt)
      && (!pn || x.ps.h === pn || (IS.posm !== "h" && x.ps.n.includes(pn))) && (!IS.foot || x.foot === IS.foot) && (!IS.quarter || x.q === +IS.quarter) && (!IS.half || x.half === +IS.half) && (!IS.year || x.year === +IS.year)
      && (!IS.mat || (IS.mat === "geen" ? !x.p.maturity : x.p.maturity === IS.mat)) && (!IS.opl || (x.sp.opl || "Ja") === IS.opl) && (IS.pot === "" || x.potI >= +IS.pot) && (!IS.adv || x.adv === IS.adv)
      && (!IS.min || (x.tot != null && x.tot >= +IS.min - 1e-9)) && (!IS.ax || !IS.axmin || (x.last?.vals[IS.ax] != null && x.last.vals[IS.ax] >= +IS.axmin - 1e-9)) && (!IS.ev || (IS.ev === "met") === !!x.last); };
  const draw = () => {
    const res = all.filter(match), byName = (a, b) => a.name.localeCompare(b.name, "nl"), num = (f) => (a, b) => (f(b) ?? -99) - (f(a) ?? -99) || byName(a, b);
    const ax = IS.sort.startsWith("ax:") ? IS.sort.slice(3) : "";
    res.sort(ax ? num(x => x.last?.vals[ax]) : { ploeg: byName, naam: byName, oud: (a, b) => (a.p.birthdate || "9").localeCompare(b.p.birthdate || "9"), jong: (a, b) => (b.p.birthdate || "0").localeCompare(a.p.birthdate || "0"),
      score: num(x => x.tot), evo: num(x => x.evo), pot: num(x => x.potI >= 0 ? x.potI : null), laatste: (a, b) => String(b.last?.date || "").localeCompare(String(a.last?.date || "")) || byName(a, b) }[IS.sort] || byName);
    const act = FKEYS.filter(k => IS[k] !== "" && IS[k] != null);
    $("#isA").innerHTML = `<span class="isc-n"><b>${res.length}</b> ${res.length === 1 ? "speler" : "spelers"}${res.length !== all.length ? " van " + all.length : ""}</span>${act.map(k => `<button type="button" class="isc-chip" data-x="${k}">${esc(lbl(k, IS[k]))}${IC.x}</button>`).join("")}${act.length || IS.q ? `<button type="button" class="isc-clear" id="isC">Alles wissen</button>` : ""}`;
    const fn = $("#isFn"); fn.textContent = nAct(); fn.hidden = !nAct();
    const grid = xs => `<div class="isc-grid">${xs.map(card).join("")}</div>`;
    $("#isL").innerHTML = !all.length ? `<div class="empty"><b>Nog geen spelers</b>Voeg spelers toe aan een ploeg, dan verschijnen ze hier.</div>`
      : !res.length ? `<div class="empty"><b>Geen spelers gevonden</b>${IS.min || IS.axmin ? "Spelers zonder evaluatie hebben nog geen scores: zodra je op een score filtert, vallen ze weg. " : ""}Probeer een ander zoekwoord of wis een filter.</div>`
      : IS.sort === "ploeg" && !IS.team ? teams.map(t => { const xs = res.filter(x => x.p.team_id === t.id); return xs.length ? `<section class="isc-grp"><h2>${esc(teamLbl(t))}<small>${xs.length}</small></h2>${grid(xs)}</section>` : ""; }).join("")
      : grid(res);
    $$("[data-x]", $("#isA")).forEach(b => b.onclick = () => { const k = b.dataset.x; IS[k] = ""; if (k === "ax") IS.axmin = ""; syncF(); draw(); });
    if ($("#isC")) $("#isC").onclick = () => { Object.assign(IS, { ...IS_DEF, sort: IS.sort, team: IS.team, open: IS.open }); $("#isQ").value = ""; syncF(); draw(); };
    $$("[data-open]", $("#isL")).forEach(el => el.onclick = async () => { const x = all.find(y => y.p.id === el.dataset.open);
      isFiche(x, all, gm, D, isOwn(el.dataset.t)); });
    if (typeof hydratePhotos === "function") hydratePhotos(v);
  };
  const syncF = () => { $$("[data-f]", v).forEach(s => s.value = IS[s.dataset.f] ?? ""); $$("[data-fp]", v).forEach(b => b.classList.toggle("h", String(IS.pos) === b.dataset.fp)); };
  $("#isQ").oninput = e => { IS.q = e.target.value; draw(); };
  $("#isF").onclick = () => { IS.open = !IS.open; $("#isP").hidden = !IS.open; $("#isF").setAttribute("aria-expanded", IS.open); };
  $$("[data-f]", v).forEach(s => s.onchange = () => { IS[s.dataset.f] = s.value; if (s.dataset.f === "ax" && s.value && !IS.axmin) IS.axmin = 3; if (s.dataset.f === "axmin" && s.value && !IS.ax) IS.ax = axesAll[0] || ""; syncF(); draw(); });
  $$("[data-fp]", v).forEach(b => b.onclick = () => { IS.pos = String(IS.pos) === b.dataset.fp ? "" : b.dataset.fp; syncF(); draw(); });
  $("#isS").onchange = e => { IS.sort = e.target.value; draw(); };
  $$("[data-tm]", v).forEach(b => b.onclick = () => { IS.team = b.dataset.tm; $$("[data-tm]", v).forEach(x => x.setAttribute("aria-selected", x === b)); draw(); });
  if ($("#isImp")) $("#isImp").onclick = () => scImport(D);
  draw();
  /* terug uit een spelersdossier: dezelfde filters en dezelfde plek in de lijst */
  if (IS.scroll) { const y = IS.scroll; IS.scroll = 0; requestAnimationFrame(() => window.scrollTo(0, y)); }
} });

/* scoutingfiche van een speler van een andere ploeg: alleen-lezen, zonder contactgegevens, notities of foto */
function isFiche(x, all, gm, D, own = false) {
  if (!x) return; const sp = x.sp, m = IS_MAT[x.p.maturity], pi = x.potI;
  const k = SC_COMP.map((c, i) => [c, sp["k" + i]]).filter(([, n]) => scNum(n)), txt = t => esc(t).replace(/\n/g, "<br>");
  const d = dialog(`<form class="isf" onsubmit="return false"><div class="isf-head"><span class="isc-av"><b>${esc((x.p.first_name || "?").slice(0, 1).toUpperCase())}</b>${x.p.number != null ? `<i>${x.p.number}</i>` : ""}</span>
      <div><h2 style="margin:0">${esc(x.name)}</h2><p class="muted" style="margin:2px 0 0">${esc([x.team ? teamLbl(x.team) : "", x.age != null ? x.age + " jaar" : "", x.q ? "Q" + x.q : "", x.foot ? x.foot.toLowerCase() + "voetig" : ""].filter(Boolean).join(" · "))}</p></div>
      ${x.tot != null ? `<span class="isc-score" style="--v:${x.tot * 20};margin-left:auto">${evF(x.tot)}</span>` : ""}</div>
    <div class="isf-tags">${x.ps.h ? `<span class="pill w">${x.ps.h} · ${esc(posName(x.ps.h))}</span>` : ""}${x.ps.n.map(n => `<span class="pill g">${n} · ${esc(posName(n))}</span>`).join("")}${sp.ontw ? `<span class="pill g">Ontwikkelen naar ${esc(sp.ontw)}</span>` : ""}
      ${m ? `<span class="isc-mat" style="--c:${m[1]}">${m[0]}</span>` : ""}${pi >= 0 ? `<span class="isc-pot">${EV_POT.map((_, i) => `<i${i <= pi ? " class=on" : ""}></i>`).join("")}<span>Potentieel ${esc(EV_POT[pi].toLowerCase())}</span></span>` : ""}${x.adv ? `<span class="pill g">Advies: ${esc(x.adv)}</span>` : ""}</div>
    <div id="isfPf" class="isf-pf"></div>
    ${k.length ? `<h3 class="dosh">Scoutingprofiel</h3><div class="isf-bars">${k.map(([c, n]) => `<div><span>${esc(c)}</span><b><i style="width:${n * 10}%"></i></b><em>${f1(n)}</em></div>`).join("")}</div>` : ""}
    ${sp.sterk ? `<h3 class="dosh">Sterktes</h3><p>${txt(sp.sterk)}</p>` : ""}${sp.werk ? `<h3 class="dosh">Werkpunten</h3><p>${txt(sp.werk)}</p>` : ""}${sp.ctx ? `<h3 class="dosh">Extra info</h3><p>${txt(sp.ctx)}</p>` : ""}
    ${x.msL.some(q => q.height_cm != null) ? `<h3 class="dosh">Lengte</h3>${gChart(x.msL, "height_cm", "cm", "#FFD100")}` : ""}
    ${x.repsL.length ? `<h3 class="dosh">Scoutingrapporten</h3><div class="dosnotes">${x.repsL.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(r => `<div class="dosnote"><div style="flex:1"><div class="dosmeta"><b>${esc(dShort(r.date))}</b>${r.title ? " · " + esc(r.title) : ""}${r.by_name ? ` <small class="muted">· ${esc(r.by_name)}</small>` : ""}</div>${r.notes ? `<p>${txt(r.notes)}</p>` : ""}${r.strengths ? `<p><b>Sterk:</b> ${esc(r.strengths)}</p>` : ""}${r.workpoints ? `<p><b>Werkpunt:</b> ${esc(r.workpoints)}</p>` : ""}</div></div>`).join("")}</div>` : ""}
    <p class="hint" style="margin:14px 0 0">${own ? "Contactgegevens, notities, evaluaties en rapporten staan in het volledige dossier." : "Scoutingfiche van een speler van een andere ploeg. Contactgegevens, notities en de antwoorden op de open vragen zie je enkel als trainer van die ploeg."}</p>
    <div class="row"><span class="spacer"></span>${own ? `<button class="btn ghost" type="button" id="isfDos">${IC.book || ""}Volledig dossier</button>` : ""}<button class="btn" type="button" data-close>Sluiten</button></div></form>`, "xl");
  if (own) $("#isfDos", d).onclick = async () => { d.close(); IS.scroll = window.scrollY; dosBack = location.hash.startsWith("#/scoutveld") ? { href: "#/scoutveld", label: "Posities vergelijken" } : { href: "#/intscouting", label: "Interne scouting" };
    if (S.team?.id !== x.p.team_id) { if (!DOS_PREV) DOS_PREV = S.team?.id || null; await loadTeam(x.p.team_id); } dosTab = "overzicht"; go("#/dossier/" + x.p.id); };
  const others = all.filter(o => o.last && o.p.id !== x.p.id).sort((a, b) => (a.cat === x.cat ? 0 : 1) - (b.cat === x.cat ? 0 : 1) || a.name.localeCompare(b.name, "nl")).map(o => ({ id: o.p.id, name: o.name, team: o.team ? teamLbl(o.team) : "", list: o.list }));
  pfMount($("#isfPf", d), { p: x.p, list: x.list, gm, others, teamAvg: e => e.key && e.key[0] === "c" ? pfAvgScores((D.E || []).filter(q => q.team_id === x.p.team_id && q.moment === e.moment)) : null });
  return d;
}
