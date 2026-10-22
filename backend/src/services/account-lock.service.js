const User = require("../models/User");
const { bad } = require("../utils/input");

// Membership grants and account deletion must contend on this document.
async function lockActiveAccount(userId, session) {
  const account = await User.findOneAndUpdate(
    { _id: userId, status: "active" }, { $inc: { accessRevision: 1 } },
    { session, returnDocument: "after" }
  );
  if (!account) throw bad("This account is no longer active. Sign in again.", 409, "ACCOUNT_CHANGED");
  return account;
}
module.exports = { lockActiveAccount };
