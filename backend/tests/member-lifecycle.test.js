jest.mock("../src/models/User", () => ({ findOne: jest.fn() }));
const Membership = require("../src/models/OrganizationMember");
const User = require("../src/models/User");
const { removeMember, addMember } = require("../src/controllers/member.controller");
const member = () => new Membership({ user: "000000000000000000000001", organization: "000000000000000000000002", role: "developer" });
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
beforeEach(() => jest.restoreAllMocks());
test("revocation saves a schema-valid non-active status", async () => {
  const document = member();
  jest.spyOn(Membership, "findOne").mockResolvedValue(document);
  jest.spyOn(document, "save").mockImplementation(() => document.validate());
  const next = jest.fn(), res = response();
  await removeMember({ params: { organizationId: document.organization, userId: document.user } }, res, next);
  expect(next).not.toHaveBeenCalled(); expect(document.status).toBe("suspended");
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
});
test("suspended membership can be restored with a new authorized role", async () => {
  const document = member(); document.status = "suspended";
  jest.spyOn(Membership, "findOne").mockResolvedValue(document);
  jest.spyOn(document, "save").mockImplementation(() => document.validate());
  User.findOne.mockResolvedValue({ _id: document.user, name: "Test", email: "test@example.com" });
  const next = jest.fn();
  await addMember({ params: { organizationId: document.organization }, body: { email: "test@example.com", role: "admin" } }, response(), next);
  expect(next).not.toHaveBeenCalled(); expect(document.status).toBe("active"); expect(document.role).toBe("admin");
});
test("owner membership is protected from removal", async () => {
  const document = member(); document.role = "owner";
  jest.spyOn(Membership, "findOne").mockResolvedValue(document);
  const res = response();
  await removeMember({ params: {} }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(403); expect(document.status).toBe("active");
});
