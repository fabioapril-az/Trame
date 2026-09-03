// Non più il punto di ingresso: "main" in package.json ora punta
// direttamente a src/functions/*.js (pattern standard del programming
// model v4), che si autoregistrano con app.http(...) al require.
// Questo file resta solo come nota storica — vedi src/functions/ per le
// route reali. events.js e settings.js furono rimossi quando la gestione
// eventi/impostazioni è passata al backend .NET (dbo.eventi, GET/PUT
// /api/impostazioni). Le uniche route oggi in questo scaffold sono
// l'ambiente di TEST per Stripe Checkout (src/functions/pagamenti-test-shared.js
// e i file che lo usano): isolato apposta, non collegato ai dati reali.
