// POST /api/create-checkout-session-test
// Endpoint di TEST (Fase 1, vedi test-pagamento.html): salva subito un
// record "in_attesa_pagamento" con un iscrizione_id univoco, poi crea una
// Stripe Checkout Session e restituisce l'URL a cui reindirizzare il
// browser. Nei metadata della sessione va SOLO iscrizione_id/tipo_pagamento
// (mai dati anagrafici): sono quelli che il webhook userà per ritrovare e
// aggiornare il record.
//
// I metodi di pagamento (carta, PayPal, eventuali wallet come Satispay) non
// sono elencati qui: si lascia che Stripe Checkout usi automaticamente
// quelli abilitati nel Dashboard (Impostazioni > Metodi di pagamento) per
// l'account collegato alla chiave di test — nessuna modifica al codice
// serve per abilitarne uno nuovo.
//
// Flusso tessera (vedi calcolaRigheTessera in pagamenti-test-shared.js):
// email duplicate nello stesso invio rifiutate, ciascuna email verificata
// (sola lettura) contro il backend .NET reale per non far pagare una
// tessera a chi è già socio, prezzo sempre letto da quotaIscrizioneSoci
// (admin-soci.html) — mai hardcoded qui.
//
// Flusso evento (vedi calcolaRigaEvento): Singolo/Gruppo richiedono un'email
// per persona per applicare lo sconto socio persona per persona (dal 2°
// evento, fino al tetto configurato — vedi test-pagamento-admin.html per
// importo/tetto in Fase 1, admin-soci.html in Fase 2); l'aperitivo resta un
// semplice numero, mai scontato.

const { app } = require("@azure/functions");
const {
  STATI,
  getTableClient,
  getStripe,
  baseUrl,
  calcolaRigaEvento,
  calcolaRigheTessera,
  totaleRighe,
  ErroreValidazione
} = require("./pagamenti-test-shared");

app.http("create-checkout-session-test", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "create-checkout-session-test",
  handler: async (request, context) => {
    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return { status: 400, jsonBody: { error: "Corpo della richiesta non valido (JSON atteso)." } };
    }

    const tipoPagamento = payload && payload.tipoPagamento;
    if (tipoPagamento !== "evento" && tipoPagamento !== "tessera") {
      return { status: 400, jsonBody: { error: "tipoPagamento deve essere 'evento' o 'tessera'." } };
    }

    // Generato dal client una sola volta per tentativo di pagamento (stesso
    // valore anche se il fetch viene ripetuto per un problema di rete):
    // usato come idempotency key verso Stripe, così un doppio invio della
    // STESSA richiesta non crea due Checkout Session/due addebiti. Se manca
    // (client vecchio, o richiesta di test manuale) se ne genera uno qui,
    // che però non protegge da un doppio invio dal client.
    const richiestaId = typeof payload.richiestaId === "string" && payload.richiestaId
      ? payload.richiestaId
      : crypto.randomUUID();

    let righe;
    let datiRecord;
    try {
      if (tipoPagamento === "evento") {
        const { evento, righe: righeEvento, persone } = await calcolaRigaEvento(payload);
        righe = righeEvento;
        datiRecord = {
          persone,
          eventoId: evento.id,
          eventoTitolo: evento.titolo,
          modalita: payload.modalita,
          personeAperitivo: parseInt(payload.personeAperitivo, 10) || 0,
          aperitivoAllergie: (payload.aperitivoAllergie || "").trim() || null
        };
      } else {
        const { numeroTessere, persone, righe: righeTessera } = await calcolaRigheTessera(payload);
        righe = righeTessera;
        datiRecord = { numeroTessere, persone };
      }
    } catch (err) {
      if (err instanceof ErroreValidazione) {
        return { status: 400, jsonBody: { error: err.message } };
      }
      context.error("Errore di calcolo importo:", err);
      return { status: 500, jsonBody: { error: "Errore interno nel calcolo dell'importo." } };
    }

    const importoTotale = totaleRighe(righe);
    const iscrizioneId = crypto.randomUUID();
    const ora = new Date().toISOString();

    let tableClient;
    try {
      tableClient = await getTableClient();
      await tableClient.createEntity({
        partitionKey: tipoPagamento,
        rowKey: iscrizioneId,
        stato: STATI.IN_ATTESA,
        datiJson: JSON.stringify(datiRecord),
        importoTotale: importoTotale,
        stripeSessionId: null,
        stripePaymentIntentId: null,
        createdAt: ora,
        updatedAt: ora
      });
    } catch (err) {
      context.error("Errore salvataggio record test:", err);
      return { status: 500, jsonBody: { error: "Errore nel salvataggio dell'iscrizione di test." } };
    }

    let session;
    try {
      const stripe = getStripe();
      const base = baseUrl();
      if (!base) {
        throw new Error("Manca SITE_BASE_URL_TEST nelle impostazioni della Function.");
      }
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: righe.map((r) => ({
          price_data: {
            currency: "eur",
            unit_amount: Math.round(r.importoUnitario * 100),
            product_data: { name: r.descrizione }
          },
          quantity: r.quantita
        })),
        metadata: {
          iscrizione_id: iscrizioneId,
          tipo_pagamento: tipoPagamento
        },
        success_url: base + "/test-pagamento-ok.html?iscrizione_id=" + encodeURIComponent(iscrizioneId) +
          "&tipo=" + encodeURIComponent(tipoPagamento),
        cancel_url: base + "/test-pagamento.html?annullato=1"
      }, { idempotencyKey: "checkout-test-" + richiestaId });
    } catch (err) {
      context.error("Errore creazione Checkout Session:", err);
      return { status: 500, jsonBody: { error: "Errore nella creazione della sessione di pagamento Stripe." } };
    }

    try {
      await tableClient.updateEntity({
        partitionKey: tipoPagamento,
        rowKey: iscrizioneId,
        stripeSessionId: session.id
      }, "Merge");
    } catch (err) {
      // Non blocca il checkout: il webhook ritroverà comunque il record
      // tramite iscrizione_id nei metadata, stripeSessionId è solo un
      // riferimento comodo per il debug in admin.
      context.warn("Impossibile salvare stripeSessionId sul record:", err);
    }

    return { status: 200, jsonBody: { url: session.url, iscrizioneId: iscrizioneId, importoTotale: importoTotale } };
  }
});
