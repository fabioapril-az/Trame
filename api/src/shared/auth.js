// Legge l'identità dell'utente autenticato che Azure Static Web Apps allega
// automaticamente ad ogni richiesta tramite l'header x-ms-client-principal
// (JSON codificato in base64). Vedi:
// https://learn.microsoft.com/azure/static-web-apps/user-information

/**
 * @param {import('@azure/functions').HttpRequest} request
 * @returns {{ userId: string, userDetails: string, identityProvider: string, userRoles: string[] } | null}
 */
function getClientPrincipal(request) {
  const header = request.headers.get("x-ms-client-principal");
  if (!header) {
    return null;
  }
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

/**
 * @param {import('@azure/functions').HttpRequest} request
 * @returns {boolean}
 */
function isEditor(request) {
  const principal = getClientPrincipal(request);
  return Boolean(principal && principal.userRoles && principal.userRoles.includes("editor"));
}

module.exports = { getClientPrincipal, isEditor };
