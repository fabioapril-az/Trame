// Wrapper minimo su MSAL.js (Microsoft Authentication Library) per il
// backoffice soci (admin-soci.html). Login con MSAL.js contro la App
// Registration "Trame Backoffice" — stessa usata da Easy Auth sull'API,
// ma qui in modalità Single-Page Application (piattaforma "spa", nessun
// client secret: PKCE). Il token ottenuto viene passato come Bearer
// all'API .NET, che lo valida tramite Easy Auth (pattern già validato
// manualmente in Sprint 5 con "az account get-access-token").
//
// Login/logout/rinnovo token usano SEMPRE il redirect a pagina intera, mai
// popup: due bug reali trovati in test.
// 1) Con un account nuovo del tenant, Azure AD mostra una schermata di
//    verifica/sicurezza al primo accesso (MFA, registrazione informazioni
//    di sicurezza) che non si renderizza correttamente dentro un popup
//    piccolo (resta bianca, il popup non si chiude mai: "timed_out").
// 2) Un popup aperto automaticamente da codice (non da un click diretto
//    dell'utente, es. il rinnovo silenzioso del token dopo un redirect di
//    login) può restare bianco e non chiudersi mai — i browser trattano
//    diversamente i popup non originati da un gesto utente esplicito, e
//    MSAL non riesce sempre a intercettarne la chiusura in quel caso.

(function () {
  var msalInstance = new msal.PublicClientApplication({
    auth: {
      clientId: window.TRAME_CONFIG.msalClientId,
      authority: window.TRAME_CONFIG.msalAuthority,
      // Redirect di default (usato per l'inizializzazione/eventuali flussi
      // impliciti di MSAL) puntato su una pagina dedicata e vuota — vedi
      // auth-blank.html. login()/getToken() specificano invece esplicitamente
      // appRedirectUri (la pagina reale dell'app) per il proprio redirect.
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
      } else if (!msalInstance.getActiveAccount()) {
        // Caricamento pagina "normale" (non un ritorno da redirect): se la
        // sessione ha già un account in cache ma nessuno impostato come
        // attivo, lo impostiamo esplicitamente — senza questo,
        // getAllAccounts()[0] può scegliere un account diverso da quello
        // con cui è stato effettivamente ottenuto il token più recente
        // (bug reale trovato in test: subito dopo un login via redirect,
        // il rinnovo silenzioso del token falliva e apriva un popup di
        // fallback che restava bloccato in bianco — vedi getAccount sotto).
        var accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          msalInstance.setActiveAccount(accounts[0]);
        }
      }
    })
    .catch(function (err) {
      // Bug reale riscontrato in test: se sessionStorage contiene uno stato
      // di un tentativo di login precedente interrotto/scaduto (es. tra due
      // pagine diverse che condividono questo stesso script, come
      // admin.html e admin-soci.html), handleRedirectPromise() rifiuta con
      // "no_token_request_cache_error" — e senza questo catch la rifiutava
      // per SEMPRE ("ready" restava una promise fallita), bloccando anche un
      // login successivo pulito. Uno stato di ritorno incoerente non deve
      // impedire di ripartire da "non ancora autenticato".
      console.warn("Stato di redirect MSAL incoerente, riparto da non autenticato:", err);
    });

  function getAccount() {
    // getActiveAccount() rispetta quale account è stato effettivamente
    // usato per l'ultimo login/token — getAllAccounts()[0] no (l'ordine
    // non è garantito corrispondere), causa reale del bug sopra.
    var active = msalInstance.getActiveAccount();
    if (active) {
      return active;
    }
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
  // quando possibile. Se serve di nuovo un'interazione (sessione scaduta
  // dopo molte ore), il fallback è un redirect a pagina intera, non un
  // popup: un popup aperto automaticamente da qui (non da un click diretto
  // dell'utente) può restare bloccato in bianco — bug reale trovato in
  // test. Il redirect ricarica la pagina; la chiamata che ha innescato il
  // rinnovo va ripetuta al ritorno (chi chiama getToken() lo fa già a ogni
  // caricamento pagina/azione, quindi succede naturalmente).
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
        return msalInstance.acquireTokenRedirect({
          scopes: [window.TRAME_CONFIG.apiScope],
          account: account,
          redirectUri: appRedirectUri
        });
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
