const express = require("express");
const User = require("../models/User");

// This app is never mounted by the product or exposed as an external server.
// Only allowlisted disposable users can stand in for an OAuth-authenticated session.
function createFixtureApp(users, mount, router) {
  const app = express();
  const allowed = new Set(users.map(user => String(user._id)));
  app.use(express.json());
  app.use(async (req, res, next) => {
    try {
      const id = req.get("X-Fixture-Actor");
      req.user = allowed.has(id) ? await User.findById(id) : null;
      req.isAuthenticated = () => Boolean(req.user);
      req.requestId = "disposable-http-acceptance";
      next();
    } catch (error) { next(error); }
  });
  app.use(mount, router);
  app.use(require("../middleware/errorHandler"));
  return app;
}

module.exports = { createFixtureApp };
