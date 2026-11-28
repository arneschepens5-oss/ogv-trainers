/* FootballCoachHub — fysieke testen.
   De club maakt haar eigen tests aan (Beheer › Instellingen › Fysieke testen, settings.tests).
   Resultaten staan in fit_results (databaseversie 60): per ploeg een overzicht, per speler in het dossier (tab Fysiek),
   en een aparte gsm-app (test/) voor wie de testen afneemt: beheerders en leden met het recht "tester" (testcode). */
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
const tsFit = pid => (S.fit || []).filter(r => r.player_id === pid);
const tsDirTxt = t => tsLow(t) ? "lager is beter" : "hoger is beter";

/* ============ resultaten van de ploeg ============ */
let TS_DAY = "";
let TS_VIEW = "tabel", TS_PID = "", TS_TEST = "", TS_TDAY = "";
route("testen", { title: "Fysieke testen", auth: true, team: true, render: (v, pid) => { if (pid && active().some(p => p.id === pid)) { TS_VIEW = "speler"; TS_PID = pid; } tsTableView(v); } });
function tsTableView(v) {
  const T = tsOn(), P = active(), R = (S.fit || []).filter(r => P.some(p => p.id === r.player_id));
  const acts = `<div class="row" style="gap:8px;flex-wrap:wrap">${R.length ? `<button class="btn ghost" type="button" id="tsCsv">${IC.dl}Exporteren</button><button class="btn ghost" type="button" id="tsPr">${IC.print}Afdrukken</button>` : ""}</div>`;
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
  const tabs = R.length ? `<div class="ptabs tsviews" role="tablist">${[["tabel", "Overzicht"], ["speler", "Per speler"], ["ploeg", "Ploeg en evolutie"]].map(([k, l]) => `<button type="button" role="tab" data-tv="${k}" aria-selected="${TS_VIEW === k}">${l}</button>`).join("")}</div>` : "";
  const bindTabs = () => $$("[data-tv]", v).forEach(b => b.onclick = () => { TS_VIEW = b.dataset.tv; render(); });
  if (R.length && TS_VIEW === "speler") { v.innerHTML = head("Fysieke testen", sub, acts) + tabs + `<div id="tsv"></div>`; bindTabs(); tsPlayerView($("#tsv"), T, P, R); return; }
  if (R.length && TS_VIEW === "ploeg") { v.innerHTML = head("Fysieke testen", sub, acts) + tabs + `<div id="tsv"></div>`; bindTabs(); tsTeamView($("#tsv"), T, P, R); return; }
  v.innerHTML = head("Fysieke testen", sub, acts) + tabs + (!R.length ? `<div class="empty"><b>Nog geen resultaten</b>De testafnemers van de club vullen ze in met de aparte testapp.${S.admin ? ` De link en testcode vind je in <a class="link" href="#/clubinstellingen/testen">Instellingen › Fysieke testen</a>.` : ""}</div>` : `
    <div class="tsdays"><span>Toon</span><button type="button" data-day="" aria-pressed="${!TS_DAY}">Laatste per speler</button>${days.map(d => `<button type="button" data-day="${d}" aria-pressed="${TS_DAY === d}">${esc(dShort(d))}${parse(d).getFullYear() !== new Date().getFullYear() ? " " + parse(d).getFullYear() : ""}</button>`).join("")}</div>
    <div class="tblwrap sec"><table class="tbl tstbl"><thead><tr><th>Speler</th>${cols.map(t => `<th title="${esc(t.uitleg || "")}"><b>${esc(t.name)}</b><small>${esc(t.unit || "")}${t.unit ? " · " : ""}${tsDirTxt(t)}</small></th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr><td><a class="link" href="#/testen/${r.p.id}" title="Evolutie van ${esc(pname(r.p))}">${r.p.number != null ? `<span class="muted">${r.p.number}</span> ` : ""}${esc(pname(r.p))}</a></td>${r.c.map((c, k) => c ? `<td class="tsc${band(cols[k], stats[k], c.cur.value)}"><b>${tsFmt(cols[k], c.cur.value)}</b>${arrow(cols[k], c)}${TS_DAY ? "" : `<small class="tsd">${esc(dShort(c.cur.date))}</small>`}</td>` : `<td class="tsc none">–</td>`).join("")}</tr>`).join("")}</tbody>
    <tfoot><tr><th>Gemiddelde</th>${stats.map((s, k) => `<td>${s ? tsFmt(cols[k], s.avg) : "–"}</td>`).join("")}</tr><tr><th>Beste</th>${stats.map((s, k) => `<td>${s ? tsFmt(cols[k], s.best) : "–"}</td>`).join("")}</tr></tfoot></table></div>
    <p class="hint">Groen: het beste derde van de ploeg op die test, oranje: het zwakste derde (vanaf 4 spelers). ▲ beter dan de vorige keer, ▼ minder goed. Vergelijk spelers vooral met zichzelf: kinderen van dezelfde leeftijd verschillen sterk in groei.</p>`)
    + (cols.length < T.length ? `<p class="hint">Nog zonder resultaten: ${T.filter(t => !cols.includes(t)).map(t => esc(t.name)).join(", ")}.</p>` : "");
  bindTabs(); $$("[data-day]", v).forEach(b => b.onclick = () => { TS_DAY = b.dataset.day; render(); });
  if ($("#tsCsv")) $("#tsCsv").onclick = () => { const all = T.filter(t => R.some(r => r.test_id === t.id)), lines = [["Speler", "Rugnummer", "Datum", "Test", "Resultaat", "Eenheid", "Pogingen"].map(csvCell).join(";")];
    R.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(r => { const p = P.find(x => x.id === r.player_id), t = tsById(r.test_id); if (!p || !t || !all.includes(t)) return;
      lines.push([pname(p), p.number ?? "", r.date, t.name, tsFmt(t, r.value), t.unit || "", (r.tries || []).map(x => tsFmt(t, x)).join(" / ")].map(csvCell).join(";")); });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" })); a.download = `fysieke-testen-${(S.team?.name || "ploeg").replace(/\W+/g, "-")}.csv`; a.click(); };
  if ($("#tsPr")) $("#tsPr").onclick = () => window.print();
}

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
      ${xs.length > 1 ? tsLine(t, [{ name: pname(p), cls: "me", pts: xs.map(x => ({ date: x.date, v: +x.value })) }, { name: "Gemiddelde ploeg", cls: "avg", pts: tsDays((S.fit || []).filter(r => active().some(q => q.id === r.player_id)), t).map(d => ({ date: d.date, v: d.avg })) }], null, t.name) : ""}</div>`; }).join("");
  return `<div class="sec panel" data-t="groei"><div class="row" style="margin-bottom:6px"><h2 style="margin:0;margin-right:auto">Fysieke testen</h2></div>
    ${cards ? `<div class="tscards">${cards}</div><p class="hint" style="margin-bottom:0"><a class="link" href="#/testen/${p.id}">Volledige analyse en alle metingen ›</a> Vergelijk vooral met eerdere resultaten van deze speler. Een groeispurt (zie Meten en wegen) kan resultaten tijdelijk doen dalen.</p>` : `<p class="hint" style="margin:0">Nog geen testresultaten voor ${esc(p.first_name || "deze speler")}.${tsOn().length ? "" : " De club heeft nog geen testen aangemaakt."}</p>`}</div>`;
}

/* ============ testen afnemen kan enkel in de aparte testapp (test/), niet in de trainersapp ============ */
route("testafname", { title: "Fysieke testen", auth: true, render: () => location.replace("#/testen") });

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
    <p class="hint" style="margin-top:0">Maak elke test één keer aan. Testafnemers kiezen ze daarna in de testapp en zien de resultaten per ploeg en in het dossier van de speler. Bij meer pogingen telt de beste.</p>
    <datalist id="tsunits">${TS_UNITS.map(u => `<option value="${u}">`).join("")}</datalist>
    <div id="tslist" class="cslist">${T.length ? T.map(tsRow).join("") : ""}</div>
    ${T.length ? "" : `<p class="hint" id="tsnone">Nog geen testen. Voorbeelden: <i>Sprint 10 m</i> (s, lager is beter, 2 decimalen, 2 pogingen), <i>Verspringen zonder aanloop</i> (cm, hoger is beter), <i>Yo-yo-test</i> (niveau).</p>`}
    <button class="link" type="button" id="tsadd" style="margin:4px 0 12px">${IC.plus}Test toevoegen</button>
    <h2>Testapp voor testafnemers</h2>
    <p class="hint" style="margin-top:0">Testen worden ingevuld in een aparte gsm-app. Testafnemers (bv. een kinesist, looptrainer of trainer) openen de link, maken een account aan met deze testcode en wachten tot jij ze toelaat bij <a class="link" href="#/clubbeheer/toegang">Toegang en leden</a>. Ze zien enkel de namen en rugnummers van de spelers en kunnen niets anders in de app.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><code id="tcode" style="font-size:18px;font-weight:900;padding:8px 12px;border-radius:10px;background:var(--card2)">…</code><button class="btn ghost small" type="button" id="tcodeNew">Nieuwe code</button><button class="btn ghost small" type="button" id="tcodeCp">${IC.copy || ""}Link en code kopiëren</button><a class="btn ghost small" id="tapp" target="_blank" rel="noopener">Testapp openen</a></div>
    <p class="hint">Link: <a class="link" id="tlink" target="_blank" rel="noopener"></a> · Een nieuwe code maakt de oude ongeldig; wie al testafnemer is, blijft dat. Een bestaand lid kan je ook zelf het recht <b>Fysieke testen afnemen</b> of de functie <b>Testafnemer</b> geven. Beheerders kunnen altijd testen afnemen.</p>`;
}
const tsAppUrl = () => new URL("test/?c=" + CLUB.id, location.href.split("#")[0].split("?")[0]).href;
function tsSettingsBind(f, st) {
  const L = $("#tslist", f);
  { const base = tsAppUrl(), el = $("#tcode", f), lk = $("#tlink", f); let url = base; $("#tapp", f).href = base;
    const setL = c => { url = c && /^[A-Z0-9]{4,}$/i.test(c) ? base + "&k=" + encodeURIComponent(c) : base; lk.href = url; lk.textContent = url; }; setL("");
    const get = async nieuw => { if (mode === "demo") { el.textContent = "TDEMO123"; setL("TDEMO123"); return; } const r = await sb.rpc("test_code", { nieuw }); el.textContent = r.error ? "niet beschikbaar" : r.data; setL(r.error ? "" : r.data); };
    get(false); $("#tcodeNew", f).onclick = async () => { if (confirm("Een nieuwe testcode maken? De oude werkt dan niet meer voor nieuwe testafnemers.")) await get(true); };
    $("#tcodeCp", f).onclick = async () => { const t = `Testapp ${clubName()}: ${url}\nTestcode: ${el.textContent}\nMaak een account aan met de testcode. Daarna laat de beheerder je toe.`; try { await navigator.clipboard.writeText(t); toast("Link en code gekopieerd."); } catch (e) { toast(t); } }; }
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

/* ============ analyse: rekenwerk ============ */
/* resultaten van één test, per testdag gegroepeerd (enkel spelers van de huidige ploeg) */
function tsDays(R, t) { const m = new Map(); R.filter(r => r.test_id === t.id).forEach(r => { if (!m.has(r.date)) m.set(r.date, []); m.get(r.date).push(r); });
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, rs]) => { const vs = rs.map(r => +r.value);
    return { date, rs, n: vs.length, avg: vs.reduce((a, b) => a + b, 0) / vs.length, min: Math.min(...vs), max: Math.max(...vs) }; }); }
/* procent van de ploeg dat de speler die dag overtreft (0–100); gelijke resultaten tellen half */
function tsPct(t, day, v) { const o = day.rs.map(r => +r.value); if (o.length < 3) return null; let w = 0; o.forEach(x => { if (x === v) w += .5; else if (tsBetter(t, v, x)) w++; }); w -= .5; return Math.round(100 * w / (o.length - 1)); }
const tsRank = (t, day, v) => 1 + day.rs.filter(r => tsBetter(t, +r.value, v) && +r.value !== v).length;
/* verandering in procent, positief = beter (ook bij tijden, waar lager beter is) */
const tsGain = (t, a, b) => a ? (tsLow(t) ? (a - b) / a : (b - a) / a) * 100 : null;
const tsPctTxt = x => x == null ? "–" : (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(Math.abs(x) < 10 ? 1 : 0).replace(".", ",") + "%";
const tsGainHtml = x => x == null ? "" : `<span class="tsg ${x > 0.5 ? "up" : x < -0.5 ? "down" : ""}">${x > 0.5 ? "▲" : x < -0.5 ? "▼" : "="} ${tsPctTxt(x)}</span>`;
const tsDayLbl = d => parse(d).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }) + (parse(d).getFullYear() !== new Date().getFullYear() ? " " + String(parse(d).getFullYear()).slice(2) : "");

/* ============ analyse: grafieken ============ */
/* lijngrafiek over de tijd. series: [{ name, cls, pts:[{date,v,tip}] }], band: [{date,lo,hi}] (spreiding van de ploeg).
   Lager-is-beter: de as staat omgekeerd, zodat beter altijd bovenaan staat. */
function tsLine(t, series, band, label) {
  const all = series.flatMap(s => s.pts), dates = [...new Set([...all.map(p => p.date), ...(band || []).map(b => b.date)])].sort();
  if (dates.length < 2) return `<p class="hint" style="margin:6px 0 0">Na een tweede testdag verschijnt hier de grafiek.</p>`;
  const W = 640, H = 220, pl = 46, pr = 16, pt = 16, pb = 30, t0 = parse(dates[0]).getTime(), t1 = parse(dates[dates.length - 1]).getTime(), sp = Math.max(1, t1 - t0);
  const vs = [...all.map(p => p.v), ...(band || []).flatMap(b => [b.lo, b.hi])], mn = Math.min(...vs), mx = Math.max(...vs), pad = (mx - mn || Math.abs(mx) * .1 || 1) * .15, lo = mn - pad, hi = mx + pad;
  const X = d => pl + (parse(d).getTime() - t0) * (W - pl - pr) / sp, Y = v => { const f = (v - lo) / (hi - lo); return pt + (tsLow(t) ? f : 1 - f) * (H - pt - pb); };
  const ticks = (() => { const r = hi - lo, raw = r / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => r / k <= 7) || raw, o = []; for (let x = Math.ceil(lo / st) * st; x <= hi; x += st) o.push(+x.toFixed(6)); return o; })();
  const dec = Math.max(0, Math.min(2, t.dec ?? 1)), xl = dates.length <= 6 ? dates : dates.filter((d, i) => i % Math.ceil(dates.length / 6) === 0 || i === dates.length - 1);
  const bandPath = band && band.length > 1 ? `M${band.map(b => X(b.date) + "," + Y(b.hi)).join("L")}L${band.slice().reverse().map(b => X(b.date) + "," + Y(b.lo)).join("L")}Z` : "";
  const data = dates.map(d => ({ d, x: X(d), rows: series.map(s => { const p = s.pts.find(q => q.date === d); return p ? { s, p } : null; }).filter(Boolean), b: (band || []).find(b => b.date === d) }));
  return `<div class="tsch" data-tsd='${esc(JSON.stringify(data.map(o => ({ x: o.x / W, d: tsDayLbl(o.d), r: o.rows.map(r => [r.s.name, r.s.cls, r.p.tip || tsFmt(t, r.p.v)]), b: o.b ? tsFmt(t, o.b.lo) + " – " + tsFmt(t, o.b.hi) : "" }))))}'>
    ${series.length > 1 || band ? `<div class="tsleg">${series.map(s => `<span><i class="${s.cls}"></i>${esc(s.name)}</span>`).join("")}${bandPath ? `<span><i class="band"></i>spreiding ploeg</span>` : ""}</div>` : ""}
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${ticks.map(v => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${pl - 7}" y="${Y(v) + 4}" text-anchor="end" class="ax">${String(+v.toFixed(dec)).replace(".", ",")}</text>`).join("")}
    ${xl.map(d => `<text x="${X(d)}" y="${H - 9}" text-anchor="middle" class="ax">${esc(tsDayLbl(d))}</text>`).join("")}
    ${bandPath ? `<path d="${bandPath}" class="band"/>` : ""}
    ${series.map(s => `<polyline class="${s.cls}" points="${s.pts.slice().sort((a, b) => a.date.localeCompare(b.date)).map(p => X(p.date) + "," + Y(p.v)).join(" ")}"/>${s.pts.map(p => `<circle class="${s.cls}" cx="${X(p.date)}" cy="${Y(p.v)}" r="${s.cls === "me" ? 5 : 4}"/>`).join("")}`).join("")}
    <line class="xh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" style="display:none"/>
    <text x="${W - pr}" y="${pt - 4}" text-anchor="end" class="ax">${esc(t.unit || "")}${tsLow(t) ? " · beter ↑" : ""}</text></svg><div class="tstip" hidden></div></div>`;
}
/* crosshair en tooltip: dichtstbijzijnde testdag onder de muis of vinger */
function tsTipBind(root) {
  $$(".tsch", root).forEach(c => { const D = JSON.parse(c.dataset.tsd || "[]"), svg = $("svg", c), tip = $(".tstip", c), xh = $(".xh", c); if (!D.length) return;
    const show = e => { const r = svg.getBoundingClientRect(), fx = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width, o = D.reduce((a, b) => Math.abs(b.x - fx) < Math.abs(a.x - fx) ? b : a);
      xh.style.display = ""; xh.setAttribute("x1", o.x * 640); xh.setAttribute("x2", o.x * 640);
      tip.innerHTML = `<b>${esc(o.d)}</b>${o.r.map(([n, k, v]) => `<span><i class="${k}"></i>${esc(n)}<em>${esc(v)}</em></span>`).join("")}${o.b ? `<span><i class="band"></i>spreiding<em>${esc(o.b)}</em></span>` : ""}`;
      tip.hidden = false; const left = o.x * r.width; tip.style.left = Math.min(Math.max(0, left - tip.offsetWidth / 2), r.width - tip.offsetWidth) + "px"; };
    svg.addEventListener("pointermove", show); svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointerleave", () => { tip.hidden = true; xh.style.display = "none"; }); });
}

/* ============ analyse: per speler ============ */
function tsPlayerView(host, T, P, R) {
  const withRes = P.filter(p => R.some(r => r.player_id === p.id));
  if (!withRes.some(p => p.id === TS_PID)) TS_PID = withRes[0]?.id || P[0].id;
  const p = P.find(x => x.id === TS_PID), i = P.indexOf(p), mine = R.filter(r => r.player_id === p.id);
  const tests = T.filter(t => mine.some(r => r.test_id === t.id));
  /* per test: alles wat we nodig hebben */
  const info = tests.map(t => { const days = tsDays(R, t), xs = mine.filter(r => r.test_id === t.id).sort((a, b) => a.date.localeCompare(b.date)), last = xs[xs.length - 1], first = xs[0], prev = xs[xs.length - 2];
    const dl = days.find(d => d.date === last.date), pct = tsPct(t, dl, +last.value);
    return { t, days, xs, last, first, prev, best: tsBest(t, xs.map(x => x.value)), pct, rank: tsRank(t, dl, +last.value), n: dl.n, gainAll: xs.length > 1 ? tsGain(t, +first.value, +last.value) : null, gainLast: prev ? tsGain(t, +prev.value, +last.value) : null, vsAvg: tsGain(t, dl.avg, +last.value) }; });
  const ranked = info.filter(x => x.pct != null).sort((a, b) => b.pct - a.pct), strong = ranked[0], weak = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const ups = info.filter(x => x.gainLast != null && x.gainLast > 0.5).length, downs = info.filter(x => x.gainLast != null && x.gainLast < -0.5).length;
  const nav = `<div class="tspick"><button type="button" class="btn ghost small" id="tsPrev"${i ? "" : " disabled"} aria-label="Vorige speler">‹</button>
    <select id="tsPl" aria-label="Speler kiezen">${P.map(x => `<option value="${x.id}"${x.id === p.id ? " selected" : ""}>${x.number != null ? x.number + " · " : ""}${esc(pname(x))}${R.some(r => r.player_id === x.id) ? "" : " (geen resultaten)"}</option>`).join("")}</select>
    <button type="button" class="btn ghost small" id="tsNext"${i < P.length - 1 ? "" : " disabled"} aria-label="Volgende speler">›</button>
    <a class="link" href="#/${isDossierOff() ? "speler" : "dossier"}/${p.id}" style="margin-left:auto">Dossier van ${esc(p.first_name || pname(p))} ›</a></div>`;
  if (!info.length) { host.innerHTML = nav + `<div class="empty"><b>Nog geen resultaten voor ${esc(pname(p))}</b>Deze speler werd nog niet getest.</div>`; tsPickBind(host, P); return; }
  const prof = ranked.length >= 2 ? `<div class="panel sec"><h3 style="margin:0 0 4px">Profiel in de ploeg</h3><p class="hint" style="margin:0 0 12px">Laatste resultaat per test: hoeveel procent van de ploeg ${esc(p.first_name || "de speler")} die dag overtrof. 50% is het midden van de ploeg.</p>
    <div class="tsprof">${info.map(x => `<div class="tspr"><span class="n">${esc(x.t.name)}</span><span class="tb" title="${x.pct == null ? "te weinig spelers getest" : `beter dan ${x.pct}% van de ploeg`}"><em></em>${x.pct == null ? "" : `<i style="width:${Math.max(2, x.pct)}%"></i>`}</span><b>${x.pct == null ? "–" : x.pct + "%"}</b><small>${x.pct == null ? "" : x.rank + "e van " + x.n}</small></div>`).join("")}</div></div>` : "";
  host.innerHTML = nav + `<div class="tssum">
      <div class="kpi"><small>Testen afgelegd</small><b>${info.length}<span class="u">/${T.length}</span></b><span>${mine.length} ${mine.length === 1 ? "meting" : "metingen"}</span></div>
      <div class="kpi"><small>Sinds vorige keer</small><b>${ups}<span class="u"> beter</span></b><span>${downs ? downs + " minder goed" : "geen enkele achteruit"}</span></div>
      <div class="kpi"><small>Sterkste test</small><b class="tx">${strong ? esc(strong.t.name) : "–"}</b><span>${strong ? `beter dan ${strong.pct}% van de ploeg` : "nog te weinig vergelijking"}</span></div>
      <div class="kpi"><small>Grootste werkpunt</small><b class="tx">${weak ? esc(weak.t.name) : "–"}</b><span>${weak ? `beter dan ${weak.pct}% van de ploeg` : "nog te weinig vergelijking"}</span></div></div>
    ${prof}
    <div class="tsplist sec">${info.map(x => { const t = x.t;
      return `<div class="panel tscard tspc"><div class="row" style="margin-bottom:8px;gap:8px"><h3 style="margin:0;margin-right:auto">${esc(t.name)}</h3><small class="muted">${esc(tsDirTxt(t))}</small></div>
        <div class="tspcb"><div class="dkpis tsk4"><div class="kpi"><small>Laatste</small><b>${tsFmt(t, x.last.value)}${tsUnit(t)}</b><span>${esc(tsDayLbl(x.last.date))}</span></div>
          <div class="kpi"><small>Beste ooit</small><b>${tsFmt(t, x.best)}${tsUnit(t)}</b><span>${x.xs.length} ${x.xs.length === 1 ? "meting" : "metingen"}</span></div>
          <div class="kpi"><small>Vorige keer</small><b>${x.gainLast == null ? "–" : tsGainHtml(x.gainLast)}</b><span>${x.prev ? tsFmt(t, x.prev.value) + (t.unit ? " " + esc(t.unit) : "") : "eerste meting"}</span></div>
          <div class="kpi"><small>T.o.v. ploeg</small><b>${tsGainHtml(x.vsAvg)}</b><span>gem. ${tsFmt(t, x.days.find(d => d.date === x.last.date).avg)}</span></div></div>
        <div>${tsLine(t, [{ name: pname(p), cls: "me", pts: x.xs.map(r => ({ date: r.date, v: +r.value })) }, { name: "Gemiddelde ploeg", cls: "avg", pts: x.days.map(d => ({ date: d.date, v: d.avg, tip: tsFmt(t, d.avg) + " (" + d.n + " sp.)" })) }], x.days.filter(d => d.n >= 3).map(d => ({ date: d.date, lo: d.min, hi: d.max })), `${t.name}: ${pname(p)} tegenover de ploeg`)}</div></div>
        ${x.gainAll != null && x.xs.length > 2 ? `<p class="hint" style="margin:8px 0 0">Sinds de eerste meting (${esc(tsDayLbl(x.first.date))}): ${tsGainHtml(x.gainAll)}</p>` : ""}
        <details class="tsdet"><summary>Alle metingen</summary><table class="tbl"><thead><tr><th>Datum</th><th>Resultaat</th><th>Pogingen</th><th>Verschil</th><th>Plaats</th></tr></thead><tbody>
          ${x.xs.slice().reverse().map((r, k, arr) => { const pv = arr[k + 1], d = x.days.find(q => q.date === r.date); return `<tr><td>${esc(dShort(r.date))}</td><td><b>${tsFmt(t, r.value)}</b></td><td>${(r.tries || []).length > 1 ? r.tries.map(q => tsFmt(t, q)).join(" / ") : ""}</td><td>${pv ? tsGainHtml(tsGain(t, +pv.value, +r.value)) : ""}</td><td>${d.n > 1 ? tsRank(t, d, +r.value) + "/" + d.n : ""}</td></tr>`; }).join("")}</tbody></table></details></div>`; }).join("")}</div>
    <p class="hint">Beter staat in de grafieken altijd bovenaan, ook bij tijden (waar lager beter is). Vergelijk vooral met eerdere resultaten van de speler zelf: een groeispurt kan resultaten tijdelijk doen dalen.</p>`;
  tsPickBind(host, P); tsTipBind(host);
}
function tsPickBind(host, P) { const go = id => { TS_PID = id; render(); };
  $("#tsPl", host).onchange = e => go(e.target.value);
  $("#tsPrev", host).onclick = () => { const i = P.findIndex(x => x.id === TS_PID); if (i > 0) go(P[i - 1].id); };
  $("#tsNext", host).onclick = () => { const i = P.findIndex(x => x.id === TS_PID); if (i < P.length - 1) go(P[i + 1].id); }; }

/* ============ analyse: ploeg en evolutie ============ */
function tsTeamView(host, T, P, R) {
  const tests = T.filter(t => R.some(r => r.test_id === t.id)); if (!tests.some(t => t.id === TS_TEST)) TS_TEST = tests[0].id;
  const t = tests.find(x => x.id === TS_TEST), days = tsDays(R, t), last = days[days.length - 1], prevD = days[days.length - 2];
  if (!days.some(d => d.date === TS_TDAY)) TS_TDAY = last.date;
  const day = days.find(d => d.date === TS_TDAY), di = days.indexOf(day), before = days[di - 1];
  const nm = id => { const p = P.find(x => x.id === id); return p ? pname(p) : "?"; };
  /* ranking van de gekozen dag */
  const rows = day.rs.slice().sort((a, b) => tsLow(t) ? a.value - b.value : b.value - a.value), vals = rows.map(r => +r.value), vmin = Math.min(...vals), vmax = Math.max(...vals);
  const w = v => { if (vmax === vmin) return 100; const f = (v - vmin) / (vmax - vmin); return 18 + 82 * (tsLow(t) ? 1 - f : f); };
  /* vooruitgang tussen twee testdagen, per speler zijn vorige meting */
  const evo = rows.map(r => { const pv = R.filter(x => x.player_id === r.player_id && x.test_id === t.id && x.date < day.date).sort((a, b) => b.date.localeCompare(a.date))[0]; return pv ? { r, pv, g: tsGain(t, +pv.value, +r.value) } : null; }).filter(Boolean).sort((a, b) => b.g - a.g);
  const untested = P.filter(p => !day.rs.some(r => r.player_id === p.id));
  host.innerHTML = `<div class="tsdays"><span>Test</span>${tests.map(x => `<button type="button" data-tt="${x.id}" aria-pressed="${x.id === t.id}">${esc(x.name)}</button>`).join("")}</div>
    <div class="tssum sec"><div class="kpi"><small>Testdagen</small><b>${days.length}</b><span>${days.length > 1 ? "sinds " + esc(tsDayLbl(days[0].date)) : "eerste testdag"}</span></div>
      <div class="kpi"><small>Gemiddelde ploeg</small><b>${tsFmt(t, last.avg)}${tsUnit(t)}</b><span>${prevD ? tsGainHtml(tsGain(t, prevD.avg, last.avg)) + " t.o.v. " + esc(tsDayLbl(prevD.date)) : esc(tsDayLbl(last.date))}</span></div>
      <div class="kpi"><small>Beste resultaat</small><b>${tsFmt(t, tsLow(t) ? last.min : last.max)}${tsUnit(t)}</b><span>${esc(nm(last.rs.find(r => +r.value === (tsLow(t) ? last.min : last.max)).player_id))}</span></div>
      <div class="kpi"><small>Spreiding</small><b>${tsFmt(t, last.max - last.min)}${tsUnit(t)}</b><span>tussen beste en zwakste</span></div></div>
    <div class="panel sec"><h3 style="margin:0 0 4px">Evolutie van de ploeg</h3><p class="hint" style="margin:0 0 10px">Gemiddelde per testdag, met de spreiding tussen het beste en het zwakste resultaat.</p>
      ${tsLine(t, [{ name: "Gemiddelde ploeg", cls: "avg", pts: days.map(d => ({ date: d.date, v: d.avg, tip: tsFmt(t, d.avg) + " (" + d.n + " sp.)" })) }, { name: "Beste van de dag", cls: "me", pts: days.map(d => ({ date: d.date, v: tsLow(t) ? d.min : d.max })) }], days.map(d => ({ date: d.date, lo: d.min, hi: d.max })), `${t.name}: evolutie van de ploeg`)}</div>
    <div class="grid2 sec tsgrid"><div class="panel"><div class="row" style="gap:8px;margin-bottom:8px"><h3 style="margin:0;margin-right:auto">Rangschikking</h3>
        <select id="tsDay" aria-label="Testdag">${days.slice().reverse().map(d => `<option value="${d.date}"${d.date === day.date ? " selected" : ""}>${esc(dShort(d.date))}</option>`).join("")}</select></div>
      <div class="tsrank">${rows.map((r, k) => `<a class="tsrk" href="#/testen/${r.player_id}" title="Evolutie van ${esc(nm(r.player_id))}"><span class="k">${k + 1}</span><span class="n">${esc(nm(r.player_id))}</span><span class="tb"><i style="width:${w(+r.value)}%"></i></span><b>${tsFmt(t, r.value)}</b></a>`).join("")}</div>
      <p class="hint" style="margin:8px 0 0">De lijn toont het gemiddelde (${tsFmt(t, day.avg)}).${untested.length ? ` Niet getest: ${untested.map(p => esc(p.first_name || pname(p))).join(", ")}.` : ""}</p></div>
      <div class="panel"><h3 style="margin:0 0 4px">Vooruitgang</h3><p class="hint" style="margin:0 0 10px">${evo.length ? `Tegenover de vorige meting van elke speler${before ? ` (meestal ${esc(tsDayLbl(before.date))})` : ""}.` : "Na een tweede testdag zie je hier wie vooruitging."}</p>
        ${evo.length ? `<div class="tsevo">${evo.map(e => `<div><span class="n">${esc(nm(e.r.player_id))}</span><small>${tsFmt(t, e.pv.value)} → ${tsFmt(t, e.r.value)}</small>${tsGainHtml(e.g)}</div>`).join("")}</div>
          <p class="hint" style="margin:10px 0 0">${evo.filter(e => e.g > 0.5).length} van ${evo.length} spelers deden beter, gemiddeld ${tsPctTxt(evo.reduce((a, e) => a + e.g, 0) / evo.length)}.</p>` : ""}</div></div>`;
  const avgLine = $(".tsrank", host); if (avgLine) avgLine.style.setProperty("--avg", w(day.avg) + "%");
  $$("[data-tt]", host).forEach(b => b.onclick = () => { TS_TEST = b.dataset.tt; TS_TDAY = ""; render(); });
  $("#tsDay", host).onchange = e => { TS_TDAY = e.target.value; render(); };
  tsTipBind(host);
}
