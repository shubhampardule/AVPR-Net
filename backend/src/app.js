const express = require("express");
const cors = require("cors");
require("dotenv").config({ quiet: true });
const demoMode = process.env.SECUREPATCH_DEMO_MODE === "true";
if (demoMode && process.env.NODE_ENV === "production") throw new Error("Demo mode cannot run in production");
const routes = demoMode ? require("./routes/demo.routes") : require("./routes");
const httpLogger = require("./middleware/httpLogger");
const notFoundHandler = require("./middleware/notFoundHandler");
const errorHandler = require("./middleware/errorHandler");
const session = require("express-session");
const passport = demoMode ? null : require("./config/passport");
const env = require("./config/env");
const connectDatabase = require("./config/database");
const MongoSessionStore = require("./config/mongoSessionStore");

const app = express();
if (env.nodeEnv === "production") app.set("trust proxy", 1);
app.use((req, res, next) => {
  req.requestId = require("node:crypto").randomUUID();
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("X-XSS-Protection", "0");
  next();
});

app.use(
  cors({
    origin: ["http://localhost:5174", "http://127.0.0.1:5174"],
    credentials: true,
    exposedHeaders: ["X-Request-ID", "X-SecurePatch-Audit-Recorded", "X-SecurePatch-Verification-Recorded"],
  })
);

app.use("/api/v1/webhooks/github", express.raw({ type: "application/json", limit: "256kb" }));
app.use(express.json({ limit: "24kb", strict: true }));
app.get("/api/v1/health/live", (req, res) => res.json({ success: true, data: {
  status: "ok", revision: process.env.VERCEL_GIT_COMMIT_SHA || null,
} }));

if (!demoMode && env.nodeEnv !== "test") {
  app.use((req, res, next) => {
    connectDatabase().then(() => next(), next);
  });
}

if (!demoMode) {
  app.use(
    session({
      name: "securepatch.sid",
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store:
        env.nodeEnv === "test"
          ? undefined
          : new MongoSessionStore({
              collectionName: "sessions",
              ttl: 60 * 60 * 24,
            }),
      cookie: {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24,
      },
    })
  );
}

if (passport) {
  app.use(passport.initialize());
  app.use(passport.session());
}

app.use(httpLogger);

app.use("/api/v1", routes);

app.use(notFoundHandler);

app.use(errorHandler);

module.exports = app;
