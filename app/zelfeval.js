/* FootballCoachHub — zelfevaluatie van trainers en coördinatoren.
   De club kiest de vragen en momenten (Beheer › Instellingen › Evaluaties, settings.eval.staff).
   Antwoorden staan in staff_evals (databaseversie 60): enkel de persoon zelf ziet ze, tot hij ze indient; dan kan de beheerder ze lezen. */
"use strict";
const SE_KIND = { trainer: { naam: "trainer", titel: "Zelfevaluatie trainer", route: "zelftrainer" }, coord: { naam: "coördinator", titel: "Zelfevaluatie coördinator", route: "zelfcoord" } };
const SE_SCALE = ["Nog niet", "Soms", "Meestal", "Vaak", "Altijd"];
const SE_MOMENTS = ["Begin seizoen", "Winterstop", "Einde seizoen"];
const SE_DEF = {
  trainer: { intro: "Neem rustig de tijd. Er zijn geen foute antwoorden: dit is voor jezelf en om samen met de club te bekijken waar je steun kan gebruiken.", questions: [
    { type: "kop", text: "Mijn trainingen" },
    { type: "schaal", text: "Mijn trainingen zijn goed voorbereid: doel, oefeningen en materiaal" },
    { type: "schaal", text: "Mijn spelers zijn veel aan de bal en in beweging" },
    { type: "schaal", text: "Ik pas een oefening aan als ze niet werkt" },
    { type: "kop", text: "Coaching" },
    { type: "schaal", text: "Ik coach positief en geef concrete feedback" },
    { type: "schaal", text: "Ik werk volgens de visie en het techniekplan van de club" },
    { type: "kop", text: "Groep en omgeving" },
    { type: "schaal", text: "Ik heb een goede band met mijn spelers" },
    { type: "schaal", text: "Ik communiceer duidelijk met de ouders" },
    { type: "kop", text: "Vooruitkijken" },
    { type: "tekst", text: "Waar ben ik het meest tevreden over?" },
    { type: "tekst", text: "Wat wil ik verbeteren tegen het volgende moment?" },
    { type: "tekst", text: "Waarbij heb ik hulp of een opleiding nodig?" }] },
  coord: { intro: "Kijk terug op je rol als coördinator. Wat je hier schrijft, helpt om samen met het bestuur de jeugdwerking te verbeteren.", questions: [
    { type: "kop", text: "Begeleiding van trainers" },
    { type: "schaal", text: "Ik bezoek regelmatig trainingen en geef feedback" },
    { type: "schaal", text: "Trainers weten wanneer en waarvoor ze bij mij terechtkunnen" },
    { type: "schaal", text: "Nieuwe trainers worden goed opgevangen" },
    { type: "kop", text: "Visie en organisatie" },
    { type: "schaal", text: "De visie van de club wordt in mijn ploegen toegepast" },
    { type: "schaal", text: "Planning, evaluaties en communicatie lopen vlot" },
    { type: "schaal", text: "Ik heb een goed zicht op de ontwikkeling van de spelers" },
    { type: "kop", text: "Vooruitkijken" },
    { type: "tekst", text: "Wat liep goed?" },
    { type: "tekst", text: "Wat wil ik anders aanpakken?" },
    { type: "tekst", text: "Welke steun heb ik nodig van het bestuur?" }] } };
/* vaste ids voor de voorstellen, zodat antwoorden bij een kleine aanpassing van de tekst bewaard blijven */
for (const k in SE_DEF) SE_DEF[k].questions.forEach((q, i) => { q.id = k[0] + "d" + i; });
function seCfg(kind, st = CLUB.settings || {}) { const c = st.eval?.staff?.[kind] || {}, d = SE_DEF[kind];
  const qs = (Array.isArray(c.questions) && c.questions.length ? c.questions : d.questions).map(q => evCleanQ({ ...q, type: q?.type || "tekst" })).filter(q => q.text).map(q => { delete q.intern; delete q.link; return q; });
  const ms = (Array.isArray(c.moments) ? c.moments : SE_MOMENTS).map(m => String(m || "").trim().slice(0, 40)).filter(Boolean);
  return { on: c.on !== false, intro: c.intro ?? d.intro, moments: ms.length ? ms : SE_MOMENTS, questions: qs }; }
const isCoord = () => S.admin || /co[oö]rdinator|tvjo|avjo/i.test(S.functie || "") || mode === "demo";
const seAns = (q, a, prev) => { const v = a?.[q.id];
  if (q.type === "kop") return `<h3 class="seh">${esc(q.text)}</h3>`;
  if (q.type === "schaal") return `<div class="seq"><b>${esc(q.text)}</b><div class="sescale" role="radiogroup" aria-label="${esc(q.text)}">${SE_SCALE.map((l, i) => `<button type="button" role="radio" aria-checked="${+v === i + 1}" data-q="${q.id}" data-v="${i + 1}"><span>${i + 1}</span><small>${l}</small></button>`).join("")}</div>${prev?.[q.id] ? `<small class="seprev">Vorige keer: ${esc(SE_SCALE[prev[q.id] - 1] || prev[q.id])}</small>` : ""}</div>`;
  if (q.type === "keuze") return `<div class="seq"><b>${esc(q.text)}</b><div class="chips">${q.opts.map(o => `<button type="button" class="chip" data-q="${q.id}" data-v="${esc(o)}" aria-pressed="${v === o}">${esc(o)}</button>`).join("")}</div></div>`;
  return `<label class="seq"><b>${esc(q.text)}</b><textarea data-q="${q.id}" maxlength="2000" rows="3">${esc(v || "")}</textarea>${prev?.[q.id] ? `<small class="seprev">Vorige keer: ${esc(String(prev[q.id]).slice(0, 160))}${String(prev[q.id]).length > 160 ? "…" : ""}</small>` : ""}</label>`; };
const seRead = (qs, a) => qs.map(q => q.type === "kop" ? `<h3 class="seh">${esc(q.text)}</h3>` : `<div class="seq ro"><b>${esc(q.text)}</b><p>${a?.[q.id] == null || a[q.id] === "" ? `<span class="muted">niet ingevuld</span>` : q.type === "schaal" ? `<span class="sedot">${a[q.id]}</span> ${esc(SE_SCALE[a[q.id] - 1] || "")}` : esc(a[q.id]).replace(/\n/g, "<br>")}</p></div>`).join("");

const SEV = { kind: "", m: "", tab: "mijn", rows: null, club: null };
for (const kind of Object.keys(SE_KIND)) route(SE_KIND[kind].route, { title: SE_KIND[kind].titel, auth: true, render: v => seRender(v, kind) });
async function seRender(v, kind) {
  const K = SE_KIND[kind], C = seCfg(kind), season = seasonNow();
  if (SEV.kind !== kind) Object.assign(SEV, { kind, m: "", tab: "mijn", rows: null, club: null });
  if (kind === "coord" && !isCoord()) { v.innerHTML = head(K.titel, "") + `<div class="empty"><b>Enkel voor coördinatoren</b>Je functie in de club is geen coördinator. Klopt dat niet, vraag dan de beheerder je functie aan te passen.</div>`; return; }
  if (!C.on) { v.innerHTML = head(K.titel, "") + `<div class="empty"><b>Staat uit voor ${esc(clubName())}</b>${S.admin ? `Zet ze aan in <a class="link" href="#/clubinstellingen/evaluaties">Instellingen › Evaluaties</a>.` : "Vraag de beheerder als je ze wil gebruiken."}</div>`; return; }
  if (!SEV.rows) { try { SEV.rows = await db.list("staff_evals", mode === "demo" ? { kind } : { kind, user_id: user.id }); SEV.ok = true; } catch (e) { SEV.rows = []; SEV.ok = false; } }
  const tabs = S.admin ? `<nav class="dtabs setabs" aria-label="Zelfevaluaties"><button type="button" data-tab="mijn" aria-selected="${SEV.tab === "mijn"}">Mijn zelfevaluatie</button><button type="button" data-tab="club" aria-selected="${SEV.tab === "club"}">Ingediend in de club</button></nav>` : "";
  const sub = SEV.tab === "club" ? `Wat ${kind === "trainer" ? "trainers" : "coördinatoren"} van ${esc(clubName())} dit seizoen indienden.` : `Seizoen ${esc(season)}. Alleen jij ziet je antwoorden, tot je ze indient: dan kan de beheerder van de club ze lezen.`;
  if (SEV.ok === false) { v.innerHTML = head(K.titel, sub) + `<div class="empty"><b>Nog niet beschikbaar</b>De database van de club moet nog bijgewerkt worden (versie 60).</div>`; return; }
  if (SEV.tab === "club" && S.admin) return seClub(v, kind, K, C, season, head(K.titel, sub) + tabs);
  const mine = SEV.rows.filter(r => r.season === season), get = m => mine.find(r => r.moment === m);
  if (!C.moments.includes(SEV.m)) SEV.m = C.moments.find(m => get(m)?.status !== "ingediend") || C.moments[C.moments.length - 1];
  const row = get(SEV.m), sent = row?.status === "ingediend", a = { ...(row?.answers || {}) }, i = C.moments.indexOf(SEV.m), prevRow = i > 0 ? get(C.moments[i - 1]) : null;
  const filled = C.questions.filter(q => q.type !== "kop" && a[q.id] != null && a[q.id] !== "").length, total = C.questions.filter(q => q.type !== "kop").length;
  v.innerHTML = head(K.titel, sub, `<button class="btn ghost" type="button" onclick="window.print()">${IC.print}Afdrukken</button>`) + tabs + `
    <div class="semoms">${C.moments.map(m => { const r = get(m); return `<button type="button" data-m="${esc(m)}" aria-pressed="${m === SEV.m}"><b>${esc(m)}</b><small class="${r?.status === "ingediend" ? "ok" : r ? "wip" : ""}">${r?.status === "ingediend" ? "ingediend" : r ? "concept" : "nog niet gestart"}</small></button>`; }).join("")}</div>
    <div class="panel sec seform">${C.intro ? `<p class="hint" style="margin-top:0">${esc(C.intro)}</p>` : ""}
      ${sent ? `<div class="share">${IC.check}<div><b style="color:var(--ink)">Ingediend</b> op ${esc(dShort(String(row.updated_at).slice(0, 10)))}. De beheerder kan dit lezen.</div></div>${seRead(C.questions, a)}`
        : C.questions.map(q => seAns(q, a, prevRow?.answers)).join("")}
      <div class="row sec noprint" style="gap:8px;flex-wrap:wrap"><small class="muted" id="sefill">${filled} van ${total} beantwoord</small><span class="spacer"></span>
        ${sent ? `<button class="btn ghost" type="button" id="seBack">Terug naar concept</button>` : `<button class="btn ghost" type="button" id="seSave">Bewaren als concept</button><button class="btn" type="button" id="seSend">Indienen</button>`}</div></div>`;
  $$("[data-tab]", v).forEach(b => b.onclick = () => { SEV.tab = b.dataset.tab; render(); });
  $$("[data-m]", v).forEach(b => b.onclick = () => { SEV.m = b.dataset.m; render(); });
  const count = () => { const n = C.questions.filter(q => q.type !== "kop" && a[q.id] != null && a[q.id] !== "").length; $("#sefill").textContent = `${n} van ${total} beantwoord`; return n; };
  $$(".seform [data-v]", v).forEach(b => b.onclick = () => { const q = b.dataset.q, same = String(a[q]) === b.dataset.v, isS = !!b.closest(".sescale");
    a[q] = same ? null : isS ? +b.dataset.v : b.dataset.v; $$(`[data-q="${q}"][data-v]`, v).forEach(x => x.setAttribute(isS ? "aria-checked" : "aria-pressed", String(a[q]) === x.dataset.v)); count(); });
  $$(".seform textarea", v).forEach(t => t.oninput = () => { a[t.dataset.q] = t.value; count(); });
  const store = async status => { const rec = { ...(row || { id: uid(), club_id: CLUB.id, user_id: mode === "demo" ? "demo" : user.id, kind, season, moment: SEV.m }), answers: a, status, updated_at: new Date().toISOString() };
    if (mode !== "demo") delete rec.club_id; /* de database vult de club zelf in */
    await safe(async () => { await db.save("staff_evals", rec); const j = SEV.rows.findIndex(r => r.id === rec.id); if (j >= 0) SEV.rows[j] = rec; else SEV.rows.push(rec); render(); },
      status === "ingediend" ? "Ingediend. De beheerder kan je zelfevaluatie nu lezen." : "Bewaard. Alleen jij ziet dit."); };
  if ($("#seSave")) $("#seSave").onclick = () => store("concept");
  if ($("#seSend")) $("#seSend").onclick = () => { const n = count(); if (n < total && !confirm(`Je beantwoordde ${n} van de ${total} vragen. Toch indienen?`)) return; store("ingediend"); };
  if ($("#seBack")) $("#seBack").onclick = () => { if (confirm("Terug naar concept? De beheerder ziet je zelfevaluatie dan niet meer tot je ze opnieuw indient.")) store("concept"); };
}
async function seClub(v, kind, K, C, season, top) {
  v.innerHTML = top + `<div class="panel sec"><span class="spin"></span> Laden…</div>`;
  if (!SEV.club || SEV.club.season !== season) { try { const r = mode === "demo" ? { data: (await db.list("staff_evals", { kind })).filter(x => x.status === "ingediend").map(x => ({ ...x, name: "Demo-trainer" })) } : await sb.rpc("staff_evals_club", { k: kind, s: season }); if (r.error) throw r.error; SEV.club = { season, rows: r.data || [] }; }
    catch (e) { v.innerHTML = top + `<div class="empty"><b>Laden lukt niet</b>${esc(e.message || "")}</div>`; return; } }
  const R = SEV.club.rows, scales = C.questions.filter(q => q.type === "schaal");
  v.innerHTML = top + (!R.length ? `<div class="empty"><b>Nog niets ingediend</b>Zodra ${kind === "trainer" ? "trainers" : "coördinatoren"} hun zelfevaluatie indienen, staat ze hier.</div>` : C.moments.map(m => { const xs = R.filter(r => r.moment === m); if (!xs.length) return "";
    const avg = scales.map(q => { const vs = xs.map(r => +r.answers?.[q.id]).filter(x => x > 0); return [q, vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null]; }).filter(x => x[1] != null);
    return `<section class="panel sec"><h2 style="margin-top:0">${esc(m)} <small class="muted">· ${xs.length} ingediend</small></h2>
      ${avg.length > 1 && xs.length > 1 ? `<details class="seavg"><summary>Gemiddelde per vraag</summary><div class="list">${avg.sort((a, b) => a[1] - b[1]).map(([q, x]) => `<div class="item static"><span class="main"><b>${esc(q.text)}</b></span><span class="pill">${f1(x)} / 5</span></div>`).join("")}</div><p class="hint">De laagste scores staan bovenaan: daar kan de club het meest helpen.</p></details>` : ""}
      <div class="list">${xs.map(r => `<details class="seone"><summary><b>${esc(r.name || r.email || "Onbekend")}</b><small class="muted">${esc(r.functie || "")}${r.functie ? " · " : ""}${esc(dShort(String(r.updated_at).slice(0, 10)))}</small></summary>${seRead(C.questions, r.answers)}</details>`).join("")}</div></section>`; }).join(""));
  $$("[data-tab]", v).forEach(b => b.onclick = () => { SEV.tab = b.dataset.tab; render(); });
}

/* ============ instellingen: de vragen voor trainers en coördinatoren ============ */
function seSettingsHtml(kind, st) {
  const C = seCfg(kind, st), K = SE_KIND[kind];
  return `<div class="seset" data-kind="${kind}">
    <label class="csmod" style="max-width:640px"><span><b>Zelfevaluatie voor de ${K.naam}</b><small>${kind === "trainer" ? "Elke trainer vult ze in voor zichzelf." : "Wie als functie coördinator, TVJO of AVJO heeft, vult ze in voor zichzelf."} Enkel de persoon zelf ziet de antwoorden, tot hij ze indient; dan kan een beheerder ze lezen.</small></span><span class="tgl"><input type="checkbox" name="se_on_${kind}"${C.on ? " checked" : ""}><span></span></span></label>
    <h3>Momenten</h3><p class="hint" style="margin-top:0">Bij elk moment vult de ${K.naam} een nieuwe zelfevaluatie in. Hij ziet dan ook wat hij de vorige keer antwoordde.</p>
    <input name="se_m_${kind}" class="f" style="width:100%" maxlength="200" value="${esc(C.moments.join("; "))}" placeholder="bv. Begin seizoen; Winterstop; Einde seizoen" aria-label="Momenten, gescheiden door ;">
    <h3>Uitleg bovenaan</h3><input name="se_i_${kind}" style="width:100%" maxlength="300" value="${esc(C.intro || "")}" aria-label="Uitleg bovenaan">
    <h3>Vragen</h3><p class="hint" style="margin-top:0">Score 1 tot 5 (nog niet, soms, meestal, vaak, altijd), open vragen of keuzelijsten. Met tussentitels deel je de lijst op.</p>
    <div class="row" style="gap:8px;margin-bottom:8px"><button class="btn ghost small" type="button" data-sedef="${kind}">Voorstel van de app herstellen</button></div>
    <div class="cslist sel" data-selist="${kind}">${C.questions.map(csOpenRow).join("")}</div><button class="link" type="button" data-seadd="${kind}" style="margin:4px 0 8px">${IC.plus}Vraag toevoegen</button></div>`;
}
function seSettingsBind(f) {
  $$("[data-selist]", f).forEach(L => { L.addEventListener("click", e => { const b = e.target.closest("button"), r = b?.closest(".csr"); if (!r) return;
      if (b.hasAttribute("data-del")) r.remove(); else if (b.dataset.mv) { const up = +b.dataset.mv < 0, sib = up ? r.previousElementSibling : r.nextElementSibling; if (sib) L.insertBefore(up ? r : sib, up ? sib : r); } });
    L.addEventListener("change", e => { if (e.target.name === "ty") e.target.closest(".csr").dataset.ty = e.target.value; }); });
  $$("[data-seadd]", f).forEach(b => b.onclick = () => { const L = $(`[data-selist="${b.dataset.seadd}"]`, f); L.insertAdjacentHTML("beforeend", csOpenRow({ type: "schaal" })); L.lastElementChild.querySelector("input")?.focus(); });
  $$("[data-sedef]", f).forEach(b => b.onclick = () => { if (!confirm("De vragen terugzetten naar het voorstel van de app?")) return; $(`[data-selist="${b.dataset.sedef}"]`, f).innerHTML = SE_DEF[b.dataset.sedef].questions.map(csOpenRow).join(""); });
  return () => { const out = {};
    for (const kind of Object.keys(SE_KIND)) { const L = $(`[data-selist="${kind}"]`, f); if (!L) continue;
      const qs = $$(".csr", L).map(r => ({ id: r.dataset.id, type: $("[name=ty]", r).value, text: $("[name=t]", r).value.trim(), opts: $("[name=o]", r).value })).filter(q => q.text).map(evCleanQ).map(q => { delete q.intern; return q; });
      const on = f["se_on_" + kind].checked; if (on && !qs.some(q => q.type !== "kop")) return { err: `Zet minstens één vraag in de zelfevaluatie voor de ${SE_KIND[kind].naam}, of zet ze uit.` };
      const moments = f["se_m_" + kind].value.split(";").map(x => x.trim().slice(0, 40)).filter(Boolean); if (on && !moments.length) return { err: `Geef minstens één moment op voor de zelfevaluatie van de ${SE_KIND[kind].naam}.` };
      out[kind] = { on, intro: f["se_i_" + kind].value.trim().slice(0, 300), moments, questions: qs }; }
    return { staff: out }; };
}
