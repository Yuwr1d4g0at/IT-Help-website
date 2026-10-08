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
  var onHome = document.body.classList.contains("home");
  var contactHref = (homeHref === "#top" ? "" : homeHref) + (isPT ? "#contacto" : "#contact");

  function remember(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {
      /* storage blocked: the choice lasts for this page only */
    }
  }

  function recall(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  // Set an attribute on this page and on any site page open in a window
  function setRootAttr(name, value) {
    var docs = [document];
    document.querySelectorAll("iframe").forEach(function (f) {
      try {
        if (f.contentDocument) docs.push(f.contentDocument);
      } catch (e) {
        /* not ours */
      }
    });
    docs.forEach(function (d) {
      if (value) d.documentElement.setAttribute(name, value);
      else d.documentElement.removeAttribute(name);
    });
  }

  function setTheme(v) {
    setRootAttr("data-theme", v === "light" || v === "dark" ? v : null);
    remember("yuwri-theme", v === "light" || v === "dark" ? v : null);
  }

  function setWallpaper(v) {
    setRootAttr("data-wall", v || null);
    remember("yuwri-wall", v || null);
  }

  // ---------------------------------------------------------------------
  // Sound effects, synthesized (no audio files), off unless switched on
  // ---------------------------------------------------------------------
  var Sound = (function () {
    var ctx = null;

    function audio() {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function note(c, freq, start, dur, type, vol, toFreq) {
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, start);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(start);
      o.stop(start + dur + 0.05);
    }

    var sounds = {
      chime: function (c, t) {
        [261.6, 329.6, 392, 523.3, 659.3].forEach(function (f, i) {
          note(c, f, t + i * 0.012, 1.8, "sine", 0.05);
        });
      },
      open: function (c, t) { note(c, 620, t, 0.16, "sine", 0.045, 900); },
      minimize: function (c, t) { note(c, 700, t, 0.32, "sine", 0.05, 160); },
      close: function (c, t) { note(c, 520, t, 0.12, "triangle", 0.04, 300); },
      pop: function (c, t) { note(c, 980, t, 0.09, "sine", 0.05); }
    };

    return {
      enabled: function () {
        return recall("yuwri-sound") === "on";
      },
      set: function (on) {
        remember("yuwri-sound", on ? "on" : null);
        if (on) this.play("pop", true);
      },
      play: function (name, force) {
        if (!force && !this.enabled()) return;
        var c = audio();
        if (c && sounds[name]) sounds[name](c, c.currentTime + 0.01);
      }
    };
  })();

  window.YuwriUI = { sound: Sound, setTheme: setTheme, setWallpaper: setWallpaper };

  // ---------------------------------------------------------------------
  // Live availability (Lisbon time): weekdays 18-22, weekends 10-20
  // ---------------------------------------------------------------------
  function availability() {
    var parts = {};
    try {
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Lisbon", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    } catch (e) {
      return null;
    }
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var day = days.indexOf(parts.weekday);
    var mins = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
    var hoursFor = function (d) {
      return d === 0 || d === 6 ? [10, 20] : [18, 22];
    };
    var h = hoursFor(day);
    if (mins >= h[0] * 60 && mins < h[1] * 60) return { open: true };
    if (mins < h[0] * 60) return { open: false, when: "today", at: h[0] };
    var next = (day + 1) % 7;
    return { open: false, when: "tomorrow", at: hoursFor(next)[0] };
  }

  var statusLink = null;
  function renderStatus() {
    if (!statusLink) return;
    var a = availability();
    if (!a) return;
    var at = (a.at < 10 ? "0" : "") + a.at + ":00";
    statusLink.classList.toggle("is-open", a.open);
    statusLink.lastChild.textContent = a.open
      ? (isPT ? "Disponível agora" : "Available now")
      : a.when === "today"
        ? (isPT ? "Volto às " + at : "Back at " + at)
        : (isPT ? "Volto amanhã às " + at : "Back tomorrow " + at);
    statusLink.title = statusLink.lastChild.textContent;
  }

  if (tray) {
    statusLink = document.createElement("a");
    statusLink.className = "status-pill";
    statusLink.href = contactHref;
    var dot = document.createElement("span");
    dot.className = "status-dot";
    dot.setAttribute("aria-hidden", "true");
    statusLink.appendChild(dot);
    statusLink.appendChild(document.createElement("span"));
    tray.insertBefore(statusLink, tray.firstChild);
    renderStatus();
    setInterval(renderStatus, 60000);
  }

  // ---------------------------------------------------------------------
  // Control Center
  // ---------------------------------------------------------------------
  if (tray) {
    var C = isPT
      ? { title: "Centro de Controlo", look: "Aspeto", auto: "Auto", light: "Claro", dark: "Escuro",
          wall: "Fundo", lang: "Idioma", sound: "Efeitos sonoros", mission: "Mission Control", launch: "Launchpad",
          keys: "Atalhos", walls: { "": "Pôr do sol", ocean: "Oceano", dusk: "Crepúsculo", graphite: "Grafite" } }
      : { title: "Control Center", look: "Appearance", auto: "Auto", light: "Light", dark: "Dark",
          wall: "Wallpaper", lang: "Language", sound: "Sound effects", mission: "Mission Control", launch: "Launchpad",
          keys: "Shortcuts", walls: { "": "Sunset", ocean: "Ocean", dusk: "Dusk", graphite: "Graphite" } };

    var ccBtn = document.createElement("button");
    ccBtn.type = "button";
    ccBtn.className = "spot-btn cc-btn";
    ccBtn.setAttribute("aria-label", C.title);
    ccBtn.setAttribute("aria-expanded", "false");
    ccBtn.title = C.title;
    ccBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10 M18 7h2 M4 17h2 M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
    tray.insertBefore(ccBtn, statusLink ? statusLink.nextSibling : tray.firstChild);

    var cc = document.createElement("div");
    cc.className = "cc-panel";
    cc.setAttribute("role", "dialog");
    cc.setAttribute("aria-label", C.title);

    var section = function (label) {
      var box = document.createElement("div");
      box.className = "cc-tile";
      var h = document.createElement("p");
      h.className = "cc-label";
      h.textContent = label;
      box.appendChild(h);
      cc.appendChild(box);
      return box;
    };

    // Appearance
    var lookRow = document.createElement("div");
    lookRow.className = "cc-seg";
    var currentTheme = root.getAttribute("data-theme") || "auto";
    [["auto", C.auto], ["light", C.light], ["dark", C.dark]].forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = o[1];
      b.setAttribute("aria-pressed", String(o[0] === currentTheme));
      b.addEventListener("click", function () {
        setTheme(o[0]);
        lookRow.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        Sound.play("pop");
      });
      lookRow.appendChild(b);
    });
    section(C.look).appendChild(lookRow);

    // Wallpaper
    var wallRow = document.createElement("div");
    wallRow.className = "cc-swatches";
    var currentWall = root.getAttribute("data-wall") || "";
    Object.keys(C.walls).forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cc-swatch";
      b.setAttribute("data-wall-swatch", k || "sunset");
      b.setAttribute("aria-label", C.walls[k]);
      b.setAttribute("aria-pressed", String(k === currentWall));
      b.title = C.walls[k];
      b.addEventListener("click", function () {
        setWallpaper(k);
        wallRow.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        Sound.play("pop");
      });
      wallRow.appendChild(b);
    });
    section(C.wall).appendChild(wallRow);

    // Language + sound, side by side
    var duo = document.createElement("div");
    duo.className = "cc-duo";
    cc.appendChild(duo);

    var langBox = document.createElement("div");
    langBox.className = "cc-tile";
    langBox.innerHTML = '<p class="cc-label"></p><div class="cc-seg"></div>';
    langBox.firstChild.textContent = C.lang;
    var switcher = document.querySelector(".lang-switch");
    var here = document.createElement("span");
    here.textContent = isPT ? "PT" : "EN";
    here.setAttribute("aria-current", "true");
    var there = document.createElement("a");
    there.textContent = isPT ? "EN" : "PT";
    there.href = switcher && switcher.getAttribute("href") ? switcher.getAttribute("href") : "#";
    langBox.lastChild.appendChild(isPT ? there : here);
    langBox.lastChild.appendChild(isPT ? here : there);
    duo.appendChild(langBox);

    var soundBox = document.createElement("div");
    soundBox.className = "cc-tile";
    var sw = document.createElement("button");
    sw.type = "button";
    sw.className = "cc-switch";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(Sound.enabled()));
    sw.innerHTML = '<span class="cc-label"></span><span class="cc-knob" aria-hidden="true"></span>';
    sw.firstChild.textContent = C.sound;
    sw.addEventListener("click", function () {
      var on = sw.getAttribute("aria-checked") !== "true";
      sw.setAttribute("aria-checked", String(on));
      Sound.set(on);
    });
    soundBox.appendChild(sw);
    duo.appendChild(soundBox);

    // Desktop-only actions
    if (onHome) {
      var acts = document.createElement("div");
      acts.className = "cc-duo cc-actions";
      [["yuwri:mission", C.mission], ["yuwri:launchpad", C.launch]].forEach(function (o) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "cc-tile cc-action";
        b.textContent = o[1];
        b.addEventListener("click", function () {
          setCC(false);
          document.dispatchEvent(new CustomEvent(o[0]));
        });
        acts.appendChild(b);
      });
      cc.appendChild(acts);

      var keys = document.createElement("p");
      keys.className = "cc-keys";
      keys.textContent = C.keys + ": ⌘K Spotlight · F3 " + C.mission + " · F4 " + C.launch +
        " · ⌥W " + (isPT ? "fechar" : "close") + " · ⌥M " + (isPT ? "minimizar" : "minimize") +
        " · ⌥` " + (isPT ? "próxima janela" : "next window");
      cc.appendChild(keys);
    }

    tray.parentNode.appendChild(cc);

    var setCC = function (open) {
      cc.classList.toggle("is-open", open);
      ccBtn.setAttribute("aria-expanded", String(open));
      ccBtn.classList.toggle("is-pressed", open);
    };

    ccBtn.addEventListener("click", function () {
      setCC(!cc.classList.contains("is-open"));
    });

    document.addEventListener("pointerdown", function (e) {
      if (cc.classList.contains("is-open") && !cc.contains(e.target) && !ccBtn.contains(e.target)) setCC(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && cc.classList.contains("is-open")) {
        setCC(false);
        ccBtn.focus();
      }
    });
  }

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
  // Spotlight: search the whole site from the menu bar or with Cmd/Ctrl+K
  // ---------------------------------------------------------------------
  if (tray) {
    var S = isPT
      ? { label: "Pesquisa", placeholder: "Pesquisar na Yuwri", none: "Sem resultados." }
      : { label: "Search", placeholder: "Search Yuwri", none: "No results." };
    var lens = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.6-4.6"/></svg>';

    var spotBtn = document.createElement("button");
    spotBtn.type = "button";
    spotBtn.className = "spot-btn";
    spotBtn.setAttribute("aria-label", S.label + " (⌘K)");
    spotBtn.title = S.label + " (⌘K)";
    spotBtn.innerHTML = lens;
    tray.insertBefore(spotBtn, tray.querySelector(".cc-btn") || tray.firstChild);

    var spot = document.createElement("div");
    spot.className = "spotlight";
    spot.innerHTML =
      '<div class="spot-panel" role="dialog" aria-modal="true" aria-label="' + S.label + '">' +
      '<label class="spot-field">' + lens.replace('width="15" height="15"', 'width="22" height="22"') +
      '<input type="search" autocomplete="off" spellcheck="false" aria-controls="spot-results"></label>' +
      '<ul class="spot-results" id="spot-results" role="listbox"></ul></div>';
    document.body.appendChild(spot);

    var input = spot.querySelector("input");
    var list = spot.querySelector(".spot-results");
    input.placeholder = S.placeholder;
    var entries = null;
    var picked = 0;

    var loadIndex = function () {
      if (entries) return Promise.resolve(entries);
      return fetch(isPT ? "/pt/search-index.json" : "/search-index.json")
        .then(function (r) { return r.json(); })
        .then(function (d) {
          entries = d.entries || [];
          return entries;
        })
        .catch(function () {
          entries = [];
          return entries;
        });
    };

    var norm = function (t) {
      return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    };

    var render = function () {
      var q = norm(input.value).trim();
      list.innerHTML = "";
      picked = 0;
      if (!q || !entries) return;
      var words = q.split(/\s+/);
      var hits = entries
        .map(function (e) {
          var title = norm(e.title);
          var hay = title + " " + norm(e.keywords) + " " + norm(e.excerpt) + " " + norm(e.category);
          if (!words.every(function (w) { return hay.indexOf(w) !== -1; })) return null;
          var score = words.reduce(function (n, w) { return n + (title.indexOf(w) !== -1 ? 3 : 1); }, 0);
          return { e: e, score: score };
        })
        .filter(Boolean)
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 8);

      if (!hits.length) {
        var li0 = document.createElement("li");
        li0.className = "spot-empty";
        li0.textContent = S.none;
        list.appendChild(li0);
        return;
      }

      hits.forEach(function (h, i) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = h.e.url;
        a.setAttribute("role", "option");
        if (i === 0) a.classList.add("is-selected");
        var left = document.createElement("span");
        var t = document.createElement("span");
        t.className = "spot-title";
        t.textContent = h.e.title.replace(/\s*\|\s*Yuwri\s*$/, "").replace(/^Yuwri\s*\|\s*/, "");
        var ex = document.createElement("span");
        ex.className = "spot-excerpt";
        ex.textContent = h.e.excerpt || "";
        left.appendChild(t);
        left.appendChild(ex);
        var cat = document.createElement("span");
        cat.className = "spot-cat";
        cat.textContent = h.e.category || "";
        a.appendChild(left);
        a.appendChild(cat);
        li.appendChild(a);
        list.appendChild(li);
      });
    };

    var openSpot = function () {
      spot.classList.add("is-open");
      input.value = "";
      list.innerHTML = "";
      input.focus();
      loadIndex().then(render);
    };

    var closeSpot = function () {
      spot.classList.remove("is-open");
    };

    var move = function (step) {
      var items = list.querySelectorAll("a");
      if (!items.length) return;
      items[picked].classList.remove("is-selected");
      picked = (picked + step + items.length) % items.length;
      items[picked].classList.add("is-selected");
      items[picked].scrollIntoView({ block: "nearest" });
    };

    spotBtn.addEventListener("click", openSpot);
    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        var cur = list.querySelectorAll("a")[picked];
        if (cur) { e.preventDefault(); closeSpot(); cur.click(); }
      }
    });
    list.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeSpot();
    });
    spot.addEventListener("pointerdown", function (e) {
      if (e.target === spot) closeSpot();
    });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (spot.classList.contains("is-open")) closeSpot();
        else openSpot();
      } else if (e.key === "Escape" && spot.classList.contains("is-open")) {
        closeSpot();
        spotBtn.focus();
      }
    });
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
