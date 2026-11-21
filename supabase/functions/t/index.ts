// Korte deellink voor trainingen: /functions/v1/t/<token> stuurt door naar de bekijkpagina.
// Alleen een vaste bestemming, het token wordt gecontroleerd: geen open doorverwijzing, geen gegevens.
const DEST = "https://trainers.footballcoachhub.be/bekijk/?t=";
Deno.serve((req) => {
  const u = new URL(req.url);
  const tok = u.pathname.split("/").filter(Boolean).pop() || u.searchParams.get("t") || "";
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(tok)) return new Response("Deze link is niet volledig.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(null, { status: 302, headers: { location: DEST + tok, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
});
