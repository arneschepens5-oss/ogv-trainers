/* FootballCoachHub — trainersdossier: wie zijn de trainers van de club, in welke ploegen, hoe bereik je ze en welke opleidingen hebben ze.
   Bewust NIET opgeslagen: rijksregisternummer, identiteitskaart- of rekeningnummer. Zichtbaar voor alle trainers van de club;
   wijzigen kan de trainer zelf of een beheerder. */
"use strict";

/* diploma's en opleidingen van Voetbal Vlaanderen (opleidingsaanbod 2024-2025 en gelijkstellingstabel 2024) */
const DIPL = [
  ["Trainersdiploma's", [["s2c", "Start 2 Coach"], ["uefa_c", "Initiator / UEFA C (veldvoetbal)"], ["uefa_c_in", "Initiator / UEFA C (indoor)"], ["uefa_c_g", "Initiator / UEFA C (G-voetbal)"], ["instr", "Instructeur"],
    ["uefa_b", "Trainer B / UEFA B"], ["uefa_b_fs", "Trainer B / UEFA B Futsal"], ["uefa_a", "Trainer A / UEFA A (elite jeugd en seniors)"], ["uefa_ey", "UEFA Elite Youth A"], ["uefa_pro", "UEFA Pro"]]],
  ["Jeugdwerking", [["jc", "Jeugdcoördinator"], ["tvjo1", "TVJO 1"], ["tvjo2", "TVJO 2"], ["mentor", "Mentor coach"], ["techniek", "Techniektraining"], ["multiskillz", "Multiskillz for foot"]]],
  ["Scouting en analyse", [["ts1", "Talentscout 1 (talentidentificatie 1)"], ["ts2", "Talentscout 2 (talentidentificatie 2)"], ["ws1", "Wedstrijdscout 1"], ["va1", "Videoanalist 1"], ["va2", "Videoanalist 2"]]],
  ["Keeper, fysiek en mentaal", [["kt1", "Keepertrainer 1 (jeugd)"], ["kt2", "Keepertrainer 2 / UEFA Goalkeeper B"], ["phys", "Physical coach (jeugd)"], ["uefa_fit", "UEFA Fitness B"],
    ["blp1", "Blessurepreventie 1"], ["blp2", "Blessurepreventie 2"], ["mc1", "Mental coaching 1"], ["mc2", "Mental coaching 2"]]],
  ["Andere", [["api", "Club-API (aanspreekpunt integriteit)"], ["ref", "Ref in one day"], ["ehbo", "EHBO / reanimatie"]]]];
const DIPL_N = Object.fromEntries(DIPL.flatMap(([, xs]) => xs));
const DOC_BUCKET = "trainer-docs";
const tDipl = pr => pr?.dipl && typeof pr.dipl === "object" ? pr.dipl : {};
const docs = {
  async save(clubId, userId, code, file) {
    if (file.size > 10 * 1048576) throw new Error("Het bestand is groter dan 10 MB.");
    if (!/^(application\/pdf|image\/(jpeg|png|webp|heic))$/.test(file.type)) throw new Error("Kies een pdf of een foto (jpg, png).");
    if (mode === "demo") return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1].replace("jpeg", "jpg"), path = `${clubId}/${userId}/${code}-${uid().slice(0, 8)}.${ext}`;
    const { error } = await sb.storage.from(DOC_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(/bucket not found/i.test(error.message) ? "De opslag voor diploma's is nog niet klaargezet: voer supabase-diplomas-v45.sql uit." : /row-level|policy/i.test(error.message) ? "Je mag dit diploma niet opslaan." : error.message);
    return path;
  },
  async open(path) {
    if (/^data:/.test(path)) { const w = window.open(); if (w) w.document.write(`<iframe src="${path}" style="border:0;width:100%;height:100vh"></iframe>`); return; }
    const w = window.open("", "_blank"); const { data, error } = await sb.storage.from(DOC_BUCKET).createSignedUrl(path, 300);
    if (error) { if (w) w.close(); toast("Openen lukte niet: " + error.message); return; } if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  },
  async remove(path) { if (!path || /^data:/.test(path) || mode === "demo" || !sb) return; await sb.storage.from(DOC_BUCKET).remove([path]).catch(() => {}); }
};
let TP = [], TPok = true;
async function tpLoad() { try { TP = await db.list("trainer_profiles"); TPok = true; } catch (e) { TP = []; TPok = false; } }
const tpOf = key => TP.find(x => x.user_id === key) || null;
const tKey = r => r.user_id || r.email || "";
const tNice = e => String(e || "Trainer").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const tName = (r, prof) => prof?.name || tNice(r?.email || prof?.email);
const tIsId = k => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k) || k === "demo";
/* avatar van een trainer: foto of de beginletter */
const tAv = (prof, name, size = 48) => prof?.photo ? `<span class="tav" style="width:${size}px;height:${size}px"><img data-pp="${esc(prof.photo)}" alt="" draggable="false"></span>`
  : `<span class="tav" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px">${esc((name || "?").trim().slice(0, 1).toUpperCase())}</span>`;
/* alle trainers van de club: per persoon de ploegen waarin hij of zij staat */
async function tAll() {
  const [teams, rows] = await Promise.all([db.list("teams"), db.list("team_trainers")]); await tpLoad();
  const by = new Map();
  for (const r of rows) { const k = tKey(r); if (!k) continue; const o = by.get(k) || { key: k, user_id: r.user_id, email: r.email, teams: [] };
    const t = teams.find(x => x.id === r.team_id); if (t && !o.teams.some(x => x.id === t.id)) o.teams.push(t); if (!o.email && r.email) o.email = r.email; by.set(k, o); }
  for (const p of TP) if (!by.has(p.user_id)) by.set(p.user_id, { key: p.user_id, user_id: p.user_id, email: p.email, teams: [] });
  return [...by.values()].sort((a, b) => tName(a, tpOf(a.key)).localeCompare(tName(b, tpOf(b.key)), "nl"));
}

route("trainers", { title: "Trainers", auth: true, render: async (v) => {
  v.innerHTML = head("Trainers", "Wie coacht welke ploeg en hoe bereik je elkaar? Tik op een trainer voor zijn of haar dossier.", user && tIsId(user.id) ? `<a class="btn ghost" href="#/trainer/${encodeURIComponent(user.id)}">Mijn profiel</a>` : "") + `<div class="empty"><b>Laden…</b></div>`;
  const all = await safe(tAll); if (!all) return;
  v.innerHTML = head("Trainers", "Wie coacht welke ploeg en hoe bereik je elkaar? Tik op een trainer voor zijn of haar dossier.", user && tIsId(user.id) ? `<a class="btn ghost" href="#/trainer/${encodeURIComponent(user.id)}">Mijn profiel</a>` : "") +
    (TPok ? "" : `<div class="share" style="margin-bottom:14px">${IC.eye}<div><b style="color:var(--ink)">Profielen zijn nog niet ingeschakeld</b><br>De beheerder moet <b>supabase-dossiers-v40.sql</b> uitvoeren. Tot dan zie je enkel de namen en ploegen.</div></div>`) +
    (all.length ? `<div class="list">${all.map(t => { const pr = tpOf(t.key), nm = tName(t, pr);
      return `<a class="item" href="#/trainer/${encodeURIComponent(t.key)}">${tAv(pr, nm, 44)}<span class="main"><b>${esc(nm)}${t.user_id && t.user_id === user?.id ? ' <span class="pill g">jij</span>' : ""}</b><small>${esc([pr?.role, t.teams.map(teamLbl).join(", ")].filter(Boolean).join(" · ") || "Nog geen ploeg")}</small></span></a>`; }).join("")}</div>`
      : `<div class="empty"><b>Nog geen trainers</b></div>`);
} });

route("trainer", { title: "Trainer", auth: true, render: async (v, id) => {
  const key = decodeURIComponent(id || "");
  v.innerHTML = backLink("#/trainers", "Alle trainers") + `<div class="empty"><b>Laden…</b></div>`;
  const all = await safe(tAll); if (!all) return;
  const t = all.find(x => x.key === key); if (!t) { v.innerHTML = backLink("#/trainers", "Alle trainers") + `<div class="empty"><b>Trainer niet gevonden</b></div>`; return; }
  const pr = tpOf(key), nm = tName(t, pr), mine = t.user_id && t.user_id === user?.id, canEdit = TPok && tIsId(key) && (mine || S.admin);
  const dip = String(pr?.diplomas || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean), email = pr?.email || t.email;
  const myIds = new Set((S.teams || []).map(x => x.id));
  v.innerHTML = backLink("#/trainers", "Alle trainers") + `<div class="ph">${tAv(pr, nm, 72)}<div class="t"><h1 class="pg">${esc(nm)}</h1><p class="sub">${esc([pr?.role, t.teams.map(teamLbl).join(", ")].filter(Boolean).join(" · ") || "Trainer")}</p></div>
      ${canEdit ? `<button class="btn ghost" type="button" id="tEdit">${mine ? "Mijn profiel aanpassen" : "Profiel aanpassen"}</button>` : ""}</div>
    <div class="grid2">
     <div class="panel"><h2>Contact</h2><div class="list">
       ${pr?.phone ? `<a class="item" href="tel:${esc(pr.phone.replace(/[^\d+]/g, ""))}"><span class="main"><b>${esc(pr.phone)}</b><small>Gsm</small></span></a>` : ""}
       ${email ? `<a class="item" href="mailto:${esc(email)}"><span class="main"><b>${esc(email)}</b><small>E-mail</small></span></a>` : ""}
       ${!pr?.phone && !email ? `<p class="hint" style="margin:0">Nog geen contactgegevens.</p>` : ""}</div>
       ${pr?.bio ? `<h3 class="dosh" style="margin-top:14px">Over ${esc(nm.split(" ")[0])}</h3><p style="margin:0;white-space:pre-line">${esc(pr.bio)}</p>` : ""}</div>
     <div class="panel"><h2>Opleidingen en diploma's</h2>${(() => { const dd = tDipl(pr), codes = Object.keys(dd).filter(k => DIPL_N[k]), seeDoc = mine || S.admin;
       const order = DIPL.flatMap(([, xs]) => xs.map(x => x[0])); codes.sort((a, b) => order.indexOf(a) - order.indexOf(b));
       return (codes.length ? `<div class="dipl-list">${codes.map(k => `<div class="dipl"><span class="dipl-ic${dd[k].file ? " ok" : ""}" title="${dd[k].file ? "Diploma opgeladen" : "Nog geen diploma opgeladen"}">${dd[k].file ? "✓" : ""}</span><span class="dipl-n"><b>${esc(DIPL_N[k])}</b>${dd[k].y ? `<small>${esc(dd[k].y)}</small>` : ""}</span>${dd[k].file && seeDoc ? `<button type="button" class="btn ghost small" data-doc="${esc(k)}">Bekijken</button>` : ""}</div>`).join("")}</div>` : "")
         + (dip.length ? `<h3 class="dosh" style="margin-top:12px">Andere opleidingen</h3><p style="margin:0;white-space:pre-line">${esc(dip.join("\n"))}</p>` : "")
         + (!codes.length && !dip.length ? `<p class="hint" style="margin:0">${canEdit ? "Duid je diploma's aan via Profiel aanpassen." : "Nog niets ingevuld."}</p>` : "")
         + (codes.some(k => dd[k].file) && !seeDoc ? `<p class="hint" style="margin:10px 0 0">Opgeladen diploma's zijn enkel zichtbaar voor de trainer zelf en de beheerders.</p>` : ""); })()}</div></div>
    <div class="panel sec"><h2>Ploegen</h2>${t.teams.length ? `<div class="list">${t.teams.map(x => `<div class="item static"><span class="num">${esc(teamCode(x))}</span><span class="main"><b>${esc(x.name)}</b><small>${esc([x.category, x.format, x.season].filter(Boolean).join(" · "))}</small></span></div>`).join("")}</div>` : `<p class="hint" style="margin:0">Nog niet gekoppeld aan een ploeg.</p>`}</div>
    ${!pr && !canEdit ? `<p class="hint">Deze trainer heeft nog geen profiel ingevuld.</p>` : ""}`;
  if (canEdit) $("#tEdit").onclick = () => trainerForm(t, pr, nm);
  $$("[data-doc]", v).forEach(b => b.onclick = () => docs.open(tDipl(pr)[b.dataset.doc].file));
} });

function trainerForm(t, pr, nm) {
  const mine = t.user_id === user?.id, ph = { blob: null, remove: false }, dd = JSON.parse(JSON.stringify(tDipl(pr))), files = {};
  const d = dialog(`<form><h2>${mine ? "Mijn profiel" : "Profiel van " + esc(nm)}</h2><div class="fields">
   <div class="f full pfoto"><span class="pfimg" id="pfImg">${pr?.photo ? `<img data-pp="${esc(pr.photo)}" alt="">` : `<b>${esc(nm.slice(0, 1).toUpperCase())}</b>`}</span>
    <div class="pfc"><div class="row" style="gap:8px;flex-wrap:wrap"><label class="btn ghost small" style="cursor:pointer">${pr?.photo ? "Andere foto" : "Foto toevoegen"}<input type="file" id="pfFile" accept="image/*" hidden></label>${pr?.photo ? `<button class="btn ghost small" type="button" id="pfDel">Foto verwijderen</button>` : ""}</div>
    <small class="hint">Zichtbaar voor de trainers van de club.</small></div></div>
   <label class="f">Naam<input name="name" required maxlength="80" value="${esc(pr?.name || (mine ? "" : nm))}" placeholder="Voor- en achternaam"></label>
   <label class="f">Functie<input name="role" maxlength="80" value="${esc(pr?.role || "")}" placeholder="bv. Trainer PU9"></label>
   <label class="f">Gsm<input name="phone" type="tel" inputmode="tel" maxlength="30" value="${esc(pr?.phone || "")}"></label>
   <label class="f">E-mail<input name="email" type="email" maxlength="120" value="${esc(pr?.email || t.email || "")}"></label>
   <div class="f full"><span>Diploma's van Voetbal Vlaanderen <small class="muted" style="font-weight:400">— vink aan wat je behaalde en laad het diploma op (pdf of foto)</small></span>
    <div class="dipl-pick">${DIPL.map(([g, xs]) => `<details${xs.some(([k]) => dd[k]) || g === "Trainersdiploma's" ? " open" : ""}><summary>${esc(g)}<small>${xs.filter(([k]) => dd[k]).length || ""}</small></summary>${xs.map(([k, l]) => `<div class="dp-row" data-k="${k}"><label class="check"><input type="checkbox" data-dk="${k}"${dd[k] ? " checked" : ""}> <span>${esc(l)}</span></label>
      <span class="dp-more"${dd[k] ? "" : " hidden"}><input type="number" class="dp-y" min="1980" max="2100" placeholder="Jaar" value="${esc(dd[k]?.y || "")}" aria-label="Jaar behaald"><label class="btn ghost small dp-up">${dd[k]?.file ? "Ander bestand" : "Diploma uploaden"}<input type="file" accept="application/pdf,image/*" hidden></label><span class="dp-st">${dd[k]?.file ? `✓ ${esc(dd[k].name || "opgeladen")}` : ""}</span></span></div>`).join("")}</details>`).join("")}</div></div>
   <label class="f full">Andere opleidingen<textarea name="diplomas" rows="2" maxlength="800" placeholder="Eén per regel, bv. LO-diploma, KNVB-cursus">${esc(pr?.diplomas || "")}</textarea></label>
   <label class="f full">Korte presentatie<textarea name="bio" rows="3" maxlength="600">${esc(pr?.bio || "")}</textarea></label></div>
   <p class="hint" style="margin:8px 0 0">Zet hier geen rijksregister-, identiteitskaart- of rekeningnummer. Die horen niet in deze app.</p>
   <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  $("#pfFile", d).onchange = async e => { const f = e.target.files[0]; if (!f) return;
    try { ph.blob = await photos.shrink(f); ph.remove = false; $("#pfImg", d).innerHTML = `<img src="${URL.createObjectURL(ph.blob)}" alt="">`; } catch (err) { toast(err.message || "Foto kiezen is niet gelukt."); e.target.value = ""; } };
  if ($("#pfDel", d)) $("#pfDel", d).onclick = () => { ph.blob = null; ph.remove = true; $("#pfImg", d).innerHTML = `<b>${esc(nm.slice(0, 1).toUpperCase())}</b>`; $("#pfDel", d).hidden = true; };
  $$("[data-dk]", d).forEach(c => c.onchange = () => { c.closest(".dp-row").querySelector(".dp-more").hidden = !c.checked; });
  $$(".dp-row input[type=file]", d).forEach(inp => inp.onchange = () => { const f0 = inp.files[0], row = inp.closest(".dp-row"); if (!f0) return;
    if (f0.size > 10 * 1048576) { toast("Het bestand is groter dan 10 MB."); inp.value = ""; return; } files[row.dataset.k] = f0; row.querySelector(".dp-st").textContent = "↑ " + f0.name; });
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    await safe(async () => {
      const row = { user_id: t.key, club_id: CLUB.id, name: f.name.trim(), role: f.role.trim() || null, phone: f.phone.trim() || null, email: f.email.trim() || null, diplomas: f.diplomas.trim() || null, bio: f.bio.trim() || null, photo: pr?.photo || null };
      if (ph.blob) row.photo = await photos.saveTrainer(CLUB.id, t.key, ph.blob); else if (ph.remove) row.photo = null;
      const nd = {}, drop = [];
      for (const r of $$(".dp-row", d)) { const k = r.dataset.k, on = r.querySelector("[data-dk]").checked, old = dd[k];
        if (!on) { if (old?.file) drop.push(old.file); continue; }
        const y = r.querySelector(".dp-y").value; nd[k] = { y: y ? +y : null, file: old?.file || null, name: old?.name || null };
        if (files[k]) { nd[k].file = await docs.save(CLUB.id, t.key, k, files[k]); nd[k].name = files[k].name.slice(0, 80); if (old?.file) drop.push(old.file); } }
      row.dipl = nd;
      await db.save("trainer_profiles", row).catch(err => { if (/dipl/.test(err.message || "")) throw new Error("Voer eerst supabase-diplomas-v45.sql uit in Supabase."); throw err; });
      if ((ph.blob || ph.remove) && pr?.photo) photos.remove(pr.photo); drop.forEach(x => docs.remove(x));
      d.close(); render(); }, "Profiel opgeslagen."); };
}
