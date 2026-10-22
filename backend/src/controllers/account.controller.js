const ApiResponse = require("../utils/ApiResponse");
const { bad } = require("../utils/input");
const { deleteAccount } = require("../services/account-deletion.service");

async function deleteMyAccount(req, res, next) {
  try {
    if (!req.body || Object.keys(req.body).length !== 1 || typeof req.body.confirmation !== "string") {
      throw bad("Provide only your account email as confirmation");
    }
    await deleteAccount(req.user._id, req.body.confirmation);
    // The persisted account is already inactive even if this session store fails.
    req.user = null;
    if (req.session) {
      try { await new Promise(resolve => req.session.destroy(() => resolve())); }
      catch { require("../config/logger").warn("account_deleted_session_cleanup_failed"); }
    }
    res.clearCookie("securepatch.sid", { httpOnly: true,
      secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    return ApiResponse.success(res, { deleted: true }, "Your account has been deleted");
  } catch (error) { next(error); }
}
module.exports = { deleteMyAccount };
