/* 3D-veld voor het portaal: een 8v8-veld in perspectief waarop OGV een opbouw speelt.
   Opbouw: keeper -> de 4 zakt uit -> switch naar de hoge back -> flank -> spits.
   Getekend met canvas 2D en een eigen perspectiefprojectie (geen 3D-bibliotheek nodig). */
window.mountPitch = function (cv) {
  if (!cv) return null;
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const L = 64, W = 42, HL = L / 2, HW = W / 2;            // veld 64 x 42 m
  const Y = "#FFD100", WHITE = "#F2F2EE";

  // ---- camera ----
  let w = 0, h = 0, dpr = 1, f = 1, cam, R, U, F;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  function setCam(t) {
    const a = 0.5 + 0.22 * Math.sin(t * 0.045);            // traag heen en weer draaien
    const mobile = w < 640;
    const r = mobile ? 60 : 62, hgt = mobile ? 38 : 31;
    cam = [Math.sin(a) * r + 4, hgt, Math.cos(a) * r];
    const target = [mobile ? 2 : 6, 0, mobile ? 2 : -2];
    F = norm(sub(target, cam)); R = norm(cross(F, [0, 1, 0])); U = cross(R, F);
    f = (mobile ? 1.18 : 0.98) * Math.max(h, w * 0.55);
  }
  // x = lengte (OGV valt aan naar +x), z = breedte, y = hoogte
  function P(x, y, z) {
    const d = sub([x, y, z], cam), zc = dot(d, F);
    // het veld schuift op desktop naar rechts, zodat de titel links leesbaar blijft
    const ox = w < 640 ? w * 0.5 : w * 0.68, oy = h * (w < 640 ? 0.50 : 0.42);
    return [ox + f * dot(d, R) / zc, oy - f * dot(d, U) / zc, zc];
  }
  function line(pts, close) {
    ctx.beginPath();
    pts.forEach((p, i) => { const q = P(p[0], p[1] || 0, p[2]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    if (close) ctx.closePath();
  }
  const arc = (cx, cz, r, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r]; });

  // ---- tactiek: 8v8, 1-3-3-1. Index: 0 K, 1 LB, 2 CV(4), 3 RB, 4 LM, 5 CM, 6 RM, 7 SP ----
  const phases = [
    { h: [[-29, 0], [-19, -14], [-21, 0], [-19, 14], [-6, -15], [-9, 0], [-6, 15], [9, 0]], b: 0 },
    { h: [[-28, 0], [-9, -18], [-20, -6], [-9, 18], [3, -15], [-21, 4], [3, 15], [14, 0]], b: 5 },     // 4 zakt uit, backs hoog
    { h: [[-27, 0], [-7, -18], [-18, -8], [-5, 18], [6, -14], [-16, 5], [8, 13], [16, -2]], b: 3 },    // switch naar hoge back
    { h: [[-26, 0], [-4, -18], [-14, -8], [2, 17], [12, -13], [-10, 5], [17, 12], [20, -1]], b: 6 },   // back naar flank
    { h: [[-25, 0], [-2, -17], [-12, -8], [5, 16], [17, -10], [-6, 5], [22, 10], [25, 2]], b: 7 }      // voorzet naar spits
  ];
  const oppBase = [[29, 0], [19, -12], [21, 0], [19, 12], [8, -14], [10, 0], [8, 14], [-4, 0]];
  const SEG = 2.6, PASS0 = 1.0, PASS1 = 1.9, END = 2.4;      // seconden
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  function state(t) {
    const total = (phases.length - 1) * SEG + END;
    let tt = t % (total + 0.8);
    let fade = 1;
    if (tt > total) { fade = 1 - (tt - total) / 0.8; tt = total; }
    if (tt < 0.5) fade = Math.min(fade, tt / 0.5);
    let home, ball, ballH = 0.25, shot = false;
    const seg = Math.min(Math.floor(tt / SEG), phases.length - 1);
    if (tt >= (phases.length - 1) * SEG) {                  // afronding: bal naar doel
      const k = Math.min(1, (tt - (phases.length - 1) * SEG) / 0.9);
      home = phases[phases.length - 1].h;
      const s = home[7]; const e = ease(k);
      ball = [lerp(s[0] + 0.8, HL + 0.6, e), lerp(s[1], 1.3, e)]; ballH = 0.25 + Math.sin(k * Math.PI) * 0.9 + k * 0.6; shot = k >= 1;
    } else {
      const a = phases[seg], b = phases[seg + 1], u = (tt - seg * SEG) / SEG;
      home = a.h.map((p, i) => [lerp(p[0], b.h[i][0], ease(u)), lerp(p[1], b.h[i][1], ease(u))]);
      const s = tt - seg * SEG, from = home[a.b], to = home[b.b];
      if (s < PASS0) ball = [from[0] + 0.8, from[1]];
      else if (s < PASS1) {
        const k = ease((s - PASS0) / (PASS1 - PASS0));
        ball = [lerp(from[0] + 0.8, to[0] + 0.8, k), lerp(from[1], to[1], k)];
        const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
        ballH = 0.25 + Math.sin(k * Math.PI) * Math.min(3.5, dist * 0.08);
      } else ball = [to[0] + 0.8, to[1]];
    }
    const opp = oppBase.map((p, i) => i === 0 ? [p[0], lerp(p[1], ball[1], 0.25)] : [lerp(p[0], ball[0], 0.22) + 3, lerp(p[1], ball[1], 0.28)]);
    return { home, opp, ball, ballH, fade, shot };
  }

  // ---- tekenen ----
  function draw(t) {
    setCam(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // grasbanen
    const N = 10;
    for (let i = 0; i < N; i++) {
      const x0 = -HL + L * i / N, x1 = -HL + L * (i + 1) / N;
      line([[x0, 0, -HW], [x1, 0, -HW], [x1, 0, HW], [x0, 0, HW]], true);
      ctx.fillStyle = i % 2 ? "#0F1310" : "#0B0E0C"; ctx.fill();
    }
    // lichtvlek van de schijnwerpers
    const c = P(0, 0, 0), g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], Math.max(w, h) * 0.55);
    g.addColorStop(0, "rgba(255,213,0,.07)"); g.addColorStop(1, "rgba(255,213,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // lijnen
    ctx.strokeStyle = "rgba(255,213,0,.75)"; ctx.lineWidth = 1.4; ctx.lineJoin = "round";
    line([[-HL, 0, -HW], [HL, 0, -HW], [HL, 0, HW], [-HL, 0, HW]], true); ctx.stroke();
    line([[0, 0, -HW], [0, 0, HW]]); ctx.stroke();
    line(arc(0, 0, 6, 0, Math.PI * 2, 56), true); ctx.stroke();
    for (const s of [-1, 1]) {
      const gx = s * HL;
      line([[gx, 0, -12], [gx - s * 10, 0, -12], [gx - s * 10, 0, 12], [gx, 0, 12]]); ctx.stroke();
      line([[gx, 0, -5], [gx - s * 4, 0, -5], [gx - s * 4, 0, 5], [gx, 0, 5]]); ctx.stroke();
      // doel in 3D
      ctx.strokeStyle = "rgba(242,242,238,.85)"; ctx.lineWidth = 2;
      line([[gx, 0, -2.5], [gx, 2, -2.5], [gx, 2, 2.5], [gx, 0, 2.5]]); ctx.stroke();
      ctx.strokeStyle = "rgba(242,242,238,.25)"; ctx.lineWidth = 1;
      line([[gx, 2, -2.5], [gx + s * 1.6, 0, -2.5], [gx + s * 1.6, 0, 2.5], [gx, 2, 2.5]]); ctx.stroke();
      ctx.strokeStyle = "rgba(255,213,0,.75)"; ctx.lineWidth = 1.4;
    }
    const st = state(reduce ? 5.4 : t);
    ctx.globalAlpha = st.fade;
    // spelers, achteraan eerst
    const tokens = [];
    st.home.forEach((p, i) => tokens.push({ x: p[0], z: p[1], col: Y, home: true, keeper: i === 0 }));
    st.opp.forEach(p => tokens.push({ x: p[0], z: p[1], col: WHITE, home: false }));
    tokens.forEach(k => k.d = P(k.x, 0, k.z)[2]);
    tokens.sort((a, b) => b.d - a.d);
    for (const k of tokens) {
      const g0 = P(k.x, 0, k.z), top = P(k.x, 1.7, k.z), s = f / g0[2];
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.beginPath(); ctx.ellipse(g0[0], g0[1], s * 0.9, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = k.home ? "rgba(255,213,0,.9)" : "rgba(242,242,238,.55)"; ctx.lineWidth = Math.max(1, s * 0.22);
      ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
      ctx.beginPath(); ctx.arc(top[0], top[1], Math.max(2.5, s * 0.62), 0, Math.PI * 2);
      ctx.fillStyle = k.home ? (k.keeper ? "#fff" : Y) : "#1B1D1A"; ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.16); ctx.strokeStyle = k.home ? "#000" : "rgba(242,242,238,.8)"; ctx.stroke();
    }
    // bal met schaduw
    const bg = P(st.ball[0], 0, st.ball[1]), bt = P(st.ball[0], st.ballH, st.ball[1]), bs = f / bg[2];
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.beginPath(); ctx.ellipse(bg[0], bg[1], bs * .35, bs * .14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bt[0], bt[1], Math.max(2, bs * 0.3), 0, Math.PI * 2); ctx.fill();
    if (st.shot) { const q = P(HL, 1, 1.3); ctx.strokeStyle = "rgba(255,213,0,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], 14, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(1.5, devicePixelRatio || 1); w = r.width; h = r.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    if (reduce || !running) draw(clock);
  }
  let clock = 0, last = 0, running = false, visible = true, raf = 0;
  function loop(ts) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; clock += dt;
    draw(clock); raf = requestAnimationFrame(loop);
  }
  function setRun() {
    const want = !reduce && visible && !scrolling && !document.hidden;
    if (want && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    if (!want && running) { running = false; cancelAnimationFrame(raf); }
  }
  const ro = new ResizeObserver(resize); ro.observe(cv);
  // stoppen zodra het veld grotendeels uit beeld is
  const io = new IntersectionObserver(e => { visible = e[0].intersectionRatio > 0.25; setRun(); }, { threshold: [0, 0.25, 0.5] }); io.observe(cv);
  // pauzeren zolang er gescrold wordt, zodat het scrollen vlot blijft
  let scrolling = false, st = 0;
  const onScroll = () => { if (!scrolling) { scrolling = true; setRun(); } clearTimeout(st); st = setTimeout(() => { scrolling = false; setRun(); }, 140); };
  addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", setRun);
  resize(); setRun();
  return function stop() { running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); removeEventListener("scroll", onScroll); document.removeEventListener("visibilitychange", setRun); };
};
