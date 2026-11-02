/* OGV Platform — trainingen maken zoals in PSD: trainingsfiche met oefeningen, categorieën uit het leerplan,
   inspanning/rust/herhalingen, organisatie, aandachtspunten, materiaal, afmetingen en een veldtekening per oefening.
   Plus: mijn oefeningen (persoonlijke oefenstof) en sjablonen. */
"use strict";

/* ============ veldtekening ============ */
const FIELDS = {
  "5v5": { l: "5v5-veld (35 × 25 m)", r: 25 / 35 }, "8v8": { l: "8v8-veld (60 × 40 m)", r: 40 / 60 }, "11v11": { l: "11v11-veld", r: 68 / 105 },
  "half": { l: "Half veld", r: 68 / 52.5 }, "square": { l: "Vrij vlak", r: .7 }
};
const DOBJ = { // plaatsbare voorwerpen
  p1: "Speler geel", p2: "Speler zwart", p3: "Speler blauw", k: "Keeper", cone: "Kegel", pot: "Potje", pole: "Paal", ball: "Bal", goal: "Groot doel", mini: "Minidoel", ladder: "Ladder", hurdle: "Horde", txt: "Tekst",
  pass: "Pass", run: "Loopactie", drib: "Dribbel", line: "Lijn", zone: "Zone"
};
const LINEISH = new Set(["pass", "run", "drib", "line", "zone"]);
function fieldLines(f, W, H) {
  const L = 'fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".35"';
  if (f === "square") return `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" ${L} stroke-dasharray="1 1"/>`;
  if (f === "half") { const bw = W * .58, bh = H * .22, sw = W * .26, sh = H * .09;
    return `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" ${L}/><path d="M1 ${H - 1}h${W - 2}" ${L}/><path d="M${(W - bw) / 2} 1v${bh}h${bw}v-${bh}M${(W - sw) / 2} 1v${sh}h${sw}v-${sh}" ${L}/><path d="M${W / 2 - 9} ${H - 1}a9 9 0 0 1 18 0" ${L}/><rect x="${W / 2 - 4}" y="-.6" width="8" height="1.6" fill="#fff"/>`; }
  const bx = f === "5v5" ? 9 : f === "8v8" ? 12 : 16, by = H * (f === "11v11" ? .6 : .5), r = f === "11v11" ? 9 : f === "8v8" ? 7 : 6;
  return `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" ${L}/><path d="M${W / 2} 1V${H - 1}" ${L}/><circle cx="${W / 2}" cy="${H / 2}" r="${r}" ${L}/>
    <rect x="1" y="${(H - by) / 2}" width="${bx}" height="${by}" ${L}/><rect x="${W - 1 - bx}" y="${(H - by) / 2}" width="${bx}" height="${by}" ${L}/>
    <rect x="-.6" y="${H / 2 - 3.5}" width="1.6" height="7" fill="#fff"/><rect x="${W - 1}" y="${H / 2 - 3.5}" width="1.6" height="7" fill="#fff"/>`;
}
function arrowPath(o, W, H) {
  const x1 = o.x * W / 100, y1 = o.y * H / 100, x2 = o.x2 * W / 100, y2 = o.y2 * H / 100;
  if (o.t !== "drib") return `M${x1} ${y1}L${x2} ${y2}`;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, n = Math.max(2, Math.round(len / 2.4)), ux = dx / len, uy = dy / len;
  let d = `M${x1} ${y1}`; for (let i = 1; i <= n; i++) { const t = i / n, a = (i % 2 ? 1 : -1) * 1.1 * (i === n ? 0 : 1); d += ` L${x1 + dx * t - uy * a} ${y1 + dy * t + ux * a}`; } return d;
}
function diagramSVG(dg, opts = {}) {
  dg = dg || { field: "5v5", objs: [] }; const F = FIELDS[dg.field] || FIELDS["5v5"], W = 100, H = +(100 * F.r).toFixed(2);
  const col = { p1: "#FFD500", p2: "#141414", p3: "#2563EB", k: "#F2F2EE" }, tx = { p1: "#000", p2: "#fff", p3: "#fff", k: "#000" };
  const sel = opts.sel;
  const objs = (dg.objs || []).map((o, i) => { const x = o.x * W / 100, y = o.y * H / 100, s = i === sel ? ' data-sel="1"' : "", tag = `data-i="${i}"${s}`;
    if (o.t === "zone") { const x2 = o.x2 * W / 100, y2 = o.y2 * H / 100; return `<rect ${tag} x="${Math.min(x, x2)}" y="${Math.min(y, y2)}" width="${Math.abs(x2 - x)}" height="${Math.abs(y2 - y)}" fill="rgba(255,213,0,.18)" stroke="#FFD500" stroke-width=".35" stroke-dasharray="1.2 .8"/>`; }
    if (LINEISH.has(o.t)) { const c = o.t === "line" ? "#fff" : "#111"; return `<path ${tag} d="${arrowPath(o, W, H)}" fill="none" stroke="${o.t === "run" ? "#fff" : c}" stroke-width=".55" ${o.t === "run" ? 'stroke-dasharray="1.4 1"' : ""} ${o.t !== "line" ? 'marker-end="url(#ah' + (o.t === "run" ? "w" : "") + ')"' : ""} stroke-linecap="round"/><path ${tag} d="${arrowPath(o, W, H)}" stroke="transparent" stroke-width="3" fill="none"/>`; }
    if (col[o.t]) return `<g ${tag}><circle cx="${x}" cy="${y}" r="2.3" fill="${col[o.t]}" stroke="${o.t === "p2" ? "#fff" : "#111"}" stroke-width=".3"/>${o.n ? `<text x="${x}" y="${y + .9}" text-anchor="middle" font-size="2.5" font-weight="800" fill="${tx[o.t]}" font-family="Archivo,Arial">${esc(o.n)}</text>` : ""}</g>`;
    if (o.t === "cone") return `<path ${tag} d="M${x} ${y - 1.7}L${x + 1.4} ${y + 1.1}H${x - 1.4}Z" fill="#FF7A1A" stroke="#7A3300" stroke-width=".2"/>`;
    if (o.t === "pot") return `<ellipse ${tag} cx="${x}" cy="${y}" rx="1.3" ry=".8" fill="#FFD500" stroke="#7A5F00" stroke-width=".2"/>`;
    if (o.t === "pole") return `<g ${tag}><rect x="${x - .35}" y="${y - 2.4}" width=".7" height="2.8" fill="#E11D48"/><circle cx="${x}" cy="${y + .5}" r=".7" fill="#555"/></g>`;
    if (o.t === "ball") return `<circle ${tag} cx="${x}" cy="${y}" r="1" fill="#fff" stroke="#111" stroke-width=".3"/>`;
    if (o.t === "goal" || o.t === "mini") { const w = o.t === "goal" ? 7 : 3.6, d = o.t === "goal" ? 2.2 : 1.4, left = o.x < 50;
      return `<path ${tag} d="M${x} ${y - w / 2}h${left ? -d : d}v${w}h${left ? d : -d}" fill="rgba(255,255,255,.25)" stroke="#fff" stroke-width=".5"/>`; }
    if (o.t === "ladder") return `<g ${tag} stroke="#FFD500" stroke-width=".3" fill="none"><rect x="${x - 1.2}" y="${y - 5}" width="2.4" height="10"/>${[1, 2, 3, 4].map(k => `<path d="M${x - 1.2} ${y - 5 + k * 2}h2.4"/>`).join("")}</g>`;
    if (o.t === "hurdle") return `<path ${tag} d="M${x - 1.5} ${y + .8}V${y - .8}H${x + 1.5}V${y + .8}" fill="none" stroke="#2563EB" stroke-width=".45"/>`;
    if (o.t === "txt") return `<text ${tag} x="${x}" y="${y}" font-size="2.6" font-weight="700" fill="#fff" stroke="#000" stroke-width=".25" paint-order="stroke" font-family="Archivo,Arial">${esc(o.n || "Tekst")}</text>`;
    return ""; }).join("");
  return `<svg class="dg" viewBox="-1 -1 ${W + 2} ${H + 2}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Veldtekening">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#111"/></marker>
    <marker id="ahw" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#fff"/></marker></defs>
    <rect x="-1" y="-1" width="${W + 2}" height="${H + 2}" fill="#2F7D3B"/>${Array.from({ length: 8 }, (_, k) => k % 2 ? `<rect x="${k * W / 8}" y="0" width="${W / 8}" height="${H}" fill="rgba(255,255,255,.04)"/>` : "").join("")}
    ${fieldLines(dg.field, W, H)}${objs}</svg>`;
}
/* tekenbord: plaatsen, slepen, pijlen trekken, nummeren, verwijderen */
function diagramEditor(host, dg, onChange) {
  dg.objs = dg.objs || []; let tool = "select", sel = -1, drag = null, draft = null, num = { p1: 1, p2: 1, p3: 1 };
  const tools = [["select", "Selecteren", IC.cursor], ["p1", "Speler geel", '<span class="dot" style="background:#FFD500"></span>'], ["p2", "Speler zwart", '<span class="dot" style="background:#141414;border:1px solid #888"></span>'], ["p3", "Speler blauw", '<span class="dot" style="background:#2563EB"></span>'], ["k", "Keeper", '<span class="dot" style="background:#F2F2EE;border:1px solid #888"></span>'],
    ["ball", "Bal", "⚽"], ["cone", "Kegel", '<span style="color:#FF7A1A">▲</span>'], ["pot", "Potje", '<span style="color:#FFD500">●</span>'], ["pole", "Paal", '<span style="color:#E11D48">|</span>'], ["goal", "Groot doel", "⊐"], ["mini", "Minidoel", "⊏"], ["ladder", "Ladder", "☰"], ["hurdle", "Horde", "∩"],
    ["pass", "Pass", IC.arrow], ["run", "Loopactie", IC.dash], ["drib", "Dribbel", IC.wave], ["line", "Lijn", IC.line], ["zone", "Zone", IC.rect], ["txt", "Tekst", IC.text]];
  host.innerHTML = `<div class="dge"><div class="row" style="gap:8px;margin-bottom:8px"><select id="dgf" style="width:auto">${Object.entries(FIELDS).map(([k, f]) => `<option value="${k}"${dg.field === k ? " selected" : ""}>${f.l}</option>`).join("")}</select>
    <span class="spacer"></span><button class="btn ghost small" type="button" id="dgdel" disabled>${IC.trash}Verwijderen</button><button class="btn ghost small" type="button" id="dgclr">Leegmaken</button></div>
    <div class="dgtools" role="toolbar" aria-label="Tekengereedschap">${tools.map(([k, l, ic]) => `<button type="button" data-tool="${k}" title="${l}" aria-label="${l}" aria-pressed="${k === tool}">${ic}</button>`).join("")}</div>
    <div class="dgwrap" id="dgw"></div><p class="hint" id="dgh" style="margin:6px 0 0">Kies een voorwerp en tik op het veld. Pijlen en zones trek je door te slepen. Dubbeltik op een speler om het nummer te wijzigen.</p></div>`;
  const W = 100, svgPt = (svg, ev) => { const r = svg.getBoundingClientRect(), H = 100 * (FIELDS[dg.field] || FIELDS["5v5"]).r; return { x: Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * (W + 2) - 1)), y: Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height * (H + 2) - 1) / H * 100)) }; };
  const draw = () => { const all = draft ? { ...dg, objs: [...dg.objs, draft] } : dg; $("#dgw", host).innerHTML = diagramSVG(all, { sel });
    $("#dgdel", host).disabled = sel < 0; const svg = $("#dgw svg", host), wrap = $("#dgw", host);
    wrap.style.touchAction = "none";
    wrap.onpointerdown = ev => { const p = svgPt(svg, ev), hit = ev.target.closest("[data-i]");
      if (tool === "select") { if (hit) { sel = +hit.dataset.i; const o = dg.objs[sel]; drag = { p, o: JSON.parse(JSON.stringify(o)) }; wrap.setPointerCapture(ev.pointerId); } else sel = -1; draw(); return; }
      if (LINEISH.has(tool)) { draft = { t: tool, x: p.x, y: p.y, x2: p.x, y2: p.y }; wrap.setPointerCapture(ev.pointerId); draw(); return; }
      const o = { t: tool, x: p.x, y: p.y }; if (num[tool] != null) o.n = String(num[tool]++); if (tool === "k") o.n = "K";
      if (tool === "txt") { const t = prompt("Tekst op het veld:", ""); if (!t) return; o.n = t; }
      dg.objs.push(o); sel = dg.objs.length - 1; onChange(); draw(); };
    wrap.onpointermove = ev => { const p = svgPt(svg, ev);
      if (draft) { draft.x2 = p.x; draft.y2 = p.y; draw(); return; }
      if (drag && sel >= 0) { const o = dg.objs[sel], dx = p.x - drag.p.x, dy = p.y - drag.p.y; o.x = drag.o.x + dx; o.y = drag.o.y + dy; if (o.x2 != null) { o.x2 = drag.o.x2 + dx; o.y2 = drag.o.y2 + dy; } draw(); } };
    wrap.onpointerup = () => { if (draft) { if (Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y) > 2) { dg.objs.push(draft); sel = dg.objs.length - 1; onChange(); } draft = null; draw(); }
      if (drag) { drag = null; onChange(); } };
    wrap.ondblclick = ev => { const hit = ev.target.closest("[data-i]"); if (!hit) return; const o = dg.objs[+hit.dataset.i]; if (!("n" in o) && o.t !== "txt") return;
      const t = prompt(o.t === "txt" ? "Tekst:" : "Nummer of letter van de speler:", o.n || ""); if (t === null) return; o.n = t.slice(0, o.t === "txt" ? 40 : 3); onChange(); draw(); }; };
  $$("[data-tool]", host).forEach(b => b.onclick = () => { tool = b.dataset.tool; $$("[data-tool]", host).forEach(x => x.setAttribute("aria-pressed", x === b)); });
  $("#dgf", host).onchange = e => { dg.field = e.target.value; onChange(); draw(); };
  $("#dgdel", host).onclick = () => { if (sel >= 0) { dg.objs.splice(sel, 1); sel = -1; onChange(); draw(); } };
  $("#dgclr", host).onclick = () => { if (dg.objs.length && !confirm("Alle voorwerpen van het veld halen?")) return; dg.objs = []; num = { p1: 1, p2: 1, p3: 1 }; sel = -1; onChange(); draw(); };
  const key = ev => { if ((ev.key === "Delete" || ev.key === "Backspace") && sel >= 0 && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { ev.preventDefault(); dg.objs.splice(sel, 1); sel = -1; onChange(); draw(); } };
  document.addEventListener("keydown", key); draw();
  return () => document.removeEventListener("keydown", key);
}

/* ============ trainingsfiche ============ */
const EX_PHASES = ["Opwarming", "Kern", "Wedstrijdvorm", "Afsluiting"];
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
  const t = todayIso(), up = S.events.filter(e => e.type === "training" && e.date >= t), done = S.events.filter(e => e.type === "training" && e.date < t).reverse().slice(0, 10);
  const tpls = await items.list("training").catch(() => []);
  const it = e => { const pl = normPlan(e.plan), n = pl.items.length, mins = planMinutes(e.plan);
    return `<div class="item" data-go="#/activiteit/${e.id}/plan"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span><span class="main"><b>${esc(pl.theme || e.theme || "Training zonder thema")}</b><small>${dShort(e.date)}${e.start_time ? " · " + tm(e.start_time) : ""}${pl.intensity ? " · intensiteit " + pl.intensity : ""}</small></span>
    <span class="val">${n ? `<b>${n} oef.</b>${mins} min` : `<b style="color:var(--warn)">Maken</b>nog leeg`}</span></div>`; };
  v.innerHTML = head("Trainingen maken", "Stel elke training samen als een volledige fiche: oefeningen met categorie, duur, inspanning, rust, herhalingen, organisatie, aandachtspunten en een veldtekening.",
    `<a class="btn ghost" href="#/oefeningen">${IC.ball}Mijn oefeningen</a><button class="btn" type="button" id="addEv">${IC.plus}Training</button>`) +
    (up.length ? `<div class="list">${up.map(it).join("")}</div>` : `<div class="empty"><b>Geen trainingen gepland</b>Voeg een training toe en herhaal ze wekelijks.</div>`) +
    (tpls.length ? `<div class="sec"><h2>Mijn sjablonen</h2><div class="list">${tpls.map(x => `<div class="item static"><span class="num">${IC.copy}</span><span class="main"><b>${esc(x.title)}</b><small>${(x.data.items || []).length} oefeningen · ${planMinutes(x.data)} min</small></span><button class="btn ghost small" type="button" data-tpl="${x.id}">Inplannen</button><button class="link" type="button" data-tdel="${x.id}">✕</button></div>`).join("")}</div></div>` : "") +
    (done.length ? `<div class="sec"><h2>Vorige trainingen</h2><div class="list">${done.map(it).join("")}</div></div>` : "");
  $("#addEv").onclick = () => eventForm({ type: "training", date: todayIso(), start_time: "18:00", end_time: "19:15" }, true);
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
  $$("[data-tdel]", v).forEach(b => b.onclick = async () => { const x = tpls.find(z => z.id === b.dataset.tdel); if (!confirm(`Sjabloon "${x.title}" verwijderen?`)) return; await safe(() => items.del(x), "Sjabloon verwijderd."); render(); });
  $$("[data-tpl]", v).forEach(b => b.onclick = () => { const x = tpls.find(z => z.id === b.dataset.tpl), up2 = S.events.filter(e => e.type === "training" && e.date >= t).slice(0, 10);
    if (!up2.length) { toast("Plan eerst een training in de kalender."); return; }
    const d = dialog(`<div class="dlg"><h2>Sjabloon inplannen</h2><p class="muted" style="margin:0">Op welke training zet je "${esc(x.title)}"? Het bestaande plan van die training wordt vervangen.</p><div class="list">${up2.map(e => `<div class="item" data-e="${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span><span class="main"><b>${esc(normPlan(e.plan).theme || e.theme || "Training")}</b><small>${dShort(e.date)}</small></span>${IC.plus}</div>`).join("")}</div><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button></div></div>`);
    $$("[data-e]", d).forEach(y => y.onclick = async () => { const e = S.events.find(z => z.id === y.dataset.e); e.plan = JSON.parse(JSON.stringify(x.data)); e.plan.items.forEach(i => i.id = uid()); await safe(() => putEvent(e), "Sjabloon ingepland."); d.close(); go("#/activiteit/" + e.id + "/plan"); }); });
} });

async function planEditor(tv, e) {
  e.plan = normPlan(e.plan); const pl = e.plan, sv = saver(e), lib = await loadLib().catch(() => null);
  const dur = e.start_time && e.end_time ? (() => { const [a, b] = [e.start_time, e.end_time].map(s => { const [h, m] = tm(s).split(":"); return +h * 60 + +m; }); return b - a; })() : null;
  const draw = () => {
    const total = planMinutes(pl);
    tv.innerHTML = `<div class="panel noprint"><div class="fields">
      <label class="f full">Thema<input data-p="theme" value="${esc(pl.theme || e.theme || "")}" list="themes2" placeholder="bv. 5v5 voetballen met 4 en K naast elkaar"><datalist id="themes2">${THEMES.map(x => `<option value="${esc(x)}">`).join("")}</datalist></label>
      <label class="f">Aantal spelers<input data-p="players" value="${esc(pl.players || "")}" placeholder="bv. 8-10 + 1K"></label>
      <label class="f">Intensiteit training<select data-p="intensity" data-num>${["", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}"${String(pl.intensity ?? "") === String(n) ? " selected" : ""}>${n ? n + " – " + INTENS[n] : "–"}</option>`).join("")}</select></label>
      <label class="f full">Materiaal<input data-p="material" value="${esc(pl.material || "")}" placeholder="bv. 2 grote goals, potjes, kegels, ballen, hesjes"></label>
      <label class="f full">Doel van de training<input data-p="goal" value="${esc(pl.goal || "")}" placeholder="Wat moeten de spelers na deze training beter kunnen?"></label></div>
      <p class="muted" style="margin:12px 0 0">Totaal <b style="color:var(--ink)">${total} minuten</b>${dur ? ` van ${dur} minuten training` + (total > dur ? ' <span class="pill loss">te lang</span>' : "") : ""} · ${pl.items.length} ${pl.items.length === 1 ? "oefening" : "oefeningen"}</p></div>
    <div class="row noprint" style="margin:16px 0 4px"><button class="btn" type="button" id="exNew">${IC.plus}Nieuwe oefening</button><button class="btn ghost" type="button" id="exMine">${IC.ball}Uit mijn oefeningen</button><button class="btn ghost" type="button" id="exLib">${IC.book}Uit clubbibliotheek</button>
      <span class="spacer"></span><button class="btn ghost" type="button" id="tplSave">${IC.copy}Opslaan als sjabloon</button><button class="btn ghost" type="button" id="prt">${IC.print}Trainingsfiche afdrukken</button></div>
    ${EX_PHASES.map(ph => { const xs = pl.items.map((x, i) => [x, i]).filter(([x]) => x.phase === ph); if (!xs.length) return "";
      return `<div class="sec"><h2>${ph} <span class="hint" style="font-weight:500">${xs.reduce((s, [x]) => s + exMinutes(x), 0)} min</span></h2><div class="exs">${xs.map(([x, i]) => exCard(x, i)).join("")}</div></div>`; }).join("") ||
      `<div class="empty sec"><b>Nog geen oefeningen</b>Maak een nieuwe oefening, neem er een uit je eigen oefeningen of uit de clubbibliotheek.</div>`}`;
    $$("[data-p]", tv).forEach(x => x.oninput = x.onchange = () => { pl[x.dataset.p] = x.hasAttribute("data-num") ? (x.value === "" ? null : +x.value) : x.value; sv(); if (x.tagName === "SELECT") draw(); });
    $("#exNew").onclick = () => exEditor({ id: uid(), phase: pl.items.length ? "Kern" : "Opwarming", name: "", cats: [], reps: null, work: "", rest: 60, diagram: { field: S.team?.format === "8v8" ? "8v8" : "5v5", objs: [] } }, x => { pl.items.push(x); sv(); draw(); });
    $("#exLib").onclick = () => libPicker(lib, L => { pl.items.push(exFromLib(L)); sv(); draw(); });
    $("#exMine").onclick = () => minePicker(x => { pl.items.push(x); sv(); draw(); });
    $("#prt").onclick = () => printPlan(e);
    $("#tplSave").onclick = async () => { const name = prompt("Naam van het sjabloon:", pl.theme || e.theme || "Training"); if (!name) return;
      await safe(() => items.save({ kind: "training", title: name, data: JSON.parse(JSON.stringify(pl)) }), "Opgeslagen bij je sjablonen."); };
    $$("[data-ex]", tv).forEach(b => b.onclick = () => { const [act, i] = b.dataset.ex.split(":"), k = +i, arr = pl.items;
      if (act === "edit") exEditor(JSON.parse(JSON.stringify(arr[k])), x => { arr[k] = x; sv(); draw(); });
      if (act === "up" && k > 0) { [arr[k - 1], arr[k]] = [arr[k], arr[k - 1]]; sv(); draw(); }
      if (act === "down" && k < arr.length - 1) { [arr[k + 1], arr[k]] = [arr[k], arr[k + 1]]; sv(); draw(); }
      if (act === "dup") { arr.splice(k + 1, 0, { ...JSON.parse(JSON.stringify(arr[k])), id: uid() }); sv(); draw(); }
      if (act === "del" && confirm(`"${arr[k].name || "Oefening"}" verwijderen uit deze training?`)) { arr.splice(k, 1); sv(); draw(); }
      if (act === "mine") safe(() => items.save({ kind: "oefening", title: arr[k].name || "Oefening", data: exData(arr[k]) }), "Opgeslagen bij Mijn oefeningen."); });
  };
  draw();
}
const INTENS = { 1: "Heel licht", 2: "Licht", 3: "Matig", 4: "Redelijk zwaar", 5: "Zwaar", 6: "Zwaar+", 7: "Heel zwaar", 8: "Heel zwaar+", 9: "Bijna maximaal", 10: "Maximaal" };
const exData = x => { const d = JSON.parse(JSON.stringify(x)); delete d.id; return d; };
function exCard(x, i) {
  const pic = x.diagram && x.diagram.objs?.length ? diagramSVG(x.diagram) : x.img ? `<img src="${esc(x.img)}" alt="">` : x.diagram ? diagramSVG(x.diagram) : `<span class="ph0">${IC.field}</span>`;
  const facts = [exMinutes(x) ? exMinutes(x) + " min" : "", x.intensity ? "intensiteit " + x.intensity : "", x.reps ? x.reps + " × " + (x.work || "?") : "", x.rest ? x.rest + " s rust" : "", x.size].filter(Boolean);
  return `<article class="excard"><div class="pic">${pic}</div><div class="bd"><div class="row" style="gap:6px"><b style="font-size:17px;margin-right:auto">${esc(x.name || "Naamloze oefening")}</b></div>
    ${x.cats?.length ? `<div class="chips">${x.cats.map(c => `<span class="pill g">${esc(c)}</span>`).join("")}</div>` : ""}
    <small class="muted">${esc(facts.join(" · "))}</small>${x.org ? `<p class="clamp">${esc(x.org)}</p>` : ""}
    <div class="row noprint" style="gap:4px;margin-top:auto"><button class="btn small" type="button" data-ex="edit:${i}">Bewerken</button><button class="link" type="button" data-ex="up:${i}" aria-label="Omhoog">↑</button><button class="link" type="button" data-ex="down:${i}" aria-label="Omlaag">↓</button>
      <button class="link" type="button" data-ex="dup:${i}">Kopie</button><button class="link" type="button" data-ex="mine:${i}">Bewaar</button><span class="spacer"></span><button class="link" type="button" data-ex="del:${i}" aria-label="Verwijderen">✕</button></div></div></article>`;
}
/* volledig bewerkscherm voor één oefening */
function exEditor(x, onSave, saveLabel) {
  x.cats = x.cats || []; if (!x.diagram && !x.img) x.diagram = { field: "5v5", objs: [] };
  const catOpts = LEERPLAN.flatMap(([a, b, list]) => list.map(l => `${a} > ${b}${l !== b ? " > " + l : ""}`));
  const d = dialog(`<form class="exed"><div class="row"><h2 style="margin-right:auto">${x.name ? "Oefening bewerken" : "Nieuwe oefening"}</h2><button class="xbtn" style="position:static" type="button" data-close aria-label="Sluiten">${IC.x}</button></div>
  <div class="exgrid"><div class="exform"><div class="fields">
    <label class="f full">Naam<input name="name" required value="${esc(x.name || "")}" placeholder="bv. Opbouwpatroon 5v5 pas- en trapactivatie"></label>
    <label class="f">Onderdeel<select name="phase">${EX_PHASES.map(p => `<option${x.phase === p ? " selected" : ""}>${p}</option>`).join("")}</select></label>
    <label class="f">Intensiteit<select name="intensity"><option value="">–</option>${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}"${+x.intensity === n ? " selected" : ""}>${n} – ${INTENS[n]}</option>`).join("")}</select></label>
    <label class="f">Duur inspanning<input name="work" value="${esc(x.work || "")}" placeholder="mm:ss, bv. 04:00" inputmode="numeric"></label>
    <label class="f">Rust (seconden)<input name="rest" type="number" min="0" value="${x.rest ?? ""}"></label>
    <label class="f">Herhalingen<input name="reps" type="number" min="0" value="${x.reps ?? ""}"></label>
    <label class="f">Duurtijd (min)<input name="minutes" type="number" min="0" value="${x.minutes ?? ""}" placeholder="automatisch"></label>
    <div class="f full"><span>Categorie (leerplan Voetbal Vlaanderen)</span><div class="chips" id="cats">${x.cats.map(c => `<button type="button" class="tag" aria-pressed="true" data-cat="${esc(c)}">${esc(c)} ✕</button>`).join("")}</div>
      <input list="catlist" id="catin" placeholder="Zoek en kies, bv. Passing of Openen: breed"><datalist id="catlist">${catOpts.map(c => `<option value="${esc(c)}">`).join("")}</datalist></div>
    <label class="f full">Opstelling, organisatie en richtlijnen<textarea name="org" rows="4">${esc(x.org || "")}</textarea></label>
    <label class="f full">Uitvoeringscriteria en aandachtspunten<textarea name="criteria" rows="4" placeholder="Eén aandachtspunt per regel">${esc(x.criteria || "")}</textarea></label>
    <label class="f">Materiaal<input name="material" value="${esc(x.material || "")}" placeholder="5 kegels, 1 groot doel, ballen"></label>
    <label class="f">Afmetingen<input name="size" value="${esc(x.size || "")}" placeholder="bv. 35 × 25 m"></label></div></div>
    <div class="exdiag"><div class="row" style="margin-bottom:8px"><b>Veldtekening</b><span class="spacer"></span>${x.img ? `<button class="link" type="button" id="toDraw">Zelf tekenen in plaats van de afbeelding</button>` : `<label class="link" style="cursor:pointer">Afbeelding gebruiken<input type="file" accept="image/*" id="imgIn" hidden></label>`}</div><div id="dgHost">${x.img && !(x.diagram?.objs?.length) ? `<img src="${esc(x.img)}" alt="" style="width:100%;border-radius:12px">` : ""}</div></div></div>
  <div class="row"><span class="hint" id="durH"></span><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">${saveLabel || "Oefening opslaan"}</button></div></form>`, "wide xl");
  let stopDg = null; const startDg = () => { x.diagram = x.diagram || { field: "5v5", objs: [] }; stopDg = diagramEditor($("#dgHost", d), x.diagram, () => {}); };
  if (!(x.img && !(x.diagram?.objs?.length))) startDg();
  const td = $("#toDraw", d); if (td) td.onclick = () => { x.img = null; td.remove(); startDg(); };
  const ii = $("#imgIn", d); if (ii) ii.onchange = async () => { const f = ii.files[0]; if (!f) return; if (f.size > 4e6) { toast("Kies een afbeelding kleiner dan 4 MB."); return; }
    const rd = new FileReader(); rd.onload = () => { x.img = rd.result; x.diagram = null; if (stopDg) stopDg(); $("#dgHost", d).innerHTML = `<img src="${x.img}" alt="" style="width:100%;border-radius:12px">`; }; rd.readAsDataURL(f); };
  const drawCats = () => { $("#cats", d).innerHTML = x.cats.map(c => `<button type="button" class="tag" aria-pressed="true" data-cat="${esc(c)}">${esc(c)} ✕</button>`).join(""); $$("[data-cat]", d).forEach(b => b.onclick = () => { x.cats = x.cats.filter(c => c !== b.dataset.cat); drawCats(); }); };
  const addCat = el => { const val = el.value.trim(); if (val && !x.cats.includes(val)) { x.cats.push(val); drawCats(); } el.value = ""; };
  drawCats(); $("#catin", d).onchange = ev => addCat(ev.target); $("#catin", d).onkeydown = ev => { if (ev.key === "Enter") { ev.preventDefault(); addCat(ev.target); } };
  const f = $("form", d), dh = () => { const tmp = { reps: +f.reps.value || null, work: f.work.value, rest: +f.rest.value || 0, minutes: +f.minutes.value || null }; const m = exMinutes(tmp); $("#durH", d).textContent = m ? `Duurtijd: ${m} minuten` : ""; };
  ["reps", "work", "rest", "minutes"].forEach(k => f[k].oninput = dh); dh();
  d.addEventListener("close", () => stopDg && stopDg(), { once: true });
  f.onsubmit = ev => { ev.preventDefault(); const fd = Object.fromEntries(new FormData(f));
    Object.assign(x, { name: fd.name.trim(), phase: fd.phase, intensity: fd.intensity ? +fd.intensity : null, work: fd.work.trim(), rest: fd.rest === "" ? null : +fd.rest, reps: fd.reps === "" ? null : +fd.reps, minutes: fd.minutes === "" ? null : +fd.minutes,
      org: fd.org.trim(), criteria: fd.criteria.trim(), material: fd.material.trim(), size: fd.size.trim() });
    d.close(); onSave(x); };
}
async function minePicker(onPick) {
  const mine = await items.list("oefening").catch(() => []);
  if (!mine.length) { toast("Je hebt nog geen eigen oefeningen. Maak er een bij Mijn oefeningen of bewaar een oefening uit een training."); return; }
  const d = dialog(`<div class="dlg"><h2>Uit mijn oefeningen</h2><input id="mq" type="search" placeholder="Zoeken"><div id="ml" class="exs" style="max-height:60dvh;overflow:auto"></div><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Sluiten</button></div></div>`, "wide");
  const drawL = (q = "") => { const t = q.toLowerCase(); $("#ml", d).innerHTML = mine.filter(m => !t || (m.title + " " + (m.data.cats || []).join(" ")).toLowerCase().includes(t)).map(m => `<button class="excard pickable" type="button" data-m="${m.id}"><div class="pic">${m.data.diagram ? diagramSVG(m.data.diagram) : m.data.img ? `<img src="${esc(m.data.img)}" alt="">` : ""}</div><div class="bd"><b>${esc(m.title)}</b><small class="muted">${esc((m.data.cats || []).join(", "))}</small></div></button>`).join("");
    $$("[data-m]", d).forEach(b => b.onclick = () => { const m = mine.find(z => z.id === b.dataset.m); onPick({ ...JSON.parse(JSON.stringify(m.data)), id: uid(), name: m.data.name || m.title }); d.close(); toast("Oefening toegevoegd."); }); };
  $("#mq", d).oninput = e => drawL(e.target.value); drawL();
}

/* ============ afdrukken: trainingsfiche zoals PSD ============ */
function printPlan(e) {
  const pl = normPlan(e.plan), el = document.createElement("div"); el.className = "print-only";
  el.innerHTML = `<div class="pfiche"><header><div><h1>${esc(pl.theme || e.theme || "Training")}</h1><p>${esc(S.team?.name || "")} · ${cap(dLong(e.date))}${e.start_time ? ", " + tm(e.start_time) + (e.end_time ? "–" + tm(e.end_time) : "") : ""}${e.location ? " · " + esc(e.location) : ""}</p></div><img src="icons/icon-192.png" alt=""></header>
    <dl class="pmeta"><div><dt>Thema</dt><dd>${esc(pl.theme || e.theme || "–")}</dd></div><div><dt>Aantal spelers</dt><dd>${esc(pl.players || "–")}</dd></div><div><dt>Materiaal</dt><dd>${esc(pl.material || "–")}</dd></div><div><dt>Intensiteit</dt><dd>${pl.intensity ? pl.intensity + " – " + INTENS[pl.intensity] : "–"}</dd></div><div><dt>Totale duur</dt><dd>${planMinutes(pl)} min</dd></div></dl>
    ${pl.goal ? `<p class="pgoal"><b>Doel:</b> ${esc(pl.goal)}</p>` : ""}
    ${pl.items.map(x => `<section class="pex"><div class="ptxt"><h2>${esc(x.phase)} : ${esc(x.name || "Oefening")}</h2>
      ${x.cats?.length ? `<p><b>Categorie:</b><br>${x.cats.map(c => "- " + esc(c)).join("<br>")}</p>` : ""}
      <p>${[["Duurtijd", exMinutes(x) ? exMinutes(x) + " min." : ""], ["Intensiteit", x.intensity ? x.intensity + " - " + INTENS[x.intensity] : ""], ["Duur van de inspanning", x.work], ["Duur van de rust", x.rest ? x.rest + " sec." : ""], ["Aantal herhalingen", x.reps]].filter(([, val]) => val).map(([k, val]) => `<b>${k}:</b> ${esc(val)}`).join("<br>")}</p>
      ${x.org ? `<h3>Opstelling / Organisatie &amp; richtlijnen</h3><p>${esc(x.org).replace(/\n/g, "<br>")}</p>` : ""}${x.criteria ? `<h3>Uitvoeringscriteria / Aandachtspunten</h3><p>${esc(x.criteria).replace(/\n/g, "<br><br>")}</p>` : ""}
      ${x.material ? `<h3>Materiaal</h3><p>${esc(x.material)}</p>` : ""}${x.size ? `<h3>Afmetingen</h3><p>${esc(x.size)}</p>` : ""}</div>
      <div class="pimg">${x.diagram && x.diagram.objs?.length ? diagramSVG(x.diagram) : x.img ? `<img src="${esc(x.img)}" alt="">` : x.diagram ? diagramSVG(x.diagram) : ""}</div></section>`).join("")}
    <footer>OGV Trainers · Kvv OG Vorselaar</footer></div>`;
  document.body.appendChild(el); document.documentElement.classList.add("printing");
  const done = () => { el.remove(); document.documentElement.classList.remove("printing"); removeEventListener("afterprint", done); };
  addEventListener("afterprint", done); setTimeout(() => print(), 150);
}

/* ============ mijn oefeningen ============ */
route("oefeningen", { title: "Mijn oefeningen", auth: true, render: async v => {
  v.innerHTML = head("Mijn oefeningen", "Laden…"); const mine = await items.list("oefening");
  let q = "";
  const draw = () => { const t = q.toLowerCase(), list = mine.filter(m => !t || (m.title + " " + (m.data.cats || []).join(" ") + " " + (m.data.org || "")).toLowerCase().includes(t));
    v.innerHTML = head("Mijn oefeningen", "Je persoonlijke oefenstof. Alleen jij ziet deze oefeningen. Je kan ze in elke training gebruiken.", `<input type="search" id="oq" placeholder="Zoeken" value="${esc(q)}" style="width:min(260px,100%)"><button class="btn" type="button" id="new">${IC.plus}Nieuwe oefening</button>`) +
      (list.length ? `<div class="exs">${list.map((m, i) => `<article class="excard"><div class="pic">${m.data.diagram ? diagramSVG(m.data.diagram) : m.data.img ? `<img src="${esc(m.data.img)}" alt="">` : ""}</div><div class="bd"><b style="font-size:17px">${esc(m.title)}</b>
        ${m.data.cats?.length ? `<div class="chips">${m.data.cats.map(c => `<span class="pill g">${esc(c)}</span>`).join("")}</div>` : ""}<small class="muted">${esc([m.data.phase, exMinutes(m.data) ? exMinutes(m.data) + " min" : "", m.data.size].filter(Boolean).join(" · "))}</small>${m.data.org ? `<p class="clamp">${esc(m.data.org)}</p>` : ""}
        <div class="row" style="margin-top:auto;gap:6px"><button class="btn small" type="button" data-ed="${m.id}">Bewerken</button><button class="link" type="button" data-cp="${m.id}">Kopie</button><span class="spacer"></span><button class="link" type="button" data-del="${m.id}">✕</button></div></div></article>`).join("")}</div>`
      : `<div class="empty"><b>${mine.length ? "Niets gevonden" : "Nog geen eigen oefeningen"}</b>Maak een oefening met een veldtekening, of klik op "Bewaar" bij een oefening in een training.</div>`);
    $("#oq").oninput = e => { q = e.target.value; draw(); const o = $("#oq"); o.focus(); o.setSelectionRange(o.value.length, o.value.length); };
    $("#new").onclick = () => exEditor({ id: uid(), phase: "Kern", name: "", cats: [], rest: 60, diagram: { field: "5v5", objs: [] } }, async x => { const r = await safe(() => items.save({ kind: "oefening", title: x.name, data: exData(x) }), "Oefening opgeslagen."); if (r) { mine.unshift(r); draw(); } });
    $$("[data-ed]", v).forEach(b => b.onclick = () => { const m = mine.find(z => z.id === b.dataset.ed); exEditor({ ...JSON.parse(JSON.stringify(m.data)), name: m.data.name || m.title }, async x => { m.title = x.name; m.data = exData(x); await safe(() => items.save(m), "Oefening opgeslagen."); draw(); }); });
    $$("[data-cp]", v).forEach(b => b.onclick = async () => { const m = mine.find(z => z.id === b.dataset.cp); const r = await safe(() => items.save({ kind: "oefening", title: m.title + " (kopie)", data: { ...JSON.parse(JSON.stringify(m.data)), name: m.title + " (kopie)" } }), "Kopie gemaakt."); if (r) { mine.unshift(r); draw(); } });
    $$("[data-del]", v).forEach(b => b.onclick = async () => { const m = mine.find(z => z.id === b.dataset.del); if (!confirm(`"${m.title}" verwijderen?`)) return; await safe(() => items.del(m), "Oefening verwijderd."); mine.splice(mine.indexOf(m), 1); draw(); });
  };
  draw();
} });
