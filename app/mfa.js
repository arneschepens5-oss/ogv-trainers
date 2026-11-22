/* Tweestapsverificatie met een authenticator-app (TOTP), enkel voor het supportaccount van het platform.
   De database dwingt het ook af: is_super() is pas waar na de code (functie mfa_ok). */
const MFA_ON = () => !!(sb && sb.auth && sb.auth.mfa);
async function mfaFactor() { try { const { data } = await sb.auth.mfa.listFactors(); return (data?.totp || []).find(f => f.status === "verified") || null; } catch (e) { return null; } }
function mfaScreen(html) { document.body.classList.add("authpage"); shell(true); const v = $("#view"); v.innerHTML = `<div class="authbox">${AUTHHEAD()}${html}</div>`; return v; }

/* inloggen: code uit de app vragen */
function mfaChallenge() {
  return new Promise(res => {
    const v = mfaScreen(`<h2 style="margin:0 0 8px">Tweestapsverificatie</h2><p class="muted">Open je authenticator-app en vul de 6-cijferige code in.</p>
      <form id="mfaf" class="authcard"><label class="f">Code<input name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required autofocus></label><div class="err" id="mfae"></div><button class="btn">Bevestigen</button></form>
      <div class="row"><button class="link" type="button" id="mfaout">Afmelden</button></div>`);
    $("#mfaout", v).onclick = () => { res(false); logout(); };
    $("#mfaf", v).onsubmit = async e => { e.preventDefault(); const b = $("button", e.target), err = $("#mfae", v); b.disabled = true; err.textContent = "";
      try { const f = await mfaFactor(); if (!f) { res(true); return; }
        const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: e.target.c.value.trim() });
        if (error) { err.textContent = /invalid|expired/i.test(error.message) ? "Die code klopt niet of is verlopen. Probeer de nieuwste code." : error.message; b.disabled = false; e.target.c.select(); return; }
        res(true);
      } catch (x) { err.textContent = "Controleren lukt niet: controleer je internetverbinding."; b.disabled = false; } };
  });
}

/* instellen: QR-code tonen en de eerste code laten bevestigen. done(true) als het gelukt is, done(false, fout) anders */
async function mfaEnrollUI(root, done) {
  try {
    const { data: l } = await sb.auth.mfa.listFactors();
    for (const f of (l?.all || [])) if (f.factor_type === "totp" && f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator " + new Date().toISOString().slice(0, 10) + "-" + Math.random().toString(36).slice(2, 6) });
    if (error) throw error;
    root.innerHTML = `<ol class="hint" style="padding-left:18px;margin:0 0 12px"><li>Installeer een authenticator-app op je gsm (Google Authenticator of Microsoft Authenticator).</li><li>Scan deze code in de app.</li><li>Vul de 6 cijfers in die de app toont.</li></ol>
      <div style="text-align:center;margin:8px 0"><img alt="QR-code om te scannen" src="${esc(data.totp.qr_code)}" style="width:200px;height:200px;background:#fff;padding:8px;border-radius:12px"></div>
      <p class="hint" style="text-align:center;margin:0 0 12px">Lukt scannen niet? Typ deze sleutel in de app:<br><b style="color:var(--ink);word-break:break-all;user-select:all">${esc(data.totp.secret)}</b></p>
      <form class="mfaenr authcard"><label class="f">Code uit de app<input name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label><div class="err mfaerr"></div><button class="btn">Activeren</button></form>`;
    const f = $(".mfaenr", root); f.onsubmit = async e => { e.preventDefault(); const b = $("button", f), er = $(".mfaerr", root); b.disabled = true; er.textContent = "";
      const { error: ve } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: f.c.value.trim() });
      if (ve) { er.textContent = /invalid|expired/i.test(ve.message) ? "Die code klopt niet. Probeer de nieuwste code uit de app." : ve.message; b.disabled = false; f.c.select(); return; }
      done(true); };
  } catch (e) { done(false, e); }
}

/* beheerders en het supportaccount moeten een tweede stap hebben; andere accounts mogen vrij kiezen */
async function mfaEnforce() {
  if (!MFA_ON() || mode === "demo") return true;
  if (!S.super) return true;
  if (await mfaFactor()) return true;
  return new Promise(res => {
    const v = mfaScreen(`<h2 style="margin:0 0 8px">Beveilig je account</h2><p class="muted">Met dit account kan je de gegevens van alle clubs zien. Daarom vragen we bij het aanmelden voortaan een tweede stap met een code uit een app. Dit duurt twee minuten en je doet het maar één keer.</p><div id="mfaroot"></div><div class="row" style="margin-top:12px"><button class="link" type="button" id="mfaout">Afmelden</button></div>`);
    $("#mfaout", v).onclick = () => { res(false); logout(); };
    const cb = (ok, err) => {
      if (ok) { res(true); return; }
      if (err && /disabled|not enabled/i.test(err.message || "")) { toast("Tweestapsverificatie staat uit in de database. Je kan zonder verder."); res(true); return; }
      $("#mfaroot", v).innerHTML = `<div class="err">${esc(err?.message || "Instellen lukt niet.")}</div><button class="btn" type="button" id="mfaretry" style="margin-top:8px">Opnieuw proberen</button>`;
      $("#mfaretry", v).onclick = () => mfaEnrollUI($("#mfaroot", v), cb);
    };
    mfaEnrollUI($("#mfaroot", v), cb);
  });
}
async function mfaGate() {
  if (!MFA_ON() || mode === "demo") return true;
  try { const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); if (a && a.nextLevel === "aal2" && a.currentLevel !== "aal2") return await mfaChallenge(); } catch (e) { /* offline: de database blijft de poort */ }
  return true;
}

/* in "Mijn account": aanzetten of uitzetten */
async function mfaAccountSection(d) {
  const box = $("#mfasec", d); if (!box) return;
  if (!MFA_ON()) { box.textContent = "Niet beschikbaar."; return; }
  const draw = async () => { const f = await mfaFactor(), must = true;
    box.innerHTML = f ? `<p style="margin:0 0 8px">Staat <b style="color:var(--ok)">aan</b>. Bij het aanmelden vragen we een code uit je authenticator-app.</p>${must ? `<p class="hint" style="margin:0">Voor dit account is dit verplicht.</p>` : `<button class="btn ghost small" type="button" id="mfaoff">Uitzetten</button>`}`
      : `<p style="margin:0 0 8px">Staat <b>uit</b>. Met een code uit een app op je gsm kan niemand je account gebruiken met enkel je wachtwoord.</p><button class="btn ghost small" type="button" id="mfaon">Aanzetten</button><div id="mfaenr" style="margin-top:12px"></div>`;
    const on = $("#mfaon", box); if (on) on.onclick = () => { on.hidden = true; mfaEnrollUI($("#mfaenr", box), (ok, err) => { if (ok) { toast("Tweestapsverificatie staat aan."); draw(); } else { toast(/disabled|not enabled/i.test(err?.message || "") ? "Tweestapsverificatie staat uit in de database." : (err?.message || "Instellen lukt niet.")); on.hidden = false; } }); };
    const off = $("#mfaoff", box); if (off) off.onclick = async () => { if (!confirm("Tweestapsverificatie uitzetten? Je account is dan enkel nog met je wachtwoord beveiligd.")) return;
      const { error } = await sb.auth.mfa.unenroll({ factorId: f.id }); if (error) { toast(error.message); return; } toast("Tweestapsverificatie staat uit."); draw(); }; };
  draw();
}
