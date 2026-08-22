const { app } = require("@azure/functions");
const { randomUUID } = require("crypto");
const { getTableClient } = require("../shared/tables");
const { getClientPrincipal, isEditor } = require("../shared/auth");

const TABLE_NAME = "Events";
const PARTITION_KEY = "event";
const VALID_STATUSES = ["bozza", "pubblicato", "fatto"];

function toPublicEvent(entity) {
  return {
    id: entity.rowKey,
    title: entity.title,
    description: entity.description || "",
    category: entity.category || "",
    whenLabel: entity.whenLabel || "",
    whereLabel: entity.whereLabel || "",
    ctaLabel: entity.ctaLabel || "Scrivici per iscriverti",
    status: entity.status || "bozza",
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

// GET /api/events            -> pubblico, solo eventi "pubblicato"
// GET /api/events?all=1      -> solo editor, tutti gli eventi (bozza/pubblicato/fatto)
app.http("events", {
  route: "events",
  methods: ["GET", "POST"],
  authLevel: "anonymous", // il controllo vero è fatto da staticwebapp.config.json + qui sotto
  handler: async (request, context) => {
    const client = await getTableClient(TABLE_NAME);

    if (request.method === "GET") {
      const wantsAll = request.query.get("all") === "1";
      if (wantsAll && !isEditor(request)) {
        return { status: 403, jsonBody: { error: "Accesso riservato agli editor." } };
      }

      const entities = client.listEntities({
        queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
      });

      const events = [];
      for await (const entity of entities) {
        if (wantsAll || entity.status === "pubblicato") {
          events.push(toPublicEvent(entity));
        }
      }
      events.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

      return { jsonBody: { events } };
    }

    // POST: crea un nuovo evento — riservato agli editor.
    if (!isEditor(request)) {
      return { status: 403, jsonBody: { error: "Accesso riservato agli editor." } };
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return { status: 400, jsonBody: { error: "Corpo della richiesta non valido." } };
    }

    if (!body || typeof body.title !== "string" || !body.title.trim()) {
      return { status: 400, jsonBody: { error: "Il titolo dell'evento è obbligatorio." } };
    }

    const status = VALID_STATUSES.includes(body.status) ? body.status : "bozza";
    const now = new Date().toISOString();
    const principal = getClientPrincipal(request);

    const entity = {
      partitionKey: PARTITION_KEY,
      rowKey: randomUUID(),
      title: body.title.trim(),
      description: (body.description || "").trim(),
      category: (body.category || "").trim(),
      whenLabel: (body.whenLabel || "").trim(),
      whereLabel: (body.whereLabel || "").trim(),
      ctaLabel: (body.ctaLabel || "").trim(),
      status,
      createdAt: now,
      updatedAt: now,
      createdBy: principal ? principal.userDetails : "sconosciuto",
    };

    await client.createEntity(entity);

    return { status: 201, jsonBody: { event: toPublicEvent(entity) } };
  },
});

// PUT    /api/events/{id}  -> aggiorna un evento (anche solo lo status, es. "segna come fatto")
// DELETE /api/events/{id}  -> elimina un evento
// Entrambe riservate agli editor.
app.http("eventsById", {
  route: "events/{id}",
  methods: ["PUT", "DELETE"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (!isEditor(request)) {
      return { status: 403, jsonBody: { error: "Accesso riservato agli editor." } };
    }

    const id = request.params.id;
    const client = await getTableClient(TABLE_NAME);

    if (request.method === "DELETE") {
      try {
        await client.deleteEntity(PARTITION_KEY, id);
      } catch (err) {
        if (err.statusCode === 404) {
          return { status: 404, jsonBody: { error: "Evento non trovato." } };
        }
        throw err;
      }
      return { status: 204 };
    }

    // PUT: aggiornamento parziale (merge) dei campi passati nel body.
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return { status: 400, jsonBody: { error: "Corpo della richiesta non valido." } };
    }

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return { status: 400, jsonBody: { error: "Stato evento non valido." } };
    }

    const updatable = ["title", "description", "category", "whenLabel", "whereLabel", "ctaLabel", "status"];
    const entity = { partitionKey: PARTITION_KEY, rowKey: id, updatedAt: new Date().toISOString() };
    for (const field of updatable) {
      if (typeof body[field] === "string") {
        entity[field] = body[field].trim();
      }
    }

    try {
      await client.updateEntity(entity, "Merge");
    } catch (err) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: "Evento non trovato." } };
      }
      throw err;
    }

    return { jsonBody: { ok: true } };
  },
});
