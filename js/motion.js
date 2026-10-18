// Homepage motion: the extra layer of polish on top of the desktop.
// A slowly drifting wallpaper that leans toward the pointer, windows that
// lift and tilt while they are dragged, content that rises into a window
// as it opens, a light that follows the pointer over cards and ripples on
// buttons. Pure enhancement: desktop.js owns the windows, and with
// reduced motion (or no JavaScript) none of this runs.
(function () {
  "use strict";

  var body = document.body;
  if (!body.classList.contains("home") || !body.classList.contains("os")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var narrowMQ = window.matchMedia("(max-width: 760px)");
  var fine = window.matchMedia("(pointer: fine)");

  // ---------------------------------------------------------------------
  // Wallpaper: three soft lights that drift, and lean toward the pointer
  // ---------------------------------------------------------------------

  var aurora = document.createElement("div");
  aurora.className = "aurora";
  aurora.setAttribute("aria-hidden", "true");
  aurora.innerHTML = "<i></i><i></i><i></i>";
  body.insertBefore(aurora, body.firstChild);

  var tx = 0, ty = 0, cx = 0, cy = 0, rafLean = 0;

  function lean() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    aurora.style.setProperty("--px", cx.toFixed(2));
    aurora.style.setProperty("--py", cy.toFixed(2));
    rafLean = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(lean) : 0;
  }

  if (fine.matches) {
    window.addEventListener("pointermove", function (e) {
      if (narrowMQ.matches) return;
      tx = (e.clientX / window.innerWidth - 0.5) * -34;
      ty = (e.clientY / window.innerHeight - 0.5) * -24;
      if (!rafLean) rafLean = requestAnimationFrame(lean);
    }, { passive: true });
  }

  // ---------------------------------------------------------------------
  // Dragging: the window lifts, and tilts a little with its own speed
  // ---------------------------------------------------------------------

  var dragEl = null, lastX = 0, tilt = 0, rafTilt = 0;

  function tiltStep() {
    if (!dragEl) return;
    tilt *= 0.82;
    dragEl.style.rotate = tilt.toFixed(2) + "deg";
    rafTilt = Math.abs(tilt) > 0.02 ? requestAnimationFrame(tiltStep) : 0;
  }

  function endDrag() {
    if (!dragEl) return;
    var el = dragEl;
    dragEl = null;
    el.classList.remove("is-lifted");
    el.style.rotate = "";
  }

  new MutationObserver(function () {
    if (body.classList.contains("dragging")) {
      if (dragEl) return;
      dragEl = document.querySelector(".os .win.is-active");
      if (dragEl) dragEl.classList.add("is-lifted");
    } else {
      endDrag();
    }
  }).observe(body, { attributes: true, attributeFilter: ["class"] });

  window.addEventListener("pointermove", function (e) {
    if (dragEl) {
      var dx = e.clientX - lastX;
      tilt = Math.max(-2.4, Math.min(2.4, tilt + dx * 0.05));
      if (!rafTilt) rafTilt = requestAnimationFrame(tiltStep);
    }
    lastX = e.clientX;
  }, { passive: true });

  // ---------------------------------------------------------------------
  // Opening a window: its content rises into place, one piece after another
  // ---------------------------------------------------------------------

  var RISE = [
    ".welcome > *", ".win-body > *", ".win-copy > *", ".program-grid > *", ".icon-bank > *",
    ".hours-list > *", ".town-list > *", ".toolbar", ".tabs", ".tab-panel > *", ".mail-fields > *",
    ".sysinfo > *", ".checklist > *", ".installer-main > *"
  ].join(",");

  function rise(win) {
    var n = 0;
    win.querySelectorAll(RISE).forEach(function (el) {
      el.style.setProperty("--i", Math.min(n++, 14));
      el.classList.add("rise");
    });
    win.classList.add("is-rising");
    clearTimeout(win._riseT);
    win._riseT = setTimeout(function () {
      win.classList.remove("is-rising");
      win.querySelectorAll(".rise").forEach(function (el) {
        el.classList.remove("rise");
        el.style.removeProperty("--i");
      });
    }, 1100);
  }

  var seen = new WeakSet();

  function watch(win) {
    if (seen.has(win)) return;
    seen.add(win);
    var wasHidden = win.hidden;
    new MutationObserver(function () {
      if (wasHidden && !win.hidden) rise(win);
      wasHidden = win.hidden;
    }).observe(win, { attributes: true, attributeFilter: ["hidden"] });
    if (!win.hidden) rise(win);
  }

  var shelf = document.querySelector(".windows");
  if (shelf) {
    shelf.querySelectorAll(".win").forEach(watch);
    // Pages opened as apps are added later
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && n.classList.contains("win")) watch(n);
        });
      });
    }).observe(shelf, { childList: true });
  }

  // ---------------------------------------------------------------------
  // Pointer light on cards, and ripples on buttons
  // ---------------------------------------------------------------------

  var GLOW = ".program, .icon-item, .tool-btn, .tip, .btn";

  document.addEventListener("pointermove", function (e) {
    var t = e.target.closest ? e.target.closest(GLOW) : null;
    if (!t) return;
    var r = t.getBoundingClientRect();
    t.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
    t.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
  }, { passive: true });

  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest ? e.target.closest(".btn, .tool-btn") : null;
    if (!b || e.button) return;
    var r = b.getBoundingClientRect();
    var size = Math.max(r.width, r.height) * 2;
    var dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.width = dot.style.height = size + "px";
    dot.style.left = e.clientX - r.left - size / 2 + "px";
    dot.style.top = e.clientY - r.top - size / 2 + "px";
    b.appendChild(dot);
    setTimeout(function () { dot.remove(); }, 650);
  });
})();
