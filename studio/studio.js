/* =====================================================================
   OGV Videostudio — matchanalyse met tekeningen op het beeld
   Alles wordt op één canvas getekend (video + tekeningen + volgers), zodat wat je ziet
   exact is wat je exporteert. Coördinaten zijn genormaliseerd (0..1) op het videobeeld.
   ===================================================================== */
"use strict";
const SB_URL = "https://intswyovpwiigdwmgjfz.supabase.co", SB_KEY = "sb_publishable_mGTwxXL1HjKgnJcgSATtxQ_6CvHJ-3W", BUCKET = "trainer-files";
const LOCAL = /^(localhost|127\.|\[::1\])/.test(location.hostname);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Math.random().toString(36).slice(2) + Date.now().toString(36));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), x = s - m * 60; return String(m).padStart(2, "0") + ":" + x.toFixed(1).padStart(4, "0"); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const COLORS = ["#FFD100", "#FFFFFF", "#EF4444", "#3B82F6", "#22C55E", "#F97316", "#111111"];
const CNAME = { "#FFD100": "geel", "#FFFFFF": "wit", "#EF4444": "rood", "#3B82F6": "blauw", "#22C55E": "groen", "#F97316": "oranje", "#111111": "zwart" };
const WIDTHS = [[.75, "Dun"], [1, "Normaal"], [1.6, "Dik"]];
const TAGS = [["Goal", "#22C55E"], ["Kans", "#FFD100"], ["Balwinst", "#3B82F6"], ["Balverlies", "#EF4444"], ["Opbouw", "#A3A3A3"], ["Pressing", "#F97316"], ["Omschakeling", "#A855F7"], ["Stilstaande fase", "#14B8A6"]];
const FPS = 25, FRAME = 1 / FPS;

/* ---------- pictogrammen ---------- */
const I = {
  sel: '<path d="M5 3l14 8-6 2-2 6z"/>', pass: '<path d="M4 20 19 5"/><path d="M11 5h8v8"/>', run: '<path d="M4 20l3-3m3-3 2-2m3-3 4-4" /><path d="M12 5h7v7"/>',
  drib: '<path d="M3 18c2-3 3 2 5-1s3 2 5-1 3 2 4 0"/><path d="M15 9l4-4M14 5h5v5"/>', line: '<path d="M5 19 19 5"/>', pen: '<path d="M4 20c4-1 4-6 8-7s5-6 8-9"/>',
  ring: '<ellipse cx="12" cy="16" rx="8" ry="3.2"/><circle cx="12" cy="7" r="2.6"/>', spot: '<path d="M8 3h8l3 15H5z" opacity=".55"/><ellipse cx="12" cy="18.5" rx="7" ry="2.5"/>',
  badge: '<circle cx="12" cy="12" r="8"/><path d="M11 9l2-1v8"/>', text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', poly: '<path d="M4 17 8 5l9 2 3 9-9 4z"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>', link: '<circle cx="5" cy="17" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="19" cy="16" r="2"/><path d="M6.4 15.4 10.6 8.6M13.6 8.4l3.9 6"/>',
  lens: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20M8 10.5h5M10.5 8v5"/>', zoom: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  track: '<circle cx="12" cy="8" r="3"/><path d="M12 1.5v2M12 12.5v2M5.5 8h2M16.5 8h2"/><ellipse cx="12" cy="19.5" rx="6" ry="2.2"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>', pause: '<path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" fill="currentColor"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  snow: '<path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18"/>', eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>'
};
const ico = (k, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}">${I[k]}</svg>`;
const TOOLS = [
  ["sel", "Selecteren en verplaatsen", "V", "Klik op een tekening om ze te selecteren. Sleep de gele bolletjes om ze aan te passen."],
  ["pass", "Pass (pijl)", "P", "Sleep van de passgever naar de ontvanger. Trek nadien aan het middelste bolletje om de pijl te krommen."],
  ["run", "Loopactie (stippelpijl)", "R", "Sleep in de looprichting van de speler."],
  ["drib", "Dribbel (golvende pijl)", "D", "Sleep in de richting van de dribbel."],
  ["line", "Lijn", "L", "Sleep een rechte lijn, bv. de buitenspellijn of de lijn van de verdediging."],
  ["pen", "Vrij tekenen", "F", "Teken met de muis of je vinger."],
  ["ring", "Speler aanduiden (ring)", "O", "Sleep vanaf de voeten van de speler opzij, zo breed als de speler."],
  ["spot", "Spotlight op speler", "S", "Sleep vanaf de voeten van de speler opzij: de rest van het beeld wordt donkerder."],
  ["badge", "Rugnummer / stap", "N", "Tik om een genummerde cirkel te plaatsen. Het nummer telt vanzelf op."],
  ["text", "Tekst", "T", "Tik waar de tekst moet komen en typ."],
  ["poly", "Zone (vrije vorm)", "Z", "Tik de hoeken aan. Dubbeltik of druk Enter om af te sluiten."],
  ["rect", "Vak", "B", "Sleep een rechthoek."],
  ["link", "Spelers verbinden (linie)", "K", "Tik de spelers één voor één aan. Dubbeltik of Enter om af te sluiten."],
  ["lens", "Vergrootglas", "G", "Sleep vanuit het midden: dat stuk van het beeld wordt uitvergroot."],
  ["zoom", "Camera inzoomen op dit moment", "C", "Sleep een kader: bij het afspelen zoomt het beeld daar vloeiend op in tijdens het bevriezen."],
  ["track", "Spelers volgen (automatisch)", "Y", "Tik spelers aan om ze te volgen of te verbinden. Eerst nog Spelers herkennen bij Volgen."]
];
const TOOLMAP = Object.fromEntries(TOOLS.map(t => [t[0], t]));
const LINE_KINDS = new Set(["pass", "run", "drib", "line"]);
const KNAME = { pass: "Pass", run: "Loopactie", drib: "Dribbel", line: "Lijn", pen: "Vrije lijn", ring: "Ring", spot: "Spotlight", badge: "Nummer", text: "Tekst", poly: "Zone", rect: "Vak", link: "Linie", lens: "Vergrootglas" };

/* ---------- opslag: Supabase (aangemeld) of lokaal (om te testen) ---------- */
let sb = null, user = null, mode = "local";
const LKEY = "ogv-studio-local";
const store = {
  async init() {
    if (window.supabase?.createClient) {
      sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "implicit", storageKey: "tb_auth", lock: async (_n, _t, fn) => await fn() } });
      try { const { data } = await sb.auth.getSession(); user = data.session?.user || null; } catch (e) { user = null; }
    }
    mode = user ? "cloud" : "local";
  },
  _l() { try { return JSON.parse(localStorage.getItem(LKEY) || "{}"); } catch (e) { return {}; } },
  async get(id) { if (mode === "local") return this._l()[id] || null;
    const { data, error } = await sb.from("trainer_items").select("*").eq("id", id).maybeSingle(); if (error) throw error; return data; },
  async save(row) { row.updated_at = new Date().toISOString();
    if (mode === "local") { const l = this._l(); l[row.id] = row; try { localStorage.setItem(LKEY, JSON.stringify(l)); } catch (e) { throw new Error("Lokaal opslaan lukt niet (te groot)."); } return; }
    const { error } = await sb.from("trainer_items").upsert({ id: row.id, user_id: user.id, kind: "videoproject", title: row.title, data: row.data, updated_at: row.updated_at }, { onConflict: "id" }); if (error) throw error; },
  async videos() { if (mode === "local") return [];
    const { data } = await sb.from("trainer_items").select("id,kind,title,file_path,file_name,file_type,data").eq("user_id", user.id).in("kind", ["document", "principe"]);
    return (data || []).filter(x => (x.file_type || "").startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(x.file_name || "") || (x.kind === "principe" && (x.file_path || x.data?.video_url)))
      .map(x => ({ t: (x.kind === "principe" ? "Spelprincipe: " : "") + x.title, path: x.file_path || x.data?.video_url, name: x.file_name || x.title + ".mp4" })); },
  async url(path) { if (!path) return null; if (/^(https?:|blob:)/.test(path)) return path; if (mode === "local") return null;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 4 * 3600); if (error) throw error; return data.signedUrl; },
  async upload(file) { if (mode === "local") throw new Error("Meld je aan in OGV Trainers om video's in je opslag te bewaren.");
    if (file.size > 50 * 1048576) throw new Error("Deze video is groter dan 50 MB. Knip ze eerst korter (bv. alleen de fase die je wil tonen).");
    const name = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80), path = `${user.id}/${uid()}-${name}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || "video/mp4", upsert: false }); if (error) throw error;
    await sb.from("trainer_items").insert({ id: uid(), user_id: user.id, kind: "document", title: file.name.replace(/\.[^.]+$/, ""), folder: "Video", file_path: path, file_name: file.name, file_type: file.type || "video/mp4", file_size: file.size, data: {} });
    return path; }
};

/* ---------- gegevens van een analyse ---------- */
function migrateShape(s) {
  const p = s.pts || [];
  if (s.k === "arrow") return { id: uid(), k: "pass", c: s.c, w: 1, pts: [p[0], p[p.length - 1]] };
  if (s.k === "run" || s.k === "line") return { id: uid(), k: s.k, c: s.c, w: 1, pts: [p[0], p[p.length - 1]] };
  if (s.k === "circle" || s.k === "spot") return { id: uid(), k: s.k === "circle" ? "ring" : "spot", c: s.c, w: 1, pts: [p[0]], r: Math.max(.012, Math.abs((p[1] || p[0])[0] - p[0][0])) };
  return { id: uid(), w: 1, ...s };
}
function normData(d) {
  d = d || {}; d.v = 3;
  if (!Array.isArray(d.moments)) d.moments = (d.drawings || []).map(x => ({ id: uid(), t: x.t, hold: x.hold ?? 3, dur: 3, anim: true, zoom: null, shapes: (x.shapes || []).map(migrateShape) }));
  delete d.drawings;
  d.moments.forEach(m => { m.id = m.id || uid(); m.shapes = (m.shapes || []).map(s => ({ id: s.id || uid(), w: 1, ...s })); if (m.anim == null) m.anim = true; if (m.dur == null) m.dur = 3; });
  d.tracks = d.tracks || []; d.tags = d.tags || []; d.inout = d.inout || null; d.players = d.players || []; d.links = d.links || []; d.vis = d.vis || null;
  d.moments.sort((a, b) => a.t - b.t); return d;
}

/* =====================================================================
   TEKENEN
   ===================================================================== */
const quad = (a, q, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * q[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * q[1] + t * t * b[1]];
/* het pad van een lijnvorm in pixels (frame-ruimte), als reeks punten */
function linePath(sh, W, H) {
  const a = [sh.pts[0][0] * W, sh.pts[0][1] * H], b = [sh.pts[1][0] * W, sh.pts[1][1] * H];
  if (!sh.q) return [a, b];
  const q = [sh.q[0] * W, sh.q[1] * H], out = []; for (let i = 0; i <= 40; i++) out.push(quad(a, q, b, i / 40)); return out;
}
const plen = P => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
/* pad inkorten tot een fractie (animatie) of tot een lengte van het einde af (plaats voor de pijlpunt) */
function cutPath(P, frac, trimEnd = 0) {
  const L = plen(P), want = Math.max(0, L * frac - trimEnd); if (want <= 0) return [P[0], P[0]];
  const out = [P[0]]; let acc = 0;
  for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (acc + d >= want) { const f = (want - acc) / (d || 1); out.push([P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f]); return out; }
    acc += d; out.push(P[i]); }
  return out;
}
/* golvend pad voor een dribbel */
function wavy(P, amp, wl) {
  const L = plen(P); if (L < 4) return P; const out = []; let acc = 0, seg = 0, segAcc = 0; const step = Math.max(2, wl / 10);
  const total = L * .86;
  for (let s = 0; s <= L; s += step) {
    while (seg < P.length - 2 && segAcc + Math.hypot(P[seg + 1][0] - P[seg][0], P[seg + 1][1] - P[seg][1]) < s) { segAcc += Math.hypot(P[seg + 1][0] - P[seg][0], P[seg + 1][1] - P[seg][1]); seg++; }
    const A = P[seg], B = P[seg + 1] || A, d = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, f = (s - segAcc) / d;
    const x = A[0] + (B[0] - A[0]) * f, y = A[1] + (B[1] - A[1]) * f, nx = -(B[1] - A[1]) / d, ny = (B[0] - A[0]) / d;
    const k = s < total ? Math.sin(s / wl * Math.PI * 2) * amp * Math.min(1, s / (wl * .5)) : 0;
    out.push([x + nx * k, y + ny * k]); acc = s; }
  out.push(P[P.length - 1]); return out;
}
const stroke = (ctx, P) => { if (P.length < 2) return; ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.stroke(); };
function arrowHead(ctx, P, L) { if (P.length < 2) return; const b = P[P.length - 1]; let j = P.length - 2; while (j > 0 && Math.hypot(b[0] - P[j][0], b[1] - P[j][1]) < L * .6) j--;
  const a = P[j], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  ctx.beginPath(); ctx.moveTo(b[0] + Math.cos(ang) * L * .15, b[1] + Math.sin(ang) * L * .15); ctx.lineTo(b[0] - L * Math.cos(ang - .42), b[1] - L * Math.sin(ang - .42)); ctx.lineTo(b[0] - L * .62 * Math.cos(ang), b[1] - L * .62 * Math.sin(ang)); ctx.lineTo(b[0] - L * Math.cos(ang + .42), b[1] - L * Math.sin(ang + .42)); ctx.closePath(); ctx.fill(); }
const ink = c => c === "#111111" || c === "#FFFFFF" || c === "#FFD100" ? (c === "#111111" ? "#FFFFFF" : "#111111") : "#FFFFFF";
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

/* één vorm tekenen. W en H = grootte van het beeld in pixels; p = animatievoortgang 0..1; src = video (voor het vergrootglas) */
function drawShape(ctx, sh, W, H, p = 1, src = null) {
  if (p <= 0) return; const c = sh.c || "#FFD100", lw = Math.max(2, W * .0042) * (sh.w || 1), X = q => q[0] * W, Y = q => q[1] * H;
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw;
  ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = lw * 1.3; ctx.shadowOffsetY = lw * .25;
  const fade = Math.min(1, p * 1.6);
  if (LINE_KINDS.has(sh.k) && sh.pts?.length >= 2) {
    let P = linePath(sh, W, H), head = sh.k !== "line" || sh.head, L = lw * 4.4;
    P = cutPath(P, p, 0);
    if (sh.k === "drib") P = wavy(P, lw * 1.5, lw * 7);
    const body = head ? cutPath(P, 1, L * .55) : P;
    if (sh.k === "run") ctx.setLineDash([lw * 2.6, lw * 2]);
    stroke(ctx, body); ctx.setLineDash([]);
    if (head && plen(P) > L * .8) arrowHead(ctx, P, L);
  } else if (sh.k === "pen" && sh.pts?.length > 1) { stroke(ctx, cutPath(sh.pts.map(q => [X(q), Y(q)]), p)); }
  else if (sh.k === "ring" || sh.k === "spot") {
    const a = sh.pts[0], cx = X(a), cy = Y(a), rx = Math.max(6, (sh.r || .02) * W) * (sh.k === "ring" ? (.6 + .4 * ease(Math.min(1, p))) : 1), ry = rx * .36;
    if (sh.k === "spot") { /* licht van boven: donker rondom, licht op de speler */
      ctx.save(); ctx.shadowBlur = 0; ctx.globalAlpha = fade; ctx.fillStyle = "rgba(0,0,0,.58)"; ctx.beginPath(); ctx.rect(-W, -H, W * 3, H * 3); ctx.ellipse(cx, cy - rx * 1.75, rx * 1.2, rx * 2.15, 0, 0, Math.PI * 2); ctx.fill("evenodd");
      const g = ctx.createLinearGradient(cx, cy - rx * 4.8, cx, cy); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.2)"); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(cx - rx * .45, cy - rx * 4.8); ctx.lineTo(cx + rx * .45, cy - rx * 4.8); ctx.lineTo(cx + rx, cy); ctx.lineTo(cx - rx, cy); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.globalAlpha = fade; ctx.lineWidth = lw * 1.15; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = fade * .28; ctx.fill(); ctx.globalAlpha = fade;
    if (sh.label) labelAt(ctx, sh.label, cx, cy - rx * (sh.k === "spot" ? 4.9 : 4.2), W, c);
  } else if (sh.k === "badge") {
    const a = sh.pts[0], cx = X(a), cy = Y(a), R = Math.max(10, W * .016) * (sh.w || 1) * (.5 + .5 * ease(Math.min(1, p)));
    ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = Math.max(1.5, R * .12); ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.stroke();
    ctx.fillStyle = ink(c); ctx.font = `900 ${R * 1.15}px Archivo, Arial, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(sh.n ?? 1), cx, cy + R * .06);
  } else if (sh.k === "text") {
    const a = sh.pts[0], fs = Math.max(13, W * .024) * (sh.s || 1), txt = sh.text || "Tekst"; ctx.globalAlpha = fade; ctx.shadowBlur = 0;
    ctx.font = `800 ${fs}px Archivo, Arial, sans-serif`; const lines = txt.split("\n"), tw = Math.max(...lines.map(l => ctx.measureText(l).width)), pad = fs * .42, lh = fs * 1.2;
    const bx = X(a), by = Y(a), bw = tw + pad * 2, bh = lh * lines.length + pad * 1.1;
    ctx.fillStyle = sh.bg === "none" ? "rgba(0,0,0,0)" : sh.bg === "color" ? c : "rgba(0,0,0,.78)"; rr(ctx, bx, by, bw, bh, fs * .3); ctx.fill();
    if (sh.bg !== "color" && sh.bg !== "none") { ctx.fillStyle = c; ctx.fillRect(bx, by + fs * .3, Math.max(3, fs * .14), bh - fs * .6); }
    ctx.fillStyle = sh.bg === "color" ? ink(c) : (c === "#111111" ? "#FFFFFF" : sh.bg === "none" ? c : "#FFFFFF"); if (sh.bg === "none") { ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = fs * .3; }
    ctx.textBaseline = "top"; lines.forEach((l, i) => ctx.fillText(l, bx + pad + (sh.bg === "none" ? 0 : fs * .08), by + pad * .62 + i * lh));
  } else if ((sh.k === "poly" || sh.k === "link") && sh.pts?.length > 1) {
    const P = sh.pts.map(q => [X(q), Y(q)]);
    if (sh.k === "poly") { ctx.globalAlpha = fade * (sh.op ?? .28); ctx.beginPath(); P.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.shadowBlur = 0; ctx.fill(); ctx.globalAlpha = fade; ctx.shadowBlur = lw;
      ctx.setLineDash([lw * 2.2, lw * 1.5]); ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.globalAlpha = fade; const cut = cutPath(P, p); stroke(ctx, cut); P.forEach((q, i) => { if (i / (P.length - 1 || 1) > p + .001) return; ctx.beginPath(); ctx.ellipse(q[0], q[1], W * .017 * (sh.w || 1), W * .0065 * (sh.w || 1), 0, 0, Math.PI * 2); ctx.globalAlpha = fade * .3; ctx.fill(); ctx.globalAlpha = fade; ctx.stroke(); }); }
  } else if (sh.k === "rect" && sh.pts?.length > 1) {
    const [a, b] = sh.pts, x = Math.min(X(a), X(b)), y = Math.min(Y(a), Y(b)), w = Math.abs(X(b) - X(a)), h = Math.abs(Y(b) - Y(a));
    ctx.globalAlpha = fade * (sh.op ?? .26); ctx.shadowBlur = 0; ctx.fillRect(x, y, w, h); ctx.globalAlpha = fade; ctx.shadowBlur = lw; ctx.setLineDash([lw * 2.2, lw * 1.5]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  } else if (sh.k === "lens" && sh.pts?.length) {
    const a = sh.pts[0], cx = X(a), cy = Y(a), R = Math.max(14, (sh.r || .08) * W) * (.4 + .6 * ease(Math.min(1, p))), z = sh.z || 2.2;
    ctx.globalAlpha = fade;
    if (src && src.videoWidth) { const vw = src.videoWidth, vh = src.videoHeight, sw = (R * 2 / z) / W * vw, shh = (R * 2 / z) / H * vh;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip(); ctx.shadowBlur = 0;
      try { ctx.drawImage(src, a[0] * vw - sw / 2, a[1] * vh - shh / 2, sw, shh, cx - R, cy - R, R * 2, R * 2); } catch (e) {}
      ctx.restore(); }
    ctx.lineWidth = lw * 1.4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
function labelAt(ctx, txt, x, y, W, c) {
  const fs = Math.max(13, W * .019); ctx.save(); ctx.shadowBlur = 0; ctx.font = `800 ${fs}px Archivo, Arial, sans-serif`; const tw = ctx.measureText(txt).width, pad = fs * .38;
  ctx.fillStyle = "rgba(0,0,0,.8)"; rr(ctx, x - tw / 2 - pad, y - fs - pad * .6, tw + pad * 2, fs + pad * 1.5, fs * .3); ctx.fill();
  ctx.fillStyle = c === "#111111" ? "#FFD100" : c; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(txt, x, y); ctx.restore();
}

/* ---------- volgers (automatisch gevolgde spelers) ---------- */
function trackAt(tr, t) { const P = tr.pts; if (!P || !P.length) return null; if (t < P[0][0] - .05 || t > P[P.length - 1][0] + .05) return null;
  let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; }
  const a = P[lo], b = P[hi]; if (b[0] === a[0] || t <= a[0]) return [a[1], a[2], a[3] || 0]; if (t >= b[0]) return [b[1], b[2], b[3] || 0]; const f = (t - a[0]) / (b[0] - a[0]);
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * f]; }
/* positie van een herkende speler; bij een lange onderbreking (achter iemand anders) tonen we hem niet */
function playerAt(pl, t) { const P = pl.pts; if (!P.length || t < P[0][0] - .07 || t > P[P.length - 1][0] + .07) return null;
  let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= t) lo = m; else hi = m; } if (P[hi][0] - P[lo][0] > 1.3) return null; return trackAt(pl, t); }
const TSTYLES = [["spot", "Spotlight"], ["ring", "Ring"], ["mark", "Pijltje"], ["none", "Geen"]];
/* lijnen tussen gevolgde spelers: lijn (in volgorde), linie (rechtgetrokken langs de spelers) of zone (vlak ertussen) */
const LKIND = { line: "Lijn", linie: "Linie", zone: "Zone" };
function hull(P) { P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
function orderAlong(P) { if (P.length < 3) return P; const mx = P.reduce((s, p) => s + p[0], 0) / P.length, my = P.reduce((s, p) => s + p[1], 0) / P.length; let xx = 0, yy = 0, xy = 0;
  P.forEach(p => { const dx = p[0] - mx, dy = p[1] - my; xx += dx * dx; yy += dy * dy; xy += dx * dy; }); const ang = .5 * Math.atan2(2 * xy, xx - yy), ux = Math.cos(ang), uy = Math.sin(ang);
  return P.slice().sort((a, b) => (a[0] - mx) * ux + (a[1] - my) * uy - ((b[0] - mx) * ux + (b[1] - my) * uy)); }
function drawLinks(ctx, links, tracks, t, W, H) {
  (links || []).forEach(L => { const P = L.ids.map(id => tracks.find(x => x.id === id)).filter(tr => tr && !tr.hidden).map(tr => trackAt(tr, t)).filter(Boolean).map(p => [p[0] * W, p[1] * H]); if (P.length < 2) return;
    const c = L.c || "#FFD100", lw = Math.max(2, W * .0035) * (L.w || 1); ctx.save(); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = lw * 1.5;
    if (L.k === "zone" && P.length >= 3) { const Hh = hull(P); ctx.beginPath(); Hh.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.globalAlpha = .24; ctx.fill(); ctx.globalAlpha = 1; ctx.setLineDash([lw * 2.5, lw * 1.8]); ctx.stroke(); }
    else { const Q = L.k === "linie" ? orderAlong(P) : P; ctx.beginPath(); Q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      Q.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], lw * 1.6, 0, Math.PI * 2); ctx.fill(); }); }
    ctx.restore(); }); }
function drawTracks(ctx, tracks, t, W, H) {
  const on = (tracks || []).map(tr => ({ tr, p: trackAt(tr, t) })).filter(x => x.p && !x.tr.hidden); if (!on.length) return;
  const lw = Math.max(2, W * .0045), spots = on.filter(x => (x.tr.style || "spot") === "spot");
  if (spots.length) { ctx.save(); ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.rect(-W, -H, W * 3, H * 3);
    spots.forEach(({ tr, p }) => { const rx = p[2] ? p[2] * H * .34 : (tr.r || .022) * W, x = p[0] * W, y = p[1] * H; ctx.moveTo(x + rx * 1.15, y - rx * 1.7); ctx.ellipse(x, y - rx * 1.7, rx * 1.15, rx * 2.1, 0, 0, Math.PI * 2); });
    ctx.fill("evenodd"); ctx.restore(); }
  on.forEach(({ tr, p }) => { const c = tr.c || "#FFD100", rx = p[2] ? Math.max(W * .006, p[2] * H * .34) : (tr.r || .022) * W, ry = rx * .36, x = p[0] * W, y = p[1] * H, st = tr.style || "spot";
    ctx.save(); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw * 1.1; ctx.lineCap = "round"; ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = lw * 1.2;
    if (tr.trail) { const seg = tr.pts.filter(q => q[0] <= t && q[0] >= t - 3); if (seg.length > 1) { ctx.save(); ctx.globalAlpha = .85; ctx.setLineDash([lw * 1.6, lw * 1.4]); ctx.beginPath(); seg.forEach((q, i) => i ? ctx.lineTo(q[1] * W, q[2] * H) : ctx.moveTo(q[1] * W, q[2] * H)); ctx.lineTo(x, y); ctx.stroke(); ctx.restore(); } }
    if (st === "spot") { const g = ctx.createLinearGradient(x, y - rx * 4.6, x, y); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.22)");
      ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - rx * .5, y - rx * 4.6); ctx.lineTo(x + rx * .5, y - rx * 4.6); ctx.lineTo(x + rx, y); ctx.lineTo(x - rx, y); ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (st === "spot" || st === "ring") { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = .25; ctx.fill(); ctx.globalAlpha = 1; }
    if (st === "mark") { const top = y - (p[2] ? p[2] * H * 1.05 : rx * 4.3), s2 = rx * .7; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x - s2, top - s2 * 1.3); ctx.lineTo(x + s2, top - s2 * 1.3); ctx.closePath(); ctx.fill(); }
    if (st === "none" && !tr.name) { ctx.restore(); return; }
    if (tr.name) labelAt(ctx, tr.name, x, y - (p[2] ? p[2] * H * 1.12 : rx * 4.2) - (st === "mark" ? rx * 1.3 : 0), W, c);
    ctx.restore(); }); }

/* volgen met genormaliseerde kruiscorrelatie, kleur van het shirt en voorspelde beweging */
function makeTracker(vid) {
  const TW = Math.min(960, vid.videoWidth || 960), TH = Math.round(TW * (vid.videoHeight || 540) / (vid.videoWidth || 960));
  const cv = document.createElement("canvas"); cv.width = TW; cv.height = TH; const cx = cv.getContext("2d", { willReadFrequently: true });
  let T = null, T0 = null, tw = 0, th = 0, C0 = null;
  const grab = () => cx.drawImage(vid, 0, 0, TW, TH);
  const patch = (img, iw, x0, y0) => { const a = new Float32Array(tw * th * 3); let k = 0, sum = 0;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const o = ((y0 + y) * iw + (x0 + x)) * 4; a[k++] = img[o]; a[k++] = img[o + 1]; a[k++] = img[o + 2]; }
    for (let i = 0; i < a.length; i++) sum += a[i]; const m = sum / a.length; let n = 0; for (let i = 0; i < a.length; i++) { a[i] -= m; n += a[i] * a[i]; } n = Math.sqrt(n) || 1; for (let i = 0; i < a.length; i++) a[i] /= n; return a; };
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
    start(x, y, r) { grab(); tw = Math.max(8, Math.min(70, Math.round(r * TW * 2.1))); th = Math.max(16, Math.min(160, Math.round(tw * 2.3)));
      const x0 = Math.round(x * TW - tw / 2), y0 = Math.round(y * TH - th + tw * .15);
      const bx = Math.max(0, Math.min(TW - tw, x0)), by = Math.max(0, Math.min(TH - th, y0)); const d = cx.getImageData(bx, by, tw, th).data; T = patch(d, tw, 0, 0); T0 = T.slice(); C0 = colorOf(d, tw, 0, 0); },
    step(x, y, vx, vy) { grab(); const px = x * TW + vx * TW, py = y * TH + vy * TH, R = Math.max(10, Math.round(tw * 1.3));
      const ox = Math.round(px - tw / 2), oy = Math.round(py - th + tw * .15);
      const sx = Math.max(0, ox - R), sy = Math.max(0, oy - R), ex = Math.min(TW - tw, ox + R), ey = Math.min(TH - th, oy + R); if (ex < sx || ey < sy) return null;
      const W2 = ex - sx + tw, H2 = ey - sy + th, img = cx.getImageData(sx, sy, W2, H2).data, cxp = ox - sx, cyp = oy - sy;
      const look = (x0, y0) => .7 * ncc(img, W2, x0, y0, T) + .3 * ncc(img, W2, x0, y0, T0) - 2.2 * cdist(colorOf(img, W2, x0, y0));
      const score = (x0, y0) => look(x0, y0) - .45 * (((x0 - cxp) ** 2 + (y0 - cyp) ** 2) / (R * R));
      let best = -2, bx = 0, by = 0; for (let y0 = 0; y0 <= ey - sy; y0 += 2) for (let x0 = 0; x0 <= ex - sx; x0 += 2) { const v = score(x0, y0); if (v > best) { best = v; bx = x0; by = y0; } }
      for (let y0 = Math.max(0, by - 1); y0 <= Math.min(ey - sy, by + 1); y0++) for (let x0 = Math.max(0, bx - 1); x0 <= Math.min(ex - sx, bx + 1); x0++) { const v = score(x0, y0); if (v > best) { best = v; bx = x0; by = y0; } }
      if (best > .6) { const P2 = patch(img, W2, bx, by); for (let i = 0; i < T.length; i++) T[i] = T[i] * .85 + P2[i] * .15; let n = 0; for (let i = 0; i < T.length; i++) n += T[i] * T[i]; n = Math.sqrt(n) || 1; for (let i = 0; i < T.length; i++) T[i] /= n; }
      const cd = cdist(colorOf(img, W2, bx, by)), raw = look(bx, by) + 2.2 * cd - 4 * Math.max(0, cd - .12);
      return { x: (sx + bx + tw / 2) / TW, y: (sy + by + th - tw * .15) / TH, score: raw }; } };
}
const seekTo = (vid, t) => new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; vid.removeEventListener("seeked", fin); res(); }; vid.addEventListener("seeked", fin); vid.currentTime = t; setTimeout(fin, 1500); });

/* =====================================================================
   BEELD SAMENSTELLEN (scherm én export)
   view = zichtbaar deel van het beeld (camera), shapes = [{sh, p}]
   ===================================================================== */
function composeFrame(ctx, W, H, o) {
  const { vid, view = { x: 0, y: 0, w: 1, h: 1 }, shapes = [], t = 0, tracks = [], links = [] } = o;
  ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  if (vid && vid.videoWidth) { const vw = vid.videoWidth, vh = vid.videoHeight; try { ctx.drawImage(vid, view.x * vw, view.y * vh, view.w * vw, view.h * vh, 0, 0, W, H); } catch (e) {} }
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.translate(-view.x / view.w * W, -view.y / view.h * H); ctx.scale(1 / view.w, 1 / view.h);
  drawTracks(ctx, tracks, t, W, H);
  drawLinks(ctx, links, tracks, t, W, H);
  /* spotlights eerst (die maken het beeld donker), daarna de rest erover */
  shapes.filter(x => x.sh.k === "spot").forEach(x => drawShape(ctx, x.sh, W, H, x.p, vid));
  shapes.filter(x => x.sh.k !== "spot").forEach(x => drawShape(ctx, x.sh, W, H, x.p, vid));
  ctx.restore();
}
/* camera tijdens een bevroren moment: inzoomen, vasthouden, uitzoomen */
function camAt(m, el) {
  if (!m || !m.zoom) return { x: 0, y: 0, w: 1, h: 1 };
  const hold = m.hold || 3, tin = Math.min(.7, hold * .3), tout = Math.min(.6, hold * .25);
  const f = el < tin ? ease(el / tin) : el > hold - tout ? ease(Math.max(0, (hold - el) / tout)) : 1, z = m.zoom;
  return { x: z.x * f, y: z.y * f, w: 1 + (z.w - 1) * f, h: 1 + (z.w - 1) * f };
}
/* welke tekeningen staan op het scherm en hoe ver is hun animatie */
function shapesAt(m, el) {
  if (!m) return []; const n = m.shapes.length; if (!m.anim || !m.hold) return m.shapes.map(sh => ({ sh, p: 1 }));
  const start = m.zoom ? Math.min(.7, m.hold * .3) : .1, per = Math.min(.55, Math.max(.25, (m.hold * .55) / Math.max(1, n))), dur = .5;
  return m.shapes.map((sh, i) => ({ sh, p: clamp((el - start - i * per) / dur, 0, 1) }));
}

/* =====================================================================
   EDITOR
   ===================================================================== */
const vid = $("#vid"), cv = $("#cv"), ctx = cv.getContext("2d"), stage = $("#stage");
let P = null, D = null;                     /* analyse (rij) en gegevens */
let tool = "pass", color = "#FFD100", width = 1, sel = null, selM = null, drag = null, draft = null;
let frozen = null, lastT = 0, exporting = false, tracking = null, fixing = null, objUrl = null, localFile = null, clip = null, tab = "edit";
const hist = { a: [], i: -1 };
let pick = [], hoverP = null, openTr = null;                 /* aangetikte herkende spelers */

const toast = (msg, ms = 3200) => { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), ms); };
const hint = msg => { const h = $("#hintbar"); h.textContent = msg || ""; h.classList.toggle("on", !!msg); clearTimeout(hint.h); if (msg) hint.h = setTimeout(() => h.classList.remove("on"), 4500); };
const dur = () => vid.duration && isFinite(vid.duration) ? vid.duration : 0;
const frameT = t => Math.round(t * FPS) / FPS;
const mById = id => D.moments.find(m => m.id === id);
const curMoment = () => { if (frozen) return frozen.m; const t = vid.currentTime; return D.moments.find(m => Math.abs(m.t - t) < FRAME * .6) || null; };
const shapeById = id => { for (const m of D.moments) { const s = m.shapes.find(x => x.id === id); if (s) return { m, s }; } return null; };

/* ---------- geschiedenis, bewaren ---------- */
function snapshot() { const s = JSON.stringify(D); if (hist.a[hist.i] === s) return; hist.a = hist.a.slice(0, hist.i + 1); hist.a.push(s); if (hist.a.length > 100) hist.a.shift(); hist.i = hist.a.length - 1; updUndo(); }
function restore(s) { D = normData(JSON.parse(s)); if (sel && !shapeById(sel)) sel = null; if (selM && !mById(selM)) selM = null; scheduleSave(); refresh(); updUndo(); }
const updUndo = () => { $("#undo").disabled = hist.i <= 0; $("#redo").disabled = hist.i >= hist.a.length - 1; };
function commit() { D.moments = D.moments.filter(m => m.shapes.length || m.zoom || m.keep); D.moments.sort((a, b) => a.t - b.t); snapshot(); scheduleSave(); refresh(); }
let saveT = null, saving = false;
function scheduleSave() { $("#saved").textContent = "Niet bewaard"; clearTimeout(saveT); saveT = setTimeout(saveNow, 1200); }
async function saveNow() {
  clearTimeout(saveT); if (saving) { saveT = setTimeout(saveNow, 600); return; } saving = true;
  if (!P.id) { P.id = uid(); const u = new URL(location.href); u.searchParams.delete("new"); u.searchParams.set("p", P.id); history.replaceState(null, "", u); }
  P.title = $("#title").value.trim() || "Analyse"; P.data = D;
  try { await store.save(P); $("#saved").textContent = mode === "local" ? "Bewaard op dit toestel" : "Bewaard"; }
  catch (e) { $("#saved").textContent = "Niet bewaard"; toast("Bewaren lukt niet: " + (e.message || e)); }
  saving = false;
}
window.addEventListener("beforeunload", e => { if ($("#saved").textContent === "Niet bewaard") { saveNow(); e.preventDefault(); e.returnValue = ""; } });

/* ---------- canvas en beeldverhouding ---------- */
let dpr = 1, BX = { x: 0, y: 0, w: 1, h: 1 };
function fit() { const r = stage.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const vw = vid.videoWidth || 16, vh = vid.videoHeight || 9, s = Math.min(r.width / vw, r.height / vh); BX = { x: (r.width - vw * s) / 2, y: (r.height - vh * s) / 2, w: vw * s, h: vh * s }; }
new ResizeObserver(() => { fit(); renderTimeline(); }).observe(stage);
const toN = e => { const r = cv.getBoundingClientRect(); return [clamp((e.clientX - r.left - BX.x) / BX.w, -.05, 1.05), clamp((e.clientY - r.top - BX.y) / BX.h, -.05, 1.05)]; };

/* ---------- het beeld tekenen (elke frame) ---------- */
function liveState() {
  const t = vid.currentTime;
  if (frozen) { const el = (performance.now() - frozen.t0) / 1000; return { view: camAt(frozen.m, el), shapes: shapesAt(frozen.m, el), m: frozen.m, edit: false }; }
  if (!vid.paused) { const on = D.moments.filter(m => !m.hold && t >= m.t && t <= m.t + (m.dur || 3));
    return { view: { x: 0, y: 0, w: 1, h: 1 }, shapes: on.flatMap(m => m.shapes.map(sh => ({ sh, p: m.anim ? clamp((t - m.t) / .45, 0, 1) : 1 }))), m: null, edit: false }; }
  const m = curMoment(); return { view: { x: 0, y: 0, w: 1, h: 1 }, shapes: m ? m.shapes.map(sh => ({ sh, p: 1 })) : [], m, edit: true };
}
function paint() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!vid.videoWidth) return;
  const st = liveState(), W = BX.w, H = BX.h; ctx.setTransform(dpr, 0, 0, dpr, BX.x * dpr, BX.y * dpr);
  const shapes = draft && draft.k !== "zoom" && draft.k !== "track" ? [...st.shapes, { sh: draft, p: 1 }] : draft?.k === "track" ? [...st.shapes, { sh: { ...draft, k: "spot" }, p: 1 }] : st.shapes;
  composeFrame(ctx, W, H, { vid, view: st.view, shapes, t: vid.currentTime, tracks: D.tracks, links: D.links });
  if (!st.edit) return;
  if (showPlayers()) drawPlayerOverlay(W, H);
  /* hulplijnen in bewerkmodus: inzoomkader, selectie, handvatten */
  const m = st.m;
  if (m?.zoom || draft?.k === "zoom") { const z = draft?.k === "zoom" ? draft.z : m.zoom; if (z) { ctx.save(); ctx.strokeStyle = "#FFD100"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.w * H); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.fillRect(z.x * W, z.y * H - 22, 118, 20); ctx.fillStyle = "#FFD100"; ctx.font = "700 12px Archivo, sans-serif"; ctx.fillText("Inzoomen hier", z.x * W + 8, z.y * H - 8); ctx.restore(); } }
  if (fixing) { ctx.save(); ctx.fillStyle = "rgba(255,209,0,.10)"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  const s = sel && shapeById(sel); if (s && s.m === m) { ctx.save(); const hs = handles(s.s);
    const bb = bbox(s.s, W, H); ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.strokeRect(bb.x - 6, bb.y - 6, bb.w + 12, bb.h + 12); ctx.setLineDash([]);
    hs.forEach(h => { ctx.beginPath(); ctx.arc(h.p[0] * W, h.p[1] * H, h.k === "mid" ? 6 : 7, 0, Math.PI * 2); ctx.fillStyle = h.k === "mid" ? "#fff" : "#FFD100"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#111"; ctx.stroke(); });
    ctx.restore(); }
  if (draft && (draft.k === "poly" || draft.k === "link") && draft._hover) { ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.setLineDash([5, 5]); const l = draft.pts[draft.pts.length - 1]; ctx.beginPath(); ctx.moveTo(l[0] * W, l[1] * H); ctx.lineTo(draft._hover[0] * W, draft._hover[1] * H); ctx.stroke(); ctx.restore(); }
}
/* handvatten per vorm (genormaliseerd) */
function handles(sh) {
  const p = sh.pts || [];
  if (LINE_KINDS.has(sh.k)) { const mid = sh.q ? quad(p[0], sh.q, p[1], .5) : [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]; return [{ k: "p", i: 0, p: p[0] }, { k: "p", i: 1, p: p[1] }, { k: "mid", p: mid }]; }
  if (sh.k === "ring" || sh.k === "spot" || sh.k === "lens") return [{ k: "r", p: [p[0][0] + (sh.r || .02) * (sh.k === "lens" ? 1 : 1), p[0][1]] }];
  if (sh.k === "poly" || sh.k === "link" || sh.k === "rect") return p.map((q, i) => ({ k: "p", i, p: q }));
  return [];
}
function bbox(sh, W, H) { const p = sh.pts || []; let xs, ys;
  if (sh.k === "ring" || sh.k === "spot" || sh.k === "lens") { const r = (sh.r || .02) * W, c = [p[0][0] * W, p[0][1] * H]; return sh.k === "lens" ? { x: c[0] - r, y: c[1] - r, w: r * 2, h: r * 2 } : sh.k === "spot" ? { x: c[0] - r * 1.2, y: c[1] - r * 4.8, w: r * 2.4, h: r * 5.2 } : { x: c[0] - r, y: c[1] - r * .4, w: r * 2, h: r * .8 }; }
  if (sh.k === "badge") { const R = Math.max(10, W * .016) * (sh.w || 1); return { x: p[0][0] * W - R, y: p[0][1] * H - R, w: R * 2, h: R * 2 }; }
  if (sh.k === "text") { ctx.save(); const fs = Math.max(13, W * .024) * (sh.s || 1); ctx.font = `800 ${fs}px Archivo, Arial, sans-serif`; const lines = (sh.text || "Tekst").split("\n"); const tw = Math.max(...lines.map(l => ctx.measureText(l).width)); ctx.restore();
    return { x: p[0][0] * W, y: p[0][1] * H, w: tw + fs * .84, h: fs * 1.2 * lines.length + fs * .46 }; }
  const pts = LINE_KINDS.has(sh.k) ? linePath(sh, W, H) : p.map(q => [q[0] * W, q[1] * H]); xs = pts.map(q => q[0]); ys = pts.map(q => q[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
/* afstand tot een vorm in pixels (0 = erop of erin) */
function distTo(sh, x, y, W, H) {
  const px = x * W, py = y * H, segD = P => { let best = 1e9; for (let i = 1; i < P.length; i++) { const [a, b] = [P[i - 1], P[i]], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / L, 0, 1); best = Math.min(best, Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t)); } return best; };
  if (LINE_KINDS.has(sh.k)) return segD(linePath(sh, W, H));
  if (sh.k === "pen" || sh.k === "link") return segD(sh.pts.map(q => [q[0] * W, q[1] * H]));
  if (sh.k === "poly") { const P = sh.pts.map(q => [q[0] * W, q[1] * H]); let inside = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > py) !== (P[j][1] > py) && px < (P[j][0] - P[i][0]) * (py - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) inside = !inside; } return inside ? 0 : segD([...P, P[0]]); }
  const b = bbox(sh, W, H); const dx = Math.max(b.x - px, 0, px - b.x - b.w), dy = Math.max(b.y - py, 0, py - b.y - b.h); return Math.hypot(dx, dy);
}
function hitShape(m, n) { if (!m) return null; for (let i = m.shapes.length - 1; i >= 0; i--) { if (distTo(m.shapes[i], n[0], n[1], BX.w, BX.h) < 10) return m.shapes[i]; } return null; }
function hitHandle(sh, n) { return handles(sh).find(h => Math.hypot((h.p[0] - n[0]) * BX.w, (h.p[1] - n[1]) * BX.h) < 13) || null; }

/* ---------- herkende spelers op het beeld ---------- */
const showPlayers = () => tool === "track" && D && D.players.length && vid.paused && !frozen && !tracking && !exporting;
const playersNow = () => D.players.map(pl => { const q = playerAt(pl, vid.currentTime); return q && { pl, x: q[0], y: q[1], h: q[2] }; }).filter(Boolean);
function playerHit(n) { const W = BX.w, H = BX.h; let best = null, bd = 1e9;
  playersNow().forEach(o => { const hp = o.h * H, cx = o.x * W, top = o.y * H - hp, bot = o.y * H + hp * .15, half = Math.max(12, hp * .3), px = n[0] * W, py = n[1] * H;
    if (px < cx - half || px > cx + half || py < top - 6 || py > bot + 6) return; const d = Math.abs(px - cx) + Math.abs(py - (top + bot) / 2) * .4; if (d < bd) { bd = d; best = o; } });
  return best; }
function drawPlayerOverlay(W, H) {
  ctx.save(); const L = playersNow();
  L.forEach(o => { const hp = o.h * H, rx = Math.max(7, hp * .36), x = o.x * W, y = o.y * H, i = pick.indexOf(o.pl.id), on = i >= 0, hv = hoverP === o.pl.id, fol = D.tracks.some(tr => tr.pid === o.pl.id);
    ctx.lineWidth = on ? 3 : hv ? 2.2 : 1.4; ctx.strokeStyle = on ? "#FFD100" : hv ? "#fff" : fol ? "rgba(255,209,0,.7)" : "rgba(255,255,255,.62)";
    ctx.setLineDash(on || hv ? [] : [4, 3]); ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (hv || on) { ctx.globalAlpha = on ? .9 : .5; ctx.strokeRect(x - Math.max(8, hp * .28), y - hp, Math.max(16, hp * .56), hp * 1.02); ctx.globalAlpha = 1; }
    if (on) { const r = Math.max(9, W * .009); ctx.fillStyle = "#FFD100"; ctx.beginPath(); ctx.arc(x, y - hp - r - 3, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#111"; ctx.font = `800 ${r * 1.2}px Archivo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), x, y - hp - r - 2); } });
  ctx.restore(); }
/* volger maken (of hergebruiken) voor een herkende speler */
function followerFor(pl, style) {
  let tr = D.tracks.find(x => x.pid === pl.id);
  if (!tr) { tr = { id: uid(), pid: pl.id, name: "", c: color, style: style || "ring", trail: false, r: .02, pts: pl.pts.map(q => [q[0], q[1], q[2], q[3]]) }; D.tracks.push(tr); }
  else if (style) tr.style = style;
  return tr; }
/* een volger vanaf dit beeld verder laten lopen met een andere (de juiste) herkende speler */
function switchTo(tr, pl, t) { tr.pts = tr.pts.filter(q => q[0] < t - .001).concat(pl.pts.filter(q => q[0] >= t - .001).map(q => [q[0], q[1], q[2], q[3]])); tr.pid = pl.id; }

/* ---------- afspelen met bevriesmomenten ---------- */
function tick() {
  const t = vid.currentTime;
  if (!vid.paused && !exporting && $("#freezeOn").checked && !frozen) {
    const hit = D.moments.find(m => m.hold > 0 && m.t > lastT && m.t <= t + .01);
    if (hit) { vid.pause(); vid.currentTime = hit.t; frozen = { m: hit, t0: performance.now() }; }
  }
  if (frozen) { const el = (performance.now() - frozen.t0) / 1000;
    $("#momentBadge").hidden = false; $("#momentBadge").innerHTML = `${ico("snow", 16)} Bevroren · nog ${Math.max(0, frozen.m.hold - el).toFixed(1)} s`;
    if (el >= frozen.m.hold) { const m = frozen.m; frozen = null; lastT = m.t; vid.play().catch(() => {}); } }
  else badge();
  if (!vid.paused) lastT = Math.max(lastT, t);
  if (clip && !vid.paused && !exporting && t >= clip.b) { vid.pause(); clip = null; }
  $("#time").textContent = fmt(t) + " / " + fmt(dur());
  $("#play").innerHTML = ico(!vid.paused || frozen ? "pause" : "play", 20); $("#play").setAttribute("aria-label", !vid.paused || frozen ? "Pauzeren" : "Afspelen");
  const hd = $("#head"), lane = $("#laneM"); if (dur() && lane) { const r = lane.getBoundingClientRect(), tr = $("#tl").getBoundingClientRect(); hd.style.left = (r.left - tr.left + t / dur() * r.width) + "px"; }
  paint(); requestAnimationFrame(tick);
}
function badge() { const b = $("#momentBadge"); const m = vid.paused ? curMoment() : null;
  if (!m || exporting) { b.hidden = true; return; }
  b.hidden = false; b.innerHTML = `<span class="num">${ico("snow", 16)} Moment ${fmt(m.t)}</span><span>${m.hold ? "bevriest " + m.hold.toFixed(1).replace(".", ",") + " s" : "zonder bevriezen"}</span>${m.zoom ? "<span>· inzoomen</span>" : ""}`; }
const stopFreeze = () => { if (frozen) { const m = frozen.m; frozen = null; vid.currentTime = m.t; } };
function playPause() { if (!vid.src || tracking || exporting) return; if (frozen) { stopFreeze(); return; } if (vid.paused) { lastT = vid.currentTime - .001; if (vid.currentTime >= dur() - .05) vid.currentTime = 0; vid.play().catch(() => {}); } else vid.pause(); }
function seek(t) { stopFreeze(); vid.pause(); clip = null; const v = clamp(frameT(t), 0, dur()); vid.currentTime = v; lastT = v - .001; }
$("#play").onclick = playPause;
$$("[data-step]").forEach(b => b.onclick = () => seek(vid.currentTime + +b.dataset.step));
$("#rate").onchange = e => vid.playbackRate = +e.target.value;
vid.addEventListener("seeked", () => { if (tracking || exporting) return; if (vid.paused && !frozen) { const m = curMoment(); if (m && tab === "edit") { selM = m.id; } renderSide(); } });
vid.addEventListener("pause", () => { if (!tracking && !exporting) renderSide(); });

/* ---------- gereedschap ---------- */
function renderRail() {
  $("#rail").innerHTML = TOOLS.map(([k, l, key], i) => `${i === 1 || i === 6 || i === 10 || i === 13 ? '<span class="sep"></span>' : ""}<button class="tool" data-tool="${k}" title="${l} (${key})" aria-label="${l}" aria-pressed="${k === tool}">${ico(k)}<kbd>${key}</kbd></button>`).join("") +
    `<span class="sep"></span>${COLORS.map(c => `<button class="sw" data-color="${c}" style="--c:${c}" title="Kleur ${CNAME[c]}" aria-label="Kleur ${CNAME[c]}" aria-pressed="${c === color}"></button>`).join("")}
    <span class="sep"></span>${WIDTHS.map(([w, l]) => `<button class="wbtn" data-w="${w}" title="Lijndikte ${l.toLowerCase()}" aria-label="Lijndikte ${l.toLowerCase()}" aria-pressed="${w === width}"><i style="height:${Math.round(2 + w * 2.5)}px"></i></button>`).join("")}`;
  $$("[data-tool]").forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $$("[data-color]").forEach(b => b.onclick = () => { color = b.dataset.color; const s = sel && shapeById(sel); if (s) { s.s.c = color; commit(); } renderRail(); });
  $$("[data-w]").forEach(b => b.onclick = () => { width = +b.dataset.w; const s = sel && shapeById(sel); if (s) { s.s.w = width; commit(); } renderRail(); });
}
function setTool(k) { finishPoly(); tool = k; renderRail(); cv.style.cursor = k === "sel" ? "default" : "crosshair"; hint(TOOLMAP[k][3]); }

/* ---------- tekenen met muis, pen of vinger ---------- */
let badgeN = 1, lastDown = 0;
cv.addEventListener("pointerdown", e => {
  if (!vid.videoWidth || exporting || tracking) return; e.preventDefault(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); const n = toN(e);
  if (frozen) stopFreeze(); if (!vid.paused) vid.pause();
  if (fixing) { const tr = D.tracks.find(x => x.id === fixing); fixing = null; const ph = D.players.length ? playerHit(n) : null;
    if (tr && ph) { switchTo(tr, ph.pl, vid.currentTime); commit(); toast("Verbeterd: vanaf hier volgt hij deze speler."); return; }
    if (tr) runTrack(tr, vid.currentTime, n[0], n[1]); return; }
  if (showPlayers()) { const ph = playerHit(n);
    if (ph) { const id = ph.pl.id, i = pick.indexOf(id); if (i >= 0) pick.splice(i, 1); else pick.push(id); if (tab !== "track") { tab = "track"; renderTabs(); } else renderSide(); return; }
    if (playersNow().length) { if (pick.length) { pick = []; renderSide(); } else hint("Tik op een speler (de stippellijntjes aan de voeten). Sleep om iemand te volgen die niet herkend werd."); } }
  const m = curMoment(), s = sel && shapeById(sel);
  /* handvat van de geselecteerde vorm verslepen kan met elk gereedschap */
  if (s && s.m === m) { const h = hitHandle(s.s, n); if (h) { drag = { type: "h", h, s: s.s, n0: n, orig: JSON.parse(JSON.stringify(s.s)) }; cv.setPointerCapture(e.pointerId); return; } }
  if (tool === "sel") { const hs = hitShape(m, n); sel = hs?.id || null; if (hs) { selM = m.id; drag = { type: "move", s: hs, n0: n, orig: JSON.parse(JSON.stringify(hs)) }; cv.setPointerCapture(e.pointerId); } renderSide(); return; }
  if (tool === "poly" || tool === "link") { const now = performance.now();
    if (draft && draft.k === tool) { if (now - lastDown < 320) { finishPoly(); return; } draft.pts.push(n); } else draft = { id: uid(), k: tool, c: color, w: width, pts: [n] }; lastDown = now; return; }
  if (tool === "badge") { const mm = ensureMoment(); const sh = { id: uid(), k: "badge", c: color, w: width, pts: [n], n: nextBadge(mm) }; mm.shapes.push(sh); sel = sh.id; commit(); return; }
  if (tool === "text") { const mm = ensureMoment(); const sh = { id: uid(), k: "text", c: color, w: 1, s: 1, bg: "dark", pts: [n], text: "Tekst" }; mm.shapes.push(sh); sel = sh.id; tab = "edit"; commit(); setTimeout(() => { const ta = $("#shText"); if (ta) { ta.focus(); ta.select(); } }, 30); return; }
  if (tool === "zoom") { draft = { k: "zoom", a: n, z: { x: n[0], y: n[1], w: .05 } }; cv.setPointerCapture(e.pointerId); return; }
  draft = { id: uid(), k: tool, c: color, w: width, pts: tool === "pen" ? [n] : [n, n] }; if (["ring", "spot", "lens", "track"].includes(tool)) { draft.pts = [n]; draft.r = tool === "lens" ? .06 : .02; }
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener("pointermove", e => {
  const n = toN(e);
  if (drag) { const dx = n[0] - drag.n0[0], dy = n[1] - drag.n0[1], o = drag.orig, s = drag.s;
    if (drag.type === "move") { s.pts = o.pts.map(q => [q[0] + dx, q[1] + dy]); if (o.q) s.q = [o.q[0] + dx, o.q[1] + dy]; }
    else { const h = drag.h; if (h.k === "p") { s.pts[h.i] = [o.pts[h.i][0] + dx, o.pts[h.i][1] + dy]; }
      else if (h.k === "mid") { const a = s.pts[0], b = s.pts[1]; s.q = [2 * n[0] - (a[0] + b[0]) / 2, 2 * n[1] - (a[1] + b[1]) / 2]; if (Math.hypot((n[0] - (a[0] + b[0]) / 2) * BX.w, (n[1] - (a[1] + b[1]) / 2) * BX.h) < 6) s.q = null; }
      else if (h.k === "r") { s.r = clamp(Math.abs(n[0] - s.pts[0][0]), .008, .4); } }
    drag.moved = true; return; }
  if (!draft && showPlayers()) { const ph = playerHit(n), id = ph ? ph.pl.id : null; if (id !== hoverP) hoverP = id; cv.style.cursor = ph ? "pointer" : "crosshair"; return; }
  if (!draft) { if (tool === "sel" || sel) { const m = curMoment(), s = sel && shapeById(sel); cv.style.cursor = s && s.m === m && hitHandle(s.s, n) ? "grab" : tool === "sel" ? (hitShape(m, n) ? "move" : "default") : "crosshair"; } return; }
  if (draft.k === "poly" || draft.k === "link") { draft._hover = n; return; }
  if (draft.k === "zoom") { const a = draft.a, w = clamp(Math.max(Math.abs(n[0] - a[0]), Math.abs(n[1] - a[1])), .08, 1); draft.z = { x: clamp(Math.min(a[0], n[0] < a[0] ? a[0] - w : a[0]), 0, 1 - w), y: clamp(n[1] < a[1] ? a[1] - w : a[1], 0, 1 - w), w }; return; }
  if (draft.k === "pen") { const l = draft.pts[draft.pts.length - 1]; if (Math.hypot((n[0] - l[0]) * BX.w, (n[1] - l[1]) * BX.h) > 2.5) draft.pts.push(n); return; }
  if (["ring", "spot", "lens", "track"].includes(draft.k)) { draft._moved = true; draft.r = clamp(Math.hypot((n[0] - draft.pts[0][0]), (n[1] - draft.pts[0][1]) * BX.h / BX.w), .008, .4); return; }
  draft.pts[1] = n;
});
cv.addEventListener("pointerup", () => {
  if (drag) { const moved = drag.moved; drag = null; if (moved) commit(); return; }
  if (!draft || draft.k === "poly" || draft.k === "link") return;
  const d = draft; draft = null;
  if (d.k === "zoom") { if (d.z.w >= .99) return; const mm = ensureMoment(); mm.zoom = { ...d.z }; if (!mm.hold) mm.hold = 3; commit(); toast("Inzoomkader gezet. Bij het afspelen zoomt het beeld hier vloeiend op in."); setTool("sel"); return; }
  if (d.k === "track" && D.players.length && !d._moved) return;
  if (d.k === "track") { const tr = { id: uid(), name: "", c: d.c, style: "spot", trail: false, r: Math.max(.012, d.r || .022), pts: [] }; D.tracks.push(tr); tab = "track"; renderTabs(); runTrack(tr, vid.currentTime, d.pts[0][0], d.pts[0][1]); return; }
  if (LINE_KINDS.has(d.k) && Math.hypot((d.pts[1][0] - d.pts[0][0]) * BX.w, (d.pts[1][1] - d.pts[0][1]) * BX.h) < 12) return;
  if (d.k === "pen" && d.pts.length < 3) return;
  if (d.k === "rect" && Math.abs(d.pts[1][0] - d.pts[0][0]) * BX.w < 8) return;
  const mm = ensureMoment(); mm.shapes.push(d); sel = d.id; commit();
});
cv.addEventListener("dblclick", e => { if (tool === "sel") { const s = sel && shapeById(sel); if (s && s.s.k === "text") { tab = "edit"; renderSide(); setTimeout(() => $("#shText")?.focus(), 20); } } });
function finishPoly() { if (!draft || (draft.k !== "poly" && draft.k !== "link")) return; const d = draft; draft = null; delete d._hover;
  if (d.pts.length >= (d.k === "poly" ? 3 : 2)) { const mm = ensureMoment(); mm.shapes.push(d); sel = d.id; commit(); } }
function ensureMoment() { let m = curMoment(); if (!m) { m = { id: uid(), t: frameT(vid.currentTime), hold: 3, dur: 3, anim: true, zoom: null, shapes: [] }; D.moments.push(m); D.moments.sort((a, b) => a.t - b.t); vid.currentTime = m.t; } selM = m.id; return m; }
function nextBadge(m) { const ns = m.shapes.filter(s => s.k === "badge").map(s => +s.n || 0); return ns.length ? Math.max(...ns) + 1 : 1; }

/* ---------- speler automatisch volgen ---------- */
async function runTrack(tr, fromT, x, y) {
  if (tracking) return; let trk; try { trk = makeTracker(vid); trk.start(x, y, tr.r || .022); } catch (e) { toast("Volgen lukt niet voor deze video (beveiligde bron). Kies de video van je toestel."); return; }
  vid.pause(); stopFreeze(); tracking = { stop: false };
  tr.pts = tr.pts.filter(q => q[0] < fromT - .001); tr.pts.push([+fromT.toFixed(3), x, y]);
  $("#busy").hidden = false; $("#busyMsg").textContent = "Speler volgen…"; $("#busyStop").onclick = () => { tracking.stop = true; };
  const dt = 1 / 15, end = Math.min(dur(), fromT + (tr.max || 30)); let t = fromT, px = x, py = y, vx = 0, vy = 0, low = 0, why = "";
  while (!tracking.stop) { t += dt; if (t > end) { why = t >= dur() - dt ? "einde" : "max"; break; }
    await seekTo(vid, t); const r = trk.step(px, py, vx, vy);
    if (!r || r.score < .42) { if (++low >= 15) { tr.pts.splice(tr.pts.length - (low - 1), low - 1); why = "kwijt"; break; } px += vx; py += vy; tr.pts.push([+t.toFixed(3), +px.toFixed(4), +py.toFixed(4)]); continue; }
    low = 0; vx = vx * .6 + (r.x - px) * .4; vy = vy * .6 + (r.y - py) * .4; px = r.x; py = r.y; tr.pts.push([+t.toFixed(3), +px.toFixed(4), +py.toFixed(4)]);
    $("#busyMsg").textContent = `Speler volgen… ${fmt(t)}`; }
  if (tracking.stop) why = "stop"; tracking = null; $("#busy").hidden = true;
  const last = tr.pts[tr.pts.length - 1][0]; await seekTo(vid, last); commit();
  toast(why === "kwijt" ? `Speler kwijt na ${fmt(last)}. Kies bij Volgen "Verbeteren" en tik de speler aan.` : why === "einde" ? "Gevolgd tot het einde van de video." : why === "max" ? "30 seconden gevolgd. Kies \"Verder volgen\" om door te gaan." : `Gevolgd tot ${fmt(last)}.`, 5000);
}

/* ---------- tijdlijn ---------- */
function renderTimeline() {
  const L = dur(); if (!D) return;
  const pct = t => (L ? clamp(t / L, 0, 1) * 100 : 0) + "%";
  $("#laneM").innerHTML = D.moments.map(m => `<button class="mk${m.id === selM ? " sel" : ""}${m.hold ? "" : " nohold"}" data-m="${m.id}" style="left:${pct(m.t)}" title="Moment ${fmt(m.t)} · ${m.shapes.length} tekening(en)${m.hold ? " · bevriest " + m.hold + " s" : ""}">${m.zoom ? "⌕" : m.shapes.length}</button>`).join("");
  $("#laneT").innerHTML = (D.vis ? `<span class="rg vis" style="left:${pct(D.vis.a)};width:calc(${pct(D.vis.b)} - ${pct(D.vis.a)})" title="Spelers herkend"></span>` : "") + D.tracks.filter(tr => tr.pts.length > 1).map(tr => `<span class="rg" style="left:${pct(tr.pts[0][0])};width:calc(${pct(tr.pts[tr.pts.length - 1][0])} - ${pct(tr.pts[0][0])});background:${tr.c}" title="${esc(tr.name || "Gevolgde speler")}"></span>`).join("");
  $("#laneG").innerHTML = D.tags.map(g => `<span class="tg" style="left:${pct(g.t)};--c:${g.c}" title="${esc(g.l)} · ${fmt(g.t)}">${esc(g.l)}</span>`).join("");
  const io = $("#inout"), lane = $("#laneM"); if (D.inout && L && lane) { const r = lane.getBoundingClientRect(), tr = $("#tl").getBoundingClientRect(); io.style.display = "block"; io.style.left = (r.left - tr.left + D.inout.a / L * r.width) + "px"; io.style.width = ((D.inout.b - D.inout.a) / L * r.width) + "px"; } else io.style.display = "none";
}
(() => { const tl = $("#tl"); let scrub = false, mdrag = null;
  const tAt = e => { const r = $("#laneM").getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * dur(); };
  tl.addEventListener("pointerdown", e => { if (!dur() || exporting || tracking) return; const mk = e.target.closest("[data-m]");
    if (mk) { const m = mById(mk.dataset.m); mdrag = { m, x0: e.clientX, moved: false }; tl.setPointerCapture(e.pointerId); return; }
    scrub = true; tl.setPointerCapture(e.pointerId); seek(tAt(e)); });
  tl.addEventListener("pointermove", e => { if (scrub) seek(tAt(e)); else if (mdrag) { if (Math.abs(e.clientX - mdrag.x0) > 4) mdrag.moved = true; if (mdrag.moved) { mdrag.m.t = frameT(tAt(e)); vid.currentTime = mdrag.m.t; renderTimeline(); } } });
  tl.addEventListener("pointerup", () => { if (mdrag) { const m = mdrag.m; if (mdrag.moved) commit(); else { selM = m.id; sel = null; tab = "edit"; renderTabs(); seek(m.t); } mdrag = null; } scrub = false; });
})();
async function filmstrip() {
  const strip = $("#strip"), n = Math.max(6, Math.min(18, Math.round(strip.clientWidth / 90))); strip.innerHTML = "";
  if (!vid.src || !dur()) return; const v2 = document.createElement("video"); v2.muted = true; v2.playsInline = true; v2.preload = "auto"; v2.crossOrigin = vid.crossOrigin; v2.src = vid.currentSrc || vid.src;
  await new Promise(r => { v2.onloadeddata = r; v2.onerror = r; setTimeout(r, 6000); }); if (!v2.videoWidth) return;
  for (let i = 0; i < n; i++) { const c = document.createElement("canvas"); c.width = 160; c.height = 90; strip.appendChild(c); }
  const cs = $$("canvas", strip);
  for (let i = 0; i < n; i++) { await seekTo(v2, (i + .5) / n * dur()); try { cs[i].getContext("2d").drawImage(v2, 0, 0, 160, 90); } catch (e) { break; } }
  v2.removeAttribute("src"); v2.load();
}

/* ---------- zijpaneel ---------- */
function renderTabs() { $$(".tabs [data-tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab)); renderSide(); }
$$(".tabs [data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === "track" && tool !== "track") setTool("track"); renderTabs(); });
const seg = (id, opts, val) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(val)}">${l}</button>`).join("")}</div>`;
const colsHtml = (id, val) => `<div class="cols" id="${id}">${COLORS.map(c => `<button type="button" data-c="${c}" style="--c:${c}" aria-label="Kleur ${CNAME[c]}" aria-pressed="${c === val}"></button>`).join("")}</div>`;
const bindSeg = (id, fn) => $$(`#${id} [data-v]`).forEach(b => b.onclick = () => fn(b.dataset.v));
const bindCols = (id, fn) => $$(`#${id} [data-c]`).forEach(b => b.onclick = () => fn(b.dataset.c));
function refresh() { renderTimeline(); renderSide(); }

function renderSide() {
  const pane = $("#pane"); if (!D) return;
  if (pane.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== "range" && document.activeElement.type !== "checkbox") return;
  if (tab === "edit") return paneEdit(pane);
  if (tab === "list") return paneList(pane);
  if (tab === "track") return paneTrack(pane);
  if (tab === "tags") return paneTags(pane);
}
function paneEdit(pane) {
  const s = sel && shapeById(sel), m = curMoment();
  if (!vid.videoWidth) { pane.innerHTML = `<div class="empty"><b>Begin met een clip</b>Kies een video in het midden. Daarna pauzeer je op het juiste beeld en teken je erop.</div>${helpBlock()}`; return; }
  if (s && s.m === m) return paneShape(pane, s.s, s.m);
  const up = localFile && !D.file_path && mode === "cloud" ? `<div class="empty" style="margin-bottom:14px;border-color:var(--yel)"><b>Deze video staat alleen op dit toestel</b>Bewaar ze in je opslag om de analyse ook op een ander toestel te openen (max. 50 MB).<div class="row" style="margin-top:8px"><button class="btn small" id="upGo">Video bewaren</button></div></div>` : "";
  setTimeout(() => { const u = $("#upGo"); if (u) u.onclick = uploadLocal; }, 0);
  if (!m) { pane.innerHTML = up + `<h3>Teken op dit beeld</h3><p>Pauzeer de video op het beeld dat je wil uitleggen en kies links een gereedschap. Je eerste tekening maakt hier een <b>moment</b>: bij het afspelen stopt de video daar even en verschijnen je tekeningen één voor één.</p>
    <button class="btn ghost small" id="mkM">+ Leeg moment op ${fmt(vid.currentTime)}</button>${helpBlock()}`;
    $("#mkM").onclick = () => { const mm = ensureMoment(); mm.keep = true; commit(); }; return; }
  pane.innerHTML = up + `<h3>Moment ${fmt(m.t)}</h3>
    <div class="field"><span>Bij het afspelen</span>${seg("mHold", [["1", "Bevriezen"], ["0", "Doorlopen"]], m.hold ? 1 : 0)}</div>
    ${m.hold ? `<div class="field"><span>Hoe lang bevriezen</span><div class="rng"><input type="range" id="mHoldS" min="1" max="12" step=".5" value="${m.hold}"><b id="mHoldV">${String(m.hold).replace(".", ",")} s</b></div></div>`
      : `<div class="field"><span>Tekeningen blijven staan</span><div class="rng"><input type="range" id="mDur" min="1" max="10" step=".5" value="${m.dur || 3}"><b id="mDurV">${String(m.dur || 3).replace(".", ",")} s</b></div></div>`}
    <label class="chk" style="margin-bottom:12px"><input type="checkbox" id="mAnim"${m.anim ? " checked" : ""}> Tekeningen één voor één laten verschijnen</label>
    <div class="field"><span>Camera</span><div class="row">${m.zoom ? `<span class="note">Zoomt in op het gele kader.</span><button class="btn ghost small" id="mZoomEd">Kader opnieuw</button><button class="btn ghost small" id="mZoomX">Niet inzoomen</button>` : `<button class="btn ghost small" id="mZoomEd">${ico("zoom", 16)} Inzoomen op een stuk</button>`}</div></div>
    <h4>Tekeningen (volgorde van verschijnen)</h4>
    ${m.shapes.length ? `<div class="list">${m.shapes.map((x, i) => `<div class="it" data-s="${x.id}"><span class="ic" style="color:${x.c}">${ico(x.k === "pass" || x.k === "run" || x.k === "drib" || x.k === "line" ? x.k : x.k)}</span><span class="mn"><b>${i + 1}. ${KNAME[x.k] || x.k}${x.k === "text" ? ": " + esc((x.text || "").slice(0, 18)) : x.k === "badge" ? " " + esc(x.n) : x.label ? ": " + esc(x.label) : ""}</b></span>
      <button class="x" data-up="${x.id}" title="Eerder laten verschijnen" aria-label="Eerder">${ico("up", 16)}</button><button class="x" data-del="${x.id}" title="Verwijderen" aria-label="Verwijderen">${ico("x", 16)}</button></div>`).join("")}</div>` : `<p class="note">Nog geen tekeningen op dit moment.</p>`}
    <div class="row" style="margin-top:14px"><button class="btn small" id="mPrev">${ico("play", 14)} Bekijk dit moment</button><button class="btn ghost small" id="mCopy">${ico("copy", 16)} Kopieer naar…</button><button class="btn danger small" id="mDel">Moment wissen</button></div>`;
  bindSeg("mHold", v => { m.hold = v === "1" ? (m.hold || 3) || 3 : 0; if (v === "1" && !m.hold) m.hold = 3; commit(); });
  const hs = $("#mHoldS"); if (hs) { hs.oninput = () => { m.hold = +hs.value; $("#mHoldV").textContent = String(m.hold).replace(".", ",") + " s"; }; hs.onchange = commit; }
  const ds = $("#mDur"); if (ds) { ds.oninput = () => { m.dur = +ds.value; $("#mDurV").textContent = String(m.dur).replace(".", ",") + " s"; }; ds.onchange = commit; }
  $("#mAnim").onchange = e => { m.anim = e.target.checked; commit(); };
  $("#mZoomEd").onclick = () => setTool("zoom"); const zx = $("#mZoomX"); if (zx) zx.onclick = () => { m.zoom = null; commit(); };
  $$("[data-s]", pane).forEach(r => r.onclick = e => { if (e.target.closest("button")) return; sel = r.dataset.s; renderSide(); });
  $$("[data-up]", pane).forEach(b => b.onclick = () => { const i = m.shapes.findIndex(x => x.id === b.dataset.up); if (i > 0) { [m.shapes[i - 1], m.shapes[i]] = [m.shapes[i], m.shapes[i - 1]]; commit(); } });
  $$("[data-del]", pane).forEach(b => b.onclick = () => { m.shapes = m.shapes.filter(x => x.id !== b.dataset.del); if (sel === b.dataset.del) sel = null; commit(); });
  $("#mPrev").onclick = () => previewMoment(m);
  $("#mCopy").onclick = () => copyMomentDialog(m);
  $("#mDel").onclick = () => { if (!confirm("Dit moment en zijn tekeningen wissen?")) return; D.moments = D.moments.filter(x => x !== m); sel = null; selM = null; commit(); };
}
function paneShape(pane, s, m) {
  const isLine = LINE_KINDS.has(s.k);
  pane.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">${KNAME[s.k] || s.k}</h3><button class="btn ghost small" id="shBack">Moment</button></div><p class="note" style="margin-top:4px">Moment ${fmt(m.t)} · sleep de gele bolletjes op het beeld om aan te passen.</p>
    ${isLine ? `<div class="field"><span>Soort lijn</span>${seg("shKind", [["pass", "Pass"], ["run", "Loopactie"], ["drib", "Dribbel"], ["line", "Lijn"]], s.k)}</div>` : ""}
    ${s.k === "line" ? `<label class="chk" style="margin-bottom:12px"><input type="checkbox" id="shHead"${s.head ? " checked" : ""}> Met pijlpunt</label>` : ""}
    ${isLine ? `<div class="row" style="margin-bottom:12px"><button class="btn ghost small" id="shStraight"${s.q ? "" : " disabled"}>Rechttrekken</button><button class="btn ghost small" id="shFlip">Richting omdraaien</button></div>` : ""}
    <div class="field"><span>Kleur</span>${colsHtml("shCol", s.c)}</div>
    ${["text", "lens", "poly", "rect"].includes(s.k) ? "" : `<div class="field"><span>Dikte</span>${seg("shW", WIDTHS.map(([w, l]) => [w, l]), s.w || 1)}</div>`}
    ${s.k === "text" ? `<div class="field"><span>Tekst</span><textarea id="shText" rows="3">${esc(s.text || "")}</textarea></div><div class="field"><span>Grootte</span>${seg("shS", [[.75, "Klein"], [1, "Normaal"], [1.4, "Groot"], [2, "Titel"]], s.s || 1)}</div><div class="field"><span>Achtergrond</span>${seg("shBg", [["dark", "Donker"], ["color", "Gekleurd"], ["none", "Geen"]], s.bg || "dark")}</div>` : ""}
    ${s.k === "badge" ? `<div class="field"><span>Nummer of letter</span><input id="shN" value="${esc(s.n)}" maxlength="3"></div>` : ""}
    ${s.k === "ring" || s.k === "spot" ? `<div class="field"><span>Naam boven de speler (mag leeg)</span><input id="shLabel" value="${esc(s.label || "")}" maxlength="24" placeholder="bv. 7 Lars"></div>` : ""}
    ${s.k === "lens" ? `<div class="field"><span>Vergroting</span>${seg("shZ", [[1.6, "1,6×"], [2.2, "2,2×"], [3, "3×"], [4, "4×"]], s.z || 2.2)}</div>` : ""}
    ${s.k === "poly" || s.k === "rect" ? `<div class="field"><span>Vulling</span>${seg("shOp", [[.12, "Licht"], [.28, "Normaal"], [.45, "Sterk"]], s.op ?? (s.k === "poly" ? .28 : .26))}</div>` : ""}
    <div class="row" style="margin-top:6px"><button class="btn ghost small" id="shDup">${ico("copy", 16)} Dupliceren</button><button class="btn danger small" id="shDel">Verwijderen</button></div>
    <p class="note" style="margin-top:12px">Sneltoetsen: Delete wist, Ctrl+D dupliceert, pijltjes verschuiven.</p>`;
  $("#shBack").onclick = () => { sel = null; renderSide(); };
  bindSeg("shKind", v => { s.k = v; commit(); });
  const hd = $("#shHead"); if (hd) hd.onchange = e => { s.head = e.target.checked; commit(); };
  const st = $("#shStraight"); if (st) st.onclick = () => { s.q = null; commit(); };
  const fl = $("#shFlip"); if (fl) fl.onclick = () => { s.pts.reverse(); commit(); };
  bindCols("shCol", c => { s.c = c; color = c; renderRail(); commit(); });
  bindSeg("shW", v => { s.w = +v; commit(); });
  const tx = $("#shText"); if (tx) { tx.oninput = () => { s.text = tx.value; }; tx.onchange = () => commit(); tx.onblur = () => commit(); }
  bindSeg("shS", v => { s.s = +v; commit(); }); bindSeg("shBg", v => { s.bg = v; commit(); });
  const nn = $("#shN"); if (nn) { nn.oninput = () => { s.n = nn.value; }; nn.onchange = () => commit(); }
  const lb = $("#shLabel"); if (lb) { lb.oninput = () => { s.label = lb.value; }; lb.onchange = () => commit(); }
  bindSeg("shZ", v => { s.z = +v; commit(); }); bindSeg("shOp", v => { s.op = +v; commit(); });
  $("#shDup").onclick = () => dupShape(); $("#shDel").onclick = () => delShape();
}
function dupShape() { const s = sel && shapeById(sel); if (!s) return; const k = JSON.parse(JSON.stringify(s.s)); k.id = uid(); k.pts = k.pts.map(q => [q[0] + .02, q[1] + .02]); if (k.q) k.q = [k.q[0] + .02, k.q[1] + .02]; if (k.k === "badge") k.n = nextBadge(s.m); s.m.shapes.push(k); sel = k.id; commit(); }
function delShape() { const s = sel && shapeById(sel); if (!s) return; s.m.shapes = s.m.shapes.filter(x => x !== s.s); sel = null; commit(); }
function paneList(pane) {
  pane.innerHTML = `<h3>Alle momenten</h3><p>Tik om ernaartoe te gaan. Versleep een moment op de tijdlijn om het te verschuiven.</p>
    ${D.moments.length ? `<div class="list">${D.moments.map((m, i) => `<div class="it${m.id === selM ? " sel" : ""}" data-go="${m.id}"><span class="ic">${ico(m.zoom ? "zoom" : "snow", 17)}</span><span class="mn"><b>${i + 1}. ${fmt(m.t)}</b><small>${m.shapes.length} tekening(en) · ${m.hold ? "bevriest " + String(m.hold).replace(".", ",") + " s" : "doorlopend " + String(m.dur || 3).replace(".", ",") + " s"}${m.zoom ? " · inzoomen" : ""}</small></span></div>`).join("")}</div>` : `<div class="empty"><b>Nog geen momenten</b>Pauzeer de video en teken iets: dat maakt een moment.</div>`}
    <h4>Clip voor export</h4><p>${D.inout ? `Van ${fmt(D.inout.a)} tot ${fmt(D.inout.b)}.` : "Hele video. Zet een begin en einde met de knoppen onder het beeld (of I en O)."}</p>${D.inout ? `<button class="btn ghost small" id="ioX">Hele video gebruiken</button>` : ""}`;
  $$("[data-go]", pane).forEach(r => r.onclick = () => { const m = mById(r.dataset.go); selM = m.id; sel = null; seek(m.t); tab = "edit"; renderTabs(); });
  const io = $("#ioX"); if (io) io.onclick = () => { D.inout = null; commit(); };
}
function paneTrack(pane) {
  const t = vid.currentTime, V = D.vis, inR = V && t >= V.a - .05 && t <= V.b + .05, now = inR ? playersNow() : [];
  pick = pick.filter(id => D.players.some(p => p.id === id));
  const pl = id => D.players.find(p => p.id === id), teamOf = pick.length ? pl(pick[0]).tm : -1;
  let top;
  if (!vid.videoWidth) top = `<div class="empty"><b>Kies eerst een clip</b>Daarna herkent de studio de spelers voor je.</div>`;
  else if (!V) top = `<h3>Spelers herkennen</h3><p>De studio zoekt zelf alle spelers in een stuk video en volgt ze. Daarna tik je ze gewoon aan: een spotlight, ring of naam blijft dan aan die speler hangen, en lijnen tussen spelers bewegen mee.</p>
    <button class="btn" id="vRun">${ico("track", 16)} Spelers herkennen</button><p class="note" style="margin-top:8px">Werkt het best met een vaste camera of een beeld dat rustig meedraait. De eerste keer laadt de herkenning (4 tot 20 MB).</p>`;
  else if (!inR) top = `<h3>Spelers herkennen</h3><p>Herkend van <button class="chipbtn" id="vGo">${fmt(V.a)}</button> tot ${fmt(V.b)}. Op dit beeld (${fmt(t)}) nog niet.</p><button class="btn" id="vRun">${ico("track", 16)} Hier herkennen</button>`;
  else if (!pick.length) top = `<h3>${now.length} spelers op dit beeld</h3><p>Tik op het beeld één of meer spelers aan (de stippellijntjes aan hun voeten). Daarna kies je hier wat er moet gebeuren.</p>
    <p class="note">Herkend van ${fmt(V.a)} tot ${fmt(V.b)}. <button class="chipbtn" id="vRun">Ander stuk herkennen</button></p>`;
  else top = `<h3>${pick.length === 1 ? "1 speler gekozen" : pick.length + " spelers gekozen"}</h3>
    <div class="field"><span>Laten volgen met</span><div class="seg">${TSTYLES.slice(0, 3).map(([v, l]) => `<button type="button" data-pst="${v}">${l}</button>`).join("")}</div></div>
    ${pick.length === 1 ? `<div class="field"><span>Naam boven de speler (mag leeg)</span><input id="pName" maxlength="24" placeholder="bv. 7 Lars" value="${esc(D.tracks.find(x => x.pid === pick[0])?.name || "")}"></div>` : ""}
    ${pick.length >= 2 ? `<div class="field"><span>Verbinden</span><div class="seg"><button type="button" data-plk="line">Lijn</button><button type="button" data-plk="linie">Linie</button>${pick.length >= 3 ? `<button type="button" data-plk="zone">Zone</button>` : ""}</div></div>` : `<p class="note">Kies meer spelers om ze met een lijn, linie of zone te verbinden.</p>`}
    <div class="row">${teamOf >= 0 ? `<button class="btn ghost small" id="pTeam">Hele ploeg kiezen</button>` : ""}<button class="btn ghost small" id="pClr">Keuze wissen</button></div>`;
  const SN = Object.fromEntries(TSTYLES);
  const fol = D.tracks.length ? `<h4>Gevolgde spelers</h4>` + D.tracks.map((tr, i) => { const a = tr.pts[0]?.[0] ?? 0, b = tr.pts[tr.pts.length - 1]?.[0] ?? 0, op = openTr === tr.id;
      return `<div class="it fol${op ? " open" : ""}" style="flex-direction:column;align-items:stretch;cursor:default;gap:8px;margin-bottom:6px"><div class="row" style="flex-wrap:nowrap"><span class="ic" style="background:${tr.c};color:#111">${ico("track", 17)}</span><input data-tn="${tr.id}" value="${esc(tr.name || "")}" placeholder="Speler ${i + 1} (naam)" aria-label="Naam" style="flex:1;min-width:0;border:1px solid var(--line2);background:var(--panel);border-radius:8px;padding:6px 8px">
        <button class="x" data-topen="${tr.id}" title="${op ? "Minder" : "Stijl, kleur en verbeteren"}" aria-label="Instellingen" aria-expanded="${op}">${ico(op ? "up" : "sel", 16)}</button><button class="x" data-tdel="${tr.id}" aria-label="Verwijderen">${ico("x", 16)}</button></div>
        <small class="note">${SN[tr.style || "spot"]} · <button class="chipbtn" data-tgo="${a}">${fmt(a)}</button> tot <button class="chipbtn" data-tgo="${b}">${fmt(b)}</button></small>
        ${op ? `${seg("ts" + tr.id, TSTYLES, tr.style || "spot")}${colsHtml("tc" + tr.id, tr.c)}
        <div class="row"><label class="chk"><input type="checkbox" data-ttr="${tr.id}"${tr.trail ? " checked" : ""}> Looplijn</label><label class="chk"><input type="checkbox" data-thd="${tr.id}"${tr.hidden ? "" : " checked"}> Zichtbaar</label></div>
        <div class="row"><button class="btn ghost small" data-tfix="${tr.id}" title="Volgt hij ergens de verkeerde? Ga naar dat beeld en tik daarna de juiste speler aan.">Verbeteren vanaf hier</button>${tr.pid ? "" : `<button class="btn ghost small" data-tmore="${tr.id}">Verder volgen</button>`}</div>` : ""}</div>`; }).join("") : "";
  const lk = D.links.length ? `<h4>Lijnen tussen spelers</h4><div class="list">` + D.links.map(L => `<div class="it" style="cursor:default"><span class="ic" style="background:${L.c};color:#111">${ico(L.k === "zone" ? "poly" : "link", 16)}</span><span class="mn"><b>${LKIND[L.k]}</b><small>${L.ids.map(id => esc(D.tracks.find(x => x.id === id)?.name || "")).filter(Boolean).join(", ") || L.ids.length + " spelers"}</small></span>${colsHtml("lc" + L.id, L.c)}<button class="x" data-ldel="${L.id}" aria-label="Verwijderen">${ico("x", 16)}</button></div>`).join("") + `</div>` : "";
  pane.innerHTML = top + fol + lk;
  const r = $("#vRun"); if (r) r.onclick = recogniseDialog; const g = $("#vGo"); if (g) g.onclick = () => seek(V.a);
  $$("[data-pst]", pane).forEach(b => b.onclick = () => { pick.forEach(id => { const tr = followerFor(pl(id), b.dataset.pst); if (pick.length > 1 && !tr.c) tr.c = color; }); commit(); toast(pick.length === 1 ? "Deze speler wordt nu gevolgd." : pick.length + " spelers worden nu gevolgd."); });
  const pn = $("#pName"); if (pn) { pn.oninput = () => { const tr = followerFor(pl(pick[0]), D.tracks.find(x => x.pid === pick[0])?.style || "ring"); tr.name = pn.value.slice(0, 24); paint(); }; pn.onchange = commit; }
  $$("[data-plk]", pane).forEach(b => b.onclick = () => { const ids = pick.map(id => { const tr = D.tracks.find(x => x.pid === id) || followerFor(pl(id), "none"); return tr.id; });
    D.links.push({ id: uid(), k: b.dataset.plk, ids, c: color, w: 1 }); pick = []; commit(); toast(`${LKIND[b.dataset.plk]} gemaakt. Ze beweegt mee met de spelers.`); });
  const pt = $("#pTeam"); if (pt) pt.onclick = () => { now.forEach(o => { if (o.pl.tm === teamOf && !pick.includes(o.pl.id)) pick.push(o.pl.id); }); renderSide(); };
  const pc = $("#pClr"); if (pc) pc.onclick = () => { pick = []; renderSide(); };
  const T = id => D.tracks.find(x => x.id === id);
  D.tracks.forEach(tr => { bindSeg("ts" + tr.id, v => { tr.style = v; commit(); }); bindCols("tc" + tr.id, c => { tr.c = c; commit(); }); });
  $$("[data-topen]", pane).forEach(b => b.onclick = () => { openTr = openTr === b.dataset.topen ? null : b.dataset.topen; renderSide(); });
  D.links.forEach(L => bindCols("lc" + L.id, c => { L.c = c; commit(); }));
  $$("[data-tn]", pane).forEach(i => { i.oninput = () => { T(i.dataset.tn).name = i.value.slice(0, 24); }; i.onchange = commit; });
  $$("[data-ttr]", pane).forEach(i => i.onchange = () => { T(i.dataset.ttr).trail = i.checked; commit(); });
  $$("[data-thd]", pane).forEach(i => i.onchange = () => { T(i.dataset.thd).hidden = !i.checked; commit(); });
  $$("[data-tgo]", pane).forEach(b => b.onclick = () => seek(+b.dataset.tgo));
  $$("[data-tfix]", pane).forEach(b => b.onclick = () => { vid.pause(); stopFreeze(); fixing = b.dataset.tfix; if (D.players.length) setTool("track"); toast("Tik nu op het beeld de juiste speler aan. Vanaf dit beeld volgt de app hem.", 5000); });
  $$("[data-tmore]", pane).forEach(b => b.onclick = async () => { const tr = T(b.dataset.tmore), l = tr.pts[tr.pts.length - 1]; if (!l) return; await seekTo(vid, l[0]); runTrack(tr, l[0], l[1], l[2]); });
  $$("[data-tdel]", pane).forEach(b => b.onclick = () => { if (!confirm("Deze gevolgde speler verwijderen?")) return; const id = b.dataset.tdel; D.tracks = D.tracks.filter(x => x.id !== id);
    D.links.forEach(L => L.ids = L.ids.filter(x => x !== id)); D.links = D.links.filter(L => L.ids.length >= 2); commit(); });
  $$("[data-ldel]", pane).forEach(b => b.onclick = () => { D.links = D.links.filter(L => L.id !== b.dataset.ldel); commit(); });
}

/* ---------- spelers herkennen over een stuk video ---------- */
function recogniseDialog() {
  if (!vid.videoWidth) return; if (!window.OGVVision) { toast("De herkenning kon niet geladen worden. Herlaad de pagina."); return; }
  const L = dur(), t = vid.currentTime, opts = [];
  if (D.inout) opts.push(["io", `Clip ${fmt(D.inout.a)} – ${fmt(D.inout.b)}`, D.inout.a, D.inout.b]);
  opts.push(["10", `Vanaf hier, 10 s`, t, Math.min(L, t + 10)], ["20", `Vanaf hier, 20 s`, t, Math.min(L, t + 20)]);
  if (L <= 60) opts.push(["all", "Hele video", 0, L]);
  const d = $("#dlg"); let choice = opts[0][0], q = "auto";
  d.innerHTML = `<h2>Spelers herkennen</h2><p>De studio zoekt in elk beeld alle spelers en koppelt ze aan elkaar, ook als ze even achter iemand verdwijnen. Dat gebeurt op je eigen toestel: de video gaat nergens naartoe.</p>
    <div class="field"><span>Welk stuk</span>${seg("vR", opts.map(o => [o[0], o[1]]), choice)}</div>
    <div class="field"><span>Nauwkeurigheid</span>${seg("vQ", [["auto", "Automatisch"], ["fast", "Snel"], ["fine", "Kleine spelers"]], q)}</div>
    <p class="note">Automatisch kijkt zelf of de spelers klein in beeld staan. Snel volstaat als de camera dicht bij de spelers staat. Reken op een halve tot twee minuten per 10 seconden video, sneller op een recente computer.</p>
    <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn ghost" id="vX">Annuleren</button><button class="btn" id="vGo2">Herkennen</button></div>`;
  d.showModal(); bindSeg("vR", v => { choice = v; $$("#vR [data-v]").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === v)); }); bindSeg("vQ", v => { q = v; $$("#vQ [data-v]").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === v)); });
  $("#vX").onclick = () => d.close();
  $("#vGo2").onclick = () => { const o = opts.find(x => x[0] === choice); d.close(); recognise(o[2], o[3], q); };
}
async function recognise(a, b, q) {
  if (tracking || b - a < .3) return; vid.pause(); stopFreeze(); tracking = { stop: false };
  $("#busy").hidden = false; $("#busyMsg").textContent = "Herkenning laden…"; $("#busyStop").onclick = () => { tracking.stop = true; };
  try {
    const res = await OGVVision.analyse(vid.currentSrc || vid.src, { a, b, fps: q === "fast" ? 6 : 8, tiles: q === "fast" ? 0 : q === "fine" ? 2 : "auto", crossOrigin: vid.crossOrigin,
      stopped: () => tracking.stop,
      onProgress: p => { $("#busyMsg").textContent = p.phase === "model" ? "Herkenning laden (eenmalig)…" : p.phase === "link" ? "Spelers aan elkaar koppelen…"
        : `Spelers zoeken… ${Math.round(p.k / p.N * 100)}%${p.eta ? " · nog ongeveer " + (p.eta > 90 ? Math.round(p.eta / 60) + " min" : Math.round(p.eta) + " s") : ""}`; } });
    if (!res.players.length) { toast("Geen spelers gevonden in dit stuk. Staat de camera erg ver? Kies dan Kleine spelers.", 6000); }
    else { const last = Math.max(...res.players.map(p => p.pts[p.pts.length - 1][0]));
      D.players = res.players; D.vis = { a, b: Math.min(b, last), ep: res.ep, n: res.players.length };
      D.tracks.forEach(tr => { if (tr.pid) tr.pid = null; }); pick = [];
      toast(`${res.players.length} spelers herkend${tracking.stop ? " (gestopt)" : ""}. Tik er één of meer aan.`, 5000); }
  } catch (e) { const m = String(e.message || e); toast(m === "BEVEILIGD" ? "Herkennen lukt niet voor deze video (beveiligde bron). Kies de video van je toestel." : "Herkennen lukte niet: " + m, 6000); }
  tracking = null; $("#busy").hidden = true; tab = "track"; setTool("track"); await seekTo(vid, a); commit(); renderTabs();
}
function paneTags(pane) {
  pane.innerHTML = `<h3>Fases taggen</h3><p>Tik een tag om deze fase op ${fmt(vid.currentTime)} te markeren. Zo vind je goals, kansen en balverlies snel terug.</p>
    <div class="row" style="margin-bottom:14px">${TAGS.map(([l, c]) => `<button class="chipbtn" data-tag="${esc(l)}" data-c="${c}" style="border-color:${c}">${esc(l)}</button>`).join("")}</div>
    ${D.tags.length ? `<div class="list">${D.tags.slice().sort((a, b) => a.t - b.t).map(g => `<div class="it" data-gt="${g.t}"><span class="ic" style="background:${g.c};color:#111">${ico("tag", 16)}</span><span class="mn"><b>${esc(g.l)}</b><small>${fmt(g.t)}</small></span><button class="x" data-gdel="${g.id}" aria-label="Verwijderen">${ico("x", 16)}</button></div>`).join("")}</div>` : `<p class="note">Nog geen tags.</p>`}`;
  $$("[data-tag]", pane).forEach(b => b.onclick = () => { D.tags.push({ id: uid(), t: frameT(vid.currentTime), l: b.dataset.tag, c: b.dataset.c }); commit(); toast(`"${b.dataset.tag}" getagd op ${fmt(vid.currentTime)}.`); });
  $$("[data-gt]", pane).forEach(r => r.onclick = e => { if (e.target.closest("[data-gdel]")) return; seek(+r.dataset.gt); });
  $$("[data-gdel]", pane).forEach(b => b.onclick = () => { D.tags = D.tags.filter(g => g.id !== b.dataset.gdel); commit(); });
}
const helpBlock = () => `<h4>Snel aan de slag</h4><div class="kv"><kbd>Spatie</kbd><span>Afspelen / pauzeren</span><kbd>← →</kbd><span>Eén beeld verder of terug</span><kbd>V</kbd><span>Selecteren</span><kbd>P R D</kbd><span>Pass, loopactie, dribbel</span><kbd>O S</kbd><span>Ring, spotlight</span><kbd>Y</kbd><span>Spelers aantikken en volgen</span><kbd>C</kbd><span>Inzoomen</span><kbd>Ctrl Z</kbd><span>Ongedaan maken</span></div>`;

/* ---------- moment bekijken en kopiëren ---------- */
function previewMoment(m) { stopFreeze(); vid.pause(); const from = Math.max(0, m.t - 1.5); vid.currentTime = from; lastT = from - .001; clip = { b: Math.min(dur(), m.t + 2) }; $("#freezeOn").checked = true; setTimeout(() => vid.play().catch(() => {}), 120); }
function copyMomentDialog(m) {
  const d = $("#dlg"); d.innerHTML = `<h2>Tekeningen kopiëren</h2><p>Kopieer de ${m.shapes.length} tekening(en) van dit moment naar een ander beeld, bv. een paar seconden later in dezelfde aanval.</p>
    <div class="field"><span>Naar tijdstip</span><input id="cpT" value="${fmt(Math.min(dur(), m.t + 2))}"></div><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="cpX">Annuleren</button><button class="btn" id="cpGo">Kopiëren</button></div>`;
  d.showModal(); $("#cpX").onclick = () => d.close();
  $("#cpGo").onclick = () => { const v = $("#cpT").value.trim().split(":"), t = v.length > 1 ? (+v[0]) * 60 + parseFloat(v[1].replace(",", ".")) : parseFloat(v[0].replace(",", ".")); if (!isFinite(t)) return;
    const tt = frameT(clamp(t, 0, dur())); let to = D.moments.find(x => Math.abs(x.t - tt) < FRAME * .6); if (!to) { to = { id: uid(), t: tt, hold: m.hold, dur: m.dur, anim: m.anim, zoom: null, shapes: [] }; D.moments.push(to); }
    to.shapes.push(...m.shapes.map(s => ({ ...JSON.parse(JSON.stringify(s)), id: uid() }))); d.close(); commit(); seek(tt); toast("Gekopieerd. Versleep de tekeningen naar hun nieuwe plaats."); };
}

/* ---------- video laden ---------- */
function loadSrc(src, name, path) {
  if (objUrl && objUrl !== src) URL.revokeObjectURL(objUrl); if (src.startsWith("blob:")) objUrl = src;
  vid.crossOrigin = /^https?:/.test(src) ? "anonymous" : null; vid.src = src; vid.load();
  if (name) D.file_name = name; if (path !== undefined) D.file_path = path; $("#drop").hidden = true;
  if ((P.title === "Nieuwe analyse" || !P.title) && name) { P.title = name.replace(/\.[^.]+$/, ""); $("#title").value = P.title; }
}
vid.addEventListener("loadedmetadata", () => { fit(); refresh(); filmstrip(); if (!hist.a.length) snapshot(); });
vid.addEventListener("error", () => toast("Deze video kan niet afgespeeld worden in de browser. Probeer een mp4-bestand."));
function pickFile(f) { if (!f || !f.type.startsWith("video/")) { toast("Kies een videobestand."); return; }
  if (D.file_name && D.file_name !== f.name && D.moments.length && !confirm(`Deze analyse hoort bij "${D.file_name}". Toch "${f.name}" laden?`)) return;
  localFile = f; loadSrc(URL.createObjectURL(f), f.name, D.file_path && D.file_name === f.name ? D.file_path : null); scheduleSave(); renderSide(); }
$("#file").onchange = e => pickFile(e.target.files[0]);
stage.addEventListener("dragover", e => { e.preventDefault(); $("#drop").classList.add("over"); });
stage.addEventListener("dragleave", () => $("#drop").classList.remove("over"));
stage.addEventListener("drop", e => { e.preventDefault(); $("#drop").classList.remove("over"); pickFile(e.dataTransfer.files[0]); });
$("#fromStore").onclick = async () => { let list = []; try { list = await store.videos(); } catch (e) {}
  const d = $("#dlg"); d.innerHTML = `<h2>Video uit mijn opslag</h2>${list.length ? `<div class="list" style="max-height:50vh;overflow:auto">${list.map((x, i) => `<div class="it" data-i="${i}"><span class="ic">${ico("play", 15)}</span><span class="mn"><b>${esc(x.t)}</b><small>${esc(x.name)}</small></span></div>`).join("")}</div>` : `<p>${mode === "local" ? "Meld je aan in OGV Trainers om je opslag te gebruiken." : "Er staan nog geen video's in je opslag. Kies een video van je toestel: de studio biedt daarna aan om ze te bewaren."}</p>`}<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" id="vsX">Sluiten</button></div>`;
  d.showModal(); $("#vsX").onclick = () => d.close();
  $$("[data-i]", d).forEach(r => r.onclick = async () => { const x = list[+r.dataset.i]; d.close(); try { loadSrc(await store.url(x.path), x.name, x.path); scheduleSave(); } catch (e) { toast("Video openen lukt niet."); } }); };
async function uploadLocal() {
  if (!localFile) return; const d = $("#dlg"); d.innerHTML = `<h2>Video bewaren in je opslag</h2><p>Dan opent deze analyse ook op je gsm, tablet of laptop van de club.</p><div class="prog"><i id="upP" style="width:30%"></i></div><p class="note" id="upM">Bezig met uploaden…</p>`; d.showModal();
  try { const path = await store.upload(localFile); D.file_path = path; $("#upP").style.width = "100%"; $("#upM").textContent = "Bewaard."; localFile = null; scheduleSave(); setTimeout(() => d.close(), 700); renderSide(); }
  catch (e) { $("#upM").textContent = e.message || String(e); $("#upP").style.width = "0"; d.insertAdjacentHTML("beforeend", `<div class="row" style="justify-content:flex-end"><button class="btn ghost" onclick="this.closest('dialog').close()">Sluiten</button></div>`); }
}

/* ---------- exporteren ---------- */
$("#exportBtn").onclick = () => {
  if (!vid.videoWidth) { toast("Kies eerst een video."); return; }
  const d = $("#dlg"), vw = vid.videoWidth, a = D.inout?.a ?? 0, b = D.inout?.b ?? dur(), n = D.moments.filter(m => m.t >= a && m.t <= b && m.hold).reduce((s, m) => s + m.hold, 0);
  d.innerHTML = `<h2>Exporteren</h2><p>Maak een video met alle tekeningen, bevriesmomenten, zooms en gevolgde spelers, om te delen met je spelers.</p>
    <div class="field"><span>Welk stuk</span>${seg("exR", [["io", D.inout ? `${fmt(D.inout.a)} – ${fmt(D.inout.b)}` : "Hele video"], ["all", "Hele video"]], "io")}</div>
    <div class="field"><span>Kwaliteit</span>${seg("exQ", [[720, "720p"], [1080, "1080p"]].filter(([h]) => h <= Math.max(720, vid.videoHeight)), Math.min(1080, Math.max(720, vid.videoHeight)) >= 1080 ? 1080 : 720)}</div>
    <label class="chk" style="margin-bottom:8px"><input type="checkbox" id="exIntro" checked> Titelkaart vooraan (2 s)</label>
    <div class="field"><span>Ondertitel op de titelkaart (mag leeg)</span><input id="exSub" placeholder="bv. U13 – opbouw tegen hoge druk" maxlength="70"></div>
    <p class="note">Duur ongeveer ${fmt((b - a) + n + 2)}. Het opnemen gebeurt in echte tijd: laat dit venster open tot het klaar is.</p>
    <div class="row" style="justify-content:space-between;margin-top:8px"><button class="btn ghost" id="exPng">Huidig beeld als afbeelding</button><span class="row"><button class="btn ghost" id="exX">Annuleren</button><button class="btn" id="exGo">Video maken</button></span></div>`;
  d.showModal(); let range = "io", q = +$("#exQ [aria-pressed=true]")?.dataset.v || 720;
  bindSeg("exR", v => { range = v; $$("#exR [data-v]").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === v)); });
  bindSeg("exQ", v => { q = +v; $$("#exQ [data-v]").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === v)); });
  $("#exX").onclick = () => d.close(); $("#exPng").onclick = () => { d.close(); snapshotPng(); };
  $("#exGo").onclick = () => { const r = range === "all" || !D.inout ? [0, dur()] : [D.inout.a, D.inout.b]; exportVideo({ a: r[0], b: r[1], h: q, intro: $("#exIntro").checked, sub: $("#exSub").value.trim() }); };
};
function snapshotPng() { const vw = vid.videoWidth, vh = vid.videoHeight, c = document.createElement("canvas"); c.width = vw; c.height = vh; const x = c.getContext("2d"), st = liveState();
  composeFrame(x, vw, vh, { vid, view: st.view, shapes: st.shapes, t: vid.currentTime, tracks: D.tracks, links: D.links });
  try { c.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = slug(P.title) + "-" + fmt(vid.currentTime).replace(/[:.]/g, "-") + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png"); }
  catch (e) { toast("Afbeelding maken lukt niet voor deze video (beveiligde bron)."); } }
const slug = s => (s || "analyse").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "analyse";
let logoImg = null; (() => { const im = new Image(); im.onload = () => logoImg = im; im.src = "../icons/logo-dark.png"; })();
function drawTitle(x, W, H, k, sub) {
  x.fillStyle = "#0B0C0A"; x.fillRect(0, 0, W, H); const a = Math.min(1, k * 2.5) * Math.min(1, (1 - k) * 4); x.save(); x.globalAlpha = Math.max(0, a);
  x.fillStyle = "#FFD100"; x.fillRect(W * .08, H * .62, W * .12 * Math.min(1, k * 3), H * .012);
  if (logoImg) { const s = H * .16; x.drawImage(logoImg, W * .08, H * .2, s, s); }
  x.fillStyle = "#F4F4F0"; x.font = `900 ${H * .085}px Archivo, Arial, sans-serif`; x.textBaseline = "alphabetic"; x.fillText(P.title || "Analyse", W * .08, H * .55, W * .84);
  if (sub) { x.fillStyle = "#B3B5AB"; x.font = `600 ${H * .045}px Archivo, Arial, sans-serif`; x.fillText(sub, W * .08, H * .72, W * .84); }
  x.fillStyle = "#8F9188"; x.font = `700 ${H * .03}px Archivo, Arial, sans-serif`; x.fillText("OG Vorselaar · Videoanalyse", W * .08, H * .88); x.restore(); }
async function exportVideo({ a, b, h, intro, sub }) {
  const d = $("#dlg"); if (!("MediaRecorder" in window) || !HTMLCanvasElement.prototype.captureStream) { toast("Video maken lukt niet in deze browser. Gebruik Chrome of Edge."); return; }
  const vw = vid.videoWidth, vh = vid.videoHeight, H = Math.min(h, vh) & ~1, W = Math.round(H * vw / vh) & ~1, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  try { x.drawImage(vid, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1); } catch (e) { toast("Deze video komt uit een beveiligde bron: exporteren lukt niet. Kies de video van je toestel."); return; }
  const types = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"], mime = types.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || "";
  const rec = new MediaRecorder(c.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: H >= 1080 ? 9e6 : 5e6 } : {}), chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const total = (b - a) + D.moments.filter(m => m.t >= a && m.t <= b && m.hold).reduce((s, m) => s + m.hold, 0) + (intro ? 2 : 0);
  d.innerHTML = `<h2>Video maken…</h2><p>Laat dit venster open. Het opnemen gebeurt in echte tijd.</p><div class="prog"><i id="exP"></i></div><p class="note" id="exM">Voorbereiden…</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="exStop">Stoppen</button></div>`;
  if (!d.open) d.showModal(); let cancel = false; $("#exStop").onclick = () => { cancel = true; };
  exporting = true; stopFreeze(); vid.pause(); const rate = vid.playbackRate; vid.playbackRate = 1; await seekTo(vid, a);
  const done = new Promise(r => rec.onstop = r); rec.start(250); const t0 = performance.now(); let shown = 0;
  /* titelkaart */
  if (intro) await new Promise(r => { const s = performance.now(); const f = now => { const k = (now - s) / 2000; drawTitle(x, W, H, Math.min(1, k), sub); if (k < 1 && !cancel) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  await new Promise(r => { let fz = null, lastE = a - .001; vid.play().catch(() => {});
    const f = now => { if (cancel) { vid.pause(); r(); return; } const t = vid.currentTime; let view = { x: 0, y: 0, w: 1, h: 1 }, shapes = [];
      if (!fz) { const hit = D.moments.find(m => m.hold > 0 && m.t > lastE && m.t <= t + .01 && m.t <= b); if (hit) { vid.pause(); vid.currentTime = hit.t; fz = { m: hit, s: now }; } }
      if (fz) { const el = (now - fz.s) / 1000; view = camAt(fz.m, el); shapes = shapesAt(fz.m, el); if (el >= fz.m.hold) { lastE = fz.m.t; fz = null; vid.play().catch(() => {}); } }
      else { lastE = Math.max(lastE, t); shapes = D.moments.filter(m => !m.hold && t >= m.t && t <= m.t + (m.dur || 3)).flatMap(m => m.shapes.map(sh => ({ sh, p: m.anim ? clamp((t - m.t) / .45, 0, 1) : 1 }))); }
      composeFrame(x, W, H, { vid, view, shapes, t, tracks: D.tracks, links: D.links });
      const el = (now - t0) / 1000; if (now - shown > 200) { shown = now; $("#exP").style.width = Math.min(100, el / total * 100) + "%"; $("#exM").textContent = `${fmt(el)} van ongeveer ${fmt(total)}`; }
      if (!fz && (t >= b - .02 || vid.ended)) { vid.pause(); setTimeout(r, 150); return; }
      requestAnimationFrame(f); };
    requestAnimationFrame(f); });
  rec.stop(); await done; exporting = false; vid.playbackRate = rate;
  if (cancel) { d.close(); toast("Export gestopt."); return; }
  const type = (rec.mimeType || mime || "video/webm").split(";")[0], ext = type.includes("mp4") ? "mp4" : "webm", url = URL.createObjectURL(new Blob(chunks, { type }));
  d.innerHTML = `<h2>Video klaar</h2><p>${ext === "mp4" ? "Een mp4-bestand: dat speelt overal af, ook via WhatsApp." : "Een WebM-bestand. Dat speelt niet op elke iPhone af; exporteer in Chrome of Edge op een recente computer voor mp4."}</p>
    <video src="${url}" controls style="width:100%;border-radius:10px;background:#000;margin-bottom:12px"></video><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="exC">Sluiten</button><a class="btn" href="${url}" download="${slug(P.title)}.${ext}">Downloaden</a></div>`;
  $("#exC").onclick = () => d.close();
}

/* ---------- in- en uitpunt, moment toevoegen ---------- */
$("#addMoment").onclick = () => { if (!vid.videoWidth) return; const m = ensureMoment(); m.keep = true; tab = "edit"; renderTabs(); commit(); };
$("#setIn").onclick = () => { if (!dur()) return; const t = frameT(vid.currentTime); D.inout = { a: t, b: D.inout && D.inout.b > t + .2 ? D.inout.b : dur() }; commit(); toast("Begin van de clip: " + fmt(t)); };
$("#setOut").onclick = () => { if (!dur()) return; const t = frameT(vid.currentTime); D.inout = { a: D.inout && D.inout.a < t - .2 ? D.inout.a : 0, b: t }; commit(); toast("Einde van de clip: " + fmt(t)); };
$("#undo").onclick = () => { if (hist.i > 0) restore(hist.a[--hist.i]); };
$("#redo").onclick = () => { if (hist.i < hist.a.length - 1) restore(hist.a[++hist.i]); };
$("#title").addEventListener("input", () => scheduleSave());
$("#help").onclick = () => { const d = $("#dlg"); d.innerHTML = `<h2>Zo werkt de videostudio</h2>
  <p>1. Pauzeer op het beeld dat je wil uitleggen. 2. Teken met het gereedschap links: dat maakt een <b>moment</b>. 3. Bij het afspelen bevriest de video daar en verschijnen je tekeningen één voor één, eventueel met inzoomen. 4. Exporteer als video.</p>
  <div class="kv">${[["Spatie", "Afspelen / pauzeren"], ["← / →", "Eén beeld terug / vooruit"], ["Shift + ← / →", "Eén seconde"], ["[ en ]", "Vorig / volgend moment"], ["M", "Moment toevoegen"], ["I en O", "Begin en einde voor export"],
    ...TOOLS.map(t => [t[2], t[1]]), ["Delete", "Geselecteerde tekening wissen"], ["Ctrl + D", "Dupliceren"], ["Ctrl + C / V", "Kopiëren en plakken (ook naar een ander moment)"], ["Pijltjes", "Geselecteerde tekening verschuiven"], ["Ctrl + Z / Shift Z", "Ongedaan maken / opnieuw"], ["Esc", "Zone afsluiten / selectie opheffen"]]
    .map(([k, l]) => `<kbd>${k}</kbd><span>${l}</span>`).join("")}</div><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="hX">Begrepen</button></div>`; d.showModal(); $("#hX").onclick = () => d.close(); };

/* ---------- sneltoetsen ---------- */
let clipboard = null;
document.addEventListener("keydown", e => {
  if ($("#dlg").open) return; const ae = document.activeElement, typing = ae && (ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || (ae.tagName === "INPUT" && !/^(file|checkbox|radio|range|button)$/.test(ae.type)));
  if (typing) { if (e.key === "Escape") ae.blur(); return; } if (ae && ae.tagName === "INPUT") ae.blur();
  if (tracking) { if (e.key === "Escape") tracking.stop = true; return; }
  const k = e.key, ctl = e.ctrlKey || e.metaKey, s = sel && shapeById(sel);
  if (ctl && k.toLowerCase() === "z") { e.preventDefault(); (e.shiftKey ? $("#redo") : $("#undo")).click(); return; }
  if (ctl && k.toLowerCase() === "y") { e.preventDefault(); $("#redo").click(); return; }
  if (ctl && k.toLowerCase() === "d") { e.preventDefault(); dupShape(); return; }
  if (ctl && k.toLowerCase() === "c") { if (s) { clipboard = JSON.parse(JSON.stringify(s.s)); toast("Tekening gekopieerd. Ga naar een ander beeld en druk Ctrl+V."); } return; }
  if (ctl && k.toLowerCase() === "v") { if (clipboard && vid.videoWidth) { const m = ensureMoment(); const c = { ...JSON.parse(JSON.stringify(clipboard)), id: uid() }; m.shapes.push(c); sel = c.id; commit(); } return; }
  if (ctl) return;
  if (k === " ") { e.preventDefault(); playPause(); return; }
  if (k === "Escape") { if (draft) { if (draft.k === "poly" || draft.k === "link") finishPoly(); else draft = null; } else if (fixing) fixing = null; else if (pick.length) { pick = []; renderSide(); } else { sel = null; renderSide(); } return; }
  if (k === "Enter") { finishPoly(); return; }
  if ((k === "Delete" || k === "Backspace") && s) { e.preventDefault(); delShape(); return; }
  if (k.startsWith("Arrow") && s && vid.paused) { e.preventDefault(); const st = e.shiftKey ? .02 : .004, dx = k === "ArrowLeft" ? -st : k === "ArrowRight" ? st : 0, dy = k === "ArrowUp" ? -st : k === "ArrowDown" ? st : 0;
    s.s.pts = s.s.pts.map(q => [q[0] + dx, q[1] + dy]); if (s.s.q) s.s.q = [s.s.q[0] + dx, s.s.q[1] + dy]; clearTimeout(document.ak); document.ak = setTimeout(commit, 400); return; }
  if (k === "ArrowLeft" || k === "ArrowRight") { e.preventDefault(); seek(vid.currentTime + (k === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : FRAME)); return; }
  if (k === "[" || k === "]") { const t = vid.currentTime, m = k === "[" ? [...D.moments].reverse().find(x => x.t < t - .01) : D.moments.find(x => x.t > t + .01); if (m) { selM = m.id; sel = null; seek(m.t); } return; }
  if (k === "?") { $("#help").click(); return; }
  const lk = k.toLowerCase();
  if (lk === "m") { $("#addMoment").click(); return; } if (lk === "i") { $("#setIn").click(); return; }
  const t = TOOLS.find(x => x[2].toLowerCase() === lk); if (t) { setTool(t[0]); return; }
  if (lk === "e") $("#setOut").click();
});

/* ---------- opstarten ---------- */
(async function boot() {
  renderRail(); setTool("pass"); hint("");
  await store.init();
  const q = new URLSearchParams(location.search), id = q.get("p");
  if (id) { try { P = await store.get(id); } catch (e) { P = null; } if (!P) { $("#drop b").textContent = "Analyse niet gevonden"; $("#drop span").textContent = mode === "local" ? "Meld je eerst aan in OGV Trainers." : "Ze is misschien verwijderd."; } }
  if (!P) P = { id: null, kind: "videoproject", title: "Nieuwe analyse", data: {} };
  D = normData(P.data); P.data = D; $("#title").value = P.title || "Nieuwe analyse";
  $("#saved").textContent = mode === "local" ? (LOCAL ? "Testmodus: bewaart op dit toestel" : "Niet aangemeld: bewaart op dit toestel") : P.id ? "Bewaard" : "";
  if (D.file_path) { try { loadSrc(await store.url(D.file_path), D.file_name, D.file_path); } catch (e) { toast("De video in je opslag kon niet geladen worden."); } }
  else if (D.file_name) { $("#drop b").textContent = `Kies opnieuw "${D.file_name}"`; $("#drop span").textContent = "Deze video staat alleen op het toestel waarmee je de analyse maakte."; }
  fit(); refresh(); updUndo(); requestAnimationFrame(tick);
})();
