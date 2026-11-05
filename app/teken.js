/* OGV Platform — tekentool voor oefeningen.
   Een tekening is { field, vert, bg, objs: [...] } met coördinaten in procent van de breedte (x) en hoogte (y).
   Voorwerpen: spelers (p, k, tr), materiaal, lijnen (pass, run, drib, shot, line) met optionele bocht (cx, cy),
   vlakken (zone, oval) en tekst. Extra eigenschappen: c (kleur), s (grootte), r (draaiing in graden), n (nummer of tekst). */
"use strict";

const FIELDS = {
  "5v5": { l: "5v5-veld · 35 × 25 m", r: 25 / 35 },
  "8v8": { l: "8v8-veld · 60 × 40 m", r: 40 / 60 },
  "11v11": { l: "Groot veld · 105 × 68 m", r: 68 / 105 },
  "half": { l: "Half veld", r: 68 / 52.5, fixed: true },
  "box": { l: "Strafschopgebied", r: .62, fixed: true },
  "small": { l: "Klein veldje · 20 × 15 m", r: .75 },
  "square": { l: "Vrij vlak", r: .7 },
  "square1": { l: "Vrij vlak, vierkant", r: 1, fixed: true }
};
const PCOL = { geel: ["#FFD100", "#000"], zwart: ["#161616", "#fff"], blauw: ["#2563EB", "#fff"], rood: ["#E11D48", "#fff"], wit: ["#F5F5F0", "#000"], oranje: ["#FF7A1A", "#000"], groen: ["#16A34A", "#fff"], paars: ["#7C3AED", "#fff"] };
const COLS = Object.fromEntries(Object.entries(PCOL).map(([k, v]) => [k, v[0]]));
const ARROWS = new Set(["pass", "run", "drib", "shot", "line", "lob"]);
const TWO_PT = new Set([...ARROWS, "meas"]);
const LINEISH = new Set([...TWO_PT, "zone", "oval"]);
const ROTATABLE = new Set(["goal", "mini", "ladder", "hurdle", "pop", "txt", "flag", "gate", "conerow", "rebound", "pole", "cone"]);
const LEGACY_P = { p1: "geel", p2: "zwart", p3: "blauw" };
/* standaardkleur per soort voorwerp; op een wit blad worden witte lijnen donker */
const defCol = (t, bg) => ({ p: "geel", k: "groen", tr: "zwart", cone: "oranje", pot: "geel", pole: "rood", ring: "blauw", pop: "blauw", zone: "geel", oval: "blauw", mini: "oranje", rebound: "blauw",
  ladder: "geel", hurdle: "blauw", gate: "oranje", conerow: "geel", step: "oranje", flag: "rood", pen: "zwart", meas: bg === "wit" ? "zwart" : "wit",
  pass: "zwart", drib: "zwart", shot: "rood", lob: "zwart", run: bg === "wit" ? "zwart" : "wit", line: bg === "wit" ? "zwart" : "wit", txt: bg === "wit" ? "zwart" : "wit" })[t] || "wit";
/* oude keepers (zonder kleur) bleven lichtgrijs */
const colOf = (o, bg) => o.c || LEGACY_P[o.t] || (o.t === "k" && !o.c && o.legacyK ? "keeper" : defCol(o.t, bg));

function dgDims(dg) { const F = FIELDS[dg.field] || FIELDS["5v5"], rot = !!dg.vert && !F.fixed; return { F, rot, W: 100, H: +(100 * (rot ? 1 / F.r : F.r)).toFixed(2) }; }

/* veldlijnen in liggende stand op een vlak van W × H */
function fieldLines(f, W, H, lc) {
  const u = W / 100, L = `fill="none" stroke="${lc}" stroke-width="${.35 * u}"`, out = `<rect x="${u}" y="${u}" width="${W - 2 * u}" height="${H - 2 * u}" ${L}/>`;
  if (f === "square" || f === "square1") return `<rect x="${u}" y="${u}" width="${W - 2 * u}" height="${H - 2 * u}" ${L} stroke-dasharray="${u} ${u}"/>`;
  if (f === "small") return out + `<path d="M${W / 2} ${u}V${H - u}" ${L}/>`;
  if (f === "half") { const bw = W * .59, bh = H * .24, sw = W * .27, sh = H * .08, g = W * .11;
    return out + `<path d="M${(W - bw) / 2} ${u}v${bh}h${bw}v-${bh}M${(W - sw) / 2} ${u}v${sh}h${sw}v-${sh}" ${L}/><path d="M${W / 2 - W * .13} ${H - u}a${W * .13} ${W * .13} 0 0 1 ${W * .26} 0" ${L}/>
      <path d="M${W / 2 - W * .13} ${u + bh}a${W * .13} ${W * .13} 0 0 0 ${W * .26} 0" ${L} stroke-dasharray="0"/><circle cx="${W / 2}" cy="${u + H * .16}" r="${.5 * u}" fill="${lc}"/><rect x="${(W - g) / 2}" y="${-.8 * u}" width="${g}" height="${1.6 * u}" fill="#fff"/>`; }
  if (f === "box") { const bw = 84, bh = 34, sw = 38, sh = 11.5, g = 15;
    return `<path d="M0 ${u}H${W}" ${L}/><path d="M${(W - bw) / 2} ${u}v${bh}h${bw}v-${bh}M${(W - sw) / 2} ${u}v${sh}h${sw}v-${sh}" ${L}/><circle cx="${W / 2}" cy="${u + 23}" r=".6" fill="${lc}"/>
      <path d="M${W / 2 - 14.5} ${u + bh}a19 19 0 0 0 29 0" ${L}/><rect x="${(W - g) / 2}" y="-.8" width="${g}" height="1.6" fill="#fff"/>`; }
  const big = f === "11v11", bx = W * (f === "5v5" ? .09 : f === "8v8" ? .12 : .157), by = H * (big ? .59 : .5), r = H * (big ? .135 : f === "8v8" ? .16 : .2);
  const pen = big ? `<rect x="${u}" y="${(H - H * .27) / 2}" width="${W * .052}" height="${H * .27}" ${L}/><rect x="${W - u - W * .052}" y="${(H - H * .27) / 2}" width="${W * .052}" height="${H * .27}" ${L}/><circle cx="${W * .105}" cy="${H / 2}" r="${.45 * u}" fill="${lc}"/><circle cx="${W - W * .105}" cy="${H / 2}" r="${.45 * u}" fill="${lc}"/>` : "";
  return out + `<path d="M${W / 2} ${u}V${H - u}" ${L}/><circle cx="${W / 2}" cy="${H / 2}" r="${r}" ${L}/><circle cx="${W / 2}" cy="${H / 2}" r="${.45 * u}" fill="${lc}"/>
    <rect x="${u}" y="${(H - by) / 2}" width="${bx}" height="${by}" ${L}/><rect x="${W - u - bx}" y="${(H - by) / 2}" width="${bx}" height="${by}" ${L}/>${pen}
    <rect x="${-.6 * u}" y="${H / 2 - H * .07}" width="${1.6 * u}" height="${H * .14}" fill="#fff"/><rect x="${W - u}" y="${H / 2 - H * .07}" width="${1.6 * u}" height="${H * .14}" fill="#fff"/>`;
}

/* punten langs een rechte of gebogen lijn */
function curvePts(o, W, H) {
  const A = [o.x * W / 100, o.y * H / 100], B = [o.x2 * W / 100, o.y2 * H / 100], C = o.cx != null ? [o.cx * W / 100, o.cy * H / 100] : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const at = t => [(1 - t) ** 2 * A[0] + 2 * (1 - t) * t * C[0] + t * t * B[0], (1 - t) ** 2 * A[1] + 2 * (1 - t) * t * C[1] + t * t * B[1]];
  const der = t => [2 * (1 - t) * (C[0] - A[0]) + 2 * t * (B[0] - C[0]), 2 * (1 - t) * (C[1] - A[1]) + 2 * t * (B[1] - C[1])];
  return { A, B, C, at, der };
}
function arrowSVG(o, W, H, col, tag, bg) {
  const s = o.s || 1, { A, B, C, at, der } = curvePts(o, W, H), len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, curved = o.cx != null;
  const head = o.t === "line" || o.nohead ? 0 : (o.t === "shot" ? 2.3 : 1.7) * s, dEnd = der(1), dl = Math.hypot(...dEnd) || 1, ux = dEnd[0] / dl, uy = dEnd[1] / dl;
  const E = [B[0] - ux * head * .8, B[1] - uy * head * .8];
  let d;
  if (o.t === "drib") { const n = Math.max(4, Math.round(len / 2.2)); d = `M${A[0]} ${A[1]}`;
    for (let i = 1; i <= n; i++) { const t = i / n * .94, p = at(t), dv = der(t), l = Math.hypot(...dv) || 1, a = (i % 2 ? 1 : -1) * 1 * s * (i >= n - 1 ? .3 : 1); d += ` L${p[0] - dv[1] / l * a} ${p[1] + dv[0] / l * a}`; }
    d += ` L${E[0]} ${E[1]}`; }
  else d = curved ? `M${A[0]} ${A[1]}Q${C[0]} ${C[1]} ${E[0]} ${E[1]}` : `M${A[0]} ${A[1]}L${E[0]} ${E[1]}`;
  const w = (o.t === "shot" ? .95 : o.t === "line" ? .45 : .55) * s;
  const dash = o.t === "run" ? `stroke-dasharray="${1.5 * s} ${1 * s}"` : o.t === "lob" ? `stroke-dasharray=".05 ${1.1 * s}"` : o.dash ? `stroke-dasharray="1 1"` : "";
  const lw = o.t === "lob" ? w * 1.5 : w;
  const hd = head ? `<path d="M${B[0]} ${B[1]}L${B[0] - ux * head - uy * head * .55} ${B[1] - uy * head + ux * head * .55}L${B[0] - ux * head + uy * head * .55} ${B[1] - uy * head - ux * head * .55}Z" fill="${col}"/>` : "";
  const extra = o.t === "shot" ? `<path d="${d}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="${w * .35}" stroke-linecap="round"/>` : "";
  return `<g ${tag}><path d="${d}" fill="none" stroke="${col}" stroke-width="${lw}" ${dash} stroke-linecap="round" stroke-linejoin="round"/>${extra}${hd}<path d="${curved ? `M${A[0]} ${A[1]}Q${C[0]} ${C[1]} ${B[0]} ${B[1]}` : `M${A[0]} ${A[1]}L${B[0]} ${B[1]}`}" stroke="transparent" stroke-width="4" fill="none"/></g>`;
}
/* vrije lijn met de pen: vloeiend door de punten */
function penPath(pts, W, H) {
  const P = pts.map(([x, y]) => [x * W / 100, y * H / 100]); if (!P.length) return "";
  let d = `M${P[0][0]} ${P[0][1]}`; for (let i = 1; i < P.length - 1; i++) { const m = [(P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2]; d += ` Q${P[i][0]} ${P[i][1]} ${m[0]} ${m[1]}`; }
  if (P.length > 1) d += ` L${P[P.length - 1][0]} ${P[P.length - 1][1]}`; return d;
}
/* doel van bovenaf: palen, lat en net; de opening kijkt naar +x */
const goalShape = (w, d, frame, post) => { const n = Math.max(3, Math.round(w / .9)), m = Math.max(2, Math.round(d / .9));
  return `<path d="M.2 ${w / 2 + .5}L${-d + .2} ${w / 2 + .5}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/><rect x="${-d}" y="${-w / 2}" width="${d}" height="${w}" fill="rgba(255,255,255,.22)"/>
    <g stroke="rgba(255,255,255,.55)" stroke-width=".1">${Array.from({ length: n - 1 }, (_, k) => `<path d="M${-d} ${-w / 2 + (k + 1) * w / n}h${d}"/>`).join("")}${Array.from({ length: m - 1 }, (_, k) => `<path d="M${-d + (k + 1) * d / m} ${-w / 2}v${w}"/>`).join("")}</g>
    <path d="M0 ${-w / 2}H${-d}V${w / 2}H0" fill="none" stroke="${frame}" stroke-width="${post * .55}" stroke-linejoin="round"/>
    <path d="M0 ${-w / 2}V${w / 2}" stroke="${frame}" stroke-width="${post}" stroke-linecap="round"/><path d="M0 ${-w / 2}V${w / 2}" stroke="rgba(0,0,0,.35)" stroke-width="${post * .25}" stroke-linecap="round"/>`; };
function objSVG(o, i, W, H, bg) {
  const x = o.x * W / 100, y = o.y * H / 100, s = o.s || 1, tag = `data-i="${i}"`, ck = colOf(o, bg), col = ck === "keeper" ? "#F2F2EE" : COLS[ck] || ck;
  const hit = (r = 3) => `<circle cx="${x}" cy="${y}" r="${r * s}" fill="transparent"/>`, rot = (inner, def = 0) => `<g transform="translate(${x} ${y}) rotate(${o.r ?? def}) scale(${s})">${inner}</g>`;
  const t = LEGACY_P[o.t] ? "p" : o.t, dark = "rgba(0,0,0,.55)";
  if (ARROWS.has(t)) return arrowSVG(o, W, H, col, tag, bg);
  if (t === "pen") { const d = penPath(o.pts || [], W, H), P = (o.pts || []).map(([a, b]) => [a * W / 100, b * H / 100]), n = P.length;
    let hd = ""; if (o.head && n > 2) { const B = P[n - 1], A = P[Math.max(0, n - 4)], l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, ux = (B[0] - A[0]) / l, uy = (B[1] - A[1]) / l, h = 1.7 * s;
      hd = `<path d="M${B[0] + ux * .6} ${B[1] + uy * .6}L${B[0] - ux * h - uy * h * .55} ${B[1] - uy * h + ux * h * .55}L${B[0] - ux * h + uy * h * .55} ${B[1] - uy * h - ux * h * .55}Z" fill="${col}"/>`; }
    return `<g ${tag}><path d="${d}" fill="none" stroke="${col}" stroke-width="${.55 * s}" stroke-linecap="round" stroke-linejoin="round" ${o.dash ? 'stroke-dasharray="1.5 1"' : ""}/>${hd}<path d="${d}" fill="none" stroke="transparent" stroke-width="4"/></g>`; }
  if (t === "meas") { const x2 = o.x2 * W / 100, y2 = o.y2 * H / 100, l = Math.hypot(x2 - x, y2 - y) || 1, nx = -(y2 - y) / l, ny = (x2 - x) / l, tk = 1.3, lab = o.n ?? "10 m", mx = (x + x2) / 2, my = (y + y2) / 2, fw = Math.max(3, String(lab).length * 1.25);
    return `<g ${tag}><path d="M${x} ${y}L${x2} ${y2}M${x + nx * tk} ${y + ny * tk}L${x - nx * tk} ${y - ny * tk}M${x2 + nx * tk} ${y2 + ny * tk}L${x2 - nx * tk} ${y2 - ny * tk}" stroke="${col}" stroke-width=".3" fill="none"/>
      ${lab ? `<rect x="${mx - fw / 2}" y="${my - 1.35}" width="${fw}" height="2.7" rx="1.2" fill="${ck === "wit" ? "#1E5A2E" : "#fff"}" stroke="${col}" stroke-width=".2"/><text x="${mx}" y="${my + .75}" text-anchor="middle" font-size="2" font-weight="800" fill="${ck === "wit" ? "#fff" : col}" font-family="Archivo,Arial">${esc(lab)}</text>` : ""}
      <path d="M${x} ${y}L${x2} ${y2}" stroke="transparent" stroke-width="4"/></g>`; }
  if (t === "zone" || t === "oval") { const x2 = o.x2 * W / 100, y2 = o.y2 * H / 100, X = Math.min(x, x2), Y = Math.min(y, y2), w = Math.abs(x2 - x), h = Math.abs(y2 - y), st = `fill="${col}" fill-opacity="${o.solid ? .38 : .2}" stroke="${col}" stroke-width=".4" ${o.solid ? "" : 'stroke-dasharray="1.2 .8"'}`;
    const lab = o.n ? `<text x="${X + w / 2}" y="${Y + h / 2 + .8}" text-anchor="middle" font-size="2.4" font-weight="800" fill="#fff" stroke="#000" stroke-width=".25" paint-order="stroke" font-family="Archivo,Arial">${esc(o.n)}</text>` : "";
    return `<g ${tag}>${t === "zone" ? `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx=".6" ${st}/>` : `<ellipse cx="${X + w / 2}" cy="${Y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${st}/>`}${lab}</g>`; }
  if (t === "p" || t === "k") { const [fc, tc] = ck === "keeper" ? ["#F2F2EE", "#000"] : PCOL[ck] || PCOL.geel, R = 2.3 * s;
    const nm = o.nm ? `<text x="${x}" y="${y + R + 2 * s}" text-anchor="middle" font-size="${1.75 * s}" font-weight="800" fill="#fff" stroke="#000" stroke-width=".3" paint-order="stroke" font-family="Archivo,Arial">${esc(o.nm)}</text>` : "";
    return `<g ${tag}>${hit()}<ellipse cx="${x + .25 * s}" cy="${y + .45 * s}" rx="${R}" ry="${R * .92}" fill="rgba(0,0,0,.28)"/><circle cx="${x}" cy="${y}" r="${R}" fill="${fc}" stroke="${ck === "zwart" ? "#fff" : "#111"}" stroke-width="${t === "k" ? .5 : .3}"/>
      ${t === "k" ? `<path d="M${x - R * .62} ${y - R * .62}a${R * .85} ${R * .85} 0 0 1 ${R * 1.24} 0" fill="none" stroke="${tc}" stroke-width=".3" opacity=".55"/>` : `<path d="M${x - R * .7} ${y - R * .45}a${R * .8} ${R * .8} 0 0 1 ${R * 1.4} 0" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".3"/>`}
      ${o.n ? `<text x="${x}" y="${y + .9 * s}" text-anchor="middle" font-size="${(String(o.n).length > 2 ? 1.8 : 2.5) * s}" font-weight="800" fill="${tc}" font-family="Archivo,Arial">${esc(o.n)}</text>` : ""}${nm}</g>`; }
  if (t === "tr") return `<g ${tag}>${hit()}<rect x="${x - 2.2 * s + .3}" y="${y - 2.2 * s + .45}" width="${4.4 * s}" height="${4.4 * s}" rx="${1 * s}" fill="rgba(0,0,0,.28)"/><rect x="${x - 2.2 * s}" y="${y - 2.2 * s}" width="${4.4 * s}" height="${4.4 * s}" rx="${1 * s}" fill="${col}" stroke="#fff" stroke-width=".3"/><text x="${x}" y="${y + .9 * s}" text-anchor="middle" font-size="${2.5 * s}" font-weight="800" fill="${ck === "wit" || ck === "geel" ? "#000" : "#fff"}" font-family="Archivo,Arial">${esc(o.n || "T")}</text>${o.nm ? `<text x="${x}" y="${y + 4.3 * s}" text-anchor="middle" font-size="${1.75 * s}" font-weight="800" fill="#fff" stroke="#000" stroke-width=".3" paint-order="stroke" font-family="Archivo,Arial">${esc(o.nm)}</text>` : ""}</g>`;
  if (t === "step") return `<g ${tag}>${hit(2.2)}<circle cx="${x}" cy="${y}" r="${1.55 * s}" fill="${col}" stroke="#fff" stroke-width=".3"/><text x="${x}" y="${y + .65 * s}" text-anchor="middle" font-size="${1.8 * s}" font-weight="900" fill="${ck === "geel" || ck === "wit" || ck === "oranje" ? "#000" : "#fff"}" font-family="Archivo,Arial">${esc(o.n || "1")}</text></g>`;
  if (t === "cone") return `<g ${tag}>${hit(2.4)}${rot(`<ellipse cy="1.15" rx="1.9" ry=".55" fill="rgba(0,0,0,.3)"/><path d="M0 -1.9L1.45 1.05H-1.45Z" fill="${col}"/><path d="M0 -1.9L1.45 1.05H0Z" fill="rgba(0,0,0,.2)"/><path d="M-.62 -.45H.62L.86 .1H-.86Z" fill="rgba(255,255,255,.75)"/><rect x="-1.75" y=".95" width="3.5" height=".38" rx=".15" fill="${col}" stroke="${dark}" stroke-width=".12"/>`)}</g>`;
  if (t === "pot") return `<g ${tag}>${hit(2.2)}${rot(`<ellipse cy=".3" rx="1.45" ry=".9" fill="rgba(0,0,0,.28)"/><ellipse rx="1.4" ry=".85" fill="${col}" stroke="${dark}" stroke-width=".15"/><ellipse cy="-.12" rx=".55" ry=".32" fill="rgba(0,0,0,.3)"/><path d="M-1.1 -.35a1.3 .7 0 0 1 1.3 -.45" stroke="rgba(255,255,255,.6)" stroke-width=".18" fill="none"/>`)}</g>`;
  if (t === "pole") return `<g ${tag}>${hit(2.6)}${rot(`<ellipse cy=".75" rx="1.1" ry=".5" fill="#333"/><rect x="-.32" y="-3.2" width=".64" height="3.9" rx=".25" fill="${col}"/>${[-2.6, -1.6, -.6].map(yy => `<rect x="-.32" y="${yy}" width=".64" height=".45" fill="#fff"/>`).join("")}<circle cy="-3.2" r=".34" fill="${col}"/>`)}</g>`;
  if (t === "ring") return `<g ${tag}>${hit(2.6)}${rot(`<circle cx=".2" cy=".3" r="1.9" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".5"/><circle r="1.9" fill="none" stroke="${col}" stroke-width=".5"/><path d="M-1.3 -1.1a1.7 1.7 0 0 1 1.7 -.75" stroke="rgba(255,255,255,.65)" stroke-width=".18" fill="none"/>`)}</g>`;
  if (t === "pop") return `<g ${tag}>${hit(2.8)}${rot(`<ellipse cy="2.3" rx="1.7" ry=".55" fill="rgba(0,0,0,.3)"/><path d="M-1.45 2.1V-.2Q-1.45 -1.25 -.55 -1.35H.55Q1.45 -1.25 1.45 -.2V2.1Z" fill="${col}" stroke="#111" stroke-width=".2"/><circle cy="-2.25" r=".85" fill="${col}" stroke="#111" stroke-width=".2"/><path d="M-1.45 .4H1.45" stroke="rgba(255,255,255,.4)" stroke-width=".2"/>`)}</g>`;
  if (t === "ball") return `<g ${tag}>${hit(2.2)}<ellipse cx="${x + .2 * s}" cy="${y + .35 * s}" rx="${1 * s}" ry="${.85 * s}" fill="rgba(0,0,0,.3)"/><circle cx="${x}" cy="${y}" r="${1 * s}" fill="#fff" stroke="#111" stroke-width=".2"/>
    <path d="M${x} ${y - .38 * s}l${.36 * s} ${.26 * s} -${.14 * s} ${.42 * s}h-${.44 * s}l-${.14 * s} -${.42 * s}z" fill="#111"/><path d="M${x} ${y - .38 * s}V${y - 1 * s}M${x + .36 * s} ${y - .12 * s}L${x + .95 * s} ${y - .3 * s}M${x + .22 * s} ${y + .3 * s}L${x + .55 * s} ${y + .82 * s}M${x - .22 * s} ${y + .3 * s}L${x - .55 * s} ${y + .82 * s}M${x - .36 * s} ${y - .12 * s}L${x - .95 * s} ${y - .3 * s}" stroke="#111" stroke-width=".12"/></g>`;
  if (t === "net") return `<g ${tag}>${hit(3)}${rot(`<ellipse cy="2" rx="2.6" ry=".7" fill="rgba(0,0,0,.3)"/><path d="M-2.3 -1.2Q-2.6 2.2 0 2.3Q2.6 2.2 2.3 -1.2Z" fill="rgba(0,0,0,.2)" stroke="#fff" stroke-width=".18"/><path d="M-2.2 0H2.2M-2 1.2H2M-1 -1.2L-.8 2.3M1 -1.2L.8 2.3" stroke="rgba(255,255,255,.5)" stroke-width=".1"/>${[[-1.2, -1.3], [.1, -1.6], [1.3, -1.25], [-.6, -.3], [.8, -.25], [0, .8]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r=".72" fill="#fff" stroke="#111" stroke-width=".15"/><circle cx="${a}" cy="${b}" r=".25" fill="#111"/>`).join("")}<path d="M-2.4 -1.25Q0 -.6 2.4 -1.25" stroke="#fff" stroke-width=".22" fill="none"/>`)}</g>`;
  if (t === "goal") return `<g ${tag}>${hit(4.6)}${rot(goalShape(9.5, 3, "#fff", .95), o.x < 50 ? 0 : 180)}</g>`;
  if (t === "mini") return `<g ${tag}>${hit(3.2)}${rot(goalShape(5, 1.9, col, .7), o.x < 50 ? 0 : 180)}</g>`;
  if (t === "rebound") return `<g ${tag}>${hit(3)}${rot(`<rect x="-.25" y="-3" width="1.6" height="6" rx=".3" fill="rgba(0,0,0,.3)"/><rect x="-.6" y="-3" width="1.2" height="6" rx=".3" fill="rgba(255,255,255,.25)" stroke="${col}" stroke-width=".4"/><g stroke="rgba(255,255,255,.75)" stroke-width=".1">${[-2, -1, 0, 1, 2].map(k => `<path d="M-.6 ${k}h1.2"/>`).join("")}<path d="M0 -3v6"/></g>`)}</g>`;
  if (t === "ladder") return `<g ${tag}>${hit(3)}${rot(`<g stroke="${col}" fill="none" stroke-linecap="round"><path d="M-1.3 -5.2V5.2M1.3 -5.2V5.2" stroke-width=".38"/>${[-4, -2, 0, 2, 4].map(k => `<path d="M-1.3 ${k}H1.3" stroke-width=".42"/>`).join("")}</g><g stroke="rgba(0,0,0,.35)" stroke-width=".12"><path d="M-1.1 -5.2V5.2M1.5 -5.2V5.2"/></g>`)}</g>`;
  if (t === "hurdle") return `<g ${tag}>${hit(2.4)}${rot(`<path d="M-1.9 1.2H-1.2M1.2 1.2H1.9" stroke="#333" stroke-width=".35" stroke-linecap="round"/><path d="M-1.55 1.2V-1H1.55V1.2" fill="none" stroke="${col}" stroke-width=".48" stroke-linejoin="round"/><path d="M-1.55 -1H1.55" stroke="rgba(255,255,255,.55)" stroke-width=".14"/>`)}</g>`;
  if (t === "gate") return `<g ${tag}>${hit(3)}${rot([-2.4, 2.4].map(gx => `<g transform="translate(0 ${gx})"><ellipse cy=".9" rx="1.3" ry=".4" fill="rgba(0,0,0,.3)"/><path d="M0 -1.4L1.05 .8H-1.05Z" fill="${col}"/><path d="M0 -1.4L1.05 .8H0Z" fill="rgba(0,0,0,.2)"/><rect x="-1.25" y=".7" width="2.5" height=".3" fill="${col}"/></g>`).join("") + `<path d="M0 -1.6V1.6" stroke="rgba(255,255,255,.6)" stroke-width=".18" stroke-dasharray=".5 .4"/>`)}</g>`;
  if (t === "conerow") return `<g ${tag}>${hit(3.2)}${rot([-6, -3, 0, 3, 6].map(cx => `<ellipse cx="${cx}" rx="1.1" ry=".7" fill="${col}" stroke="${dark}" stroke-width=".13"/><ellipse cx="${cx}" cy="-.1" rx=".42" ry=".26" fill="rgba(0,0,0,.3)"/>`).join(""))}<rect x="${x - 7 * s}" y="${y - 1.5 * s}" width="${14 * s}" height="${3 * s}" fill="transparent"/></g>`;
  if (t === "flag") return `<g ${tag}>${hit(2.4)}${rot(`<ellipse cy="1" rx=".8" ry=".3" fill="rgba(0,0,0,.3)"/><path d="M0 1V-3" stroke="#eee" stroke-width=".32" stroke-linecap="round"/><path d="M.15 -3L2.4 -2.3L.15 -1.5Z" fill="${col}"/><path d="M.15 -3L1.3 -2.65V-1.95L.15 -1.5Z" fill="rgba(255,255,255,.35)"/>`)}</g>`;
  if (t === "txt") { const fs = 2.6 * s, len = String(o.n || "Tekst").length; return `<g ${tag}><text transform="translate(${x} ${y}) rotate(${o.r || 0})" font-size="${fs}" font-weight="800" fill="${col}" stroke="${ck === "zwart" ? "#fff" : "#000"}" stroke-width=".28" paint-order="stroke" font-family="Archivo,Arial" text-anchor="middle" dominant-baseline="middle">${esc(o.n || "Tekst")}</text><rect x="${x - fs * len * .3}" y="${y - fs * .7}" width="${fs * len * .6}" height="${fs * 1.4}" fill="transparent"/></g>`; }
  return "";
}
/* selectiekader en grepen */
function selSVG(o, W, H) {
  if (!o) return "";
  const p = (a, b) => [a * W / 100, b * H / 100], h = (k, [x, y]) => `<circle data-h="${k}" cx="${x}" cy="${y}" r="1.5" fill="#FFD100" stroke="#000" stroke-width=".3" style="cursor:grab"/>`;
  if (ARROWS.has(o.t)) { const { A, B, at } = curvePts(o, W, H), C = o.cx != null ? at(.5) : at(.5);
    return `<path d="M${A[0]} ${A[1]}${o.cx != null ? `Q${p(o.cx, o.cy).join(" ")} ` : "L"}${B[0]} ${B[1]}" fill="none" stroke="#FFD100" stroke-width="1.6" stroke-opacity=".3" pointer-events="none"/>${h("a", A)}${h("b", B)}<circle data-h="c" cx="${C[0]}" cy="${C[1]}" r="1.2" fill="#fff" stroke="#000" stroke-width=".3" style="cursor:grab"/>`; }
  if (o.t === "meas") return h("a", p(o.x, o.y)) + h("b", p(o.x2, o.y2));
  if (o.t === "pen") { const P = (o.pts || []).map(([a, b]) => p(a, b)); if (!P.length) return ""; const xs = P.map(q => q[0]), ys = P.map(q => q[1]);
    return `<rect x="${Math.min(...xs) - 1}" y="${Math.min(...ys) - 1}" width="${Math.max(...xs) - Math.min(...xs) + 2}" height="${Math.max(...ys) - Math.min(...ys) + 2}" fill="none" stroke="#FFD100" stroke-width=".35" stroke-dasharray="1 .7" pointer-events="none"/>`; }
  if (o.t === "zone" || o.t === "oval") { const A = p(o.x, o.y), B = p(o.x2, o.y2);
    return `<rect x="${Math.min(A[0], B[0])}" y="${Math.min(A[1], B[1])}" width="${Math.abs(B[0] - A[0])}" height="${Math.abs(B[1] - A[1])}" fill="none" stroke="#FFD100" stroke-width=".35" pointer-events="none"/>${h("a", A)}${h("b", B)}`; }
  const [x, y] = p(o.x, o.y), r = ({ goal: 5.8, ladder: 5.8, conerow: 7.4, rebound: 3.4, gate: 3.6, txt: 3 }[o.t] || 3.3) * (o.s || 1);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#FFD100" stroke-width=".45" stroke-dasharray="1 .7" pointer-events="none"/>`;
}
function diagramSVG(dg, opts = {}) {
  dg = dg || { field: "5v5", objs: [] }; const { rot, W, H } = dgDims(dg), wit = dg.bg === "wit", lc = wit ? "#9AA79C" : "rgba(255,255,255,.8)";
  const bands = Array.from({ length: 10 }, (_, k) => k % 2 ? (rot ? `<rect x="0" y="${k * H / 10}" width="${W}" height="${H / 10}" fill="rgba(255,255,255,.045)"/>` : `<rect x="${k * W / 10}" y="0" width="${W / 10}" height="${H}" fill="rgba(255,255,255,.045)"/>`) : "").join("");
  const lines = rot ? `<g transform="translate(${W} 0) rotate(90)">${fieldLines(dg.field, H, W, lc)}</g>` : fieldLines(dg.field, W, H, lc);
  const objs = (dg.objs || []).map((o, i) => objSVG(o, i, W, H, dg.bg)).join("");
  const M = 3;
  return `<svg class="dg" viewBox="${-M} ${-M} ${W + 2 * M} ${H + 2 * M}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Veldtekening"${opts.size ? ` width="${opts.size}" height="${Math.round(opts.size * (H + 2 * M) / (W + 2 * M))}"` : ""}>
    <rect x="${-M}" y="${-M}" width="${W + 2 * M}" height="${H + 2 * M}" fill="${wit ? "#FFFFFF" : "#2F7D3B"}"/>${wit ? "" : bands}${lines}${objs}${opts.sel != null && opts.sel >= 0 ? selSVG(dg.objs[opts.sel], W, H) : ""}</svg>`;
}

/* ============ snelle opstellingen en organisaties (liggend veld, eigen ploeg speelt naar rechts) ============ */
const DG_PRESETS = [
  ["5v5: eigen ploeg (keeper + ruit)", () => [["k", 4, 50, "K"], ["p", 18, 50, "4"], ["p", 32, 80, "7"], ["p", 32, 20, "11"], ["p", 44, 50, "9"]].map(([t, x, y, n]) => ({ t, x, y, n, c: t === "p" ? "geel" : undefined }))],
  ["5v5: tegenstander", () => [["k", 96, 50, "K"], ["p", 82, 50, ""], ["p", 68, 20, ""], ["p", 68, 80, ""], ["p", 56, 50, ""]].map(([t, x, y, n]) => ({ t, x, y, n, c: t === "p" ? "zwart" : undefined }))],
  ["8v8: eigen ploeg (1-3-3-1)", () => [["k", 4, 50, "K"], ["p", 17, 82, "2"], ["p", 15, 50, "4"], ["p", 17, 18, "3"], ["p", 32, 84, "7"], ["p", 30, 50, "8"], ["p", 32, 16, "11"], ["p", 45, 50, "9"]].map(([t, x, y, n]) => ({ t, x, y, n, c: t === "p" ? "geel" : undefined }))],
  ["8v8: tegenstander", () => [["k", 96, 50, "K"], ["p", 83, 18, ""], ["p", 85, 50, ""], ["p", 83, 82, ""], ["p", 68, 16, ""], ["p", 70, 50, ""], ["p", 68, 84, ""], ["p", 55, 50, ""]].map(([t, x, y, n]) => ({ t, x, y, n, c: t === "p" ? "zwart" : undefined }))],
  ["Rondo 4 tegen 1", () => [...[[38, 28], [62, 28], [38, 72], [62, 72]].map(([x, y]) => ({ t: "cone", x, y })), ...[[50, 28, "1"], [50, 72, "3"], [38, 50, "4"], [62, 50, "2"]].map(([x, y, n]) => ({ t: "p", x, y, n, c: "geel" })), { t: "p", x: 50, y: 50, n: "", c: "zwart" }, { t: "ball", x: 52.5, y: 31 }]],
  ["Vierkant met 4 kegels", () => [[30, 22], [70, 22], [30, 78], [70, 78]].map(([x, y]) => ({ t: "cone", x, y }))],
  ["Twee grote doelen", () => [{ t: "goal", x: 1.2, y: 50 }, { t: "goal", x: 98.8, y: 50 }]],
  ["Vier minidoelen", () => [[1.2, 25, 0], [1.2, 75, 0], [98.8, 25, 180], [98.8, 75, 180]].map(([x, y, r]) => ({ t: "mini", x, y, r }))],
  ["Ballen bij de start", () => [{ t: "net", x: 8, y: 88 }]]
];

/* ============ tekenbord ============ */
const DG_GROUPS = [
  ["Spelers", [["p", "Speler"], ["k", "Keeper"], ["tr", "Trainer"], ["ball", "Bal"], ["step", "Stapnr."]]],
  ["Materiaal", [["cone", "Kegel"], ["pot", "Potje"], ["conerow", "Rij potjes"], ["gate", "Poortje"], ["pole", "Paal"], ["ring", "Hoepel"], ["pop", "Pop"], ["ladder", "Ladder"], ["hurdle", "Horde"], ["goal", "Groot doel"], ["mini", "Minidoel"], ["rebound", "Kaatsmuur"], ["net", "Ballen"], ["flag", "Vlag"]]],
  ["Lijnen", [["pass", "Pass"], ["run", "Loopactie"], ["drib", "Dribbel"], ["shot", "Schot"], ["lob", "Hoge bal"], ["line", "Lijn"], ["pen", "Vrij tekenen"], ["meas", "Afstand"]]],
  ["Vlakken", [["zone", "Zone"], ["oval", "Cirkel"], ["txt", "Tekst"]]]
];
/* knoppen tonen het voorwerp zoals het op het veld staat */
function toolIcon(t) {
  const wrap = (inner, vb = "0 0 24 24") => `<svg viewBox="${vb}" class="ti" aria-hidden="true">${inner}</svg>`;
  const mini = o => objSVG({ ...o, x: 50, y: 50 }, 0, 24, 24, "gras").replace(/data-i="0"/, "");
  if (ARROWS.has(t)) { const o = { t, x: 12, y: 82, x2: 88, y2: 20, s: 2.4, ...(t === "lob" ? { cx: 20, cy: 10 } : {}) }; return wrap(arrowSVG(o, 24, 24, t === "shot" ? "#E11D48" : "currentColor", "", "gras")); }
  if (t === "pen") return wrap(`<path d="M3 17c3-6 5 2 8-3s4-7 6-4 2 5 4 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`);
  if (t === "meas") return wrap(`<path d="M3 15h18M3 12v6M21 12v6" stroke="currentColor" stroke-width="1.3" fill="none"/><text x="12" y="10" text-anchor="middle" font-size="6.5" font-weight="800" fill="currentColor" font-family="Archivo,Arial">10m</text>`);
  if (t === "zone") return wrap(`<rect x="3" y="5" width="18" height="14" rx="1.5" fill="#FFD100" fill-opacity=".25" stroke="#FFD100" stroke-width="1.4" stroke-dasharray="3 2"/>`);
  if (t === "oval") return wrap(`<ellipse cx="12" cy="12" rx="9" ry="7" fill="#2563EB" fill-opacity=".25" stroke="#2563EB" stroke-width="1.4" stroke-dasharray="3 2"/>`);
  if (t === "txt") return wrap(`<text x="12" y="17" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor" font-family="Archivo,Arial">Aa</text>`);
  const S = { goal: 2.2, mini: 3.4, ladder: 1.75, ball: 6, cone: 4.4, pot: 5, step: 5, conerow: 1.45, gate: 3.2, pole: 3.2, ring: 4.3, pop: 3.6, hurdle: 4.6, rebound: 3, net: 3.3, flag: 3.8, p: 3.7, k: 3.7, tr: 3.7 }[t] || 3;
  return wrap(mini({ t, s: S, r: t === "goal" || t === "mini" ? 90 : t === "rebound" ? 90 : undefined, n: t === "k" ? "K" : t === "tr" ? "T" : t === "p" ? "7" : t === "step" ? "1" : undefined }));
}

function diagramEditor(host, dg, onChange, opts = {}) {
  dg.objs = dg.objs || []; dg.field = dg.field || "5v5";
  let group = 0, tool = "select", sel = -1, drag = null, draft = null, pcol = "geel", lastHint = "";
  const snap = () => JSON.stringify({ field: dg.field, vert: !!dg.vert, bg: dg.bg || "", objs: dg.objs });
  let hist = [snap()], hi = 0;
  const commit = () => { const s = snap(); if (s === hist[hi]) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1; onChange(); bar(); };
  const restore = s => { const o = JSON.parse(s); dg.field = o.field; dg.vert = o.vert || undefined; dg.bg = o.bg || undefined; dg.objs = o.objs; sel = -1; onChange(); bar(); draw(); top(); };
  const undo = () => { if (hi > 0) restore(hist[--hi]); }, redo = () => { if (hi < hist.length - 1) restore(hist[++hi]); };
  const nextStep = () => String(dg.objs.filter(o => o.t === "step").length + 1);
  const roster = () => (typeof S !== "undefined" && S.players ? active() : []).map(p => p.first_name || pname(p)).filter(Boolean);
  const nextNum = c => { const ns = dg.objs.filter(o => (o.t === "p" && (o.c || "geel") === c) || LEGACY_P[o.t] === c).map(o => parseInt(o.n)).filter(n => !isNaN(n)); return String(ns.length ? Math.max(...ns) + 1 : 1); };
  const fieldOpts = () => Object.entries(FIELDS).map(([k, f]) => `<option value="${k}"${dg.field === k ? " selected" : ""}>${f.l}</option>`).join("");

  host.innerHTML = `<div class="dge">
    <div class="dgtop"><select id="dgf" aria-label="Soort veld">${fieldOpts()}</select>
      <button class="dgb" type="button" id="dgrot" title="Veld kantelen">${IC.rotate}<span>Kantelen</span></button>
      <button class="dgb" type="button" id="dgbg" title="Grasveld of wit blad"><span class="sw" aria-hidden="true"></span><span id="dgbgl"></span></button>
      <select id="dgpre" aria-label="Snel plaatsen"><option value="">Snel plaatsen…</option>${DG_PRESETS.map(([l], k) => `<option value="${k}">${esc(l)}</option>`).join("")}</select>
      <span class="spacer"></span>
      <button class="dgb ic" type="button" id="dgun" title="Ongedaan maken (Ctrl+Z)" aria-label="Ongedaan maken">↶</button><button class="dgb ic" type="button" id="dgre" title="Opnieuw (Ctrl+Y)" aria-label="Opnieuw">↷</button>
      <button class="dgb ic" type="button" id="dgfs" title="Groot scherm" aria-label="Groot scherm">⤢</button></div>
    <div class="dgtabs" role="tablist"><button type="button" class="dgsel" id="dgselb" aria-pressed="true" title="Selecteren en verplaatsen (Esc)"><svg viewBox="0 0 24 24" class="ti" aria-hidden="true"><path d="M6 3l12 9-5.5 1.2L16 20l-2.6 1.2-3-6.6L6 18z" fill="currentColor"/></svg><span>Kiezen</span></button>
      ${DG_GROUPS.map(([g], k) => `<button type="button" role="tab" data-g="${k}" aria-selected="${k === group}">${g}</button>`).join("")}</div>
    <div class="dgtools" id="dgt"></div>
    <div class="dgwrap" id="dgw"></div>
    <div class="dgctx" id="dgc"></div>
    <p class="hint dgh" id="dgh"></p></div>`;
  const wrap = $("#dgw", host);
  const tools = () => {
    const [, list] = DG_GROUPS[group];
    $("#dgt", host).innerHTML = list.map(([k, l]) => `<button type="button" data-tool="${k}" aria-pressed="${k === tool}" title="${l}">${toolIcon(k)}<span>${l}</span></button>`).join("") +
      (group === 0 ? `<span class="dgcols" role="group" aria-label="Kleur van de spelers">${["geel", "zwart", "blauw", "rood", "wit", "oranje"].map(c => `<button type="button" data-pc="${c}" aria-pressed="${pcol === c}" title="${cap(c)}" style="--c:${COLS[c]}"></button>`).join("")}</span>` : "");
    $$("[data-tool]", host).forEach(b => b.onclick = () => setTool(b.dataset.tool));
    $$("[data-pc]", host).forEach(b => b.onclick = () => { pcol = b.dataset.pc; if (tool !== "p") setTool("p"); else tools(); });
  };
  const hints = { select: "Tik op een voorwerp om het te kiezen en te verslepen. Bij een lijn versleep je de gele bolletjes; met het witte bolletje maak je een bocht.",
    line: "Trek een lijn: druk, sleep en laat los. Je kan meteen de volgende trekken.", place: "Tik op het veld om te plaatsen. Je kan er meteen meer plaatsen. Tik op een bestaand voorwerp om het te verplaatsen.",
    zone: "Sleep om een vlak te tekenen.", pen: "Teken vrij met je vinger of de muis. Bij een gekozen lijn kan je een pijlpunt aanzetten.", meas: "Trek een lijn om een afstand aan te duiden, bv. 20 m." };
  const setTool = t => { tool = t; $("#dgselb", host).setAttribute("aria-pressed", t === "select"); if (t !== "select") sel = -1; tools(); draw(); bar();
    $("#dgh", host).textContent = t === "select" ? hints.select : t === "zone" || t === "oval" ? hints.zone : t === "pen" ? hints.pen : t === "meas" ? hints.meas : ARROWS.has(t) ? hints.line : t === "txt" ? "Tik op het veld waar de tekst moet komen." : hints.place; };
  const top = () => { $("#dgf", host).innerHTML = fieldOpts(); const F = FIELDS[dg.field]; $("#dgrot", host).hidden = !!F.fixed; $("#dgrot", host).setAttribute("aria-pressed", !!dg.vert);
    $("#dgbgl", host).textContent = dg.bg === "wit" ? "Wit blad" : "Grasveld"; $("#dgbg", host).classList.toggle("wit", dg.bg === "wit");
    $("#dgun", host).disabled = hi <= 0; $("#dgre", host).disabled = hi >= hist.length - 1; };
  const svgPt = ev => { const svg = $("svg", wrap), m = svg.getScreenCTM().inverse(), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(m), { W, H } = dgDims(dg);
    return { x: Math.max(0, Math.min(100, q.x / W * 100)), y: Math.max(0, Math.min(100, q.y / H * 100)) }; };
  const draw = () => { const all = draft ? { ...dg, objs: [...dg.objs, draft] } : dg; wrap.innerHTML = diagramSVG(all, { sel: draft ? -1 : sel }); wrap.dataset.tool = tool; };
  /* contextbalk voor het gekozen voorwerp */
  const bar = () => { const c = $("#dgc", host); top(); const o = dg.objs[sel];
    if (!o) { c.innerHTML = dg.objs.length ? `<span class="hint">${dg.objs.length} ${dg.objs.length === 1 ? "voorwerp" : "voorwerpen"} op het veld</span><span class="spacer"></span><button class="dgb" type="button" id="dgpng">${IC.dl}<span>Afbeelding</span></button><button class="dgb danger" type="button" id="dgclr">Alles wissen</button>` : `<span class="hint">Het veld is nog leeg. Kies hierboven wat je wil plaatsen of gebruik "Snel plaatsen".</span>`;
      const clr = $("#dgclr", c); if (clr) clr.onclick = () => { if (!confirm("Alles van het veld halen? Je kan dit ongedaan maken.")) return; dg.objs = []; sel = -1; commit(); draw(); };
      const png = $("#dgpng", c); if (png) png.onclick = () => dgPng(dg); return; }
    const t = LEGACY_P[o.t] ? "p" : o.t, lbl = { p: "Nr.", k: "Nr.", tr: "Label", step: "Nr.", txt: " ", meas: " ", zone: "Tekst", oval: "Tekst" }[t];
    const noCol = new Set(["ball", "goal", "net"]), palette = noCol.has(t) ? [] : t === "p" || t === "k" || t === "tr" ? ["geel", "zwart", "blauw", "rood", "wit", "oranje", "groen", "paars"] : ["zwart", "wit", "geel", "oranje", "rood", "blauw", "groen", "paars"];
    const curC = colOf(o, dg.bg), named = t === "p" || t === "k" || t === "tr", wide = t === "txt" || t === "zone" || t === "oval";
    c.innerHTML = `<b class="dgname">${esc((DG_GROUPS.flatMap(g => g[1]).find(x => x[0] === t) || [, "Voorwerp"])[1])}</b>
      ${lbl ? `<label class="dglbl${wide ? " wide" : ""}">${lbl.trim()}<input id="dgn" value="${esc(o.n ?? (t === "meas" ? "10 m" : ""))}" maxlength="${wide ? 40 : t === "meas" ? 10 : 3}" placeholder="${t === "p" ? "7" : ""}"></label>` : ""}
      ${named ? `<label class="dglbl wide">Naam<input id="dgnm" value="${esc(o.nm || "")}" maxlength="18" list="dgroster" placeholder="bv. Lucas"><datalist id="dgroster">${roster().map(n => `<option value="${esc(n)}">`).join("")}</datalist></label>` : ""}
      ${palette.length ? `<span class="dgcols">${palette.map(k => `<button type="button" data-cc="${k}" aria-pressed="${curC === k}" title="${cap(k)}" style="--c:${COLS[k]}"></button>`).join("")}</span>` : ""}
      <span class="dgseg" role="group" aria-label="Grootte">${[[.75, "S"], [1, "M"], [1.35, "L"]].map(([v, l]) => `<button type="button" data-sz="${v}" aria-pressed="${(o.s || 1) === v}">${l}</button>`).join("")}</span>
      ${ROTATABLE.has(t) ? `<button class="dgb" type="button" id="dgr" title="Draaien (R)">↻<span>Draaien</span></button>` : ""}
      ${ARROWS.has(t) ? `<button class="dgb" type="button" id="dgcv">${o.cx != null ? "Recht" : "Bocht"}</button><button class="dgb" type="button" id="dgsw" title="Richting omdraaien">⇄<span>Omdraaien</span></button>` : ""}
      ${t === "pen" ? `<button class="dgb" type="button" id="dghd" aria-pressed="${!!o.head}">Pijlpunt</button>` : ""}
      ${t === "pen" || t === "line" || t === "pass" ? `<button class="dgb" type="button" id="dgda" aria-pressed="${!!o.dash}">Stippellijn</button>` : ""}
      ${t === "zone" || t === "oval" ? `<button class="dgb" type="button" id="dgso" aria-pressed="${!!o.solid}">Gevuld</button>` : ""}
      <span class="spacer"></span><button class="dgb ic" type="button" id="dgfw" title="Naar voren" aria-label="Naar voren">⇡</button><button class="dgb ic" type="button" id="dgbw" title="Naar achteren" aria-label="Naar achteren">⇣</button>
      <button class="dgb" type="button" id="dgdup" title="Kopie (Ctrl+D)">${IC.copy}<span>Kopie</span></button><button class="dgb danger" type="button" id="dgdel" title="Verwijderen (Delete)">${IC.trash}<span>Weg</span></button>`;
    const n = $("#dgn", c); if (n) { n.oninput = () => { o.n = n.value; draw(); }; n.onchange = commit; n.onkeydown = ev => { if (ev.key === "Enter") { ev.preventDefault(); n.blur(); } }; }
    const nm = $("#dgnm", c); if (nm) { nm.oninput = () => { o.nm = nm.value.trim() || undefined; draw(); }; nm.onchange = commit; nm.onkeydown = ev => { if (ev.key === "Enter") { ev.preventDefault(); nm.blur(); } }; }
    $$("[data-cc]", c).forEach(b => b.onclick = () => { o.c = b.dataset.cc; if (t === "p") pcol = o.c; commit(); draw(); });
    $$("[data-sz]", c).forEach(b => b.onclick = () => { o.s = +b.dataset.sz === 1 ? undefined : +b.dataset.sz; commit(); draw(); });
    const r = $("#dgr", c); if (r) r.onclick = () => { o.r = (dgRot(o) + 45) % 360; commit(); draw(); };
    const cv = $("#dgcv", c); if (cv) cv.onclick = () => { if (o.cx != null) { delete o.cx; delete o.cy; } else { const dx = o.x2 - o.x, dy = o.y2 - o.y; o.cx = (o.x + o.x2) / 2 - dy * .3; o.cy = (o.y + o.y2) / 2 + dx * .3; } commit(); draw(); };
    const sw = $("#dgsw", c); if (sw) sw.onclick = () => { [o.x, o.y, o.x2, o.y2] = [o.x2, o.y2, o.x, o.y]; commit(); draw(); };
    const tg = (id, k) => { const b = $(id, c); if (b) b.onclick = () => { o[k] = o[k] ? undefined : true; commit(); draw(); }; };
    tg("#dghd", "head"); tg("#dgda", "dash"); tg("#dgso", "solid");
    $("#dgfw", c).onclick = () => { if (sel < dg.objs.length - 1) { const [z] = dg.objs.splice(sel, 1); dg.objs.push(z); sel = dg.objs.length - 1; commit(); draw(); } };
    $("#dgbw", c).onclick = () => { if (sel > 0) { const [z] = dg.objs.splice(sel, 1); dg.objs.unshift(z); sel = 0; commit(); draw(); } };
    $("#dgdup", c).onclick = dup; $("#dgdel", c).onclick = del; };
  const dup = () => { const o = dg.objs[sel]; if (!o) return; const k = JSON.parse(JSON.stringify(o)); dgShift(k, o, 4, 4); if (k.t === "step") k.n = nextStep();
    if (k.t === "p" && /^\d+$/.test(k.n || "")) k.n = nextNum(k.c || "geel"); dg.objs.push(k); sel = dg.objs.length - 1; commit(); draw(); };
  const del = () => { if (sel < 0) return; dg.objs.splice(sel, 1); sel = -1; commit(); draw(); };

  wrap.style.touchAction = "none";
  wrap.onpointerdown = ev => {
    if (ev.button > 0) return; const p = svgPt(ev), h = ev.target.closest("[data-h]"), hit = ev.target.closest("[data-i]");
    if (h && sel >= 0) { drag = { h: h.dataset.h, p, o: JSON.parse(JSON.stringify(dg.objs[sel])) }; wrap.setPointerCapture(ev.pointerId); return; }
    if (tool === "select" || (hit && !LINEISH.has(tool) && tool !== "pen")) {
      if (hit) { sel = +hit.dataset.i; drag = { p, o: JSON.parse(JSON.stringify(dg.objs[sel])), moved: false }; wrap.setPointerCapture(ev.pointerId); }
      else sel = -1;
      draw(); bar(); return; }
    if (tool === "pen") { draft = { t: "pen", pts: [[p.x, p.y]] }; if (dg.bg !== "wit" && false) draft.c = "wit"; wrap.setPointerCapture(ev.pointerId); draw(); return; }
    if (LINEISH.has(tool)) { draft = { t: tool, x: p.x, y: p.y, x2: p.x, y2: p.y }; if (tool === "meas") draft.n = "10 m"; if (tool !== "zone" && tool !== "oval" && defCol(tool, dg.bg) !== defCol(tool, "")) draft.c = defCol(tool, dg.bg); wrap.setPointerCapture(ev.pointerId); draw(); return; }
    const o = { t: tool, x: p.x, y: p.y };
    if (tool === "p") { o.c = pcol; o.n = nextNum(pcol); }
    if (tool === "k") o.n = "K";
    if (tool === "step") o.n = nextStep();
    if (tool === "txt") { o.n = "Tekst"; if (dg.bg === "wit") o.c = "zwart"; }
    if ((tool === "goal" || tool === "mini") && (dg.field === "half" || dg.field === "box" || dg.vert)) o.r = p.y < 50 ? 90 : 270;
    if ((tool === "goal" || tool === "mini") && !o.r && o.r !== 0 && !(dg.field === "half" || dg.field === "box" || dg.vert)) o.r = p.x < 50 ? 0 : 180;
    dg.objs.push(o); sel = dg.objs.length - 1; commit(); draw(); bar();
    if (tool === "txt") { setTool("select"); sel = dg.objs.length - 1; draw(); bar(); setTimeout(() => { const n = $("#dgn", host); if (n) { n.focus(); n.select(); } }, 30); }
  };
  wrap.onpointermove = ev => {
    if (!draft && !drag) return; const p = svgPt(ev);
    if (draft && draft.t === "pen") { const L = draft.pts[draft.pts.length - 1]; if (Math.hypot(p.x - L[0], p.y - L[1]) > .7) { draft.pts.push([p.x, p.y]); draw(); } return; }
    if (draft) { draft.x2 = p.x; draft.y2 = p.y; if (draft.t === "lob") { const dx = draft.x2 - draft.x, dy = draft.y2 - draft.y; draft.cx = (draft.x + draft.x2) / 2 - dy * .35; draft.cy = (draft.y + draft.y2) / 2 + dx * .35; } draw(); return; }
    const o = dg.objs[sel]; if (!o) return; const dx = p.x - drag.p.x, dy = p.y - drag.p.y;
    if (Math.abs(dx) + Math.abs(dy) > .4) drag.moved = true;
    if (drag.h === "a") { o.x = p.x; o.y = p.y; } else if (drag.h === "b") { o.x2 = p.x; o.y2 = p.y; }
    else if (drag.h === "c") { /* het bolletje ligt op de bocht (t = .5): controlepunt = 2·P − (A+B)/2 */ o.cx = 2 * p.x - (o.x + o.x2) / 2; o.cy = 2 * p.y - (o.y + o.y2) / 2; }
    else dgShift(o, drag.o, dx, dy);
    draw();
  };
  const up = () => { if (draft && draft.t === "pen") { if (draft.pts.length > 2) { dg.objs.push(draft); sel = dg.objs.length - 1; commit(); } draft = null; draw(); bar(); return; }
    if (draft) { const big = Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y) > 2.5; if (big) { dg.objs.push(draft); sel = dg.objs.length - 1; commit(); } draft = null; draw(); bar(); return; }
    if (drag) { drag = null; commit(); bar(); } };
  wrap.onpointerup = up; wrap.onpointercancel = up;
  wrap.ondblclick = ev => { const hit = ev.target.closest("[data-i]"); if (!hit) return; sel = +hit.dataset.i; draw(); bar(); const n = $("#dgn", host); if (n) { n.focus(); n.select(); } };

  $("#dgselb", host).onclick = () => setTool("select");
  $$("[data-g]", host).forEach(b => b.onclick = () => { group = +b.dataset.g; $$("[data-g]", host).forEach(x => x.setAttribute("aria-selected", x === b)); const first = DG_GROUPS[group][1][0][0]; setTool(first); });
  $("#dgf", host).onchange = e => { dg.field = e.target.value; if (FIELDS[dg.field].fixed) delete dg.vert; commit(); draw(); };
  $("#dgrot", host).onclick = () => { /* alles mee kantelen zodat de tekening blijft kloppen */ const to = !dg.vert;
    dg.objs.forEach(o => { const x0 = o.x; dgMap(o, (a, b) => dgTurn(a, b, to));
      if (TURNS.has(o.t)) o.r = ((dgRot(o, x0)) + (to ? -90 : 90) + 360) % 360; });
    dg.vert = to || undefined; commit(); draw(); };
  $("#dgbg", host).onclick = () => { dg.bg = dg.bg === "wit" ? undefined : "wit"; commit(); draw(); };
  $("#dgpre", host).onchange = e => { const k = e.target.value; e.target.value = ""; if (k === "") return; const add = DG_PRESETS[+k][1](), turn = dg.vert || FIELDS[dg.field].fixed && dg.field !== "square1";
    add.forEach(o => { if (turn) { const x0 = o.x; [o.x, o.y] = dgTurn(o.x, o.y, true); if (TURNS.has(o.t)) o.r = (dgRot(o, x0) + 270) % 360; }
      Object.keys(o).forEach(key => o[key] === undefined && delete o[key]); dg.objs.push(o); });
    sel = -1; commit(); draw(); toast("Geplaatst. Versleep wat je anders wil."); };
  $("#dgun", host).onclick = undo; $("#dgre", host).onclick = redo;
  $("#dgfs", host).onclick = () => { const on = !host.classList.contains("dgfull"); host.classList.toggle("dgfull", on); $("#dgfs", host).textContent = on ? "✕" : "⤢"; $("#dgfs", host).title = on ? "Klein scherm" : "Groot scherm"; draw(); };
  const key = ev => {
    if (!host.isConnected) return; const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && !typing) { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y" && !typing) { ev.preventDefault(); redo(); return; }
    if (typing) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "d" && sel >= 0) { ev.preventDefault(); dup(); return; }
    if ((ev.key === "Delete" || ev.key === "Backspace") && sel >= 0) { ev.preventDefault(); del(); return; }
    if (ev.key.toLowerCase() === "r" && sel >= 0 && ROTATABLE.has(dg.objs[sel].t)) { ev.preventDefault(); const o = dg.objs[sel]; o.r = (dgRot(o) + 45) % 360; commit(); draw(); return; }
    if (ev.key === "Escape" && (tool !== "select" || sel >= 0)) { ev.preventDefault(); ev.stopPropagation(); sel = -1; setTool("select"); return; }
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (mv && sel >= 0) { ev.preventDefault(); const o = dg.objs[sel], f = ev.shiftKey ? 3 : .6; dgShift(o, JSON.parse(JSON.stringify(o)), mv[0] * f, mv[1] * f); draw(); clearTimeout(key.t); key.t = setTimeout(commit, 400); }
  };
  document.addEventListener("keydown", key, true);
  tools(); setTool("select"); draw(); bar();
  return () => document.removeEventListener("keydown", key, true);
}
/* een voorwerp verschuiven of omzetten, inclusief de punten van een vrije lijn */
const dgShift = (o, base, dx, dy) => { ["x", "x2", "cx"].forEach(a => { if (base[a] != null) o[a] = base[a] + dx; }); ["y", "y2", "cy"].forEach(a => { if (base[a] != null) o[a] = base[a] + dy; }); if (base.pts) o.pts = base.pts.map(([a, b]) => [a + dx, b + dy]); };
const dgMap = (o, fn) => { if (o.x != null) [o.x, o.y] = fn(o.x, o.y); if (o.x2 != null) [o.x2, o.y2] = fn(o.x2, o.y2); if (o.cx != null) [o.cx, o.cy] = fn(o.cx, o.cy); if (o.pts) o.pts = o.pts.map(([a, b]) => fn(a, b)); };
/* kantelen: liggend (x naar rechts) ↔ staand (naar boven spelen) */
const TURNS = new Set(["goal", "mini", "ladder", "hurdle", "gate", "conerow", "rebound"]);
const dgTurn = (x, y, toVert) => toVert ? [y, 100 - x] : [100 - y, x];
const dgRot = (o, x0) => o.r ?? ((o.t === "goal" || o.t === "mini") ? ((x0 ?? o.x) < 50 ? 0 : 180) : 0);
/* tekening als afbeelding bewaren */
function dgPng(dg, name = "veldtekening") {
  const svg = diagramSVG(dg, { size: 1600 }), img = new Image();
  img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0);
    c.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }, "image/png"); };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
