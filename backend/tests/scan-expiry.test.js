jest.mock("../src/models/Scan", () => ({ find: jest.fn(), updateMany: jest.fn() }));
const Scan = require("../src/models/Scan");
const { expireOverdueScans, EXPIRY_BATCH_SIZE } = require("../src/services/scan-expiry.service");
beforeEach(() => jest.resetAllMocks());

test("expiry is bounded, scoped and rechecks active status and deadline during the write", async () => {
  const query = { select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ _id: "expired" }]) };
  Scan.find.mockReturnValue(query); Scan.updateMany.mockResolvedValue({ modifiedCount: 1 });
  const now = new Date();
  expect(await expireOverdueScans({ organization: "org", activeKey: "org:team/repo" }, now)).toBe(1);
  expect(query.limit).toHaveBeenCalledWith(EXPIRY_BATCH_SIZE);
  expect(Scan.updateMany).toHaveBeenCalledWith({ organization: "org", activeKey: "org:team/repo",
    _id: { $in: ["expired"] }, status: { $in: ["queued", "running"] }, deadlineAt: { $lte: now } },
  { $set: expect.objectContaining({ status: "failed", activeKey: null, leaseToken: null, completedAt: now }) });
});

test("an empty expiry batch performs no write", async () => {
  const query = { select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
  Scan.find.mockReturnValue(query);
  expect(await expireOverdueScans()).toBe(0);
  expect(Scan.updateMany).not.toHaveBeenCalled();
});
