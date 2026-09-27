// Site-wide search (search/ + pt/search/).
// Fetches a static JSON index (search-index.json / pt/search-index.json,
// hand-maintained alongside the pages they describe) and scores/filters it
// client-side as you type. No server, no build step — content (the index
// URL + UI strings) is set per-language as window.SEARCH_DATA before this
// file loads, same pattern as js/wizard.js.
(function () {
  "use strict";

  var data = window.SEARCH_DATA;
  var input = document.getElementById("search-input");
  var resultsEl = document.getElementById("search-results");
  var statusEl = document.getElementById("search-status");
  var noResultsEl = document.getElementById("search-no-results");
  if (!data || !input || !resultsEl) return;

  var entries = [];
  var ready = false;

  function esc(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Very small relevance score: exact title match beats a title hit,
  // which beats a keywords hit, which beats an excerpt hit. Good enough
  // for a few dozen entries with no build step or library involved.
  function scoreEntry(entry, terms) {
    var title = entry.title.toLowerCase();
    var keywords = (entry.keywords || "").toLowerCase();
    var excerpt = (entry.excerpt || "").toLowerCase();
    var total = 0;

    terms.forEach(function (term) {
      if (!term) return;
      if (title === term) total += 6;
      else if (title.indexOf(term) !== -1) total += 3;
      if (keywords.indexOf(term) !== -1) total += 2;
      if (excerpt.indexOf(term) !== -1) total += 1;
    });

    return total;
  }

  function renderResults(query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    if (!terms.length) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      if (noResultsEl) noResultsEl.hidden = true;
      if (statusEl) statusEl.textContent = ready ? data.ui.prompt : "";
      return;
    }

    if (!ready) {
      if (statusEl) statusEl.textContent = data.ui.loading;
      return;
    }

    var scored = entries
      .map(function (entry) {
        return { entry: entry, score: scoreEntry(entry, terms) };
      })
      .filter(function (s) {
        return s.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    if (!scored.length) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      if (noResultsEl) noResultsEl.hidden = false;
      if (statusEl) statusEl.textContent = "";
      return;
    }

    if (noResultsEl) noResultsEl.hidden = true;
    if (statusEl) {
      statusEl.textContent = data.ui.countTemplate.replace(
        "{n}",
        String(scored.length)
      );
    }

    resultsEl.hidden = false;
    resultsEl.innerHTML = scored
      .map(function (s) {
        var entry = s.entry;
        return (
          '<a href="' +
          esc(entry.url) +
          '" class="blog-card search-result-card">' +
          '<div class="blog-card-eyebrow">' +
          esc(entry.category) +
          "</div>" +
          "<h3>" +
          esc(entry.title) +
          "</h3>" +
          "<p>" +
          esc(entry.excerpt) +
          "</p>" +
          "</a>"
        );
      })
      .join("");
  }

  function syncUrl(query) {
    if (!window.history || !window.history.replaceState) return;
    var params = new URLSearchParams(window.location.search);
    if (query) params.set("q", query);
    else params.delete("q");
    var qs = params.toString();
    var newUrl = window.location.pathname + (qs ? "?" + qs : "");
    window.history.replaceState(null, "", newUrl);
  }

  input.addEventListener("input", function () {
    renderResults(input.value);
    syncUrl(input.value);
  });

  fetch(data.indexUrl)
    .then(function (res) {
      if (!res.ok) throw new Error("Search index request failed");
      return res.json();
    })
    .then(function (json) {
      entries = (json && json.entries) || [];
      ready = true;

      var params = new URLSearchParams(window.location.search);
      var initial = params.get("q");
      if (initial) input.value = initial;

      renderResults(input.value);
    })
    .catch(function () {
      if (statusEl) statusEl.textContent = data.ui.loadError;
    });
})();
