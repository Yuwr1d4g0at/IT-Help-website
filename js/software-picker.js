// "Build Your Own Setup" picker (software/ + pt/software/).
// Generates a plain .bat file that installs each checked app.
// Windows 10/11 mode calls winget; Windows 7/8.1 mode calls Chocolatey
// with each app pinned to its last release that still runs there (rows
// carry data-choco / data-choco-version). macOS mode builds a .sh that
// calls Homebrew casks (data-brew); rows marked data-only-mode="mac" are
// Mac-only picks, hidden in the Windows modes. Nothing is downloaded or
// hosted here: every tool fetches straight from its own public repository.
(function () {
  "use strict";

  var checks = Array.prototype.slice.call(document.querySelectorAll(".pick-check"));
  var countEl = document.getElementById("picker-count");
  var generateBtn = document.getElementById("picker-generate");
  var output = document.getElementById("picker-output");
  var scriptEl = document.getElementById("picker-script");
  var downloadLink = document.getElementById("picker-download");
  var copyBtn = document.getElementById("picker-copy");
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll(".picker-mode-btn"));
  var modeBlocks = Array.prototype.slice.call(document.querySelectorAll("[data-show-mode]"));

  if (!checks.length || !countEl || !generateBtn) return;

  var titles = Array.prototype.slice.call(document.querySelectorAll("[data-title-mac]"));
  var currentUrl = null;
  var mode = "modern";

  // Which data attribute holds each mode's package id.
  var PACKAGE = { modern: "winget", legacy: "choco", mac: "brew" };

  // Small tags next to an app: the pinned version in Windows 7 mode, or the
  // Mac substitute's name (e.g. KeePass -> KeePassXC) in macOS mode.
  function addTag(c, label, tagMode) {
    if (!label) return;
    var tag = document.createElement("span");
    tag.className = "pick-version mono";
    tag.textContent = label;
    tag.dataset.tagMode = tagMode;
    tag.hidden = true;
    c.parentNode.appendChild(tag);
  }
  checks.forEach(function (c) {
    if (c.dataset.choco) addTag(c, c.dataset.chocoLabel || c.dataset.chocoVersion, "legacy");
    if (c.dataset.brew) addTag(c, c.dataset.brewLabel, "mac");
  });

  titles.forEach(function (t) {
    t.dataset.titleDefault = t.textContent;
  });

  function available(c) {
    return !!c.dataset[PACKAGE[mode]];
  }

  function selected() {
    return checks.filter(function (c) {
      return c.checked && available(c);
    });
  }

  function updateCount() {
    var n = selected().length;
    var template = n === 1 ? countEl.dataset.singular : countEl.dataset.plural;
    countEl.textContent = template.replace("{n}", n);
    generateBtn.disabled = n === 0;
    if (n === 0) {
      output.hidden = true;
    }
  }

  function setMode(next) {
    mode = next;
    modeButtons.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    });
    modeBlocks.forEach(function (el) {
      el.hidden = el.dataset.showMode !== mode;
    });
    checks.forEach(function (c) {
      var row = c.parentNode;
      var ok = available(c);
      c.disabled = !ok;
      row.classList.toggle("pick-unavailable", !ok);
      var only = row.dataset.onlyMode;
      row.classList.toggle("mode-hidden", !!only && only !== mode);
      Array.prototype.forEach.call(row.querySelectorAll(".pick-version"), function (tag) {
        tag.hidden = tag.dataset.tagMode !== mode;
      });
    });
    titles.forEach(function (t) {
      t.textContent = mode === "mac" ? t.dataset.titleMac : t.dataset.titleDefault;
    });
    var file = { modern: "fileModern", legacy: "fileLegacy", mac: "fileMac" }[mode];
    downloadLink.setAttribute("download", downloadLink.dataset[file]);
    output.hidden = true;
    updateCount();

    // Re-run any active search so Mac-only rows appear or drop out of it.
    var search = document.getElementById("software-search");
    if (search) search.dispatchEvent(new Event("input"));
  }

  function buildWingetScript(picks) {
    var lines = ["@echo off", "echo Installing your picks with winget...", "echo."];
    picks.forEach(function (c) {
      lines.push("echo -- " + c.dataset.name);
      lines.push(
        "winget install --id " +
          c.dataset.winget +
          (c.dataset.source ? " -s " + c.dataset.source : "") +
          " -e --silent --accept-package-agreements --accept-source-agreements"
      );
      lines.push("echo.");
    });
    lines.push("echo Done. Press any key to close.");
    lines.push("pause >nul");
    return lines.join("\r\n");
  }

  // Windows 7/8.1: check the prerequisites (PowerShell 3+ for TLS 1.2,
  // .NET 4.8 for Chocolatey 2.x), bootstrap Chocolatey, then install
  // each pick pinned so a later "choco upgrade all" can't break it.
  function buildChocoScript(picks) {
    var ps = "\"%PS%\" -NoProfile -ExecutionPolicy Bypass -Command ";
    var lines = [
      "@echo off",
      "setlocal",
      "echo Installing your picks for Windows 7 / 8.1 with Chocolatey...",
      "echo.",
      "net session >nul 2>&1",
      "if errorlevel 1 goto :needadmin",
      "set \"PS=%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\"",
      ps +
        "\"if ($PSVersionTable.PSVersion.Major -lt 3) { exit 2 }; " +
        "$r = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full' -ErrorAction SilentlyContinue).Release; " +
        "if ($r -lt 528040) { exit 3 }; exit 0\"",
      "if %errorlevel%==2 goto :needwmf",
      "if %errorlevel%==3 goto :needdotnet",
      "where choco >nul 2>&1",
      "if not errorlevel 1 goto :install",
      "echo -- Chocolatey",
      ps.replace("-NoProfile ", "-NoProfile -InputFormat None ") +
        "\"[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; " +
        "iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))\"",
      "set \"PATH=%PATH%;%ALLUSERSPROFILE%\\chocolatey\\bin\"",
      "choco -v >nul 2>&1",
      "if errorlevel 1 goto :chocofail",
      "echo.",
      ":install"
    ];
    picks.forEach(function (c) {
      lines.push("echo -- " + c.dataset.name);
      lines.push(
        "choco install " +
          c.dataset.choco +
          (c.dataset.chocoVersion ? " --version " + c.dataset.chocoVersion + " --pin" : "") +
          " -y --no-progress"
      );
      lines.push("echo.");
    });
    lines.push(
      "echo Done. Some apps may ask for a restart. Press any key to close.",
      "goto :end",
      ":needadmin",
      "echo Right-click this file and choose \"Run as administrator\".",
      "goto :end",
      ":needwmf",
      "echo PowerShell is too old. Install .NET Framework 4.8 and then",
      "echo Windows Management Framework 5.1, restart, and run this again.",
      "goto :end",
      ":needdotnet",
      "echo Install .NET Framework 4.8 first, restart, and run this again.",
      "goto :end",
      ":chocofail",
      "echo Chocolatey could not be installed. Check the internet connection",
      "echo and that Windows is fully updated, then run this again.",
      ":end",
      "pause >nul"
    );
    return lines.join("\r\n");
  }

  // macOS: find or install Homebrew, then install each pick as a cask.
  // Run with "bash file.sh" from Terminal, not pasted: Homebrew's installer
  // reads its prompts from the terminal and would eat the pasted lines.
  function buildBrewScript(picks) {
    var findBrew =
      "for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do\n" +
      "  [ -x \"$b\" ] && eval \"$(\"$b\" shellenv)\" && break\n" +
      "done";
    var lines = [
      "#!/bin/bash",
      "echo \"Installing your picks with Homebrew...\"",
      "echo",
      findBrew,
      "if ! command -v brew >/dev/null 2>&1; then",
      "  echo \"-- Homebrew (it will ask for your Mac password)\"",
      "  /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"",
      "  " + findBrew.replace(/\n/g, "\n  "),
      "fi",
      "if ! command -v brew >/dev/null 2>&1; then",
      "  echo \"Homebrew could not be installed. Check the internet connection\"",
      "  echo \"and that this is an administrator account, then run this again.\"",
      "  exit 1",
      "fi",
      "echo"
    ];
    picks.forEach(function (c) {
      lines.push("echo \"-- " + (c.dataset.brewLabel || c.dataset.name) + "\"");
      lines.push("brew install --cask " + c.dataset.brew);
      lines.push("echo");
    });
    lines.push("echo \"Done. Your new apps are in the Applications folder.\"");
    return lines.join("\n") + "\n";
  }

  generateBtn.addEventListener("click", function () {
    var picks = selected();
    if (!picks.length) return;

    var text =
      mode === "legacy" ? buildChocoScript(picks) :
      mode === "mac" ? buildBrewScript(picks) :
      buildWingetScript(picks);
    scriptEl.textContent = text;

    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    var blob = new Blob([text], { type: "text/plain" });
    currentUrl = URL.createObjectURL(blob);
    downloadLink.href = currentUrl;

    output.hidden = false;
    output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(scriptEl.textContent).then(function () {
        var original = copyBtn.textContent;
        copyBtn.textContent = "✓";
        setTimeout(function () {
          copyBtn.textContent = original;
        }, 1200);
      });
    });
  }

  checks.forEach(function (c) {
    c.addEventListener("change", updateCount);
  });

  modeButtons.forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.mode !== mode) setMode(b.dataset.mode);
    });
  });

  setMode(mode);
})();

// Search filter (software/ + pt/software/).
// Everything is visible on the page by default (no tabs, no hidden
// sections) — this just narrows the always-visible list as you type.
(function () {
  "use strict";

  var searchInput = document.getElementById("software-search");
  var noResults = document.getElementById("no-results");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".category-card"));

  if (!searchInput || !cards.length) return;

  searchInput.addEventListener("input", function () {
    var query = searchInput.value.trim().toLowerCase();
    var anyMatch = false;

    cards.forEach(function (card) {
      var rows = Array.prototype.slice.call(card.querySelectorAll(".app-row"));
      var cardHasMatch = false;
      rows.forEach(function (row) {
        var match =
          !row.classList.contains("mode-hidden") &&
          (!query || row.textContent.toLowerCase().indexOf(query) !== -1);
        row.hidden = !match;
        if (match) cardHasMatch = true;
      });
      card.hidden = !cardHasMatch;
      if (cardHasMatch) anyMatch = true;
    });

    if (noResults) noResults.hidden = !query || anyMatch;
  });
})();
