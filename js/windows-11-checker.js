// "Is My PC Ready for Windows 11?" checker (tools/windows-11-checker/ + pt
// equivalent). A browser can't read the PC's hardware, so this is a guided
// checklist: the page lists the five requirements as radio groups (Yes /
// No / Not sure), each with a "How do I check?" hint, and this script
// turns the answers into a plain-language result that updates live.
// Nothing is sent anywhere. Result strings are set per-language as
// window.W11_DATA before this file loads, same pattern as js/wizard.js.
(function () {
  "use strict";

  var data = window.W11_DATA;
  var form = document.getElementById("w11-form");
  var resultEl = document.getElementById("w11-result");
  if (!data || !form || !resultEl) return;

  var ui = data.ui;
  var REQS = ["cpu", "tpm", "boot", "ram", "storage"];
  var lastSignature = null;

  function esc(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function readAnswers() {
    var answers = {};
    REQS.forEach(function (req) {
      var checked = form.querySelector('input[name="w11-' + req + '"]:checked');
      answers[req] = checked ? checked.value : null;
    });
    return answers;
  }

  // Decide which result to show, in order:
  //  1. Processor is a "No": not officially supported. Nothing else can
  //     change that, so it wins over everything.
  //  2. Any other "No" (TPM / Secure Boot / RAM / storage): probably
  //     fixable. Firmware settings and cheap upgrades get their own
  //     paragraph each, so a mix of both is explained properly.
  //  3. Anything still unanswered: prompt to finish.
  //  4. Any "Not sure": point to the hints / PC Health Check.
  //  5. All "Yes": ready.
  // Returns { key, badge, paragraphs: [keys], links: [keys] } so the
  // strings can stay in W11_DATA.
  function decide(answers) {
    var no = {}, unsure = 0, unanswered = 0;
    REQS.forEach(function (req) {
      if (answers[req] === "no") no[req] = true;
      else if (answers[req] === "unsure") unsure++;
      else if (answers[req] !== "yes") unanswered++;
    });

    if (no.cpu) {
      return { key: "notSupported", badge: "replace", paragraphs: ["cpuBody"], links: ["win10", "repairOrReplace"] };
    }

    var firmware = no.tpm || no.boot;
    var hardware = no.ram || no.storage;
    if (firmware || hardware) {
      var paragraphs = [];
      if (firmware) paragraphs.push("firmwareBody");
      if (hardware) paragraphs.push("hardwareBody");
      if (unsure || unanswered) paragraphs.push("alsoCheckBody");
      return {
        key: firmware && hardware ? "fixableBoth" : firmware ? "fixableFirmware" : "fixableHardware",
        badge: "fixable",
        paragraphs: paragraphs,
        links: ["upgradeGuide"]
      };
    }

    if (unanswered) {
      return { key: "pending", badge: null, paragraphs: ["pendingBody"], links: [] };
    }

    if (unsure) {
      return { key: "unsure", badge: "unsure", paragraphs: ["unsureBody"], links: ["upgradeGuide"] };
    }

    return { key: "ready", badge: "repair", paragraphs: ["readyBody"], links: ["backup", "upgradeGuide"] };
  }

  function render() {
    var result = decide(readAnswers());
    var signature = result.key + "|" + result.paragraphs.join(",");
    // Only touch the live region when the result actually changes, so
    // screen readers aren't re-read the same text on every click.
    if (signature === lastSignature) return;
    lastSignature = signature;

    var copy = ui.results[result.key];
    var html = '<div class="wizard-eyebrow">' + esc(ui.eyebrow) + "</div>";
    if (result.badge) {
      html += '<span class="calc-badge ' + (result.badge === "repair" || result.badge === "replace"
        ? "calc-badge-" + result.badge
        : "w11-badge-" + result.badge) + '">' + esc(ui.badgeLabels[result.badge]) + "</span>";
    }
    html += '<h2 class="wizard-result-title">' + esc(copy.title) + "</h2>";
    result.paragraphs.forEach(function (p) {
      html += '<p class="wizard-result-body">' + esc(ui.paragraphs[p]) + "</p>";
    });
    result.links.forEach(function (l) {
      var link = ui.links[l];
      html += '<a href="' + link.href + '" class="wizard-result-link">' + esc(link.text) + " &rarr;</a>";
    });
    html +=
      '<div class="wizard-actions">' +
      '<a href="' + ui.contactHref + '" class="btn btn-primary btn-sm">' + esc(ui.contactCta) + "</a>" +
      (result.key === "pending"
        ? ""
        : '<button type="button" class="wizard-restart" id="w11-restart">' + esc(ui.startOver) + "</button>") +
      "</div>";

    resultEl.innerHTML = html;

    var restart = document.getElementById("w11-restart");
    if (restart) restart.addEventListener("click", reset);
  }

  function reset() {
    Array.prototype.slice.call(form.querySelectorAll('input[type="radio"]')).forEach(function (input) {
      input.checked = false;
    });
    Array.prototype.slice.call(form.querySelectorAll("details")).forEach(function (d) {
      d.open = false;
    });
    render();
    var first = form.querySelector('input[type="radio"]');
    if (first) first.focus();
  }

  form.addEventListener("change", render);
  form.addEventListener("submit", function (e) { e.preventDefault(); });

  render();
})();
