const Scan = require("../models/Scan");
const EXPIRY_BATCH_SIZE = 500;

async function expireOverdueScans({ organization, activeKey } = {}, now = new Date()) {
  const filter = { status: { $in: ["queued", "running"] }, deadlineAt: { $lte: now },
    ...(organization ? { organization } : {}), ...(activeKey ? { activeKey } : {}) };
  const ids = await Scan.find(filter).select("_id").sort({ deadlineAt: 1, _id: 1 }).limit(EXPIRY_BATCH_SIZE).lean();
  if (!ids.length) return 0;
  // Recheck eligibility after selection; a concurrent completion must survive.
  const result = await Scan.updateMany({ ...filter, _id: { $in: ids.map(scan => scan._id) } },
    { $set: { status: "failed", activeKey: null, leaseUntil: null, leaseToken: null,
      errorMessage: "Scan deadline expired", completedAt: now } });
  return result.modifiedCount;
}

module.exports = { expireOverdueScans, EXPIRY_BATCH_SIZE };
