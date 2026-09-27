// Repair-or-replace cost calculator (repair-or-replace/ + pt/repair-or-replace/).
// A numeric companion to the question-tree wizard on the same page: once
// you actually have an age and two prices, this runs a straightforward
// rule of thumb instead of a qualitative guess. Content (the messages +
// UI strings) is set per-language as window.CALC_DATA before this file
// loads, same pattern as js/wizard.js.
(function () {
  "use strict";

  var data = window.CALC_DATA;
  var root = document.getElementById("calc-root");
  if (!data || !root) return;

  var ui = data.ui;

  function esc(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatEuro(n) {
    return "€" + Math.round(n).toLocaleString(ui.locale || "en-US");
  }

  function fillTemplate(str, vars) {
    return str.replace(/\{(\w+)\}/g, function (match, key) {
      return key in vars ? String(vars[key]) : match;
    });
  }

  // Rule of thumb, in order:
  //  1. The repair alone costs at least half of buying new: replace,
  //     regardless of age.
  //  2. Six years or older and the repair is already a third of a new
  //     one: replace (it likely won't be the last thing to fail).
  //  3. Six years or older but the repair is cheap: repair, it's still
  //     the better deal even on an older machine.
  //  4. Younger than six years and under that 50% line: repair.
  function decide(age, repairCost, replacementCost) {
    var ratio = repairCost / replacementCost;
    var vars = {
      age: age,
      percent: Math.round(ratio * 100),
      repairCost: formatEuro(repairCost),
      replacementCost: formatEuro(replacementCost)
    };

    var key;
    if (ratio >= 0.5) key = "replaceCostly";
    else if (age >= 6 && ratio >= 0.3) key = "replaceOldAndCostly";
    else if (age >= 6) key = "repairOldButCheap";
    else key = "repairAffordable";

    var result = ui.results[key];
    return {
      type: result.type,
      title: fillTemplate(result.title, vars),
      body: fillTemplate(result.body, vars)
    };
  }

  function calcField(id, label, placeholder) {
    return (
      '<div class="calc-field">' +
      '<label for="' + id + '">' + esc(label) + "</label>" +
      '<input type="number" min="0" step="any" inputmode="decimal" id="' +
      id +
      '" placeholder="' +
      esc(placeholder) +
      '">' +
      "</div>"
    );
  }

  function renderForm() {
    root.innerHTML =
      '<div class="wizard-eyebrow">' + esc(ui.eyebrow) + "</div>" +
      '<h2 class="wizard-question">' + esc(ui.heading) + "</h2>" +
      '<div class="calc-fields">' +
      calcField("calc-age", ui.ageLabel, ui.agePlaceholder) +
      calcField("calc-repair", ui.repairLabel, ui.repairPlaceholder) +
      calcField("calc-replacement", ui.replacementLabel, ui.replacementPlaceholder) +
      "</div>" +
      '<p class="calc-error" id="calc-error" hidden></p>' +
      '<button type="button" class="btn btn-primary btn-sm" id="calc-submit">' +
      esc(ui.calculateCta) +
      "</button>";

    document.getElementById("calc-submit").addEventListener("click", handleSubmit);
    ["calc-age", "calc-repair", "calc-replacement"].forEach(function (id) {
      document.getElementById(id).addEventListener("keydown", function (e) {
        if (e.key === "Enter") handleSubmit();
      });
    });
  }

  function handleSubmit() {
    var age = parseFloat(document.getElementById("calc-age").value);
    var repairCost = parseFloat(document.getElementById("calc-repair").value);
    var replacementCost = parseFloat(document.getElementById("calc-replacement").value);
    var errorEl = document.getElementById("calc-error");

    if (
      isNaN(age) ||
      isNaN(repairCost) ||
      isNaN(replacementCost) ||
      age < 0 ||
      repairCost <= 0 ||
      replacementCost <= 0
    ) {
      errorEl.textContent = ui.validationError;
      errorEl.hidden = false;
      return;
    }

    errorEl.hidden = true;
    renderResult(decide(age, repairCost, replacementCost));
  }

  function renderResult(result) {
    root.innerHTML =
      '<span class="calc-badge calc-badge-' +
      esc(result.type) +
      '">' +
      esc(ui.badgeLabels[result.type]) +
      "</span>" +
      '<h3 class="wizard-result-title">' + esc(result.title) + "</h3>" +
      '<p class="wizard-result-body">' + esc(result.body) + "</p>" +
      '<div class="wizard-actions">' +
      '<a href="' + ui.contactHref + '" class="btn btn-primary btn-sm">' + esc(ui.contactCta) + "</a>" +
      '<button type="button" class="wizard-restart" id="calc-restart">' + esc(ui.recalculateCta) + "</button>" +
      "</div>";

    document.getElementById("calc-restart").addEventListener("click", renderForm);
  }

  renderForm();
})();
