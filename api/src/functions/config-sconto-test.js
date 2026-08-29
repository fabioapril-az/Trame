// GET /api/config-sconto-test  -> { scontoSocioEuro, scontoSocioMaxEventi }
// PUT /api/config-sconto-test  -> salva nuovi valori
//
// Pannello admin di TEST (test-pagamento-admin.html) per lo sconto socio
// sugli eventi: importo e tetto di eventi scontati, letti da
// calcolaRigaEvento in pagamenti-test-shared.js ad ogni checkout. In Fase 2
// gli stessi due campi andranno aggiunti a admin-soci.html sul backend
// .NET reale (vedi memoria di progetto): qui restano nel nostro Table
// Storage di test, protetti dalla stessa TEST_ADMIN_KEY degli altri
// endpoint admin di test.

const { app } = require("@azure/functions");
const { leggiConfigScontoSocio, salvaConfigScontoSocio } = require("./pagamenti-test-shared");

function chiaveValida(request) {
  const attesa = process.env.TEST_ADMIN_KEY;
  return Boolean(attesa) && request.headers.get("x-test-admin-key") === attesa;
}

app.http("config-sconto-test-get", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "config-sconto-test",
  handler: async (request, context) => {
    if (!chiaveValida(request)) {
      return { status: 401, jsonBody: { error: "Chiave admin di test mancante o errata." } };
    }
    try {
      const config = await leggiConfigScontoSocio();
      return { status: 200, jsonBody: config };
    } catch (err) {
      context.error("Errore lettura config sconto socio:", err);
      return { status: 500, jsonBody: { error: "Errore interno." } };
    }
  }
});

app.http("config-sconto-test-put", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "config-sconto-test",
  handler: async (request, context) => {
    if (!chiaveValida(request)) {
      return { status: 401, jsonBody: { error: "Chiave admin di test mancante o errata." } };
    }
    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return { status: 400, jsonBody: { error: "Corpo della richiesta non valido (JSON atteso)." } };
    }
    const scontoSocioEuro = parseFloat(payload.scontoSocioEuro);
    const scontoSocioMaxEventi = parseInt(payload.scontoSocioMaxEventi, 10);
    if (!(scontoSocioEuro >= 0)) {
      return { status: 400, jsonBody: { error: "L'importo dello sconto deve essere un numero >= 0." } };
    }
    if (!(scontoSocioMaxEventi >= 0)) {
      return { status: 400, jsonBody: { error: "Il numero massimo di eventi scontati deve essere un intero >= 0." } };
    }
    try {
      await salvaConfigScontoSocio({ scontoSocioEuro, scontoSocioMaxEventi });
      return { status: 200, jsonBody: { scontoSocioEuro, scontoSocioMaxEventi } };
    } catch (err) {
      context.error("Errore salvataggio config sconto socio:", err);
      return { status: 500, jsonBody: { error: "Errore interno." } };
    }
  }
});
