// FootballCoachHub — pushmeldingen. Elk uur (pg_cron) met {kind:"tick"}; een aangemelde gebruiker kan {kind:"test"} sturen.
// Verstuurt: afgelastingen (ouders + trainers), "komt je kind morgen?" (ouders, 17-20u), "X komt niet" (trainers),
// vergeten aanwezigheden (trainers, 9-21u). Elke melding maar één keer (tabel notif_sent).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP = Deno.env.get("APP_URL") || "https://arneschepens5-oss.github.io/ogv-trainers/";
const db = createClient(URL_, KEY, { auth: { persistSession: false } });
/* sleutels: de eerste keer zelf aanmaken en bewaren in push_keys (enkel leesbaar voor deze functie) */
let KEYS: { public_key: string; private_key: string } | null = null;
async function keys() {
  if (KEYS) return KEYS;
  let { data } = await db.from("push_keys").select("public_key,private_key").eq("id", 1).maybeSingle();
  if (!data) { const k = webpush.generateVAPIDKeys(); await db.from("push_keys").insert({ id: 1, public_key: k.publicKey, private_key: k.privateKey });
    ({ data } = await db.from("push_keys").select("public_key,private_key").eq("id", 1).maybeSingle()); }
  if (!data) throw new Error("Sleutels voor meldingen ontbreken: voer supabase-meldingen-v48.sql uit.");
  KEYS = data; webpush.setVapidDetails("mailto:gc@og-vorselaar.be", data.public_key, data.private_key); return KEYS;
}
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-cron-key", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

/* datum en uur in België */
const bru = (d = new Date()) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour % 24 }; };
const addD = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayTxt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const what = (e: any) => e.type === "wedstrijd" ? `de wedstrijd${e.opponent ? (e.home === false ? " bij " : " tegen ") + e.opponent : ""}` : "de training";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; prefs: any; fails: number };
async function send(s: Sub, msg: { title: string; body: string; url?: string; tag?: string }) {
  try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...msg, url: msg.url && !/^https?:/.test(msg.url) ? APP + msg.url : msg.url || APP }), { TTL: 6 * 3600, urgency: "normal" }); return true; }
  catch (e: any) { const code = e?.statusCode;
    if (code === 404 || code === 410 || s.fails >= 5) await db.from("push_subs").delete().eq("id", s.id); else await db.from("push_subs").update({ fails: s.fails + 1 }).eq("id", s.id);
    return false; }
}
/* eenmalig: true als deze sleutel nog niet verstuurd werd (en markeert hem) */
async function once(key: string) { const { error } = await db.from("notif_sent").insert({ key }); return !error; }
const on = (s: Sub, k: string) => s.prefs?.[k] !== false;

async function tick() {
  const now = bru(), today = now.date, out = { cancel: 0, ask: 0, nee: 0, att: 0 };
  const { data: subs } = await db.from("push_subs").select("id,endpoint,p256dh,auth,prefs,fails,user_id,player_id");
  if (!subs?.length) return out;
  const parentSubs = subs.filter(s => s.player_id), trainerSubs = subs.filter(s => s.user_id);
  const { data: tt } = await db.from("team_trainers").select("team_id,user_id").not("user_id", "is", null);
  const trainersOf = (team: string) => new Set((tt || []).filter(r => r.team_id === team).map(r => r.user_id));
  const pids = [...new Set(parentSubs.map(s => s.player_id))];
  const { data: players } = pids.length ? await db.from("players").select("id,first_name,team_id,active").in("id", pids) : { data: [] as any[] };
  const P = new Map((players || []).filter(p => p.active !== false).map(p => [p.id, p]));
  const parentsOfTeam = (team: string) => parentSubs.filter(s => P.get(s.player_id)?.team_id === team);
  const { data: teams } = await db.from("teams").select("id,name");
  const T = new Map((teams || []).map(t => [t.id, t.name]));

  /* a) afgelastingen in de komende twee weken */
  const { data: off } = await db.from("events").select("id,team_id,type,date,start_time,opponent,home,cancelled,rbfa_state").gte("date", today).lte("date", addD(today, 14)).or("cancelled.eq.true,rbfa_state.eq.afgelast");
  for (const e of off || []) { if (!(await once("cancel:" + e.id))) continue;
    const msg = { title: `Afgelast: ${what(e)}`, body: `${T.get(e.team_id) || ""} · ${dayTxt(e.date)}${e.start_time ? " om " + String(e.start_time).slice(0, 5) : ""}`, tag: "cancel-" + e.id };
    for (const s of parentsOfTeam(e.team_id)) if (on(s, "cancel")) { await send(s, { ...msg, url: "ouder/#" }); out.cancel++; }
    const tr = trainersOf(e.team_id); for (const s of trainerSubs) if (tr.has(s.user_id) && on(s, "cancel")) { await send(s, { ...msg, url: "#/activiteit/" + e.id }); out.cancel++; } }

  /* b) ouders: komt je kind morgen? (tussen 17 en 20 uur, enkel als er nog niet geantwoord is en het kind niet afgemeld is) */
  if (now.hour >= 17 && now.hour < 20 && parentSubs.length) {
    const tom = addD(today, 1), teamIds = [...new Set([...P.values()].map(p => p.team_id))];
    const { data: evs } = await db.from("events").select("id,team_id,type,date,start_time,opponent,home,cancelled,rbfa_state").eq("date", tom).in("team_id", teamIds);
    const live = (evs || []).filter(e => !e.cancelled && e.rbfa_state !== "afgelast" && (e.type === "training" || e.type === "wedstrijd"));
    if (live.length) {
      const ids = live.map(e => e.id);
      const { data: rs } = await db.from("rsvp").select("event_id,player_id").in("event_id", ids);
      const { data: ab } = await db.from("player_absence").select("player_id,date_from,date_to").lte("date_from", tom).or(`date_to.is.null,date_to.gte.${tom}`);
      for (const e of live) for (const s of parentsOfTeam(e.team_id)) { const p = P.get(s.player_id); if (!p || !on(s, "ask")) continue;
        if ((rs || []).some(r => r.event_id === e.id && r.player_id === p.id) || (ab || []).some(a => a.player_id === p.id)) continue;
        if (!(await once(`ask:${e.id}:${p.id}`))) continue;
        await send(s, { title: `Komt ${p.first_name} morgen naar ${what(e)}?`, body: `${dayTxt(e.date)}${e.start_time ? " om " + String(e.start_time).slice(0, 5) : ""}. Tik om ja of nee door te geven.`, url: "ouder/#", tag: `ask-${e.id}-${p.id}` }); out.ask++; } } }

  /* c) trainers: een ouder meldde dat een speler niet komt (laatste 2 uur) */
  if (trainerSubs.length) {
    const since = new Date(Date.now() - 2 * 3600e3).toISOString();
    const { data: nee } = await db.from("rsvp").select("event_id,player_id,team_id,note,updated_at").eq("status", "nee").gte("updated_at", since);
    if (nee?.length) {
      const { data: evs } = await db.from("events").select("id,team_id,type,date,opponent,home").in("id", nee.map(r => r.event_id));
      const { data: ps } = await db.from("players").select("id,first_name,last_name").in("id", nee.map(r => r.player_id));
      for (const r of nee) { const e = (evs || []).find(x => x.id === r.event_id), p = (ps || []).find(x => x.id === r.player_id); if (!e || !p || e.date < today) continue;
        const tr = trainersOf(r.team_id), tgt = trainerSubs.filter(s => tr.has(s.user_id) && on(s, "nee")); if (!tgt.length) continue;
        if (!(await once(`nee:${r.event_id}:${r.player_id}:${r.updated_at}`))) continue;
        for (const s of tgt) { await send(s, { title: `${p.first_name} ${p.last_name || ""} komt niet`.trim(), body: `${what(e)[0].toUpperCase() + what(e).slice(1)} van ${dayTxt(e.date)}${r.note ? ": " + r.note : ""}`, url: "#/activiteit/" + e.id, tag: `nee-${e.id}-${p.id}` }); out.nee++; } } } }

  /* d) trainers: aanwezigheden van gisteren of eergisteren nog niet ingevuld (9-21 uur) */
  if (now.hour >= 9 && now.hour < 21 && trainerSubs.length) {
    const { data: tr } = await db.from("events").select("id,team_id,type,date").eq("type", "training").gte("date", addD(today, -2)).lte("date", addD(today, -1)).eq("cancelled", false);
    for (const e of tr || []) { const { count } = await db.from("attendance").select("event_id", { count: "exact", head: true }).eq("event_id", e.id); if (count) continue;
      const ids = trainersOf(e.team_id), tgt = trainerSubs.filter(s => ids.has(s.user_id) && on(s, "att")); if (!tgt.length) continue;
      if (!(await once("att:" + e.id))) continue;
      for (const s of tgt) { await send(s, { title: "Aanwezigheden nog niet ingevuld", body: `Training van ${dayTxt(e.date)} (${T.get(e.team_id) || ""}). Het duurt een halve minuut.`, url: `#/activiteit/${e.id}/aanwezig`, tag: "att-" + e.id }); out.att++; } } }
  return out;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try { await keys(); } catch (e) { return json({ error: String((e as Error).message) }, 500); }
  if (req.method === "GET") return json({ key: KEYS!.public_key }); /* publieke sleutel voor het toestel */
  let body: any = {}; try { body = await req.json(); } catch (_) { /* leeg */ }
  if (body.kind === "tick") { /* enkel de geplande taak (pg_cron) mag de ronde starten */
    const { data: k } = await db.from("push_keys").select("cron_key").eq("id", 1).maybeSingle();
    const got = req.headers.get("x-cron-key") || "";
    if (!k?.cron_key || got.length !== k.cron_key.length || got !== k.cron_key) return json({ error: "Geen toegang." }, 403);
    return json(await tick()); }
  if (body.kind === "test") {
    const auth = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    let q = db.from("push_subs").select("id,endpoint,p256dh,auth,prefs,fails");
    if (body.endpoint) q = q.eq("endpoint", String(body.endpoint)); /* ouders: enkel naar hun eigen toestel */
    else { const { data } = auth ? await db.auth.getUser(auth) : { data: null }; if (!data?.user) return json({ error: "Niet aangemeld." }, 401); q = q.eq("user_id", data.user.id); }
    const { data: subs } = await q.limit(5); let n = 0;
    for (const s of subs || []) if (await send(s as Sub, { title: "Meldingen staan aan", body: "Zo ziet een melding van de club eruit.", url: body.endpoint ? "ouder/#" : "#/meldingen", tag: "test" })) n++;
    return json({ sent: n });
  }
  return json({ error: "Onbekende vraag." }, 400);
});
