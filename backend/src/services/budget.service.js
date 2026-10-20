const UsageBucket = require("../models/UsageBucket");
const { bad } = require("../utils/input");
async function consume(key, maximum, windowMs, now = Date.now()) {
  const start = Math.floor(now / windowMs) * windowMs;
  const id = `${key}:${start}`;
  // Ensure one shared bucket before incrementing; the predicate makes admission atomic.
  try { await UsageBucket.updateOne({ _id: id }, { $setOnInsert: { count: 0, expires: new Date(start + windowMs * 2) } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const admitted = await UsageBucket.findOneAndUpdate({ _id: id, count: { $lt: maximum } }, { $inc: { count: 1 } }, { returnDocument: "after" });
  if (!admitted) throw bad("Usage limit reached; retry after the current window.", 429, "USAGE_LIMIT");
}
async function reserveSlots(key, maximum = 2) {
  const owner = require("node:crypto").randomUUID();
  for (let slot = 0; slot < maximum; slot++) {
    try {
      const record = await UsageBucket.findOneAndUpdate({ _id: `${key}:${slot}`, expires: { $lt: new Date() } },
        { $set: { owner, expires: new Date(Date.now() + 240000) } }, { upsert: true, returnDocument: "after" });
      if (record) return () => UsageBucket.deleteOne({ _id: record._id, owner });
    } catch (error) { if (error.code !== 11000) throw error; }
  }
  throw bad("Two requests are already running. Retry when one finishes.", 429, "AI_BUSY");
}
module.exports = { consume, reserveSlots };
