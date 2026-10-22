jest.mock("../src/models/Notification", () => ({
  find: jest.fn(), countDocuments: jest.fn(), updateMany: jest.fn(), findOneAndUpdate: jest.fn(),
}));
jest.mock("../src/models/OrganizationMember", () => ({ findOneAndUpdate: jest.fn() }));
jest.mock("../src/middleware/auth.middleware", () => ({ requireAuth: (req, res, next) => { req.user = { _id: "user-1" }; next(); } }));
jest.mock("../src/middleware/organization.middleware", () => ({ requireOrganizationMember: (req, res, next) => {
  req.organizationMembership = { _id: "member-1", notificationPreferences: {} }; next();
} }));

const express = require("express");
const request = require("supertest");
const Notification = require("../src/models/Notification");
const OrganizationMember = require("../src/models/OrganizationMember");
const errorHandler = require("../src/middleware/errorHandler");
const routes = require("../src/routes/notification.routes");

const app = express();
app.use(express.json());
app.use("/organizations", routes);
app.use(errorHandler);

beforeEach(() => jest.clearAllMocks());

test("lists only the signed-in member's organization notifications and includes preferences and unread count", async () => {
  const items = [{ _id: "507f1f77bcf86cd799439011", type: "scan.completed", title: "Scan completed" }];
  const query = { select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(items) };
  Notification.find.mockReturnValue(query);
  Notification.countDocuments.mockResolvedValueOnce(1).mockResolvedValueOnce(3);

  const response = await request(app).get("/organizations/org-1/notifications?page=1&limit=10&unreadOnly=true");

  expect(response.status).toBe(200);
  expect(Notification.find).toHaveBeenCalledWith({ organization: "org-1", recipient: "user-1", readAt: null });
  expect(Notification.countDocuments).toHaveBeenNthCalledWith(2, { organization: "org-1", recipient: "user-1", readAt: null });
  expect(response.body.data).toMatchObject({ notifications: items, unreadCount: 3, preferences: { scanResults: true }, pagination: { total: 1 } });
});

test("marks a notification read only within the current recipient and organization", async () => {
  const notificationId = "507f1f77bcf86cd799439011";
  const saved = { _id: notificationId, readAt: new Date("2026-10-22T00:00:00Z") };
  const query = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(saved) };
  Notification.findOneAndUpdate.mockReturnValue(query);

  const response = await request(app).patch(`/organizations/org-1/notifications/${notificationId}/read`);

  expect(response.status).toBe(200);
  expect(Notification.findOneAndUpdate).toHaveBeenCalledWith({ _id: notificationId, organization: "org-1", recipient: "user-1" },
    { $set: { readAt: expect.any(Date) } }, { returnDocument: "after" });
  expect(response.body.data.notification._id).toBe(notificationId);
});

test("marks all of the current member's unread organization notices as read", async () => {
  Notification.updateMany.mockResolvedValue({ modifiedCount: 4 });

  const response = await request(app).patch("/organizations/org-1/notifications/read-all");

  expect(response.status).toBe(200);
  expect(Notification.updateMany).toHaveBeenCalledWith({ organization: "org-1", recipient: "user-1", readAt: null },
    { $set: { readAt: expect.any(Date) } });
  expect(response.body.data.markedRead).toBe(4);
});

test("changes only the signed-in member's scan-results preference", async () => {
  OrganizationMember.findOneAndUpdate.mockResolvedValue({ notificationPreferences: { scanResults: false } });

  const response = await request(app).patch("/organizations/org-1/notification-preferences").send({ scanResults: false });

  expect(response.status).toBe(200);
  expect(OrganizationMember.findOneAndUpdate).toHaveBeenCalledWith({ _id: "member-1", user: "user-1", organization: "org-1", status: "active" },
    { $set: { "notificationPreferences.scanResults": false } }, { returnDocument: "after", runValidators: true });
  expect(response.body.data.preferences.scanResults).toBe(false);
});

test("rejects unsupported preference fields and malformed unread filters", async () => {
  const preference = await request(app).patch("/organizations/org-1/notification-preferences").send({ scanResults: false, emails: true });
  const filter = await request(app).get("/organizations/org-1/notifications?unreadOnly=yes");

  expect(preference.status).toBe(400);
  expect(filter.status).toBe(400);
  expect(OrganizationMember.findOneAndUpdate).not.toHaveBeenCalled();
});
