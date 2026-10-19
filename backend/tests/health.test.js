jest.mock("../src/config/github", () => require("./__mocks__/github"));
jest.mock("../src/config/env", () => require("./__mocks__/env"));
jest.mock("../src/queues/scanQueue", () => ({ scanQueue: { add: jest.fn() } }));
process.env.SESSION_SECRET = "unit-test-session-secret-only";

const request = require("supertest");
const app = require("../src/app");

describe("Health Check", () => {
  test("GET /api/v1/health should return 200", async () => {
    const response = await request(app)
      .get("/api/v1/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.service).toBe("securepatch-backend");
  });

  test("Unknown route should return 404", async () => {
    const response = await request(app)
      .get("/api/v1/does-not-exist");

    expect(response.statusCode).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
