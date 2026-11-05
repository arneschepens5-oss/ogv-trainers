/* OGV Platform — ouders en club (databaseversie 14):
   convocaties per wedstrijd, berichten van club en ploeg, ouders verwittigen bij wijzigingen,
   oudercontacten en medische info, spelers importeren uit PSD, clubdashboard en terreinoverzicht. */

/* ============ hulpfuncties ============ */
const V14 = () => mode === "demo" || !!S.v14;
async function v14Check() { if (mode !== "cloud") { S.v14 = true; return; } try { const r = await sb.from("players").select("contacts").limit(1); S.v14 = !r.error; } catch (e) { S.v14 = false; } }
const needV14 = what => `<div class="empty"><b>Nog niet beschikbaar</b>${esc(what)} werkt zodra de beheerder ogv-database.sql (versie 14) uitvoert in Supabase.</div>`;
const shareWA = txt => "https://wa.me/?text=" + encodeURIComponent(txt);
const teamShort = () => S.team?.name || "onze ploeg";
const evWhen = e => `${cap(dLong(e.date))}${e.start_time ? " om " + tm(e.start_time) : ""}`;
const evWhat = e => e.type === "wedstrijd" ? (e.opponent ? (e.home === false ? "uitwedstrijd bij " : "thuiswedstrijd tegen ") + e.opponent : "wedstrijd") : "training";
function shareDialog(title, txt, hint) {
  const d = dialog(`<div class="dlg"><h2>${esc(title)}</h2>${hint ? `<p class="hint" style="margin-top:0">${hint}</p>` : ""}
    <textarea id="shtxt" style="min-height:180px">${esc(txt)}</textarea>
    <div class="row" style="margin-top:12px"><button class="btn ghost" type="button" id="shcp">${IC.copy}Kopiëren</button><span class="spacer"></span><button class="btn ghost" type="button" data-close>Sluiten</button><a class="btn" id="shwa" target="_blank" rel="noopener">${IC.wa}WhatsApp</a></div></div>`);
  const ta = $("#shtxt", d), sync = () => $("#shwa", d).href = shareWA(ta.value); ta.oninput = sync; sync();
  $("#shcp", d).onclick = () => { navigator.clipboard?.writeText(ta.value); toast("Gekopieerd."); };
  return d;
}

/* ============ ouders verwittigen bij een wijziging of afgelasting ============ */
function notifyChange(before, after) {
  if (!after || after.date < todayIso()) return;
  const ch = [];
  if (!!before.cancelled !== !!after.cancelled) ch.push(after.cancelled ? "cancel" : "uncancel");
  if (before.date !== after.date) ch.push("date");
  if (tm(before.start_time) !== tm(after.start_time) || tm(before.end_time) !== tm(after.end_time)) ch.push("time");
  if ((before.location || "") !== (after.location || "")) ch.push("loc");
  if (!ch.length) return;
  const what = evWhat(after), T = teamShort();
  const txt = ch.includes("cancel") ? `⚠️ AFGELAST – ${T}\nDe ${what} van ${evWhen(before)} gaat niet door.\n\nSportieve groeten,\n${myName() || "de trainer"}`
    : ch.includes("uncancel") ? `✅ Gaat toch door – ${T}\nDe ${what} van ${evWhen(after)} gaat toch door${after.location ? " (" + after.location + ")" : ""}.`
    : `🔁 Wijziging – ${T}\nDe ${what} van ${evWhen(before)} is verplaatst.\nNieuw: ${evWhen(after)}${after.end_time ? " tot " + tm(after.end_time) : ""}${after.location ? "\nPlaats: " + after.location : ""}\n\nGeef via je persoonlijke link door of je kind erbij is.`;
  setTimeout(() => shareDialog("Ouders verwittigen?", txt, "Stuur dit bericht naar de WhatsApp-groep van de ouders. Ouders die de persoonlijke link gebruiken, zien de wijziging daar ook meteen."), 250);
}

/* ============ convocatie per wedstrijd ============ */
function convoTab(tv, e) {
  if (!V14()) { tv.innerHTML = needV14("De convocatie"); return; }
  const ps = active(), C = e.convo || {}, home = e.home !== false;
  const sel = new Set(C.players || ps.filter(p => rsvpOf(e.id, p.id)?.status !== "nee").map(p => p.id));
  const kick = tm(e.start_time), meetDef = kick ? (([h, m]) => { const t = h * 60 + m - 45; return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); })(kick.split(":").map(Number)) : "";
  const v = { meet: C.meet ?? meetDef, place: C.place ?? (home ? "Kantine OG Vorselaar" : (e.location || "")), bring: C.bring ?? "Geel wedstrijdshirt, scheenbeschermers, drinkfles", note: C.note ?? "" };
  const paint = () => {
    const rs = p => rsvpOf(e.id, p.id)?.status, conf = [...sel].map(id => rs({ id })), ja = conf.filter(x => x === "ja").length, nee = conf.filter(x => x === "nee").length;
    tv.innerHTML = `<div class="grid2"><div class="panel"><h2>Afspraak</h2><div class="fields">
        <label class="f">Verzamelen om<input type="time" id="cvm" value="${esc(v.meet)}"></label><label class="f">Aftrap<input value="${esc(kick || "–")}" disabled></label>
        <label class="f full">Verzamelen waar<input id="cvp" value="${esc(v.place)}" placeholder="bv. kantine, of rechtstreeks op het terrein"></label>
        <label class="f full">Meebrengen<input id="cvb" value="${esc(v.bring)}"></label>
        <label class="f full">Extra info voor de ouders<textarea id="cvn" placeholder="bv. we rijden samen vanaf de kerk, carpool via de groep">${esc(v.note)}</textarea></label></div></div>
      <div class="panel"><div class="row"><h2 style="margin:0;margin-right:auto">Geselecteerd (${sel.size})</h2><button class="link" type="button" id="cvall">Iedereen</button></div>
        <p class="hint">Tik om iemand (niet) te selecteren. ${C.sent ? "Ouders zien de convocatie via hun persoonlijke link." : "Nog niet verstuurd."}</p>
        <div class="field">${ps.map(p => { const r = rs(p); return `<button type="button" data-cv="${p.id}" aria-pressed="${sel.has(p.id)}"><span class="n">${p.number ?? ""}</span>${esc(p.first_name)}${r ? `<em class="rs ${r}">${r === "ja" ? "komt" : "komt niet"}</em>` : ""}</button>`; }).join("") || '<span class="muted">Nog geen spelers.</span>'}</div>
        ${C.sent ? `<div class="rsvpbar" style="margin-top:12px"><b>Bevestigd:</b> <span class="rsvp ja">${ja} komen</span> <span class="rsvp nee">${nee} komen niet</span> <span class="rsvp none">${sel.size - ja - nee} nog geen antwoord</span></div>` : ""}</div></div>
      <div class="row sec" style="gap:10px"><button class="btn" type="button" id="cvsave">${IC.check}${C.sent ? "Convocatie bijwerken" : "Convocatie versturen"}</button><button class="btn ghost" type="button" id="cvwa">${IC.wa}Bericht voor WhatsApp</button>
        ${C.sent ? `<span class="hint">Verstuurd op ${new Date(C.sent).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>` : ""}</div>`;
    const keep = () => { v.meet = $("#cvm", tv).value; v.place = $("#cvp", tv).value; v.bring = $("#cvb", tv).value; v.note = $("#cvn", tv).value; };
    $$("[data-cv]", tv).forEach(b => b.onclick = () => { keep(); sel.has(b.dataset.cv) ? sel.delete(b.dataset.cv) : sel.add(b.dataset.cv); paint(); });
    $("#cvall", tv).onclick = () => { keep(); ps.forEach(p => sel.add(p.id)); paint(); };
    const text = () => { keep(); const names = ps.filter(p => sel.has(p.id)).map(p => p.first_name).join(", "), off = ps.filter(p => !sel.has(p.id));
      return `⚽ Convocatie ${teamShort()}\n${cap(dLong(e.date))} – ${e.opponent ? (home ? "thuis tegen " : "uit bij ") + e.opponent : "wedstrijd"}\n`
        + `${v.meet ? "🕗 Verzamelen: " + v.meet + (v.place ? " – " + v.place : "") + "\n" : ""}${kick ? "🏁 Aftrap: " + kick + "\n" : ""}${!home && e.location ? "📍 " + e.location + "\n" : ""}`
        + `\n✅ Geselecteerd: ${names || "–"}${off.length ? "\n(Niet geselecteerd deze keer: " + off.map(p => p.first_name).join(", ") + ")" : ""}\n`
        + `${v.bring ? "\n🎒 Meebrengen: " + v.bring : ""}${v.note ? "\n\n" + v.note : ""}\n\nBevestig via je persoonlijke link of je kind erbij is. Bedankt!`; };
    $("#cvsave", tv).onclick = async () => { keep(); const conv = { players: [...sel], meet: v.meet || null, place: v.place || null, bring: v.bring || null, note: v.note || null, sent: new Date().toISOString() };
      const ok = await safe(async () => { e.convo = conv; await putEvent(e); return true; }, "Convocatie verstuurd. Ouders zien ze via hun link.");
      if (ok) { Object.assign(C, conv); paint(); shareDialog("Ook in de WhatsApp-groep zetten?", text(), "Ouders zien de convocatie al via hun persoonlijke link. Met dit bericht verwittig je ook de WhatsApp-groep."); } };
    $("#cvwa", tv).onclick = () => shareDialog("Convocatie delen", text());
  };
  paint();
}

/* ============ berichten van club en ploeg ============ */
async function loadMessages(limit = 40) {
  if (!V14()) return [];
  const all = mode === "demo" ? await db.list("messages") : ((await sb.from("messages").select("*").order("created_at", { ascending: false }).limit(limit)).data || []);
  const today = todayIso();
  return all.filter(m => !m.team_id || m.team_id === S.team?.id || myTeams().some(t => t.id === m.team_id))
    .filter(m => (m.until || iso(addDays(new Date(m.created_at), 30))) >= today).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
const msgCard = m => `<div class="msgc${m.team_id ? "" : " club"}"><div class="row" style="gap:8px"><span class="pill ${m.team_id ? "t" : "w"}">${m.team_id ? esc(S.teams.find(t => t.id === m.team_id)?.name || "Ploeg") : "Club"}</span><small class="muted">${new Date(m.created_at).toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}${m.author ? " · " + esc(m.author) : ""}</small></div>
  <b>${esc(m.title)}</b>${m.body ? `<p>${esc(m.body).replace(/\n/g, "<br>")}</p>` : ""}</div>`;
route("berichten", { title: "Berichten", auth: true, render: async v => {
  if (!V14()) { v.innerHTML = head("Berichten", "") + needV14("Berichten"); return; }
  const list = await loadMessages(80), canClub = S.admin, canTeam = !!S.team;
  v.innerHTML = head("Berichten", "Berichten van de club en van je ploeg. Ouders zien ze bovenaan hun persoonlijke link, 30 dagen lang of tot de datum die je kiest.",
    canClub || canTeam ? `<button class="btn" type="button" id="newmsg">${IC.plus}Nieuw bericht</button>` : "") +
    (list.length ? `<div class="msgs">${list.map(m => `<div class="msgw">${msgCard(m)}<div class="row" style="gap:6px;margin-top:8px"><a class="btn ghost small" target="_blank" rel="noopener" href="${shareWA(m.title + (m.body ? "\n\n" + m.body : ""))}">${IC.wa}Delen</a>${(m.team_id ? true : S.admin) && (m.created_by === user?.id || S.admin || mode === "demo") ? `<button class="btn ghost small" type="button" data-delm="${m.id}">Verwijderen</button>` : ""}</div></div>`).join("")}</div>`
      : `<div class="empty"><b>Geen berichten</b>Zet hier bv. een afgelasting door het weer, een clubfeest of een oproep voor vrijwilligers.</div>`);
  const nb = $("#newmsg"); if (nb) nb.onclick = () => msgForm();
  $$("[data-delm]", v).forEach(b => b.onclick = async () => { if (!confirm("Dit bericht verwijderen?")) return; await safe(async () => { await db.del("messages", { id: b.dataset.delm }); render(); }, "Bericht verwijderd."); });
} });
function msgForm() {
  const d = dialog(`<form class="dlg"><h2>Nieuw bericht</h2><div class="fields">
    <label class="f full">Voor wie<select name="to">${S.team ? `<option value="${S.team.id}">Ouders en trainers van ${esc(S.team.name)}</option>` : ""}${S.admin ? `<option value="">Iedereen in de club</option>` : ""}</select></label>
    <label class="f full">Titel<input name="title" required maxlength="120" placeholder="bv. Training van woensdag gaat niet door"></label>
    <label class="f full">Bericht<textarea name="body" maxlength="2000" placeholder="Wat moeten de ouders weten?"></textarea></label>
    <label class="f">Zichtbaar tot<input type="date" name="until"><span class="hint" style="font-weight:400">Leeg = 30 dagen</span></label></div>
    <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Plaatsen</button></div></form>`);
  $("form", d).onsubmit = async ev => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target));
    const row = { id: uid(), team_id: f.to || null, title: f.title.trim(), body: f.body.trim() || null, author: myName() || null, until: f.until || null, created_at: new Date().toISOString(), ...(mode === "demo" ? { created_by: "demo" } : {}) };
    if (mode !== "demo") delete row.created_at;
    const ok = await safe(async () => { await db.insert("messages", row); return true; }, "Bericht geplaatst.");
    if (ok) { d.close(); render(); shareDialog("Ook via WhatsApp sturen?", row.title + (row.body ? "\n\n" + row.body : ""), "Het bericht staat nu in de app en op de ouderlinks. Stuur het eventueel ook naar de WhatsApp-groep."); } };
}
async function startMessages(box) { try { const l = (await loadMessages(10)).slice(0, 3); if (!box.isConnected || !l.length) return;
  box.innerHTML = `<div class="sec"><div class="row" style="margin-bottom:12px"><h2 style="margin:0;margin-right:auto">Berichten</h2><a class="link" href="#/berichten">Alle berichten</a></div><div class="msgs">${l.map(msgCard).join("")}</div></div>`; } catch (e) {} }

/* ============ oudercontacten en medische info ============ */
const consentLine = p => { const c = p.consent; if (!c) return `<p class="hint" style="margin:10px 0 0">Toestemming voor foto's en video's: nog niet ingevuld door de ouders.</p>`;
  return `<div class="row" style="gap:6px;margin-top:10px"><span class="pill ${c.analysis ? "w" : "loss"}">${c.analysis ? "Video-analyse mag" : "Geen video-analyse"}</span><span class="pill ${c.public ? "w" : "loss"}">${c.public ? "Foto's online mogen" : "Geen foto's online"}</span></div>`; };
const REL = ["Mama", "Papa", "Voogd", "Grootouder", "Andere"];
function pContacts(p) {
  if (Array.isArray(p.contacts) && p.contacts.some(c => c && (c.name || c.phone || c.email))) return p.contacts.filter(c => c && (c.name || c.phone || c.email));
  if (p.parent_contact) { const ph = (p.parent_contact.match(/(\+?\d[\d\s./-]{7,}\d)/) || [])[1] || ""; return [{ name: p.parent_contact.replace(ph, "").replace(/[,;:-]\s*$/, "").trim(), phone: ph }]; }
  return [];
}
const contactBtns = c => `${c.phone ? `<a class="btn small" href="${telHref(c.phone)}">${IC.phone}Bellen</a><a class="btn ghost small" href="${waHref(c.phone)}" target="_blank" rel="noopener">${IC.wa}WhatsApp</a>` : ""}${c.email ? `<a class="btn ghost small" href="mailto:${esc(c.email)}">${IC.mail}Mail</a>` : ""}`;
function contactsPanel(p) {
  const cs = pContacts(p);
  return `<div class="sec panel"><div class="row"><h2 style="margin:0;margin-right:auto">Ouders en noodcontact</h2></div>
    ${p.medical ? `<div class="medw">${IC.eye}<div><b>Medisch</b><p>${esc(p.medical).replace(/\n/g, "<br>")}</p></div></div>` : ""}
    ${cs.length ? `<div class="list" style="margin-top:8px">${cs.map(c => `<div class="item static" style="flex-wrap:wrap;row-gap:8px"><span class="main"><b>${esc(c.name || "Contact")}${c.rel ? ` <span class="muted" style="font-weight:500">· ${esc(c.rel)}</span>` : ""}</b><small>${esc([c.phone, c.email].filter(Boolean).join(" · "))}</small></span><span class="row" style="gap:6px">${contactBtns(c)}</span></div>`).join("")}</div>`
      : `<p class="hint">Nog geen contactgegevens. Ouders vullen ze zelf in via hun link (OGV Ouders), of jij via <b>Fiche bewerken</b>.</p>`}
    ${consentLine(p)}${p.parent_updated ? `<p class="hint" style="margin:8px 0 0">Door de ouders bijgewerkt op ${new Date(p.parent_updated).toLocaleDateString("nl-BE", { day: "numeric", month: "long" })}.</p>` : ""}${p.notes ? `<p style="margin:12px 0 0"><span class="muted">Notities:</span> ${esc(p.notes)}</p>` : ""}</div>`;
}
function contactFields(p) {
  const cs = pContacts(p); while (cs.length < 2) cs.push({});
  return `<div class="f full"><span>Ouders en noodcontact</span>${cs.slice(0, 2).map((c, i) => `<div class="ctrow">
      <input name="c${i}name" value="${esc(c.name || "")}" placeholder="Naam${i ? " (tweede contact)" : ""}"><select name="c${i}rel"><option value="">Relatie</option>${REL.map(r => `<option${r === c.rel ? " selected" : ""}>${r}</option>`).join("")}</select>
      <input name="c${i}phone" type="tel" inputmode="tel" value="${esc(c.phone || "")}" placeholder="Gsm"><input name="c${i}email" type="email" value="${esc(c.email || "")}" placeholder="E-mail"></div>`).join("")}</div>
    <label class="f full">Medisch: allergieën, medicatie, aandachtspunten<textarea name="medical" placeholder="bv. allergisch voor noten, astmapuffer in de sporttas">${esc(p.medical || "")}</textarea><span class="hint" style="font-weight:400">Alleen zichtbaar voor de trainers van de ploeg. Vul enkel in wat de ouders zelf doorgaven.</span></label>`;
}
function readContacts(f) {
  const cs = [0, 1].map(i => ({ name: (f["c" + i + "name"] || "").trim(), rel: f["c" + i + "rel"] || "", phone: (f["c" + i + "phone"] || "").trim(), email: (f["c" + i + "email"] || "").trim() })).filter(c => c.name || c.phone || c.email);
  return { contacts: cs, medical: (f.medical || "").trim() || null, parent_contact: cs.map(c => [c.name, c.phone].filter(Boolean).join(" ")).join(" · ") || null };
}
function teamContacts() {
  const ps = active();
  dialog(`<div class="dlg"><h2>Contacten ouders</h2><p class="hint" style="margin-top:0">Handig tijdens een wedstrijd of bij een blessure.</p>
    <div class="list tclist">${ps.map(p => { const cs = pContacts(p); return `<div class="item static" style="flex-wrap:wrap;row-gap:6px"><span class="num">${p.number ?? ""}</span><span class="main"><b>${esc(pname(p))}${p.medical ? ` <span class="pill loss" title="${esc(p.medical)}">medisch</span>` : ""}${p.consent && !p.consent.analysis ? ` <span class="pill" title="Geen toestemming voor beelden">geen beelden</span>` : ""}</b><small>${cs.length ? esc(cs.map(c => [c.rel || c.name, c.phone].filter(Boolean).join(" ")).join(" · ")) : "geen contact ingevuld"}</small></span>
      <span class="row" style="gap:6px">${cs.filter(c => c.phone).slice(0, 2).map(c => `<a class="btn small" href="${telHref(c.phone)}" title="${esc(c.name || "")}">${IC.phone}${esc(c.rel || "Bel")}</a>`).join("")}</span></div>`; }).join("") || '<p class="muted">Nog geen spelers.</p>'}</div>
    <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn" type="button" data-close>Sluiten</button></div></div>`);
}

/* ============ spelers importeren uit PSD (Excel of CSV) ============ */
let xlsxP = null;
const loadXLSX = () => xlsxP = xlsxP || new Promise((ok, no) => { if (window.XLSX) return ok(window.XLSX); const s = document.createElement("script"); s.src = "app/vendor/xlsx-0.18.5.mini.min.js"; s.onload = () => ok(window.XLSX); s.onerror = () => { xlsxP = null; no(new Error("Het Excel-onderdeel kon niet laden. Controleer je internet.")); }; document.head.appendChild(s); });
const IMP_F = [["first", "Voornaam", /^(voornaam|first ?name|prenom|roepnaam)$/i], ["last", "Achternaam", /^(achternaam|familienaam|naam|last ?name|surname|nom)$/i], ["full", "Volledige naam", /^(volledige naam|speler|spelersnaam|naam speler|name|lid|full ?name)$/i],
  ["birth", "Geboortedatum", /geboort|birth|geb\.? ?datum|dob/i], ["number", "Rugnummer", /^(rugnummer|rug ?nr\.?|nummer|nr\.?|shirt)$/i], ["pos", "Positie", /positie|position|plaats/i],
  ["phone", "Gsm ouder", /gsm|telefoon|tel\b|mobiel|phone|gsm ouder|gsm moeder|gsm mama/i], ["phone2", "Gsm tweede ouder", /gsm (vader|papa|2)|telefoon 2|tel ?2/i], ["email", "E-mail ouder", /e-?mail|mail/i], ["team", "Ploeg", /^(ploeg|team|categorie|reeks|elftal)$/i]];
function impDate(v) {
  if (v == null || v === "") return null; if (typeof v === "number" && v > 1000) { const d = new Date(Math.round((v - 25569) * 864e5)); return iso(d); }
  const s = String(v).trim(); let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/); if (m) { let y = +m[3]; if (y < 100) y += y > 30 ? 1900 : 2000; return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null;
}
function impTeam(val) { const s = String(val || "").toLowerCase().replace(/\s+/g, " ").trim(); if (!s) return null;
  return S.teams.find(t => t.name.toLowerCase() === s) || S.teams.find(t => t.name.toLowerCase().includes(s)) || S.teams.find(t => s.includes((t.category || "§").toLowerCase()) && s.includes(t.name.toLowerCase().split(" ").pop())) || S.teams.find(t => (t.category || "").toLowerCase() === s) || null; }
function importPlayers(clubWide) {
  const d = dialog(`<div class="dlg impdlg"><h2>Spelers importeren</h2>
    <p class="hint" style="margin-top:0">Exporteer de spelerslijst uit PSD (of een ander programma) als Excel of CSV en kies het bestand. De app herkent zelf de kolommen; je kan ze daarna nog aanpassen.${clubWide ? " Met een kolom <b>Ploeg</b> komen de spelers meteen in de juiste ploeg." : ""}</p>
    <label class="btn ghost" style="cursor:pointer">${IC.out}Bestand kiezen<input type="file" id="impf" accept=".xlsx,.xls,.csv,.txt" hidden></label><div id="impv"></div></div>`);
  $("#impf", d).onchange = async ev => { const file = ev.target.files[0]; if (!file) return; const host = $("#impv", d); host.innerHTML = `<p class="hint">Lezen…</p>`;
    let rows; try { const X = await loadXLSX(), wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: false }), ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = X.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }).filter(r => r.some(c => String(c).trim() !== ""));
      let hi = aoa.findIndex(r => r.filter(c => IMP_F.some(([, , re]) => re.test(String(c).trim()))).length >= 2); if (hi < 0) hi = 0;
      const hdr = aoa[hi].map(c => String(c).trim()); rows = { hdr, data: aoa.slice(hi + 1) }; }
    catch (x) { host.innerHTML = `<p class="err">${esc(x.message || "Dit bestand kan ik niet lezen.")}</p>`; return; }
    const map = {}; for (const [k, , re] of IMP_F) { const i = rows.hdr.findIndex((h, j) => re.test(h) && !Object.values(map).includes(j)); if (i >= 0) map[k] = i; }
    if (map.first != null && map.last == null && map.full == null) { const j = rows.hdr.findIndex((h, i) => /naam/i.test(h) && i !== map.first); if (j >= 0) map.last = j; }
    const draw = () => {
      const get = (r, k) => map[k] == null ? "" : r[map[k]], people = rows.data.map(r => { let fn = String(get(r, "first")).trim(), ln = String(get(r, "last")).trim();
          if (!fn && map.full != null) { const w = String(get(r, "full")).trim().split(/\s+/); if (/^[A-ZÀ-Ý' -]+$/.test(w[0] || "") && w.length > 1) { ln = w.shift(); fn = w.join(" "); } else { fn = w.shift() || ""; ln = w.join(" "); } }
          const team = clubWide ? impTeam(get(r, "team")) : S.team, num = parseInt(get(r, "number"), 10);
          return { fn, ln, birth: impDate(get(r, "birth")), number: Number.isFinite(num) ? num : null, pos: String(get(r, "pos")).trim(), phone: String(get(r, "phone")).trim(), phone2: String(get(r, "phone2")).trim(), email: String(get(r, "email")).trim(), team, teamRaw: String(get(r, "team")).trim() }; })
        .filter(x => x.fn);
      const noTeam = people.filter(x => !x.team);
      host.innerHTML = `<div class="impmap">${IMP_F.filter(([k]) => clubWide || k !== "team").map(([k, l]) => `<label class="f">${l}<select data-mk="${k}"><option value="">–</option>${rows.hdr.map((h, i) => `<option value="${i}"${map[k] === i ? " selected" : ""}>${esc(h || "kolom " + (i + 1))}</option>`).join("")}</select></label>`).join("")}</div>
        <p style="margin:14px 0 6px"><b>${people.length} spelers gevonden</b>${noTeam.length && clubWide ? ` · <span style="color:var(--warn)">${noTeam.length} zonder herkende ploeg (worden overgeslagen)</span>` : ""}</p>
        <div class="tblwrap"><table class="tbl"><tr><th>Naam</th><th>Geboren</th><th>Nr.</th>${clubWide ? "<th>Ploeg</th>" : ""}<th>Gsm</th></tr>${people.slice(0, 8).map(x => `<tr><td>${esc(x.fn + " " + x.ln)}</td><td>${x.birth || ""}</td><td>${x.number ?? ""}</td>${clubWide ? `<td>${x.team ? esc(x.team.name) : `<span style="color:var(--warn)">${esc(x.teamRaw || "?")}</span>`}</td>` : ""}<td>${esc(x.phone)}</td></tr>`).join("")}</table></div>
        ${people.length > 8 ? `<p class="hint">…en nog ${people.length - 8}.</p>` : ""}
        <p class="hint">Bestaat een speler al in de ploeg (zelfde voor- en achternaam), dan worden zijn gegevens aangevuld in plaats van een dubbele speler te maken.</p>
        <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" type="button" id="impgo"${people.filter(x => x.team).length ? "" : " disabled"}>${people.filter(x => x.team).length} spelers importeren</button></div>`;
      $$("[data-mk]", host).forEach(s => s.onchange = () => { s.value === "" ? delete map[s.dataset.mk] : map[s.dataset.mk] = +s.value; draw(); });
      $("[data-close]", host).onclick = () => d.close();
      $("#impgo", host).onclick = async () => { const b = $("#impgo", host); b.disabled = true; b.textContent = "Bezig…"; let nNew = 0, nUpd = 0;
        try { const byTeam = {}; for (const x of people.filter(y => y.team)) (byTeam[x.team.id] = byTeam[x.team.id] || []).push(x);
          for (const [tid, xs] of Object.entries(byTeam)) { const have = tid === S.team?.id ? S.players : await db.list("players", { team_id: tid });
            for (const x of xs) { const key = (x.fn + " " + x.ln).toLowerCase().trim(), old = have.find(p => pname(p).toLowerCase().trim() === key);
              const cs = [x.phone && { name: "", rel: "", phone: x.phone, email: x.email }, x.phone2 && { name: "", rel: "", phone: x.phone2, email: "" }, !x.phone && x.email && { name: "", rel: "", phone: "", email: x.email }].filter(Boolean);
              const row = { ...(old || { id: uid(), team_id: tid, active: true }), first_name: x.fn, last_name: x.ln, birthdate: x.birth || old?.birthdate || null, number: x.number ?? old?.number ?? null,
                position: ["Keeper", "Verdediger", "Middenvelder", "Aanvaller"].find(p => x.pos.toLowerCase().startsWith(p.slice(0, 4).toLowerCase())) || old?.position || null };
              if (V14() && cs.length && !(old && pContacts(old).length)) { row.contacts = cs; row.parent_contact = cs.map(c => c.phone || c.email).join(" · "); }
              await db.save("players", row); old ? nUpd++ : nNew++; if (tid === S.team?.id) { const i = S.players.findIndex(p => p.id === row.id); if (i >= 0) S.players[i] = row; else S.players.push(row); } } }
          sortPlayers(); d.close(); toast(`${nNew} spelers toegevoegd${nUpd ? ", " + nUpd + " aangevuld" : ""}.`); render(); }
        catch (x) { b.disabled = false; b.textContent = "Opnieuw proberen"; toast("Importeren lukte niet: " + (x.message || x)); } }; };
    draw(); };
}

/* ============ clubdashboard ============ */
const BOUW = [["", "Alle ploegen"], ["onder", "Onderbouw U6–U9"], ["midden", "Middenbouw U10–U13"], ["boven", "Bovenbouw U14+"]];
const ageOfTeam = t => { const m = String(t.category || t.name || "").match(/U\s?(\d{1,2})/i); return m ? +m[1] : null; };
const bouwOf = t => { const a = ageOfTeam(t); return a == null ? "" : a <= 9 ? "onder" : a <= 13 ? "midden" : "boven"; };
let DB_F = { since: 28, bouw: "" };
async function dashData(since) {
  if (mode !== "demo") { const r = await sb.rpc("club_dashboard", { since }); if (r.error) throw r.error; return r.data || []; }
  const T = await db.list("teams"), P = await db.list("players"), E = await db.list("events"), A = await db.list("attendance"), EV = await db.list("evaluations"), TT = await db.list("team_trainers"), today = todayIso();
  return T.map(t => { const ev = E.filter(e => e.team_id === t.id), tr = ev.filter(e => e.type === "training" && !e.cancelled && e.date >= since && e.date <= today), ma = ev.filter(e => e.type === "wedstrijd" && e.date >= since && e.date <= today);
    const at = A.filter(a => tr.some(e => e.id === a.event_id)), pids = P.filter(p => p.team_id === t.id).map(p => p.id), evs = {};
    EV.filter(x => pids.includes(x.player_id)).forEach(x => evs[x.moment] = (evs[x.moment] || 0) + 1);
    return { id: t.id, name: t.name, category: t.category, format: t.format, trainers: TT.filter(x => x.team_id === t.id).length, players: P.filter(p => p.team_id === t.id && p.active !== false).length,
      trainings: tr.length, trainings_att: tr.filter(e => A.some(a => a.event_id === e.id)).length, trainings_plan: tr.filter(e => e.plan && Object.keys(e.plan).length).length,
      att_pct: at.length ? Math.round(100 * at.filter(a => a.status === "aanwezig" || a.status === "te laat").length / at.length) : null,
      matches: ma.length, matches_report: ma.filter(e => e.score_for != null).length, evals: evs, next: ev.map(e => e.date).filter(x => x >= today).sort()[0] || null }; });
}
route("clubdashboard", { title: "Clubdashboard", auth: true, render: async v => {
  if (!(S.admin || S.allTeams || (S.teamAccess || []).length)) { v.innerHTML = `<div class="empty"><b>Alleen voor beheerders en coördinatoren</b>Vraag de beheerder om toegang.</div>`; return; }
  if (!V14()) { v.innerHTML = head("Clubdashboard", "") + needV14("Het clubdashboard"); return; }
  v.innerHTML = head("Clubdashboard", "Hoe staan de ploegen ervoor? Zonder namen van kinderen: enkel cijfers per ploeg.") + `<p class="hint">Laden…</p>`;
  const since = iso(addDays(new Date(), -DB_F.since)); let rows;
  try { rows = await dashData(since); } catch (e) { v.innerHTML = head("Clubdashboard", "") + `<div class="empty"><b>Laden mislukt</b>${esc(e.message || e)}</div>`; return; }
  const mom = typeof EV_MOMENTS !== "undefined" ? EV_MOMENTS : [], curM = (() => { const m = new Date().getMonth() + 1; return m >= 8 && m <= 10 ? 2 : m >= 11 || m <= 1 ? 3 : m <= 4 ? 4 : 5; })();
  rows = rows.filter(r => !DB_F.bouw || bouwOf(r) === DB_F.bouw).sort((a, b) => (ageOfTeam(a) ?? 99) - (ageOfTeam(b) ?? 99) || a.name.localeCompare(b.name, "nl", { numeric: true }));
  const pct = (a, b) => b ? Math.round(100 * a / b) : null, flag = r => { const f = [];
    if (!r.trainers) f.push("geen trainer"); if (!r.players) f.push("geen spelers");
    if (r.trainings && pct(r.trainings_att, r.trainings) < 60) f.push("aanwezigheden niet bijgehouden"); if (r.matches && r.matches_report < r.matches) f.push((r.matches - r.matches_report) + " uitslag(en) ontbreken");
    if (!r.next) f.push("niets meer gepland"); return f; };
  const tot = k => rows.reduce((s, r) => s + (r[k] || 0), 0), attAll = rows.filter(r => r.att_pct != null), probs = rows.filter(r => flag(r).length);
  const cell = (val, good) => `<td class="${val == null ? "" : good ? "okc" : "badc"}">${val ?? "–"}</td>`;
  v.innerHTML = head("Clubdashboard", "Hoe staan de ploegen ervoor? Zonder namen van kinderen: enkel cijfers per ploeg.", `<button class="btn ghost" type="button" id="dbcsv">${IC.out}Excel</button>`) +
    `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:14px"><div class="chips">${[[28, "4 weken"], [56, "8 weken"], [120, "Seizoen"]].map(([n, l]) => `<button class="chip" type="button" data-sn="${n}" aria-pressed="${DB_F.since === n}">${l}</button>`).join("")}</div>
      <select id="dbbouw" style="width:auto">${BOUW.map(([k, l]) => `<option value="${k}"${k === DB_F.bouw ? " selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="kpis"><div class="kpi"><small>Ploegen</small><b>${rows.length}</b><span>${tot("players")} spelers · ${tot("trainers")} trainers</span></div>
      <div class="kpi"><small>Aanwezigheid training</small><b>${attAll.length ? Math.round(attAll.reduce((s, r) => s + r.att_pct, 0) / attAll.length) + "%" : "–"}</b><span>gemiddeld per ploeg</span></div>
      <div class="kpi"><small>Trainingen bijgehouden</small><b>${pct(tot("trainings_att"), tot("trainings")) ?? "–"}${tot("trainings") ? "%" : ""}</b><span>${tot("trainings_att")} van ${tot("trainings")} met aanwezigheden</span></div>
      <div class="kpi"><small>Vraagt aandacht</small><b style="color:${probs.length ? "var(--warn)" : "inherit"}">${probs.length}</b><span>ploegen</span></div></div>
    ${probs.length ? `<div class="sec panel"><h2>Vraagt aandacht</h2><div class="list">${probs.map(r => `<div class="item static"><span class="main"><b>${esc(r.name)}</b><small>${esc(flag(r).join(" · "))}</small></span></div>`).join("")}</div></div>` : ""}
    <div class="sec panel"><h2>Per ploeg</h2><div class="tblwrap"><table class="tbl dbt"><tr><th>Ploeg</th><th>Trainers</th><th>Spelers</th><th>Aanwezig</th><th>Bijgehouden</th><th>Met plan</th><th>Uitslagen</th><th>Evaluatie ${esc(mom[curM - 1]?.kort || "")}</th><th>Volgende</th></tr>
      ${rows.map(r => { const ev = (r.evals || {})[curM] || 0; return `<tr><td><b>${esc(r.name)}</b></td>${cell(r.trainers, r.trainers > 0)}<td>${r.players}</td>${cell(r.att_pct == null ? null : r.att_pct + "%", r.att_pct >= 75)}
        ${cell(r.trainings ? r.trainings_att + "/" + r.trainings : null, pct(r.trainings_att, r.trainings) >= 80)}<td>${r.trainings ? r.trainings_plan + "/" + r.trainings : "–"}</td>${cell(r.matches ? r.matches_report + "/" + r.matches : null, r.matches_report >= r.matches)}
        <td>${r.players ? ev + "/" + r.players : "–"}</td><td>${r.next ? dShort(r.next) : "–"}</td></tr>`; }).join("")}</table></div>
      <p class="hint" style="margin-bottom:0">Bijgehouden: trainingen waarbij de aanwezigheden ingevuld zijn. Uitslagen: gespeelde wedstrijden met een score. Groen is in orde, rood vraagt aandacht.</p></div>`;
  $$("[data-sn]", v).forEach(b => b.onclick = () => { DB_F.since = +b.dataset.sn; render(); });
  $("#dbbouw").onchange = e => { DB_F.bouw = e.target.value; render(); };
  $("#dbcsv").onclick = () => download("clubdashboard-" + todayIso() + ".csv", "﻿" + [["Ploeg", "Trainers", "Spelers", "Aanwezigheid %", "Trainingen", "Met aanwezigheden", "Met plan", "Wedstrijden", "Met uitslag", "Volgende"].join(";"),
    ...rows.map(r => [r.name, r.trainers, r.players, r.att_pct ?? "", r.trainings, r.trainings_att, r.trainings_plan, r.matches, r.matches_report, r.next || ""].map(csvCell).join(";"))].join("\n"));
} });

/* ============ terreinoverzicht ============ */
let FLD_W = 0;
const minOf = t => { const [h, m] = String(t || "").split(":").map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
async function fieldsData(d1, d2) {
  if (mode !== "demo") { const r = await sb.rpc("club_fields", { d1, d2 }); if (r.error) throw r.error; return r.data || []; }
  const T = await db.list("teams"); return (await db.list("events")).filter(e => e.date >= d1 && e.date <= d2 && (e.type === "training" || e.home !== false))
    .map(e => ({ id: e.id, team_id: e.team_id, team: T.find(t => t.id === e.team_id)?.name || "?", type: e.type, date: e.date, start: tm(e.start_time), end: tm(e.end_time), location: e.location, opponent: e.opponent, cancelled: !!e.cancelled || e.rbfa_state === "afgelast" }));
}
function overlaps(list) { const bad = new Set();
  const live = list.filter(x => !x.cancelled && x.location && minOf(x.start) != null);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) { const a = live[i], b = live[j];
    if (a.date !== b.date || a.location.trim().toLowerCase() !== b.location.trim().toLowerCase()) continue;
    const a1 = minOf(a.start), a2 = minOf(a.end) ?? a1 + 90, b1 = minOf(b.start), b2 = minOf(b.end) ?? b1 + 90; if (a1 < b2 && b1 < a2) { bad.add(a.id); bad.add(b.id); } }
  return bad; }
route("terreinen", { title: "Terreinen", auth: true, render: async v => {
  const mon = addDays(monday(new Date()), FLD_W * 7), d1 = iso(mon), d2 = iso(addDays(mon, 6));
  v.innerHTML = head("Terreinen", "Wie traint of speelt wanneer op welk veld, voor de hele club. Overlappingen op hetzelfde terrein zijn rood.") + `<p class="hint">Laden…</p>`;
  let list; try { list = await fieldsData(d1, d2); } catch (e) { v.innerHTML = head("Terreinen", "") + (/club_fields|function/i.test(e.message || "") ? needV14("Het terreinoverzicht") : `<div class="empty"><b>Laden mislukt</b>${esc(e.message || e)}</div>`); return; }
  const bad = overlaps(list), locs = [...new Set(list.map(x => (x.location || "").trim() || "Geen terrein ingevuld"))].sort((a, b) => a === "Geen terrein ingevuld" ? 1 : b === "Geen terrein ingevuld" ? -1 : a.localeCompare(b, "nl", { numeric: true }));
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => iso(addDays(mon, i)));
  v.innerHTML = head("Terreinen", "Wie traint of speelt wanneer op welk veld, voor de hele club. Overlappingen op hetzelfde terrein zijn rood.") +
    `<div class="row" style="gap:8px;margin-bottom:14px"><button class="ib" type="button" id="fwp">${IC.chevl || "‹"}</button><b>${dShort(d1)} – ${dShort(d2)}</b><button class="ib" type="button" id="fwn">${IC.chev}</button>${FLD_W ? `<button class="link" type="button" id="fw0">Deze week</button>` : ""}<span class="spacer"></span>${bad.size ? `<span class="pill loss">${bad.size} overlappend</span>` : list.length ? `<span class="pill w">geen overlap</span>` : ""}</div>` +
    (list.length ? locs.map(l => `<div class="sec panel fld"><h2>${esc(l)}</h2><div class="fldw">${days.map(dd => { const xs = list.filter(x => ((x.location || "").trim() || "Geen terrein ingevuld") === l && x.date === dd).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
        return `<div class="fldd${dd === todayIso() ? " today" : ""}"><small>${new Date(dd + "T12:00").toLocaleDateString("nl-BE", { weekday: "short", day: "numeric" })}</small>${xs.map(x => `<div class="fldb ${x.type}${bad.has(x.id) ? " clash" : ""}${x.cancelled ? " off" : ""}"><b>${x.start || "?"}${x.end ? "–" + x.end : ""}</b><span>${esc(x.team)}</span>${x.type === "wedstrijd" ? `<em>vs ${esc(x.opponent || "")}</em>` : ""}</div>`).join("") || '<span class="fld0">–</span>'}</div>`; }).join("")}</div></div>`).join("")
      : `<div class="empty"><b>Niets gepland deze week</b>Trainingen die in de kalender staan (of die de beheerder inplant) verschijnen hier per terrein.</div>`);
  $("#fwp").onclick = () => { FLD_W--; render(); }; $("#fwn").onclick = () => { FLD_W++; render(); }; const z = $("#fw0"); if (z) z.onclick = () => { FLD_W = 0; render(); };
} });
