# Guida al backoffice del sito TraMe

Per i membri del direttivo. Serve a essere autonomi su tre cose: pubblicare e gestire gli eventi, tenere in ordine il Libro Soci, e controllare i pagamenti.

Non serve sapere nulla di tecnico. Dove c'è un rischio di combinare un guaio, è scritto in chiaro.

---

## 1. Entrare

Le pagine riservate sono tre, e si aprono direttamente dal browser:

| Pagina | Indirizzo | A cosa serve |
|---|---|---|
| Impostazioni ed eventi | progettotrame.org/admin.html | Creare e gestire gli eventi, link social, galleria |
| Libro Soci | progettotrame.org/admin-soci.html | Soci, tessere, rinnovi, scadenze |
| Pagamenti | progettotrame.org/admin-pagamenti.html | Tutti gli incassi in un unico elenco, con export |

Da ciascuna si passa alle altre due con i link in alto.

Su ogni pagina si accede con **Accedi** in alto a destra, usando il proprio account Microsoft dell'associazione. Non esiste una password del sito: l'accesso è quello dell'account. Chi non è stato autorizzato non vede nulla, anche conoscendo l'indirizzo.

**Se hai appena ricevuto un permesso nuovo**, esci e rientra: il permesso viene letto al momento dell'accesso, quindi in una sessione già aperta non compare.

---

## 2. Permessi: chi può fare cosa

### I ruoli che esistono

I permessi si danno assegnando **ruoli** a una persona. Una persona può averne più di uno, e in quel caso può fare la somma delle cose.

| Ruolo | Pensato per |
|---|---|
| **Presidente** | Tutto: eventi, soci, impostazioni, incassi |
| **Segretario** | Anagrafica soci, tessere, rinnovi, scadenze, consensi |
| **VicePresidente** | Tesoriere: vede il Libro Soci, registra incassi e rinnovi |
| **GestionePagamenti** | Solo la cassa: registra e corregge incassi, senza accedere all'anagrafica |
| **Admin** | Amministrazione tecnica del sistema. Non è una carica del direttivo |

> **Nota sul ruolo GestionePagamenti.** Oggi va assegnato **in aggiunta** a una carica. Chi lo avesse soltanto lui è autorizzato a registrare gli incassi, ma le pagine descritte in questa guida non sono fatte per lui: aprendo il Libro Soci o la pagina Pagamenti troverebbe una tabella vuota, perché quelle mostrano anche dati che a lui non competono e il sistema glieli nega. La parte che gli serve — un elenco ridotto con solo nome, tessera e stato dell'incasso — esiste già nel sistema ma non ha ancora una pagina. Fino ad allora, assegna questo ruolo solo a chi ha già una carica.

### Chi può fare cosa, azione per azione

Le pagine mostrano gli stessi pulsanti a tutti (vedi sotto il perché). Questa è la tabella di chi viene effettivamente autorizzato.

| Azione | Presidente | Segretario | VicePresidente | Solo cassa |
|---|---|---|---|---|
| Creare, modificare, eliminare un evento | sì | **no** | **no** | no |
| Immagine di un evento | sì | **no** | **no** | no |
| Salvare le impostazioni (link social, quota associativa, sconti) | sì | **no** | **no** | no |
| Vedere gli iscritti e gli interessati di un evento | sì | sì | sì | no |
| Annullare o eliminare un'iscrizione, segnare rimborsi | sì | sì | **no** | no |
| Cercare i soci, vedere lo storico di un socio | sì | sì | sì | no |
| Modificare o eliminare un socio, export CSV, scadenze | sì | sì | **no** | no |
| Rinnovare una tessera | sì | sì | sì | **no** |
| Registrare o correggere un incasso (quota, pagamento iscrizione) | sì | sì | sì | sì |
| Confermare un pagamento manuale | sì | sì | sì | sì |
| Vedere la pagina Pagamenti | sì | sì | sì | **no** |
| Scaricare la tessera di un socio | sì | sì | sì | no |

Il ruolo **Admin** può fare tutto: è amministrazione tecnica, non una carica.

Le caselle che sorprendono di più, e che vale la pena sapere prima di sbatterci contro:

- **Gli eventi li gestiscono solo Presidente e Admin.** Segretario e Vicepresidente vedono la pagina e i pulsanti, ma non possono creare né modificare un evento.
- **Anche le impostazioni sono di Presidente e Admin**, comprese la quota associativa e lo sconto socio, che pure riguardano solo i soci. È un limite noto: il permesso vale per l'intera schermata, non campo per campo. Un Segretario che deve cambiare la quota la fa cambiare al Presidente.
- **Il Vicepresidente/tesoriere vede il Libro Soci, gli iscritti e i pagamenti, e incassa, ma non modifica l'anagrafica.** Può rinnovare e registrare incassi, non può modificare o eliminare un socio, né esportare l'elenco, né annullare un'iscrizione, né caricare l'elenco delle tessere in scadenza.
- **Chi tiene solo la cassa non può rinnovare**, ed è voluto: il rinnovo sposta la scadenza della tessera, quindi cambia l'anagrafica. Per registrare i soldi di una tessera c'è *Registra quota*.

### Come si assegna un ruolo a una persona

1. Vai su **portal.azure.com** e accedi con l'account dell'associazione.
2. Cerca in alto **Microsoft Entra ID** e apri **Applicazioni aziendali** (in inglese: Enterprise applications).
3. Cerca e apri **Trame Backoffice**.
4. Nel menù a sinistra apri **Utenti e gruppi**, poi **Aggiungi utente/gruppo**.
5. Scegli la persona, poi nella colonna del ruolo scegli quale darle. Conferma con **Assegna**.

Per dare a una persona **due ruoli**, si ripete l'operazione una volta per ruolo: compaiono due righe con lo stesso nome.

Per **togliere** un permesso: stessa schermata, si seleziona la riga e si usa **Rimuovi**.

**Due cose che fermano tutti la prima volta:**

- *"Utenti e gruppi non c'è."* Se nel menù a sinistra vedi voci come *App roles*, *Certificati e segreti*, *Manifest*, sei in **Registrazioni app**, che è la stessa applicazione vista dal lato tecnico. Le assegnazioni stanno in **Applicazioni aziendali**. Scorciatoia: nella schermata di panoramica, il link *Managed application in local directory* porta esattamente dove serve.
- *"La persona non compare nell'elenco."* Chi assegni deve esistere come utente nel sistema dell'associazione. Chi ha solo un indirizzo personale (Gmail, Libero...) va prima invitato come utente ospite, sempre da Microsoft Entra ID → Utenti → Invita utente esterno.

### Se qualcuno vede un pulsante ma prende un errore di permesso

Le pagine mostrano gli stessi pulsanti a tutti: chi può fare una cosa lo decide il sistema nel momento in cui la si fa, non l'aspetto della pagina. Quindi è normale che un pulsante esista e che, premendolo, una persona senza quel permesso riceva un messaggio che dice che non è autorizzata. Non è un guasto: è il caso in cui l'operazione va chiesta a chi ha il ruolo giusto.

---

## 3. Inserire un nuovo evento

Si fa su **admin.html**, scheda **Eventi**, con **+ Nuovo evento**.

### Il minimo indispensabile

- **Titolo**
- **Descrizione breve**: è il testo della scheda che si vede nell'elenco eventi del sito. Tienila corta.
- **Stato**: vedi sotto. Per lavorare in pace, parti da *Bozza*.

Tutto il resto è facoltativo e si può aggiungere dopo.

### Lo stato, che decide cosa si vede sul sito

| Stato | Sul sito pubblico | Iscrizioni |
|---|---|---|
| **Bozza** | Non si vede | No |
| **Annunciato** | Si vede, senza data né iscrizioni: raccoglie solo gli interessati | No |
| **Aperto** | Si vede | Sì |
| **Chiuso** | Si vede tra gli eventi passati | No |
| **Annullato** | Non si vede | No |

*Bozza* e *Annunciato* non richiedono una data: lasciandola vuota il sito scrive "Data da definire". **Annunciato** serve quando l'evento esiste come idea ma non ha ancora data e programma: chi è interessato lascia la sua email, e la trovi nel pulsante **Interessati** sulla riga dell'evento. Nessuna email parte da sola: li avvisi tu quando l'evento si concretizza.

### Data, ora, luogo, categoria

La **categoria** è l'etichetta che compare sulla scheda dell'evento e che permette di filtrare gli eventi sul sito (yoga, fotografia, pasticceria, canto, ballo, teatro, disegno, trekking urbano, viaggi). Se serve una categoria nuova non basta scriverla: va aggiunta al sistema, quindi va chiesta a chi cura il sito.

### I prezzi: due sistemi, e non si mescolano

**Sistema consigliato — i tre prezzi.** Compila uno o più di questi campi:

- **Prezzo Singolo**: per chi si iscrive da solo, a persona.
- **Prezzo Gruppo**: prezzo a persona per chi si iscrive in 2-6 persone, tipicamente più basso.
- **Prezzo Aperitivo**: prezzo a persona del solo aperitivo. Si può scegliere da solo oppure aggiungere a Singolo o Gruppo, e non è mai scontato.

Lasciando vuoto un campo, quella possibilità non viene offerta. Questo è il sistema che funziona con il pagamento online.

**Sistema vecchio — "Modalità di partecipazione".** Serve solo se i tre prezzi non bastano, per esempio con più di due modi di partecipare a prezzi diversi. Si aggiungono righe con nome e prezzo a persona, nessuno sconto di gruppo, **nessun pagamento online**.

> I due sistemi sono **alternativi**: non compilarli entrambi sullo stesso evento. Se lo fai, al salvataggio compare un messaggio che te lo dice e l'evento non viene salvato.

**Quota evento** è il campo da usare quando l'evento ha un prezzo unico e non serve distinguere nulla. **Quota iscrizione associativa inclusa** serve solo se il prezzo che hai messo comprende già la tessera, e indica quanta parte ne rappresenta: per ora è un promemoria interno, non compare sul sito.

### Posti e chiusura delle iscrizioni

- **Posti massimi**: quando sono esauriti, il sito non accetta altre iscrizioni. Se lo lasci vuoto, i posti sono illimitati. Nell'elenco eventi la colonna Posti mostra quanti sono ancora liberi su quanti.
- **Iscrizioni entro il**: dopo quella data il sito non accetta più iscrizioni, anche se lo stato è *Aperto*.

### Le tre caselle in fondo

- **Aperto anche ai non soci**: se spuntata, si può partecipare senza associarsi. Se non lo è, chi si iscrive deve essere socio o diventarlo.
- **Pagamento online attivo**: normalmente lasciala spuntata, così chi si iscrive paga subito con carta, PayPal o Satispay. Togliendola, l'iscrizione viene registrata ma il pagamento lo raccogli tu a parte: quelle iscrizioni restano "In attesa pagamento manuale" finché non le confermi a mano.
- **Pagina dettaglio attiva**: se la togli, la scheda dell'evento resta nell'elenco ma il pulsante "Dettagli" non porta a nessuna pagina.

### Condizioni di cancellazione

Testo mostrato a chi si iscrive, prima di pagare. Se prevedi rimborsi solo entro una certa data, scrivilo qui: è la sede giusta.

### Dopo aver creato l'evento

Con **Crea evento** l'evento compare nell'elenco. Poi apri **Modifica** sulla sua riga per fare le due cose che si possono fare solo su un evento che esiste:

- **caricare l'immagine**: scegli il file e premi *Carica immagine*. Le foto dal telefono vengono rimpicciolite automaticamente, non serve prepararle. *Rimuovi immagine* la toglie.
- **scrivere il testo esteso**, quello della pagina di dettaglio, più lungo della descrizione breve.

Quando l'evento è pronto, cambia lo stato in **Aperto** e salva: da quel momento è sul sito e accetta iscrizioni.

---

## 4. La pagina Impostazioni ed eventi (admin.html)

Due schede in alto: **Eventi** e **Impostazioni**.

### Scheda Eventi

**Tutti gli eventi** è la tabella di lavoro. Il filtro per stato serve a ritrovare le bozze. **Aggiorna elenco** ricarica i dati, utile se qualcun altro sta lavorando nello stesso momento.

Su ogni riga:

- **Modifica** — apre tutti i campi dell'evento, più immagine e posti disponibili. Ricordati di **Salva modifiche**; **Chiudi** esce senza salvare.
- **Iscritti** — l'elenco di chi si è iscritto. Vedi sotto.
- **Interessati** — chi ha lasciato l'email su un evento *Annunciato*. Sola consultazione, con l'indicazione di chi ha acconsentito alla newsletter.
- **Elimina** — **non reversibile, e cancella anche gli iscritti.** Da usare solo su eventi creati per errore o per prova. Un evento che non si è svolto va messo in *Annullato*, non eliminato: così resta la storia.

### L'elenco iscritti, riga per riga

Per ogni iscritto vedi nome ed email, se è socio o no, quante persone, la modalità scelta, lo stato, l'importo, il metodo di pagamento, eventuali allergie segnalate e la data.

I pulsanti disponibili:

- **Annulla** — annulla l'iscrizione e chiede se registrare anche una richiesta di rimborso, con una nota. L'iscrizione resta visibile, con stato *Annullata*.
- **Elimina** — fa sparire la riga. Serve a ripulire le iscrizioni di prova, non a gestire una rinuncia: per quella si usa *Annulla*.
- **Segna come rimborsato** / **Rimborsa gruppo** — registra che il rimborso è avvenuto. **Il rimborso vero si fa prima dal pannello di Stripe**: questo pulsante non muove soldi, tiene solo allineata la nostra situazione. "Rimborsa gruppo" compare quando un unico pagamento copre più righe (un gruppo, o iscrizione più aperitivo) e le sistema tutte insieme, così non se ne dimentica una.
- **Conferma pagamento ricevuto** — compare sulle iscrizioni in attesa di pagamento manuale, cioè sugli eventi con il pagamento online disattivato. Premilo quando hai davvero incassato.
- **Registra pagamento** / **Correggi pagamento** — vedi il capitolo 6.

### Scheda Impostazioni

Link Instagram, Facebook e galleria fotografica che compaiono sul sito. Il link galleria lasciato vuoto resta nascosto, non produce un link rotto.

---

## 5. La pagina Libro Soci (admin-soci.html)

### Cercare

Il campo di ricerca funziona su nome, cognome ed email; il filtro accanto seleziona lo stato. Gli stati sono: **attivo**, **scaduto** (tessera da rinnovare), **decaduto**, **cancellato**.

**Esporta CSV** scarica l'elenco completo dei soci in un file che si apre con Excel.

### Registrare un socio nuovo

**+ Registra nuovo socio** apre il modulo di iscrizione in una scheda nuova, nella versione riservata alla segreteria: qui puoi registrare anche un adulto che ha già pagato in contanti o con bonifico. Dal sito pubblico, invece, un adulto passa sempre dal pagamento online.

Compilato il modulo, il socio compare in elenco con il suo numero di tessera. **Il pagamento è un passaggio a parte**: vedi il capitolo 6.

### Le azioni su ogni riga

- **Modifica** — dati di contatto: nome, cognome, telefono, indirizzo, città, CAP.
- **Rinnova** — rinnovo annuale della tessera. Registra l'incasso **e insieme** sposta la scadenza, riporta il socio ad attivo, azzera i promemoria e il contatore degli eventi scontati. Da usare **solo per un rinnovo vero**. Non è disponibile a chi ha solo il ruolo della cassa, proprio perché cambia l'anagrafica.
- **Registra quota** — registra un incasso senza toccare nient'altro. È quello che serve per la prima quota. Vedi capitolo 6.
- **Scarica tessera** — genera il PDF della tessera.
- **Storico** — tutte le modifiche fatte su quel socio: data e ora, cosa è cambiato da cosa a cosa, e **chi** l'ha fatto. È la sede in cui si chiarisce un dubbio su un dato, invece di andare a memoria.
- **Segna come rimborsato** — come per gli eventi: il rimborso vero si fa prima da Stripe, questo lo registra.
- **Elimina** — non cancella niente per davvero: mette il socio in stato *cancellato*, e da quel momento non si può più rinnovare né iscrivere a eventi. Tessere, rinnovi e storico restano.

### Tessere in scadenza

Indichi entro quanti giorni guardare e premi **Carica**: ottieni chi scade in quel periodo, con email e numero di tessera. È la lista da cui partire per i solleciti, che si mandano a mano.

### Quota e vantaggi mostrati a chi vuole associarsi

In fondo alla pagina si impostano:

- **Quota associativa** e **testo dei vantaggi**, mostrati a chi, iscrivendosi a un evento, dice di volersi associare. Nessuno viene registrato automaticamente: arriva solo una email alla segreteria.
- **Sconto socio sugli eventi** e **numero massimo di eventi scontati**: lo sconto a persona vale dal secondo evento a cui il socio si iscrive, fino al numero indicato, e si azzera a ogni rinnovo. Sull'aperitivo non si applica mai.

> Questi campi cambiano quanto paga la gente sul sito. Modificali con la stessa attenzione di un prezzo.

---

## 6. Registrare un pagamento incassato a mano

Vale per contanti, bonifico, Satispay e PayPal ricevuti fuori dal sito. I metodi disponibili sono esattamente questi quattro: la carta non c'è perché è ciò che usa il pagamento online del sito.

### Quota di un socio

Libro Soci → riga del socio → **Registra quota**. Metti la data in cui hai incassato (non necessariamente oggi), il metodo, l'importo. Il riferimento è facoltativo: usalo per il numero di un bonifico.

- Non usare *Rinnova* al suo posto: quello sposterebbe anche la scadenza della tessera.
- Se sbagli, ripremi *Registra quota* e correggi: la riga viene corretta, non duplicata, quindi l'incasso non viene contato due volte.
- L'importo 0 è ammesso, per tracciare una quota omaggio invece di far sparire il caso dai conti.

### Iscrizione a un evento

admin.html → Eventi → **Iscritti** → riga dell'iscritto → **Registra pagamento** (o **Correggi pagamento**, se un importo c'è già). Stessi campi. Serve sia a registrare un incasso, sia a correggere una riga sbagliata.

Sulle iscrizioni pagate online il pulsante non c'è: per quelle l'importo vero è quello che ha registrato il sistema di pagamento, e non va riscritto a mano. Un errore su un pagamento online si sistema con un rimborso.

Ogni registrazione e ogni correzione resta tracciata con chi l'ha fatta e quando.

---

## 7. La pagina Pagamenti (admin-pagamenti.html)

Tutti gli incassi — iscrizioni a eventi e tessere — in un unico elenco. Serve a non dover aprire evento per evento.

**Filtri:** tipo (eventi, tessere o entrambi), evento specifico, mese, anno. **Filtra** applica, **Azzera filtri** rimette tutto.

Per ogni riga: tipo, riferimento, nome, email, numero di persone, modalità, stato, importo, metodo, allergie, data.

La data è quella dell'incasso quando l'hai indicata tu: un contante incassato a settembre per un'iscrizione di luglio risulta a settembre, ed è su quella che funzionano i filtri per mese e anno.

### Esportare per la contabilità

**Esporta CSV** scarica **tutte** le righe che corrispondono ai filtri attivi, non solo quelle della pagina che stai guardando. Il file si apre in Excel con le colonne già separate, nome e cognome divisi, gli importi sommabili e le date in formato italiano.

Il nome del file riporta i filtri usati e la data dell'export, così a distanza di mesi si capisce cosa contiene.

Sotto il pulsante compare l'esito. Se dice che l'export è **incompleto**, non usare quel file: rifallo. Se dice che nel frattempo sono arrivati pagamenti nuovi, il file va bene — è coerente con il momento in cui è partito — e quei pagamenti li prendi rilanciando l'export.

---

## 8. Se qualcosa non funziona

| Cosa vedi | Cosa significa |
|---|---|
| "Accedi con il tuo account Microsoft" e non entri | L'account non è ancora autorizzato: serve un ruolo (capitolo 2) |
| Un messaggio che dice che non hai il permesso | L'operazione richiede un ruolo che non hai: chiedila a chi ce l'ha |
| Hai appena ricevuto un ruolo ma non cambia niente | Esci e rientra |
| "Si è verificato un errore imprevisto" | Non è colpa di quello che hai scritto. Riprova una volta; se si ripete, segnalalo a chi cura il sito indicando **cosa stavi facendo** |
| La tabella dei soci è vuota e sai che i soci ci sono | Probabilmente hai solo il ruolo della cassa, che non dà accesso all'anagrafica (capitolo 2) |
| Un pulsante c'è ma a te dà errore e a un collega funziona | Avete ruoli diversi: guarda la tabella del capitolo 2 |

Per qualunque segnalazione, la cosa più utile da riportare è: quale pagina, quale pulsante, e cosa è comparso a schermo.
