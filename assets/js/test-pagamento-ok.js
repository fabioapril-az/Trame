// Pagina di TEST (test-pagamento-ok.html): Stripe reindirizza qui subito
// dopo il pagamento, ma la conferma vera arriva dal webhook (asincrono,
// vedi api/src/functions/stripe-webhook-test.js) — quindi si fa polling
// sullo stato finché non è più "in attesa" (o finché non si esaurisce un
// numero massimo di tentativi, per non restare bloccati all'infinito se il
// webhook non è configurato).

(function () {
  var params = new URLSearchParams(window.location.search);
  var iscrizioneId = params.get("iscrizione_id");
  var tipo = params.get("tipo");

  var titoloEl = document.getElementById("esito-titolo");
  var testoEl = document.getElementById("esito-testo");

  var TENTATIVI_MASSIMI = 15;
  var INTERVALLO_MS = 2000;
  var tentativi = 0;

  if (!iscrizioneId || !tipo) {
    titoloEl.textContent = "Link non valido";
    testoEl.textContent = "Mancano i parametri iscrizione_id/tipo nel link.";
    return;
  }

  function verifica() {
    tentativi++;
    fetch("/api/iscrizione-test-stato?id=" + encodeURIComponent(iscrizioneId) + "&tipo=" + encodeURIComponent(tipo))
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            throw new Error(body.error || "Errore nella verifica dello stato.");
          }
          return body;
        });
      })
      .then(function (record) {
        if (record.stato === "confermato") {
          titoloEl.textContent = "Pagamento confermato ✔";
          testoEl.textContent = "Importo: " + record.importoTotale.toFixed(2) + " € · payment_intent: " +
            (record.stripePaymentIntentId || "—") + " · iscrizione_id: " + record.iscrizioneId;
          return;
        }
        if (record.stato === "annullato") {
          titoloEl.textContent = "Pagamento annullato";
          testoEl.textContent = "La sessione di pagamento risulta scaduta o annullata.";
          return;
        }
        if (tentativi >= TENTATIVI_MASSIMI) {
          titoloEl.textContent = "Ancora in attesa di conferma";
          testoEl.textContent = "Il webhook non ha ancora aggiornato lo stato. Controlla che " +
            "l'endpoint /api/stripe-webhook-test sia raggiungibile e configurato nel Dashboard Stripe " +
            "(o che `stripe listen` sia attivo in locale), poi ricarica questa pagina.";
          return;
        }
        setTimeout(verifica, INTERVALLO_MS);
      })
      .catch(function (err) {
        titoloEl.textContent = "Errore nella verifica";
        testoEl.textContent = err.message;
      });
  }

  verifica();
})();
