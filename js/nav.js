// Taskbar behaviour (all pages):
// - the Yuwri button opens the Start menu (the .nav-links list),
// - a clock in the system tray,
// - a taskbar button for the current page, and working minimize /
//   maximize / close buttons on the page's window,
// - when a page is opened inside a window on the homepage desktop
//   ("embedded"), the taskbar and page chrome are hidden and links back to
//   the homepage open the matching window there instead.
(function () {
  "use strict";

  var root = document.documentElement;
  var isPT = (root.lang || "").toLowerCase().indexOf("pt") === 0;
  var L = isPT
    ? { desktop: "Ambiente de trabalho", min: "Minimizar", max: "Maximizar", close: "Fechar", start: "Iniciar" }
    : { desktop: "Desktop", min: "Minimize", max: "Maximize", close: "Close", start: "Start" };

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

  var nav = document.querySelector(".site-nav");
  var brand = document.querySelector(".site-nav .brand");
  var links = document.getElementById("nav-links");
  var tray = document.querySelector(".nav-actions");
  var homeHref = brand ? brand.getAttribute("href") : "/";

  // ---------------------------------------------------------------------
  // Clock
  // ---------------------------------------------------------------------
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

  // ---------------------------------------------------------------------
  // Task button strip (the homepage desktop fills it with its windows)
  // ---------------------------------------------------------------------
  var tasks = null;
  if (nav && brand) {
    tasks = document.createElement("div");
    tasks.className = "tasks";
    brand.insertAdjacentElement("afterend", tasks);
  }

  // ---------------------------------------------------------------------
  // Start menu
  // ---------------------------------------------------------------------
  if (brand && links) {
    var onHome = document.body.classList.contains("home");

    if (!onHome) {
      var home = document.createElement("a");
      home.href = homeHref;
      home.className = "start-home";
      home.textContent = L.desktop;
      links.insertBefore(home, links.firstChild);
    }

    brand.setAttribute("role", "button");
    brand.setAttribute("aria-haspopup", "true");
    brand.setAttribute("aria-expanded", "false");
    brand.setAttribute("aria-controls", "nav-links");
    brand.setAttribute("title", L.start);

    var setOpen = function (open) {
      links.classList.toggle("is-open", open);
      brand.setAttribute("aria-expanded", String(open));
      brand.classList.toggle("is-pressed", open);
    };

    brand.addEventListener("click", function (e) {
      e.preventDefault();
      setOpen(!links.classList.contains("is-open"));
      if (links.classList.contains("is-open")) {
        var first = links.querySelector("a");
        if (first) first.focus();
      }
    });

    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("pointerdown", function (e) {
      if (!links.classList.contains("is-open")) return;
      if (links.contains(e.target) || brand.contains(e.target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("is-open")) {
        setOpen(false);
        brand.focus();
      }
    });
  }

  // ---------------------------------------------------------------------
  // Sub-pages: the page is one window, so give it a task button and make
  // its title-bar buttons work.
  // ---------------------------------------------------------------------
  var h1 = document.querySelector(".page-intro h1");
  if (!h1 || !tasks) return;

  var body = document.body;
  var pageTitle = h1.textContent.trim();

  var task = document.createElement("button");
  task.type = "button";
  task.className = "task";
  task.setAttribute("aria-pressed", "true");
  var mark = document.createElement("span");
  mark.className = "task-mark";
  mark.setAttribute("aria-hidden", "true");
  var label = document.createElement("span");
  label.textContent = pageTitle;
  task.appendChild(mark);
  task.appendChild(label);
  tasks.appendChild(task);

  var setMin = function (min) {
    body.classList.toggle("page-min", min);
    task.setAttribute("aria-pressed", String(!min));
  };

  task.addEventListener("click", function () {
    setMin(!body.classList.contains("page-min"));
  });

  var controls = document.createElement("span");
  // A sibling of the h1 (not inside it) so the heading's text stays just
  // the page title; CSS places it over the right end of the title bar.
  controls.className = "win-controls page-controls";
  [["min", "_", L.min], ["max", "□", L.max], ["close", "×", L.close]].forEach(function (c) {
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
    if (b.classList.contains("wc-min")) setMin(true);
    if (b.classList.contains("wc-max")) body.classList.toggle("page-max");
    if (b.classList.contains("wc-close")) location.href = homeHref;
  });

  h1.addEventListener("dblclick", function (e) {
    if (!e.target.closest("button")) body.classList.toggle("page-max");
  });
})();
