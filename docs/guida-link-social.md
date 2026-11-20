# Link per social, inserzioni e messaggi

Come preparare i link agli eventi di TraMe da usare su Instagram, Facebook, nelle inserzioni sponsorizzate, su WhatsApp e nelle newsletter, in modo che la pagina **Statistiche del sito** (progettotrame.org/admin-analytics.html) sappia da dove arriva ogni persona.

Un link ben fatto ha due parti:

1. **l'indirizzo dell'evento**, che mostra l'anteprima con foto, titolo e descrizione quando lo condividi;
2. **i parametri UTM** in fondo, che dicono alle statistiche da quale canale e da quale campagna arriva chi clicca.

---

## 1. Trovare l'indirizzo dell'evento

1. Apri **progettotrame.org/eventi.html**.
2. Sulla scheda dell'evento premi **Dettagli**.
3. Copia l'indirizzo dalla barra del browser. Ha questa forma:

   `https://progettotrame.org/eventi/ortica-storie-e-murales-21-novembre-21/`

Questo è l'indirizzo da condividere: è quello che Google indicizza e che su WhatsApp, Facebook e Instagram mostra l'anteprima con la foto dell'evento.

> **Se cambi il titolo dell'evento, cambia anche l'indirizzo.** Dopo una modifica del titolo ricopialo dal sito: quello vecchio smette di funzionare.

I vecchi link del tipo `evento.html?id=21`, già usati in passato, continuano a funzionare, ma non mostrano l'anteprima e non vengono indicizzati da Google. Per i post nuovi usa l'indirizzo nuovo.

---

## 2. Aggiungere i parametri UTM

In fondo all'indirizzo dell'evento aggiungi i parametri del canale che stai usando. Al posto di **NOME** scrivi il nome della campagna (vedi il paragrafo 3).

| Dove pubblichi il link | Cosa aggiungi in fondo all'indirizzo | Nelle statistiche compare come |
|---|---|---|
| **Instagram**: link in bio, adesivo "Link" nelle storie | `?utm_source=instagram&utm_medium=social&utm_campaign=NOME` | Instagram (organico) |
| **Facebook**: post, pagina, gruppi | `?utm_source=facebook&utm_medium=social&utm_campaign=NOME` | Facebook (organico) |
| **WhatsApp**: messaggi, gruppi, stato | `?utm_source=whatsapp&utm_medium=messaggio&utm_campaign=NOME` | Altre campagne |
| **Newsletter o email** | `?utm_source=newsletter&utm_medium=email&utm_campaign=NOME` | Altre campagne |
| **Volantini e locandine con QR code** | `?utm_source=volantino&utm_medium=qr&utm_campaign=NOME` | Altre campagne |
| **Inserzioni sponsorizzate Meta** (Facebook e Instagram) | Niente nel link: vedi il paragrafo 4 | Facebook (inserzioni) o Instagram (inserzioni) |

**Esempio completo**, per una storia Instagram dell'evento Ortica:

`https://progettotrame.org/eventi/ortica-storie-e-murales-21-novembre-21/?utm_source=instagram&utm_medium=social&utm_campaign=ortica-novembre`

Se l'indirizzo contiene già un `?`, il primo parametro va attaccato con `&` invece che con `?`.

### Perché servono

Instagram e WhatsApp **non comunicano al sito da dove arriva la persona**. Senza UTM, quelle visite finiscono tutte in "Diretto o non identificato" e non si capisce quale post o quale messaggio ha funzionato. Facebook a volte la comunica, ma non distingue un post normale da un'inserzione.

---

## 3. Scegliere il nome della campagna

- **solo minuscole, numeri e trattini**: niente spazi, accenti o apostrofi;
- **breve e riconoscibile**: per esempio `ortica-novembre`, `yoga-nidra-avvento`, `tessera-2027`;
- **lo stesso nome su tutti i canali dello stesso evento**: così nelle statistiche, sezione **Campagne**, confronti direttamente Instagram, Facebook, WhatsApp e newsletter per quell'evento.

Il canale si distingue già da `utm_source`, quindi non serve metterlo nel nome: `ortica-novembre` va bene sia per Instagram sia per WhatsApp.

---

## 4. Inserzioni sponsorizzate su Facebook e Instagram

Nelle inserzioni il link si scrive **senza** UTM. I parametri si inseriscono una volta in Gestione inserzioni e Meta li compila da sola:

1. In **Gestione inserzioni** apri l'inserzione, al livello **Inserzione**, non Campagna o Gruppo di inserzioni.
2. Nella sezione **Monitoraggio**, nel campo **Parametri URL**, incolla esattamente:

   `utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}`

3. Come **URL del sito web** metti l'indirizzo dell'evento, senza nulla in fondo.

Meta sostituisce da sola `{{site_source_name}}` con Facebook o Instagram, a seconda di dove è stata vista l'inserzione, e `{{campaign.name}}` con il nome della campagna. Per questo conviene dare alle campagne Meta un nome semplice, con le stesse regole del paragrafo 3.

Lo stesso campo va compilato in **ogni** inserzione. Se duplichi un'inserzione già compilata, i parametri vengono copiati.

---

## 5. Link diretto alla prenotazione

Se preferisci portare le persone **direttamente al pagamento**, puoi usare la pagina di prenotazione, con gli stessi UTM:

`https://progettotrame.org/iscrizione-evento.html?id=21&utm_source=instagram&utm_medium=social&utm_campaign=ortica-novembre`

(qui il primo parametro si attacca con `&`, perché l'indirizzo ha già `?id=21`).

Nelle statistiche è contato come **"clic link diretto"**. Il numero dell'evento (`id=21`) lo trovi in fondo all'indirizzo della pagina evento, dopo l'ultimo trattino.

Ha due svantaggi: il link condiviso **non mostra l'anteprima** con foto, e chi arriva non legge la descrizione prima di decidere. Per post e storie è meglio la pagina dell'evento. Il link diretto è utile quando la persona ha già deciso, per esempio in un messaggio di promemoria.

---

## 6. Link accorciati

Per la bio di Instagram puoi usare un servizio come **Linktree** o **Bitly**. Gli UTM restano validi, purché il link accorciato porti all'indirizzo **completo**, parametri compresi. Prima di pubblicarlo, prova il link accorciato e controlla che nella barra del browser compaiano ancora gli `utm_…`.

---

## 7. Dove vedere i risultati

**progettotrame.org/admin-analytics.html**, con il login admin:

- **Provenienza**: quante persone per canale (Instagram, Facebook, inserzioni, Google, altre campagne, diretto);
- **Campagne**: i numeri per nome della campagna, divisi per canale;
- **Per evento**: visite, clic su Prenota, avvii di pagamento e acquisti di ogni evento.

Prima di controllare, ricordati di escludere il tuo dispositivo, con il pulsante in fondo alla pagina delle statistiche, altrimenti le tue prove si sommano ai numeri veri.

---

## Promemoria veloce

```
Indirizzo:   progettotrame.org/eventi.html → Dettagli → copia l'indirizzo
Instagram:   ?utm_source=instagram&utm_medium=social&utm_campaign=NOME
Facebook:    ?utm_source=facebook&utm_medium=social&utm_campaign=NOME
WhatsApp:    ?utm_source=whatsapp&utm_medium=messaggio&utm_campaign=NOME
Newsletter:  ?utm_source=newsletter&utm_medium=email&utm_campaign=NOME
QR code:     ?utm_source=volantino&utm_medium=qr&utm_campaign=NOME
Inserzioni:  Parametri URL → utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}
NOME:        minuscole e trattini, uguale su tutti i canali dello stesso evento
```
