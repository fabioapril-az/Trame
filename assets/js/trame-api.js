// Helper condiviso per chiamare l'API del gestionale soci
// (https://app-trame-prod.azurewebsites.net) dalle pagine pubbliche e dal
// backoffice. Traduce gli errori del backend (vedi GlobalExceptionHandler.cs)
// in messaggi in italiano comprensibili, senza esporre dettagli tecnici.

(function () {
  var MESSAGGI_ERRORE = {
    email_duplicata: "Esiste già un socio iscritto con questa email.",
    socio_non_trovato: "Socio non trovato.",
    socio_cancellato: "Questo socio risulta cancellato: contatta la segreteria.",
    evento_non_trovato: "Evento non trovato.",
    evento_non_aperto: "Le iscrizioni a questo evento non sono aperte.",
    posti_esauriti: "I posti disponibili per questo evento sono esauriti.",
    posti_insufficienti: "Non ci sono abbastanza posti disponibili per tutte le persone indicate.",
    // Posto bloccato per 30 minuti da chi ha già aperto la pagina di
    // pagamento: se non paga, il posto torna libero da solo.
    posti_in_pagamento: "Gli ultimi posti sono in fase di pagamento da parte di altre persone. Riprova tra qualche minuto.",
    posti_max_sotto_prenotato: "Non puoi ridurre i posti sotto quelli già prenotati o in fase di pagamento.",
    richiede_nuovo_socio: "Email non trovata: completa anche i dati di iscrizione all'associazione.",
    richiede_rinnovo: "La tessera risulta scaduta: è necessario rinnovarla per procedere.",
    richiede_consenso: "Devi accettare l'informativa sul trattamento dei dati personali per procedere.",
    gia_iscritto: "Risulti già iscritto/a a questo evento con questa email.",
    combinazione_non_valida: "Scegli una sola data o tutte le date collegate: una via di mezzo non è ammessa.",
    sconto_non_configurato: "\"Tutte le date\" non è ancora disponibile per questo evento: riprova più tardi o scegli una sola data.",
    pacchetto_non_aperto: "Le iscrizioni a questo evento non sono attualmente aperte.",
    iscrizione_socio_richiede_nome_cognome: "Indica nome e cognome per completare l'iscrizione.",
    email_socio_nome_diverso: "Questa email è già associata a un altro socio, con un nome diverso. Usa la tua email personale, oppure scrivi nome e cognome come li hai indicati all'iscrizione. Per aiuto: info@progettotrame.org.",
    evento_riservato_soci: "Questo evento è riservato ai soci: completa anche l'iscrizione all'associazione per procedere.",
    email_gia_socia_attiva: "Questa email risulta già di un socio attivo: torna indietro e riprova, la tessera non serve.",
    rinnovo_non_applicabile: "La tessera di questa persona non risulta da rinnovare: torna indietro e riprova.",
    tessera_richiede_maggiorenne: "L'iscrizione online all'associazione è riservata ai maggiorenni: per i minorenni scrivici a info@progettotrame.org.",
    consenso_foto_richiesto: "Scegli Sì o No per il consenso a foto e video di ogni persona da associare.",
    dati_tessera_incompleti: "Completa data di nascita e codice fiscale di ogni persona da associare.",
    prezzo_richiesto: "Per aprire le iscrizioni inserisci almeno un prezzo tra Singolo, Gruppo e Aperitivo.",
    opzioni_non_piu_supportate: "Le modalità di partecipazione non sono più supportate: usa i prezzi Singolo, Gruppo e Aperitivo.",
    funzione_non_disponibile: "Questa funzione non è più disponibile. Per informazioni scrivici a info@progettotrame.org.",
    validation_error: "Controlla i dati inseriti.",
    internal_error: "Si è verificato un errore imprevisto. Riprova più tardi."
  };

  /**
   * @param {string} path Es. "/api/soci" (con lo slash iniziale)
   * @param {RequestInit} [options]
   * @returns {Promise<any>} il body JSON della risposta se ok, altrimenti lancia un Error con .message leggibile
   */
  function trameFetch(path, options) {
    var url = window.TRAME_CONFIG.apiBaseUrl + path;
    return fetch(url, options).then(function (res) {
      if (res.ok) {
        if (res.status === 204) {
          return null;
        }
        var contentType = res.headers.get("content-type") || "";
        if (contentType.indexOf("application/json") !== -1) {
          return res.json();
        }
        // L'API risponde sempre con JSON o 204: un 2xx con un content-type
        // diverso non è mai un successo vero — è tipicamente la pagina HTML
        // di "Service Unavailable" che l'infrastruttura Azure può servire
        // con status 200 durante un cold-start (bug reale trovato in test:
        // veniva trattata come una risposta valida, mascherando l'errore
        // invece di mostrare il fallback previsto).
        throw new Error("Il server ha risposto in modo imprevisto. Riprova tra qualche istante.");
      }
      return res.json().catch(function () { return null; }).then(function (body) {
        var messaggio;
        if (body && body.errors) {
          // ProblemDetails di validazione ASP.NET Core: { errors: { campo: ["msg", ...] } }
          var primoCampo = Object.keys(body.errors)[0];
          messaggio = primoCampo ? body.errors[primoCampo][0] : "Controlla i dati inseriti.";
        } else if (body && body.error && MESSAGGI_ERRORE[body.error]) {
          messaggio = MESSAGGI_ERRORE[body.error];
        } else if (body && body.message) {
          messaggio = body.message;
        } else {
          messaggio = "Si è verificato un errore (" + res.status + ").";
        }
        var err = new Error(messaggio);
        err.status = res.status;
        err.codice = body && body.error;
        err.body = body;
        throw err;
      });
    });
  }

  window.trameFetch = trameFetch;
})();
