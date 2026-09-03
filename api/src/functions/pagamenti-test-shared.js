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

// --- Sconto socio sugli eventi (dal 2° evento, fino a un tetto di eventi
//     scontati, azzerato ad ogni rinnovo tessera — deciso con l'utente).
//     In Fase 2 importo/tetto vivranno in admin-soci.html sul backend .NET
//     reale, insieme a un vero contatore "eventi da ultimo rinnovo" per
//     socio (da verificare/aggiungere lì — non esiste ancora qui).
//     Qui, in Fase 1, SIMULIAMO entrambi nel nostro Table Storage di test:
//     - config (partitionKey "config"/rowKey "sconto-socio"): importo e
//       tetto, modificabili da test-pagamento-admin.html;
//     - un contatore per email (partitionKey "contatore-eventi-test"),
//       incrementato dal webhook ad ogni evento CONFERMATO per una persona
//       che risulta socia — mai azzerato in Fase 1 (non abbiamo qui il
//       concetto di rinnovo), sufficiente per validare il calcolo prezzo. ---

const DEFAULT_SCONTO_SOCIO_EURO = 5;
const DEFAULT_SCONTO_SOCIO_MAX_EVENTI = 10;

async function leggiConfigScontoSocio() {
  const tableClient = await getTableClient();
  try {
    const entity = await tableClient.getEntity("config", "sconto-socio");
    return {
      scontoSocioEuro: entity.scontoSocioEuro,
      scontoSocioMaxEventi: entity.scontoSocioMaxEventi
    };
  } catch (err) {
    if (err.statusCode === 404) {
      return { scontoSocioEuro: DEFAULT_SCONTO_SOCIO_EURO, scontoSocioMaxEventi: DEFAULT_SCONTO_SOCIO_MAX_EVENTI };
    }
    throw err;
  }
}

async function salvaConfigScontoSocio(config) {
  const tableClient = await getTableClient();
  await tableClient.upsertEntity({
    partitionKey: "config",
    rowKey: "sconto-socio",
    scontoSocioEuro: config.scontoSocioEuro,
    scontoSocioMaxEventi: config.scontoSocioMaxEventi
  }, "Merge");
}

async function leggiContatoreEventiTest(emailNormalizzata) {
  const tableClient = await getTableClient();
  try {
    const entity = await tableClient.getEntity("contatore-eventi-test", emailNormalizzata);
    return entity.eventiConfermati || 0;
  } catch (err) {
    if (err.statusCode === 404) {
      return 0;
    }
    throw err;
  }
}

async function incrementaContatoreEventiTest(emailNormalizzata) {
  const attuale = await leggiContatoreEventiTest(emailNormalizzata);
  const tableClient = await getTableClient();
  await tableClient.upsertEntity({
    partitionKey: "contatore-eventi-test",
    rowKey: emailNormalizzata,
    eventiConfermati: attuale + 1
  }, "Merge");
}

// Verifica se UNA persona ha diritto allo sconto (socia + contatore entro
// il tetto). Usata sia da calcolaRigaEvento (al submit, fonte di verità)
// sia da un endpoint dedicato che il form chiama in anteprima quando si
// esce dal campo email — stessa identica logica nei due punti, non due
// implementazioni che potrebbero disallinearsi.
async function verificaScontoPersona(email) {
  const emailNormalizzata = email.trim().toLowerCase();
  const socio = await verificaSocioEsistente(emailNormalizzata);
  if (!socio) {
    return { socio: false, scontoApplicabile: false, scontoEuro: 0 };
  }
  const config = await leggiConfigScontoSocio();
  const contatore = await leggiContatoreEventiTest(emailNormalizzata);
  const scontoApplicabile = contatore >= 1 && contatore <= config.scontoSocioMaxEventi;
  return { socio: true, scontoApplicabile, scontoEuro: config.scontoSocioEuro };
}

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

// URL di base per i redirect Stripe (success_url/cancel_url): NON una
// Application Setting fissa (richiederebbe reimpostarla ad ogni nuovo
// ambiente di anteprima), ma l'origine mandata dal client
// (window.location.origin), validata contro un elenco di pattern permessi
// — così funziona da sola sia sull'URL stabile sia su ogni futura PR di
// test, senza toccare configurazione.
function baseUrlValida(origine) {
  if (!origine) {
    return null;
  }
  if (/^https:\/\/([a-z0-9-]+\.)*azurestaticapps\.net$/i.test(origine)) {
    return origine;
  }
  if (origine === "https://progettotrame.org") {
    return origine;
  }
  return null;
}

// --- Calcolo importi lato server: mai fidarsi del totale mandato dal
//     client, solo delle SCELTE (evento/modalità/persone) — i prezzi
//     vengono sempre ripresi dal catalogo qui sopra. ---

// Singolo/Gruppo ora richiedono un'email per persona (non solo un numero):
// serve a sapere, persona per persona, se è socia e se le spetta lo sconto
// — l'aperitivo resta invece un semplice numero, mai nominale e mai
// scontato (deciso con l'utente: non matura né riceve lo sconto socio).
async function calcolaRigaEvento(payload) {
  const evento = EVENTI_TEST[payload.eventoId];
  if (!evento) {
    throw new ErroreValidazione("Evento di test non riconosciuto.");
  }

  const modalita = payload.modalita;
  let prezzoBase, etichettaModalita, minPersone, maxPersone;
  if (modalita === "singolo") {
    if (evento.prezzoSingolo == null) {
      throw new ErroreValidazione("Questo evento di test non prevede la modalità Singolo.");
    }
    prezzoBase = evento.prezzoSingolo;
    etichettaModalita = "Singolo";
    minPersone = maxPersone = 1;
  } else if (modalita === "gruppo") {
    if (evento.prezzoGruppoPersona == null) {
      throw new ErroreValidazione("Questo evento di test non prevede la modalità Gruppo.");
    }
    prezzoBase = evento.prezzoGruppoPersona;
    etichettaModalita = "Gruppo";
    minPersone = 2;
    maxPersone = 6;
  } else {
    throw new ErroreValidazione("Modalità di partecipazione non valida.");
  }

  const persone = Array.isArray(payload.persone) ? payload.persone : [];
  if (!(persone.length >= minPersone && persone.length <= maxPersone)) {
    throw new ErroreValidazione(
      "Il numero di persone per " + etichettaModalita + " deve essere tra " + minPersone + " e " + maxPersone + "."
    );
  }
  persone.forEach((p, i) => {
    if (!p || !p.nome || !p.cognome || !p.email) {
      throw new ErroreValidazione("Dati mancanti per la persona " + (i + 1) + ".");
    }
  });

  const emailNormalizzate = persone.map((p) => p.email.trim().toLowerCase());
  const emailViste = new Set();
  for (const email of emailNormalizzate) {
    if (emailViste.has(email)) {
      throw new ErroreValidazione("L'email " + email + " è ripetuta su più persone: ogni persona richiede un'email diversa.");
    }
    emailViste.add(email);
  }

  // Sconto socio: per ciascuna persona, stessa verifica (in parallelo) che
  // il form chiama in anteprima all'uscita dal campo email — vedi
  // verificaScontoPersona qui sopra.
  const risultatiSconto = await Promise.all(emailNormalizzate.map(verificaScontoPersona));
  const numeroScontati = risultatiSconto.filter((r) => r.scontoApplicabile).length;
  const numeroPieni = persone.length - numeroScontati;
  const scontoEuro = risultatiSconto.find((r) => r.scontoApplicabile)
    ? risultatiSconto.find((r) => r.scontoApplicabile).scontoEuro
    : 0;

  const righe = [];
  if (numeroPieni > 0) {
    righe.push({
      descrizione: "Iscrizione " + evento.titolo + " - " + etichettaModalita + " x" + numeroPieni,
      importoUnitario: prezzoBase,
      quantita: numeroPieni
    });
  }
  if (numeroScontati > 0) {
    righe.push({
      descrizione: "Iscrizione " + evento.titolo + " - " + etichettaModalita + " x" + numeroScontati + " (sconto socio)",
      importoUnitario: Math.max(0, prezzoBase - scontoEuro),
      quantita: numeroScontati
    });
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

  return { evento, righe, persone };
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
  baseUrlValida,
  calcolaRigaEvento,
  calcolaRigheTessera,
  leggiQuotaTessera,
  verificaSocioEsistente,
  leggiConfigScontoSocio,
  salvaConfigScontoSocio,
  leggiContatoreEventiTest,
  incrementaContatoreEventiTest,
  verificaScontoPersona,
  totaleRighe,
  ErroreValidazione
};
