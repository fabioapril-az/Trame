// Generatore delle pagine statiche per SEO, anteprime social e AI.
//
// Gira su GitHub Actions prima di ogni pubblicazione (vedi il workflow
// azure-static-web-apps-*.yml): legge eventi e impostazioni dall'API
// pubblica del backend e scrive, NELLA COPIA DI LAVORO DEL RUNNER (i file
// generati non vengono mai salvati nel repository):
//   - eventi/<slug>-<id>/index.html  una pagina per evento, con contenuto,
//     anteprima social (Open Graph) e dati strutturati Schema.org Event;
//   - eventi.html e index.html con le schede già scritte nell'HTML (le
//     ricrea comunque events.js con i dati vivi);
//   - sitemap.xml, llms.txt, assets/js/pagine-eventi.js (id → indirizzo);
//   - canonical e anteprima social sulle pagine pubbliche fisse.
// Sulle pagine generate i dati vivi (posti, stato, "In prenotazione")
// arrivano comunque dal backend all'apertura: la versione statica serve a
// motori di ricerca, AI e anteprime dei link.
//
// Uso: node scripts/genera-pagine.mjs   (Node 20+, nessuna dipendenza)
// Esce con codice 0 e stampa la "firma" del contenuto generato su stdout
// (ultima riga "FIRMA=<sha256>") per decidere se ripubblicare.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const SITO = "https://progettotrame.org";
const API = "https://app-trame-prod.azurewebsites.net";
const RADICE = process.cwd();
const IMMAGINE_DEFAULT = SITO + "/assets/img/logo-photo.jpg";

const CATEGORIE = {
  yoga: "Yoga", fotografia: "Fotografia", pasticceria: "Pasticceria", canto: "Canto",
  ballo: "Ballo", teatro: "Teatro", disegno: "Disegno", "trekking-urbano": "Itinerari urbani", viaggi: "Viaggi",
};
const ICONE = {
  yoga: "🧘", fotografia: "📷", pasticceria: "🍰", canto: "🎤", ballo: "💃",
  teatro: "🎭", disegno: "✏️", "trekking-urbano": "🥾", viaggi: "🧳",
};

// Pagine pubbliche fisse: ricevono canonical e anteprima social.
const PAGINE_FISSE = ["index.html", "chi-siamo.html", "eventi.html", "fili.html", "contatti.html", "diventa-socio.html"];

// --- utilità ---------------------------------------------------------------

async function leggiJson(percorso) {
  // Il backend sul piano F1 può essere a freddo: tre tentativi distanziati.
  let ultimoErrore;
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    try {
      const risposta = await fetch(API + percorso, { headers: { Origin: SITO }, signal: AbortSignal.timeout(60000) });
      if (!risposta.ok) throw new Error(percorso + " → " + risposta.status);
      return await risposta.json();
    } catch (err) {
      ultimoErrore = err;
      if (tentativo < 3) await new Promise((r) => setTimeout(r, 15000));
    }
  }
  throw ultimoErrore;
}

function esc(valore) {
  return String(valore == null ? "" : valore)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function slug(testo) {
  return String(testo || "evento")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 70).replace(/-+$/, "") || "evento";
}

function urlEvento(e) {
  return "/eventi/" + slug(e.titolo) + "-" + e.id + "/";
}

function testoSemplice(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ").replace(/<\/(p|li|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function riassunto(testo, max) {
  if (testo.length <= max) return testo;
  const taglio = testo.slice(0, max - 1);
  return taglio.slice(0, taglio.lastIndexOf(" ") > 40 ? taglio.lastIndexOf(" ") : taglio.length) + "…";
}

// Il testo arriva dall'editor dell'admin (contenuto fidato), ma va comunque
// ripulito: solo tag di formattazione, solo link http(s)/mailto, nessun
// attributo di stile o evento. Il testo semplice (eventi vecchi) diventa
// paragrafi.
const TAG_AMMESSI = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "ol", "ul", "li", "a", "span"]);

function pulisciHtml(html) {
  const sorgente = String(html || "");
  if (!/<[a-z][\s\S]*>/i.test(sorgente)) {
    return sorgente.split(/\n+/).map((r) => r.trim()).filter(Boolean).map((r) => "<p>" + esc(r) + "</p>").join("");
  }
  const senzaBlocchi = sorgente.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "");
  const pulito = senzaBlocchi.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, nome, attributi) => {
    nome = nome.toLowerCase();
    if (!TAG_AMMESSI.has(nome)) return "";
    if (tag.startsWith("</")) return "</" + nome + ">";
    if (nome === "a") {
      const href = /href\s*=\s*"([^"]*)"/i.exec(attributi);
      const valore = href ? href[1] : "";
      if (!/^(https?:|mailto:)/i.test(valore)) return "<a>";
      return '<a href="' + esc(valore) + '" target="_blank" rel="noopener">';
    }
    if (nome === "li") {
      const tipo = /data-list\s*=\s*"(bullet|ordered)"/i.exec(attributi);
      return tipo ? '<li data-list="' + tipo[1] + '">' : "<li>";
    }
    return "<" + nome + ">";
  });
  // Quill scrive sempre <ol>: quelli con voci "bullet" sono elenchi puntati.
  return pulito.replace(/<ol>([\s\S]*?)<\/ol>/g, (blocco, interno) => {
    const voci = interno.replace(/ data-list="(bullet|ordered)"/g, "");
    return /<li data-list="bullet">/.test(interno) ? "<ul>" + voci + "</ul>" : "<ol>" + voci + "</ol>";
  });
}

function formattaData(iso) {
  if (!iso) return "Data da definire";
  const [a, m, g] = iso.split("-");
  return g + "/" + m + "/" + a;
}

function formattaDataEstesa(iso) {
  if (!iso) return null;
  return new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });
}

function formattaPrezzo(valore) {
  return Number(valore).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// Data e ora con il fuso di Roma (ora legale compresa), per Schema.org.
function dataOraIso(data, ora) {
  if (!data) return null;
  const hhmm = /^\d{1,2}:\d{2}/.test(ora || "") ? ora.slice(0, 5).padStart(5, "0") : null;
  if (!hhmm) return data;
  const istante = new Date(data + "T" + hhmm + ":00Z");
  const roma = new Date(istante.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  const utc = new Date(istante.toLocaleString("en-US", { timeZone: "UTC" }));
  const minuti = Math.round((roma - utc) / 60000);
  const segno = minuti >= 0 ? "+" : "-";
  const offset = segno + String(Math.floor(Math.abs(minuti) / 60)).padStart(2, "0") + ":" + String(Math.abs(minuti) % 60).padStart(2, "0");
  return data + "T" + hhmm + ":00" + offset;
}

function prezzoPrincipale(e) {
  const prezzi = [e.prezzoSingolo, e.prezzoGruppoPersona, e.quotaEvento].filter((p) => p != null);
  return prezzi.length ? Math.min(...prezzi) : null;
}

function online(e) {
  return /\bonline\b/i.test(e.luogo || "");
}

function metaTag(attributo, nome, valore) {
  return valore ? "  <meta " + attributo + '="' + nome + '" content="' + esc(valore) + '">\n' : "";
}

function anteprimaSocial({ titolo, descrizione, url, immagine, tipo }) {
  return metaTag("name", "description", descrizione) +
    '  <link rel="canonical" href="' + esc(url) + '">\n' +
    metaTag("property", "og:type", tipo || "website") +
    metaTag("property", "og:site_name", "Progetto TraMe") +
    metaTag("property", "og:locale", "it_IT") +
    metaTag("property", "og:title", titolo) +
    metaTag("property", "og:description", descrizione) +
    metaTag("property", "og:url", url) +
    metaTag("property", "og:image", immagine || IMMAGINE_DEFAULT) +
    metaTag("name", "twitter:card", "summary_large_image");
}

function jsonLd(oggetto) {
  // "<" escapato: un testo con "</script>" non può chiudere il blocco.
  return '  <script type="application/ld+json">' + JSON.stringify(oggetto).replace(/</g, "\\u003c") + "</script>\n";
}

function sostituisci(html, cerca, nuovo, nome) {
  if (!html.includes(cerca)) throw new Error("Segnaposto non trovato (" + nome + "): il modello HTML è cambiato");
  return html.replace(cerca, nuovo);
}

// --- dati strutturati --------------------------------------------------------

function organizzazione(impostazioni) {
  return {
    "@type": "Organization",
    "@id": SITO + "/#organizzazione",
    name: "Progetto TraMe",
    alternateName: "TraMe",
    description: "Associazione culturale di Milano che organizza eventi e corsi di yoga, fotografia, pasticceria, canto, ballo, teatro, disegno, itinerari urbani e viaggi.",
    url: SITO + "/",
    logo: IMMAGINE_DEFAULT,
    email: "info@progettotrame.org",
    address: { "@type": "PostalAddress", addressLocality: "Milano", addressCountry: "IT" },
    sameAs: [impostazioni && impostazioni.instagramUrl, impostazioni && impostazioni.facebookUrl].filter(Boolean),
  };
}

function datiEvento(e, descrizione) {
  const inizio = dataOraIso(e.dataEvento, e.ora);
  if (!inizio) return null;
  const prezzo = prezzoPrincipale(e);
  const esaurito = e.postiDisponibili != null && e.postiDisponibili <= 0;
  const dati = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.titolo,
    description: descrizione,
    startDate: inizio,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: online(e) ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: online(e)
      ? { "@type": "VirtualLocation", url: SITO + urlEvento(e) }
      : { "@type": "Place", name: e.luogo || "Milano", address: e.luogo || "Milano" },
    image: [e.immagineUrl || IMMAGINE_DEFAULT],
    organizer: { "@type": "Organization", name: "Progetto TraMe", url: SITO + "/" },
    url: SITO + urlEvento(e),
  };
  if (prezzo != null) {
    dati.offers = {
      "@type": "Offer",
      price: Number(prezzo).toFixed(2),
      priceCurrency: "EUR",
      availability: e.stato !== "aperto" ? "https://schema.org/SoldOut" : (esaurito ? "https://schema.org/SoldOut" : "https://schema.org/InStock"),
      url: SITO + "/iscrizione-evento.html?id=" + e.id,
    };
  }
  return dati;
}

// --- schede statiche (eventi.html e home) -----------------------------------

// Stessa struttura (e quindi stesse altezze fisse) di renderEventCard in
// events.js, che la sostituisce con i dati vivi appena il backend risponde:
// se cambia una, va cambiata anche l'altra.
function notaIscrizione(prezzoBase, quotaTessera) {
  const domanda = "<p class=\"event-card__nota-iscrizione\">Non sei ancora socio TraMe? Puoi richiedere l'iscrizione durante la prenotazione.</p>";
  if (prezzoBase == null || quotaTessera == null) return domanda;
  return domanda + '<p class="event-card__nota-iscrizione event-card__nota-iscrizione--prezzo">' +
    "<span>Prima partecipazione, inclusa tessera da " + formattaPrezzo(quotaTessera) + "</span>" +
    "<strong>" + formattaPrezzo(Number(prezzoBase) + Number(quotaTessera)) + "</strong></p>";
}

function schedaStatica(e, mappaPagine, quotaTessera) {
  const annunciato = e.stato === "annunciato";
  const pagina = mappaPagine[e.id];
  const media = e.immagineUrl
    ? '<img src="' + esc(e.immagineUrl) + '" alt="' + esc(e.titolo) + '" class="event-card__image" loading="lazy">'
    : '<span class="event-card__media-icon" aria-hidden="true">' + (ICONE[e.categoria] || "🗓️") + "</span>";
  const meta = ["<span>🗓️ " + esc(formattaData(e.dataEvento)) + "</span>"];
  if (e.ora) meta.push("<span>🕐 " + esc(e.ora) + "</span>");
  if (e.luogo) meta.push('<span class="event-card__meta-luogo">📍 ' + esc(e.luogo) + "</span>");
  if (e.notaEvento) meta.push("<span>📝 " + esc(e.notaEvento) + "</span>");
  const prezzo = e.quotaEvento
    ? '<span class="event-card__price-block"><span class="event-card__price">' + formattaPrezzo(e.quotaEvento) + "</span>" +
      '<span class="event-card__price-socio">Prezzo socio</span></span>'
    : "<span></span>";
  const esaurito = e.postiDisponibili != null && e.postiDisponibili <= 0;
  const azione = annunciato
    ? '<a href="interesse-evento.html?id=' + e.id + '" class="btn btn--primary btn--small">Informami quando parte →</a>'
    : (e.stato === "aperto" && !esaurito
      ? '<a href="iscrizione-evento.html?id=' + e.id + '" class="btn btn--primary btn--small">Prenota →</a>'
      : '<span class="btn btn--outline btn--small" aria-disabled="true" style="opacity:.6; pointer-events:none;">' +
        (e.stato !== "aperto" ? "Iscrizioni chiuse" : "Posti esauriti") + "</span>");
  return '<article class="event-card"' + (e.categoria ? ' data-category="' + esc(e.categoria) + '"' : "") + ">" +
    '<div class="event-card__media">' + media +
    (e.categoria ? '<span class="event-card__badge">' + esc(CATEGORIE[e.categoria] || e.categoria) + "</span>" : "") +
    (annunciato ? '<span class="event-card__badge event-card__badge--stato">Prossimamente</span>' : "") + "</div>" +
    '<div class="event-card__body">' +
    (e.categoria ? '<span class="event-card__eyebrow">' + esc(CATEGORIE[e.categoria] || e.categoria) + "</span>" : "") +
    '<h3 class="event-card__title">' + esc(e.titolo) + "</h3>" +
    '<p class="event-card__subtitle">' + esc(e.sottotitolo || "") + "</p>" +
    '<p class="event-card__meta">' + meta.join("") + "</p>" +
    '<div class="event-card__footer">' + prezzo + '<div class="event-card__actions">' + azione + "</div></div>" +
    notaIscrizione(e.quotaEvento, quotaTessera) +
    (e.descrizione ? '<div class="event-card__desc">' + pulisciHtml(e.descrizione) + "</div>" : "") +
    (pagina ? '<a href="' + pagina + '" class="event-card__details-link">Dettagli →</a>' : "") +
    "</div></article>";
}

function ordina(eventi, decrescente) {
  return eventi.slice().sort((a, b) => {
    const da = a.dataEvento || "9999", db = b.dataEvento || "9999";
    return decrescente ? db.localeCompare(da) : da.localeCompare(db);
  });
}

// Riempie un contenitore data-events-mount con le schede statiche e lo
// marca data-prerender: events.js lo sostituisce con i dati vivi, e se il
// backend non risponde lascia queste al posto del messaggio di riserva.
function riempiMount(html, selettoreStato, eventi, mappaPagine, quotaTessera, max) {
  const re = new RegExp('(<div class="[^"]*" data-events-mount data-status="' + selettoreStato + '"[^>]*?)( hidden)?(></div>)');
  const trovato = re.exec(html);
  if (!trovato) throw new Error("Contenitore eventi non trovato: " + selettoreStato);
  if (!eventi.length) return html;
  const schede = (max ? eventi.slice(0, max) : eventi).map((e) => schedaStatica(e, mappaPagine, quotaTessera)).join("");
  return html.replace(re, "$1 data-prerender>" + schede + "</div>");
}

// --- pagine ------------------------------------------------------------------

function paginaEvento(modello, e, impostazioni) {
  const url = SITO + urlEvento(e);
  const categoria = CATEGORIE[e.categoria] || e.categoria || "Evento";
  const testo = testoSemplice(e.descrizione) || testoSemplice(e.testoDettaglio);
  const quando = [formattaDataEstesa(e.dataEvento), e.ora ? "ore " + e.ora : null].filter(Boolean).join(", ");
  const descrizione = riassunto([e.sottotitolo, quando, e.luogo, testo].filter(Boolean).join(" · "), 300);
  const titoloPagina = e.titolo + " — Progetto TraMe";
  const immagine = e.immagineUrl || IMMAGINE_DEFAULT;

  let html = modello;
  html = sostituisci(html, "<title>Evento — Progetto TraMe</title>", "<title>" + esc(titoloPagina) + "</title>", "title");
  html = sostituisci(html, '  <meta name="robots" content="noindex">\n',
    '  <base href="/">\n' +
    anteprimaSocial({ titolo: e.titolo, descrizione, url, immagine, tipo: "article" }) +
    (datiEvento(e, descrizione) ? jsonLd(datiEvento(e, descrizione)) : ""), "robots");
  html = sostituisci(html, "<body>", '<body data-evento-id="' + e.id + '" data-prerender>', "body");
  html = sostituisci(html, '<p id="evento-loading" class="example-note">', '<p id="evento-loading" class="example-note" hidden>', "loading");
  html = sostituisci(html, '<article id="evento-content" hidden>', '<article id="evento-content">', "content");

  if (e.immagineUrl) {
    html = sostituisci(html, '<img id="evento-immagine" class="event-detail__image" alt="" hidden>',
      '<img id="evento-immagine" class="event-detail__image" alt="' + esc(e.titolo) + '" src="' + esc(e.immagineUrl) + '">', "immagine");
  } else {
    html = sostituisci(html, '<span id="evento-media-icon" class="event-detail__media-icon" aria-hidden="true" hidden></span>',
      '<span id="evento-media-icon" class="event-detail__media-icon" aria-hidden="true">' + (ICONE[e.categoria] || "🗓️") + "</span>", "icona");
  }
  html = sostituisci(html, '<span id="evento-badge" class="event-card__badge"></span>', '<span id="evento-badge" class="event-card__badge">' + esc(categoria) + "</span>", "badge");
  html = sostituisci(html, '<span class="section__eyebrow" id="evento-categoria-label"></span>', '<span class="section__eyebrow" id="evento-categoria-label">' + esc(categoria) + "</span>", "categoria");
  html = sostituisci(html, '<h1 id="evento-titolo"></h1>', '<h1 id="evento-titolo">' + esc(e.titolo) + "</h1>", "h1");
  if (e.sottotitolo) {
    html = sostituisci(html, '<p class="event-card__subtitle event-detail__subtitle" id="evento-sottotitolo" hidden></p>',
      '<p class="event-card__subtitle event-detail__subtitle" id="evento-sottotitolo">' + esc(e.sottotitolo) + "</p>", "sottotitolo");
  }
  const meta = ["<span>🗓️ " + esc(formattaData(e.dataEvento)) + "</span>"];
  if (e.ora) meta.push("<span>🕐 " + esc(e.ora) + "</span>");
  if (e.luogo) meta.push("<span>📍 " + esc(e.luogo) + "</span>");
  if (e.notaEvento) meta.push("<span>📝 " + esc(e.notaEvento) + "</span>");
  html = sostituisci(html, '<div class="event-card__meta event-detail__meta" id="evento-meta"></div>',
    '<div class="event-card__meta event-detail__meta" id="evento-meta">' + meta.join("") + "</div>", "meta");
  if (e.scadenzaIscrizione) {
    html = sostituisci(html, '<p class="form-note" id="evento-scadenza" hidden></p>',
      '<p class="form-note" id="evento-scadenza">Prenotazioni entro il ' + esc(formattaData(e.scadenzaIscrizione)) + "</p>", "scadenza");
  }
  if (e.quotaEvento) {
    html = sostituisci(html, '<span class="event-card__price" id="evento-prezzo"></span>', '<span class="event-card__price" id="evento-prezzo">' + formattaPrezzo(e.quotaEvento) + "</span>", "prezzo");
    html = sostituisci(html, '<span class="event-card__price-socio" id="evento-prezzo-socio" hidden>', '<span class="event-card__price-socio" id="evento-prezzo-socio">', "prezzo-socio");
  }
  const prenota = e.stato === "annunciato" ? ["interesse-evento.html?id=" + e.id, "Informami quando parte →"]
    : (e.stato === "aperto" ? ["iscrizione-evento.html?id=" + e.id, "Prenota →"] : [null, "Iscrizioni chiuse"]);
  html = sostituisci(html, '<a id="evento-prenota" href="#" class="btn btn--primary">Prenota →</a>',
    prenota[0] ? '<a id="evento-prenota" href="' + prenota[0] + '" class="btn btn--primary">' + prenota[1] + "</a>"
      : '<a id="evento-prenota" class="btn btn--outline" aria-disabled="true" style="pointer-events:none; opacity:.6;">' + prenota[1] + "</a>", "prenota");
  html = sostituisci(html, '<div id="evento-nota-iscrizione"></div>',
    '<div id="evento-nota-iscrizione">' + notaIscrizione(e.quotaEvento, impostazioni && impostazioni.quotaIscrizioneSoci) + "</div>", "nota-iscrizione");
  html = sostituisci(html, '<div class="event-detail__desc" id="evento-descrizione"></div>',
    '<div class="event-detail__desc" id="evento-descrizione">' + pulisciHtml(e.testoDettaglio || e.descrizione) + "</div>", "descrizione");
  return html;
}

function llmsTxt(eventi, impostazioni) {
  const riga = (e) => {
    const parti = [formattaData(e.dataEvento), e.ora, e.luogo, e.quotaEvento ? formattaPrezzo(e.quotaEvento) : null].filter(Boolean).join(" · ");
    const link = e.dettagliAttivi !== false ? SITO + urlEvento(e) : SITO + "/eventi.html";
    return "- [" + e.titolo + "](" + link + "): " + (CATEGORIE[e.categoria] || "Evento") + (parti ? " — " + parti : "") +
      (e.sottotitolo ? ". " + e.sottotitolo : "");
  };
  const aperti = ordina(eventi.filter((e) => e.stato === "aperto"));
  const annunciati = eventi.filter((e) => e.stato === "annunciato");
  const passati = ordina(eventi.filter((e) => e.stato === "chiuso"), true).slice(0, 10);
  const social = [impostazioni && impostazioni.instagramUrl, impostazioni && impostazioni.facebookUrl].filter(Boolean);
  return [
    "# Progetto TraMe",
    "",
    "> Associazione culturale di Milano che organizza eventi e corsi per ritrovare se stessi insieme agli altri: yoga, fotografia, pasticceria, canto, ballo, teatro, disegno, itinerari urbani e viaggi. Molti eventi sono aperti anche a chi non è socio; ci si prenota e si paga online dal sito.",
    "",
    "Contatti: info@progettotrame.org" + (social.length ? " · " + social.join(" · ") : ""),
    "",
    "## Eventi con iscrizioni aperte",
    aperti.length ? aperti.map(riga).join("\n") : "Al momento nessun evento con iscrizioni aperte.",
    "",
    "## Prossimamente",
    annunciati.length ? annunciati.map(riga).join("\n") : "Nessun evento annunciato.",
    "",
    "## Pagine principali",
    "- [Tutti gli eventi](" + SITO + "/eventi.html): calendario aggiornato",
    "- [Chi siamo](" + SITO + "/chi-siamo.html): il manifesto e i soci fondatori",
    "- [I Fili di TraMe](" + SITO + "/fili.html): le persone e i talenti che conducono gli eventi",
    "- [Diventa socio](" + SITO + "/diventa-socio.html): iscrizione all'associazione",
    "- [Contatti](" + SITO + "/contatti.html)",
    "",
    "## Eventi passati",
    passati.length ? passati.map(riga).join("\n") : "Nessuno.",
    "",
  ].join("\n");
}

// --- principale --------------------------------------------------------------

async function principale() {
  const [eventi, impostazioni] = await Promise.all([leggiJson("/api/eventi"), leggiJson("/api/impostazioni").catch(() => null)]);
  const pubblici = eventi.filter((e) => ["aperto", "annunciato", "chiuso"].includes(e.stato));
  const conPagina = pubblici.filter((e) => e.dettagliAttivi !== false);
  const mappaPagine = Object.fromEntries(conPagina.map((e) => [e.id, urlEvento(e)]));
  const scritti = {};
  const quota = (impostazioni && impostazioni.quotaIscrizioneSoci) || null;

  // Pagine evento
  // A capo normalizzati: i segnaposto usano "\n" (su Windows la copia di
  // lavoro ha CRLF).
  const modello = (await readFile(path.join(RADICE, "evento.html"), "utf8")).replace(/\r\n/g, "\n");
  await rm(path.join(RADICE, "eventi"), { recursive: true, force: true });
  for (const e of conPagina) {
    scritti[urlEvento(e).slice(1) + "index.html"] = paginaEvento(modello, e, impostazioni);
  }

  // Pagine fisse: canonical, anteprima social, dati strutturati in home,
  // schede già scritte in eventi.html e nella sezione "In programma".
  for (const nome of PAGINE_FISSE) {
    let html = (await readFile(path.join(RADICE, nome), "utf8")).replace(/\r\n/g, "\n");
    const titolo = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || "Progetto TraMe";
    const descrizioneAttuale = (/<meta name="description" content="([^"]*)">/.exec(html) || [])[1];
    const url = SITO + (nome === "index.html" ? "/" : "/" + nome);
    // La description c'è già nell'HTML: qui solo canonical e anteprima social.
    let testa = anteprimaSocial({ titolo: titolo.replace(/&amp;/g, "&"), descrizione: null, url, immagine: IMMAGINE_DEFAULT });
    if (descrizioneAttuale) {
      testa += metaTag("property", "og:description", descrizioneAttuale.replace(/&amp;/g, "&").replace(/&#39;/g, "'"));
    }
    if (nome === "index.html") {
      testa += jsonLd({ "@context": "https://schema.org", ...organizzazione(impostazioni) });
    }
    html = sostituisci(html, '  <link rel="icon"', testa + '  <link rel="icon"', nome + " testa");
    if (nome === "eventi.html") {
      const prossimi = ordina(pubblici.filter((e) => e.stato === "aperto")).concat(pubblici.filter((e) => e.stato === "annunciato"));
      html = riempiMount(html, "aperto,annunciato", prossimi, mappaPagine, quota);
      html = riempiMount(html, "chiuso", ordina(pubblici.filter((e) => e.stato === "chiuso"), true), mappaPagine, quota);
      if (prossimi.length) {
        html = sostituisci(html, '<div class="coming-soon" id="eventi-coming-soon">', '<div class="coming-soon" id="eventi-coming-soon" hidden>', "coming-soon");
      }
      if (pubblici.some((e) => e.stato === "chiuso")) {
        html = sostituisci(html, '<section class="section section--alt" id="eventi-passati-section" hidden>', '<section class="section section--alt" id="eventi-passati-section">', "passati");
      }
    }
    if (nome === "index.html") {
      const aperti = ordina(pubblici.filter((e) => e.stato === "aperto"));
      html = riempiMount(html, "aperto", aperti, mappaPagine, quota, 3);
      if (aperti.length) {
        html = html.replace('id="home-coming-soon"', 'id="home-coming-soon" hidden');
      }
    }
    scritti[nome] = html;
  }

  // Indirizzi delle pagine evento per events.js (link "Dettagli").
  scritti["assets/js/pagine-eventi.js"] =
    "// GENERATO da scripts/genera-pagine.mjs durante la pubblicazione: non modificare a mano.\n" +
    "window.TRAME_PAGINE_EVENTI = " + JSON.stringify(mappaPagine) + ";\n";

  scritti["sitemap.xml"] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    PAGINE_FISSE.map((n) => SITO + (n === "index.html" ? "/" : "/" + n))
      .concat(conPagina.map((e) => SITO + urlEvento(e)))
      .map((u) => "  <url><loc>" + esc(u) + "</loc></url>").join("\n") + "\n</urlset>\n";

  scritti["llms.txt"] = llmsTxt(pubblici, impostazioni);

  // Firma: cambia solo se cambia il contenuto generato.
  const firma = createHash("sha256");
  for (const nome of Object.keys(scritti).sort()) firma.update(nome + "\n" + scritti[nome]);
  const valoreFirma = firma.digest("hex");
  scritti["firma-pagine.txt"] = valoreFirma + "\n";

  for (const [nome, contenuto] of Object.entries(scritti)) {
    const destinazione = path.join(RADICE, nome);
    await mkdir(path.dirname(destinazione), { recursive: true });
    await writeFile(destinazione, contenuto);
  }
  console.log("Pagine evento: " + conPagina.length + " · eventi pubblici: " + pubblici.length);
  console.log("FIRMA=" + valoreFirma);
}

principale().catch((err) => {
  console.error("Generazione non riuscita:", err.message);
  process.exit(1);
});
