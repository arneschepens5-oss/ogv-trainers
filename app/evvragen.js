/* FootballCoachHub — editors voor de evaluatievragen van de club (Beheer > Instellingen > Evaluaties).
   De club kiest zelf: de onderdelen die de trainer scoort, extra open vragen voor de trainer
   en de vragenlijst die spelers zelf invullen (zelfevaluatie). Gebruikt door club.js. */
"use strict";
const csRow = (cls, attrs, inner) => `<div class="csr ${cls}" ${attrs || ""}>${inner}<span class="csctl"><button type="button" class="ib" data-mv="-1" aria-label="Omhoog">↑</button><button type="button" class="ib" data-mv="1" aria-label="Omlaag">↓</button><button type="button" class="ib" data-del aria-label="Verwijderen">×</button></span></div>`;
const csCritRow = raw => { const l = String(raw || "").trim(); if (!l) return "";
  if (l.startsWith("#")) return csRow("csg", 'data-t="g"', `<input name="n" maxlength="40" placeholder="Naam van de groep, bv. Techniek" value="${esc(l.replace(/^#+\s*/, ""))}" aria-label="Groep">`);
  const [n, h] = l.split(/\s+\|\s+/);
  return csRow("csi", 'data-t="i"', `<input name="n" maxlength="40" placeholder="Onderdeel, bv. Passing" value="${esc((n || "").trim())}" aria-label="Onderdeel"><input name="h" maxlength="120" placeholder="Uitleg voor de trainer (optioneel)" value="${esc((h || "").trim())}" aria-label="Uitleg">`); };
const csOpenRow = q => { const ty = ["tekst", "keuze", "schaal", "kop"].includes(q.type) ? q.type : "tekst";
  return csRow("cso", `data-id="${esc(q.id || evQid())}" data-ty="${ty}"`, `<select name="ty" aria-label="Soort vraag">${[["tekst", "Open antwoord"], ["keuze", "Keuzelijst"], ["schaal", "Score 1 tot 5"], ["kop", "Tussentitel"]].map(([k, l]) => `<option value="${k}"${k === ty ? " selected" : ""}>${l}</option>`).join("")}</select>
   <input name="t" maxlength="160" placeholder="Vraag, bv. Wat is de volgende stap voor deze speler?" value="${esc(q.text || "")}" aria-label="Vraag">
   <input name="o" class="csopts" maxlength="600" placeholder="Keuzes, gescheiden door ; bv. Laag; Gemiddeld; Hoog" value="${esc((q.opts || []).join("; "))}" aria-label="Keuzes">
   <label class="csint" title="Niet op het rapport voor de ouders"><input type="checkbox" name="i"${q.intern ? " checked" : ""}> intern</label>`); };
const csLinkOpts = (crits, sel) => `<option value="">Niet vergelijken</option>` + crits.map(c => `<option${c === sel ? " selected" : ""}>${esc(c)}</option>`).join("");
const csSelfRow = (q, crits) => csRow("csq", `data-id="${esc(q.id || evQid())}" data-ty="${q.type === "tekst" ? "tekst" : "schaal"}"`,
  `<select name="ty" aria-label="Soort vraag"><option value="schaal"${q.type === "tekst" ? "" : " selected"}>Schaal</option><option value="tekst"${q.type === "tekst" ? " selected" : ""}>Open antwoord</option></select>
   <input name="t" maxlength="160" placeholder="Vraag, in woorden van een kind" value="${esc(q.text || "")}" aria-label="Vraag">
   <select name="l" aria-label="Vergelijken met onderdeel van de trainer" title="Welk onderdeel van de trainer hoort hierbij? Dan zie je beide scores naast elkaar.">${csLinkOpts(crits, q.link)}</select>`);
const csCritNames = lines => lines.filter(l => !String(l).trim().startsWith("#")).map(l => String(l).split(/\s+\|\s+/)[0].trim()).filter(Boolean);

function csEvalEditorsHtml(ev) {
  const M = evMaster({ eval: ev }), tpl = M.template, crits = csCritNames(tpl);
  const sf = ev.self || {}, qs = (Array.isArray(sf.questions) ? sf.questions : []).map(evCleanQ).map(evSelfQ).filter(Boolean), open = M.open;
  return `<h2>Onderdelen met een score</h2><p class="hint" style="margin-top:0">De trainer scoort elk onderdeel. De groepen zijn de hoeken van het spelersprofiel. Een groep die begint met <b>Keeper</b> geldt enkel voor doelmannen. Wat niet past bij een leeftijd, vink je af onder <b>Per leeftijd</b>; hier staat alles wat de club kan gebruiken.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn ghost small" type="button" data-tpl="ogv">Fiche OG Vorselaar herstellen</button></div>
    <div id="cscrit" class="cslist">${tpl.map(csCritRow).join("")}</div>
    <div class="row" style="gap:16px;margin:4px 0 8px"><button class="link" type="button" id="csaddg">${IC.plus}Groep toevoegen</button><button class="link" type="button" id="csaddi">${IC.plus}Onderdeel toevoegen</button></div>
    <h2>Vragen voor de trainer</h2><p class="hint" style="margin-top:0">Open vragen, keuzelijsten en scores naast de onderdelen. Tussentitels maken er inklapbare blokken van. Vink <b>intern</b> aan voor wat enkel voor trainers en club is: dat komt niet op het rapport. Sterktes, werkpunten en doelen staan al vast in elke evaluatie, die hoef je hier niet toe te voegen.</p>
    <p class="hint">Laat de vragen <b>Potentieel</b> en <b>Advies</b> staan: daarop zoek je in Interne scouting.</p>
    <div id="csopen" class="cslist">${open.map(csOpenRow).join("")}</div><button class="link" type="button" id="csaddo" style="margin:4px 0 8px">${IC.plus}Vraag toevoegen</button>
    <div class="csselfwrap"><h2>Eigen zelfevaluatie (optioneel)</h2>
    <label class="csmod" style="max-width:640px"><span><b>Eigen vragen voor de zelfevaluatie</b><small>Per leeftijd kies je de zelfevaluatie: een korte lijst met smileys, een uitgebreide met cijfers, of deze eigen vragen van de club.</small></span><span class="tgl"><input type="checkbox" name="selfon"${sf.on === true ? " checked" : ""}><span></span></span></label>
    <div id="csself"${sf.on === true ? "" : " hidden"}>
      <p class="hint"><b>Deze vragen staan los van de scores van de trainer.</b> Schrijf ze helemaal zelf, in kindertaal, en kies per vraag een schaal of een open antwoord. Koppelen aan een onderdeel van de trainer is optioneel en dient enkel om beide scores naast elkaar te tonen.</p>
      <p class="hint">Voor kinderen tot 9 jaar raden we de korte lijst met smileys aan: ouders vullen die samen met hun kind in. Vanaf 10 jaar kan een speler dit zelf met cijfers.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">${Object.entries(EV_SELF_PRESETS).map(([k, p]) => `<button class="btn ghost small" type="button" data-sp="${k}">${esc(p.naam)}</button>`).join("")}<button class="btn ghost small" type="button" id="csclrq">Leeg beginnen</button></div>
      <div class="row" style="gap:18px;flex-wrap:wrap;margin-bottom:8px">
        <label class="chkl"><input type="radio" name="sscale" value="smiley"${sf.scale === "cijfers" || sf.scale === "cijfers10" ? "" : " checked"}><span>Smileys <span class="hint">${[1, 2, 3, 4, 5].map(n => EV_FACES[n]).join(" ")}</span></span></label>
        <label class="chkl"><input type="radio" name="sscale" value="cijfers"${sf.scale === "cijfers" ? " checked" : ""}><span>Cijfers 1 tot 5</span></label>
        <label class="chkl"><input type="radio" name="sscale" value="cijfers10"${sf.scale === "cijfers10" ? " checked" : ""}><span>Cijfers 1 tot 10</span></label></div>
      <label class="f full" style="display:block;margin-bottom:10px">Korte uitleg bovenaan de lijst<input name="selfintro" maxlength="200" value="${esc(sf.intro || "")}" placeholder="bv. Vul dit samen met je mama of papa in. Er zijn geen foute antwoorden."></label>
      <div id="csslist" class="cslist">${qs.map(q => csSelfRow(q, crits)).join("")}</div><button class="link" type="button" id="csaddq" style="margin:4px 0 8px">${IC.plus}Vraag toevoegen</button>
    </div></div></div>`;
}

/* koppelt knoppen en lijsten; geeft een functie terug die de gekozen vragen verzamelt (of een foutmelding) */
function csEvalEditorsBind(f) {
  const crit = $("#cscrit", f), open = $("#csopen", f), sl = $("#csslist", f), self = $("#csself", f);
  [crit, open, sl].forEach(h => h.addEventListener("click", e => { const b = e.target.closest("button"), r = b?.closest(".csr"); if (!r) return;
    if (b.hasAttribute("data-del")) r.remove();
    else if (b.dataset.mv) { const up = +b.dataset.mv < 0, sib = up ? r.previousElementSibling : r.nextElementSibling; if (sib) h.insertBefore(up ? r : sib, up ? sib : r); } }));
  const names = () => csCritNames(csCritLines(crit));
  /* de keuzelijst "vergelijken met" volgt de onderdelen zoals ze nu in de lijst staan */
  const refresh = () => $$("select[name=l]", sl).forEach(s => { const cur = s.value; s.innerHTML = csLinkOpts(names(), cur); s.value = names().includes(cur) ? cur : ""; });
  sl.addEventListener("focusin", e => { if (e.target.name === "l") refresh(); }); sl.addEventListener("mousedown", e => { if (e.target.name === "l") refresh(); });
  [sl, open].forEach(h => h.addEventListener("change", e => { if (e.target.name === "ty") e.target.closest(".csr").dataset.ty = e.target.value; }));
  if ($("#csogvq", f)) $("#csogvq", f).onclick = () => { if ($$(".csr", open).length && !confirm("De vragen worden vervangen door de vragen van de fiche van OG Vorselaar. Doorgaan?")) return; open.innerHTML = EV_OPEN_OGV.map(csOpenRow).join(""); };
  const add = (host, html, focus = "input") => { host.insertAdjacentHTML("beforeend", html); host.lastElementChild.querySelector(focus)?.focus(); };
  $("#csaddg", f).onclick = () => add(crit, csCritRow("# "));
  $("#csaddi", f).onclick = () => add(crit, csCritRow("x").replace('value="x"', 'value=""'));
  $("#csaddo", f).onclick = () => add(open, csOpenRow({}));
  $("#csaddq", f).onclick = () => add(sl, csSelfRow({ type: "schaal" }, names()));
  f.selfon.onchange = () => { self.hidden = !f.selfon.checked; };
  $$("[data-tpl]", f).forEach(b => b.onclick = () => { if (!confirm("Alle onderdelen terugzetten naar de fiche van OG Vorselaar? Ingevulde evaluaties blijven bewaard.")) return; crit.innerHTML = EV_TEMPLATE_OGV.map(csCritRow).join(""); refresh(); });
  $("#csclrq", f).onclick = () => { if ($$(".csr", sl).length && !confirm("Alle vragen van de zelfevaluatie worden gewist. Doorgaan?")) return; sl.innerHTML = ""; add(sl, csSelfRow({ type: "schaal" }, names())); };
  $$("[data-sp]", f).forEach(b => b.onclick = () => { const p = EV_SELF_PRESETS[b.dataset.sp];
    if ($$(".csr", sl).length && !confirm("De vragen van de zelfevaluatie worden vervangen door deze lijst. Doorgaan?")) return;
    f.sscale.value = p.scale; f.selfintro.value = p.intro; sl.innerHTML = p.questions.map(q => csSelfRow({ ...q, link: names().includes(q.link) ? q.link : "" }, names())).join(""); });
  return () => {
    const lines = csCritLines(crit), items = csCritNames(lines);
    if (!items.length) return { err: "Vul minstens één onderdeel in." };
    const dup = items.find((n, i) => items.indexOf(n) !== i); if (dup) return { err: `Het onderdeel "${dup}" staat twee keer in de lijst. Geef elk onderdeel een andere naam.` };
    const oq = $$(".csr", open).map(r => ({ id: r.dataset.id, type: $("[name=ty]", r).value, text: $("[name=t]", r).value.trim(), opts: $("[name=o]", r).value, intern: $("[name=i]", r).checked })).filter(q => q.text).map(evCleanQ).map(q => { delete q.link; return q; });
    const bad = oq.find(q => q.type === "tekst" && $$(".csr", open).some(r => r.dataset.id === q.id && $("[name=ty]", r).value === "keuze")); if (bad) return { err: `Geef bij "${bad.text}" minstens één keuze op, gescheiden door ;` };
    const sq = $$(".csr", sl).map(r => { const ty = $("[name=ty]", r).value, l = $("[name=l]", r).value; return { id: r.dataset.id, type: ty, text: $("[name=t]", r).value.trim(), ...(ty === "schaal" && items.includes(l) ? { link: l } : {}) }; }).filter(q => q.text).map(evCleanQ);
    const on = f.selfon.checked; if (on && !sq.length) return { err: "Zet minstens één vraag in de zelfevaluatie, of zet ze uit." };
    return { template: lines, open: oq, self: { on, scale: ["cijfers", "cijfers10"].includes(f.sscale.value) ? f.sscale.value : "smiley", intro: f.selfintro.value.trim().slice(0, 200), questions: sq } }; };
}
/* de lijst met onderdelen terug naar tekstregels: "# Groep" en "Naam | uitleg" */
function csCritLines(host) { return $$(".csr", host).map(r => { const n = $("[name=n]", r).value.trim().replace(/\|/g, "/").replace(/^#+\s*/, ""); if (!n) return null;
  if (r.dataset.t === "g") return "# " + n; const h = ($("[name=h]", r)?.value || "").trim().replace(/\|/g, "/"); return h ? n + " | " + h : n; }).filter(Boolean); }

/* ============ per leeftijd: wat de trainers van die leeftijd zien ============
   De beheerder vinkt onderdelen en vragen af en kiest de zelfevaluatie. Zolang een leeftijd niet aangepast is, geldt het voorstel van de app. */
const CSA = { k: null, ages: null };
function csAgeTeams() { return [...(S.teams || [])].sort((a, b) => evAgeOf(a) - evAgeOf(b) || teamLbl(a).localeCompare(teamLbl(b), "nl", { numeric: true })); }
function csAges(host, st, getMaster) {
  const teams = csAgeTeams(), keys = [...new Set(teams.map(evAgeKey))].sort((a, b) => +a - +b);
  if (!CSA.ages) CSA.ages = JSON.parse(JSON.stringify((st.eval || {}).ages || {}));
  if (window.EV_AGE_PICK && keys.includes(window.EV_AGE_PICK)) { CSA.k = window.EV_AGE_PICK; window.EV_AGE_PICK = null; }
  if (!keys.includes(CSA.k)) CSA.k = keys[0] || null;
  const cfgOf = k => CSA.ages[k] ? { off: [], offq: [], self: "uit", ...CSA.ages[k], custom: true } : { ...evAgeSuggest(+k), custom: false };
  const SELF = [["uit", "Geen zelfevaluatie"], ["jong", "Kort, met smileys (samen met de ouders)"], ["oud", "Uitgebreid, met cijfers"], ["club", "Eigen vragen van de club"]];
  const draw = () => {
    if (!keys.length) { host.innerHTML = `<p class="hint">Nog geen ploegen. Maak eerst ploegen aan; daarna stel je hier per leeftijd de fiche in.</p>`; return; }
    const M = getMaster(), groups = evGroupsRaw({ criteria: M.template }), all = groups.flatMap(g => g.items.map(i => i.name)), qs = M.open, k = CSA.k, c = cfgOf(k);
    const off = new Set(c.off), offq = new Set(c.offq), qn = qs.filter(q => q.type !== "kop");
    const field = groups.filter(g => !evKeeperGroup(g)).flatMap(g => g.items.map(i => i.name)), cnt = kk => { const x = cfgOf(kk), o = new Set(x.off); return field.filter(n => !o.has(n)).length; };
    const secs = []; { let cur = null; for (const q of qs) { if (q.type === "kop") { cur = { kop: q.text, qs: [] }; secs.push(cur); continue; } if (!cur) { cur = { kop: "Algemeen", qs: [] }; secs.push(cur); } cur.qs.push(q); } }
    host.innerHTML = `<div class="agtabs" role="tablist" aria-label="Leeftijd">${keys.map(kk => `<button type="button" role="tab" data-ag="${kk}" aria-selected="${kk === k}"><b>${esc(evAgeLbl(kk))}</b><small>${cnt(kk)} onderdelen</small>${CSA.ages[kk] ? "" : '<i title="Voorstel van de app">voorstel</i>'}</button>`).join("")}</div>
      <div class="agcard">
        <div class="aghead"><div><h3>${esc(evAgeLbl(k))}</h3><small>${teams.filter(t => evAgeKey(t) === k).map(t => esc(teamLbl(t))).join(" · ")}</small></div>
          <div class="agtools"><select data-agcopy aria-label="Kopiëren van een andere leeftijd"><option value="">Kopiëren van…</option>${keys.filter(x => x !== k).map(x => `<option value="${x}">${esc(evAgeLbl(x))}</option>`).join("")}</select>
          <button class="btn ghost small" type="button" data-agsug>Voorstel van de app</button><button class="btn ghost small" type="button" data-agall>Alles aan</button></div></div>
        ${c.custom ? "" : `<p class="agnote">${IC.star}<span>Dit is het voorstel van de app voor deze leeftijd. Pas gerust aan; het wordt pas jullie keuze als je bewaart.</span></p>`}
        <label class="agself"><span><b>Zelfevaluatie door de spelers</b><small>De trainer zet ze per moment open in Evaluaties.</small></span><select data-agself>${SELF.map(([v, l]) => `<option value="${v}"${c.self === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <div class="agsec"><h4>Onderdelen <small>${all.filter(n => !off.has(n)).length} van ${all.length} aan</small></h4>
        ${groups.map(g => { const on = g.items.filter(i => !off.has(i.name)).length;
          return `<div class="aggrp${on ? "" : " none"}"><label class="aggh"><input type="checkbox" data-agg="${esc(g.name)}"${on === g.items.length ? " checked" : ""}${on && on < g.items.length ? ' data-mixed="1"' : ""}><b>${esc(g.name)}</b><small>${on}/${g.items.length}</small>${evKeeperGroup(g) ? '<em>enkel doelmannen</em>' : ""}</label>
            <div class="agchips">${g.items.map(i => `<label class="agc"><input type="checkbox" data-agi="${esc(i.name)}"${off.has(i.name) ? "" : " checked"}><span>${esc(i.name)}</span></label>`).join("")}</div></div>`; }).join("")}</div>
        <div class="agsec"><h4>Vragen <small>${qn.filter(q => !offq.has(q.id)).length} van ${qn.length} aan</small></h4>
        ${secs.filter(x => x.qs.length).map(x => { const on = x.qs.filter(q => !offq.has(q.id)).length;
          return `<details class="aggrp q${on ? "" : " none"}"><summary><b>${esc(x.kop)}</b><small>${on}/${x.qs.length}</small></summary><div class="agqs">${x.qs.map(q => `<label class="agq"><input type="checkbox" data-agq="${esc(q.id)}"${offq.has(q.id) ? "" : " checked"}><span>${esc(q.text)}${q.intern ? ' <span class="evint">intern</span>' : ""}</span></label>`).join("")}</div></details>`; }).join("")}</div>
      </div>`;
    $$("[data-mixed]", host).forEach(x => { x.indeterminate = true; });
    const save = patch => { const cur = cfgOf(k); CSA.ages[k] = { off: cur.off, offq: cur.offq, self: cur.self, ...patch }; const open = $$("details[open] summary b", host).map(b => b.textContent); draw(); $$("details summary b", host).forEach(b => { if (open.includes(b.textContent)) b.closest("details").open = true; }); };
    $$("[data-ag]", host).forEach(b => b.onclick = () => { CSA.k = b.dataset.ag; draw(); });
    $("[data-agself]", host).onchange = e => save({ self: e.target.value });
    $$("[data-agi]", host).forEach(x => x.onchange = () => { const o = new Set(cfgOf(k).off); if (x.checked) o.delete(x.dataset.agi); else o.add(x.dataset.agi); save({ off: [...o] }); });
    $$("[data-agg]", host).forEach(x => x.onchange = () => { const g = groups.find(g => g.name === x.dataset.agg), o = new Set(cfgOf(k).off); g.items.forEach(i => x.checked ? o.delete(i.name) : o.add(i.name)); save({ off: [...o] }); });
    $$("[data-agq]", host).forEach(x => x.onchange = () => { const o = new Set(cfgOf(k).offq); if (x.checked) o.delete(x.dataset.agq); else o.add(x.dataset.agq); save({ offq: [...o] }); });
    $("[data-agall]", host).onclick = () => save({ off: [], offq: [] });
    $("[data-agsug]", host).onclick = () => { const sg = evAgeSuggest(+k); save({ off: sg.off, offq: sg.offq, self: sg.self }); };
    $("[data-agcopy]", host).onchange = e => { const from = e.target.value; if (!from) return; const x = cfgOf(from); save({ off: [...x.off], offq: [...x.offq], self: x.self }); toast(`Overgenomen van ${evAgeLbl(from)}.`); };
  };
  draw();
  return { redraw: draw, value: () => JSON.parse(JSON.stringify(CSA.ages)), reset: () => { CSA.ages = null; } };
}
/* de onderdelen van elke ploeg ook op de ploeg zelf zetten (voor Interne scouting en oudere schermen) */
async function evSyncTeams(st = CLUB.settings || {}) {
  for (const t of S.teams || []) { const criteria = evTplFor(t, st).slice(); if (JSON.stringify(criteria) === JSON.stringify(t.criteria || [])) continue;
    try { await db.save("teams", { ...t, criteria }); t.criteria = criteria; if (S.team?.id === t.id) S.team.criteria = criteria; } catch (e) {} }
}
