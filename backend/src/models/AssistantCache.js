const mongoose = require("mongoose");
const schema = new mongoose.Schema({ _id: String, result: mongoose.Schema.Types.Mixed, expires: Date });
schema.index({ expires: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.models.AssistantCache || mongoose.model("AssistantCache", schema);
