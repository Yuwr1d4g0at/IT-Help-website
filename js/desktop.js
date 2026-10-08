// Homepage desktop: turns the stacked homepage windows into real ones.
// Windows open from the desktop icons, Start menu and in-page links, can be
// dragged by the title bar, resized from the corner, minimized to the
// taskbar, maximized and closed. Links to other pages of the site open
// inside a window instead of navigating away.
//
// Without JavaScript (and for search engines) the homepage stays a normal
// scrolling page; everything here is an enhancement on top of it.
(function () {
  "use strict";

  var body = document.body;
  var desk = document.querySelector(".desktop");
  var shelf = document.querySelector(".windows");
  var tasks = document.querySelector(".tasks");
  if (!body.classList.contains("home") || !desk || !shelf || !tasks) return;

  var isPT = (document.documentElement.lang || "").toLowerCase().indexOf("pt") === 0;
  var L = isPT
    ? { min: "Minimizar", max: "Maximizar", close: "Fechar", loading: "A abrir…",
        begin: "Clique aqui para começar", beginSub: "ou nos ícones do ambiente de trabalho." }
    : { min: "Minimize", max: "Maximize", close: "Close", loading: "Opening…",
        begin: "Click here to begin", beginSub: "or on the icons on the desktop." };

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
    prices: "notepad", software: "floppy", blog: "book", resources: "folder",
    troubleshoot: "help", "repair-or-replace": "pc", "cheat-sheets": "notepad",
    glossary: "book", "heads-up": "warning", tools: "folder", search: "help"
  };

  var narrowMQ = window.matchMedia("(max-width: 760px)");
  var wins = {};
  var order = [];
  var active = null;
  var z = 10;
  var cascade = 0;

  body.classList.add("os");
  body.classList.toggle("narrow", narrowMQ.matches);

  function deskSize() {
    return { w: desk.clientWidth, h: desk.clientHeight };
  }

  function isNarrow() {
    return narrowMQ.matches;
  }

  function iconSvg(name) {
    var svg = document.querySelector('svg[data-icon="' + name + '"]');
    if (!svg) return document.createElement("span");
    svg = svg.cloneNode(true);
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    return svg;
  }

  function titleText(w) {
    return w.el.querySelector(".win-title-text").textContent.trim();
  }

  // ---------------------------------------------------------------------
  // Window setup
  // ---------------------------------------------------------------------

  function register(el, id) {
    var w = { id: id, el: el, task: null, placed: false, app: el.classList.contains("win-app") };
    wins[id] = w;
    el.hidden = true;
    el.tabIndex = -1;

    var ctr = el.querySelector(".win-controls");
    ctr.removeAttribute("aria-hidden");
    ctr.innerHTML = "";
    [["min", "_", L.min], ["max", "□", L.max], ["close", "×", L.close]].forEach(function (c) {
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
      x = Math.max(110, (d.w - width) / 2 + 40);
      y = Math.max(12, Math.round(d.h * 0.07));
    } else {
      var step = cascade++ % 7;
      x = 130 + step * 32;
      y = 14 + step * 28;
    }
    if (x + width > d.w - 8) x = Math.max(8, d.w - width - 8);

    el.style.width = width + "px";
    el.style.left = x + "px";
    el.style.top = y + "px";
    if (w.app) el.style.height = Math.max(260, d.h - y - 14) + "px";
    w.placed = true;
  }

  // ---------------------------------------------------------------------
  // Window state
  // ---------------------------------------------------------------------

  function focus(w) {
    if (active && active !== w) {
      active.el.classList.remove("is-active");
      if (active.task) active.task.setAttribute("aria-pressed", "false");
    }
    active = w;
    w.el.classList.add("is-active");
    w.el.style.zIndex = ++z;
    if (w.task) w.task.setAttribute("aria-pressed", "true");
    order = order.filter(function (o) { return o !== w; });
    order.push(w);
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
  }

  function open(w) {
    if (!w.placed) place(w);
    w.el.hidden = false;
    if (!w.task) w.task = makeTask(w);
    focus(w);
    w.el.focus({ preventScroll: true });
    if (!w.app && w.id !== "welcome" && history.replaceState) {
      history.replaceState(null, "", "#" + w.id);
    }
  }

  function minimize(w) {
    w.el.hidden = true;
    w.el.classList.remove("is-active");
    if (w.task) w.task.setAttribute("aria-pressed", "false");
    focusNext();
  }

  function close(w) {
    w.el.hidden = true;
    w.el.classList.remove("is-active");
    if (w.task) {
      w.task.remove();
      w.task = null;
    }
    order = order.filter(function (o) { return o !== w; });
    if (w.app) {
      w.el.remove();
      delete wins[w.id];
    }
    if (location.hash === "#" + w.id && history.replaceState) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    focusNext();
  }

  function toggleMax(w) {
    var max = !w.el.classList.contains("is-max");
    w.el.classList.toggle("is-max", max);
    var b = w.el.querySelector(".wc-max");
    if (b) b.textContent = max ? "❐" : "□";
  }

  function makeTask(w) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "task";
    b.setAttribute("aria-pressed", "false");
    var icon = w.el.querySelector(".win-title svg");
    if (icon) b.appendChild(icon.cloneNode(true));
    var s = document.createElement("span");
    s.textContent = titleText(w);
    b.appendChild(s);
    b.title = s.textContent;
    b.addEventListener("click", function () {
      if (w.el.hidden) open(w);
      else if (active === w) minimize(w);
      else focus(w);
    });
    tasks.appendChild(b);
    return b;
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
      x = Math.min(Math.max(x, 60 - width), d.w - 60);
      y = Math.min(Math.max(y, 0), d.h - 30);
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
    el.setAttribute("data-w", "960");

    var bar = document.createElement("div");
    bar.className = "win-title";
    bar.appendChild(iconSvg(pageIcon(url)));
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
      if (w.task) {
        w.task.querySelector("span").textContent = name;
        w.task.title = name;
      }
    });

    open(w);
  }

  // ---------------------------------------------------------------------
  // Opening things: links, icons, Start menu, messages from embedded pages
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
    if (a.classList.contains("lang-switch")) return;
    if (a.classList.contains("brand")) return;
    var url = new URL(a.getAttribute("href"), location.href);
    if (url.origin !== location.origin) return;

    // Icons get selected like on a real desktop
    var icon = a.closest(".desk-icon");
    selectIcon(icon);

    var label = a.textContent.trim().replace(/\s+/g, " ");
    if (route(url, label)) e.preventDefault();
  });

  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "yuwri-open") return;
    route(new URL(e.data.href, location.href));
  });

  function selectIcon(icon) {
    desk.querySelectorAll(".desk-icon.is-selected").forEach(function (i) {
      if (i !== icon) i.classList.remove("is-selected");
    });
    if (icon) icon.classList.add("is-selected");
  }

  // Clicking empty desktop clears the selection
  desk.addEventListener("pointerdown", function (e) {
    if (e.target === desk || e.target === shelf) selectIcon(null);
  });

  // ---------------------------------------------------------------------
  // "Click here to begin" balloon on the first visit
  // ---------------------------------------------------------------------

  function balloon() {
    var seen = false;
    try {
      seen = sessionStorage.getItem("yuwri-begin") === "1";
      sessionStorage.setItem("yuwri-begin", "1");
    } catch (err) {
      seen = false;
    }
    if (seen) return;

    var tip = document.createElement("div");
    tip.className = "balloon";
    tip.setAttribute("role", "status");
    tip.innerHTML = "<strong></strong><span></span>";
    tip.querySelector("strong").textContent = L.begin;
    tip.querySelector("span").textContent = L.beginSub;
    document.body.appendChild(tip);

    var dismiss = function () {
      tip.remove();
      document.removeEventListener("pointerdown", dismiss);
    };
    document.addEventListener("pointerdown", dismiss);
    setTimeout(dismiss, 9000);
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
  balloon();

  function onNarrowChange() {
    body.classList.toggle("narrow", isNarrow());
  }
  if (narrowMQ.addEventListener) narrowMQ.addEventListener("change", onNarrowChange);

  // Keep title bars reachable when the browser window shrinks
  window.addEventListener("resize", function () {
    var d = deskSize();
    Object.keys(wins).forEach(function (k) {
      var el = wins[k].el;
      if (el.offsetLeft > d.w - 60) el.style.left = Math.max(0, d.w - el.offsetWidth) + "px";
      if (el.offsetTop > d.h - 30) el.style.top = Math.max(0, d.h - 60) + "px";
    });
  });
})();
