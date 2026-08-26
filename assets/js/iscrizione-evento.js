// Wizard di iscrizione a un evento (iscrizione-evento.html?id=EVENTO_ID).
// Implementa il flusso a rami di specifiche sez. 4.3:
//   1a. evento NON aperto ai non soci -> un solo bottone "Continua": cerca
//       socio per email (GET /api/soci/verifica) e si procede in base al
//       risultato (vedi sotto).
//   1b. evento aperto anche ai non soci -> la scelta è immediata, insieme
//       alla mail, invece che dopo aver scoperto se l'email è già socia
//       (segnalato dall'utente: un passaggio in meno): due bottoni,
//       "Conferma" (iscrizione al solo evento, nessuna verifica preventiva)
//       e "Voglio associarmi anche all'associazione" (stesso comportamento
//       del bottone "Continua" del caso 1a).
//   2a. non trovato -> form iscrizione associazione + iscrizione evento insieme
//   2b. trovato, scaduto/decaduto -> rinnovo obbligatorio prima di procedere
//   2c. trovato, in scadenza entro 30gg -> rinnovo suggerito (facoltativo)
//   2d. trovato, attivo -> procede direttamente (nessun secondo click: non
//       c'è altro da compilare, chiedere comunque conferma sarebbe solo
//       attrito — segnalato dall'utente in test)
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
  var eventoNonSociNota = document.getElementById("evento-non-soci-nota");
  var btnConfermaSoloEvento = document.getElementById("btn-conferma-solo-evento");
  var btnVerificaEmail = document.getElementById("btn-verifica-email");
  var emailStatus = document.getElementById("email-status");

  var stepNuovoSocio = document.getElementById("step-nuovo-socio");
  var stepRinnovo = document.getElementById("step-rinnovo");
  var rinnovoTitolo = document.getElementById("rinnovo-titolo");
  var rinnovoNota = document.getElementById("rinnovo-nota");
  var rinnovoAzioniFacoltative = document.getElementById("rinnovo-facoltativo-azioni");
  var btnSaltaRinnovo = document.getElementById("btn-salta-rinnovo");
  var stepConferma = document.getElementById("step-conferma");
  var btnConferma = document.getElementById("btn-conferma");
  var confermaStatus = document.getElementById("conferma-status");
  var invioInCorso = document.getElementById("invio-in-corso");

  var stato = {
    trovato: false, richiedeRinnovo: false, suggerisceRinnovo: false, saltaRinnovo: false,
    apertoNonSoci: false, soloEvento: false
  };

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
      stato.apertoNonSoci = Boolean(evento.apertoNonSoci);
      if (stato.apertoNonSoci) {
        eventoNonSociNota.hidden = false;
        btnConfermaSoloEvento.hidden = false;
        btnVerificaEmail.textContent = "Voglio associarmi anche all'associazione";
        btnVerificaEmail.classList.remove("btn--primary");
        btnVerificaEmail.classList.add("btn--outline");
      }
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

  // Disabilita/riabilita i controlli del passo email — condivisa dai due
  // punti di ingresso possibili ("Continua"/"Voglio associarmi" e, per un
  // evento aperto ai non soci, "Conferma" per il solo evento).
  function disabilitaStepEmail(disabled) {
    inputEmail.disabled = disabled;
    btnVerificaEmail.disabled = disabled;
    btnConfermaSoloEvento.disabled = disabled;
  }

  btnVerificaEmail.addEventListener("click", function () {
    if (!inputEmail.reportValidity()) {
      return;
    }
    emailStatus.hidden = true;
    disabilitaStepEmail(true);

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

        // Socio già attivo, nessun rinnovo necessario: non c'è altro da
        // compilare, quindi si procede subito invece di chiedere un secondo
        // click su un pannello altrimenti vuoto.
        eseguiIscrizione();
      })
      .catch(function (err) {
        emailStatus.textContent = err.message;
        emailStatus.hidden = false;
        disabilitaStepEmail(false);
      });
  });

  // Iscrizione al solo evento (visibile solo se l'evento è aperto anche ai
  // non soci): nessuna verifica preventiva, si invia subito — è il backend
  // a occuparsi di riconoscere un'email già socia (vedi IscrivitiAsync).
  btnConfermaSoloEvento.addEventListener("click", function () {
    if (!inputEmail.reportValidity()) {
      return;
    }
    emailStatus.hidden = true;
    disabilitaStepEmail(true);
    stato.trovato = false;
    stato.richiedeRinnovo = false;
    stato.suggerisceRinnovo = false;
    stato.soloEvento = true;
    eseguiIscrizione();
  });

  btnSaltaRinnovo.addEventListener("click", function () {
    stato.saltaRinnovo = true;
    stepRinnovo.hidden = true;
  });

  // Valida i campi obbligatori di una sezione (nessun <form> nativo qui:
  // wizard è un contenitore semplice, non un elemento form — la convalida
  // va quindi fatta esplicitamente sui singoli campi).
  function validaSezione(container) {
    var campi = container.querySelectorAll("input, select, textarea");
    for (var i = 0; i < campi.length; i++) {
      if (!campi[i].checkValidity()) {
        campi[i].reportValidity();
        return false;
      }
    }
    return true;
  }

  function eseguiIscrizione() {
    if (!stepNuovoSocio.hidden && !validaSezione(stepNuovoSocio)) {
      return;
    }
    confermaStatus.hidden = true;

    var payload = {
      email: inputEmail.value.trim(),
      importoPagato: null
    };

    if (!stato.trovato && !stato.soloEvento) {
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

    btnConferma.disabled = true;
    invioInCorso.hidden = false;

    window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId) + "/iscriviti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (esito) {
        wizardEl.hidden = true;
        esitoEl.hidden = false;
        // La frase sulla tessera ha senso solo per chi l'ha appena creata o
        // rinnovata in questo passaggio — a un socio già attivo o a chi si è
        // iscritto senza associarsi non si mostra (segnalato dall'utente:
        // vedeva comunque il riferimento alla tessera pur non avendo fatto
        // né una cosa né l'altra).
        var notaTessera = (esito && (esito.tipoIscrizione === "nuovo_socio" || esito.tipoIscrizione === "rinnovo"))
          ? " Riceverai a breve la tessera via email."
          : "";
        esitoEl.innerHTML = "<h3>Iscrizione confermata!</h3><p>Ti aspettiamo all'evento." + notaTessera + "</p>";
      })
      .catch(function (err) {
        invioInCorso.hidden = true;
        // Sia nel percorso "socio già attivo" (invio automatico) sia in
        // quello "Conferma" per il solo evento, il pannello di conferma
        // resta nascosto di default: se qui si torna con un errore, va reso
        // visibile, altrimenti il messaggio non si vede da nessuna parte
        // (bug reale: "non fa nulla").
        stepConferma.hidden = false;
        confermaStatus.textContent = err.message;
        confermaStatus.hidden = false;
        btnConferma.disabled = false;
        disabilitaStepEmail(false);
      });
  }

  btnConferma.addEventListener("click", eseguiIscrizione);

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
