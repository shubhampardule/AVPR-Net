const mongoose = require("mongoose");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");

async function persistScanCompletion({ scanId, leaseToken, fields, findings }) {
  // Collection/index initialization must happen outside the transaction.
  if (findings.length) await Finding.init();
  await mongoose.connection.transaction(async session => {
    // Lock the scan before writing evidence. Cancellation and replacement claims
    // update this same record, causing a conflict/recheck instead of stale writes.
    const owned = await Scan.findOneAndUpdate({ _id: scanId, status: "running", cancelledAt: null, leaseToken,
      $or: [{ deadlineAt: null }, { deadlineAt: { $gt: new Date() } }] },
      { $set: fields }, { session });
    if (!owned) throw new Error("Scan was cancelled, expired, or its lease was replaced before completion");
    if (findings.length) {
      await Finding.bulkWrite(findings.map(finding => ({ updateOne: {
        filter: { scan: scanId, fingerprint: finding.fingerprint },
        update: { $setOnInsert: finding }, upsert: true,
      } })), { ordered: false, session });
    }
  });
}

module.exports = { persistScanCompletion };
