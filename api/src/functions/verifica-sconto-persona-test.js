// GET /api/verifica-sconto-persona-test?email=...
// Usato da test-pagamento.js per mostrare un'anteprima realistica del
// totale (con lo sconto socio, se spetta) quando si esce dal campo email —
// stessa identica funzione (verificaScontoPersona) che calcolaRigaEvento
// userà come fonte di verità al momento del pagamento: qui è solo
// un'anteprima, il contatore potrebbe cambiare nel frattempo (es. un altro
// checkout completato nel mezzo), quindi il server ricalcola comunque da
// zero al submit — non fidarsi mai di un totale mandato dal client.

const { app } = require("@azure/functions");
const { verificaScontoPersona } = require("./pagamenti-test-shared");

app.http("verifica-sconto-persona-test", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "verifica-sconto-persona-test",
  handler: async (request, context) => {
    const email = request.query.get("email");
    if (!email || !email.trim()) {
      return { status: 400, jsonBody: { error: "Parametro email mancante." } };
    }
    try {
      const risultato = await verificaScontoPersona(email);
      return { status: 200, jsonBody: risultato };
    } catch (err) {
      context.error("Errore verifica sconto persona:", err);
      return { status: 500, jsonBody: { error: "Errore interno." } };
    }
  }
});
