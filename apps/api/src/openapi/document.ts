export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "StrawToDo API",
    version: "0.2.1.3",
    description:
      "Telegram Cursor inbox + Linear board. Auth: Authorization: Bearer <API_KEY> or X-Api-Key. Telegram path: POST /telegram/todos (create+run), GET /telegram/queue — no edit.",
  },
  servers: [{ url: "/v1" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          details: {},
        },
      },
      Issue: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          identifier: { type: "string", example: "STD-1" },
          title: { type: "string" },
          description: { type: "string" },
          status: {
            type: "string",
            enum: ["backlog", "todo", "in_progress", "in_review", "done", "canceled"],
          },
          priority: {
            type: "string",
            enum: ["none", "low", "medium", "high", "urgent"],
          },
          project_id: { type: "string", nullable: true },
          assignee_id: { type: "string", nullable: true },
          label_ids: { type: "array", items: { type: "string" } },
          created_by: { type: "string" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string" },
        },
      },
      Comment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          issue_id: { type: "string", format: "uuid" },
          body: { type: "string" },
          created_by: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/health": {
      get: {
        security: [],
        summary: "Health check",
        responses: { "200": { description: "OK" } },
      },
    },
    "/projects": {
      get: {
        summary: "List projects",
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Create project",
        responses: { "201": { description: "Created" } },
      },
    },
    "/issues": {
      get: {
        summary: "List issues",
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "project_id", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Create issue",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" },
          },
        ],
        responses: { "201": { description: "Created" } },
      },
    },
    "/issues/{id}": {
      get: {
        summary: "Get issue by id or identifier",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
      patch: {
        summary: "Update issue",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
    },
    "/issues/{id}/comments": {
      get: {
        summary: "List comments",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Add comment",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Created" } },
      },
    },
    "/search": {
      get: {
        summary: "Search issues",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/issues/{id}/runs": {
      get: { summary: "List runs for an issue", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
      post: { summary: "Start an Agent run", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "201": { description: "Created" }, "409": { description: "Busy" } } },
    },
    "/queue/start": {
      post: { summary: "Run the next Todo", responses: { "201": { description: "Created" }, "409": { description: "Busy" } } },
    },
    "/telegram/todos": {
      post: {
        summary: "Telegram Inbox：建 Todo（可一次多張），run:true 立刻派工。不編輯。",
        parameters: [{ name: "Idempotency-Key", in: "header", schema: { type: "string" } }],
        responses: { "201": { description: "Created" }, "409": { description: "Busy run queued as todo" } },
      },
    },
    "/telegram/queue": {
      get: { summary: "Telegram Inbox：Todo／進行中／待審＋現行 Run", responses: { "200": { description: "OK" } } },
    },
    "/telegram/todos/{id}": {
      get: {
        summary: "Telegram Inbox：單張狀態＋留言＋Run（唯讀）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
    },
    "/telegram/todos/{id}/run": {
      post: {
        summary: "Telegram Inbox：執行指定 Todo",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Started" }, "409": { description: "Busy" } },
      },
    },
    "/telegram/queue/start": {
      post: { summary: "Telegram Inbox：執行佇列下一張", responses: { "201": { description: "Created" }, "409": { description: "Busy" } } },
    },
    "/api-keys": {
      post: {
        summary: "Create API key",
        responses: { "201": { description: "Created (raw key shown once)" } },
      },
    },
  },
} as const;
