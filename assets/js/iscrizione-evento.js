// Wizard di iscrizione a un evento (iscrizione-evento.html?id=EVENTO_ID).
// Flusso (specifiche sez. 4.3, riviste su richiesta esplicita dell'utente:
// nessuna registrazione automatica di nuovi soci da qui):
//   - la verifica dell'email è automatica, all'uscita dal campo (nessun
//     bottone "Continua" da premere apposta):
//     1. trovato, attivo -> procede subito (nessun click: non c'è altro da
//        compilare, chiedere comunque conferma sarebbe solo attrito)
//     2. trovato, scaduto/decaduto -> rinnovo obbligatorio prima di procedere
//     3. trovato, in scadenza entro 30gg -> rinnovo suggerito (facoltativo)
//     4. non trovato -> abilita il bottone "Voglio associarmi anche
//        all'associazione" (disabilitato finché non si sa che l'email non è
//        già socia — SENZA verifica, il bottone resta disabilitato)
//   - "Voglio associarmi anche all'associazione": non registra nulla in
//     automatico, manda solo una email allo staff (POST .../richiesta-
//     associazione) che segue la richiesta manualmente; la schermata finale
//     mostra quota associativa e testo dei vantaggi (da GET /api/impostazioni,
//     gestiti in admin-soci.html).
//   - "Conferma" (solo se l'evento è aperto anche ai non soci): iscrizione al
//     solo evento, nessuna verifica preventiva — il backend riconosce da sé
//     un'email già socia.
// In tutti i casi (tranne la richiesta di associazione) termina con
// POST /api/eventi/{id}/iscriviti.

(function () {
  var eventoId = new URLSearchParams(window.location.search).get("id");

  var titoloEl = document.getElementById("evento-titolo");
  var sottotitoloEl = document.getElementById("evento-sottotitolo");
  var loadingEl = document.getElementById("evento-loading");
  var chiusoEl = document.getElementById("evento-chiuso");
  var wizardEl = document.getElementById("wizard");
  var esitoEl = document.getElementById("esito-finale");

  var inputEmail = document.getElementById("input-email");
  var eventoNonSociNota = document.getElementById("evento-non-soci-nota");
  var btnConfermaSoloEvento = document.getElementById("btn-conferma-solo-evento");
  var btnAssociati = document.getElementById("btn-associati");
  var verificaStatus = document.getElementById("verifica-status");
  var emailStatus = document.getElementById("email-status");

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
    apertoNonSoci: false, impostazioni: null
  };
  var verificaTimer = null;

  if (!eventoId) {
    titoloEl.textContent = "Link non valido";
    loadingEl.hidden = true;
    chiusoEl.hidden = false;
    chiusoEl.textContent = "Manca l'identificativo dell'evento nel link.";
    return;
  }

  window.trameFetch("/api/impostazioni")
    .then(function (impostazioni) { stato.impostazioni = impostazioni; })
    .catch(function () { /* quota/testo vantaggi non essenziali per il resto del flusso */ });

  window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId))
    .then(function (evento) {
      loadingEl.hidden = true;
      titoloEl.textContent = evento.titolo;
      stato.apertoNonSoci = Boolean(evento.apertoNonSoci);
      if (stato.apertoNonSoci) {
        eventoNonSociNota.hidden = false;
        btnConfermaSoloEvento.hidden = false;
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
  // punti di ingresso possibili ("Voglio associarmi" e, per un evento aperto
  // ai non soci, "Conferma" per il solo evento).
  function disabilitaStepEmail(disabled) {
    inputEmail.disabled = disabled;
    btnConfermaSoloEvento.disabled = disabled;
    // btnAssociati resta gestito a parte: si riabilita solo se la verifica
    // conferma che l'email non è già socia (vedi verificaEmail sotto), non
    // genericamente insieme agli altri controlli.
  }

  // Verifica automatica dell'email (debounce sull'input + verifica immediata
  // all'uscita dal campo): nessun bottone "Continua" da premere apposta.
  // Il bottone "Voglio associarmi anche all'associazione" si abilita SOLO se
  // la verifica conferma che l'email non è già di un socio (richiesto
  // esplicitamente: prima restava sempre cliccabile).
  function verificaEmail() {
    btnAssociati.disabled = true;
    stepRinnovo.hidden = true;
    if (!inputEmail.checkValidity() || !inputEmail.value.trim()) {
      verificaStatus.hidden = true;
      return;
    }
    verificaStatus.textContent = "Verifica in corso…";
    verificaStatus.hidden = false;

    window.trameFetch("/api/soci/verifica?email=" + encodeURIComponent(inputEmail.value.trim()))
      .then(function (result) {
        verificaStatus.hidden = true;
        stato.trovato = result.trovato;
        stato.richiedeRinnovo = Boolean(result.richiedeRinnovoObbligatorio);
        stato.suggerisceRinnovo = Boolean(result.suggerisceRinnovo);

        if (!result.trovato) {
          btnAssociati.disabled = false;
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
        // compilare, quindi si procede subito invece di chiedere un click.
        eseguiIscrizione();
      })
      .catch(function (err) {
        verificaStatus.hidden = true;
        emailStatus.textContent = err.message;
        emailStatus.hidden = false;
      });
  }

  inputEmail.addEventListener("blur", function () {
    if (verificaTimer) {
      clearTimeout(verificaTimer);
      verificaTimer = null;
    }
    verificaEmail();
  });
  inputEmail.addEventListener("input", function () {
    btnAssociati.disabled = true;
    emailStatus.hidden = true;
    if (verificaTimer) {
      clearTimeout(verificaTimer);
    }
    verificaTimer = setTimeout(verificaEmail, 700);
  });

  // "Conferma" (solo evento, visibile solo se l'evento è aperto anche ai non
  // soci): nessuna verifica preventiva, si invia subito — è il backend a
  // occuparsi di riconoscere un'email già socia (vedi IscrivitiAsync).
  btnConfermaSoloEvento.addEventListener("click", function () {
    if (!inputEmail.reportValidity()) {
      return;
    }
    emailStatus.hidden = true;
    disabilitaStepEmail(true);
    btnAssociati.disabled = true;
    stato.trovato = false;
    stato.richiedeRinnovo = false;
    stato.suggerisceRinnovo = false;
    eseguiIscrizione({ soloEvento: true });
  });

  // "Voglio associarmi anche all'associazione": nessuna registrazione
  // automatica (richiesto esplicitamente) — manda solo una email allo staff,
  // che segue la richiesta manualmente. Abilitato solo dopo verificaEmail()
  // ha confermato che l'email non è già di un socio.
  btnAssociati.addEventListener("click", function () {
    disabilitaStepEmail(true);
    btnAssociati.disabled = true;

    window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId) + "/richiesta-associazione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inputEmail.value.trim() })
    })
      .then(function () {
        wizardEl.hidden = true;
        esitoEl.hidden = false;
        esitoEl.innerHTML = renderEsitoRichiestaAssociazione();
      })
      .catch(function (err) {
        disabilitaStepEmail(false);
        btnAssociati.disabled = false;
        emailStatus.textContent = err.message;
        emailStatus.hidden = false;
      });
  });

  function renderEsitoRichiestaAssociazione() {
    var html = "<h3>Richiesta inviata!</h3>" +
      "<p>Grazie per l'interesse: abbiamo inoltrato la tua richiesta alla segreteria, che ti contatterà a breve.</p>";
    var imp = stato.impostazioni;
    if (imp && imp.quotaIscrizioneSoci) {
      html += "<p><strong>Quota associativa:</strong> " + imp.quotaIscrizioneSoci + " €</p>";
    }
    if (imp && imp.testoVantaggiIscrizione) {
      html += "<p>" + escapeHtml(imp.testoVantaggiIscrizione).replace(/\n/g, "<br>") + "</p>";
    }
    return html;
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  btnSaltaRinnovo.addEventListener("click", function () {
    stato.saltaRinnovo = true;
    stepRinnovo.hidden = true;
  });

  function eseguiIscrizione(opzioni) {
    var soloEvento = Boolean(opzioni && opzioni.soloEvento);
    confermaStatus.hidden = true;

    var payload = {
      email: inputEmail.value.trim(),
      importoPagato: null
    };

    if (!soloEvento && (stato.richiedeRinnovo || (stato.suggerisceRinnovo && !stato.saltaRinnovo))) {
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
        // La frase sulla tessera ha senso solo per chi l'ha appena rinnovata
        // in questo passaggio — a un socio già attivo o a chi si è iscritto
        // senza associarsi non si mostra.
        var notaTessera = (esito && esito.tipoIscrizione === "rinnovo")
          ? " Riceverai a breve la tessera via email."
          : "";
        esitoEl.innerHTML = "<h3>Iscrizione confermata!</h3><p>Ti aspettiamo all'evento." + notaTessera + "</p>";
      })
      .catch(function (err) {
        invioInCorso.hidden = true;
        // Sia nel percorso "socio già attivo" (invio automatico) sia in
        // quello "Conferma" per il solo evento, il pannello di conferma
        // resta nascosto di default: se qui si torna con un errore, va reso
        // visibile, altrimenti il messaggio non si vede da nessuna parte.
        stepConferma.hidden = false;
        confermaStatus.textContent = err.message;
        confermaStatus.hidden = false;
        btnConferma.disabled = false;
        disabilitaStepEmail(false);
      });
  }

  btnConferma.addEventListener("click", function () { eseguiIscrizione(); });

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
