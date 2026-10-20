const Membership = require("../src/models/OrganizationMember");
const { removeMember } = require("../src/controllers/member.controller");
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
test("owner membership is protected from removal", async () => {
  const document = member(); document.role = "owner";
  jest.spyOn(Membership, "findOne").mockResolvedValue(document);
  const res = response();
  await removeMember({ params: {} }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(403); expect(document.status).toBe("active");
});
