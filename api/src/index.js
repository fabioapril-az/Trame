// Punto di ingresso delle Azure Functions (programming model v4).
// Ogni file in ./functions registra le proprie route con app.http(...).
require("./functions/events");
require("./functions/settings");
