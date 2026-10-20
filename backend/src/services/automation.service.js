const crypto = require("node:crypto");
const Automation = require("../models/RepositoryAutomation");
const Organization = require("../models/Organization");
const UsageBucket = require("../models/UsageBucket");
const ScanService = require("./scan.service");
const { bad, repository } = require("../utils/input");
function nextRun(frequency, now = new Date()) {
  if (frequency === "off") return null;
  const next = new Date(now);
  if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else {
    const day = next.getUTCDate(); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + 1);
    const end = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, end));
  }
  return next;
}
async function settings(organization, owner, repo, body) {
  repository(owner, repo); owner = owner.toLowerCase(); repo = repo.toLowerCase();
  const filter = { organization, owner, repo };
  if (!body) return await Automation.findOne(filter).lean() || { push: false, pullRequest: false, frequency: "off" };
  if (Object.keys(body).some(k => !["push", "pullRequest", "frequency"].includes(k)) || typeof body.push !== "boolean" || typeof body.pullRequest !== "boolean" || !["off", "weekly", "monthly"].includes(body.frequency)) throw bad("Invalid automation settings");
  if ((body.push || body.pullRequest) && !process.env.GITHUB_WEBHOOK_SECRET) throw bad("Configure the GitHub App webhook secret and URL before enabling events", 503, "WEBHOOK_NOT_CONFIGURED");
  const org = await Organization.findById(organization);
  if (!org?.githubInstallationId) throw bad("Connect GitHub first");
  await require("./github.service").resolveCommit(org.githubInstallationId, owner, repo);
  return Automation.findOneAndUpdate(filter, { $set: { ...body, installationId: org.githubInstallationId, nextRunAt: nextRun(body.frequency), lastError: null } }, { upsert: true, returnDocument: "after", runValidators: true });
}
async function runDueSchedules() {
  const pending = await Automation.find({ "pendingRefs.0": { $exists: true } }).limit(5);
  for (const config of pending) {
    const ref = config.pendingRefs[0];
    try {
      const job = await ScanService.enqueueScan({ organizationId: config.organization, owner: config.owner, repo: config.repo, ref });
      await Automation.updateOne({ _id: config._id }, { $pull: { pendingRefs: ref }, $set: { lastError: null, lastScanId: String(job.scanId) } });
    } catch { /* Keep the pending commit for the next worker pass. */ }
  }
  for (let count = 0; count < 5; count++) {
    const now = new Date();
    const config = await Automation.findOneAndUpdate({ frequency: { $ne: "off" }, nextRunAt: { $lte: now, $ne: null },
      $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }] }, { $set: { leaseUntil: new Date(Date.now() + 60000) } }, { returnDocument: "after" });
    if (!config) break;
    try {
      const job = await ScanService.enqueueScan({ organizationId: config.organization, owner: config.owner, repo: config.repo });
      config.lastScanId = String(job.scanId); config.lastError = null;
      config.nextRunAt = nextRun(config.frequency);
    } catch { config.lastError = "Scheduled scan could not be queued. Check GitHub access, quota and active scans."; config.nextRunAt = new Date(Date.now() + 15 * 60 * 1000); }
    config.leaseUntil = null; await config.save();
  }
}
function verifySignature(body, signature, secret) {
  if (!secret || !Buffer.isBuffer(body) || typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
async function receive(body, event, delivery) {
  if (typeof delivery !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(delivery)) throw bad("Invalid GitHub delivery identifier");
  if (!["push", "pull_request"].includes(event)) return { skipped: true };
  let payload;
  try { payload = JSON.parse(body.toString("utf8")); } catch { throw bad("Invalid webhook JSON"); }
  const owner = payload.repository?.owner?.login?.toLowerCase(), repo = payload.repository?.name?.toLowerCase();
  repository(owner, repo);
  if (event === "push" && (payload.deleted || payload.ref !== `refs/heads/${payload.repository.default_branch}`)) return { skipped: true };
  if (event === "pull_request" && !["opened", "reopened", "synchronize"].includes(payload.action)) return { skipped: true };
  const ref = event === "push" ? payload.after : payload.pull_request?.head?.sha;
  if (!/^[a-f0-9]{40}$/.test(ref || "")) throw bad("Invalid event commit");
  try { await UsageBucket.create({ _id: `delivery:${delivery}`, count: 1, expires: new Date(Date.now() + 86400000) }); }
  catch (error) { if (error.code === 11000) return { duplicate: true }; throw error; }
  try {
    const configs = await Automation.find({ owner, repo, installationId: String(payload.installation?.id), [event === "push" ? "push" : "pullRequest"]: true }).limit(50);
    for (const config of configs) {
      const stored = await Automation.findOneAndUpdate({ _id: config._id, $or: [{ "pendingRefs.19": { $exists: false } }, { pendingRefs: ref }] },
        { $addToSet: { pendingRefs: ref }, $set: { lastError: null } });
      if (!stored) throw bad("Repository event queue is full (20 commits)", 429, "EVENT_QUEUE_FULL");
    }
    return { accepted: configs.length };
  } catch (error) { await UsageBucket.deleteOne({ _id: `delivery:${delivery}` }); throw error; }
}
module.exports = { nextRun, settings, runDueSchedules, verifySignature, receive };
