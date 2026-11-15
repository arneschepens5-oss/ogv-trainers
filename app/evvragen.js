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

function csEvalEditorsHtml(ev, forProfile, isc) {
  const tpl = Array.isArray(ev.template) && ev.template.length ? ev.template : EV_TEMPLATE_DEFAULT, crits = csCritNames(tpl);
  const sf = ev.self || {}, qs = (Array.isArray(sf.questions) ? sf.questions : []).map(evCleanQ).map(evSelfQ).filter(Boolean), open = evOpenList(ev.open);
  return `<h2>Wat evalueren jullie?</h2><p class="hint" style="margin-top:0">Dit zijn de onderdelen waar de trainer een score voor geeft, in groepen. Voeg gerust eigen onderdelen toe, hernoem of verwijder ze. ${forProfile ? "Dit geldt voor de gekozen ploegen; hun trainers kunnen dit niet aanpassen." : "Dit wordt de standaard voor nieuwe ploegen; een trainer kan het voor zijn ploeg nog aanpassen."}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn ghost small" type="button" data-tpl="std">Uitgebreid (21 onderdelen)</button><button class="btn ghost small" type="button" data-tpl="kort">Kort, voor de jongsten (9 onderdelen)</button>${isc ? `<button class="btn ghost small" type="button" data-tpl="ogv">Fiche OG Vorselaar (6 blokken + keeper)</button>` : ""}</div>
    <div id="cscrit" class="cslist">${tpl.map(csCritRow).join("")}</div>
    <div class="row" style="gap:16px;margin:4px 0 8px"><button class="link" type="button" id="csaddg">${IC.plus}Groep toevoegen</button><button class="link" type="button" id="csaddi">${IC.plus}Onderdeel toevoegen</button></div>
    <h2>Extra vragen voor de trainer</h2><p class="hint" style="margin-top:0">Open vragen die de trainer bij elke speler beantwoordt, naast de scores. Ze komen ook op het rapport voor het oudergesprek.</p>
    <p class="hint">Kies per vraag de soort. ${isc ? "Alles in de interne scouting is intern. De vragen <b>Potentieel</b> en <b>Advies</b> gebruik je ook om op te zoeken in Interne scouting: laat hun naam en keuzes staan." : "Vink <b>intern</b> aan voor wat enkel voor de trainers is: dat komt niet op het rapport voor de ouders."}</p>
    ${isc ? `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn ghost small" type="button" id="csogvq">Vragen van de fiche OG Vorselaar</button></div>` : ""}
    <div id="csopen" class="cslist">${open.map(csOpenRow).join("")}</div><button class="link" type="button" id="csaddo" style="margin:4px 0 8px">${IC.plus}Vraag toevoegen</button>
    <div class="csselfwrap"${isc ? " hidden" : ""}><h2>Zelfevaluatie door de spelers</h2>
    <label class="csmod" style="max-width:640px"><span><b>Spelers evalueren zichzelf</b><small>Per moment zet de trainer dit open voor zijn ploeg. Spelers of ouders vullen de vragen in via hun persoonlijke link in de app. Zo zie je naast jouw score wat de speler zelf vindt.</small></span><span class="tgl"><input type="checkbox" name="selfon"${sf.on === true ? " checked" : ""}><span></span></span></label>
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
  if ($("#csogvq", f)) $("#csogvq", f).onclick = () => { if ($$(".csr", open).length && !confirm("De open vragen worden vervangen door de vragen van de fiche van de interne scouting. Doorgaan?")) return; open.innerHTML = EV_OPEN_OGV.map(csOpenRow).join(""); };
  const add = (host, html, focus = "input") => { host.insertAdjacentHTML("beforeend", html); host.lastElementChild.querySelector(focus)?.focus(); };
  $("#csaddg", f).onclick = () => add(crit, csCritRow("# "));
  $("#csaddi", f).onclick = () => add(crit, csCritRow("x").replace('value="x"', 'value=""'));
  $("#csaddo", f).onclick = () => add(open, csOpenRow({}));
  $("#csaddq", f).onclick = () => add(sl, csSelfRow({ type: "schaal" }, names()));
  f.selfon.onchange = () => { self.hidden = !f.selfon.checked; };
  $$("[data-tpl]", f).forEach(b => b.onclick = () => { crit.innerHTML = (b.dataset.tpl === "kort" ? EV_TEMPLATE_SHORT : b.dataset.tpl === "ogv" ? EV_TEMPLATE_OGV : EV_TEMPLATE_DEFAULT).map(csCritRow).join("");
    if (b.dataset.tpl === "ogv" && !$$(".csr", open).length) open.innerHTML = EV_OPEN_OGV.map(csOpenRow).join(""); refresh(); });
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

/* ============ evaluatie per leeftijd: de beheerder geeft groepen ploegen een eigen evaluatie en zelfevaluatie ============ */
const evProfiles = (st = CLUB.settings || {}) => (Array.isArray(st.eval?.profiles) ? st.eval.profiles : []).filter(p => p && p.id);
const evProfileOf = (teamId, st) => teamId ? evProfiles(st).find(p => (p.teams || []).includes(teamId)) || null : null;
const evAgeOf = t => { const m = String(t.category || t.name || "").match(/U\s?(\d+)/i); return m ? +m[1] : 99; };
function csProfiles(host, st, save) {
  const club = st.eval || {}, profs = evProfiles(st), teams = [...(S.teams || [])].sort((a, b) => evAgeOf(a) - evAgeOf(b) || String(a.name).localeCompare(String(b.name)));
  const tName = id => { const t = teams.find(x => x.id === id); return t ? (typeof teamLbl === "function" ? teamLbl(t) : t.name) : "?"; };
  const used = new Set(profs.flatMap(p => p.teams || [])), rest = teams.filter(t => !used.has(t.id));
  const nCrit = tpl => csCritNames(tpl || []).length, nSelf = p => p.self?.on ? (p.self.questions || []).length : 0;
  const card = (p, std) => `<div class="evp${std ? " std" : ""}"><div class="evph"><span class="evpi">${std ? IC.gear : IC.star}</span><div><b>${esc(std ? "Standaard van de club" : p.name)}</b>
      <small>${nCrit(std ? (club.template || EV_TEMPLATE_DEFAULT) : p.template)} onderdelen · ${(std ? club.self?.on : p.self?.on) ? nSelf(std ? club : p) + " vragen zelfevaluatie" : "geen zelfevaluatie"}</small></div>
      ${std ? "" : `<button class="btn ghost small" type="button" data-pe="${p.id}">Bewerken</button>`}</div>
    <div class="evpt">${(std ? rest.map(t => t.id) : p.teams || []).map(id => `<span class="pill">${esc(tName(id))}</span>`).join("") || `<span class="hint">${std ? "Alle ploegen hebben een eigen evaluatie." : "Nog geen ploegen gekozen."}</span>`}</div>
    ${std ? `<p class="hint" style="margin:8px 0 0">Stel je hieronder in op deze pagina.</p>` : ""}</div>`;
  host.innerHTML = `<h2>Evaluatie per leeftijd</h2><p class="hint" style="margin-top:0">Geef jonge en oudere spelers een andere evaluatie. Een groep ploegen krijgt dan eigen onderdelen voor de trainer en een eigen zelfevaluatie. Ploegen die je nergens kiest, volgen de standaard van de club.</p>
    <div class="evps">${profs.map(p => card(p)).join("")}${card(null, true)}</div>
    <button class="btn ghost small" type="button" id="evpnew" style="margin:10px 0 6px">${IC.plus}Evaluatie voor een leeftijd toevoegen</button>`;
  const persist = async (list, changed, msg) => {
    const cur = CLUB.settings || st, ev = { ...(cur.eval || {}), profiles: list };
    if (!(await save({ eval: ev }, msg))) return false;
    /* de onderdelen van de trainer staan per ploeg: zet ze voor de ploegen die veranderden */
    const tplOf = id => (list.find(p => (p.teams || []).includes(id))?.template) || (ev.template?.length ? ev.template : EV_TEMPLATE_DEFAULT);
    for (const id of changed) { const t = (S.teams || []).find(x => x.id === id); if (!t) continue; const criteria = tplOf(id).slice();
      try { await db.save("teams", { ...t, criteria }); t.criteria = criteria; if (S.team?.id === id) S.team.criteria = criteria; } catch (x) {} }
    if (typeof evApplyClub === "function") evApplyClub(); render(); return true; };
  const edit = p => {
    const isNew = !p; p = p || { id: "p" + Date.now().toString(36), name: "", teams: [], template: EV_TEMPLATE_SHORT.slice(), open: [], self: { on: !!club.self?.on, scale: "smiley", intro: club.self?.intro || "", questions: (EV_SELF_PRESETS.jong?.questions || club.self?.questions || []).map(q => ({ ...q })) } };
    const sel = new Set(p.teams || []), owner = id => profs.find(x => x.id !== p.id && (x.teams || []).includes(id));
    const ages = [["U6–U9", 6, 9], ["U10–U13", 10, 13], ["U14–U17", 14, 17], ["U18 en ouder", 18, 99]];
    const d = dialog(`<form class="evpdlg" onsubmit="return false"><h2>${isNew ? "Evaluatie voor een leeftijd" : "Evaluatie bewerken"}</h2>
      <label class="f full">Naam<input name="pnaam" maxlength="40" value="${esc(p.name)}" placeholder="bv. Onderbouw (U6–U9)" required></label>
      <h3>Voor welke ploegen?</h3><div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">${ages.map(([l, a, b]) => `<button class="btn ghost small" type="button" data-age="${a}-${b}">${l}</button>`).join("")}<button class="link" type="button" data-age="none">Niets</button></div>
      <div class="evpteams">${teams.map(t => { const o = owner(t.id); return `<label class="evpt1"><input type="checkbox" value="${t.id}"${sel.has(t.id) ? " checked" : ""}><span><b>${esc(tName(t.id))}</b>${o ? `<small>nu: ${esc(o.name)}</small>` : ""}</span></label>`; }).join("") || `<p class="hint">Nog geen ploegen.</p>`}</div>
      ${csEvalEditorsHtml({ template: p.template, open: p.open, self: p.self }, true)}
      <div class="row csfoot">${isNew ? "" : `<button class="btn ghost" type="button" id="evpdel" style="color:var(--bad)">Verwijderen</button>`}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" type="button" id="evpok">Bewaren</button></div></form>`, "wide");
    const f = $("form", d), collect = csEvalEditorsBind(f);
    $$("[data-age]", d).forEach(b => b.onclick = () => { const [a, z] = b.dataset.age === "none" ? [0, -1] : b.dataset.age.split("-").map(Number);
      $$(".evpteams input", d).forEach(c => { const t = teams.find(x => x.id === c.value), g = evAgeOf(t); if (b.dataset.age === "none") c.checked = false; else if (g >= a && g <= z) c.checked = true; }); });
    const before = new Set(p.teams || []);
    $("#evpok", d).onclick = async () => { const name = f.pnaam.value.trim(); if (!name) { toast("Geef de evaluatie een naam."); f.pnaam.focus(); return; }
      const q = collect(); if (q.err) { toast(q.err); return; }
      const chosen = $$(".evpteams input", d).filter(c => c.checked).map(c => c.value);
      const np = { id: p.id, name, teams: chosen, template: q.template, open: q.open, self: q.self };
      const list = profs.filter(x => x.id !== p.id).map(x => ({ ...x, teams: (x.teams || []).filter(id => !chosen.includes(id)) })).concat([np]);
      const changed = new Set([...before, ...chosen]);
      if (await persist(list, changed, isNew ? "Evaluatie toegevoegd." : "Evaluatie bewaard.")) d.close(); };
    const del = $("#evpdel", d); if (del) del.onclick = async () => { if (!confirm(`"${p.name}" verwijderen? De ploegen volgen dan weer de standaard van de club. Ingevulde evaluaties blijven bewaard.`)) return;
      if (await persist(profs.filter(x => x.id !== p.id), new Set(p.teams || []), "Evaluatie verwijderd.")) d.close(); };
  };
  $("#evpnew", host).onclick = () => edit(null);
  $$("[data-pe]", host).forEach(b => b.onclick = () => edit(profs.find(p => p.id === b.dataset.pe)));
}

/* ============ fiche per ploeg: snel wisselen (Evaluaties en Beheer › Ploegen en trainers) ============ */
const evProfSum = (p, st = CLUB.settings || {}) => { const ev = st.eval || {}, tpl = p ? p.template : (ev.template?.length ? ev.template : EV_TEMPLATE_DEFAULT), open = p ? p.open : ev.open, self = p ? p.self : ev.self;
  const n = csCritNames(tpl || []).length, oq = evOpenList(open).filter(q => q.type !== "kop").length;
  return [n + " onderdelen", oq ? oq + " open vragen" : "", self?.on ? "zelfevaluatie aan" : "zonder zelfevaluatie"].filter(Boolean).join(" · "); };
function evFicheSelect(teamId, attr) {
  const profs = evProfiles(), cur = evProfileOf(teamId);
  return `<select ${attr} aria-label="Evaluatiefiche van deze ploeg"><option value=""${cur ? "" : " selected"}>Standaard van de club</option>${profs.map(p => `<option value="${esc(p.id)}"${cur?.id === p.id ? " selected" : ""}>${esc(p.name || "Zonder naam")}</option>`).join("")}</select>`;
}
async function evSetTeamProfile(teamId, profId) {
  const st = CLUB.settings || {}, ev = { ...(st.eval || {}) };
  const profs = evProfiles(st).map(p => ({ ...p, teams: (p.teams || []).filter(id => id !== teamId) })), pr = profId ? profs.find(p => p.id === profId) : null;
  if (pr) pr.teams.push(teamId);
  if (!(await csCtxOwn().saveAll(CLUB.name, CLUB.short, { ...st, eval: { ...ev, profiles: profs } }, pr ? `Deze ploeg evalueert nu met "${pr.name}".` : "Deze ploeg evalueert nu met de standaard van de club."))) return false;
  const t = (S.teams || []).find(x => x.id === teamId), criteria = (pr?.template?.length ? pr.template : ev.template?.length ? ev.template : EV_TEMPLATE_DEFAULT).slice();
  if (t) { try { await db.save("teams", { ...t, criteria }); t.criteria = criteria; if (S.team?.id === teamId) S.team.criteria = criteria; } catch (e) { toast(e.message || String(e)); } }
  if (typeof evApplyClub === "function") evApplyClub(); return true;
}
/* zelfevaluatie aan of uit voor de fiche van deze ploeg (geldt voor alle ploegen met dezelfde fiche) */
async function evSetSelf(teamId, on) {
  const st = CLUB.settings || {}, ev = { ...(st.eval || {}) }, profs = evProfiles(st).map(p => ({ ...p })), pr = profs.find(p => (p.teams || []).includes(teamId)) || null;
  const cur = { ...((pr ? pr.self : ev.self) || {}) }, t = (S.teams || []).find(x => x.id === teamId);
  cur.on = !!on; if (on && !(cur.questions || []).length) { const k = (t ? evAgeOf(t) : 99) <= 9 ? "jong" : "oud", ps = EV_SELF_PRESETS[k]; Object.assign(cur, { scale: ps.scale, intro: ps.intro, questions: ps.questions.map(q => ({ ...q })) }); }
  if (pr) pr.self = cur; else ev.self = cur;
  if (!(await csCtxOwn().saveAll(CLUB.name, CLUB.short, { ...st, eval: { ...ev, profiles: profs } }, on ? "Zelfevaluatie staat aan." : "Zelfevaluatie staat uit."))) return false;
  if (typeof evApplyClub === "function") evApplyClub(); return true;
}

/* ============ interne scouting: de tweede, interne fiche (beheerder) ============ */
async function iscSave(patch, msg) { const st = CLUB.settings || {}, ev = { ...(st.eval || {}) }, cur = { ...(ev.isc || {}) };
  const ok = await csCtxOwn().saveAll(CLUB.name, CLUB.short, { ...st, eval: { ...ev, isc: { ...cur, ...patch } } }, msg); return ok; }
async function iscSetTeam(teamId, on) { const c = iscCfg(), t = (S.teams || []).find(x => x.id === teamId) || { id: teamId };
  const byAge = c.on !== false && evAgeOf(t) >= (+c.from || 0), on_teams = c.on_teams.filter(x => x !== teamId), off_teams = c.off_teams.filter(x => x !== teamId);
  if (on && !byAge) on_teams.push(teamId); if (!on && byAge) off_teams.push(teamId);
  return iscSave({ on_teams, off_teams }, on ? "Interne scouting staat aan voor deze ploeg." : "Interne scouting staat uit voor deze ploeg."); }
function csIsc(host, st) {
  const draw = () => { const c = iscCfg(CLUB.settings || st), teams = (S.teams || []).slice().sort((a, b) => evAgeOf(a) - evAgeOf(b) || teamLbl(a).localeCompare(teamLbl(b), "nl", { numeric: true }));
    const n = csCritNames(c.template).length, oq = c.open.filter(q => q.type !== "kop").length, on = teams.filter(t => iscOn(t, CLUB.settings || st));
    host.innerHTML = `<h2>Interne scouting</h2><p class="hint" style="margin-top:0">Een tweede fiche naast de evaluatie: de trainer vult ze per moment apart in. Enkel voor de trainers en de club, nooit voor ouders of spelers. Hieruit komen het spelersprofiel en het zoeken in Interne scouting.</p>
      <div class="iscbox"><label class="csmod"><span><b>Interne scouting gebruiken</b><small>${n} onderdelen · ${oq} vragen</small></span><span class="tgl"><input type="checkbox" id="iscon"${c.on !== false ? " checked" : ""}><span></span></span></label>
        <label class="iscfrom"><span>Voor elke ploeg vanaf</span><select id="iscfrom">${[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(a => `<option value="${a}"${+c.from === a ? " selected" : ""}>U${a}</option>`).join("")}</select></label>
        <div class="iscbtns"><button class="btn small" type="button" id="iscedit">Onderdelen en vragen aanpassen</button></div></div>
      <div class="iscteams">${teams.map(t => `<label class="iscteam${iscOn(t, CLUB.settings || st) ? " on" : ""}"><input type="checkbox" data-it="${t.id}"${iscOn(t, CLUB.settings || st) ? " checked" : ""}><span>${esc(teamLbl(t))}</span></label>`).join("")}</div>
      <p class="hint" style="margin:6px 0 0">${on.length} van ${teams.length} ploegen. Vink een ploeg aan of uit om af te wijken van de leeftijd.</p>`;
    $("#iscon", host).onchange = async e => { if (await iscSave({ on: e.target.checked }, e.target.checked ? "Interne scouting staat aan." : "Interne scouting staat uit.")) draw(); };
    $("#iscfrom", host).onchange = async e => { if (await iscSave({ from: +e.target.value, on_teams: [], off_teams: [] }, "Bewaard.")) draw(); };
    $$("[data-it]", host).forEach(x => x.onchange = async () => { if (await iscSetTeam(x.dataset.it, x.checked)) draw(); });
    $("#iscedit", host).onclick = () => iscEdit(draw); };
  draw();
}
function iscEdit(after) {
  const c = iscCfg();
  const d = dialog(`<form class="evpdlg iscdlg" onsubmit="return false"><h2>Fiche van de interne scouting</h2><p class="hint" style="margin-top:0">De groepen zijn de hoeken van het spelersprofiel. Een groep die begint met <b>Keeper</b> geldt enkel voor doelmannen.</p>
    ${csEvalEditorsHtml({ template: c.template, open: c.open, self: { on: false } }, true, true)}
    <div class="row"><button class="btn ghost" type="button" id="iscreset">Fiche OG Vorselaar herstellen</button><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" type="button" id="iscok">Bewaren</button></div></form>`, "xl");
  const f = $("form", d), collect = csEvalEditorsBind(f);
  $("#iscreset", d).onclick = () => { if (!confirm("Alle onderdelen en vragen van de interne scouting terugzetten naar de fiche van OG Vorselaar?")) return;
    $("#cscrit", f).innerHTML = EV_TEMPLATE_OGV.map(csCritRow).join(""); $("#csopen", f).innerHTML = EV_OPEN_OGV.map(csOpenRow).join(""); };
  $("#iscok", d).onclick = async () => { const r = collect(); if (r.err) { toast(r.err); return; }
    if (await iscSave({ template: r.template, open: r.open.map(q => ({ ...q, intern: true })) }, "Fiche van de interne scouting bewaard.")) { d.close(); after && after(); } };
}
