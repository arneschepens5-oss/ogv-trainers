/* FootballCoachHub — Excel van de interne scouting inlezen (enkel beheerders).
   Leest de tabbladen Spelers, Evaluaties en (optioneel) Evaluaties archief, zoekt elke speler in de app op naam en geboortedatum
   en vult posities, maturiteit en evaluaties aan. Bestaande scores of antwoorden in de app worden nooit overschreven.
   Het bestand zelf wordt niet bewaard: alles gebeurt in de browser van de beheerder. */
"use strict";
const IM_N = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/-\s*\n\s*/g, "").replace(/[\n\r]+/g, " ").replace(/[–—]/g, "-").replace(/\s*\*\s*$/, "").replace(/\s+/g, " ").trim();
const IM_NAME = s => IM_N(s).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
/* kolommen van het tabblad Evaluaties: begin van de kop → onderdeel van de fiche (scores) */
const IM_SCORES = [["dribbel", "Dribbel"], ["balvastheid", "Balvastheid en balbescherming"], ["eerste gerichte aanname", "Eerste gerichte aanname"], ["kopbaltechniek", "Kopbaltechniek"],
  ["uitvoeringssnelheid technische", "Uitvoeringssnelheid techniek"], ["uitvoeringssnelheid decision", "Snelheid van beslissen"], ["kwaliteitsvolle staande tackle", "Staande tackle"],
  ["traptechniek pass lv", "Pass linkervoet"], ["traptechniek pass rv", "Pass rechtervoet"], ["duelvaardigheid", "Duelvaardigheid"], ["versnellen met bal", "Versnellen met bal"],
  ["traptechniek lob/voorzet lv", "Lob en voorzet linkervoet"], ["traptechniek lob/voorzet rv", "Lob en voorzet rechtervoet"], ["doordraaien", "Doordraaien"], ["afwerking", "Afwerking"],
  ["aanspeelbaarheid", "Aanspeelbaarheid"], ["positiespel b+", "Positiespel B+"], ["positiespel b-", "Positiespel B-"], ["keuze aan de bal", "Keuze aan de bal"], ["omschakeling en reactie", "Omschakeling en reactie"],
  ["verdedigend gedrag", "Verdedigend gedrag"], ["scanning", "Scanning"], ["algemeen spelinzicht", "Algemeen spelinzicht"],
  ["durf/lef", "Durf en lef"], ["teamgeest", "Teamgeest"], ["zelfvertrouwen", "Zelfvertrouwen"], ["positieve ingesteldheid", "Positieve ingesteldheid"], ["consistentie", "Consistentie"], ["werkkracht/inzet", "Werkkracht en inzet"],
  ["doorzettingsvermogen", "Doorzettingsvermogen"], ["emotionele controle", "Emotionele controle"], ["zin voor initiatief", "Zin voor initiatief"], ["progressiehonger", "Progressiehonger"], ["zelfkritiek", "Zelfkritiek en zelfanalyse"],
  ["leiderschap", "Leiderschap"], ["verbale communicatie", "Verbale communicatie"], ["gedrag/respect/discipline", "Gedrag, respect en discipline"], ["winnaarstype", "Winnaarstype"],
  ["startsnelheid", "Startsnelheid (5 m)"], ["snelheid (20", "Snelheid (20 tot 30 m)"], ["wendbaarheid", "Wendbaarheid"], ["sprongkracht", "Sprongkracht"], ["coordinatie", "Coördinatie"], ["lenigheid", "Lenigheid"],
  ["stabiliteit", "Stabiliteit"], ["uithouding", "Uithouding"], ["duelkracht", "Duelkracht"],
  ["vangtechniek", "Vangtechniek"], ["duiken", "Duiken en valtechniek"], ["positiekeuze in doel", "Positiekeuze in doel"], ["uitkomen", "Uitkomen"], ["voetenwerk", "Voetenwerk en spel aan de voet"], ["uitworp", "Uitworp en uittrap"], ["coaching van de verdediging", "Coaching van de verdediging"]];
/* open velden: o:<id> = vraag van de fiche, d:<veld> = vast veld van de evaluatie */
const IM_OPEN = [["hoe goed ligt", "o:ligging"], ["op welke twee posities", "o:posities"], ["hoe betrokken", "o:betrokken"], ["hoe goed staat de speler open", "o:feedback"], ["hoe zou je de speler omschrijven", "o:omschrijving"],
  ["zijn er nog zaken", "o:aandacht"], ["varia", "o:varia"], ["welke rol neemt", "o:rol"], ["hoe schat je het voetbalplezier", "o:plezier"],
  ["sterke punten - techniek", "o:tech_sterk"], ["werkpunten - techniek", "o:tech_werk"], ["sterke punten - tactiek", "o:tact_sterk"], ["werkpunten - tactiek", "o:tact_werk"],
  ["sterke punten - mentaal", "o:ment_sterk"], ["werkpunten - mentaal", "o:ment_werk"], ["sterke punten - fysiek", "o:fys_sterk"], ["werkpunten - fysiek", "o:fys_werk"],
  ["positieve punten", "d:strengths"], ["werkpunten - waar willen we", "d:workpoints"], ["actieplan 1", "o:actie1"], ["actieplan 2", "o:actie2"], ["doelstelling", "d:goals"], ["smart", "o:smart"],
  ["in welke mate werden", "o:opvolging"], ["evolutie sinds", "o:evolutie"], ["hoe schat je het huidige niveau", "o:niveau"], ["welk competitieniveau", "o:competitie"], ["hoe schat je de ontwikkeling", "o:ontwikkeling"],
  ["licht je inschatting", "o:toelichting"], ["opmerkingen keeper", "o:keeper_opm"], ["potentieel", "o:potentieel"], ["advies", "o:advies"], ["volgende stap", "o:volgende_stap"],
  ["ploeg op dat moment", "d:team_then"], ["trainer / evaluator", "by"]];
/* oude fiche (tabblad Evaluaties archief): teksten; de rest met een score van 1 tot 5 bewaren we als "oude criteria" */
const IM_ARCH_TXT = [["sterktes", "d:strengths"], ["werkpunten", "d:workpoints"], ["algemene omschrijving", "o:omschrijving"], ["potentieel", "o:potentieel"], ["advies", "o:advies"], ["volgende stap", "o:volgende_stap"], ["trainer / evaluator", "by"], ["ploeg op dat moment", "d:team_then"]];
const IM_META = ["speler-id", "naam (automatisch)", "seizoen", "evaluatiemoment", "datum", "laatste evaluatie", "volgorde", "laatste_id"];

const imIso = v => { if (v == null || v === "") return null; if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0]; m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null; };
const imSeason = v => { const m = String(v ?? "").match(/(20\d{2})/); return m ? m[1] + "-" + (+m[1] + 1) : ""; };
const imSeasonOf = iso => { if (!iso) return ""; const d = parse(iso), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return y + "-" + (y + 1); };
const imScore = v => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return isNaN(n) || n < 0.5 || n > 5 ? null : Math.round(n * 2) / 2; };
const imTxt = v => v == null ? "" : typeof v === "number" ? String(v) : String(v).trim();
const imMat = v => /vroeg/i.test(v || "") ? "vroeg" : /laat/i.test(v || "") ? "laat" : /normaal/i.test(v || "") ? "normaal" : "";
const imFoot = v => /twee/i.test(v || "") ? "Beide" : /links/i.test(v || "") ? "Links" : /rechts/i.test(v || "") ? "Rechts" : "";
/* tabblad als rijen met de kop van rij "hdr" (0-gebaseerd); formules leveren hun bewaarde waarde */
function imSheet(X, wb, name, hdrHint) {
  const nm = wb.SheetNames.find(n => IM_N(n) === IM_N(name)); if (!nm) return null;
  const rows = X.utils.sheet_to_json(wb.Sheets[nm], { header: 1, raw: true, defval: null, blankrows: false });
  const hi = rows.findIndex(r => (r || []).some(c => IM_N(c) === hdrHint)); if (hi < 0) return null;
  return { head: rows[hi].map(IM_N), rows: rows.slice(hi + 1).filter(r => r && r.some(c => c != null && c !== "")) };
}
const imCol = (head, pre) => head.findIndex(h => h && h.startsWith(pre));

/* de evaluatiemomenten van de club: eerst op naam (begin, winterstop, einde), anders op datum */
function imMoment(name, iso, team) {
  const n = IM_N(name), find = rx => EV_MOMENTS.find(m => rx.test(IM_N(m.naam)));
  const byName = /begin|start/.test(n) ? find(/start|begin/) : /winter|tussentijd/.test(n) ? find(/winter/) || find(/tussen/) : /einde/.test(n) ? find(/einde/) : null;
  if (byName) return byName.m;
  if (iso && team) { const d = parse(iso); for (const mo of EV_MOMENTS) { const w = evWindow(mo, team); if (d >= w.from && d <= w.to) return mo.m; }
    let best = null, bd = 1e15; for (const mo of EV_MOMENTS) { const w = evWindow(mo, team), dd = Math.min(Math.abs(d - w.from), Math.abs(d - w.to)); if (dd < bd) { bd = dd; best = mo.m; } } return best; }
  return null;
}

/* inlezen en koppelen, zonder iets te bewaren */
function imAnalyse(X, wb, D) {
  const SP = imSheet(X, wb, "Spelers", "speler-id"), EV = imSheet(X, wb, "Evaluaties", "speler-id"), AR = imSheet(X, wb, "Evaluaties archief", "speler-id");
  if (!SP) throw new Error("Geen tabblad 'Spelers' met een kolom 'Speler-ID' gevonden. Kies het Excel-bestand van de interne scouting.");
  const h = SP.head, c = k => imCol(h, k), posCols = h.map((x, i) => { const m = String(x || "").match(/^(\d{1,2}) [a-z]/); return m && +m[1] >= 1 && +m[1] <= 11 ? [i, +m[1]] : null; }).filter(Boolean);
  const ci = { id: c("speler-id"), vn: c("voornaam"), fn: c("familienaam"), bd: c("geboortedatum"), cat: c("leeftijdscategorie"), pcat: c("spelende categorie"), ploeg: h.findIndex(x => x === "ploeg"), opl: c("op leeftijd"), voet: c("voorkeursvoet"), mat: c("maturiteit"), ontw: c("ontwikkelen naar"), opm: c("opmerkingen") };
  const xs = SP.rows.map(r => { const id = imTxt(r[ci.id]); if (!id || !(imTxt(r[ci.vn]) || imTxt(r[ci.fn]))) return null;
    const pos = { h: null, n: [] }; posCols.forEach(([i, n]) => { const v = IM_N(r[i]); if (v === "h" && !pos.h) pos.h = n; else if (v === "h" || v === "n") pos.n.push(n); });
    return { id, first: imTxt(r[ci.vn]), last: imTxt(r[ci.fn]), birth: imIso(r[ci.bd]), cat: imTxt(r[ci.cat]), pcat: ci.pcat >= 0 ? imTxt(r[ci.pcat]) : "", ploeg: ci.ploeg >= 0 ? imTxt(r[ci.ploeg]) : "", opl: ci.opl >= 0 ? imTxt(r[ci.opl]) : "",
      foot: imFoot(r[ci.voet]), mat: imMat(r[ci.mat]), pos, ontw: ci.ontw >= 0 ? imTxt(r[ci.ontw]) : "", opm: ci.opm >= 0 ? imTxt(r[ci.opm]) : "" }; }).filter(Boolean)
    .filter(x => !/^voorbeeld/i.test(x.first + " " + x.last));
  /* spelers van de club in de app koppelen: geboortedatum + familienaam + voornaam, dan volledige naam, dan geboortedatum + één van beide namen */
  const app = D.P.filter(p => p.active !== false), T = Object.fromEntries(D.T.map(t => [t.id, t]));
  const key = (f, l) => IM_NAME(f).split(" ")[0] + "|" + IM_NAME(l).replace(/ /g, "");
  for (const x of xs) {
    const k = key(x.first, x.last), full = IM_NAME(x.first + " " + x.last).replace(/ /g, "");
    let hit = app.filter(p => p.birthdate && x.birth && p.birthdate === x.birth && key(p.first_name, p.last_name) === k);
    if (hit.length !== 1) hit = app.filter(p => IM_NAME(p.first_name + " " + p.last_name).replace(/ /g, "") === full);
    if (hit.length === 1) { x.match = hit[0]; x.how = x.birth && hit[0].birthdate && hit[0].birthdate !== x.birth ? "naam" : "zeker"; continue; }
    const loose = app.filter(p => x.birth && p.birthdate === x.birth && (IM_NAME(p.last_name).replace(/ /g, "") === IM_NAME(x.last).replace(/ /g, "") || IM_NAME(p.first_name).split(" ")[0] === IM_NAME(x.first).split(" ")[0]));
    if (loose.length === 1) { x.match = loose[0]; x.how = "controleer"; } else { x.match = null; x.how = "niet"; x.cands = app.filter(p => x.birth && p.birthdate && p.birthdate.slice(0, 4) === x.birth.slice(0, 4)).sort((a, b) => pname(a).localeCompare(pname(b), "nl")); }
  }
  /* evaluaties */
  const evs = [];
  const readEval = (S0, arch) => { if (!S0) return; const hh = S0.head, col = k => imCol(hh, k);
    const m = { id: col("speler-id"), s: col("seizoen"), mo: col("evaluatiemoment"), d: hh.findIndex(x => x === "datum") };
    const sc = arch ? [] : IM_SCORES.map(([pre, name]) => [hh.findIndex(x => x && x.startsWith(pre) && !x.startsWith("sterke") && !x.startsWith("werkpunten")), name]).filter(([i]) => i >= 0);
    const op = (arch ? IM_ARCH_TXT : IM_OPEN).map(([pre, to]) => [hh.findIndex(x => x && x.startsWith(pre)), to]).filter(([i]) => i >= 0);
    const used = new Set([...Object.values(m), ...sc.map(x => x[0]), ...op.map(x => x[0])]);
    const oldCols = arch ? hh.map((x, i) => x && !used.has(i) && !IM_META.includes(x) && !/^(gem\.|opmerkingen)/.test(x) ? i : -1).filter(i => i >= 0) : [];
    const oldTxt = arch ? hh.map((x, i) => x && /^opmerkingen/.test(x) ? i : -1).filter(i => i >= 0) : [];
    for (const r of S0.rows) { const pid = imTxt(r[m.id]); if (!pid) continue;
      const e = { pid, arch, season: imSeason(r[m.s]), momentName: imTxt(r[m.mo]), date: imIso(r[m.d]), scores: {}, open: {}, det: {}, by: "", old: {}, oldTxt: {} };
      sc.forEach(([i, name]) => { const v = imScore(r[i]); if (v != null) e.scores[name] = v; });
      op.forEach(([i, to]) => { let v = r[i]; if (v == null || v === "") return; v = to === "o:betrokken" || to === "o:feedback" || to === "o:opvolging" ? String(Math.round(+v) || imTxt(v)) : imTxt(v); if (!v) return;
        if (to === "by") e.by = v; else if (to.startsWith("o:")) e.open[to.slice(2)] = v; else e.det[to.slice(2)] = v; });
      oldCols.forEach(i => { const v = imScore(r[i]); if (v != null) e.old[S0.head[i]] = v; });
      oldTxt.forEach(i => { const v = imTxt(r[i]); if (v) e.oldTxt[S0.head[i]] = v; });
      if (!e.season) e.season = imSeasonOf(e.date);
      if (!Object.keys(e.scores).length && !Object.keys(e.open).length && !Object.keys(e.det).length && !Object.keys(e.old).length && !Object.keys(e.oldTxt).length) continue;
      if (!e.season && !e.momentName) continue;
      evs.push(e); } };
  readEval(EV, false); readEval(AR, true);
  return { xs, evs, T, hasEval: !!EV, hasArch: !!AR };
}

/* één evaluatie samenvoegen in een bestaande: enkel lege velden aanvullen */
function imMerge(target, e, stat) {
  target.scores = { ...(target.scores || {}) }; target.details = { ...(target.details || {}) }; const D = target.details; D.open = { ...(D.open || {}) };
  let add = 0, clash = 0;
  for (const [k, v] of Object.entries(e.scores)) { if (target.scores[k] == null || target.scores[k] === "") { target.scores[k] = v; add++; } else if (+target.scores[k] !== v) clash++; }
  for (const [k, v] of Object.entries(e.open)) { if (D.open[k] == null || D.open[k] === "") { D.open[k] = v; add++; } else if (String(D.open[k]) !== String(v)) clash++; }
  for (const [k, v] of Object.entries(e.det)) { if (!D[k]) { D[k] = v; add++; } else if (String(D[k]) !== String(v)) clash++; }
  if (Object.keys(e.old).length) D.oud = { ...e.old, ...(D.oud || {}) };
  if (Object.keys(e.oldTxt).length) D.oud_txt = { ...e.oldTxt, ...(D.oud_txt || {}) };
  if (e.by) { D.by = D.by || e.by; D.by_all = [...new Set([...(D.by_all || []), e.by])]; }
  if (!target.date && e.date) target.date = e.date;
  if (!Object.keys(D.open).length) delete D.open;
  D.import = D.import || todayIso();
  stat.add += add; stat.clash += clash; return add > 0 || Object.keys(e.old).length > 0;
}

/* alles schrijven; geeft een verslag terug */
async function imWrite(A, D, prog) {
  const stat = { players: 0, evNew: 0, evAdd: 0, hist: 0, add: 0, clash: 0, skipped: 0, noMoment: 0 };
  const byPid = new Map(A.xs.filter(x => x.match).map(x => [x.id, x]));
  const work = new Map(); /* player.id -> { p (bewerkte kopie), dirty } */
  const getP = p => { if (!work.has(p.id)) work.set(p.id, { p: { ...p, scout: { ...(p.scout && typeof p.scout === "object" ? p.scout : {}) }, history: (Array.isArray(p.history) ? p.history : []).map(h => ({ ...h, evals: (h.evals || []).map(e => ({ ...e })) })) }, dirty: false }); return work.get(p.id); };
  /* 1. spelersgegevens */
  for (const x of A.xs) { if (!x.match) continue; const w = getP(x.match), p = w.p, sp = p.scout, before = JSON.stringify([p.scout, p.maturity, p.foot, p.birthdate]);
    if (x.pos.h || x.pos.n.length) { sp.h = x.pos.h || undefined; sp.n = x.pos.n.length ? x.pos.n : undefined; if (!sp.h) delete sp.h; if (!sp.n) delete sp.n;
      const nms = [...new Set([x.pos.h, ...x.pos.n].filter(Boolean).map(posScName))].slice(0, 3); delete sp.p1; delete sp.p2; delete sp.p3; nms.forEach((nm, i) => sp["p" + (i + 1)] = nm); }
    if (x.ontw) sp.ontw = x.ontw; if (x.opl) sp.opl = x.opl; if (x.opm) sp.opm = x.opm; if (x.pcat && x.pcat !== x.cat) sp.pcat = x.pcat;
    if (x.mat && !p.maturity) p.maturity = x.mat; if (x.foot && !p.foot) p.foot = x.foot; if (x.birth && !p.birthdate) p.birthdate = x.birth;
    if (JSON.stringify([p.scout, p.maturity, p.foot, p.birthdate]) !== before) { sp.upd = todayIso(); w.dirty = true; } }
  /* 2. evaluaties: dit seizoen in de tabel, vorige seizoenen in de geschiedenis van de speler */
  const cur = new Map((D.E || []).map(e => [e.player_id + "|" + e.moment, { ...e }])), touched = new Map();
  const list = A.evs.slice().sort((a, b) => (a.arch ? 1 : 0) - (b.arch ? 1 : 0) || String(a.date || "").localeCompare(String(b.date || "")));
  for (const e of list) { const x = byPid.get(e.pid); if (!x) { stat.skipped++; continue; }
    const p = x.match, team = A.T[p.team_id], m = imMoment(e.momentName, e.date, team); if (!m) { stat.noMoment++; continue; }
    const season = e.season || team?.season || "";
    if (!team?.season || season === imSeason(team.season)) {
      const k = p.id + "|" + m, had = cur.get(k), t = had || { id: uid(), team_id: p.team_id, player_id: p.id, moment: m, date: e.date || null, scores: {}, comment: null, details: {} };
      if (imMerge(t, e, stat)) { cur.set(k, t); touched.set(k, { t, isNew: !had && !touched.has(k) ? true : touched.get(k)?.isNew || false }); }
    } else { const w = getP(p), H = w.p.history; let h = H.find(x2 => imSeason(x2.season) === season);
      if (!h) { h = { season, team: x.ploeg || e.det.team_then || "", category: x.cat || "", evals: [], stats: {} }; H.push(h); H.sort((a, b) => String(a.season).localeCompare(String(b.season))); }
      let he = h.evals.find(y => y.moment === m); if (!he) { he = { moment: m, date: e.date || null, scores: {} }; h.evals.push(he); h.evals.sort((a, b) => a.moment - b.moment); }
      if (imMerge(he, e, stat)) { w.dirty = true; stat.hist++; } } }
  /* 3. bewaren */
  const jobs = [...[...work.values()].filter(w => w.dirty).map(w => async () => { await db.save("players", w.p); stat.players++; }),
    ...[...touched.values()].map(({ t, isNew }) => async () => { await db.save("evaluations", t); if (isNew) stat.evNew++; else stat.evAdd++; })];
  let done = 0; stat.fail = 0; stat.err = "";
  for (const j of jobs) { try { await j(); } catch (e) { stat.fail++; stat.err = stat.err || (e.message || String(e)); } done++; prog(done, jobs.length); }
  return stat;
}

/* het venster: bestand kiezen → voorbeeld → importeren → verslag */
function scImport(D) {
  if (!S.admin) { toast("Alleen beheerders kunnen een Excel importeren."); return; }
  const d = dialog(`<form class="imx" onsubmit="return false"><h2>Excel van de interne scouting importeren</h2>
    <p class="hint" style="margin-top:0">Kies het Excel-bestand met de tabbladen <b>Spelers</b> en <b>Evaluaties</b> (en eventueel <b>Evaluaties archief</b>). Je ziet eerst wat er gebeurt, pas daarna wordt er iets bewaard.</p>
    <ul class="imx-rules"><li>Elke speler wordt gezocht op naam en geboortedatum. Spelers die nog niet in de app staan, slaan we over.</li>
      <li>Posities (H en N), ontwikkelen naar positie en op leeftijd komen uit de Excel. Maturiteit, voorkeursvoet en geboortedatum vullen we enkel aan als ze in de app nog leeg zijn.</li>
      <li>Evaluaties van dit seizoen komen bij het juiste moment; oudere seizoenen bij de geschiedenis van de speler. <b>Wat al in de app staat, wordt nooit overschreven.</b> Je kan dezelfde Excel later opnieuw importeren.</li>
      <li>Het bestand zelf wordt niet bewaard of doorgestuurd.</li></ul>
    <label class="btn" style="cursor:pointer;align-self:flex-start">${IC.sheet}Excel kiezen<input type="file" id="imf" accept=".xlsx,.xlsm,.xls" hidden></label>
    <div id="imv"></div><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Sluiten</button></div></form>`, "xl");
  $("#imf", d).onchange = async ev => { const file = ev.target.files[0]; if (!file) return; const out = $("#imv", d); out.innerHTML = `<p class="hint">Bezig met lezen…</p>`;
    let A; try { const X = await loadXLSX(), wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: false }); A = imAnalyse(X, wb, D); } catch (e) { out.innerHTML = `<p class="grpwarn">${esc(e.message || String(e))}</p>`; return; }
    const by = k => A.xs.filter(x => x.how === k), evFor = new Set(A.evs.map(e => e.pid));
    const card = (n, l, cls) => `<div class="imx-k ${cls || ""}"><b>${n}</b><span>${l}</span></div>`;
    const rowSel = x => `<tr><td><b>${esc(x.first + " " + x.last)}</b><small>${esc([x.birth ? dShort(x.birth) : "geen geboortedatum", x.ploeg].filter(Boolean).join(" · "))}${evFor.has(x.id) ? " · heeft evaluaties" : ""}</small></td>
      <td><select data-im="${esc(x.id)}"><option value="">Overslaan</option>${(x.how === "controleer" ? [x.match] : []).concat(x.cands || []).filter(Boolean).map(p => `<option value="${p.id}"${x.match?.id === p.id ? " selected" : ""}>${esc(pname(p))} · ${esc(teamLbl(A.T[p.team_id] || {}))}${p.birthdate ? " · " + esc(dShort(p.birthdate)) : ""}</option>`).join("")}</select></td></tr>`;
    const draw = () => { const ok = A.xs.filter(x => x.match).length, evOk = A.evs.filter(e => A.xs.find(x => x.id === e.pid)?.match).length;
      out.innerHTML = `<div class="imx-ks">${card(A.xs.length, "spelers in de Excel")}${card(by("zeker").length + by("naam").length, "meteen gevonden", "ok")}${card(by("controleer").length, "even nakijken", by("controleer").length ? "warn" : "")}${card(by("niet").length, "niet in de app", by("niet").length ? "bad" : "")}${card(evOk + " / " + A.evs.length, "evaluaties te koppelen")}</div>
        ${!A.hasEval ? `<p class="grpwarn">Geen tabblad 'Evaluaties' gevonden: enkel posities en spelersgegevens worden ingelezen.</p>` : ""}
        ${by("controleer").length || by("niet").length ? `<h3 class="dosh">Nakijken</h3><p class="hint" style="margin-top:0">Kies de juiste speler of laat <b>Overslaan</b> staan. Ontbreekt een speler in de app? Voeg hem eerst toe aan zijn ploeg en importeer daarna opnieuw.</p>
          <div class="tblwrap imx-tbl"><table><tbody>${[...by("controleer"), ...by("niet").sort((a, b) => (evFor.has(b.id) ? 1 : 0) - (evFor.has(a.id) ? 1 : 0) || (a.last + a.first).localeCompare(b.last + b.first, "nl"))].map(rowSel).join("")}</tbody></table></div>` : ""}
        <div class="row" style="margin-top:14px"><span class="hint">${ok} spelers en ${evOk} evaluaties worden verwerkt.</span><span class="spacer"></span><button class="btn" type="button" id="imgo"${ok ? "" : " disabled"}>Importeren</button></div>`;
      $$("[data-im]", out).forEach(s => s.onchange = () => { const x = A.xs.find(y => y.id === s.dataset.im); x.match = s.value ? D.P.find(p => p.id === s.value) : null; draw(); });
      $("#imgo", out).onclick = async () => { const b = $("#imgo", out); b.disabled = true; b.textContent = "Bezig…";
        $$(".imx-prog", out).forEach(x => x.remove()); out.insertAdjacentHTML("beforeend", `<div class="imx-prog"><i id="imbar"></i></div>`);
        let st; try { st = await imWrite(A, D, (k, n) => { const bar = $("#imbar", out); if (bar) bar.style.width = Math.round(k / Math.max(1, n) * 100) + "%"; }); }
        catch (e) { toast(e.message || String(e)); b.disabled = false; b.textContent = "Opnieuw proberen"; return; }
        imDone(out, A, st, D); }; };
    draw(); };
}
/* verslag, en welke ploegen nog niet met de fiche van de interne scouting evalueren */
function imDone(out, A, st, D) {
  const tids = [...new Set(A.xs.filter(x => x.match && A.evs.some(e => e.pid === x.id)).map(x => x.match.team_id))];
  const ogvNames = new Set(csCritNames(EV_TEMPLATE_OGV)), uses = t => { const c = csCritNames(t.criteria || []); return c.length && c.filter(n => ogvNames.has(n)).length >= c.length * 0.8; };
  const need = tids.map(id => S.teams.find(t => t.id === id)).filter(t => t && !uses(t));
  out.innerHTML = `<div class="imx-ks">${[[st.players, "spelers bijgewerkt"], [st.evNew, "nieuwe evaluaties"], [st.evAdd, "evaluaties aangevuld"], [st.hist, "uit vorige seizoenen"]].map(([n, l]) => `<div class="imx-k ok"><b>${n}</b><span>${l}</span></div>`).join("")}</div>
    ${st.fail ? `<p class="grpwarn">${st.fail} ${st.fail === 1 ? "rij kon" : "rijen konden"} niet bewaard worden${/row-level security|policy/i.test(st.err) ? ": voer eerst <b>supabase-evaluaties-beheerder-v54.sql</b> uit in Supabase en importeer daarna opnieuw (wat al bewaard is, wordt niet dubbel gezet)." : ": " + esc(st.err)}</p>` : ""}
    ${st.clash ? `<p class="hint">${st.clash} ${st.clash === 1 ? "score of antwoord stond" : "scores of antwoorden stonden"} al anders ingevuld (in de app of in een eerdere rij van de Excel) en ${st.clash === 1 ? "is" : "zijn"} niet overschreven.</p>` : ""}
    ${st.skipped ? `<p class="hint">${st.skipped} evaluaties van spelers die niet in de app staan, zijn overgeslagen.</p>` : ""}${st.noMoment ? `<p class="hint">${st.noMoment} evaluaties zonder moment of datum zijn overgeslagen.</p>` : ""}
    ${need.length ? `<div class="imx-need"><b>Deze ploegen evalueren in de app nog niet met de fiche van de interne scouting</b><p class="hint" style="margin:4px 0 8px">${need.map(t => esc(teamLbl(t))).join(", ")}. De geïmporteerde scores staan er wel, maar hun trainers zien ze pas in hun evaluatiescherm (en vullen ze verder aan) als de ploeg dezelfde fiche gebruikt. Het spelersprofiel en Interne scouting werken sowieso.</p>
      <button class="btn small" type="button" id="imfiche">Fiche instellen voor deze ${need.length} ploegen</button></div>` : `<p class="hint">Alle betrokken ploegen evalueren al met de fiche van de interne scouting.</p>`}`;
  const b = $("#imfiche", out); if (b) b.onclick = async () => { b.disabled = true;
    const st0 = CLUB.settings || {}, ev = { ...(st0.eval || {}) }, profs = (Array.isArray(ev.profiles) ? ev.profiles : []).map(p => ({ ...p, teams: (p.teams || []).filter(id => !need.some(t => t.id === id)) }));
    let pr = profs.find(p => /interne scouting/i.test(p.name || "")); if (!pr) { pr = { id: "p" + Date.now().toString(36), name: "Interne scouting", teams: [], template: EV_TEMPLATE_OGV.slice(), open: EV_OPEN_OGV.map(q => ({ ...q })), self: { ...(ev.self || { on: false }) } }; profs.push(pr); }
    pr.teams = [...new Set([...(pr.teams || []), ...need.map(t => t.id)])];
    const ok = await csCtxOwn().saveAll(CLUB.name, CLUB.short, { ...st0, eval: { ...ev, profiles: profs.filter(p => p.teams.length || p === pr) } }, "Fiche ingesteld.");
    if (!ok) { b.disabled = false; return; }
    for (const t of need) { const criteria = (pr.template || EV_TEMPLATE_OGV).slice(); try { await db.save("teams", { ...t, criteria }); t.criteria = criteria; } catch (x) {} }
    if (typeof evApplyClub === "function") evApplyClub(); b.replaceWith(Object.assign(document.createElement("p"), { className: "hint", textContent: "Klaar: deze ploegen evalueren nu met de fiche van de interne scouting (Clubinstellingen › Evaluaties › Interne scouting)." })); };
  setTimeout(() => render(), 0);
}
