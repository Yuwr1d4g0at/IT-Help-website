// Mobile nav toggle (all pages). Shows/hides the nav-links list under the
// hamburger button below the .nav-links breakpoint in style.css.
(function () {
  "use strict";

  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");

  if (!toggle || !links) return;

  function setOpen(open) {
    links.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", function () {
    setOpen(!links.classList.contains("is-open"));
  });

  // Close after picking a link, so the menu doesn't stay open on the next page.
  links.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      setOpen(false);
    });
  });

  // Close on Escape, and when a resize brings back the desktop layout.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 600) setOpen(false);
  });
})();
