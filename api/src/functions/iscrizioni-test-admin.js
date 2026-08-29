// GET  /api/iscrizioni-test-admin           -> elenco record (per test-pagamento-admin.html)
// POST /api/iscrizioni-test-admin/rimborso  -> segna un record come "rimborsato"
//
// Ambiente di TEST soltanto: non usa il login Azure AD del vero admin (qui
// non c'è ancora nulla di reale da proteggere seriamente), ma richiede
// comunque l'header X-Test-Admin-Key con il valore di TEST_ADMIN_KEY, per
// non lasciare i dati di test/il pulsante "rimborsato" apertamente
// pubblici. Il rimborso VERO si fa sempre a mano dal Dashboard Stripe
// (payment_intent_id è mostrato qui apposta): questo endpoint si limita a
// registrare lo stato sul nostro record, come richiesto.

const { app } = require("@azure/functions");
const { STATI, getTableClient } = require("./pagamenti-test-shared");

function chiaveValida(request) {
  const attesa = process.env.TEST_ADMIN_KEY;
  return Boolean(attesa) && request.headers.get("x-test-admin-key") === attesa;
}

app.http("iscrizioni-test-admin-lista", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "iscrizioni-test-admin",
  handler: async (request, context) => {
    if (!chiaveValida(request)) {
      return { status: 401, jsonBody: { error: "Chiave admin di test mancante o errata." } };
    }
    try {
      const tableClient = await getTableClient();
      const risultati = [];
      for await (const entity of tableClient.listEntities()) {
        risultati.push({
          tipoPagamento: entity.partitionKey,
          iscrizioneId: entity.rowKey,
          stato: entity.stato,
          importoTotale: entity.importoTotale,
          dati: entity.datiJson ? JSON.parse(entity.datiJson) : null,
          stripeSessionId: entity.stripeSessionId || null,
          stripePaymentIntentId: entity.stripePaymentIntentId || null,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt
        });
      }
      risultati.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return { status: 200, jsonBody: risultati };
    } catch (err) {
      context.error("Errore elenco iscrizioni test:", err);
      return { status: 500, jsonBody: { error: "Errore interno." } };
    }
  }
});

app.http("iscrizioni-test-admin-rimborso", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "iscrizioni-test-admin/rimborso",
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
    const { tipoPagamento, iscrizioneId } = payload || {};
    if (!tipoPagamento || !iscrizioneId) {
      return { status: 400, jsonBody: { error: "tipoPagamento/iscrizioneId mancanti." } };
    }

    try {
      const tableClient = await getTableClient();
      const record = await tableClient.getEntity(tipoPagamento, iscrizioneId);
      if (record.stato !== STATI.CONFERMATO) {
        return { status: 400, jsonBody: { error: "Solo un'iscrizione confermata può essere segnata come rimborsata." } };
      }
      await tableClient.updateEntity({
        partitionKey: tipoPagamento,
        rowKey: iscrizioneId,
        stato: STATI.RIMBORSATO,
        updatedAt: new Date().toISOString()
      }, "Merge");
      return { status: 200, jsonBody: { ok: true } };
    } catch (err) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: "Record non trovato." } };
      }
      context.error("Errore registrazione rimborso test:", err);
      return { status: 500, jsonBody: { error: "Errore interno." } };
    }
  }
});
