// Shared question-tree wizard engine, used by troubleshoot/, repair-or-replace/,
// and their pt/ mirrors. Content (the tree + UI strings) is defined
// per-language in an inline <script> on each page as `window.WIZARD_DATA`,
// before this file loads — this file is just the renderer/state machine.
(function () {
  "use strict";

  var data = window.WIZARD_DATA;
  var root = document.getElementById("wizard-root");
  if (!data || !root) return;

  var tree = data.tree;
  var ui = data.ui;
  var history = [];
  var path = [];
  var current = "start";

  // A short plain-text summary of the chosen path and result, for the
  // "send this to me on WhatsApp" button. Built from the visitor's own clicks.
  function whatsappHref(node) {
    if (!ui.whatsappUrl) return "";
    var lines = [ui.whatsappIntro, ""];
    path.forEach(function (step) {
      lines.push("- " + step.question + " " + step.answer);
    });
    lines.push("", ui.whatsappResult + " " + node.title);
    return ui.whatsappUrl + encodeURIComponent(lines.join("\n"));
  }

  function esc(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function render(nodeId) {
    current = nodeId;
    var node = tree[nodeId];
    if (!node) return;

    if (node.options) {
      root.innerHTML =
        (history.length
          ? '<button type="button" class="wizard-back" id="wizard-back">' + esc(ui.back) + "</button>"
          : "") +
        '<div class="wizard-eyebrow">' + esc(ui.eyebrow) + "</div>" +
        '<h2 class="wizard-question">' + esc(node.question) + "</h2>" +
        '<div class="wizard-options">' +
        node.options
          .map(function (opt, i) {
            return (
              '<button type="button" class="wizard-option" data-next="' +
              esc(opt.next) +
              '">' +
              esc(opt.label) +
              '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' +
              "</button>"
            );
          })
          .join("") +
        "</div>";

      var backBtn = document.getElementById("wizard-back");
      if (backBtn) {
        backBtn.addEventListener("click", function () {
          var prev = history.pop();
          path.pop();
          render(prev);
        });
      }

      Array.prototype.slice.call(root.querySelectorAll(".wizard-option")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          history.push(current);
          path.push({ question: node.question, answer: btn.textContent });
          render(btn.dataset.next);
        });
      });
    } else {
      var linkHtml = node.link
        ? '<a href="' + node.link.href + '" class="wizard-result-link">' + esc(node.link.text) + " &rarr;</a>"
        : "";
      root.innerHTML =
        '<button type="button" class="wizard-back" id="wizard-back">' + esc(ui.back) + "</button>" +
        '<div class="wizard-eyebrow">' + esc(node.result === "cta" ? ui.ctaEyebrow : ui.tipEyebrow) + "</div>" +
        '<h2 class="wizard-result-title">' + esc(node.title) + "</h2>" +
        '<p class="wizard-result-body">' + esc(node.body) + "</p>" +
        linkHtml +
        '<div class="wizard-actions">' +
        '<a href="' + ui.contactHref + '" class="btn btn-primary btn-sm">' + esc(ui.contactCta) + "</a>" +
        (ui.whatsappUrl
          ? '<a href="' + whatsappHref(node) + '" class="btn btn-outline btn-sm" target="_blank" rel="noopener">' + esc(ui.whatsappCta) + "</a>"
          : "") +
        '<button type="button" class="wizard-restart" id="wizard-restart">' + esc(ui.startOver) + "</button>" +
        "</div>";

      document.getElementById("wizard-back").addEventListener("click", function () {
        var prev = history.pop();
        path.pop();
        render(prev);
      });
      document.getElementById("wizard-restart").addEventListener("click", function () {
        history = [];
        path = [];
        render("start");
      });
    }
  }

  render("start");
})();
