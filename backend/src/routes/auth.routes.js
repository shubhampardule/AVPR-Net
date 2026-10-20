const express = require("express");
const passport = require("../config/passport");
const { googleCallback, getCurrentUser, logout, } = require("../controllers/auth.controller");
const { requireAuth, } = require("../middleware/auth.middleware");

const router = express.Router();
const { startGitHubLogin, finishGitHubLogin } = require("../controllers/githubAuth.controller");
const safeReturnTo = require("../utils/safeReturnTo");

router.get("/github", startGitHubLogin);
router.get("/github/callback", finishGitHubLogin);

router.get("/google", (req, res, next) => {
    req.session.authReturnTo = safeReturnTo(req.query.returnTo);
    req.session.save((error) => {
        if (error) return next(error);
        return passport.authenticate("google", { scope: ["profile", "email"], state: true })(req, res, next);
    });
});

router.get(
    "/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/api/v1/auth/google/failure",
    }),
    googleCallback
);

router.get("/google/failure", (req, res) => {
    res.status(401).json({
        success: false,
        error: {
            code: "GOOGLE_AUTH_FAILED",
            message: "Google authentication failed",
        },
    });
});

router.post(
    "/logout",
    requireAuth,
    logout
);

router.get(
    "/me",
    requireAuth,
    getCurrentUser
);

module.exports = router;
