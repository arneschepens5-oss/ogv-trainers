/* OGV Platform — videoanalyse: tekenen op de clip (telestratie), bevriesmomenten, tags,
   beeld per beeld, export als video met tekeningen en als afbeelding. Projecten worden per trainer bewaard. */
"use strict";
const VA_COLORS = ["#FFD100", "#FFFFFF", "#EF4444", "#3B82F6", "#22C55E", "#111111"];
const VA_TRACKIC = `<svg class="i" viewBox="0 0 24 24" ${P}><circle cx="12" cy="9" r="3"/><path d="M12 2v2M12 14v2M5 9h2M17 9h2"/><ellipse cx="12" cy="19.5" rx="6" ry="2.2"/></svg>`;
const VA_POLYIC = `<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 17 8 5l9 2 3 9-9 4z"/></svg>`;
const VA_TOOLS = [["track", "Speler volgen: sleep vanaf de voeten van de speler, de app volgt hem automatisch", VA_TRACKIC], ["arrow", "Pass", IC.arrow], ["run", "Loopactie", IC.dash], ["pen", "Vrij tekenen", IC.pen], ["line", "Lijn", IC.line], ["circle", "Speler omcirkelen", IC.circle], ["spot", "Spotlight (vast beeld)", IC.spot],
  ["rect", "Zone", IC.rect], ["poly", "Vlak: tik de hoeken aan, dubbeltik of Enter om af te sluiten", VA_POLYIC], ["link", "Spelers verbinden", `<svg class="i" viewBox="0 0 24 24" ${P}><circle cx="5" cy="17" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="19" cy="15" r="2"/><path d="m6.5 15.5 4-7M13.5 8.5l4 5"/></svg>`],
  ["text", "Tekst", IC.text], ["erase", "Gum: tik op een tekening", IC.trash]];
const VA_TAGS = [["Goal", "#22C55E"], ["Kans", "#FFD100"], ["Balwinst", "#3B82F6"], ["Balverlies", "#EF4444"], ["Opbouw", "#A3A3A3"], ["Pressing", "#F97316"], ["Omschakeling", "#C084FC"], ["Stilstaande fase", "#14B8A6"]];
const vfmt = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), x = s - m * 60; return String(m).padStart(2, "0") + ":" + x.toFixed(1).padStart(4, "0"); };

/* ---------- tekenen op een canvas (gedeeld door scherm en export) ---------- */
function vaDrawShape(ctx, sh, W, H, preview) {
  const lw = Math.max(2, W * .0045), P2 = p => [p[0] * W, p[1] * H], c = sh.c || "#FFD100";
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
  else if (sh.k === "poly") { if (pts.length < 2) { ctx.restore(); return; } ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    ctx.globalAlpha = .24; ctx.fill(); ctx.globalAlpha = 1; ctx.setLineDash([lw * 2, lw * 1.4]); ctx.stroke(); ctx.setLineDash([]); }
  else if (sh.k === "rect") { if (pts.length < 2) { ctx.restore(); return; } const [a, b] = pts; ctx.globalAlpha = .22; ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    ctx.globalAlpha = 1; ctx.setLineDash([lw * 2, lw * 1.4]); ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); ctx.setLineDash([]); }
  else if (sh.k === "text" && pts.length) { const fs = Math.max(14, W * .026), p = pts[0]; ctx.shadowBlur = 0; ctx.font = `800 ${fs}px Archivo, Arial, sans-serif`; const tw = ctx.measureText(sh.text || "").width;
    ctx.fillStyle = "rgba(0,0,0,.72)"; const pad = fs * .35; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(p[0] - pad, p[1] - fs - pad * .6, tw + pad * 2, fs + pad * 1.6, fs * .3) : ctx.rect(p[0] - pad, p[1] - fs - pad * .6, tw + pad * 2, fs + pad * 1.6); ctx.fill();
    ctx.fillStyle = c === "#111111" ? "#FFD100" : c; ctx.fillText(sh.text || "", p[0], p[1]); }
  if (preview) { ctx.globalAlpha = 1; }
  ctx.restore();
}
function vaDist(sh, x, y) { /* afstand in genormaliseerde eenheden tot een vorm, voor de gum */
  const pts = sh.pts || []; if (!pts.length) return 9;
  if (sh.k === "poly" && pts.length > 2) { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } if (inside) return 0; }
  if (sh.k === "rect" && pts.length > 1) { const [a, b] = pts; if (x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]) && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1])) return 0; }
  if ((sh.k === "circle" || sh.k === "spot") && pts.length > 1) return Math.max(0, Math.hypot(x - pts[0][0], (y - pts[0][1]) * 2.6) - Math.abs(pts[1][0] - pts[0][0]));
  let best = 9; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[i + 1] || a; const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)); } return best;
}

/* ============ spelers volgen ============
   Een "volger" is een reeks posities [t, x, y] (x en y genormaliseerd, aan de voeten van de speler).
   Tijdens het afspelen en bij het exporteren wordt de positie tussen twee metingen geïnterpoleerd. */
const VA_TSTYLES = [["spot", "Spotlight"], ["ring", "Ring aan de voeten"], ["mark", "Pijltje boven het hoofd"]];
function vaTrackAt(tr, t) { const P = tr.pts; if (!P || !P.length) return null; if (t < P[0][0] - .05 || t > P[P.length - 1][0] + .05) return null;
  let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; }
  const a = P[lo], b = P[hi]; if (b[0] === a[0] || t <= a[0]) return [a[1], a[2]]; if (t >= b[0]) return [b[1], b[2]]; const f = (t - a[0]) / (b[0] - a[0]);
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
function vaDrawTracks(ctx, tracks, t, W, H) {
  const on = (tracks || []).map(tr => ({ tr, p: vaTrackAt(tr, t) })).filter(x => x.p && !x.tr.hidden); if (!on.length) return;
  const lw = Math.max(2, W * .0045);
  /* één donkere laag met een gat per spotlight, zodat meerdere spotlights samen kunnen */
  const spots = on.filter(x => (x.tr.style || "spot") === "spot");
  if (spots.length) { const o = document.createElement("canvas"); o.width = Math.ceil(W); o.height = Math.ceil(H); const c = o.getContext("2d");
    c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(0, 0, W, H); c.globalCompositeOperation = "destination-out";
    spots.forEach(({ tr, p }) => { const rx = (tr.r || .022) * W, x = p[0] * W, y = p[1] * H; c.beginPath(); c.ellipse(x, y - rx * 1.7, rx * 1.15, rx * 2.1, 0, 0, Math.PI * 2); c.fill(); });
    ctx.drawImage(o, 0, 0, W, H); }
  on.forEach(({ tr, p }) => { const c = tr.c || "#FFD100", rx = (tr.r || .022) * W, ry = rx * .36, x = p[0] * W, y = p[1] * H, st = tr.style || "spot";
    ctx.save(); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw * 1.1; ctx.lineCap = "round"; ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = lw * 1.2;
    if (tr.trail) { const seg = tr.pts.filter(q => q[0] <= t && q[0] >= t - (tr.trail === true ? 3 : tr.trail)); if (seg.length > 1) { ctx.save(); ctx.globalAlpha = .85; ctx.setLineDash([lw * 1.6, lw * 1.4]); ctx.beginPath(); seg.forEach((q, i) => i ? ctx.lineTo(q[1] * W, q[2] * H) : ctx.moveTo(q[1] * W, q[2] * H)); ctx.lineTo(x, y); ctx.stroke(); ctx.restore(); } }
    if (st === "spot") { const g = ctx.createLinearGradient(x, y - rx * 4.6, x, y); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.22)");
      ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - rx * .5, y - rx * 4.6); ctx.lineTo(x + rx * .5, y - rx * 4.6); ctx.lineTo(x + rx, y); ctx.lineTo(x - rx, y); ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (st === "spot" || st === "ring") { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = .25; ctx.fill(); ctx.globalAlpha = 1; }
    if (st === "mark") { const top = y - rx * 4.3, s2 = rx * .7; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x - s2, top - s2 * 1.3); ctx.lineTo(x + s2, top - s2 * 1.3); ctx.closePath(); ctx.fill(); }
    if (tr.name) { const fs = Math.max(13, W * .02), ty = y - rx * (st === "mark" ? 5.6 : 4.4); ctx.shadowBlur = 0; ctx.font = `800 ${fs}px Archivo, Arial, sans-serif`; const tw = ctx.measureText(tr.name).width, pad = fs * .35;
      ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2 - pad, ty - fs - pad * .5, tw + pad * 2, fs + pad * 1.4, fs * .3) : ctx.rect(x - tw / 2 - pad, ty - fs - pad * .5, tw + pad * 2, fs + pad * 1.4); ctx.fill();
      ctx.fillStyle = c === "#111111" ? "#FFD100" : c; ctx.textAlign = "center"; ctx.fillText(tr.name, x, ty); }
    ctx.restore(); }); }
/* volgen met genormaliseerde kruiscorrelatie op een verkleind beeld (rond de vorige plaats, met voorspelde beweging) */
function vaTracker(vid) {
  const TW = Math.min(960, vid.videoWidth || 960), TH = Math.round(TW * (vid.videoHeight || 540) / (vid.videoWidth || 960));
  const cv = document.createElement("canvas"); cv.width = TW; cv.height = TH; const cx = cv.getContext("2d", { willReadFrequently: true });
  let T = null, T0 = null, tw = 0, th = 0;
  const grab = () => cx.drawImage(vid, 0, 0, TW, TH);
  const patch = (img, iw, x0, y0) => { const a = new Float32Array(tw * th * 3); let k = 0, sum = 0;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const o = ((y0 + y) * iw + (x0 + x)) * 4; a[k++] = img[o]; a[k++] = img[o + 1]; a[k++] = img[o + 2]; }
    for (let i = 0; i < a.length; i++) sum += a[i]; const m = sum / a.length; let n = 0; for (let i = 0; i < a.length; i++) { a[i] -= m; n += a[i] * a[i]; } n = Math.sqrt(n) || 1; for (let i = 0; i < a.length; i++) a[i] /= n; return a; };
  /* gemiddelde kleur van een vak (shirt en broek tellen het zwaarst): verschil met de speler kost punten */
  let C0 = null;
  const colorOf = (img, iw, x0, y0) => { let r = 0, g = 0, b = 0, n = 0; const ya = Math.round(th * .2), yb = Math.round(th * .75);
    for (let y = ya; y < yb; y++) for (let x = Math.round(tw * .2); x < Math.round(tw * .8); x++) { const o = ((y0 + y) * iw + (x0 + x)) * 4; r += img[o]; g += img[o + 1]; b += img[o + 2]; n++; }
    return [r / n, g / n, b / n]; };
  const cdist = c => Math.hypot(c[0] - C0[0], c[1] - C0[1], c[2] - C0[2]) / 441.7;
  const ncc = (img, iw, x0, y0, tpl) => { let sum = 0, k = 0; const n = tw * th * 3;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const o = ((y0 + y) * iw + (x0 + x)) * 4; sum += img[o] + img[o + 1] + img[o + 2]; }
    const m = sum / n; let dot = 0, nn = 0;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const o = ((y0 + y) * iw + (x0 + x)) * 4; for (let c = 0; c < 3; c++) { const v = img[o + c] - m; dot += v * tpl[k++]; nn += v * v; } }
    return dot / (Math.sqrt(nn) || 1); };
  return {
    /* x, y = voeten (genormaliseerd), r = halve breedte van de speler (genormaliseerd t.o.v. de breedte) */
    start(x, y, r) { grab(); tw = Math.max(8, Math.min(70, Math.round(r * TW * 2.1))); th = Math.max(16, Math.min(160, Math.round(tw * 2.3)));
      const x0 = Math.round(x * TW - tw / 2), y0 = Math.round(y * TH - th + tw * .15);
      const bx = Math.max(0, Math.min(TW - tw, x0)), by = Math.max(0, Math.min(TH - th, y0)); const d = cx.getImageData(bx, by, tw, th).data; T = patch(d, tw, 0, 0); T0 = T.slice(); C0 = colorOf(d, tw, 0, 0); },
    step(x, y, vx, vy) { grab(); const px = x * TW + vx * TW, py = y * TH + vy * TH, R = Math.max(10, Math.round(tw * 1.3));
      const ox = Math.round(px - tw / 2), oy = Math.round(py - th + tw * .15);
      const sx = Math.max(0, ox - R), sy = Math.max(0, oy - R), ex = Math.min(TW - tw, ox + R), ey = Math.min(TH - th, oy + R); if (ex < sx || ey < sy) return null;
      const W2 = ex - sx + tw, H2 = ey - sy + th, img = cx.getImageData(sx, sy, W2, H2).data;
      /* gelijkenis met het uitzicht van de speler, min een straf voor afstand tot de voorspelde plaats: zo springt de volger niet naar een ploegmaat in hetzelfde shirt */
      const cxp = ox - sx, cyp = oy - sy;
      const look = (x0, y0) => .7 * ncc(img, W2, x0, y0, T) + .3 * ncc(img, W2, x0, y0, T0) - 2.2 * cdist(colorOf(img, W2, x0, y0));
      const score = (x0, y0) => look(x0, y0) - .45 * (((x0 - cxp) ** 2 + (y0 - cyp) ** 2) / (R * R));
      let best = -2, bx = 0, by = 0; for (let y0 = 0; y0 <= ey - sy; y0 += 2) for (let x0 = 0; x0 <= ex - sx; x0 += 2) { const v = score(x0, y0); if (v > best) { best = v; bx = x0; by = y0; } }
      for (let y0 = Math.max(0, by - 1); y0 <= Math.min(ey - sy, by + 1); y0++) for (let x0 = Math.max(0, bx - 1); x0 <= Math.min(ex - sx, bx + 1); x0++) { const v = score(x0, y0); if (v > best) { best = v; bx = x0; by = y0; } }
      if (best > .6) { const P2 = patch(img, W2, bx, by); for (let i = 0; i < T.length; i++) T[i] = T[i] * .85 + P2[i] * .15; let n = 0; for (let i = 0; i < T.length; i++) n += T[i] * T[i]; n = Math.sqrt(n) || 1; for (let i = 0; i < T.length; i++) T[i] /= n; }
      const raw = look(bx, by) + 2.2 * cdist(colorOf(img, W2, bx, by)) - 4 * Math.max(0, cdist(colorOf(img, W2, bx, by)) - .12);
      return { x: (sx + bx + tw / 2) / TW, y: (sy + by + th - tw * .15) / TH, score: raw }; } };
}
const vaSeek = (vid, t) => new Promise(res => { const done = () => { vid.removeEventListener("seeked", done); res(); }; vid.addEventListener("seeked", done); vid.currentTime = t; setTimeout(done, 1500); });

/* ---------- overzicht van analyses ---------- */
/* de analyses zelf openen in de aparte Videostudio (studio/) */
const studioUrl = id => "studio/" + (id && id !== "nieuw" ? "?p=" + encodeURIComponent(id) : "?new=1");
route("videoanalyse", { title: "Videoanalyse", auth: true, render: async (v, id) => {
  if (id) { v.innerHTML = `<div class="empty"><span class="spin"></span> Videostudio openen…</div>`; location.href = studioUrl(id); return; }
  v.innerHTML = head("Videoanalyse", "Laden…"); const list = await items.list("videoproject");
  const cnt = p => { const ms = p.data.moments || p.data.drawings || []; return `${ms.length} ${ms.length === 1 ? "moment" : "momenten"}${(p.data.tracks || []).length ? " · " + p.data.tracks.length + " gevolgd" : ""}${(p.data.tags || []).length ? " · " + p.data.tags.length + " tags" : ""}`; };
  v.innerHTML = head("Videoanalyse", "Analyseer wedstrijdbeelden in de Videostudio: teken passes, loopacties en zones, laat de video bevriezen en inzoomen, volg spelers automatisch en exporteer een video voor je spelers.",
    `<a class="btn" href="${studioUrl()}">${IC.plus}Nieuwe analyse</a>`) +
    `<div class="grid2">${[["Tekenen als op tv", "Passes met curve, loopacties, dribbels, ringen, spotlights, zones, linies, nummers, tekst en een vergrootglas. Alles achteraf aan te passen.", "pen"],
      ["Bevriezen en inzoomen", "Op elk moment stopt het beeld, zoomt het in op wat telt en verschijnen je tekeningen één voor één.", "eye"],
      ["Spelers automatisch volgen", "Zet een spotlight of naam op een speler: de studio volgt hem door de video.", "spot"], ["Klaar om te delen", "Exporteer als mp4 met titelkaart, of een beeld als afbeelding.", "dl"]]
      .map(([b, s, i]) => `<div class="tile" style="cursor:default"><span class="ic">${IC[i] || IC.video}</span><span><b>${b}</b><small>${s}</small></span></div>`).join("")}</div>
    <div class="sec"><h2>Mijn analyses</h2>${list.length ? `<div class="list">${list.map(p => `<a class="item" href="${studioUrl(p.id)}"><span class="num">${IC.video}</span><span class="main"><b>${esc(p.title)}</b><small>${esc(p.data.file_name || "")} · ${cnt(p)}</small></span>${IC.chev}</a>`).join("")}</div>`
      : `<div class="empty"><b>Nog geen analyses</b>Start een nieuwe analyse met een clip van je toestel of uit je opslag.</div>`}</div>`;
  $$("[data-go]", v).forEach(x => x.onclick = () => go(x.dataset.go));
} });

/* ---------- de editor ---------- */
async function vaEditor(v, id) {
  let proj = id === "nieuw" ? { id: null, kind: "videoproject", title: "Nieuwe analyse", data: { drawings: [], tags: [], file_name: "", file_path: null } }
    : (await items.list("videoproject")).find(x => x.id === id);
  if (!proj) { v.innerHTML = `<div class="empty"><b>Analyse niet gevonden</b><a class="btn" href="#/videoanalyse">Terug</a></div>`; return; }
  const D = proj.data; D.drawings = D.drawings || []; D.tags = D.tags || []; D.tracks = D.tracks || []; vaEditor.cur = D;
  let tool = "arrow", color = "#FFD100", active = null, drawing = null, freeze = true, holdUntil = 0, lastT = 0, dirty = false, objUrl = null, exporting = false;
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
  <aside class="vaside"><div class="ptabs" role="tablist"><button type="button" role="tab" data-p="track" aria-selected="false">Volgen</button><button type="button" role="tab" data-p="draw" aria-selected="true">Tekeningen</button><button type="button" role="tab" data-p="tags" aria-selected="false">Momenten</button><button type="button" role="tab" data-p="exp" aria-selected="false">Exporteren</button></div><div id="vpanel"></div></aside></div>`;
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
  function paint() { const b = box(); ctx.clearRect(0, 0, b.w, b.h); vaDrawTracks(ctx, D.tracks, vid.currentTime, b.w, b.h);
    const d = visibleDrawing(); if (d) d.shapes.forEach(sh => vaDrawShape(ctx, sh, b.w, b.h)); if (drawing) vaDrawShape(ctx, drawing.k === "track" ? { ...drawing, k: "spot" } : drawing, b.w, b.h, true);
    if (fixing) { ctx.save(); ctx.fillStyle = "rgba(255,209,0,.12)"; ctx.fillRect(0, 0, b.w, b.h); ctx.restore(); } }
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
  $("#vplay").onclick = () => { if (!vid.src || tracking) return; if (holdUntil) { holdUntil = 0; active = null; $("#vhold").hidden = true; vid.pause(); return; } if (vid.paused) { active = null; lastT = vid.currentTime; vid.play().catch(() => {}); } else vid.pause(); };
  $$("[data-step]", v).forEach(b => b.onclick = () => { vid.pause(); holdUntil = 0; active = null; $("#vhold").hidden = true; vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + +b.dataset.step)); });
  $("#vrate").onchange = e => vid.playbackRate = +e.target.value; $("#vfreeze").onchange = e => freeze = e.target.checked;
  $("#vtl").onclick = e => { if (!vid.duration || e.target.closest("[data-mk]")) return; const r = $("#vtl .track").getBoundingClientRect(); vid.pause(); holdUntil = 0; active = null; vid.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * vid.duration; };
  function drawMarks() { if (!vid.duration) { $("#vmarks").innerHTML = ""; return; }
    $("#vmarks").innerHTML = D.drawings.map(d => `<button type="button" class="mk dr" data-mk="${d.t}" style="left:${d.t / vid.duration * 100}%" title="Tekening op ${vfmt(d.t)}"></button>`).join("") +
      D.tracks.filter(tr => tr.pts.length > 1).map(tr => `<span class="mkrange" style="left:${tr.pts[0][0] / vid.duration * 100}%;width:${(tr.pts[tr.pts.length - 1][0] - tr.pts[0][0]) / vid.duration * 100}%;--c:${tr.c}" title="${esc(tr.name || "Gevolgde speler")}"></span>`).join("") +
      D.tags.map(g => `<button type="button" class="mk tg" data-mk="${g.t}" style="left:${g.t / vid.duration * 100}%;--c:${g.color}" title="${esc(g.label)} op ${vfmt(g.t)}"></button>`).join("");
    $$("[data-mk]", v).forEach(m => m.onclick = () => { vid.pause(); holdUntil = 0; active = null; vid.currentTime = +m.dataset.mk; }); }
  /* ---- tekenen ---- */
  $$("[data-t]", v).forEach(b => b.onclick = () => { tool = b.dataset.t; $$("[data-t]", v).forEach(x => x.setAttribute("aria-pressed", x === b)); finishLink(); });
  $$("[data-c]", v).forEach(b => b.onclick = () => { color = b.dataset.c; $$("[data-c]", v).forEach(x => x.setAttribute("aria-pressed", x === b)); });
  const npt = e => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
  const targetDrawing = () => { vid.pause(); holdUntil = 0; $("#vhold").hidden = true; const t = +vid.currentTime.toFixed(2); let d = near(t);
    if (!d) { d = { id: uid(), t, hold: 3, shapes: [] }; D.drawings.push(d); D.drawings.sort((a, b) => a.t - b.t); } active = null; return d; };
  let linkShape = null;
  const finishLink = () => { if (linkShape && linkShape.pts.length > (linkShape.k === "poly" ? 2 : 1)) { targetDrawing().shapes.push(linkShape); markDirty(); drawMarks(); panel(); } linkShape = null; drawing = null; };
  /* ---- volgen ---- */
  let tracking = null, fixing = null; /* fixing = id van de volger die je verbetert met een tik op de juiste plaats */
  async function runTrack(tr, fromT, x, y) {
    if (tracking) return; let trk; try { trk = vaTracker(vid); trk.start(x, y, tr.r || .022); } catch (e) { toast("Volgen lukt niet voor deze video (beveiligde bron). Laad de video van je toestel."); return; }
    vid.pause(); holdUntil = 0; active = null; tracking = { stop: false, tr };
    tr.pts = tr.pts.filter(q => q[0] < fromT - .001); tr.pts.push([+fromT.toFixed(3), x, y]);
    const hold = $("#vhold"); hold.hidden = false; hold.innerHTML = `<span id="trkmsg">Speler volgen…</span> <button type="button" class="btn small" id="trkstop" style="margin-left:8px">Stoppen</button>`;
    $("#trkstop").onclick = () => { if (tracking) tracking.stop = true; };
    const dt = 1 / 15, end = Math.min(vid.duration || 0, fromT + (tr.max || 30)); let t = fromT, px = x, py = y, vx = 0, vy = 0, low = 0, why = "";
    while (!tracking.stop) { t += dt; if (t > end) { why = t >= (vid.duration || 0) - dt ? "einde" : "max"; break; }
      await vaSeek(vid, t); const r = trk.step(px, py, vx, vy);
      /* even niet te zien (achter een andere speler)? dan tot 1 seconde verder op de voorspelde baan, daarna stoppen */
      if (!r || r.score < .42) { if (++low >= 15) { tr.pts.splice(tr.pts.length - (low - 1), low - 1); why = "kwijt"; break; }
        px += vx; py += vy; tr.pts.push([+t.toFixed(3), +px.toFixed(4), +py.toFixed(4)]); continue; } low = 0;
      vx = vx * .6 + (r.x - px) * .4; vy = vy * .6 + (r.y - py) * .4; px = r.x; py = r.y; tr.pts.push([+t.toFixed(3), +px.toFixed(4), +py.toFixed(4)]);
      const m = $("#trkmsg"); if (m) m.textContent = `Speler volgen… ${vfmt(t)}`; }
    if (tracking.stop) why = "stop";
    tracking = null; hold.hidden = true; hold.textContent = ""; markDirty(); drawMarks(); panel();
    const last = tr.pts[tr.pts.length - 1][0]; await vaSeek(vid, last);
    toast(why === "kwijt" ? `Speler kwijt na ${vfmt(last)}. Tik bij Volgen op "Verbeteren" en tik de speler aan om verder te volgen.` : why === "einde" ? "Gevolgd tot het einde van de video." : why === "max" ? "30 seconden gevolgd. Tik op \"Verder volgen\" om door te gaan." : `Gevolgd tot ${vfmt(last)}.`); }
  const startFix = id => { const tr = D.tracks.find(x => x.id === id); if (!tr) return; vid.pause(); holdUntil = 0; active = null; fixing = id; toast(`Tik op de voeten van ${tr.name || "de speler"} op dit beeld. De app volgt vanaf hier opnieuw.`); };
  cv.style.touchAction = "none";
  cv.onpointerdown = e => { if (!vid.src || exporting || tracking) return; const p = npt(e);
    if (fixing) { const tr = D.tracks.find(x => x.id === fixing); fixing = null; if (tr) runTrack(tr, vid.currentTime, p[0], p[1]); return; }
    if (tool === "erase") { const d = near(vid.currentTime); if (!d) return; let bi = -1, bd = .03; d.shapes.forEach((s, i) => { const dd = vaDist(s, p[0], p[1]); if (dd < bd) { bd = dd; bi = i; } });
      if (bi >= 0) { d.shapes.splice(bi, 1); if (!d.shapes.length) D.drawings.splice(D.drawings.indexOf(d), 1); markDirty(); drawMarks(); panel(); } return; }
    if (tool === "text") { const t = prompt("Tekst op het beeld:", ""); if (!t) return; targetDrawing().shapes.push({ k: "text", c: color, pts: [p], text: t.slice(0, 60) }); markDirty(); drawMarks(); panel(); return; }
    if (tool === "link" || tool === "poly") { vid.pause(); if (!linkShape || linkShape.k !== tool) linkShape = { k: tool, c: color, pts: [] }; linkShape.pts.push(p); drawing = linkShape; return; }
    if (tool === "track") vid.pause();
    drawing = { k: tool, c: color, pts: [p, p] }; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!drawing || tool === "link" || tool === "poly") return; const p = npt(e); if (tool === "pen") drawing.pts.push(p); else drawing.pts[1] = p; };
  cv.onpointerup = () => { if (!drawing || tool === "link" || tool === "poly") return; const s = drawing; drawing = null;
    if (s.k === "track") { const a = s.pts[0], b = s.pts[1], r = Math.max(.012, Math.min(.08, Math.abs(b[0] - a[0]) || .022));
      const tr = { id: uid(), name: "", c: s.c, style: "spot", trail: false, r, pts: [] }; D.tracks.push(tr); ptab = "track"; $$("[data-p]", v).forEach(x => x.setAttribute("aria-selected", x.dataset.p === "track"));
      runTrack(tr, vid.currentTime, a[0], a[1]); return; }
    const a = s.pts[0], b = s.pts[s.pts.length - 1]; if (s.k !== "pen" && Math.hypot(b[0] - a[0], b[1] - a[1]) < .01 && s.k !== "circle" && s.k !== "spot") return;
    if ((s.k === "circle" || s.k === "spot") && Math.hypot(b[0] - a[0], b[1] - a[1]) < .01) s.pts[1] = [a[0] + .035, a[1]];
    if (s.k === "pen") s.pts = s.pts.filter((p, i) => i % 2 === 0 || i === s.pts.length - 1);
    targetDrawing().shapes.push(s); markDirty(); drawMarks(); panel(); };
  cv.ondblclick = () => finishLink();
  $("#vundo").onclick = () => { if (linkShape) { linkShape.pts.pop(); if (!linkShape.pts.length) { linkShape = null; drawing = null; } return; } const d = near(vid.currentTime) || D.drawings[D.drawings.length - 1]; if (!d) return; d.shapes.pop(); if (!d.shapes.length) D.drawings.splice(D.drawings.indexOf(d), 1); markDirty(); drawMarks(); panel(); };
  const keys = e => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || $("#dlg").open) return;
    if (tracking) { if (e.key === "Escape") tracking.stop = true; return; } if (fixing && e.key === "Escape") { fixing = null; return; }
    if (e.key === " ") { e.preventDefault(); $("#vplay").click(); } else if (e.key === "ArrowRight") { e.preventDefault(); vid.pause(); vid.currentTime += e.shiftKey ? 1 : .04; }
    else if (e.key === "ArrowLeft") { e.preventDefault(); vid.pause(); vid.currentTime -= e.shiftKey ? 1 : .04; } else if (e.key === "Enter" || e.key === "Escape") finishLink();
    else if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); $("#vundo").click(); } };
  document.addEventListener("keydown", keys);
  /* ---- zijpaneel ---- */
  let ptab = D.tracks.length ? "track" : "draw", clipIn = null, clipOut = null; $$("[data-p]", v).forEach(x => x.setAttribute("aria-selected", x.dataset.p === ptab));
  $$("[data-p]", v).forEach(b => b.onclick = () => { ptab = b.dataset.p; $$("[data-p]", v).forEach(x => x.setAttribute("aria-selected", x === b)); panel(); });
  function panel() { const pv = $("#vpanel");
    if (ptab === "track") { pv.innerHTML = `<p class="hint" style="margin-top:0">Kies <b>Speler volgen</b> (eerste knop) en sleep op het beeld vanaf de voeten van de speler opzij, zo breed als de speler. De app volgt hem automatisch. Klopt het ergens niet? Pauzeer daar, tik op <b>Verbeteren</b> en tik de speler aan.</p>` +
      (D.tracks.length ? `<div class="list">${D.tracks.map(tr => { const a = tr.pts[0]?.[0] ?? 0, b = tr.pts[tr.pts.length - 1]?.[0] ?? 0;
        return `<div class="item static vatr" style="flex-wrap:wrap;gap:6px"><span class="num" style="background:${tr.c};color:#111;border-color:${tr.c}">${tr.style === "mark" ? "▼" : tr.style === "ring" ? "◯" : "◉"}</span>
          <span class="main" style="min-width:140px"><input class="tname" data-tn="${tr.id}" value="${esc(tr.name || "")}" placeholder="Naam (bv. 7 Lars)" aria-label="Naam van de gevolgde speler" style="padding:6px 8px;width:100%"><small><button class="link" type="button" data-trgo="${a}">${vfmt(a)}</button> – <button class="link" type="button" data-trgo="${b}">${vfmt(b)}</button> · ${tr.pts.length} posities</small></span>
          <div class="row" style="gap:4px;width:100%"><select data-tst="${tr.id}" aria-label="Weergave" style="flex:1;min-width:0;padding:6px">${VA_TSTYLES.map(([k, l]) => `<option value="${k}"${(tr.style || "spot") === k ? " selected" : ""}>${l}</option>`).join("")}</select>
            <label class="check" style="font-size:13px"><input type="checkbox" data-ttr="${tr.id}"${tr.trail ? " checked" : ""}> Spoor</label>
            <label class="check" style="font-size:13px"><input type="checkbox" data-thd="${tr.id}"${tr.hidden ? "" : " checked"}> Tonen</label></div>
          <div class="row" style="gap:4px;width:100%"><button class="btn ghost small" type="button" data-tfix="${tr.id}">Verbeteren</button><button class="btn ghost small" type="button" data-tmore="${tr.id}">Verder volgen</button>
            <span class="row" style="gap:3px">${VA_COLORS.map(c => `<button type="button" class="tcol" data-tc="${tr.id}" data-col="${c}" style="--c:${c}" aria-label="Kleur ${c}" aria-pressed="${tr.c === c}"></button>`).join("")}</span><span class="spacer"></span><button class="link" type="button" data-tdel2="${tr.id}" aria-label="Volger verwijderen">✕</button></div></div>`; }).join("")}</div>`
        : `<div class="empty"><b>Nog niemand gevolgd</b>Pauzeer de video, kies Speler volgen en sleep vanaf de voeten van een speler.</div>`);
      const T = id => D.tracks.find(x => x.id === id);
      $$("[data-tn]", pv).forEach(i => i.oninput = () => { T(i.dataset.tn).name = i.value.slice(0, 24); markDirty(); });
      $$("[data-tst]", pv).forEach(i => i.onchange = () => { T(i.dataset.tst).style = i.value; markDirty(); panel(); });
      $$("[data-ttr]", pv).forEach(i => i.onchange = () => { T(i.dataset.ttr).trail = i.checked; markDirty(); });
      $$("[data-thd]", pv).forEach(i => i.onchange = () => { T(i.dataset.thd).hidden = !i.checked; markDirty(); });
      $$("[data-tc]", pv).forEach(b => b.onclick = () => { T(b.dataset.tc).c = b.dataset.col; markDirty(); panel(); });
      $$("[data-trgo]", pv).forEach(b => b.onclick = () => { vid.pause(); holdUntil = 0; active = null; vid.currentTime = +b.dataset.trgo; });
      $$("[data-tfix]", pv).forEach(b => b.onclick = () => startFix(b.dataset.tfix));
      $$("[data-tmore]", pv).forEach(b => b.onclick = async () => { const tr = T(b.dataset.tmore), l = tr.pts[tr.pts.length - 1]; if (!l) return; await vaSeek(vid, l[0]); runTrack(tr, l[0], l[1], l[2]); });
      $$("[data-tdel2]", pv).forEach(b => b.onclick = () => { if (!confirm("Deze volger verwijderen?")) return; D.tracks = D.tracks.filter(x => x.id !== b.dataset.tdel2); markDirty(); drawMarks(); panel(); }); }
    else if (ptab === "draw") { pv.innerHTML = `<p class="hint" style="margin-top:0">Pauzeer op het juiste moment en teken op het beeld. Bij het afspelen bevriest de video daar zolang je kiest.</p>` + (D.drawings.length ? `<div class="list">${D.drawings.map(d => `<div class="item static"><button class="num" type="button" data-go-t="${d.t}" style="width:auto;padding:0 8px;cursor:pointer">${vfmt(d.t)}</button><span class="main"><b>${d.shapes.length} ${d.shapes.length === 1 ? "tekening" : "tekeningen"}</b><small>${[...new Set(d.shapes.map(s => (VA_TOOLS.find(x => x[0] === s.k) || [0, s.k])[1]))].join(", ")}</small></span>
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
      $("#xpng").onclick = () => vaSnapshot(vid, near(vid.currentTime), proj.title, D.tracks);
      $("#xvid").onclick = () => vaExport(vid, D, clipIn ?? 0, clipOut ?? vid.duration, proj.title, s => { exporting = s; });
      const up = $("#xup"); if (up) up.onclick = async () => { if (!vaFile) return; up.disabled = true; up.textContent = "Bezig met uploaden…";
        await safe(async () => { const path = await files.upload(vaFile); await items.save({ kind: "document", title: vaFile.name.replace(/\.[^.]+$/, ""), folder: "Video's", file_path: path, file_name: vaFile.name, file_type: vaFile.type, file_size: vaFile.size, data: {} });
          D.file_path = path; markDirty(); await save(); panel(); }, "Video bewaard in je opslag."); up.disabled = false; }; } }
  panel();
  /* ---- opslaan ---- */
  async function save() { proj.title = $("#vt").value.trim() || "Analyse"; const r = await safe(() => items.save(proj), "Analyse opgeslagen."); if (r) { dirty = false; $("#vsaved").textContent = ""; if (id === "nieuw") history.replaceState(null, "", "#/videoanalyse/" + proj.id); } }
  $("#vsave").onclick = save; $("#vt").oninput = markDirty;
  const leave = e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } }; addEventListener("beforeunload", leave);
  return () => { if (tracking) tracking.stop = true; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("keydown", keys); removeEventListener("beforeunload", leave); vid.pause(); if (dirty && D.drawings.length + D.tags.length) toast("Let op: de laatste wijzigingen aan de analyse zijn niet opgeslagen."); if (objUrl) setTimeout(() => URL.revokeObjectURL(objUrl), 60000); };
}
function vaSnapshot(vid, d, title, tracks) {
  if (!vid.videoWidth) { toast("Laad eerst een video."); return; }
  const c = document.createElement("canvas"); c.width = vid.videoWidth; c.height = vid.videoHeight; const x = c.getContext("2d");
  try { x.drawImage(vid, 0, 0, c.width, c.height); vaDrawTracks(x, tracks, vid.currentTime, c.width, c.height); (d?.shapes || []).forEach(s => vaDrawShape(x, s, c.width, c.height));
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
  const frame = () => { x.drawImage(vid, 0, 0, c.width, c.height); vaDrawTracks(x, D.tracks, vid.currentTime, c.width, c.height); const d = shown || D.drawings.find(z => Math.abs(z.t - vid.currentTime) < .06 && (z.hold ?? 3) === 0); (d?.shapes || []).forEach(s => vaDrawShape(x, s, c.width, c.height)); };
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
