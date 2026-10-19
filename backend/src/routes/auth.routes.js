const express = require("express");
const passport = require("../config/passport");
const { googleCallback, getCurrentUser, logout, } = require("../controllers/auth.controller");
const { requireAuth, } = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
    "/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
    })
);

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