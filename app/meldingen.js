/* FootballCoachHub — pushmeldingen voor trainers: aanzetten op dit toestel, kiezen waarvoor, en een testmelding.
   Versturen gebeurt door de functie "notify" in Supabase (databaseversie 48). */
"use strict";
/* de publieke sleutel komt van de functie notify zelf */
async function vapidKey() { const r = await fetch(SB_URL + "/functions/v1/notify", { headers: { apikey: SB_KEY } }); const j = await r.json().catch(() => ({}));
  if (!j.key) throw new Error("Meldingen zijn nog niet klaargezet: de beheerder moet supabase-meldingen-v48.sql uitvoeren."); return j.key; }
const PUSH_KINDS = [["cancel", "Afgelastingen", "Een training of wedstrijd van je ploeg wordt afgelast (ook via RBFA)."],
  ["nee", "Speler komt niet", "Een ouder meldt in de ouderapp dat een speler niet komt."],
  ["att", "Aanwezigheden vergeten", "De dag na een training waarvan de aanwezigheden nog niet ingevuld zijn."]];
const pushOk = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const b64u = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
async function pushSub() { if (!pushOk()) return null; const r = await navigator.serviceWorker.getRegistration(); return r ? r.pushManager.getSubscription() : null; }
const pushPrefs = () => { try { return JSON.parse(localStorage.getItem("ogv-push-prefs")) || {}; } catch (e) { return {}; } };
async function pushEnable(prefs) {
  if (!pushOk()) throw new Error("Dit toestel of deze browser ondersteunt geen meldingen.");
  if (isIOS() && !isStandalone()) throw new Error("Op een iPhone werken meldingen enkel als de app op je beginscherm staat: tik op Delen › Zet op beginscherm en open de app van daaruit.");
  const perm = await Notification.requestPermission(); if (perm !== "granted") throw new Error("Je gaf geen toestemming voor meldingen. Dat kan je aanpassen in de instellingen van je browser.");
  const reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(mode === "demo" ? "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" : await vapidKey()) });
  try { localStorage.setItem("ogv-push-prefs", JSON.stringify(prefs)); } catch (e) {}
  if (mode === "demo") return sub;
  const { error } = await sb.rpc("push_save", { sub: sub.toJSON(), pr: prefs });
  if (error) throw new Error(/push_save|function/i.test(error.message) ? "Meldingen zijn nog niet klaargezet: de beheerder moet supabase-meldingen-v48.sql uitvoeren." : error.message);
  return sub;
}
async function pushDisable() { const s = await pushSub(); if (!s) return; if (mode !== "demo") await sb.rpc("push_del", { ep: s.endpoint }).catch(() => {}); await s.unsubscribe().catch(() => {}); }

route("meldingen", { title: "Meldingen", auth: true, render: async v => {
  const sub = await pushSub().catch(() => null), pr = pushPrefs(), perm = pushOk() ? Notification.permission : "none";
  const blocked = perm === "denied", iosHome = isIOS() && !isStandalone();
  v.innerHTML = head("Meldingen", "Krijg een melding op je gsm wanneer er iets is voor je ploeg, ook als de app gesloten is.") +
    `<div class="panel mld"><div class="mld-top"><span class="mld-ic${sub ? " on" : ""}">${IC.bell}</span><div><b>${sub ? "Meldingen staan aan op dit toestel" : "Meldingen staan uit op dit toestel"}</b>
      <small>${!pushOk() ? "Deze browser ondersteunt geen meldingen. Probeer Chrome, Edge of Safari." : blocked ? "Je browser blokkeert meldingen voor deze app. Zet ze aan in de site-instellingen van je browser." : iosHome ? "Op een iPhone: zet de app eerst op je beginscherm (Delen › Zet op beginscherm) en open ze van daaruit." : sub ? "Elk toestel zet je apart aan." : "Je kiest zelf waarvoor je een melding wil."}</small></div>
      ${pushOk() && !blocked ? `<button class="btn${sub ? " ghost" : ""}" type="button" id="mldGo">${sub ? "Uitzetten" : "Aanzetten"}</button>` : ""}</div>
      <div class="mld-kinds">${PUSH_KINDS.map(([k, l, d]) => `<label class="check"><input type="checkbox" data-pk="${k}"${pr[k] === false ? "" : " checked"}> <span><b>${l}</b><br><small class="muted">${d}</small></span></label>`).join("")}</div>
      ${sub ? `<div class="row" style="margin-top:12px"><button class="btn ghost small" type="button" id="mldTest">Testmelding sturen</button><span class="spacer"></span></div>` : ""}</div>
    <p class="hint">Ouders zetten hun eigen meldingen aan in de ouderapp: ze krijgen dan een melding bij een afgelasting en de avond voor een training of wedstrijd als ze nog niet doorgaven of hun kind komt.</p>`;
  const prefs = () => Object.fromEntries($$("[data-pk]", v).map(c => [c.dataset.pk, c.checked]));
  const go = $("#mldGo"); if (go) go.onclick = async () => { go.disabled = true;
    try { if (sub) { await pushDisable(); toast("Meldingen uitgezet op dit toestel."); } else { await pushEnable(prefs()); toast("Meldingen staan aan."); } render(); }
    catch (e) { go.disabled = false; dialog(`<form onsubmit="return false"><h2>Meldingen aanzetten</h2><p>${esc(e.message)}</p><div class="row"><span class="spacer"></span><button class="btn" type="button" data-close>OK</button></div></form>`); } };
  $$("[data-pk]", v).forEach(c => c.onchange = async () => { try { localStorage.setItem("ogv-push-prefs", JSON.stringify(prefs())); } catch (e) {}
    if (sub && mode !== "demo") await safe(async () => { const { error } = await sb.rpc("push_save", { sub: sub.toJSON(), pr: prefs() }); if (error) throw error; }, "Bewaard."); });
  const t = $("#mldTest"); if (t) t.onclick = async () => { if (mode === "demo") { const r = await navigator.serviceWorker.ready; r.showNotification("Meldingen staan aan", { body: "Zo ziet een melding van de club eruit.", icon: "icons/icon-192.png" }); return; }
    const { data, error } = await sb.functions.invoke("notify", { body: { kind: "test" } }); toast(error ? "Versturen lukte niet: " + error.message : data?.sent ? "Testmelding verstuurd." : "Geen toestel gevonden. Zet meldingen opnieuw aan."); };
} });
/* één keer per toestel een uitnodiging op de startpagina */
function pushInvite() {
  if (!pushOk() || Notification.permission !== "default" || !user) return "";
  try { if (localStorage.getItem("ogv-push-invite")) return ""; } catch (e) { return ""; }
  return `<div class="mldinv" id="mldInv">${IC.bell}<div><b>Meldingen bij afgelastingen en afmeldingen?</b><small>Zet ze aan, dan hoef je niet telkens zelf te kijken.</small></div><a class="btn small" href="#/meldingen" data-inv>Aanzetten</a><button class="link" type="button" data-inv aria-label="Niet nu">Niet nu</button></div>`;
}
document.addEventListener("click", e => { if (e.target.closest?.("[data-inv]")) { try { localStorage.setItem("ogv-push-invite", "1"); } catch (x) {} $("#mldInv")?.remove(); } });
