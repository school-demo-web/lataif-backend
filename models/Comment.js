const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Article",
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  deviceId: {
    type: String,
    default: 'anonymous'
  },
  guestName: {
    type: String,
    default: 'Guest'
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "approved"
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment"
  }],
  likes: [{
    type: String  // Store device IDs for likes
  }],
  isEdited: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Comment", CommentSchema);