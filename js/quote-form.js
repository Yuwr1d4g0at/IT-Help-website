// "Describe your problem" quote form (/quote/ and /pt/quote/).
//
// GitHub Pages can't run server code, so the form posts to Web3Forms
// (https://web3forms.com), which emails the request to Yuwri.
//
// =====================================================================
//  CONFIG: paste the Web3Forms access key between the quotes below.
//  While it still says YOUR_WEB3FORMS_ACCESS_KEY the form sends nothing
//  anywhere and offers WhatsApp, email and phone instead.
// =====================================================================
var WEB3FORMS_ACCESS_KEY = "YOUR_WEB3FORMS_ACCESS_KEY";

(function () {
  "use strict";

  var ENDPOINT = "https://api.web3forms.com/submit";
  var PLACEHOLDER = "YOUR_WEB3FORMS_ACCESS_KEY";

  var form = document.querySelector(".quote-form");
  if (!form) return;

  var isPT = (document.documentElement.lang || "").toLowerCase().indexOf("pt") === 0;
  var T = isPT
    ? {
        sending: "A enviar…",
        needName: "Escreva o seu nome.",
        needContact: "Deixe um email ou um número de telefone, para eu lhe poder responder.",
        badEmail: "Este email não parece estar completo.",
        badPhone: "Este número de telefone não parece estar completo.",
        needArea: "Escolha a sua zona.",
        needDevice: "Escolha o tipo de equipamento.",
        needMessage: "Descreva o problema em pelo menos uma frase.",
        needPreferredEmail: "Escolheu ser contactado por email: deixe também o seu email.",
        needPreferredPhone: "Escolheu ser contactado por telefone ou WhatsApp: deixe também o seu número.",
        needConsent: "Para enviar, marque a caixa de consentimento.",
        ok: "Obrigado! O seu pedido foi enviado. Respondo normalmente no mesmo dia.",
        fail: "Não foi possível enviar o pedido. Pode tentar outra vez, ou falar comigo diretamente:",
        offline: "O formulário ainda não está ligado, por isso nada foi enviado. Pode mandar-me o mesmo pedido por aqui:",
        viaWa: "WhatsApp",
        viaMail: "Email",
        viaCall: "Ligar",
        subject: "Pedido de orçamento",
        fields: { name: "Nome", email: "Email", phone: "Telefone", area: "Zona", device: "Equipamento", preferred: "Contacto preferido", message: "Problema" }
      }
    : {
        sending: "Sending…",
        needName: "Please enter your name.",
        needContact: "Please leave an email or a phone number so I can reply.",
        badEmail: "That email address doesn't look complete.",
        badPhone: "That phone number doesn't look complete.",
        needArea: "Please choose your area.",
        needDevice: "Please choose the type of device.",
        needMessage: "Please describe the problem in at least a sentence.",
        needPreferredEmail: "You chose to be contacted by email: please add your email address too.",
        needPreferredPhone: "You chose to be contacted by phone or WhatsApp: please add your number too.",
        needConsent: "Please tick the consent box to send your request.",
        ok: "Thank you! Your request has been sent. I usually reply the same day.",
        fail: "Your request couldn't be sent. You can try again, or reach me directly:",
        offline: "The form isn't connected yet, so nothing was sent. You can send me the same request here instead:",
        viaWa: "WhatsApp",
        viaMail: "Email",
        viaCall: "Call",
        subject: "Quote request",
        fields: { name: "Name", email: "Email", phone: "Phone", area: "Area", device: "Device", preferred: "Preferred contact", message: "Problem" }
      };

  var f = form.elements;
  var button = form.querySelector('button[type="submit"]');
  var buttonText = button.textContent;
  var statusEl = form.querySelector(".form-status");
  var configured = WEB3FORMS_ACCESS_KEY && WEB3FORMS_ACCESS_KEY !== PLACEHOLDER;

  // Without JavaScript the button stays disabled (see the <noscript> note),
  // so nothing can be submitted as a plain GET with personal data in the URL.
  button.disabled = false;

  function value(name) {
    return (f[name] && f[name].value ? f[name].value : "").trim();
  }

  function setStatus(text, kind, links) {
    statusEl.className = "form-status" + (kind ? " is-" + kind : "");
    statusEl.textContent = text;
    if (links && links.length) {
      links.forEach(function (l, i) {
        statusEl.appendChild(document.createTextNode(i ? " · " : " "));
        var a = document.createElement("a");
        a.href = l.href;
        a.textContent = l.label;
        if (l.blank) {
          a.target = "_blank";
          a.rel = "noopener";
        }
        statusEl.appendChild(a);
      });
    }
  }

  function clearInvalid() {
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
  }

  function fail(field, message) {
    var el = f[field];
    if (el) {
      el.setAttribute("aria-invalid", "true");
      el.focus();
    }
    setStatus(message, "error");
    return false;
  }

  function validate() {
    clearInvalid();
    var email = value("email");
    var phone = value("phone");
    var preferred = value("preferred_contact");
    if (!value("name")) return fail("name", T.needName);
    if (!email && !phone) return fail("email", T.needContact);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("email", T.badEmail);
    if (phone && phone.replace(/\D/g, "").length < 9) return fail("phone", T.badPhone);
    if (!value("area")) return fail("area", T.needArea);
    if (!value("device")) return fail("device", T.needDevice);
    if (value("message").length < 10) return fail("message", T.needMessage);
    if (preferred === "email" && !email) return fail("email", T.needPreferredEmail);
    if ((preferred === "phone" || preferred === "whatsapp") && !phone) return fail("phone", T.needPreferredPhone);
    if (!f.consent.checked) return fail("consent", T.needConsent);
    return true;
  }

  function optionText(name) {
    var el = f[name];
    if (!el || el.selectedIndex < 0) return "";
    return el.options[el.selectedIndex].text;
  }

  function summary() {
    var F = T.fields;
    return [
      F.name + ": " + value("name"),
      F.email + ": " + value("email"),
      F.phone + ": " + value("phone"),
      F.area + ": " + optionText("area"),
      F.device + ": " + optionText("device"),
      F.preferred + ": " + optionText("preferred_contact"),
      "",
      F.message + ":",
      value("message")
    ].join("\n");
  }

  // Direct contact links, with the request already written in where possible
  function fallbackLinks() {
    var text = T.subject + "\n\n" + summary();
    var wa = form.getAttribute("data-wa");
    var mail = form.getAttribute("data-email");
    var tel = form.getAttribute("data-tel");
    return [
      { label: T.viaWa, href: "https://wa.me/" + wa + "?text=" + encodeURIComponent(text), blank: true },
      { label: T.viaMail, href: "mailto:" + mail + "?subject=" + encodeURIComponent(T.subject) + "&body=" + encodeURIComponent(summary()) },
      { label: T.viaCall, href: "tel:" + tel }
    ];
  }

  function track(name) {
    var ui = window.YuwriUI;
    if (ui && ui.track) ui.track(name);
  }

  function busy(on) {
    button.disabled = on;
    button.textContent = on ? T.sending : buttonText;
    form.setAttribute("aria-busy", on ? "true" : "false");
  }

  form.addEventListener("input", function (e) {
    if (e.target.getAttribute("aria-invalid") === "true") e.target.removeAttribute("aria-invalid");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (button.disabled) return;
    if (!validate()) return;

    // Honeypot: people never see this box, bots tend to fill it in.
    if (f.botcheck && f.botcheck.checked) {
      setStatus(T.ok, "ok");
      form.reset();
      return;
    }

    if (!configured) {
      setStatus(T.offline, "", fallbackLinks());
      return;
    }

    var payload = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: T.subject + ": " + optionText("device") + " (" + optionText("area") + ")",
      from_name: "yuwri.pt",
      name: value("name"),
      email: value("email"),
      phone: value("phone"),
      area: optionText("area"),
      device: optionText("device"),
      preferred_contact: optionText("preferred_contact"),
      message: value("message"),
      consent: "yes",
      language: isPT ? "pt-PT" : "en",
      botcheck: false
    };

    busy(true);
    setStatus(T.sending, "");
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        }, function () {
          return { ok: false, data: null };
        });
      })
      .then(function (r) {
        busy(false);
        if (r.ok && r.data && r.data.success) {
          form.reset();
          setStatus(T.ok, "ok");
          track("quote-sent");
        } else {
          setStatus(T.fail, "error", fallbackLinks());
          track("quote-failed");
        }
      })
      .catch(function () {
        busy(false);
        setStatus(T.fail, "error", fallbackLinks());
        track("quote-failed");
      });
  });
})();
