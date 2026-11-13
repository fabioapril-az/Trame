// Logica della pagina di amministrazione (admin.html) — solo Impostazioni
// (link social + galleria) ora: la gestione eventi si è spostata
// interamente in admin-soci.html/admin-soci.js (eventi con posti/quote/
// iscrizioni, unico sistema — il vecchio CMS eventi separato su questa
// pagina è stato rimosso, mai avuto dati reali).
// Impostazioni ora vive sul backend .NET (GET/PUT /api/impostazioni),
// stesso login MSAL condiviso con la sezione Eventi — vedi admin-auth.js
// per il widget di login/logout e la visibilità delle sezioni riservate.
// Prima era una Function Node.js separata protetta dal ruolo "editor" di
// Static Web Apps: due sistemi di accesso indipendenti sulla stessa
// pagina, causa di stati di accesso incoerenti (segnalato dall'utente).

(function () {
  var settingsForm = document.getElementById("settings-form");
  var settingsStatus = document.getElementById("settings-form-status");

  function apiFetchAuth(path, options) {
    options = options || {};
    return window.trameAuth.getToken().then(function (token) {
      options.headers = Object.assign({}, options.headers, { Authorization: "Bearer " + token });
      return window.trameFetch(path, options);
    });
  }

  // PUT /api/impostazioni sovrascrive TUTTI i campi: qui si tengono quelli
  // gestiti altrove (quota, vantaggi e sconto socio in admin-soci.html) e
  // si rimandano invariati. Prima venivano mandati solo i link social, e
  // salvare questa pagina azzerava gli altri.
  var impostazioniCorrenti = null;

  function loadSettings() {
    window.trameFetch("/api/impostazioni")
      .then(function (settings) {
        impostazioniCorrenti = settings;
        document.getElementById("settings-instagram").value = (settings && settings.instagramUrl) || "";
        document.getElementById("settings-facebook").value = (settings && settings.facebookUrl) || "";
        document.getElementById("settings-gallery").value = (settings && settings.galleryUrl) || "";
        document.getElementById("settings-analytics").checked = Boolean(settings && settings.analyticsAttivo);
      })
      .catch(function () {
        // Campi vuoti: si può comunque compilare e salvare da zero.
      });
  }

  settingsForm.addEventListener("submit", function (e) {
    e.preventDefault();
    settingsStatus.hidden = true;
    if (!impostazioniCorrenti) {
      // Senza i valori attuali si rischierebbe di azzerare quota e sconto.
      settingsStatus.textContent = "Impostazioni non ancora caricate: ricarica la pagina e riprova.";
      settingsStatus.hidden = false;
      return;
    }
    var payload = Object.assign({}, impostazioniCorrenti, {
      instagramUrl: document.getElementById("settings-instagram").value.trim() || null,
      facebookUrl: document.getElementById("settings-facebook").value.trim() || null,
      galleryUrl: document.getElementById("settings-gallery").value.trim() || null,
      analyticsAttivo: document.getElementById("settings-analytics").checked
    });

    apiFetchAuth("/api/impostazioni", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (aggiornate) {
        if (aggiornate) {
          impostazioniCorrenti = aggiornate;
        }
        settingsStatus.textContent = "Impostazioni salvate.";
        settingsStatus.hidden = false;
      })
      .catch(function (err) {
        settingsStatus.textContent = err.message;
        settingsStatus.hidden = false;
      });
  });

  // Caricate solo dopo il login (admin-auth.js), non al semplice load della
  // pagina: prima del login la sezione è comunque nascosta. Una Promise,
  // non un evento: si "ricorda" di essersi già risolta anche se il login si
  // completa prima che questo script sia stato eseguito (bug reale
  // segnalato dall'utente su un CustomEvent che poteva essere sparato
  // troppo presto).
  window.trameAuthUiReady.then(loadSettings);
})();
