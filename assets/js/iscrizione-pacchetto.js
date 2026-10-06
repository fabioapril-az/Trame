// Wizard di iscrizione a un pacchetto (iscrizione-pacchetto.html?id=ID) — un
// evento a più date collegate (vedi pacchetto.html). Sempre pagamento
// online Stripe, chiunque sia: nessun percorso "socio già riconosciuto
// senza pagamento" come in iscrizione-evento.html — lo sconto socio (se
// spetta) lo calcola il server persona per persona, qui si mostra solo un
// totale senza sconti come anteprima, stesso principio del wizard a tre
// prezzi degli eventi normali.

(function () {
  var CONSENSO_VERSIONE = "1.0"; // versione dell'informativa privacy corrente (privacy.html)

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function formattaData(isoDate) {
    if (!isoDate) return "Data da definire";
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  function formattaPrezzo(valore) {
    return Number(valore).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  var pacchettoId = new URLSearchParams(window.location.search).get("id");
  var params = new URLSearchParams(window.location.search);
  var pagamentoParam = params.get("pagamento"); // "confermato"|"annullato", solo al ritorno da Stripe

  var titoloEl = document.getElementById("pacchetto-titolo");
  var sottotitoloEl = document.getElementById("pacchetto-sottotitolo");
  var loadingEl = document.getElementById("pacchetto-loading");
  var chiusoEl = document.getElementById("pacchetto-chiuso");
  var wizardEl = document.getElementById("wizard-pagamento");
  var esitoEl = document.getElementById("esito-finale");

  if (!pacchettoId) {
    loadingEl.hidden = true;
    chiusoEl.hidden = false;
    chiusoEl.textContent = "Manca l'identificativo dell'evento nel link.";
    return;
  }

  window.trameFetch("/api/pacchetti-eventi/" + encodeURIComponent(pacchettoId))
    .then(function (pacchetto) {
      loadingEl.hidden = true;
      titoloEl.textContent = pacchetto.nome;
      var sottoEventi = pacchetto.sottoEventi || [];
      var dateTesto = sottoEventi.map(function (ev) { return formattaData(ev.dataEvento); }).join(" e ");
      sottotitoloEl.textContent = "Più date: " + dateTesto + ". Puoi partecipare a una sola o a tutte.";

      if (pacchetto.stato !== "aperto") {
        chiusoEl.hidden = false;
        chiusoEl.textContent = "Le iscrizioni a questo evento non sono attualmente aperte.";
        return;
      }

      if (pagamentoParam === "confermato") {
        esitoEl.hidden = false;
        esitoEl.innerHTML = "<h3>Pagamento confermato!</h3><p>Ti aspettiamo all'evento. Riceverai conferma via email.</p>";
        return;
      }

      if (pagamentoParam === "annullato") {
        document.getElementById("pagamento-annullato-nota").hidden = false;
      }

      inizializzaWizard(pacchetto, sottoEventi);
      wizardEl.hidden = false;
    })
    .catch(function (err) {
      loadingEl.hidden = true;
      titoloEl.textContent = "Evento non disponibile";
      chiusoEl.hidden = false;
      chiusoEl.textContent = err.message;
    });

  function inizializzaWizard(pacchetto, sottoEventi) {
    var pgCombinazione = document.getElementById("pg-combinazione");
    var pgNumeroPersone = document.getElementById("pg-numero-persone");
    var pgBlocchiPersone = document.getElementById("pg-blocchi-persone");
    var pgBlocchiAperitivo = document.getElementById("pg-blocchi-aperitivo");
    var pgTotale = document.getElementById("pg-totale");
    var pgStatus = document.getElementById("pg-status");
    var pgBtnPaga = document.getElementById("pg-btn-paga");

    document.getElementById("pg-date-info").textContent =
      "Date collegate: " + sottoEventi.map(function (ev) {
        return ev.titolo + " (" + formattaData(ev.dataEvento) + ")";
      }).join(" · ");

    function popolaSelectNumerico(select, min, max) {
      select.innerHTML = "";
      for (var n = min; n <= max; n++) {
        var option = document.createElement("option");
        option.value = n;
        option.textContent = n;
        select.appendChild(option);
      }
    }
    popolaSelectNumerico(pgNumeroPersone, 1, 6);

    // Un'opzione per sotto-evento, più "tutte le date" solo se il pacchetto
    // ha davvero uno sconto configurato — altrimenti il server la
    // rifiuterebbe (409 sconto_non_configurato) e non avrebbe senso
    // offrirla.
    sottoEventi.forEach(function (ev) {
      var opzione = document.createElement("option");
      opzione.value = String(ev.id);
      opzione.textContent = "Solo " + ev.titolo + " — " + formattaData(ev.dataEvento);
      pgCombinazione.appendChild(opzione);
    });
    if (pacchetto.scontoTutteLeDate != null) {
      var opzioneTutte = document.createElement("option");
      opzioneTutte.value = "tutte";
      opzioneTutte.textContent = "Tutte le date (sconto incluso)";
      pgCombinazione.appendChild(opzioneTutte);
    }

    function sottoEventiScelti() {
      if (pgCombinazione.value === "tutte") {
        return sottoEventi;
      }
      var id = parseInt(pgCombinazione.value, 10);
      return sottoEventi.filter(function (ev) { return ev.id === id; });
    }

    function leggiPersoneDaBlocchi(validare) {
      var blocchi = pgBlocchiPersone.querySelectorAll(".admin-panel");
      var persone = [];
      for (var i = 0; i < blocchi.length; i++) {
        var nome = blocchi[i].querySelector(".pg-persona-nome");
        var cognome = blocchi[i].querySelector(".pg-persona-cognome");
        var email = blocchi[i].querySelector(".pg-persona-email");
        var consenso = blocchi[i].querySelector(".pg-persona-consenso");
        var newsletter = blocchi[i].querySelector(".pg-persona-newsletter");
        if (validare) {
          if (!nome.reportValidity() || !cognome.reportValidity() || !email.reportValidity() || !consenso.reportValidity()) {
            return null;
          }
        }
        // Mostrata a tutti indistintamente, socio o non-socio: per chi
        // risulta già socio il backend non scrive né legge questi tre
        // campi (stesso principio già verificato sul checkout eventi).
        persone.push({
          nome: nome.value.trim(),
          cognome: cognome.value.trim(),
          email: email.value.trim(),
          consensoAccettato: consenso.checked,
          consensoVersione: CONSENSO_VERSIONE,
          consensoNewsletter: newsletter.checked
        });
      }
      if (validare) {
        var viste = {};
        for (var j = 0; j < persone.length; j++) {
          var norm = persone[j].email.toLowerCase();
          if (viste[norm]) {
            pgStatus.textContent = "L'email " + persone[j].email + " è ripetuta su più persone: ogni persona richiede un'email diversa.";
            pgStatus.hidden = false;
            return null;
          }
          viste[norm] = true;
        }
      }
      return persone;
    }

    function generaBlocchiPersone(n) {
      var precedenti = leggiPersoneDaBlocchi(false) || [];
      pgBlocchiPersone.innerHTML = "";
      for (var i = 0; i < n; i++) {
        var blocco = document.createElement("div");
        blocco.className = "admin-panel";
        blocco.style.cssText = "margin:16px 0; padding:16px; border:1px solid var(--color-line); " +
          "border-radius:10px; background:var(--color-cream-alt);";
        blocco.innerHTML =
          "<h4 style=\"margin:0 0 14px; padding-bottom:8px; font-size:1.05rem; " +
          "color:var(--color-terracotta-dark); border-bottom:1px solid var(--color-line);\">Persona " + (i + 1) + "</h4>" +
          "<div class=\"form-row\"><label>Nome</label><input type=\"text\" class=\"pg-persona-nome\" maxlength=\"100\" required></div>" +
          "<div class=\"form-row\"><label>Cognome</label><input type=\"text\" class=\"pg-persona-cognome\" maxlength=\"100\" required></div>" +
          "<div class=\"form-row\"><label>Email</label><input type=\"email\" class=\"pg-persona-email\" maxlength=\"255\" required></div>" +
          "<div class=\"form-row form-row--checkbox\"><label><input type=\"checkbox\" class=\"pg-persona-newsletter\"> " +
          "Vuole ricevere anche la nostra newsletter, con gli altri eventi e novità di TraMe?</label></div>" +
          "<div class=\"form-row form-row--checkbox\"><label><input type=\"checkbox\" class=\"pg-persona-consenso\" required> " +
          "Ho letto e accetto <a href=\"privacy.html\" target=\"_blank\" rel=\"noopener\">l'informativa privacy</a> per questa persona.</label></div>";
        if (precedenti[i]) {
          blocco.querySelector(".pg-persona-nome").value = precedenti[i].nome;
          blocco.querySelector(".pg-persona-cognome").value = precedenti[i].cognome;
          blocco.querySelector(".pg-persona-email").value = precedenti[i].email;
          blocco.querySelector(".pg-persona-consenso").checked = Boolean(precedenti[i].consensoAccettato);
          blocco.querySelector(".pg-persona-newsletter").checked = Boolean(precedenti[i].consensoNewsletter);
        }
        pgBlocchiPersone.appendChild(blocco);
      }
    }

    // Un numero (0-6) per ciascuna data scelta che ha un prezzo aperitivo
    // configurato — indipendente da chi partecipa all'evento vero e
    // proprio, come per gli eventi normali, ma qui ripetuto per ogni data
    // incluse nella combinazione scelta (non per l'intero pacchetto).
    function generaBlocchiAperitivo() {
      var precedenti = {};
      pgBlocchiAperitivo.querySelectorAll("[data-evento-id]").forEach(function (blocco) {
        precedenti[blocco.getAttribute("data-evento-id")] = blocco.querySelector("select").value;
      });
      pgBlocchiAperitivo.innerHTML = "";
      sottoEventiScelti().forEach(function (ev) {
        if (ev.prezzoAperitivoPersona == null) return;
        var riga = document.createElement("div");
        riga.className = "form-row";
        riga.setAttribute("data-evento-id", ev.id);
        riga.innerHTML =
          "<label>Persone solo aperitivo il " + formattaData(ev.dataEvento) + " (0-6)</label><select></select>";
        var select = riga.querySelector("select");
        for (var n = 0; n <= 6; n++) {
          var opzione = document.createElement("option");
          opzione.value = n;
          opzione.textContent = n;
          select.appendChild(opzione);
        }
        if (precedenti[ev.id]) {
          select.value = precedenti[ev.id];
        }
        select.addEventListener("change", aggiornaTotale);
        pgBlocchiAperitivo.appendChild(riga);
      });
    }

    function leggiPersoneAperitivo() {
      var risultato = [];
      pgBlocchiAperitivo.querySelectorAll("[data-evento-id]").forEach(function (blocco) {
        var numero = parseInt(blocco.querySelector("select").value, 10);
        if (numero > 0) {
          risultato.push({ eventoId: parseInt(blocco.getAttribute("data-evento-id"), 10), numero: numero });
        }
      });
      return risultato;
    }

    // Teaser senza alcuno sconto (né socio né pacchetto): lo stesso
    // principio già usato per gli eventi, dove il totale vero lo decide
    // solo il server al momento del pagamento.
    function aggiornaTotale() {
      var n = parseInt(pgNumeroPersone.value, 10);
      var scelti = sottoEventiScelti();
      var totale = 0;
      scelti.forEach(function (ev) {
        totale += (ev.prezzoSingolo || 0) * n;
      });
      leggiPersoneAperitivo().forEach(function (voce) {
        var ev = sottoEventi.filter(function (e) { return e.id === voce.eventoId; })[0];
        if (ev && ev.prezzoAperitivoPersona != null) {
          totale += ev.prezzoAperitivoPersona * voce.numero;
        }
      });
      pgTotale.textContent = "Totale (senza eventuale sconto): " + totale.toFixed(2) + " €";
    }

    function aggiornaCampi() {
      generaBlocchiPersone(parseInt(pgNumeroPersone.value, 10));
      generaBlocchiAperitivo();
      aggiornaTotale();
    }

    pgCombinazione.addEventListener("change", aggiornaCampi);
    pgNumeroPersone.addEventListener("change", aggiornaCampi);
    aggiornaCampi();

    function nuovoRichiestaId() {
      return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : (Date.now() + "-" + Math.random());
    }

    pgBtnPaga.addEventListener("click", function () {
      pgStatus.hidden = true;
      var persone = leggiPersoneDaBlocchi(true);
      if (!persone) {
        return;
      }
      var dateScelte = sottoEventiScelti().map(function (ev) { return ev.id; });
      var payload = {
        richiestaId: nuovoRichiestaId(),
        origine: window.location.origin,
        modalita: persone.length === 1 ? "singolo" : "gruppo",
        persone: persone,
        dateScelte: dateScelte,
        personeAperitivo: leggiPersoneAperitivo()
      };
      pgBtnPaga.disabled = true;
      pgBtnPaga.textContent = "Reindirizzamento a Stripe…";
      window.trameFetch("/api/pacchetti-eventi/" + encodeURIComponent(pacchettoId) + "/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (result) {
          if (result && result.url) {
            window.location.href = result.url;
            return;
          }
          esitoEl.hidden = false;
          wizardEl.hidden = true;
          esitoEl.innerHTML = "<h3>Iscrizione registrata!</h3><p>Ti contatteremo a breve per completare il pagamento.</p>";
        })
        .catch(function (err) {
          pgBtnPaga.disabled = false;
          pgBtnPaga.textContent = "Vai al pagamento";
          pgStatus.textContent = err.message;
          pgStatus.hidden = false;
        });
    });
  }
})();
