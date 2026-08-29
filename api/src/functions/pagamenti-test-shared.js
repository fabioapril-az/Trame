// Modulo condiviso dall'AMBIENTE DI TEST per Stripe Checkout (Fase 1,
// vedi test-pagamento.html). Isolato di proposito da tutto il resto:
// - chiavi Stripe SOLO test (sk_test_/whsec_ di test), lette da variabili
//   d'ambiente dedicate (STRIPE_SECRET_KEY_TEST/STRIPE_WEBHOOK_SECRET_TEST);
// - i record vivono in un Table Storage tutto nostro (tabella
//   "IscrizioniTest", connection string PAGAMENTI_TEST_STORAGE_CONNECTION_STRING),
//   separato dal database del backend .NET che gestisce i veri soci/eventi
//   (vedi memoria di progetto "trame-two-console-workflow": quel backend è
//   un repo/console diverso, non toccato da qui). Nessun collegamento ai
//   dati reali finché non si passa alla Fase 2 con indicazioni condivise a
//   quella console.
//
// Catalogo eventi di test: hardcoded qui (nessun admin.html toccato in
// Fase 1), tre eventi con combinazioni diverse dei 3 prezzi opzionali per
// verificare la logica "singolo/gruppo alternativi, aperitivo sempre
// combinabile, opzione assente se il prezzo non è impostato".

const { TableClient } = require("@azure/data-tables");

const NOME_TABELLA = "IscrizioniTest";

const EVENTI_TEST = {
  "evt-cena": {
    id: "evt-cena",
    titolo: "Cena conviviale (test)",
    prezzoSingolo: 25,
    prezzoGruppoPersona: 20,
    prezzoAperitivoPersona: 8
  },
  "evt-laboratorio": {
    id: "evt-laboratorio",
    titolo: "Laboratorio creativo (test)",
    prezzoSingolo: 15,
    prezzoGruppoPersona: null,
    prezzoAperitivoPersona: null
  },
  "evt-aperitivo-gruppo": {
    id: "evt-aperitivo-gruppo",
    titolo: "Uscita di gruppo (test)",
    prezzoSingolo: null,
    prezzoGruppoPersona: 18,
    prezzoAperitivoPersona: 10
  }
};

// Backend .NET reale (vedi assets/js/trame-config.js): usato QUI SOLO in
// lettura, per due controlli che ha senso fare contro i dati veri anche in
// Fase 1 — non scriviamo mai nulla lì. Stessi endpoint pubblici (nessun
// token) già chiamati da iscrizione-evento.html/diventa-socio.html.
const BACKEND_API_BASE_URL = "https://app-trame-prod.azurewebsites.net";

// Prezzo tessera: NON hardcoded — letto da /api/impostazioni sul backend
// reale (campo quotaIscrizioneSoci, configurabile in admin-soci.html,
// sezione "Iscrizione soci"), lo stesso valore già mostrato a chi si vuole
// associare da iscrizione-evento.html. Così l'unico posto dove si cambia
// il prezzo resta quel pannello admin, non il codice.
async function leggiQuotaTessera() {
  let res;
  try {
    res = await fetch(BACKEND_API_BASE_URL + "/api/impostazioni");
  } catch (err) {
    throw new ErroreValidazione("Impossibile contattare il backend per leggere la quota tessera (rete non raggiungibile).");
  }
  if (!res.ok) {
    throw new ErroreValidazione("Impossibile leggere la quota tessera dal backend (risposta " + res.status + ").");
  }
  const impostazioni = await res.json();
  if (!impostazioni || !impostazioni.quotaIscrizioneSoci) {
    throw new ErroreValidazione(
      "Quota tessera non configurata: impostala in admin-soci.html, sezione \"Iscrizione soci\" (Quota associativa)."
    );
  }
  return impostazioni.quotaIscrizioneSoci;
}

// Verifica (sola lettura) se un'email è già di un socio esistente, per non
// far pagare una tessera nuova a chi ce l'ha già — stesso endpoint pubblico
// usato da iscrizione-evento.html per la stessa ragione.
async function verificaSocioEsistente(email) {
  let res;
  try {
    res = await fetch(BACKEND_API_BASE_URL + "/api/soci/verifica?email=" + encodeURIComponent(email));
  } catch (err) {
    throw new ErroreValidazione("Impossibile verificare se " + email + " è già socio/a (rete non raggiungibile).");
  }
  if (!res.ok) {
    throw new ErroreValidazione("Impossibile verificare se " + email + " è già socio/a (risposta " + res.status + ").");
  }
  const risultato = await res.json();
  return Boolean(risultato && risultato.trovato);
}

const STATI = {
  IN_ATTESA: "in_attesa_pagamento",
  CONFERMATO: "confermato",
  ANNULLATO: "annullato",
  RIMBORSATO: "rimborsato"
};

let tableClientPromise = null;

// Crea il client e assicura che la tabella esista, una sola volta per
// cold start (chiamate successive riusano la stessa promise).
function getTableClient() {
  if (!tableClientPromise) {
    tableClientPromise = (async () => {
      const connectionString = process.env.PAGAMENTI_TEST_STORAGE_CONNECTION_STRING;
      if (!connectionString) {
        throw new Error("Manca PAGAMENTI_TEST_STORAGE_CONNECTION_STRING nelle impostazioni della Function.");
      }
      const client = TableClient.fromConnectionString(connectionString, NOME_TABELLA, {
        allowInsecureConnection: connectionString.indexOf("UseDevelopmentStorage=true") !== -1
      });
      try {
        await client.createTable();
      } catch (err) {
        // 409 = tabella già esistente: normale dopo il primo cold start.
        if (err.statusCode !== 409) {
          throw err;
        }
      }
      return client;
    })();
  }
  return tableClientPromise;
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY_TEST;
  if (!key) {
    throw new Error("Manca STRIPE_SECRET_KEY_TEST nelle impostazioni della Function.");
  }
  if (key.indexOf("sk_test_") !== 0) {
    // Guardia esplicita: questo ambiente è SOLO di test, non deve mai
    // poter girare per sbaglio con una chiave live.
    throw new Error("STRIPE_SECRET_KEY_TEST non è una chiave di test (deve iniziare con sk_test_).");
  }
  return require("stripe")(key);
}

function baseUrl() {
  return (process.env.SITE_BASE_URL_TEST || "").replace(/\/+$/, "");
}

// --- Calcolo importi lato server: mai fidarsi del totale mandato dal
//     client, solo delle SCELTE (evento/modalità/persone) — i prezzi
//     vengono sempre ripresi dal catalogo qui sopra. ---

function calcolaRigaEvento(payload) {
  const evento = EVENTI_TEST[payload.eventoId];
  if (!evento) {
    throw new ErroreValidazione("Evento di test non riconosciuto.");
  }

  const righe = [];
  const modalita = payload.modalita;

  if (modalita === "singolo") {
    if (evento.prezzoSingolo == null) {
      throw new ErroreValidazione("Questo evento di test non prevede la modalità Singolo.");
    }
    righe.push({
      descrizione: "Iscrizione " + evento.titolo + " - Singolo",
      importoUnitario: evento.prezzoSingolo,
      quantita: 1
    });
  } else if (modalita === "gruppo") {
    if (evento.prezzoGruppoPersona == null) {
      throw new ErroreValidazione("Questo evento di test non prevede la modalità Gruppo.");
    }
    const numeroPersone = parseInt(payload.numeroPersoneGruppo, 10);
    if (!(numeroPersone >= 2 && numeroPersone <= 6)) {
      throw new ErroreValidazione("Il numero di persone per il Gruppo deve essere tra 2 e 6.");
    }
    righe.push({
      descrizione: "Iscrizione " + evento.titolo + " - Gruppo x" + numeroPersone,
      importoUnitario: evento.prezzoGruppoPersona,
      quantita: numeroPersone
    });
  } else {
    throw new ErroreValidazione("Modalità di partecipazione non valida.");
  }

  const personeAperitivo = parseInt(payload.personeAperitivo, 10) || 0;
  if (personeAperitivo > 0) {
    if (evento.prezzoAperitivoPersona == null) {
      throw new ErroreValidazione("Questo evento di test non prevede l'opzione Aperitivo.");
    }
    if (personeAperitivo > 6) {
      throw new ErroreValidazione("Le persone solo aperitivo devono essere al massimo 6.");
    }
    righe.push({
      descrizione: "Aperitivo x" + personeAperitivo + " person" + (personeAperitivo === 1 ? "a" : "e"),
      importoUnitario: evento.prezzoAperitivoPersona,
      quantita: personeAperitivo
    });
  }

  return { evento, righe };
}

async function calcolaRigheTessera(payload) {
  const numeroTessere = parseInt(payload.numeroTessere, 10);
  if (!(numeroTessere >= 1 && numeroTessere <= 5)) {
    throw new ErroreValidazione("Il numero di tessere deve essere tra 1 e 5.");
  }
  const persone = Array.isArray(payload.persone) ? payload.persone : [];
  if (persone.length !== numeroTessere) {
    throw new ErroreValidazione("Il numero di blocchi persona non corrisponde al numero di tessere.");
  }
  persone.forEach((p, i) => {
    if (!p || !p.nome || !p.cognome || !p.email) {
      throw new ErroreValidazione("Dati mancanti per la persona " + (i + 1) + ".");
    }
  });

  // Stessa email su più blocchi: quasi certamente un errore di battitura
  // (o un tentativo di far pagare due tessere alla stessa persona), non un
  // caso legittimo — le tessere sono nominali.
  const emailNormalizzate = persone.map((p) => p.email.trim().toLowerCase());
  const emailViste = new Set();
  for (const email of emailNormalizzate) {
    if (emailViste.has(email)) {
      throw new ErroreValidazione("L'email " + email + " è ripetuta su più persone: ogni tessera richiede un'email diversa.");
    }
    emailViste.add(email);
  }

  // Verifica (in parallelo) che nessuna delle persone sia già socia
  // esistente: evita di far pagare una tessera nuova a chi ce l'ha già.
  const risultatiVerifica = await Promise.all(emailNormalizzate.map(verificaSocioEsistente));
  risultatiVerifica.forEach((giaSocio, i) => {
    if (giaSocio) {
      throw new ErroreValidazione(
        "L'email " + persone[i].email + " risulta già di un socio/a esistente: non serve una nuova tessera."
      );
    }
  });

  const prezzoTessera = await leggiQuotaTessera();
  const righe = [{
    descrizione: "Tessera associazione x" + numeroTessere,
    importoUnitario: prezzoTessera,
    quantita: numeroTessere
  }];

  return { numeroTessere, persone, righe };
}

function totaleRighe(righe) {
  return righe.reduce((somma, r) => somma + r.importoUnitario * r.quantita, 0);
}

class ErroreValidazione extends Error {}

module.exports = {
  EVENTI_TEST,
  STATI,
  getTableClient,
  getStripe,
  baseUrl,
  calcolaRigaEvento,
  calcolaRigheTessera,
  leggiQuotaTessera,
  verificaSocioEsistente,
  totaleRighe,
  ErroreValidazione
};
