// Punto di ingresso delle Azure Functions (programming model v4).
// Ogni file in ./functions registra le proprie route con app.http(...).
// events.js rimosso: la gestione eventi è unificata sotto admin-soci.html
// (backend .NET, dbo.eventi) — questo CMS separato non aveva dati reali.
require("./functions/settings");
