const mongoose = require("mongoose");

const organizationMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    role: {
      type: String,
      enum: ["owner", "admin", "developer"],
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "invited", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

organizationMemberSchema.index(
  { user: 1, organization: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "OrganizationMember",
  organizationMemberSchema
);