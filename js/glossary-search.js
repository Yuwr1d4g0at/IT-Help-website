// Search filter (glossary/ + pt/glossary/).
// Everything is visible on the page by default — this just narrows the
// always-visible list of terms as you type.
(function () {
  "use strict";

  // Lowercase and drop accents so "virus" finds "vírus".
  function fold(str) {
    return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  var searchInput = document.getElementById("glossary-search");
  var noResults = document.getElementById("no-results");
  var terms = Array.prototype.slice.call(document.querySelectorAll(".glossary-term"));

  if (!searchInput || !terms.length) return;

  searchInput.addEventListener("input", function () {
    var query = fold(searchInput.value.trim());
    var anyMatch = false;

    terms.forEach(function (term) {
      var match = !query || fold(term.textContent).indexOf(query) !== -1;
      term.hidden = !match;
      if (match) anyMatch = true;
    });

    if (noResults) noResults.hidden = !query || anyMatch;
  });
})();
