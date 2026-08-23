// Wizard di iscrizione a un evento (iscrizione-evento.html?id=EVENTO_ID).
// Implementa il flusso a rami di specifiche sez. 4.3:
//   1. cerca socio per email (GET /api/soci/verifica)
//   2a. non trovato -> form iscrizione associazione + iscrizione evento insieme
//   2b. trovato, scaduto/decaduto -> rinnovo obbligatorio prima di procedere
//   2c. trovato, in scadenza entro 30gg -> rinnovo suggerito (facoltativo)
//   2d. trovato, attivo -> procede direttamente
// In tutti i casi termina con POST /api/eventi/{id}/iscriviti.

(function () {
  var eventoId = new URLSearchParams(window.location.search).get("id");

  var titoloEl = document.getElementById("evento-titolo");
  var sottotitoloEl = document.getElementById("evento-sottotitolo");
  var loadingEl = document.getElementById("evento-loading");
  var chiusoEl = document.getElementById("evento-chiuso");
  var wizardEl = document.getElementById("wizard");
  var esitoEl = document.getElementById("esito-finale");

  var stepEmail = document.getElementById("step-email");
  var inputEmail = document.getElementById("input-email");
  var btnVerificaEmail = document.getElementById("btn-verifica-email");
  var emailStatus = document.getElementById("email-status");

  var stepNuovoSocio = document.getElementById("step-nuovo-socio");
  var stepRinnovo = document.getElementById("step-rinnovo");
  var rinnovoTitolo = document.getElementById("rinnovo-titolo");
  var rinnovoNota = document.getElementById("rinnovo-nota");
  var rinnovoAzioniFacoltative = document.getElementById("rinnovo-facoltativo-azioni");
  var btnSaltaRinnovo = document.getElementById("btn-salta-rinnovo");
  var stepConferma = document.getElementById("step-conferma");
  var confermaStatus = document.getElementById("conferma-status");

  var stato = { trovato: false, richiedeRinnovo: false, suggerisceRinnovo: false, saltaRinnovo: false };

  if (!eventoId) {
    titoloEl.textContent = "Link non valido";
    loadingEl.hidden = true;
    chiusoEl.hidden = false;
    chiusoEl.textContent = "Manca l'identificativo dell'evento nel link.";
    return;
  }

  window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId))
    .then(function (evento) {
      loadingEl.hidden = true;
      titoloEl.textContent = evento.titolo;
      var dettagli = formattaData(evento.dataEvento) + (evento.luogo ? " · " + evento.luogo : "");
      if (evento.quotaEvento) {
        dettagli += " · quota: " + evento.quotaEvento + " €";
      }
      sottotitoloEl.textContent = dettagli;

      if (evento.stato !== "aperto") {
        chiusoEl.hidden = false;
        chiusoEl.textContent = "Le iscrizioni a questo evento non sono attualmente aperte.";
        return;
      }
      wizardEl.hidden = false;
    })
    .catch(function (err) {
      loadingEl.hidden = true;
      titoloEl.textContent = "Evento non disponibile";
      chiusoEl.hidden = false;
      chiusoEl.textContent = err.message;
    });

  btnVerificaEmail.addEventListener("click", function () {
    if (!inputEmail.reportValidity()) {
      return;
    }
    emailStatus.hidden = true;
    btnVerificaEmail.disabled = true;
    inputEmail.disabled = true;

    window.trameFetch("/api/soci/verifica?email=" + encodeURIComponent(inputEmail.value.trim()))
      .then(function (result) {
        stato.trovato = result.trovato;
        stato.richiedeRinnovo = Boolean(result.richiedeRinnovoObbligatorio);
        stato.suggerisceRinnovo = Boolean(result.suggerisceRinnovo);

        if (!result.trovato) {
          stepNuovoSocio.hidden = false;
          stepConferma.hidden = false;
          return;
        }

        if (stato.richiedeRinnovo) {
          rinnovoTitolo.textContent = "La tua tessera è scaduta";
          rinnovoNota.textContent = "Per iscriverti devi prima rinnovare la tessera (scaduta il " +
            formattaData(result.dataScadenza) + ").";
          rinnovoAzioniFacoltative.hidden = true;
          stepRinnovo.hidden = false;
          stepConferma.hidden = false;
          return;
        }

        if (stato.suggerisceRinnovo) {
          rinnovoTitolo.textContent = "La tua tessera scade presto";
          rinnovoNota.textContent = "Scade il " + formattaData(result.dataScadenza) +
            ": puoi rinnovarla ora insieme all'iscrizione, oppure procedere senza rinnovare.";
          rinnovoAzioniFacoltative.hidden = false;
          stepRinnovo.hidden = false;
          stepConferma.hidden = false;
          return;
        }

        stepConferma.hidden = false;
      })
      .catch(function (err) {
        emailStatus.textContent = err.message;
        emailStatus.hidden = false;
        btnVerificaEmail.disabled = false;
        inputEmail.disabled = false;
      });
  });

  btnSaltaRinnovo.addEventListener("click", function () {
    stato.saltaRinnovo = true;
    stepRinnovo.hidden = true;
  });

  wizardEl.addEventListener("submit", function (e) {
    e.preventDefault();
    confermaStatus.hidden = true;

    var payload = {
      email: inputEmail.value.trim(),
      importoPagato: parseImporto(document.getElementById("importo-pagato").value)
    };

    if (!stato.trovato) {
      payload.nuovoSocio = {
        nome: val("ns-nome"),
        cognome: val("ns-cognome"),
        email: payload.email,
        telefono: val("ns-telefono") || null,
        dataNascita: val("ns-data-nascita"),
        codiceFiscale: val("ns-cf").toUpperCase(),
        indirizzo: val("ns-indirizzo") || null,
        citta: val("ns-citta") || null,
        cap: val("ns-cap") || null,
        consensoAccettato: document.getElementById("ns-consenso").checked,
        consensoVersione: "1.0",
        consensoCanale: "evento"
      };
    } else if (stato.richiedeRinnovo || (stato.suggerisceRinnovo && !stato.saltaRinnovo)) {
      payload.rinnovo = {
        dataRinnovo: new Date().toISOString().slice(0, 10),
        importo: parseImporto(document.getElementById("rn-importo").value),
        metodoPagamento: val("rn-metodo") || null,
        riferimentoPagamento: null
      };
    }

    var btnConferma = document.getElementById("btn-conferma");
    btnConferma.disabled = true;
    btnConferma.textContent = "Invio in corso…";

    window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId) + "/iscriviti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function () {
        wizardEl.hidden = true;
        esitoEl.hidden = false;
        esitoEl.innerHTML = "<h3>Iscrizione confermata!</h3><p>Ti aspettiamo all'evento. " +
          "Se hai completato o rinnovato la tessera, la riceverai a breve via email.</p>";
      })
      .catch(function (err) {
        confermaStatus.textContent = err.message;
        confermaStatus.hidden = false;
        btnConferma.disabled = false;
        btnConferma.textContent = "Conferma iscrizione";
      });
  });

  function val(id) {
    return document.getElementById(id).value.trim();
  }

  function parseImporto(value) {
    if (!value) {
      return null;
    }
    var n = parseFloat(value);
    return isNaN(n) ? null : n;
  }

  function formattaData(isoDate) {
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }
})();
