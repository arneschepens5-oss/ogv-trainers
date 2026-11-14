/* FootballCoachHub — editors voor de evaluatievragen van de club (Beheer > Instellingen > Evaluaties).
   De club kiest zelf: de onderdelen die de trainer scoort, extra open vragen voor de trainer
   en de vragenlijst die spelers zelf invullen (zelfevaluatie). Gebruikt door club.js. */
"use strict";
const csRow = (cls, attrs, inner) => `<div class="csr ${cls}" ${attrs || ""}>${inner}<span class="csctl"><button type="button" class="ib" data-mv="-1" aria-label="Omhoog">↑</button><button type="button" class="ib" data-mv="1" aria-label="Omlaag">↓</button><button type="button" class="ib" data-del aria-label="Verwijderen">×</button></span></div>`;
const csCritRow = raw => { const l = String(raw || "").trim(); if (!l) return "";
  if (l.startsWith("#")) return csRow("csg", 'data-t="g"', `<input name="n" maxlength="40" placeholder="Naam van de groep, bv. Techniek" value="${esc(l.replace(/^#+\s*/, ""))}" aria-label="Groep">`);
  const [n, h] = l.split(/\s+\|\s+/);
  return csRow("csi", 'data-t="i"', `<input name="n" maxlength="40" placeholder="Onderdeel, bv. Passing" value="${esc((n || "").trim())}" aria-label="Onderdeel"><input name="h" maxlength="120" placeholder="Uitleg voor de trainer (optioneel)" value="${esc((h || "").trim())}" aria-label="Uitleg">`); };
const csOpenRow = q => csRow("cso", `data-id="${esc(q.id || evQid())}"`, `<input name="t" maxlength="160" placeholder="Vraag, bv. Wat is de volgende stap voor deze speler?" value="${esc(q.text || "")}" aria-label="Vraag">`);
const csLinkOpts = (crits, sel) => `<option value="">Niet vergelijken</option>` + crits.map(c => `<option${c === sel ? " selected" : ""}>${esc(c)}</option>`).join("");
const csSelfRow = (q, crits) => csRow("csq", `data-id="${esc(q.id || evQid())}" data-ty="${q.type === "tekst" ? "tekst" : "schaal"}"`,
  `<select name="ty" aria-label="Soort vraag"><option value="schaal"${q.type === "tekst" ? "" : " selected"}>Schaal</option><option value="tekst"${q.type === "tekst" ? " selected" : ""}>Open antwoord</option></select>
   <input name="t" maxlength="160" placeholder="Vraag, in woorden van een kind" value="${esc(q.text || "")}" aria-label="Vraag">
   <select name="l" aria-label="Vergelijken met onderdeel van de trainer" title="Welk onderdeel van de trainer hoort hierbij? Dan zie je beide scores naast elkaar.">${csLinkOpts(crits, q.link)}</select>`);
const csCritNames = lines => lines.filter(l => !String(l).trim().startsWith("#")).map(l => String(l).split(/\s+\|\s+/)[0].trim()).filter(Boolean);

function csEvalEditorsHtml(ev) {
  const tpl = Array.isArray(ev.template) && ev.template.length ? ev.template : EV_TEMPLATE_DEFAULT, crits = csCritNames(tpl);
  const sf = ev.self || {}, qs = (Array.isArray(sf.questions) ? sf.questions : []).map(evCleanQ), open = (Array.isArray(ev.open) ? ev.open : []).map(evCleanQ);
  return `<h2>Wat evalueren jullie?</h2><p class="hint" style="margin-top:0">Dit zijn de onderdelen waar de trainer een score voor geeft, in groepen. Voeg gerust eigen onderdelen toe, hernoem of verwijder ze. Dit wordt de standaard voor nieuwe ploegen; een trainer kan het voor zijn ploeg nog aanpassen.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn ghost small" type="button" data-tpl="std">Uitgebreid (21 onderdelen)</button><button class="btn ghost small" type="button" data-tpl="kort">Kort, voor de jongsten (9 onderdelen)</button></div>
    <div id="cscrit" class="cslist">${tpl.map(csCritRow).join("")}</div>
    <div class="row" style="gap:16px;margin:4px 0 8px"><button class="link" type="button" id="csaddg">${IC.plus}Groep toevoegen</button><button class="link" type="button" id="csaddi">${IC.plus}Onderdeel toevoegen</button></div>
    <h2>Extra vragen voor de trainer</h2><p class="hint" style="margin-top:0">Open vragen die de trainer bij elke speler beantwoordt, naast de scores. Ze komen ook op het rapport voor het oudergesprek.</p>
    <div id="csopen" class="cslist">${open.map(csOpenRow).join("")}</div><button class="link" type="button" id="csaddo" style="margin:4px 0 8px">${IC.plus}Vraag toevoegen</button>
    <h2>Zelfevaluatie door de spelers</h2>
    <label class="csmod" style="max-width:640px"><span><b>Spelers evalueren zichzelf</b><small>Per moment zet de trainer dit open voor zijn ploeg. Spelers of ouders vullen de vragen in via hun persoonlijke link in de app. Zo zie je naast jouw score wat de speler zelf vindt.</small></span><span class="tgl"><input type="checkbox" name="selfon"${sf.on === true ? " checked" : ""}><span></span></span></label>
    <div id="csself"${sf.on === true ? "" : " hidden"}>
      <p class="hint">Voor kinderen tot 9 jaar raden we de korte lijst met smileys aan: ouders vullen die samen met hun kind in. Vanaf 10 jaar kan een speler dit zelf met cijfers.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">${Object.entries(EV_SELF_PRESETS).map(([k, p]) => `<button class="btn ghost small" type="button" data-sp="${k}">${esc(p.naam)}</button>`).join("")}</div>
      <div class="row" style="gap:18px;flex-wrap:wrap;margin-bottom:8px">
        <label class="chkl"><input type="radio" name="sscale" value="smiley"${sf.scale === "cijfers" ? "" : " checked"}><span>Smileys <span class="hint">${[1, 2, 3, 4, 5].map(n => EV_FACES[n]).join(" ")}</span></span></label>
        <label class="chkl"><input type="radio" name="sscale" value="cijfers"${sf.scale === "cijfers" ? " checked" : ""}><span>Cijfers 1 tot 5</span></label></div>
      <label class="f full" style="display:block;margin-bottom:10px">Korte uitleg bovenaan de lijst<input name="selfintro" maxlength="200" value="${esc(sf.intro || "")}" placeholder="bv. Vul dit samen met je mama of papa in. Er zijn geen foute antwoorden."></label>
      <div id="csslist" class="cslist">${qs.map(q => csSelfRow(q, crits)).join("")}</div><button class="link" type="button" id="csaddq" style="margin:4px 0 8px">${IC.plus}Vraag toevoegen</button>
    </div></div>`;
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
  sl.addEventListener("change", e => { if (e.target.name === "ty") e.target.closest(".csr").dataset.ty = e.target.value; });
  const add = (host, html, focus = "input") => { host.insertAdjacentHTML("beforeend", html); host.lastElementChild.querySelector(focus)?.focus(); };
  $("#csaddg", f).onclick = () => add(crit, csCritRow("# "));
  $("#csaddi", f).onclick = () => add(crit, csCritRow("x").replace('value="x"', 'value=""'));
  $("#csaddo", f).onclick = () => add(open, csOpenRow({}));
  $("#csaddq", f).onclick = () => add(sl, csSelfRow({ type: "schaal" }, names()));
  f.selfon.onchange = () => { self.hidden = !f.selfon.checked; };
  $$("[data-tpl]", f).forEach(b => b.onclick = () => { crit.innerHTML = (b.dataset.tpl === "kort" ? EV_TEMPLATE_SHORT : EV_TEMPLATE_DEFAULT).map(csCritRow).join(""); refresh(); });
  $$("[data-sp]", f).forEach(b => b.onclick = () => { const p = EV_SELF_PRESETS[b.dataset.sp];
    if ($$(".csr", sl).length && !confirm("De vragen van de zelfevaluatie worden vervangen door deze lijst. Doorgaan?")) return;
    f.sscale.value = p.scale; f.selfintro.value = p.intro; sl.innerHTML = p.questions.map(q => csSelfRow({ ...q, link: names().includes(q.link) ? q.link : "" }, names())).join(""); });
  return () => {
    const lines = csCritLines(crit), items = csCritNames(lines);
    if (!items.length) return { err: "Vul minstens één onderdeel in." };
    const dup = items.find((n, i) => items.indexOf(n) !== i); if (dup) return { err: `Het onderdeel "${dup}" staat twee keer in de lijst. Geef elk onderdeel een andere naam.` };
    const oq = $$(".csr", open).map(r => ({ id: r.dataset.id, text: $("[name=t]", r).value.trim() })).filter(q => q.text).map(evCleanQ).map(q => ({ id: q.id, text: q.text }));
    const sq = $$(".csr", sl).map(r => { const ty = $("[name=ty]", r).value, l = $("[name=l]", r).value; return { id: r.dataset.id, type: ty, text: $("[name=t]", r).value.trim(), ...(ty === "schaal" && items.includes(l) ? { link: l } : {}) }; }).filter(q => q.text).map(evCleanQ);
    const on = f.selfon.checked; if (on && !sq.length) return { err: "Zet minstens één vraag in de zelfevaluatie, of zet ze uit." };
    return { template: lines, open: oq, self: { on, scale: f.sscale.value === "cijfers" ? "cijfers" : "smiley", intro: f.selfintro.value.trim().slice(0, 200), questions: sq } }; };
}
/* de lijst met onderdelen terug naar tekstregels: "# Groep" en "Naam | uitleg" */
function csCritLines(host) { return $$(".csr", host).map(r => { const n = $("[name=n]", r).value.trim().replace(/\|/g, "/").replace(/^#+\s*/, ""); if (!n) return null;
  if (r.dataset.t === "g") return "# " + n; const h = ($("[name=h]", r)?.value || "").trim().replace(/\|/g, "/"); return h ? n + " | " + h : n; }).filter(Boolean); }
