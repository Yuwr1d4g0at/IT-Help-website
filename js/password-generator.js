// Strong password generator (tools/password-generator/ + pt equivalent).
// Everything happens in the browser with the Web Crypto RNG when it's
// available (falling back to Math.random otherwise): nothing is sent
// anywhere, and the password never leaves the page until it's copied.
// UI strings are set per-language as window.PWGEN_DATA before this file
// loads, same pattern as js/wizard.js.
(function () {
  "use strict";

  var data = window.PWGEN_DATA;
  var lengthInput = document.getElementById("pwgen-length");
  var lowerCheck = document.getElementById("pwgen-lower");
  var upperCheck = document.getElementById("pwgen-upper");
  var numberCheck = document.getElementById("pwgen-numbers");
  var symbolCheck = document.getElementById("pwgen-symbols");
  var output = document.getElementById("pwgen-output");
  var generateBtn = document.getElementById("pwgen-generate");
  var copyBtn = document.getElementById("pwgen-copy");
  var statusEl = document.getElementById("pwgen-status");
  if (!data || !lengthInput || !output || !generateBtn) return;

  var ui = data.ui;

  var CHARSETS = {
    lower: "abcdefghijklmnopqrstuvwxyz",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.<>?"
  };

  function randomIndex(max) {
    if (window.crypto && window.crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return arr[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function generate() {
    var pool = "";
    if (lowerCheck.checked) pool += CHARSETS.lower;
    if (upperCheck.checked) pool += CHARSETS.upper;
    if (numberCheck.checked) pool += CHARSETS.numbers;
    if (symbolCheck.checked) pool += CHARSETS.symbols;

    if (!pool) {
      output.value = "";
      statusEl.textContent = ui.noCharsets;
      return;
    }

    var length = Math.max(4, Math.min(64, parseInt(lengthInput.value, 10) || 16));
    var chars = [];
    for (var i = 0; i < length; i++) {
      chars.push(pool.charAt(randomIndex(pool.length)));
    }
    output.value = chars.join("");
    showStrength(length, pool.length);
  }

  function showStrength(length, poolSize) {
    var entropy = Math.round(length * Math.log2(poolSize));
    var label;
    if (entropy < 40) label = ui.strengthWeak;
    else if (entropy < 70) label = ui.strengthOkay;
    else label = ui.strengthStrong;
    statusEl.textContent = ui.strengthTemplate
      .replace("{bits}", String(entropy))
      .replace("{label}", label);
  }

  function copy() {
    if (!output.value) return;

    function done(ok) {
      statusEl.textContent = ok ? ui.copied : ui.copyFailed;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(output.value).then(
        function () { done(true); },
        function () { done(false); }
      );
    } else {
      output.select();
      try {
        done(document.execCommand("copy"));
      } catch (e) {
        done(false);
      }
    }
  }

  generateBtn.addEventListener("click", generate);
  copyBtn.addEventListener("click", copy);
  [lengthInput, lowerCheck, upperCheck, numberCheck, symbolCheck].forEach(function (el) {
    el.addEventListener("change", generate);
  });

  generate();
})();
