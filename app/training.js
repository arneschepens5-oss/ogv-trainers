/* OGV Platform — trainingen maken: een tijdlijn per onderdeel met oefeningen (tekening, duur, organisatie, aandachtspunten),
   de trainingsbibliotheek (clubtrainingen, gedeelde oefenstof, PSD-databank) en afdrukken. De tekentool zit in teken.js. */
"use strict";

/* ============ trainingsfiche ============ */
const EX_PHASES = ["Opwarming", "Kern", "Wedstrijdvorm", "Afsluiting"];
/* soort oefening: één woordenlijst voor de trainingsfiche en de bibliotheek */
const EX_TYPES = ["Opwarming", "Tussenvorm", "Wedstrijdvorm", "Afwerkvorm", "Pasvorm", "Positiespel", "Duelvorm", "Techniekvorm", "Coördinatie", "Activatie met band", "Stretching", "Cooling down"];
const TYPE_COL = { Opwarming: "#38BDF8", Tussenvorm: "#FFD100", Wedstrijdvorm: "#22C55E", Afwerkvorm: "#FB7185", Pasvorm: "#F97316", Positiespel: "#14B8A6", Duelvorm: "#E879F9", Techniekvorm: "#A3E635", "Coördinatie": "#60A5FA", "Activatie met band": "#F43F5E", "Stretching": "#2DD4BF", "Cooling down": "#A78BFA" };
const TYPE_ALIAS = { partijvorm: "Wedstrijdvorm", spelvorm: "Wedstrijdvorm", afsluiting: "Cooling down", passingvorm: "Pasvorm", passvorm: "Pasvorm", rondo: "Positiespel", techniek: "Techniekvorm", afwerking: "Afwerkvorm", duel: "Duelvorm", coordinatie: "Coördinatie", activatie: "Activatie met band", "activatie band": "Activatie met band", weerstandsband: "Activatie met band", rekken: "Stretching", stretchen: "Stretching" };
const FORM2TYPE = { Duelvorm: "Duelvorm", Kleine: "Wedstrijdvorm", Grote: "Wedstrijdvorm", Rondo: "Positiespel", Passingvorm: "Pasvorm", Afwerkvorm: "Afwerkvorm", Opbouwpatroon: "Tussenvorm", Technische: "Techniekvorm", Circuit: "Coördinatie", Spelvorm: "Opwarming", Oefening: "Tussenvorm" };
function exType(x) {
  const p = (x.phase || "").trim().toLowerCase(), hit = EX_TYPES.find(t => t.toLowerCase() === p) || TYPE_ALIAS[p];
  if (hit) return hit;
  const n = [x.name, x.goal].filter(Boolean).join(" ").toLowerCase();
  if (/stretch|rekken|rekoefen/.test(n)) return "Stretching";
  if (/weerstandsband|elastiek|miniband|\bband\b|activatie met band/.test(n)) return "Activatie met band";
  return FORM2TYPE[exForm(x).split(" ")[0]] || "Tussenvorm";
}
const secOf = t => { if (t == null || t === "") return 0; const m = String(t).match(/^(\d+)(?::(\d{1,2}))?$/); return m ? (m[2] != null ? +m[1] * 60 + +m[2] : +m[1] * 60) : 0; };
const exMinutes = x => x.minutes ? +x.minutes : (x.reps && secOf(x.work) ? Math.round((x.reps * secOf(x.work) + (x.reps - 1) * (+x.rest || 0)) / 60) : 0);
function normPlan(pl) {
  if (pl && pl.v === 2) return pl;
  const out = { v: 2, theme: "", players: "", material: "", intensity: null, goal: pl?.goal || "", items: [] };
  (pl?.phases || []).forEach(ph => (ph.items || []).forEach(it => out.items.push({ id: it.id || uid(), phase: /opwarm/i.test(ph.name) ? "Opwarming" : /wedstrijd/i.test(ph.name) ? "Wedstrijdvorm" : /afsl/i.test(ph.name) ? "Afsluiting" : "Kern",
    name: it.title || "", minutes: it.minutes || null, reps: it.sets || null, org: it.note || "", lib: it.lib || null, cats: [] })));
  return out;
}
function exFromLib(L) { return { id: uid(), phase: L.map === "opwarming" ? "Opwarming" : L.map === "thema" ? "Kern" : (L.thema === "Wedstrijdvormen" ? "Wedstrijdvorm" : "Kern"), name: L.title, lib: L.id, img: "trainingen/" + L.img,
  minutes: L.map === "thema" ? 60 : 15, org: L.bedoeling, size: L.veld || "", cats: L.principe ? ["TEAMTACTICS > " + PRINC[L.principe]] : L.thema ? ["BASICS > " + L.thema] : [] }; }
const planMinutes = pl => (normPlan(pl).items || []).reduce((s, x) => s + exMinutes(x), 0);

route("trainingen", { title: "Trainingen maken", auth: true, team: true, render: async v => {
  /* Een training maken staat los van de kalender. Je kiest zelf of je ze op een training zet en of ze in de clubbibliotheek komt. */
  const t = todayIso(), hasPlan = e => normPlan(e.plan).items.length > 0;
  const up = S.events.filter(e => e.type === "training" && e.date >= t && hasPlan(e)), done = S.events.filter(e => e.type === "training" && e.date < t && hasPlan(e)).reverse().slice(0, 8);
  const mine = (await items.listAll("training").catch(() => [])).filter(x => items.mine(x) && x.data?.source !== "PSD");
  const it = e => { const pl = normPlan(e.plan);
    return `<div class="item" data-go="#/activiteit/${e.id}/plan"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span><span class="main"><b>${esc(pl.theme || e.theme || "Training")}</b><small>${dShort(e.date)}${e.start_time ? " · " + tm(e.start_time) : ""}</small></span>
    <span class="val"><b>${pl.items.length} oef.</b>${planMinutes(e.plan)} min</span></div>`; };
  const own = x => `<div class="item" data-go="#/sjabloon/${x.id}"><span class="num">${IC.plan}</span><span class="main"><b>${esc(x.title)}</b><small>${(normPlan(x.data).items || []).length} oefeningen · ${planMinutes(x.data)} min · ${x.shared ? `<span class="shdot" aria-hidden="true"></span>In de clubbibliotheek` : "Alleen voor jou"}</small></span><button class="btn ghost small" type="button" data-tpl="${x.id}">Op een training zetten</button></div>`;
  v.innerHTML = head("Trainingen maken", "Maak een oefening of een hele training. Daarna kies je zelf of je ze op een training in de kalender zet en of je ze deelt in de clubbibliotheek.", `<a class="btn ghost" href="#/bibliotheek">${IC.book}Trainingsbibliotheek</a>`) +
    `<div class="startpick"><button type="button" id="mk1"><span class="sp-ic">${toolIcon("cone")}</span><b>Eén oefening maken</b><small>Teken een oefening en bewaar ze. Je kan ze later in elke training gebruiken.</small></button>
      <button type="button" id="mkT"><span class="sp-ic">${IC.plan}</span><b>Een hele training maken</b><small>Zet oefeningen in de volgorde die jij kiest, met de tijd per oefening. Op een training zetten kan nadien.</small></button></div>` +
    `<div class="sec"><div class="row"><h2 style="margin:0">Mijn trainingen</h2><span class="spacer"></span><a class="link" href="#/sjablonen">Alle trainingen in de bibliotheek</a></div>
      ${mine.length ? `<div class="list" style="margin-top:10px">${mine.map(own).join("")}</div>` : `<div class="empty" style="margin-top:10px"><b>Nog geen eigen trainingen</b>Kies "Een hele training maken" om te beginnen.</div>`}</div>` +
    (up.length ? `<div class="sec"><h2>Op de kalender</h2><div class="list">${up.slice(0, 12).map(it).join("")}</div></div>` : "") +
    (done.length ? `<div class="sec"><h2>Vorige trainingen</h2><div class="list">${done.map(it).join("")}</div></div>` : "");
  $("#mk1").onclick = () => exEditor({ id: uid(), phase: "", name: "", cats: [], minutes: 15, diagram: { field: S.team?.format === "8v8" ? "8v8" : "5v5", objs: [] } }, async x => {
    const r = await safe(() => items.save({ kind: "oefening", title: x.name, data: exData(x) }), "Bewaard in je bibliotheek bij Van mij."); if (!r) return;
    if (S.events.some(e => e.type === "training" && e.date >= todayIso())) toTraining({ ...JSON.parse(JSON.stringify(x)), id: uid() }, "Ook op een training zetten?"); });
  $("#mkT").onclick = async () => { const r = await safe(() => items.save({ kind: "training", title: "Nieuwe training", data: { v: 2, theme: "", items: [], ages: S.team?.category ? [S.team.category.toUpperCase().replace(/^P/, "")] : [] } })); if (r) go("#/sjabloon/" + r.id); };
  $$("[data-go]", v).forEach(x => x.onclick = ev => { if (ev.target.closest("[data-tpl]")) return; go(x.dataset.go); });
  $$("[data-tpl]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); tplSchedule(mine.find(z => z.id === b.dataset.tpl)); });
} });

/* training zonder datum: zelfde plan-editor, bewaard als training in de bibliotheek */
route("sjabloon", { title: "Training zonder datum", auth: true, team: true, render: async (v, id) => {
  v.innerHTML = head("Training", "Laden…"); const row = (await items.listAll("training").catch(() => [])).find(x => x.id === id);
  if (!row) { v.innerHTML = `<div class="empty"><b>Training niet gevonden</b><a class="btn" href="#/trainingen">Naar trainingen maken</a></div>`; return; }
  if (!items.mine(row)) { go("#/bibliotheek"); setTimeout(() => tplView(row), 300); return; }
  const pseudo = { id: row.id, plan: normPlan(row.data), start_time: null, end_time: null, date: null };
  v.innerHTML = backLink("#/trainingen", "Trainingen maken") + head(esc(row.title), "Je training wordt vanzelf bewaard. Zet ze op een training in de kalender wanneer je wil.",
    `<span class="hint" id="saved"></span><button class="btn" type="button" id="tplan">${IC.cal}Op een training zetten</button><button class="btn ghost small" type="button" id="tdel">Verwijderen</button>`) +
    `<div class="panel row tshare${row.shared ? " hl" : ""}" style="margin:0 0 14px"><label class="check" style="flex:1;min-width:220px"><input type="checkbox" id="tsh"${row.shared ? " checked" : ""}>
      <span><b>In de trainingsbibliotheek van de club</b><br><span class="hint" id="tshh">${row.shared ? "Alle trainers van de club zien en gebruiken deze training." : "Staat uit: alleen jij ziet deze training."}</span></span></label></div><div id="tabv"></div>`;
  const save = debounce(async () => { row.data = { ...row.data, ...JSON.parse(JSON.stringify(pseudo.plan)) }; if (pseudo.plan.theme) { row.title = pseudo.plan.theme; const h1 = $("h1.pg"); if (h1) h1.textContent = row.title; }
    const ok = await safe(() => items.save(row)); const s2 = $("#saved"); if (ok && s2) { s2.textContent = "Opgeslagen"; setTimeout(() => s2 && (s2.textContent = ""), 1500); } }, 700);
  planEditor($("#tabv"), pseudo, { save, tpl: true });
  $("#tplan").onclick = () => { row.data = { ...row.data, ...JSON.parse(JSON.stringify(pseudo.plan)) }; tplSchedule(row); };
  $("#tsh").onchange = async ev => { const on = ev.target.checked; row.data = { ...row.data, ...JSON.parse(JSON.stringify(pseudo.plan)) };
    const ok = await safe(async () => { await items.share(row, on); return true; }, on ? "Gedeeld in de clubbibliotheek." : "Niet meer gedeeld, alleen jij ziet ze nog.");
    if (!ok) ev.target.checked = !on; $(".tshare", v)?.classList.toggle("hl", !!row.shared); const h = $("#tshh", v); if (h) h.textContent = row.shared ? "Alle trainers van de club zien en gebruiken deze training." : "Staat uit: alleen jij ziet deze training."; };
  $("#tdel").onclick = async () => { if (!confirm("Deze training verwijderen?")) return; await safe(() => items.del(row), "Verwijderd."); go("#/trainingen"); };
} });

/* ============ trainingsplan: één lijst in de volgorde die de trainer zelf kiest ============ */
const PHASE_COL = { Opwarming: "#38BDF8", Kern: "#FFD100", Wedstrijdvorm: "#22C55E", Afsluiting: "#A78BFA" };
const LABEL_SUG = EX_TYPES;
const LPAL = ["#38BDF8", "#FFD100", "#22C55E", "#A78BFA", "#FB7185", "#F97316", "#14B8A6", "#E879F9"];
const labelCol = l => !l ? "var(--line2)" : TYPE_COL[l] || PHASE_COL[l] || LPAL[[...l.toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % LPAL.length];
const hm = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = s => { const [h, m] = tm(s).split(":"); return +h * 60 + +m; };
async function planEditor(tv, e, opts = {}) {
  e.plan = normPlan(e.plan); const pl = e.plan, sv = opts.save || saver(e);
  const dur = e.start_time && e.end_time ? toMin(e.end_time) - toMin(e.start_time) : null, start = e.start_time ? toMin(e.start_time) : null;
  let dragId = null, details = false;
  const change = () => { sv(); draw(); };
  const newEx = () => ({ id: uid(), phase: "", name: "", cats: [], minutes: 15, diagram: { field: S.team?.format === "8v8" ? "8v8" : "5v5", objs: [] } });
  const row = (x, t0, k) => { const m = exMinutes(x), clock = start != null ? `${hm(start + t0)} – ${hm(start + t0 + m)}` : `${t0}′ – ${t0 + m}′`;
    const lab = `<span class="pl-lab">${esc(exType(x))}</span>`;
    if (x.pause) return `<article class="pl-row pause" draggable="true" data-id="${x.id}" style="--pc:var(--line2)"><span class="grip" aria-hidden="true">⋮⋮</span><span class="pl-pic ph">☕</span>
      <div class="pl-main"><span class="pl-clock">${clock}</span><b>${esc(x.name || "Drinkpauze")}</b></div>${durCtl(x, m)}<div class="pl-acts">${moveBtns(x)}<button class="ib" type="button" data-act="del" data-id="${x.id}" aria-label="Verwijderen">${IC.trash}</button></div></article>`;
    const facts = [x.players ? x.players + " spelers" : "", x.size, x.reps ? `${x.reps} × ${x.work || "?"}${x.rest ? " · " + x.rest + " s rust" : ""}` : ""].filter(Boolean).join(" · ");
    return `<article class="pl-row" draggable="true" data-id="${x.id}" style="--pc:${labelCol(exType(x))}"><span class="grip" title="Sleep om te verplaatsen" aria-hidden="true">⋮⋮</span>
      <button class="pl-pic" type="button" data-act="edit" data-id="${x.id}" aria-label="Oefening openen">${exPic(x)}</button>
      <div class="pl-main" data-act="edit" data-id="${x.id}"><span class="pl-clock"><span class="pl-no">${k + 1}</span>${clock}${lab}</span><b>${esc(x.name || "Naamloze oefening")}</b>${facts ? `<small>${esc(facts)}</small>` : ""}${x.org ? `<p class="clamp2">${esc(x.org)}</p>` : `<p class="hint" style="margin:0">Nog geen uitleg. Tik om aan te vullen.</p>`}</div>
      ${durCtl(x, m)}<div class="pl-acts">${moveBtns(x)}<button class="ib" type="button" data-act="dup" data-id="${x.id}" title="Kopie" aria-label="Kopie">${IC.copy}</button>
      <button class="ib" type="button" data-act="mine" data-id="${x.id}" title="Bewaren in de bibliotheek" aria-label="Bewaren in de bibliotheek">${IC.book}</button><button class="ib" type="button" data-act="del" data-id="${x.id}" title="Verwijderen" aria-label="Verwijderen">${IC.trash}</button></div></article>`; };
  const durCtl = (x, m) => `<div class="pl-dur"><button type="button" data-act="minus" data-id="${x.id}" aria-label="Korter">−</button><span><b>${m || "–"}</b><small>min</small></span><button type="button" data-act="plus" data-id="${x.id}" aria-label="Langer">+</button></div>`;
  const moveBtns = x => `<button class="ib" type="button" data-act="up" data-id="${x.id}" title="Omhoog" aria-label="Omhoog">↑</button><button class="ib" type="button" data-act="down" data-id="${x.id}" title="Omlaag" aria-label="Omlaag">↓</button>`;
  const draw = () => {
    const total = planMinutes(pl), over = dur ? total - dur : 0, n = pl.items.filter(x => !x.pause).length, labs = [...new Set(pl.items.filter(x => !x.pause).map(exType))];
    const segs = pl.items.map(x => { const m = exMinutes(x); return m ? `<span style="flex:${m};background:${x.pause ? "var(--line2)" : labelCol(exType(x))}" title="${esc((x.name || "Oefening") + " · " + m + " min")}"></span>` : ""; }).join("");
    let acc = 0;
    tv.innerHTML = `<div class="pl-top noprint">
      <input class="pl-theme" data-p="theme" value="${esc(pl.theme || e.theme || "")}" list="themes2" placeholder="Thema van de training, bv. Opbouw van achteruit" aria-label="Thema"><datalist id="themes2">${THEMES.map(x => `<option value="${esc(x)}">`).join("")}</datalist>
      <div class="pl-sum"><div class="pl-bar" role="img" aria-label="${total} minuten gepland">${segs}${dur && total < dur ? `<span class="free" style="flex:${dur - total}"></span>` : ""}${!segs && !dur ? `<span class="free" style="flex:1"></span>` : ""}</div>
        <p><b>${total} min</b>${dur ? ` van ${dur} min` : ""} · ${n} ${n === 1 ? "oefening" : "oefeningen"}${dur ? over > 0 ? ` · <span class="pill loss">${over} min te veel</span>` : total ? ` · nog ${dur - total} min vrij` : "" : ""}
        ${labs.length ? `<span class="pl-legend">${labs.map(l => `<i style="--pc:${labelCol(l)}"></i>${esc(l)}`).join("")}</span>` : ""}</p></div>
      <button class="link" type="button" id="pl-det" aria-expanded="${details}">${details ? "Details verbergen" : "Doel, spelers, materiaal en intensiteit"}</button>
      ${details ? `<div class="fields pl-fields"><label class="f full">Doel van de training<input data-p="goal" value="${esc(pl.goal || "")}" placeholder="Wat moeten de spelers na deze training beter kunnen?"></label>
        <label class="f">Aantal spelers<input data-p="players" value="${esc(pl.players || "")}" placeholder="bv. 8-10 + 1K"></label>
        <label class="f">Intensiteit<select data-p="intensity" data-num>${["", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => `<option value="${k}"${String(pl.intensity ?? "") === String(k) ? " selected" : ""}>${k ? k + " – " + INTENS[k] : "–"}</option>`).join("")}</select></label>
        <label class="f full">Materiaal<input data-p="material" value="${esc(pl.material || "")}" placeholder="bv. 2 grote doelen, potjes, kegels, ballen, hesjes"></label></div>` : ""}</div>
    <div class="row noprint pl-tools"><button class="btn ghost small" type="button" id="prt">${IC.print}Afdrukken</button>${opts.tpl ? "" : `<button class="btn ghost small" type="button" id="tplSave">${IC.copy}Bewaren in de bibliotheek</button>`}
      <button class="btn ghost small" type="button" id="cpy">${IC.rotate}Overnemen van andere training</button>${pl.items.length ? `<span class="spacer"></span><button class="link" type="button" id="clr">Plan leegmaken</button>` : ""}</div>
    <div class="pl-list" data-drop="1">${pl.items.map((x, k) => { const r = row(x, acc, k); acc += exMinutes(x); return r; }).join("") ||
      `<div class="pl-empty"><b>Bouw je training zoals jij wil</b>Voeg oefeningen toe in de volgorde die jij kiest. Je bepaalt zelf hoeveel en welke. Per oefening kies je de soort: opwarming, tussenvorm, wedstrijdvorm, afwerkvorm, pasvorm…</div>`}</div>
    <div class="pl-add noprint"><button class="btn" type="button" id="addNew">${IC.plus}Nieuwe oefening</button><button class="btn ghost" type="button" id="addLib">${IC.book}Uit de bibliotheek</button><button class="btn ghost" type="button" id="addPause">☕ Pauze</button></div>`;
    bind();
  };
  const find = id => pl.items.find(x => x.id === id);
  const bind = () => {
    $$("[data-p]", tv).forEach(x => x.oninput = x.onchange = () => { pl[x.dataset.p] = x.hasAttribute("data-num") ? (x.value === "" ? null : +x.value) : x.value; sv(); });
    $("#pl-det", tv).onclick = () => { details = !details; draw(); };
    $("#prt", tv).onclick = () => printPlan(e);
    const ts = $("#tplSave", tv); if (ts) ts.onclick = async () => { if (!pl.items.length) { toast("Voeg eerst oefeningen toe."); return; } const name = prompt("Naam van deze training in de bibliotheek:", pl.theme || e.theme || "Training"); if (!name) return;
      await safe(() => items.save({ kind: "training", title: name, data: { ...JSON.parse(JSON.stringify(pl)), ages: S.team?.category ? [S.team.category.toUpperCase().replace(/^P/, "")] : [] } }), "Bewaard bij Volledige trainingen in de bibliotheek."); };
    $("#cpy", tv).onclick = () => copyFrom();
    const clr = $("#clr", tv); if (clr) clr.onclick = () => { if (!confirm("Alle oefeningen uit dit plan halen?")) return; pl.items = []; change(); };
    $("#addNew", tv).onclick = () => exEditor(newEx(), x => { pl.items.push(x); change(); });
    $("#addLib", tv).onclick = () => libPick(x => { pl.items.push(x); change(); });
    $("#addPause", tv).onclick = () => { pl.items.push({ id: uid(), phase: "", name: "Drinkpauze", minutes: 3, pause: true, cats: [] }); change(); };
    $$("[data-act]", tv).forEach(b => b.onclick = ev => { ev.stopPropagation(); const x = find(b.dataset.id); if (!x) return; const arr = pl.items, k = arr.indexOf(x), act = b.dataset.act;
      if (act === "edit" && !x.pause) exEditor(JSON.parse(JSON.stringify(x)), y => { arr[arr.indexOf(x)] = y; change(); });
      if (act === "minus" || act === "plus") { const m = exMinutes(x), step = act === "minus" ? (m <= 5 ? 1 : 5) : (m < 5 ? 1 : 5); x.minutes = Math.max(1, m + (act === "plus" ? step : -step)); change(); }
      if (act === "up" && k > 0) { [arr[k - 1], arr[k]] = [arr[k], arr[k - 1]]; change(); }
      if (act === "down" && k < arr.length - 1) { [arr[k + 1], arr[k]] = [arr[k], arr[k + 1]]; change(); }
      if (act === "dup") { arr.splice(k + 1, 0, { ...JSON.parse(JSON.stringify(x)), id: uid() }); change(); }
      if (act === "del" && confirm(`"${x.name || "Oefening"}" uit deze training halen?`)) { arr.splice(k, 1); change(); }
      if (act === "mine") safe(() => items.save({ kind: "oefening", title: x.name || "Oefening", data: exData(x) }), "Bewaard bij je oefeningen in de bibliotheek."); });
    /* slepen met de muis */
    $$(".pl-row", tv).forEach(r => { r.ondragstart = ev => { dragId = r.dataset.id; r.classList.add("dragging"); ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", dragId); };
      r.ondragend = () => { dragId = null; r.classList.remove("dragging"); $$(".drop-before,.drop-after", tv).forEach(z => z.classList.remove("drop-before", "drop-after")); }; });
    const list = $("[data-drop]", tv);
    list.ondragover = ev => { if (!dragId) return; ev.preventDefault(); $$(".drop-before,.drop-after", tv).forEach(z => z.classList.remove("drop-before", "drop-after"));
      const r = ev.target.closest(".pl-row"); if (r && r.dataset.id !== dragId) { const b = r.getBoundingClientRect(); r.classList.add(ev.clientY < b.top + b.height / 2 ? "drop-before" : "drop-after"); } };
    list.ondrop = ev => { ev.preventDefault(); if (!dragId) return; const x = find(dragId), r = ev.target.closest(".pl-row"), arr = pl.items;
      if (r && r.dataset.id !== x.id) { arr.splice(arr.indexOf(x), 1); const tgt = find(r.dataset.id), b = r.getBoundingClientRect(); let j = arr.indexOf(tgt); if (ev.clientY >= b.top + b.height / 2) j++; arr.splice(j, 0, x); }
      dragId = null; change(); };
  };
  const copyFrom = () => { const others = S.events.filter(z => z.type === "training" && z.id !== e.id && normPlan(z.plan).items.length).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
    if (!others.length) { toast("Er zijn nog geen andere trainingen met een plan."); return; }
    const d = dialog(`<div class="dlg"><h2>Overnemen van een andere training</h2><p class="muted" style="margin:0">De oefeningen komen onderaan dit plan. Wat je niet nodig hebt, haal je er daarna weer uit.</p>
      <div class="list">${others.map(z => { const p2 = normPlan(z.plan); return `<div class="item" data-o="${z.id}"><span class="date"><b>${dDay(z.date)}</b><small>${dMon(z.date)}</small></span><span class="main"><b>${esc(p2.theme || z.theme || "Training")}</b><small>${p2.items.length} oefeningen · ${planMinutes(p2)} min</small></span>${IC.plus}</div>`; }).join("")}</div>
      <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button></div></div>`);
    $$("[data-o]", d).forEach(y => y.onclick = () => { const z = S.events.find(q => q.id === y.dataset.o), p2 = normPlan(z.plan);
      p2.items.forEach(i => pl.items.push({ ...JSON.parse(JSON.stringify(i)), id: uid() })); ["theme", "goal", "players", "material", "intensity"].forEach(k => { if (!pl[k] && p2[k]) pl[k] = p2[k]; });
      d.close(); change(); toast(`${p2.items.length} oefeningen overgenomen.`); }); };
  draw();
}
const INTENS = { 1: "Heel licht", 2: "Licht", 3: "Matig", 4: "Redelijk zwaar", 5: "Zwaar", 6: "Zwaar+", 7: "Heel zwaar", 8: "Heel zwaar+", 9: "Bijna maximaal", 10: "Maximaal" };
const exData = x => { const d = JSON.parse(JSON.stringify(x)); delete d.id; return d; };

/* ============ oefening maken of bewerken: schermvullend, tekening centraal ============ */
function exEditor(x, onSave, saveLabel) {
  x.cats = x.cats || []; const hasImg = () => x.img || x.img_path; if (!x.diagram && !hasImg()) x.diagram = { field: S.team?.format === "8v8" ? "8v8" : "5v5", objs: [] };
  const catOpts = LEERPLAN.flatMap(([a, b, list]) => list.map(l => `${a} > ${b}${l !== b ? " > " + l : ""}`));
  let dirty = false; const curMin = exMinutes(x);
  const d = dialog(`<form class="exed exf" novalidate>
    <header class="exbar"><button class="ib exx" type="button" id="exx" aria-label="Sluiten">${IC.x}</button><input name="name" class="exname" required value="${esc(x.name || "")}" placeholder="Naam van de oefening" aria-label="Naam van de oefening">
      <div class="exviews" role="tablist"><button type="button" role="tab" data-view="draw" aria-selected="true">Tekening</button><button type="button" role="tab" data-view="info" aria-selected="false">Uitleg en duur</button></div>
      <span class="hint" id="durH"></span><button class="btn ghost" type="button" id="exc">Annuleren</button><button class="btn" type="submit">${saveLabel || "Bewaren"}</button></header>
    <div class="exbody" data-v="draw"><div class="exdiag"><div id="dgHost"></div>
        <p class="hint exalt">${hasImg() ? `Je gebruikt een afbeelding. <button class="link" type="button" id="toDraw">Liever zelf tekenen</button>` : `Liever een foto of afbeelding? <label class="link" style="cursor:pointer">Afbeelding kiezen<input type="file" accept="image/*" id="imgIn" hidden></label>`}</p></div>
      <aside class="exform">
        <div class="f full"><span>Duur</span><div class="exdur">${[5, 10, 15, 20, 25, 30].map(n => `<button type="button" class="chip" data-min="${n}" aria-pressed="${curMin === n}">${n}′</button>`).join("")}<label class="exmin"><input name="minutes" type="number" min="0" inputmode="numeric" value="${x.minutes ?? ""}" placeholder="${curMin || "min"}" aria-label="Duur in minuten"> min</label></div></div>
        <div class="f full"><span>Soort oefening</span><input type="hidden" name="phase" value="${esc(exType(x))}">
          <span class="chips exlabs" role="radiogroup">${EX_TYPES.map(l => `<button type="button" class="tag" role="radio" data-lab="${l}" aria-checked="${exType(x) === l}" style="--pc:${labelCol(l)}">${l}</button>`).join("")}</span></div>
        <div class="fields"><label class="f">Aantal spelers<input name="players" value="${esc(x.players || "")}" placeholder="bv. 8-12"></label>
          <label class="f">Afmetingen<input name="size" value="${esc(x.size || "")}" placeholder="bv. 30 × 20 m"></label></div>
        <label class="f full">Organisatie en verloop<textarea name="org" rows="6" placeholder="Hoe zet je de oefening op en hoe verloopt ze? Welke varianten zijn er?">${esc(x.org || "")}</textarea></label>
        <label class="f full">Aandachtspunten<textarea name="criteria" rows="4" placeholder="Eén aandachtspunt per regel, bv.&#10;Open lichaamshouding&#10;Pass in de juiste voet">${esc(x.criteria || "")}</textarea></label>
        <details class="exmore"${x.goal || x.reps || x.intensity || x.material || x.cats.length || (x.ages || []).length ? " open" : ""}><summary>Meer details <span class="hint">doel, intensiteit, herhalingen, materiaal, categorie, leeftijd</span></summary>
          <div class="fields"><label class="f full">Doel van de oefening<input name="goal" value="${esc(x.goal || "")}" placeholder="Wat leren de spelers hier?"></label>
            <label class="f">Intensiteit<select name="intensity"><option value="">–</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}"${+x.intensity === n ? " selected" : ""}>${n} – ${INTENS[n]}</option>`).join("")}</select></label>
            <label class="f">Materiaal<input name="material" value="${esc(x.material || "")}" placeholder="kegels, 2 minidoelen, ballen"></label>
            <label class="f">Herhalingen<input name="reps" type="number" min="0" value="${x.reps ?? ""}"></label>
            <label class="f">Duur per herhaling<input name="work" value="${esc(x.work || "")}" placeholder="mm:ss, bv. 03:00"></label>
            <label class="f">Rust (seconden)<input name="rest" type="number" min="0" value="${x.rest ?? ""}"></label>
            <label class="f">Leeftijd<input name="ages" value="${esc((x.ages || []).join(", "))}" placeholder="bv. U8, U9"></label>
            <div class="f full"><span>Categorie (leerplan Voetbal Vlaanderen)</span><div class="chips" id="cats"></div>
              <input list="catlist" id="catin" placeholder="Zoek en kies, bv. Passing of Openen: breed"><datalist id="catlist">${catOpts.map(c => `<option value="${esc(c)}">`).join("")}</datalist></div>
            ${x.source === "PSD" ? `<p class="hint full" style="margin:0">Overgenomen uit de PSD-oefendatabank${x.author ? " · gemaakt door " + esc(x.author) : ""}.</p>` : ""}</div></details>
      </aside></div></form>`, "exfull");
  const f = $("form", d); let stopDg = null;
  const mark = () => { dirty = true; };
  const startDg = () => { x.diagram = x.diagram || { field: S.team?.format === "8v8" ? "8v8" : "5v5", objs: [] }; stopDg = diagramEditor($("#dgHost", d), x.diagram, mark, { full: true, name: x.name }); };
  const showImg = () => { $("#dgHost", d).innerHTML = `<div class="eximg">${exPic(x, "")}</div>`; };
  if (hasImg() && !(x.diagram?.objs?.length)) showImg(); else startDg();
  const td = $("#toDraw", d); if (td) td.onclick = () => { x.img = null; x.img_path = null; mark(); td.parentElement.remove(); startDg(); };
  const ii = $("#imgIn", d); if (ii) ii.onchange = () => { const file = ii.files[0]; if (!file) return; if (file.size > 4e6) { toast("Kies een afbeelding kleiner dan 4 MB."); return; }
    const rd = new FileReader(); rd.onload = () => { x.img = rd.result; x.img_path = null; x.diagram = null; if (stopDg) stopDg(); mark(); showImg(); }; rd.readAsDataURL(file); };
  $$("[data-view]", d).forEach(b => b.onclick = () => { $(".exbody", d).dataset.v = b.dataset.view; $$("[data-view]", d).forEach(z => z.setAttribute("aria-selected", z === b)); });
  $$("[data-lab]", d).forEach(b => b.onclick = () => { f.phase.value = b.dataset.lab; $$("[data-lab]", d).forEach(z => z.setAttribute("aria-checked", z === b)); mark(); });
  const dh = () => { const tmp = { reps: +f.reps.value || null, work: f.work.value, rest: +f.rest.value || 0, minutes: +f.minutes.value || null }, m = exMinutes(tmp);
    $("#durH", d).textContent = m ? `${m} min` : ""; $$("[data-min]", d).forEach(b => b.setAttribute("aria-pressed", +b.dataset.min === m && !!f.minutes.value)); };
  $$("[data-min]", d).forEach(b => b.onclick = () => { f.minutes.value = b.dataset.min; mark(); dh(); });
  ["reps", "work", "rest", "minutes"].forEach(k => f[k].addEventListener("input", dh)); dh();
  f.addEventListener("input", mark);
  const drawCats = () => { $("#cats", d).innerHTML = x.cats.map(c => `<button type="button" class="tag" aria-pressed="true" data-cat="${esc(c)}">${esc(c)} ✕</button>`).join(""); $$("[data-cat]", d).forEach(b => b.onclick = () => { x.cats = x.cats.filter(c => c !== b.dataset.cat); mark(); drawCats(); }); };
  const addCat = el => { const val = el.value.trim(); if (val && !x.cats.includes(val)) { x.cats.push(val); mark(); drawCats(); } el.value = ""; };
  drawCats(); $("#catin", d).onchange = ev => addCat(ev.target); $("#catin", d).onkeydown = ev => { if (ev.key === "Enter") { ev.preventDefault(); addCat(ev.target); } };
  const leave = () => !dirty || confirm("Je wijzigingen aan deze oefening niet bewaren?");
  $("#exc", d).onclick = $("#exx", d).onclick = () => { if (leave()) d.close(); };
  d.addEventListener("cancel", ev => { if (!leave()) ev.preventDefault(); });
  d.addEventListener("close", () => stopDg && stopDg(), { once: true });
  f.onsubmit = ev => { ev.preventDefault(); const fd = Object.fromEntries(new FormData(f));
    if (!fd.name.trim()) { f.name.focus(); toast("Geef de oefening eerst een naam (bovenaan)."); return; }
    Object.assign(x, { name: fd.name.trim(), phase: fd.phase.trim(), intensity: fd.intensity ? +fd.intensity : null, work: fd.work.trim(), rest: fd.rest === "" ? null : +fd.rest, reps: fd.reps === "" ? null : +fd.reps, minutes: fd.minutes === "" ? null : +fd.minutes,
      org: fd.org.trim(), criteria: fd.criteria.trim(), material: fd.material.trim(), size: fd.size.trim(), players: fd.players.trim(), goal: fd.goal.trim(),
      ages: fd.ages.split(/[,;\s]+/).map(a => a.trim().toUpperCase()).filter(Boolean).map(a => /^\d+$/.test(a) ? "U" + a : a === "SENIORS" ? "Seniors" : a) });
    dirty = false; d.close(); onSave(x); };
  if (!x.name) setTimeout(() => f.name.focus(), 60);
}

/* ============ indeling van oefenstof: thema, vorm en leeftijd ============ */
const exPic = (x, ph) => x.diagram && dgFrames(x.diagram)[0].length ? diagramSVG(x.diagram) : x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : x.img_path ? `<img data-fp="${esc(x.img_path)}" alt="" loading="lazy">` : x.diagram ? diagramSVG(x.diagram) : (ph ?? `<span class="ph0">${IC.field}</span>`);
/* thema's sluiten aan bij de basisprincipes van de club (1A opbouw, 1B/2A verdedigen, 2B doelkansen, 3 omschakeling) */
const EX_THEMES = [
  ["Balgevoel en techniek", /^basics$/, /jongle|techniek|tecnhiek|balgevoel|voetenwerk|kap- en draai|kappen en draai|hoekje trappen|kopspel|senseball|balvaardig/],
  ["Dribbelen en 1v1", /leiden en dribbelen|individuele actie|met bal: leiden/, /dribbel|\bleiden\b|kapbeweg|schijnbeweg|\b1\s*(v|tegen|vs)\s*1\b|passeer/],
  ["Passen en aannemen", /passing|balcontrole|balaanname/, /\bpass|passing|aanname|balcontrole|\bkaats|trap(techniek|vorm)/],
  ["Afwerken", /doelpoging|afwerken/, /afwerk|\bschiet|\bschot|scoren|doelpoging|finish|kopbal/],
  ["Vrijlopen en aanspeelbaar zijn", /vrijlopen|aanspeelbaar|ruimte creëren/, /vrijlop|aanspeelbaar|driehoek|vrij (lopen|staan)|steunen|ingedraaid|scann/],
  ["Opbouw en balcirculatie", /het spel openen|balcirculatie/, /opbouw|openen|balcirculatie|rondo|ronde|positiespel|balbezit|possession|uitbouw|uitvoetbal|lijnen breken|derde man/],
  ["Doelkansen creëren", /infiltratie|doelkans creëren|voorzet|bezetting voor doel/, /doelkans|infiltr|voorzet|give.?(&|and|en).?go|overtal|\b[23]\s*(v|tegen|vs)\s*[12]\b|aanval/],
  ["Verdedigen en druk zetten", /balverlies > (?!pressing > onmiddellijk|bal recupereren door interceptie > onmiddellijk)|balverlies$/, /verdedig|druk zetten|pressing|drukzet|afblok|dekking|verstoren|storen|remmen|duel/],
  ["Omschakelen", /onmiddellijk druk na balverlies|balrecuperatie|onmiddellijk na balverlies/, /omschakel|counter|transitie|balrecup|na balverlies|omschakeling/],
  ["Coördinatie en fysiek", /^fysiek/, /coördinatie|coordinatie|loopschol|snelheid|sprint|kracht|ladder|lenig|reactie|wendbaar|uithouding/],
  ["Blessurepreventie", /blessure/, /preventie|rompstab|\bcore\b|11\+|stabilisatie|cool(ing)?[ -]?down|stretch/],
  ["Mentaal en spel", /^mentaal/, /tikker|estafette|stoelendans|kat en muis|spelletje|plezier|teambuilding|rivier|astronaut|alien|piraat|haai|multisport|basket|klappen|tegengestelde/],
  ["Keepers", /^keepers/, /keeper|doelman|doelverdedig/],
  ["Liniegerichte training", /^$/, /\blin+ie/],
  ["Vrij spel en wedstrijdvormen", /^$/, /\bwv\d?\b|wedstrijd|\bmatch\b|\d\s*(v|vs|tegen|\/)\s*\d/]];
function exThemes(x) {
  if (x._th) return x._th;
  const cats = (x.cats || []).map(c => c.toLowerCase()), txt = [x.name, x.goal].filter(Boolean).join(" ").toLowerCase(), out = [];
  EX_THEMES.forEach(([n, rc]) => { if (cats.some(c => rc.test(c))) out.push(n); });
  const VS = EX_THEMES[EX_THEMES.length - 1];
  if (!out.length) EX_THEMES.forEach(([n, , rt]) => { if (n !== VS[0] && rt.test(txt)) out.push(n); });
  if (!out.length && VS[2].test(txt)) out.push(VS[0]);
  if (!out.length && cats.some(c => /teamtactics/.test(c))) out.push("Opbouw en balcirculatie");
  if (!out.length && x.phase === "Opwarming") out.push("Coördinatie en fysiek");
  if (!out.length && x.phase === "Wedstrijdvorm") out.push("Vrij spel en wedstrijdvormen");
  Object.defineProperty(x, "_th", { value: out.length ? out : ["Overige"], enumerable: false }); return x._th;
}
const EX_FORMS = ["Duelvorm (1v1 tot 2v2)", "Kleine partijvorm (3v3 tot 5v5)", "Grote partijvorm (6v6 en meer)", "Rondo en positiespel", "Passingvorm", "Afwerkvorm", "Opbouwpatroon", "Technische activatie", "Circuit en loopscholing", "Spelvorm", "Oefening"];
function exForm(x) {
  const F = n => EX_FORMS.find(f => f.startsWith(n)), txt = [x.name, x.org].filter(Boolean).join(" ").toLowerCase(), n = (x.name || "").toLowerCase();
  const nn = n.replace(/\b(g?k)\s*\+\s*/g, "").replace(/\s*\+\s*g?k\b/g, ""), m = nn.match(/(\d+)\s*(?:v|vs\.?|tegen|\/|x)\s*(\d+)/);
  if (/rondo|ronde|positiespel|possession/.test(n)) return F("Rondo");
  if (m) { const tot = +m[1] + +m[2]; return tot <= 4 ? F("Duel") : tot <= 10 ? F("Kleine") : F("Grote"); }
  if (/partij|wedstrijd|\bwv\d?\b|\bmatch\b/.test(n) || x.phase === "Wedstrijdvorm") return F("Kleine");
  if (/afwerk|schot|scoren|shoot/.test(n)) return F("Afwerk");
  if (/patroon|patronen|uitvoetbal|opbouw/.test(n)) return F("Opbouw");
  if (/pass|pas(\b|activ|vorm| en| open)|ruit|driehoek|vierkant|kaats|y-vorm|give|stervorm|kruis/.test(n)) return F("Passing");
  if (/activatie|techniek|tecnhiek|jongle|voetenwerk|kap|draai|hoekje|kopspel|senseball/.test(n)) return F("Technische");
  if (/circuit|parcours|loopschol|ladder|coördinatie|coordinatie|horde|preventie/.test(txt)) return F("Circuit");
  if (/tikker|estafette|spel\b|spelletje|kat en muis|stoelendans|rivier|astronaut|alien|klappen|tegengestelde|blinde|multisport/.test(n)) return F("Spelvorm");
  if (/duel|1\s*v\s*1|1\/1/.test(txt)) return F("Duel");
  return F("Oefening");
}
const EX_BANDS = [["onder", "U6 – U9 (2v2 en 5v5)", 6, 9], ["mid", "U10 – U13 (8v8)", 10, 13], ["boven", "U14 en ouder (11v11)", 14, 99]];
const ageNum = a => /senior/i.test(a) ? 99 : +String(a).replace(/\D/g, "") || 0;
const exBands = x => EX_BANDS.filter(([, , lo, hi]) => (x.ages || []).some(a => { const n = ageNum(a); return n >= lo && n <= hi; })).map(b => b[0]);
const agesTxt = ages => { const ns = (ages || []).map(ageNum).filter(Boolean).sort((a, b) => a - b); if (!ns.length) return ""; const f = n => n === 99 ? "Seniors" : "U" + n; return ns.length === 1 ? f(ns[0]) : f(ns[0]) + "–" + f(ns[ns.length - 1]); };
const exMeta = x => [agesTxt(x.ages), exMinutes(x) ? exMinutes(x) + " min" : "", x.players ? x.players + " sp." : ""].filter(Boolean).join(" · ");
const FILTER_KEY = "ogv-exfilter";
function exFilterState() { try { return { q: "", ...JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"), q: "" }; } catch (e) { return { q: "" }; } }
function exFilter(list, f) {
  const t = (f.q || "").toLowerCase().trim();
  return list.filter(m => { const x = m.data || m;
    if (f.phase && x.phase !== f.phase) return false;
    if (f.band && !exBands(x).includes(f.band)) return false;
    if (f.theme && !exThemes(x).includes(f.theme)) return false;
    if (f.form && exForm(x) !== f.form) return false;
    if (f.src === "psd" && x.source !== "PSD") return false; if (f.src === "eigen" && !(items.mine(m) && !m.shared)) return false; if (f.src === "club" && !m.shared) return false;
    if (f.author && (x.author || x.shared_by) !== f.author) return false;
    return !t || [m.title, x.name, (x.cats || []).join(" "), x.org, x.goal, x.criteria, x.author, x.shared_by].filter(Boolean).join(" ").toLowerCase().includes(t); });
}
function exFilterBar(host, list, f, onChange, compact) {
  const authors = [...new Set(list.map(m => (m.data || m).author || (m.data || m).shared_by).filter(Boolean))].sort((a, b) => a.localeCompare(b, "nl"));
  const cnt = (k, val) => list.filter(m => { const x = m.data || m; return k === "theme" ? exThemes(x).includes(val) : k === "form" ? exForm(x) === val : exBands(x).includes(val); }).length;
  const sel = (k, label, opts) => `<label class="flt"><span>${label}</span><select data-f="${k}"><option value="">Alle</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${f[k] === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  host.innerHTML = `<div class="filters"><label class="flt grow"><span>Zoeken</span><input type="search" data-f="q" value="${esc(f.q || "")}" placeholder="Naam, categorie, aandachtspunt…"></label>
    ${sel("phase", "Onderdeel", EX_PHASES.map(p => [p, p]))}${sel("band", "Leeftijd", EX_BANDS.map(([k, l]) => [k, `${l} (${cnt("band", k)})`]))}
    ${sel("theme", "Thema", [...EX_THEMES.map(t => t[0]), "Overige"].map(t => [t, `${t} (${cnt("theme", t)})`]).filter(o => !/\(0\)$/.test(o[1])))}
    ${sel("form", "Vorm", EX_FORMS.map(t => [t, `${t} (${cnt("form", t)})`]).filter(o => !/\(0\)$/.test(o[1])))}
    ${compact ? "" : sel("src", "Bron", [["eigen", "Alleen van mij (niet gedeeld)"], ["club", "Gedeeld met de club"], ["psd", "PSD-databank"]]) + (authors.length > 1 ? sel("author", "Gemaakt door", authors.map(a => [a, a])) : "")}
    ${Object.keys(f).some(k => k !== "q" && f[k]) || f.q ? `<button class="link" type="button" data-reset>Filters wissen</button>` : ""}</div>`;
  const save = () => { try { const { q, ...rest } = f; localStorage.setItem(FILTER_KEY, JSON.stringify(rest)); } catch (e) {} };
  $$("[data-f]", host).forEach(el => { const k = el.dataset.f;
    if (k === "q") el.oninput = () => { f.q = el.value; onChange(); };
    else el.onchange = () => { f[k] = el.value; save(); exFilterBar(host, list, f, onChange, compact); onChange(); }; });
  const r = $("[data-reset]", host); if (r) r.onclick = () => { Object.keys(f).forEach(k => f[k] = ""); save(); exFilterBar(host, list, f, onChange, compact); onChange(); };
}

/* ============ afdrukken: trainingsfiche zoals PSD ============ */
async function printPlan(e) {
  const pl = normPlan(e.plan), el = document.createElement("div"); el.className = "print-only";
  el.innerHTML = `<div class="pfiche"><header><div><h1>${esc(pl.theme || e.theme || "Training")}</h1><p>${esc(S.team?.name || "")} · ${e.date ? cap(dLong(e.date)) : "Training zonder datum"}${e.start_time ? ", " + tm(e.start_time) + (e.end_time ? "–" + tm(e.end_time) : "") : ""}${e.location ? " · " + esc(e.location) : ""}</p></div><img src="icons/logo.png" alt=""></header>
    <dl class="pmeta"><div><dt>Thema</dt><dd>${esc(pl.theme || e.theme || "–")}</dd></div><div><dt>Aantal spelers</dt><dd>${esc(pl.players || "–")}</dd></div><div><dt>Materiaal</dt><dd>${esc(pl.material || "–")}</dd></div><div><dt>Intensiteit</dt><dd>${pl.intensity ? pl.intensity + " – " + INTENS[pl.intensity] : "–"}</dd></div><div><dt>Totale duur</dt><dd>${planMinutes(pl)} min</dd></div></dl>
    ${pl.goal ? `<p class="pgoal"><b>Doel:</b> ${esc(pl.goal)}</p>` : ""}
    ${pl.items.map(x => `<section class="pex"><div class="ptxt"><h2>${x.phase ? esc(x.phase) + " : " : ""}${esc(x.name || "Oefening")}</h2>
      ${x.cats?.length ? `<p><b>Categorie:</b><br>${x.cats.map(c => "- " + esc(c)).join("<br>")}</p>` : ""}
      <p>${[["Duurtijd", exMinutes(x) ? exMinutes(x) + " min." : ""], ["Intensiteit", x.intensity ? x.intensity + " - " + INTENS[x.intensity] : ""], ["Duur van de inspanning", x.work], ["Duur van de rust", x.rest ? x.rest + " sec." : ""], ["Aantal herhalingen", x.reps]].filter(([, val]) => val).map(([k, val]) => `<b>${k}:</b> ${esc(val)}`).join("<br>")}</p>
      ${x.org ? `<h3>Opstelling / Organisatie &amp; richtlijnen</h3><p>${esc(x.org).replace(/\n/g, "<br>")}</p>` : ""}${x.criteria ? `<h3>Uitvoeringscriteria / Aandachtspunten</h3><p>${esc(x.criteria).replace(/\n/g, "<br><br>")}</p>` : ""}
      ${x.material ? `<h3>Materiaal</h3><p>${esc(x.material)}</p>` : ""}${x.size ? `<h3>Afmetingen</h3><p>${esc(x.size)}</p>` : ""}</div>
      <div class="pimg">${exPic(x, "")}</div></section>`).join("")}
    <footer>OGV Trainers · Kvv OG Vorselaar</footer></div>`;
  document.body.appendChild(el); document.documentElement.classList.add("printing");
  await hydrateImgs(el).catch(() => {});
  const imgs = [...el.querySelectorAll("img")]; imgs.forEach(i => { i.loading = "eager"; });
  await Promise.race([Promise.all(imgs.map(i => i.complete && i.src ? 0 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 4000))]);
  const done = () => { el.remove(); document.documentElement.classList.remove("printing"); removeEventListener("afterprint", done); };
  addEventListener("afterprint", done); setTimeout(() => print(), 150);
}

const srcLine = (m, x) => { const by = x.source === "PSD" ? "PSD-databank" + (x.author ? " · " + x.author : "") : !items.mine(m) ? "Gedeeld door " + (x.shared_by || "een clubtrainer") : m.shared ? "Van jou, gedeeld met de club" : "Van jou, alleen voor jou";
  return `<small class="hint">${m.shared ? `<span class="shdot" aria-hidden="true"></span>` : ""}${esc(by)}</small>`; };
/* ============ trainingssjablonen (eigen sjablonen en volledige trainingen uit PSD) ============ */
function tplSchedule(x) {
  const t = todayIso(), up2 = S.events.filter(e => e.type === "training" && e.date >= t).slice(0, 12);
  if (!S.team) { toast("Kies eerst je ploeg."); return; }
  if (!up2.length) { toast("Er staat nog geen training in de kalender. Voeg er een toe bij Kalender."); return; }
  const d = dialog(`<div class="dlg"><h2>Op een training zetten</h2><p class="muted" style="margin:0">Op welke training zet je "${esc(x.title)}"?</p><div class="list">${up2.map(e => { const n = normPlan(e.plan).items.length;
    return `<div class="item" data-e="${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span><span class="main"><b>${esc(normPlan(e.plan).theme || e.theme || "Training")}</b><small>${dShort(e.date)}${e.start_time ? " · " + tm(e.start_time) : ""}${n ? ` · <span style="color:var(--warn)">heeft al een plan, dat wordt vervangen</span>` : ""}</small></span>${IC.plus}</div>`; }).join("")}</div>
    <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button></div></div>`);
  $$("[data-e]", d).forEach(y => y.onclick = async () => { const e = S.events.find(z => z.id === y.dataset.e);
    if (normPlan(e.plan).items.length && !confirm("Deze training heeft al een plan. Vervangen?")) return;
    const pl = JSON.parse(JSON.stringify(x.data)); delete pl.source; delete pl.psd_id; delete pl.author; delete pl.ages; delete pl.shared_by;
    pl.items.forEach(i => i.id = uid()); e.plan = pl; await safe(() => putEvent(e), "Op de training gezet."); d.close(); go("#/activiteit/" + e.id + "/plan"); });
}
function tplView(x, onChange) {
  const pl = normPlan(x.data);
  const d = dialog(`<div class="dlg"><div class="row"><h2 style="margin-right:auto">${esc(x.title)}</h2><button class="xbtn" style="position:static" type="button" data-close aria-label="Sluiten">${IC.x}</button></div>
    <p class="muted" style="margin:0">${esc([agesTxt(x.data.ages), pl.players ? pl.players + " spelers" : "", planMinutes(pl) + " min", x.data.author ? "gemaakt door " + x.data.author : ""].filter(Boolean).join(" · "))}</p>
    ${pl.goal ? `<p style="margin:0">${esc(pl.goal)}</p>` : ""}${pl.material ? `<p class="hint" style="margin:0"><b>Materiaal:</b> ${esc(pl.material)}</p>` : ""}
    <div class="exs" style="max-height:60dvh;overflow:auto">${pl.items.map(it => `<article class="excard"><div class="pic">${exPic(it)}</div><div class="bd"><small class="hint">${esc(it.phase)}</small><b>${esc(it.name || "Oefening")}</b><small class="muted">${esc([exMinutes(it) ? exMinutes(it) + " min" : "", it.size].filter(Boolean).join(" · "))}</small>${it.org ? `<p class="clamp">${esc(it.org)}</p>` : ""}</div></article>`).join("")}</div>
    <div class="row">${srcLine(x, x.data)}<span class="spacer"></span>${items.mine(x) && mode !== "demo" ? `<button class="link" type="button" id="tv-sh">${x.shared ? "Niet meer delen" : "Delen met club"}</button>` : ""}${items.mine(x) ? `<button class="link" type="button" id="tv-del">Verwijderen</button><button class="btn ghost" type="button" id="tv-ed">Bewerken</button>` : ""}
      ${S.team && logged() ? `<button class="btn" type="button" id="tv-plan">${IC.plus}Inplannen op een training</button>` : ""}</div></div>`, "wide xl");
  const tp = $("#tv-plan", d); if (tp) tp.onclick = () => { d.close(); tplSchedule(x); };
  const te = $("#tv-ed", d); if (te) te.onclick = () => { d.close(); go("#/sjabloon/" + x.id); };
  const sh = $("#tv-sh", d); if (sh) sh.onclick = async () => { await safe(() => items.share(x, !x.shared), x.shared ? "Niet meer gedeeld." : "Gedeeld met alle clubtrainers."); d.close(); onChange && onChange(); };
  const dl = $("#tv-del", d); if (dl) dl.onclick = async () => { if (!confirm(`Training "${x.title}" verwijderen?`)) return; await safe(() => items.del(x), "Verwijderd."); d.close(); onChange && onChange(); };
}

/* ============ trainingsbibliotheek: clubtrainingen, oefenstof en sjablonen in één overzicht ============ */
const BOUW2BAND = { onderbouw: "onder", middenbouw: "mid", bovenbouw: "boven" };
const LIBTHEME = { "Techniek": "Balgevoel en techniek", "Duel 1v1": "Dribbelen en 1v1", "Passing en balaanname": "Passen en aannemen", "Handelingssnelheid": "Passen en aannemen", "Positiespel": "Opbouw en balcirculatie", "Wedstrijdvormen": "Vrij spel en wedstrijdvormen", "Wedstrijdopwarming": "Coördinatie en fysiek" };
const PRTHEME = { "1A": "Opbouw en balcirculatie", "1B": "Verdedigen en druk zetten", "2A": "Doelkansen creëren", "2B": "Verdedigen en druk zetten", "3A": "Omschakelen", "3B": "Omschakelen" };
const SRC_L = { club: "Club", eigen: "Van mij", anderen: "Gedeeld door trainers", psd: "PSD-databank" };
const teamBand = () => { const c = parseInt(String(S.team?.category || "").replace(/\D/g, "")); return !c ? "" : c <= 9 ? "onder" : c <= 13 ? "mid" : "boven"; };
let LB = null;
function lbState() { if (LB) return LB; let st = {}; try { st = JSON.parse(localStorage.getItem("ogv-lib") || "{}"); } catch (e) {}
  LB = { type: st.type || "oefening", band: st.band ?? teamBand(), theme: "", soort: "", src: "", author: "", q: "", more: false }; return LB; }
const lbSave = () => { try { localStorage.setItem("ogv-lib", JSON.stringify({ type: LB.type, band: LB.band })); } catch (e) {} };
const logged = () => !!db && (mode === "demo" || !!user);
async function libData() {
  const [L, ex, tp] = await Promise.all([loadLib().catch(() => null), logged() ? items.listAll("oefening").catch(() => []) : [], logged() ? items.listAll("training").catch(() => []) : []]);
  tp.forEach(x => { x.data = normPlan(x.data); });
  const out = [], ph = `<span class="ph0">${IC.field}</span>`;
  (L?.items || []).forEach(i => { const train = i.map === "thema";
    out.push({ key: "c:" + i.id, type: train ? "training" : "oefening", src: "club", title: i.title, sub: i.bedoeling, pic: `<img src="trainingen/${esc(i.img)}" alt="" loading="lazy">`,
      bands: i.bouwen.map(b => BOUW2BAND[b]), themes: [i.principe ? PRTHEME[i.principe] : LIBTHEME[i.thema]].filter(Boolean), soort: train ? "" : i.map === "opwarming" ? "Opwarming" : ({ Wedstrijdvormen: "Wedstrijdvorm", "Duel 1v1": "Duelvorm", "Passing en balaanname": "Pasvorm", Techniek: "Techniekvorm", Positiespel: "Positiespel", Handelingssnelheid: "Tussenvorm" })[i.thema] || "Tussenvorm", meta: [i.principe ? "Basisprincipe " + i.principe : "", i.vorm, i.bouwen.map(b => L.bouwen.find(x => x.id === b)?.leeftijd).join(", ")].filter(Boolean).join(" · "), author: "", lib: i }); });
  ex.forEach(m => { const x = m.data;
    out.push({ key: "x:" + m.id, type: "oefening", src: x.source === "PSD" ? "psd" : items.mine(m) ? "eigen" : "anderen", title: m.title, sub: x.goal || x.org, pic: exPic(x, ph), bands: exBands(x), themes: exThemes(x), soort: exType(x), meta: exMeta(x), author: x.author || x.shared_by || "", row: m }); });
  tp.forEach(t => { const pics = t.data.items.filter(i => i.img || i.img_path || i.diagram?.objs?.length).slice(0, 3), th = [...new Set(t.data.items.flatMap(exThemes))].filter(z => z !== "Overige");
    out.push({ key: "t:" + t.id, type: "training", src: t.data.source === "PSD" ? "psd" : items.mine(t) ? "eigen" : "anderen", title: t.title, sub: t.data.goal, strip: pics.map(i => `<div>${exPic(i, "")}</div>`).join("") || `<div class="ph0">${IC.field}</div>`,
      bands: exBands(t.data), themes: th.length ? th : ["Overige"], phase: "", form: "", meta: [agesTxt(t.data.ages), t.data.items.length + " oefeningen", planMinutes(t.data) ? planMinutes(t.data) + " min" : ""].filter(Boolean).join(" · "), author: t.data.author || t.data.shared_by || "", row: t }); });
  const rank = { club: 0, eigen: 1, anderen: 2, psd: 3 }; out.sort((a, b) => rank[a.src] - rank[b.src]);
  return { L, list: out };
}
function libMatch(e, f, skip) {
  if (f.type && e.type !== f.type) return false;
  if (skip !== "band" && f.band && !e.bands.includes(f.band)) return false;
  if (skip !== "theme" && f.theme && !e.themes.includes(f.theme)) return false;
  if (skip !== "soort" && f.soort && e.soort !== f.soort) return false;
  if (f.src && e.src !== f.src) return false; if (f.author && e.author !== f.author) return false;
  const t = (f.q || "").toLowerCase().trim(); if (!t) return true;
  const x = e.row?.data || e.lib || {};
  return [e.title, e.sub, e.meta, e.author, e.themes.join(" "), (x.cats || []).join(" "), x.org, x.criteria, x.thema, ...(x.items || []).map(i => i.name)].filter(Boolean).join(" ").toLowerCase().includes(t);
}
const libCard = e => e.type === "training" && e.strip != null
  ? `<button class="tplcard pickable" type="button" data-k="${esc(e.key)}"><div class="tstrip">${e.strip}</div>${libBody(e)}</button>`
  : `<button class="excard pickable" type="button" data-k="${esc(e.key)}"><div class="pic">${e.pic}</div>${libBody(e)}</button>`;
const libBody = e => `<div class="bd"><b class="lt">${esc(e.title)}</b>
  <div class="chips">${e.themes.filter(z => z !== "Overige").slice(0, 2).map(c => `<span class="pill g">${esc(c)}</span>`).join("")}${e.soort ? `<span class="pill soort" style="--pc:${labelCol(e.soort)}">${esc(e.soort)}</span>` : ""}</div>
  ${e.meta ? `<small class="muted">${esc(e.meta)}</small>` : ""}${e.sub ? `<p class="clamp">${esc(e.sub)}</p>` : ""}
  <small class="hint lsrc src-${e.src}">${e.row?.shared ? `<span class="shdot" aria-hidden="true"></span>` : ""}${esc(e.src === "club" ? "Clubtraining OG Vorselaar" : e.src === "psd" ? "PSD-databank" + (e.author ? " · " + e.author : "") : e.src === "anderen" ? "Gedeeld door " + (e.author || "een clubtrainer") : e.row?.shared ? "Van jou, gedeeld met de club" : "Van jou")}</small></div>`;

route("bibliotheek", { title: "Trainingsbibliotheek", render: async (v, id) => {
  v.innerHTML = head("Trainingsbibliotheek", "Laden…");
  let D = await libData(); const f = lbState(); let shown = 36;
  const counts = t => D.list.filter(e => e.type === t).length;
  const shell = () => {
    v.innerHTML = head("Trainingsbibliotheek", "Alle oefeningen en trainingen van de club op één plek. Kies je leeftijd, zoek of filter op thema en zet wat je nodig hebt met één klik in je training.",
        logged() ? `<button class="btn" type="button" id="new">${IC.plus}Nieuwe oefening</button>` : "") +
      `<div class="libtype" role="tablist">${[["oefening", "Oefeningen", "Losse oefeningen om je training mee op te bouwen"], ["training", "Volledige trainingen", "Kant-en-klaar, in één keer in te plannen"]].map(([k, l, s2]) => `<button type="button" role="tab" data-type="${k}" aria-selected="${f.type === k}"><b>${l} <span>${counts(k)}</span></b><small>${s2}</small></button>`).join("")}</div>
      <div class="bouw b4" role="group" aria-label="Leeftijd">${[["", "Alle", "Alle leeftijden"], ["onder", "Onderbouw", "U6 – U9 · 5v5"], ["mid", "Middenbouw", "U10 – U13 · 8v8"], ["boven", "Bovenbouw", "U14+ · 11v11"]].map(([k, n, l]) => `<button type="button" data-band="${k}" aria-pressed="${f.band === k}"><b>${n}</b><small>${l}</small></button>`).join("")}</div>
      <div id="lf"></div><p class="hint" id="cnt" style="margin:12px 0"></p><div id="grid"></div>`;
    $$("[data-type]", v).forEach(b => b.onclick = () => { f.type = b.dataset.type; f.soort = ""; f.theme = ""; lbSave(); shown = 36; shell(); });
    $$("[data-band]", v).forEach(b => b.onclick = () => { f.band = b.dataset.band; lbSave(); shown = 36; $$("[data-band]", v).forEach(x => x.setAttribute("aria-pressed", x === b)); bar(); grid(); });
    const n = $("#new", v); if (n) n.onclick = () => exEditor({ id: uid(), phase: "Kern", name: "", cats: [], rest: 60, diagram: { field: S.team?.format === "8v8" ? "8v8" : "5v5", objs: [] } }, async x => { const r = await safe(() => items.save({ kind: "oefening", title: x.name, data: exData(x) }), "Oefening opgeslagen bij Van mij."); if (r) reload(); });
    bar(); grid();
  };
  const bar = () => { const base = D.list.filter(e => e.type === f.type), inBand = base.filter(e => libMatch(e, f, "theme"));
    const th = [...EX_THEMES.map(t => t[0]), "Overige"].map(t => [t, inBand.filter(e => e.themes.includes(t)).length]).filter(([, c]) => c || f.theme === "" + c);
    const authors = [...new Set(base.map(e => e.author).filter(Boolean))].sort((a, b) => a.localeCompare(b, "nl"));
    const sel = (k, label, opts) => `<label class="flt"><span>${label}</span><select data-f="${k}"><option value="">Alle</option>${opts.map(([val, l]) => `<option value="${esc(val)}"${f[k] === val ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
    const active = ["src", "author"].filter(k => f[k]).length, inS = base.filter(e => libMatch(e, f, "soort"));
    $("#lf", v).innerHTML = (f.type === "oefening" ? `<div class="soorten" role="group" aria-label="Soort oefening"><button type="button" class="chip" data-so="" aria-pressed="${!f.soort}">Alle soorten</button>${EX_TYPES.map(t => [t, inS.filter(e => e.soort === t).length]).filter(([t, c]) => c || f.soort === t).map(([t, c]) => `<button type="button" class="chip" data-so="${t}" aria-pressed="${f.soort === t}" style="--pc:${labelCol(t)}">${t} <b>${c}</b></button>`).join("")}</div>` : "") + `<div class="filters"><label class="flt grow"><span>Zoeken</span><input type="search" data-f="q" value="${esc(f.q)}" placeholder="${f.type === "oefening" ? "Zoek: rondo, 1v1, afwerken, opbouw…" : "Zoek: opbouw, omschakeling…"}"></label>
      ${sel("theme", "Thema", th.map(([t, c]) => [t, `${t} (${c})`]))}
      <button class="link" type="button" id="more" aria-expanded="${f.more}">${f.more ? "Minder filters" : "Meer filters"}${active && !f.more ? ` (${active})` : ""}</button>
      ${f.more ? `<div class="fmore">${sel("src", "Bron", Object.entries(SRC_L).filter(([k]) => base.some(e => e.src === k)))}${authors.length > 1 ? sel("author", "Gemaakt door", authors.map(a => [a, a])) : ""}</div>` : ""}
      ${active || f.theme || f.q || f.soort ? `<button class="link" type="button" id="reset">Filters wissen</button>` : ""}</div>`;
    $$("[data-f]", v).forEach(el => { const k = el.dataset.f;
      if (k === "q") el.oninput = () => { f.q = el.value; shown = 36; grid(); };
      else el.onchange = () => { f[k] = el.value; shown = 36; bar(); grid(); }; });
    $("#more", v).onclick = () => { f.more = !f.more; bar(); };
    $$("[data-so]", v).forEach(b => b.onclick = () => { f.soort = b.dataset.so; shown = 36; bar(); grid(); });
    const r = $("#reset", v); if (r) r.onclick = () => { Object.assign(f, { theme: "", soort: "", src: "", author: "", q: "" }); shown = 36; bar(); grid(); };
  };
  const grid = () => { const list = D.list.filter(e => libMatch(e, f)), tot = D.list.filter(e => e.type === f.type).length;
    $("#cnt", v).textContent = `${list.length} ${f.type === "oefening" ? (list.length === 1 ? "oefening" : "oefeningen") : (list.length === 1 ? "training" : "trainingen")}${list.length < tot ? " van " + tot : ""}${!logged() ? " · meld je aan om ook de oefenstof van de trainers te zien" : ""}`;
    $("#grid", v).innerHTML = list.length ? `<div class="${f.type === "training" ? "tpls" : "exs"}">${list.slice(0, shown).map(libCard).join("")}</div>${list.length > shown ? `<div class="row" style="justify-content:center;margin-top:16px"><button class="btn ghost" type="button" id="morec">Meer tonen (nog ${list.length - shown})</button></div>` : ""}`
      : `<div class="empty"><b>Niets gevonden</b>${f.band ? "Probeer <button class='link' type='button' id='allb'>alle leeftijden</button> of wis de filters." : "Pas de filters aan of wis ze."}</div>`;
    const mc = $("#morec", v); if (mc) mc.onclick = () => { shown += 36; grid(); };
    const ab = $("#allb", v); if (ab) ab.onclick = () => { f.band = ""; lbSave(); shell(); };
    $$("[data-k]", v).forEach(b => b.onclick = () => open(D.list.find(e => e.key === b.dataset.k))); };
  const reload = async () => { D = await libData(); shell(); };
  const open = e => { if (!e) return; if (e.lib) return libDetail(D.L, e.lib.id); if (e.type === "training") return tplView(e.row, reload); exView(e.row, reload); };
  shell();
  if (id) { const e = D.list.find(z => z.key === "c:" + id || z.key.endsWith(":" + id)); if (e) open(e); }
} });
route("oefeningen", { title: "Trainingsbibliotheek", render: () => { lbState().type = "oefening"; lbSave(); location.replace("#/bibliotheek"); } });
route("sjablonen", { title: "Trainingsbibliotheek", render: () => { lbState().type = "training"; lbSave(); location.replace("#/bibliotheek"); } });

/* één oefening bekijken: alles in één oogopslag, met de acties erbij */
function exView(m, onChange) {
  const x = m.data, own = items.mine(m), fact = (k, val) => val ? `<dt>${k}</dt><dd>${esc(val)}</dd>` : "";
  const d = dialog(`<div class="dlg exview"><div class="row"><h2 style="margin-right:auto">${esc(m.title)}</h2><button class="xbtn" style="position:static" type="button" data-close aria-label="Sluiten">${IC.x}</button></div>
    <div class="exvgrid"><div><div class="exvpic">${exPic(x)}</div>${x.diagram && dgFrames(x.diagram).length > 1 ? `<div class="row" style="margin-top:8px;gap:6px"><button class="btn ghost small" type="button" id="xv-play">▶ Afspelen</button><button class="btn ghost small" type="button" id="xv-vid">${IC.dl}Filmpje</button><span class="hint">${dgFrames(x.diagram).length} stappen</span></div>` : ""}</div><div class="exvinfo">
      <div class="chips">${exThemes(x).filter(z => z !== "Overige").map(c => `<span class="pill g">${esc(c)}</span>`).join("")}<span class="pill soort" style="--pc:${labelCol(exType(x))}">${esc(exType(x))}</span></div>
      ${x.goal ? `<p style="margin:0">${esc(x.goal)}</p>` : ""}
      <dl class="facts">${fact("Soort", exType(x))}${fact("Leeftijd", agesTxt(x.ages))}${fact("Duur", exMinutes(x) ? exMinutes(x) + " min" : "")}${fact("Inspanning", x.reps ? `${x.reps} × ${x.work || "?"}${x.rest ? ", " + x.rest + " s rust" : ""}` : "")}${fact("Intensiteit", x.intensity ? x.intensity + " – " + INTENS[x.intensity] : "")}${fact("Spelers", x.players)}${fact("Afmetingen", x.size)}${fact("Materiaal", x.material)}</dl>
      ${srcLine(m, x)}</div></div>
    ${x.org ? `<h3>Organisatie en richtlijnen</h3><p class="pre">${esc(x.org)}</p>` : ""}${x.criteria ? `<h3>Aandachtspunten</h3><p class="pre">${esc(x.criteria)}</p>` : ""}
    <div class="row exvact">${S.team && logged() ? `<button class="btn" type="button" id="xv-plan">${IC.plus}Toevoegen aan een training</button>` : ""}
      <button class="btn ghost" type="button" id="xv-ed">${own ? "Bewerken" : "Eigen kopie maken"}</button>
      <span class="spacer"></span>${own && mode !== "demo" ? `<button class="link" type="button" id="xv-sh">${m.shared ? "Niet meer delen" : "Delen met club"}</button>` : ""}${own ? `<button class="link" type="button" id="xv-del">Verwijderen</button>` : ""}</div></div>`, "wide xl");
  const xp = $("#xv-play", d); if (xp) { let stop = null; const pic = $(".exvpic", d);
    xp.onclick = () => { if (stop) { stop(); stop = null; pic.innerHTML = exPic(x); xp.textContent = "▶ Afspelen"; return; } stop = dgPlay(pic, x.diagram); xp.textContent = "■ Stoppen"; };
    d.addEventListener("close", () => stop && stop(), { once: true }); }
  const xvd = $("#xv-vid", d); if (xvd) xvd.onclick = () => dgVideo(x.diagram, x.name || m.title);
  const pb = $("#xv-plan", d); if (pb) pb.onclick = () => toTraining({ ...JSON.parse(JSON.stringify(x)), id: uid(), name: x.name || m.title });
  $("#xv-ed", d).onclick = () => { d.close(); exEditor({ ...JSON.parse(JSON.stringify(x)), name: x.name || m.title }, async y => {
    if (own) { m.title = y.name; m.data = { ...exData(y), shared_by: x.shared_by }; await safe(() => items.save(m), "Oefening opgeslagen."); }
    else { const dd = exData(y); delete dd.shared_by; await safe(() => items.save({ kind: "oefening", title: dd.name || m.title, data: dd }), "Opgeslagen als eigen kopie bij Van mij."); }
    onChange && onChange(); }, own ? null : "Opslaan als eigen kopie"); };
  const sh = $("#xv-sh", d); if (sh) sh.onclick = async () => { await safe(() => items.share(m, !m.shared), m.shared ? "Niet meer gedeeld." : "Gedeeld: elke clubtrainer kan deze oefening nu gebruiken."); d.close(); onChange && onChange(); };
  const del = $("#xv-del", d); if (del) del.onclick = async () => { if (!confirm(`"${m.title}" verwijderen?${m.shared ? " Andere trainers kunnen ze dan ook niet meer gebruiken." : ""}`)) return;
    await safe(() => items.del(m), "Oefening verwijderd."); d.close(); onChange && onChange(); };
}
/* een oefening op een geplande training zetten */
function toTraining(item, title) {
  const up = S.events.filter(e => e.type === "training" && e.date >= todayIso()).slice(0, 10);
  if (!up.length) { toast("Plan eerst een training in de kalender."); return; }
  const d2 = dialog(`<div class="dlg"><h2>${esc(title || "Aan welke training toevoegen?")}</h2><div class="list">${up.map(e => `<div class="item" data-e="${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span><span class="main"><b>${esc(normPlan(e.plan).theme || e.theme || "Training")}</b><small>${dShort(e.date)} · ${normPlan(e.plan).items.length} oefeningen</small></span>${IC.plus}</div>`).join("")}</div><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>${title ? "Nee, bedankt" : "Annuleren"}</button></div></div>`);
  $$("[data-e]", d2).forEach(y => y.onclick = async () => { const e = S.events.find(z => z.id === y.dataset.e); e.plan = normPlan(e.plan); e.plan.items.push(item);
    await safe(() => putEvent(e), "Toegevoegd aan de training van " + dShort(e.date) + "."); d2.close(); });
}
/* kiezen uit de bibliotheek vanuit de trainingsfiche */
async function libPick(onPick) {
  const D = await libData(), f = { type: "oefening", band: lbState().band, theme: "", soort: "", src: "", author: "", q: "" };
  const d = dialog(`<div class="dlg"><h2>Uit de trainingsbibliotheek</h2><div class="filters"><label class="flt grow"><span>Zoeken</span><input type="search" id="pq" placeholder="Zoek: rondo, 1v1, afwerken…"></label>
    <label class="flt"><span>Leeftijd</span><select id="pb"><option value="">Alle</option>${EX_BANDS.map(([k, l]) => `<option value="${k}"${f.band === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="flt"><span>Thema</span><select id="pt"><option value="">Alle</option>${[...EX_THEMES.map(t => t[0])].map(t => `<option>${esc(t)}</option>`).join("")}</select></label>
    <label class="flt"><span>Soort</span><select id="pp"><option value="">Alle</option>${EX_TYPES.map(p2 => `<option>${p2}</option>`).join("")}</select></label></div>
    <div id="pl" class="exs" style="max-height:56dvh;overflow:auto"></div><div class="row"><span class="hint" id="pc"></span><span class="spacer"></span><button class="btn ghost" type="button" data-close>Sluiten</button></div></div>`, "wide xl");
  const draw = () => { const list = D.list.filter(e => libMatch(e, f)); $("#pc", d).textContent = `${list.length} oefeningen${list.length > 60 ? " · eerste 60 getoond, verfijn met de filters" : ""}`;
    $("#pl", d).innerHTML = list.slice(0, 60).map(libCard).join("") || `<div class="empty"><b>Niets gevonden</b>Pas de filters aan.</div>`;
    $$("[data-k]", d).forEach(b => b.onclick = () => { const e = D.list.find(z => z.key === b.dataset.k);
      onPick({ ...(e.lib ? exFromLib(e.lib) : { ...JSON.parse(JSON.stringify(e.row.data)), id: uid(), name: e.row.data.name || e.row.title }), phase: e.soort }); d.close(); toast("Oefening toegevoegd."); }); };
  $("#pq", d).oninput = ev => { f.q = ev.target.value; draw(); };
  [["#pb", "band"], ["#pt", "theme"], ["#pp", "soort"]].forEach(([sel, k]) => $(sel, d).onchange = ev => { f[k] = ev.target.value; draw(); });
  draw();
}
