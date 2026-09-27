// File size converter (tools/file-size-converter/ + pt equivalent).
// Enter an amount and a unit, pick decimal (1000-based, what a hard
// drive box uses) or binary (1024-based, what Windows actually shows),
// and see the equivalent in every other unit. Everything recalculates
// live; there's no submit button. Purely client-side, nothing sent
// anywhere.
(function () {
  "use strict";

  var valueInput = document.getElementById("fsc-value");
  var unitSelect = document.getElementById("fsc-unit");
  var standardSelect = document.getElementById("fsc-standard");
  var resultsBody = document.getElementById("fsc-results");
  if (!valueInput || !unitSelect || !standardSelect || !resultsBody) return;

  var UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

  function formatNumber(n) {
    if (!isFinite(n)) return "—";
    var abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return n.toExponential(4);
    var maxDecimals = abs < 1 ? 6 : abs < 1000 ? 4 : 2;
    return n.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
  }

  function render() {
    var value = parseFloat(valueInput.value);
    var base = standardSelect.value === "binary" ? 1024 : 1000;
    var fromPower = UNITS.indexOf(unitSelect.value);

    if (isNaN(value) || fromPower === -1) {
      resultsBody.innerHTML = "";
      return;
    }

    var bytes = value * Math.pow(base, fromPower);

    resultsBody.innerHTML = UNITS.map(function (unit, power) {
      var amount = bytes / Math.pow(base, power);
      var rowClass = power === fromPower ? ' class="tool-row-current"' : "";
      var label = base === 1024 && power > 0 ? unit.charAt(0) + "iB" : unit;
      return "<tr" + rowClass + "><td>" + label + "</td><td>" + formatNumber(amount) + "</td></tr>";
    }).join("");
  }

  valueInput.addEventListener("input", render);
  unitSelect.addEventListener("change", render);
  standardSelect.addEventListener("change", render);

  render();
})();
