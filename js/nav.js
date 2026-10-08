// Mobile nav toggle (all pages). Shows/hides the nav-links list under the
// hamburger button below the .nav-links breakpoint in style.css.
// Also puts a little clock in the taskbar's "system tray".
(function () {
  "use strict";

  var tray = document.querySelector(".nav-actions");

  if (tray) {
    var clock = document.createElement("span");
    clock.className = "tray-clock";
    clock.setAttribute("aria-hidden", "true");
    tray.appendChild(clock);

    var tick = function () {
      var now = new Date();
      clock.textContent =
        String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    };
    tick();
    setInterval(tick, 15000);
  }

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
    if (window.innerWidth > 960) setOpen(false);
  });
})();
