// POST /api/stripe-webhook-test
// Endpoint di TEST per il webhook Stripe (Fase 1). Da configurare nel
// Dashboard Stripe (modalità Test) puntando a
// https://<host-static-web-app>/api/stripe-webhook-test, oppure in locale
// con `stripe listen --forward-to http://localhost:7071/api/stripe-webhook-test`
// (il segreto stampato da quel comando va in STRIPE_WEBHOOK_SECRET_TEST).
//
// Eventi gestiti:
// - checkout.session.completed  -> stato: confermato, salva payment_intent_id
// - checkout.session.expired    -> stato: annullato (solo se ancora in attesa)
// Nessun altro evento tocca lo stato: niente cancellazione automatica dei
// dati, il rimborso è un'azione manuale separata (vedi iscrizioni-test-admin.js).

const { app } = require("@azure/functions");
const { STATI, getTableClient, getStripe } = require("./pagamenti-test-shared");

app.http("stripe-webhook-test", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "stripe-webhook-test",
  handler: async (request, context) => {
    const signature = request.headers.get("stripe-signature");
    const rawBody = await request.text();

    let event;
    try {
      const stripe = getStripe();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST;
      if (!webhookSecret) {
        throw new Error("Manca STRIPE_WEBHOOK_SECRET_TEST nelle impostazioni della Function.");
      }
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      context.warn("Firma webhook non valida:", err.message);
      return { status: 400, jsonBody: { error: "Firma non valida." } };
    }

    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.expired") {
      // Riconosciuto ma non ci interessa (es. payment_intent.*): 200 per
      // evitare che Stripe continui a ritentare inutilmente.
      return { status: 200, jsonBody: { ricevuto: true, ignorato: event.type } };
    }

    const session = event.data.object;
    const iscrizioneId = session.metadata && session.metadata.iscrizione_id;
    const tipoPagamento = session.metadata && session.metadata.tipo_pagamento;
    if (!iscrizioneId || !tipoPagamento) {
      context.warn("Sessione senza metadata iscrizione_id/tipo_pagamento:", session.id);
      return { status: 200, jsonBody: { ricevuto: true, ignorato: "metadata mancanti" } };
    }

    try {
      const tableClient = await getTableClient();
      const record = await tableClient.getEntity(tipoPagamento, iscrizioneId);

      if (event.type === "checkout.session.completed") {
        await tableClient.updateEntity({
          partitionKey: tipoPagamento,
          rowKey: iscrizioneId,
          stato: STATI.CONFERMATO,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          updatedAt: new Date().toISOString()
        }, "Merge");
      } else if (event.type === "checkout.session.expired") {
        // Non sovrascrive un record già confermato/rimborsato per una corsa
        // rara in cui l'evento di scadenza arrivasse dopo il completamento.
        if (record.stato === STATI.IN_ATTESA) {
          await tableClient.updateEntity({
            partitionKey: tipoPagamento,
            rowKey: iscrizioneId,
            stato: STATI.ANNULLATO,
            updatedAt: new Date().toISOString()
          }, "Merge");
        }
      }
    } catch (err) {
      if (err.statusCode === 404) {
        context.warn("Record iscrizione_id non trovato per il webhook:", iscrizioneId);
        return { status: 200, jsonBody: { ricevuto: true, ignorato: "record non trovato" } };
      }
      context.error("Errore aggiornamento record da webhook:", err);
      return { status: 500, jsonBody: { error: "Errore interno nell'aggiornamento del record." } };
    }

    return { status: 200, jsonBody: { ricevuto: true } };
  }
});
