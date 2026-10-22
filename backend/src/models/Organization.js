const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "suspended", "deleting", "deleted"],
      default: "active",
    },

    githubInstallationId: {
      type: String,
      default: null,
      index: true,
    },

    deletionRequestedAt: { type: Date, default: null },
    purgeAfter: { type: Date, default: null, index: true },
    purgeAttemptedAt: { type: Date, default: null },
    purgedAt: { type: Date, default: null },
    hostedAiEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Organization || mongoose.model("Organization", organizationSchema);
