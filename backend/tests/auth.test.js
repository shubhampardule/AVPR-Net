jest.mock("../src/config/github", () => require("./__mocks__/github"));
jest.mock("../src/config/env", () => require("./__mocks__/env"));
jest.mock("../src/queues/scanQueue", () => ({ scanQueue: { add: jest.fn() } }));
process.env.SESSION_SECRET = "unit-test-session-secret-only";

const request = require("supertest");
const app = require("../src/app");

describe("Authentication", () => {
  describe("GET /api/v1/auth/me", () => {
    test("should return 401 when user is not authenticated", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me");

      expect(response.statusCode).toBe(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    test("should return 401 when user is not authenticated", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout");

      expect(response.statusCode).toBe(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    });
  });

  describe("POST /api/v1/organizations/invitations/accept", () => {
    test("requires a signed-in account before processing an invitation token", async () => {
      const response = await request(app)
        .post("/api/v1/organizations/invitations/accept")
        .send({ token: "a".repeat(43) });

      expect(response.statusCode).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/v1/auth/google/failure", () => {
    test("should return 401 when Google authentication fails", async () => {
      const response = await request(app)
        .get("/api/v1/auth/google/failure");

      expect(response.statusCode).toBe(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "GOOGLE_AUTH_FAILED",
          message: "Google authentication failed",
        },
      });
    });
  });
});
