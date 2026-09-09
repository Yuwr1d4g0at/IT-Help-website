// "Build Your Own Setup" picker (software/ + pt/software/).
// Generates a plain .bat file that calls winget for each checked app.
// Nothing is downloaded or hosted here — winget just fetches straight
// from Microsoft's own public package repository.
(function () {
  "use strict";

  var checks = Array.prototype.slice.call(document.querySelectorAll(".pick-check"));
  var countEl = document.getElementById("picker-count");
  var generateBtn = document.getElementById("picker-generate");
  var output = document.getElementById("picker-output");
  var scriptEl = document.getElementById("picker-script");
  var downloadLink = document.getElementById("picker-download");
  var copyBtn = document.getElementById("picker-copy");

  if (!checks.length || !countEl || !generateBtn) return;

  var currentUrl = null;

  function selected() {
    return checks.filter(function (c) {
      return c.checked;
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

  function buildScript(picks) {
    var lines = ["@echo off", "echo Installing your picks with winget...", "echo."];
    picks.forEach(function (c) {
      lines.push("echo -- " + c.dataset.name);
      lines.push(
        "winget install --id " +
          c.dataset.winget +
          " -e --silent --accept-package-agreements --accept-source-agreements"
      );
      lines.push("echo.");
    });
    lines.push("echo Done. Press any key to close.");
    lines.push("pause >nul");
    return lines.join("\r\n");
  }

  generateBtn.addEventListener("click", function () {
    var picks = selected();
    if (!picks.length) return;

    var text = buildScript(picks);
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

  updateCount();
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
        var match = !query || row.textContent.toLowerCase().indexOf(query) !== -1;
        row.hidden = !match;
        if (match) cardHasMatch = true;
      });
      card.hidden = !cardHasMatch;
      if (cardHasMatch) anyMatch = true;
    });

    if (noResults) noResults.hidden = !query || anyMatch;
  });
})();
