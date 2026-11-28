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
const tsMayTest = () => S.admin || (S.rechten || []).includes("tester") || mode === "demo";
const tsTeams = () => tsMayTest() ? (S.teams || []) : myTeams();
const tsFit = pid => (S.fit || []).filter(r => r.player_id === pid);
const tsDirTxt = t => tsLow(t) ? "lager is beter" : "hoger is beter";

/* ============ resultaten van de ploeg ============ */
let TS_DAY = "";
route("testen", { title: "Fysieke testen", auth: true, team: true, render: v => {
  const T = tsOn(), P = active(), R = (S.fit || []).filter(r => P.some(p => p.id === r.player_id));
  const acts = `<div class="row" style="gap:8px;flex-wrap:wrap">${tsMayTest() ? `<a class="btn" href="${esc(tsAppUrl())}" target="_blank" rel="noopener">${IC.phone}Testapp openen</a>` : ""}${R.length ? `<button class="btn ghost" type="button" id="tsCsv">${IC.dl}Exporteren</button><button class="btn ghost" type="button" id="tsPr">${IC.print}Afdrukken</button>` : ""}</div>`;
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
  v.innerHTML = head("Fysieke testen", sub, acts) + (!R.length ? `<div class="empty"><b>Nog geen resultaten</b>${tsMayTest() ? `Neem de eerste testen af met <a class="link" href="${esc(tsAppUrl())}" target="_blank" rel="noopener">de testapp</a>.` : "Een testafnemer van de club vult ze in met de testapp."}</div>` : `
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
  return `<div class="sec panel" data-t="groei"><div class="row" style="margin-bottom:6px"><h2 style="margin:0;margin-right:auto">Fysieke testen</h2>${tsMayTest() ? `<a class="btn small ghost noprint" href="${esc(tsAppUrl())}" target="_blank" rel="noopener">Testapp openen</a>` : ""}</div>
    ${cards ? `<div class="tscards">${cards}</div><p class="hint" style="margin-bottom:0">Vergelijk vooral met eerdere resultaten van deze speler. Een groeispurt (zie Meten en wegen) kan resultaten tijdelijk doen dalen.</p>` : `<p class="hint" style="margin:0">Nog geen testresultaten voor ${esc(p.first_name || "deze speler")}.${tsOn().length ? "" : " De club heeft nog geen testen aangemaakt."}</p>`}</div>`;
}

/* ============ testen afnemen gebeurt in de aparte testapp (test/) ============ */
route("testafname", { title: "Testen afnemen", auth: true, render: v => {
  const u = tsAppUrl();
  v.innerHTML = head("Testen afnemen", "Testen vul je in met de aparte testapp op je gsm.", "") + `<div class="panel" style="max-width:560px"><p style="margin-top:0">De testapp opent nu. Gebeurt er niets, tik dan op de knop. Zet de testapp op het beginscherm van je gsm, dan open je ze voortaan rechtstreeks.</p><a class="btn" href="${esc(u)}">${IC.phone}Testapp openen</a></div>`;
  if (tsMayTest() && !clubOff("testen")) setTimeout(() => { if (/^#\/testafname/.test(location.hash)) location.assign(u); }, 250);
} });

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
