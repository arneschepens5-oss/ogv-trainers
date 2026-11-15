/* FootballCoachHub — blessures en afwezigheden over een periode (databaseversie 48).
   Een afwezige speler staat niet standaard in de selectie, en een training waarop hij geblesseerd was telt niet mee als gemist. */
"use strict";
const ABS_K = [["blessure", "Blessure", "var(--bad)"], ["ziek", "Ziek", "var(--warn)"], ["afwezig", "Afwezig", "var(--info)"], ["andere", "Andere", "var(--muted)"]];
const absL = k => (ABS_K.find(x => x[0] === k) || ABS_K[3])[1];
const absList = pid => (S.abs || []).filter(a => a.player_id === pid).sort((a, b) => String(b.date_from).localeCompare(String(a.date_from)));
const absOf = (pid, d) => (S.abs || []).find(a => a.player_id === pid && a.date_from <= d && (!a.date_to || a.date_to >= d)) || null;
const absNow = pid => absOf(pid, todayIso());
const absTill = a => a.date_to ? "tot " + dShort(a.date_to) : "nog niet hersteld";
/* klein label voor lijsten */
const absTag = (pid, d = todayIso()) => { const a = absOf(pid, d); return a ? `<span class="abstag k-${a.kind}" title="${esc(a.note || "")}">${esc(absL(a.kind))} · ${esc(absTill(a))}</span>` : ""; };
function absPanel(p) {
  if (S.absOk === false) return `<div class="panel sec"><h2>Blessures en afwezigheden</h2><p class="hint" style="margin:0">Dit werkt zodra de beheerder <b>supabase-meldingen-v48.sql</b> uitvoert.</p></div>`;
  const xs = absList(p.id), now = absNow(p.id);
  return `<div class="panel sec absp" data-absp="${p.id}"><div class="row" style="margin-bottom:8px"><h2 style="margin:0;margin-right:auto">Blessures en afwezigheden</h2><button class="btn small noprint" type="button" data-absadd="${p.id}">${IC.plus}Toevoegen</button></div>
    ${now ? `<div class="absnow k-${now.kind}"><b>${esc(absL(now.kind))}${now.note ? ": " + esc(now.note) : ""}</b><small>Sinds ${esc(dShort(now.date_from))} · ${esc(absTill(now))}</small>${now.date_to ? "" : `<button class="btn small noprint" type="button" data-absok="${now.id}">Hersteld vandaag</button>`}</div>` : ""}
    ${xs.filter(a => a !== now).length ? `<div class="list">${xs.filter(a => a !== now).map(a => `<div class="item static"><span class="main"><b>${esc(absL(a.kind))}${a.note ? ": " + esc(a.note) : ""}</b><small>${esc(dShort(a.date_from))} ${a.date_from.slice(0, 4)}${a.date_to ? " – " + esc(dShort(a.date_to)) + " " + a.date_to.slice(0, 4) : ""}${a.by_name ? " · " + esc(a.by_name) : ""}</small></span><button class="btn ghost small noprint" type="button" data-absed="${a.id}">Bewerken</button></div>`).join("")}</div>`
      : now ? "" : `<p class="hint" style="margin:0">Geen blessures of afwezigheden. Een geblesseerde speler staat niet standaard in de selectie en een gemiste training telt dan niet mee.</p>`}
    ${now ? `<button class="link noprint" type="button" data-absed="${now.id}" style="margin-top:8px">Huidige bewerken</button>` : ""}</div>`;
}
function absBind(root) {
  $$("[data-absadd]", root).forEach(b => b.onclick = () => absForm(S.players.find(p => p.id === b.dataset.absadd)));
  $$("[data-absed]", root).forEach(b => b.onclick = () => { const a = S.abs.find(x => x.id === b.dataset.absed); absForm(S.players.find(p => p.id === a.player_id), a); });
  $$("[data-absok]", root).forEach(b => b.onclick = async () => { const a = { ...S.abs.find(x => x.id === b.dataset.absok), date_to: todayIso() }; if (a.date_to < a.date_from) a.date_to = a.date_from;
    await safe(async () => { await db.save("player_absence", a); S.abs = S.abs.map(x => x.id === a.id ? a : x); render(); }, "Hersteld."); });
}
function absForm(p, a) {
  if (!p) return; const n = !a;
  const d = dialog(`<form><h2>${n ? "Blessure of afwezigheid" : "Bewerken"} · ${esc(p.first_name)}</h2><div class="fields">
    <div class="f full"><span>Soort</span><div class="seg" id="absK">${ABS_K.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${(a?.kind || "blessure") === k}">${l}</button>`).join("")}</div></div>
    <label class="f">Vanaf<input name="from" type="date" required value="${esc(a?.date_from || todayIso())}"></label>
    <label class="f">Tot en met <span class="hint">leeg = nog niet hersteld</span><input name="to" type="date" value="${esc(a?.date_to || "")}"></label>
    <label class="f full">Wat is er? <span class="hint">kort, bv. "enkel verstuikt" of "op vakantie"</span><input name="note" maxlength="300" value="${esc(a?.note || "")}"></label></div>
    <p class="hint" style="margin:8px 0 0">Enkel voor de trainers van de ploeg. Noteer geen medische details die je niet nodig hebt.</p>
    <div class="row">${n ? "" : `<button class="btn danger" type="button" id="absDel">Verwijderen</button>`}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  let kind = a?.kind || "blessure";
  $$("#absK button", d).forEach(b => b.onclick = () => { kind = b.dataset.k; $$("#absK button", d).forEach(x => x.setAttribute("aria-pressed", x === b)); });
  if (!n) $("#absDel", d).onclick = async () => { if (!confirm("Verwijderen?")) return; await safe(async () => { await db.del("player_absence", { id: a.id }); S.abs = S.abs.filter(x => x.id !== a.id); d.close(); render(); }, "Verwijderd."); };
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    if (f.to && f.to < f.from) { toast("De einddatum ligt voor de begindatum."); return; }
    const row = { ...(a || { id: uid(), team_id: p.team_id, player_id: p.id }), kind, date_from: f.from, date_to: f.to || null, note: f.note.trim() || null, by_name: typeof myName === "function" ? myName() || null : null };
    await safe(async () => { await db.save("player_absence", row).catch(err => { throw /player_absence/.test(err.message || "") ? new Error("Voer eerst supabase-meldingen-v48.sql uit in Supabase.") : err; });
      S.abs = (S.abs || []).filter(x => x.id !== row.id).concat(row); d.close(); render(); }, "Opgeslagen."); };
}
