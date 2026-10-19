require("dotenv").config({ quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Demo mode cannot run in production");
process.env.SECUREPATCH_DEMO_MODE = "true";
require("../server");
