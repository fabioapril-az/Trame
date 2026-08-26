// Wizard di iscrizione a un evento (iscrizione-evento.html?id=EVENTO_ID).
// Flusso (specifiche sez. 4.3, riviste su richiesta esplicita dell'utente):
//   - la verifica dell'email è automatica, all'uscita dal campo (nessun
//     bottone "Continua" da premere apposta) — ma NON esegue mai da sola
//     un'azione finale: serve solo a determinare quale passo mostrare.
//     Ogni azione finale (iscrizione o richiesta di associazione) richiede
//     sempre un click esplicito su un bottone "Conferma" (bug reale corretto:
//     prima un socio già attivo veniva iscritto in automatico senza alcun
//     click, e non c'era modo di vedere/annullare l'operazione).
//     1. trovato, attivo -> mostra "Conferma iscrizione" (step-conferma)
//     2. trovato, scaduto/decaduto -> rinnovo obbligatorio, poi "Conferma iscrizione"
//     3. trovato, in scadenza entro 30gg -> rinnovo suggerito (facoltativo), poi "Conferma iscrizione"
//     4. non trovato -> abilita "Voglio associarmi anche all'associazione"
//   - "Voglio associarmi anche all'associazione": mostra quota associativa e
//     testo dei vantaggi (da GET /api/impostazioni, gestiti in
//     admin-soci.html) PRIMA di inviare qualunque cosa; solo al click su
//     "Conferma richiesta" parte una email allo staff (POST .../richiesta-
//     associazione) — nessuna registrazione automatica di nuovi soci.
//   - "Conferma" (solo se l'evento è aperto anche ai non soci): iscrizione al
//     solo evento, nessuna verifica preventiva — il backend riconosce da sé
//     un'email già socia. Resta un solo click, come già era.
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

  var stepInteresse = document.getElementById("step-interesse-associazione");
  var interesseQuota = document.getElementById("interesse-quota");
  var interesseVantaggi = document.getElementById("interesse-vantaggi");
  var btnConfermaAssociazione = document.getElementById("btn-conferma-associazione");
  var interesseStatus = document.getElementById("interesse-status");

  var stato = {
    trovato: false, richiedeRinnovo: false, suggerisceRinnovo: false, saltaRinnovo: false,
    apertoNonSoci: false, impostazioni: null
  };
  var verificaTimer = null;
  // Email dell'ultima verifica completata: se il blur scatta di nuovo con
  // la STESSA email (es. per lo spostamento del focus quando si clicca un
  // bottone dentro il wizard, come "Conferma iscrizione"), non va rifatta
  // la verifica — altrimenti i pannelli/bottoni appena mostrati vengono
  // nascosti un istante prima che il click li raggiunga, e il click va a
  // vuoto (bug reale trovato in test: "Conferma iscrizione"/"Conferma
  // richiesta" sembravano non fare nulla).
  var ultimaEmailVerificata = null;

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

  // Disabilita/riabilita i controlli del passo email — condivisa dai punti
  // di ingresso possibili ("Conferma richiesta" e, per un evento aperto ai
  // non soci, "Conferma" per il solo evento).
  function disabilitaStepEmail(disabled) {
    inputEmail.disabled = disabled;
    btnConfermaSoloEvento.disabled = disabled;
    // btnAssociati resta gestito a parte: si riabilita solo se la verifica
    // conferma che l'email non è già socia (vedi verificaEmail sotto), non
    // genericamente insieme agli altri controlli.
  }

  // Verifica automatica dell'email (debounce sull'input + verifica immediata
  // all'uscita dal campo): nessun bottone "Continua" da premere apposta, ma
  // serve SOLO a decidere quale passo mostrare — non esegue mai da sola
  // un'iscrizione o un invio (richiesto esplicitamente: ogni azione finale
  // passa sempre da un click su un bottone "Conferma").
  function verificaEmail() {
    var email = inputEmail.value.trim();
    if (!inputEmail.checkValidity() || !email) {
      verificaStatus.hidden = true;
      return;
    }
    if (email === ultimaEmailVerificata) {
      // Stessa email già verificata (es. blur causato dal click su un
      // bottone del wizard): non rifare la richiesta né nascondere i
      // pannelli già mostrati.
      return;
    }
    ultimaEmailVerificata = email;

    btnAssociati.disabled = true;
    stepRinnovo.hidden = true;
    stepConferma.hidden = true;
    stepInteresse.hidden = true;
    verificaStatus.textContent = "Verifica in corso…";
    verificaStatus.hidden = false;

    window.trameFetch("/api/soci/verifica?email=" + encodeURIComponent(email))
      .then(function (result) {
        verificaStatus.hidden = true;
        stato.trovato = result.trovato;
        stato.richiedeRinnovo = Boolean(result.richiedeRinnovoObbligatorio);
        stato.suggerisceRinnovo = Boolean(result.suggerisceRinnovo);

        if (!result.trovato) {
          btnAssociati.hidden = false;
          btnAssociati.disabled = false;
          if (stato.apertoNonSoci) {
            btnConfermaSoloEvento.hidden = false;
          }
          return;
        }

        // Già socio: "Voglio associarmi"/"Conferma" (solo evento) non
        // servono più, l'unica azione possibile è "Conferma iscrizione"
        // (richiesto esplicitamente: prima restavano visibili insieme,
        // confondendo a cosa servisse "Conferma").
        btnAssociati.hidden = true;
        btnConfermaSoloEvento.hidden = true;

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
        // compilare, ma serve comunque un click esplicito su "Conferma
        // iscrizione" — nessuna azione deve partire da sola.
        stepConferma.hidden = false;
      })
      .catch(function (err) {
        verificaStatus.hidden = true;
        ultimaEmailVerificata = null;
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
    // L'email sta cambiando: torna allo stato "da verificare" — entrambi i
    // bottoni riappaiono nelle loro condizioni di default finché la nuova
    // verifica (blur o debounce) non stabilisce di nuovo lo stato giusto.
    btnAssociati.disabled = true;
    btnAssociati.hidden = false;
    if (stato.apertoNonSoci) {
      btnConfermaSoloEvento.hidden = false;
    }
    emailStatus.hidden = true;
    if (verificaTimer) {
      clearTimeout(verificaTimer);
    }
    verificaTimer = setTimeout(verificaEmail, 700);
  });

  // "Conferma" (solo evento, visibile solo se l'evento è aperto anche ai non
  // soci): nessuna verifica preventiva, si invia subito — è il backend a
  // occuparsi di riconoscere un'email già socia (vedi IscrivitiAsync). Resta
  // un solo click, era già così.
  btnConfermaSoloEvento.addEventListener("click", function () {
    if (!inputEmail.reportValidity()) {
      return;
    }
    emailStatus.hidden = true;
    disabilitaStepEmail(true);
    btnAssociati.disabled = true;
    stepInteresse.hidden = true;
    stato.trovato = false;
    stato.richiedeRinnovo = false;
    stato.suggerisceRinnovo = false;
    eseguiIscrizione({ soloEvento: true });
  });

  // "Voglio associarmi anche all'associazione": mostra quota e vantaggi
  // PRIMA di inviare qualunque cosa — l'invio parte solo al click su
  // "Conferma richiesta" (vedi sotto). Abilitato solo dopo che verificaEmail()
  // ha confermato che l'email non è già di un socio.
  btnAssociati.addEventListener("click", function () {
    var imp = stato.impostazioni;
    if (imp && imp.quotaIscrizioneSoci) {
      interesseQuota.textContent = "Quota associativa: " + imp.quotaIscrizioneSoci + " €";
      interesseQuota.hidden = false;
    } else {
      interesseQuota.hidden = true;
    }
    if (imp && imp.testoVantaggiIscrizione) {
      interesseVantaggi.textContent = imp.testoVantaggiIscrizione;
      interesseVantaggi.hidden = false;
    } else {
      interesseVantaggi.hidden = true;
    }
    document.getElementById("interesse-solo-soci-nota").hidden = stato.apertoNonSoci;
    interesseStatus.hidden = true;
    btnAssociati.disabled = true;
    // "Conferma" (solo evento) resta cliccabile anche con questo pannello
    // aperto: chi cambia idea può scegliere quella strada senza dover
    // ricaricare la pagina (bug reale trovato in test: prima veniva
    // disabilitata qui e non c'era modo di riattivarla senza "Annulla",
    // che non esisteva).
    stepInteresse.hidden = false;
  });

  document.getElementById("btn-annulla-associazione").addEventListener("click", function () {
    stepInteresse.hidden = true;
    btnAssociati.disabled = false;
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

  btnConfermaAssociazione.addEventListener("click", function () {
    if (!validaSezione(stepInteresse)) {
      return;
    }
    interesseStatus.hidden = true;
    btnConfermaAssociazione.disabled = true;

    window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId) + "/richiesta-associazione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inputEmail.value.trim(),
        nome: document.getElementById("ia-nome").value.trim(),
        cognome: document.getElementById("ia-cognome").value.trim(),
        telefono: document.getElementById("ia-telefono").value.trim() || null
      })
    })
      .then(function (esito) {
        wizardEl.hidden = true;
        esitoEl.hidden = false;
        // Se l'evento è aperto anche ai non soci, la richiesta di
        // associazione iscrive anche a QUESTO evento (l'"anche" del
        // bottone) — altrimenti l'iscrizione resta bloccata finché la
        // segreteria non associa la persona.
        var notaEvento = (esito && esito.iscrittoEvento)
          ? " Ti abbiamo anche iscritto/a a questo evento: ti aspettiamo!"
          : "";
        esitoEl.innerHTML = "<h3>Richiesta inviata!</h3>" +
          "<p>Grazie per l'interesse: abbiamo inoltrato la tua richiesta alla segreteria, che ti contatterà a breve." +
          notaEvento + "</p>";
      })
      .catch(function (err) {
        btnConfermaAssociazione.disabled = false;
        interesseStatus.textContent = err.message;
        interesseStatus.hidden = false;
      });
  });

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
