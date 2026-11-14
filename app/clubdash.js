/* FootballCoachHub — clubdashboard: hoe staat de club ervoor? Alleen aantallen per ploeg, nooit namen van kinderen.
   Gegevens uit club_dashboard2 (databaseversie 44); valt terug op club_dashboard + club_spelersprofiel als die nog ontbreekt. */
"use strict";
let CD = (() => { try { const o = JSON.parse(localStorage.getItem("ogv-cd")); if (o && typeof o === "object") return { since: 120, tab: "overzicht", sel: null, ...o, open: false }; } catch (e) {} return { since: 120, tab: "overzicht", sel: null, open: false }; })();
const cdSave = () => { try { localStorage.setItem("ogv-cd", JSON.stringify({ since: CD.since, tab: CD.tab, sel: CD.sel })); } catch (e) {} };
const CD_TABS = [["overzicht", "Overzicht"], ["spelers", "Spelers"], ["trainingen", "Trainingen"], ["wedstrijden", "Wedstrijden"], ["ploegen", "Per ploeg"]];
const CD_Q = ["#FFD100", "#E0B400", "#B38F00", "#806600"];
const CD_M = [["vroeg", "Vroegmatuur", "#F59E0B"], ["normaal", "Normaal matuur", "#10B981"], ["laat", "Laatmatuur", "#3B82F6"]];

async function cdData(since) {
  if (mode !== "demo") {
    const r = await sb.rpc("club_dashboard2", { since }); if (!r.error) return { rows: r.data || [], full: true };
    if (!/club_dashboard2|function/i.test(r.error.message)) throw r.error;
    const a = await sb.rpc("club_dashboard", { since }); if (a.error) throw a.error;
    const b = await sb.rpc("club_spelersprofiel"); const sp = b.error ? [] : b.data || [];
    return { rows: (a.data || []).map(t => ({ ...t, ...(sp.find(x => x.id === t.id) || {}), players: t.players })), full: false };
  }
  const [T, P, E, A, EV, TT] = await Promise.all(["teams", "players", "events", "attendance", "evaluations", "team_trainers"].map(k => db.list(k)));
  const M = await db.list("player_measures").catch(() => []), today = todayIso();
  return { full: true, rows: T.map(t => { const ps = P.filter(p => p.team_id === t.id && p.active !== false), ev = E.filter(e => e.team_id === t.id && e.date >= since && e.date <= today);
    const tr = ev.filter(e => e.type === "training" && !e.cancelled), ma = ev.filter(e => e.type === "wedstrijd" && !e.cancelled), pl = ma.filter(e => e.score_for != null && e.score_against != null);
    const at = A.filter(a => tr.some(e => e.id === a.event_id)), here = at.filter(a => a.status === "aanwezig" || a.status === "te laat"), evs = {};
    EV.filter(x => ps.some(p => p.id === x.player_id)).forEach(x => evs[x.moment] = (evs[x.moment] || 0) + 1);
    const c = typeof spCount === "function" ? spCount(ps) : {};
    return { id: t.id, name: t.name, category: t.category, format: t.format, trainers: TT.filter(x => x.team_id === t.id).length, trainers_dipl: 0, ...c, players: ps.length,
      links: ps.filter(p => p.foot === "Links").length, rechts: ps.filter(p => p.foot === "Rechts").length, beide: ps.filter(p => p.foot === "Beide").length,
      scouted: ps.filter(p => p.scout && Object.keys(p.scout).length).length, measured: new Set(M.filter(m => ps.some(p => p.id === m.player_id)).map(m => m.player_id)).size,
      trainings: tr.length, trainings_cancel: ev.filter(e => e.type === "training" && e.cancelled).length, trainings_att: tr.filter(e => A.some(a => a.event_id === e.id)).length,
      trainings_plan: tr.filter(e => e.plan && Object.keys(e.plan).length).length, att_pct: at.length ? Math.round(100 * here.length / at.length) : null,
      late_pct: here.length ? Math.round(100 * here.filter(a => a.status === "te laat").length / here.length) : null,
      matches: ma.length, matches_report: pl.length, w: pl.filter(e => e.score_for > e.score_against).length, d: pl.filter(e => e.score_for === e.score_against).length,
      l: pl.filter(e => e.score_for < e.score_against).length, gf: pl.reduce((s, e) => s + e.score_for, 0), ga: pl.reduce((s, e) => s + e.score_against, 0), evals: evs,
      next: E.filter(e => e.team_id === t.id && e.date >= today && !e.cancelled).map(e => e.date).sort()[0] || null }; }) };
}

route("clubdashboard", { title: "Clubdashboard", auth: true, render: async v => {
  if (!(S.admin || S.allTeams || (S.teamAccess || []).length)) { v.innerHTML = `<div class="empty"><b>Alleen voor beheerders en coördinatoren</b>Vraag de beheerder om toegang.</div>`; return; }
  if (!V14()) { v.innerHTML = head("Clubdashboard", "") + needV14("Het clubdashboard"); return; }
  v.innerHTML = head("Clubdashboard", "Laden…");
  const since = iso(addDays(new Date(), -CD.since)); let D;
  try { D = await cdData(since); } catch (e) { v.innerHTML = head("Clubdashboard", "") + `<div class="empty"><b>Laden mislukt</b>${esc(e.message || e)}</div>`; return; }
  const allRows = D.rows.slice().sort((a, b) => (ageOfTeam(a) ?? 99) - (ageOfTeam(b) ?? 99) || a.name.localeCompare(b.name, "nl", { numeric: true }));
  if (CD.sel) CD.sel = CD.sel.filter(id => allRows.some(r => r.id === id)); if (CD.sel && !CD.sel.length) CD.sel = null;
  const rows = CD.sel ? allRows.filter(r => CD.sel.includes(r.id)) : allRows;
  const N = k => rows.reduce((s, r) => s + (+r[k] || 0), 0), pc = (a, b) => b ? Math.round(100 * a / b) : null, pcs = (a, b) => b ? pc(a, b) + "%" : "–";
  const mom = typeof EV_MOMENTS !== "undefined" ? EV_MOMENTS : [], curM = (() => { const m = new Date().getMonth() + 1; return m >= 8 && m <= 10 ? 2 : m >= 11 || m <= 1 ? 3 : m <= 4 ? 4 : 5; })();
  const weeks = Math.max(1, CD.since / 7), withAtt = rows.filter(r => r.att_pct != null), attAvg = withAtt.length ? Math.round(withAtt.reduce((s, r) => s + r.att_pct, 0) / withAtt.length) : null;
  const P = N("players"), withB = P - N("nobirth"), H1 = N("q1") + N("q2"), MK = N("vroeg") + N("normaal") + N("laat"), played = N("w") + N("d") + N("l");
  const flags = r => { const f = [];
    if (!r.trainers) f.push(["geen trainer", 3]); if (!r.players) f.push(["geen spelers", 2]);
    if (r.trainings && pc(r.trainings_att, r.trainings) < 60) f.push(["aanwezigheden niet bijgehouden", 2]); if (r.att_pct != null && r.att_pct < 70) f.push([`lage aanwezigheid (${r.att_pct}%)`, 2]);
    if (r.matches && r.matches_report < r.matches) f.push([(r.matches - r.matches_report) + " uitslag(en) ontbreken", 1]);
    if (!r.next) f.push(["niets meer gepland", 1]); if (r.players && (r.evals || {})[curM] != null && (r.evals || {})[curM] < r.players / 2 && new Date().getMonth() !== 7) f.push(["evaluaties " + (mom[curM - 1]?.kort || "") + " achter", 1]);
    return f; };
  const probs = rows.map(r => ({ r, f: flags(r) })).filter(x => x.f.length).sort((a, b) => Math.max(...b.f.map(x => x[1])) - Math.max(...a.f.map(x => x[1])));
  const kpi = (l, val, sub, tone) => `<div class="kpi"><small>${l}</small><b${tone ? ` style="color:var(--${tone})"` : ""}>${val}</b><span>${sub}</span></div>`;
  const bars = (list, opts) => cfBars(list, opts);

  /* inzichten: korte zinnen die de cijfers duiden */
  const ins = [];
  if (withB >= 12) { const h = pc(H1, withB); if (h >= 60) ins.push(["warn", `<b>${h}% van de spelers is in de eerste jaarhelft geboren.</b> Dat wijst op een relatief leeftijdseffect: spelers uit Q3 en Q4 vallen sneller af of worden minder gekozen.`]); else ins.push(["ok", `Geboortedata zijn evenwichtig verdeeld: ${h}% in de eerste jaarhelft.`]); }
  if (P && pc(MK, P) < 50) ins.push(["info", `Maturiteit is pas voor <b>${pcs(MK, P)}</b> van de spelers ingeschat. Vraag de trainers om ze in te vullen op de spelersfiche.`]);
  else if (MK) { const lm = pc(N("laat"), MK), vm = pc(N("vroeg"), MK); ins.push([vm > lm + 15 ? "warn" : "ok", `Maturiteit: ${vm}% vroegmatuur en ${lm}% laatmatuur.${vm > lm + 15 ? " Laatmature spelers zijn ondervertegenwoordigd: let op dat ze niet wegvallen." : ""}`]); }
  if (attAvg != null) ins.push([attAvg >= 80 ? "ok" : attAvg >= 70 ? "info" : "warn", `Gemiddelde aanwezigheid op training: <b>${attAvg}%</b>.`]);
  if (D.full && N("trainers")) { const dp = pc(N("trainers_dipl"), N("trainers")); if (dp < 50) ins.push(["info", `Slechts ${dp}% van de trainersplaatsen heeft een trainer met een diploma in zijn profiel.`]); }
  if (N("trainings")) { const pp = pc(N("trainings_plan"), N("trainings")); if (pp < 50) ins.push(["info", `${pp}% van de trainingen had een trainingsvoorbereiding in de app.`]); }

  const sel = CD.sel ? CD.sel.length + " van " + allRows.length + " ploegen" : "Alle " + allRows.length + " ploegen";
  const preset = k => !CD.sel ? k === "" : k !== "" && CD.sel.length && allRows.filter(r => bouwOf(r) === k).map(r => r.id).sort().join() === CD.sel.slice().sort().join();
  v.innerHTML = `<div class="cd">
    ${head("Clubdashboard", "Hoe staat de club ervoor? Enkel aantallen per ploeg, nooit namen van kinderen.", `<button class="btn ghost" type="button" id="cdx">${IC.out}Excel</button>`)}
    <div class="cd-bar">
      <div class="cd-seg" role="group" aria-label="Periode">${[[28, "4 weken"], [56, "8 weken"], [120, "Seizoen"]].map(([n, l]) => `<button type="button" data-sn="${n}" aria-pressed="${CD.since === n}">${l}</button>`).join("")}</div>
      <div class="cd-seg" role="group" aria-label="Ploegen">${BOUW.map(([k, l]) => `<button type="button" data-bw="${k}" aria-pressed="${preset(k)}">${esc(k ? l.split(" ")[0] : "Alle")}</button>`).join("")}
        <button type="button" id="cdpk" aria-expanded="${CD.open}" aria-pressed="${!!CD.sel && !BOUW.some(([k]) => k && preset(k))}">Kies ploegen</button></div>
      <span class="cd-sel">${esc(sel)}</span></div>
    <div class="cd-pick" id="cdp"${CD.open ? "" : " hidden"}>${allRows.map(r => `<button type="button" class="chip" data-tp="${r.id}" aria-pressed="${!CD.sel || CD.sel.includes(r.id)}">${esc(r.name)}</button>`).join("")}
      <span class="cd-pk-act"><button type="button" class="link" data-all="1">Alles aan</button> · <button type="button" class="link" data-all="0">Alles uit</button></span></div>
    ${D.full ? "" : `<div class="share" style="margin:12px 0">${IC.eye}<div>Voer <b>supabase-clubdashboard-v44.sql</b> uit voor alle cijfers (uitslagen, voorkeursvoet, diploma's, afgelaste trainingen).</div></div>`}
    <div class="ptabs cd-tabs" role="tablist">${CD_TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${CD.tab === k}">${l}</button>`).join("")}</div>
    <div id="cdv"></div></div>`;
  const host = $("#cdv");
  const qBars = () => bars([["Q1 · jan–mrt", N("q1")], ["Q2 · apr–jun", N("q2")], ["Q3 · jul–sep", N("q3")], ["Q4 · okt–dec", N("q4")]].map(([l, n], i) => ({ l, v: n, vl: `${n} · ${pcs(n, withB)}`, c: CD_Q[i] })));
  const mBars = () => bars(CD_M.map(([k, l, c]) => ({ l, v: N(k), vl: `${N(k)} · ${pcs(N(k), MK)}`, c })).concat([{ l: "Niet ingeschat", v: P - MK, vl: `${P - MK}`, c: "var(--line2)" }]));
  const stack = (r, parts) => { const tot = parts.reduce((s, p) => s + p[1], 0); return tot ? `<span class="cd-stk" title="${esc(parts.map(p => p[0] + ": " + p[1]).join(" · "))}">${parts.filter(p => p[1]).map(p => `<i style="flex:${p[1]};background:${p[2]}">${p[1]}</i>`).join("")}</span>` : `<span class="hint">–</span>`; };

  if (CD.tab === "overzicht") host.innerHTML = `
    <div class="kpis">${kpi("Ploegen", rows.length, `${N("trainers")} ${N("trainers") === 1 ? "trainer" : "trainers"} gekoppeld`)}${kpi("Spelers", P, rows.length ? `gemiddeld ${Math.round(P / rows.length)} per ploeg` : "–")}
      ${kpi("Aanwezigheid", attAvg != null ? attAvg + "%" : "–", "gemiddeld op training", attAvg != null && attAvg < 70 ? "warn" : "")}
      ${kpi("Resultaten", played ? `${N("w")}<span class="u">W</span> ${N("d")}<span class="u">G</span> ${N("l")}<span class="u">V</span>` : "–", played ? pc(N("w"), played) + "% gewonnen" : "nog geen uitslagen")}
      ${kpi("Vraagt aandacht", probs.length, probs.length === 1 ? "ploeg" : "ploegen", probs.length ? "warn" : "")}</div>
    ${ins.length ? `<div class="sec cd-ins">${ins.map(([t, h]) => `<p class="cd-in ${t}">${h}</p>`).join("")}</div>` : ""}
    <div class="grid2 sec"><div class="panel"><h2>Geboortekwartaal</h2>${qBars()}<p class="hint" style="margin-bottom:0">Eerste jaarhelft: <b>${pcs(H1, withB)}</b> · tweede jaarhelft: <b>${pcs(withB - H1, withB)}</b>${N("nobirth") ? ` · ${N("nobirth")} zonder geboortedatum` : ""}</p></div>
      <div class="panel"><h2>Maturiteit</h2>${mBars()}<p class="hint" style="margin-bottom:0">Inschatting van de trainers ten opzichte van leeftijdsgenoten.</p></div></div>
    <div class="sec panel"><h2>Vraagt aandacht</h2>${probs.length ? `<div class="cd-probs">${probs.map(({ r, f }) => `<div><b>${esc(r.name)}</b><span>${f.map(([t, s]) => `<em class="s${s}">${esc(t)}</em>`).join("")}</span></div>`).join("")}</div>` : `<p class="hint" style="margin:0">Alles in orde bij de gekozen ploegen.</p>`}</div>`;

  if (CD.tab === "spelers") host.innerHTML = `
    <div class="kpis">${kpi("Spelers", P, `in ${rows.length} ploegen`)}${kpi("Eerste jaarhelft", pcs(H1, withB), `${H1} spelers · jan–jun`)}${kpi("Maturiteit ingeschat", pcs(MK, P), `${MK} van ${P}`)}
      ${D.full ? kpi("Scoutingprofiel", pcs(N("scouted"), P), `${N("scouted")} spelers met profiel`) + kpi("Gemeten", pcs(N("measured"), P), "met lengte of gewicht") : ""}</div>
    <div class="grid2 sec"><div class="panel"><h2>Geboortekwartaal</h2>${qBars()}</div><div class="panel"><h2>Maturiteit</h2>${mBars()}</div></div>
    ${D.full ? `<div class="sec panel"><h2>Voorkeursvoet</h2>${bars([["Rechts", N("rechts"), "#FFD100"], ["Links", N("links"), "#10B981"], ["Beide", N("beide"), "#3B82F6"], ["Niet ingevuld", P - N("rechts") - N("links") - N("beide"), "var(--line2)"]].map(([l, n, c]) => ({ l, v: n, vl: `${n} · ${pcs(n, P)}`, c })))}</div>` : ""}
    <div class="sec panel"><h2>Per ploeg</h2><div class="cd-leg"><span><i style="background:${CD_Q[0]}"></i>Q1</span><span><i style="background:${CD_Q[1]}"></i>Q2</span><span><i style="background:${CD_Q[2]}"></i>Q3</span><span><i style="background:${CD_Q[3]}"></i>Q4</span>${CD_M.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}</div>
      <div class="cd-rows">${rows.map(r => `<div class="cd-row"><b>${esc(r.name)}<small>${r.players} spelers</small></b>${stack(r, [["Q1", +r.q1 || 0, CD_Q[0]], ["Q2", +r.q2 || 0, CD_Q[1]], ["Q3", +r.q3 || 0, CD_Q[2]], ["Q4", +r.q4 || 0, CD_Q[3]]])}${stack(r, CD_M.map(([k, l, c]) => [l, +r[k] || 0, c]))}</div>`).join("")}</div></div>`;

  if (CD.tab === "trainingen") { const tAll = N("trainings");
    host.innerHTML = `<div class="kpis">${kpi("Trainingen", tAll, `${(tAll / weeks / Math.max(1, rows.length)).toFixed(1).replace(".", ",")} per ploeg per week`)}${kpi("Aanwezigheid", attAvg != null ? attAvg + "%" : "–", "gemiddeld per ploeg")}
      ${D.full ? kpi("Te laat", (() => { const x = rows.filter(r => r.late_pct != null); return x.length ? Math.round(x.reduce((s, r) => s + r.late_pct, 0) / x.length) + "%" : "–"; })(), "van wie er was") : ""}
      ${kpi("Bijgehouden", pcs(N("trainings_att"), tAll), "met aanwezigheden")}${kpi("Met plan", pcs(N("trainings_plan"), tAll), "trainingsvoorbereiding")}${D.full ? kpi("Afgelast", N("trainings_cancel"), "in deze periode") : ""}</div>
      <div class="grid2 sec"><div class="panel"><h2>Aanwezigheid per ploeg</h2>${bars(rows.filter(r => r.att_pct != null).sort((a, b) => b.att_pct - a.att_pct).map(r => ({ l: r.name, v: r.att_pct, vl: r.att_pct + "%", warn: r.att_pct < 70, c: r.att_pct < 70 ? "var(--bad)" : "" })), { empty: "Nog geen aanwezigheden." })}</div>
        <div class="panel"><h2>Trainingen per ploeg</h2>${bars(rows.slice().sort((a, b) => b.trainings - a.trainings).map(r => ({ l: r.name, v: r.trainings, vl: `${r.trainings} · ${pcs(r.trainings_plan, r.trainings)} met plan` })), { empty: "Nog geen trainingen." })}</div></div>`; }

  if (CD.tab === "wedstrijden") { const rep = N("matches_report");
    host.innerHTML = `<div class="kpis">${kpi("Wedstrijden", N("matches"), `${rep} met uitslag (${pcs(rep, N("matches"))})`)}${D.full ? kpi("Gewonnen", pcs(N("w"), played), `${N("w")} W · ${N("d")} G · ${N("l")} V`) + kpi("Doelpunten", `${N("gf")} – ${N("ga")}`, played ? `${(N("gf") / played).toFixed(1).replace(".", ",")} voor · ${(N("ga") / played).toFixed(1).replace(".", ",")} tegen per match` : "–") : ""}</div>
      ${D.full ? `<div class="sec panel"><h2>Resultaten per ploeg</h2><div class="cd-leg"><span><i style="background:var(--ok)"></i>Gewonnen</span><span><i style="background:var(--line2)"></i>Gelijk</span><span><i style="background:var(--bad)"></i>Verloren</span></div>
        <div class="cd-rows">${rows.filter(r => r.matches).map(r => `<div class="cd-row two"><b>${esc(r.name)}<small>${r.gf} – ${r.ga} doelpunten</small></b>${stack(r, [["Gewonnen", +r.w || 0, "var(--ok)"], ["Gelijk", +r.d || 0, "var(--line2)"], ["Verloren", +r.l || 0, "var(--bad)"]])}</div>`).join("") || `<p class="hint">Nog geen wedstrijden in deze periode.</p>`}</div>
        <p class="hint" style="margin-bottom:0">In de onderbouw tellen uitslagen niet: kijk daar vooral naar speelplezier en evenwichtige speeltijd.</p></div>` : ""}
      <div class="sec panel"><h2>Uitslagen ingevuld</h2>${bars(rows.filter(r => r.matches).map(r => ({ l: r.name, v: r.matches_report, vl: `${r.matches_report}/${r.matches}`, warn: r.matches_report < r.matches, c: r.matches_report < r.matches ? "var(--warn)" : "" })), { empty: "Nog geen wedstrijden." })}</div>`; }

  if (CD.tab === "ploegen") { const cell = (val, good) => `<td class="${val == null || val === "–" ? "" : good ? "okc" : "badc"}">${val ?? "–"}</td>`;
    host.innerHTML = `<div class="panel"><div class="tblwrap"><table class="tbl dbt"><tr><th>Ploeg</th><th>Trainers</th><th>Spelers</th><th>Q1–Q2</th><th>Matuur V/N/L</th><th>Aanwezig</th><th>Bijgehouden</th><th>Met plan</th>${D.full ? "<th>W-G-V</th>" : ""}<th>Uitslagen</th><th>Evaluatie ${esc(mom[curM - 1]?.kort || "")}</th><th>Volgende</th></tr>
      ${rows.map(r => { const ev = (r.evals || {})[curM] || 0, wb = (+r.players || 0) - (+r.nobirth || 0); return `<tr><td><b>${esc(r.name)}</b></td>${cell(r.trainers, r.trainers > 0)}<td>${r.players}</td><td>${wb ? pc((+r.q1 || 0) + (+r.q2 || 0), wb) + "%" : "–"}</td><td>${(+r.vroeg || 0) + (+r.normaal || 0) + (+r.laat || 0) ? `${r.vroeg || 0}/${r.normaal || 0}/${r.laat || 0}` : "–"}</td>
        ${cell(r.att_pct == null ? null : r.att_pct + "%", r.att_pct >= 75)}${cell(r.trainings ? r.trainings_att + "/" + r.trainings : null, pc(r.trainings_att, r.trainings) >= 80)}<td>${r.trainings ? r.trainings_plan + "/" + r.trainings : "–"}</td>
        ${D.full ? `<td>${r.matches ? `${r.w}-${r.d}-${r.l}` : "–"}</td>` : ""}${cell(r.matches ? r.matches_report + "/" + r.matches : null, r.matches_report >= r.matches)}<td>${r.players ? ev + "/" + r.players : "–"}</td><td>${r.next ? dShort(r.next) : "–"}</td></tr>`; }).join("")}</table></div>
      <p class="hint" style="margin-bottom:0">Groen is in orde, rood vraagt aandacht. Bijgehouden: trainingen met aanwezigheden. Matuur: vroeg / normaal / laat.</p></div>`; }

  const rerender = () => { cdSave(); render(); };
  $$("[data-sn]", v).forEach(b => b.onclick = () => { CD.since = +b.dataset.sn; rerender(); });
  $$("[data-bw]", v).forEach(b => b.onclick = () => { const k = b.dataset.bw; CD.sel = k ? allRows.filter(r => bouwOf(r) === k).map(r => r.id) : null; if (CD.sel && !CD.sel.length) { toast("Geen ploegen in die groep."); CD.sel = null; } rerender(); });
  $("#cdpk").onclick = () => { CD.open = !CD.open; $("#cdp").hidden = !CD.open; $("#cdpk").setAttribute("aria-expanded", CD.open); };
  $$("[data-tp]", v).forEach(b => b.onclick = () => { const cur = new Set(CD.sel || allRows.map(r => r.id)); cur.has(b.dataset.tp) ? cur.delete(b.dataset.tp) : cur.add(b.dataset.tp); CD.sel = cur.size === allRows.length ? null : [...cur]; if (!cur.size) { toast("Kies minstens één ploeg."); CD.sel = null; } CD.open = true; rerender(); });
  $$("[data-all]", v).forEach(b => b.onclick = () => { CD.sel = b.dataset.all === "1" ? null : [allRows[0]?.id].filter(Boolean); CD.open = true; rerender(); });
  $$(".cd-tabs [data-tab]", v).forEach(b => b.onclick = () => { CD.tab = b.dataset.tab; rerender(); });
  $("#cdx").onclick = () => { const cols = [["name", "Ploeg"], ["trainers", "Trainers"], ["players", "Spelers"], ["q1", "Q1"], ["q2", "Q2"], ["q3", "Q3"], ["q4", "Q4"], ["vroeg", "Vroegmatuur"], ["normaal", "Normaal matuur"], ["laat", "Laatmatuur"], ["links", "Linksvoetig"], ["rechts", "Rechtsvoetig"], ["beide", "Tweevoetig"], ["att_pct", "Aanwezigheid %"], ["trainings", "Trainingen"], ["trainings_att", "Met aanwezigheden"], ["trainings_plan", "Met plan"], ["trainings_cancel", "Afgelast"], ["matches", "Wedstrijden"], ["matches_report", "Met uitslag"], ["w", "Gewonnen"], ["d", "Gelijk"], ["l", "Verloren"], ["gf", "Doelpunten voor"], ["ga", "Doelpunten tegen"], ["next", "Volgende"]];
    download("clubdashboard-" + todayIso() + ".csv", "﻿" + [cols.map(c => c[1]).join(";"), ...rows.map(r => cols.map(([k]) => r[k] ?? "").map(csvCell).join(";"))].join("\n")); };
} });
