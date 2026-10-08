// Homepage forms: the "New Message" window and "Book a Visit".
// Nothing is sent from the site itself: the form writes a tidy message and
// opens the visitor's email app or WhatsApp with it filled in, so there is
// no server, account or third-party form service involved.
(function () {
  "use strict";

  var isPT = (document.documentElement.lang || "").toLowerCase().indexOf("pt") === 0;
  var locale = isPT ? "pt-PT" : "en-GB";
  var T = isPT
    ? {
        help: "Pedido de ajuda", booking: "Pedido de marcação",
        bookIntro: "Olá! Gostava de marcar uma visita.",
        day: "Dia", time: "Hora", type: "Tipo", area: "Zona", problem: "Problema", name: "Nome",
        openingMail: "A abrir o seu email…", openingWa: "A abrir o WhatsApp…"
      }
    : {
        help: "Help request", booking: "Booking request",
        bookIntro: "Hi! I'd like to book a visit.",
        day: "Day", time: "Time", type: "Type", area: "Area", problem: "Problem", name: "Name",
        openingMail: "Opening your email app…", openingWa: "Opening WhatsApp…"
      };

  // Opening hours (Lisbon time): weekdays 18:00-22:00, weekends 10:00-20:00.
  // Start times leave at least an hour before closing.
  function slotsFor(date) {
    var day = date.getDay();
    var weekend = day === 0 || day === 6;
    var from = weekend ? 10 : 18;
    var to = weekend ? 19 : 21;
    var out = [];
    for (var h = from; h <= to; h++) out.push((h < 10 ? "0" : "") + h + ":00");
    return out;
  }

  function waUrl(number, text) {
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
  }

  function mailUrl(email, subject, body) {
    return "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function status(form, text) {
    var s = form.querySelector(".form-status");
    if (!s) {
      s = document.createElement("p");
      s.className = "form-status";
      s.setAttribute("role", "status");
      (form.querySelector(".form-actions") || form).insertAdjacentElement("afterend", s);
    }
    s.textContent = text;
  }

  function send(form, via, subject, text) {
    if (via === "whatsapp") {
      status(form, T.openingWa);
      window.open(waUrl(form.getAttribute("data-wa"), text), "_blank", "noopener");
    } else {
      status(form, T.openingMail);
      window.location.href = mailUrl(form.getAttribute("data-email"), subject, text);
    }
  }

  // Remember which button submitted the form (Enter counts as the default)
  var lastVia = null;
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-via]");
    if (b) lastVia = b.getAttribute("data-via");
  }, true);

  // ---------------------------------------------------------------------
  // New Message
  // ---------------------------------------------------------------------
  document.querySelectorAll(".mail-form").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var via = (e.submitter && e.submitter.getAttribute("data-via")) || lastVia || "email";
      var name = form.elements.name.value.trim();
      var subject = form.elements.subject.value.trim();
      var body = form.elements.body.value.trim();
      var text = body + (name ? "\n\n— " + name : "");
      if (via === "whatsapp" && subject) text = subject + "\n\n" + text;
      send(form, via, subject || T.help, text);
    });
  });

  // ---------------------------------------------------------------------
  // Book a Visit
  // ---------------------------------------------------------------------
  function iso(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  document.querySelectorAll(".book-form").forEach(function (form) {
    var dayInput = form.elements.day;
    var timeSelect = form.elements.time;
    var today = new Date();
    var max = new Date();
    max.setDate(max.getDate() + 60);
    dayInput.min = iso(today);
    dayInput.max = iso(max);

    function fillSlots() {
      if (!dayInput.value) return;
      var parts = dayInput.value.split("-");
      var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      var keep = timeSelect.value;
      var slots = slotsFor(d);
      // Today: only times still ahead
      if (iso(d) === iso(new Date())) {
        var nowH = new Date().getHours();
        slots = slots.filter(function (s) { return parseInt(s, 10) > nowH; });
      }
      timeSelect.innerHTML = "";
      slots.forEach(function (s) {
        var o = document.createElement("option");
        o.textContent = s;
        timeSelect.appendChild(o);
      });
      if (slots.indexOf(keep) !== -1) timeSelect.value = keep;
      timeSelect.disabled = !slots.length;
    }

    dayInput.addEventListener("change", fillSlots);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var via = (e.submitter && e.submitter.getAttribute("data-via")) || lastVia || "whatsapp";
      var parts = dayInput.value.split("-");
      var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      var dayText = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
      var f = form.elements;
      var lines = [
        T.bookIntro,
        "",
        T.day + ": " + dayText,
        T.time + ": " + f.time.value,
        T.type + ": " + f.type.value,
        T.area + ": " + f.area.value,
        T.problem + ": " + f.problem.value.trim(),
        T.name + ": " + f.name.value.trim()
      ];
      send(form, via, T.booking + " – " + dayText + " " + f.time.value, lines.join("\n"));
    });
  });
})();
