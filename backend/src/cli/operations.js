require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const { snapshot } = require("../services/operations.service");

async function main() {
  let result;
  if (!process.env.DATABASE_URL) {
    result = { status: "unavailable", alerts: ["DATABASE_NOT_CONFIGURED"] };
  } else {
    try {
      const dnsServers = (process.env.MONGODB_DNS_SERVERS || "").split(",").map(value => value.trim()).filter(Boolean);
      if (dnsServers.length) require("node:dns").setServers(dnsServers);
      await mongoose.connect(process.env.DATABASE_URL, { autoIndex: false, autoCreate: false, maxPoolSize: 2,
        serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 5000 });
      result = await snapshot();
    } catch { result = { status: "unavailable", alerts: ["DATABASE_UNAVAILABLE"] }; }
    finally { await mongoose.disconnect().catch(() => {}); }
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ...result }));
  process.exitCode = result.status === "ok" ? 0 : result.status === "degraded" ? 1 : 2;
}

if (require.main === module) main().catch(() => {
  console.log(JSON.stringify({ status: "unavailable", alerts: ["MONITOR_FAILED"] })); process.exitCode = 2;
});
module.exports = { main };
