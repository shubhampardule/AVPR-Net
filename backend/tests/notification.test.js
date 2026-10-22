jest.mock("../src/models/OrganizationMember", () => ({ find: jest.fn() }));
jest.mock("../src/models/Notification", () => ({ bulkWrite: jest.fn() }));
jest.mock("../src/config/logger", () => ({ error: jest.fn() }));

const OrganizationMember = require("../src/models/OrganizationMember");
const Notification = require("../src/models/Notification");
const logger = require("../src/config/logger");
const { eventForScan, notifyScanResult } = require("../src/services/notification.service");

const base = { _id: "scan-1", organization: "org-1", owner: "Team", repo: "project", status: "completed",
  scannersUsed: ["semgrep", "bandit"], scannerErrors: [], summary: { total: 3, critical: 1, high: 1 } };
function memberships(users = ["user-1", "user-2"]) {
  return { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(users.map(user => ({ user }))) };
}

beforeEach(() => jest.clearAllMocks());

test("classifies complete, partial and failed scans without exposing scanner error text", () => {
  expect(eventForScan(base)).toMatchObject({ type: "scan.completed", body: "3 findings detected · 1 critical · 1 high." });
  expect(eventForScan({ ...base, scannerErrors: [{ scanner: "bandit", message: "private diagnostic" }] }))
    .toMatchObject({ type: "scan.partial" });
  expect(eventForScan({ ...base, status: "failed" })).toMatchObject({ type: "scan.failed" });
  expect(eventForScan({ ...base, status: "completed", scannersUsed: [] })).toMatchObject({ type: "scan.partial" });
  expect(eventForScan({ ...base, cancelledAt: new Date() })).toBeNull();
  expect(eventForScan({ ...base, scannerErrors: [{ message: "private diagnostic" }] }).body).not.toContain("private diagnostic");
});

test("delivers idempotent notices only to active members with scan updates enabled", async () => {
  OrganizationMember.find.mockReturnValue(memberships());
  Notification.bulkWrite.mockResolvedValue({ upsertedCount: 2, modifiedCount: 0 });

  await expect(notifyScanResult(base)).resolves.toMatchObject({ delivered: 2, skipped: false });

  expect(OrganizationMember.find).toHaveBeenCalledWith({ organization: "org-1", status: "active", "notificationPreferences.scanResults": { $ne: false } });
  const [operations, options] = Notification.bulkWrite.mock.calls[0];
  expect(options).toEqual({ ordered: false });
  expect(operations).toHaveLength(2);
  expect(operations[0].updateOne).toMatchObject({ filter: { recipient: "user-1", dedupeKey: "scan-1:scan.completed" }, upsert: true });
  expect(operations[0].updateOne.update.$setOnInsert).toMatchObject({
    organization: "org-1", recipient: "user-1", type: "scan.completed", repository: "Team/project",
    href: "/github/Team/project/scan?scanId=scan-1", title: "Scan completed",
  });
  expect(operations[0].updateOne.update.$setOnInsert.expiresAt.getTime() - operations[0].updateOne.update.$setOnInsert.createdAt.getTime())
    .toBe(90 * 24 * 60 * 60 * 1000);
});

test("does not create a notification for cancelled or unterminal scans", async () => {
  expect(await notifyScanResult({ ...base, status: "running" })).toEqual({ delivered: 0, skipped: true });
  expect(await notifyScanResult({ ...base, cancelledAt: new Date() })).toEqual({ delivered: 0, skipped: true });
  expect(OrganizationMember.find).not.toHaveBeenCalled();
  expect(Notification.bulkWrite).not.toHaveBeenCalled();
});

test("notification storage failures stay best effort and log only event identifiers", async () => {
  OrganizationMember.find.mockReturnValue(memberships(["user-1"]));
  Notification.bulkWrite.mockRejectedValue(new Error("raw database detail"));

  await expect(notifyScanResult(base)).resolves.toMatchObject({ failed: true, delivered: 0 });

  expect(logger.error).toHaveBeenCalledWith("notification_delivery_failed type=scan.completed scan=scan-1 error=Error");
  expect(logger.error.mock.calls[0][0]).not.toContain("raw database detail");
});
