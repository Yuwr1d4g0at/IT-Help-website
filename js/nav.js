// Menu bar behaviour (all pages):
// - the logo opens a menu with every page,
// - the bold name next to it shows what's in front,
// - date and time on the right,
// - working red / yellow / green buttons on a sub-page's window,
// - when a page is opened inside a window on the homepage desktop
//   ("embedded"), the menu bar and page chrome are hidden and links back to
//   the homepage open the matching window there instead.
(function () {
  "use strict";

  var root = document.documentElement;
  var isPT = (root.lang || "").toLowerCase().indexOf("pt") === 0;
  var locale = isPT ? "pt-PT" : "en-GB";
  var L = isPT
    ? { desktop: "Ambiente de trabalho", about: "Sobre a Yuwri", min: "Minimizar", max: "Ampliar", close: "Fechar", menu: "Menu Yuwri" }
    : { desktop: "Desktop", about: "About Yuwri", min: "Minimize", max: "Zoom", close: "Close", menu: "Yuwri menu" };

  // Home is "/" or "/pt/" (optionally with index.html)
  function isHomePath(path) {
    return /^\/(pt\/)?(index\.html)?$/.test(path);
  }

  // ---------------------------------------------------------------------
  // Embedded in a desktop window?
  // ---------------------------------------------------------------------
  var embedded = false;
  if (window.self !== window.top) {
    try {
      embedded = window.parent.document.body.classList.contains("os");
    } catch (e) {
      embedded = false;
    }
  }

  if (embedded) {
    root.classList.add("embedded");
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest("a[href]");
      if (!a || a.target === "_blank") return;
      var url = new URL(a.getAttribute("href"), location.href);
      if (url.origin !== location.origin) return;
      if (isHomePath(url.pathname)) {
        e.preventDefault();
        window.parent.postMessage({ type: "yuwri-open", href: url.href }, location.origin);
      }
    });
    return;
  }

  root.classList.add("js");

  var brand = document.querySelector(".site-nav .brand");
  var links = document.getElementById("nav-links");
  var tray = document.querySelector(".nav-actions");
  var homeHref = brand ? brand.getAttribute("href") : "/";

  // ---------------------------------------------------------------------
  // Clock: "Thu 8 Oct  17:20"
  // ---------------------------------------------------------------------
  if (tray) {
    var clock = document.createElement("span");
    clock.className = "tray-clock";
    clock.setAttribute("aria-hidden", "true");
    var day = document.createElement("span");
    day.className = "clock-date";
    var time = document.createElement("span");
    clock.appendChild(day);
    clock.appendChild(time);
    tray.appendChild(clock);

    var tick = function () {
      var now = new Date();
      try {
        day.textContent =
          now.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }).replace(/[.,]/g, "") + " ";
      } catch (e) {
        day.textContent = "";
      }
      time.textContent = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    };
    tick();
    setInterval(tick, 15000);
  }

  // ---------------------------------------------------------------------
  // Bold "app name" next to the logo
  // ---------------------------------------------------------------------
  var h1 = document.querySelector(".page-intro h1");
  if (brand) {
    var app = document.createElement("span");
    app.className = "menu-app";
    app.textContent = h1 ? h1.textContent.trim() : "Yuwri";
    brand.insertAdjacentElement("afterend", app);
  }

  // ---------------------------------------------------------------------
  // Logo menu
  // ---------------------------------------------------------------------
  if (brand && links) {
    var menu = document.createElement("div");
    menu.className = "brand-menu";
    menu.id = "brand-menu";
    menu.setAttribute("role", "menu");

    var add = function (href, text) {
      var a = document.createElement("a");
      a.href = href;
      a.textContent = text;
      a.setAttribute("role", "menuitem");
      menu.appendChild(a);
      return a;
    };

    var aboutLink = links.querySelector('a[href$="#about"], a[href$="#sobre"]');
    if (aboutLink) add(aboutLink.getAttribute("href"), L.about);
    menu.appendChild(document.createElement("hr"));
    links.querySelectorAll("a").forEach(function (a) {
      add(a.getAttribute("href"), a.textContent.trim());
    });
    menu.appendChild(document.createElement("hr"));
    add(homeHref, L.desktop);

    brand.parentNode.appendChild(menu);

    brand.setAttribute("role", "button");
    brand.setAttribute("aria-haspopup", "true");
    brand.setAttribute("aria-expanded", "false");
    brand.setAttribute("aria-controls", "brand-menu");
    brand.setAttribute("aria-label", L.menu);

    var setOpen = function (open) {
      menu.classList.toggle("is-open", open);
      brand.setAttribute("aria-expanded", String(open));
      brand.classList.toggle("is-pressed", open);
    };

    brand.addEventListener("click", function (e) {
      e.preventDefault();
      var open = !menu.classList.contains("is-open");
      setOpen(open);
      if (open) {
        var first = menu.querySelector("a");
        if (first) first.focus();
      }
    });

    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("pointerdown", function (e) {
      if (!menu.classList.contains("is-open")) return;
      if (menu.contains(e.target) || brand.contains(e.target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        setOpen(false);
        brand.focus();
      }
    });
  }

  // ---------------------------------------------------------------------
  // Sub-pages: the page is one window; make its buttons work.
  // Red and yellow take you back to the desktop, green widens the window.
  // ---------------------------------------------------------------------
  if (!h1) return;

  var body = document.body;

  // A sibling of the h1 (not inside it) so the heading's text stays just
  // the page title; CSS places it at the left end of the title bar.
  var controls = document.createElement("span");
  controls.className = "win-controls page-controls";
  [["close", "×", L.close], ["min", "−", L.min], ["max", "+", L.max]].forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "wc-" + c[0];
    b.textContent = c[1];
    b.setAttribute("aria-label", c[2]);
    b.title = c[2];
    controls.appendChild(b);
  });
  h1.classList.add("has-controls");
  h1.insertAdjacentElement("afterend", controls);

  controls.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.classList.contains("wc-max")) body.classList.toggle("page-max");
    else location.href = homeHref;
  });

  h1.addEventListener("dblclick", function () {
    body.classList.toggle("page-max");
  });
})();
