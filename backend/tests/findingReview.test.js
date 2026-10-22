jest.mock("../src/config/env", () => require("./__mocks__/env"));
jest.mock("../src/config/github", () => require("./__mocks__/github"));
jest.mock("../src/middleware/auth.middleware", () => ({ requireAuth: (req, res, next) => next() }));
jest.mock("../src/middleware/scanAccess.middleware", () => ({ requireScanMember: (req, res, next) => next() }));
jest.mock("../src/models/Scan", () => ({ findById: jest.fn() }));
jest.mock("../src/models/Finding", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));

const express = require("express");
const request = require("supertest");
const Scan = require("../src/models/Scan");
const Finding = require("../src/models/Finding");
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.user = { _id: "507f1f77bcf86cd799439011" }; next(); });
app.use("/scans", require("../src/routes/scan.routes"));

beforeEach(() => {
  jest.clearAllMocks();
  Scan.findById.mockResolvedValue({ _id: "507f1f77bcf86cd799439012", organization: "org" });
  Finding.findOne.mockResolvedValue({ _id: "507f1f77bcf86cd799439013" });
  Finding.findOneAndUpdate.mockImplementation(async (filter, update) => ({
    _id: filter._id, status: update.$set.status, statusReason: update.$set.statusReason,
    reviewedBy: update.$set.reviewedBy, reviewedAt: update.$set.reviewedAt,
    reviewHistory: [update.$push.reviewHistory],
  }));
});

test("review updates save the decision and append an audit entry", async () => {
  const response = await request(app).patch("/scans/507f1f77bcf86cd799439012/findings/507f1f77bcf86cd799439013")
    .send({ status: "dismissed", reason: "The affected function is not reachable." });
  expect(response.status).toBe(200);
  expect(Finding.findOneAndUpdate).toHaveBeenCalledWith(
    { _id: "507f1f77bcf86cd799439013", scan: "507f1f77bcf86cd799439012" },
    expect.objectContaining({
      $set: expect.objectContaining({ status: "dismissed", statusReason: "The affected function is not reachable." }),
      $push: { reviewHistory: expect.objectContaining({ status: "dismissed", reason: "The affected function is not reachable." }) },
    }),
    { returnDocument: "after", runValidators: true },
  );
  expect(response.body.data.reviewHistory[0].reviewedAt).toBeTruthy();
});

test("review updates reject a missing reason", async () => {
  const response = await request(app).patch("/scans/507f1f77bcf86cd799439012/findings/507f1f77bcf86cd799439013")
    .send({ status: "acknowledged", reason: "  " });
  expect(response.status).toBe(400);
  expect(Finding.findOneAndUpdate).not.toHaveBeenCalled();
});
