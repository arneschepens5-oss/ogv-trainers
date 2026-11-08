/* OGV Platform — cijfers: resultaten, speeltijd, doelpunten, aanwezigheid en werkpunten van de ploeg.
   Alles wordt berekend uit de kalender, de aanwezigheden en de wedstrijdverslagen. */
"use strict";
let CF = { per: "seizoen", squad: "", tab: "overzicht", sortK: "minutes", sortD: -1 };
const CF_PER = [["seizoen", "Heel seizoen"], ["najaar", "Najaar"], ["voorjaar", "Voorjaar"], ["laatste5", "Laatste 5 wedstrijden"], ["30d", "Laatste 30 dagen"]];
const CF_TABS = [["overzicht", "Overzicht"], ["spelers", "Spelers"], ["speeltijd", "Speeltijd"], ["goals", "Doelpunten"], ["werkpunten", "Werkpunten"]];
const COL_FOR = "var(--yellow)", COL_AG = "#8A8F98";

/* zwevende uitleg bij grafieken */
(() => { let tip = null;
  document.addEventListener("pointerover", ev => { const t = ev.target.closest?.("[data-tip]"); if (!t) { if (tip) tip.hidden = true; return; }
    if (!tip) { tip = document.createElement("div"); tip.className = "cftip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    tip.innerHTML = t.dataset.tip; tip.hidden = false; const r = t.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px"; tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + "px"; });
  document.addEventListener("scroll", () => { if (tip) tip.hidden = true; }, true); })();

/* ---------- kleine grafieken in SVG ---------- */
/* doelpunten per wedstrijd: voor boven de lijn, tegen eronder */
function cfGoalChart(ms) {
  if (!ms.length) return `<p class="muted">Nog geen gespeelde wedstrijden met een uitslag.</p>`;
  const W = Math.max(720, ms.length * 34), H = 190, mid = 100, mx = Math.max(3, ...ms.map(e => Math.max(e.score_for, e.score_against))), sc = 78 / mx, bw = Math.min(26, (W - 20) / ms.length - 8);
  const bars = ms.map((e, i) => { const x = 10 + i * ((W - 20) / ms.length) + ((W - 20) / ms.length - bw) / 2, hf = e.score_for * sc, ha = e.score_against * sc, r = res(e);
    const tip = esc(`<b>${e.home === false ? "@ " : "vs "}${esc(e.opponent || "Wedstrijd")}</b><br>${dShort(e.date)} · ${e.score_for}-${e.score_against} ${r === "win" ? "gewonnen" : r === "loss" ? "verloren" : "gelijk"}${e.report?.squad ? " · " + esc(e.report.squad) : ""}`);
    return `<g class="cfhit" data-tip="${tip}" data-go="#/activiteit/${e.id}"><rect x="${x - 4}" y="10" width="${bw + 8}" height="${H - 30}" fill="transparent"/>
      ${hf ? `<path d="M${x} ${mid - 1}V${mid - hf + 3}q0 -3 3 -3h${bw - 6}q3 0 3 3V${mid - 1}Z" fill="${COL_FOR}"/>` : ""}${ha ? `<path d="M${x} ${mid + 1}V${mid + ha - 3}q0 3 3 3h${bw - 6}q3 0 3 -3V${mid + 1}Z" fill="${COL_AG}"/>` : ""}
      <circle cx="${x + bw / 2}" cy="${H - 8}" r="3.5" fill="${r === "win" ? "var(--s-ok,#22C55E)" : r === "loss" ? "var(--s-bad,#E11D48)" : "var(--muted)"}"/></g>`; }).join("");
  return `<div class="cfscroll"><svg class="cfsvg" viewBox="0 0 ${W} ${H}" style="--mw:${Math.max(560, ms.length * 30)}px" role="img" aria-label="Doelpunten voor en tegen per wedstrijd">
    <path d="M6 ${mid}H${W - 6}" stroke="var(--line2)" stroke-width="1"/>${bars}</svg></div>
    <div class="cflegend"><span><i style="background:${COL_FOR}"></i>Gescoord</span><span><i style="background:${COL_AG}"></i>Tegen</span><span class="hint">Bolletje: gewonnen, gelijk of verloren. Tik op een staaf voor de wedstrijd.</span></div>`;
}
/* aanwezigheid per training */
function cfAttChart(tr) {
  if (!tr.length) return `<p class="muted">Nog geen trainingen met aanwezigheden.</p>`;
  const W = Math.max(720, tr.length * 22), H = 150, bw = Math.min(22, (W - 20) / tr.length - 5), a = avg(tr.map(t => t.p)), yOf = p => 130 - p * 1.15;
  const bars = tr.map((t, i) => { const x = 10 + i * ((W - 20) / tr.length) + ((W - 20) / tr.length - bw) / 2, h = Math.max(2, t.p * 1.15);
    return `<g data-tip="${esc(`<b>${dShort(t.e.date)}</b><br>${t.n} van ${t.of} aanwezig (${t.p}%)${t.e.theme ? "<br>" + esc(t.e.theme) : ""}`)}" data-go="#/activiteit/${t.e.id}/aanwezig" class="cfhit"><rect x="${x - 3}" y="0" width="${bw + 6}" height="${H}" fill="transparent"/>
      <path d="M${x} 130V${130 - h + 3}q0 -3 3 -3h${bw - 6}q3 0 3 3V130Z" fill="${t.p < 60 ? COL_AG : COL_FOR}"/></g>`; }).join("");
  return `<div class="cfscroll"><svg class="cfsvg" viewBox="0 0 ${W} ${H}" style="--mw:${Math.max(560, tr.length * 20)}px" role="img" aria-label="Aanwezigheid per training">
    ${[50, 100].map(p => `<path d="M6 ${yOf(p)}H${W - 6}" stroke="var(--line)" stroke-width="1"/><text x="${W - 6}" y="${yOf(p) - 3}" text-anchor="end" font-size="10" fill="var(--muted)">${p}%</text>`).join("")}
    <path d="M6 130H${W - 6}" stroke="var(--line2)"/>${bars}${a != null ? `<path d="M6 ${yOf(a)}H${W - 6}" stroke="var(--ink)" stroke-dasharray="4 4" stroke-width="1"/><text x="10" y="${yOf(a) - 4}" font-size="10.5" font-weight="700" fill="var(--ink)">gemiddeld ${Math.round(a)}%</text>` : ""}</svg></div>`;
}
/* horizontale balken, bv. speeltijd of topschutters */
function cfBars(rows, opts = {}) {
  if (!rows.length) return `<p class="muted">${opts.empty || "Nog geen gegevens."}</p>`;
  const mx = Math.max(...rows.map(r => r.v), opts.ref || 0, 1);
  return `<div class="cfbars">${rows.map(r => `<div class="cfbar${r.warn ? " warn" : ""}"${r.tip ? ` data-tip="${esc(r.tip)}"` : ""}${r.href ? ` data-go="${r.href}"` : ""}><span class="l">${esc(r.l)}</span>
    <span class="t"><i style="width:${Math.max(1.5, 100 * r.v / mx)}%;${r.c ? "background:" + r.c : ""}"></i>${opts.ref ? `<b class="ref" style="left:${100 * opts.ref / mx}%"></b>` : ""}</span><span class="v">${r.vl ?? r.v}</span></div>`).join("")}</div>`;
}

route("cijfers", { title: "Cijfers", auth: true, team: true, render: v => {
  const today = todayIso(), allM = past("wedstrijd").filter(e => e.rbfa_state !== "afgelast"), squads = [...new Set(allM.map(e => e.report?.squad).filter(Boolean))].sort();
  if (CF.squad && !squads.includes(CF.squad)) CF.squad = "";
  const d30 = iso(addDays(parse(today), -30)), month = e => +e.date.slice(5, 7);
  const inPer = e => CF.per === "najaar" ? month(e) >= 7 : CF.per === "voorjaar" ? month(e) < 7 : CF.per === "30d" ? e.date >= d30 : true;
  let M = allM.filter(e => (!CF.squad || e.report?.squad === CF.squad) && inPer(e)).sort((a, b) => a.date.localeCompare(b.date));
  if (CF.per === "laatste5") M = M.filter(e => e.score_for != null).slice(-5);
  const played = M.filter(e => e.score_for != null && e.score_against != null);
  const trAll = past("training").filter(e => CF.per === "laatste5" ? (M.length ? e.date >= M[0].date : false) : inPer(e)).sort((a, b) => a.date.localeCompare(b.date));
  const P = active(), mf = matchFormat(S.team), full = mf.periods * mf.minutes;
  const tr = trAll.map(e => { const as = S.att.filter(a => a.event_id === e.id); if (!as.length) return null; const n = as.filter(a => a.status === "aanwezig" || a.status === "te laat").length, of = P.length || as.length; return { e, n, of, p: pct(n, of) }; }).filter(Boolean);
  /* per speler */
  const rows = P.map(p => {
    const ms = oneADay(M.map(e => ({ e, a: attOf(e.id, p.id) })).filter(x => x.a && x.a.status === "aanwezig")), A = ms.map(x => x.a);
    const trIn = tr.filter(t => { const a = attOf(t.e.id, p.id); return a && (a.status === "aanwezig" || a.status === "te laat"); }).length;
    const minutes = Math.round(A.reduce((s, a) => s + (+a.minutes || 0), 0)), goals = A.reduce((s, a) => s + (+a.goals || 0), 0), assists = A.reduce((s, a) => s + (+a.assists || 0), 0);
    const tags = {}; A.forEach(a => (a.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1));
    const strengths = {}; A.forEach(a => (a.strengths || []).forEach(t => strengths[t] = (strengths[t] || 0) + 1));
    const ev = S.evals.filter(x => x.player_id === p.id).sort((a, b) => a.moment - b.moment), last = ev.length ? avg(Object.values(ev[ev.length - 1].scores || {}).map(Number)) : null;
    return { p, name: pname(p), trIn, trPct: tr.length ? pct(trIn, tr.length) : null, matches: ms.length, basis: A.filter(a => a.role === "basis").length, minutes,
      share: ms.length && minutes ? Math.round(100 * minutes / (ms.length * full)) : null, goals, assists, ga: goals + assists, rating: avg(A.map(a => a.rating).filter(Boolean)),
      motm: M.filter(e => e.report?.motm === p.id).length, evalAvg: last, tags, strengths, captain: A.filter(a => a.captain).length };
  });
  const W = played.filter(e => res(e) === "win").length, D = played.filter(e => res(e) === "draw").length, L = played.filter(e => res(e) === "loss").length;
  const gf = played.reduce((s, e) => s + e.score_for, 0), ga = played.reduce((s, e) => s + e.score_against, 0), clean = played.filter(e => e.score_against === 0).length;
  const rAll = avg(rows.map(r => r.rating).filter(Boolean)), trAvg = avg(tr.map(t => t.p));
  const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}"${cur === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;

  v.innerHTML = head("Cijfers", `${esc(S.team.name)} · ${M.length} ${M.length === 1 ? "wedstrijd" : "wedstrijden"} en ${tr.length} trainingen in deze periode. Alles wordt automatisch berekend uit je kalender, aanwezigheden en wedstrijdverslagen.`,
    `<button class="btn ghost" type="button" id="csv">${IC.dl}Exporteren naar Excel</button>`) +
    `<div class="cffilt"><label class="flt"><span>Periode</span>${sel("cfper", CF_PER, CF.per)}</label>${squads.length > 1 ? `<label class="flt"><span>Reeks</span>${sel("cfsq", [["", "Alle reeksen"], ...squads.map(s => [s, s])], CF.squad)}</label>` : ""}</div>
    <div class="ptabs" role="tablist">${CF_TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${CF.tab === k}">${l}</button>`).join("")}</div><div id="cfv"></div>`;
  $("#cfper").onchange = e => { CF.per = e.target.value; render(); };
  const sq = $("#cfsq"); if (sq) sq.onchange = e => { CF.squad = e.target.value; render(); };
  $$("[data-tab]", v).forEach(b => b.onclick = () => { CF.tab = b.dataset.tab; render(); });
  const host = $("#cfv");

  if (CF.tab === "overzicht") {
    const home = played.filter(e => e.home !== false), away = played.filter(e => e.home === false), rec = xs => { const w = xs.filter(e => res(e) === "win").length, d = xs.filter(e => res(e) === "draw").length; return `${w}W ${d}G ${xs.length - w - d}V`; };
    const form = played.slice(-8);
    host.innerHTML = `<div class="kpis">
        <div class="kpi"><small>Resultaten</small><b>${W}<span class="u">W</span> ${D}<span class="u">G</span> ${L}<span class="u">V</span></b><span>${played.length ? pct(W, played.length) + "% gewonnen" : "nog geen uitslagen"}</span></div>
        <div class="kpi"><small>Doelpunten</small><b>${gf} – ${ga}</b><span>${played.length ? `${gf - ga >= 0 ? "+" : ""}${gf - ga} doelsaldo · ${f1(gf / played.length)} per match` : "–"}</span></div>
        <div class="kpi"><small>Geen tegendoelpunt</small><b>${clean}</b><span>${played.length ? f1(ga / played.length) + " tegen per match" : "–"}</span></div>
        <div class="kpi"><small>Aanwezig op training</small><b>${trAvg != null ? Math.round(trAvg) + "%" : "–"}</b><span>gemiddeld over ${tr.length} trainingen</span></div>
        <div class="kpi"><small>Gemiddeld spelerscijfer</small><b>${f1(rAll)}</b><span>uit de wedstrijdverslagen</span></div></div>
      ${form.length ? `<div class="sec panel"><div class="row"><h2 style="margin:0">Vorm</h2><span class="hint">laatste ${form.length} wedstrijden, oudste links</span></div>
        <div class="cfform">${form.map(e => `<a href="#/activiteit/${e.id}" class="cff ${res(e)}" data-tip="${esc(`<b>${e.home === false ? "@ " : "vs "}${esc(e.opponent || "")}</b><br>${dShort(e.date)}`)}"><b>${res(e) === "win" ? "W" : res(e) === "loss" ? "V" : "G"}</b><span>${e.score_for}-${e.score_against}</span></a>`).join("")}</div></div>` : ""}
      <div class="sec panel"><h2>Doelpunten per wedstrijd</h2>${cfGoalChart(played)}</div>
      <div class="grid2 sec"><div class="panel"><h2>Thuis en uit</h2><div class="cfsplit"><div><small class="muted">Thuis</small><b>${rec(home)}</b><span>${home.reduce((s, e) => s + e.score_for, 0)} – ${home.reduce((s, e) => s + e.score_against, 0)}</span></div><div><small class="muted">Uit</small><b>${rec(away)}</b><span>${away.reduce((s, e) => s + e.score_for, 0)} – ${away.reduce((s, e) => s + e.score_against, 0)}</span></div></div>
        ${squads.length > 1 && !CF.squad ? `<h2 style="margin-top:18px">Per reeks</h2><div class="cfsplit">${squads.map(s => { const xs = played.filter(e => e.report?.squad === s); return `<div><small class="muted">${esc(s)}</small><b>${rec(xs)}</b><span>${xs.reduce((a, e) => a + e.score_for, 0)} – ${xs.reduce((a, e) => a + e.score_against, 0)}</span></div>`; }).join("")}</div>` : ""}</div>
        <div class="panel"><h2>Uitblinkers</h2>${(() => { const top = (k, l, fmt) => { const r = rows.filter(x => x[k]).sort((a, b) => b[k] - a[k])[0]; return r ? `<div class="item static" data-go="#/speler/${r.p.id}"><span class="num">${r.p.number ?? ""}</span><span class="main"><b>${esc(r.name)}</b><small>${l}</small></span><span class="val"><b>${fmt(r[k])}</b></span></div>` : ""; };
          return `<div class="list">${top("goals", "Meeste doelpunten", n => n)}${top("assists", "Meeste assists", n => n)}${top("rating", "Hoogste gemiddelde cijfer", f1)}${top("motm", "Vaakst man van de match", n => n + "×")}${top("trPct", "Hoogste aanwezigheid op training", n => n + "%")}</div>` || `<p class="muted">Nog geen gegevens.</p>`; })()}</div></div>
      <div class="sec panel"><h2>Aanwezigheid per training</h2>${cfAttChart(tr)}<p class="hint" style="margin-bottom:0">Grijze staven: minder dan 60% van de spelers aanwezig.</p></div>`;
  }
  if (CF.tab === "spelers") {
    const cols = [["name", "Speler"], ["trPct", "Training %"], ["matches", "Wedstr."], ["basis", "Basis"], ["minutes", "Minuten"], ["share", "Speeltijd %"], ["goals", "Goals"], ["assists", "Assists"], ["ga", "G+A"], ["rating", "Cijfer"], ["motm", "MVP"], ["evalAvg", "Evaluatie"]];
    const num = cols.slice(1).map(c => c[0]), mx = Object.fromEntries(num.map(k => [k, Math.max(0, ...rows.map(r => +r[k] || 0))]));
    const sorted = rows.slice().sort((a, b) => { const x = CF.sortK === "name" ? a.name : a[CF.sortK] ?? -1, y = CF.sortK === "name" ? b.name : b[CF.sortK] ?? -1; return (x > y ? 1 : x < y ? -1 : 0) * CF.sortD; });
    const cell = (r, k) => { const val = r[k]; if (val == null || val === "") return `<td>–</td>`; const n = mx[k] ? val / mx[k] : 0, txt = k === "rating" || k === "evalAvg" ? f1(val) : k === "trPct" || k === "share" ? val + "%" : val;
      return `<td style="--h:${Math.round(4 + 26 * n)}%">${txt}</td>`; };
    host.innerHTML = `<p class="hint" style="margin-top:0">Tik op een kolom om te sorteren, op een speler om zijn fiche te openen. Hoe geler het vakje, hoe hoger in de ploeg.</p>
      <div class="panel wrapx" style="padding:4px 0"><table class="tbl cftbl"><thead><tr>${cols.map(([k, l]) => `<th data-k="${k}" aria-sort="${CF.sortK === k ? (CF.sortD > 0 ? "ascending" : "descending") : "none"}">${l}${CF.sortK === k ? (CF.sortD > 0 ? " ↑" : " ↓") : ""}</th>`).join("")}</tr></thead>
      <tbody>${sorted.map(r => `<tr class="go" data-go="#/speler/${r.p.id}"><td><span class="cfnum">${r.p.number ?? ""}</span>${esc(r.name)}</td>${num.map(k => cell(r, k)).join("")}</tr>`).join("")}</tbody>
      <tfoot><tr><td>Ploeg</td><td>${trAvg != null ? Math.round(trAvg) + "%" : "–"}</td><td>${M.length}</td><td></td><td>${rows.reduce((s, r) => s + r.minutes, 0)}</td><td></td><td>${rows.reduce((s, r) => s + r.goals, 0)}</td><td>${rows.reduce((s, r) => s + r.assists, 0)}</td><td></td><td>${f1(rAll)}</td><td></td><td></td></tr></tfoot></table></div>`;
    $$("th[data-k]", host).forEach(th => th.onclick = () => { if (CF.sortK === th.dataset.k) CF.sortD *= -1; else { CF.sortK = th.dataset.k; CF.sortD = th.dataset.k === "name" ? 1 : -1; } render(); });
  }
  if (CF.tab === "speeltijd") {
    const withM = rows.filter(r => r.matches), avgMin = avg(withM.map(r => r.minutes)), avgShare = avg(withM.map(r => r.share).filter(x => x != null));
    const low = withM.filter(r => avgMin && r.minutes < avgMin * .75);
    const noMin = M.length && !rows.some(r => r.minutes);
    host.innerHTML = `${noMin ? `<div class="share">${IC.eye}<div>Er zijn nog geen speelminuten ingevuld. Vul ze in bij <b>Opstelling per kwart</b> of bij <b>Spelers beoordelen</b> in een wedstrijd, dan zie je hier de verdeling.</div></div>` : ""}
      <div class="kpis sec"><div class="kpi"><small>Gemiddeld per speler</small><b>${avgMin != null ? Math.round(avgMin) : "–"}<span class="u"> min</span></b><span>over ${M.length} wedstrijden</span></div>
        <div class="kpi"><small>Gemiddeld deel van de match</small><b>${avgShare != null ? Math.round(avgShare) + "%" : "–"}</b><span>van ${full} minuten per wedstrijd</span></div>
        <div class="kpi"><small>Duidelijk minder speeltijd</small><b>${low.length}</b><span>${low.length ? "minder dan 75% van het gemiddelde" : "de verdeling is evenwichtig"}</span></div></div>
      <div class="sec panel"><h2>Speelminuten per speler</h2><p class="hint" style="margin-top:0">De zwarte streep is het gemiddelde. Rood: duidelijk minder dan gemiddeld. Bij jeugdvoetbal streven we naar evenveel speeltijd voor iedereen.</p>
        ${cfBars(rows.slice().sort((a, b) => b.minutes - a.minutes).map(r => ({ l: r.name, v: r.minutes, vl: `${r.minutes} min`, warn: avgMin && r.matches && r.minutes < avgMin * .75, c: avgMin && r.matches && r.minutes < avgMin * .75 ? "var(--s-bad,#E11D48)" : null, href: "#/speler/" + r.p.id,
          tip: `<b>${esc(r.name)}</b><br>${r.matches} wedstrijden · ${r.basis}× basis${r.share != null ? `<br>${r.share}% van de speeltijd in zijn wedstrijden` : ""}` })), { ref: avgMin, empty: "Nog geen wedstrijden in deze periode." })}</div>
      <div class="sec panel"><h2>Basis en wedstrijden</h2>${cfBars(rows.slice().sort((a, b) => b.matches - a.matches).map(r => ({ l: r.name, v: r.matches, vl: `${r.matches} · ${r.basis}× basis`, href: "#/speler/" + r.p.id })), { empty: "Nog geen wedstrijden." })}</div>`;
  }
  if (CF.tab === "goals") {
    const G = M.flatMap(e => (e.report?.goals || []).map(g => ({ ...g, e }))), gFor = G.filter(g => g.side === "for"), gAg = G.filter(g => g.side === "against");
    const types = ["Open spel", "Counter", "Stilstaande fase", "Penalty", "Eigen doelpunt"], tc = xs => types.map(t => [t, xs.filter(g => (g.type || "Open spel") === t).length]);
    const per = Array.from({ length: mf.periods }, (_, k) => k), perOf = g => g.min == null ? null : Math.min(mf.periods - 1, Math.floor((g.min - 1) / mf.minutes));
    const pl = (k, l) => cfBars(rows.filter(r => r[k]).sort((a, b) => b[k] - a[k]).map(r => ({ l: r.name, v: r[k], href: "#/speler/" + r.p.id })), { empty: `Nog geen ${l}.` });
    const hasMin = G.some(g => g.min != null);
    host.innerHTML = `<div class="kpis"><div class="kpi"><small>Gescoord</small><b>${gf}</b><span>${played.length ? f1(gf / played.length) + " per match" : "–"}</span></div><div class="kpi"><small>Tegen</small><b>${ga}</b><span>${played.length ? f1(ga / played.length) + " per match" : "–"}</span></div>
        <div class="kpi"><small>Verschillende doelpuntenmakers</small><b>${rows.filter(r => r.goals).length}</b><span>van ${P.length} spelers</span></div><div class="kpi"><small>Met assist</small><b>${gFor.length ? pct(gFor.filter(g => g.assist_id).length, gFor.length) + "%" : "–"}</b><span>van de geregistreerde doelpunten</span></div></div>
      <div class="grid2 sec"><div class="panel"><h2>Topschutters</h2>${pl("goals", "doelpunten")}</div><div class="panel"><h2>Assists</h2>${pl("assists", "assists")}</div></div>
      <div class="grid2 sec"><div class="panel"><h2>Hoe vallen de doelpunten?</h2>${G.length ? `<table class="tbl"><thead><tr><th>Soort</th><th>Voor</th><th>Tegen</th></tr></thead><tbody>${types.map((t, k) => { const a = tc(gFor)[k][1], b = tc(gAg)[k][1]; return a || b ? `<tr><td>${t}</td><td>${a}</td><td>${b}</td></tr>` : ""; }).join("")}</tbody></table>` : `<p class="muted">Registreer doelpunten in het wedstrijdverslag om dit te zien.</p>`}</div>
        <div class="panel"><h2>Per ${mf.periods === 2 ? "helft" : "periode"}</h2>${hasMin ? `<div class="cfper">${per.map(k => { const a = gFor.filter(g => perOf(g) === k).length, b = gAg.filter(g => perOf(g) === k).length, m = Math.max(1, ...per.map(j => Math.max(gFor.filter(g => perOf(g) === j).length, gAg.filter(g => perOf(g) === j).length)));
          return `<div class="cfpc" data-tip="${esc(`<b>${k + 1}e ${mf.periods === 2 ? "helft" : "periode"}</b><br>${a} gescoord · ${b} tegen`)}"><div class="cfpb"><i style="height:${100 * a / m}%;background:${COL_FOR}"></i><i style="height:${100 * b / m}%;background:${COL_AG}"></i></div><small>${k + 1}e</small><span>${a} – ${b}</span></div>`; }).join("")}</div>
          <div class="cflegend"><span><i style="background:${COL_FOR}"></i>Gescoord</span><span><i style="background:${COL_AG}"></i>Tegen</span></div>` : `<p class="muted">Vul de minuut in bij de doelpunten om te zien wanneer ze vallen.</p>`}</div></div>`;
  }
  if (CF.tab === "werkpunten") {
    const cnt = k => { const o = {}; rows.forEach(r => Object.entries(r[k]).forEach(([t, n]) => { o[t] = o[t] || { n: 0, who: [] }; o[t].n += n; o[t].who.push(r.name + (n > 1 ? ` (${n}×)` : "")); })); return Object.entries(o).sort((a, b) => b[1].n - a[1].n); };
    const tags = cnt("tags"), str = cnt("strengths");
    host.innerHTML = `${tags.length ? `<div class="share">${IC.book}<div><b style="color:var(--ink)">Trainingsfocus</b><br>Het vaakst genoteerd als werkpunt: <b>${tags.slice(0, 3).map(t => esc(t[0])).join("</b>, <b>")}</b>. Zoek in de <a href="#/bibliotheek">trainingsbibliotheek</a> oefeningen rond deze thema's.</div></div>` : ""}
      <div class="grid2 sec"><div class="panel"><h2>Werkpunten bij wedstrijden</h2><p class="hint" style="margin-top:0">Hoe vaak een werkpunt bij een speler werd aangeduid. Beweeg of tik voor de namen.</p>${cfBars(tags.map(([t, o]) => ({ l: t, v: o.n, vl: o.n + "×", c: COL_AG, tip: `<b>${esc(t)}</b><br>${o.who.map(esc).join(", ")}` })), { empty: "Nog geen werkpunten aangeduid in de wedstrijdverslagen." })}</div>
        <div class="panel"><h2>Sterke punten</h2><p class="hint" style="margin-top:0">Wat bij spelers het vaakst als sterk punt werd aangeduid.</p>${cfBars(str.map(([t, o]) => ({ l: t, v: o.n, vl: o.n + "×", tip: `<b>${esc(t)}</b><br>${o.who.map(esc).join(", ")}` })), { empty: "Nog geen sterke punten aangeduid." })}</div></div>
      <div class="sec panel"><h2>Per speler</h2><div class="list">${rows.filter(r => Object.keys(r.tags).length || Object.keys(r.strengths).length).map(r => { const tt = Object.entries(r.tags).sort((a, b) => b[1] - a[1]).slice(0, 2), ss = Object.entries(r.strengths).sort((a, b) => b[1] - a[1]).slice(0, 2);
          return `<div class="item" data-go="#/speler/${r.p.id}"><span class="num">${r.p.number ?? ""}</span><span class="main"><b>${esc(r.name)}</b><small>${ss.length ? "Sterk: " + ss.map(([t, n]) => esc(t) + (n > 1 ? ` (${n}×)` : "")).join(", ") : ""}${ss.length && tt.length ? " · " : ""}${tt.length ? "Werkpunt: " + tt.map(([t, n]) => esc(t) + (n > 1 ? ` (${n}×)` : "")).join(", ") : ""}</small></span></div>`; }).join("") || `<p class="muted">Nog niets aangeduid.</p>`}</div></div>`;
  }
  $$("[data-go]", v).forEach(x => x.onclick = ev => { ev.preventDefault?.(); go(x.dataset.go); });
  $("#csv").onclick = () => download(`${S.team.name.replace(/[^\w-]+/g, "_")}_cijfers_${today}.csv`, "﻿" + [
    ["Speler", "Rugnummer", "Aanwezig training %", "Trainingen aanwezig", "Trainingen totaal", "Wedstrijden", "Basis", "Minuten", "Speeltijd %", "Goals", "Assists", "Gem. cijfer", "Man van de match", "Laatste evaluatie", "Meest genoteerd werkpunt"].map(csvCell).join(";"),
    ...rows.map(r => { const top = Object.entries(r.tags).sort((a, b) => b[1] - a[1])[0];
      return [r.name, r.p.number, r.trPct ?? "", r.trIn, tr.length, r.matches, r.basis, r.minutes, r.share ?? "", r.goals, r.assists, r.rating ? f1(r.rating) : "", r.motm, r.evalAvg ? f1(r.evalAvg) : "", top ? `${top[0]} (${top[1]}×)` : ""].map(csvCell).join(";"); })].join("\r\n"));
} });
