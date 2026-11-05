/* OGV Platform — spelersevaluaties: vier vaste momenten (winterstop en einde seizoen verplicht),
   onderdelen in groepen met uitleg, per speler een volledige fiche met sterktes, werkpunten en doelen,
   ploeganalyse en een afdrukbaar rapport voor het oudergesprek. */
"use strict";
const EV_MOMENTS = [
  { m: 1, naam: "Start seizoen", kort: "Start", periode: "augustus – september", from: [0, 7, 1], to: [0, 8, 30] },
  { m: 2, naam: "Herfst", kort: "Herfst", periode: "oktober – november", from: [0, 9, 1], to: [0, 10, 30] },
  { m: 3, naam: "Winterstop", kort: "Winter", periode: "december – januari", from: [0, 11, 1], to: [1, 0, 31], verplicht: true },
  { m: 4, naam: "Maart", kort: "Maart", periode: "half februari – half april", from: [1, 1, 15], to: [1, 3, 15] },
  { m: 5, naam: "Einde seizoen", kort: "Einde", periode: "mei – juni", from: [1, 4, 1], to: [1, 5, 30], verplicht: true }];
const EV_LAST = EV_MOMENTS.length;
const EV_LEVELS = { 1: "Nog niet", 1.5: "Nog niet tot soms", 2: "Soms", 2.5: "Soms tot meestal", 3: "Meestal", 3.5: "Meestal tot bijna altijd", 4: "Bijna altijd", 4.5: "Bijna altijd tot uitblinker", 5: "Uitblinker" };
const EV_TEMPLATE = ["# Techniek",
  "Techniek (controle over de bal) | Houdt de bal dicht bij de voet, met beide voeten, ook onder druk",
  "Passing | Zuiver en op het juiste moment passen, ook met de zwakke voet",
  "Balaanname | Eerste aanname weg van de druk en in de looprichting",
  "Dribbel en 1v1 | Durft en kan een tegenstander uitspelen",
  "Afwerking | Rustig en gericht afwerken, met beide voeten",
  "# Spelinzicht",
  "Positiespel | Staat aanspeelbaar en maakt het veld breed en diep",
  "Keuzes aan de bal | Kiest op het juiste moment tussen dribbel, pass en schot",
  "Omschakeling | Reageert meteen bij balverlies en balwinst",
  "Verdedigen | Zet druk, sluit passlijnen en wint duels",
  "# Fysiek",
  "Conditie | Houdt het tempo vol tot het einde",
  "Snelheid en wendbaarheid | Snel vertrekken, draaien en stoppen",
  "Coördinatie | Beweegt soepel en blijft in evenwicht",
  "# Mentaal en team",
  "Coaching | Praat op het veld en helpt medespelers",
  "Inzet | Werkt hard en geeft nooit op",
  "Concentratie | Blijft gefocust op training en wedstrijd",
  "Zelfvertrouwen | Durft de bal te vragen en fouten te maken",
  "Bijdrage aan de ploeg | Speelt voor de ploeg en steunt anderen",
  "Leerbereidheid | Luistert en past tips meteen toe",
  "# Algemeen",
  "Potentieel | Hoe ver kan deze speler nog groeien?"];
const EV_ADVICE = ["Blijft in deze ploeg", "Klaar voor een hoger niveau", "Beter op zijn plaats in een andere ploeg", "Bespreken met de jeugdcoördinator"];
const EV_LEVEL_TEAM = ["Boven het niveau van de ploeg", "Op het niveau van de ploeg", "Onder het niveau van de ploeg"];

/* onderdelen lezen: "# Groep" start een groep, "Naam | uitleg" geeft uitleg; oude lijsten zonder groepen blijven werken */
function evGroups(t = S.team) {
  const list = t?.criteria?.length ? t.criteria : EV_TEMPLATE, out = []; let g = null;
  for (const raw of list) { const l = String(raw).trim(); if (!l) continue;
    if (l.startsWith("#")) { g = { name: l.replace(/^#+\s*/, ""), items: [] }; out.push(g); continue; }
    if (!g) { g = { name: "Onderdelen", items: [] }; out.push(g); }
    const [name, hint] = l.split(/\s+\|\s+/); g.items.push({ name: name.trim(), hint: (hint || "").trim() }); }
  return out.filter(x => x.items.length);
}
const evItems = t => evGroups(t).flatMap(g => g.items.map(i => i.name));
const evLegacy = t => !(t?.criteria || []).some(l => String(l).trim().startsWith("#"));
const evScore = (e, c) => { const v = +e?.scores?.[c]; return isNaN(v) || e?.scores?.[c] == null || e?.scores?.[c] === "" ? null : v; };
const evAvgOf = (e, names) => avg(names.map(c => evScore(e, c)).filter(v => v != null));
const evOf = (pid, m) => S.evals.find(x => x.player_id === pid && x.moment === m) || null;
const evPrev = (pid, m) => { for (let k = m - 1; k >= 1; k--) { const e = evOf(pid, k); if (e && Object.keys(e.scores || {}).length) return e; } return null; };
const evDone = (e, names) => !!e && names.every(c => evScore(e, c) != null);
const evStarted = e => !!e && Object.keys(e.scores || {}).length > 0;
function evWindow(mo, t = S.team) { const y = parseInt(String(t?.season || seasonNow())) || new Date().getFullYear();
  const mk = ([dy, mm, dd]) => new Date(y + dy, mm, dd, 12); return { from: mk(mo.from), to: mk(mo.to) }; }
function evCurrent(t = S.team) { const now = new Date();
  for (const mo of EV_MOMENTS) { const w = evWindow(mo, t); if (now <= w.to) return mo.m; } return EV_LAST; }
const evDelta = d => d == null ? "" : `<span class="dl ${d > 0.04 ? "up" : d < -0.04 ? "down" : ""}">${d > 0.04 ? "▲ +" : d < -0.04 ? "▼ " : "= "}${f1(Math.abs(d) < 0.05 ? 0 : d).replace(/^-/, "−")}</span>`;
const evColor = v => v == null ? "var(--card3)" : v >= 4 ? "#34D17A" : v >= 3 ? "#A3D63B" : v >= 2.5 ? "#FFD100" : v >= 2 ? "#F59E0B" : "#F2615A";
async function evPut(e) {
  try { await db.save("evaluations", e); } catch (err) { throw /details|column/i.test(err.message || "") ? new Error("voer eerst ogv-update-v6.sql uit in Supabase") : err; }
  const i = S.evals.findIndex(x => x.player_id === e.player_id && x.moment === e.moment); if (i >= 0) S.evals[i] = e; else S.evals.push(e);
}
const evNew = (pid, m) => ({ id: uid(), team_id: S.team.id, player_id: pid, moment: m, date: todayIso(), scores: {}, comment: null });

/* ============ overzicht ============ */
let evMoment = null, evView = "spelers";
route("evaluaties", { title: "Evaluaties", auth: true, team: true, render: (v, pid, sub) => {
  if (evMoment == null) evMoment = evCurrent();
  if (pid) { if (+sub >= 1 && +sub <= EV_LAST) evMoment = +sub; return evForm(v, pid, evMoment); }
  const ps = active(), groups = evGroups(), names = evItems(), mo = EV_MOMENTS[evMoment - 1], w = evWindow(mo);
  const done = ps.filter(p => evDone(evOf(p.id, evMoment), names)).length, started = ps.filter(p => evStarted(evOf(p.id, evMoment))).length;
  const now = new Date(), open = now >= w.from && now <= w.to, late = now > w.to && done < ps.length, dfmt = d => d.toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
  v.innerHTML = head("Evaluaties", `${esc(S.team.name)} · vijf momenten per seizoen. De winterstop en het einde van het seizoen zijn verplicht.`,
    `<button class="btn ghost" type="button" id="evPrintAll">${IC.print}Alle rapporten</button>`) +
  (evLegacy(S.team) ? `<div class="panel hl row" style="margin-bottom:14px"><span style="flex:1;min-width:220px"><b>Uitgebreide evaluatie beschikbaar</b><br><span class="hint">${groups[0].items.length} onderdelen nu, straks ${EV_TEMPLATE.filter(l => !l.startsWith("#")).length} in vijf groepen met uitleg per onderdeel. Je huidige scores blijven staan.</span></span><button class="btn small" type="button" id="evUpgrade">Overschakelen</button></div>` : "") +
  `<div class="evmoments" role="tablist">${EV_MOMENTS.map(x => { const ww = evWindow(x), dn = ps.filter(p => evDone(evOf(p.id, x.m), names)).length, st = ps.filter(p => evStarted(evOf(p.id, x.m))).length;
    return `<button type="button" role="tab" data-m="${x.m}" aria-selected="${x.m === evMoment}"><span class="n">${x.m}</span><span class="tx"><b>${x.naam}${x.verplicht ? ' <i class="req">verplicht</i>' : ""}</b><small>${x.periode}</small></span>
      <span class="pr"><span style="width:${ps.length ? dn / ps.length * 100 : 0}%"></span></span><small class="ct">${dn ? dn + "/" + ps.length + " klaar" : st ? st + " bezig" : now > ww.to ? "niet gedaan" : "nog niet"}</small></button>`; }).join("")}</div>
  <div class="evhead"><div><h2 style="margin:0">${mo.naam}</h2><p class="hint" style="margin:2px 0 0">${open ? `Nu bezig · invullen tot ${dfmt(w.to)}` : now < w.from ? `Start op ${dfmt(w.from)}` : `Periode voorbij (${dfmt(w.from)} – ${dfmt(w.to)})`}${late && mo.verplicht ? ' · <b style="color:var(--bad)">nog niet afgerond</b>' : ""}</p></div>
    <div class="kpi mini"><small>Klaar</small><b>${done}<span>/${ps.length}</span></b></div><div class="kpi mini"><small>Gemiddelde ploeg</small><b>${f1(avg(ps.map(p => evAvgOf(evOf(p.id, evMoment), names)).filter(x => x != null)))}</b></div></div>
  <div class="ptabs" role="tablist">${[["spelers", "Per speler"], ["tabel", "Snel invullen"], ["ploeg", "Ploeganalyse"]].map(([k, l]) => `<button type="button" role="tab" data-v="${k}" aria-selected="${evView === k}">${l}</button>`).join("")}</div><div id="evv"></div>`;
  const vv = $("#evv");
  if (!ps.length) vv.innerHTML = `<div class="empty"><b>Nog geen spelers</b><a class="link" href="#/spelers">Voeg eerst je spelers toe</a></div>`;
  else if (evView === "spelers") vv.innerHTML = `<div class="evcards">${ps.map(p => { const e = evOf(p.id, evMoment), pr = evPrev(p.id, evMoment), a = evAvgOf(e, names), b = pr ? evAvgOf(pr, names) : null;
      const dn = names.filter(c => evScore(e, c) != null).length;
      return `<a class="evcard" href="#/evaluaties/${p.id}/${evMoment}"><div class="top"><span class="num">${p.number ?? ""}</span><span class="nm"><b>${esc(pname(p))}</b><small>${evDone(e, names) ? "Klaar" : dn ? `${dn} van ${names.length} ingevuld` : "Nog niet ingevuld"}${e?.details?.talk ? " · gesprek gevoerd" : ""}</small></span>
        <span class="big" style="--c:${evColor(a)}">${a == null ? "–" : f1(a)}</span></div>
        <div class="gbars">${groups.map(g => { const ga = evAvgOf(e, g.items.map(i => i.name)), gb = pr ? evAvgOf(pr, g.items.map(i => i.name)) : null;
          return `<div class="gb"><span>${esc(g.name)}</span><span class="bar"><i style="width:${ga == null ? 0 : (ga / 5) * 100}%;background:${evColor(ga)}"></i>${gb != null ? `<em style="left:${(gb / 5) * 100}%"></em>` : ""}</span><b>${f1(ga)}</b></div>`; }).join("")}</div>
        <div class="ft">${b != null && a != null ? evDelta(a - b) + ` <span class="hint">t.o.v. ${EV_MOMENTS[pr.moment - 1].naam.toLowerCase()}</span>` : `<span class="hint">${pr ? "" : "eerste evaluatie"}</span>`}<span class="spacer"></span><span class="go">${evStarted(e) ? "Openen" : "Evalueren"} ›</span></div></a>`; }).join("")}</div>`;
  else if (evView === "tabel") { const opts = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    vv.innerHTML = `<p class="hint" style="margin-top:0">Handig op een computer: alle spelers en onderdelen in één tabel. Elke keuze wordt meteen bewaard.</p><div class="panel wrapx evtbl" style="padding:6px 10px"><table class="tbl"><thead><tr><th class="sticky">Speler</th>${groups.map(g => g.items.map((i, k) => `<th class="${k === 0 ? "gstart" : ""}" title="${esc(i.hint)}"><span class="g">${k === 0 ? esc(g.name) : "&nbsp;"}</span>${esc(i.name)}</th>`).join("")).join("")}<th>Gem.</th></tr></thead><tbody>
      ${ps.map(p => { const e = evOf(p.id, evMoment); return `<tr data-p="${p.id}"><td class="sticky"><a href="#/evaluaties/${p.id}/${evMoment}">${esc(pname(p))}</a></td>${groups.map(g => g.items.map((i, k) => `<td class="${k === 0 ? "gstart" : ""}"><select data-c="${esc(i.name)}" aria-label="${esc(i.name)} voor ${esc(pname(p))}" style="--c:${evColor(evScore(e, i.name))}"><option value="">–</option>${opts.map(o => `<option value="${o}"${evScore(e, i.name) === o ? " selected" : ""}>${String(o).replace(".", ",")}</option>`).join("")}</select></td>`).join("")).join("")}<td class="avg"><b>${f1(evAvgOf(e, names))}</b></td></tr>`; }).join("")}</tbody></table></div>`;
    $$("tr[data-p] select", vv).forEach(sel => sel.onchange = async () => { const tr = sel.closest("tr"), pid2 = tr.dataset.p, old = evOf(pid2, evMoment);
      const e = old ? { ...old, scores: { ...old.scores } } : evNew(pid2, evMoment);
      if (sel.value === "") delete e.scores[sel.dataset.c]; else e.scores[sel.dataset.c] = +sel.value;
      if (await safe(async () => { await evPut(e); return true; })) { sel.style.setProperty("--c", evColor(evScore(e, sel.dataset.c))); $(".avg b", tr).textContent = f1(evAvgOf(e, names)); } }); }
  else vv.innerHTML = evTeamAnalysis(ps, groups, names);
  $$("[data-m]", v).forEach(b => b.onclick = () => { evMoment = +b.dataset.m; render(); });
  $$("[data-v]", v).forEach(b => b.onclick = () => { evView = b.dataset.v; render(); });
  const up = $("#evUpgrade"); if (up) up.onclick = async () => { const t = S.team, old = t.criteria; t.criteria = EV_TEMPLATE.slice();
    if (await safe(async () => { await db.save("teams", t); return true; }, "Uitgebreide evaluatie staat aan.")) render(); else t.criteria = old; };
  $("#evPrintAll").onclick = () => evPrint(ps.filter(p => evStarted(evOf(p.id, evMoment))), evMoment);
} });
function evTeamAnalysis(ps, groups, names) {
  const m = evMoment, prevM = m > 1 ? m - 1 : null;
  const avgFor = (c, mm) => avg(ps.map(p => evScore(evOf(p.id, mm), c)).filter(v => v != null));
  const rows = groups.map(g => `<div class="panel"><h3 style="margin:0 0 10px">${esc(g.name)}</h3>${g.items.map(i => { const a = avgFor(i.name, m), b = prevM ? avgFor(i.name, prevM) : null;
    return `<div class="crow"><span class="cn">${esc(i.name)}</span><span class="bar"><i style="width:${a == null ? 0 : a / 5 * 100}%;background:${evColor(a)}"></i>${b != null ? `<em style="left:${b / 5 * 100}%" title="${EV_MOMENTS[prevM - 1].naam}: ${f1(b)}"></em>` : ""}</span><b>${f1(a)}</b>${a != null && b != null ? evDelta(a - b) : "<span></span>"}</div>`; }).join("")}</div>`).join("");
  const growth = ps.map(p => { const e = evOf(p.id, m), pr = evPrev(p.id, m); const a = evAvgOf(e, names), b = pr ? evAvgOf(pr, names) : null; return { p, a, d: a != null && b != null ? a - b : null }; });
  const best = growth.filter(x => x.d != null).sort((x, y) => y.d - x.d).slice(0, 3), low = growth.filter(x => x.a != null).sort((x, y) => x.a - y.a).slice(0, 3);
  const items = groups.flatMap(g => g.items.map(i => ({ n: i.name, a: avgFor(i.name, m) }))).filter(x => x.a != null).sort((x, y) => x.a - y.a);
  return `<p class="hint" style="margin-top:0">Gemiddelde van de ploeg per onderdeel. Het streepje is de vorige evaluatie.</p><div class="grid3 evsum">
    <div class="panel"><h3 style="margin:0 0 8px">Grootste groei</h3>${best.length ? best.map(x => `<div class="row"><a class="link" href="#/evaluaties/${x.p.id}/${m}">${esc(pname(x.p))}</a><span class="spacer"></span>${evDelta(x.d)}</div>`).join("") : '<p class="hint" style="margin:0">Nog geen vorige evaluatie om mee te vergelijken.</p>'}</div>
    <div class="panel"><h3 style="margin:0 0 8px">Werkpunten van de ploeg</h3>${items.slice(0, 3).map(x => `<div class="row"><span>${esc(x.n)}</span><span class="spacer"></span><b>${f1(x.a)}</b></div>`).join("") || '<p class="hint" style="margin:0">–</p>'}<p class="hint" style="margin:8px 0 0">Goede thema's voor de trainingen van de volgende periode.</p></div>
    <div class="panel"><h3 style="margin:0 0 8px">Extra aandacht</h3>${low.map(x => `<div class="row"><a class="link" href="#/evaluaties/${x.p.id}/${m}">${esc(pname(x.p))}</a><span class="spacer"></span><b>${f1(x.a)}</b></div>`).join("") || '<p class="hint" style="margin:0">–</p>'}</div></div>
    <div class="grid2 sec">${rows}</div>`;
}

/* ============ fiche van één speler ============ */
function evForm(v, pid, m) {
  const p = S.players.find(x => x.id === pid); if (!p) { v.innerHTML = `<div class="empty"><b>Speler niet gevonden</b><a class="link" href="#/evaluaties">Terug</a></div>`; return; }
  const ps = active(), idx = ps.findIndex(x => x.id === pid), groups = evGroups(), names = evItems(), mo = EV_MOMENTS[m - 1];
  let e = evOf(pid, m); e = e ? { ...e, scores: { ...e.scores }, details: { ...(e.details || {}) } } : { ...evNew(pid, m), details: {} };
  const pr = evPrev(pid, m), D = e.details, steps = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const saveLater = debounce(() => safe(async () => { await evPut(e); $("#evsaved").textContent = "Bewaard"; }), 600);
  const touch = () => { $("#evsaved").textContent = "Bewaren…"; saveLater(); };
  const s = playerStats(p);
  v.innerHTML = backLink("#/evaluaties", "Evaluaties") + `<div class="ph"><span class="num" style="width:56px;height:56px;border-radius:16px;background:var(--yellow);color:#000;font-size:24px;border:0">${p.number ?? ""}</span>
    <div class="t"><h1 class="pg">${esc(pname(p))}</h1><p class="sub">${mo.naam}${mo.verplicht ? " (verplicht)" : ""} · ${esc(S.team.name)}${pr ? ` · vergeleken met ${EV_MOMENTS[pr.moment - 1].naam.toLowerCase()}` : ""}</p></div>
    <span class="hint" id="evsaved"></span><button class="btn ghost" type="button" id="evRep">${IC.print}Rapport</button></div>
  <div class="evnav"><select id="evM" aria-label="Moment">${EV_MOMENTS.map(x => `<option value="${x.m}"${x.m === m ? " selected" : ""}>${x.m}. ${x.naam}</option>`).join("")}</select>
    <span class="spacer"></span>${idx > 0 ? `<a class="btn ghost small" href="#/evaluaties/${ps[idx - 1].id}/${m}">‹ ${esc(ps[idx - 1].first_name)}</a>` : ""}<span class="hint">${idx + 1} / ${ps.length}</span>${idx < ps.length - 1 ? `<a class="btn ghost small" href="#/evaluaties/${ps[idx + 1].id}/${m}">${esc(ps[idx + 1].first_name)} ›</a>` : ""}</div>
  <div class="evlayout"><div class="evmain">
    <div class="evlegend">${[1, 2, 3, 4, 5].map(n => `<span><i style="background:${evColor(n)}"></i>${n} ${EV_LEVELS[n].toLowerCase()}</span>`).join("")}<span><i class="prevmark"></i>vorige keer</span></div>
    ${groups.map((g, gi) => `<section class="panel evgroup" data-g="${gi}"><div class="gh"><h2>${esc(g.name)}</h2><span class="gavg" style="--c:${evColor(evAvgOf(e, g.items.map(i => i.name)))}">${f1(evAvgOf(e, g.items.map(i => i.name)))}</span></div>
      ${g.items.map(i => { const cur = evScore(e, i.name), prv = pr ? evScore(pr, i.name) : null;
        return `<div class="crit" data-c="${esc(i.name)}"><div class="cl"><b>${esc(i.name)}</b>${i.hint ? `<small>${esc(i.hint)}</small>` : ""}</div>
          <div class="scale9" role="radiogroup" aria-label="${esc(i.name)}">${steps.map(n => `<button type="button" role="radio" data-s="${n}" aria-checked="${cur === n}" title="${EV_LEVELS[n]}" class="${n % 1 ? "half" : ""}${prv === n ? " prev" : ""}" style="--c:${evColor(n)}">${n % 1 ? "½" : n}</button>`).join("")}</div>
          <div class="cv"><span class="lvl">${cur == null ? "" : EV_LEVELS[cur]}</span>${prv != null ? `<span class="hint">vorige: ${f1(prv)}</span>` : ""}</div></div>`; }).join("")}</section>`).join("")}
    <section class="panel"><h2>Sterktes en werkpunten</h2><div id="evsug"></div>
      <div class="fields"><label class="f full">Sterktes<textarea data-d="strengths" rows="3" placeholder="Waar blinkt deze speler in uit?">${esc(D.strengths || "")}</textarea></label>
      <label class="f full">Werkpunten<textarea data-d="workpoints" rows="3" placeholder="Wat moet beter? Concreet en haalbaar.">${esc(D.workpoints || "")}</textarea></label>
      <label class="f full">Doelen tot de volgende evaluatie <span class="hint">één per regel</span><textarea data-d="goals" rows="3" placeholder="bv. Met links passen over 10 meter">${esc(D.goals || "")}</textarea></label></div>
      <div class="row" style="margin-top:8px"><button class="btn ghost small" type="button" id="evGoals">${IC.plus}Als persoonlijke doelen bewaren</button><span class="hint">Komen op de spelerskaart, waar je ze kan afvinken.</span></div></section>
  </div><aside class="evside">
    <section class="panel evscore"><small>Gemiddelde</small><b id="evAvg" style="color:${evColor(evAvgOf(e, names))}">${f1(evAvgOf(e, names))}</b><span id="evAvgD">${pr ? evDelta(evAvgOf(e, names) != null && evAvgOf(pr, names) != null ? evAvgOf(e, names) - evAvgOf(pr, names) : null) : ""}</span>
      <div class="hint" id="evCount">${names.filter(c => evScore(e, c) != null).length} van ${names.length} onderdelen</div>
      <div class="evstats"><div><small>Training</small><b>${s.trTot ? s.trPct + "%" : "–"}</b></div><div><small>Wedstrijden</small><b>${s.matches}</b></div><div><small>Minuten</small><b>${s.minutes}</b></div><div><small>Matchcijfer</small><b>${f1(s.rating)}</b></div></div></section>
    <section class="panel"><h3>Positie en niveau</h3><div class="fields"><label class="f full">Beste positie(s)<input data-d="position" value="${esc(D.position || p.position || "")}" placeholder="bv. Piloot, staart"></label>
      <label class="f full">Niveau t.o.v. de ploeg<select data-d="level"><option value="">–</option>${EV_LEVEL_TEAM.map(x => `<option${D.level === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>
      ${m === EV_LAST ? `<label class="f full">Advies volgend seizoen<select data-d="advice"><option value="">–</option>${EV_ADVICE.map(x => `<option${D.advice === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>` : ""}</div></section>
    <section class="panel"><h3>Oudergesprek</h3><div class="fields"><label class="f full">Boodschap voor speler en ouders <span class="hint">komt op het rapport</span><textarea data-d="parents" rows="4" placeholder="Wat wil je zeker meegeven?">${esc(D.parents || "")}</textarea></label>
      <label class="check"><input type="checkbox" data-d="talk"${D.talk ? " checked" : ""}> Gesprek gevoerd</label></div></section>
    <section class="panel"><h3>Privénotitie</h3><textarea id="evNote" rows="4" placeholder="Alleen voor trainers, niet op het rapport">${esc(e.comment || "")}</textarea></section>
  </aside></div>`;
  const recalc = () => { const a = evAvgOf(e, names); $("#evAvg").textContent = f1(a); $("#evAvg").style.color = evColor(a);
    $("#evAvgD").innerHTML = pr && a != null && evAvgOf(pr, names) != null ? evDelta(a - evAvgOf(pr, names)) : "";
    $("#evCount").textContent = `${names.filter(c => evScore(e, c) != null).length} van ${names.length} onderdelen`;
    $$(".evgroup", v).forEach(sec => { const g = groups[+sec.dataset.g], ga = evAvgOf(e, g.items.map(i => i.name)), el = $(".gavg", sec); el.textContent = f1(ga); el.style.setProperty("--c", evColor(ga)); });
    sugg(); };
  const sugg = () => { const sc = names.map(c => [c, evScore(e, c)]).filter(x => x[1] != null && x[0] !== "Potentieel"); if (sc.length < 4) { $("#evsug").innerHTML = ""; return; }
    const top = sc.slice().sort((a, b) => b[1] - a[1]).slice(0, 3), low = sc.slice().sort((a, b) => a[1] - b[1]).slice(0, 3);
    $("#evsug").innerHTML = `<p class="hint" style="margin-top:0">Volgens de scores: sterk in ${top.map(x => `<b style="color:var(--ink)">${esc(x[0].replace(/ \(.*\)/, ""))}</b>`).join(", ")}; werkpunten ${low.map(x => `<b style="color:var(--ink)">${esc(x[0].replace(/ \(.*\)/, ""))}</b>`).join(", ")}. <button class="link" type="button" id="evFill">Overnemen</button></p>`;
    $("#evFill").onclick = () => { const add = (k, arr) => { const t = $(`[data-d="${k}"]`, v), line = arr.map(x => x[0].replace(/ \(.*\)/, "")).join(", "); if (!t.value.includes(line)) { t.value = (t.value ? t.value + "\n" : "") + line; D[k] = t.value; } };
      add("strengths", top); add("workpoints", low); touch(); }; };
  $$(".crit", v).forEach(row => $$("[data-s]", row).forEach(b => b.onclick = () => { const c = row.dataset.c, n = +b.dataset.s, on = b.getAttribute("aria-checked") !== "true";
    if (on) e.scores[c] = n; else delete e.scores[c];
    $$("[data-s]", row).forEach(x => x.setAttribute("aria-checked", on && x === b)); $(".lvl", row).textContent = on ? EV_LEVELS[n] : ""; e.date = e.date || todayIso(); recalc(); touch(); }));
  $$("[data-d]", v).forEach(el => el[el.type === "checkbox" || el.tagName === "SELECT" ? "onchange" : "oninput"] = () => { D[el.dataset.d] = el.type === "checkbox" ? el.checked : el.value; if (el.dataset.d === "talk" && el.checked) D.talk_date = todayIso(); touch(); });
  $("#evNote").oninput = ev => { e.comment = ev.target.value || null; touch(); };
  $("#evM").onchange = ev => { evMoment = +ev.target.value; go("#/evaluaties/" + pid + "/" + evMoment); };
  $("#evRep").onclick = () => { evPrint([p], m); };
  $("#evGoals").onclick = async () => { const lines = (D.goals || "").split("\n").map(x => x.trim()).filter(Boolean); if (!lines.length) { toast("Schrijf eerst een of meer doelen."); return; }
    const have = new Set(S.goals.filter(g => g.player_id === pid).map(g => g.text.toLowerCase())); let n = 0;
    await safe(async () => { for (const t of lines) { if (have.has(t.toLowerCase())) continue; const g = { id: uid(), team_id: S.team.id, player_id: pid, text: t, area: null, term: "kort", status: "bezig" }; await db.save("goals", g); S.goals.push(g); n++; } }); toast(n ? `${n} ${n === 1 ? "doel" : "doelen"} bewaard op de spelerskaart.` : "Die doelen staan al op de spelerskaart."); };
  sugg();
}

/* ============ rapport voor het oudergesprek ============ */
function evPrint(players, m) {
  if (!players.length) { toast("Er is nog geen speler geëvalueerd voor dit moment."); return; }
  const groups = evGroups(), names = evItems(), mo = EV_MOMENTS[m - 1];
  const el = document.createElement("div"); el.className = "print-only";
  el.innerHTML = players.map(p => { const e = evOf(p.id, m) || evNew(p.id, m), pr = evPrev(p.id, m), D = e.details || {}, a = evAvgOf(e, names), s = playerStats(p);
    const hist = EV_MOMENTS.map(x => [x, evAvgOf(evOf(p.id, x.m), names)]).filter(x => x[1] != null);
    return `<div class="prep"><header><div><h1>${esc(pname(p))}</h1><p>${esc(S.team.name)} · Evaluatie ${mo.naam.toLowerCase()} · ${new Date(e.date || Date.now()).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" })}</p></div><img src="icons/logo.png" alt=""></header>
      <div class="ptop"><div class="pbig"><small>Gemiddelde</small><b>${f1(a)}</b><span>op 5${pr && a != null && evAvgOf(pr, names) != null ? ` · ${(a - evAvgOf(pr, names) >= 0 ? "+" : "")}${f1(a - evAvgOf(pr, names))} t.o.v. ${EV_MOMENTS[pr.moment - 1].naam.toLowerCase()}` : ""}</span></div>
        <div class="phist">${hist.map(([x, v]) => `<div><i style="height:${Math.round(6 + (v - 1) / 4 * 54)}px"></i><b>${f1(v)}</b><small>${x.kort}</small></div>`).join("")}</div>
        <dl><dt>Aanwezig op training</dt><dd>${s.trTot ? s.trPct + "%" : "–"}</dd><dt>Wedstrijden</dt><dd>${s.matches}</dd>${D.position ? `<dt>Beste positie</dt><dd>${esc(D.position)}</dd>` : ""}</dl></div>
      <div class="pgroups">${groups.map(g => `<div class="pg"><h2>${esc(g.name)} <span>${f1(evAvgOf(e, g.items.map(i => i.name)))}</span></h2>${g.items.map(i => { const c = evScore(e, i.name), b = pr ? evScore(pr, i.name) : null;
        return `<div class="pr"><span>${esc(i.name)}</span><span class="pb"><i style="width:${c == null ? 0 : c / 5 * 100}%"></i>${b != null ? `<em style="left:${b / 5 * 100}%"></em>` : ""}</span><b>${c == null ? "–" : f1(c)}</b></div>`; }).join("")}</div>`).join("")}</div>
      <div class="ptexts">${[["Sterktes", D.strengths], ["Werkpunten", D.workpoints], ["Doelen tot de volgende evaluatie", D.goals], ["Boodschap van de trainer", D.parents], m === EV_LAST && D.advice ? ["Advies volgend seizoen", D.advice] : null].filter(x => x && x[1]).map(([k, t]) => `<div><h3>${k}</h3><p>${esc(t).replace(/\n/g, "<br>")}</p></div>`).join("")}</div>
      <footer>Schaal: 1 nog niet · 2 soms · 3 meestal · 4 bijna altijd · 5 uitblinker. Het streepje is de vorige evaluatie. · OG Vorselaar jeugdwerking</footer></div>`; }).join("");
  document.body.appendChild(el); document.documentElement.classList.add("printing");
  const done = () => { el.remove(); document.documentElement.classList.remove("printing"); removeEventListener("afterprint", done); };
  addEventListener("afterprint", done); setTimeout(() => print(), 150);
}

/* ============ herinnering op de startpagina ============ */
function evReminder() {
  const t = S.team; if (!t) return ""; const ps = active(); if (!ps.length) return "";
  const now = new Date(), names = evItems();
  for (const mo of EV_MOMENTS) { const w = evWindow(mo), soon = new Date(w.from.getTime() - 14 * 864e5);
    if (now < soon || now > w.to || !mo.verplicht && now < w.from) continue;
    const dn = ps.filter(p => evDone(evOf(p.id, mo.m), names)).length; if (dn === ps.length) continue;
    const days = Math.ceil((w.to - now) / 864e5), before = now < w.from;
    return `<a class="evremind${mo.verplicht ? " req" : ""}" href="#/evaluaties" data-em="${mo.m}"><span class="ic">${IC.star}</span><span><b>Evaluatie ${mo.naam.toLowerCase()}${mo.verplicht ? " (verplicht)" : ""}</b><small>${before ? `Start over ${Math.ceil((w.from - now) / 864e5)} dagen` : `${dn} van ${ps.length} spelers klaar · nog ${days} ${days === 1 ? "dag" : "dagen"}`}</small></span><span class="go">Evalueren ›</span></a>`; }
  return "";
}
