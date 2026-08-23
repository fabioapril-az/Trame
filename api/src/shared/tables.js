const { TableClient } = require("@azure/data-tables");

// Cache in-process: evita di richiamare createTable() ad ogni invocazione
// quando l'istanza della Function resta "calda" tra una richiesta e l'altra.
const ensuredTables = new Set();

/**
 * Restituisce un TableClient per la tabella richiesta, creandola se non
 * esiste ancora. La connection string dello Storage Account è configurata
 * come Application Setting sulla Static Web App (vedi guida di setup).
 * @param {string} tableName
 */
async function getTableClient(tableName) {
  const connectionString = process.env.EVENTS_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "Manca l'application setting EVENTS_STORAGE_CONNECTION_STRING sulla Static Web App."
    );
  }

  const client = TableClient.fromConnectionString(connectionString, tableName, {
    allowInsecureConnection: connectionString.includes("UseDevelopmentStorage=true"),
  });

  if (!ensuredTables.has(tableName)) {
    await client.createTable();
    ensuredTables.add(tableName);
  }

  return client;
}

module.exports = { getTableClient };
