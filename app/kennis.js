/* OGV Platform — trainingsbibliotheek, spelprincipes, zonekaart, videoanalyse,
   animatiebord, wedstrijdblad, mixschema en scouting. */
"use strict";

/* ============ trainingsbibliotheek ============ */
let LIB = null;
async function loadLib() { if (LIB) return LIB; LIB = await fetch("trainingen/trainingen.json", { cache: "no-cache" }).then(r => r.json()); return LIB; }
const LIB_MAPS = [["thema", "Thematrainingen", "Volledige trainingen per basisprincipe van het opleidingsplan."], ["oefenstof", "Oefenstof", "Losse oefeningen om je training mee op te bouwen."], ["opwarming", "Opwarming", "De vaste wedstrijdopwarming van de club."]];
const LIB_THEMAS = ["Techniek", "Duel 1v1", "Passing en balaanname", "Handelingssnelheid", "Positiespel", "Wedstrijdvormen"];
let libBouw = null, libMap = "alle", libQ = "";
route("bibliotheek", { title: "Trainingsbibliotheek", render: async (v, id) => {
  const L = await loadLib();
  if (!libBouw) { try { libBouw = localStorage.getItem("tb-bouw"); } catch (e) {} if (!libBouw) { const c = parseInt(String(S.team?.category || "").replace(/\D/g, "")); libBouw = !c ? "middenbouw" : c <= 9 ? "onderbouw" : c <= 13 ? "middenbouw" : "bovenbouw"; } }
  const card = it => `<button class="tr" type="button" data-id="${esc(it.id)}"><span class="pic" style="background-image:url('trainingen/${esc(it.img)}')">${it.principe ? `<span class="code">${esc(it.principe)}</span>` : ""}</span>
    <span class="body"><h3>${esc(it.title)}</h3><p>${esc(it.bedoeling)}</p><span class="tags">${[it.vorm, it.veld, it.pages > 1 ? it.pages + " pagina's" : ""].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("")}</span></span></button>`;
  const draw = () => {
    const t = libQ.trim().toLowerCase(), match = i => !t || [i.title, i.bedoeling, i.thema, i.vorm, i.principe, PRINC[i.principe] || ""].join(" ").toLowerCase().includes(t);
    let its = L.items.filter(i => i.bouwen.includes(libBouw) && match(i)); const all = L.items.filter(i => i.bouwen.includes(libBouw));
    if (libMap !== "alle") its = its.filter(i => i.map === libMap);
    let body = "";
    for (const [mid, mn, mu] of LIB_MAPS) { if (libMap !== "alle" && libMap !== mid) continue; const mi = its.filter(i => i.map === mid); if (!mi.length) continue;
      if (mid === "oefenstof") { body += `<div class="sec"><h2>${mn}</h2><p class="muted" style="margin:-6px 0 6px">${mu}</p>` + LIB_THEMAS.map(th => { const x = mi.filter(i => i.thema === th); return x.length ? `<h3 class="muted" style="margin:16px 0 10px">${th}</h3><div class="cards">${x.map(card).join("")}</div>` : ""; }).join("") + "</div>"; }
      else body += `<div class="sec"><h2>${mn}</h2><p class="muted" style="margin:-6px 0 14px">${mu}</p><div class="cards">${mi.sort((a, b) => ((a.principe || "9") + (a.bron ? "z" : "a") + a.title).localeCompare((b.principe || "9") + (b.bron ? "z" : "a") + b.title)).map(card).join("")}</div></div>`; }
    $("#libv").innerHTML = `<div class="scrollx" style="margin:18px 0 0">${[["alle", "Alles", all.length], ...LIB_MAPS.map(([k, n]) => [k, n, all.filter(i => i.map === k).length]).filter(x => x[2])].map(([k, n, c]) => `<button class="chip" type="button" data-m="${k}" aria-pressed="${libMap === k}">${n}<b>${c}</b></button>`).join("")}</div>` +
      (body || `<div class="empty sec"><b>Geen training gevonden</b>Niets past bij "${esc(libQ)}" in deze leeftijdsgroep.</div>`);
    $$("[data-m]", v).forEach(b => b.onclick = () => { libMap = b.dataset.m; draw(); });
    $$(".tr", v).forEach(b => b.onclick = () => libDetail(L, b.dataset.id));
    $$("#bouw button", v).forEach(b => b.setAttribute("aria-pressed", b.dataset.b === libBouw));
  };
  v.innerHTML = head("Trainingsbibliotheek", "Alle trainingen en oefeningen van de club. Kies je leeftijdsgroep, open een training en bekijk, download of plan ze.", `<input id="lq" type="search" placeholder="Zoek: omschakeling, 1v1, passing…" style="width:min(340px,100%)" value="${esc(libQ)}">`) +
    `<div class="bouw" id="bouw" role="group" aria-label="Leeftijdsgroep">${L.bouwen.map(b => `<button type="button" data-b="${b.id}"><b>${b.naam}</b><small>${b.leeftijd} · ${b.vorm}</small></button>`).join("")}</div><div id="libv"></div>`;
  $$("#bouw button", v).forEach(b => b.onclick = () => { libBouw = b.dataset.b; try { localStorage.setItem("tb-bouw", libBouw); } catch (e) {} libMap = "alle"; draw(); });
  $("#lq").oninput = e => { libQ = e.target.value; draw(); };
  draw(); if (id) libDetail(L, id);
} });
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
    $$("[data-e]", d2).forEach(x => x.onclick = async () => { const e = S.events.find(z => z.id === x.dataset.e); e.plan = e.plan?.phases ? e.plan : { phases: PHASES.map(([name]) => ({ name, items: [] })), goal: "" };
      const ph = e.plan.phases[it.map === "opwarming" ? 0 : it.map === "thema" ? 1 : 2]; ph.items.push({ id: uid(), lib: it.id, title: it.title, minutes: it.map === "thema" ? 60 : 15 });
      await safe(() => putEvent(e), "Toegevoegd aan de training van " + dShort(e.date) + "."); d2.close(); }); };
}

/* ============ spelprincipes (vervangt het Lovable-tactiekbord) ============ */
const PRINCIPLES = [
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
let prFormat = "5v5";
route("principes", { title: "Spelprincipes", render: v => {
  const its = PRINCIPLES.filter(p => p.f === prFormat), groups = [["1A", "Opbouw van achteruit"], ["1B", "Opbouw verstoren"], ["3A", "Omschakeling naar balbezit"], ["3B", "Omschakeling naar balverlies"], ["Basis", "Basisprincipes"]];
  v.innerHTML = head("Spelprincipes", "De spelprincipes van OG Vorselaar als animatie, met de kernpunten om aan je spelers uit te leggen.") +
    `<div class="chips" style="margin-bottom:6px">${["5v5", "8v8"].map(f => `<button class="chip" type="button" data-f="${f}" aria-pressed="${f === prFormat}">${f}</button>`).join("")}<a class="chip" href="#/zonekaart" style="text-decoration:none">Zonekaart 8v8</a></div>` +
    groups.map(([m, n]) => { const x = its.filter(p => p.m === m); return x.length ? `<div class="sec"><h2>${n}</h2><div class="cards">${x.map(p => `<button class="tr" type="button" data-v="${p.v}"><span class="pic" style="background-image:url('media/principes/${p.v}.jpg')">${p.m !== "Basis" ? `<span class="code">${p.m}</span>` : ""}</span><span class="body"><h3>${esc(p.t)}</h3><p>${esc(p.k[0])}</p></span></button>`).join("")}</div></div>` : ""; }).join("");
  $$("[data-f]", v).forEach(b => b.onclick = () => { prFormat = b.dataset.f; render(); });
  $$("[data-v]", v).forEach(b => b.onclick = () => { const p = PRINCIPLES.find(x => x.v === b.dataset.v);
    const d = dialog(`<div class="dlgv"><div class="media"><video src="media/principes/${p.v}.mp4" poster="media/principes/${p.v}.jpg" controls autoplay muted loop playsinline></video></div>
      <div class="info"><span class="pill w" style="align-self:flex-start">${p.f} · ${p.m === "Basis" ? "Basisprincipe" : p.m + " " + PRINC[p.m]}</span><h2>${esc(p.t)}</h2><h3 style="margin:6px 0 0">Kernpunten</h3><ul class="kern">${p.k.map(k => `<li>${esc(k)}</li>`).join("")}</ul>
      <div class="row" style="margin-top:auto"><a class="btn ghost" href="media/principes/${p.v}.mp4" download>${IC.dl}Video downloaden</a><a class="btn ghost" href="#/animatiebord">${IC.board}Zelf tekenen</a></div></div></div><button class="xbtn" type="button" data-close aria-label="Sluiten">${IC.x}</button>`, "wide");
    d.style.position = "relative"; d.addEventListener("close", () => { const vid = $("video", d); if (vid) vid.pause(); }, { once: true }); });
} });

/* ============ zonekaart 8v8 ============ */
const ZONES = { rows: ["Flank", "Halfruimte", "Centrum", "Halfruimte", "Flank"], cols: ["o", "o", "m", "m", "a", "a"],
  cells: [["2 tijden zone", "Speel en vertrek zone", "Speel en beweeg zone", "Run zone + creatieve zone", "Actie/1v1 zone", "Lange voorzet zone"],
          ["Geen balverlies zone", "Snel handelen zone", "Infiltratie zone", "Infiltratie zone", "Creatieve zone", "Schot/45 zone"],
          ["Rust aan bal zone", "Snel handelen zone", ["Spelverdelingszone", "voor langere diagonale pas"], ["Spelverdelingszone", "voor korte/middellange diagonale pas"], "Last pass/schotzone", "Schotzone"]] };
route("zonekaart", { title: "Zonekaart 8v8", render: v => {
  const rowsIdx = [0, 1, 2, 1, 0];
  v.innerHTML = head("Zonekaart 8 tegen 8", "Aanvalsrichting van links naar rechts. Boven en onder zijn gespiegeld: dezelfde zone aan beide flanken.", `<a class="btn ghost" href="media/zonekaart.jpg" download>${IC.dl}Afbeelding</a><button class="btn ghost" type="button" onclick="print()">${IC.print}Afdrukken</button>`) +
  `<div class="panel wrapx"><div class="zones"><span></span><span class="zh" style="grid-column:span 2;background:#DDE7DA">Opbouw</span><span class="zh" style="grid-column:span 2;background:#FFEFA8">Middenveld</span><span class="zh" style="grid-column:span 2;background:var(--yellow)">Aanval</span>
   ${rowsIdx.map((ri, r) => `<span class="rl">${ZONES.rows[r]}</span>` + ZONES.cells[ri].map((c, ci) => { const [t, s] = Array.isArray(c) ? c : [c, ""]; return `<button type="button" class="z ${ZONES.cols[ci]}">${esc(t)}${s ? `<small>${esc(s)}</small>` : ""}</button>`; }).join("")).join("")}</div>
   <p class="hint" style="margin:12px 0 0">→ Aanvalsrichting</p></div>
  <div class="sec grid2"><div class="panel"><h2>Hoe gebruik je de zonekaart?</h2><p class="muted" style="margin:0">Gebruik de namen van de zones als gemeenschappelijke taal in training en wedstrijd. "Speel je vrij in de infiltratie zone" is voor een speler duidelijker dan "loop tussen de lijnen". In de opbouwzones vragen we rust en geen balverlies, in de aanvalszones durf en acties.</p></div>
  <div class="panel"><h2>Verder met</h2><div class="row"><a class="btn ghost" href="#/principes">${IC.video}Spelprincipes 8v8</a><a class="btn ghost" href="#/animatiebord">${IC.board}Animatiebord</a></div></div></div>`;
} });

/* ============ videoanalyse (vervangt Tactiekbord 2) ============ */
route("videoanalyse", { title: "Videoanalyse", render: v => {
  const clubV = [["", "Kies een clubvideo"], ...PRINCIPLES.map(p => [`media/principes/${p.v}.mp4`, `${p.f} · ${p.t}`]), ["media/analyse/u13-goal-animatie.mp4", "Voorbeeld: doelpunt U13 als animatie"]];
  v.innerHTML = head("Videoanalyse", "Zet de tactische animatie naast echte wedstrijdbeelden en speel ze samen af. Je eigen beelden blijven op je toestel; ze worden nergens geüpload.") +
  `<div class="vs">${[0, 1].map(i => `<div class="vbox"><video id="v${i}" playsinline ${i === 0 ? 'src="media/analyse/u13-goal-animatie.mp4"' : ""}></video><div class="vh"><select data-v="${i}">${clubV.map(([s, l]) => `<option value="${s}"${i === 0 && s.includes("u13") ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>
    <label class="btn ghost small" style="cursor:pointer">${IC.video}Eigen video<input type="file" accept="video/*" data-file="${i}" hidden></label></div></div>`).join("")}</div>
  <div class="panel sec row" style="justify-content:center"><button class="btn" type="button" id="pp">${IC.play}Samen afspelen</button><button class="btn ghost" type="button" id="rw">−3 s</button><button class="btn ghost" type="button" id="ff">+3 s</button>
    <button class="btn ghost" type="button" id="sync">Gelijkzetten</button><label class="f" style="flex-direction:row;align-items:center;gap:8px">Snelheid<select id="rate" style="width:90px"><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="1.5">1,5×</option></select></label></div>
  <p class="hint">Tip: zet beide video's op hetzelfde moment (bijvoorbeeld de start van de actie) en klik op Gelijkzetten. Daarna lopen ze samen.</p>`;
  const vs = [$("#v0"), $("#v1")]; let off = 0;
  $$("[data-v]", v).forEach(s => s.onchange = () => { const x = vs[+s.dataset.v]; if (s.value) { x.src = s.value; x.load(); } });
  $$("[data-file]", v).forEach(f => f.onchange = () => { const file = f.files[0]; if (!file) return; const x = vs[+f.dataset.file]; x.src = URL.createObjectURL(file); x.load(); });
  $("#pp").onclick = () => { const playing = vs.some(x => !x.paused); vs.forEach(x => playing ? x.pause() : x.play().catch(() => {})); $("#pp").innerHTML = playing ? IC.play + "Samen afspelen" : IC.pause + "Pauze"; };
  $("#rw").onclick = () => vs.forEach(x => x.currentTime = Math.max(0, x.currentTime - 3)); $("#ff").onclick = () => vs.forEach(x => x.currentTime += 3);
  $("#sync").onclick = () => { off = vs[1].currentTime - vs[0].currentTime; toast("Video's staan gelijk."); };
  $("#rate").onchange = e => vs.forEach(x => x.playbackRate = +e.target.value);
  vs[0].addEventListener("seeked", () => { if (Math.abs(vs[1].currentTime - (vs[0].currentTime + off)) > .3 && vs[1].duration) vs[1].currentTime = Math.max(0, vs[0].currentTime + off); });
  return () => vs.forEach(x => { x.pause(); if (x.src.startsWith("blob:")) URL.revokeObjectURL(x.src); });
} });

/* ============ ingebouwde tools ============ */
function embed(v, src, title) { v.innerHTML = `<iframe class="embed" src="${src}" title="${esc(title)}" allow="clipboard-write; fullscreen" loading="eager"></iframe>`; }
route("animatiebord", { title: "Animatiebord", wide: true, render: v => embed(v, "tactiekbord/", "Animatiebord") });
route("matchday", { title: "Wedstrijdblad", wide: true, render: v => {
  if (S.team) { const next = S.events.find(e => e.type === "wedstrijd" && e.date >= todayIso());
    const sel = next ? active().filter(p => { const a = attOf(next.id, p.id); return !a || a.status === "aanwezig" || a.status === "te laat"; }).map(p => p.id) : [];
    try { localStorage.setItem("ogv-matchday-import", JSON.stringify({ id: S.team.id, name: S.team.name, format: S.team.format || "5v5",
      squad: active().map(p => ({ id: p.id, name: pname(p), nr: p.number ?? "" })), sel, opp: next?.opponent || "", date: next?.date || "", kick: tm(next?.start_time), home: next ? (next.home === false ? "uit" : "thuis") : "" })); } catch (e) {} }
  embed(v, "matchday/", "Wedstrijdblad");
} });

/* ============ mixschema ============ */
const MIX_DAYS = [[[0,3,5,7,8,10,13],[1,2,4,6,9,11,12]],[[1,4,5,7,9,11,12],[0,2,3,6,8,10,13]],[[0,1,6,7,9,10,13],[2,3,4,5,8,11,12]],[[2,4,5,7,10,11,13],[0,1,3,6,8,9,12]],[[0,2,4,7,8,11,13],[1,3,5,6,9,10,12]],[[0,2,3,7,9,12,13],[1,4,5,6,8,10,11]],[[2,5,6,7,8,9,12],[0,1,3,4,10,11,13]],[[1,4,6,7,8,9,13],[0,2,3,5,10,11,12]],[[1,3,4,7,8,10,12],[0,2,5,6,9,11,13]],[[1,3,5,7,9,11,13],[0,2,4,6,8,10,12]],[[1,2,6,7,8,10,11],[0,3,4,5,9,12,13]],[[3,4,6,7,11,12,13],[0,1,2,5,8,9,10]],[[2,3,6,7,10,12,13],[0,1,4,5,8,9,11]],[[1,2,3,7,9,10,11],[0,4,5,6,8,12,13]],[[0,5,6,7,10,11,12],[1,2,3,4,8,9,13]],[[3,4,5,7,8,9,10],[0,1,2,6,11,12,13]],[[1,2,5,7,8,12,13],[0,3,4,6,9,10,11]],[[0,2,4,7,9,10,12],[1,3,5,6,8,11,13]],[[0,1,3,7,8,11,12],[2,4,5,6,9,10,13]],[[0,3,6,7,8,9,11],[1,2,4,5,10,12,13]]];
let mixTab = "dagen", mixPeriod = "all", mixP = 0;
route("mixschema", { title: "Mixschema", auth: true, render: async v => {
  const docs = await db.list("club_docs", { key: "mixschema" }); const doc = docs[0] || { key: "mixschema", data: { names: Array(14).fill("") } };
  const names = doc.data.names || Array(14).fill(""), coll = new Intl.Collator("nl", { numeric: true });
  const label = i => (names[i] || "").trim() || "Speler " + (i + 1), sorted = l => l.slice().sort((a, b) => coll.compare(label(a), label(b)));
  const save = debounce(() => safe(() => db.save("club_docs", { key: "mixschema", data: { names } }), "Namen bewaard."), 800);
  const draw = () => {
    let body = "";
    if (mixTab === "dagen") body = `<div class="chips" style="margin-bottom:14px">${[["all", "Alle 20"], ["voor", "Voor kerst (1 tot 6)"], ["na", "Na kerst (7 tot 20)"]].map(([k, l]) => `<button class="chip" type="button" data-p="${k}" aria-pressed="${mixPeriod === k}">${l}</button>`).join("")}</div>
      <div class="days">${MIX_DAYS.map((d, k) => { const nr = k + 1, voor = nr <= 6; if ((mixPeriod === "voor" && !voor) || (mixPeriod === "na" && voor)) return "";
        return `<div class="day"><div class="h"><b>Speeldag ${nr}</b><span class="hint">${voor ? "voor kerst" : "na kerst"}</span></div><div class="tm">${d.map((l, t) => `<div><span class="pill ${t ? "g" : "w"}">Ploeg ${t + 1}</span><ul>${sorted(l).map(i => `<li>${esc(label(i))}</li>`).join("")}</ul></div>`).join("")}</div></div>`; }).join("")}</div>`;
    else if (mixTab === "speler") body = `<label class="f" style="max-width:320px">Speler<select id="ps">${sorted([...Array(14).keys()]).map(i => `<option value="${i}"${i === mixP ? " selected" : ""}>${esc(label(i))}</option>`).join("")}</select></label>
      <div class="panel wrapx sec" style="padding:6px 12px"><table class="tbl"><thead><tr><th>Dag</th><th style="text-align:left">Ploeg</th><th style="text-align:left">Speelt samen met</th></tr></thead><tbody>${MIX_DAYS.map((d, k) => { const t = d[0].includes(mixP) ? 0 : 1;
        return `<tr><td>${k + 1}</td><td style="text-align:left"><span class="pill ${t ? "g" : "w"}">Ploeg ${t + 1}</span></td><td style="text-align:left;white-space:normal" class="muted">${sorted(d[t].filter(x => x !== mixP)).map(label).map(esc).join(", ")}</td></tr>`; }).join("")}</tbody></table></div>`;
    else body = `<div class="panel"><p class="muted" style="margin-top:0">Alleen voor trainers. Hier zie je wie in groep A en groep B zit; op de andere tabbladen staat dat nergens.</p><div class="grid2">${[["Groep A", 0], ["Groep B", 7]].map(([g, o]) => `<div><h3>${g}</h3>${[...Array(7).keys()].map(j => `<label class="f" style="flex-direction:row;align-items:center;gap:8px;margin-bottom:6px"><span style="width:20px">${j + 1}</span><input data-n="${o + j}" value="${esc(names[o + j] || "")}" maxlength="40" placeholder="Naam speler ${g.slice(-1)}${j + 1}"></label>`).join("")}</div>`).join("")}</div></div>`;
    v.innerHTML = head("Mixschema", "Gemengde wedstrijd van 30 minuten, 20 speeldagen. Namen staan alfabetisch, zodat niemand ziet wie in groep A of B zit.", `<button class="btn ghost" type="button" onclick="print()">${IC.print}Afdrukken</button>`) +
      `<div class="ptabs" role="tablist">${[["dagen", "Speeldagen"], ["speler", "Per speler"], ["namen", "Namen invullen"]].map(([k, l]) => `<button type="button" role="tab" data-t="${k}" aria-selected="${mixTab === k}">${l}</button>`).join("")}</div>` + body;
    $$("[data-t]", v).forEach(b => b.onclick = () => { mixTab = b.dataset.t; draw(); }); $$("[data-p]", v).forEach(b => b.onclick = () => { mixPeriod = b.dataset.p; draw(); });
    const ps = $("#ps"); if (ps) ps.onchange = () => { mixP = +ps.value; draw(); };
    $$("[data-n]", v).forEach(i => i.oninput = () => { names[+i.dataset.n] = i.value; save(); });
  };
  draw();
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
  <div class="fields sec" style="grid-template-columns:2fr 1fr 1fr 1fr"><input id="fq" type="search" placeholder="Zoek op naam of club" value="${esc(scF.q)}"><select id="fp"><option value="">Alle posities</option>${Object.keys(SC_POS).map(x => `<option${scF.p === x ? " selected" : ""}>${x}</option>`).join("")}</select>
    <select id="fs"><option value="">Alle statussen</option>${SC_STAT.map(x => `<option${scF.s === x ? " selected" : ""}>${x}</option>`).join("")}</select><select id="fn"><option value="">Alle niveaus</option>${["Top talent", "Interessant", "Opvolgen", "Onder niveau"].map(x => `<option${scF.n === x ? " selected" : ""}>${x}</option>`).join("")}</select></div>
  <p class="hint">${list.length} getoond</p>
  ${list.length ? `<div class="grid3">${list.map(p => { const a = scAvg(p), age = p.geb ? Math.floor((Date.now() - new Date(p.geb)) / 31557600000) : "";
    return `<a class="sc-card" href="#/scouting/${esc(p.id)}"><div class="hd"><span class="bg">${f1(a)}</span><span style="min-width:0"><b style="display:block;font-weight:800;font-stretch:112%;font-size:19px">${esc(p.naam)}</b><small class="muted">${esc([p.club, age ? age + " jaar" : "", p.voet ? p.voet + " voet" : ""].filter(Boolean).join(" · "))}</small>
      <span class="chips" style="margin-top:6px">${[p.p1, p.p2, p.p3].filter(Boolean).map(x => `<span class="pill g">${esc((SC_POS[x] || [x])[0])}</span>`).join("")}${a != null ? `<span class="pill ${a >= 8 ? "w" : "g"}">${scNiv(a)}</span>` : ""}</span></span></div>
      ${SC_COMP.map((c, i) => { const val = p["k" + i]; return `<div class="mbar"><span>${SC_SH[i]}</span><span class="b"><i style="width:${scNum(val) ? val * 10 : 0}%;background:${scNum(val) ? scCol(val) : "transparent"}"></i></span><b style="color:var(--ink);text-align:right">${scNum(val) ? f1(val) : "–"}</b></div>`; }).join("")}
      <div class="row hint"><span class="pill" style="background:#000;color:var(--yellow)">${esc(p.stat || "Nieuw")}</span><span class="spacer"></span>${esc(p.scout || "")}${p.dat ? " · " + esc(p.dat) : ""}</div></a>`; }).join("")}</div>`
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
      <div class="kpi" style="background:#000;border-color:var(--yellow)"><small>Algemeen cijfer</small><b style="color:var(--yellow)">${f1(a)}</b><span>${a == null ? "Zichtbaar als alle 5 scores ingevuld zijn" : scNiv(a)}</span></div></div>
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
