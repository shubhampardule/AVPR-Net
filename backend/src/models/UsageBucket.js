const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  _id: String, count: { type: Number, default: 0 }, owner: String, expires: { type: Date, required: true },
});
schema.index({ expires: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.models.UsageBucket || mongoose.model("UsageBucket", schema);
