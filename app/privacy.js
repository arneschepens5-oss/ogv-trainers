/* FootballCoachHub — privacy voor de beheerder: wie ziet wat, wie heeft welk recht, en gestopte spelers opschonen. */
"use strict";
const PRV_ROWS = [
  ["Naam, geboortedatum, ploeg, positie", "✓", "scoutingfiche", "✓", "eigen kind", "–"],
  ["Contactgegevens ouders", "✓", "–", "✓", "eigen gegevens", "–"],
  ["Aanwezigheid, speeltijd, notities", "✓", "–", "✓", "beperkt", "–"],
  ["Evaluaties", "✓", "–", "✓", "als gedeeld", "–"],
  ["Lengte, gewicht, maturiteit", "✓", "lengte, maturiteit", "✓", "–", "–"],
  ["Interne scouting", "✓", "✓ (uit te zetten)", "✓", "–", "–"],
  ["Foto van de speler", "✓ (met toestemming)", "–", "✓", "–", "–"],
  ["Aanwezigheid trainers", "eigen ploeg", "–", "✓", "–", "✓"],
  ["Diploma's van trainers", "eigen diploma", "lijst, geen bestand", "✓", "–", "–"]];
route("privacybeheer", { title: "Privacy", auth: true, render: async v => {
  if (!S.admin) { v.innerHTML = `<div class="empty"><b>Alleen voor beheerders</b></div>`; return; }
  v.innerHTML = head("Privacy", "Laden…");
  const [P, A, E] = await Promise.all([db.list("players"), db.list("attendance").catch(() => []), db.list("events").catch(() => [])]);
  let members = []; if (mode !== "demo") { try { const r = await sb.rpc("club_admin_info"); members = r.data?.members || []; } catch (e) {} }
  const evDate = Object.fromEntries(E.map(e => [e.id, e.date])), last = {};
  for (const a of A) { const d = evDate[a.event_id]; if (d && (!last[a.player_id] || d > last[a.player_id])) last[a.player_id] = d; }
  const T = Object.fromEntries(S.teams.map(t => [t.id, t])), yearAgo = iso(addDays(new Date(), -365));
  const gone = P.filter(p => p.active === false).map(p => ({ p, last: last[p.id] || null })).sort((a, b) => String(a.last || "").localeCompare(String(b.last || "")));
  const due = gone.filter(x => !x.last || x.last < yearAgo);
  const withPhoto = P.filter(p => p.photo).length, withMeas = new Set((S.pmeas || []).map(m => m.player_id)).size;
  const R = k => members.filter(m => m.role === "admin" || (m.rechten || []).includes(k));
  v.innerHTML = head("Privacy", "Wie ziet wat in de app, wie heeft extra rechten en welke gegevens van gestopte spelers gewist mogen worden.", `<a class="btn ghost" href="privacy.html" target="_blank" rel="noopener">${IC.eye}Privacyverklaring ouders</a>`) +
    `<div class="kpis"><div class="kpi"><small>Spelers in de app</small><b>${P.length}</b><span>${P.length - gone.length} actief</span></div><div class="kpi"><small>Met foto</small><b>${withPhoto}</b><span>met toestemming ouders</span></div>
      <div class="kpi"><small>Gestopte spelers</small><b>${gone.length}</b><span>op niet actief</span></div><div class="kpi"><small>Te wissen</small><b style="color:${due.length ? "var(--warn)" : "inherit"}">${due.length}</b><span>langer dan 1 jaar weg</span></div></div>
    <div class="sec panel"><h2>Wie ziet wat?</h2><div class="tblwrap"><table class="tbl prvt"><thead><tr><th>Gegevens</th><th>Trainers van de ploeg</th><th>Andere trainers</th><th>Coördinator / beheerder</th><th>Ouders en spelers</th><th>Penningmeester</th></tr></thead>
      <tbody>${PRV_ROWS.map(r => `<tr>${r.map((c, i) => i ? `<td class="${c === "–" ? "no" : c === "✓" ? "yes" : ""}">${esc(c)}</td>` : `<td><b>${esc(c)}</b></td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="hint" style="margin-bottom:0">Dit wordt in de database zelf afgedwongen (beveiliging per rij), niet alleen in de app.</p></div>
    ${members.length ? `<div class="sec panel"><h2>Extra rechten</h2><div class="prvr">${[["Beheerder", members.filter(m => m.role === "admin")], ["Alle ploegen", members.filter(m => m.all_teams)], ["Externe scouting", R("scouting")], ["Betalingen", R("betalingen")], ["Geen interne scouting", members.filter(m => (m.rechten || []).includes("intscout_uit") && m.role !== "admin")]].map(([l, xs]) => `<div><b>${l}</b><span>${xs.length ? xs.map(m => esc(m.name || m.email || "")).join(", ") : "niemand"}</span></div>`).join("")}</div>
      <p class="hint" style="margin-bottom:0">Aanpassen in <a class="link" href="#/clubbeheer">Beheer › Leden</a>. Geef extra rechten enkel aan wie ze echt nodig heeft.</p></div>` : ""}
    <div class="sec panel"><h2>Gestopte spelers opschonen</h2><p class="hint" style="margin-top:0">Volgens de privacyverklaring wissen we de gegevens van een speler ten laatste één jaar nadat hij de club verliet. Wissen haalt alles weg: aanwezigheden, evaluaties, scouting, metingen en foto. Dat kan niet ongedaan gemaakt worden.</p>
      ${gone.length ? `<div class="list">${gone.map(({ p, last: l }) => `<label class="item static prvg"><input type="checkbox" data-del="${p.id}"${!l || l < yearAgo ? " checked" : ""}><span class="main"><b>${esc(pname(p))}</b><small>${esc(T[p.team_id]?.name || "")} · ${l ? "laatste activiteit " + dShort(l) + " " + l.slice(0, 4) : "geen activiteit"}</small></span>${!l || l < yearAgo ? `<span class="pill w">te wissen</span>` : ""}</label>`).join("")}</div>
        <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn danger" type="button" id="prvDel">Aangevinkte spelers wissen</button></div>`
        : `<p class="hint" style="margin:0">Geen gestopte spelers. Een speler die de club verlaat, zet je op "Speelt niet meer in deze ploeg" in zijn fiche.</p>`}</div>`;
  const b = $("#prvDel"); if (b) b.onclick = async () => { const ids = $$("[data-del]:checked", v).map(x => x.dataset.del); if (!ids.length) { toast("Vink eerst spelers aan."); return; }
    if (!confirm(`${ids.length} ${ids.length === 1 ? "speler" : "spelers"} en al hun gegevens definitief wissen? Dit kan niet ongedaan gemaakt worden.`)) return;
    await safe(async () => { for (const id of ids) { const p = P.find(x => x.id === id); await db.del("players", { id }); if (p?.photo) photos.remove(p.photo); } render(); }, ids.length + " gewist."); };
} });
