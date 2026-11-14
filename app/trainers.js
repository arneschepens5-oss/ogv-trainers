/* FootballCoachHub — trainersdossier: wie zijn de trainers van de club, in welke ploegen, hoe bereik je ze en welke opleidingen hebben ze.
   Bewust NIET opgeslagen: rijksregisternummer, identiteitskaart- of rekeningnummer. Zichtbaar voor alle trainers van de club;
   wijzigen kan de trainer zelf of een beheerder. */
"use strict";
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
     <div class="panel"><h2>Opleidingen en diploma's</h2>${dip.length ? `<div class="list">${dip.map(x => `<div class="item static"><span class="main"><b style="white-space:normal">${esc(x)}</b></span></div>`).join("")}</div>` : `<p class="hint" style="margin:0">${canEdit ? "Voeg je diploma's en opleidingen toe via Profiel aanpassen." : "Nog niets ingevuld."}</p>`}</div></div>
    <div class="panel sec"><h2>Ploegen</h2>${t.teams.length ? `<div class="list">${t.teams.map(x => `<div class="item static"><span class="num">${esc(teamCode(x))}</span><span class="main"><b>${esc(x.name)}</b><small>${esc([x.category, x.format, x.season].filter(Boolean).join(" · "))}</small></span></div>`).join("")}</div>` : `<p class="hint" style="margin:0">Nog niet gekoppeld aan een ploeg.</p>`}</div>
    ${!pr && !canEdit ? `<p class="hint">Deze trainer heeft nog geen profiel ingevuld.</p>` : ""}`;
  if (canEdit) $("#tEdit").onclick = () => trainerForm(t, pr, nm);
} });

function trainerForm(t, pr, nm) {
  const mine = t.user_id === user?.id, ph = { blob: null, remove: false };
  const d = dialog(`<form><h2>${mine ? "Mijn profiel" : "Profiel van " + esc(nm)}</h2><div class="fields">
   <div class="f full pfoto"><span class="pfimg" id="pfImg">${pr?.photo ? `<img data-pp="${esc(pr.photo)}" alt="">` : `<b>${esc(nm.slice(0, 1).toUpperCase())}</b>`}</span>
    <div class="pfc"><div class="row" style="gap:8px;flex-wrap:wrap"><label class="btn ghost small" style="cursor:pointer">${pr?.photo ? "Andere foto" : "Foto toevoegen"}<input type="file" id="pfFile" accept="image/*" hidden></label>${pr?.photo ? `<button class="btn ghost small" type="button" id="pfDel">Foto verwijderen</button>` : ""}</div>
    <small class="hint">Zichtbaar voor de trainers van de club.</small></div></div>
   <label class="f">Naam<input name="name" required maxlength="80" value="${esc(pr?.name || (mine ? "" : nm))}" placeholder="Voor- en achternaam"></label>
   <label class="f">Functie<input name="role" maxlength="80" value="${esc(pr?.role || "")}" placeholder="bv. Trainer PU9"></label>
   <label class="f">Gsm<input name="phone" type="tel" inputmode="tel" maxlength="30" value="${esc(pr?.phone || "")}"></label>
   <label class="f">E-mail<input name="email" type="email" maxlength="120" value="${esc(pr?.email || t.email || "")}"></label>
   <label class="f full">Opleidingen en diploma's<textarea name="diplomas" rows="4" maxlength="800" placeholder="Eén per regel, bv.&#10;Initiator (Voetbal Vlaanderen)&#10;Talentscout 1">${esc(pr?.diplomas || "")}</textarea></label>
   <label class="f full">Korte presentatie<textarea name="bio" rows="3" maxlength="600">${esc(pr?.bio || "")}</textarea></label></div>
   <p class="hint" style="margin:8px 0 0">Zet hier geen rijksregister-, identiteitskaart- of rekeningnummer. Die horen niet in deze app.</p>
   <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  $("#pfFile", d).onchange = async e => { const f = e.target.files[0]; if (!f) return;
    try { ph.blob = await photos.shrink(f); ph.remove = false; $("#pfImg", d).innerHTML = `<img src="${URL.createObjectURL(ph.blob)}" alt="">`; } catch (err) { toast(err.message || "Foto kiezen is niet gelukt."); e.target.value = ""; } };
  if ($("#pfDel", d)) $("#pfDel", d).onclick = () => { ph.blob = null; ph.remove = true; $("#pfImg", d).innerHTML = `<b>${esc(nm.slice(0, 1).toUpperCase())}</b>`; $("#pfDel", d).hidden = true; };
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    await safe(async () => {
      const row = { user_id: t.key, club_id: CLUB.id, name: f.name.trim(), role: f.role.trim() || null, phone: f.phone.trim() || null, email: f.email.trim() || null, diplomas: f.diplomas.trim() || null, bio: f.bio.trim() || null, photo: pr?.photo || null };
      if (ph.blob) row.photo = await photos.saveTrainer(CLUB.id, t.key, ph.blob); else if (ph.remove) row.photo = null;
      await db.save("trainer_profiles", row); if ((ph.blob || ph.remove) && pr?.photo) photos.remove(pr.photo);
      d.close(); render(); }, "Profiel opgeslagen."); };
}
