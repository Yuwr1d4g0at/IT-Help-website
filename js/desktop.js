// Homepage desktop: turns the stacked homepage windows into real ones.
// Windows open from the Dock, the logo menu and in-page links, can be
// dragged by the title bar, resized from the corner, minimized into the
// Dock, zoomed and closed. Links to other pages of the site open inside a
// window instead of navigating away.
//
// Without JavaScript (and for search engines) the homepage stays a normal
// scrolling page; everything here is an enhancement on top of it.
(function () {
  "use strict";

  var body = document.body;
  var desk = document.querySelector(".desktop");
  var shelf = document.querySelector(".windows");
  var icons = document.querySelector(".desk-icons");
  if (!body.classList.contains("home") || !desk || !shelf || !icons) return;

  var isPT = (document.documentElement.lang || "").toLowerCase().indexOf("pt") === 0;
  var L = isPT
    ? { min: "Minimizar", max: "Ampliar", close: "Fechar", loading: "A abrir…",
        hello: "Bem-vindo à Yuwri", helloSub: "Abra o que quiser a partir da Dock, lá em baixo." }
    : { min: "Minimize", max: "Zoom", close: "Close", loading: "Opening…",
        hello: "Welcome to Yuwri", helloSub: "Open anything from the Dock at the bottom of the screen." };

  // Same window, the other language's anchor (links from embedded pages
  // in the other language still land on the right window).
  var ALIAS = {
    services: "servicos", servicos: "services", about: "sobre", sobre: "about",
    contact: "contacto", contacto: "contact", area: "zona", zona: "area",
    tools: "ferramentas", ferramentas: "tools", approach: "abordagem", abordagem: "approach",
    testimonials: "testemunhos", testemunhos: "testimonials"
  };

  // Icon for a page opened in a window, by its first path segment
  var PAGE_ICONS = {
    prices: "prices", software: "software", blog: "tips", resources: "tools",
    troubleshoot: "help", "repair-or-replace": "pc", "cheat-sheets": "checklist",
    glossary: "glossary", "heads-up": "warning", tools: "tools", search: "help"
  };

  var narrowMQ = window.matchMedia("(max-width: 760px)");
  var menuApp = document.querySelector(".menu-app");
  var wins = {};
  var order = [];
  var active = null;
  var z = 10;
  var cascade = 0;

  body.classList.add("os");
  body.classList.toggle("narrow", narrowMQ.matches);

  // ---------------------------------------------------------------------
  // The Dock: the desktop icons, plus a tray for minimized windows
  // ---------------------------------------------------------------------
  var dock = document.createElement("nav");
  dock.className = "dock";
  dock.setAttribute("aria-label", "Dock");
  var sep = document.createElement("div");
  sep.className = "dock-sep";
  var tray = document.createElement("div");
  tray.className = "dock-tray";
  dock.appendChild(icons);
  dock.appendChild(sep);
  dock.appendChild(tray);
  body.appendChild(dock);

  function deskSize() {
    return { w: desk.clientWidth, h: desk.clientHeight };
  }

  function isNarrow() {
    return narrowMQ.matches;
  }

  function iconFor(name, size) {
    var src = document.querySelector('[data-icon="' + name + '"]');
    if (!src) return document.createElement("span");
    var ico = src.cloneNode(true);
    ico.style.width = size + "px";
    ico.style.height = size + "px";
    return ico;
  }

  function titleText(w) {
    return w.el.querySelector(".win-title-text").textContent.trim();
  }

  // ---------------------------------------------------------------------
  // Window setup
  // ---------------------------------------------------------------------

  function register(el, id) {
    var w = { id: id, el: el, tile: null, placed: false, app: el.classList.contains("win-app") };
    wins[id] = w;
    el.hidden = true;
    el.tabIndex = -1;

    var ctr = el.querySelector(".win-controls");
    ctr.removeAttribute("aria-hidden");
    ctr.innerHTML = "";
    [["close", "×", L.close], ["min", "−", L.min], ["max", "+", L.max]].forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "wc-" + c[0];
      b.textContent = c[1];
      b.title = c[2];
      b.setAttribute("aria-label", c[2]);
      ctr.appendChild(b);
    });

    ctr.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.classList.contains("wc-min")) minimize(w);
      else if (b.classList.contains("wc-max")) toggleMax(w);
      else close(w);
    });

    el.addEventListener("pointerdown", function () {
      focus(w);
    }, true);

    el.addEventListener("focusin", function () {
      if (active !== w) focus(w);
    });

    var bar = el.querySelector(".win-title");
    bar.addEventListener("pointerdown", function (e) {
      startDrag(w, bar, e);
    });
    bar.addEventListener("dblclick", function (e) {
      if (!e.target.closest("button") && !isNarrow()) toggleMax(w);
    });

    return w;
  }

  function place(w) {
    var d = deskSize();
    var el = w.el;
    var width = Math.min(+el.getAttribute("data-w") || 600, d.w - 16);
    var x, y;

    if (w.id === "welcome") {
      x = (d.w - width) / 2;
      y = Math.max(14, Math.round(d.h * 0.08));
    } else {
      var step = cascade++ % 7;
      x = Math.max(16, d.w * 0.12) + step * 30;
      y = 18 + step * 26;
    }
    if (x + width > d.w - 8) x = Math.max(8, d.w - width - 8);

    el.style.width = width + "px";
    el.style.left = Math.round(x) + "px";
    el.style.top = y + "px";
    if (w.app) el.style.height = Math.max(260, d.h - y - 12) + "px";
    w.placed = true;
  }

  // ---------------------------------------------------------------------
  // Window state
  // ---------------------------------------------------------------------

  function focus(w) {
    if (active && active !== w) active.el.classList.remove("is-active");
    active = w;
    w.el.classList.add("is-active");
    w.el.style.zIndex = ++z;
    order = order.filter(function (o) { return o !== w; });
    order.push(w);
    if (menuApp) menuApp.textContent = titleText(w);
  }

  // Hand focus to the top-most window still showing
  function focusNext() {
    active = null;
    for (var i = order.length - 1; i >= 0; i--) {
      if (!order[i].el.hidden) {
        focus(order[i]);
        return;
      }
    }
    if (menuApp) menuApp.textContent = "Yuwri";
  }

  function open(w) {
    var wasHidden = w.el.hidden;
    if (!w.placed) place(w);
    removeTile(w);
    w.el.hidden = false;
    if (wasHidden) {
      w.el.classList.remove("is-opening");
      void w.el.offsetWidth;
      w.el.classList.add("is-opening");
    }
    focus(w);
    w.el.focus({ preventScroll: true });
    updateDock();
    if (!w.app && w.id !== "welcome" && history.replaceState) {
      history.replaceState(null, "", "#" + w.id);
    }
  }

  function minimize(w) {
    w.el.hidden = true;
    w.el.classList.remove("is-active");
    addTile(w);
    focusNext();
    updateDock();
  }

  function close(w) {
    w.el.hidden = true;
    w.el.classList.remove("is-active");
    removeTile(w);
    order = order.filter(function (o) { return o !== w; });
    if (w.app) {
      w.el.remove();
      delete wins[w.id];
    }
    if (location.hash === "#" + w.id && history.replaceState) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    focusNext();
    updateDock();
  }

  function toggleMax(w) {
    w.el.classList.toggle("is-max");
  }

  // Minimized windows sit at the right end of the Dock
  function addTile(w) {
    if (w.tile) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dock-min";
    b.title = titleText(w);
    b.setAttribute("aria-label", titleText(w));
    var icon = w.el.querySelector(".win-title .ico");
    b.appendChild(iconFor(icon ? icon.getAttribute("data-icon") : "logo", 36));
    b.addEventListener("click", function () {
      open(w);
    });
    tray.appendChild(b);
    w.tile = b;
    dock.classList.add("has-min");
  }

  function removeTile(w) {
    if (w.tile) {
      w.tile.remove();
      w.tile = null;
    }
    dock.classList.toggle("has-min", tray.children.length > 0);
  }

  // Dot under each Dock icon whose window is open (or minimized)
  function updateDock() {
    icons.querySelectorAll(".desk-icon").forEach(function (a) {
      var url = new URL(a.getAttribute("href"), location.href);
      var w = sameDoc(url) ? windowFor(url.hash) : wins["page:" + url.pathname];
      var running = !!w && (!w.el.hidden || !!w.tile);
      a.classList.toggle("is-running", running);
    });
  }

  // ---------------------------------------------------------------------
  // Dragging (title bar)
  // ---------------------------------------------------------------------

  function startDrag(w, bar, e) {
    if (e.button !== 0 || e.target.closest("button") || isNarrow() || w.el.classList.contains("is-max")) return;
    e.preventDefault();
    var el = w.el;
    var startX = e.clientX;
    var startY = e.clientY;
    var left = el.offsetLeft;
    var top = el.offsetTop;
    var d = deskSize();
    var width = el.offsetWidth;

    bar.setPointerCapture(e.pointerId);
    body.classList.add("dragging");

    function move(ev) {
      var x = left + ev.clientX - startX;
      var y = top + ev.clientY - startY;
      x = Math.min(Math.max(x, 80 - width), d.w - 80);
      y = Math.min(Math.max(y, 0), d.h - 40);
      el.style.left = x + "px";
      el.style.top = y + "px";
    }

    function up() {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
      body.classList.remove("dragging");
    }

    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  }

  // Resizing uses the browser's own resize grip (CSS `resize: both`);
  // stop iframes from swallowing the pointer while it's held.
  desk.addEventListener("pointerdown", function (e) {
    var win = e.target.closest(".win");
    if (!win || e.target !== win) return;
    body.classList.add("dragging");
    document.addEventListener("pointerup", function done() {
      body.classList.remove("dragging");
      document.removeEventListener("pointerup", done);
    });
  });

  // ---------------------------------------------------------------------
  // Pages of the site, opened in a window
  // ---------------------------------------------------------------------

  function pageIcon(url) {
    var seg = url.pathname.replace(/^\/(pt\/)?/, "").split("/")[0];
    return PAGE_ICONS[seg] || "globe";
  }

  function openPage(url, label) {
    var key = "page:" + url.pathname;
    var w = wins[key];
    if (w) {
      var frame = w.el.querySelector("iframe");
      if (url.hash && frame) frame.src = url.href;
      open(w);
      return;
    }

    var el = document.createElement("section");
    el.className = "win win-app";
    el.setAttribute("data-w", "980");

    var bar = document.createElement("div");
    bar.className = "win-title";
    bar.appendChild(iconFor(pageIcon(url), 16));
    var t = document.createElement("span");
    t.className = "win-title-text";
    t.textContent = label || L.loading;
    bar.appendChild(t);
    var ctr = document.createElement("div");
    ctr.className = "win-controls";
    bar.appendChild(ctr);

    var content = document.createElement("div");
    content.className = "win-content";
    var frame2 = document.createElement("iframe");
    frame2.src = url.href;
    frame2.title = label || "";
    content.appendChild(frame2);

    el.appendChild(bar);
    el.appendChild(content);
    shelf.appendChild(el);

    w = register(el, key);

    frame2.addEventListener("load", function () {
      var name = "";
      try {
        name = frame2.contentDocument.title || "";
      } catch (err) {
        name = "";
      }
      name = name.replace(/\s*\|\s*Yuwri\s*$/, "").replace(/^Yuwri\s*\|\s*/, "").trim();
      if (!name) return;
      t.textContent = name;
      frame2.title = name;
      if (active === w && menuApp) menuApp.textContent = name;
      if (w.tile) {
        w.tile.title = name;
        w.tile.setAttribute("aria-label", name);
      }
    });

    open(w);
  }

  // ---------------------------------------------------------------------
  // Opening things: links, Dock, menus, messages from embedded pages
  // ---------------------------------------------------------------------

  function sameDoc(url) {
    var here = location.pathname.replace(/index\.html$/, "");
    return url.pathname.replace(/index\.html$/, "") === here;
  }

  function windowFor(hash) {
    var id = decodeURIComponent((hash || "").replace(/^#/, ""));
    return wins[id] || wins[ALIAS[id]] || null;
  }

  function isSitePage(url) {
    return url.origin === location.origin && /(\/|\.html)$/.test(url.pathname) && !/404\.html$/.test(url.pathname);
  }

  function route(url, label) {
    if (sameDoc(url) || /^\/(pt\/)?(index\.html)?$/.test(url.pathname)) {
      var w = windowFor(url.hash) || wins.welcome;
      open(w);
      return true;
    }
    if (isSitePage(url)) {
      openPage(url, label);
      return true;
    }
    return false;
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    if (a.classList.contains("lang-switch") || a.classList.contains("brand")) return;
    var url = new URL(a.getAttribute("href"), location.href);
    if (url.origin !== location.origin) return;

    var label = a.textContent.trim().replace(/\s+/g, " ");
    if (route(url, label)) e.preventDefault();
  });

  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "yuwri-open") return;
    route(new URL(e.data.href, location.href));
  });

  // ---------------------------------------------------------------------
  // Welcome notification on the first visit
  // ---------------------------------------------------------------------

  function notify() {
    var seen = false;
    try {
      seen = sessionStorage.getItem("yuwri-hello") === "1";
      sessionStorage.setItem("yuwri-hello", "1");
    } catch (err) {
      seen = false;
    }
    if (seen) return;

    var n = document.createElement("div");
    n.className = "notice";
    n.setAttribute("role", "status");
    n.appendChild(iconFor("logo", 38));
    var txt = document.createElement("div");
    var strong = document.createElement("strong");
    strong.textContent = L.hello;
    txt.appendChild(strong);
    txt.appendChild(document.createTextNode(L.helloSub));
    n.appendChild(txt);
    body.appendChild(n);

    var dismiss = function () {
      n.remove();
      document.removeEventListener("pointerdown", dismiss);
    };
    document.addEventListener("pointerdown", dismiss);
    setTimeout(dismiss, 8000);
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------

  shelf.querySelectorAll(".win").forEach(function (el) {
    register(el, el.id);
  });

  open(wins.welcome);
  var start = windowFor(location.hash);
  if (start && start !== wins.welcome) open(start);
  notify();

  if (narrowMQ.addEventListener) {
    narrowMQ.addEventListener("change", function () {
      body.classList.toggle("narrow", isNarrow());
    });
  }

  // Keep title bars reachable when the browser window shrinks
  window.addEventListener("resize", function () {
    var d = deskSize();
    Object.keys(wins).forEach(function (k) {
      var el = wins[k].el;
      if (el.offsetLeft > d.w - 80) el.style.left = Math.max(0, d.w - el.offsetWidth) + "px";
      if (el.offsetTop > d.h - 40) el.style.top = Math.max(0, d.h - 80) + "px";
    });
  });
})();
