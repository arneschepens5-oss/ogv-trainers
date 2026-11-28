/* FootballCoachHub — fysieke testen.
   De club maakt haar eigen tests aan (Beheer › Instellingen › Fysieke testen, settings.tests).
   Resultaten staan in fit_results (databaseversie 60): per ploeg een overzicht, per speler in het dossier (tab Fysiek),
   en een gsm-app (#/testafname) voor wie de testen afneemt: trainers, beheerders en leden met het recht "tester". */
"use strict";
const TS_UNITS = ["s", "cm", "m", "kg", "aantal", "niveau", "punten", "km/u", "%"];
const tsAll = () => (Array.isArray(CLUB.settings?.tests) ? CLUB.settings.tests : []).filter(t => t && t.id && t.name);
const tsOn = () => tsAll().filter(t => !t.off);
const tsById = id => tsAll().find(t => t.id === id);
const tsLow = t => t?.dir === "laag";
const tsBetter = (t, a, b) => b == null || (tsLow(t) ? a < b : a > b);
const tsBest = (t, xs) => { const v = xs.filter(x => x != null && x !== "" && isFinite(x)).map(Number); return v.length ? (tsLow(t) ? Math.min(...v) : Math.max(...v)) : null; };
const tsFmt = (t, v) => v == null || v === "" ? "–" : Number(v).toFixed(Math.max(0, Math.min(3, t?.dec ?? 1))).replace(".", ",");
const tsUnit = t => t?.unit ? ` <span class="u">${esc(t.unit)}</span>` : "";
const tsNum = s => { const x = String(s ?? "").trim().replace(",", "."); return x === "" || !isFinite(x) ? null : Number(x); };
const tsMayTest = () => S.admin || (S.rechten || []).includes("tester") || mode === "demo";
const tsTeams = () => tsMayTest() ? (S.teams || []) : myTeams();
const tsFit = pid => (S.fit || []).filter(r => r.player_id === pid);
const tsDirTxt = t => tsLow(t) ? "lager is beter" : "hoger is beter";

/* ============ resultaten van de ploeg ============ */
let TS_DAY = "";
route("testen", { title: "Fysieke testen", auth: true, team: true, render: v => {
  const T = tsOn(), P = active(), R = (S.fit || []).filter(r => P.some(p => p.id === r.player_id));
  const acts = `<div class="row" style="gap:8px;flex-wrap:wrap">${tsMayTest() ? `<a class="btn" href="#/testafname">${IC.phone}Testen afnemen</a>` : ""}${R.length ? `<button class="btn ghost" type="button" id="tsCsv">${IC.dl}Exporteren</button><button class="btn ghost" type="button" id="tsPr">${IC.print}Afdrukken</button>` : ""}</div>`;
  const sub = `Resultaten van ${esc(teamLbl(S.team))}. Ze worden ingevuld door de testafnemers van de club, daarna staan ze hier en in het dossier van elke speler.`;
  if (S.fitOk === false) { v.innerHTML = head("Fysieke testen", sub) + `<div class="empty"><b>Nog niet beschikbaar</b>De database van de club moet nog bijgewerkt worden (versie 60).</div>`; return; }
  if (!T.length) { v.innerHTML = head("Fysieke testen", sub) + `<div class="empty"><b>De club heeft nog geen testen</b>${S.admin ? `Maak ze aan in <a class="link" href="#/clubinstellingen/testen">Instellingen › Fysieke testen</a>: naam, eenheid en of hoger of lager beter is.` : "Vraag de beheerder om de testen van de club aan te maken."}</div>`; return; }
  const days = [...new Set(R.map(r => r.date))].sort().reverse(); if (TS_DAY && !days.includes(TS_DAY)) TS_DAY = "";
  /* per speler en test: het resultaat van de gekozen dag, of het laatste; plus het vorige om de evolutie te tonen */
  const cell = (p, t) => { const xs = R.filter(r => r.player_id === p.id && r.test_id === t.id).sort((a, b) => a.date.localeCompare(b.date));
    const i = TS_DAY ? xs.findIndex(r => r.date === TS_DAY) : xs.length - 1; return i < 0 ? null : { cur: xs[i], prev: xs[i - 1] || null }; };
  const cols = T.filter(t => R.some(r => r.test_id === t.id)), rows = P.map(p => ({ p, c: cols.map(t => cell(p, t)) }));
  const stats = cols.map((t, k) => { const vs = rows.map(r => r.c[k]?.cur.value).filter(x => x != null).map(Number).sort((a, b) => a - b); if (!vs.length) return null;
    const avg = vs.reduce((a, b) => a + b, 0) / vs.length, q = n => vs[Math.min(vs.length - 1, Math.max(0, Math.round(n * (vs.length - 1))))];
    return { n: vs.length, avg, best: tsLow(t) ? vs[0] : vs[vs.length - 1], lo: q(1 / 3), hi: q(2 / 3) }; });
  const band = (t, s, x) => { if (!s || s.n < 4) return ""; const good = tsLow(t) ? x <= s.lo : x >= s.hi, weak = tsLow(t) ? x >= s.hi : x <= s.lo; return good ? " top" : weak ? " low" : ""; };
  const arrow = (t, c) => { if (!c?.prev) return ""; const d = c.cur.value - c.prev.value; if (!d) return `<small class="tsev">=</small>`; const up = tsLow(t) ? d < 0 : d > 0;
    return `<small class="tsev ${up ? "up" : "down"}" title="Vorige keer ${esc(tsFmt(t, c.prev.value))} (${esc(dShort(c.prev.date))})">${up ? "▲" : "▼"} ${tsFmt(t, Math.abs(d))}</small>`; };
  v.innerHTML = head("Fysieke testen", sub, acts) + (!R.length ? `<div class="empty"><b>Nog geen resultaten</b>${tsMayTest() ? `Neem de eerste testen af met <a class="link" href="#/testafname">de gsm-app</a>.` : "Een testafnemer van de club vult ze in met de gsm-app."}</div>` : `
    <div class="tsdays"><span>Toon</span><button type="button" data-day="" aria-pressed="${!TS_DAY}">Laatste per speler</button>${days.map(d => `<button type="button" data-day="${d}" aria-pressed="${TS_DAY === d}">${esc(dShort(d))}${parse(d).getFullYear() !== new Date().getFullYear() ? " " + parse(d).getFullYear() : ""}</button>`).join("")}</div>
    <div class="tblwrap sec"><table class="tbl tstbl"><thead><tr><th>Speler</th>${cols.map(t => `<th title="${esc(t.uitleg || "")}"><b>${esc(t.name)}</b><small>${esc(t.unit || "")}${t.unit ? " · " : ""}${tsDirTxt(t)}</small></th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr><td><a class="link" href="#/${isDossierOff() ? "speler" : "dossier"}/${r.p.id}" data-dos="${r.p.id}">${r.p.number != null ? `<span class="muted">${r.p.number}</span> ` : ""}${esc(pname(r.p))}</a></td>${r.c.map((c, k) => c ? `<td class="tsc${band(cols[k], stats[k], c.cur.value)}"><b>${tsFmt(cols[k], c.cur.value)}</b>${arrow(cols[k], c)}${TS_DAY ? "" : `<small class="tsd">${esc(dShort(c.cur.date))}</small>`}</td>` : `<td class="tsc none">–</td>`).join("")}</tr>`).join("")}</tbody>
    <tfoot><tr><th>Gemiddelde</th>${stats.map((s, k) => `<td>${s ? tsFmt(cols[k], s.avg) : "–"}</td>`).join("")}</tr><tr><th>Beste</th>${stats.map((s, k) => `<td>${s ? tsFmt(cols[k], s.best) : "–"}</td>`).join("")}</tr></tfoot></table></div>
    <p class="hint">Groen: het beste derde van de ploeg op die test, oranje: het zwakste derde (vanaf 4 spelers). ▲ beter dan de vorige keer, ▼ minder goed. Vergelijk spelers vooral met zichzelf: kinderen van dezelfde leeftijd verschillen sterk in groei.</p>`)
    + (cols.length < T.length ? `<p class="hint">Nog zonder resultaten: ${T.filter(t => !cols.includes(t)).map(t => esc(t.name)).join(", ")}.</p>` : "");
  $$("[data-day]", v).forEach(b => b.onclick = () => { TS_DAY = b.dataset.day; render(); });
  $$("[data-dos]", v).forEach(a => a.onclick = () => { if (typeof dosTab !== "undefined") dosTab = "groei"; });
  if ($("#tsCsv")) $("#tsCsv").onclick = () => { const all = T.filter(t => R.some(r => r.test_id === t.id)), lines = [["Speler", "Rugnummer", "Datum", "Test", "Resultaat", "Eenheid", "Pogingen"].map(csvCell).join(";")];
    R.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(r => { const p = P.find(x => x.id === r.player_id), t = tsById(r.test_id); if (!p || !t || !all.includes(t)) return;
      lines.push([pname(p), p.number ?? "", r.date, t.name, tsFmt(t, r.value), t.unit || "", (r.tries || []).map(x => tsFmt(t, x)).join(" / ")].map(csvCell).join(";")); });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" })); a.download = `fysieke-testen-${(S.team?.name || "ploeg").replace(/\W+/g, "-")}.csv`; a.click(); };
  if ($("#tsPr")) $("#tsPr").onclick = () => window.print();
} });

/* ============ in het dossier: tab Fysiek ============ */
function fysiekTestsPane(p) {
  if (S.fitOk === false) return "";
  const T = tsAll().filter(t => !t.off || tsFit(p.id).some(r => r.test_id === t.id)), mine = tsFit(p.id);
  const cards = T.map(t => { const xs = mine.filter(r => r.test_id === t.id).sort((a, b) => a.date.localeCompare(b.date)); if (!xs.length) return "";
    const last = xs[xs.length - 1], best = tsBest(t, xs.map(x => x.value)), team = (S.fit || []).filter(r => r.test_id === t.id && r.date === last.date && active().some(q => q.id === r.player_id)).map(r => +r.value);
    const rank = team.length > 1 ? 1 + team.filter(x => tsBetter(t, x, +last.value) && x !== +last.value).length : null;
    return `<div class="panel tscard"><div class="row" style="margin-bottom:6px;gap:8px"><h3 style="margin:0;margin-right:auto">${esc(t.name)}</h3><small class="muted">${esc(tsDirTxt(t))}</small></div>
      <div class="dkpis"><div class="kpi"><small>Laatste</small><b>${tsFmt(t, last.value)}${tsUnit(t)}</b><span>${esc(dShort(last.date))}</span></div>
        <div class="kpi"><small>Beste ooit</small><b>${tsFmt(t, best)}${tsUnit(t)}</b><span>${xs.length} ${xs.length === 1 ? "meting" : "metingen"}</span></div>
        <div class="kpi"><small>In de ploeg</small><b>${rank ? rank + "<span class=\"u\">/" + team.length + "</span>" : "–"}</b><span>${rank ? "op die dag" : "geen vergelijking"}</span></div></div>
      ${xs.length > 1 ? gChart(xs.map(x => ({ date: x.date, v: +x.value })), "v", t.unit || "", "#2F6FED") : ""}</div>`; }).join("");
  return `<div class="sec panel" data-t="groei"><div class="row" style="margin-bottom:6px"><h2 style="margin:0;margin-right:auto">Fysieke testen</h2><a class="btn small ghost noprint" href="#/testafname">Test afnemen</a></div>
    ${cards ? `<div class="tscards">${cards}</div><p class="hint" style="margin-bottom:0">Vergelijk vooral met eerdere resultaten van deze speler. Een groeispurt (zie Meten en wegen) kan resultaten tijdelijk doen dalen.</p>` : `<p class="hint" style="margin:0">Nog geen testresultaten voor ${esc(p.first_name || "deze speler")}.${tsOn().length ? "" : " De club heeft nog geen testen aangemaakt."}</p>`}</div>`;
}

/* ============ gsm-app voor wie de testen afneemt ============ */
const TA = { team: "", test: "", date: "", go: false, players: null, res: new Map(), sw: null };
addEventListener("hashchange", () => { if (!/^#\/testafname/.test(location.hash)) document.documentElement.classList.remove("tamode"); });
route("testafname", { title: "Testen afnemen", auth: true, render: async v => {
  document.documentElement.classList.add("tamode");
  const close = `<a class="tax" href="#/${S.team && !clubOff("testen") ? "testen" : "start"}" aria-label="Sluiten">${IC.x || "×"}</a>`;
  if (clubOff("testen")) { v.innerHTML = `<div class="ta">${close}<div class="empty"><b>Fysieke testen staan uit</b>Vraag de beheerder om ze aan te zetten.</div></div>`; return; }
  if (!tsMayTest()) { v.innerHTML = `<div class="ta">${close}<div class="empty"><b>Enkel voor testafnemers</b>Testen invullen mag enkel wie van de beheerder het recht "Fysieke testen afnemen" kreeg. Vraag het aan je clubbeheerder.</div></div>`; return; }
  const teams = tsTeams(), T = tsOn();
  if (!T.length || !teams.length) { v.innerHTML = `<div class="ta">${close}<div class="empty"><b>${!T.length ? "Nog geen testen" : "Geen ploegen"}</b>${!T.length ? "De beheerder maakt eerst de testen van de club aan." : "Je hebt nog geen toegang tot een ploeg. Vraag de beheerder het recht om testen af te nemen."}</div></div>`; return; }
  if (!teams.some(t => t.id === TA.team)) TA.team = (S.team && teams.some(t => t.id === S.team.id) ? S.team.id : teams[0].id);
  if (!T.some(t => t.id === TA.test)) TA.test = T[0].id; if (!TA.date) TA.date = todayIso();
  const team = teams.find(t => t.id === TA.team), test = tsById(TA.test);
  if (!TA.go) {
    v.innerHTML = `<div class="ta">${close}<div class="tahd">${ogvBrand() ? LOGO("top") : ""}<div><small>${esc(clubName())}</small><h1>Testen afnemen</h1></div></div>
      <form class="tapanel" id="taset"><label class="f full">Ploeg<select name="team">${teams.map(t => `<option value="${t.id}"${t.id === TA.team ? " selected" : ""}>${esc(teamLbl(t))}</option>`).join("")}</select></label>
      <label class="f full">Test<select name="test">${T.map(t => `<option value="${t.id}"${t.id === TA.test ? " selected" : ""}>${esc(t.name)}${t.unit ? " (" + esc(t.unit) + ")" : ""}</option>`).join("")}</select></label>
      <label class="f full">Datum<input name="date" type="date" value="${esc(TA.date)}" max="${todayIso()}" required></label>
      <p class="hint" id="tauitl">${test.uitleg ? esc(test.uitleg) : ""}</p>
      <button class="btn big" style="width:100%">Start</button></form>
      <p class="hint" style="text-align:center">Tip: zet deze pagina op je beginscherm. Zonder bereik bewaart de app je resultaten en verstuurt ze later.</p></div>`;
    const f = $("#taset"); f.test.onchange = () => { $("#tauitl").textContent = tsById(f.test.value)?.uitleg || ""; };
    f.onsubmit = e => { e.preventDefault(); TA.team = f.team.value; TA.test = f.test.value; TA.date = f.date.value || todayIso(); TA.go = true; TA.players = null; render(); };
    return; }
  v.innerHTML = `<div class="ta"><div class="empty"><span class="spin"></span> Spelers laden…</div></div>`;
  try {
    if (!TA.players || TA.players.team !== TA.team) {
      const ps = mode === "demo" ? (await db.list("players", { team_id: TA.team })).filter(p => p.active !== false) : ((await sb.rpc("test_spelers", { t: TA.team })).data || []);
      TA.players = Object.assign(ps.sort((a, b) => (a.number ?? 99) - (b.number ?? 99) || pname(a).localeCompare(pname(b))), { team: TA.team }); }
    const rs = mode === "demo" ? await db.list("fit_results", { team_id: TA.team }) : ((await sb.from("fit_results").select("*").eq("team_id", TA.team).eq("test_id", TA.test).eq("date", TA.date)).data || []);
    TA.res = new Map(rs.filter(r => r.test_id === TA.test && r.date === TA.date).map(r => [r.player_id, r]));
  } catch (e) { v.innerHTML = `<div class="ta">${close}<div class="empty"><b>Laden lukt niet</b>${esc(e.message || "Controleer je verbinding.")}<br><button class="btn" type="button" onclick="render()">Opnieuw</button></div></div>`; return; }
  taDraw(v, team, test);
} });
function taDraw(v, team, test) {
  const n = Math.max(1, Math.min(5, +test.tries || 1)), P = TA.players, timed = /^(s|sec|seconden?)$/i.test(test.unit || "");
  const done = () => P.filter(p => TA.res.has(p.id)).length;
  v.innerHTML = `<div class="ta"><div class="tabar"><button class="tax back" type="button" id="taBack" aria-label="Andere test kiezen">${IC.back || "‹"}</button>
      <div class="tat"><b>${esc(test.name)}</b><small>${esc(teamLbl(team))} · ${esc(dShort(TA.date))} · ${esc(tsDirTxt(test))}</small></div><span class="tacnt" id="tacnt">${done()}/${P.length}</span></div>
    ${test.uitleg ? `<details class="tauitleg"><summary>Hoe werkt deze test?</summary><p>${esc(test.uitleg)}</p></details>` : ""}
    ${timed ? `<div class="tasw" id="tasw"><span id="swt">0,00</span><button type="button" class="btn" id="swgo">Start</button><button type="button" class="btn ghost" id="swrs">Nul</button><small>Stop zet de tijd in het actieve vak.</small></div>` : ""}
    <div class="talist">${P.map((p, i) => { const r = TA.res.get(p.id), tr = r ? (r.tries?.length ? r.tries : [r.value]) : [];
      return `<div class="tarow${r ? " ok" : ""}" data-p="${p.id}"><div class="tan"><span class="tanr">${p.number ?? ""}</span><b>${esc(pname(p))}</b><small class="tabest">${r ? "Resultaat: " + tsFmt(test, r.value) + (test.unit ? " " + esc(test.unit) : "") : ""}</small></div>
        <div class="tain">${Array.from({ length: n }, (_, k) => `<input type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="${esc(pname(p))}${n > 1 ? " poging " + (k + 1) : ""}" placeholder="${n > 1 ? "Poging " + (k + 1) : esc(test.unit || "resultaat")}" value="${tr[k] != null ? String(tr[k]).replace(".", ",") : ""}" data-i="${i}" data-k="${k}">`).join("")}</div></div>`; }).join("")}</div>
    <div class="tafoot"><button class="btn ghost" type="button" id="taNext">Volgende test</button><a class="btn" href="#/${S.team?.id === team.id && !clubOff("testen") ? "testen" : "start"}">Klaar</a></div></div>`;
  const ins = $$(".tain input", v); let focused = null, timer = {};
  const save = async row => { const p = P.find(x => x.id === row.dataset.p), vals = $$("input", row).map(i => tsNum(i.value)), bad = $$("input", row).some(i => i.value.trim() && tsNum(i.value) == null), best = tsBest(test, vals);
    row.classList.toggle("bad", bad); if (bad) { $(".tabest", row).textContent = "Enkel cijfers, bv. 3,45"; return; }
    const old = TA.res.get(p.id);
    try {
      if (best == null) { if (old) { await db.del("fit_results", { id: old.id }); TA.res.delete(p.id); S.fit = (S.fit || []).filter(x => x.id !== old.id); } row.classList.remove("ok"); $(".tabest", row).textContent = ""; }
      else { const rec = { id: old?.id || uid(), team_id: TA.team, player_id: p.id, test_id: test.id, date: TA.date, value: best, tries: n > 1 ? vals.filter(x => x != null) : null, updated_at: new Date().toISOString() };
        await db.save("fit_results", rec); TA.res.set(p.id, rec); if (S.fit) { const j = S.fit.findIndex(x => x.id === rec.id); if (j >= 0) S.fit[j] = rec; else if (S.team?.id === TA.team) S.fit.push(rec); }
        row.classList.add("ok"); $(".tabest", row).textContent = "Resultaat: " + tsFmt(test, best) + (test.unit ? " " + test.unit : "") + (navigator.onLine ? "" : " · wacht op bereik"); }
      $("#tacnt").textContent = done() + "/" + P.length;
    } catch (e) { row.classList.add("bad"); $(".tabest", row).textContent = "Niet bewaard: " + (e.message || "probeer opnieuw"); } };
  ins.forEach((inp, j) => { inp.onfocus = () => { focused = inp; $$(".tarow.cur", v).forEach(r => r.classList.remove("cur")); inp.closest(".tarow").classList.add("cur"); };
    inp.oninput = () => { const row = inp.closest(".tarow"); clearTimeout(timer[row.dataset.p]); timer[row.dataset.p] = setTimeout(() => save(row), 700); };
    inp.onblur = () => { const row = inp.closest(".tarow"); clearTimeout(timer[row.dataset.p]); if (!row.contains(document.activeElement)) save(row); };
    inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const nx = ins[j + 1]; if (nx) nx.focus(); else inp.blur(); } }; });
  $("#taBack").onclick = $("#taNext").onclick = () => { TA.go = false; render(); };
  if (timed) { const out = $("#swt"), go = $("#swgo"); let t0 = 0, raf = 0;
    const tick = () => { out.textContent = ((performance.now() - t0) / 1000).toFixed(2).replace(".", ","); raf = requestAnimationFrame(tick); };
    go.onclick = () => { if (!raf) { t0 = performance.now(); tick(); go.textContent = "Stop"; go.classList.add("danger"); return; }
      cancelAnimationFrame(raf); raf = 0; go.textContent = "Start"; go.classList.remove("danger"); const s = ((performance.now() - t0) / 1000).toFixed(2);
      const tgt = focused && !focused.value.trim() ? focused : ins.find(i => !i.value.trim()); if (tgt) { tgt.value = s.replace(".", ","); tgt.focus(); save(tgt.closest(".tarow")); } };
    go.onmousedown = e => e.preventDefault();
    $("#swrs").onclick = () => { cancelAnimationFrame(raf); raf = 0; out.textContent = "0,00"; go.textContent = "Start"; go.classList.remove("danger"); }; }
  (ins.find(i => !i.value.trim()) || null)?.closest(".tarow")?.scrollIntoView({ block: "center" });
}

/* ============ instellingen: de testen van de club ============ */
const tsRow = t => `<div class="csr tsr" data-id="${esc(t.id || "t" + Math.random().toString(36).slice(2, 8))}">
  <input name="n" maxlength="50" placeholder="Naam, bv. Sprint 30 m" value="${esc(t.name || "")}" aria-label="Naam van de test">
  <input name="u" maxlength="12" list="tsunits" placeholder="Eenheid" value="${esc(t.unit || "")}" aria-label="Eenheid">
  <select name="d" aria-label="Wat is beter?"><option value="hoog"${t.dir !== "laag" ? " selected" : ""}>Hoger is beter</option><option value="laag"${t.dir === "laag" ? " selected" : ""}>Lager is beter</option></select>
  <select name="c" aria-label="Decimalen">${[0, 1, 2].map(k => `<option value="${k}"${(t.dec ?? 1) === k ? " selected" : ""}>${k === 0 ? "geen decimalen" : k + " decimaal" + (k > 1 ? "en" : "")}</option>`).join("")}</select>
  <select name="t" aria-label="Pogingen">${[1, 2, 3].map(k => `<option value="${k}"${(t.tries || 1) === k ? " selected" : ""}>${k} ${k === 1 ? "poging" : "pogingen"}</option>`).join("")}</select>
  <input name="x" class="tsx" maxlength="300" placeholder="Uitleg voor wie de test afneemt (optioneel): opstelling, start, wat je meet" value="${esc(t.uitleg || "")}" aria-label="Uitleg">
  <label class="tgl sm" title="Uit: de test verdwijnt uit de app, resultaten blijven bewaard"><input type="checkbox" name="on"${t.off ? "" : " checked"}><span></span>actief</label>
  <span class="csctl"><button type="button" class="ib" data-mv="-1" aria-label="Omhoog">↑</button><button type="button" class="ib" data-mv="1" aria-label="Omlaag">↓</button><button type="button" class="ib" data-del aria-label="Verwijderen">${IC.x || "×"}</button></span></div>`;
function tsSettingsHtml(st) {
  const T = (Array.isArray(st.tests) ? st.tests : []).filter(t => t && !t.del);
  return `<h2 style="margin-top:0">Fysieke testen van de club</h2>
    <p class="hint" style="margin-top:0">Maak elke test één keer aan. Trainers en testafnemers kiezen ze daarna in de gsm-app en zien de resultaten per ploeg en in het dossier van de speler. Bij meer pogingen telt de beste.</p>
    <datalist id="tsunits">${TS_UNITS.map(u => `<option value="${u}">`).join("")}</datalist>
    <div id="tslist" class="cslist">${T.length ? T.map(tsRow).join("") : ""}</div>
    ${T.length ? "" : `<p class="hint" id="tsnone">Nog geen testen. Voorbeelden: <i>Sprint 10 m</i> (s, lager is beter, 2 decimalen, 2 pogingen), <i>Verspringen zonder aanloop</i> (cm, hoger is beter), <i>Yo-yo-test</i> (niveau).</p>`}
    <button class="link" type="button" id="tsadd" style="margin:4px 0 12px">${IC.plus}Test toevoegen</button>
    <p class="hint">Wie mag testen afnemen? Trainers bij hun eigen ploegen, beheerders bij alle ploegen. Geef iemand anders (bv. een kinesist of looptrainer) het recht <b>Fysieke testen afnemen</b> bij <a class="link" href="#/clubbeheer/toegang">Toegang en leden</a>, of de functie <b>Testafnemer</b>.</p>`;
}
function tsSettingsBind(f, st) {
  const L = $("#tslist", f);
  L.addEventListener("click", e => { const b = e.target.closest("button"), r = b?.closest(".csr"); if (!r) return;
    if (b.hasAttribute("data-del")) { if (confirm("Deze test verwijderen? Bestaande resultaten blijven bewaard, maar worden niet meer getoond. Zet de test liever uit als je ze later nog wil zien.")) r.remove(); }
    else if (b.dataset.mv) { const up = +b.dataset.mv < 0, sib = up ? r.previousElementSibling : r.nextElementSibling; if (sib) L.insertBefore(up ? r : sib, up ? sib : r); } });
  $("#tsadd", f).onclick = () => { $("#tsnone", f)?.remove(); L.insertAdjacentHTML("beforeend", tsRow({ tries: 1, dec: 1 })); L.lastElementChild.querySelector("input").focus(); };
  return () => { const T = $$(".csr", L).map(r => ({ id: r.dataset.id, name: $("[name=n]", r).value.trim().slice(0, 50), unit: $("[name=u]", r).value.trim().slice(0, 12), dir: $("[name=d]", r).value === "laag" ? "laag" : "hoog",
      dec: +$("[name=c]", r).value || 0, tries: +$("[name=t]", r).value || 1, uitleg: $("[name=x]", r).value.trim().slice(0, 300), ...($("[name=on]", r).checked ? {} : { off: true }) })).filter(t => t.name);
    const dup = T.find((t, i) => T.findIndex(x => x.name.toLowerCase() === t.name.toLowerCase()) !== i); if (dup) return { err: `De test "${dup.name}" staat twee keer in de lijst.` };
    /* verwijderde testen blijven in de instellingen (verborgen), zodat oude resultaten hun naam houden */
    const gone = (Array.isArray(st?.tests) ? st.tests : []).filter(t => t && t.id && !T.some(x => x.id === t.id)).map(t => ({ ...t, off: true, del: true }));
    return { tests: [...T, ...gone] }; };
}
