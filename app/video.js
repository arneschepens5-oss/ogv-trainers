/* OGV Platform — videoanalyse: tekenen op de clip (telestratie), bevriesmomenten, tags,
   beeld per beeld, export als video met tekeningen en als afbeelding. Projecten worden per trainer bewaard. */
"use strict";
const VA_COLORS = ["#FFD500", "#FFFFFF", "#EF4444", "#3B82F6", "#22C55E", "#111111"];
const VA_TOOLS = [["arrow", "Pass", IC.arrow], ["run", "Loopactie", IC.dash], ["pen", "Vrij tekenen", IC.pen], ["line", "Lijn", IC.line], ["circle", "Speler omcirkelen", IC.circle], ["spot", "Spotlight", IC.spot],
  ["rect", "Zone", IC.rect], ["link", "Spelers verbinden", `<svg class="i" viewBox="0 0 24 24" ${P}><circle cx="5" cy="17" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="19" cy="15" r="2"/><path d="m6.5 15.5 4-7M13.5 8.5l4 5"/></svg>`],
  ["text", "Tekst", IC.text], ["erase", "Gum: tik op een tekening", IC.trash]];
const VA_TAGS = [["Goal", "#22C55E"], ["Kans", "#FFD500"], ["Balwinst", "#3B82F6"], ["Balverlies", "#EF4444"], ["Opbouw", "#A3A3A3"], ["Pressing", "#F97316"], ["Omschakeling", "#C084FC"], ["Stilstaande fase", "#14B8A6"]];
const vfmt = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), x = s - m * 60; return String(m).padStart(2, "0") + ":" + x.toFixed(1).padStart(4, "0"); };

/* ---------- tekenen op een canvas (gedeeld door scherm en export) ---------- */
function vaDrawShape(ctx, sh, W, H, preview) {
  const lw = Math.max(2, W * .0045), P2 = p => [p[0] * W, p[1] * H], c = sh.c || "#FFD500";
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw;
  ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = lw * 1.2;
  const head = (a, b) => { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = lw * 4.2; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - L * Math.cos(ang - .45), b[1] - L * Math.sin(ang - .45)); ctx.lineTo(b[0] - L * Math.cos(ang + .45), b[1] - L * Math.sin(ang + .45)); ctx.closePath(); ctx.fill(); };
  const pts = (sh.pts || []).map(P2);
  if (sh.k === "arrow" || sh.k === "run" || sh.k === "line") { if (pts.length < 2) { ctx.restore(); return; } const [a, b] = [pts[0], pts[pts.length - 1]];
    if (sh.k === "run") ctx.setLineDash([lw * 2.4, lw * 1.8]);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), shorten = sh.k === "line" ? 0 : lw * 3;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0] - Math.cos(ang) * shorten, b[1] - Math.sin(ang) * shorten); ctx.stroke(); ctx.setLineDash([]); if (sh.k !== "line") head(a, b); }
  else if (sh.k === "pen") { if (pts.length < 2) { ctx.restore(); return; } ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
  else if (sh.k === "link") { ctx.setLineDash([lw * 1.4, lw * 1.2]); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
    pts.forEach(p => { ctx.beginPath(); ctx.ellipse(p[0], p[1], W * .018, W * .007, 0, 0, Math.PI * 2); ctx.stroke(); }); }
  else if (sh.k === "circle" || sh.k === "spot") { if (pts.length < 2) { ctx.restore(); return; } const [a, b] = pts, rx = Math.max(W * .012, Math.abs(b[0] - a[0])), ry = rx * .36;
    if (sh.k === "spot") { ctx.shadowBlur = 0; ctx.save(); ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.ellipse(a[0], a[1] - rx * 1.7, rx * 1.15, rx * 2.1, 0, 0, Math.PI * 2); ctx.fill("evenodd"); ctx.restore();
      const g = ctx.createLinearGradient(a[0], a[1] - rx * 4.6, a[0], a[1]); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.22)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a[0] - rx * .5, a[1] - rx * 4.6); ctx.lineTo(a[0] + rx * .5, a[1] - rx * 4.6); ctx.lineTo(a[0] + rx, a[1]); ctx.lineTo(a[0] - rx, a[1]); ctx.closePath(); ctx.fill(); }
    ctx.lineWidth = lw * 1.1; ctx.beginPath(); ctx.ellipse(a[0], a[1], rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = .25; ctx.beginPath(); ctx.ellipse(a[0], a[1], rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  else if (sh.k === "rect") { if (pts.length < 2) { ctx.restore(); return; } const [a, b] = pts; ctx.globalAlpha = .22; ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    ctx.globalAlpha = 1; ctx.setLineDash([lw * 2, lw * 1.4]); ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); ctx.setLineDash([]); }
  else if (sh.k === "text" && pts.length) { const fs = Math.max(14, W * .026), p = pts[0]; ctx.shadowBlur = 0; ctx.font = `800 ${fs}px Archivo, Arial, sans-serif`; const tw = ctx.measureText(sh.text || "").width;
    ctx.fillStyle = "rgba(0,0,0,.72)"; const pad = fs * .35; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(p[0] - pad, p[1] - fs - pad * .6, tw + pad * 2, fs + pad * 1.6, fs * .3) : ctx.rect(p[0] - pad, p[1] - fs - pad * .6, tw + pad * 2, fs + pad * 1.6); ctx.fill();
    ctx.fillStyle = c === "#111111" ? "#FFD500" : c; ctx.fillText(sh.text || "", p[0], p[1]); }
  if (preview) { ctx.globalAlpha = 1; }
  ctx.restore();
}
function vaDist(sh, x, y) { /* afstand in genormaliseerde eenheden tot een vorm, voor de gum */
  const pts = sh.pts || []; if (!pts.length) return 9;
  if (sh.k === "rect" && pts.length > 1) { const [a, b] = pts; if (x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]) && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1])) return 0; }
  if ((sh.k === "circle" || sh.k === "spot") && pts.length > 1) return Math.max(0, Math.hypot(x - pts[0][0], (y - pts[0][1]) * 2.6) - Math.abs(pts[1][0] - pts[0][0]));
  let best = 9; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[i + 1] || a; const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)); } return best;
}

/* ---------- overzicht van analyses ---------- */
route("videoanalyse", { title: "Videoanalyse", auth: true, render: async (v, id) => {
  if (id) return vaEditor(v, id);
  v.innerHTML = head("Videoanalyse", "Laden…"); const list = await items.list("videoproject");
  v.innerHTML = head("Videoanalyse", "Laad een clip, teken pijlen, looplijnen, zones en spotlights rechtstreeks op het beeld, zet momenten vast en exporteer het resultaat als video voor je spelers.",
    `<a class="btn" href="#/videoanalyse/nieuw">${IC.plus}Nieuwe analyse</a>`) +
    `<div class="grid3">${[["Teken op het beeld", "Pijlen, looplijnen, zones, spotlight op een speler, verbindingslijnen en tekst. Elke tekening bevriest het beeld op dat moment.", "pen"],
      ["Momenten taggen", "Markeer goals, kansen, balverlies of pressing en spring er met één tik naartoe.", "tag"], ["Delen met spelers", "Exporteer de clip met alle tekeningen als video, of een beeld als afbeelding.", "dl"]]
      .map(([b, s, i]) => `<div class="tile" style="cursor:default"><span class="ic">${IC[i]}</span><span><b>${b}</b><small>${s}</small></span></div>`).join("")}</div>
    <div class="sec"><h2>Mijn analyses</h2>${list.length ? `<div class="list">${list.map(p => `<div class="item" data-go="#/videoanalyse/${p.id}"><span class="num">${IC.video}</span><span class="main"><b>${esc(p.title)}</b><small>${esc(p.data.file_name || "")} · ${(n => n + (n === 1 ? " tekenmoment" : " tekenmomenten"))((p.data.drawings || []).length)} · ${(n => n + (n === 1 ? " moment" : " momenten"))((p.data.tags || []).length)} · ${new Date(p.updated_at).toLocaleDateString("nl-BE")}</small></span>${p.data.file_path ? '<span class="pill t">In mijn opslag</span>' : '<span class="pill g">Video op toestel</span>'}</div>`).join("")}</div>`
      : `<div class="empty"><b>Nog geen analyses</b>Start een nieuwe analyse met een clip van je toestel of uit je opslag.</div>`}</div>`;
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
} });

/* ---------- de editor ---------- */
async function vaEditor(v, id) {
  let proj = id === "nieuw" ? { id: null, kind: "videoproject", title: "Nieuwe analyse", data: { drawings: [], tags: [], file_name: "", file_path: null } }
    : (await items.list("videoproject")).find(x => x.id === id);
  if (!proj) { v.innerHTML = `<div class="empty"><b>Analyse niet gevonden</b><a class="btn" href="#/videoanalyse">Terug</a></div>`; return; }
  const D = proj.data; D.drawings = D.drawings || []; D.tags = D.tags || [];
  let tool = "arrow", color = "#FFD500", active = null, drawing = null, freeze = true, holdUntil = 0, lastT = 0, dirty = false, objUrl = null, exporting = false;
  v.innerHTML = backLink("#/videoanalyse", "Videoanalyse") + `<div class="ph"><div class="t"><input class="titlein" id="vt" value="${esc(proj.title)}" aria-label="Naam van de analyse"></div>
    <span class="hint" id="vsaved"></span><button class="btn" type="button" id="vsave">${IC.check}Opslaan</button></div>
  <div class="va"><div class="vamain">
    <div class="vatools" role="toolbar" aria-label="Tekengereedschap">${VA_TOOLS.map(([k, l, ic]) => `<button type="button" data-t="${k}" title="${l}" aria-label="${l}" aria-pressed="${k === tool}">${ic}</button>`).join("")}
      <span class="sep"></span>${VA_COLORS.map(c => `<button type="button" class="sw" data-c="${c}" style="--c:${c}" aria-label="Kleur ${c}" aria-pressed="${c === color}"></button>`).join("")}
      <span class="sep"></span><button type="button" id="vundo" title="Laatste tekening ongedaan maken" aria-label="Ongedaan maken">${IC.undo}</button></div>
    <div class="vastage" id="vstage"><video id="vv" playsinline preload="auto"></video><canvas id="vc"></canvas>
      <div class="vadrop" id="vdrop"><b>Kies een clip</b><span>Sleep een video hierheen of kies er een.</span><div class="row" style="justify-content:center"><label class="btn" style="cursor:pointer">${IC.video}Video van dit toestel<input type="file" accept="video/*" id="vfile" hidden></label><button class="btn ghost" type="button" id="vfromstore">${IC.folder}Uit mijn opslag</button></div></div>
      <div class="vahold" id="vhold" hidden></div></div>
    <div class="vactl"><button type="button" id="vplay" class="btn small" aria-label="Afspelen">${IC.play}</button>
      <button type="button" class="btn ghost small" data-step="-5" aria-label="5 seconden terug">−5s</button><button type="button" class="btn ghost small" data-step="-0.04" aria-label="Beeld terug">${IC.stepb}</button>
      <button type="button" class="btn ghost small" data-step="0.04" aria-label="Beeld vooruit">${IC.stepf}</button><button type="button" class="btn ghost small" data-step="5" aria-label="5 seconden vooruit">+5s</button>
      <span class="vtime" id="vtime">00:00.0 / 00:00.0</span><span class="spacer"></span>
      <select id="vrate" aria-label="Snelheid"><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="1.5">1,5×</option><option value="2">2×</option></select>
      <label class="check" style="font-size:13.5px"><input type="checkbox" id="vfreeze" checked> Stoppen bij tekeningen</label></div>
    <div class="vatl" id="vtl"><div class="track"><div class="prog" id="vprog"></div></div><div id="vmarks"></div></div>
  </div>
  <aside class="vaside"><div class="ptabs" role="tablist"><button type="button" role="tab" data-p="draw" aria-selected="true">Tekeningen</button><button type="button" role="tab" data-p="tags" aria-selected="false">Momenten</button><button type="button" role="tab" data-p="exp" aria-selected="false">Exporteren</button></div><div id="vpanel"></div></aside></div>`;
  const vid = $("#vv"), cv = $("#vc"), ctx = cv.getContext("2d"), stage = $("#vstage");
  const markDirty = () => { dirty = true; $("#vsaved").textContent = "Niet opgeslagen"; };
  /* ---- video laden ---- */
  const loadSrc = (src, name, path) => { if (objUrl && objUrl !== src) URL.revokeObjectURL(objUrl); if (src.startsWith("blob:")) objUrl = src;
    vid.crossOrigin = /^https?:/.test(src) ? "anonymous" : null; vid.src = src; vid.load(); D.file_name = name || D.file_name; if (path !== undefined) D.file_path = path; $("#vdrop").hidden = true;
    if (proj.title === "Nieuwe analyse" && name) { proj.title = name.replace(/\.[^.]+$/, ""); $("#vt").value = proj.title; } };
  $("#vfile").onchange = e => { const f = e.target.files[0]; if (!f) return; if (D.file_name && D.file_name !== f.name && D.drawings.length && !confirm(`Deze analyse hoort bij "${D.file_name}". Toch "${f.name}" laden?`)) return;
    loadSrc(URL.createObjectURL(f), f.name, D.file_path && D.file_name === f.name ? D.file_path : null); vaFile = f; markDirty(); };
  let vaFile = null;
  stage.ondragover = e => { e.preventDefault(); }; stage.ondrop = e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("video/")) { loadSrc(URL.createObjectURL(f), f.name, null); vaFile = f; markDirty(); } };
  $("#vfromstore").onclick = async () => { const docs = (await items.list("document")).filter(x => (x.file_type || "").startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(x.file_name || ""));
    const princ = (await items.list("principe")).filter(x => x.data.video_url || x.file_path);
    const all = [...docs.map(x => ({ t: x.title, path: x.file_path, name: x.file_name })), ...princ.map(x => ({ t: "Spelprincipe: " + x.title, path: x.file_path || x.data.video_url, name: x.file_name || x.title + ".mp4" }))];
    if (!all.length) { toast("Er staan nog geen video's in je opslag."); return; }
    const d = dialog(`<div class="dlg"><h2>Video uit mijn opslag</h2><div class="list">${all.map((x, i) => `<div class="item" data-i="${i}"><span class="num">${IC.video}</span><span class="main"><b>${esc(x.t)}</b><small>${esc(x.name || "")}</small></span></div>`).join("")}</div><div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button></div></div>`);
    $$("[data-i]", d).forEach(r => r.onclick = async () => { const x = all[+r.dataset.i]; d.close(); try { loadSrc(await files.url(x.path), x.name, x.path); markDirty(); } catch (e) { toast("Video openen lukt niet."); } }); };
  if (D.file_path) { try { loadSrc(await files.url(D.file_path), D.file_name, D.file_path); } catch (e) { toast("De video in je opslag kon niet geladen worden."); } }
  else if (D.file_name) { $("#vdrop b").textContent = `Kies opnieuw "${D.file_name}"`; $("#vdrop span").textContent = "Deze video staat alleen op het toestel waarmee je de analyse maakte."; }
  /* ---- canvas over het echte videobeeld leggen ---- */
  const box = () => { const r = stage.getBoundingClientRect(), vw = vid.videoWidth || 16, vh = vid.videoHeight || 9, s = Math.min(r.width / vw, r.height / vh);
    return { x: (r.width - vw * s) / 2, y: (r.height - vh * s) / 2, w: vw * s, h: vh * s }; };
  const fit = () => { const b = box(), dpr = Math.min(2, devicePixelRatio || 1); cv.style.left = b.x + "px"; cv.style.top = b.y + "px"; cv.style.width = b.w + "px"; cv.style.height = b.h + "px";
    cv.width = Math.round(b.w * dpr); cv.height = Math.round(b.h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paint(); };
  const ro = new ResizeObserver(fit); ro.observe(stage); vid.addEventListener("loadedmetadata", () => { fit(); drawMarks(); });
  const near = t => D.drawings.find(d => Math.abs(d.t - t) < .06);
  const visibleDrawing = () => { const t = vid.currentTime; if (active) return active; if (vid.paused) return near(t); return null; };
  function paint() { const b = box(); ctx.clearRect(0, 0, b.w, b.h); const d = visibleDrawing(); if (d) d.shapes.forEach(sh => vaDrawShape(ctx, sh, b.w, b.h)); if (drawing) vaDrawShape(ctx, drawing, b.w, b.h, true); }
  /* ---- afspelen met bevriesmomenten ---- */
  const tick = () => { const t = vid.currentTime;
    if (!vid.paused && freeze && !exporting) { const hit = D.drawings.find(d => d.t > lastT - .001 && d.t <= t + .02 && d.t >= lastT); if (hit) { vid.pause(); vid.currentTime = hit.t; active = hit; holdUntil = performance.now() + (hit.hold || 3) * 1000; $("#vhold").hidden = false; } }
    if (active && holdUntil && performance.now() >= holdUntil) { holdUntil = 0; $("#vhold").hidden = true; const a = active; active = null; lastT = a.t + .03; vid.currentTime = a.t + .03; vid.play().catch(() => {}); }
    if (active && holdUntil) $("#vhold").textContent = "Bevroren · nog " + Math.ceil((holdUntil - performance.now()) / 1000) + " s";
    lastT = Math.max(lastT, vid.paused ? lastT : t);
    $("#vtime").textContent = vfmt(t) + " / " + vfmt(vid.duration); $("#vprog").style.width = (vid.duration ? t / vid.duration * 100 : 0) + "%";
    $("#vplay").innerHTML = vid.paused && !holdUntil ? IC.play : IC.pause; paint(); raf = requestAnimationFrame(tick); };
  let raf = requestAnimationFrame(tick);
  vid.addEventListener("seeked", () => { if (!holdUntil) { lastT = vid.currentTime; } });
  $("#vplay").onclick = () => { if (!vid.src) return; if (holdUntil) { holdUntil = 0; active = null; $("#vhold").hidden = true; vid.pause(); return; } if (vid.paused) { active = null; lastT = vid.currentTime; vid.play().catch(() => {}); } else vid.pause(); };
  $$("[data-step]", v).forEach(b => b.onclick = () => { vid.pause(); holdUntil = 0; active = null; $("#vhold").hidden = true; vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + +b.dataset.step)); });
  $("#vrate").onchange = e => vid.playbackRate = +e.target.value; $("#vfreeze").onchange = e => freeze = e.target.checked;
  $("#vtl").onclick = e => { if (!vid.duration || e.target.closest("[data-mk]")) return; const r = $("#vtl .track").getBoundingClientRect(); vid.pause(); holdUntil = 0; active = null; vid.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * vid.duration; };
  function drawMarks() { if (!vid.duration) { $("#vmarks").innerHTML = ""; return; }
    $("#vmarks").innerHTML = D.drawings.map(d => `<button type="button" class="mk dr" data-mk="${d.t}" style="left:${d.t / vid.duration * 100}%" title="Tekening op ${vfmt(d.t)}"></button>`).join("") +
      D.tags.map(g => `<button type="button" class="mk tg" data-mk="${g.t}" style="left:${g.t / vid.duration * 100}%;--c:${g.color}" title="${esc(g.label)} op ${vfmt(g.t)}"></button>`).join("");
    $$("[data-mk]", v).forEach(m => m.onclick = () => { vid.pause(); holdUntil = 0; active = null; vid.currentTime = +m.dataset.mk; }); }
  /* ---- tekenen ---- */
  $$("[data-t]", v).forEach(b => b.onclick = () => { tool = b.dataset.t; $$("[data-t]", v).forEach(x => x.setAttribute("aria-pressed", x === b)); finishLink(); });
  $$("[data-c]", v).forEach(b => b.onclick = () => { color = b.dataset.c; $$("[data-c]", v).forEach(x => x.setAttribute("aria-pressed", x === b)); });
  const npt = e => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
  const targetDrawing = () => { vid.pause(); holdUntil = 0; $("#vhold").hidden = true; const t = +vid.currentTime.toFixed(2); let d = near(t);
    if (!d) { d = { id: uid(), t, hold: 3, shapes: [] }; D.drawings.push(d); D.drawings.sort((a, b) => a.t - b.t); } active = null; return d; };
  let linkShape = null;
  const finishLink = () => { if (linkShape && linkShape.pts.length > 1) { targetDrawing().shapes.push(linkShape); markDirty(); drawMarks(); panel(); } linkShape = null; drawing = null; };
  cv.style.touchAction = "none";
  cv.onpointerdown = e => { if (!vid.src || exporting) return; const p = npt(e);
    if (tool === "erase") { const d = near(vid.currentTime); if (!d) return; let bi = -1, bd = .03; d.shapes.forEach((s, i) => { const dd = vaDist(s, p[0], p[1]); if (dd < bd) { bd = dd; bi = i; } });
      if (bi >= 0) { d.shapes.splice(bi, 1); if (!d.shapes.length) D.drawings.splice(D.drawings.indexOf(d), 1); markDirty(); drawMarks(); panel(); } return; }
    if (tool === "text") { const t = prompt("Tekst op het beeld:", ""); if (!t) return; targetDrawing().shapes.push({ k: "text", c: color, pts: [p], text: t.slice(0, 60) }); markDirty(); drawMarks(); panel(); return; }
    if (tool === "link") { vid.pause(); if (!linkShape) linkShape = { k: "link", c: color, pts: [] }; linkShape.pts.push(p); drawing = linkShape; return; }
    drawing = { k: tool, c: color, pts: [p, p] }; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!drawing || tool === "link") return; const p = npt(e); if (tool === "pen") drawing.pts.push(p); else drawing.pts[1] = p; };
  cv.onpointerup = () => { if (!drawing || tool === "link") return; const s = drawing; drawing = null;
    const a = s.pts[0], b = s.pts[s.pts.length - 1]; if (s.k !== "pen" && Math.hypot(b[0] - a[0], b[1] - a[1]) < .01 && s.k !== "circle" && s.k !== "spot") return;
    if ((s.k === "circle" || s.k === "spot") && Math.hypot(b[0] - a[0], b[1] - a[1]) < .01) s.pts[1] = [a[0] + .035, a[1]];
    if (s.k === "pen") s.pts = s.pts.filter((p, i) => i % 2 === 0 || i === s.pts.length - 1);
    targetDrawing().shapes.push(s); markDirty(); drawMarks(); panel(); };
  cv.ondblclick = () => finishLink();
  $("#vundo").onclick = () => { if (linkShape) { linkShape.pts.pop(); if (!linkShape.pts.length) { linkShape = null; drawing = null; } return; } const d = near(vid.currentTime) || D.drawings[D.drawings.length - 1]; if (!d) return; d.shapes.pop(); if (!d.shapes.length) D.drawings.splice(D.drawings.indexOf(d), 1); markDirty(); drawMarks(); panel(); };
  const keys = e => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || $("#dlg").open) return;
    if (e.key === " ") { e.preventDefault(); $("#vplay").click(); } else if (e.key === "ArrowRight") { e.preventDefault(); vid.pause(); vid.currentTime += e.shiftKey ? 1 : .04; }
    else if (e.key === "ArrowLeft") { e.preventDefault(); vid.pause(); vid.currentTime -= e.shiftKey ? 1 : .04; } else if (e.key === "Enter" || e.key === "Escape") finishLink();
    else if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); $("#vundo").click(); } };
  document.addEventListener("keydown", keys);
  /* ---- zijpaneel ---- */
  let ptab = "draw", clipIn = null, clipOut = null;
  $$("[data-p]", v).forEach(b => b.onclick = () => { ptab = b.dataset.p; $$("[data-p]", v).forEach(x => x.setAttribute("aria-selected", x === b)); panel(); });
  function panel() { const pv = $("#vpanel");
    if (ptab === "draw") { pv.innerHTML = `<p class="hint" style="margin-top:0">Pauzeer op het juiste moment en teken op het beeld. Bij het afspelen bevriest de video daar zolang je kiest.</p>` + (D.drawings.length ? `<div class="list">${D.drawings.map(d => `<div class="item static"><button class="num" type="button" data-go-t="${d.t}" style="width:auto;padding:0 8px;cursor:pointer">${vfmt(d.t)}</button><span class="main"><b>${d.shapes.length} ${d.shapes.length === 1 ? "tekening" : "tekeningen"}</b><small>${[...new Set(d.shapes.map(s => (VA_TOOLS.find(x => x[0] === s.k) || [0, s.k])[1]))].join(", ")}</small></span>
      <label class="hint" style="display:flex;align-items:center;gap:4px">Bevries<select data-hold="${d.id}" style="width:66px;padding:4px">${[0, 1, 2, 3, 4, 5, 8, 10].map(n => `<option value="${n}"${(d.hold ?? 3) === n ? " selected" : ""}>${n}s</option>`).join("")}</select></label><button class="link" type="button" data-ddel="${d.id}" aria-label="Verwijderen">✕</button></div>`).join("")}</div>` : `<div class="empty"><b>Nog geen tekeningen</b>Kies een gereedschap en teken op het beeld.</div>`);
      $$("[data-go-t]", pv).forEach(b => b.onclick = () => { vid.pause(); holdUntil = 0; active = null; vid.currentTime = +b.dataset.goT; });
      $$("[data-hold]", pv).forEach(s => s.onchange = () => { D.drawings.find(d => d.id === s.dataset.hold).hold = +s.value; markDirty(); });
      $$("[data-ddel]", pv).forEach(b => b.onclick = () => { D.drawings = D.drawings.filter(d => d.id !== b.dataset.ddel); markDirty(); drawMarks(); panel(); }); }
    else if (ptab === "tags") { pv.innerHTML = `<p class="hint" style="margin-top:0">Tik tijdens het kijken op een moment om het op de tijdlijn te zetten.</p><div class="chips">${VA_TAGS.map(([l, c]) => `<button class="tag" type="button" data-tag="${l}" data-col="${c}" style="border-color:${c}">${l}</button>`).join("")}<button class="tag" type="button" id="tagOwn">${IC.plus.replace('class="i"', 'class="i" style="width:14px;height:14px"')}Eigen</button></div>
      ${D.tags.length ? `<div class="list" style="margin-top:12px">${D.tags.slice().sort((a, b) => a.t - b.t).map(g => `<div class="item static"><button class="num" type="button" data-go-t="${g.t}" style="width:auto;padding:0 8px;cursor:pointer;border-color:${g.color}">${vfmt(g.t)}</button><span class="main"><b>${esc(g.label)}</b>${g.note ? `<small>${esc(g.note)}</small>` : ""}</span><button class="link" type="button" data-tnote="${g.id}">Notitie</button><button class="link" type="button" data-tdel="${g.id}" aria-label="Verwijderen">✕</button></div>`).join("")}</div>` : ""}`;
      const addTag = (label, colr) => { if (!vid.src) return; D.tags.push({ id: uid(), t: +vid.currentTime.toFixed(2), label, color: colr }); markDirty(); drawMarks(); panel(); toast(label + " op " + vfmt(vid.currentTime)); };
      $$("[data-tag]", pv).forEach(b => b.onclick = () => addTag(b.dataset.tag, b.dataset.col));
      $("#tagOwn").onclick = () => { const l = prompt("Naam van het moment:", ""); if (l) addTag(l.slice(0, 30), "#E5E7EB"); };
      $$("[data-go-t]", pv).forEach(b => b.onclick = () => { vid.pause(); holdUntil = 0; active = null; vid.currentTime = +b.dataset.goT; });
      $$("[data-tnote]", pv).forEach(b => b.onclick = () => { const g = D.tags.find(x => x.id === b.dataset.tnote), n = prompt("Notitie bij " + g.label + ":", g.note || ""); if (n === null) return; g.note = n; markDirty(); panel(); });
      $$("[data-tdel]", pv).forEach(b => b.onclick = () => { D.tags = D.tags.filter(g => g.id !== b.dataset.tdel); markDirty(); drawMarks(); panel(); }); }
    else { pv.innerHTML = `<h3>Video met tekeningen</h3><p class="hint" style="margin-top:0">Het fragment wordt in echte tijd opgenomen, met de bevriesmomenten erbij. Laat het venster open tot het klaar is.</p>
      <div class="fields"><label class="f">Van<div class="row" style="gap:6px;flex-wrap:nowrap"><input id="xin" value="${clipIn != null ? vfmt(clipIn) : "begin"}" readonly><button class="btn ghost small" type="button" id="setIn">Nu</button></div></label>
      <label class="f">Tot<div class="row" style="gap:6px;flex-wrap:nowrap"><input id="xout" value="${clipOut != null ? vfmt(clipOut) : "einde"}" readonly><button class="btn ghost small" type="button" id="setOut">Nu</button></div></label></div>
      <div class="row" style="margin-top:12px"><button class="btn" type="button" id="xvid">${IC.dl}Video exporteren</button><button class="link" type="button" id="xreset">Hele video</button></div><div id="xprog" class="hint" style="margin-top:8px"></div>
      <h3 style="margin-top:20px">Afbeelding</h3><p class="hint" style="margin-top:0">Het huidige beeld met de tekening erop, bijvoorbeeld voor in WhatsApp of een presentatie.</p><button class="btn ghost" type="button" id="xpng">${IC.cam}Afbeelding opslaan</button>
      <h3 style="margin-top:20px">Video bewaren</h3><p class="hint" style="margin-top:0">${D.file_path ? "Deze video staat in je opslag. De analyse opent op elk toestel." : "De video staat nu alleen op dit toestel. Bewaar hem in je opslag om de analyse ook op andere toestellen te openen (max. 50 MB)."}</p>${D.file_path ? "" : `<button class="btn ghost" type="button" id="xup" ${vaFile ? "" : "disabled"}>${IC.up}In mijn opslag bewaren</button>`}`;
      $("#setIn").onclick = () => { clipIn = vid.currentTime; panel(); }; $("#setOut").onclick = () => { clipOut = vid.currentTime; panel(); }; $("#xreset").onclick = () => { clipIn = clipOut = null; panel(); };
      $("#xpng").onclick = () => vaSnapshot(vid, near(vid.currentTime), proj.title);
      $("#xvid").onclick = () => vaExport(vid, D, clipIn ?? 0, clipOut ?? vid.duration, proj.title, s => { exporting = s; });
      const up = $("#xup"); if (up) up.onclick = async () => { if (!vaFile) return; up.disabled = true; up.textContent = "Bezig met uploaden…";
        await safe(async () => { const path = await files.upload(vaFile); await items.save({ kind: "document", title: vaFile.name.replace(/\.[^.]+$/, ""), folder: "Video's", file_path: path, file_name: vaFile.name, file_type: vaFile.type, file_size: vaFile.size, data: {} });
          D.file_path = path; markDirty(); await save(); panel(); }, "Video bewaard in je opslag."); up.disabled = false; }; } }
  panel();
  /* ---- opslaan ---- */
  async function save() { proj.title = $("#vt").value.trim() || "Analyse"; const r = await safe(() => items.save(proj), "Analyse opgeslagen."); if (r) { dirty = false; $("#vsaved").textContent = ""; if (id === "nieuw") history.replaceState(null, "", "#/videoanalyse/" + proj.id); } }
  $("#vsave").onclick = save; $("#vt").oninput = markDirty;
  const leave = e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } }; addEventListener("beforeunload", leave);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("keydown", keys); removeEventListener("beforeunload", leave); vid.pause(); if (dirty && D.drawings.length + D.tags.length) toast("Let op: de laatste wijzigingen aan de analyse zijn niet opgeslagen."); if (objUrl) setTimeout(() => URL.revokeObjectURL(objUrl), 60000); };
}
function vaSnapshot(vid, d, title) {
  if (!vid.videoWidth) { toast("Laad eerst een video."); return; }
  const c = document.createElement("canvas"); c.width = vid.videoWidth; c.height = vid.videoHeight; const x = c.getContext("2d");
  try { x.drawImage(vid, 0, 0, c.width, c.height); (d?.shapes || []).forEach(s => vaDrawShape(x, s, c.width, c.height));
    c.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = (title || "analyse").replace(/[^\w-]+/g, "_") + "_" + vfmt(vid.currentTime).replace(/[:.]/g, "-") + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }, "image/png"); }
  catch (e) { toast("Afbeelding maken lukt niet voor deze video."); }
}
async function vaExport(vid, D, from, to, title, setBusy) {
  if (!vid.videoWidth) { toast("Laad eerst een video."); return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast("Video exporteren werkt niet in deze browser. Gebruik Chrome of Edge op een computer."); return; }
  const mime = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find(m => MediaRecorder.isTypeSupported(m)); if (!mime) { toast("Deze browser kan geen video opnemen."); return; }
  const sc = Math.min(1, 1280 / vid.videoWidth), c = document.createElement("canvas"); c.width = Math.round(vid.videoWidth * sc / 2) * 2; c.height = Math.round(vid.videoHeight * sc / 2) * 2; const x = c.getContext("2d");
  const stream = c.captureStream(30);
  try { const vs = vid.captureStream ? vid.captureStream() : vid.mozCaptureStream ? vid.mozCaptureStream() : null; vs?.getAudioTracks().forEach(t => stream.addTrack(t)); } catch (e) {}
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 }), chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const pr = $("#xprog"), btn = $("#xvid"); setBusy(true); btn.disabled = true;
  const holds = D.drawings.filter(d => d.t >= from && d.t <= to && (d.hold ?? 3) > 0).sort((a, b) => a.t - b.t), total = (to - from) + holds.reduce((s, d) => s + (d.hold ?? 3), 0);
  let shown = null, frozenUntil = 0, idx = 0, started = performance.now(), stop = false;
  const frame = () => { x.drawImage(vid, 0, 0, c.width, c.height); const d = shown || D.drawings.find(z => Math.abs(z.t - vid.currentTime) < .06 && (z.hold ?? 3) === 0); (d?.shapes || []).forEach(s => vaDrawShape(x, s, c.width, c.height)); };
  await new Promise(res => { vid.pause(); vid.currentTime = from; vid.addEventListener("seeked", res, { once: true }); });
  rec.start(200); vid.play().catch(() => {});
  await new Promise(res => { const loop = () => { if (stop) return res(); const now = performance.now();
    if (frozenUntil) { if (now >= frozenUntil) { frozenUntil = 0; shown = null; vid.play().catch(() => {}); } }
    else if (idx < holds.length && vid.currentTime >= holds[idx].t) { vid.pause(); shown = holds[idx]; frozenUntil = now + (holds[idx].hold ?? 3) * 1000; idx++; }
    if (!frozenUntil && (vid.currentTime >= to - .02 || vid.ended)) { stop = true; }
    frame(); pr.textContent = `Bezig met opnemen… ${Math.min(100, Math.round((now - started) / 10 / total))}%`; requestAnimationFrame(loop); }; loop(); });
  vid.pause(); await new Promise(r => { rec.onstop = r; rec.stop(); });
  const ext = mime.includes("mp4") ? "mp4" : "webm", blob = new Blob(chunks, { type: mime.split(";")[0] }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = (title || "analyse").replace(/[^\w-]+/g, "_") + "." + ext; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  pr.textContent = `Klaar: ${fmtSize(blob.size)} ${ext.toUpperCase()}.${ext === "webm" ? " Speelt af in Chrome, VLC en WhatsApp op Android." : ""}`; btn.disabled = false; setBusy(false);
}
