// FootballCoachHub — agenda-abonnement (iCal). Eén keer koppelen in Google Agenda, iPhone of Outlook; wijzigingen en afgelastingen komen vanzelf mee.
// ?k=<ouder- of spelerslink-code>  → de activiteiten van dat kind
// ?t=<persoonlijke agendacode van een trainer> → de activiteiten van al zijn ploegen
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/* lange regels plooien (max 75 tekens) zoals iCal vraagt */
const fold = (l: string) => { const out: string[] = []; let s = l; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); };
const day = (d: string, n = 0) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const hm = (t: string | null) => (t || "").slice(0, 5);
const plusH = (t: string, h: number) => { const [a, b] = t.split(":").map(Number), m = Math.min(23 * 60 + 59, a * 60 + b + h * 60); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
const VTZ = ["BEGIN:VTIMEZONE", "TZID:Europe/Brussels", "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD", "END:VTIMEZONE"];

function vevent(e: any, label: string, team: string) {
  const off = e.cancelled || e.rbfa_state === "afgelast", d = e.date.replace(/-/g, "");
  const what = e.type === "wedstrijd" ? (e.opponent ? (e.home === false ? "Uit bij " : "Thuis tegen ") + e.opponent : "Wedstrijd") : e.type === "training" ? "Training" : (e.theme || "Activiteit");
  const s = hm(e.start_time), en = hm(e.end_time) || (s ? plusH(s, e.type === "wedstrijd" ? 2 : 1.25) : "");
  const cv = e.convo && e.convo.meet ? "Verzamelen om " + e.convo.meet + (e.convo.place ? " – " + e.convo.place : "") : "";
  const desc = [team, cv, e.kk_home && e.home !== false ? "Kleedkamer " + e.kk_home : ""].filter(Boolean).join("\n");
  return ["BEGIN:VEVENT", "UID:" + e.id + "@footballcoachhub", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
    s ? "DTSTART;TZID=Europe/Brussels:" + d + "T" + s.replace(":", "") + "00" : "DTSTART;VALUE=DATE:" + d,
    s ? "DTEND;TZID=Europe/Brussels:" + d + "T" + en.replace(":", "") + "00" : "DTEND;VALUE=DATE:" + day(e.date, 1).replace(/-/g, ""),
    "SUMMARY:" + esc((off ? "AFGELAST – " : "") + what + (label ? " – " + label : "")), e.location ? "LOCATION:" + esc(e.location) : "", desc ? "DESCRIPTION:" + esc(desc) : "",
    off ? "STATUS:CANCELLED" : "STATUS:CONFIRMED", "END:VEVENT"].filter(Boolean).map(fold).join("\r\n");
}
const cal = (name: string, evs: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FootballCoachHub//Agenda//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  fold("X-WR-CALNAME:" + esc(name)), "X-WR-TIMEZONE:Europe/Brussels", "REFRESH-INTERVAL;VALUE=DURATION:PT3H", "X-PUBLISHED-TTL:PT3H", ...VTZ, ...evs, "END:VCALENDAR"].join("\r\n") + "\r\n";
const out = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": status === 200 ? "text/calendar; charset=utf-8" : "text/plain; charset=utf-8",
  "Cache-Control": "private, max-age=900", "Access-Control-Allow-Origin": "*", "Content-Disposition": 'inline; filename="agenda.ics"' } });

async function events(teams: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db.from("events").select("id,team_id,type,date,start_time,end_time,location,opponent,home,theme,cancelled,rbfa_state,convo,kk_home")
    .in("team_id", teams).gte("date", day(today, -30)).lte("date", day(today, 240)).order("date").limit(800);
  if (error) throw error; return data || [];
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  const u = new URL(req.url), k = (u.searchParams.get("k") || "").replace(/\.ics$/, ""), t = (u.searchParams.get("t") || "").replace(/\.ics$/, "");
  try {
    if (UUID.test(k)) { /* ouder of speler */
      const { data: p, error: pe } = await db.from("players").select("id,first_name,team_id,active,parent_token,player_token").or(`parent_token.eq.${k},player_token.eq.${k}`).maybeSingle();
      if (pe) throw pe; if (!p || p.active === false) return out("Deze link werkt niet meer.", 404);
      const { data: tm } = await db.from("teams").select("name").eq("id", p.team_id).maybeSingle();
      const kid = p.player_token === k;
      return out(cal(kid ? `Mijn voetbal (${tm?.name || ""})` : `${p.first_name} – ${tm?.name || "voetbal"}`, (await events([p.team_id])).map(e => vevent(e, kid ? "" : p.first_name, tm?.name || ""))));
    }
    if (UUID.test(t)) { /* trainer */
      const { data: c, error: ce } = await db.from("trainer_cal").select("user_id").eq("token", t).maybeSingle(); if (ce) throw ce;
      if (!c) return out("Deze link werkt niet meer.", 404);
      const { data: tt } = await db.from("team_trainers").select("team_id").eq("user_id", c.user_id);
      const ids = [...new Set((tt || []).map(r => r.team_id))]; if (!ids.length) return out(cal("Mijn ploegen", []));
      const { data: tms } = await db.from("teams").select("id,name").in("id", ids); const N = new Map((tms || []).map(x => [x.id, x.name]));
      return out(cal(ids.length === 1 ? N.get(ids[0]) || "Mijn ploeg" : "Mijn ploegen", (await events(ids)).map(e => vevent(e, ids.length > 1 ? N.get(e.team_id) || "" : "", N.get(e.team_id) || ""))));
    }
    return out("Ongeldige link.", 400);
  } catch (e) { console.error(e); return out("Even niet beschikbaar.", 500); }
});
