/* OGV Platform — trainingsbibliotheek, animatiebord, wedstrijdblad en scouting.
   DEMO_PRINCIPLES zijn enkel voorbeelddata voor de demomodus. */
"use strict";

/* ============ trainingsbibliotheek ============ */
let LIB = null;
async function loadLib() { if (LIB) return LIB; LIB = await fetch("trainingen/trainingen.json", { cache: "no-cache" }).then(r => r.json()); return LIB; }
const LIB_MAPS = [["thema", "Thematrainingen", "Volledige trainingen per basisprincipe van het opleidingsplan."], ["oefenstof", "Oefenstof", "Losse oefeningen om je training mee op te bouwen."], ["opwarming", "Opwarming", "De vaste wedstrijdopwarming van de club."]];
const LIB_THEMAS = ["Techniek", "Duel 1v1", "Passing en balaanname", "Handelingssnelheid", "Positiespel", "Wedstrijdvormen"];
function libDetail(L, id) {
  const it = L.items.find(i => i.id === id); if (!it) return;
  const ext = it.orig ? it.orig.split(".").pop().toUpperCase() : "", bn = it.bouwen.map(b => L.bouwen.find(x => x.id === b).naam).join(", ");
  const logged = !!db && (mode === "demo" || !!user) && S.team;
  const d = dialog(`<div class="dlgv"><div class="media"><img src="trainingen/${esc(it.img)}" alt="Veldopstelling van ${esc(it.title)}"></div>
    <div class="info"><h2>${esc(it.title)}</h2><p style="margin:0;color:#D8DAD2">${esc(it.bedoeling)}</p>
    <dl class="facts">${it.principe ? `<dt>Basisprincipe</dt><dd>${esc(it.principe)} ${esc(PRINC[it.principe])}</dd>` : ""}${it.map === "oefenstof" ? `<dt>Thema</dt><dd>${esc(it.thema)}</dd>` : ""}
      <dt>Leeftijd</dt><dd>${esc(bn)}</dd>${it.vorm ? `<dt>Spelvorm</dt><dd>${esc(it.vorm)}</dd>` : ""}${it.veld ? `<dt>Veld</dt><dd>${esc(it.veld)}</dd>` : ""}<dt>Document</dt><dd>${it.pages} ${it.pages === 1 ? "pagina" : "pagina's"}</dd>${it.bron ? `<dt>Bron</dt><dd>${esc(it.bron)}</dd>` : ""}</dl>
    <div class="row" style="margin-top:auto"><a class="btn" href="trainingen/${esc(it.pdf)}" target="_blank" rel="noopener">${IC.eye}Training bekijken</a><a class="btn ghost" href="trainingen/${esc(it.pdf)}" download>${IC.dl}PDF</a>${it.orig ? `<a class="btn ghost" href="trainingen/${esc(it.orig)}" download>${IC.note}${ext}</a>` : ""}</div>
    ${logged ? `<button class="btn ghost" type="button" id="toPlan">${IC.plan}Toevoegen aan een training</button>` : ""}</div></div><button class="xbtn" type="button" data-close aria-label="Sluiten">${IC.x}</button>`, "wide");
  d.style.position = "relative";
  const tp = $("#toPlan", d); if (tp) tp.onclick = () => { const up = S.events.filter(e => e.type === "training" && e.date >= todayIso()).slice(0, 8);
    if (!up.length) { toast("Plan eerst een training in de kalender."); return; }
    const d2 = dialog(`<div class="dlg"><h2>Aan welke training toevoegen?</h2><div class="list">${up.map(e => `<div class="item" data-e="${e.id}"><span class="date"><b>${dDay(e.date)}</b><small>${dMon(e.date)}</small></span><span class="main"><b>${e.theme ? esc(e.theme) : "Training"}</b><small>${dShort(e.date)}</small></span>${IC.plus}</div>`).join("")}</div><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button></div></div>`);
    $$("[data-e]", d2).forEach(x => x.onclick = async () => { const e = S.events.find(z => z.id === x.dataset.e); e.plan = normPlan(e.plan);
      e.plan.items.push(exFromLib(it));
      await safe(() => putEvent(e), "Toegevoegd aan de training van " + dShort(e.date) + "."); d2.close(); }); };
}

/* ============ voorbeeldprincipes (demo) ============ */
const DEMO_PRINCIPLES = [
  { f: "5v5", m: "1A", t: "Opbouw tegen matige druk met inschuivende keeper", v: "5v5-opbouw-matige-druk", k: ["De keeper schuift in en maakt een extra veldspeler.", "Verdedigers zetten zich breed, tot tegen de zijlijn.", "Zoek eerst de vrije man voor je gaat dribbelen.", "Na de pass meteen opnieuw aanspeelbaar worden."] },
  { f: "5v5", m: "1A", t: "Opbouw tegen hoge druk met inschuivende keeper", v: "5v5-opbouw-hoge-druk", k: ["Met de keeper erbij heb je achteraan een man meer.", "Snel combineren in één of twee tijden.", "Durf over de eerste lijn van de tegenstander te spelen.", "De spits biedt zich aan om de bal vast te houden."] },
  { f: "5v5", m: "1B", t: "Drukzetten met drukkende keeper", v: "5v5-drukzetten-keeper", k: ["De dichtste speler zet meteen druk op de bal.", "Sluit samen de passlijnen in de buurt van de bal.", "De keeper schuift mee op en ruimt achter de lijn op.", "Samen opschuiven: niemand blijft achter hangen."] },
  { f: "5v5", m: "Basis", t: "Indribbelen", v: "5v5-indribbel", k: ["Na de indribbel eerst kijken: is er een vrije medespeler?", "Medespelers maken het veld breed en diep.", "Kies bewust tussen dribbelen en passen."] },
  { f: "8v8", m: "1A", t: "Opbouw zonder tegenstander, met lijnen op het veld", v: "8v8-opbouw-zonder-tegenstander", k: ["De 4 zakt uit tussen de centrale verdedigers.", "Eén back schuift hoger op.", "Gebruik de lijnen om de looplijnen en posities aan te leren."] },
  { f: "8v8", m: "1A", t: "Opbouw: de 4 zakt uit, één back gaat hoger, de flank komt mee in het middenveld", v: "8v8-opbouw-4-uitzakken-back-hoog", k: ["De 4 zakt uit en maakt de opbouw breder.", "De back aan de balkant schuift hoger op.", "De flankspeler komt binnen in het middenveld voor een extra aanspeelpunt."] },
  { f: "8v8", m: "1A", t: "Opbouw: de 4 en de 8 zakken uit, de backs gaan hoger", v: "8v8-opbouw-4-en-8-uitzakken", k: ["De 4 en de 8 zakken uit om overtal te maken.", "Beide backs schuiven op tot op de middenlijn.", "Zoek de vrije man en speel vooruit zodra het kan."] },
  { f: "8v8", m: "1A", t: "Opbouw: met de 4 die uitzakt een 4v3 creëren na een switch", v: "8v8-opbouw-4v3-na-switch", k: ["De 4 zakt uit en de bal gaat van kant.", "Na de switch ontstaat aan de andere kant een 4 tegen 3.", "Snel doorspelen voor de tegenstander kan bijschuiven."] },
  { f: "8v8", m: "1B", t: "Drukzetten met doorspringende spelers om de backs vast te zetten", v: "8v8-drukzetten-doorspringen", k: ["Een middenvelder springt door naar de back aan de balkant.", "Zo zetten we de backs van de tegenstander vast.", "De rest schuift mee in om de passlijnen te sluiten."] },
  { f: "8v8", m: "3A", t: "Omschakeling van balverlies naar balbezit", v: "8v8-omschakeling-balwinst", k: ["Na balwinst is de eerste actie vooruit gericht.", "De hoogste spelers lopen zich meteen vrij in de diepte en de breedte.", "Snel afronden voor de tegenstander georganiseerd staat."] },
  { f: "8v8", m: "3B", t: "Omschakeling van balbezit naar balverlies", v: "8v8-omschakeling-balverlies", k: ["Bij balverlies zet de dichtste speler meteen druk.", "Eerst de diepte afsluiten, dan de bal heroveren.", "Lukt druk zetten niet? Samen terugzakken achter de bal."] },
  { f: "8v8", m: "Basis", t: "Ingooi: vanuit een ingooi een doelkans creëren", v: "8v8-ingooi", k: ["Vaste posities en looplijnen bij elke ingooi.", "Bewegen om ruimte te maken voor de ontvanger.", "Na de ingooi meteen vooruit spelen richting doel."] }
];
/* ============ ingebouwde tools ============ */
function embed(v, src, title) { v.innerHTML = `<iframe class="embed" src="${src}" title="${esc(title)}" allow="clipboard-write; fullscreen" loading="eager"></iframe>`; }
route("animatiebord", { title: "Animatiebord", wide: true, render: (v, id) => embed(v, "tactiekbord/" + (id ? "#b-" + encodeURIComponent(id) : ""), "Animatiebord") });
route("matchday", { title: "Wedstrijdblad", wide: true, render: (v, id) => {
  if (S.team) { const next = (id && S.events.find(e => e.id === id)) || S.events.find(e => e.type === "wedstrijd" && e.date >= todayIso());
    const sel = next ? active().filter(p => { const a = attOf(next.id, p.id); return !a || a.status === "aanwezig" || a.status === "te laat"; }).map(p => p.id) : [];
    try { localStorage.setItem("ogv-matchday-import", JSON.stringify({ id: S.team.id, name: S.team.name, format: S.team.format || "5v5",
      squad: active().map(p => ({ id: p.id, name: pname(p), nr: p.number ?? "" })), sel, opp: next?.opponent || "", date: next?.date || "", kick: tm(next?.start_time), home: next ? (next.home === false ? "uit" : "thuis") : "" })); } catch (e) {} }
  embed(v, "matchday/?v=51", "Wedstrijdblad");
} });

/* ============ scouting ============ */
const SC_POS = { "Doelman": ["DOEL", 50, 90], "Rechtsachter": ["RA", 86, 70], "Linksachter": ["LA", 14, 70], "Centrale verdediger": ["CV", 50, 72], "Verdedigende middenvelder": ["VM", 50, 55], "Centrale middenvelder": ["CM", 50, 42], "Aanvallende middenvelder": ["AM", 50, 29], "Rechtsbuiten": ["RB", 86, 20], "Linksbuiten": ["LB", 14, 20], "Spits": ["SP", 50, 9] };
const SC_STAT = ["Nieuw", "Blijven volgen", "Opnieuw bekijken", "Uitnodigen", "Contact opnemen", "Afgevallen"];
const SC_COMP = ["Winning mindset", "Toekomstig fysiek potentieel", "Spelinzicht", "Bal- en lichaamscontrole", "Leervermogen"], SC_SH = ["Mindset", "Fysiek", "Inzicht", "Balcontrole", "Leren"];
const scNum = v => typeof v === "number" && !isNaN(v);
const scAvg = p => { const k = SC_COMP.map((c, i) => p["k" + i]); return k.every(scNum) ? k.reduce((a, b) => a + b, 0) / 5 : null; };
const scNiv = a => a == null ? "" : a >= 8 ? "Top talent" : a >= 7 ? "Interessant" : a >= 6 ? "Opvolgen" : "Onder niveau";
const scCol = v => `hsl(${Math.round((v - 1) * 13.3)},72%,46%)`;
let scTab = "db", scF = { q: "", p: "", s: "", n: "" };
route("scouting", { title: "Scouting", auth: true, render: async (v, id) => {
  v.innerHTML = head("Scoutingsdatabase", "Laden…"); const rows = await db.list("scouting"); const all = rows.map(r => ({ id: r.id, created_by: r.created_by, ...r.data }));
  if (id) { scoutForm(v, all.find(x => x.id === id) || null, all); return; }
  const list = all.filter(p => { const a = scAvg(p); return (!scF.q || (p.naam + " " + p.club).toLowerCase().includes(scF.q.toLowerCase())) && (!scF.p || [p.p1, p.p2, p.p3].includes(scF.p)) && (!scF.s || p.stat === scF.s) && (!scF.n || scNiv(a) === scF.n); })
    .sort((a, b) => (scAvg(b) ?? -1) - (scAvg(a) ?? -1) || (b.ts || 0) - (a.ts || 0));
  const sc5 = all.map(scAvg).filter(x => x != null);
  v.innerHTML = head("Scoutingsdatabase", "Eén gedeelde database voor alle trainers. Bevat gegevens van minderjarigen: deel ze enkel binnen de club.", `<button class="btn ghost" type="button" id="exp">${IC.dl}Excel</button><a class="btn" href="#/scouting/nieuw">${IC.plus}Nieuwe speler</a>`) +
  `<div class="kpis"><div class="kpi" style="background:var(--yellow);color:#000;border-color:var(--yellow)"><small style="color:#000">Spelers</small><b>${all.length}</b></div><div class="kpi"><small>Top talent</small><b>${all.filter(p => scNiv(scAvg(p)) === "Top talent").length}</b></div><div class="kpi"><small>Gemiddeld cijfer</small><b>${sc5.length ? f1(avg(sc5)) : "–"}</b></div><div class="kpi"><small>Nieuw</small><b>${all.filter(p => p.stat === "Nieuw").length}</b></div></div>
  <div class="fields sec scflt"><input id="fq" type="search" placeholder="Zoek op naam of club" value="${esc(scF.q)}"><select id="fp"><option value="">Positie</option>${Object.keys(SC_POS).map(x => `<option${scF.p === x ? " selected" : ""}>${x}</option>`).join("")}</select>
    <select id="fs"><option value="">Status</option>${SC_STAT.map(x => `<option${scF.s === x ? " selected" : ""}>${x}</option>`).join("")}</select><select id="fn"><option value="">Niveau</option>${["Top talent", "Interessant", "Opvolgen", "Onder niveau"].map(x => `<option${scF.n === x ? " selected" : ""}>${x}</option>`).join("")}</select></div>
  <p class="hint">${list.length} getoond</p>
  ${list.length ? `<div class="grid3">${list.map(p => { const a = scAvg(p), age = p.geb ? Math.floor((Date.now() - new Date(p.geb)) / 31557600000) : "";
    return `<a class="sc-card" href="#/scouting/${esc(p.id)}"><div class="hd"><span class="bg">${f1(a)}</span><span style="min-width:0"><b style="display:block;font-weight:800;font-stretch:112%;font-size:19px">${esc(p.naam)}</b><small class="muted">${esc([p.club, age ? age + " jaar" : "", p.voet ? p.voet + " voet" : ""].filter(Boolean).join(" · "))}</small>
      <span class="chips" style="margin-top:6px">${[p.p1, p.p2, p.p3].filter(Boolean).map(x => `<span class="pill g">${esc((SC_POS[x] || [x])[0])}</span>`).join("")}${a != null ? `<span class="pill ${a >= 8 ? "w" : "g"}">${scNiv(a)}</span>` : ""}</span></span></div>
      ${SC_COMP.map((c, i) => { const val = p["k" + i]; return `<div class="mbar"><span>${SC_SH[i]}</span><span class="b"><i style="width:${scNum(val) ? val * 10 : 0}%;background:${scNum(val) ? scCol(val) : "transparent"}"></i></span><b style="color:var(--ink);text-align:right">${scNum(val) ? f1(val) : "–"}</b></div>`; }).join("")}
      <div class="row hint"><span class="pill w">${esc(p.stat || "Nieuw")}</span><span class="spacer"></span>${esc(p.scout || "")}${p.dat ? " · " + esc(p.dat) : ""}</div></a>`; }).join("")}</div>`
    : `<div class="empty"><b>Nog geen spelers</b>Voeg de eerste gescoute speler toe.<br><a class="btn" href="#/scouting/nieuw">Nieuwe speler</a></div>`}`;
  const f = (sel, k) => $(sel).oninput = e => { scF[k] = e.target.value; render(); }; f("#fq", "q"); f("#fp", "p"); f("#fs", "s"); f("#fn", "n");
  $("#fq").focus(); const q = $("#fq"); q.setSelectionRange(q.value.length, q.value.length);
  $("#exp").onclick = () => { const h = ["Naam", "Club", "Geboortedatum", "Voorkeursvoet", "Lengte (cm)", "Hoofdpositie", "Alternatieve positie 2", "Alternatieve positie 3", ...SC_COMP, "Algemeen cijfer", "Niveau", "Sterktes / spelbeschrijving", "Werkpunten", "Situatie & context", "Status", "Gescout op", "Wedstrijd / bron", "Scout"];
    download("Scoutingsdatabase_OG_Vorselaar.csv", "﻿" + [h.map(csvCell).join(";"), ...all.map(p => [p.naam, p.club, p.geb, p.voet, p.len, p.p1, p.p2, p.p3, ...SC_COMP.map((c, i) => scNum(p["k" + i]) ? String(p["k" + i]).replace(".", ",") : ""), scAvg(p) == null ? "" : f1(scAvg(p)), scNiv(scAvg(p)), p.sterk, p.werk, p.ctx, p.stat, p.dat, p.bron, p.scout].map(csvCell).join(";"))].join("\r\n")); };
} });
function scoutForm(v, p, all) {
  const isNew = !p; p = p ? { ...p } : { stat: "Nieuw", dat: todayIso(), scout: (() => { try { return localStorage.getItem("scout") || ""; } catch (e) { return ""; } })() };
  let sel = [p.p1, p.p2, p.p3].filter(Boolean); const sc = SC_COMP.map((c, i) => scNum(p["k" + i]) ? p["k" + i] : null);
  const draw = () => {
    const a = sc.every(x => x != null) ? sc.reduce((x, y) => x + y, 0) / 5 : null;
    v.innerHTML = backLink("#/scouting", "Scoutingsdatabase") + head(isNew ? "Nieuwe speler" : esc(p.naam), isNew ? "Vul minstens de naam, de hoofdpositie en je eigen naam in." : esc([p.club, p.bron].filter(Boolean).join(" · "))) +
    `<div class="grid2"><div class="panel"><h2>Speler</h2><div class="fields"><label class="f full">Naam<input id="naam" value="${esc(p.naam || "")}" autocomplete="off"></label><label class="f">Club<input id="club" value="${esc(p.club || "")}"></label>
      <label class="f">Geboortedatum<input id="geb" type="date" value="${esc(p.geb || "")}"></label><label class="f">Voorkeursvoet<select id="voet">${["", "Rechts", "Links", "Beide"].map(x => `<option${(p.voet || "") === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="f">Lengte (cm)<input id="len" type="number" min="100" max="220" value="${esc(p.len || "")}"></label></div></div>
    <div class="panel"><h2>Positie op het veld</h2><div class="pitchpick">${Object.entries(SC_POS).map(([n, [ab, x, y]]) => { const i = sel.indexOf(n); return `<button type="button" class="${i >= 0 ? "s" + (i + 1) : ""}" style="left:${x}%;top:${y}%" data-pos="${n}" title="${n}">${ab}</button>`; }).join("")}</div>
      <p class="hint" style="text-align:center">${sel.length ? sel.map((s, i) => (i + 1) + ". " + s).join(" · ") : "Tik: 1 = hoofdpositie, daarna maximaal 2 alternatieven"}</p></div></div>
    <div class="grid2 sec"><div class="panel"><h2>Beoordeling</h2>${SC_COMP.map((c, i) => `<div class="rng" style="margin-bottom:10px"><div class="t"><span>${c}</span><span class="v" style="${sc[i] != null ? `background:${scCol(sc[i])};color:#fff` : ""}">${sc[i] != null ? f1(sc[i]) : "–"}</span></div><input type="range" min="1" max="10" step="0.5" value="${sc[i] ?? 5}" data-k="${i}" aria-label="${c}"></div>`).join("")}
      <div class="kpi" style="border-color:var(--yellow)"><small>Algemeen cijfer</small><b style="color:var(--ytext)">${f1(a)}</b><span>${a == null ? "Zichtbaar als alle 5 scores ingevuld zijn" : scNiv(a)}</span></div></div>
    <div class="panel"><h2>Notities en opvolging</h2><div class="fields"><label class="f full">Sterktes en spelbeschrijving<textarea id="sterk">${esc(p.sterk || "")}</textarea></label><label class="f full">Werkpunten<textarea id="werk">${esc(p.werk || "")}</textarea></label>
      <label class="f full">Situatie en context<textarea id="ctx" placeholder="Rugnummer, matuur, speelminuten…">${esc(p.ctx || "")}</textarea></label>
      <label class="f">Status<select id="stat">${SC_STAT.map(x => `<option${p.stat === x ? " selected" : ""}>${x}</option>`).join("")}</select></label><label class="f">Gescout op<input id="dat" type="date" value="${esc(p.dat || "")}"></label>
      <label class="f full">Wedstrijd of bron<input id="bron" value="${esc(p.bron || "")}" placeholder="Club A U14 – Club B U14"></label><label class="f full">Scout (jouw naam)<input id="scout" value="${esc(p.scout || "")}"></label></div></div></div>
    <div class="row sec">${isNew ? "" : `<button class="btn danger" type="button" id="del">Verwijderen</button>`}<span class="spacer"></span><a class="btn ghost" href="#/scouting">Annuleren</a><button class="btn" type="button" id="save">${isNew ? "Opslaan in de database" : "Wijzigingen opslaan"}</button></div>`;
    const keep = () => ["naam", "club", "geb", "voet", "len", "sterk", "werk", "ctx", "stat", "dat", "bron", "scout"].forEach(k => p[k] = $("#" + k).value.trim());
    $$("[data-pos]", v).forEach(b => b.onclick = () => { keep(); const n = b.dataset.pos, i = sel.indexOf(n); if (i >= 0) sel.splice(i, 1); else if (sel.length < 3) sel.push(n); draw(); });
    $$("[data-k]", v).forEach(r => { r.oninput = () => { sc[+r.dataset.k] = +r.value; const s = r.previousElementSibling.querySelector(".v"); s.textContent = f1(+r.value); s.style.background = scCol(+r.value); s.style.color = "#fff"; }; r.onchange = () => { keep(); draw(); }; });
    $("#save").onclick = async () => { keep(); if (!p.naam || !sel[0] || !p.scout) { toast("Vul minstens naam, hoofdpositie en jouw naam als scout in."); return; }
      if (isNew && all.some(x => x.naam.toLowerCase() === p.naam.toLowerCase() && (x.geb || "") === (p.geb || "")) && !confirm("Deze speler staat al in de database. Toch nog eens toevoegen?")) return;
      const data = { ...p, p1: sel[0] || "", p2: sel[1] || "", p3: sel[2] || "", ts: Date.now() }; delete data.id; delete data.created_by; sc.forEach((s, i) => { if (s != null) data["k" + i] = s; else delete data["k" + i]; });
      try { localStorage.setItem("scout", p.scout); } catch (e) {}
      await safe(async () => { await db.save("scouting", { id: p.id || "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), data, updated_at: new Date().toISOString() }); go("#/scouting"); }, p.naam + " is opgeslagen."); };
    const del = $("#del"); if (del) del.onclick = async () => { if (!confirm("Deze speler definitief verwijderen?")) return; await safe(async () => { await db.del("scouting", { id: p.id }); go("#/scouting"); }, "Speler verwijderd."); };
  };
  draw();
}
