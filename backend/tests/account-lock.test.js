const User = require("../src/models/User");
const { lockActiveAccount } = require("../src/services/account-lock.service");
afterEach(() => jest.restoreAllMocks());
test("membership grants acquire a transaction write lock on an active user", async () => {
  const update = jest.spyOn(User, "findOneAndUpdate").mockResolvedValue({ status: "active" });
  const session = { transaction: true };
  await lockActiveAccount("actor", session);
  expect(update).toHaveBeenCalledWith({ _id: "actor", status: "active" }, { $inc: { accessRevision: 1 } }, { session, returnDocument: "after" });
});
test("membership grants reject deleted accounts instead of creating orphan memberships", async () => {
  jest.spyOn(User, "findOneAndUpdate").mockResolvedValue(null);
  await expect(lockActiveAccount("actor", {})).rejects.toMatchObject({ code: "ACCOUNT_CHANGED", statusCode: 409 });
});
