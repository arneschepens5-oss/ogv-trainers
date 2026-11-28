// Huisstijl van een club voor de apps: manifest (naam + icoon op het beginscherm), icoon en korte info.
// GET ?club=<id> of ?tok=<ouder-/spelerslink>  &app=scout|test|ouder|trainers  (manifest)
//     &icon=1 (logo als afbeelding)   &info=1 (naam, kleur, logo)
import { createClient } from "npm:@supabase/supabase-js@2";
const SITE = "https://trainers.footballcoachhub.be";
const OGV = "00000000-0000-4000-8000-000000000001";
const H = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
const isId = (s: string | null) => !!s && /^[0-9a-f-]{36}$/i.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  const u = new URL(req.url), self = "https://intswyovpwiigdwmgjfz.supabase.co/functions/v1/brand";
  const club = u.searchParams.get("club"), tok = u.searchParams.get("tok"), app = u.searchParams.get("app") || "";
  if (!isId(club) && !isId(tok)) return new Response("onbekende club", { status: 404, headers: H });
  const { data: c } = await db.rpc("club_brand", isId(club) ? { c: club } : { tok });
  if (!c) return new Response("onbekende club", { status: 404, headers: H });
  const ogv = c.id === OGV, name = c.name, short = c.short || name, st = { color: c.color, color2: c.color2 };
  const logo: string = c.logo || "";

  if (u.searchParams.get("icon")) {
    if (ogv || !logo.startsWith("data:")) return Response.redirect(SITE + (ogv ? "/icons/ogv-512.png" : "/icons/icon-512.png"), 302);
    const [head, b64] = logo.split(","), type = head.slice(5).split(";")[0] || "image/png";
    return new Response(Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), { headers: { ...H, "Content-Type": type } });
  }
  if (u.searchParams.get("info")) return Response.json({ id: c.id, name, short, color: st.color || null, logo: ogv ? SITE + "/icons/ogv-192.png" : logo || null }, { headers: H });

  // grootte van het logo (PNG) voor het manifest
  let sizes = "512x512";
  if (!ogv && logo.startsWith("data:image/png")) { const b = atob(logo.split(",")[1].slice(0, 40)); const n = (i: number) => (b.charCodeAt(i) << 24 | b.charCodeAt(i + 1) << 16 | b.charCodeAt(i + 2) << 8 | b.charCodeAt(i + 3)) >>> 0; sizes = `${n(16)}x${n(20)}`; }
  else if (!ogv && logo) sizes = "any";
  const icon = `${self}?club=${c.id}&icon=1`, col = st.color2 || "#0E0F0C";
  const M: Record<string, unknown> = {
    scout: { name: `Scouting · ${short}`, short_name: "Scouting", start_url: `${SITE}/scout/?c=${c.id}`, scope: `${SITE}/scout/`, id: `${SITE}/scout/?c=${c.id}` },
    test: { name: `Fysieke testen · ${short}`, short_name: "Testen", start_url: `${SITE}/test/?c=${c.id}`, scope: `${SITE}/test/`, id: `${SITE}/test/?c=${c.id}` },
    ouder: { name: `${short} · ouders en spelers`, short_name: ogv ? "OGV Ouders" : short, scope: `${SITE}/ouder/` },
    trainers: { name: ogv ? "OGV Trainers" : `${short} Trainers`, short_name: ogv ? "OGV Trainers" : short, start_url: `${SITE}/`, scope: `${SITE}/`, id: `${SITE}/?club=${c.id}` },
  };
  const m = { ...(M[app] || M.trainers) as object, lang: "nl", display: "standalone", background_color: col, theme_color: col,
    icons: [{ src: icon, sizes, type: logo.startsWith("data:image/png") || ogv || !logo ? "image/png" : undefined, purpose: "any" }] };
  return new Response(JSON.stringify(m), { headers: { ...H, "Content-Type": "application/manifest+json" } });
});
