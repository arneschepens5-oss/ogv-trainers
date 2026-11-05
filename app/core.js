/* OGV Platform — kern: gegevens, aanmelden, navigatie, hulpfuncties.
   Alle onderdelen (ploeg, wedstrijd, training, scouting...) registreren hun pagina's via route(). */
"use strict";
const SB_URL = "https://intswyovpwiigdwmgjfz.supabase.co", SB_KEY = "sb_publishable_mGTwxXL1HjKgnJcgSATtxQ_6CvHJ-3W";
const KEYS = { teams:["id"], team_trainers:["team_id","user_id"], players:["id"], events:["id"], attendance:["event_id","player_id"],
  evaluations:["player_id","moment"], goals:["id"], scouting:["id"], club_docs:["key"], trainer_items:["id"], rsvp:["event_id","player_id"], messages:["id"], parent_messages:["id"] };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));

/* ============ gegevenslaag ============ */
let sb = null, mode = null, user = null, db = null;
/* zonder verbinding (langs het veld) gaan wijzigingen naar een wachtrij op het toestel en worden ze later verstuurd */
const OUTBOX_KEY = "ogv-outbox";
const isNetErr = e => !navigator.onLine || /failed to fetch|networkerror|network request|load failed|fetch|timeout|ERR_INTERNET|ERR_NETWORK/i.test(String(e?.message || e || ""));
const outbox = {
  get() { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch (e) { return []; } },
  set(a) { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(a)); } catch (e) {} outboxBanner(); },
  add(op) { const a = this.get(), k = op.t + ":" + JSON.stringify(op.key);
    const i = op.kind === "save" ? a.findIndex(x => x.kind === "save" && x.t + ":" + JSON.stringify(x.key) === k) : -1;
    if (i >= 0) a[i] = op; else a.push(op); this.set(a);
    if (!outbox.warned) { outbox.warned = true; toast("Geen verbinding: je wijziging staat veilig op je toestel en wordt verstuurd zodra je weer online bent."); } },
  busy: false, warned: false,
  async flush() { if (this.busy || !sb || !user || !navigator.onLine) return; const a = this.get(); if (!a.length) return; this.busy = true; let done = 0;
    try { for (const op of a) {
        let r; if (op.kind === "save") r = await sb.from(op.t).upsert(op.row, { onConflict: KEYS[op.t].join(",") });
        else { let q = sb.from(op.t).delete(); for (const k in op.key) q = q.eq(k, op.key[k]); r = await q; }
        if (r.error && isNetErr(r.error)) break; /* nog steeds offline */
        if (r.error) console.warn("Niet verstuurd", op, r.error);
        done++; }
      const rest = this.get().slice(done); this.set(rest); if (done) { outbox.warned = false; toast(rest.length ? `${done} wijzigingen verstuurd, ${rest.length} wachten nog.` : "Je wijzigingen zijn verstuurd."); }
    } finally { this.busy = false; } }
};
function outboxBanner() { const n = outbox.get().length; let b = document.getElementById("obx");
  if (!n) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("div"); b.id = "obx"; b.className = "obx"; b.setAttribute("role", "status"); document.body.appendChild(b); }
  b.innerHTML = `<span>${navigator.onLine ? "Bezig met versturen…" : "Geen verbinding"} · ${n} ${n === 1 ? "wijziging wacht" : "wijzigingen wachten"} op je toestel</span><button type="button">Nu proberen</button>`;
  b.querySelector("button").onclick = () => outbox.flush(); }
addEventListener("online", () => { outboxBanner(); outbox.flush(); }); addEventListener("offline", outboxBanner);
setInterval(() => outbox.flush(), 30000);
const SBDB = {
  async list(t, m = {}) { let q = sb.from(t).select("*"); for (const k in m) q = q.eq(k, m[k]); const { data, error } = await q; if (error) throw error; return data || []; },
  async save(t, row) { const op = { kind: "save", t, row: JSON.parse(JSON.stringify(row)), key: Object.fromEntries(KEYS[t].map(k => [k, row[k]])) };
    if (!navigator.onLine) { outbox.add(op); return; }
    const { error } = await sb.from(t).upsert(row, { onConflict: KEYS[t].join(",") }); if (error) { if (isNetErr(error)) { outbox.add(op); return; } throw error; } },
  async insert(t, row) { const { error } = await sb.from(t).insert(row); if (error) { if (isNetErr(error) && KEYS[t]) { outbox.add({ kind: "save", t, row: JSON.parse(JSON.stringify(row)), key: Object.fromEntries(KEYS[t].map(k => [k, row[k]])) }); return; } throw error; } },
  async del(t, m) { if (!navigator.onLine) { outbox.add({ kind: "del", t, key: m }); return; }
    let q = sb.from(t).delete(); for (const k in m) q = q.eq(k, m[k]); const { error } = await q; if (error) { if (isNetErr(error)) { outbox.add({ kind: "del", t, key: m }); return; } throw error; } },
  async addTrainer(team, mail) { const { data, error } = await sb.rpc("add_trainer", { t: team, mail }); if (error) throw error; return data; }
};
const DEMO_KEY = "ogv-platform-demo-v2";
const DEMODB = {
  _d: null,
  _load() { if (this._d) return this._d; try { this._d = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) {} if (!this._d) { this._d = demoSeed(); this._save(); } return this._d; },
  _save() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this._d)); } catch (e) {} },
  async list(t, m = {}) { const d = this._load(); return (d[t] || []).filter(r => Object.keys(m).every(k => r[k] === m[k])).map(r => JSON.parse(JSON.stringify(r))); },
  async save(t, row) { const d = this._load(); d[t] = d[t] || []; const k = KEYS[t]; const i = d[t].findIndex(r => k.every(c => r[c] === row[c]));
    if (i >= 0) d[t][i] = { ...d[t][i], ...JSON.parse(JSON.stringify(row)) }; else d[t].push(JSON.parse(JSON.stringify(row))); this._save(); },
  async insert(t, row) { return this.save(t, row); },
  async del(t, m) { const d = this._load(), ks = Object.keys(m);
    const gone = (d[t] || []).filter(r => ks.every(k => r[k] === m[k])); d[t] = (d[t] || []).filter(r => !ks.every(k => r[k] === m[k]));
    const casc = { teams: "team_id", players: "player_id", events: "event_id" }[t];
    if (casc) for (const g of gone) for (const tt of ["team_trainers","players","events","attendance","evaluations","goals"]) d[tt] = (d[tt] || []).filter(r => r[casc] !== g.id);
    this._save(); },
  async addTrainer() { return "geen_account"; }
};

/* ============ bestanden (privé map per trainer in Supabase Storage) ============ */
const BUCKET = "trainer-files", demoFiles = new Map();
const files = {
  async upload(file, onProgress) {
    const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
    const path = `${mode === "demo" ? "demo" : user.id}/${uid()}-${safeName}`;
    if (mode === "demo") { demoFiles.set(path, URL.createObjectURL(file)); return path; }
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) throw new Error(/exceeded|too large|size/i.test(error.message) ? "Bestand is te groot (maximaal 50 MB)." : /bucket not found/i.test(error.message) ? "De opslag is nog niet klaargezet: voer het databasescript opnieuw uit." : error.message);
    return path;
  },
  async url(path, download) {
    if (!path) return null; if (/^(https?:|media\/|trainingen\/|blob:)/.test(path)) return path;
    if (mode === "demo") return demoFiles.get(path) || null;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined); if (error) throw error; return data.signedUrl;
  },
  async remove(path) { if (!path || /^(https?:|media\/)/.test(path)) return; if (mode === "demo") { demoFiles.delete(path); return; } await sb.storage.from(BUCKET).remove([path]); }
};
/* afbeeldingen uit de privé-opslag: <img data-fp="pad"> krijgt automatisch een tijdelijke link (in groep opgevraagd) */
const fpCache = new Map();
async function hydrateImgs(root = document) {
  const els = [...root.querySelectorAll("img[data-fp]:not([src])")]; if (!els.length) return;
  const fresh = p => { const c = fpCache.get(p); return c && Date.now() - c.t < 50 * 60e3; };
  const need = [...new Set(els.map(e => e.dataset.fp))].filter(p => !fresh(p));
  if (need.length) {
    if (mode === "demo" || !sb) need.forEach(p => fpCache.set(p, { u: demoFiles.get(p) || "", t: Date.now() }));
    else for (let i = 0; i < need.length; i += 100) { const { data } = await sb.storage.from(BUCKET).createSignedUrls(need.slice(i, i + 100), 3600);
      (data || []).forEach(d => d.signedUrl && fpCache.set(d.path, { u: d.signedUrl, t: Date.now() })); }
  }
  els.forEach(e => { const c = fpCache.get(e.dataset.fp); if (c?.u) e.src = c.u; });
}
let hyT; new MutationObserver(() => { clearTimeout(hyT); hyT = setTimeout(() => hydrateImgs().catch(() => {}), 40); }).observe(document.documentElement, { childList: true, subtree: true });
const items = {
  _c: {}, bust(kind) { if (kind) delete this._c[kind]; else this._c = {}; },
  async list(kind) { const rows = await db.list("trainer_items", mode === "demo" ? { kind } : { kind, user_id: user.id }); return rows.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")); },
  async save(row) { this.bust(row.kind); row.updated_at = new Date().toISOString(); if (!row.id) row.id = uid(); if (mode === "demo") row.user_id = "demo"; else row.user_id = user.id; await db.save("trainer_items", row); return row; },
  async del(row) { this.bust(row.kind); if (row.file_path) await files.remove(row.file_path).catch(() => {}); await db.del("trainer_items", { id: row.id }); },
  /* eigen items plus wat andere trainers van de club gedeeld hebben */
  async listAll(kind) { const c = this._c[kind]; if (c && Date.now() - c.t < 5 * 60e3) return c.rows.slice(); const rows = await this._listAll(kind); this._c[kind] = { t: Date.now(), rows }; return rows.slice(); },
  async _listAll(kind) { const own = await this.list(kind); if (mode === "demo") { own.forEach(r => { if (r.data && !r.data.name && kind === "oefening") r.data.name = r.title; }); return own; }
    let sh = []; try { sh = await db.list("trainer_items", { kind, shared: true }); } catch (e) { /* ogv-update-v7 nog niet uitgevoerd */ }
    own.concat(sh).forEach(r => { if (r.data && !r.data.name && kind === "oefening") r.data.name = r.title; });
    const ids = new Set(own.map(r => r.id)); return own.concat(sh.filter(r => !ids.has(r.id)).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))); },
  mine: r => mode === "demo" || !r.user_id || r.user_id === user?.id,
  async share(row, on) { const was = row.shared; row.shared = on;
    if (on && !row.data.shared_by) row.data.shared_by = user?.user_metadata?.name || user?.user_metadata?.full_name || (user?.email || "").split("@")[0];
    try { await this.save(row); } catch (e) { row.shared = was; throw /shared|column|schema/i.test(e.message || "") ? new Error("Voer eerst het databasescript ogv-update-v7.sql uit in Supabase.") : e; } }
};
const fmtSize = b => b == null ? "" : b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + " kB" : (b / 1048576).toFixed(1).replace(".", ",") + " MB";

/* ============ thema: licht, donker of volgens het toestel ============ */
const THEME_KEY = "ogv-theme";
function getTheme() { try { return localStorage.getItem(THEME_KEY) || "dark"; } catch (e) { return "dark"; } }
function applyTheme(t) { t = t || getTheme(); const eff = t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
  document.documentElement.dataset.theme = eff; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = eff === "light" ? "#F4F4EF" : "#000000"; }
function setTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} applyTheme(t); }
matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (getTheme() === "system") applyTheme("system"); });
applyTheme();
const THEME_OPTS = [["light", "Licht"], ["dark", "Donker"], ["system", "Automatisch"]];
const themeSwitch = labels => { const cur = getTheme(), i = Math.max(0, THEME_OPTS.findIndex(o => o[0] === cur));
  return `<div class="themesw${labels ? " lbl" : ""}" role="radiogroup" aria-label="Weergave" style="--i:${i}"><span class="thumb" aria-hidden="true"></span>${THEME_OPTS.map(([k, l], j) =>
    `<button type="button" role="radio" data-theme-set="${k}" data-ti="${j}" aria-checked="${cur === k}" title="${l}${k === "system" ? " (volgt je toestel)" : ""}" aria-label="${l}">${IC["th_" + k]}${labels ? `<span>${l}</span>` : ""}</button>`).join("")}</div>`; };
function bindThemeSwitch() { $$("[data-theme-set]").forEach(b => b.onclick = () => {
  const root = document.documentElement; root.classList.add("theming"); setTheme(b.dataset.themeSet); setTimeout(() => root.classList.remove("theming"), 350);
  $$(".themesw").forEach(w => w.style.setProperty("--i", b.dataset.ti)); $$("[data-theme-set]").forEach(x => x.setAttribute("aria-checked", x.dataset.themeSet === getTheme())); }); }

/* ============ hulpfuncties ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const todayIso = () => iso(new Date());
const parse = s => new Date(s + "T12:00:00");
const dShort = s => parse(s).toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" });
const dLong = s => parse(s).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
const dDay = s => parse(s).getDate(), dMon = s => parse(s).toLocaleDateString("nl-BE", { month: "short" });
const tm = s => s ? String(s).slice(0, 5) : "";
const pname = p => p ? ((p.first_name || "") + " " + (p.last_name || "")).trim() : "Onbekend";
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const avg = a => { a = a.filter(x => typeof x === "number" && !isNaN(x)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const f1 = n => n == null || isNaN(n) ? "–" : (Math.round(n * 10) / 10).toLocaleString("nl-BE");
const seasonNow = () => { const d = new Date(), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return y + "-" + (y + 1); };
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
let toastT; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800); }
async function safe(fn, ok) { try { const r = await fn(); if (ok) toast(ok); return r; } catch (e) { console.error(e); toast(isNetErr(e) ? "Geen verbinding: dit kon niet opgeslagen worden. Probeer opnieuw zodra je weer bereik hebt." : "Opslaan mislukt: " + (e.message || "onbekende fout")); } }
function debounce(fn, ms = 600) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function dialog(html, cls = "") { const d = $("#dlg"); d.className = cls; d.innerHTML = html; d.showModal(); $$("[data-close]", d).forEach(b => b.onclick = () => d.close()); return d; }
function download(name, text, type = "text/csv;charset=utf-8") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
const csvCell = s => `"${String(s ?? "").replace(/"/g, '""')}"`;

const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const IC = {
  th_light: `<svg class="i" viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  th_dark: `<svg class="i" viewBox="0 0 24 24" ${P}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>`,
  th_system: `<svg class="i" viewBox="0 0 24 24" ${P}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`,
  logout: `<svg class="i" viewBox="0 0 24 24" ${P}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg>`,
  link: `<svg class="i" viewBox="0 0 24 24" ${P}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>`,
  home:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>`,
  phone:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>`,
  mail:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  wa:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .8a4 4 0 0 1-2.3-2.3l.8-1-1-2z"/></svg>`,
  cal:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  ppl:`<svg class="i" viewBox="0 0 24 24" ${P}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 4.8"/></svg>`,
  chart:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`,
  star:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>`,
  ball:`<svg class="i" viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/></svg>`,
  mic:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
  trophy:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a4 4 0 0 1-4 4M7 5H4v2a4 4 0 0 0 4 4"/></svg>`,
  sheet:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10h7M8.5 13.5h7M8.5 17h4"/></svg>`,
  rotate:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>`,
  book:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>`,
  plan:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M9 5h11M9 12h11M9 19h11"/><circle cx="4.5" cy="5" r="1.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="4.5" cy="19" r="1.5"/></svg>`,
  video:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>`,
  board:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 14l3-3 3 2 4-5"/><path d="M9 21h6"/></svg>`,
  field:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M12 4v16"/><circle cx="12" cy="12" r="3"/><path d="M3 9h3v6H3M21 9h-3v6h3"/></svg>`,
  split:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="2" y="5" width="9" height="14" rx="1.5"/><rect x="13" y="5" width="9" height="14" rx="1.5"/></svg>`,
  scout:`<svg class="i" viewBox="0 0 24 24" ${P}><circle cx="10" cy="10" r="6"/><path d="m20 20-5.5-5.5"/></svg>`,
  clock:`<svg class="i" viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  gear:`<svg class="i" viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>`,
  menu:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  back:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`,
  plus:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M12 5v14M5 12h14"/></svg>`,
  x:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  chev:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="m9 6 6 6-6 6"/></svg>`,
  print:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7"/></svg>`,
  play:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M7 4v16l13-8z"/></svg>`,
  pause:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M8 4v16M16 4v16"/></svg>`,
  swap:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>`,
  flag:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>`,
  note:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`,
  undo:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>`,
  check:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
  eye:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  out:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  dl:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>`,
  folder:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  up:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>`,
  file:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`,
  img:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>`,
  pen:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M3 21c3-1 5-3 7-6l7-7a2 2 0 0 0-3-3l-7 7c-3 2-4 4-4 9"/></svg>`,
  arrow:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 20 19 5M10 5h9v9"/></svg>`,
  dash:`<svg class="i" viewBox="0 0 24 24" ${P} stroke-dasharray="3 3"><path d="M4 20 19 5"/><path d="M10 5h9v9" stroke-dasharray="0"/></svg>`,
  wave:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M3 17c2-3 3 1 5-2s3 1 5-2 3 1 5-2M15 5h5v5"/></svg>`,
  circle:`<svg class="i" viewBox="0 0 24 24" ${P}><ellipse cx="12" cy="14" rx="9" ry="5"/></svg>`,
  spot:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M12 2v4M5 5l2 2M19 5l-2 2"/><ellipse cx="12" cy="17" rx="7" ry="3.5"/></svg>`,
  rect:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="4" y="6" width="16" height="12" rx="1"/></svg>`,
  text:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>`,
  line:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M5 19 19 5"/></svg>`,
  cursor:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="m5 3 14 7-6 2-2 6z"/></svg>`,
  trash:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
  tag:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>`,
  cam:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  stepb:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="M18 5 9 12l9 7zM6 5v14"/></svg>`,
  stepf:`<svg class="i" viewBox="0 0 24 24" ${P}><path d="m6 5 9 7-9 7zM18 5v14"/></svg>`,
  copy:`<svg class="i" viewBox="0 0 24 24" ${P}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>`
};

/* ============ clubconstanten ============ */
const STATUS = ["aanwezig","te laat","verwittigd","afwezig","geblesseerd"];
const STATUS_L = { "aanwezig":"Aanwezig","te laat":"Te laat","verwittigd":"Verwittigd","afwezig":"Afwezig","geblesseerd":"Blessure" };
const PRINC = { "1A":"Opbouw van achteruit","1B":"Opbouw verstoren","2A":"Doelkans creëren en scoren","2B":"Doelkans verhinderen en scoren beletten","3A":"Omschakeling B- naar B+","3B":"Omschakeling B+ naar B-" };
const THEMES = [...Object.entries(PRINC).map(([k, v]) => k + " " + v), "Techniek","Duel 1v1","Passing en balaanname","Handelingssnelheid","Positiespel","Wedstrijdvormen"];
const PILLARS = ["Techniek","Tactiek","Fysiek","Mentaal"];
const DEF_CRIT = ["Techniek (controle over de bal)","Afwerking","Conditie","Coaching","Bijdrage aan de ploeg","Potentieel"];
const DEF_TAGS = ["Zelfvertrouwen & durven","Zichtbaarheid & betrokkenheid","Te veel dribbelen","Afwerking","Positiespel","Rust & tijd aan de bal","Techniek & passing","Coaching & praten","Mentaliteit & focus","Duelkracht","Verdedigen"];
/* posities met de gekende rugnummers */
const POSNUM = [["1", "Doelman"], ["2", "Rechtsachter"], ["3", "Centrale verdediger"], ["4", "Centrale verdediger"], ["5", "Linksachter"], ["6", "Verdedigende middenvelder"],
  ["7", "Rechtsbuiten"], ["8", "Centrale middenvelder"], ["9", "Spits"], ["10", "Aanvallende middenvelder"], ["11", "Linksbuiten"]];
const posLabel = n => { const x = POSNUM.find(q => q[0] === String(n)); return x ? x[0] + " · " + x[1] : ""; };
const isKeeper = p => /^1\b|keeper|doelman/i.test(p?.position || "");
const STRENGTHS = ["Inzet","Durf","Balcontrole","Passing","Dribbel","Afwerking","Overzicht","Positie","Duelkracht","Snelheid","Coaching","Teamspeler","Leiderschap","Verdedigen","Keeperswerk"];
const FORMAT_DEF = { "2v2":[2,10], "3v3":[4,10], "5v5":[4,15], "8v8":[4,15], "11v11":[2,40] };
const matchFormat = t => ({ periods: t?.periods || FORMAT_DEF[t?.format]?.[0] || 4, minutes: t?.period_minutes || FORMAT_DEF[t?.format]?.[1] || 15 });

/* ============ toestand ============ */
const S = { teams: [], myTeamIds: [], team: null, players: [], events: [], att: [], evals: [], goals: [], trainers: [], club: null };
const TEAM_KEY = "ogv-platform-team";
const myTeams = () => S.allTeams ? S.teams.slice() : S.teams.filter(t => S.myTeamIds.includes(t.id) || (S.teamAccess || []).includes(t.id));
async function loadTeams() {
  S.teams = (await db.list("teams")).sort((a, b) => (a.category || a.name).localeCompare(b.category || b.name, "nl", { numeric: true }));
  const tt = mode === "demo" ? (await db.list("team_trainers", { user_id: "demo" })) : (await db.list("team_trainers", { user_id: user.id }));
  S.myTeamIds = tt.map(r => r.team_id);
}
async function loadTeam(id) {
  S.team = myTeams().find(t => t.id === id) || null; if (!S.team) return;
  try { localStorage.setItem(TEAM_KEY, id); } catch (e) {}
  const m = { team_id: id };
  [S.players, S.events, S.att, S.evals, S.goals, S.trainers] = await Promise.all(["players","events","attendance","evaluations","goals","team_trainers"].map(t => db.list(t, m)));
  try { S.rsvp = await db.list("rsvp", m); } catch (e) { S.rsvp = []; } /* tabel bestaat pas vanaf databaseversie 5 */
  sortPlayers(); sortEvents();
  if (typeof rbfaAuto === "function") setTimeout(rbfaAuto, 800);
}
const sortPlayers = () => S.players.sort((a, b) => (a.number ?? 99) - (b.number ?? 99) || pname(a).localeCompare(pname(b)));
const sortEvents = () => S.events.sort((a, b) => (a.date + (a.start_time || "")).localeCompare(b.date + (b.start_time || "")));
const active = () => S.players.filter(p => p.active !== false);
const attOf = (e, p) => S.att.find(a => a.event_id === e && a.player_id === p);
const past = type => S.events.filter(e => e.date <= todayIso() && !e.cancelled && (!type || e.type === type));
const teamName = id => S.teams.find(t => t.id === id)?.name || "Ploeg";
async function putAtt(a) { const p = S.players.find(x => x.id === a.player_id); if (p) a.player_name = pname(p);
  await db.save("attendance", a); const i = S.att.findIndex(x => x.event_id === a.event_id && x.player_id === a.player_id); if (i >= 0) S.att[i] = a; else S.att.push(a); }
async function putEvent(e) { await db.save("events", e); const i = S.events.findIndex(x => x.id === e.id); if (i >= 0) S.events[i] = e; else S.events.push(e); sortEvents(); S.club = null; }
async function loadClub(force) { if (S.club && !force) return S.club; S.club = (await db.list("events", { type: "wedstrijd" })).sort((a, b) => (b.date + (b.start_time || "")).localeCompare(a.date + (a.start_time || ""))); return S.club; }
const res = e => e.score_for == null || e.score_against == null ? null : e.score_for > e.score_against ? "win" : e.score_for < e.score_against ? "loss" : "draw";
const RES_L = { win: "Gewonnen", loss: "Verloren", draw: "Gelijk" };
const matchTitle = (e, tname) => { const us = e.report?.squad ? "OGV " + e.report.squad : tname || "OGV"; return e.opponent ? (e.home === false ? esc(e.opponent) + " – " + esc(us) : esc(us) + " – " + esc(e.opponent)) : "Wedstrijd"; };

function playerStats(p) {
  const tr = past("training").filter(e => S.att.some(a => a.event_id === e.id));
  const trIn = tr.filter(e => { const a = attOf(e.id, p.id); return a && (a.status === "aanwezig" || a.status === "te laat"); }).length;
  const ms = past("wedstrijd").map(e => attOf(e.id, p.id)).filter(a => a && a.status === "aanwezig");
  const ev = S.evals.filter(x => x.player_id === p.id).sort((a, b) => a.moment - b.moment);
  const last = ev.length ? avg(Object.values(ev[ev.length - 1].scores || {}).map(Number)) : null;
  const tagc = {}; ms.forEach(a => (a.tags || []).forEach(t => tagc[t] = (tagc[t] || 0) + 1));
  const top = Object.entries(tagc).sort((a, b) => b[1] - a[1])[0];
  const motm = S.events.filter(e => e.report?.motm === p.id).length;
  return { trTot: tr.length, trIn, trPct: pct(trIn, tr.length), matches: ms.length, basis: ms.filter(a => a.role === "basis").length,
    minutes: Math.round(ms.reduce((s, a) => s + (+a.minutes || 0), 0)), goals: ms.reduce((s, a) => s + (+a.goals || 0), 0), assists: ms.reduce((s, a) => s + (+a.assists || 0), 0),
    rating: avg(ms.map(a => a.rating).filter(Boolean)), evalAvg: last, topTag: top ? `${top[0]} (${top[1]}×)` : "", motm };
}

/* ============ navigatie ============ */
const ROUTES = {};
function route(name, def) { ROUTES[name] = def; }
const NAV = [
  { g: null, items: [["start", "Start", "home"]] },
  { g: "Mijn ploeg", team: true, items: [["ploeg", "Overzicht", "trophy"], ["kalender", "Kalender", "cal"], ["spelers", "Spelers", "ppl"], ["evaluaties", "Evaluaties", "star"], ["cijfers", "Cijfers", "chart"]] },
  { g: "Wedstrijd", items: [["uitslagen", "Uitslagen club", "ball"], ["live", "Live coachen", "mic"], ["matchday", "Wedstrijdblad", "sheet"], ["videoanalyse", "Videoanalyse", "split"]] },
  { g: "Training", items: [["trainingen", "Trainingen maken", "plan"], ["bibliotheek", "Trainings\u00ADbibliotheek", "book"], ["animatiebord", "Animatiebord", "board"]] },
  { g: "Mijn map", items: [["opslag", "Mijn opslag", "folder"], ["principes", "Mijn spelprincipes", "video"], ["mixschema", "Mixschema", "rotate"]] },
  { g: "Club", items: [["berichten", "Berichten", "mail"], ["terreinen", "Terreinen", "cal"], ["contacten", "Wie contacteer ik?", "phone"], ["scouting", "Scoutings\u00ADdatabase", "scout"]] }
];
const ALIAS = { activiteit: "kalender", verslag: "uitslagen", speler: "spelers", training: "trainingen", wedstrijd: "kalender", instellingen: "ploeg-instellingen", oefening: "bibliotheek", oefeningen: "bibliotheek", sjabloon: "trainingen", sjablonen: "bibliotheek", zonekaart: "opslag" };
function cur() { const h = location.hash.replace(/^#\/?/, "").split("/"); return { page: h[0] || "start", id: decodeURIComponent(h[1] || ""), sub: h[2] || "" }; }
function go(h) { if (location.hash === h) render(); else location.hash = h; }
let teardown = null;

function shell() {
  const r = cur(), active = ALIAS[r.page] || r.page, t = S.team, logged = !!db && (mode === "demo" || !!user);
  const coord = S.admin || S.allTeams || (S.teamAccess || []).length, nav = NAV.map(g => g.g === "Club" && coord ? { ...g, items: [["clubdashboard", "Clubdashboard", "chart"], ...g.items] } : g);
  const navHtml = (S.admin ? [...nav, { g: "Beheer", items: [["clubbeheer", "Beheer", "gear"]] }] : nav).map(sec => (sec.g ? `<div class="navgrp">${sec.g}</div>` : "") + sec.items.map(([k, l, i]) =>
    `<a href="#/${k}"${active === k ? ' aria-current="page"' : ""}>${IC[i]}<span>${l}</span>${k === "clubbeheer" && S.fbOpen ? `<span class="bdgn" title="${S.fbOpen} open meldingen">${S.fbOpen}</span>` : ""}</a>`).join("")).join("");
  const nm = myName(), who = mode === "demo" ? "Demomodus" : (nm || user?.email || ""), ini = mode === "demo" ? "D" : (who.replace(/[^a-z]/gi, "")[0] || "T").toUpperCase();
  const acct = logged ? `<div class="acct"><span class="av" aria-hidden="true">${ini}</span><span class="who"><b title="${esc(user?.email || who)}">${esc(who)}</b><small>${mode === "demo" ? "Voorbeeldgegevens" : nm ? esc(S.functie || (S.admin ? "Beheerder" : "Trainer")) + " · OG Vorselaar" : `<button class="link" type="button" data-setname>Je naam invullen</button>`}</small></span><button class="ib" type="button" data-logout title="${mode === "demo" ? "Demo verlaten" : "Afmelden"}" aria-label="${mode === "demo" ? "Demo verlaten" : "Afmelden"}">${IC.logout}</button></div>`
    : `<button class="btn small" type="button" data-login style="width:100%">Aanmelden</button>`;
  const teamBtn = logged ? `<button class="teampick" type="button" data-pick>${t ? `<span class="bdg">${esc((t.category || "OGV").slice(0, 4))}</span><span><b>${esc(t.name)}</b><small>${esc([t.format, t.season].filter(Boolean).join(" · ")) || "Mijn ploeg"}</small></span>` : `<span class="bdg">+</span><span><b>Kies je ploeg</b><small>${myTeams().length ? myTeams().length + " ploegen" : "Nog geen ploeg"}</small></span>`}</button>` : "";
  const keep = $(".side")?.scrollTop || 0; /* zijbalk blijft staan waar je was */
  $("#app").innerHTML = `<div class="shell${logged ? "" : " out"}">
  <aside class="side" aria-label="Hoofdmenu">
    <a class="brand" href="#/start"><img src="icons/icon-192.png" alt=""><span><b>OGV Trainers</b><small>Jeugdwerking OG Vorselaar</small></span></a>
    ${teamBtn}
    <nav class="nav">${navHtml}${logged && t ? `<a href="#/ploeg-instellingen"${active === "ploeg-instellingen" ? ' aria-current="page"' : ""}>${IC.gear}<span>Ploeg en trainers</span></a>` : ""}</nav>
    <div class="foot">${logged ? `<button class="navbtn" type="button" data-report>${IC.note || IC.eye}<span>Probleem melden</span></button><a class="navbtn" href="handleiding/uitgebreid.html" target="_blank" rel="noopener">${IC.book}<span>Handleiding</span></a>` : ""}${acct}<div class="frow"><span>Weergave</span>${themeSwitch()}</div></div>
  </aside>
  <main>
    <header class="topbar"><img src="icons/icon-192.png" alt="">${teamBtn || `<b style="flex:1;font-weight:900;font-stretch:118%">OGV Trainers</b>`}${mode === "demo" ? '<span class="pill" style="background:var(--info);color:#000">Demo</span>' : ""}</header>
    <div class="page" id="view"></div>
  </main>
  <nav class="tabbar" aria-label="Snelmenu">
    ${[["start","Start","home"],["kalender","Kalender","cal"],["trainingen","Training","plan"],["matchday","Wedstrijdblad","sheet"]].map(([k,l,i]) => `<a href="#/${k}"${active === k ? ' aria-current="page"' : ""}>${IC[i]}<span>${l}</span></a>`).join("")}
    <button type="button" data-sheet>${IC.menu}<span>Meer</span></button>
  </nav>
  <div class="sheet" id="sheet"><div class="in"><div class="grab"></div><nav class="nav">${navHtml}${logged && t ? `<a href="#/ploeg-instellingen">${IC.gear}<span>Ploeg en trainers</span></a>` : ""}</nav>
    <div class="sheetfoot">${logged ? `<button class="navbtn" type="button" data-report>${IC.note || IC.eye}<span>Probleem melden</span></button><a class="navbtn" href="handleiding/uitgebreid.html" target="_blank" rel="noopener">${IC.book}<span>Handleiding</span></a>` : ""}<div class="frow"><span>Weergave</span>${themeSwitch(true)}</div>${acct}</div></div></div>
  </div>`;
  const sd = $(".side"); if (sd && keep) sd.scrollTop = keep;
  $$("[data-pick]").forEach(b => b.onclick = pickTeam);
  bindThemeSwitch();
  $$("[data-logout]").forEach(b => b.onclick = logout);
  $$("[data-setname], .acct .who b").forEach(b => b.onclick = () => mode !== "demo" && nameForm());
  $$("[data-login]").forEach(b => b.onclick = () => go("#/aanmelden"));
  $$("[data-report]").forEach(b => b.onclick = () => { $("#sheet")?.classList.remove("open"); reportProblem(); });
  const sh = $("#sheet"); $("[data-sheet]").onclick = () => sh.classList.add("open"); sh.onclick = e => { if (e.target === sh || e.target.closest("a")) sh.classList.remove("open"); };
}
let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  if (teardown) { try { teardown(); } catch (e) {} teardown = null; }
  const r = cur(), def = ROUTES[r.page] || ROUTES.start;
  shell(); const v = $("#view");
  if (def.wide) v.classList.add("wide");
  const logged = !!db && (mode === "demo" || !!user);
  /* alles achter aanmelden en de clubcode, behalve het aanmeldscherm zelf */
  if (r.page !== "aanmelden" && !logged) { viewLogin(v); return; }
  if (r.page !== "aanmelden" && mode === "cloud" && S.member === false) { viewJoin(v); return; }
  if (def.team && !S.team) { viewNoTeam(v); return; }
  try { const td = await def.render(v, r.id, r.sub);
    if (typeof td === "function") { if (seq === renderSeq) teardown = td; else try { td(); } catch (x) {} } /* een nieuwere weergave kwam tussen */ }
  catch (e) { console.error(e); v.innerHTML = `<div class="empty"><b>Er liep iets mis</b>${esc(e.message || e)}<br><button class="btn" type="button" onclick="location.reload()">Opnieuw laden</button></div>`; }
  document.title = (def.title ? def.title + " | " : "") + "OGV Trainers";
  if (!def.keepScroll) scrollTo(0, 0);
}
addEventListener("hashchange", () => { const d = $("#dlg"); if (d?.open) d.close(); render(); }); /* terugknop op gsm sluit ook een open venster */

function backLink(href, label) { return `<a class="crumb" href="${href}">${IC.back}${esc(label)}</a>`; }
function head(title, sub, actions = "") { return `<div class="ph"><div class="t"><h1 class="pg">${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div>${actions}</div>`; }

/* ============ probleem melden ============ */
const ERRLOG = [];
addEventListener("error", e => { ERRLOG.push(String(e.message || e.error || "fout").slice(0, 200)); if (ERRLOG.length > 6) ERRLOG.shift(); });
addEventListener("unhandledrejection", e => { ERRLOG.push(String(e.reason?.message || e.reason || "fout").slice(0, 200)); if (ERRLOG.length > 6) ERRLOG.shift(); });
const appVersion = () => (document.querySelector('script[src*="core.js"]')?.src.match(/v=(\d+)/) || [])[1] || "?";
function reportProblem() {
  const info = { pagina: location.hash || "#/start", versie: appVersion(), toestel: navigator.userAgent, scherm: `${innerWidth}×${innerHeight}`, thema: document.documentElement.dataset.theme, online: navigator.onLine, ploeg: S.team?.name || null, fouten: ERRLOG.slice() };
  const d = dialog(`<form><h2>Probleem melden</h2><p class="muted" style="margin:0">Iets werkt niet, is onduidelijk of kan beter? Laat het weten. De beheerder krijgt je melding te zien.</p>
    <div class="chips" id="fbk">${["Er werkt iets niet", "Idee of wens", "Vraag"].map((k, i) => `<button type="button" class="chip" data-k="${k}" aria-pressed="${i === 0}">${k}</button>`).join("")}</div>
    <label class="f">Wat gebeurde er?<textarea name="msg" rows="5" required placeholder="bv. Als ik op Bewaren tik bij een oefening, gebeurt er niets."></textarea></label>
    <label class="check"><input type="checkbox" name="tech" checked> Technische info meesturen (pagina, toestel, laatste foutmeldingen)</label>
    <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Versturen</button></div></form>`);
  let kind = "Er werkt iets niet"; $$("#fbk [data-k]", d).forEach(b => b.onclick = () => { kind = b.dataset.k; $$("#fbk [data-k]", d).forEach(z => z.setAttribute("aria-pressed", z === b)); });
  $("form", d).onsubmit = async ev => { ev.preventDefault(); const f = ev.target, msg = f.msg.value.trim(); if (!msg) return;
    if (mode === "demo") { d.close(); toast("In de demo wordt niets verstuurd."); return; }
    const row = { message: msg, kind, page: info.pagina, email: user?.email || null, name: myName() || null, info: f.tech.checked ? info : {} };
    const { error } = await sb.from("feedback").insert(row);
    if (error) { const txt = `[${kind}] ${msg}\n\n${f.tech.checked ? JSON.stringify(info) : ""}`; navigator.clipboard?.writeText(txt).catch(() => {});
      toast(isNetErr(error) ? "Geen verbinding. Je melding is gekopieerd: plak ze later of stuur ze via WhatsApp." : "Versturen lukte niet. Je melding is gekopieerd: stuur ze naar de beheerder."); return; }
    d.close(); toast("Bedankt! Je melding is verstuurd."); };
}

/* ============ naam van de trainer (in het account, zodat andere trainers en de beheerder je herkennen) ============ */
const myName = () => (user?.user_metadata?.full_name || "").trim();
function nameForm() {
  const d = dialog(`<form><h2>Jouw naam</h2><p class="muted" style="margin:0">Andere trainers en de beheerder zien je naam in plaats van alleen je e-mailadres.</p>
    <label class="f">Voornaam en naam<input name="nm" required maxlength="60" autocomplete="name" value="${esc(myName())}" placeholder="bv. Jelle Lauwers"></label>
    <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">Bewaren</button></div></form>`);
  $("form", d).onsubmit = async ev => { ev.preventDefault(); const n = ev.target.nm.value.trim().replace(/\s+/g, " "); if (!n) return;
    const r = await safe(async () => { const { data, error } = await sb.auth.updateUser({ data: { full_name: n } }); if (error) throw error; user = data.user; return true; }, "Naam bewaard.");
    if (r) { d.close(); render(); } };
}

/* ============ ploeg kiezen ============ */
/* nog geen ploeg: vragen of een collega de ploeg al aanmaakte, zodat er geen dubbele ploeg ontstaat */
function noTeamHelp(host, done) {
  /* alleen de beheerder koppelt trainers aan ploegen: de trainer vraagt toegang, het verzoek komt bij de meldingen */
  const teams = (S.teams || []).slice().sort((a, b) => (a.category || a.name).localeCompare(b.category || b.name, "nl", { numeric: true }));
  host.innerHTML = `<div class="nth"><b>Vraag toegang tot je ploeg</b><p class="muted" style="margin:0">De beheerder van de club koppelt trainers aan hun ploeg. Kies je ploeg en verstuur je vraag: de beheerder krijgt ze meteen te zien.</p>
    <label class="f">Mijn ploeg<select id="ntt"><option value="">Kies je ploeg…</option>${teams.map(t => `<option value="${t.id}">${esc(t.name)}${t.season ? " · " + esc(t.season) : ""}</option>`).join("")}<option value="?">Mijn ploeg staat er niet tussen</option></select></label>
    <label class="f">Bericht <span class="hint">niet verplicht</span><input id="ntm" maxlength="200" placeholder="bv. Ik ben de nieuwe hulptrainer van de U9"></label>
    <div class="nthb"><button class="btn" type="button" id="nts">Toegang vragen</button><button class="btn ghost" type="button" id="ntr">${IC.rotate}Kijk opnieuw</button></div></div>`;
  $("#nts", host).onclick = async () => { const tv = $("#ntt", host).value; if (!tv) { toast("Kies eerst je ploeg."); return; }
    if (mode === "demo") { toast("In de demo wordt niets verstuurd."); return; }
    const t = teams.find(x => x.id === tv), extra = $("#ntm", host).value.trim();
    const row = { kind: "Toegang tot ploeg", page: "#/clubbeheer/ploegen", email: user?.email || null, name: myName() || null,
      message: `${myName() || user?.email} vraagt toegang tot ${t ? t.name : "een ploeg die nog niet in de app staat"}.${extra ? "\n" + extra : ""}`, info: { ploeg: t?.id || null, ploegnaam: t?.name || null, email: user?.email } };
    const { error } = await sb.from("feedback").insert(row);
    if (error) { toast("Versturen lukte niet. Vraag het rechtstreeks aan de beheerder of de jeugdcoördinator."); return; }
    host.innerHTML = `<div class="nth"><b>Je vraag is verstuurd</b><p class="muted" style="margin:0">Zodra de beheerder je gekoppeld heeft, tik je op <b>Kijk opnieuw</b> en open je meteen je ploeg.</p><div class="nthb"><button class="btn" type="button" id="ntr">${IC.rotate}Kijk opnieuw</button></div></div>`; bindR(); };
  const bindR = () => { $("#ntr", host).onclick = async () => { await loadTeams(); if (myTeams().length) { const t = myTeams()[0]; done && done(); await loadTeam(t.id); toast(`Welkom bij ${t.name}!`); render(); } else toast("Je bent nog niet gekoppeld. Even geduld, of vraag het aan de beheerder."); }; };
  bindR();
}
function viewNoTeam(v) {
  const ts = myTeams();
  v.innerHTML = head("Kies je ploeg", ts.length ? "Met welke ploeg wil je werken?" : S.admin ? "Je bent nog aan geen ploeg gekoppeld. Als beheerder maak je ploegen aan en koppel je trainers in Beheer." : "Je bent nog aan geen ploeg gekoppeld.") +
    (ts.length ? `<div class="list">${ts.map(t => `<div class="item" data-team="${t.id}"><span class="num">${esc((t.category || "").slice(0, 4))}</span><span class="main"><b>${esc(t.name)}</b><small>${esc([t.format, t.season].filter(Boolean).join(" · "))}</small></span>${IC.chev}</div>`).join("")}</div>` : "") +
    (ts.length ? (S.admin ? `<p style="margin-top:18px"><button class="btn" type="button" id="nt">${IC.plus}Nieuwe ploeg</button></p>` : "") : S.admin ? `<p style="margin-top:18px"><a class="btn" href="#/clubbeheer/ploegen">Ploegen aanmaken in Beheer</a></p>` : `<div class="panel" id="nth" style="margin-top:6px"></div>`);
  $$("[data-team]", v).forEach(x => x.onclick = async () => { await loadTeam(x.dataset.team); render(); });
  const nt = $("#nt"); if (nt) nt.onclick = () => teamForm(); const nh = $("#nth"); if (nh) noTeamHelp(nh);
}
function pickTeam() {
  if (!db || (mode !== "demo" && !user)) { go("#/aanmelden"); return; }
  const d = dialog(`<div class="dlg"><h2>Ploeg kiezen</h2><div class="list">${myTeams().map(t => `<div class="item" data-team="${t.id}"><span class="num">${esc((t.category || "").slice(0, 4))}</span><span class="main"><b>${esc(t.name)}</b><small>${esc([t.format, t.season].filter(Boolean).join(" · "))}</small></span>${t.id === S.team?.id ? IC.check : ""}</div>`).join("") || '<div id="nth"></div>'}</div>
  <div class="row">${S.admin ? `<button class="btn ghost" type="button" id="nt">${IC.plus}Nieuwe ploeg</button>` : ""}<span class="spacer"></span><button class="btn ghost" type="button" data-close>Sluiten</button></div></div>`);
  if (!myTeams().length && !S.admin) noTeamHelp($("#nth", d), () => d.close());
  $$("[data-team]", d).forEach(x => x.onclick = async () => { d.close(); await loadTeam(x.dataset.team); render(); });
  const ntb = $("#nt", d); if (ntb) ntb.onclick = () => { d.close(); teamForm(); };
}
function teamForm(t) {
  const n = !t; t = t || { name: "", category: "", format: "5v5", season: seasonNow() };
  const mf = matchFormat(t);
  const d = dialog(`<form><h2>${n ? "Nieuwe ploeg" : "Ploeg bewerken"}</h2><div class="fields">
    <label class="f full">Naam<input name="name" required value="${esc(t.name)}" placeholder="bv. U9 Geel"></label>
    <label class="f">Categorie<input name="category" value="${esc(t.category)}" placeholder="U9"></label>
    <label class="f">Spelvorm<select name="format">${["2v2","3v3","5v5","8v8","11v11"].map(f => `<option${f === t.format ? " selected" : ""}>${f}</option>`).join("")}</select></label>
    <label class="f">Seizoen<input name="season" value="${esc(t.season)}"></label>
    <label class="f">Aantal periodes<input name="periods" type="number" min="1" max="8" value="${mf.periods}"></label>
    <label class="f">Minuten per periode<input name="period_minutes" type="number" min="5" max="60" value="${mf.minutes}"></label></div>
    <div class="row"><span class="spacer"></span><button class="btn ghost" type="button" data-close>Annuleren</button><button class="btn">${n ? "Ploeg aanmaken" : "Opslaan"}</button></div></form>`);
  $("form", d).onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    const row = { ...(n ? { id: uid() } : S.team), name: f.name.trim(), category: f.category.trim(), format: f.format, season: f.season.trim(), periods: +f.periods || null, period_minutes: +f.period_minutes || null };
    if (n) row.criteria = EV_TEMPLATE.slice(); if (n && mode === "demo") row.worktags = DEF_TAGS;
    await safe(async () => { if (n) { await db.insert("teams", row); if (mode === "demo") await db.save("team_trainers", { team_id: row.id, user_id: "demo", email: "demo@ogvorselaar.be" }); } else await db.save("teams", row);
      await loadTeams(); await loadTeam(row.id); d.close(); go(n ? "#/spelers" : "#/ploeg-instellingen"); }, n ? "Ploeg aangemaakt. Voeg nu je spelers toe." : "Ploeg opgeslagen."); };
}

/* ============ aanmelden ============ */
route("aanmelden", { title: "Aanmelden", render: v => viewLogin(v) });
function viewLogin(v, msg) {
  v.innerHTML = `<div class="authbox"><h1>OGV<span>Trainers</span></h1><p class="muted">${esc(msg || "Meld je aan met je trainersaccount. Het is hetzelfde account als voor het Animatiebord.")}</p>
  <form id="lf" style="display:flex;flex-direction:column;gap:12px"><label class="f">E-mailadres<input type="email" name="email" required autocomplete="username"></label>
   <label class="f">Wachtwoord<input type="password" name="pw" required autocomplete="current-password"></label><div class="err" id="lerr"></div><button class="btn">Aanmelden</button></form>
  <div class="row"><button class="link" type="button" id="forgot">Wachtwoord vergeten</button><span class="spacer"></span><a class="link" href="handleiding/" target="_blank" rel="noopener">Handleiding</a>${LOCAL ? `<button class="link" type="button" id="demo">Bekijk de demo</button>` : ""}</div>
  <div class="panel" style="padding:14px 16px"><b>Nog geen account?</b><p class="hint" style="margin:4px 0 10px">Maak er zelf een aan met de clubcode die je van de jeugdcoördinator kreeg.</p><button class="btn ghost small" type="button" id="reg">Account aanmaken</button></div></div>`;
  $("#lf").onsubmit = async e => { e.preventDefault(); if (!sb) { $("#lerr").textContent = "Geen verbinding met de database."; return; }
    const btn = $("button", e.target); btn.disabled = true; btn.textContent = "Bezig met aanmelden…"; $("#lerr").textContent = "";
    try { const { error } = await sb.auth.signInWithPassword({ email: e.target.email.value.trim(), password: e.target.pw.value });
      if (error) $("#lerr").textContent = error.message === "Invalid login credentials" ? "E-mailadres of wachtwoord klopt niet." : error.message === "Email not confirmed" ? "Je account is nog niet bevestigd. Vraag de beheerder om het te bevestigen in Supabase." : error.message;
      else btn.textContent = "Je ploegen worden geladen…"; }
    catch (x) { $("#lerr").textContent = "Aanmelden lukt niet: controleer je internetverbinding."; }
    finally { if ($("#lerr").textContent) { btn.disabled = false; btn.textContent = "Aanmelden"; } } };
  $("#forgot").onclick = async () => { const m = $("#lf").email.value.trim(); if (!m) { $("#lerr").textContent = "Vul eerst je e-mailadres in."; return; }
    if (sb) await sb.auth.resetPasswordForEmail(m, { redirectTo: location.origin + location.pathname }); $("#lerr").textContent = "Als dit adres een account heeft, staat er nu een mail in je mailbox."; };
  const dm = $("#demo"); if (dm) dm.onclick = startDemo; $("#reg").onclick = () => viewRegister(v);
}
async function startCloud() {
  mode = "cloud"; db = SBDB;
  await clubStatus(); if (!S.member) { render(); return; } if (typeof v14Check === "function") await v14Check(); setTimeout(fbCount, 1500); setInterval(fbCount, 120000);
  try { await loadTeams(); const last = (() => { try { return localStorage.getItem(TEAM_KEY); } catch (e) {} })();
    const pick = myTeams().find(t => t.id === last) || (myTeams().length === 1 ? myTeams()[0] : null); if (pick) await loadTeam(pick.id); }
  catch (e) { console.error(e); db = null; mode = null; shell(); viewLogin($("#view"), /relation|does not exist|schema cache|column/i.test(e.message || "") ? "De database is nog niet klaargezet. De beheerder moet eerst supabase-setup.sql uitvoeren." : "Laden mislukt: " + (e.message || e)); return; }
  if (cur().page === "aanmelden") location.hash = "#/start"; else render();
}
async function startDemo() { mode = "demo"; db = DEMODB; user = { id: "demo", email: "demo" }; S.member = true; S.admin = true; S.v14 = true; try { sessionStorage.setItem("ogv-mode", "demo"); } catch (e) {}
  await loadTeams(); await loadTeam(myTeams()[0].id); if (cur().page === "aanmelden") location.hash = "#/start"; else render(); }
async function logout() { if (mode === "demo") { try { sessionStorage.removeItem("ogv-mode"); } catch (e) {} } else if (sb) await sb.auth.signOut();
  mode = null; db = null; user = null; Object.assign(S, { teams: [], myTeamIds: [], team: null, club: null, member: null, admin: false }); go("#/start"); }

/* ============ demo-gegevens (verzonnen) ============ */
function demoSeed() {
  let r = 11; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280, pick = a => a[Math.floor(rnd() * a.length)];
  const today = new Date(), d = { teams: [], team_trainers: [], players: [], events: [], attendance: [], evaluations: [], goals: [], scouting: [], club_docs: [] };
  const mk = (name, cat, format, mine, names) => {
    const team = { id: uid(), name, category: cat, format, season: seasonNow(), criteria: EV_TEMPLATE.slice(), worktags: DEF_TAGS, share_ratings: !mine, periods: FORMAT_DEF[format][0], period_minutes: FORMAT_DEF[format][1] };
    d.teams.push(team); if (mine) d.team_trainers.push({ team_id: team.id, user_id: "demo", email: "demo@ogvorselaar.be" });
    const pos = ["1 · Doelman","3 · Centrale verdediger","2 · Rechtsachter","8 · Centrale middenvelder","7 · Rechtsbuiten","11 · Linksbuiten","9 · Spits","10 · Aanvallende middenvelder","5 · Linksachter","9 · Spits","6 · Verdedigende middenvelder","4 · Centrale verdediger"];
    const ps = names.map((n, i) => ({ id: uid(), team_id: team.id, first_name: n[0], last_name: n[1], birthdate: (format === "5v5" ? "2018" : "2016") + "-0" + (1 + i % 9) + "-1" + (i % 9), number: i + 1, position: pos[i], foot: i % 4 ? "Rechts" : "Links", active: true }));
    d.players.push(...ps);
    const opps = ["KFC Lille","Herenthout VV","Zandhoven","Wiekevorst","Bouwel","Nijlen","Pulle","Massenhoven","Grobbendonk","Viersel"];
    for (let w = -6; w <= 2; w++) {
      const wed = addDays(monday(today), w * 7 + 2), sat = addDays(monday(today), w * 7 + 5);
      d.events.push({ id: uid(), team_id: team.id, type: "training", date: iso(wed), start_time: "18:00", end_time: "19:15", location: mine ? "Terrein C" : "KGV (terrein D)", theme: pick(THEMES.slice(0, 6)), report: {} });
      d.events.push({ id: uid(), team_id: team.id, type: "wedstrijd", date: iso(sat), start_time: mine ? "10:00" : "11:30", location: w % 2 ? (mine ? "Terrein B" : "Terrein A") : "Uit", opponent: opps[(w + 6 + (mine ? 0 : 3)) % opps.length], home: !!(w % 2), report: {} });
    }
    for (const e of d.events.filter(x => x.team_id === team.id && x.date <= iso(today))) {
      const present = [];
      for (const p of ps) { const x = rnd(); const st = x < .84 ? "aanwezig" : x < .91 ? "verwittigd" : x < .96 ? "afwezig" : "geblesseerd";
        const a = { event_id: e.id, player_id: p.id, team_id: team.id, status: st, tags: [], strengths: [], scores: {}, player_name: pname(p) };
        if (e.type === "wedstrijd" && st === "aanwezig") present.push([p, a]);
        d.attendance.push(a); }
      if (e.type === "training") { e.report = { good: "Veel inzet in de wedstrijdvorm.", better: "Meer praten op het veld." }; continue; }
      const mf = FORMAT_DEF[format], total = mf[0] * mf[1];
      const goalsFor = Math.floor(rnd() * 5), goalsAg = Math.floor(rnd() * 4), gl = [];
      for (let i = 0; i < goalsFor; i++) { const [p, a] = pick(present) || []; if (!p) break; a.goals = (a.goals || 0) + 1; const as = pick(present); if (as && as[0] !== p && rnd() < .6) as[1].assists = (as[1].assists || 0) + 1;
        gl.push({ id: uid(), min: 1 + Math.floor(rnd() * total), side: "for", player_id: p.id, name: pname(p), assist_id: as && as[0] !== p ? as[0].id : null, assist_name: as && as[0] !== p ? pname(as[0]) : "", type: pick(["Open spel","Open spel","Stilstaande fase","Counter"]) }); }
      for (let i = 0; i < goalsAg; i++) gl.push({ id: uid(), min: 1 + Math.floor(rnd() * total), side: "against", type: pick(["Open spel","Stilstaande fase"]) });
      gl.sort((a, b) => a.min - b.min);
      e.score_for = goalsFor; e.score_against = goalsAg;
      present.forEach(([p, a], i) => { a.role = i < (format === "5v5" ? 5 : 8) ? "basis" : "wissel"; a.minutes = a.role === "basis" ? total - Math.floor(rnd() * 3) * mf[1] / 2 : Math.round(total / 2); a.rating = 4 + Math.floor(rnd() * 6);
        a.scores = Object.fromEntries(PILLARS.map(k => [k, 2 + Math.floor(rnd() * 4)])); a.strengths = [pick(STRENGTHS)]; if (rnd() < .5) a.tags = [pick(DEF_TAGS)];
        a.note = rnd() < .4 ? pick(["Sterke match, veel balrecuperaties.","Durfde de bal te vragen.","Moet sneller kijken voor hij de bal krijgt.","Mooie assist in het tweede kwart."]) : ""; });
      const best = present.slice().sort((x, y) => (y[1].rating || 0) - (x[1].rating || 0))[0];
      e.report = { kind: "Competitie", formation: format === "5v5" ? "1-2-1-1" : "1-3-3-1", pitch: "Kunstgras", weather: pick(["Droog","Regen","Zon","Wind"]), half_for: Math.floor(goalsFor / 2), half_against: Math.floor(goalsAg / 2),
        goals: gl, motm: best ? best[0].id : null, motm_name: best ? pname(best[0]) : "", team_rating: 5 + Math.floor(rnd() * 4),
        moments: Object.fromEntries(Object.keys(PRINC).map(k => [k, { score: 2 + Math.floor(rnd() * 4), note: "" }])),
        opponent: "Fysiek sterk, speelden veel lange ballen.", good: "Goed opgebouwd van achteruit, veel balbezit in de eerste helft.", better: "Sneller omschakelen na balverlies, meer praten.", actions: "Training woensdag: 3B omschakeling B+ naar B-.", };
      if (e.report.moments["1A"]) e.report.moments["1A"].note = "Keeper speelde goed in, backs stonden breed.";
    }
    return { team, ps };
  };
  const a = mk("Demoploeg U9", "U9", "5v5", true, [["Lio","Peeters"],["Mats","Janssens"],["Odin","Maes"],["Juul","Claes"],["Remi","Wouters"],["Staf","Goossens"],["Nore","Mertens"],["Lou","Willems"],["Bas","Jacobs"],["Fien","Hermans"]]);
  mk("Demoploeg U11", "U11", "8v8", false, [["Wout","Aerts"],["Kas","Smets"],["Jef","Vermeulen"],["Mil","Pauwels"],["Tibo","Dubois"],["Vic","Lambrechts"],["Gust","Michiels"],["Ward","Cools"],["Rob","Segers"],["Lars","Hendrickx"],["Tuur","Verbeke"]]);
  const pr = a.ps;
  d.evaluations = pr.flatMap(p => [1, 2].map(m => ({ id: uid(), team_id: a.team.id, player_id: p.id, moment: m, date: iso(addDays(today, m === 1 ? -70 : -14)), scores: Object.fromEntries(evItems({ criteria: EV_TEMPLATE }).map(c => [c, Math.min(5, Math.round((2 + rnd() * 2 + (m - 1) * .5) * 2) / 2)])), comment: "",
    details: m === 2 ? { strengths: "Inzet, Passing", workpoints: "Zelfvertrouwen, Coaching", goals: "Elke training minstens één keer de bal vragen" } : {} })));
  d.goals = [{ id: uid(), team_id: a.team.id, player_id: pr[3].id, text: "Met links leren passen over 10 meter", area: "Techniek", term: "kort", status: "bezig" },
             { id: uid(), team_id: a.team.id, player_id: pr[6].id, text: "Na balverlies meteen druk zetten", area: "Tactiek", term: "middellang", status: "bezig" }];
  d.scouting = [["Voorbeeldspeler A","FC Voorbeeld U13","Centrale middenvelder",[8,7,8.5,8,7.5]],["Voorbeeldspeler B","SK Demo U13","Spits",[6,8,6.5,7,6]],["Voorbeeldspeler C","VV Proef U12","Linksachter",[7,6,7,6.5,8]]]
    .map(([naam, club, p1, k], i) => ({ id: "demo" + i, data: { naam, club, p1, p2: "", p3: "", geb: "2013-0" + (i + 3) + "-12", voet: ["Rechts","Links","Beide"][i], k0: k[0], k1: k[1], k2: k[2], k3: k[3], k4: k[4], stat: ["Nieuw","Blijven volgen","Uitnodigen"][i], sterk: "Verzonnen voorbeeld om de demo te tonen.", werk: "", ctx: "", dat: iso(addDays(today, -i * 9)), bron: "Demowedstrijd", scout: "Demo", ts: Date.now() - i } }));
  d.club_docs = [];
  const now = new Date().toISOString(), it = (kind, title, data, extra = {}) => ({ id: uid(), user_id: "demo", kind, title, data, created_at: now, updated_at: now, ...extra });
  d.trainer_items = [
    ...DEMO_PRINCIPLES.map(p => it("principe", p.t, { format: p.f, moment: p.m, kern: p.k, video_url: "media/principes/" + p.v + ".mp4", poster: "media/principes/" + p.v + ".jpg" })),
    it("mixschema", "Gemengde wedstrijd U9", mixMake(pr.map((p, i) => ({ name: p.first_name, group: i < 5 ? "A" : "B" })), 12, 2)),
    it("oefening", "Rondo 4v1 met omschakeling", { phase: "Kern", cats: ["BASICS > Balbezit > Passing"], intensity: 5, work: "03:00", rest: 60, reps: 4, org: "Vier spelers rond een vierkant van 8 op 8 meter, één verdediger in het midden.", criteria: "Bal in de voet spelen.\nNa de pass meteen opnieuw aanspeelbaar worden.", material: "4 kegels, ballen, hesjes", size: "8 × 8 m",
      diagram: { field: "square", objs: [{ t: "cone", x: 25, y: 25 }, { t: "cone", x: 75, y: 25 }, { t: "cone", x: 25, y: 75 }, { t: "cone", x: 75, y: 75 }, { t: "p1", x: 25, y: 18, n: "1" }, { t: "p1", x: 82, y: 50, n: "2" }, { t: "p1", x: 50, y: 82, n: "3" }, { t: "p1", x: 18, y: 50, n: "4" }, { t: "p2", x: 50, y: 50, n: "" }, { t: "pass", x: 25, y: 18, x2: 80, y2: 48 }, { t: "run", x: 50, y: 50, x2: 70, y2: 40 }] } })
  ];
  return d;
}

/* ============ opstarten ============ */
const LOCAL = /^(localhost|127\.|\[::1\])/.test(location.hostname);
function boot() {
  let demo = false; try { demo = sessionStorage.getItem("ogv-mode") === "demo"; } catch (e) {}
  if (new URLSearchParams(location.search).has("demo")) demo = true;
  if (!LOCAL) { demo = false; try { sessionStorage.removeItem("ogv-mode"); } catch (e) {} } /* demo alleen om lokaal te testen */
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "tb_auth" } });
    let started = false;
    sb.auth.onAuthStateChange((ev, session) => { if (mode === "demo") return;
      /* Supabase houdt tijdens deze melding een slot vast: databaseoproepen moeten erna gebeuren, anders blijft alles hangen. */
      if (session?.user) { user = session.user; if (!started) { started = true; setTimeout(startCloud, 0); } }
      else if (started || ev === "SIGNED_OUT") { started = false; user = null; db = null; mode = null; render(); } });
  }
  if (demo) { startDemo(); return; }
  if (!sb) { render(); return; }
  sb.auth.getSession().then(({ data }) => { if (!data.session && mode !== "demo") render(); });
}
