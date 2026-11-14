# Guida al backoffice del sito TraMe

Per i membri del direttivo. Serve a essere autonomi su quattro cose: pubblicare e gestire gli eventi, tenere in ordine il Libro Soci, controllare i pagamenti e leggere le statistiche del sito.

Non serve sapere nulla di tecnico. Dove c'è un rischio di combinare un guaio, è scritto in chiaro.

---

## 1. Entrare

Le pagine riservate sono quattro, e si aprono direttamente dal browser:

| Pagina | Indirizzo | A cosa serve |
|---|---|---|
| Impostazioni ed eventi | progettotrame.org/admin.html | Eventi, pacchetti, talenti, link social, interruttore delle statistiche |
| Libro Soci | progettotrame.org/admin-soci.html | Soci, tessere, rinnovi, scadenze, quota e sconto socio |
| Pagamenti | progettotrame.org/admin-pagamenti.html | Tutti gli incassi in un unico elenco, con export |
| Analytics | progettotrame.org/admin-analytics.html | Visite agli eventi, clic su Prenota, prenotazioni e provenienza |

Da ciascuna si passa alle altre con i link in alto.

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
| **GestionePagamenti** | Un incarico, non una carica: solo la cassa |
| **Admin** | Amministrazione tecnica del sistema. Non è una carica del direttivo |

> **Nota sull'incarico GestionePagamenti.** Oggi va assegnato **in aggiunta** a una carica. Chi lo avesse soltanto lui è autorizzato a confermare e registrare incassi e a rinnovare tessere, ma non può vedere né il Libro Soci, né gli iscritti, né la pagina Pagamenti: aprendole troverebbe tabelle vuote o un messaggio di permesso. In pratica non riesce ad arrivare alle righe su cui dovrebbe lavorare. Fino a quando non avrà una pagina sua, assegnalo solo a chi ha già una carica.

### Chi può fare cosa, azione per azione

Le pagine mostrano gli stessi pulsanti a tutti (vedi sotto il perché). Questa è la tabella di chi viene effettivamente autorizzato.

| Azione | Presidente | Segretario | VicePresidente | Solo cassa |
|---|---|---|---|---|
| Creare, modificare, eliminare un evento o un pacchetto, e le loro immagini | sì | **no** | **no** | no |
| Talenti ("I Fili di TraMe") | sì | **no** | **no** | no |
| Salvare le impostazioni (link social, Analytics attivo, quota associativa, sconti) | sì | **no** | **no** | no |
| Vedere gli iscritti e gli interessati di un evento | sì | sì | sì | no |
| Annullare o eliminare un'iscrizione, segnare rimborsi | sì | sì | **no** | no |
| Adeguare il contatore sconto dei partecipanti di un evento | sì | sì | **no** | no |
| Cercare i soci, vedere lo storico di un socio | sì | sì | sì | no |
| Registrare a mano un socio nuovo | sì | sì | **no** | no |
| Modificare o eliminare un socio, export CSV, scadenze, rimborso tessera | sì | sì | **no** | no |
| Rinnovare una tessera | sì | sì | sì | sì |
| Registrare o correggere un incasso (quota, pagamento iscrizione) | sì | sì | sì | sì |
| Confermare un pagamento manuale | sì | sì | sì | sì |
| Vedere la pagina Pagamenti | sì | sì | sì | **no** |
| Vedere la pagina Analytics | sì | sì | sì | **no** |

Il ruolo **Admin** può fare tutto: è amministrazione tecnica, non una carica.

Le caselle che sorprendono di più, e che vale la pena sapere prima di sbatterci contro:

- **Eventi, pacchetti e talenti li gestiscono solo Presidente e Admin.** Segretario e Vicepresidente vedono la pagina e i pulsanti, ma non possono creare né modificare nulla.
- **Anche le impostazioni sono di Presidente e Admin**, comprese la quota associativa e lo sconto socio, che pure si modificano dal Libro Soci. È un limite noto: il permesso vale per l'intera schermata, non campo per campo. Un Segretario vede quei campi ma, salvando, riceve un errore: la quota la fa cambiare al Presidente.
- **Il Vicepresidente/tesoriere vede il Libro Soci, gli iscritti, i pagamenti e le statistiche, e incassa, ma non modifica l'anagrafica.** Può rinnovare e registrare incassi; non può registrare un socio nuovo, modificarlo o eliminarlo, esportare l'elenco, annullare un'iscrizione, segnare un rimborso né caricare le tessere in scadenza. È un'incoerenza nota: chi incassa non può registrare il rimborso dello stesso pagamento.

### Come si assegna un ruolo a una persona

1. Vai su **portal.azure.com** e accedi con l'account dell'associazione.
2. Cerca in alto **Microsoft Entra ID** e apri **Applicazioni aziendali** (in inglese: Enterprise applications).
3. Cerca e apri **Trame Backoffice**.
4. Nel menù a sinistra apri **Utenti e gruppi**, poi **Aggiungi utente/gruppo**.
5. Scegli la persona, poi nella colonna del ruolo scegli quale darle. Conferma con **Assegna**.

Per dare a una persona **due ruoli**, si ripete l'operazione una volta per ruolo: compaiono due righe con lo stesso nome.

Per **togliere** un permesso: stessa schermata, si seleziona la riga e si usa **Rimuovi**.

I ruoli si assegnano solo da qui: nel gestionale non c'è una schermata per farlo.

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
- **Descrizione breve**: è il testo della scheda che si vede nell'elenco eventi del sito.
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

### Sottotitolo, data, ora, luogo, nota, categoria

- **Sottotitolo** (massimo 81 caratteri): una riga breve sotto il titolo, nella scheda e nella pagina di dettaglio.
- **Luogo** (massimo 70 caratteri).
- **Nota aggiuntiva**: un'informazione breve che compare con un'icona accanto a data, ora e luogo, ad esempio "Percorso a piedi di circa 4 km" o "Evento online".
- **Categoria**: l'etichetta che compare sulla scheda dell'evento e che permette di filtrare gli eventi sul sito (yoga, fotografia, pasticceria, canto, ballo, teatro, disegno, itinerari urbani, viaggi). Se serve una categoria nuova non basta scriverla: va aggiunta al sistema, quindi va chiesta a chi cura il sito.

### Come appare la scheda sul sito

Ogni scheda ha la stessa altezza e lo stesso ordine: foto, categoria, titolo, sottotitolo, data, ora, luogo, nota, prezzo con "Prezzo socio" e pulsante Prenota, la frase per chi non è socio con il totale "prima partecipazione, inclusa tessera", poi la descrizione breve e il link Dettagli.

- Titolo, sottotitolo e luogo occupano sempre lo stesso spazio (due righe ciascuno), anche se il testo è più corto.
- La **descrizione breve** sta in uno spazio fisso: se è lunga, nella scheda scorre. Il testo completo resta nella pagina di dettaglio.
- Nella pagina di dettaglio il titolo si rimpicciolisce da solo per stare in due righe.

### I prezzi: almeno uno è obbligatorio

Ci si iscrive a un evento solo pagando online, e il pagamento usa questi tre prezzi. Compilane uno o più:

- **Prezzo Singolo**: per chi si iscrive da solo, a persona.
- **Prezzo Gruppo**: prezzo a persona per chi si iscrive in 2-6 persone, tipicamente più basso.
- **Prezzo Aperitivo**: prezzo a persona del solo aperitivo. Si può scegliere da solo oppure aggiungere a Singolo o Gruppo, e non è mai scontato.

Lasciando vuoto un campo, quella possibilità non viene offerta.

> Per mettere un evento in stato **Aperto** serve **almeno uno dei tre prezzi**: senza, il salvataggio si blocca con il messaggio "Per aprire le iscrizioni inserisci almeno un prezzo". Bozze ed eventi annunciati si possono salvare anche senza prezzi.

Le vecchie "Modalità di partecipazione" e il modulo di iscrizione senza pagamento sono stati tolti a novembre 2026. Un evento **gratuito** oggi non si può gestire dal sito: se servirà, va progettato a parte.

**Quota evento** è il campo da usare quando l'evento ha un prezzo unico e non serve distinguere nulla. **Quota iscrizione associativa inclusa** serve solo se il prezzo che hai messo comprende già la tessera, e indica quanta parte ne rappresenta: per ora è un promemoria interno, non compare sul sito.

### Posti e chiusura delle iscrizioni

- **Posti massimi**: quando sono esauriti, il sito non accetta altre iscrizioni. Se lo lasci vuoto, i posti sono illimitati. Nell'elenco eventi la colonna Posti mostra quanti sono ancora liberi su quanti.
- **Posti in pagamento**: chi arriva sulla pagina di pagamento Stripe si tiene il posto per **30 minuti**. In quel tempo il posto risulta occupato. Se gli ultimi posti sono tutti in pagamento, sul sito il pulsante dice "In prenotazione, riprova tra 30 minuti" invece di "Posti esauriti". Se la persona non paga, il posto si libera da solo. Così lo stesso posto non può essere venduto due volte.
- **Ridurre i posti**: non puoi scendere sotto i posti già prenotati o in pagamento. Il salvataggio si blocca con un messaggio.
- **Iscrizioni entro il**: dopo quella data il sito non accetta più iscrizioni, anche se lo stato è *Aperto*.

### Le tre caselle in fondo

- **Aperto anche ai non soci**: se spuntata, si può partecipare senza associarsi, e associarsi diventa una scelta facoltativa. Se non lo è, chi non è socio deve associarsi: nel pagamento online la tessera viene aggiunta allo stesso pagamento dell'evento (capitolo 9).
- **Pagamento online attivo**: normalmente lasciala spuntata, così chi si iscrive paga subito con carta, PayPal o Satispay. Togliendola, l'iscrizione viene registrata ma il pagamento lo raccogli tu a parte: quelle iscrizioni restano "In attesa pagamento manuale" finché non le confermi a mano.
- **Pagina dettaglio attiva**: se la togli, la scheda dell'evento resta nell'elenco ma il link "Dettagli" non porta a nessuna pagina.

### Condizioni di cancellazione

Testo mostrato a chi si iscrive, prima di pagare. Se prevedi rimborsi solo entro una certa data, scrivilo qui: è la sede giusta.

### Dopo aver creato l'evento

Con **Crea evento** l'evento compare nell'elenco. Poi apri **Modifica** sulla sua riga per fare le due cose che si possono fare solo su un evento che esiste:

- **caricare l'immagine**: scegli il file e premi *Carica immagine*. Le foto dal telefono vengono rimpicciolite automaticamente, non serve prepararle. *Rimuovi immagine* la toglie.
- **scrivere il testo esteso**, quello della pagina di dettaglio, più lungo della descrizione breve.

Quando l'evento è pronto, cambia lo stato in **Aperto** e salva: da quel momento è sul sito e accetta iscrizioni.

---

## 4. La pagina Impostazioni ed eventi (admin.html)

Quattro schede in alto: **Eventi**, **Pacchetti** (capitolo 8), **Talenti** e **Impostazioni**.

### Scheda Eventi

**Tutti gli eventi** è la tabella di lavoro. Il filtro per stato serve a ritrovare le bozze. **Aggiorna elenco** ricarica i dati, utile se qualcun altro sta lavorando nello stesso momento.

Su ogni riga:

- **Modifica**: apre tutti i campi dell'evento, più immagine e posti disponibili. Ricordati di **Salva modifiche**; **Chiudi** esce senza salvare.
- **Iscritti**: l'elenco di chi si è iscritto. Vedi sotto.
- **Interessati**: chi ha lasciato l'email su un evento *Annunciato*. Sola consultazione, con l'indicazione di chi ha acconsentito alla newsletter.
- **Elimina**: **non reversibile, e cancella anche gli iscritti.** Da usare solo su eventi creati per errore o per prova. Un evento che non si è svolto va messo in *Annullato*, non eliminato: così resta la storia.

### L'elenco iscritti, riga per riga

Per ogni iscritto vedi nome ed email, se è socio o no, quante persone, la modalità scelta, lo stato, l'importo, il metodo di pagamento, eventuali allergie segnalate e la data.

Nella colonna Importo, "**da pagare X €**" indica una cifra dovuta e non ancora incassata. Non conta negli incassi finché non la confermi con **Registra pagamento**, che la propone già compilata.

I pulsanti disponibili:

- **Annulla**: annulla l'iscrizione e chiede se registrare anche una richiesta di rimborso, con una nota. L'iscrizione resta visibile, con stato *Annullata*.
- **Elimina**: fa sparire la riga. Serve a ripulire le iscrizioni di prova, non a gestire una rinuncia: per quella si usa *Annulla*.
- **Segna come rimborsato** / **Rimborsa gruppo** / **Rimborsa pacchetto**: **registrano soltanto** che il rimborso è avvenuto. **I soldi si restituiscono prima dalla dashboard di Stripe**: questi pulsanti non muovono denaro, tengono solo allineata la nostra situazione. Inoltre **abbassano di uno il contatore dello sconto socio** per ogni data pagata da ciascun socio coinvolto. "Rimborsa gruppo" compare quando un unico pagamento copre più righe (un gruppo, o iscrizione più aperitivo) e le sistema tutte insieme. "Rimborsa pacchetto" compare sulle iscrizioni nate da un acquisto a più date (capitolo 8): segna rimborsate tutte le righe di quell'acquisto, **anche quelle sulle altre date collegate**.
- **Conferma pagamento ricevuto**: compare sulle iscrizioni in attesa di pagamento manuale, cioè sugli eventi con il pagamento online disattivato. Premilo quando hai davvero incassato.
- **Registra pagamento** / **Correggi pagamento**: vedi il capitolo 6.

### Scheda Talenti

Le persone presentate nella pagina pubblica "I Fili di TraMe", con foto, ambito e descrizione.

### Scheda Impostazioni

- **Link Instagram, Facebook e galleria fotografica** che compaiono sul sito. Il link galleria lasciato vuoto resta nascosto, non produce un link rotto.
- **Analytics attivo**: accende o spegne la registrazione delle statistiche del sito (capitolo 10). Spegnendola, il sito smette di registrare entro un minuto.

Salvando questa scheda, quota associativa, vantaggi e sconto socio (che si impostano nel Libro Soci) restano come sono: vengono rimandati invariati.

---

## 5. La pagina Libro Soci (admin-soci.html)

### Cercare

Il campo di ricerca funziona su nome, cognome ed email; il filtro accanto seleziona lo stato. Gli stati sono: **attivo**, **scaduto** (tessera da rinnovare), **decaduto**, **cancellato**.

Nell'elenco la colonna **Foto** mostra la risposta al consenso foto e video: Sì, No, oppure "—" per chi non ha ancora risposto.

**Esporta CSV** scarica l'elenco completo dei soci in un file che si apre con Excel.

### Regola: nessun socio senza pagamento

Dal sito pubblico si diventa soci **solo pagando online**: dalla pagina "Diventa socio", oppure aggiungendo la tessera mentre si prenota un evento (capitolo 9). L'unica eccezione è la registrazione a mano fatta dalla segreteria, descritta qui sotto, per chi ha pagato in contanti o con bonifico.

I **minorenni** oggi non possono iscriversi online: li registra la segreteria a mano, con il consenso del genitore raccolto a parte. È in preparazione l'iscrizione online in cui è il genitore a compilare e pagare.

### Registrare un socio nuovo

**+ Registra nuovo socio** apre, nella stessa scheda del browser, il modulo di iscrizione nella versione riservata alla segreteria. **Serve il login**: se non sei già entrato compare il pulsante *Accedi*, e senza un ruolo autorizzato (capitolo 2) il socio non viene registrato. Chi apre quell'indirizzo senza login non vede il modulo.

In questa versione la **data di nascita e il codice fiscale sono facoltativi**: se non li conosci al momento, lascia i campi vuoti e completali più avanti da "Modifica" sulla riga del socio. Finché la data di nascita resta vuota, il socio non viene mai considerato minorenne.

La casella **"Ha già fatto 1 evento?"** è spuntata di default: serve quando registri qualcuno dopo un evento pagato in contanti, così lo sconto socio scatta già dal suo prossimo evento invece che dal secondo.

Il modulo chiede anche, **in modo obbligatorio**, se la persona autorizza Progetto TraMe, i suoi amministratori e i talenti che conducono gli eventi a pubblicare foto e video in cui compare (link "(documentazione)" accanto alla domanda, testo completo nella pagina consenso-foto.html del sito): non si può salvare senza scegliere Sì o No. Se hai già una firma su carta per questa persona, registra comunque la scelta qui: è l'unico posto in cui resta salvata.

Compilato il modulo, il socio compare in elenco con il suo numero di tessera. **Il pagamento è un passaggio a parte e va fatto subito dopo**: vedi il capitolo 6.

> **L'email con la tessera parte sempre**, anche per un socio registrato a mano qui: non c'è un modo di evitarlo. Se la persona è già stata avvisata a voce, riceverà comunque il messaggio.

Quando invece è una **persona nuova a diventare socia da sola** pagando online, arriva anche un'email di avviso a `info@progettotrame.org`, con nome, numero tessera, email e canale usato. Questo avviso **non** parte quando sei tu a registrare qualcuno da qui.

### Le azioni su ogni riga

- **Modifica**: dati di contatto (nome, cognome, telefono, indirizzo, città, CAP). In fondo al pannello, separati, anche data di nascita e codice fiscale: compaiono sempre vuoti anche se il socio li ha già (non è un errore), e lasciarli vuoti **non li cancella**; servono solo per completarli in un momento successivo. Più sotto, il **consenso foto e video**: qui invece si vede sempre la risposta vera, o "non ha ancora risposto". Usalo anche per registrare una firma già raccolta su carta. Nome e cognome vanno scritti come li usa la persona: servono anche al controllo sulle prenotazioni (capitolo 9).
- **Rinnova**: rinnovo annuale della tessera. Registra l'incasso **e insieme** sposta la scadenza, riporta il socio ad attivo, azzera i promemoria e il contatore degli eventi scontati. Da usare **solo per un rinnovo vero**.
- **Registra quota**: registra un incasso senza toccare nient'altro. È quello che serve per la prima quota. Vedi capitolo 6.
- **Scarica tessera**: genera il PDF della tessera.
- **Storico**: tutte le modifiche fatte su quel socio: data e ora, cosa è cambiato da cosa a cosa, e **chi** l'ha fatto.
- **Segna come rimborsato**: come per gli eventi, **registra soltanto**. Il rimborso vero si fa prima da Stripe (o restituendo i contanti). Compare solo sui soci di cui risulta un pagamento. Dopo averlo premuto, al suo posto compare **Annulla rimborso**, che serve se il contrassegno è finito sul socio sbagliato: non annulla il rimborso vero, toglie solo quello che risulta a noi. Entrambe le operazioni restano nello Storico con il nome di chi le ha fatte.
- **Elimina**: **non cancella i dati**. Mette il socio in stato *cancellato*, e da quel momento non si può più rinnovare né iscrivere a eventi. Anagrafica, tessere, rinnovi e storico restano nel sistema. Se una persona chiede di cancellare davvero i propri dati (diritto previsto dalla privacy), oggi non c'è un pulsante per farlo: va chiesto a chi cura il sito.

### Tessere in scadenza

Indichi entro quanti giorni guardare e premi **Carica**: ottieni chi scade in quel periodo, con email e numero di tessera. È la lista da cui partire per i solleciti, che si mandano a mano.

### Quota, vantaggi e sconto socio

In fondo alla pagina si impostano:

- **Quota associativa** e **testo dei vantaggi**: compaiono nella pagina "Diventa socio" e nel passaggio "Associati a TraMe" delle prenotazioni online. La quota è anche l'importo della tessera che si aggiunge al pagamento dell'evento.
- **Sconto socio sugli eventi** e **numero massimo di eventi scontati**: lo sconto a persona vale dal secondo evento a cui il socio si iscrive, fino al numero indicato, e si azzera a ogni rinnovo. Sull'aperitivo non si applica mai.

> Questi campi cambiano quanto paga la gente sul sito. Modificali con la stessa attenzione di un prezzo. Ricorda che salvarli richiede il ruolo di Presidente o Admin (capitolo 2).

---

## 6. Registrare un pagamento incassato a mano

Vale per contanti, bonifico, Satispay, PayPal, carta o altro ricevuti fuori dal sito. "Carta" qui significa un pagamento con carta raccolto fuori da Stripe, per esempio su un POS fisico: è un valore diverso da quello che il pagamento online del sito scrive da sé quando qualcuno paga con carta su Stripe.

### Quota di un socio

Libro Soci → riga del socio → **Registra quota**. Metti la data in cui hai incassato (non necessariamente oggi), il metodo, l'importo. Il riferimento è facoltativo: usalo per il numero di un bonifico.

- Non usare *Rinnova* al suo posto: quello sposterebbe anche la scadenza della tessera.
- Se sbagli, ripremi *Registra quota* e correggi: la riga viene corretta, non duplicata, quindi l'incasso non viene contato due volte.
- L'importo 0 è ammesso, per tracciare una quota omaggio invece di far sparire il caso dai conti.

### Iscrizione a un evento

admin.html → Eventi → **Iscritti** → riga dell'iscritto → **Registra pagamento** (o **Correggi pagamento**, se un importo c'è già). Stessi campi. Serve sia a registrare un incasso, sia a correggere una riga sbagliata.

Sulle iscrizioni pagate online il pulsante non c'è: per quelle l'importo vero è quello che ha registrato il sistema di pagamento, e non va riscritto a mano. Un errore su un pagamento online si sistema con un rimborso.

Una persona che paga in contanti **all'evento senza essersi prenotata dal sito** non può essere aggiunta agli iscritti dell'evento: il gestionale oggi non lo permette. Se diventa socia, la registri dal Libro Soci (capitolo 5).

Ogni registrazione e ogni correzione resta tracciata con chi l'ha fatta e quando.

---

## 7. La pagina Pagamenti (admin-pagamenti.html)

Tutti gli incassi, iscrizioni a eventi e tessere, in un unico elenco. Serve a non dover aprire evento per evento.

**Filtri:** tipo (eventi, tessere o entrambi), evento specifico, mese, anno. **Filtra** applica, **Azzera filtri** rimette tutto.

Per ogni riga: tipo, riferimento, nome, email, numero di persone, modalità, stato, importo, metodo, allergie, data.

La data è quella dell'incasso quando l'hai indicata tu: un contante incassato a settembre per un'iscrizione di luglio risulta a settembre, ed è su quella che funzionano i filtri per mese e anno.

Gli importi sono quelli pagati dalle persone, al lordo: le commissioni di Stripe sono nella dashboard di Stripe.

### Esportare per la contabilità

**Esporta CSV** scarica **tutte** le righe che corrispondono ai filtri attivi, non solo quelle della pagina che stai guardando. Il file si apre in Excel con le colonne già separate, nome e cognome divisi, gli importi sommabili e le date in formato italiano.

Il nome del file riporta i filtri usati e la data dell'export, così a distanza di mesi si capisce cosa contiene.

Sotto il pulsante compare l'esito. Se dice che l'export è **incompleto**, non usare quel file: rifallo. Se dice che nel frattempo sono arrivati pagamenti nuovi, il file va bene, perché è coerente con il momento in cui è partito, e quei pagamenti li prendi rilanciando l'export.

---

## 8. Eventi a più date (Pacchetti)

Serve quando un evento si svolge su due o più giornate e chi partecipa può scegliere di venire a una sola data o a tutte, con uno sconto sul totale se le prende tutte (es. un corso in due incontri). Pubblicamente deve sembrare **un evento solo**, non due eventi scollegati: una scheda, una pagina, una pagina di iscrizione. Per questo funziona in due passaggi.

### Come si crea

1. **Crea le singole date come eventi normali**, una per ciascuna giornata, esattamente come al capitolo 3 (titolo, prezzi, posti, tutto come sempre). Per adesso resteranno visibili come eventi separati.
2. Vai sulla scheda **Pacchetti** → **+ Nuovo pacchetto**. Scrivi:
   - il **nome** che vedrà il pubblico, cioè il nome dell'evento nel suo insieme, non quello delle singole date;
   - il **sottotitolo** (massimo 81 caratteri) e la **nota aggiuntiva**, come per un evento (capitolo 3);
   - la **descrizione breve**, quella della scheda;
   - se serve, il **testo esteso** per la pagina di dettaglio. Finché resta vuoto, la pagina di dettaglio mostra la descrizione breve.

   La casella **"Pagina dettaglio attiva"** funziona come per gli eventi.
3. In "Date collegate", scegli dal menu le date create al punto 1 e premi **+ Aggiungi data**, una per una, nell'ordine in cui devono comparire. Servono almeno due.
4. Imposta lo **sconto per chi prende tutte le date**: è l'importo in euro che si sottrae dal totale di chi si iscrive a tutte le date insieme. Senza questo importo, chi tenta di iscriversi a "tutte le date" riceve un errore. Se non sei ancora pronto a deciderlo, lascialo vuoto e completalo prima di pubblicare.
5. Crea il pacchetto (parte sempre in Bozza), poi da **Modifica** carica l'immagine di copertina e porta lo stato ad **Aperto** quando è pronto. Gli stati sono gli stessi di un evento normale. Un pacchetto annullato si può riaprire da Modifica cambiando lo stato.

Da quel momento, le singole date **non compaiono più come schede separate** sul sito pubblico (nella tabella Eventi restano visibili, etichettate "fa parte di: [nome pacchetto]"): l'unica cosa che il pubblico vede è il pacchetto.

Luogo e ora compaiono sulla scheda del pacchetto solo se sono uguali per tutte le date. Lo stesso vale per la categoria.

### Attenzione quando modifichi le date collegate

Nel pannello Modifica, l'elenco delle date collegate **sostituisce sempre quello esistente** quando salvi: non si aggiunge a quello che c'è già. Se vuoi solo cambiare il nome o la descrizione senza toccare le date, salva comunque con l'elenco delle date intatto, così com'è quando apri il pannello.

### Come funziona il prezzo

Il pagamento è **sempre online** (Stripe): non esiste un percorso di pagamento manuale per i pacchetti. Chi si iscrive sceglie quante persone (1-6) e quale combinazione di date (una sola, o tutte). Per ciascuna persona il sistema calcola:

- il prezzo di ciascuna data scelta, **meno lo sconto socio se le spetta**, valutato data per data;
- **meno lo sconto pacchetto**, se ha scelto tutte le date, diviso proporzionalmente fra le date.

Il totale mostrato sul sito prima del pagamento comprende già lo sconto "tutte le date"; lo sconto socio si vede solo al pagamento.

Vedendo gli iscritti di una singola data (dalla scheda Eventi), troverai quindi importi diversi fra la prima e la seconda data dello stesso acquisto: è corretto, il totale pagato complessivamente è quello giusto.

Le regole sulla tessera (capitolo 9) valgono anche per i pacchetti: associarsi è obbligatorio se almeno una delle date scelte non è aperta ai non soci.

### Eliminare un pacchetto

**Non elimina le date collegate.** Tornano eventi normali, di nuovo visibili singolarmente sul sito, con tutti i loro iscritti e pagamenti intatti: solo lo "scollegamento", niente di irreversibile sui dati.

---

## 9. Cosa succede quando qualcuno prenota dal sito

Utile per rispondere alle domande di chi prenota e per capire cosa trovi negli iscritti.

### Chi non è socio: la tessera nello stesso pagamento

Nella prenotazione con pagamento online, dopo nome, cognome ed email, chi preme **Vai al pagamento** viene controllato persona per persona:

- **socio attivo**: va dritto al pagamento;
- **non socio**: si apre il passaggio **"Associati a TraMe"**, con quota e vantaggi, data di nascita, codice fiscale, dati facoltativi e consenso foto. La tessera viene aggiunta **allo stesso pagamento** dell'evento (es. 17 € + 15 € = 32 €). Il socio viene creato solo quando il pagamento è confermato, e riceve sia l'email della tessera sia quella dell'iscrizione;
- **tessera scaduta**: nello stesso passaggio la tessera si rinnova, senza reinserire i dati.

Sugli eventi **riservati ai soci** associarsi è obbligatorio. Su quelli **aperti ai non soci** c'è una casella per persona: si può pagare solo l'evento. Il passaggio è bloccato per i minorenni, che vengono invitati a scrivere a info@progettotrame.org.

L'email inserita viene già compilata nella pagina di pagamento di Stripe.

### Controllo sull'email di un socio

Se qualcuno scrive l'email di un socio ma con un **nome e cognome diversi** da quelli registrati, la prenotazione si ferma con il messaggio "questa email è già associata a un altro socio". Il messaggio non dice a chi appartiene l'email. Il controllo ignora maiuscole, accenti e nome/cognome invertiti, ma non i diminutivi: "Beppe" e "Giuseppe" sono diversi.

Se a fermarsi è un socio vero, quasi sempre è perché il suo nome è registrato in modo diverso: correggilo da **Modifica** nel Libro Soci.

### Eventi senza prezzi

Il vecchio modulo di iscrizione senza pagamento è stato tolto a novembre 2026. Se un evento aperto risultasse comunque senza prezzi, la pagina di iscrizione mostra solo "L'iscrizione online a questo evento non è disponibile" con l'email della segreteria. La richiesta di associazione via email, che partiva da quel modulo, non esiste più: si diventa soci da "Diventa socio" o nella prenotazione.

### Consenso foto e video

Si chiede, con scelta obbligatoria Sì o No:

- a chi si iscrive come socio, online o registrato da te;
- a chi si associa durante una prenotazione.

La risposta si vede nella colonna Foto del Libro Soci e si cambia da Modifica.

---

## 10. Statistiche del sito (admin-analytics.html)

Una pagina che mostra quanto vengono visti gli eventi e quanto portano a prenotare, e da dove arrivano le persone. Le statistiche sono interne e aggregate: niente cookie, nessun dato personale dei visitatori, solo totali giornalieri. È descritto anche nell'informativa privacy, sezione "Statistiche di visita".

### Cosa trovi

- **Filtri** in alto: periodo (ultimi 7/30/90 giorni, 12 mesi o date a scelta), un evento o pacchetto specifico, e **Dati**: *Reali* (quelli veri) o *Prove in anteprima* (solo per i test tecnici).
- **Cinque numeri**: visite (aperture della pagina di dettaglio), clic su Prenota (dalla scheda e dal dettaglio), avvii di pagamento, acquisti e partecipanti. Acquisti e partecipanti sono **al netto dei rimborsi**.
- **Dalla visita alla prenotazione**: barre con i passaggi e le percentuali tra un passaggio e l'altro.
- **Andamento giornaliero**: grafico di una misura a scelta; passando il mouse si legge il valore del giorno. *Vedi tabella* mostra tutti i numeri giorno per giorno.
- **Provenienza**, **Campagne (UTM)** e **Per evento**: gli stessi numeri divisi per canale, per campagna e per evento.

### Come leggere i numeri

- **Le percentuali sono rapporti tra azioni registrate, non tra persone.** Una persona può visitare da schede diverse del browser, o prenotare dalla scheda senza aprire il dettaglio, quindi i clic possono anche superare le visite.
- Una visita e un clic contano una volta per evento finché resta aperta la scheda del browser: ricaricare non conta di nuovo.
- **Non sono comprese** le partecipazioni pagate in contanti all'evento senza prenotazione dal sito.
- **"Diretto o non identificato"** raccoglie chi scrive l'indirizzo e chi arriva da app che non dicono la provenienza, come Instagram e WhatsApp. **"Non registrata"** sono le prenotazioni fatte prima degli Analytics.
- I giorni sono in ora italiana. Gli importi non ci sono: stanno nella pagina Pagamenti.

### Riconoscere le campagne: i link UTM

Facebook e Instagram non dicono da soli se un visitatore arriva da un'inserzione o da un post normale. Per distinguerli, i link delle campagne devono avere i **parametri UTM**.

- **Campagne Meta (Facebook e Instagram Ads):** nella creazione dell'inserzione, nel campo "Parametri URL", incolla:

  `utm_source={{site_source_name}}&utm_medium=paid&utm_campaign={{campaign.name}}`

  Meta sostituisce da solo il canale e il nome della campagna. Nella dashboard compariranno come "Facebook Ads" o "Instagram Ads", con il nome della campagna.
- **Altri canali** (newsletter, volantini con QR code, link in bio): aggiungi al link dell'evento qualcosa come `?utm_source=newsletter&utm_medium=email&utm_campaign=dicembre`. Compariranno in "Altre campagne". Se il link ha già un `?`, usa `&` al posto del `?`.

### Interruttore ed esclusione del tuo dispositivo

- La registrazione si accende e si spegne da **admin.html → Impostazioni → Analytics attivo**. Quando è spenta la dashboard lo segnala.
- In fondo alla pagina Analytics c'è **"Escludi questo dispositivo dalle statistiche"**: premilo su ogni browser con cui controlli il sito, così le tue visite non falsano i numeri. I pagamenti veri restano sempre contati. L'esclusione vale solo per quel browser e resta finché non la togli.

---

## 11. Se qualcosa non funziona

| Cosa vedi | Cosa significa |
|---|---|
| "Accedi con il tuo account Microsoft" e non entri | L'account non è ancora autorizzato: serve un ruolo (capitolo 2) |
| Un messaggio che dice che non hai il permesso | L'operazione richiede un ruolo che non hai: chiedila a chi ce l'ha |
| Hai appena ricevuto un ruolo ma non cambia niente | Esci e rientra |
| "Si è verificato un errore imprevisto" | Non è colpa di quello che hai scritto. Riprova una volta; se si ripete, segnalalo a chi cura il sito indicando **cosa stavi facendo** |
| La tabella dei soci è vuota e sai che i soci ci sono | Probabilmente hai solo l'incarico della cassa, che non dà accesso all'anagrafica (capitolo 2) |
| Un pulsante c'è ma a te dà errore e a un collega funziona | Avete ruoli diversi: guarda la tabella del capitolo 2 |
| Un socio dice che la prenotazione lo ferma con "email già associata a un altro socio" | Nome o cognome registrati in modo diverso: correggili da Modifica nel Libro Soci (capitolo 9) |
| La pagina Analytics dice che Analytics è spento | Riaccendilo da Impostazioni (capitolo 4) |
| La pagina Analytics è tutta a zero | Nel periodo scelto non ci sono ancora visite registrate, oppure è selezionato "Prove in anteprima" invece di "Reali" |

Per qualunque segnalazione, la cosa più utile da riportare è: quale pagina, quale pulsante, e cosa è comparso a schermo.
