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

route("dossier", { title: "Spelersdossier", auth: true, team: true, render: (v, id) => {
  const ps = active();
  if (!id) {
    v.innerHTML = head("Spelersdossier", "Alles wat jullie over een speler noteerden op één pagina: speeltijd en cijfers over alle groepjes, aanwezigheid, evaluaties en elke opmerking met de naam van de trainer. Om samen een oudergesprek voor te bereiden.") +
      (ps.length ? `<div class="list">${ps.map(p => { const s = playerStats(p), g = dosCount(matchRows(p.id).map(x => groupOf(x.e)).filter(Boolean));
        return `<a class="item" href="#/dossier/${p.id}"><span class="num">${p.number ?? ""}</span><span class="main"><b>${esc(pname(p))}</b><small>${s.matches} wedstrijden · ${s.minutes} min · cijfer ${f1(s.rating)}${g.length ? " · " + g.map(([k, c]) => `${esc(k)} ${c}×`).join(", ") : ""}</small></span>${IC.chev}</a>`; }).join("")}</div>`
       : `<div class="empty"><b>Nog geen spelers</b></div>`);
    return;
  }
  const p = S.players.find(x => x.id === id);
  if (!p) { v.innerHTML = `<div class="empty"><b>Speler niet gevonden</b><a class="link" href="#/dossier">Terug</a></div>`; return; }
  const s = playerStats(p), rows = matchRows(p.id), A = rows.map(x => x.a), idx = ps.findIndex(x => x.id === p.id);
  const prevP = idx > 0 ? ps[idx - 1] : null, nextP = idx >= 0 && idx < ps.length - 1 ? ps[idx + 1] : null;
  const mf = matchFormat(S.team), full = mf.periods * mf.minutes;
  const age = p.birthdate ? Math.floor((Date.now() - parse(p.birthdate)) / 3.15576e10) : null;
  /* per groepje en per trainer */
  const bySquad = dosCount(rows.map(x => groupOf(x.e) || "Zonder groepje"));
  const raters = [...new Set(A.map(a => a.rated_by).filter(Boolean))];
  const byRater = raters.map(r => { const xs = A.filter(a => a.rated_by === r); return { r, n: xs.length, avg: avg(xs.map(a => a.rating).filter(x => x != null)) }; });
  const unknownN = A.filter(a => !a.rated_by && (a.rating != null || a.note)).length;
  /* team-gemiddelden als vergelijkingspunt */
  const teamMin = avg(ps.map(q => { const r = matchRows(q.id); return r.length ? r.reduce((t, x) => t + (+x.a.minutes || 0), 0) / r.length : null; }).filter(x => x != null));
  const myMin = rows.length ? A.reduce((t, a) => t + (+a.minutes || 0), 0) / rows.length : null;
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
  const share = rows.length && myMin != null ? Math.round(100 * myMin / full) : null;

  v.innerHTML = `<div class="row noprint" style="margin-bottom:10px;gap:8px">${backLink("#/dossier", "Alle dossiers")}<span class="spacer"></span>
      ${prevP ? `<a class="btn ghost small" href="#/dossier/${prevP.id}" title="${esc(pname(prevP))}">‹ Vorige</a>` : ""}${nextP ? `<a class="btn ghost small" href="#/dossier/${nextP.id}" title="${esc(pname(nextP))}">Volgende ›</a>` : ""}
      <a class="btn ghost small" href="#/speler/${p.id}">Spelerskaart</a><button class="btn small" type="button" onclick="print()">${IC.print}Afdrukken</button></div>
  <div class="dos">
  <div class="ph"><span class="num" style="width:60px;height:60px;border-radius:16px;background:var(--yellow);color:#000;font-size:26px;border:0">${p.number ?? ""}</span>
    <div class="t"><h1 class="pg">${esc(pname(p))}</h1><p class="sub">${esc([S.team.name, p.position, age != null ? age + " jaar" : "", p.birthdate ? "geboren " + parse(p.birthdate).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" }) + " (" + qOf(p.birthdate) + ")" : ""].filter(Boolean).join(" · "))}</p>
    <p class="hint" style="margin:2px 0 0">Spelersdossier voor intern gebruik door de trainers · ${new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" })}</p></div></div>
  <div class="kpis">
    <div class="kpi"><small>Aanwezig op training</small><b>${s.trTot ? s.trPct + "%" : "–"}</b><span>${s.trIn} van ${s.trTot}</span></div>
    <div class="kpi"><small>Wedstrijden</small><b>${s.matches}</b><span>${s.basis}× basis${s.matches ? " (" + pct(s.basis, s.matches) + "%)" : ""}</span></div>
    <div class="kpi"><small>Speeltijd per wedstrijd</small><b>${myMin != null ? Math.round(myMin) + "'" : "–"}</b><span>${share != null ? share + "% van de wedstrijd" : ""}${teamMin != null ? " · ploeg " + Math.round(teamMin) + "'" : ""}</span></div>
    <div class="kpi"><small>Gemiddeld cijfer</small><b>${f1(s.rating)}</b><span>ploeg ${f1(teamRate)}${s.motm ? " · " + s.motm + "× man van de match" : ""}</span></div></div>

  <div class="grid2 sec">
    <div class="panel"><h2>Per groepje en per trainer</h2>
      ${bySquad.some(([k]) => k !== "Zonder groepje") ? `<div class="dosrow">${bySquad.map(([k, c]) => `<span class="pill g">${esc(k)}: ${c}×</span>`).join(" ")}</div>` : rows.length ? "" : `<p class="hint">Nog geen wedstrijden.</p>`}
      ${byRater.length ? `<div class="list" style="margin-top:10px">${byRater.map(x => `<div class="item static"><span class="main"><b>${esc(x.r)}</b><small>${x.n} ${x.n === 1 ? "wedstrijd" : "wedstrijden"} beoordeeld</small></span><span class="val"><b>${f1(x.avg)}</b>gem. cijfer</span></div>`).join("")}</div>` : ""}
      ${unknownN ? `<p class="hint" style="margin:8px 0 0">${unknownN} oudere beoordelingen zonder naam van de trainer (van voor deze functie bestond).</p>` : ""}
      ${byRater.length > 1 && byRater.every(x => x.avg != null) && Math.abs(byRater[0].avg - byRater[1].avg) >= 1 ? `<p class="grpwarn" style="margin-top:10px">Jullie cijfers liggen meer dan 1 punt uit elkaar. Bespreek of het aan de speler ligt (ander groepje, andere positie) of aan hoe streng jullie quoteren.</p>` : ""}</div>
    <div class="panel"><h2>Wat komt het vaakst terug?</h2>
      <h3 class="dosh">Werkpunten uit wedstrijden</h3>${work.length ? `<div class="chips">${work.slice(0, 8).map(([k, c]) => `<span class="tag" aria-pressed="true">${esc(k)} · ${c}×</span>`).join("")}</div>` : `<p class="hint">Nog geen werkpunten aangeduid bij wedstrijden.</p>`}
      <h3 class="dosh">Sterke punten uit wedstrijden</h3>${str.length ? `<div class="chips">${str.slice(0, 8).map(([k, c]) => `<span class="tag good" aria-pressed="true">${esc(k)} · ${c}×</span>`).join("")}</div>` : `<p class="hint">Nog geen sterke punten aangeduid bij wedstrijden.</p>`}</div></div>

  ${dosChart(rows) ? `<div class="sec panel"><h2>Verloop wedstrijdcijfer</h2>${dosChart(rows)}<p class="hint" style="margin:6px 0 0">Eén punt per speeldag. Ga met de muis over een punt voor de tegenstander en wie quoteerde.</p></div>` : ""}

  <div class="sec panel"><h2>Evaluaties</h2>
    ${evMs.length ? `<div class="tblwrap"><table class="dostbl"><thead><tr><th>Onderdeel</th>${evMs.map(m => `<th>${esc(m.kort)}</th>`).join("")}</tr></thead><tbody>
      ${groups.map(g => `<tr class="g"><td>${esc(g.name)}</td>${evMs.map(m => `<td>${f1(evAvgOf(ev.find(e => e.moment === m.m), g.items.map(i => i.name)))}</td>`).join("")}</tr>
        ${g.items.map(i => `<tr><td>${esc(i.name)}</td>${evMs.map(m => { const c = evScore(ev.find(e => e.moment === m.m), i.name); return `<td${c != null ? ` style="color:${evColor(c)}"` : ""}>${c == null ? "–" : f1(c)}</td>`; }).join("")}</tr>`).join("")}`).join("")}
      <tr class="g"><td>Gemiddelde</td>${evMs.map(m => `<td>${f1(evAvgOf(ev.find(e => e.moment === m.m), names))}</td>`).join("")}</tr></tbody></table></div>
      ${evMs.length > 1 && ev.some(e => Object.keys(e.scores || {}).length < names.length) ? `<p class="hint" style="margin:8px 0 0">Niet elke evaluatie telde evenveel onderdelen. Vergelijk dus per onderdeel, niet enkel het gemiddelde.</p>` : ""}`
     : `<p class="hint">Nog geen evaluatie. <a class="link" href="#/evaluaties">Naar de evaluaties</a></p>`}
    ${evTexts.length ? `<div class="dostexts">${evTexts.map(x => `<div><h3>${esc(x.k)} <span class="muted">· ${esc(x.mo.naam)}${x.by ? " · " + esc(x.by) : ""}</span></h3><p>${esc(x.t).replace(/\n/g, "<br>")}</p></div>`).join("")}</div>` : ""}</div>

  <div class="sec panel"><div class="row" style="margin-bottom:6px"><h2 style="margin:0;margin-right:auto">Doelen</h2><button class="btn small noprint" type="button" id="dosG">${IC.plus}Doel</button></div>
    ${gs.length ? `<div class="list">${gs.map(g => `<div class="item static"><span class="main"><b style="white-space:normal">${esc(g.text)}</b><small>${esc([g.area, g.status].filter(Boolean).join(" · "))}</small></span></div>`).join("")}</div>` : `<p class="hint">Nog geen doelen. Spreek er tijdens het gesprek één of twee af die je op het veld kunt zien.</p>`}
    <div class="doslines print-only-lines"><b>Afspraken uit het gesprek</b><i></i><i></i><i></i><i></i></div></div>

  <div class="sec panel"><h2>Alle opmerkingen bij wedstrijden <span class="muted" style="font-weight:600;font-size:14px">(${notes.length}, nieuwste eerst)</span></h2>
    ${notes.length ? `<div class="dosnotes">${notes.slice(0, DOS_MAX_NOTES).map(({ e, a }) => `<div class="dosnote"><span class="rate on" style="--rc:${a.rating != null ? rateCol(a.rating) : "var(--card3)"}">${a.rating ?? "–"}</span>
      <div><div class="dosmeta"><b>${esc(dShort(e.date))}</b> · ${esc(e.opponent || "Wedstrijd")}${groupOf(e) ? ` <span class="pill g">${esc(groupOf(e))}</span>` : ""}${isCaptain(e, p, a) ? ' <span class="pill w">Kapitein</span>' : ""}${e.report?.motm === p.id ? ' <span class="pill w">Man van de match</span>' : ""}
        <small class="muted">${esc([a.role, a.minutes != null ? Math.round(a.minutes) + " min" : ""].filter(Boolean).join(" · "))}</small></div>
        ${a.note ? `<p>${esc(a.note).replace(/\n/g, "<br>")}</p>` : ""}${(a.tags || []).length ? `<div class="chips">${a.tags.map(t => `<span class="tag" aria-pressed="true">${esc(t)}</span>`).join("")}</div>` : ""}
        <span class="rby">${a.rated_by ? "Beoordeeld door " + esc(a.rated_by) : "Trainer niet gekend"}</span></div></div>`).join("")}</div>`
     : `<p class="hint">Nog geen opmerkingen bij wedstrijden.</p>`}</div>
  </div>`;
  $("#dosG").onclick = () => goalForm(p);
} });
