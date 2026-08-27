// Login/logout condiviso per tutta admin.html (Impostazioni + Eventi): un
// solo accesso Azure AD (ruolo Presidente/Admin sulla App Registration
// "Trame Backoffice"), non più due sistemi indipendenti — prima il ruolo
// "editor" di Static Web Apps gestiva "Impostazioni" e questo stesso login
// MSAL gestiva solo "Eventi": due sessioni scollegate sulla stessa pagina,
// tanto che si poteva vedere "Accesso non riconosciuto" in alto pur essendo
// autenticati e operativi più sotto (segnalato dall'utente in test).
// Le sezioni riservate sono marcate con [data-area-riservata] e mostrate/
// nascoste tutte insieme da qui; il caricamento dei rispettivi dati
// (impostazioni, elenco eventi) resta a admin.js/admin-eventi.js, che
// attendono window.trameAuthUiReady.
//
// Una Promise (non un CustomEvent) apposta: admin.js/admin-eventi.js si
// registrano con .then() solo dopo che i rispettivi script sono stati
// caricati ed eseguiti (tag <script> successivi a questo), e nel frattempo
// il login MSAL può già essersi risolto — un evento sparato una sola volta
// prima che il listener esista andrebbe perso per sempre, lasciando le
// liste vuote finché non si preme manualmente "Aggiorna elenco" (bug reale
// segnalato dall'utente). Una Promise invece "ricorda" di essersi già
// risolta anche per chi si iscrive in ritardo.
window.trameAuthUiReady = new Promise(function (resolve) {
  window._trameAuthUiReadyResolve = resolve;
});

(function () {
  var userLabel = document.getElementById("admin-user-label");
  var btnLogin = document.getElementById("admin-btn-login");
  var btnLogout = document.getElementById("admin-btn-logout");
  var gateNote = document.getElementById("admin-auth-gate-note");
  var areeRiservate = document.querySelectorAll("[data-area-riservata]");

  function mostraAree(mostra) {
    for (var i = 0; i < areeRiservate.length; i++) {
      areeRiservate[i].hidden = !mostra;
    }
  }

  function refreshUi() {
    var account = window.trameAuth.getAccount();
    if (!account) {
      gateNote.hidden = false;
      btnLogin.hidden = false;
      btnLogout.hidden = true;
      userLabel.textContent = "Non collegato";
      mostraAree(false);
      return;
    }
    gateNote.hidden = true;
    btnLogin.hidden = true;
    btnLogout.hidden = false;
    userLabel.textContent = account.name || account.username;
    mostraAree(true);
    window._trameAuthUiReadyResolve();
  }

  btnLogin.addEventListener("click", function () {
    window.trameAuth.login().catch(function (err) {
      gateNote.hidden = false;
      gateNote.textContent = "Accesso non riuscito: " + err.message;
    });
  });

  btnLogout.addEventListener("click", function () {
    window.trameAuth.logout().then(function () { window.location.reload(); });
  });

  window.trameAuth.ready.then(refreshUi);
})();
