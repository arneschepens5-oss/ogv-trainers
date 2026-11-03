/* OGV Trainers — toegangscontrole voor de losse pagina's (animatiebord, wedstrijdblad).
   Alleen wie aangemeld is én lid van de club (met de clubcode) mag ze gebruiken; anders naar het aanmeldscherm. */
(function () {
  var host = location.hostname; if (/^(localhost|127\.|\[::1\])/.test(host)) return;
  var root = document.documentElement, app = new URL("../", location.href).href + "#/aanmelden";
  var out = function () { try { (window.top || window).location.replace(app); } catch (e) { location.replace(app); } };
  var s = null; try { s = JSON.parse(localStorage.getItem("tb_auth") || "null"); } catch (e) {}
  if (!s || !s.access_token) { root.style.visibility = "hidden"; out(); return; }
  root.style.visibility = "hidden";
  var show = function () { root.style.visibility = ""; };
  fetch("https://intswyovpwiigdwmgjfz.supabase.co/rest/v1/rpc/club_status", { method: "POST", headers: { apikey: "sb_publishable_mGTwxXL1HjKgnJcgSATtxQ_6CvHJ-3W", Authorization: "Bearer " + s.access_token, "Content-Type": "application/json" }, body: "{}" })
    .then(function (r) { if (r.status === 401) { show(); return null; } return r.json(); })
    .then(function (j) { if (j === null) return; if (j && j.member === true) show(); else out(); })
    .catch(show); /* zonder internet (op het veld) blijft de pagina bruikbaar */
})();
