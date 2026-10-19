const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config({ quiet: true });
const demoMode = process.env.SECUREPATCH_DEMO_MODE === "true";
if (demoMode && process.env.NODE_ENV === "production") throw new Error("Demo mode cannot run in production");
const routes = demoMode ? require("./routes/demo.routes") : require("./routes");
const httpLogger = require("./middleware/httpLogger");
const notFoundHandler = require("./middleware/notFoundHandler");
const errorHandler = require("./middleware/errorHandler");
const session = require("express-session");
const passport = demoMode ? null : require("./config/passport");

const app = express();
app.use((req, res, next) => {
  req.requestId = require("node:crypto").randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

app.use(helmet());

app.use(
  cors({
    origin: ["http://localhost:5174", "http://127.0.0.1:5174"],
    credentials: true,
  })
);

app.use(express.json({ limit: "24kb", strict: true }));

if (!demoMode) app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

if (passport) {
  app.use(passport.initialize());
  app.use(passport.session());
}

app.use(httpLogger);

app.use("/api/v1", routes);

app.use(notFoundHandler);

app.use(errorHandler);

module.exports = app;
