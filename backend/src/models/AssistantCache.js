const mongoose = require("mongoose");
const schema = new mongoose.Schema({ _id: String, organization: { type: mongoose.Schema.Types.ObjectId, index: true }, result: mongoose.Schema.Types.Mixed, expires: Date });
schema.index({ expires: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.models.AssistantCache || mongoose.model("AssistantCache", schema);
