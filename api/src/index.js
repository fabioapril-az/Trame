// Punto di ingresso delle Azure Functions (programming model v4).
// Ogni file in ./functions registra le proprie route con app.http(...).
// events.js rimosso prima: la gestione eventi è unificata sotto il
// backend .NET (dbo.eventi). settings.js rimosso ora: le impostazioni del
// sito sono passate anche loro al backend .NET (GET/PUT /api/impostazioni),
// per far girare admin.html sotto un solo sistema di login invece di due
// scollegati (ruolo "editor" di Static Web Apps + Azure AD App Roles).
// Questo CMS Node.js/Table Storage separato non ha più funzioni registrate:
// resta solo come scaffold vuoto dell'app Functions gestita dalla Static
// Web App (api_location nel workflow), nessuna route esposta.
