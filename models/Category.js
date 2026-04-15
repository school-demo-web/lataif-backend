const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    unique: true,
    trim: true
  },
  nameEn: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [200, "Description cannot exceed 200 characters"]
  },
  color: {
    type: String,
    default: "#00464a"
  },
  icon: {
    type: String,
    default: "folder"
  },
  articleCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create slug from name
CategorySchema.pre("save", function(next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\u0600-\u06FF\w\-]+/g, "");
  }
  next();
});

module.exports = mongoose.model("Category", CategorySchema);
