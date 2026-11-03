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
const PCOL = { geel: ["#FFD500", "#000"], zwart: ["#161616", "#fff"], blauw: ["#2563EB", "#fff"], rood: ["#E11D48", "#fff"], wit: ["#F5F5F0", "#000"], oranje: ["#FF7A1A", "#000"], groen: ["#16A34A", "#fff"] };
const COLS = Object.fromEntries(Object.entries(PCOL).map(([k, v]) => [k, v[0]]));
const LINEISH = new Set(["pass", "run", "drib", "shot", "line", "zone", "oval"]);
const ARROWS = new Set(["pass", "run", "drib", "shot", "line"]);
const ROTATABLE = new Set(["goal", "mini", "ladder", "hurdle", "pop", "txt", "flag"]);
const LEGACY_P = { p1: "geel", p2: "zwart", p3: "blauw" };
/* standaardkleur per soort voorwerp; op een wit blad worden witte lijnen grijs */
const defCol = (t, bg) => ({ p: "geel", k: "wit", tr: "zwart", cone: "oranje", pot: "geel", pole: "rood", ring: "blauw", pop: "blauw", zone: "geel", oval: "blauw",
  pass: "zwart", drib: "zwart", shot: "rood", run: bg === "wit" ? "zwart" : "wit", line: bg === "wit" ? "zwart" : "wit", txt: bg === "wit" ? "zwart" : "wit" })[t] || "wit";
const colOf = (o, bg) => o.c || LEGACY_P[o.t] || (o.t === "k" && !o.c ? "keeper" : defCol(o.t, bg));

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
  const head = o.t === "line" ? 0 : (o.t === "shot" ? 2.3 : 1.7) * s, dEnd = der(1), dl = Math.hypot(...dEnd) || 1, ux = dEnd[0] / dl, uy = dEnd[1] / dl;
  const E = [B[0] - ux * head * .8, B[1] - uy * head * .8]; /* lijn stopt net voor de pijlpunt */
  let d;
  if (o.t === "drib") { const n = Math.max(4, Math.round(len / 2.2)); d = `M${A[0]} ${A[1]}`;
    for (let i = 1; i <= n; i++) { const t = i / n * .94, p = at(t), dv = der(t), l = Math.hypot(...dv) || 1, a = (i % 2 ? 1 : -1) * 1 * s * (i >= n - 1 ? .3 : 1); d += ` L${p[0] - dv[1] / l * a} ${p[1] + dv[0] / l * a}`; }
    d += ` L${E[0]} ${E[1]}`; }
  else d = curved ? `M${A[0]} ${A[1]}Q${C[0]} ${C[1]} ${E[0]} ${E[1]}` : `M${A[0]} ${A[1]}L${E[0]} ${E[1]}`;
  const w = (o.t === "shot" ? .95 : o.t === "line" ? .45 : .55) * s, dash = o.t === "run" ? `stroke-dasharray="${1.5 * s} ${1 * s}"` : o.t === "line" && o.n === "-" ? `stroke-dasharray="1 1"` : "";
  const hd = head ? `<path d="M${B[0]} ${B[1]}L${B[0] - ux * head - uy * head * .55} ${B[1] - uy * head + ux * head * .55}L${B[0] - ux * head + uy * head * .55} ${B[1] - uy * head - ux * head * .55}Z" fill="${col}"/>` : "";
  const shadow = col === "#F5F5F0" || (bg !== "wit" && col === "#161616") ? "" : "";
  return `<g ${tag}>${shadow}<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" ${dash} stroke-linecap="round" stroke-linejoin="round"/>${hd}<path d="${curved ? `M${A[0]} ${A[1]}Q${C[0]} ${C[1]} ${B[0]} ${B[1]}` : `M${A[0]} ${A[1]}L${B[0]} ${B[1]}`}" stroke="transparent" stroke-width="4" fill="none"/></g>`;
}
function objSVG(o, i, W, H, bg, sel) {
  const x = o.x * W / 100, y = o.y * H / 100, s = o.s || 1, tag = `data-i="${i}"`, ck = colOf(o, bg), col = ck === "keeper" ? "#F2F2EE" : COLS[ck] || ck;
  const hit = (r = 3) => `<circle cx="${x}" cy="${y}" r="${r * s}" fill="transparent"/>`, rot = (inner, def = 0) => `<g transform="translate(${x} ${y}) rotate(${o.r ?? def}) scale(${s})">${inner}</g>`;
  const t = LEGACY_P[o.t] ? "p" : o.t;
  if (ARROWS.has(t)) return arrowSVG(o, W, H, col, tag, bg);
  if (t === "zone" || t === "oval") { const x2 = o.x2 * W / 100, y2 = o.y2 * H / 100, X = Math.min(x, x2), Y = Math.min(y, y2), w = Math.abs(x2 - x), h = Math.abs(y2 - y), st = `fill="${col}" fill-opacity=".2" stroke="${col}" stroke-width=".4" stroke-dasharray="1.2 .8"`;
    return t === "zone" ? `<rect ${tag} x="${X}" y="${Y}" width="${w}" height="${h}" rx=".6" ${st}/>` : `<ellipse ${tag} cx="${X + w / 2}" cy="${Y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${st}/>`; }
  if (t === "p" || t === "k") { const [fc, tc] = ck === "keeper" ? ["#F2F2EE", "#000"] : PCOL[ck] || PCOL.geel, R = 2.3 * s;
    return `<g ${tag}>${hit()}<circle cx="${x}" cy="${y}" r="${R}" fill="${fc}" stroke="${ck === "zwart" ? "#fff" : "#111"}" stroke-width="${t === "k" ? .55 : .3}"/>${t === "k" ? `<circle cx="${x}" cy="${y}" r="${R - .75}" fill="none" stroke="${tc}" stroke-width=".18" opacity=".6"/>` : ""}${o.n ? `<text x="${x}" y="${y + .9 * s}" text-anchor="middle" font-size="${(String(o.n).length > 2 ? 1.9 : 2.5) * s}" font-weight="800" fill="${tc}" font-family="Archivo,Arial">${esc(o.n)}</text>` : ""}</g>`; }
  if (t === "tr") return `<g ${tag}>${hit()}<rect x="${x - 2.2 * s}" y="${y - 2.2 * s}" width="${4.4 * s}" height="${4.4 * s}" rx="${1 * s}" fill="${col}" stroke="#fff" stroke-width=".3"/><text x="${x}" y="${y + .9 * s}" text-anchor="middle" font-size="${2.5 * s}" font-weight="800" fill="${ck === "wit" || ck === "geel" ? "#000" : "#fff"}" font-family="Archivo,Arial">${esc(o.n || "T")}</text></g>`;
  if (t === "cone") return `<g ${tag}>${hit(2.4)}${rot(`<path d="M0 -1.8L1.45 1.1H-1.45Z" fill="${col}" stroke="rgba(0,0,0,.55)" stroke-width=".2"/><path d="M-1.8 1.1H1.8" stroke="rgba(0,0,0,.5)" stroke-width=".35"/>`)}</g>`;
  if (t === "pot") return `<g ${tag}>${hit(2.2)}${rot(`<ellipse rx="1.35" ry=".85" fill="${col}" stroke="rgba(0,0,0,.55)" stroke-width=".2"/><ellipse rx=".5" ry=".3" fill="rgba(0,0,0,.25)"/>`)}</g>`;
  if (t === "pole") return `<g ${tag}>${hit(2.4)}${rot(`<rect x="-.35" y="-2.6" width=".7" height="3" fill="${col}"/><ellipse cy=".5" rx=".9" ry=".45" fill="#444"/>`)}</g>`;
  if (t === "ring") return `<g ${tag}>${hit(2.6)}${rot(`<circle r="1.9" fill="none" stroke="${col}" stroke-width=".45"/>`)}</g>`;
  if (t === "pop") return `<g ${tag}>${hit(2.8)}${rot(`<rect x="-1.25" y="-1.4" width="2.5" height="3.6" rx=".9" fill="${col}" stroke="#111" stroke-width=".25"/><circle cy="-2.3" r=".95" fill="${col}" stroke="#111" stroke-width=".25"/>`)}</g>`;
  if (t === "ball") return `<g ${tag}>${hit(2.2)}<circle cx="${x}" cy="${y}" r="${1 * s}" fill="#fff" stroke="#111" stroke-width=".28"/><path d="M${x - .35 * s} ${y - .3 * s}l${.35 * s} -${.25 * s} ${.35 * s} ${.25 * s} -${.13 * s} ${.4 * s}h-${.44 * s}z" fill="#111"/></g>`;
  if (t === "net") return `<g ${tag}>${hit(3)}${rot(`<rect x="-2.4" y="-1.7" width="4.8" height="3.4" rx="1" fill="rgba(0,0,0,.25)" stroke="#fff" stroke-width=".25" stroke-dasharray=".5 .4"/>${[[-1.1, -.5], [.9, -.6], [-.1, .7], [1.4, .8], [-1.5, .9]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r=".72" fill="#fff" stroke="#111" stroke-width=".2"/>`).join("")}`)}</g>`;
  if (t === "goal" || t === "mini") { const w = t === "goal" ? 7.5 : 3.8, d = t === "goal" ? 2.3 : 1.4, def = o.x < 50 ? 0 : 180;
    return `<g ${tag}>${hit(3.4)}${rot(`<path d="M0 ${-w / 2}H${-d}V${w / 2}H0" fill="rgba(255,255,255,.28)" stroke="#fff" stroke-width=".55" stroke-linejoin="round"/><path d="M${-d} ${-w / 2}L0 ${w / 2}M${-d} ${w / 2}L0 ${-w / 2}" stroke="rgba(255,255,255,.35)" stroke-width=".15"/>`, def)}</g>`; }
  if (t === "ladder") return `<g ${tag}>${hit(3)}${rot(`<g stroke="${COLS[o.c] || "#FFD500"}" stroke-width=".32" fill="none"><rect x="-1.25" y="-5" width="2.5" height="10"/>${[1, 2, 3, 4].map(k => `<path d="M-1.25 ${-5 + k * 2}h2.5"/>`).join("")}</g>`)}</g>`;
  if (t === "hurdle") return `<g ${tag}>${hit(2.4)}${rot(`<path d="M-1.6 .9V-.8H1.6V.9" fill="none" stroke="${COLS[o.c] || "#2563EB"}" stroke-width=".5" stroke-linejoin="round"/>`)}</g>`;
  if (t === "flag") return `<g ${tag}>${hit(2.4)}${rot(`<path d="M0 1V-2.8" stroke="#ddd" stroke-width=".3"/><path d="M0 -2.8L2 -2.1L0 -1.4Z" fill="${col === "#F5F5F0" ? "#E11D48" : col}"/>`)}</g>`;
  if (t === "txt") { const fs = 2.6 * s; return `<g ${tag}><text transform="translate(${x} ${y}) rotate(${o.r || 0})" font-size="${fs}" font-weight="800" fill="${col}" stroke="${ck === "zwart" ? "#fff" : "#000"}" stroke-width=".28" paint-order="stroke" font-family="Archivo,Arial" text-anchor="middle" dominant-baseline="middle">${esc(o.n || "Tekst")}</text><rect x="${x - fs * String(o.n || "Tekst").length * .3}" y="${y - fs * .7}" width="${fs * String(o.n || "Tekst").length * .6}" height="${fs * 1.4}" fill="transparent"/></g>`; }
  return "";
}
/* selectiekader en grepen */
function selSVG(o, W, H) {
  if (!o) return "";
  const p = (a, b) => [a * W / 100, b * H / 100], h = (k, [x, y]) => `<circle data-h="${k}" cx="${x}" cy="${y}" r="1.5" fill="#FFD500" stroke="#000" stroke-width=".3" style="cursor:grab"/>`;
  if (ARROWS.has(o.t)) { const { A, B, at } = curvePts(o, W, H), C = o.cx != null ? p(o.cx, o.cy) : at(.5);
    return `<path d="M${A[0]} ${A[1]}${o.cx != null ? `Q${p(o.cx, o.cy).join(" ")} ` : "L"}${B[0]} ${B[1]}" fill="none" stroke="#FFD500" stroke-width="1.6" stroke-opacity=".3" pointer-events="none"/>${h("a", A)}${h("b", B)}<circle data-h="c" cx="${C[0]}" cy="${C[1]}" r="1.2" fill="#fff" stroke="#000" stroke-width=".3" style="cursor:grab"/>`; }
  if (o.t === "zone" || o.t === "oval") { const A = p(o.x, o.y), B = p(o.x2, o.y2);
    return `<rect x="${Math.min(A[0], B[0])}" y="${Math.min(A[1], B[1])}" width="${Math.abs(B[0] - A[0])}" height="${Math.abs(B[1] - A[1])}" fill="none" stroke="#FFD500" stroke-width=".35" pointer-events="none"/>${h("a", A)}${h("b", B)}`; }
  const [x, y] = p(o.x, o.y), r = (o.t === "goal" ? 4.6 : o.t === "ladder" ? 5.6 : o.t === "txt" ? 3 : 3.3) * (o.s || 1);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#FFD500" stroke-width=".45" stroke-dasharray="1 .7" pointer-events="none"/>`;
}
function diagramSVG(dg, opts = {}) {
  dg = dg || { field: "5v5", objs: [] }; const { rot, W, H } = dgDims(dg), wit = dg.bg === "wit", lc = wit ? "#9AA79C" : "rgba(255,255,255,.8)";
  const bands = Array.from({ length: 10 }, (_, k) => k % 2 ? (rot ? `<rect x="0" y="${k * H / 10}" width="${W}" height="${H / 10}" fill="rgba(255,255,255,.045)"/>` : `<rect x="${k * W / 10}" y="0" width="${W / 10}" height="${H}" fill="rgba(255,255,255,.045)"/>`) : "").join("");
  const lines = rot ? `<g transform="translate(${W} 0) rotate(90)">${fieldLines(dg.field, H, W, lc)}</g>` : fieldLines(dg.field, W, H, lc);
  const objs = (dg.objs || []).map((o, i) => objSVG(o, i, W, H, dg.bg, opts.sel === i)).join("");
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
  ["Spelers", [["p", "Speler"], ["k", "Keeper"], ["tr", "Trainer"], ["ball", "Bal"]]],
  ["Materiaal", [["cone", "Kegel"], ["pot", "Potje"], ["pole", "Paal"], ["ring", "Hoepel"], ["pop", "Pop"], ["ladder", "Ladder"], ["hurdle", "Horde"], ["goal", "Groot doel"], ["mini", "Minidoel"], ["net", "Ballen"], ["flag", "Vlag"]]],
  ["Lijnen", [["pass", "Pass"], ["run", "Loopactie"], ["drib", "Dribbel"], ["shot", "Schot"], ["line", "Lijn"]]],
  ["Vlakken", [["zone", "Zone"], ["oval", "Cirkel"], ["txt", "Tekst"]]]
];
/* kleine voorbeeldjes voor de knoppen */
function toolIcon(t) {
  const W = 24, wrap = inner => `<svg viewBox="0 0 24 24" class="ti" aria-hidden="true">${inner}</svg>`;
  const mini = o => { const s = objSVG({ s: 1.9, ...o, x: 50, y: 50 }, 0, 24, 24, "gras"); return s.replace(/data-i="0"/, ""); };
  if (ARROWS.has(t)) { const o = { t, x: 12, y: 80, x2: 88, y2: 22, s: 2.4 }; return wrap(arrowSVG(o, W, W, t === "run" || t === "line" ? "currentColor" : t === "shot" ? "#E11D48" : "currentColor", "", "gras")); }
  if (t === "zone") return wrap(`<rect x="3" y="5" width="18" height="14" rx="1.5" fill="#FFD500" fill-opacity=".25" stroke="#FFD500" stroke-width="1.4" stroke-dasharray="3 2"/>`);
  if (t === "oval") return wrap(`<ellipse cx="12" cy="12" rx="9" ry="7" fill="#2563EB" fill-opacity=".25" stroke="#2563EB" stroke-width="1.4" stroke-dasharray="3 2"/>`);
  if (t === "txt") return wrap(`<text x="12" y="17" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor" font-family="Archivo,Arial">Aa</text>`);
  if (t === "goal" || t === "mini") return wrap(mini({ t, r: 90, s: t === "goal" ? 2 : 2.8 }).replace(/stroke="#fff"/g, 'stroke="currentColor"'));
  if (t === "net") return wrap(mini({ t, s: 2.6 }));
  return wrap(mini({ t, s: t === "ladder" ? 1.6 : t === "ball" ? 4.5 : t === "cone" || t === "pot" ? 4 : 3.4, n: t === "k" ? "K" : t === "tr" ? "T" : t === "p" ? "7" : undefined, c: t === "k" ? "groen" : undefined }));
}

function diagramEditor(host, dg, onChange) {
  dg.objs = dg.objs || []; dg.field = dg.field || "5v5";
  let group = 0, tool = "select", sel = -1, drag = null, draft = null, pcol = "geel", lastHint = "";
  const snap = () => JSON.stringify({ field: dg.field, vert: !!dg.vert, bg: dg.bg || "", objs: dg.objs });
  let hist = [snap()], hi = 0;
  const commit = () => { const s = snap(); if (s === hist[hi]) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1; onChange(); bar(); };
  const restore = s => { const o = JSON.parse(s); dg.field = o.field; dg.vert = o.vert || undefined; dg.bg = o.bg || undefined; dg.objs = o.objs; sel = -1; onChange(); bar(); draw(); top(); };
  const undo = () => { if (hi > 0) restore(hist[--hi]); }, redo = () => { if (hi < hist.length - 1) restore(hist[++hi]); };
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
    zone: "Sleep om een vlak te tekenen." };
  const setTool = t => { tool = t; $("#dgselb", host).setAttribute("aria-pressed", t === "select"); if (t !== "select") sel = -1; tools(); draw(); bar();
    $("#dgh", host).textContent = t === "select" ? hints.select : t === "zone" || t === "oval" ? hints.zone : ARROWS.has(t) ? hints.line : t === "txt" ? "Tik op het veld waar de tekst moet komen." : hints.place; };
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
    const t = LEGACY_P[o.t] ? "p" : o.t, lbl = { p: "Nr.", k: "Label", tr: "Label", txt: " " }[t], palette = t === "p" || t === "k" || t === "tr" ? ["geel", "zwart", "blauw", "rood", "wit", "oranje", "groen"] : t === "ball" || t === "goal" || t === "mini" || t === "net" ? [] : ["zwart", "wit", "geel", "oranje", "rood", "blauw", "groen"];
    const curC = colOf(o, dg.bg);
    c.innerHTML = `<b class="dgname">${esc((DG_GROUPS.flatMap(g => g[1]).find(x => x[0] === t) || [, "Voorwerp"])[1])}</b>
      ${lbl ? `<label class="dglbl${t === "txt" ? " wide" : ""}">${lbl.trim()}<input id="dgn" value="${esc(o.n ?? "")}" maxlength="${t === "txt" ? 40 : 3}" ${t === "p" ? 'inputmode="text"' : ""}></label>` : ""}
      ${palette.length ? `<span class="dgcols">${palette.map(k => `<button type="button" data-cc="${k}" aria-pressed="${curC === k}" title="${cap(k)}" style="--c:${COLS[k]}"></button>`).join("")}</span>` : ""}
      <span class="dgseg" role="group" aria-label="Grootte">${[[.75, "S"], [1, "M"], [1.35, "L"]].map(([v, l]) => `<button type="button" data-sz="${v}" aria-pressed="${(o.s || 1) === v}">${l}</button>`).join("")}</span>
      ${ROTATABLE.has(t) ? `<button class="dgb" type="button" id="dgr" title="Draaien">↻<span>Draaien</span></button>` : ""}
      ${ARROWS.has(t) ? `<button class="dgb" type="button" id="dgcv">${o.cx != null ? "Recht" : "Bocht"}</button><button class="dgb" type="button" id="dgsw" title="Richting omdraaien">⇄<span>Omdraaien</span></button>` : ""}
      <span class="spacer"></span><button class="dgb" type="button" id="dgdup" title="Kopie (Ctrl+D)">${IC.copy}<span>Kopie</span></button><button class="dgb danger" type="button" id="dgdel" title="Verwijderen (Delete)">${IC.trash}<span>Weg</span></button>`;
    const n = $("#dgn", c); if (n) { n.oninput = () => { o.n = n.value; draw(); }; n.onchange = commit; n.onkeydown = ev => { if (ev.key === "Enter") { ev.preventDefault(); n.blur(); } }; }
    $$("[data-cc]", c).forEach(b => b.onclick = () => { o.c = b.dataset.cc; if (t === "p" || t === "k") pcol = t === "p" ? o.c : pcol; commit(); draw(); });
    $$("[data-sz]", c).forEach(b => b.onclick = () => { o.s = +b.dataset.sz === 1 ? undefined : +b.dataset.sz; commit(); draw(); });
    const r = $("#dgr", c); if (r) r.onclick = () => { o.r = (dgRot(o) + 45) % 360; commit(); draw(); };
    const cv = $("#dgcv", c); if (cv) cv.onclick = () => { if (o.cx != null) { delete o.cx; delete o.cy; } else { const dx = o.x2 - o.x, dy = o.y2 - o.y; o.cx = (o.x + o.x2) / 2 - dy * .3; o.cy = (o.y + o.y2) / 2 + dx * .3; } commit(); draw(); };
    const sw = $("#dgsw", c); if (sw) sw.onclick = () => { [o.x, o.y, o.x2, o.y2] = [o.x2, o.y2, o.x, o.y]; commit(); draw(); };
    $("#dgdup", c).onclick = dup; $("#dgdel", c).onclick = del; };
  const dup = () => { const o = dg.objs[sel]; if (!o) return; const k = JSON.parse(JSON.stringify(o)); ["x", "x2", "cx"].forEach(a => { if (k[a] != null) k[a] = Math.min(100, k[a] + 4); }); ["y", "y2", "cy"].forEach(a => { if (k[a] != null) k[a] = Math.min(100, k[a] + 4); });
    if (k.t === "p" && /^\d+$/.test(k.n || "")) k.n = nextNum(k.c || "geel"); dg.objs.push(k); sel = dg.objs.length - 1; commit(); draw(); };
  const del = () => { if (sel < 0) return; dg.objs.splice(sel, 1); sel = -1; commit(); draw(); };

  wrap.style.touchAction = "none";
  wrap.onpointerdown = ev => {
    if (ev.button > 0) return; const p = svgPt(ev), h = ev.target.closest("[data-h]"), hit = ev.target.closest("[data-i]");
    if (h && sel >= 0) { drag = { h: h.dataset.h, p, o: JSON.parse(JSON.stringify(dg.objs[sel])) }; wrap.setPointerCapture(ev.pointerId); return; }
    if (tool === "select" || (hit && !ARROWS.has(tool) && tool !== "zone" && tool !== "oval")) {
      if (hit) { sel = +hit.dataset.i; drag = { p, o: JSON.parse(JSON.stringify(dg.objs[sel])), moved: false }; wrap.setPointerCapture(ev.pointerId); }
      else sel = -1;
      draw(); bar(); return; }
    if (LINEISH.has(tool)) { draft = { t: tool, x: p.x, y: p.y, x2: p.x, y2: p.y }; if (tool !== "zone" && tool !== "oval" && defCol(tool, dg.bg) !== defCol(tool, "")) draft.c = defCol(tool, dg.bg); wrap.setPointerCapture(ev.pointerId); draw(); return; }
    const o = { t: tool, x: p.x, y: p.y };
    if (tool === "p") { o.c = pcol; o.n = nextNum(pcol); }
    if (tool === "k") o.n = "K";
    if (tool === "txt") { o.n = "Tekst"; if (dg.bg === "wit") o.c = "zwart"; }
    if ((tool === "goal" || tool === "mini") && (dg.field === "half" || dg.field === "box" || dg.vert)) o.r = p.y < 50 ? 90 : 270;
    if ((tool === "goal" || tool === "mini") && !o.r && o.r !== 0 && !(dg.field === "half" || dg.field === "box" || dg.vert)) o.r = p.x < 50 ? 0 : 180;
    dg.objs.push(o); sel = dg.objs.length - 1; commit(); draw(); bar();
    if (tool === "txt") { setTool("select"); sel = dg.objs.length - 1; draw(); bar(); setTimeout(() => { const n = $("#dgn", host); if (n) { n.focus(); n.select(); } }, 30); }
  };
  wrap.onpointermove = ev => {
    if (!draft && !drag) return; const p = svgPt(ev);
    if (draft) { draft.x2 = p.x; draft.y2 = p.y; draw(); return; }
    const o = dg.objs[sel]; if (!o) return; const dx = p.x - drag.p.x, dy = p.y - drag.p.y;
    if (Math.abs(dx) + Math.abs(dy) > .4) drag.moved = true;
    if (drag.h === "a") { o.x = p.x; o.y = p.y; } else if (drag.h === "b") { o.x2 = p.x; o.y2 = p.y; }
    else if (drag.h === "c") { /* het bolletje ligt op de bocht (t = .5): controlepunt = 2·P − (A+B)/2 */ o.cx = 2 * p.x - (o.x + o.x2) / 2; o.cy = 2 * p.y - (o.y + o.y2) / 2; }
    else { o.x = drag.o.x + dx; o.y = drag.o.y + dy; if (o.x2 != null) { o.x2 = drag.o.x2 + dx; o.y2 = drag.o.y2 + dy; } if (o.cx != null) { o.cx = drag.o.cx + dx; o.cy = drag.o.cy + dy; } }
    draw();
  };
  const up = () => { if (draft) { const big = Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y) > 2.5; if (big) { dg.objs.push(draft); sel = dg.objs.length - 1; commit(); } draft = null; draw(); bar(); return; }
    if (drag) { drag = null; commit(); bar(); } };
  wrap.onpointerup = up; wrap.onpointercancel = up;
  wrap.ondblclick = ev => { const hit = ev.target.closest("[data-i]"); if (!hit) return; sel = +hit.dataset.i; draw(); bar(); const n = $("#dgn", host); if (n) { n.focus(); n.select(); } };

  $("#dgselb", host).onclick = () => setTool("select");
  $$("[data-g]", host).forEach(b => b.onclick = () => { group = +b.dataset.g; $$("[data-g]", host).forEach(x => x.setAttribute("aria-selected", x === b)); const first = DG_GROUPS[group][1][0][0]; setTool(first); });
  $("#dgf", host).onchange = e => { dg.field = e.target.value; if (FIELDS[dg.field].fixed) delete dg.vert; commit(); draw(); };
  $("#dgrot", host).onclick = () => { /* alles mee kantelen zodat de tekening blijft kloppen */ const to = !dg.vert;
    dg.objs.forEach(o => { const x0 = o.x; [o.x, o.y] = dgTurn(o.x, o.y, to); if (o.x2 != null) [o.x2, o.y2] = dgTurn(o.x2, o.y2, to); if (o.cx != null) [o.cx, o.cy] = dgTurn(o.cx, o.cy, to);
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
    if (ev.key === "Escape" && (tool !== "select" || sel >= 0)) { ev.preventDefault(); ev.stopPropagation(); sel = -1; setTool("select"); return; }
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (mv && sel >= 0) { ev.preventDefault(); const o = dg.objs[sel], f = ev.shiftKey ? 3 : .6; ["x", "x2", "cx"].forEach(a => { if (o[a] != null) o[a] += mv[0] * f; }); ["y", "y2", "cy"].forEach(a => { if (o[a] != null) o[a] += mv[1] * f; }); draw(); clearTimeout(key.t); key.t = setTimeout(commit, 400); }
  };
  document.addEventListener("keydown", key, true);
  tools(); setTool("select"); draw(); bar();
  return () => document.removeEventListener("keydown", key, true);
}
/* kantelen: liggend (x naar rechts) ↔ staand (naar boven spelen) */
const TURNS = new Set(["goal", "mini", "ladder", "hurdle"]);
const dgTurn = (x, y, toVert) => toVert ? [y, 100 - x] : [100 - y, x];
const dgRot = (o, x0) => o.r ?? ((o.t === "goal" || o.t === "mini") ? ((x0 ?? o.x) < 50 ? 0 : 180) : 0);
/* tekening als afbeelding bewaren */
function dgPng(dg, name = "veldtekening") {
  const svg = diagramSVG(dg, { size: 1600 }), img = new Image();
  img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0);
    c.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }, "image/png"); };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
