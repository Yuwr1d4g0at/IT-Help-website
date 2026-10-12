// Homepage desktop: turns the stacked homepage windows into real ones.
// Windows open from the Dock, the logo menu, Spotlight and in-page links,
// can be dragged by the title bar, resized from the corner, minimized into
// the Dock, zoomed and closed, and remember where they were left. Links to
// other pages of the site open inside a window instead of navigating away.
//
// Without JavaScript (and for search engines) the homepage stays a normal
// scrolling page; everything here is an enhancement on top of it.
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var desk = document.querySelector(".desktop");
  var shelf = document.querySelector(".windows");
  var icons = document.querySelector(".desk-icons");
  if (!body.classList.contains("home") || !desk || !shelf || !icons) return;

  var isPT = (root.lang || "").toLowerCase().indexOf("pt") === 0;
  var L = isPT
    ? { min: "Minimizar", max: "Ampliar", close: "Fechar", loading: "A abrir…",
        hello: "Bem-vindo à Yuwri", helloSub: "Abra o que quiser a partir da Dock, lá em baixo.",
        newMsg: "Nova mensagem", bookVisit: "Marcar visita", searchApps: "Pesquisar", about: "Sobre a Yuwri", services: "Ver serviços", wallpaper: "Fundo",
        cleanUp: "Arrumar janelas",
        walls: { "": "Pôr do sol", ocean: "Oceano", dusk: "Crepúsculo", graphite: "Grafite" } }
    : { min: "Minimize", max: "Zoom", close: "Close", loading: "Opening…",
        hello: "Welcome to Yuwri", helloSub: "Open anything from the Dock at the bottom of the screen.",
        newMsg: "New Message", bookVisit: "Book a Visit", searchApps: "Search", about: "About Yuwri", services: "Show Services", wallpaper: "Wallpaper",
        cleanUp: "Clean Up Windows",
        walls: { "": "Sunset", ocean: "Ocean", dusk: "Dusk", graphite: "Graphite" } };

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

  var GEO_KEY = "yuwri-geo-v1";
  var narrowMQ = window.matchMedia("(max-width: 760px)");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var menuApp = document.querySelector(".menu-app");
  var contactId = isPT ? "contacto" : "contact";
  var aboutId = isPT ? "sobre" : "about";
  var servicesId = isPT ? "servicos" : "services";
  var bookId = isPT ? "marcar" : "book";
  var UI = window.YuwriUI || { sound: { play: function () {} }, setWallpaper: function () {} };
  var mission = false;
  var wins = {};
  var order = [];
  var active = null;
  var z = 10;
  var cascade = 0;

  body.classList.add("os");
  body.classList.toggle("narrow", narrowMQ.matches);

  // ---------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------

  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch (e) {
      /* storage blocked: nothing is remembered, everything still works */
    }
  }

  function recall(key, json) {
    try {
      var v = localStorage.getItem(key);
      return json ? JSON.parse(v || "null") : v;
    } catch (e) {
      return null;
    }
  }

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
    ico.style.transform = "";
    ico.style.width = size + "px";
    ico.style.height = size + "px";
    return ico;
  }

  function titleText(w) {
    return w.el.querySelector(".win-title-text").textContent.trim();
  }

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

  // Magnification: icons near the pointer grow, in a wave
  function magnify(x) {
    icons.querySelectorAll(".desk-icon").forEach(function (a) {
      var r = a.getBoundingClientRect();
      var d = Math.abs(x - (r.left + r.width / 2));
      var f = Math.max(0, 1 - d / 150);
      f = f * f * (3 - 2 * f);
      a.querySelector(".ico").style.transform =
        f > 0 ? "translateY(" + (-12 * f).toFixed(1) + "px) scale(" + (1 + 0.42 * f).toFixed(3) + ")" : "";
    });
  }

  dock.addEventListener("pointermove", function (e) {
    if (isNarrow() || reduceMotion || e.pointerType === "touch") return;
    dock.classList.add("fisheye");
    magnify(e.clientX);
  });

  dock.addEventListener("pointerleave", function () {
    dock.classList.remove("fisheye");
    icons.querySelectorAll(".desk-icon .ico").forEach(function (i) {
      i.style.transform = "";
    });
  });

  // ---------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------

  function centerDelta(from, to) {
    return {
      dx: from.left + from.width / 2 - (to.left + to.width / 2),
      dy: from.top + from.height / 2 - (to.top + to.height / 2),
      s: Math.max(0.05, Math.min(1, from.width / Math.max(1, to.width)))
    };
  }

  // Zoom a window out of wherever it was opened from
  function animateOpen(el, fromRect) {
    if (reduceMotion || !el.animate) return;
    var r = el.getBoundingClientRect();
    if (fromRect) {
      var d = centerDelta(fromRect, r);
      el.animate(
        [
          { transform: "translate(" + d.dx + "px," + d.dy + "px) scale(" + d.s + ")", opacity: 0.2 },
          { transform: "none", opacity: 1 }
        ],
        { duration: 340, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" }
      );
    } else {
      el.animate(
        [{ transform: "scale(0.94) translateY(10px)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 240, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.1)" }
      );
    }
  }

  // Squeeze a window down into its Dock tile ("genie"-style)
  function animateMinimize(el, toRect, done) {
    if (reduceMotion || !el.animate) return done();
    var d = centerDelta(toRect, el.getBoundingClientRect());
    var anim = el.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: "translate(" + d.dx * 0.3 + "px," + d.dy * 0.55 + "px) scale(0.8, 0.45)", opacity: 0.95, offset: 0.45 },
        { transform: "translate(" + d.dx + "px," + d.dy + "px) scale(" + d.s + ")", opacity: 0.2 }
      ],
      { duration: 430, easing: "cubic-bezier(0.55, 0, 0.7, 0.4)" }
    );
    anim.onfinish = done;
  }

  function animateClose(el, done) {
    if (reduceMotion || !el.animate) return done();
    var anim = el.animate(
      [{ transform: "none", opacity: 1 }, { transform: "scale(0.94)", opacity: 0 }],
      { duration: 160, easing: "ease-in" }
    );
    anim.onfinish = done;
  }

  function bounce(icon) {
    if (!icon || reduceMotion) return;
    icon.classList.remove("is-bouncing");
    void icon.offsetWidth;
    icon.classList.add("is-bouncing");
    setTimeout(function () {
      icon.classList.remove("is-bouncing");
    }, 950);
  }

  // ---------------------------------------------------------------------
  // Remembered positions
  // ---------------------------------------------------------------------

  var geo = recall(GEO_KEY, true) || {};

  function saveGeo(w, sized) {
    if (isNarrow() || w.el.classList.contains("is-max")) return;
    var g = geo[w.id] || {};
    g.x = w.el.offsetLeft;
    g.y = w.el.offsetTop;
    g.w = w.el.offsetWidth;
    if (sized) g.h = w.el.offsetHeight;
    geo[w.id] = g;
    store(GEO_KEY, geo);
  }

  // ---------------------------------------------------------------------
  // Window setup
  // ---------------------------------------------------------------------

  function register(el, id) {
    var w = { id: id, el: el, tile: null, placed: false, busy: false, app: el.classList.contains("win-app") };
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

    el.addEventListener("pointerdown", function (e) {
      if (mission) {
        e.preventDefault();
        e.stopPropagation();
        setMission(false, w);
        return;
      }
      focus(w);
    }, true);

    el.addEventListener("click", function (e) {
      if (body.classList.contains("mission-out")) {
        e.preventDefault();
        e.stopPropagation();
      }
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
    var x, y, h = null;
    var saved = geo[w.id];

    if (saved && saved.x < d.w - 80 && saved.y < d.h - 40) {
      x = saved.x;
      y = saved.y;
      width = Math.min(saved.w || width, d.w);
      if (saved.h) h = Math.min(saved.h, d.h - y);
    } else if (w.id === "welcome") {
      x = (d.w - width) / 2;
      y = Math.max(14, Math.round(d.h * 0.08));
    } else {
      var step = cascade++ % 7;
      x = Math.max(16, d.w * 0.12) + step * 30;
      y = 18 + step * 26;
      if (x + width > d.w - 8) x = Math.max(8, d.w - width - 8);
    }

    el.style.width = width + "px";
    el.style.left = Math.round(x) + "px";
    el.style.top = Math.round(y) + "px";
    if (h) el.style.height = h + "px";
    else if (w.app) el.style.height = Math.max(260, d.h - y - 12) + "px";
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

  function dockIconFor(w) {
    var match = null;
    icons.querySelectorAll(".desk-icon").forEach(function (a) {
      var url = new URL(a.getAttribute("href"), location.href);
      var target = sameDoc(url) ? windowFor(url.hash) : wins["page:" + url.pathname];
      if (target === w) match = a;
    });
    return match;
  }

  function open(w, fromEl) {
    if (w.busy) return;
    var wasHidden = w.el.hidden;
    var fromRect = null;
    if (wasHidden) {
      var src = w.tile || fromEl;
      if (src) fromRect = (src.querySelector(".ico") || src).getBoundingClientRect();
      if (!w.tile) bounce(fromEl && fromEl.closest(".dock") ? fromEl : dockIconFor(w));
    }
    if (!w.placed) place(w);
    removeTile(w);
    w.el.hidden = false;
    focus(w);
    if (wasHidden) {
      animateOpen(w.el, fromRect);
      UI.sound.play("open");
      if (!w.counted && UI.track) {
        w.counted = true;
        UI.track("window-" + w.id.replace(/^page:/, "").replace(/\//g, "-").replace(/^-|-$/g, ""), titleText(w));
      }
    }
    w.el.focus({ preventScroll: true });
    updateDock();
    if (!w.app && w.id !== "welcome" && history.replaceState) {
      history.replaceState(null, "", "#" + w.id);
    }
  }

  function minimize(w) {
    if (w.busy) return;
    w.busy = true;
    addTile(w);
    updateDock();
    var target = w.tile.getBoundingClientRect();
    w.el.classList.remove("is-active");
    UI.sound.play("minimize");
    animateMinimize(w.el, target, function () {
      w.el.hidden = true;
      w.busy = false;
      focusNext();
    });
  }

  function close(w) {
    if (w.busy) return;
    w.busy = true;
    w.el.classList.remove("is-active");
    UI.sound.play("close");
    animateClose(w.el, function () {
      w.busy = false;
      w.el.hidden = true;
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
    });
  }

  function toggleMax(w) {
    var el = w.el;
    var before = el.getBoundingClientRect();
    el.classList.toggle("is-max");
    if (reduceMotion || !el.animate) return;
    var after = el.getBoundingClientRect();
    el.animate(
      [
        {
          transformOrigin: "0 0",
          transform: "translate(" + (before.left - after.left) + "px," + (before.top - after.top) + "px) scale(" +
            before.width / after.width + "," + before.height / after.height + ")"
        },
        { transformOrigin: "0 0", transform: "none" }
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" }
    );
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
      a.classList.toggle("is-running", !!w && (!w.el.hidden || !!w.tile));
    });
  }

  // ---------------------------------------------------------------------
  // Dragging (title bar) and resizing (corner)
  // ---------------------------------------------------------------------

  function startDrag(w, bar, e) {
    if (e.button !== 0 || e.target.closest("button") || isNarrow() || mission || w.el.classList.contains("is-max")) return;
    e.preventDefault();
    var el = w.el;
    var deskRect = desk.getBoundingClientRect();
    var snap = null;
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

      // Push against the left/right edge to fill that half, the top to zoom
      var px = ev.clientX - deskRect.left;
      var py = ev.clientY - deskRect.top;
      snap = px <= 6 ? "left" : px >= d.w - 6 ? "right" : py <= 2 ? "max" : null;
      showSnap(snap);
    }

    function up() {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
      body.classList.remove("dragging");
      showSnap(null);
      if (snap === "max") {
        el.style.left = left + "px";
        el.style.top = top + "px";
        toggleMax(w);
      } else if (snap) {
        el.style.left = (snap === "left" ? 0 : Math.round(d.w / 2)) + "px";
        el.style.top = "0px";
        el.style.width = Math.round(d.w / 2) + "px";
        el.style.height = d.h + "px";
        saveGeo(w, true);
      } else if (el.offsetLeft !== left || el.offsetTop !== top) {
        saveGeo(w, false);
      }
    }

    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  }

  var snapBox = document.createElement("div");
  snapBox.className = "snap-preview";
  snapBox.hidden = true;
  desk.appendChild(snapBox);

  function showSnap(where) {
    snapBox.hidden = !where;
    if (!where) return;
    snapBox.style.left = where === "right" ? "50%" : "0";
    snapBox.style.width = where === "max" ? "100%" : "50%";
  }

  // Resizing uses the browser's own resize grip (CSS `resize: both`);
  // stop iframes from swallowing the pointer while it's held, and remember
  // the new size afterwards.
  desk.addEventListener("pointerdown", function (e) {
    var winEl = e.target.closest(".win");
    if (!winEl || e.target !== winEl) return;
    var w = null;
    Object.keys(wins).forEach(function (k) {
      if (wins[k].el === winEl) w = wins[k];
    });
    var w0 = winEl.offsetWidth;
    var h0 = winEl.offsetHeight;
    body.classList.add("dragging");
    document.addEventListener("pointerup", function done() {
      body.classList.remove("dragging");
      document.removeEventListener("pointerup", done);
      if (w && (winEl.offsetWidth !== w0 || winEl.offsetHeight !== h0)) saveGeo(w, true);
    });
  });

  // ---------------------------------------------------------------------
  // Pages of the site, opened in a window
  // ---------------------------------------------------------------------

  function pageIcon(url) {
    var seg = url.pathname.replace(/^\/(pt\/)?/, "").split("/")[0];
    return PAGE_ICONS[seg] || "globe";
  }

  function openPage(url, label, fromEl) {
    var key = "page:" + url.pathname;
    var w = wins[key];
    if (w) {
      var frame = w.el.querySelector("iframe");
      if (url.hash && frame) frame.src = url.href;
      open(w, fromEl);
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

    open(w, fromEl);
  }

  // ---------------------------------------------------------------------
  // Opening things: links, Dock, menus, Spotlight, embedded pages
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

  function route(url, label, fromEl) {
    if (sameDoc(url) || /^\/(pt\/)?(index\.html)?$/.test(url.pathname)) {
      open(windowFor(url.hash) || wins.welcome, fromEl);
      return true;
    }
    if (isSitePage(url)) {
      openPage(url, label, fromEl);
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

    var label = (a.querySelector(".spot-title") || a).textContent.trim().replace(/\s+/g, " ");
    if (route(url, label, a)) e.preventDefault();
  });

  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "yuwri-open") return;
    route(new URL(e.data.href, location.href));
  });

  // ---------------------------------------------------------------------
  // Right-click on the wallpaper
  // ---------------------------------------------------------------------

  var ctx = null;

  function closeCtx() {
    if (ctx) {
      ctx.remove();
      ctx = null;
    }
  }

  function setWallpaper(name) {
    UI.setWallpaper(name);
  }

  function cleanUp() {
    geo = {};
    store(GEO_KEY, null);
    cascade = 0;
    order.forEach(function (w) {
      if (w.el.hidden) {
        w.placed = false;
        return;
      }
      w.el.classList.remove("is-max");
      w.el.style.height = "";
      place(w);
    });
  }

  function showCtx(x, y) {
    closeCtx();
    ctx = document.createElement("div");
    ctx.className = "ctx-menu";
    ctx.setAttribute("role", "menu");

    var item = function (text, fn, cls) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.textContent = text;
      if (cls) b.className = cls;
      b.addEventListener("click", function () {
        closeCtx();
        fn();
      });
      ctx.appendChild(b);
    };
    var rule = function () {
      ctx.appendChild(document.createElement("hr"));
    };

    item(L.newMsg, function () { open(wins[contactId]); });
    item(L.bookVisit, function () { open(wins[bookId]); });
    item(L.services, function () { open(wins[servicesId]); });
    item(L.about, function () { open(wins[aboutId]); });
    rule();
    var label = document.createElement("div");
    label.className = "ctx-label";
    label.textContent = L.wallpaper;
    ctx.appendChild(label);
    var current = root.getAttribute("data-wall") || "";
    Object.keys(L.walls).forEach(function (k) {
      item(L.walls[k], function () { setWallpaper(k); }, k === current ? "is-current" : "");
    });
    rule();
    item("Mission Control", function () { setMission(true); });
    item("Launchpad", function () { setLaunchpad(true); });
    item(L.cleanUp, cleanUp);

    body.appendChild(ctx);
    var r = ctx.getBoundingClientRect();
    ctx.style.left = Math.min(x, window.innerWidth - r.width - 6) + "px";
    ctx.style.top = Math.min(y, window.innerHeight - r.height - 6) + "px";
    ctx.querySelector("button").focus();
  }

  desk.addEventListener("contextmenu", function (e) {
    if (e.target !== desk && e.target !== shelf) return;
    e.preventDefault();
    showCtx(e.clientX, e.clientY);
  });

  document.addEventListener("pointerdown", function (e) {
    if (ctx && !ctx.contains(e.target)) closeCtx();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeCtx();
  });

  window.addEventListener("blur", closeCtx);

  // ---------------------------------------------------------------------
  // Welcome notification and startup screen (first visit of a session)
  // ---------------------------------------------------------------------

  function firstVisit() {
    var seen;
    try {
      seen = sessionStorage.getItem("yuwri-hello") === "1";
      sessionStorage.setItem("yuwri-hello", "1");
    } catch (err) {
      /* no session storage: treat as seen, skip the extras */
      seen = true;
    }
    return !seen;
  }

  function notify() {
    if (isNarrow()) return;
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

  function boot(then) {
    var screen = document.createElement("div");
    screen.className = "boot";
    screen.setAttribute("aria-hidden", "true");
    screen.innerHTML =
      '<svg class="boot-logo" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M6 4l6 8 6-8 M12 12v8"/></svg><div class="boot-bar"><span></span></div>';
    body.appendChild(screen);
    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      screen.classList.add("is-done");
      UI.sound.play("chime");
      then();
      setTimeout(function () { screen.remove(); }, 600);
    };
    screen.addEventListener("pointerdown", finish);
    document.addEventListener("keydown", finish, { once: true });
    setTimeout(finish, 1300);
  }

  // ---------------------------------------------------------------------
  // Mission Control: every open window, spread out side by side
  // ---------------------------------------------------------------------

  function setMission(on, pick) {
    var visible = order.filter(function (w) { return !w.el.hidden; });
    if (on && (mission || !visible.length)) return;
    if (!on && !mission) return;
    closeCtx();
    setLaunchpad(false);
    mission = on;
    body.classList.toggle("mission", on);
    var d = deskSize();
    var n = visible.length;
    var cols = Math.ceil(Math.sqrt(n));
    var rows = Math.ceil(n / cols);
    var pad = 36;
    var cellW = (d.w - pad * 2) / cols;
    var cellH = (d.h - pad * 2) / rows;

    visible.forEach(function (w, idx) {
      var el = w.el;
      el.style.transition = reduceMotion ? "none" : "transform 0.38s cubic-bezier(0.2, 0.9, 0.25, 1)";
      if (!on) {
        el.style.transform = "";
        return;
      }
      var col = idx % cols;
      var row = Math.floor(idx / cols);
      var ww = el.offsetWidth;
      var hh = el.offsetHeight;
      var sc = Math.min((cellW * 0.86) / ww, (cellH * 0.8) / hh, 1);
      var cx = pad + cellW * (col + 0.5);
      var cy = pad + cellH * (row + 0.5);
      var tx = cx - (el.offsetLeft + ww / 2);
      var ty = cy - (el.offsetTop + hh / 2);
      el.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + sc + ")";
    });

    if (!on) {
      body.classList.add("mission-out");
      setTimeout(function () {
        body.classList.remove("mission-out");
        visible.forEach(function (w) { w.el.style.transition = ""; });
      }, 420);
      if (pick) focus(pick);
    }
    UI.sound.play("pop");
  }

  desk.addEventListener("pointerdown", function (e) {
    if (mission && (e.target === desk || e.target === shelf)) setMission(false);
  });

  // ---------------------------------------------------------------------
  // Launchpad: every page and tool in one grid
  // ---------------------------------------------------------------------

  var APPS = [
    ["#" + servicesId, "services", isPT ? "Serviços" : "Services"],
    ["prices/", "prices", isPT ? "Preços" : "Prices"],
    ["#" + bookId, "book", L.bookVisit],
    ["software/", "software", "Software"],
    ["blog/", "tips", isPT ? "Dicas" : "Tips"],
    ["troubleshoot/", "help", isPT ? "Assistente" : "Troubleshooter"],
    ["repair-or-replace/", "pc", isPT ? "Reparar ou Substituir" : "Repair or Replace"],
    ["cheat-sheets/", "checklist", isPT ? "Checklists" : "Cheat Sheets"],
    ["glossary/", "glossary", isPT ? "Glossário" : "Glossary"],
    ["heads-up/", "warning", isPT ? "Avisos" : "Heads Up"],
    ["tools/windows-11-checker/", "w11", isPT ? "Pronto para o Windows 11?" : "Windows 11 Check"],
    ["tools/password-generator/", "key", isPT ? "Gerador de Palavras-passe" : "Passwords"],
    ["tools/file-size-converter/", "ruler", isPT ? "Conversor de Tamanhos" : "File Sizes"],
    ["resources/", "tools", isPT ? "Recursos" : "Resources"],
    ["#" + (isPT ? "testemunhos" : "testimonials"), "reviews", isPT ? "Opiniões" : "Reviews"],
    ["#" + aboutId, "user", isPT ? "Sobre" : "About"],
    ["#" + contactId, "contact", isPT ? "Contacto" : "Contact"],
    ["search/", "search", isPT ? "Pesquisa" : "Search"]
  ];

  var pad = document.createElement("div");
  pad.className = "launchpad";
  pad.setAttribute("role", "dialog");
  pad.setAttribute("aria-modal", "true");
  pad.setAttribute("aria-label", "Launchpad");
  pad.hidden = true;
  var padSearch = document.createElement("input");
  padSearch.type = "search";
  padSearch.className = "launch-search";
  padSearch.placeholder = L.searchApps;
  padSearch.setAttribute("aria-label", L.searchApps);
  var padGrid = document.createElement("ul");
  padGrid.className = "launch-grid";
  APPS.forEach(function (app) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = app[0];
    a.className = "launch-app";
    a.appendChild(iconFor(app[1], 72));
    var span = document.createElement("span");
    span.textContent = app[2];
    a.appendChild(span);
    li.appendChild(a);
    padGrid.appendChild(li);
  });
  pad.appendChild(padSearch);
  pad.appendChild(padGrid);
  body.appendChild(pad);

  function setLaunchpad(on) {
    if (on === !pad.hidden) return;
    if (on) {
      closeCtx();
      if (mission) setMission(false);
      pad.hidden = false;
      padSearch.value = "";
      filterApps();
      padSearch.focus();
      UI.sound.play("pop");
    } else {
      pad.hidden = true;
    }
  }

  function filterApps() {
    var q = padSearch.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    padGrid.querySelectorAll("li").forEach(function (li) {
      var t = li.textContent.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      li.hidden = q && t.indexOf(q) === -1;
    });
  }

  padSearch.addEventListener("input", filterApps);
  padSearch.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var first = padGrid.querySelector("li:not([hidden]) a");
      if (first) first.click();
    }
  });
  pad.addEventListener("click", function (e) {
    if (e.target.closest("a")) setLaunchpad(false);
    else if (e.target === pad || e.target === padGrid) setLaunchpad(false);
  });

  // Launchpad's own Dock icon, first in the row
  var lpItem = document.createElement("li");
  var lpLink = document.createElement("a");
  lpLink.href = "#launchpad";
  lpLink.className = "desk-icon dock-launchpad";
  lpLink.appendChild(iconFor("launchpad", 52));
  var lpLabel = document.createElement("span");
  lpLabel.textContent = "Launchpad";
  lpLink.appendChild(lpLabel);
  lpItem.appendChild(lpLink);
  icons.insertBefore(lpItem, icons.firstChild);
  lpLink.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setLaunchpad(pad.hidden);
  });

  document.addEventListener("yuwri:mission", function () { setMission(!mission); });
  document.addEventListener("yuwri:launchpad", function () { setLaunchpad(pad.hidden); });

  // ---------------------------------------------------------------------
  // Files on the desktop (wide screens): click to select, double-click
  // (or Enter, or a tap) to open
  // ---------------------------------------------------------------------

  var FILE_ART = {
    drive: '<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="4" y="10" width="56" height="30" rx="5" fill="#E2E2E7" stroke="#A9A9B0"/><rect x="4" y="28" width="56" height="12" rx="4" fill="#C4C4CC"/><circle cx="50" cy="34" r="2.4" fill="#34C759"/></svg>',
    doc: '<svg viewBox="0 0 48 60" aria-hidden="true"><path d="M6 2h26l12 12v42a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#FFFFFF" stroke="#C8C8CE"/><path d="M32 2v12h12" fill="#ECECF1" stroke="#C8C8CE"/><path d="M12 28h24M12 34h24M12 40h16" stroke="#B0B0B8" stroke-width="2.5" stroke-linecap="round"/></svg>',
    folder: '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M4 10a4 4 0 0 1 4-4h15l5 5h28a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#3E95EC"/><path d="M4 18a3 3 0 0 1 3-3h50a3 3 0 0 1 3 3v26a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#6DB7F7"/></svg>'
  };
  var FILES = [
    ["drive", "#" + aboutId, "Yuwri HD"],
    ["doc", "prices/", isPT ? "Tabela de Preços" : "Price List"],
    ["doc", "#" + (isPT ? "abordagem" : "approach"), isPT ? "Leia-me" : "Read Me"],
    ["folder", "cheat-sheets/", isPT ? "Checklists" : "Cheat Sheets"],
    ["folder", "#" + (isPT ? "ferramentas" : "tools"), isPT ? "Extras" : "Free Tools"]
  ];

  var files = document.createElement("div");
  files.className = "desk-files";
  var lastPointer = "mouse";
  FILES.forEach(function (f) {
    var a = document.createElement("a");
    a.className = "desk-file";
    a.href = f[1];
    a.innerHTML = FILE_ART[f[0]];
    var label = document.createElement("span");
    label.textContent = f[2];
    a.appendChild(label);
    a.addEventListener("pointerdown", function (e) { lastPointer = e.pointerType; });
    a.addEventListener("click", function (e) {
      // Mouse single click only selects; keyboard (detail 0) and taps open
      if (e.detail === 1 && lastPointer !== "touch") {
        e.preventDefault();
        e.stopPropagation();
        files.querySelectorAll(".desk-file").forEach(function (x) { x.classList.toggle("is-selected", x === a); });
      }
    });
    a.addEventListener("dblclick", function (e) {
      e.preventDefault();
      route(new URL(a.getAttribute("href"), location.href), f[2], a);
    });
    files.appendChild(a);
  });
  desk.insertBefore(files, desk.firstChild);

  desk.addEventListener("pointerdown", function (e) {
    if (e.target === desk || e.target === shelf) {
      files.querySelectorAll(".is-selected").forEach(function (x) { x.classList.remove("is-selected"); });
    }
  });

  // ---------------------------------------------------------------------
  // Desktop widgets (wide screens): clock, availability, next free slot
  // ---------------------------------------------------------------------

  var W = isPT
    ? { avail: "Disponível agora", back: "Volto às ", backTomorrow: "Volto amanhã às ",
        replies: "Respondo normalmente no mesmo dia.", message: "Mensagem", next: "Próxima vaga",
        today: "Hoje", tomorrow: "Amanhã", bookIt: "Marcar" }
    : { avail: "Available now", back: "Back at ", backTomorrow: "Back tomorrow at ",
        replies: "I usually reply the same day.", message: "Message", next: "Next free slot",
        today: "Today", tomorrow: "Tomorrow", bookIt: "Book it" };

  // Lisbon date/time as numbers
  function lisbon(date) {
    var parts = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
      weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
    return {
      y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, min: +parts.minute,
      wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday)
    };
  }

  // First bookable start time (same hours as the Book a Visit window)
  function nextSlot() {
    var now = lisbon(new Date());
    for (var add = 0; add < 8; add++) {
      var day = new Date(Date.UTC(now.y, now.m - 1, now.d + add));
      var wd = day.getUTCDay();
      var first = wd === 0 || wd === 6 ? 10 : 18;
      var last = wd === 0 || wd === 6 ? 19 : 21;
      var start = add === 0 ? Math.max(first, now.h + 1) : first;
      if (start <= last) {
        return {
          add: add, hour: start, date: day,
          iso: day.toISOString().slice(0, 10),
          time: (start < 10 ? "0" : "") + start + ":00"
        };
      }
    }
    return null;
  }

  var widgets = document.createElement("div");
  widgets.className = "widgets";
  widgets.innerHTML =
    '<div class="widget widget-clock" aria-hidden="true"><div class="w-time"></div><div class="w-date"></div></div>' +
    '<div class="widget widget-status"><p class="w-head"><span class="status-dot" aria-hidden="true"></span><strong class="w-status"></strong></p>' +
    '<p class="w-sub"></p><a class="btn btn-sm" href="#' + contactId + '"></a></div>' +
    '<div class="widget widget-slot"><p class="w-label"></p><strong class="w-slot"></strong>' +
    '<button type="button" class="btn btn-sm btn-primary"></button></div>';
  widgets.querySelector(".w-sub").textContent = W.replies;
  widgets.querySelector(".widget-status a").textContent = W.message;
  widgets.querySelector(".w-label").textContent = W.next;
  widgets.querySelector(".widget-slot button").textContent = W.bookIt;
  desk.insertBefore(widgets, desk.firstChild);

  var slot = null;

  function renderWidgets() {
    var now = new Date();
    widgets.querySelector(".w-time").textContent =
      String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    widgets.querySelector(".w-date").textContent =
      now.toLocaleDateString(isPT ? "pt-PT" : "en-GB", { weekday: "long", day: "numeric", month: "long" });

    var a = UI.availability ? UI.availability() : null;
    var statusBox = widgets.querySelector(".widget-status");
    if (a) {
      var at = (a.at < 10 ? "0" : "") + a.at + ":00";
      statusBox.classList.toggle("is-open", a.open);
      widgets.querySelector(".w-status").textContent = a.open ? W.avail : (a.when === "today" ? W.back : W.backTomorrow) + at;
    }

    slot = nextSlot();
    var slotBox = widgets.querySelector(".widget-slot");
    slotBox.hidden = !slot;
    if (slot) {
      var dayName = slot.add === 0 ? W.today : slot.add === 1 ? W.tomorrow :
        slot.date.toLocaleDateString(isPT ? "pt-PT" : "en-GB", { weekday: "long", timeZone: "UTC" });
      widgets.querySelector(".w-slot").textContent = dayName + " · " + slot.time;
    }
  }

  // "Book it": open Book a Visit with that day and time filled in
  widgets.querySelector(".widget-slot button").addEventListener("click", function (e) {
    var w = wins[bookId];
    if (!w) return;
    open(w, e.currentTarget);
    var form = w.el.querySelector(".book-form");
    if (form && slot) {
      form.elements.day.value = slot.iso;
      form.elements.day.dispatchEvent(new Event("change"));
      form.elements.time.value = slot.time;
      form.elements.problem.focus();
    }
  });

  renderWidgets();
  setInterval(renderWidgets, 30000);

  // ---------------------------------------------------------------------
  // Keyboard shortcuts. Cmd+W / Cmd+M belong to the browser, so the
  // window ones use Option (Alt): Option+W close, Option+M minimize,
  // Option+` next window. F3 / Ctrl+Up Mission Control, F4 Launchpad.
  // ---------------------------------------------------------------------

  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "");
    if (e.key === "F3" || (e.ctrlKey && e.key === "ArrowUp")) {
      e.preventDefault();
      setMission(!mission);
    } else if (e.key === "F4") {
      e.preventDefault();
      setLaunchpad(pad.hidden);
    } else if (e.key === "Escape") {
      if (!pad.hidden) setLaunchpad(false);
      else if (mission) setMission(false);
    } else if (e.altKey && !e.metaKey && !e.ctrlKey && !typing && active) {
      if (e.code === "KeyW") {
        e.preventDefault();
        close(active);
      } else if (e.code === "KeyM") {
        e.preventDefault();
        minimize(active);
      } else if (e.code === "Backquote") {
        e.preventDefault();
        var visible = order.filter(function (w) { return !w.el.hidden; });
        if (visible.length > 1) {
          focus(visible[0]);
          visible[0].el.focus({ preventScroll: true });
        }
      }
    }
  });

  // ---------------------------------------------------------------------
  // Start up
  // ---------------------------------------------------------------------

  shelf.querySelectorAll(".win").forEach(function (el) {
    register(el, el.id);
  });

  function start(showNotice) {
    open(wins.welcome);
    var first = windowFor(location.hash);
    if (first && first !== wins.welcome) open(first);
    if (showNotice) setTimeout(notify, 500);
  }

  if (firstVisit() && !reduceMotion) {
    boot(function () { start(true); });
  } else {
    start(false);
  }

  if (narrowMQ.addEventListener) {
    narrowMQ.addEventListener("change", function () {
      body.classList.toggle("narrow", isNarrow());
    });
  }

  // Keep title bars reachable when the browser window shrinks
  window.addEventListener("resize", function () {
    closeCtx();
    var d = deskSize();
    Object.keys(wins).forEach(function (k) {
      var el = wins[k].el;
      if (el.offsetLeft > d.w - 80) el.style.left = Math.max(0, d.w - el.offsetWidth) + "px";
      if (el.offsetTop > d.h - 40) el.style.top = Math.max(0, d.h - 80) + "px";
    });
  });
})();
