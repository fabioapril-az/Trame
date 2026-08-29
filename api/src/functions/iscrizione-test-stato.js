// GET /api/iscrizione-test-stato?id=...&tipo=evento|tessera
// Endpoint di TEST usato da test-pagamento-ok.html per mostrare lo stato
// reale del record (il redirect di Stripe è immediato, ma il webhook che
// conferma il pagamento può arrivare qualche istante dopo: la pagina fa
// polling su questo endpoint finché lo stato non è più "in attesa").
// Nessun dato sensibile oltre stato/importo/riferimenti Stripe: i dati
// anagrafici raccolti nel form non vengono restituiti qui.

const { app } = require("@azure/functions");
const { getTableClient } = require("./pagamenti-test-shared");

app.http("iscrizione-test-stato", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "iscrizione-test-stato",
  handler: async (request, context) => {
    const iscrizioneId = request.query.get("id");
    const tipoPagamento = request.query.get("tipo");
    if (!iscrizioneId || (tipoPagamento !== "evento" && tipoPagamento !== "tessera")) {
      return { status: 400, jsonBody: { error: "Parametri id/tipo mancanti o non validi." } };
    }

    try {
      const tableClient = await getTableClient();
      const record = await tableClient.getEntity(tipoPagamento, iscrizioneId);
      return {
        status: 200,
        jsonBody: {
          iscrizioneId: record.rowKey,
          stato: record.stato,
          importoTotale: record.importoTotale,
          stripePaymentIntentId: record.stripePaymentIntentId || null
        }
      };
    } catch (err) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: "Iscrizione di test non trovata." } };
      }
      context.error("Errore lettura stato iscrizione test:", err);
      return { status: 500, jsonBody: { error: "Errore interno." } };
    }
  }
});
