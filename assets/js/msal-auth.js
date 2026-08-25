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

  // Token tenuto in memoria per la durata di questa pagina (non in
  // sessionStorage: quello lo gestisce già MSAL). Bug reale trovato in
  // test: acquireTokenSilent() fallisce sistematicamente su questo
  // account/browser (probabile blocco cookie di terze parti di Edge
  // sull'iframe nascosto che MSAL usa per il controllo silenzioso verso
  // login.microsoftonline.com) — non solo dopo la scadenza, ma su OGNI
  // chiamata. Senza questa cache, ogni azione (anche solo aprire la lista
  // eventi) ripartiva da un redirect di login completo, cancellando
  // qualunque dato l'utente stesse compilando in un form. Il token
  // ottenuto dal login stesso (result.accessToken, già valido) viene
  // riusato finché non scade, senza richiamare MSAL per ogni chiamata.
  var tokenInMemoria = null;

  function tokenValido(token) {
    return Boolean(token && token.scadenza && token.scadenza.getTime() - Date.now() > 60000);
  }

  function salvaToken(result) {
    if (result && result.accessToken) {
      tokenInMemoria = { accessToken: result.accessToken, scadenza: result.expiresOn };
    }
  }

  var initPromise = msalInstance.initialize()
    .then(function () { return msalInstance.handleRedirectPromise(); })
    .then(function (result) {
      if (result && result.account) {
        msalInstance.setActiveAccount(result.account);
        salvaToken(result);
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
  // risolve mai in questo contesto. Il redirect punta a auth-blank.html
  // (non a questa pagina) — bug reale trovato in test: admin.html è
  // protetta anche dal ruolo "editor" della Static Web App, che intercetta
  // il ritorno da login.microsoftonline.com PRIMA che questo script possa
  // elaborarlo (vedi auth-blank.html per il dettaglio). auth-blank.html
  // rimanda poi qui con un secondo redirect "same-site", passato tramite
  // "state" perché è un valore che il round-trip OAuth restituisce intatto.
  function login() {
    return initPromise.then(function () {
      return msalInstance.loginRedirect({
        scopes: [window.TRAME_CONFIG.apiScope],
        redirectUri: window.location.origin + "/auth-blank.html",
        state: window.location.pathname
      });
    });
  }

  function logout() {
    var account = getAccount();
    return initPromise.then(function () {
      return msalInstance.logoutRedirect({ account: account, postLogoutRedirectUri: appRedirectUri });
    });
  }

  // Restituisce un access token valido per l'API. Prima controlla la cache
  // in memoria (vedi sopra): se il token del login è ancora valido, lo
  // riusa direttamente, senza richiamare MSAL — questo è ciò che permette
  // di lavorare sulla pagina (compilare un form, ecc.) senza redirect
  // improvvisi. Solo se manca o è scaduto tenta acquireTokenSilent(), e
  // solo come ultima risorsa un redirect a pagina intera (mai un popup:
  // aperto automaticamente da qui, non da un click diretto dell'utente,
  // può restare bloccato in bianco — bug reale trovato in test). Un
  // redirect qui ricarica la pagina cancellando i dati non salvati: capita
  // ormai solo dopo un'ora reale di inattività del token, non a ogni azione.
  function getToken() {
    var account = getAccount();
    if (!account) {
      return Promise.reject(new Error("Non sei collegato."));
    }
    if (tokenValido(tokenInMemoria)) {
      return Promise.resolve(tokenInMemoria.accessToken);
    }
    return initPromise
      .then(function () {
        return msalInstance.acquireTokenSilent({ scopes: [window.TRAME_CONFIG.apiScope], account: account });
      })
      .then(function (result) {
        salvaToken(result);
        return result.accessToken;
      })
      .catch(function () {
        return msalInstance.acquireTokenRedirect({
          scopes: [window.TRAME_CONFIG.apiScope],
          account: account,
          redirectUri: window.location.origin + "/auth-blank.html",
          state: window.location.pathname
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
