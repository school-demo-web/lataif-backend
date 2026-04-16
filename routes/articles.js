const express = require("express");
const router = express.Router();
const Article = require("../models/Article");
const User = require("../models/User");
const Category = require("../models/Category");
const { protect, authorize } = require("../middleware/auth");





// @route   GET /api/articles
// @desc    Get all articles (paginated)
// @access  Public
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const query = { status: "published" };
    
    if (req.query.category) query.category = req.query.category;
    if (req.query.author) query.author = req.query.author;
    if (req.query.search) query.$text = { $search: req.query.search };
    
    const articles = await Article.find(query)
      .populate("author", "name avatar")
      .populate("category", "name nameEn")
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Article.countDocuments(query);
    
    res.json({
      success: true,
      data: articles,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error("Get articles error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/articles/trending
// @desc    Get trending articles
// @access  Public
router.get("/trending", async (req, res) => {
  try {
    const articles = await Article.find({ status: "published" })
      .populate("author", "name avatar")
      .populate("category", "name nameEn")
      .sort({ views: -1 })
      .limit(5);
    
    res.json({ success: true, data: articles });
  } catch (error) {
    console.error("Get trending error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/articles/:id
// @desc    Get single article by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate("author", "name avatar bio")
      .populate("category", "name nameEn");
    
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }
    
    // Increment view count
    article.views += 1;
    await article.save();
    
    // Update author's total views
    if (article.author) {
      await User.findByIdAndUpdate(article.author._id, {
        $inc: { totalViews: 1 }
      });
    }
    
    // Get related articles
    const relatedArticles = await Article.find({
      _id: { $ne: article._id },
      category: article.category?._id,
      status: "published"
    })
      .populate("author", "name avatar")
      .limit(3);
    
    res.json({
      success: true,
      data: article,
      related: relatedArticles
    });
  } catch (error) {
    console.error("Get article error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/articles
// @desc    Create new article
// @access  Private (Author/Admin)
router.post("/", protect, authorize("author", "admin"), async (req, res) => {
  try {
    const articleData = { ...req.body, author: req.user._id };
    const article = await Article.create(articleData);
    
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalArticles: 1 } });
    await Category.findByIdAndUpdate(article.category, { $inc: { articleCount: 1 } });
    
    res.status(201).json({ success: true, data: article });
  } catch (error) {
    console.error("Create article error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PUT /api/articles/:id
// @desc    Update article
// @access  Private (Owner/Admin)
router.put("/:id", protect, async (req, res) => {
  try {
    let article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: "Article not found" });
    
    if (article.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    article = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: article });
  } catch (error) {
    console.error("Update article error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   DELETE /api/articles/:id
// @desc    Delete article
// @access  Private (Owner/Admin)
router.delete("/:id", protect, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: "Article not found" });
    
    if (article.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    await article.deleteOne();
    await User.findByIdAndUpdate(article.author, { $inc: { totalArticles: -1 } });
    await Category.findByIdAndUpdate(article.category, { $inc: { articleCount: -1 } });
    
    res.json({ success: true, message: "Article deleted successfully" });
  } catch (error) {
    console.error("Delete article error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ============================================
// UPDATED LIKE ROUTE - Works with Auth OR DeviceID
// ============================================
// @route   POST /api/articles/:id/like
// @desc    Like/Unlike article (Works for guests with deviceId)
// @access  Public
router.post("/:id/like", async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }
    
    const { deviceId } = req.body;
    
    // Check if user is authenticated
    let identifier = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = require("jsonwebtoken").verify(token, process.env.JWT_SECRET);
        identifier = decoded.id.toString();
      } catch (e) {
        // Token invalid, fall back to deviceId
      }
    }
    
    // If not authenticated, use deviceId
    if (!identifier) {
      if (!deviceId) {
        return res.status(400).json({ 
          success: false, 
          message: "Device ID required for guest likes" 
        });
      }
      identifier = deviceId;
    }
    
    // Check if already liked (likes array stores strings)
    const likeIndex = article.likes.findIndex(id => id.toString() === identifier);
    
    if (likeIndex === -1) {
      article.likes.push(identifier);
    } else {
      article.likes.splice(likeIndex, 1);
    }
    
    await article.save();
    
    res.json({ 
      success: true, 
      likes: article.likes.length, 
      isLiked: likeIndex === -1 
    });
    
  } catch (error) {
    console.error("Like article error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;