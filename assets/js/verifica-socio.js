// Pagina di atterraggio del QR stampato sulla tessera socio
// (verifica-socio.html?tessera=NUMERO) → GET /api/soci/verifica-tessera.

(function () {
  var STATO_LABELS = {
    attivo: "Tessera valida",
    scaduto: "Tessera scaduta",
    decaduto: "Tessera decaduta",
    cancellato: "Socio cancellato"
  };

  var loadingEl = document.getElementById("verifica-loading");
  var esitoEl = document.getElementById("verifica-esito");

  function formattaData(isoDate) {
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  function mostraEsito(html) {
    loadingEl.hidden = true;
    esitoEl.innerHTML = html;
    esitoEl.hidden = false;
  }

  var numero = new URLSearchParams(window.location.search).get("tessera");
  if (!numero) {
    mostraEsito(
      '<span class="verifica-card__icon" aria-hidden="true">⚠️</span>' +
      "<h2>Numero tessera mancante</h2>" +
      "<p>Il link non contiene un numero di tessera valido.</p>"
    );
    return;
  }

  window.trameFetch("/api/soci/verifica-tessera?numero=" + encodeURIComponent(numero))
    .then(function (result) {
      if (!result.trovato) {
        mostraEsito(
          '<span class="verifica-card__icon" aria-hidden="true">❌</span>' +
          "<h2>Tessera non riconosciuta</h2>" +
          "<p>Nessuna tessera trovata con il numero " + escapeHtml(numero) + ".</p>"
        );
        return;
      }

      var valida = result.stato === "attivo";
      var icona = valida ? "✅" : "⚠️";
      var etichettaStato = STATO_LABELS[result.stato] || result.stato;

      mostraEsito(
        '<span class="verifica-card__icon" aria-hidden="true">' + icona + "</span>" +
        "<h2>" + etichettaStato + "</h2>" +
        "<p><strong>" + escapeHtml(result.nomeCognome) + "</strong></p>" +
        "<p>Numero tessera: " + escapeHtml(numero) + "</p>" +
        "<p>Valida fino al " + formattaData(result.dataScadenza) + "</p>"
      );
    })
    .catch(function (err) {
      mostraEsito(
        '<span class="verifica-card__icon" aria-hidden="true">⚠️</span>' +
        "<h2>Verifica non riuscita</h2>" +
        "<p>" + escapeHtml(err.message) + "</p>"
      );
    });

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }
})();
