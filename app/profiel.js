/* FootballCoachHub — spelersprofiel: een radar met de groepen van de evaluatie (bv. techniek, spelinzicht, fysiek, mentaal)
   op basis van de evaluaties van de trainers, ook die van vorige seizoenen. Vergelijk met een vorige evaluatie,
   het gemiddelde van de ploeg of een andere speler. Gebruikt in het spelersdossier en in Interne scouting. */
"use strict";
const PF_SKIP = /^(algemeen|onderdelen)$/i;

/* bij welke groep hoort elk onderdeel? Elke fiche die de club gebruikt(e) apart, zodat ook oude evaluaties meetellen.
   Een evaluatie wordt gelezen met de fiche die de meeste van haar onderdelen kent (dezelfde naam kan in twee fiches in een andere groep staan). */
function pfGroupMap(extra = []) {
  const st = (typeof CLUB !== "undefined" && CLUB.settings) || {}, ev = st.eval || {};
  const raw = [...extra, evMaster(st).template, ...(((ev.isc || {}).template) ? [ev.isc.template] : []), ev.v2 ? [] : ev.template || [], EV_TEMPLATE_OGV, EV_TEMPLATE_DEFAULT, EV_TEMPLATE_SHORT];
  const tpls = [], seen = new Set(), keep = new Set(), order = [];
  for (const tpl of raw) { const sig = JSON.stringify(tpl || []); if (!tpl || !tpl.length || seen.has(sig)) continue; seen.add(sig);
    const m = new Map(), ord = []; let g = null;
    for (const r of tpl) { const l = String(r).trim(); if (!l) continue;
      if (l.startsWith("#")) { g = l.replace(/^#+\s*/, ""); if (!ord.includes(g)) ord.push(g); if (!order.includes(g)) order.push(g); if (evKeeperGroup({ name: g })) keep.add(g); continue; }
      const n = l.split(/\s+\|\s+/)[0].trim(); if (g && !m.has(n)) m.set(n, g); }
    if (m.size) tpls.push({ m, order: ord }); }
  const all = new Map(); tpls.forEach(t => t.m.forEach((g, n) => { if (!all.has(n)) all.set(n, g); }));
  return { tpls, m: all, order, keep };
}
/* gemiddelde per groep van één evaluatie, gelezen met de best passende fiche */
const PF_ALIAS = { "techniek": "techniek aan de bal", "met de bal": "techniek aan de bal", "zonder de bal": "verdedigen", "mentaal en team": "mentaal", "plezier en inzet": "mentaal" };
function pfVals(scores, gm) {
  const keys = Object.keys(scores || {}); if (!keys.length || !gm.tpls.length) return {};
  /* de huidige fiche (eerste sjabloon) telt altijd; oudere onderdelen vullen enkel groepen aan die in deze evaluatie nog geen score hebben */
  let M = gm.tpls[0]; if (!keys.some(k => M.m.has(k))) { let bn = 0; for (const t of gm.tpls) { const n = keys.filter(k => t.m.has(k)).length; if (n > bn) { bn = n; M = t; } } }
  const lc = s => String(s || "").toLowerCase(), toM = g => M.order.find(x => lc(x) === lc(g)) || M.order.find(x => lc(x) === PF_ALIAS[lc(g)]) || null;
  const acc = {}, leg = {};
  for (const [k, v] of Object.entries(scores)) { const n = +v; if (v == null || v === "" || isNaN(n)) continue;
    if (M.m.has(k)) { const g = M.m.get(k); if (!PF_SKIP.test(g)) (acc[g] = acc[g] || []).push(n); continue; }
    const t = gm.tpls.find(t => t.m.has(k)), g = t ? toM(t.m.get(k)) : null; if (g && !PF_SKIP.test(g)) (leg[g] = leg[g] || []).push(n); }
  for (const g in leg) if (!acc[g]) acc[g] = leg[g];
  const out = Object.fromEntries(Object.entries(acc).map(([g, xs]) => [g, xs.reduce((a, b) => a + b, 0) / xs.length]));
  Object.defineProperty(out, "_order", { value: M.order, enumerable: false }); return out;
}
/* de hoeken van de radar: de groepen met een score, in de volgorde van de fiche; keeper enkel bij doelmannen of als er keeperscores zijn */
function pfAxes(vals, gm) { const ord = [...(vals._order || []), ...gm.order.filter(g => !(vals._order || []).includes(g))]; return ord.filter(g => vals[g] != null && !PF_SKIP.test(g)); }
const pfTotal = (vals, axes) => { const xs = axes.map(a => vals[a]).filter(v => v != null); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
/* alle evaluaties van een speler, oudste eerst: dit seizoen (lijst) en de vorige seizoenen (p.history) */
/* oude evaluaties kunnen nog een aparte interne scouting (details.isc) hebben: die scores tellen voor het profiel */
const pfSrc = e => { const I = e?.details?.isc; const isc = I && I.scores && Object.keys(I.scores).length;
  return { scores: isc ? I.scores : (e?.scores || {}), details: { ...(e?.details || {}), open: { ...(e?.details?.open || {}), ...(I?.open || {}) } }, isc: !!isc }; };
function pfList(p, evals, season) {
  const mo = m => EV_MOMENTS[m - 1] || { naam: "Evaluatie " + m, kort: "E" + m };
  const now = (evals || []).filter(e => e.player_id === p.id).map(e => ({ ...e, ...pfSrc(e) })).filter(e => Object.keys(e.scores || {}).length)
    .map(e => ({ key: "c" + e.moment, label: mo(e.moment).naam + (season ? " " + season : ""), short: mo(e.moment).kort + (season ? " " + String(season).slice(2, 4) + "–" + String(season).slice(7, 9) : ""), date: e.date || "", season: season || "", moment: e.moment, scores: e.scores, team_id: e.team_id, details: e.details }));
  const old = (Array.isArray(p.history) ? p.history : []).flatMap((h, hi) => (h.evals || []).map(e => ({ ...e, ...pfSrc(e) })).filter(e => Object.keys(e.scores || {}).length)
    .map(e => ({ key: "h" + hi + "-" + e.moment, label: mo(e.moment).naam + " " + (h.season || ""), short: mo(e.moment).kort + " " + String(h.season || "").slice(2, 4) + "–" + String(h.season || "").slice(7, 9), date: e.date || "", season: h.season || "", moment: e.moment, scores: e.scores, team: h.team, details: e.details })));
  return [...old, ...now].sort((a, b) => (a.season + (a.date || "") + a.moment).localeCompare(b.season + (b.date || "") + b.moment));
}

/* de radar zelf: ringen per punt, één gevulde vorm (de gekozen evaluatie) en een stippellijn om mee te vergelijken */
function radarSvg(axes, main, cmp, o = {}) {
  const S0 = o.size || 340, mini = !!o.mini, n = axes.length, c = S0 / 2, R = mini ? S0 / 2 - 3 : S0 / 2 - 62, max = o.max || 5, RS = max === 10 ? [4, 6, 8, 10] : [2, 3, 4, 5];
  /* het midden is 1 (de laagste score), de buitenste ring 5: zo zie je de verschillen beter */
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n, fr = v => Math.max(0, Math.min(max, v ?? 1) - 1) / (max - 1), pt = (i, v) => [c + Math.cos(ang(i)) * R * fr(v), c + Math.sin(ang(i)) * R * fr(v)], at = (i, r) => [c + Math.cos(ang(i)) * r, c + Math.sin(ang(i)) * r];
  const poly = vs => vs.map((v, i) => pt(i, v).map(x => x.toFixed(1)).join(",")).join(" ");
  const ring = k => axes.map((_, i) => pt(i, k).map(x => x.toFixed(1)).join(",")).join(" ");
  const wrap = t => { const w = String(t).split(" "); if (t.length <= 13 || w.length < 2) return [t]; let best = 1, d = 99; for (let k = 1; k < w.length; k++) { const a = w.slice(0, k).join(" ").length, b = w.slice(k).join(" ").length; if (Math.abs(a - b) < d) { d = Math.abs(a - b); best = k; } } return [w.slice(0, best).join(" "), w.slice(best).join(" ")]; };
  const mv = axes.map(a => main?.[a] ?? null), cv = cmp ? axes.map(a => cmp[a] ?? null) : null;
  if (mini) return `<svg class="pfmini" viewBox="0 0 ${S0} ${S0}" aria-hidden="true"><polygon points="${ring(max)}" class="pfg"/><polygon points="${ring(RS[1])}" class="pfg"/>${mv.some(v => v != null) ? `<polygon points="${poly(mv)}" class="pfm"/>` : ""}</svg>`;
  const lab = (i, t, v) => { const [x, y] = at(i, R + 16), cos = Math.cos(ang(i)), anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end", ls = wrap(t), dy = Math.sin(ang(i)) < -0.5 ? -(ls.length - 1) * 13 : Math.sin(ang(i)) > 0.5 ? 6 : -(ls.length - 1) * 6.5;
    return `<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}" class="pfl">${ls.map((l, k) => `<tspan x="${x.toFixed(1)}" dy="${k ? 13 : 0}">${esc(l)}</tspan>`).join("")}</text>`; };
  return `<svg class="pfradar" viewBox="0 0 ${S0} ${S0}" role="img" aria-label="Spelersprofiel: ${esc(axes.map((a, i) => a + " " + (mv[i] == null ? "geen score" : evF(mv[i]))).join(", "))}">
    ${RS.map(k => `<polygon points="${ring(k)}" class="pfg${k === max ? " out" : ""}"/>`).join("")}
    ${axes.map((_, i) => { const [x, y] = pt(i, max); return `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="pfg"/>`; }).join("")}
    ${RS.map(k => { const a = -Math.PI / 2 + Math.PI / n, rr = R * fr(k); return `<text x="${(c + Math.cos(a) * rr + 3).toFixed(1)}" y="${(c + Math.sin(a) * rr - 2).toFixed(1)}" class="pfr">${EV_DISP === 2 ? k * 2 : k}</text>`; }).join("")}
    ${cv && cv.some(v => v != null) ? `<polygon points="${poly(cv)}" class="pfc"/>${cv.map((v, i) => v == null ? "" : `<circle cx="${pt(i, v)[0].toFixed(1)}" cy="${pt(i, v)[1].toFixed(1)}" r="3" class="pfcd"><title>${esc(axes[i])}: ${evF(v)}</title></circle>`).join("")}` : ""}
    <polygon points="${poly(mv)}" class="pfm"/>
    ${mv.map((v, i) => { if (v == null) return ""; const [x, y] = pt(i, v), rv = R * fr(v), [tx, ty] = at(i, rv > R * 0.78 ? rv - 15 : rv + 13);
      return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" class="pfmd"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" class="pfhit"><title>${esc(axes[i])}: ${evF(v)}${cv && cv[i] != null ? " · vergelijking " + evF(cv[i]) : ""}</title></circle>
        <text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" class="pfv">${evF(v)}</text></g>`; }).join("")}
    ${axes.map((a, i) => lab(i, a)).join("")}</svg>`;
}

/* paneel met radar, keuze van evaluatie en vergelijking, en de evolutie doorheen de jaren.
   ctx: { p, list (pfList), gm, teamAvg(e) -> scores of null, others: [{ id, name, team, list }] } */
function pfPanel(ctx, st = {}) {
  const { p, list, gm } = ctx, keeper = evIsKeeper(p) || list.some(e => Object.keys(e.scores || {}).some(k => gm.keep.has(gm.m.get(k))));
  const withVals = list.map(e => ({ ...e, vals: pfVals(e.scores, gm) })).filter(e => Object.keys(e.vals).length);
  if (!withVals.length) return `<div class="pf empty-pf"><h2>Spelersprofiel</h2><p class="hint" style="margin:0">Nog geen evaluatie met scores. Zodra een trainer ${esc(p.first_name || "deze speler")} evalueert, verschijnt hier het profiel.</p></div>`;
  const mi = st.main != null && withVals[st.main] ? st.main : withVals.length - 1, main = withVals[mi];
  const axes = pfAxes(main.vals, gm).filter(a => keeper || !gm.keep.has(a));
  const opts = [["", "Niet vergelijken"], ...(mi > 0 ? [["prev", "Vorige evaluatie (" + withVals[mi - 1].label + ")"]] : []), ...withVals.map((e, i) => i === mi || i === mi - 1 ? null : ["e" + i, e.label]).filter(Boolean),
    ...(ctx.teamAvg && ctx.teamAvg(main) ? [["team", "Gemiddelde van de ploeg"]] : []), ...(ctx.others || []).filter(o => o.id !== p.id).map(o => ["p" + o.id, o.name + (o.team ? " · " + o.team : "")])];
  const ck = st.cmp != null ? st.cmp : mi > 0 ? "prev" : "";
  const cmpE = ck === "prev" ? withVals[mi - 1] : ck.startsWith("e") ? withVals[+ck.slice(1)] : null;
  const other = ck.startsWith("p") ? (ctx.others || []).find(o => "p" + o.id === ck) : null, otherE = other ? (() => { const l = other.list.map(e => ({ ...e, vals: pfVals(e.scores, gm) })).filter(e => Object.keys(e.vals).length); return l[l.length - 1]; })() : null;
  const cmpV = cmpE ? cmpE.vals : ck === "team" ? pfVals(ctx.teamAvg(main), gm) : otherE ? otherE.vals : null;
  const cmpL = cmpE ? cmpE.label : ck === "team" ? "Gemiddelde van de ploeg" : other ? other.name + (otherE ? " · " + otherE.label : " · nog geen evaluatie") : "";
  const tot = pfTotal(main.vals, axes), ctot = cmpV ? pfTotal(cmpV, axes) : null;
  const strongest = axes.slice().sort((a, b) => main.vals[b] - main.vals[a])[0], weakest = axes.slice().sort((a, b) => main.vals[a] - main.vals[b])[0];
  const chart = axes.length >= 3 ? radarSvg(axes, main.vals, cmpV) : `<div class="pfbars">${axes.map(a => `<div><span>${esc(a)}</span><b><i style="width:${main.vals[a] / 5 * 100}%"></i></b><em>${evF(main.vals[a])}</em></div>`).join("")}</div>`;
  const hist = withVals.length > 1 ? `<details class="pfhist"${st.hist ? " open" : ""}><summary>Doorheen de jaren · ${withVals.length} evaluaties</summary><div class="tblwrap"><table class="pftbl"><thead><tr><th>Evaluatie</th>${axes.map(a => `<th title="${esc(a)}">${esc(a)}</th>`).join("")}<th>Totaal</th></tr></thead><tbody>
      ${withVals.slice().reverse().map((e, ri) => { const i = withVals.length - 1 - ri, t = pfTotal(e.vals, axes), pv = i > 0 ? pfTotal(withVals[i - 1].vals, axes) : null;
        return `<tr${i === mi ? ' class="on"' : ""}><td><button type="button" class="link" data-pfm="${i}">${esc(e.label)}</button>${e.team ? `<small>${esc(e.team)}</small>` : ""}</td>${axes.map(a => `<td style="--c:${evColor(e.vals[a])}">${e.vals[a] == null ? "–" : `<i></i>${evF(e.vals[a])}`}</td>`).join("")}<td><b>${evF(t)}</b>${t != null && pv != null ? evDelta(t - pv) : ""}</td></tr>`; }).join("")}</tbody></table></div></details>` : "";
  return `<div class="pf"><div class="pfhead"><h2>Spelersprofiel</h2>
      ${withVals.length > 1 ? `<label class="pfsel"><span>Evaluatie</span><select data-pf="main">${withVals.map((e, i) => `<option value="${i}"${i === mi ? " selected" : ""}>${esc(e.label)}</option>`).join("")}</select></label>` : `<span class="pill g">${esc(main.label)}</span>`}
      ${opts.length > 1 ? `<label class="pfsel"><span>Vergelijk met</span><select data-pf="cmp">${opts.map(([k, l]) => `<option value="${esc(k)}"${k === ck ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>` : ""}</div>
    <div class="pfbody"><div class="pfchart">${chart}</div>
      <div class="pfside"><div class="pfleg"><span class="m"><i></i>${esc(main.label)}</span>${cmpV ? `<span class="c"><i></i>${esc(cmpL)}</span>` : ""}</div>
        <div class="pftot"><small>Gemiddelde</small><b style="color:${evColor(tot)}">${evF(tot)}</b>${ctot != null ? evDelta(tot - ctot) : ""}<span class="hint">op ${evMaxTxt()} · ${axes.length} blokken</span></div>
        <table class="pfrows"><tbody>${axes.map(a => `<tr><td>${esc(a)}</td><td><span class="pfbar"><i style="width:${main.vals[a] / 5 * 100}%;background:${evColor(main.vals[a])}"></i>${cmpV && cmpV[a] != null ? `<em style="left:${cmpV[a] / 5 * 100}%"></em>` : ""}</span></td><td><b>${evF(main.vals[a])}</b></td><td>${cmpV && cmpV[a] != null ? evDelta(main.vals[a] - cmpV[a]) : ""}</td></tr>`).join("")}</tbody></table>
        ${axes.length > 2 && strongest !== weakest ? `<p class="hint pfsum">Sterkst in <b>${esc(strongest.toLowerCase())}</b>, meeste groeimarge in <b>${esc(weakest.toLowerCase())}</b>.</p>` : ""}</div></div>
    ${hist}</div>`;
}
/* paneel tekenen en de keuzes laten werken (herteken in dezelfde host) */
function pfMount(host, ctx) {
  if (!host) return; const st = { main: null, cmp: null, hist: false };
  const draw = () => { host.innerHTML = pfPanel(ctx, st);
    $$("[data-pf]", host).forEach(s => s.onchange = () => { if (s.dataset.pf === "main") { st.main = +s.value; st.cmp = null; } else st.cmp = s.value; draw(); });
    $$("[data-pfm]", host).forEach(b => b.onclick = () => { st.main = +b.dataset.pfm; st.cmp = null; st.hist = true; draw(); });
    const d = $(".pfhist", host); if (d) d.ontoggle = () => { st.hist = d.open; }; };
  draw();
}
/* gemiddelde scores van een groep evaluaties (voor "gemiddelde van de ploeg") */
function pfAvgScores(evs) { const acc = {}; evs.forEach(e => Object.entries(pfSrc(e).scores).forEach(([k, v]) => { const n = +v; if (v == null || v === "" || isNaN(n)) return; (acc[k] = acc[k] || []).push(n); }));
  const out = Object.fromEntries(Object.entries(acc).map(([k, xs]) => [k, xs.reduce((a, b) => a + b, 0) / xs.length])); return Object.keys(out).length ? out : null; }

/* ============ posities 1 tot 11 (nummering van de club), hoofdpositie (H) en nevenposities (N) ============ */
const POS11 = [[1, "DOEL", "Doelman", 50, 90], [2, "RA", "Rechtsachter", 86, 70], [3, "CV-R", "Centrale verdediger rechts", 63, 75], [4, "CV-L", "Centrale verdediger links", 37, 75], [5, "LA", "Linksachter", 14, 70],
  [6, "VM", "Verdedigende middenvelder", 50, 57], [7, "RB", "Rechtsbuiten", 86, 23], [8, "CM", "Centrale middenvelder", 66, 42], [9, "SP", "Spits", 50, 10], [10, "AM", "Aanvallende middenvelder", 34, 33], [11, "LB", "Linksbuiten", 14, 23]];
const POS_BY_NAME = { "Doelman": [1], "Rechtsachter": [2], "Centrale verdediger": [3, 4], "Linksachter": [5], "Verdedigende middenvelder": [6], "Rechtsbuiten": [7], "Centrale middenvelder": [8], "Spits": [9], "Aanvallende middenvelder": [10], "Linksbuiten": [11] };
const posName = n => (POS11.find(x => x[0] === n) || [])[2] || "";
const posAb = n => (POS11.find(x => x[0] === n) || [])[1] || "";
const posScName = n => n === 3 || n === 4 ? "Centrale verdediger" : posName(n);
/* posities van een speler: eerst de nummers uit het profiel, anders afgeleid uit de oude posities of de positie op de fiche */
function posOf(p) {
  const sp = p?.scout && typeof p.scout === "object" ? p.scout : {};
  if (sp.h || (Array.isArray(sp.n) && sp.n.length)) return { h: +sp.h || null, n: (sp.n || []).map(Number).filter(x => x >= 1 && x <= 11 && x !== +sp.h) };
  const names = [sp.p1, sp.p2, sp.p3].filter(Boolean); let nums = names.flatMap(nm => POS_BY_NAME[nm] || []);
  if (!nums.length) { const t = String(p?.position || "").toLowerCase(); const hit = Object.keys(POS_BY_NAME).find(k => t.includes(k.toLowerCase())); if (hit) nums = POS_BY_NAME[hit]; else if (/doel|keeper/.test(t)) nums = [1]; else if (/staart/.test(t)) nums = [4]; else if (/piloot/.test(t)) nums = [9]; }
  return { h: nums[0] || null, n: [...new Set(nums.slice(1))] };
}
const posTxt = ps => [ps.h ? ps.h + " " + posAb(ps.h) : "", ...ps.n.map(n => n + "")].filter(Boolean).join(" · ");
/* klikbaar veld: tik = hoofdpositie, nog eens = nevenpositie, nog eens = weg */
function posPicker(ps) {
  return `<div class="pos11" role="group" aria-label="Posities">${POS11.map(([n, ab, nm, x, y]) => { const st = ps.h === n ? "h" : ps.n.includes(n) ? "n" : "";
    return `<button type="button" class="pp11 ${st}" data-pn="${n}" style="left:${x}%;top:${y}%" title="${n} · ${esc(nm)}" aria-label="${n} ${esc(nm)}: ${st === "h" ? "hoofdpositie" : st === "n" ? "ook inzetbaar" : "niet"}"><b>${n}</b><small>${ab}</small></button>`; }).join("")}</div>
    <p class="hint" style="margin:6px 0 0"><span class="pp11k h">H</span> hoofdpositie · <span class="pp11k n">N</span> ook inzetbaar. Tik op een positie om te wisselen.</p>`;
}
function posBind(host, ps) { $$("[data-pn]", host).forEach(b => b.onclick = () => { const n = +b.dataset.pn;
  if (ps.h === n) { ps.h = null; ps.n = [...new Set([...ps.n, n])]; } else if (ps.n.includes(n)) ps.n = ps.n.filter(x => x !== n); else if (!ps.h) ps.h = n; else ps.n = [...ps.n, n];
  $$("[data-pn]", host).forEach(x => { const k = +x.dataset.pn; x.className = "pp11 " + (ps.h === k ? "h" : ps.n.includes(k) ? "n" : ""); }); }); }
