const assert = require("node:assert/strict");
const { fork } = require("node:child_process");
const path = require("node:path");
const mongoose = require("mongoose");
const request = require("supertest");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const Notification = require("../models/Notification");

function waitFor(child, state) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("Disposable worker timed out")), 25000);
    const onMessage = message => {
      if (message.state === state) finish(null, message);
      else if (message.state === "setup_failed") finish(new Error("Disposable worker setup failed"));
    };
    const onExit = () => finish(new Error("Disposable worker exited before expected state"));
    const onError = () => finish(new Error("Disposable worker could not start"));
    function finish(error, value) {
      clearTimeout(timer); child.off("message", onMessage); child.off("exit", onExit); child.off("error", onError);
      if (error) reject(error); else resolve(value);
    }
    child.on("message", onMessage); child.once("exit", onExit); child.once("error", onError);
  });
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Disposable worker did not stop")), 10000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill();
  });
}

async function runWorkerProcessChecks({ organization, actor }) {
  const children = [], checks = [];
  const start = (scan, mode) => {
    const child = fork(path.join(__dirname, "worker-acceptance-child.js"), [], {
      windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"],
      env: { ...process.env, REDIS_URL: "", NODE_ENV: "test", VERCEL: "0", DOTENV_CONFIG_QUIET: "true" },
    });
    children.push(child);
    child.send({ database: mongoose.connection.db.databaseName,
      authSource: mongoose.connection.getClient().options.credentials?.source, mode,
      job: { id: String(scan._id), data: { scanId: String(scan._id), organizationId: String(organization),
        installationId: "123", owner: "fixture", repo: scan.repo } } });
    return child;
  };
  const create = repo => Scan.create({ organization, owner: "fixture", repo, installationId: "123", status: "queued",
    commitSha: "a".repeat(40), deadlineAt: new Date(Date.now() + 120000), activeKey: `${organization}:fixture/${repo}` });
  try {
    let scan = await create("worker-restart");
    const interrupted = start(scan, "hold");
    await waitFor(interrupted, "scanning");
    const claimed = await Scan.findById(scan._id);
    assert.equal(claimed.status, "running"); assert.ok(claimed.leaseToken);
    await stop(interrupted);
    assert.equal((await Scan.findById(scan._id)).status, "running");
    assert.equal(await Finding.countDocuments({ scan: scan._id }), 0);
    // Advance only this fixture's lease instead of waiting a full minute.
    await Scan.updateOne({ _id: scan._id, leaseToken: claimed.leaseToken }, { $set: { leaseUntil: new Date(Date.now() - 1000) } });
    const replacement = start(scan, "complete");
    const recovered = await waitFor(replacement, "finished");
    assert.equal(recovered.result.success, true); assert.equal(recovered.cleaned, true);
    assert.equal((await Scan.findById(scan._id)).status, "completed");
    assert.equal(await Finding.countDocuments({ scan: scan._id }), 1);
    const duplicate = start(scan, "complete");
    assert.equal((await waitFor(duplicate, "finished")).result.skipped, true);
    assert.equal(await Finding.countDocuments({ scan: scan._id }), 1);
    checks.push("terminated_worker_is_recovered_by_new_process_without_duplicate_evidence");

    scan = await create("worker-cancel");
    const worker = start(scan, "hold");
    await waitFor(worker, "scanning");
    const app = require("./acceptance-http").createFixtureApp([actor], "/scans", require("../routes/scan.routes"));
    assert.equal((await request(app).post(`/scans/${scan._id}/cancel`).set("X-Fixture-Actor", String(actor._id))).status, 200);
    const finished = waitFor(worker, "finished");
    worker.send({ action: "finish" });
    const cancelled = await finished;
    assert.equal(cancelled.result.failed, true); assert.equal(cancelled.cleaned, true);
    const record = await Scan.findById(scan._id);
    assert.equal(record.status, "failed"); assert.ok(record.cancelledAt);
    assert.equal(await Finding.countDocuments({ scan: scan._id }), 0);
    assert.equal(await Notification.countDocuments({ scan: scan._id }), 0);
    checks.push("http_cancellation_blocks_running_worker_process_and_success_notifications");
  } finally {
    await Promise.all(children.map(stop));
  }
  return checks;
}

module.exports = { runWorkerProcessChecks };
