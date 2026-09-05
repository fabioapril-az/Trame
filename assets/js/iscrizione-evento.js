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
  var paramsUrl = new URLSearchParams(window.location.search);
  var eventoId = paramsUrl.get("id");
  var pagamentoParam = paramsUrl.get("pagamento"); // "confermato"|"annullato", solo al ritorno da Stripe

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

  // Modalità di partecipazione (facoltative, definite in admin per evento) e
  // dati richiesti solo a chi si iscrive al solo evento senza essere socio —
  // vedi impostaModalitaPartecipazione()/mostraCampiSoloEvento() più sotto.
  var campoNumeroPersone = document.getElementById("campo-numero-persone");
  var inputNumeroPersone = document.getElementById("input-numero-persone");
  var campoOpzione = document.getElementById("campo-opzione");
  var inputOpzione = document.getElementById("input-opzione");
  var opzionePrezzoTotale = document.getElementById("opzione-prezzo-totale");
  var campoNomeSoloEvento = document.getElementById("campo-nome-solo-evento");
  var campoCognomeSoloEvento = document.getElementById("campo-cognome-solo-evento");
  var inputSoloEventoNome = document.getElementById("se-nome");
  var inputSoloEventoCognome = document.getElementById("se-cognome");

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
    apertoNonSoci: false, impostazioni: null, opzioniPartecipazione: []
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
        mostraCampiSoloEvento(true);
      } else {
        // Senza "Conferma" (solo evento) come alternativa, "anche" non ha
        // senso: qui è l'unica azione possibile per chi non è socio.
        btnAssociati.textContent = "Voglio iscrivermi all'associazione";
      }
      var dettagli = formattaData(evento.dataEvento) + (evento.luogo ? " · " + evento.luogo : "");
      if (evento.quotaEvento) {
        dettagli += " · quota: " + evento.quotaEvento + " €";
      }
      sottotitoloEl.textContent = dettagli;

      impostaModalitaPartecipazione(evento.opzioniPartecipazione || []);
      // Solo un limite lato UI (il backend rifiuta comunque se si supera
      // davvero la capienza): evita di far scegliere nel menu più posti di
      // quanti ce ne siano davvero.
      if (evento.postiMax && (evento.opzioniPartecipazione || []).length) {
        popolaNumeroPersone(Math.max(1, Math.min(6, evento.postiDisponibili)));
      }

      if (evento.stato !== "aperto") {
        chiusoEl.hidden = false;
        chiusoEl.textContent = "Le iscrizioni a questo evento non sono attualmente aperte.";
        return;
      }

      // Ritorno da Stripe dopo un pagamento riuscito: nessun wizard, solo
      // l'esito (l'URL è quello che il backend .NET genera nel redirect).
      if (pagamentoParam === "confermato") {
        esitoEl.hidden = false;
        esitoEl.innerHTML = "<h3>Pagamento confermato!</h3><p>Ti aspettiamo all'evento. Riceverai conferma via email.</p>";
        return;
      }

      // Prezzi Singolo/Gruppo/Aperitivo e "Modalità di partecipazione" sono
      // alternativi (l'API .NET li rifiuta insieme): un evento con questi
      // prezzi usa il wizard di pagamento, mai quello sopra.
      var usaPrezziPagamento = evento.prezzoSingolo != null || evento.prezzoGruppoPersona != null || evento.prezzoAperitivoPersona != null;
      if (usaPrezziPagamento) {
        if (pagamentoParam === "annullato") {
          document.getElementById("pagamento-annullato-nota").hidden = false;
        }
        inizializzaWizardPagamento(evento);
        document.getElementById("wizard-pagamento").hidden = false;
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
    inputNumeroPersone.disabled = disabled;
    inputOpzione.disabled = disabled;
    inputSoloEventoNome.disabled = disabled;
    inputSoloEventoCognome.disabled = disabled;
    // btnAssociati resta gestito a parte: si riabilita solo se la verifica
    // conferma che l'email non è già socia (vedi verificaEmail sotto), non
    // genericamente insieme agli altri controlli.
  }

  // Menu a tendina 1-6 (richiesto esplicitamente al posto di un campo
  // numerico libero): "max" lo riduce ulteriormente se i posti disponibili
  // sono meno di 6, così non si può nemmeno provare a chiedere più posti di
  // quanti ce ne siano davvero.
  function popolaNumeroPersone(max) {
    var valorePrecedente = inputNumeroPersone.value || "1";
    inputNumeroPersone.innerHTML = "";
    for (var n = 1; n <= max; n++) {
      var option = document.createElement("option");
      option.value = n;
      option.textContent = n;
      inputNumeroPersone.appendChild(option);
    }
    if (inputNumeroPersone.querySelector('option[value="' + valorePrecedente + '"]')) {
      inputNumeroPersone.value = valorePrecedente;
    }
  }

  // Popola il selettore modalità solo se l'evento ne ha (admin, facoltative):
  // un evento a quota unica non mostra questi campi, resta come prima.
  function impostaModalitaPartecipazione(opzioni) {
    stato.opzioniPartecipazione = opzioni;
    if (!opzioni.length) {
      return;
    }
    popolaNumeroPersone(6);
    campoNumeroPersone.hidden = false;
    campoOpzione.hidden = false;
    inputOpzione.innerHTML = "";
    // Placeholder vuoto e obbligatorio (required in HTML): senza, il
    // <select> selezionerebbe da solo la prima modalità, facendo confermare
    // un prezzo diverso da quello che ci si aspetta senza essersene accorti.
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— scegli —";
    placeholder.disabled = true;
    placeholder.selected = true;
    inputOpzione.appendChild(placeholder);
    opzioni.forEach(function (o) {
      var option = document.createElement("option");
      option.value = o.id;
      option.textContent = o.nome + " — " + o.prezzoPersona + " € a persona";
      inputOpzione.appendChild(option);
    });
    aggiornaPrezzoTotale();
  }

  function opzioneSelezionata() {
    var id = inputOpzione.value;
    return stato.opzioniPartecipazione.filter(function (o) { return String(o.id) === id; })[0] || null;
  }

  function aggiornaPrezzoTotale() {
    var opzione = opzioneSelezionata();
    var persone = parseInt(inputNumeroPersone.value, 10) || 1;
    if (!opzione) {
      opzionePrezzoTotale.hidden = true;
      return;
    }
    opzionePrezzoTotale.textContent = "Totale: " + (opzione.prezzoPersona * persone).toFixed(2) + " €";
    opzionePrezzoTotale.hidden = false;
  }

  inputNumeroPersone.addEventListener("change", aggiornaPrezzoTotale);
  inputOpzione.addEventListener("change", aggiornaPrezzoTotale);

  // Nome/cognome servono solo a chi si iscrive al solo evento senza essere
  // socio (bottone "Conferma" sotto, visibile solo se l'evento è aperto
  // anche ai non soci): un socio già noto ha questi dati in anagrafica, non
  // glieli si richiede di nuovo.
  function mostraCampiSoloEvento(visibile) {
    btnConfermaSoloEvento.hidden = !visibile;
    campoNomeSoloEvento.hidden = !visibile;
    campoCognomeSoloEvento.hidden = !visibile;
  }

  // Il testo del bottone cambia in "Invio in corso…" mentre la richiesta è
  // in volo: disabilitare da solo il bottone non bastava a far capire che
  // stava succedendo qualcosa, specie con l'API un po' lenta a rispondere
  // (segnalato dall'utente in test).
  function impostaCaricamento(btn, inCorso) {
    if (inCorso) {
      if (!btn.dataset.testoOriginale) {
        btn.dataset.testoOriginale = btn.textContent;
      }
      btn.textContent = "Invio in corso…";
      btn.disabled = true;
    } else {
      if (btn.dataset.testoOriginale) {
        btn.textContent = btn.dataset.testoOriginale;
        delete btn.dataset.testoOriginale;
      }
      btn.disabled = false;
    }
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
            mostraCampiSoloEvento(true);
          }
          return;
        }

        // Già socio: "Voglio associarmi"/"Conferma" (solo evento) non
        // servono più, l'unica azione possibile è "Conferma iscrizione"
        // (richiesto esplicitamente: prima restavano visibili insieme,
        // confondendo a cosa servisse "Conferma").
        btnAssociati.hidden = true;
        mostraCampiSoloEvento(false);

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
      mostraCampiSoloEvento(true);
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
    if (!inputSoloEventoNome.reportValidity() || !inputSoloEventoCognome.reportValidity()) {
      return;
    }
    if (stato.opzioniPartecipazione.length && (!inputNumeroPersone.reportValidity() || !inputOpzione.reportValidity())) {
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
      // Il tooltip nativo del browser sul campo non valido a volte passa
      // inosservato in un modulo lungo come questo: si vedeva il click
      // apparentemente "non fare nulla" (segnalato dall'utente in test).
      // Un messaggio esplicito rende visibile che qualcosa È successo.
      interesseStatus.textContent = "Controlla i campi evidenziati: alcuni dati sono mancanti o non validi.";
      interesseStatus.hidden = false;
      return;
    }
    interesseStatus.hidden = true;
    impostaCaricamento(btnConfermaAssociazione, true);

    window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId) + "/richiesta-associazione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inputEmail.value.trim(),
        nome: document.getElementById("ia-nome").value.trim(),
        cognome: document.getElementById("ia-cognome").value.trim(),
        telefono: document.getElementById("ia-telefono").value.trim() || null,
        dataNascita: document.getElementById("ia-data-nascita").value,
        codiceFiscale: document.getElementById("ia-cf").value.trim().toUpperCase(),
        indirizzo: document.getElementById("ia-indirizzo").value.trim() || null,
        citta: document.getElementById("ia-citta").value.trim() || null,
        cap: document.getElementById("ia-cap").value.trim() || null,
        consensoAccettato: document.getElementById("ia-consenso").checked,
        consensoVersione: "1.0"
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
        impostaCaricamento(btnConfermaAssociazione, false);
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
    var pulsante = soloEvento ? btnConfermaSoloEvento : btnConferma;
    confermaStatus.hidden = true;

    var payload = {
      email: inputEmail.value.trim(),
      importoPagato: null
    };

    // Solo se l'evento ha modalità di partecipazione definite in admin —
    // altrimenti un evento a quota unica manda solo l'email, come prima.
    if (stato.opzioniPartecipazione.length) {
      payload.numeroPersone = parseInt(inputNumeroPersone.value, 10) || 1;
      payload.opzionePartecipazioneId = inputOpzione.value ? parseInt(inputOpzione.value, 10) : null;
    }

    // Nome/cognome solo per chi si iscrive al solo evento senza essere
    // socio: un socio già noto li ha già in anagrafica.
    if (soloEvento) {
      payload.nome = inputSoloEventoNome.value.trim();
      payload.cognome = inputSoloEventoCognome.value.trim();
    }

    if (!soloEvento && (stato.richiedeRinnovo || (stato.suggerisceRinnovo && !stato.saltaRinnovo))) {
      payload.rinnovo = {
        dataRinnovo: new Date().toISOString().slice(0, 10),
        importo: parseImporto(document.getElementById("rn-importo").value),
        metodoPagamento: val("rn-metodo") || null,
        riferimentoPagamento: null
      };
    }

    impostaCaricamento(pulsante, true);
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
        impostaCaricamento(pulsante, false);
        disabilitaStepEmail(false);
      });
  }

  btnConferma.addEventListener("click", function () {
    if (stato.opzioniPartecipazione.length && (!inputNumeroPersone.reportValidity() || !inputOpzione.reportValidity())) {
      return;
    }
    eseguiIscrizione();
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

  // ================= Wizard di pagamento (Stripe) =================
  // Attivo solo per eventi con prezzoSingolo/prezzoGruppoPersona/
  // prezzoAperitivoPersona (vedi sopra) — nessuna verifica socio qui, lo
  // sconto (se spetta) lo calcola il server persona per persona al submit.
  // Stessa logica già validata in Fase 1 (test-pagamento.html/js).
  function inizializzaWizardPagamento(evento) {
    var pgModalita = document.getElementById("pg-modalita");
    var pgCampoModalita = document.getElementById("pg-campo-modalita");
    var pgCampoNumeroGruppo = document.getElementById("pg-campo-numero-gruppo");
    var pgNumeroGruppo = document.getElementById("pg-numero-gruppo");
    var pgBlocchiPersone = document.getElementById("pg-blocchi-persone");
    var pgCampoAperitivo = document.getElementById("pg-campo-aperitivo");
    var pgAperitivo = document.getElementById("pg-aperitivo");
    var pgCampoAllergie = document.getElementById("pg-campo-allergie");
    var pgAllergie = document.getElementById("pg-allergie");
    var pgTotale = document.getElementById("pg-totale");
    var pgStatus = document.getElementById("pg-status");
    var pgBtnPaga = document.getElementById("pg-btn-paga");

    // Assente sugli eventi creati prima di questo campo: di default attivo
    // (comportamento di sempre). Se disattivato dall'admin (es. Stripe
    // temporaneamente sospeso per questo evento), il bottone non promette
    // un pagamento online: registra e basta, si paga a parte.
    var pagamentoOnlineAttivo = evento.pagamentoOnlineAttivo !== false;
    var testoBtnPaga = pagamentoOnlineAttivo ? "Vai al pagamento" : "Invia iscrizione";
    pgBtnPaga.textContent = testoBtnPaga;

    function popolaSelectNumerico(select, min, max) {
      select.innerHTML = "";
      for (var n = min; n <= max; n++) {
        var option = document.createElement("option");
        option.value = n;
        option.textContent = n;
        select.appendChild(option);
      }
    }
    popolaSelectNumerico(pgNumeroGruppo, 2, 6);
    popolaSelectNumerico(pgAperitivo, 0, 6);

    function modalitaAttiva() {
      if (evento.prezzoSingolo != null && evento.prezzoGruppoPersona != null) {
        return pgModalita.value;
      }
      return evento.prezzoSingolo != null ? "singolo" : "gruppo";
    }

    function leggiPersoneDaBlocchi(validare) {
      var blocchi = pgBlocchiPersone.querySelectorAll(".admin-panel");
      var persone = [];
      for (var i = 0; i < blocchi.length; i++) {
        var nome = blocchi[i].querySelector(".pg-persona-nome");
        var cognome = blocchi[i].querySelector(".pg-persona-cognome");
        var email = blocchi[i].querySelector(".pg-persona-email");
        if (validare) {
          if (!nome.reportValidity() || !cognome.reportValidity() || !email.reportValidity()) {
            return null;
          }
        }
        persone.push({ nome: nome.value.trim(), cognome: cognome.value.trim(), email: email.value.trim() });
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
          "<div class=\"form-row\"><label>Email</label><input type=\"email\" class=\"pg-persona-email\" maxlength=\"255\" required></div>";
        if (precedenti[i]) {
          blocco.querySelector(".pg-persona-nome").value = precedenti[i].nome;
          blocco.querySelector(".pg-persona-cognome").value = precedenti[i].cognome;
          blocco.querySelector(".pg-persona-email").value = precedenti[i].email;
        }
        pgBlocchiPersone.appendChild(blocco);
      }
    }

    function aggiornaTotale() {
      var modalita = modalitaAttiva();
      var prezzoBase = modalita === "singolo" ? evento.prezzoSingolo : evento.prezzoGruppoPersona;
      var n = modalita === "singolo" ? 1 : parseInt(pgNumeroGruppo.value, 10);
      var totale = (prezzoBase || 0) * n;
      var personeAperitivo = pgCampoAperitivo.hidden ? 0 : parseInt(pgAperitivo.value, 10);
      if (personeAperitivo > 0) {
        totale += evento.prezzoAperitivoPersona * personeAperitivo;
      }
      pgTotale.textContent = "Totale (senza eventuale sconto socio): " + totale.toFixed(2) + " €";
    }

    function aggiornaCampi() {
      var entrambe = evento.prezzoSingolo != null && evento.prezzoGruppoPersona != null;
      pgCampoModalita.hidden = !entrambe;
      var modalita = modalitaAttiva();
      pgCampoNumeroGruppo.hidden = modalita !== "gruppo";
      pgCampoAperitivo.hidden = evento.prezzoAperitivoPersona == null;
      pgCampoAllergie.hidden = evento.prezzoAperitivoPersona == null;
      var n = modalita === "singolo" ? 1 : parseInt(pgNumeroGruppo.value, 10);
      generaBlocchiPersone(n);
      aggiornaTotale();
    }

    pgModalita.addEventListener("change", aggiornaCampi);
    pgNumeroGruppo.addEventListener("change", aggiornaCampi);
    pgAperitivo.addEventListener("change", aggiornaTotale);
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
      var payload = {
        richiestaId: nuovoRichiestaId(),
        // Il backend usa questa origine (validata contro un allowlist) per
        // costruire il redirect di ritorno da Stripe — niente più dominio
        // fisso, funziona da sola sia su produzione sia su ogni anteprima
        // PR. Campo obbligatorio lato server.
        origine: window.location.origin,
        modalita: modalitaAttiva(),
        persone: persone,
        personeAperitivo: pgCampoAperitivo.hidden ? 0 : parseInt(pgAperitivo.value, 10),
        allergieNote: pgCampoAllergie.hidden ? null : pgAllergie.value.trim()
      };
      pgBtnPaga.disabled = true;
      pgBtnPaga.textContent = pagamentoOnlineAttivo ? "Reindirizzamento a Stripe…" : "Invio in corso…";
      window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId) + "/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (result) {
          if (result && result.url) {
            window.location.href = result.url;
            return;
          }
          // Pagamento online disattivato per questo evento: nessun redirect,
          // l'iscrizione è già registrata (stato "in attesa di pagamento
          // manuale") — il pagamento va raccolto a parte.
          document.getElementById("wizard-pagamento").hidden = true;
          esitoEl.hidden = false;
          esitoEl.innerHTML = "<h3>Iscrizione registrata!</h3>" +
            "<p>Il pagamento online non è attivo per questo evento: ti contatteremo a breve per completare il pagamento.</p>";
        })
        .catch(function (err) {
          pgBtnPaga.disabled = false;
          pgBtnPaga.textContent = testoBtnPaga;
          pgStatus.textContent = err.message;
          pgStatus.hidden = false;
        });
    });
  }
})();
