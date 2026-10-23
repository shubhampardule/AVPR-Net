// Trusted synthetic worker drill. No downloads, scanner executable or repository code.
const mongoose = require("mongoose");
process.once("message", async message => {
  try {
    const { database, authSource, job, mode } = message;
    const { assertDisposableDatabase } = require("./lifecycle-acceptance");
    // Check the namespace before opening a connection or loading worker models.
    if (!/^avpr_acceptance_[a-f0-9]{20}$/.test(database)) throw new Error("Invalid disposable namespace");
    const dnsServers = (process.env.MONGODB_DNS_SERVERS || "").split(",").map(value => value.trim()).filter(Boolean);
    if (dnsServers.length) require("node:dns").setServers(dnsServers);
    await mongoose.connect(process.env.DATABASE_URL, { dbName: database, authSource, autoCreate: false, autoIndex: false,
      maxPoolSize: 2, serverSelectionTimeoutMS: 10000, socketTimeoutMS: 15000 });
    assertDisposableDatabase(database, mongoose.connection);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    process.on("message", message => { if (message.action === "finish") release(); });
    let cleaned = false;
    const runtime = {
      createWorkspace: async () => ({ workspacePath: "/synthetic", cleanup: async () => { cleaned = true; } }),
      createOrchestrator: () => ({ runAll: async () => {
        process.send({ state: "scanning" });
        if (mode === "hold") await gate;
        return { scannersRun: ["semgrep"], scannerErrors: [], coverage: [], results: [{ scanner: "semgrep", findings: [{
          path: "fixture.js", start: { line: 1, col: 1 }, end: { line: 1 }, check_id: "fixture-worker-rule",
          extra: { severity: "WARNING", message: "Synthetic process recovery fixture", lines: "fixture", metadata: { cwe: ["CWE-89"] } },
        }] }] };
      } }),
    };
    let result;
    try { result = await require("../workers/scanWorker").processScanJob(job, runtime); }
    catch { result = { failed: true }; }
    await mongoose.disconnect();
    process.send({ state: "finished", result, cleaned }, () => process.exit(0));
  } catch (error) {
    await mongoose.disconnect().catch(() => {});
    process.send?.({ state: "setup_failed", errorType: error.name || "Error" }, () => process.exit(1));
  }
});
