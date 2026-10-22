const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    accessRevision: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    profileImage: {
      type: String,
      default: null,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    githubId: { type: String, unique: true, sparse: true },
    githubUsername: { type: String, trim: true },

    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
