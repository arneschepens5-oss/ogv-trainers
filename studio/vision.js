/* OGV Videostudio – spelers herkennen en volgen.
   1) Een apart rekenproces (vision-worker.js) zoekt per beeld alle personen met YOLOX en geeft per speler een kleurprofiel en de camerabeweging terug.
   2) Hier koppelen we die beelden aan elkaar tot sporen per speler, naar het voorbeeld van ByteTrack (Zhang e.a., 2022):
      voorspelde positie (snelheid + camerabeweging), eerst de zekere detecties koppelen, daarna de onzekere (half verborgen spelers),
      met de Hongaarse methode voor de beste toewijzing en het kleurprofiel om gelijkaardige spelers uit elkaar te houden.
   3) Omdat we achteraf rekenen (niet live) plakken we onderbroken sporen nog aan elkaar als positie, timing en kleur kloppen.
   4) Twee ploegen herkennen we aan de kleur van shirt en broek (k-means). */
(function () {
  const BASE = new URL(".", document.currentScript ? document.currentScript.src : location.href).href;
  let worker = null, ready = null, seq = 0; const waiting = new Map();
  function call(msg, transfer) { const id = ++seq; return new Promise((res, rej) => { waiting.set(id, { res, rej }); worker.postMessage({ ...msg, id }, transfer || []); }); }
  function boot(gpu, model) {
    worker = new Worker(BASE + "vision-worker.js?v=2");
    worker.onmessage = e => { const w = waiting.get(e.data.id); if (!w) return; waiting.delete(e.data.id); e.data.ok ? w.res(e.data.r) : w.rej(new Error(e.data.err)); };
    worker.onerror = e => { waiting.forEach(w => w.rej(new Error(e.message || "Rekenproces gestopt"))); waiting.clear(); };
    return call({ type: "init", base: BASE, gpu, model: model || (gpu ? "yolox_tiny.onnx" : "yolox_nano.onnx") });
  }
  /* eerst met de grafische kaart (veel sneller), anders op de processor */
  function start(model) {
    if (ready) return ready;
    ready = (async () => { if ("gpu" in navigator) { try { return await boot(true, model); } catch (e) { worker.terminate(); worker = null; } }
      return await boot(false, model); })().catch(e => { ready = null; if (worker) worker.terminate(); worker = null; throw e; });
    return ready;
  }

  /* ---------- hulpfuncties ---------- */
  const bhat = (a, b) => { let s1 = 0, s2 = 0; const n = a.length / 2; for (let i = 0; i < n; i++) s1 += Math.sqrt(a[i] * b[i]); for (let i = n; i < a.length; i++) s2 += Math.sqrt(a[i] * b[i]); return .65 * s1 + .35 * s2; };
  const blend = (a, b, k) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] * (1 - k) + b[i] * k; return o; };
  /* Hongaarse methode (minimale kosten), rechthoekige matrix met Infinity = verboden */
  function hungarian(C) {
    const n = C.length, m = n ? C[0].length : 0; if (!n || !m) return [];
    const N = Math.max(n, m), BIG = 1e6, a = []; for (let i = 0; i < N; i++) { a.push(new Float64Array(N)); for (let j = 0; j < N; j++) a[i][j] = i < n && j < m && isFinite(C[i][j]) ? C[i][j] : BIG; }
    const u = new Float64Array(N + 1), v = new Float64Array(N + 1), p = new Int32Array(N + 1), way = new Int32Array(N + 1);
    for (let i = 1; i <= N; i++) { p[0] = i; let j0 = 0; const minv = new Float64Array(N + 1).fill(Infinity), used = new Uint8Array(N + 1);
      do { used[j0] = 1; const i0 = p[j0]; let d = Infinity, j1 = 0;
        for (let j = 1; j <= N; j++) if (!used[j]) { const cur = a[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < d) { d = minv[j]; j1 = j; } }
        for (let j = 0; j <= N; j++) if (used[j]) { u[p[j]] += d; v[j] -= d; } else minv[j] -= d; j0 = j1; } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0); }
    const res = []; for (let j = 1; j <= N; j++) { const i = p[j] - 1, jj = j - 1; if (i < n && jj < m && a[i][jj] < BIG) res.push([i, jj]); } return res;
  }

  /* ---------- sporen bouwen ---------- */
  function buildTracks(frames, ar) {
    const tracks = [], live = []; let nid = 1, prevT = null; const cum = []; let cx = 0, cy = 0;
    const HI = .42, LO = .12, MAXLOST = 1.6;
    for (const fr of frames) {
      const dt = prevT == null ? .1 : Math.max(.02, fr.t - prevT); prevT = fr.t;
      const sx = fr.shift[0] * ar, sy = fr.shift[1]; cx += sx; cy += sy; cum.push([fr.t, cx, cy]);
      const D = fr.dets.map((d, i) => ({ X: (d[0] + d[2] / 2) * ar, Y: d[1] + d[3], h: d[3], s: d[4], f: fr.feats[i], used: false }));
      for (const tr of live) { tr.X += sx; tr.Y += sy; const g = Math.min(.8, fr.t - tr.mT); tr.pX = tr.X + tr.vx * g; tr.pY = tr.Y + tr.vy * g; }
      const cost = (tr, d, motionOnly) => { const hh = Math.max(tr.h, d.h), dd = Math.hypot(tr.pX - d.X, tr.pY - d.Y) / hh, gate = (motionOnly ? .6 : .9) + .22 * Math.min(tr.miss, 8);
        const hr = d.h / tr.h; if (dd > gate || hr < .6 || hr > 1.6) return Infinity; return motionOnly ? dd : dd + 1.25 * (1 - bhat(tr.f, d.f)); };
      const upd = (tr, d) => { const g = Math.max(.02, fr.t - tr.mT), mx0 = (d.X - tr.X) / g, my0 = (d.Y - tr.Y) / g, kk = tr.hits < 2 ? 1 : .4; tr.vx = tr.vx * (1 - kk) + mx0 * kk; tr.vy = tr.vy * (1 - kk) + my0 * kk;
        const sp = Math.hypot(tr.vx, tr.vy), mx = tr.h * 6; if (sp > mx) { tr.vx *= mx / sp; tr.vy *= mx / sp; }
        tr.X = d.X; tr.Y = d.Y; tr.h = tr.h * .7 + d.h * .3; tr.f = blend(tr.f, d.f, .12); tr.fEnd = d.f; tr.miss = 0; tr.hits++; tr.mT = fr.t; tr.pts.push([fr.t, d.X, d.Y, d.h]); d.used = true; };
      /* 1: zekere detecties */
      const hi = D.filter(d => d.s >= HI), lo = D.filter(d => d.s < HI && d.s >= LO);
      const C1 = live.map(tr => hi.map(d => cost(tr, d, false))); const m1 = hungarian(C1), got = new Set();
      m1.forEach(([i, j]) => { upd(live[i], hi[j]); got.add(live[i]); });
      /* 2: onzekere detecties voor wie nog niets heeft (half verborgen, in een duel) */
      const rest = live.filter(tr => !got.has(tr)); const C2 = rest.map(tr => lo.map(d => cost(tr, d, true)));
      hungarian(C2).forEach(([i, j]) => { upd(rest[i], lo[j]); got.add(rest[i]); });
      /* niet gevonden: verder voorspellen */
      for (const tr of live) if (!got.has(tr)) tr.miss++;
      /* nieuwe spelers */
      for (const d of hi) if (!d.used) { const tr = { id: nid++, X: d.X, Y: d.Y, vx: 0, vy: 0, h: d.h, f: d.f, fStart: d.f, fEnd: d.f, miss: 0, hits: 1, mT: fr.t, pts: [[fr.t, d.X, d.Y, d.h]] }; live.push(tr); tracks.push(tr); }
      /* opruimen */
      for (let i = live.length - 1; i >= 0; i--) { const tr = live[i]; if ((tr.hits < 3 && tr.miss > 1) || tr.miss * dt > MAXLOST) live.splice(i, 1); }
    }
    const camAt = t => { if (!cum.length) return [0, 0]; let lo = 0, hi = cum.length - 1; if (t <= cum[0][0]) return [cum[0][1], cum[0][2]]; if (t >= cum[hi][0]) return [cum[hi][1], cum[hi][2]];
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m][0] <= t) lo = m; else hi = m; } const f = (t - cum[lo][0]) / (cum[hi][0] - cum[lo][0] || 1); return [cum[lo][1] + (cum[hi][1] - cum[lo][1]) * f, cum[lo][2] + (cum[hi][2] - cum[lo][2]) * f]; };
    let T = tracks.filter(tr => tr.hits >= 3);
    /* onderbroken sporen aan elkaar plakken */
    const vel = tr => { const P = tr.pts, n = P.length; if (n < 2) return [0, 0]; const a = P[Math.max(0, n - 5)], b = P[n - 1]; const d = b[0] - a[0] || 1; return [(b[1] - a[1]) / d, (b[2] - a[2]) / d]; };
    for (let pass = 0; pass < 3; pass++) {
      const cand = [];
      for (const A of T) { const ea = A.pts[A.pts.length - 1], va = vel(A);
        for (const B of T) { if (A === B) continue; const sb = B.pts[0], g = sb[0] - ea[0]; if (g <= 0 || g > 3) continue;
          const ca = camAt(ea[0]), cb = camAt(sb[0]), gg = Math.min(g, .8), px = ea[1] + va[0] * gg + (cb[0] - ca[0]), py = ea[2] + va[1] * gg + (cb[1] - ca[1]);
          const h = Math.max(ea[3], sb[3]), d = Math.hypot(px - sb[1], py - sb[2]) / h, lim = 1 + 1.4 * g; if (d > lim) continue;
          const hr = sb[3] / ea[3]; if (hr < .55 || hr > 1.8) continue;
          const c = d / lim + 1.6 * (1 - bhat(A.fEnd, B.fStart)) + g * .15; if (c < 1.15) cand.push([c, A, B]); } }
      if (!cand.length) break; cand.sort((a, b) => a[0] - b[0]); const usedA = new Set(), usedB = new Set(), gone = new Set();
      for (const [, A, B] of cand) { if (usedA.has(A) || usedB.has(B) || gone.has(A) || gone.has(B)) continue; let root = A; while (root.into) root = root.into;
        if (root === B) continue; A.pts.push(...B.pts); A.fEnd = B.fEnd; A.hits += B.hits; A.f = blend(A.f, B.f, B.hits / A.hits); usedA.add(A); usedB.add(B); gone.add(B); B.into = A; }
      T = T.filter(tr => !gone.has(tr));
    }
    T = T.filter(tr => tr.pts.length >= 4 && tr.pts[tr.pts.length - 1][0] - tr.pts[0][0] >= .35);
    return T;
  }

  /* ---------- twee ploegen (k-means op shirtkleur) ---------- */
  function teams(T) {
    /* k-means met 4 groepen (twee ploegen + keepers/scheidsrechter), daarna zijn de twee grootste groepen de ploegen */
    const X = T.map(t => Array.from(t.f.slice(0, t.f.length / 2))); if (T.length < 4) return T.map(() => -1);
    const sim = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.sqrt(a[i] * b[i]); return s; }, K = Math.min(4, X.length);
    let best = null;
    for (let tries = 0; tries < 12; tries++) {
      let c = [X[Math.floor(Math.random() * X.length)]];
      while (c.length < K) { const d = X.map(x => Math.max(0, 1 - Math.max(...c.map(cc => sim(x, cc)))) ** 2), S = d.reduce((a, b) => a + b, 0); let r = Math.random() * S, k = 0; while (k < X.length - 1 && (r -= d[k]) > 0) k++; c.push(X[k]); }
      let lab = [];
      for (let it = 0; it < 15; it++) { lab = X.map(x => { let bi = 0, bs = -1; c.forEach((cc, k) => { const v = sim(x, cc); if (v > bs) { bs = v; bi = k; } }); return bi; });
        c = c.map((cc, k) => { const m = new Array(X[0].length).fill(0); let n = 0; X.forEach((x, i) => { if (lab[i] === k) { n++; x.forEach((v, j) => m[j] += v); } }); return n ? m.map(v => v / n) : cc; }); }
      const score = X.reduce((s, x, i) => s + sim(x, c[lab[i]]), 0); if (!best || score > best.score) best = { score, lab }; }
    const size = {}; best.lab.forEach(l => size[l] = (size[l] || 0) + 1);
    const big = Object.keys(size).map(Number).sort((a, b) => size[b] - size[a]).slice(0, 2).filter(k => size[k] >= 2);
    return best.lab.map(l => big.indexOf(l));
  }

  const seekTo = (v, t) => new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; v.removeEventListener("seeked", fin); res(); }; v.addEventListener("seeked", fin); v.currentTime = t; setTimeout(fin, 2500); });

  /* ---------- volledige analyse van een stuk video ---------- */
  async function analyse(src, { a, b, fps = 8, tiles = "auto", crossOrigin = null, onProgress = () => {}, stopped = () => false }) {
    onProgress({ phase: "model" });
    const info = await start();
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; if (crossOrigin) v.crossOrigin = crossOrigin; v.src = src;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("Video laden mislukt")); setTimeout(res, 10000); });
    if (!v.videoWidth) throw new Error("Video laden mislukt");
    const ar = v.videoWidth / v.videoHeight, step = 1 / fps, frames = [], t0 = performance.now(); let first = true, pend = null;
    const N = Math.max(1, Math.floor((b - a) / step) + 1);
    let mode = tiles;
    for (let k = 0; k < N; k++) {
      if (stopped()) break; const t = Math.min(b, a + k * step); await seekTo(v, t);
      let bmp; try { bmp = await createImageBitmap(v); } catch (e) { throw new Error("BEVEILIGD"); }
      if (mode === "auto") { /* eerste beeld: kijken of tegels nodig zijn (spelers klein in beeld) of het hele beeld volstaat */
        const r = await call({ type: "frame", bmp, tiles: 2, full: true, thr: .1, reset: true }, [bmp]); frames.push({ t, ...r }); first = false;
        mode = r.nAll > r.nFull * 1.25 + 1 ? 2 : 0; onProgress({ phase: "scan", k: 1, N, t, ep: info.ep, mode }); continue; }
      if (pend) frames.push(await pend);
      const tt = t; pend = call({ type: "frame", bmp, tiles: mode, full: false, thr: .1, reset: first }, [bmp]).then(r => ({ t: tt, ...r })); first = false;
      const el = (performance.now() - t0) / 1000; onProgress({ phase: "scan", k: k + 1, N, t, mode, ms: frames.length ? frames[frames.length - 1].ms : null, eta: k ? el / k * (N - k) : null, ep: info.ep });
    }
    if (pend) frames.push(await pend);
    v.removeAttribute("src"); v.load();
    onProgress({ phase: "link" });
    const T = buildTracks(frames, ar), tm = teams(T);
    const r4 = x => Math.round(x * 1e4) / 1e4;
    return { ep: info.ep, mode, frames: frames.length, players: T.map((tr, i) => ({ id: i + 1, tm: tm[i], f: Array.from(tr.f.slice(0, tr.f.length / 2), v => Math.round(v * 1000) / 1000), pts: tr.pts.map(p => [Math.round(p[0] * 1000) / 1000, r4(p[1] / ar), r4(p[2]), r4(p[3])]) })) };
  }

  window.OGVVision = { analyse, buildTracks, teams, hungarian, warm: start };
})();
