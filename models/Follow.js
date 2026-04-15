const mongoose = require("mongoose");

const FollowSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  deviceId: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent duplicate follows
FollowSchema.index({ author: 1, deviceId: 1 }, { unique: true, sparse: true });
FollowSchema.index({ author: 1, follower: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Follow", FollowSchema);