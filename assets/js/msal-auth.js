// Wrapper minimo su MSAL.js (Microsoft Authentication Library) per il
// backoffice soci (admin-soci.html). Login con popup contro la App
// Registration "Trame Backoffice" — stessa usata da Easy Auth sull'API,
// ma qui in modalità Single-Page Application (piattaforma "spa", nessun
// client secret: PKCE). Il token ottenuto viene passato come Bearer
// all'API .NET, che lo valida tramite Easy Auth (pattern già validato
// manualmente in Sprint 5 con "az account get-access-token").

(function () {
  var msalInstance = new msal.PublicClientApplication({
    auth: {
      clientId: window.TRAME_CONFIG.msalClientId,
      authority: window.TRAME_CONFIG.msalAuthority,
      redirectUri: window.location.origin + window.location.pathname
    },
    cache: {
      cacheLocation: "sessionStorage"
    }
  });

  var initPromise = msalInstance.initialize();

  function getAccount() {
    var accounts = msalInstance.getAllAccounts();
    return accounts.length > 0 ? accounts[0] : null;
  }

  function login() {
    return initPromise
      .then(function () { return msalInstance.loginPopup({ scopes: [window.TRAME_CONFIG.apiScope] }); })
      .then(function (result) {
        msalInstance.setActiveAccount(result.account);
        return result.account;
      });
  }

  function logout() {
    var account = getAccount();
    return initPromise.then(function () {
      return msalInstance.logoutPopup({ account: account });
    });
  }

  // Restituisce un access token valido per l'API, rinnovando in silenzio
  // quando possibile (fallback a un popup solo se la sessione richiede
  // di nuovo un'interazione, es. dopo molte ore).
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
