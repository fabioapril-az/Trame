// Schede "Eventi"/"Impostazioni" in admin.html: prima le due sezioni stavano
// una sotto l'altra sempre entrambe visibili, rendendo la pagina lunghissima
// anche quando serve solo una delle due (segnalato dall'utente). Puro switch
// di visibilità: non tocca il caricamento dati, che resta gestito da
// admin.js/admin-eventi.js indipendentemente da quale scheda sia attiva in
// quel momento (entrambe caricano i propri dati non appena il login è
// pronto, anche se la scheda è nascosta).
//
// Il gate di login (data-area-riservata, in admin-auth.js) resta un livello
// sopra, sul contenitore #area-riservata: qui ci si limita a decidere quale
// delle due schede mostrare all'interno di quel contenitore.
(function () {
  var bottoni = document.querySelectorAll("[data-tab-target]");
  var pannelli = document.querySelectorAll("[data-tab-panel]");

  function attiva(tab) {
    pannelli.forEach(function (pannello) {
      pannello.hidden = pannello.getAttribute("data-tab-panel") !== tab;
    });
    bottoni.forEach(function (bottone) {
      var attivo = bottone.getAttribute("data-tab-target") === tab;
      bottone.className = attivo ? "btn btn--primary" : "btn btn--outline";
    });
    try {
      window.localStorage.setItem("trame-admin-tab", tab);
    } catch (e) {
      // Storage non disponibile (privacy mode, ecc.): nessun problema, la
      // scheda resta comunque quella di default finché non si clicca.
    }
  }

  bottoni.forEach(function (bottone) {
    bottone.addEventListener("click", function () {
      attiva(bottone.getAttribute("data-tab-target"));
    });
  });

  var salvata = null;
  try {
    salvata = window.localStorage.getItem("trame-admin-tab");
  } catch (e) {
    // Come sopra: si resta sul default.
  }
  attiva(salvata === "impostazioni" ? "impostazioni" : "eventi");
})();
