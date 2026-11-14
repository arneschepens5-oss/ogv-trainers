/* FootballCoachHub — interne scouting: alle spelers van de club (waar je toegang toe hebt) op één plek, met zoeken en filteren.
   Je ziet enkel spelers van ploegen waar je trainer of coördinator van bent. */
"use strict";
let IS = { q: "", team: "", pos: "", foot: "", quarter: "", half: "", year: "", mat: "", pot: "", min: "", sort: "naam" };
const isAge = p => p.birthdate ? Math.floor((Date.now() - parse(p.birthdate)) / 3.15576e10) : null;
route("intscouting", { title: "Interne scouting", auth: true, render: async v => {
  v.innerHTML = head("Interne scouting", "Alle spelers van de club in één overzicht. Zoek op naam, positie, kwaliteiten of rijpheid.") + `<p class="muted">Laden…</p>`;
  const mine = new Set(myTeams().map(t => t.id)), T = Object.fromEntries(S.teams.map(t => [t.id, t]));
  const [P, R, M] = await Promise.all([db.list("players"), db.list("player_scout").catch(() => []), db.list("player_measures").catch(() => [])]);
  const all = P.filter(p => mine.has(p.team_id) && p.active !== false).map(p => { const sp = scProf(p), reps = R.filter(r => r.player_id === p.id), ms = M.filter(m => m.player_id === p.id && m.height_cm != null).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const pos = [sp.p1, sp.p2, sp.p3].filter(Boolean), q = p.birthdate ? Math.floor(parse(p.birthdate).getMonth() / 3) + 1 : 0;
    return { p, sp, name: pname(p), team: T[p.team_id], pos, q, half: q ? (q <= 2 ? 1 : 2) : 0, year: p.birthdate ? parse(p.birthdate).getFullYear() : 0, age: isAge(p), avg: scAvg(sp), reps: reps.length, len: ms.length ? ms[ms.length - 1].height_cm : (+sp.len || null),
      hay: [pname(p), p.position, p.notes, sp.sterk, sp.werk, sp.ctx, sp.p1, sp.p2, sp.p3, sp.pot, ...reps.flatMap(r => [r.title, r.notes, r.strengths, r.workpoints])].filter(Boolean).join(" ").toLowerCase() }; });
  const years = [...new Set(all.map(x => x.year).filter(Boolean))].sort((a, b) => b - a), teams = [...new Set(all.map(x => x.p.team_id))].map(id => T[id]).filter(Boolean);
  const opt = (id, lab, list, cur) => `<label class="flt"><span>${lab}</span><select id="${id}">${list.map(([k, l]) => `<option value="${k}"${String(cur) === String(k) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  const draw = () => {
    const words = IS.q.toLowerCase().split(/\s+/).filter(Boolean), res = all.filter(x => (!words.length || words.every(w => x.hay.includes(w))) && (!IS.team || x.p.team_id === IS.team)
      && (!IS.pos || x.pos.includes(IS.pos) || x.p.position === IS.pos) && (!IS.foot || x.p.foot === IS.foot) && (!IS.quarter || x.q === +IS.quarter) && (!IS.half || x.half === +IS.half)
      && (!IS.year || x.year === +IS.year) && (!IS.mat || (IS.mat === "geen" ? !x.p.maturity : x.p.maturity === IS.mat)) && (!IS.pot || x.sp.pot === IS.pot) && (!IS.min || (x.avg != null && x.avg >= +IS.min)));
    const srt = { naam: (a, b) => a.name.localeCompare(b.name, "nl"), ploeg: (a, b) => teamLbl(a.team || {}).localeCompare(teamLbl(b.team || {}), "nl", { numeric: true }) || a.name.localeCompare(b.name, "nl"),
      oud: (a, b) => (a.p.birthdate || "9").localeCompare(b.p.birthdate || "9"), score: (a, b) => (b.avg ?? -1) - (a.avg ?? -1), pot: (a, b) => SC_POT.indexOf(b.sp.pot || "") - SC_POT.indexOf(a.sp.pot || "") }[IS.sort];
    res.sort(srt);
    $("#isn").textContent = `${res.length} van ${all.length} spelers`;
    $("#isl").innerHTML = res.length ? res.map(x => { const m = typeof MAT !== "undefined" ? MAT.find(k => k[0] === x.p.maturity) : null;
      return `<div class="item" data-open="${x.p.id}" data-t="${x.p.team_id}" tabindex="0" role="link">${pAv(x.p)}<span class="main"><b>${esc(x.name)}</b><small>${esc([x.team ? teamLbl(x.team) : "", x.age != null ? x.age + " jaar" : "", x.q ? "Q" + x.q : "", x.pos[0] || String(x.p.position || "").replace(/^\d+\s*·\s*/, ""), x.len ? Math.round(x.len) + " cm" : ""].filter(Boolean).join(" · "))}</small></span>
        <span class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">${x.sp.pot ? `<span class="pill g">Potentieel ${esc(x.sp.pot.toLowerCase())}</span>` : ""}${m ? `<span class="pill" style="border-color:${m[2]}">${m[1]}</span>` : ""}${x.avg != null ? `<span class="pill">${f1(x.avg)} / 10</span>` : ""}${x.reps ? `<span class="pill">${x.reps} ${x.reps === 1 ? "rapport" : "rapporten"}</span>` : ""}</span></div>`; }).join("")
      : `<div class="empty"><b>Geen spelers gevonden</b>Pas je zoekopdracht of filters aan.</div>`;
    $$("[data-open]", $("#isl")).forEach(el => { const go1 = async () => { if (S.team?.id !== el.dataset.t) await loadTeam(el.dataset.t); go("#/dossier/" + el.dataset.open); }; el.onclick = go1; el.onkeydown = e => { if (e.key === "Enter") go1(); }; });
  };
  const filt = () => `<div class="cffilt" style="flex-wrap:wrap">
    ${opt("isteam", "Ploeg", [["", "Alle ploegen"], ...teams.map(t => [t.id, teamLbl(t)])], IS.team)}${opt("ispos", "Positie", [["", "Alle"], ...Object.keys(SC_POS).map(k => [k, k])], IS.pos)}${opt("isfoot", "Voet", [["", "Alle"], ["Rechts", "Rechts"], ["Links", "Links"], ["Beide", "Beide"]], IS.foot)}
    ${opt("isyear", "Geboortejaar", [["", "Alle"], ...years.map(y => [y, y])], IS.year)}${opt("isqt", "Kwartaal", [["", "Alle"], [1, "Q1 · jan–mrt"], [2, "Q2 · apr–jun"], [3, "Q3 · jul–sep"], [4, "Q4 · okt–dec"]], IS.quarter)}${opt("ish", "Jaarhelft", [["", "Alle"], [1, "Jan–jun"], [2, "Jul–dec"]], IS.half)}
    ${opt("ismat", "Rijpheid", [["", "Alle"], ["vroeg", "Vroeg rijp"], ["normaal", "Normaal rijp"], ["laat", "Laat rijp"], ["geen", "Niet ingeschat"]], IS.mat)}${opt("ispot", "Potentieel", [["", "Alle"], ...SC_POT.map(x => [x, x])], IS.pot)}
    ${opt("ismin", "Scoreprofiel", [["", "Alle"], [5, "5 of hoger"], [6, "6 of hoger"], [7, "7 of hoger"], [8, "8 of hoger"]], IS.min)}${opt("issort", "Sorteer op", [["naam", "Naam"], ["ploeg", "Ploeg"], ["oud", "Oudste eerst"], ["score", "Score"], ["pot", "Potentieel"]], IS.sort)}</div>`;
  v.innerHTML = head("Interne scouting", "Alle spelers van de club in één overzicht. Zoek op naam, positie, kwaliteiten of rijpheid.", `<a class="btn ghost" href="#/scouting">Scoutingsdatabase</a>`) +
    `<div class="share" style="margin-bottom:14px">${IC.eye}<div>Je ziet spelers van ploegen waar je trainer of coördinator van bent. De gegevens zijn alleen voor trainers, nooit voor ouders of spelers. Zoeken gebeurt in naam, positie, sterktes, werkpunten, extra info en scoutingrapporten.</div></div>
    <input type="search" id="isq" placeholder="Zoek bv. 'linksachter', 'snel', 'leiderschap'…" value="${esc(IS.q)}" style="width:100%;margin-bottom:10px" aria-label="Zoeken">${filt()}<p class="hint" id="isn" style="margin:10px 0 6px"></p><div class="list" id="isl"></div>`;
  $("#isq").oninput = e => { IS.q = e.target.value; draw(); };
  [["isteam", "team"], ["ispos", "pos"], ["isfoot", "foot"], ["isyear", "year"], ["isqt", "quarter"], ["ish", "half"], ["ismat", "mat"], ["ispot", "pot"], ["ismin", "min"], ["issort", "sort"]].forEach(([id, k]) => { $("#" + id).onchange = e => { IS[k] = e.target.value; draw(); }; });
  draw();
} });
