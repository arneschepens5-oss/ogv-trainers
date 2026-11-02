/* OGV Platform — "Mijn map": privé opslag, eigen spelprincipes en mixschema's per trainer.
   Alles hier is enkel zichtbaar voor de trainer die het maakte (RLS op trainer_items en op de storage-map). */
"use strict";

/* ============ mixschema-generator ============ */
/* players: [{name, group:"A"|"B"|""}]; verdeelt per speeldag over `teams` ploegen,
   met gelijke ploeggroottes, A/B evenwichtig verdeeld en zo weinig mogelijk dezelfde duo's. */
function mixMake(players, days = 12, teams = 2) {
  const n = players.length, pc = Array.from({ length: n }, () => new Array(n).fill(0)), out = [];
  if (n < teams * 2) return { players, teams, days: [] };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cost = split => split.reduce((s, t) => { let c = 0; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const x = pc[t[i]][t[j]]; c += x * x; } return s + c; }, 0);
  const groups = ["A", "B", ""].map(g => players.map((p, i) => (p.group || "") === g ? i : -1).filter(i => i >= 0));
  for (let d = 0; d < days; d++) {
    let best = null, bc = Infinity;
    for (let r = 0; r < 160; r++) {
      const split = Array.from({ length: teams }, () => []); let k = r % teams;
      for (const g of groups) for (const i of shuffle(g.slice())) { /* deel rond: zo blijven grootte en A/B in evenwicht */
        let t = k % teams; const min = Math.min(...split.map(x => x.length)); while (split[t].length > min) t = (t + 1) % teams; split[t].push(i); k++; }
      /* lokale verbetering: wissel spelers van dezelfde groep tussen ploegen */
      let c = cost(split), improved = true;
      for (let it = 0; improved && it < 4; it++) { improved = false;
        for (let a = 0; a < teams; a++) for (let b = a + 1; b < teams; b++) for (let i = 0; i < split[a].length; i++) for (let j = 0; j < split[b].length; j++) {
          const x = split[a][i], y = split[b][j]; if ((players[x].group || "") !== (players[y].group || "")) continue;
          split[a][i] = y; split[b][j] = x; const c2 = cost(split); if (c2 < c) { c = c2; improved = true; } else { split[a][i] = x; split[b][j] = y; } } }
      if (c < bc) { bc = c; best = split.map(t => t.slice()); }
    }
    for (const t of best) for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { pc[t[i]][t[j]]++; pc[t[j]][t[i]]++; }
    out.push(best);
  }
  return { players, teams, days: out };
}
function mixPairs(m) { const n = m.players.length, pc = Array.from({ length: n }, () => new Array(n).fill(0));
  (m.days || []).forEach(d => d.forEach(t => t.forEach(a => t.forEach(b => { if (a !== b) pc[a][b]++; })))); return pc; }

/* ============ Mijn opslag ============ */
const OP_FOLDERS = ["Documenten", "Spelprincipes", "Oefeningen", "Video's", "Tactieken"];
let opFolder = "Documenten", opQ = "", opExtra = [];
const opIcon = r => r.data?.url ? IC.link : !r.file_path ? IC.note : /^image\//.test(r.file_type || "") ? IC.img : /^video\//.test(r.file_type || "") ? IC.video : IC.file;
const opKind = r => r.data?.url ? "Link" : !r.file_path ? "Notitie" : ((r.file_name || "").split(".").pop() || "").toUpperCase().slice(0, 5);
route("opslag", { title: "Mijn opslag", auth: true, render: async v => {
  v.innerHTML = head("Mijn opslag", "Laden…");
  const [docs, pr, ex, vp] = await Promise.all([items.list("document"), items.list("principe"), items.list("oefening"), items.list("videoproject")]);
  const folders = [...new Set([...OP_FOLDERS, ...opExtra, ...docs.map(d => d.folder).filter(Boolean)])];
  if (!folders.includes(opFolder)) opFolder = folders[0];
  const used = docs.reduce((s, d) => s + (d.file_size || 0), 0);
  v.innerHTML = head("Mijn opslag", "Je persoonlijke map: documenten, video's, links en notities. Alleen jij ziet wat hier staat.",
    `<label class="btn" style="cursor:pointer">${IC.up}Bestanden toevoegen<input type="file" id="opf" multiple hidden></label>`) +
  `<div class="grid3" style="margin-bottom:18px">${[["principes", "Mijn spelprincipes", pr.length, "video"], ["oefeningen", "Mijn oefeningen", ex.length, "plan"], ["videoanalyse", "Videoanalyses", vp.length, "cam"]]
    .map(([h, l, c, i]) => `<a class="tile" href="#/${h}"><span class="ic">${IC[i] || IC.file}</span><span><b>${l}</b><small>${c} ${c === 1 ? "item" : "items"}</small></span></a>`).join("")}</div>
  <div class="op"><nav class="opnav" aria-label="Mappen">${folders.map(f => { const c = docs.filter(d => (d.folder || "Documenten") === f).length;
      return `<button type="button" data-f="${esc(f)}" aria-pressed="${f === opFolder}">${IC.folder}<span>${esc(f)}</span><b>${c || ""}</b></button>`; }).join("")}
    <button type="button" id="opnew" class="opadd">${IC.plus}<span>Nieuwe map</span></button><p class="hint" style="padding:8px 10px 0">${fmtSize(used) || "0 kB"} gebruikt · max. 50 MB per bestand</p></nav>
  <section class="opmain" id="opdrop"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">${esc(opFolder)}</h2><span class="spacer"></span><input id="opq" type="search" placeholder="Zoek in je opslag" value="${esc(opQ)}" style="width:min(240px,100%)">
    <button class="btn ghost small" type="button" id="oplink">${IC.plus}Link</button><button class="btn ghost small" type="button" id="opnote">${IC.plus}Notitie</button></div>
    <div id="opup"></div><div id="oplist"></div><div class="opdz" aria-hidden="true">Laat los om toe te voegen aan ${esc(opFolder)}</div></section></div>`;
  const list = () => { const q = opQ.trim().toLowerCase(), rows = docs.filter(d => q ? (d.title + " " + (d.file_name || "") + " " + (d.data?.text || "")).toLowerCase().includes(q) : (d.folder || "Documenten") === opFolder);
    $("#oplist").innerHTML = rows.length ? `<div class="list">${rows.map(r => `<div class="item static" data-id="${r.id}"><span class="num opic">${opIcon(r)}</span><span class="main"><b>${esc(r.title || r.file_name || "Zonder titel")}</b>
      <small>${[opKind(r), fmtSize(r.file_size), q ? r.folder || "Documenten" : "", new Date(r.updated_at).toLocaleDateString("nl-BE")].filter(Boolean).map(esc).join(" · ")}</small></span>
      <button class="btn ghost small" type="button" data-a="open">${r.file_path || r.data?.url ? "Openen" : "Lezen"}</button><button class="link" type="button" data-a="more" aria-label="Meer acties">•••</button></div>`).join("")}</div>`
      : `<div class="empty"><b>${q ? "Niets gevonden" : "Deze map is leeg"}</b>${q ? `Geen bestand bevat "${esc(opQ)}".` : "Sleep bestanden hierheen of gebruik Bestanden toevoegen. Ook pdf's, PowerPoints, foto's en video's."}</div>`;
    $$("#oplist [data-a]").forEach(b => b.onclick = () => opAction(docs.find(d => d.id === b.closest("[data-id]").dataset.id), b.dataset.a, folders)); };
  list();
  $$("[data-f]", v).forEach(b => b.onclick = () => { opFolder = b.dataset.f; opQ = ""; render(); });
  $("#opq").oninput = e => { opQ = e.target.value; list(); };
  $("#opnew").onclick = () => { const n = (prompt("Naam van de nieuwe map:", "") || "").trim().slice(0, 40); if (!n) return; if (!opExtra.includes(n)) opExtra.push(n); opFolder = n; render(); };
  const upload = async fl => { const arr = [...fl]; if (!arr.length) return; const box = $("#opup"); let ok = 0;
    for (const f of arr) { if (f.size > 50 * 1048576) { toast(`${f.name} is groter dan 50 MB.`); continue; }
      box.innerHTML = `<div class="panel row" style="margin-bottom:12px"><span class="spin"></span><span>Uploaden: ${esc(f.name)} (${fmtSize(f.size)})</span></div>`;
      const r = await safe(async () => { const path = await files.upload(f); return items.save({ kind: "document", title: f.name.replace(/\.[^.]+$/, ""), folder: opFolder, file_path: path, file_name: f.name, file_type: f.type, file_size: f.size, data: {} }); });
      if (r) ok++; }
    box.innerHTML = ""; if (ok) { toast(ok === 1 ? "Bestand toegevoegd." : ok + " bestanden toegevoegd."); render(); } };
  $("#opf").onchange = e => upload(e.target.files);
  const dz = $("#opdrop"); dz.ondragover = e => { e.preventDefault(); dz.classList.add("over"); }; dz.ondragleave = e => { if (!dz.contains(e.relatedTarget)) dz.classList.remove("over"); };
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove("over"); upload(e.dataTransfer.files); };
  $("#oplink").onclick = () => opTextForm({ kind: "document", folder: opFolder, title: "", data: { url: "" } });
  $("#opnote").onclick = () => opTextForm({ kind: "document", folder: opFolder, title: "", data: { text: "" } });
} });
function opTextForm(r) {
  const isLink = "url" in (r.data || {});
  const d = dialog(`<form class="dlg" method="dialog"><h2>${r.id ? "Bewerken" : isLink ? "Link toevoegen" : "Notitie"}</h2><div class="fields">
    <label class="f full">Titel<input name="title" required value="${esc(r.title)}" placeholder="${isLink ? "Bijvoorbeeld: YouTube-oefening rondo" : "Bijvoorbeeld: afspraken met de ouders"}"></label>
    ${isLink ? `<label class="f full">Adres (URL)<input name="url" type="url" required value="${esc(r.data.url)}" placeholder="https://"></label>` : `<label class="f full">Tekst<textarea name="text" rows="10">${esc(r.data.text || "")}</textarea></label>`}</div>
    <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Opslaan</button></div></form>`);
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); r.title = f.get("title").trim();
    if (isLink) { let u = f.get("url").trim(); if (!/^https?:\/\//i.test(u)) u = "https://" + u; r.data = { url: u }; } else r.data = { text: f.get("text") };
    if (await safe(() => items.save(r), "Opgeslagen.")) { d.close(); render(); } };
}
async function opAction(r, a, folders) {
  if (a === "open") {
    if (r.data?.url) { open(r.data.url, "_blank", "noopener"); return; }
    if (!r.file_path) { const d = dialog(`<div class="dlg"><h2>${esc(r.title)}</h2><div class="notetext">${esc(r.data?.text || "").replace(/\n/g, "<br>")}</div><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" id="ed">Bewerken</button><button class="btn" type="button" data-close>Sluiten</button></div></div>`);
      $("#ed", d).onclick = () => { d.close(); opTextForm(r); }; return; }
    const w = open("", "_blank"); try { const u = await files.url(r.file_path); if (w) w.location = u; else location.href = u; } catch (e) { w?.close(); toast("Openen lukt niet: " + (e.message || "")); } return;
  }
  const d = dialog(`<div class="dlg"><h2>${esc(r.title)}</h2><div class="fields"><label class="f full">Naam<input id="rn" value="${esc(r.title)}"></label>
    <label class="f full">Map<select id="mv">${folders.map(f => `<option${(r.folder || "Documenten") === f ? " selected" : ""}>${esc(f)}</option>`).join("")}</select></label></div>
    <div class="row">${r.file_path ? `<button class="btn ghost" type="button" id="dl">${IC.dl}Downloaden</button>` : !r.data?.url ? `<button class="btn ghost" type="button" id="ed">Tekst bewerken</button>` : `<button class="btn ghost" type="button" id="ed">Link bewerken</button>`}
    <button class="btn ghost danger" type="button" id="rm">${IC.trash}Verwijderen</button><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" type="button" id="ok">Bewaren</button></div></div>`);
  $("#ok", d).onclick = async () => { r.title = $("#rn", d).value.trim() || r.title; r.folder = $("#mv", d).value; if (await safe(() => items.save(r), "Bewaard.")) { d.close(); render(); } };
  const dl = $("#dl", d); if (dl) dl.onclick = async () => { try { const u = await files.url(r.file_path, r.file_name); const x = document.createElement("a"); x.href = u; x.download = r.file_name || ""; x.click(); } catch (e) { toast("Downloaden lukt niet."); } };
  const ed = $("#ed", d); if (ed) ed.onclick = () => { d.close(); opTextForm(r); };
  $("#rm", d).onclick = async e => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Zeker? Tik opnieuw"; return; }
    if (await safe(() => items.del(r), "Verwijderd.")) { d.close(); render(); } };
}

/* ============ Mijn spelprincipes ============ */
const PR_MOMENTS = [["1A", PRINC["1A"]], ["1B", PRINC["1B"]], ["2A", PRINC["2A"]], ["2B", PRINC["2B"]], ["3A", PRINC["3A"]], ["3B", PRINC["3B"]], ["SF", "Stilstaande fasen"], ["Basis", "Basisprincipes"]];
let prFmt = "alle";
async function myBoards() { /* borden uit het animatiebord: lokaal (zelfde website) en uit de cloud */
  const map = new Map(), add = b => { if (b && b.id && !map.has(b.id)) map.set(b.id, { id: b.id, name: b.name || "Bord", format: b.format || "", thumb: b.thumb || "", at: b.updatedAt || b.updated_at || "" }); };
  try { const k = mode === "demo" ? "tb_boards_v1" : "tb_boards_u_" + user.id; (JSON.parse(localStorage.getItem(k) || "[]") || []).forEach(add); } catch (e) {}
  if (mode !== "demo" && sb) { try { const { data } = await sb.from("boards").select("id,name,format,thumb,updated_at"); (data || []).forEach(add); } catch (e) {} }
  return [...map.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
route("principes", { title: "Mijn spelprincipes", auth: true, render: async (v, id) => {
  v.innerHTML = head("Mijn spelprincipes", "Laden…"); const [list, boards] = await Promise.all([items.list("principe"), myBoards()]);
  const thumb = p => { const b = boards.find(x => x.id === p.data.board_id); return p.data.poster || (b && b.thumb) || ""; };
  const fmts = [...new Set(list.map(p => p.data.format).filter(Boolean))].sort();
  const shown = list.filter(p => prFmt === "alle" || p.data.format === prFmt);
  v.innerHTML = head("Mijn spelprincipes", "Jouw eigen speelwijze: per principe een animatie uit het animatiebord of een video, met de kernpunten die je aan je spelers uitlegt. Alleen jij ziet ze.",
    `<a class="btn ghost" href="#/animatiebord">${IC.board}Animatiebord</a><button class="btn" type="button" id="prnew">${IC.plus}Nieuw principe</button>`) +
    (list.length ? `${fmts.length > 1 ? `<div class="chips" style="margin-bottom:8px">${["alle", ...fmts].map(f => `<button class="chip" type="button" data-fm="${f}" aria-pressed="${prFmt === f}">${f === "alle" ? "Alle" : f}</button>`).join("")}</div>` : ""}` +
      PR_MOMENTS.map(([m, n]) => { const x = shown.filter(p => (p.data.moment || "Basis") === m); return x.length ? `<div class="sec"><h2>${m.length === 2 && m !== "SF" ? m + " · " : ""}${n}</h2><div class="cards">${x.map(p => { const t = thumb(p);
        return `<button class="tr" type="button" data-p="${p.id}"><span class="pic"${t ? ` style="background-image:url('${esc(t)}')"` : ""}>${t ? "" : `<span class="noimg">${IC.board}</span>`}${p.data.format ? `<span class="code">${esc(p.data.format)}</span>` : ""}</span><span class="body"><h3>${esc(p.title)}</h3><p>${esc((p.data.kern || [])[0] || "")}</p><span class="tags">${[p.data.board_id ? "Animatie" : "", p.data.video_url || p.file_path ? "Video" : "", (p.data.kern || []).length ? (p.data.kern.length + " kernpunten") : ""].filter(Boolean).map(t => `<span>${t}</span>`).join("")}</span></span></button>`; }).join("")}</div></div>` : ""; }).join("")
    : `<div class="panel" style="max-width:760px"><h2 style="margin-top:0">Zo maak je je spelprincipes</h2><ol class="steps"><li><b>Teken het principe in het animatiebord.</b> Zet spelers, bal en looplijnen per stap, bijvoorbeeld de opbouw met een uitzakkende 4.</li>
      <li><b>Maak hier een principe aan</b> en koppel het bord. Een eigen video kan ook.</li><li><b>Schrijf 2 tot 4 kernpunten</b> in de woorden die je ook op training gebruikt.</li></ol>
      <div class="row"><a class="btn ghost" href="#/animatiebord">${IC.board}Naar het animatiebord</a><button class="btn" type="button" id="prnew2">${IC.plus}Eerste principe maken</button></div></div>`);
  const nw = () => prForm({ kind: "principe", title: "", data: { format: S.team?.format || "8v8", moment: "1A", kern: [] } }, boards);
  $("#prnew").onclick = nw; const n2 = $("#prnew2"); if (n2) n2.onclick = nw;
  $$("[data-fm]", v).forEach(b => b.onclick = () => { prFmt = b.dataset.fm; render(); });
  $$("[data-p]", v).forEach(b => b.onclick = () => prShow(list.find(p => p.id === b.dataset.p), boards));
  if (id) { const p = list.find(x => x.id === id); if (p) prShow(p, boards); }
} });
async function prShow(p, boards) {
  const b = boards.find(x => x.id === p.data.board_id), src = p.file_path || p.data.video_url;
  let url = null; if (src) { try { url = await files.url(src); } catch (e) {} }
  const media = url ? `<video src="${esc(url)}"${p.data.poster ? ` poster="${esc(p.data.poster)}"` : ""} controls autoplay muted loop playsinline></video>` : b?.thumb ? `<img src="${esc(b.thumb)}" alt="Animatie ${esc(p.title)}">` : `<div class="noimg big">${IC.board}</div>`;
  const d = dialog(`<div class="dlgv"><div class="media">${media}</div><div class="info"><h2>${esc(p.title)}</h2><p class="muted" style="margin:0">${esc([p.data.format, PRINC[p.data.moment] ? p.data.moment + " " + PRINC[p.data.moment] : (PR_MOMENTS.find(m => m[0] === p.data.moment) || [])[1]].filter(Boolean).join(" · "))}</p>
    ${(p.data.kern || []).length ? `<h3 style="margin:8px 0 0">Kernpunten</h3><ul class="kern">${p.data.kern.map(k => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}${p.data.coach ? `<h3 style="margin:8px 0 0">Coachwoorden</h3><p style="margin:0">${esc(p.data.coach)}</p>` : ""}
    <div class="row" style="margin-top:auto">${b ? `<a class="btn" href="#/animatiebord/${encodeURIComponent(b.id)}">${IC.board}Animatie openen</a>` : ""}${url ? `<a class="btn ghost" href="${esc(url)}" download>${IC.dl}Video</a>` : ""}<button class="btn ghost" type="button" id="pred">${IC.pen}Bewerken</button></div></div></div>
    <button class="xbtn" type="button" data-close aria-label="Sluiten">${IC.x}</button>`, "wide");
  d.style.position = "relative"; $$("a", d).forEach(a => a.addEventListener("click", () => d.close()));
  $("#pred", d).onclick = () => { d.close(); prForm(p, boards); };
}
function prForm(p, boards) {
  p = { ...p, data: { ...p.data } }; let vidFile = null;
  const d = dialog(`<form class="dlg" method="dialog"><h2>${p.id ? "Principe bewerken" : "Nieuw spelprincipe"}</h2><div class="fields">
    <label class="f full">Titel<input name="title" required value="${esc(p.title)}" placeholder="Bijvoorbeeld: opbouw met uitzakkende 4"></label>
    <label class="f">Spelvorm<select name="format">${["2v2", "3v3", "5v5", "8v8", "11v11"].map(f => `<option${p.data.format === f ? " selected" : ""}>${f}</option>`).join("")}</select></label>
    <label class="f">Moment<select name="moment">${PR_MOMENTS.map(([m, n]) => `<option value="${m}"${p.data.moment === m ? " selected" : ""}>${m.length === 2 && m !== "SF" ? m + " " : ""}${n}</option>`).join("")}</select></label>
    <label class="f full">Kernpunten <span class="hint">één per regel</span><textarea name="kern" rows="5" placeholder="De 4 zakt uit tussen de centrale verdedigers.&#10;De back aan de balkant schuift hoger op.">${esc((p.data.kern || []).join("\n"))}</textarea></label>
    <label class="f full">Coachwoorden <span class="hint">optioneel</span><input name="coach" value="${esc(p.data.coach || "")}" placeholder="Bijvoorbeeld: breed! · zak! · vrije man!"></label></div>
    <h3 style="margin:4px 0 0">Animatie uit het animatiebord</h3>
    ${boards.length ? `<div class="bpick">${[{ id: "", name: "Geen bord" }, ...boards].map(b => `<label class="bp"><input type="radio" name="board" value="${esc(b.id)}"${(p.data.board_id || "") === b.id ? " checked" : ""}><span class="th"${b.thumb ? ` style="background-image:url('${esc(b.thumb)}')"` : ""}></span><span>${esc(b.name)}${b.format ? ` <small class="hint">${esc(b.format)}</small>` : ""}</span></label>`).join("")}</div>`
      : `<p class="hint" style="margin:0">Je hebt nog geen borden. Teken het principe eerst in het <a href="#/animatiebord">animatiebord</a> en koppel het daarna hier.</p>`}
    <h3 style="margin:4px 0 0">Video <span class="hint">optioneel</span></h3><div class="row">${p.file_path || p.data.video_url ? `<span class="pill t">Video gekoppeld</span><button class="link" type="button" id="vrm">Verwijderen</button>` : ""}
      <label class="btn ghost small" style="cursor:pointer">${IC.video}${p.file_path || p.data.video_url ? "Andere video" : "Video kiezen"}<input type="file" accept="video/*" id="pv" hidden></label><span class="hint" id="pvn"></span></div>
    <div class="row">${p.id ? `<button class="btn ghost danger" type="button" id="pdel">${IC.trash}Verwijderen</button>` : ""}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn" id="psave">Opslaan</button></div></form>`, "wide");
  $("#pv", d).onchange = e => { vidFile = e.target.files[0] || null; $("#pvn", d).textContent = vidFile ? `${vidFile.name} (${fmtSize(vidFile.size)})` : ""; };
  const rm = $("#vrm", d); if (rm) rm.onclick = () => { if (p.file_path) { files.remove(p.file_path).catch(() => {}); } p.file_path = null; p.file_name = null; p.file_type = null; p.file_size = null; delete p.data.video_url; delete p.data.poster; rm.previousElementSibling.remove(); rm.remove(); };
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target), btn = $("#psave", d);
    p.title = f.get("title").trim(); Object.assign(p.data, { format: f.get("format"), moment: f.get("moment"), coach: f.get("coach").trim(), kern: f.get("kern").split("\n").map(s => s.trim()).filter(Boolean), board_id: f.get("board") || null });
    btn.disabled = true; btn.textContent = vidFile ? "Video uploaden…" : "Opslaan…";
    const ok = await safe(async () => { if (vidFile) { if (vidFile.size > 50 * 1048576) throw new Error("De video is groter dan 50 MB."); const old = p.file_path; p.file_path = await files.upload(vidFile); p.file_name = vidFile.name; p.file_type = vidFile.type; p.file_size = vidFile.size; delete p.data.video_url; delete p.data.poster; if (old) files.remove(old).catch(() => {}); }
      return items.save(p); }, "Spelprincipe opgeslagen.");
    btn.disabled = false; btn.textContent = "Opslaan"; if (ok) { d.close(); render(); } };
  const del = $("#pdel", d); if (del) del.onclick = async e => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Zeker? Tik opnieuw"; return; } if (await safe(() => items.del(p), "Verwijderd.")) { d.close(); render(); } };
}

/* ============ Mixschema per trainer ============ */
let mxTab = "dagen", mxP = 0;
route("mixschema", { title: "Mixschema", auth: true, render: async (v, id) => {
  if (!id) { v.innerHTML = head("Mixschema", "Laden…"); const list = await items.list("mixschema");
    v.innerHTML = head("Mixschema", "Vul de namen in en de ploegen worden automatisch gemengd: iedereen speelt zo vaak mogelijk met iemand anders, met evenwichtige ploegen.", `<button class="btn" type="button" id="mxnew">${IC.plus}Nieuw mixschema</button>`) +
      (list.length ? `<div class="list">${list.map(m => `<div class="item" data-go="#/mixschema/${m.id}"><span class="num">${IC.rotate}</span><span class="main"><b>${esc(m.title)}</b><small>${(m.data.players || []).length} spelers · ${(m.data.days || []).length} speeldagen · ${m.data.teams || 2} ploegen</small></span>${IC.chev || ""}</div>`).join("")}</div>`
        : `<div class="empty"><b>Nog geen mixschema</b>Handig voor gemengde wedstrijden of trainingsploegjes waarin iedereen met iedereen samenspeelt.</div>`);
    $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
    $("#mxnew").onclick = async () => { const names = S.team ? active().map(p => ({ name: pname(p), group: "" })) : [];
      const r = await safe(() => items.save({ kind: "mixschema", title: S.team ? "Mixschema " + S.team.name : "Nieuw mixschema", data: { players: names, teams: 2, days: [], ndays: 12 } }));
      if (r) { mxTab = "namen"; go("#/mixschema/" + r.id); } };
    return; }
  const m = (await items.list("mixschema")).find(x => x.id === id);
  if (!m) { v.innerHTML = `<div class="empty"><b>Mixschema niet gevonden</b><a class="btn" href="#/mixschema">Terug</a></div>`; return; }
  const D = m.data; D.players = D.players || []; D.teams = D.teams || 2; D.ndays = D.ndays || D.days?.length || 12; D.days = D.days || [];
  if (!D.days.length && mxTab !== "namen") mxTab = "namen";
  const coll = new Intl.Collator("nl", { numeric: true }), nm = i => (D.players[i]?.name || "").trim() || "Speler " + (i + 1), srt = l => l.slice().sort((a, b) => coll.compare(nm(a), nm(b)));
  const save = msg => safe(() => items.save(m), msg); const saveLater = debounce(() => save(), 900);
  const COLS = ["w", "g", "t", "b"];
  const draw = () => {
    const stale = D.days.length && D.days[0].flat().length !== D.players.filter(p => p.name.trim()).length;
    let body = "";
    if (mxTab === "namen") body = `<div class="grid2"><div class="panel"><h2 style="margin-top:0">Spelers</h2><p class="hint" style="margin-top:0">Niveau A en B is optioneel: zo komen sterkere spelers evenwichtig over de ploegen. De letters zie je alleen hier, niet op de speeldagen.</p>
        <div class="mxrows">${D.players.map((p, i) => `<div class="mxrow"><input data-n="${i}" value="${esc(p.name)}" placeholder="Naam" aria-label="Naam speler ${i + 1}"><span class="seg">${["", "A", "B"].map(g => `<button type="button" data-g="${i}" data-gv="${g}" aria-pressed="${(p.group || "") === g}">${g || "–"}</button>`).join("")}</span><button class="link" type="button" data-rm="${i}" aria-label="Verwijderen">✕</button></div>`).join("")}</div>
        <div class="row" style="margin-top:10px"><button class="btn ghost small" type="button" id="mxadd">${IC.plus}Speler</button><button class="btn ghost small" type="button" id="mxpaste">Lijst plakken</button>${S.team ? `<button class="btn ghost small" type="button" id="mxteam">Uit ${esc(S.team.name)}</button>` : ""}</div></div>
      <div class="panel"><h2 style="margin-top:0">Instellingen</h2><div class="fields"><label class="f full">Naam van het schema<input id="mxt" value="${esc(m.title)}"></label>
        <label class="f">Aantal speeldagen<input id="mxd" type="number" min="1" max="40" value="${D.ndays}"></label><label class="f">Aantal ploegen<select id="mxk">${[2, 3, 4].map(k => `<option${D.teams === k ? " selected" : ""}>${k}</option>`).join("")}</select></label></div>
        <p class="hint">${D.players.filter(p => p.name.trim()).length} spelers: ${(() => { const n = D.players.filter(p => p.name.trim()).length, k = D.teams; return n < k * 2 ? "te weinig om te mengen." : `ploegen van ${Math.floor(n / k)}${n % k ? " of " + Math.ceil(n / k) : ""} spelers.`; })()}</p>
        <button class="btn" type="button" id="mxgo">${IC.rotate}${D.days.length ? "Opnieuw mixen" : "Mix maken"}</button>${D.days.length ? `<p class="hint">Opnieuw mixen maakt een volledig nieuw schema.</p>` : ""}</div></div>`;
    else if (mxTab === "dagen") body = `<div class="days">${D.days.map((d, k) => `<div class="day"><div class="h"><b>Speeldag ${k + 1}</b></div><div class="tm" style="grid-template-columns:repeat(${d.length},1fr)">${d.map((l, t) => `<div><span class="pill ${COLS[t]}">Ploeg ${t + 1}</span><ul>${srt(l).map(i => `<li>${esc(nm(i))}</li>`).join("")}</ul></div>`).join("")}</div></div>`).join("")}</div>`;
    else if (mxTab === "speler") { const pc = mixPairs(D);
      body = `<label class="f" style="max-width:320px">Speler<select id="ps">${srt([...D.players.keys()]).map(i => `<option value="${i}"${i === mxP ? " selected" : ""}>${esc(nm(i))}</option>`).join("")}</select></label>
      <div class="panel wrapx sec" style="padding:6px 12px"><table class="tbl"><thead><tr><th>Dag</th><th style="text-align:left">Ploeg</th><th style="text-align:left">Speelt samen met</th></tr></thead><tbody>${D.days.map((d, k) => { const t = d.findIndex(l => l.includes(mxP));
        return `<tr><td>${k + 1}</td><td style="text-align:left"><span class="pill ${COLS[t]}">Ploeg ${t + 1}</span></td><td style="text-align:left;white-space:normal" class="muted">${srt(d[t].filter(x => x !== mxP)).map(nm).map(esc).join(", ")}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="hint">${esc(nm(mxP))} speelt met ${pc[mxP].filter((c, j) => c > 0 && j !== mxP).length} van de ${D.players.length - 1} andere spelers minstens één keer samen.</p>`; }
    else { const pc = mixPairs(D), idx = srt([...D.players.keys()]), mx = Math.max(1, ...pc.flat());
      body = `<p class="hint" style="margin-top:0">Hoe vaak twee spelers in dezelfde ploeg zitten. Hoe gelijker de kleuren, hoe beter gemengd.</p><div class="panel wrapx" style="padding:10px"><table class="mxm"><thead><tr><th></th>${idx.map(i => `<th><span>${esc(nm(i))}</span></th>`).join("")}</tr></thead><tbody>${idx.map(i => `<tr><th>${esc(nm(i))}</th>${idx.map(j => i === j ? "<td class='self'></td>" : `<td style="--a:${(pc[i][j] / mx).toFixed(2)}">${pc[i][j]}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; }
    v.innerHTML = backLink("#/mixschema", "Mixschema's") + head(esc(m.title), `${D.players.length} spelers · ${D.days.length} speeldagen · ${D.teams} ploegen. Namen staan alfabetisch, zodat niemand ziet wie in groep A of B zit.`,
      `<button class="btn ghost" type="button" onclick="print()">${IC.print}Afdrukken</button><button class="btn ghost danger" type="button" id="mxdel">${IC.trash}</button>`) +
      (stale && mxTab !== "namen" ? `<div class="panel row" style="margin-bottom:12px;border-color:var(--yellow)"><span>De spelerslijst is gewijzigd sinds de laatste mix.</span><span class="spacer"></span><button class="btn small" type="button" id="mxre">Opnieuw mixen</button></div>` : "") +
      `<div class="ptabs" role="tablist">${[["namen", "Spelers en instellingen"], ["dagen", "Speeldagen"], ["speler", "Per speler"], ["matrix", "Samen gespeeld"]].map(([k, l]) => `<button type="button" role="tab" data-t="${k}" aria-selected="${mxTab === k}"${k !== "namen" && !D.days.length ? " disabled" : ""}>${l}</button>`).join("")}</div>` + body;
    $$("[data-t]", v).forEach(b => b.onclick = () => { mxTab = b.dataset.t; draw(); });
    const ps = $("#ps"); if (ps) ps.onchange = () => { mxP = +ps.value; draw(); };
    $$("[data-n]", v).forEach(i => i.oninput = () => { D.players[+i.dataset.n].name = i.value; saveLater(); });
    $$("[data-g]", v).forEach(b => b.onclick = () => { D.players[+b.dataset.g].group = b.dataset.gv; saveLater(); draw(); });
    $$("[data-rm]", v).forEach(b => b.onclick = () => { D.players.splice(+b.dataset.rm, 1); saveLater(); draw(); });
    const on = (s, f) => { const e = $(s); if (e) e.onclick = f; };
    on("#mxadd", () => { D.players.push({ name: "", group: "" }); draw(); $$("[data-n]").pop()?.focus(); });
    on("#mxteam", () => { const have = new Set(D.players.map(p => p.name.trim().toLowerCase())); active().forEach(p => { if (!have.has(pname(p).toLowerCase())) D.players.push({ name: pname(p), group: "" }); }); D.players = D.players.filter(p => p.name.trim()); saveLater(); draw(); });
    on("#mxpaste", () => { const t = prompt("Plak de namen, één per regel of gescheiden door komma's:", ""); if (!t) return; t.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).forEach(n => D.players.push({ name: n, group: "" })); D.players = D.players.filter(p => p.name.trim()); saveLater(); draw(); });
    const mix = async () => { D.players = D.players.filter(p => p.name.trim()); const n = D.players.length; if (n < D.teams * 2) { toast(`Je hebt minstens ${D.teams * 2} spelers nodig.`); return; }
      const r = mixMake(D.players, D.ndays, D.teams); D.days = r.days; mxTab = "dagen"; await save("Nieuw mixschema gemaakt."); draw(); };
    on("#mxgo", mix); on("#mxre", mix);
    const t = $("#mxt"); if (t) t.oninput = () => { m.title = t.value.trim() || "Mixschema"; saveLater(); };
    const dd = $("#mxd"); if (dd) dd.onchange = () => { D.ndays = Math.max(1, Math.min(40, +dd.value || 12)); saveLater(); };
    const kk = $("#mxk"); if (kk) kk.onchange = () => { D.teams = +kk.value; saveLater(); draw(); };
    on("#mxdel", async e => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = 1; b.innerHTML = "Zeker?"; return; } if (await safe(() => items.del(m), "Mixschema verwijderd.")) go("#/mixschema"); });
  };
  draw();
} });
