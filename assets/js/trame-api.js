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
    richiede_nuovo_socio: "Email non trovata: completa anche i dati di iscrizione all'associazione.",
    richiede_rinnovo: "La tessera risulta scaduta: è necessario rinnovarla per procedere.",
    gia_iscritto: "Risulti già iscritto/a a questo evento con questa email.",
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
        return contentType.indexOf("application/json") !== -1 ? res.json() : res.text();
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
