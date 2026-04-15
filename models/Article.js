const mongoose = require("mongoose");

const ArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
    maxlength: [200, "Title cannot exceed 200 characters"]
  },
  titleEn: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: [true, "Content is required"]
  },
  excerpt: {
    type: String,
    maxlength: [300, "Excerpt cannot exceed 300 characters"]
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  featuredImage: {
    type: String,
    default: ""
  },
  pdfAttachment: {
    type: String,
    default: ""
  },
  youtubeUrl: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft"
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  allowComments: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: String
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment"
  }],
  readingTime: {
    type: Number,
    default: 0
  },
  publishedAt: {
    type: Date
  },
  seoKeywords: [{
    type: String
  }]
}, {
  timestamps: true
});

ArticleSchema.pre("save", function(next) {
  if (!this.excerpt && this.content) {
    const plainText = this.content.replace(/<[^>]*>/g, "");
    this.excerpt = plainText.substring(0, 250) + "...";
  }
  
  if (this.content) {
    const plainText = this.content.replace(/<[^>]*>/g, "");
    const wordCount = plainText.split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / 200);
  }
  
  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

ArticleSchema.index({ title: "text", content: "text", tags: "text" });

module.exports = mongoose.model("Article", ArticleSchema);