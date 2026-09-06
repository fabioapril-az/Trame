// Pagina "Informami quando parte" (interesse-evento.html?id=EVENTO_ID) →
// POST /api/eventi/{id}/interesse-notifica. Solo per eventi in stato
// "Annunciato" (pubblicati in anteprima, senza data/luogo definitivi): il
// bottone che porta qui sostituisce "Prenota" per quei soli eventi, vedi
// events.js/evento-dettaglio.js. Pagina pubblica, nessun login richiesto.

(function () {
  var CONSENSO_VERSIONE = "1.0"; // versione dell'informativa privacy corrente (privacy.html)

  var eventoId = new URLSearchParams(window.location.search).get("id");
  var titoloEl = document.getElementById("evento-titolo");
  var sottotitoloEl = document.getElementById("evento-sottotitolo");
  var loadingEl = document.getElementById("evento-loading");
  var erroreEl = document.getElementById("evento-errore");
  var form = document.getElementById("interesse-form");
  var submitBtn = document.getElementById("ie-submit-btn");
  var statusEl = document.getElementById("ie-status");
  var esitoEl = document.getElementById("ie-esito");

  function mostraStato(messaggio, tipo) {
    statusEl.textContent = messaggio;
    statusEl.hidden = false;
    statusEl.style.color = tipo === "errore" ? "var(--color-terracotta, #b5533c)" : "inherit";
  }

  if (!eventoId) {
    loadingEl.hidden = true;
    erroreEl.hidden = false;
    erroreEl.textContent = "Manca l'identificativo dell'evento nel link.";
    return;
  }

  window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId))
    .then(function (evento) {
      loadingEl.hidden = true;
      titoloEl.textContent = evento.titolo;
      form.hidden = false;

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        statusEl.hidden = true;

        var payload = {
          email: document.getElementById("ie-email").value.trim(),
          consensoNewsletter: document.getElementById("ie-newsletter").checked,
          consensoAccettato: document.getElementById("ie-consenso").checked,
          consensoVersione: CONSENSO_VERSIONE,
          consensoCanale: "evento"
        };

        submitBtn.disabled = true;
        submitBtn.textContent = "Invio in corso…";

        window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId) + "/interesse-notifica", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function () {
            form.hidden = true;
            esitoEl.hidden = false;
          })
          .catch(function (err) {
            mostraStato(err.message, "errore");
          })
          .finally(function () {
            submitBtn.disabled = false;
            submitBtn.textContent = "Informami quando parte";
          });
      });
    })
    .catch(function (err) {
      loadingEl.hidden = true;
      erroreEl.hidden = false;
      erroreEl.textContent = err.message;
    });
})();
