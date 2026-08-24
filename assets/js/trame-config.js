// Configurazione condivisa per le pagine del gestionale soci (diventa-socio,
// verifica-socio, iscrizione-evento, admin-soci). Nessun dato sensibile qui:
// clientId e URL sono pubblici per definizione in un'app a pagina singola.
window.TRAME_CONFIG = {
  apiBaseUrl: "https://app-trame-prod.azurewebsites.net",
  // App Registration "Trame Backoffice" — stessa usata da Easy Auth sull'API.
  msalClientId: "4cae2c16-f533-403f-98db-8f677e00a652",
  msalAuthority: "https://login.microsoftonline.com/78002a77-30b5-49ba-951b-cc82340aa805",
  apiScope: "api://4cae2c16-f533-403f-98db-8f677e00a652/user_impersonation",
};
