/* FootballCoachHub — meten en wegen: lengte en gewicht van een speler doorheen de jaren (tab "Groei" in het dossier).
   Enkel voor de trainers van de ploeg. Gaat in de tabel player_measures (databaseversie 42). */
"use strict";
const gDate = d => parse(d).getTime();
const gFmt = n => n == null ? "–" : String(Math.round(n * 10) / 10).replace(".", ",");
const gMine = p => (S.pmeas || []).filter(m => m.player_id === p.id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
/* groeisnelheid in cm per jaar: de laatste meting tegenover de meest recente meting die minstens 5 maanden ouder is */
function gSpeed(ms, key) {
  const xs = ms.filter(m => m[key] != null); if (xs.length < 2) return null;
  const last = xs[xs.length - 1], prev = xs.slice(0, -1).reverse().find(m => gDate(last.date) - gDate(m.date) >= 150 * 864e5); if (!prev) return null;
  return (last[key] - prev[key]) / ((gDate(last.date) - gDate(prev.date)) / (365.25 * 864e5));
}
/* lijngrafiek met echte tijdas */
function gChart(ms, key, unit, color) {
  const xs = ms.filter(m => m[key] != null); if (xs.length < 2) return `<p class="hint" style="margin:0">${xs.length ? "Eén meting is nog geen verloop. Voeg een volgende meting toe." : "Nog geen metingen."}</p>`;
  const W = 640, H = 190, pl = 40, pr = 14, pt = 14, pb = 28, t0 = gDate(xs[0].date), t1 = gDate(xs[xs.length - 1].date), span = Math.max(1, t1 - t0);
  const vs = xs.map(m => +m[key]), lo = Math.floor(Math.min(...vs) - 2), hi = Math.ceil(Math.max(...vs) + 2), X = m => pl + (gDate(m.date) - t0) * (W - pl - pr) / span, Y = v => pt + (hi - v) * (H - pt - pb) / Math.max(1, hi - lo);
  const step = Math.max(1, Math.ceil((hi - lo) / 4)), grid = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(v);
  const years = []; for (let y = parse(xs[0].date).getFullYear(); y <= parse(xs[xs.length - 1].date).getFullYear(); y++) { const tt = new Date(y, 0, 1).getTime(); if (tt >= t0 && tt <= t1) years.push([y, pl + (tt - t0) * (W - pl - pr) / span]); }
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Verloop van ${key === "height_cm" ? "de lengte" : "het gewicht"}">
    ${grid.map(v => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="12" style="fill:var(--dim)">${v}</text>`).join("")}
    ${years.map(([y, x]) => `<line x1="${x}" x2="${x}" y1="${pt}" y2="${H - pb}" style="stroke:var(--line)" stroke-dasharray="3 4"/><text x="${x + 3}" y="${H - 8}" font-size="12" style="fill:var(--dim)">${y}</text>`).join("")}
    <polyline fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" points="${xs.map(m => X(m) + "," + Y(m[key])).join(" ")}"/>
    ${xs.map(m => `<circle cx="${X(m)}" cy="${Y(m[key])}" r="4.5" fill="${color}" style="stroke:var(--bg2,#111)" stroke-width="2"><title>${esc(dShort(m.date))} · ${gFmt(m[key])} ${unit}</title></circle>`).join("")}
    <text x="${W - pr}" y="${H - 8}" text-anchor="end" font-size="12" style="fill:var(--dim)">${unit}</text></svg>`;
}
function groeiPane(p) {
  const ms = gMine(p), lastH = ms.filter(m => m.height_cm != null).pop(), lastW = ms.filter(m => m.weight_kg != null).pop(), sp = gSpeed(ms, "height_cm"), sw = gSpeed(ms, "weight_kg"), dis = S.pmeasOk === false;
  return `<div class="sec panel" data-t="groei"><div class="row" style="margin-bottom:6px"><h2 style="margin:0;margin-right:auto">Meten en wegen</h2>${dis ? "" : `<button class="btn small noprint" type="button" id="gAdd">Meting toevoegen</button>`}</div>
    <p class="hint" style="margin-top:0">Lengte en gewicht doorheen de jaren. Alleen zichtbaar voor de trainers van deze ploeg. Meet bij voorkeur op dezelfde manier (zonder schoenen, ongeveer elke 3 maanden), dan zijn de cijfers vergelijkbaar.</p>
    ${dis ? `<p class="hint">Dit onderdeel werkt zodra de beheerder <b>supabase-groei-v42.sql</b> uitvoert.</p>` : `
    <div class="dkpis"><div class="kpi"><small>Lengte</small><b>${lastH ? gFmt(lastH.height_cm) + "<span class=\"u\"> cm</span>" : "–"}</b><span>${lastH ? esc(dShort(lastH.date)) : "nog niet gemeten"}</span></div>
      <div class="kpi"><small>Groei per jaar</small><b>${sp != null ? (sp >= 0 ? "+" : "") + gFmt(sp) + "<span class=\"u\"> cm</span>" : "–"}</b><span>${sp != null ? (sp >= 7.5 ? "snelle groeispurt" : "op basis van de laatste metingen") : "na twee metingen met 5 maanden ertussen"}</span></div>
      <div class="kpi"><small>Gewicht</small><b>${lastW ? gFmt(lastW.weight_kg) + "<span class=\"u\"> kg</span>" : "–"}</b><span>${lastW ? esc(dShort(lastW.date)) : "nog niet gewogen"}</span></div>
      <div class="kpi"><small>Gewichtstoename</small><b>${sw != null ? (sw >= 0 ? "+" : "") + gFmt(sw) + "<span class=\"u\"> kg</span>" : "–"}</b><span>per jaar</span></div></div>
    <div class="sec"><div class="panel"><h2>Lengte</h2>${gChart(ms, "height_cm", "cm", "#FFD100")}</div><div class="panel" style="margin-top:12px"><h2>Gewicht</h2>${gChart(ms, "weight_kg", "kg", "#10B981")}</div></div>
    ${ms.length ? `<h3 class="dosh" style="margin-top:16px">Alle metingen</h3><div class="list">${ms.slice().reverse().map(m => `<div class="item"><span class="main"><b>${esc(dShort(m.date))}${parse(m.date).getFullYear() !== new Date().getFullYear() ? " " + parse(m.date).getFullYear() : ""}</b><small>${[m.height_cm != null ? gFmt(m.height_cm) + " cm" : "", m.weight_kg != null ? gFmt(m.weight_kg) + " kg" : "", m.note || ""].filter(Boolean).map(esc).join(" · ")}</small></span><button class="btn ghost small noprint" type="button" data-gE="${m.id}">Bewerken</button></div>`).join("")}</div>` : ""}
    <p class="hint" style="margin-bottom:0">Een snelle groei (meer dan ongeveer 7 cm per jaar) kan wijzen op een groeispurt. Spelers kunnen dan tijdelijk onhandiger zijn of sneller last krijgen van knieën en hielen. Bekijk het samen met de rijpheid op het startblad.</p>`}</div>`;
}
function groeiForm(p, m) {
  const n = !m, d = dialog(`<form><h2>${n ? "Meting toevoegen" : "Meting bewerken"} · ${esc(p.first_name)}</h2><div class="fields">
    <label class="f full">Datum<input name="date" type="date" required value="${esc(m?.date || todayIso())}"></label>
    <label class="f">Lengte (cm)<input name="h" type="number" step="0.1" min="40" max="230" inputmode="decimal" value="${m?.height_cm ?? ""}"></label>
    <label class="f">Gewicht (kg)<input name="w" type="number" step="0.1" min="5" max="200" inputmode="decimal" value="${m?.weight_kg ?? ""}"></label>
    <label class="f full">Opmerking<input name="note" maxlength="300" value="${esc(m?.note || "")}" placeholder="Bv. gemeten na de training, zonder schoenen"></label></div>
    <div class="row">${n ? "" : `<button class="btn danger" type="button" id="gDel">Verwijderen</button>`}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  if (!n) $("#gDel", d).onclick = async () => { if (!confirm("Deze meting verwijderen?")) return; await safe(async () => { await db.del("player_measures", { id: m.id }); S.pmeas = S.pmeas.filter(x => x.id !== m.id); d.close(); render(); }, "Meting verwijderd."); };
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), h = f.h === "" ? null : +f.h, w = f.w === "" ? null : +f.w;
    if (h == null && w == null) { toast("Vul een lengte of een gewicht in."); return; }
    const row = { ...(n ? { id: uid(), team_id: p.team_id, player_id: p.id } : m), date: f.date, height_cm: h, weight_kg: w, note: f.note.trim() || null };
    await safe(async () => { await db.save("player_measures", row); const i = S.pmeas.findIndex(x => x.id === row.id); if (i >= 0) S.pmeas[i] = row; else S.pmeas.push(row); d.close(); render(); }, "Meting opgeslagen."); };
}
