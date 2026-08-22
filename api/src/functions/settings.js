const { app } = require("@azure/functions");
const { getTableClient } = require("../shared/tables");
const { isEditor } = require("../shared/auth");

const TABLE_NAME = "Settings";
const PARTITION_KEY = "site";
const ROW_KEY = "settings";

function toPublicSettings(entity) {
  return {
    instagramUrl: (entity && entity.instagramUrl) || "",
    facebookUrl: (entity && entity.facebookUrl) || "",
    galleryUrl: (entity && entity.galleryUrl) || "",
  };
}

// GET /api/settings -> pubblico (link social + eventuale link galleria)
// PUT /api/settings -> solo editor
app.http("settings", {
  route: "settings",
  methods: ["GET", "PUT"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const client = await getTableClient(TABLE_NAME);

    if (request.method === "GET") {
      try {
        const entity = await client.getEntity(PARTITION_KEY, ROW_KEY);
        return { jsonBody: toPublicSettings(entity) };
      } catch (err) {
        if (err.statusCode === 404) {
          return { jsonBody: toPublicSettings(null) };
        }
        throw err;
      }
    }

    // PUT: riservato agli editor.
    if (!isEditor(request)) {
      return { status: 403, jsonBody: { error: "Accesso riservato agli editor." } };
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return { status: 400, jsonBody: { error: "Corpo della richiesta non valido." } };
    }

    const entity = {
      partitionKey: PARTITION_KEY,
      rowKey: ROW_KEY,
      instagramUrl: typeof body.instagramUrl === "string" ? body.instagramUrl.trim() : "",
      facebookUrl: typeof body.facebookUrl === "string" ? body.facebookUrl.trim() : "",
      galleryUrl: typeof body.galleryUrl === "string" ? body.galleryUrl.trim() : "",
    };

    await client.upsertEntity(entity, "Replace");

    return { jsonBody: toPublicSettings(entity) };
  },
});
