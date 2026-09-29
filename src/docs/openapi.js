export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Saraha Backend API",
    version: "1.0.0",
    description: "API for account management and anonymous messaging.",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      PublicUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          username: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          gender: { type: "integer" },
          profilePicture: { type: "string", nullable: true },
          coverProfilePictures: { type: "array", items: { type: "string" } },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          requestId: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/auth/signup": {
      post: {
        summary: "Create an account",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["username", "email", "password", "phone"], properties: { username: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", format: "password" }, confirmPassword: { type: "string" }, phone: { type: "string" } } } } },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }, "409": { description: "Account already exists" } },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } } } } },
        responses: { "200": { description: "Access and refresh tokens" }, "401": { description: "Invalid credentials" }, "429": { description: "Rate limited" } },
      },
    },
    "/user/{userId}": {
      get: {
        summary: "Read public user profile",
        parameters: [{ in: "path", name: "userId", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } }],
        responses: {
          "200": {
            description: "Public profile",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PublicUser" } } },
          },
          "404": { description: "User not found" },
        },
      },
      patch: {
        summary: "Update own profile",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "userId", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", minProperties: 1, additionalProperties: false, properties: { firstName: { type: "string" }, lastName: { type: "string" }, gender: { type: "integer", enum: [1, 2] }, phone: { type: "string" } } } } } },
        responses: { "200": { description: "Updated public profile" }, "401": { description: "Authentication required" }, "403": { description: "Not the profile owner" }, "400": { description: "Invalid input" } },
      },
    },
    "/message/list": {
      get: {
        summary: "List my messages",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
          { in: "query", name: "cursor", required: false, schema: { type: "string" }, description: "Cursor returned by the previous page" },
        ],
        responses: { "200": { description: "Message page with pageInfo.nextCursor" }, "400": { description: "Invalid cursor or page size" }, "401": { description: "Authentication required" } },
      },
    },
    "/message/{receiverId}": {
      post: { summary: "Send an anonymous message", parameters: [{ in: "path", name: "receiverId", required: true, schema: { type: "string" } }], responses: { "201": { description: "Message sent" }, "400": { description: "Invalid message" }, "404": { description: "Receiver unavailable" } } },
    },
  },
};
