// Segnala a Bing (e agli altri motori che aderiscono a IndexNow) le pagine
// del sito appena ripubblicate, così le trovano in minuti invece che giorni.
// Gira nel workflow dopo una pubblicazione di produzione; legge la
// sitemap.xml generata da genera-pagine.mjs. La chiave è pubblica per
// definizione: il file <chiave>.txt nella radice del sito prova a Bing che
// la segnalazione arriva dal proprietario del dominio.
//
// Uso: node scripts/indexnow.mjs   (non fallisce mai il workflow)

import { readFile } from "node:fs/promises";

const CHIAVE = "72ee2b8bb8d1172d5386b51c6e3cfcae";
const HOST = "progettotrame.org";

try {
  const sitemap = await readFile("sitemap.xml", "utf8");
  const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!urlList.length) {
    console.log("IndexNow: nessuna pagina nella sitemap");
  } else {
    const risposta = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: CHIAVE, keyLocation: "https://" + HOST + "/" + CHIAVE + ".txt", urlList }),
      signal: AbortSignal.timeout(20000),
    });
    // 200/202 = ricevuto; 403 = chiave non trovata sul sito; 422 = URL non del dominio.
    console.log("IndexNow: " + risposta.status + " per " + urlList.length + " pagine");
  }
} catch (err) {
  console.log("IndexNow non riuscito: " + err.message);
}
