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
route("animatiebord", { title: "Tactiekbord", wide: true, render: (v, id) => embed(v, "tactiekbord/?v=3" + (id ? "#b-" + encodeURIComponent(id) : ""), "Tactiekbord") });
route("matchday", { title: "Wedstrijdblad", wide: true, render: (v, id) => {
  if (S.team) { const next = (id && S.events.find(e => e.id === id)) || S.events.find(e => e.type === "wedstrijd" && e.date >= todayIso());
    const sel = next ? selPlayers(next).map(p => p.id) : [];
    try { localStorage.setItem("ogv-matchday-import", JSON.stringify({ id: S.team.id, name: S.team.name, format: S.team.format || "5v5",
      squad: active().map(p => ({ id: p.id, name: pname(p), nr: p.number ?? "" })), sel, opp: next?.opponent || "", date: next?.date || "", kick: tm(next?.start_time), home: next ? (next.home === false ? "uit" : "thuis") : "" })); } catch (e) {} }
  embed(v, "matchday/?v=67", "Wedstrijdblad");
} });

/* ============ scouting ============ */
const SC_POS = { "Doelman": ["DOEL", 50, 90], "Rechtsachter": ["RA", 86, 70], "Linksachter": ["LA", 14, 70], "Centrale verdediger": ["CV", 50, 72], "Verdedigende middenvelder": ["VM", 50, 55], "Centrale middenvelder": ["CM", 50, 42], "Aanvallende middenvelder": ["AM", 50, 29], "Rechtsbuiten": ["RB", 86, 20], "Linksbuiten": ["LB", 14, 20], "Spits": ["SP", 50, 9] };
const SC_STAT = ["Nieuw", "Blijven volgen", "Opnieuw bekijken", "Uitnodigen", "Contact opnemen", "Afgevallen"];
const SC_COMP = ["Winning mindset", "Toekomstig fysiek potentieel", "Spelinzicht", "Bal- en lichaamscontrole", "Leervermogen"], SC_SH = ["Mindset", "Fysiek", "Inzicht", "Balcontrole", "Leren"];
const scNum = v => typeof v === "number" && !isNaN(v);
/* de beheerder kiest zelf waarop de scouts beoordelen (Instellingen › Scouting); elk criterium houdt zijn eigen sleutel zodat oude scores blijven kloppen */
/* standaard: dezelfde zes hoeken als de interne scouting. De oude sleutels blijven (k3 balcontrole → techniek, k2 inzicht, k1 fysiek, k0 mindset → mentaal),
   zodat bestaande scores meteen in de juiste hoek staan. k4 (leervermogen) staat apart: niet in de zeshoek en niet in het gemiddelde. */
const SC_DEF = [["k3", "Techniek aan de bal", "Techniek"], ["k5", "Pas- en traptechniek", "Passing"], ["k2", "Spelinzicht", "Inzicht"], ["k6", "Verdedigen", "Verdedigen"], ["k1", "Fysiek", "Fysiek"], ["k0", "Mentaal", "Mentaal"]].map(([k, n, s]) => ({ k, n, s }));
const SC_OLD5 = SC_COMP.map((n, i) => ({ k: "k" + i, n, s: SC_SH[i] }));
const SC_LEER = "k4", SC_LEERZ = "k4z";
/* leervermogen als niveau (geen cijfer): opgeslagen als 2/4/6/8/10 zodat oude cijfers meteen een niveau krijgen */
const SC_LV = [[2, "Laag"], [4, "Eerder laag"], [6, "Gemiddeld"], [8, "Eerder hoog"], [10, "Hoog"]];
const scLv = v => !scNum(v) ? null : v <= 3 ? 2 : v <= 5 ? 4 : v <= 6.5 ? 6 : v <= 8.5 ? 8 : 10, scLvTxt = v => (SC_LV.find(([k]) => k === scLv(v)) || [])[1] || "";
const SC_HOEKEN = [["Techniek aan de bal", "Techniek"], ["Pas- en traptechniek", "Passing"], ["Spelinzicht", "Inzicht"], ["Verdedigen", "Verdedigen"], ["Fysiek", "Fysiek"], ["Mentaal", "Mentaal"]];
const scComp = (st = CLUB.settings) => { const c = st?.scout?.comp; return Array.isArray(c) && c.length ? c : SC_DEF; };
const scStats = (st = CLUB.settings) => { const c = st?.scout?.stat; return Array.isArray(c) && c.length ? c : SC_STAT; };
const scAvg = p => { const k = scComp().map(c => p[c.k]).filter(scNum); return k.length ? k.reduce((a, b) => a + b, 0) / k.length : null; };
const scNiv = a => a == null ? "" : a >= 8 ? "Top talent" : a >= 7 ? "Interessant" : a >= 6 ? "Opvolgen" : "Onder niveau";
const scCol = v => `hsl(${Math.round((v - 1) * 13.3)},72%,46%)`;
let scTab = "db", scF = { q: "", pos: [], stat: [], niv: [], voet: [], cat: [], dOud: false, dJong: false, min: {}, sort: "score", open: false, view: "lijst", fcat: "", fpos: 0 };
const SC_NIV = ["Top talent", "Interessant", "Opvolgen", "Onder niveau"];
const SC_CATS = Array.from({ length: 16 }, (_, i) => "U" + (i + 6));
/* in welke U hoort de speler? zelf gekozen, anders afgeleid uit het geboortejaar en het seizoen */
const scCatOf = p => { if (p.cat) return p.cat; if (!p.geb) return ""; const u = +seasonNow().slice(5) - +String(p.geb).slice(0, 4); return u >= 6 && u <= 21 ? "U" + u : ""; };
/* posities van een gescoute speler: p1 = hoofdpositie, p2/p3 en pn[] = andere posities (onbeperkt) */
const scPosList = p => [p.p1, p.p2, p.p3, ...(Array.isArray(p.pn) ? p.pn : [])].filter(Boolean);
const scPosNums = p => scPosList(p).map(n => (POS_BY_NAME[n] || [])).filter(x => x.length);
const scAge = p => p.geb ? Math.floor((Date.now() - new Date(p.geb)) / 31557600000) : null;
/* hoeveel filters staan aan (voor de knop en de lijst met actieve filters) */
const scActive = () => [...scF.pos.map(x => ["pos", x, (SC_POS[x] || [x])[0]]), ...scF.stat.map(x => ["stat", x, x]), ...scF.niv.map(x => ["niv", x, x]), ...scF.voet.map(x => ["voet", x, x + " voet"]), ...scF.cat.map(x => ["cat", x, x]),
  ...(scF.cat.length && scF.dOud ? [["dOud", "", "+ jaar ouder"]] : []), ...(scF.cat.length && scF.dJong ? [["dJong", "", "+ jaar jonger"]] : []),
  ...Object.entries(scF.min).filter(([, v]) => v).map(([k, v]) => ["min", k, `${(scComp().find(c => c.k === k) || {}).s || k} ${v}+`])];
/* U-filter: de gekozen U's, eventueel met spelers die een jaar ouder zijn (dispensatie) of een jaar jonger (spelen hoger) */
const scUn = c => parseInt(String(c || "").slice(1)) || 0;
const scCatRel = p => { const n = scUn(scCatOf(p)); if (!scF.cat.length || !n) return ""; const sel = scF.cat.map(scUn); return sel.includes(n) ? "in" : scF.dOud && sel.includes(n - 1) ? "oud" : scF.dJong && sel.includes(n + 1) ? "jong" : ""; };
const scCatOk = p => !scF.cat.length || !!scCatRel(p);
let SC_ROWS = null;
route("scouting", { title: "Scouting", auth: true, render: async (v, id) => {
  if (!mag("scouting")) { v.innerHTML = head("Externe scouting", "") + `<div class="empty"><b>Geen toegang</b>De externe scouting is enkel voor wie daar het recht voor kreeg. Vraag het aan de beheerder van de club.</div>`; return; }
  /* filters en sorteren: hergebruik de geladen lijst, zodat de pagina niet eerst leeg wordt en verspringt */
  let rows; if (!id && SC_ROWS && scF.soft) rows = SC_ROWS; else { v.innerHTML = head("Externe scouting", "Laden…"); rows = SC_ROWS = await db.list("scouting"); } scF.soft = false; const all = rows.map(r => ({ id: r.id, created_by: r.created_by, ...r.data }));
  if (id) { scoutForm(v, all.find(x => x.id === id) || null, all); return; }
  const list = all.filter(p => { const a = scAvg(p), age = scAge(p), pos = scPosList(p);
    return (!scF.q || [p.naam, p.club, p.sterk, p.werk, p.ctx, p.bron, p.scout].join(" ").toLowerCase().includes(scF.q.toLowerCase()))
      && (!scF.pos.length || scF.pos.some(x => pos.includes(x))) && (!scF.stat.length || scF.stat.includes(p.stat || "Nieuw")) && (!scF.niv.length || scF.niv.includes(scNiv(a)))
      && (!scF.voet.length || scF.voet.includes(p.voet)) && scCatOk(p)
      && Object.entries(scF.min).every(([k, v]) => !v || (scNum(p[k]) && p[k] >= +v)); })
    .sort(scF.sort === "naam" ? (a, b) => String(a.naam).localeCompare(String(b.naam), "nl") : scF.sort === "nieuw" ? (a, b) => String(b.dat || "").localeCompare(String(a.dat || "")) || (b.ts || 0) - (a.ts || 0)
      : scF.sort === "jong" ? (a, b) => (scAge(a) ?? 99) - (scAge(b) ?? 99) : scF.sort.startsWith("k") ? (a, b) => (b[scF.sort] ?? -1) - (a[scF.sort] ?? -1) : (a, b) => (scAvg(b) ?? -1) - (scAvg(a) ?? -1) || (b.ts || 0) - (a.ts || 0));
  const act = scActive(), chip = (k, x, l, on) => `<button type="button" class="scchip" data-tg="${k}" data-val="${esc(x)}" aria-pressed="${on}">${esc(l)}</button>`;
  const sc5 = all.map(scAvg).filter(x => x != null);
  v.innerHTML = head("Externe scouting", "Eén gedeelde database voor alle trainers. Bevat gegevens van minderjarigen: deel ze enkel binnen de club.", `<button class="btn ghost" type="button" id="exp">${IC.dl}Excel</button><button class="btn ghost" type="button" id="scapp" title="Aparte app voor scouts">${IC.scout || ""}Scoutapp</button><a class="btn" href="#/scouting/nieuw">${IC.plus}Nieuwe speler</a>`) +
  `<div class="kpis"><div class="kpi" style="background:var(--yellow);color:#000;border-color:var(--yellow)"><small style="color:#000">Spelers</small><b>${all.length}</b></div><div class="kpi"><small>Top talent</small><b>${all.filter(p => scNiv(scAvg(p)) === "Top talent").length}</b></div><div class="kpi"><small>Gemiddeld cijfer</small><b>${sc5.length ? f1(avg(sc5)) : "–"}</b></div><div class="kpi"><small>Nieuw</small><b>${all.filter(p => p.stat === "Nieuw").length}</b></div></div>
  <div class="scbar sec"><span class="scsrch">${IC.scout || ""}<input id="fq" type="search" placeholder="Zoek op naam, club, notitie of scout" value="${esc(scF.q)}" autocomplete="off"></span>
    <button class="btn ${scF.open ? "" : "ghost"}" type="button" id="fo" aria-expanded="${scF.open}">Filters${act.length ? ` <span class="scn">${act.length}</span>` : ""}</button>
    <select id="fsort" aria-label="Sorteren">${[["score", "Hoogste cijfer"], ["nieuw", "Laatst gescout"], ["naam", "Naam"], ["jong", "Jongste eerst"], ...scComp().map(c => [c.k, "Beste " + (c.s || c.n).toLowerCase()])].map(([k, l]) => `<option value="${k}"${scF.sort === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
  ${scF.open ? `<div class="scpanel panel">
    <div class="scgrp"><h4>Categorie <small>meerdere mogelijk</small></h4><div class="scchips">${(() => { const ns = all.map(p => scUn(scCatOf(p))).filter(Boolean); if (!ns.length) return '<span class="hint">Vul bij een speler zijn geboortedatum of U in.</span>'; const lo = Math.max(6, Math.min(...ns) - 1), hi = Math.min(21, Math.max(...ns) + 1); return SC_CATS.filter(c => scUn(c) >= lo && scUn(c) <= hi).map(x => chip("cat", x, x, scF.cat.includes(x))).join(""); })()}</div>
      <div class="scdisp${scF.cat.length ? "" : " off"}"><span>Ook meenemen</span><button type="button" class="scchip" data-disp="dOud" aria-pressed="${!!scF.dOud}"${scF.cat.length ? "" : " disabled"}>Jaar ouder <small>dispensatie</small></button><button type="button" class="scchip" data-disp="dJong" aria-pressed="${!!scF.dJong}"${scF.cat.length ? "" : " disabled"}>Jaar jonger <small>speelt hoger</small></button>${scF.cat.length ? "" : '<small class="hint">Kies eerst een U.</small>'}</div></div>
    <div class="scgrp"><h4>Positie <small>meerdere mogelijk</small></h4><div class="scchips">${Object.keys(SC_POS).map(x => chip("pos", x, (SC_POS[x] || [x])[0] + " · " + x, scF.pos.includes(x))).join("")}</div></div>
    <div class="scgrp"><h4>Minimum per criterium</h4><div class="scmins">${scComp().map(c => `<div class="scmin"><span>${esc(c.n)}</span><span class="scseg" role="group" aria-label="${esc(c.n)}">${["", 6, 7, 8, 9].map(v => `<button type="button" data-min="${c.k}" data-v="${v}" aria-pressed="${String(scF.min[c.k] || "") === String(v)}">${v ? v + "+" : "alle"}</button>`).join("")}</span></div>`).join("")}</div></div>
    <div class="scrow3">
      <div class="scgrp"><h4>Niveau</h4><div class="scchips">${SC_NIV.map(x => chip("niv", x, x, scF.niv.includes(x))).join("")}</div></div>
      <div class="scgrp"><h4>Voorkeursvoet</h4><div class="scchips">${["Rechts", "Links", "Beide"].map(x => chip("voet", x, x, scF.voet.includes(x))).join("")}</div></div></div>
    <div class="scgrp"><h4>Status</h4><div class="scchips">${scStats().map(x => chip("stat", x, x, scF.stat.includes(x))).join("")}</div></div>
  </div>` : ""}
  ${act.length ? `<div class="scact">${act.map(([k, x, l]) => `<button type="button" class="scx" data-rm="${k}" data-val="${esc(x)}">${esc(l)} <span aria-hidden="true">×</span></button>`).join("")}<button class="link" type="button" id="fclr">Alles wissen</button></div>` : ""}
  <p class="hint">${list.length} getoond</p>
  ${list.length ? `<div class="scgrid">${list.map(p => { const a = scAvg(p), age = scAge(p), cat = scCatOf(p), CO = scComp();
    const vals = Object.fromEntries(CO.map(c => [c.s || c.n, scNum(p[c.k]) ? p[c.k] : null])), rad = CO.length >= 3 && CO.some(c => scNum(p[c.k])) ? radarSvg(CO.map(c => c.s || c.n), vals, null, { mini: true, size: 76, max: 10 }) : "";
    return `<a class="sc-card2" href="#/scouting/${esc(p.id)}"><div class="hd"><span class="bg${a == null ? " none" : ""}">${a == null ? "–" : f1(a)}</span>
      <span class="scmain"><b>${esc(p.naam)}</b><small>${esc([p.club, cat, age != null ? age + " jaar" : "", p.voet ? p.voet.toLowerCase() + " voet" : ""].filter(Boolean).join(" · "))}</small>
        <span class="sctags">${scPosList(p).map((x, i) => `<em${i ? ' class="soft"' : ""} title="${esc(x)}">${esc((SC_POS[x] || [x])[0])}</em>`).join("")}${a != null ? `<span class="scniv n${SC_NIV.indexOf(scNiv(a))}">${scNiv(a)}</span>` : ""}${(r => r === "oud" ? '<span class="scdtag">jaar ouder</span>' : r === "jong" ? '<span class="scdtag">jaar jonger</span>' : "")(scCatRel(p))}</span></span>
      ${rad ? `<span class="isc-rad sc-rad" title="Spelersprofiel">${rad}</span>` : ""}</div>
      <div class="sck n${CO.length}">${CO.map(c => { const val = p[c.k]; return `<span title="${esc(c.n)}"><small>${esc(c.s || c.n)}</small><b style="${scNum(val) ? `color:${scCol(val)}` : ""}">${scNum(val) ? f1(val) : "–"}</b></span>`; }).join("")}</div>
      <div class="scfoot"><span class="pill w">${esc(p.stat || "Nieuw")}</span>${scNum(p[SC_LEER]) && !CO.some(c => c.k === SC_LEER) ? `<span class="pill scleerp${p[SC_LEERZ] ? "" : " est"}" title="${p[SC_LEERZ] ? "Leervermogen, goed kunnen beoordelen" : "Leervermogen, geschat"}">Leervermogen ${scLvTxt(p[SC_LEER]).toLowerCase()}${p[SC_LEERZ] ? "" : " (schatting)"}</span>` : ""}<span class="spacer"></span><small>${esc([p.scout, p.dat].filter(Boolean).join(" · "))}</small></div></a>`; }).join("")}</div>`
    : all.length ? `<div class="empty"><b>Geen spelers met deze filters</b>Haal een filter weg of verlaag een minimum.</div>` : `<div class="empty"><b>Nog geen spelers</b>Voeg de eerste gescoute speler toe.<br><a class="btn" href="#/scouting/nieuw">Nieuwe speler</a></div>`}`;
  const qi = $("#fq"); qi.oninput = debounce(() => { scF.q = qi.value; scF.typing = true; scF.soft = true; render(); }, 250);
  if (scF.typing) { scF.typing = false; qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  $("#fo").onclick = () => { scF.open = !scF.open; scF.soft = true; render(); };
  $("#fsort").onchange = e => { scF.sort = e.target.value; scF.soft = true; render(); };
  $$("[data-tg]", v).forEach(b => b.onclick = () => { const k = b.dataset.tg, x = b.dataset.val; scF[k] = scF[k].includes(x) ? scF[k].filter(y => y !== x) : [...scF[k], x]; scF.soft = true; render(); });
  $$("[data-disp]", v).forEach(b => b.onclick = () => { scF[b.dataset.disp] = !scF[b.dataset.disp]; scF.soft = true; render(); });
  $$("[data-min]", v).forEach(b => b.onclick = () => { scF.min = { ...scF.min, [b.dataset.min]: b.dataset.v }; scF.soft = true; render(); });
  $$("[data-rm]", v).forEach(b => b.onclick = () => { const k = b.dataset.rm, x = b.dataset.val; if (k === "dOud" || k === "dJong") { scF[k] = false; } else if (k === "min") { scF.min = { ...scF.min, [x]: "" }; } else scF[k] = scF[k].filter(y => y !== x); scF.soft = true; render(); });
  const clr = $("#fclr"); if (clr) clr.onclick = () => { Object.assign(scF, { q: "", pos: [], stat: [], niv: [], voet: [], cat: [], dOud: false, dJong: false, min: {} }); scF.soft = true; render(); };
  $("#scapp").onclick = () => { const url = new URL("scout/", location.href.split("#")[0].split("?")[0]).href;
    dialog(`<div class="dlg"><h2>Scoutapp</h2><p>Een aparte, eenvoudige app om tijdens of na een wedstrijd snel een gescoute speler toe te voegen. Scouts melden aan met hun gewone account en hebben het recht <b>Externe scouting</b> nodig.</p>
      <p class="hint">Open de link op de gsm en kies <b>Zet op beginscherm</b>. Zo staat de app tussen de andere apps.</p>
      <input readonly value="${esc(url)}" style="width:100%" onclick="this.select()"><div class="row" style="margin-top:12px;gap:8px"><a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">Openen</a><button class="btn ghost" type="button" data-close>Sluiten</button><span class="spacer"></span><button class="btn" type="button" id="sccp">Link kopiëren</button></div></div>`);
    const c = $("#sccp"); if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link gekopieerd."); } catch (e) { toast(url); } }; };
  $("#exp").onclick = () => { const h = ["Naam", "Club", "Geboortedatum", "Voorkeursvoet", "Lengte (cm)", "Hoofdpositie", "Andere posities", ...scComp().map(c => c.n), "Algemeen cijfer", "Niveau", "Sterktes / spelbeschrijving", "Werkpunten", "Situatie & context", "Status", "Gescout op", "Wedstrijd / bron", "Scout"];
    download("Externe_scouting_" + String(clubName()).replace(/\W+/g, "_") + ".csv", "﻿" + [h.map(csvCell).join(";"), ...all.map(p => [p.naam, p.club, p.geb, p.voet, p.len, p.p1, scPosList(p).slice(1).join(", "), ...scComp().map(c => scNum(p[c.k]) ? String(p[c.k]).replace(".", ",") : ""), scAvg(p) == null ? "" : f1(scAvg(p)), scNiv(scAvg(p)), p.sterk, p.werk, p.ctx, p.stat, p.dat, p.bron, p.scout].map(csvCell).join(";"))].join("\r\n")); };
} });
function scoutForm(v, p, all) {
  const isNew = !p; p = p ? { ...p } : { stat: "Nieuw", dat: todayIso(), scout: (() => { try { return localStorage.getItem("scout") || ""; } catch (e) { return ""; } })() };
  let sel = scPosList(p); const CO = scComp(), sc = CO.map(c => scNum(p[c.k]) ? p[c.k] : null);
  let leer = scLv(p[SC_LEER]), leerZ = p[SC_LEERZ] ? "z" : "s";
  const draw = () => {
    const fil = sc.filter(x => x != null), a = fil.length ? fil.reduce((x, y) => x + y, 0) / fil.length : null;
    v.innerHTML = backLink("#/scouting", "Externe scouting") + head(isNew ? "Nieuwe speler" : esc(p.naam), isNew ? "Vul minstens de naam, de hoofdpositie en je eigen naam in." : esc([p.club, p.bron].filter(Boolean).join(" · "))) +
    `<div class="grid2"><div class="panel"><h2>Speler</h2><div class="fields"><label class="f full">Naam<input id="naam" value="${esc(p.naam || "")}" autocomplete="off"></label><label class="f">Club<input id="club" value="${esc(p.club || "")}"></label>
      <label class="f">Geboortedatum<input id="geb" type="date" value="${esc(p.geb || "")}"></label><label class="f">Categorie (U)<select id="cat"><option value="">${(() => { const c = scCatOf({ geb: p.geb }); return c ? "Volgens geboortejaar: " + c : "Kies de U"; })()}</option>${SC_CATS.map(c => `<option${p.cat === c ? " selected" : ""}>${c}</option>`).join("")}</select></label><label class="f">Voorkeursvoet<select id="voet">${["", "Rechts", "Links", "Beide"].map(x => `<option${(p.voet || "") === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="f">Lengte (cm)<input id="len" type="number" min="100" max="220" value="${esc(p.len || "")}"></label></div></div>
    <div class="panel"><h2>Positie op het veld</h2><div class="pitchpick">${Object.entries(SC_POS).map(([n, [ab, x, y]]) => { const i = sel.indexOf(n); return `<button type="button" class="${i === 0 ? "s1" : i > 0 ? "s2" : ""}" style="left:${x}%;top:${y}%" data-pos="${n}" title="${n}">${ab}</button>`; }).join("")}</div>
      <p class="hint" style="text-align:center">${sel.length ? sel.map((s, i) => (i + 1) + ". " + s).join(" · ") : "Tik eerst de hoofdpositie (1), daarna alle andere posities die hij kan spelen"}</p></div></div>
    <div class="grid2 sec"><div class="panel"><h2>Beoordeling</h2>${CO.length >= 3 ? `<div class="scrad">${radarSvg(CO.map(c => c.s || c.n), Object.fromEntries(CO.map((c, i) => [c.s || c.n, sc[i]])), null, { size: 250, max: 10 })}</div>` : ""}${CO.map((c0, i) => { const c = esc(c0.n); return `<div class="rng" style="margin-bottom:10px"><div class="t"><span>${c}</span><span class="v" style="${sc[i] != null ? `background:${scCol(sc[i])};color:#fff` : ""}">${sc[i] != null ? f1(sc[i]) : "–"}</span></div><input type="range" min="1" max="10" step="0.5" value="${sc[i] ?? 5}" data-k="${i}" aria-label="${c}"></div>`; }).join("")}
      ${CO.some(c => c.k === SC_LEER) ? "" : `<div class="scleer"><div class="t"><b>Leervermogen</b><small>Apart: telt niet mee in de zeshoek en het algemeen cijfer. Laat leeg als je het niet kon zien.</small></div>
      <div class="segs lv" role="radiogroup" aria-label="Leervermogen">${[[0, "Niet ingevuld"], ...SC_LV].map(([k, l]) => `<button type="button" role="radio" aria-checked="${(leer || 0) === k}" class="${(leer || 0) === k ? "on" : ""}${k ? " l" + k : ""}" data-lv="${k}">${l}</button>`).join("")}</div>
      ${leer ? `<div class="segs zk" role="radiogroup" aria-label="Hoe zeker"><span>Hoe zeker?</span>${[["s", "Schatting"], ["z", "Goed kunnen beoordelen"]].map(([k, l]) => `<button type="button" role="radio" aria-checked="${leerZ === k}" class="${leerZ === k ? "on" : ""}" data-lz="${k}">${l}</button>`).join("")}</div>` : ""}</div>`}
      <div class="kpi" style="border-color:var(--yellow)"><small>Algemeen cijfer</small><b style="color:var(--ytext)">${f1(a)}</b><span>${a == null ? "Verschijnt zodra je een eerste score geeft" : scNiv(a) + (fil.length < CO.length ? ` · ${fil.length} van ${CO.length} gescoord` : "")}</span></div></div>
    <div class="panel"><h2>Notities en opvolging</h2><div class="fields"><label class="f full">Sterktes en spelbeschrijving<textarea id="sterk">${esc(p.sterk || "")}</textarea></label><label class="f full">Werkpunten<textarea id="werk">${esc(p.werk || "")}</textarea></label>
      <label class="f full">Situatie en context<textarea id="ctx" placeholder="Rugnummer, matuur, speelminuten…">${esc(p.ctx || "")}</textarea></label>
      <label class="f">Status<select id="stat">${[...new Set([...scStats(), ...(p.stat ? [p.stat] : [])])].map(x => `<option${p.stat === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label><label class="f">Gescout op<input id="dat" type="date" value="${esc(p.dat || "")}"></label>
      <label class="f full">Wedstrijd of bron<input id="bron" value="${esc(p.bron || "")}" placeholder="Club A U14 – Club B U14"></label><label class="f full">Scout (jouw naam)<input id="scout" value="${esc(p.scout || "")}"></label></div></div></div>
    <div class="row sec">${isNew ? "" : `<button class="btn danger" type="button" id="del">Verwijderen</button>`}<span class="spacer"></span>${!isNew && scCatOf(p) ? `<button class="btn ghost" type="button" id="cmpgo">${IC.field || ""}Vergelijken in ${esc(scCatOf(p))}</button>` : ""}<a class="btn ghost" href="#/scouting">Annuleren</a><button class="btn" type="button" id="save">${isNew ? "Opslaan in de database" : "Wijzigingen opslaan"}</button></div>`;
    const keep = () => ["naam", "club", "geb", "cat", "voet", "len", "sterk", "werk", "ctx", "stat", "dat", "bron", "scout"].forEach(k => p[k] = $("#" + k).value.trim());
    $("#geb", v).onchange = () => { keep(); draw(); };
    const cg = $("#cmpgo", v); if (cg) cg.onclick = () => { scF.fpick = { cat: scCatOf(p), pos: (POS_BY_NAME[p.p1] || [])[0] || 0, id: p.id }; go("#/scoutveld"); };
    $$("[data-pos]", v).forEach(b => b.onclick = () => { keep(); const n = b.dataset.pos, i = sel.indexOf(n); if (i >= 0) sel.splice(i, 1); else sel.push(n); draw(); });
    $$("[data-k]", v).forEach(r => { r.oninput = () => { sc[+r.dataset.k] = +r.value; const s = r.previousElementSibling.querySelector(".v"); s.textContent = f1(+r.value); s.style.background = scCol(+r.value); s.style.color = "#fff"; }; r.onchange = () => { keep(); draw(); }; });
    $$("[data-lv]", v).forEach(b => b.onclick = () => { keep(); leer = +b.dataset.lv || null; draw(); });
    $$("[data-lz]", v).forEach(b => b.onclick = () => { keep(); leerZ = b.dataset.lz; draw(); });
    $("#save").onclick = async () => { keep(); if (!p.naam || !sel[0] || !p.scout) { toast("Vul minstens naam, hoofdpositie en jouw naam als scout in."); return; }
      if (isNew && all.some(x => x.naam.toLowerCase() === p.naam.toLowerCase() && (x.geb || "") === (p.geb || "")) && !confirm("Deze speler staat al in de database. Toch nog eens toevoegen?")) return;
      const data = { ...p, p1: sel[0] || "", p2: sel[1] || "", p3: sel[2] || "", pn: sel.slice(3), ts: Date.now() }; if (!data.pn.length) delete data.pn; delete data.id; delete data.created_by; CO.forEach((c, i) => { if (sc[i] != null) data[c.k] = sc[i]; else delete data[c.k]; }); if (!CO.some(c => c.k === SC_LEER)) { if (leer) { data[SC_LEER] = leer; if (leerZ === "z") data[SC_LEERZ] = true; else delete data[SC_LEERZ]; } else { delete data[SC_LEER]; delete data[SC_LEERZ]; } }
      try { localStorage.setItem("scout", p.scout); } catch (e) {}
      await safe(async () => { SC_OWN = null; await db.save("scouting", { id: p.id || "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), data, updated_at: new Date().toISOString() }); go("#/scouting"); }, p.naam + " is opgeslagen."); };
    const del = $("#del"); if (del) del.onclick = async () => { if (!confirm("Deze speler definitief verwijderen?")) return; await safe(async () => { await db.del("scouting", { id: p.id }); go("#/scouting"); }, "Speler verwijderd."); };
  };
  draw();
}

/* ============ posities vergelijken: per ploeggroep eigen spelers (hoofd- en nevenpositie) naast de gescoute spelers van die U ============
   Ploegen A en B van dezelfde U vormen samen de IP-groep; C, D … staan apart. */
/* welke ploegen spelen samen (IP)? Uit de RBFA-kalender: zelfde dag, zelfde tegenstander (A tegen A, B tegen B). De beheerder bewaart het resultaat voor iedereen. */
const scOppBase = o => String(o || "").toLowerCase().replace(/\s+\d[\d\s-]*$/, "").replace(/\s+[a-d]$/, "").replace(/[^a-z0-9]+/g, " ").trim();
async function scDetectPairs(teams) {
  let ev; const from = seasonNow().slice(0, 4) + "-07-01";
  if (mode === "demo") ev = await db.list("events").catch(() => []);
  else { const r = await sb.from("events").select("team_id,date,opponent").not("opponent", "is", null).gte("date", from); if (r.error) return null; ev = r.data || []; }
  const M = new Map(); for (const e of ev) { const b = scOppBase(e.opponent); if (!b || !e.date) continue; if (!M.has(e.team_id)) M.set(e.team_id, new Map()); M.get(e.team_id).set(e.date, b); }
  const pairs = [];
  for (const a of teams) for (const b of teams) { if (a.id >= b.id || isCat(a) !== isCat(b) || !isCat(a)) continue; const A = M.get(a.id), B = M.get(b.id); if (!A || !B) continue;
    let same = 0; for (const [d, o] of A) if (B.get(d) === o) same++; if (same >= 3 && same / Math.min(A.size, B.size) >= 0.4) pairs.push([a.id, b.id].sort()); }
  return pairs;
}
/* groepen: elke ploeg apart, ploegen die samen spelen samen; plus per U een groep met alle ploegen */
function scGroups(teams, pairs = []) {
  const T = teams.filter(t => isCat(t)), par = new Map(T.map(t => [t.id, t.id])), f = x => par.get(x) === x ? x : (par.set(x, f(par.get(x))), par.get(x));
  for (const [a, b] of pairs) if (par.has(a) && par.has(b)) par.set(f(a), f(b));
  const by = new Map(); for (const t of T) { const r = f(t.id); if (!by.has(r)) by.set(r, []); by.get(r).push(t); }
  const G = [...by.values()].map(ts => { ts.sort((a, b) => teamLbl(a).localeCompare(teamLbl(b), "nl", { numeric: true })); const cat = isCat(ts[0]);
    const lbl = ts.length > 1 ? cat + " IP" : teamLbl(ts[0]).replace(/^OGV\s+/i, ""); return { k: "t|" + ts.map(t => t.id).join("+"), cat, lbl, sub: ts.length > 1 ? ts.map(teamLbl).join(" + ") + " · spelen samen" : "", teams: ts, ip: ts.length > 1 }; });
  for (const cat of new Set(T.map(isCat))) { const ts = T.filter(t => isCat(t) === cat); if (ts.length > 1) G.push({ k: "u|" + cat, cat, lbl: "Heel " + cat, sub: ts.length + " ploegen samen", teams: ts, all: true }); }
  return G.sort((a, b) => (parseInt(a.cat.slice(1)) - parseInt(b.cat.slice(1))) || (a.all ? -1 : b.all ? 1 : 0) || (b.ip ? 1 : 0) - (a.ip ? 1 : 0) || a.lbl.localeCompare(b.lbl, "nl", { numeric: true }));
}
let SC_OWN = null;
route("scoutveld", { title: "Posities vergelijken", auth: true, render: async v => {
  const canOwn = S.admin || S.intscout !== false || mode === "demo", canExt = mag("scouting");
  if (!canOwn && !canExt) { v.innerHTML = head("Posities vergelijken", "") + `<div class="empty"><b>Geen toegang</b>Vraag de beheerder toegang tot de interne of externe scouting.</div>`; return; }
  if (!$("#scfv")) v.innerHTML = head("Posities vergelijken", "Per ploeg: hoeveel spelers heb je op elke positie, met welk potentieel, en wie hebben jullie gescout? Zo zien trainers en scouts waar het nog zoeken is.") + `<div id="scfv"><div class="panel"><span class="spin"></span> Laden…</div></div>`;
  const cached = SC_OWN && Date.now() - SC_OWN.t < 120000;
  if (!cached) { let own = [], teams = [], ext = [];
    let D = null, gm = null;
    if (canOwn) try { D = await isData(); gm = pfGroupMap(D.T.map(t => t.criteria || []).filter(c => c.length)); own = isRows(D, gm).filter(x => x.p.active !== false); teams = D.T; } catch (e) {}
    if (canExt) try { ext = (await db.list("scouting")).map(r => ({ id: r.id, ...r.data })); } catch (e) {}
    let pairs = CLUB.settings?.scout?.pairs || [];
    if (S.admin && teams.length) { const found = await scDetectPairs(teams).catch(() => null);
      if (found && JSON.stringify(found) !== JSON.stringify(pairs)) { pairs = found; const ns = { ...(CLUB.settings || {}), scout: { ...(CLUB.settings?.scout || {}), pairs } };
        try { if (mode !== "demo") { const { error } = await sb.rpc("club_save_settings", { nm: CLUB.name, sh: CLUB.short, s: ns }); if (error) throw error; } CLUB.settings = ns; if (typeof rememberClub === "function") rememberClub(); } catch (e) {} } }
    SC_OWN = { t: Date.now(), own, teams, ext, D, gm, pairs }; }
  scFieldDraw(v, canOwn, canExt);
} });
function scFieldDraw(v, canOwn, canExt) {
  const host = $("#scfv"); if (!host) return; const { own, teams, ext, D, gm } = SC_OWN;
  let G = scGroups(teams, SC_OWN.pairs || []); const cats = new Set(G.map(g => g.cat));
  for (const c of new Set(ext.map(scCatOf).filter(Boolean))) if (!cats.has(c)) G.push({ k: "u|" + c, cat: c, lbl: c, sub: "geen eigen ploeg", teams: [] });
  G = G.sort((a, b) => parseInt(a.cat.slice(1)) - parseInt(b.cat.slice(1)));
  if (!G.length) { host.innerHTML = `<div class="empty"><b>Nog niets te vergelijken</b>Geef je eigen spelers posities, en vul bij gescoute spelers hun geboortedatum of U in.</div>`; return; }
  if (scF.fpick) { const pk = scF.fpick; scF.fpick = null; const g = G.find(g => g.cat === pk.cat && g.all) || G.find(g => g.cat === pk.cat); if (g) scF.fgrp = g.k; if (pk.pos) scF.fpos = pk.pos; scF.fhl = pk.id; }
  if (!G.some(g => g.k === scF.fgrp)) { const mine = S.team ? G.find(g => g.teams.some(t => t.id === S.team.id)) : null; scF.fgrp = (mine || G[0]).k; }
  const g = G.find(x => x.k === scF.fgrp), tid = new Set(g.teams.map(t => t.id));
  const oc = own.filter(x => tid.has(x.p.team_id)), ec = ext.filter(p => scCatOf(p) === g.cat), o10 = x => x.tot == null ? null : x.tot * 2;
  const at = n => { const oh = oc.filter(x => x.ps.h === n), on = oc.filter(x => x.ps.h !== n && x.ps.n.includes(n)), eh = ec.filter(p => (scPosNums(p)[0] || []).includes(n)), en = ec.filter(p => !(scPosNums(p)[0] || []).includes(n) && scPosNums(p).slice(1).some(x => x.includes(n)));
    const bestPot = Math.max(-1, ...oh.map(x => x.potI)), bestOwn = Math.max(-1, ...oh.map(x => o10(x) ?? -1));
    return { n, oh, on, eh, en, bestPot, bestOwn, lvl: !oh.length ? "leeg" : bestPot >= 2 ? "goed" : bestPot === 1 ? "mid" : bestPot === 0 ? "laag" : "onbekend" }; };
  const P = POS11.map(([n]) => at(n)), empty = P.filter(x => x.lvl === "leeg"), low = P.filter(x => x.lvl === "laag"), noPos = oc.filter(x => !x.ps.h);
  if (!POS11.some(([n]) => n === scF.fpos)) scF.fpos = (empty[0] || low[0] || P[0]).n;
  const sel = P.find(x => x.n === scF.fpos), [, sab, nm] = POS11.find(([n]) => n === sel.n), pn = n => POS11.find(([k]) => k === n);
  const LV = { goed: "Hoog potentieel", mid: "Gemiddeld potentieel", laag: "Laag potentieel", leeg: "Niemand", onbekend: "Potentieel niet ingevuld" };
  const potBar = i => i >= 0 ? `<span class="isc-pot" title="Potentieel: ${esc(EV_POT[i])}">${EV_POT.map((_, k) => `<i${k <= i ? " class=on" : ""}></i>`).join("")}<span>${esc(EV_POT[i])}</span></span>` : `<span class="cmpnone">potentieel niet ingevuld</span>`;
  const score = val => `<span class="cmps${val == null ? " none" : ""}" style="--c:${val == null ? "var(--dim)" : scCol(val)}">${val == null ? "–" : f1(val)}<small>/10</small></span>`;
  const ownRow = (x, alt) => `<button type="button" class="cmprow${alt ? " alt" : ""}" data-own="${x.p.id}"><span class="cmpav">${esc((x.p.first_name || "?")[0])}</span><span class="cmpn"><b>${esc(x.name)}</b><small>${esc([x.team ? teamLbl(x.team) : "", x.age != null ? x.age + " jaar" : ""].filter(Boolean).join(" · "))}</small><span class="cmptags"><span class="cmprole${alt ? " alt" : ""}">${alt ? "kan hier ook · hoofdpositie " + (x.ps.h || "?") : "hoofdpositie"}</span>${potBar(x.potI)}</span></span>${score(o10(x))}<span class="cmpgo" aria-hidden="true">›</span></button>`;
  const extRow = (p, alt) => { const a = scAvg(p), better = a != null && sel.bestOwn >= 0 && a > sel.bestOwn;
    return `<a class="cmprow ext${alt ? " alt" : ""}${scF.fhl === p.id ? " hl" : ""}" href="#/scouting/${esc(p.id)}"><span class="cmpav ext">${esc((p.naam || "?")[0])}</span><span class="cmpn"><b>${esc(p.naam)}${better ? ' <span class="cmpup">▲ beter dan eigen</span>' : ""}</b><small>${esc([p.club, scAge(p) != null ? scAge(p) + " jaar" : "", p.stat || "Nieuw"].filter(Boolean).join(" · "))}</small><span class="cmptags"><span class="cmprole${alt ? " alt" : ""}">${alt ? "kan hier ook" : "hoofdpositie"}</span></span></span>${score(a)}<span class="cmpgo" aria-hidden="true">›</span></a>`; };
  const block = (label, main, alt, row, none) => `<div class="cmpblk"><div class="cmpbh"><b>${label}</b><small>${main.length + alt.length ? [main.length ? `${main.length} met deze hoofdpositie` : "", alt.length ? `${alt.length} die hier ook kan` : ""].filter(Boolean).join(" · ") : ""}</small></div>
    ${main.length || alt.length ? main.map(x => row(x)).join("") + alt.map(x => row(x, true)).join("") : `<p class="cmpempty">${none}</p>`}</div>`;
  const tab = scF.ftab === "tabel" ? "tabel" : "veld";
  host.innerHTML = `<div class="cmptop"><label class="cmpsel"><span>Ploeg</span><select id="cmpg">${[...new Set(G.map(x => x.cat))].map(c => `<optgroup label="${c}">${G.filter(x => x.cat === c).map(x => `<option value="${esc(x.k)}"${x.k === g.k ? " selected" : ""}>${esc(x.lbl)}${x.sub ? " — " + esc(x.sub) : ""}</option>`).join("")}</optgroup>`).join("")}</select></label>
      <div class="cmpstats"><span><b>${oc.length}</b>eigen spelers</span>${canExt ? `<span><b>${ec.length}</b>gescout in ${esc(g.cat)}</span>` : ""}<span class="${empty.length ? "bad" : ""}"><b>${empty.length}</b>posities zonder hoofdspeler</span><span class="${low.length ? "warn" : ""}"><b>${low.length}</b>met laag potentieel</span></div></div>
    ${empty.length || low.length || noPos.length ? `<div class="cmpgaps">${empty.length || low.length ? `<b>Hier zoeken</b>${[...empty, ...low].map(x => `<button type="button" class="cmpgap ${x.lvl}" data-fpos="${x.n}">${x.n} ${esc(pn(x.n)[1])}<small>${x.lvl === "leeg" ? "niemand" : "laag potentieel"}</small></button>`).join("")}` : ""}${noPos.length ? `<span class="cmpnopos">${noPos.length} ${noPos.length === 1 ? "speler heeft" : "spelers hebben"} nog geen hoofdpositie</span>` : ""}</div>` : ""}
    <div class="cmpwrap">
      <div class="panel cmpfield"><div class="cmptabs" role="tablist"><button type="button" role="tab" data-ftab="veld" aria-selected="${tab === "veld"}">Veld</button><button type="button" role="tab" data-ftab="tabel" aria-selected="${tab === "tabel"}">Tabel</button></div>
        ${tab === "veld" ? `<div class="cmppitch">${P.map(x => { const [, a2, n2, px, py] = pn(x.n);
          return `<button type="button" class="cmpp ${x.lvl}" data-fpos="${x.n}" aria-pressed="${x.n === sel.n}" style="left:${px}%;top:${py}%" aria-label="${x.n} ${esc(n2)}: ${x.oh.length} hoofdpositie, ${x.on.length} nevenpositie, ${x.eh.length} gescout"><small>${a2}</small><b>${x.oh.length}</b>${x.on.length ? `<u>+${x.on.length}</u>` : ""}${x.eh.length ? `<i title="gescout">${x.eh.length}</i>` : ""}</button>`; }).join("")}</div>
        <div class="cmpleg"><span><b class="lg">2</b>hoofdpositie</span><span><u>+1</u>ook inzetbaar</span>${canExt ? `<span><i class="ext">1</i>gescout</span>` : ""}</div>
        <div class="cmpleg"><span><i class="goed"></i>hoog potentieel</span><span><i class="mid"></i>gemiddeld</span><span><i class="laag"></i>laag</span><span><i class="leeg"></i>niemand</span><span><i class="onb"></i>niet ingevuld</span></div>`
        : `<table class="cmptbl"><thead><tr><th>Positie</th><th>Hoofd</th><th>Neven</th>${canExt ? "<th>Gescout</th>" : ""}</tr></thead><tbody>${P.map(x => `<tr data-fpos="${x.n}"${x.n === sel.n ? ' class="on"' : ""}><td><span class="cmpdot ${x.lvl}"></span><b>${x.n}</b> ${esc(pn(x.n)[2])}</td><td><b>${x.oh.length}</b></td><td>${x.on.length || "–"}</td>${canExt ? `<td>${x.eh.length + x.en.length || "–"}</td>` : ""}</tr>`).join("")}</tbody></table>`}
        ${canOwn ? "" : `<p class="hint" style="margin:8px 0 0">Je eigen spelers zie je enkel met toegang tot de interne scouting.</p>`}</div>
      <div class="panel cmpdet"><div class="cmpdh"><span class="cmpbadge ${sel.lvl}">${sel.n}<small>${sab}</small></span><div><h2>${esc(nm)}</h2><small>${esc(g.lbl)} · ${LV[sel.lvl]}</small></div></div>
        ${canOwn ? block("Eigen spelers", sel.oh, sel.on, ownRow, "Niemand heeft deze positie als hoofdpositie.") : ""}
        ${canExt ? block(`Gescout · ${esc(g.cat)}`, sel.eh.slice().sort((a, b) => (scAvg(b) ?? -1) - (scAvg(a) ?? -1)), sel.en, extRow, "Nog niemand gescout voor deze positie.") + `<a class="btn ghost small" href="#/scouting/nieuw">${IC.plus}Gescoute speler toevoegen</a>` : ""}
        <p class="cmpnote">Cijfers op 10. Eigen spelers: laatste evaluatie (op 5) × 2. Gescout: cijfer van de scout. Een indicatie, geen exacte vergelijking.</p></div></div>`;
  $("#cmpg", host).onchange = e => { scF.fgrp = e.target.value; scF.fpos = 0; scF.fhl = null; scFieldDraw(v, canOwn, canExt); };
  $$("[data-ftab]", host).forEach(b => b.onclick = () => { scF.ftab = b.dataset.ftab; scFieldDraw(v, canOwn, canExt); });
  $$("[data-fpos]", host).forEach(b => b.onclick = () => { scF.fpos = +b.dataset.fpos; scFieldDraw(v, canOwn, canExt); });
  /* eigen speler: zijn fiche, met de knop naar het volledige dossier */
  $$("[data-own]", host).forEach(b => b.onclick = () => { const x = own.find(o => o.p.id === b.dataset.own); if (x && D) isFiche(x, own, gm, D, isOwn(x.p.team_id)); });
}
