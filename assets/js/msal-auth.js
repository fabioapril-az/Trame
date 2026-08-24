// Wrapper minimo su MSAL.js (Microsoft Authentication Library) per il
// backoffice soci (admin-soci.html). Login con MSAL.js contro la App
// Registration "Trame Backoffice" — stessa usata da Easy Auth sull'API,
// ma qui in modalità Single-Page Application (piattaforma "spa", nessun
// client secret: PKCE). Il token ottenuto viene passato come Bearer
// all'API .NET, che lo valida tramite Easy Auth (pattern già validato
// manualmente in Sprint 5 con "az account get-access-token").
//
// Login/logout usano il redirect a pagina intera (loginRedirect), non il
// popup: bug reale riscontrato in test con un account nuovo del tenant —
// Azure AD mostra una schermata di verifica/sicurezza al primo accesso
// (MFA, registrazione informazioni di sicurezza) che non si renderizza
// correttamente dentro una finestra popup piccola (resta bianca, il
// popup non si chiude mai: "timed_out"/"block_nested_popups"). Il
// redirect a pagina intera gestisce correttamente qualsiasi passaggio
// extra, non solo la semplice password. Il popup resta usato SOLO come
// fallback per il rinnovo silenzioso del token (acquireTokenPopup), dove
// l'account è già pienamente autenticato e un passaggio extra è
// improbabile.

(function () {
  var msalInstance = new msal.PublicClientApplication({
    auth: {
      clientId: window.TRAME_CONFIG.msalClientId,
      authority: window.TRAME_CONFIG.msalAuthority,
      // Pagina di redirect dedicata e vuota per il fallback popup
      // (acquireTokenPopup) — vedi auth-blank.html. Il login vero e
      // proprio (loginRedirect) specifica il proprio redirectUri qui
      // sotto, puntato alla pagina reale dell'app.
      redirectUri: window.location.origin + "/auth-blank.html"
    },
    cache: {
      cacheLocation: "sessionStorage"
    }
  });

  var appRedirectUri = window.location.origin + window.location.pathname;

  var initPromise = msalInstance.initialize()
    .then(function () { return msalInstance.handleRedirectPromise(); })
    .then(function (result) {
      if (result && result.account) {
        msalInstance.setActiveAccount(result.account);
      }
    });

  function getAccount() {
    var accounts = msalInstance.getAllAccounts();
    return accounts.length > 0 ? accounts[0] : null;
  }

  // Naviga via dalla pagina (redirect a pagina intera): la Promise non si
  // risolve mai in questo contesto — al ritorno da Azure AD, admin-soci.html
  // si ricarica e handleRedirectPromise() sopra ripristina l'account.
  function login() {
    return initPromise.then(function () {
      return msalInstance.loginRedirect({
        scopes: [window.TRAME_CONFIG.apiScope],
        redirectUri: appRedirectUri
      });
    });
  }

  function logout() {
    var account = getAccount();
    return initPromise.then(function () {
      return msalInstance.logoutRedirect({ account: account, postLogoutRedirectUri: appRedirectUri });
    });
  }

  // Restituisce un access token valido per l'API, rinnovando in silenzio
  // quando possibile (fallback a un popup solo se la sessione richiede
  // di nuovo un'interazione, es. dopo molte ore — l'account è già
  // autenticato a quel punto, un popup basta).
  function getToken() {
    var account = getAccount();
    if (!account) {
      return Promise.reject(new Error("Non sei collegato."));
    }
    return initPromise
      .then(function () {
        return msalInstance.acquireTokenSilent({ scopes: [window.TRAME_CONFIG.apiScope], account: account });
      })
      .then(function (result) { return result.accessToken; })
      .catch(function () {
        return msalInstance.acquireTokenPopup({ scopes: [window.TRAME_CONFIG.apiScope], account: account })
          .then(function (result) { return result.accessToken; });
      });
  }

  window.trameAuth = {
    ready: initPromise,
    getAccount: getAccount,
    login: login,
    logout: logout,
    getToken: getToken
  };
})();
