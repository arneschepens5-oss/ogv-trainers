/* FootballCoachHub — aanwezigheid van trainers en het overzicht voor de betalingen (vrijwilligersvergoeding).
   Trainers vinken bij een training of wedstrijd aan wie er was; wie zelf aanwezigheden van spelers invult, staat automatisch aanwezig.
   De penningmeester (recht "betalingen") ziet per trainer per maand de aantallen en het bedrag, zonder spelersgegevens. */
"use strict";
const taOf = (eid, k) => (S.tatt || []).find(x => x.event_id === eid && x.tkey === k);
const taName = r => typeof tName === "function" ? tName(r, typeof tpOf === "function" ? tpOf(tKey(r)) : null) : (r.email || "Trainer");
/* paneel onder de aanwezigheden van een activiteit */
function taPanel(host, e) {
  if (!host) return;
  if (S.tattOk === false) { host.innerHTML = S.admin ? `<p class="hint" style="margin-top:14px">Aanwezigheid van trainers bijhouden kan zodra <b>supabase-trainers-v46.sql</b> uitgevoerd is.</p>` : ""; return; }
  const trs = (S.trainers || []).filter(r => tKey(r)); if (!trs.length) { host.innerHTML = ""; return; }
  const done = trs.filter(r => taOf(e.id, tKey(r))).length;
  host.innerHTML = `<div class="panel sec tapanel"><div class="row" style="margin-bottom:8px"><h2 style="margin:0;margin-right:auto">Trainers</h2><span class="hint">${done === trs.length ? "ingevuld" : done ? `${done} van ${trs.length} ingevuld` : "nog niet ingevuld"}</span></div>
    <p class="hint" style="margin-top:0">Wie was er als trainer? Dit telt mee voor de vergoeding. Wie de aanwezigheden van de spelers invult, staat vanzelf op aanwezig.</p>
    <div class="tarow">${trs.map(r => { const a = taOf(e.id, tKey(r)), k = tKey(r);
      return `<div class="tachip" data-tk="${esc(k)}"><span class="tc-n">${esc(taName(r))}${r.user_id && r.user_id === user?.id ? ' <small>(jij)</small>' : ""}</span>
        <span class="seg sm"><button type="button" data-tp="1" aria-pressed="${a?.present === true}">Aanwezig</button><button type="button" data-tp="0" aria-pressed="${a?.present === false}">Niet</button></span></div>`; }).join("")}</div></div>`;
  $$("[data-tk]", host).forEach(row => $$("[data-tp]", row).forEach(b => b.onclick = async () => {
    const k = row.dataset.tk, val = b.dataset.tp === "1", cur0 = taOf(e.id, k);
    const rec = { event_id: e.id, team_id: e.team_id || S.team.id, tkey: k, present: val, by_name: typeof myName === "function" ? myName() || null : null };
    if (cur0 && cur0.present === val) { await safe(async () => { await db.del("trainer_att", { event_id: e.id, tkey: k }); S.tatt = S.tatt.filter(x => !(x.event_id === e.id && x.tkey === k)); }); }
    else await safe(async () => { await db.save("trainer_att", rec); S.tatt = S.tatt.filter(x => !(x.event_id === e.id && x.tkey === k)).concat(rec); });
    taPanel(host, e); }));
}
/* wie spelers afvinkt, was er zelf ook: eenmalig automatisch op aanwezig zetten */
async function taSelf(e) {
  if (S.tattOk === false || !user) return; const me = (S.trainers || []).find(r => r.user_id === user.id || (mode === "demo" && r.user_id === "demo")); if (!me) return;
  const k = tKey(me); if (taOf(e.id, k)) return;
  const rec = { event_id: e.id, team_id: e.team_id || S.team.id, tkey: k, present: true, by_name: typeof myName === "function" ? myName() || null : null };
  try { await db.save("trainer_att", rec); S.tatt = (S.tatt || []).concat(rec); const h = $("#tav"); if (h) taPanel(h, e); } catch (x) {}
}

/* ---------- Betalingen ---------- */
let PAY = { m: null, team: "" };
const payAmt = () => ({ training: +(CLUB.settings?.pay?.training) || 0, wedstrijd: +(CLUB.settings?.pay?.wedstrijd) || 0 });
const eur = n => (Math.round(n * 100) / 100).toLocaleString("nl-BE", { style: "currency", currency: "EUR" });
async function payData(d1, d2) {
  if (mode !== "demo") { const r = await sb.rpc("club_betalingen", { d1, d2 }); if (r.error) throw r.error; return r.data; }
  const [T, TT, E, A] = await Promise.all(["teams", "team_trainers", "events", "trainer_att"].map(k => db.list(k).catch(() => [])));
  return { teams: T, trainers: TT.map(r => ({ ...r, name: tName(r, tpOf(tKey(r))) })), events: E.filter(e => e.date >= d1 && e.date <= d2 && (e.type === "training" || e.type === "wedstrijd")).map(e => ({ ...e, cancelled: e.cancelled || e.rbfa_state === "afgelast", squad: e.report?.squad })), att: A };
}
route("betalingen", { title: "Betalingen", auth: true, render: async v => {
  if (!mag("betalingen")) { v.innerHTML = `<div class="empty"><b>Geen toegang</b>Het overzicht van de betalingen is voor wie het recht "Betalingen" kreeg van de beheerder.</div>`; return; }
  const now = new Date(); if (!PAY.m) PAY.m = iso(new Date(now.getFullYear(), now.getMonth() - (now.getDate() < 8 ? 1 : 0), 1)).slice(0, 7);
  const [y, mo] = PAY.m.split("-").map(Number), d1 = `${PAY.m}-01`, d2 = iso(new Date(y, mo, 0)), mname = cap(new Date(y, mo - 1, 1).toLocaleDateString("nl-BE", { month: "long", year: "numeric" }));
  v.innerHTML = head("Betalingen", "Laden…");
  let D; try { D = await payData(d1, d2 > todayIso() ? todayIso() : d2); } catch (e) { v.innerHTML = head("Betalingen", "") + `<div class="empty"><b>Laden mislukt</b>${/club_betalingen|function/i.test(e.message || "") ? "Voer eerst supabase-trainers-v46.sql uit in Supabase." : esc(e.message || e)}</div>`; return; }
  const amt = payAmt(), T = Object.fromEntries((D.teams || []).map(t => [t.id, t])), evs = (D.events || []).filter(e => !e.cancelled && (!PAY.team || e.team_id === PAY.team));
  const att = new Map((D.att || []).map(a => [a.event_id + "|" + a.tkey, a.present]));
  /* per trainer: per ploeg waar hij trainer is, alle activiteiten van die ploeg in de maand */
  const by = new Map();
  for (const r of D.trainers || []) { const k = r.user_id || r.email; if (!k || (PAY.team && r.team_id !== PAY.team)) continue;
    const o = by.get(k) || { k, name: r.name || tNice(r.email), email: r.email, teams: new Set(), tr: 0, ma: 0, trOpen: 0, maOpen: 0, trNo: 0, maNo: 0, rows: [] }; o.teams.add(r.team_id);
    for (const e of evs.filter(x => x.team_id === r.team_id)) { const p = att.get(e.id + "|" + k), kind = e.type === "training" ? "tr" : "ma";
      if (p === true) o[kind]++; else if (p === false) o[kind + "No"]++; else o[kind + "Open"]++; o.rows.push({ e, p }); }
    by.set(k, o); }
  const list = [...by.values()].map(o => ({ ...o, total: o.tr * amt.training + o.ma * amt.wedstrijd })).sort((a, b) => a.name.localeCompare(b.name, "nl"));
  const open = list.reduce((s, o) => s + o.trOpen + o.maOpen, 0), sum = list.reduce((s, o) => s + o.total, 0), months = [...Array(12)].map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return [iso(d).slice(0, 7), cap(d.toLocaleDateString("nl-BE", { month: "long", year: "numeric" }))]; });
  v.innerHTML = head("Betalingen", "Aanwezigheid van trainers per maand, voor de vrijwilligersvergoeding. Enkel trainingen en wedstrijden die niet afgelast werden.", `<button class="btn ghost" type="button" id="payx">${IC.out}Excel</button>`) +
    `<div class="cd-bar"><label class="flt"><span>Maand</span><select id="paym">${months.map(([k, l]) => `<option value="${k}"${k === PAY.m ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="flt"><span>Ploeg</span><select id="payt"><option value="">Alle ploegen</option>${(D.teams || []).slice().sort((a, b) => a.name.localeCompare(b.name, "nl", { numeric: true })).map(t => `<option value="${t.id}"${PAY.team === t.id ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
      ${S.admin ? `<span class="spacer"></span><span class="payamt">Per training <input id="pa1" type="number" min="0" step="0.5" value="${amt.training || ""}" placeholder="0"> · per wedstrijd <input id="pa2" type="number" min="0" step="0.5" value="${amt.wedstrijd || ""}" placeholder="0"> €</span>` : `<span class="hint">Per training ${eur(amt.training)} · per wedstrijd ${eur(amt.wedstrijd)}</span>`}</div>
    <div class="kpis sec">${[["Trainers", list.length, mname], ["Te betalen", eur(sum), amt.training || amt.wedstrijd ? "volgens de ingestelde bedragen" : "stel eerst de bedragen in"], ["Bevestigd", list.reduce((s, o) => s + o.tr + o.ma, 0), "keer aanwezig"], ["Nog niet ingevuld", open, open ? "trainer niet afgevinkt" : "alles ingevuld"]].map(([l, b, s], i) => `<div class="kpi"><small>${l}</small><b${i === 3 && open ? ' style="color:var(--warn)"' : ""}>${b}</b><span>${s}</span></div>`).join("")}</div>
    ${open ? `<p class="hint">Niet ingevuld telt niet mee. Vraag de trainers om bij de activiteit (tab Aanwezigheden) aan te duiden wie er was.</p>` : ""}
    ${list.length ? `<div class="panel sec" style="padding:4px 0"><div class="tblwrap"><table class="tbl paytbl"><thead><tr><th>Trainer</th><th>Ploeg</th><th>Trainingen</th><th>Wedstrijden</th><th>Niet ingevuld</th><th>Bedrag</th></tr></thead><tbody>
      ${list.map(o => `<tr data-pk="${esc(o.k)}" class="go"><td><b>${esc(o.name)}</b></td><td>${esc([...o.teams].map(id => T[id]?.name || "").join(", "))}</td><td>${o.tr}${o.trNo ? ` <small class="muted">(${o.trNo}× niet)</small>` : ""}</td><td>${o.ma}${o.maNo ? ` <small class="muted">(${o.maNo}× niet)</small>` : ""}</td>
        <td${o.trOpen + o.maOpen ? ' style="color:var(--warn);font-weight:700"' : ""}>${o.trOpen + o.maOpen || "–"}</td><td><b>${eur(o.total)}</b></td></tr>`).join("")}</tbody>
      <tfoot><tr><td>Totaal</td><td></td><td>${list.reduce((s, o) => s + o.tr, 0)}</td><td>${list.reduce((s, o) => s + o.ma, 0)}</td><td>${open || "–"}</td><td>${eur(sum)}</td></tr></tfoot></table></div></div>
      <p class="hint">Tik op een trainer voor de lijst van activiteiten. De vergoeding voor vrijwilligers heeft wettelijke maxima per dag en per jaar: controleer die zelf.</p>` : `<div class="empty"><b>Geen trainers gevonden</b>Koppel eerst trainers aan de ploegen.</div>`}`;
  $("#paym").onchange = e => { PAY.m = e.target.value; render(); };
  $("#payt").onchange = e => { PAY.team = e.target.value; render(); };
  const saveAmt = async () => { const pay = { training: +$("#pa1").value || 0, wedstrijd: +$("#pa2").value || 0 }, s = { ...(CLUB.settings || {}), pay };
    if (mode !== "demo") { const { error } = await sb.rpc("club_save_settings", { nm: CLUB.name, sh: CLUB.short, s }); if (error) { toast(error.message); return; } }
    CLUB.settings = s; toast("Bedragen bewaard."); setTimeout(render, 0); };
  if ($("#pa1")) { $("#pa1").onchange = saveAmt; $("#pa2").onchange = saveAmt; }
  $$("[data-pk]", v).forEach(tr => tr.onclick = () => { const o = list.find(x => x.k === tr.dataset.pk); if (!o) return;
    dialog(`<div class="payd"><h2>${esc(o.name)}</h2><p class="muted" style="margin-top:0">${mname} · ${o.tr} trainingen en ${o.ma} wedstrijden bevestigd · ${eur(o.total)}</p>
      <div class="list">${o.rows.sort((a, b) => (a.e.date + (a.e.start_time || "")).localeCompare(b.e.date + (b.e.start_time || ""))).map(({ e, p }) => `<div class="item static"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span>
        <span class="main"><b>${e.type === "training" ? "Training" : "Wedstrijd" + (e.opponent ? " – " + esc(e.opponent) : "")}${e.squad ? ` <span class="pill g">${esc(e.squad)}</span>` : ""}</b><small>${esc(T[e.team_id]?.name || "")}${e.start_time ? " · " + tm(e.start_time) : ""}</small></span>
        <span class="pill ${p === true ? "t" : p === false ? "loss" : "w"}">${p === true ? "aanwezig" : p === false ? "niet aanwezig" : "niet ingevuld"}</span></div>`).join("") || `<p class="hint">Geen activiteiten.</p>`}</div>
      <div class="row"><span class="spacer"></span><button class="btn" type="button" data-close>Sluiten</button></div></div>`); });
  $("#payx").onclick = () => download(`betalingen-${PAY.m}.csv`, "﻿" + [["Trainer", "E-mail", "Ploeg", "Trainingen", "Wedstrijden", "Niet ingevuld", "Bedrag (EUR)"].join(";"),
    ...list.map(o => [o.name, o.email || "", [...o.teams].map(id => T[id]?.name || "").join(", "), o.tr, o.ma, o.trOpen + o.maOpen, String(Math.round(o.total * 100) / 100).replace(".", ",")].map(csvCell).join(";"))].join("\n"));
} });
