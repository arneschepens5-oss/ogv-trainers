/* OGV Videostudio – spelers herkennen (draait apart van het scherm, zodat de studio vlot blijft).
   Model: YOLOX (Megvii, Apache-2.0), klasse 0 = persoon. Runtime: onnxruntime-web (MIT).
   Per beeld: het beeld wordt in overlappende tegels verdeeld zodat ook kleine spelers in een breed beeld gevonden worden,
   daarna één gezamenlijke lijst zonder dubbels. Per speler bewaren we ook een kleurprofiel (shirt en broek) om hem later terug te herkennen. */
let TI = 0, NI = 0, O = null, sess = null, S = 416, grid = null, ep = "wasm", prevG = null;
const GW = 192, GH = 108;

function grids(n) { const out = []; for (const st of [8, 16, 32]) { const k = n / st; for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) out.push(x, y, st); } return new Float32Array(out); }

async function init({ model, base, gpu }) {
  /* twee varianten van de rekenbibliotheek: met grafische kaart (WebGPU) of gewoon op de processor (sneller dan de gecombineerde versie) */
  if (gpu) { if (!navigator.gpu || !(await navigator.gpu.requestAdapter().catch(() => null))) throw new Error("NOGPU"); importScripts(base + "vendor/ort/ort.webgpu.min.js"); }
  else importScripts(base + "vendor/ort/ort.wasm.min.js");
  O = self.ort; O.env.wasm.wasmPaths = base + "vendor/ort/"; O.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
  const buf = await (await fetch(base + "models/" + model)).arrayBuffer();
  sess = await O.InferenceSession.create(buf, { executionProviders: [gpu ? "webgpu" : "wasm"], graphOptimizationLevel: "all" }); ep = gpu ? "webgpu" : "wasm";
  S = 416; grid = grids(S);
  /* opwarmen: de eerste berekening is altijd traag; meteen ook meten hoe snel dit toestel is */
  const x = new O.Tensor("float32", new Float32Array(3 * S * S).fill(114), [1, 3, S, S]); await sess.run({ [sess.inputNames[0]]: x });
  const t0 = performance.now(); await sess.run({ [sess.inputNames[0]]: x });
  return { ep, S, ms: Math.round(performance.now() - t0) };
}

const tc = new OffscreenCanvas(416, 416), tx = tc.getContext("2d", { willReadFrequently: true });
async function runTile(src, sx, sy, sw, sh, thr) {
  if (tc.width !== S) { tc.width = S; tc.height = S; }
  const r = Math.min(S / sw, S / sh), dw = Math.round(sw * r), dh = Math.round(sh * r);
  tx.fillStyle = "rgb(114,114,114)"; tx.fillRect(0, 0, S, S); tx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
  const px = tx.getImageData(0, 0, S, S).data, n = S * S, a = new Float32Array(3 * n);
  for (let i = 0, j = 0; i < n; i++, j += 4) { a[i] = px[j + 2]; a[n + i] = px[j + 1]; a[2 * n + i] = px[j]; }   /* BGR, 0-255 */
  const tq = performance.now(); const out = await sess.run({ [sess.inputNames[0]]: new O.Tensor("float32", a, [1, 3, S, S]) });
  TI += performance.now() - tq; NI++; const o = out[sess.outputNames[0]].data, N = o.length / 85, res = [];
  for (let k = 0; k < N; k++) { const b = k * 85, sc = o[b + 4] * o[b + 5]; if (sc < thr) continue;
    const g = k * 3, st = grid[g + 2], cx = (o[b] + grid[g]) * st, cy = (o[b + 1] + grid[g + 1]) * st, w = Math.exp(o[b + 2]) * st, h = Math.exp(o[b + 3]) * st;
    res.push([sx + (cx - w / 2) / r, sy + (cy - h / 2) / r, w / r, h / r, sc]); }
  return res;
}
const iou = (a, b) => { const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]), x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]); const I = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return [I / (a[2] * a[3] + b[2] * b[3] - I || 1), I / (Math.min(a[2] * a[3], b[2] * b[3]) || 1)]; };
function nms(B) { B.sort((a, b) => b[4] - a[4]); const keep = [];
  for (const b of B) { if (keep.every(k => { const [u, m] = iou(k, b); return u < .45 && !(m > .8 && b[3] < k[3] * 1.15 && b[3] > k[3] * .55); })) keep.push(b); }
  return keep; }

/* kleurprofiel: tint/verzadiging van shirt en broek, gras weggefilterd */
const HB = 12, BINS = HB * 2 + 3;
function prof(img, W, H, b) {
  const f = new Float32Array(BINS * 2), parts = [[.14, .5], [.5, .72]];
  parts.forEach(([ya, yb], pi) => { const x0 = Math.max(0, Math.round(b[0] + b[2] * .25)), x1 = Math.min(W - 1, Math.round(b[0] + b[2] * .75)), y0 = Math.max(0, Math.round(b[1] + b[3] * ya)), y1 = Math.min(H - 1, Math.round(b[1] + b[3] * yb)); let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const o = (y * W + x) * 4, R = img[o] / 255, G = img[o + 1] / 255, Bl = img[o + 2] / 255, mx = Math.max(R, G, Bl), mn = Math.min(R, G, Bl), d = mx - mn, s = mx ? d / mx : 0;
      let h = 0; if (d) { h = mx === R ? ((G - Bl) / d) % 6 : mx === G ? (Bl - R) / d + 2 : (R - G) / d + 4; h = (h * 60 + 360) % 360; }
      let bin; if (s < .22 || mx < .18) bin = HB * 2 + (mx < .35 ? 0 : mx < .7 ? 1 : 2); else { if (h > 70 && h < 165 && s > .25 && G >= R) continue; bin = Math.floor(h / 360 * HB) % HB + (s > .55 ? HB : 0); }
      f[pi * BINS + bin]++; n++; }
    if (n) for (let i = 0; i < BINS; i++) f[pi * BINS + i] /= n; });
  return f;
}
/* staat de speler op het veld? (groen rond de voeten) */
function onPitch(img, W, H, b) {
  const y0 = Math.min(H - 1, Math.round(b[1] + b[3] * .92)), y1 = Math.min(H - 1, Math.round(b[1] + b[3] * 1.12)), x0 = Math.max(0, Math.round(b[0] - b[2] * .4)), x1 = Math.min(W - 1, Math.round(b[0] + b[2] * 1.4)); let g = 0, n = 0;
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 2) { const o = (y * W + x) * 4, R = img[o], G = img[o + 1], Bl = img[o + 2]; n++; if (G > R * 1.05 && G > Bl * 1.02 && G > 40) g++; }
  return n ? g / n : 1;
}
/* camerabeweging tussen twee opeenvolgende beelden (verschuiving), op een klein grijs beeld */
const gc = new OffscreenCanvas(GW, GH), gx = gc.getContext("2d", { willReadFrequently: true });
function shiftOf(src, W, H) {
  gx.drawImage(src, 0, 0, W, H, 0, 0, GW, GH); const d = gx.getImageData(0, 0, GW, GH).data, g = new Float32Array(GW * GH);
  for (let i = 0; i < g.length; i++) g[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11;
  const p = prevG; prevG = g; if (!p) return [0, 0];
  const R = 14; let best = 1e18, bx = 0, by = 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { let s = 0, n = 0;
    for (let y = R; y < GH - R; y += 2) { const r1 = y * GW, r2 = (y + dy) * GW; for (let x = R; x < GW - R; x += 2) { const v = g[r2 + x + dx] - p[r1 + x]; s += v < 0 ? -v : v; n++; } }
    s /= n; s += (dx * dx + dy * dy) * .002; if (s < best) { best = s; bx = dx; by = dy; } }
  return [bx / GW, by / GH];   /* positief = beeldinhoud schuift naar rechts/onder */
}

const fc = new OffscreenCanvas(16, 16), fx = fc.getContext("2d", { willReadFrequently: true });
function greenFrac(img, W, x0, y0, w, h) { let g = 0, n = 0; for (let y = y0; y < y0 + h; y += 6) for (let x = x0; x < x0 + w; x += 6) { const o = (y * W + x) * 4, R = img[o], G = img[o + 1], Bl = img[o + 2]; n++; if (G > R * 1.05 && G > Bl * 1.02 && G > 40) g++; } return n ? g / n : 0; }
/* tiles: aantal rijen tegels (0 = enkel het hele beeld); full: ook het hele beeld in één keer (voor spelers die groot in beeld zijn) */
async function frame({ bmp, tiles, full, thr, reset }) {
  const tf = performance.now(); TI = 0; NI = 0;
  if (reset) prevG = null;
  const W0 = bmp.width, H0 = bmp.height, sc = Math.min(1, 1280 / W0), W = Math.round(W0 * sc), H = Math.round(H0 * sc);
  if (fc.width !== W || fc.height !== H) { fc.width = W; fc.height = H; } fx.drawImage(bmp, 0, 0, W, H); bmp.close();
  const img = fx.getImageData(0, 0, W, H).data, shift = shiftOf(fc, W, H);
  let B = [], nFull = 0;
  if (full || !tiles) { B = await runTile(fc, 0, 0, W, H, thr); nFull = nms(B.slice()).filter(b => b[4] > .4).length; }
  if (tiles > 0) { const rows = tiles, T = Math.min(W, Math.round(H / rows * 1.2)), cols = Math.max(1, Math.ceil((W - T) / (T * .8)) + 1), ystep = rows > 1 ? (H - T) / (rows - 1) : 0, xstep = cols > 1 ? (W - T) / (cols - 1) : 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x0 = Math.round(i * xstep), y0 = Math.round(j * ystep), th = Math.min(T, H);
      if (greenFrac(img, W, x0, y0, T, th) < .08) continue;   /* tribune, lucht, bomen: geen spelers te verwachten */
      B = B.concat(await runTile(fc, x0, y0, T, th, thr)); } }
  const keep = nms(B).filter(b => b[3] > 6 && b[2] < b[3] * 1.4 && onPitch(img, W, H, b) > .2);
  return { ms: [Math.round(performance.now() - tf), Math.round(TI), NI], nFull, nAll: keep.filter(b => b[4] > .4).length, dets: keep.map(b => [b[0] / W, b[1] / H, b[2] / W, b[3] / H, b[4]]), feats: keep.map(b => prof(img, W, H, b)), shift };
}

self.onmessage = async e => {
  const { id, type } = e.data;
  try { const r = type === "init" ? await init(e.data) : await frame(e.data); self.postMessage({ id, ok: true, r }); }
  catch (err) { self.postMessage({ id, ok: false, err: String(err && err.message || err) }); }
};
