/* OGV Platform — trainingen en oefeningen delen, afdrukken en als filmpje bewaren.
   Afdrukken: volledige fiche (met uitleg) of veldkaart (compact, om mee te nemen op het veld).
   Een oefening met stappen wordt op papier een reeks kleine tekeningen: Stap 1, Stap 2…
   Delen: een link die iedereen kan openen zonder account (alleen lezen, met afspeelbare filmpjes). */
"use strict";

const dlSteps = x => { if (!x.diagram) return exPic(x, ""); const F = dgFrames(x.diagram);
  if (F.length < 2) return diagramSVG(x.diagram);
  return `<div class="pfsteps">${F.map((o, i) => `<figure>${diagramSVG(x.diagram, { objs: o })}<figcaption>Stap ${i + 1}</figcaption></figure>`).join("")}</div>`; };
const dlLines = s => String(s || "").split(/\n+/).map(t => t.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

/* verloop van de training met tijden, drinkpauzes inbegrepen */
const dlFlow = pl => { let t = 0, n = 0; return (pl.items || []).map(x => { const m = exMinutes(x), a = t; t += m;
  return x.pause ? `☕ ${x.name || "Drinkpauze"} (${m} min)` : `${++n}. ${x.name || "Oefening"}${m ? ` (${a}′–${t}′)` : ""}`; }); };
function ficheHtml(pl, meta, layout = "vol") {
  const list = pl.items || [], nr = x => list.filter(z => !z.pause).indexOf(x) + 1;
  const flow = list.length > 1 && list.some(x => x.pause) ? `<p class="pflow"><b>Verloop:</b> ${dlFlow(pl).map(esc).join(" → ")}</p>` : "";
  const headH = `<header><div><h1>${esc(meta.title || pl.theme || "Training")}</h1><p>${esc(meta.sub || "")}</p></div><img src="icons/logo.png" alt=""></header>`;
  if (layout === "kaart") {
    let t = 0, pause = "";
    return `<div class="pfiche kaart">${headH}${flow}${pl.goal ? `<p class="pgoal"><b>Doel:</b> ${esc(pl.goal)}</p>` : ""}
      <div class="pk-grid">${list.map((x, k) => { const m = exMinutes(x), from = t; t += m;
        if (x.pause) { pause = `<div class="pk-pause">☕ Eerst ${esc((x.name || "drinkpauze").toLowerCase())}, ${m} min</div>`; return ""; }
        const pb = pause; pause = ""; const pts = dlLines(x.criteria).slice(0, 4);
        return `<section class="pk">${pb}<div class="pk-h"><span class="pk-no">${nr(x)}</span><b>${esc(x.name || "Oefening")}</b><span>${from}′–${t}′</span></div>
          <div class="pk-pic">${x.diagram ? diagramSVG(x.diagram, { objs: dgFrames(x.diagram)[0] }) : exPic(x, "")}</div>
          <p class="pk-meta">${esc([exType(x), x.players ? x.players + " sp." : "", x.size, x.reps ? `${x.reps} × ${x.work || "?"}` : ""].filter(Boolean).join(" · "))}</p>
          ${pts.length ? `<ul>${pts.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</section>`; }).join("")}${pause}</div>
      <footer>${esc(APPNAME())} · ${esc(clubName())} · ${planMinutes(pl)} min</footer></div>`;
  }
  return `<div class="pfiche">${headH}
    <dl class="pmeta"><div><dt>Thema</dt><dd>${esc(pl.theme || "–")}</dd></div><div><dt>Aantal spelers</dt><dd>${esc(pl.players || "–")}</dd></div><div><dt>Materiaal</dt><dd>${esc(pl.material || "–")}</dd></div><div><dt>Intensiteit</dt><dd>${pl.intensity ? pl.intensity + " – " + INTENS[pl.intensity] : "–"}</dd></div><div><dt>Totale duur</dt><dd>${planMinutes(pl)} min</dd></div></dl>
    ${pl.goal ? `<p class="pgoal"><b>Doel:</b> ${esc(pl.goal)}</p>` : ""}${flow}
    ${list.map((x, k) => x.pause ? `<div class="pk-pause">☕ ${esc(x.name || "Drinkpauze")} · ${exMinutes(x)} min</div>` : `<section class="pex${x.diagram && dgFrames(x.diagram).length > 1 ? " steps" : ""}"><div class="ptxt"><h2>${nr(x)}. ${x.phase ? esc(exType(x)) + ": " : ""}${esc(x.name || "Oefening")}</h2>
      <p>${[["Duur", exMinutes(x) ? exMinutes(x) + " min" : ""], ["Spelers", x.players], ["Afmetingen", x.size], ["Intensiteit", x.intensity ? x.intensity + " – " + INTENS[x.intensity] : ""], ["Inspanning", x.reps ? `${x.reps} × ${x.work || "?"}${x.rest ? ", " + x.rest + " s rust" : ""}` : ""]].filter(([, v]) => v).map(([k2, v]) => `<b>${k2}:</b> ${esc(v)}`).join(" · ")}</p>
      ${x.goal ? `<p><b>Doel:</b> ${esc(x.goal)}</p>` : ""}
      ${x.org ? `<h3>Organisatie en verloop</h3><p>${esc(x.org).replace(/\n/g, "<br>")}</p>` : ""}${x.criteria ? `<h3>Aandachtspunten</h3><ul>${dlLines(x.criteria).map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
      ${x.material ? `<h3>Materiaal</h3><p>${esc(x.material)}</p>` : ""}</div>
      <div class="pimg">${dlSteps(x)}</div></section>`).join("")}
    <footer>${esc(APPNAME())} · ${esc(clubName())}</footer></div>`;
}
async function printFiche(pl, meta, layout = "vol") {
  const el = document.createElement("div"); el.className = "print-only"; el.innerHTML = ficheHtml(normPlan(pl), meta, layout);
  document.body.appendChild(el); document.documentElement.classList.add("printing");
  await hydrateImgs(el).catch(() => {});
  const imgs = [...el.querySelectorAll("img")]; imgs.forEach(i => { i.loading = "eager"; });
  await Promise.race([Promise.all(imgs.map(i => i.complete && i.src ? 0 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 4000))]);
  const done = () => { el.remove(); document.documentElement.classList.remove("printing"); removeEventListener("afterprint", done); };
  addEventListener("afterprint", done); setTimeout(() => print(), 150);
}

/* ---------- deelbare link ---------- */
const dlToken = () => { const b = crypto.getRandomValues(new Uint8Array(16)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
/* korte link via de databank: zonder de naam van de website (en dus zonder je GitHub-naam) in het bericht */
const dlUrl = t => SB_URL + "/functions/v1/t/" + t;
async function dlInlineImg(x) { /* foto's uit de privé-opslag meesturen als kleine jpg, anders ziet de ontvanger ze niet */
  if (!x.img_path || x.img) return; try { const u = await files.url(x.img_path); const bl = await (await fetch(u)).blob();
    const im = await createImageBitmap(bl), k = Math.min(1, 1100 / Math.max(im.width, im.height)), c = document.createElement("canvas");
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    x.img = c.toDataURL("image/jpeg", .82); delete x.img_path; } catch (e) { delete x.img_path; } }
async function dlMakeLink(o) {
  const pl = JSON.parse(JSON.stringify(normPlan(o.pl))); const noMail = v => (v && !/@/.test(v) ? v : "");
  for (const x of pl.items) { delete x.shared_by; x.author = noMail(x.author); if (!x.author) delete x.author; await dlInlineImg(x); x._type = x.pause ? "" : exType(x); x._min = exMinutes(x); }
  const payload = { pl, sub: o.sub || "", team: S.team?.name || "", by: noMail(user?.user_metadata?.name) || noMail(user?.user_metadata?.full_name) };
  const { data: old } = await sb.from("shared_items").select("token").eq("item_id", String(o.id)).eq("created_by", user.id).maybeSingle();
  const token = old?.token || dlToken();
  const { error } = await sb.from("shared_items").upsert({ token, item_id: String(o.id), kind: o.kind, title: o.title || "", payload, club_name: clubName(), updated_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) throw new Error(/relation|does not exist|schema/i.test(error.message) ? "Voer eerst het databasescript supabase-delen-v60.sql uit." : error.message);
  return dlUrl(token);
}
const dlWaText = (o, url) => { const pl = normPlan(o.pl);
  return `*${o.kind === "oefening" ? "Oefening" : "Training"}: ${o.title || pl.theme || ""}*${o.sub ? "\n" + o.sub : ""}\n` +
    (o.kind === "training" ? dlFlow(pl).join("\n") + `\nTotaal ${planMinutes(pl)} min\n` : "") +
    `\nTekeningen, uitleg en filmpjes: ${url}`; };

/* ---------- het deelvenster ---------- */
function shareDlg(o) {
  const pl = normPlan(o.pl), anim = pl.items.filter(x => x.diagram && dgFrames(x.diagram).length > 1), one = o.kind === "oefening", x0 = pl.items[0];
  const canLink = mode !== "demo" && !!user && !!o.id;
  const d = dialog(`<div class="dlg shdlg"><div class="row"><h2 style="margin-right:auto">${one ? "Oefening" : "Training"} delen</h2><button class="xbtn" style="position:static" type="button" data-close aria-label="Sluiten">${IC.x}</button></div>
    <p class="muted" style="margin:0"><b>${esc(o.title || pl.theme || "")}</b>${o.sub ? " · " + esc(o.sub) : ""}</p>
    <section class="shsec"><h3>Doorsturen met een link</h3><p class="hint">Iedereen met de link ziet de tekeningen, de uitleg en de filmpjes. Een account is niet nodig. Pas je later iets aan, deel dan opnieuw: de link toont dan de nieuwste versie.</p>
      ${canLink ? `<div id="shL"><button class="btn" type="button" id="shMk">${IC.copy}Link maken</button></div>` : `<p class="hint">Meld je aan en bewaar eerst om een link te maken.</p>`}</section>
    <section class="shsec"><h3>Afdrukken of als PDF bewaren</h3><div class="shopts">
      <button type="button" class="shopt" data-pr="vol"><b>Volledige fiche</b><small>Tekening, organisatie, aandachtspunten. Oefeningen met stappen worden een reeks kleine tekeningen.</small></button>
      ${one ? "" : `<button type="button" class="shopt" data-pr="kaart"><b>Veldkaart</b><small>Alles compact op één blad, om mee te nemen op het veld.</small></button>`}</div>
      <p class="hint">Kies bij het afdrukken "Bewaren als PDF" om een PDF te maken.</p></section>
    ${anim.length || (one && x0?.diagram) ? `<section class="shsec"><h3>${anim.length ? "Filmpje" + (anim.length > 1 ? "s" : "") : "Afbeelding"}</h3><div class="shvid">
      ${anim.map(x => `<button class="btn ghost small" type="button" data-vid="${x.id}">▶ ${esc(x.name || "Oefening")}</button>`).join("")}
      ${one && x0?.diagram ? `<button class="btn ghost small" type="button" id="shPng">${IC.dl}Tekening als afbeelding</button>` : ""}</div>
      ${anim.length ? `<p class="hint">Met titel en "Stap 1 van 4" in beeld. Op gsm kan je het meteen in WhatsApp zetten. Laat het scherm open tot het klaar is.</p>` : ""}</section>` : ""}
  </div>`);
  $$("[data-pr]", d).forEach(b => b.onclick = () => { d.close(); printFiche(pl, { title: o.title || pl.theme, sub: o.sub }, b.dataset.pr); });
  $$("[data-vid]", d).forEach(b => b.onclick = () => { const x = pl.items.find(z => z.id === b.dataset.vid); dgVideo(x.diagram, x.name || "Oefening"); });
  const pn = $("#shPng", d); if (pn) pn.onclick = () => dgPng(x0.diagram, x0.name || "oefening");
  const mk = $("#shMk", d); if (mk) mk.onclick = async () => { mk.disabled = true; mk.textContent = "Link maken…";
    const url = await safe(() => dlMakeLink(o)); if (!url) { mk.disabled = false; mk.textContent = "Opnieuw proberen"; return; }
    const txt = dlWaText(o, url);
    $("#shL", d).innerHTML = `<div class="shlink"><input readonly value="${esc(url)}" aria-label="Link" onclick="this.select()"><button class="btn ghost small" type="button" id="shCp">${IC.copy}Kopiëren</button></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><a class="btn" style="background:#25D366;border-color:#25D366;color:#fff" target="_blank" rel="noopener" href="https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}">WhatsApp</a>
      ${navigator.share ? `<button class="btn ghost" type="button" id="shNat">Delen via…</button>` : ""}<a class="btn ghost" target="_blank" rel="noopener" href="${esc(url)}">Bekijken</a></div>`;
    $("#shCp", d).onclick = () => { navigator.clipboard?.writeText(url).then(() => toast("Link gekopieerd."), () => toast("Kopiëren lukte niet. Selecteer de link en kopieer ze zelf.")); };
    const nt = $("#shNat", d); if (nt) nt.onclick = () => navigator.share({ title: o.title || "Training", text: txt.replace(url, "").trim(), url }).catch(() => {}); };
}
