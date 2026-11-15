/* Laadt de huisstijl van de app in een onderdeel dat in de app draait, en volgt het licht/donker-thema van de app. */
(function () {
  if (window.self === window.top) return;
  var root = document.documentElement, P;
  try { P = window.parent.document.documentElement; } catch (e) { return; }
  root.classList.add("in-platform");
  var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "../app/embed.css?v=4"; document.head.appendChild(l);
  var sync = function () {
    var t = P.dataset.theme;
    if (!t) { var bg = getComputedStyle(P).getPropertyValue("--bg").trim(); t = /^#(f|e|d)/i.test(bg) ? "light" : "dark"; }
    root.dataset.theme = t;
  };
  sync(); new MutationObserver(sync).observe(P, { attributes: true, attributeFilter: ["data-theme", "class"] });
})();
