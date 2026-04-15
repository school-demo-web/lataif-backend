const express = require("express");
const router = express.Router();
const Article = require("../models/Article");
const User = require("../models/User");
const Comment = require("../models/Comment");
const Subscriber = require("../models/Subscriber");
const { protect, authorize } = require("../middleware/auth");

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private (Author/Admin)
router.get("/stats", protect, authorize("author", "admin"), async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = req.user.role === "admin";
    
    // Base query - admin sees all, author sees own
    const articleQuery = isAdmin ? {} : { author: userId };
    
    // Article stats
    const totalArticles = await Article.countDocuments(articleQuery);
    const publishedArticles = await Article.countDocuments({ ...articleQuery, status: "published" });
    const draftArticles = await Article.countDocuments({ ...articleQuery, status: "draft" });
    
    // Total views
    const articles = await Article.find(articleQuery);
    const totalViews = articles.reduce((sum, article) => sum + (article.views || 0), 0);
    
    // Comments
    const commentQuery = isAdmin ? {} : { article: { $in: articles.map(a => a._id) } };
    const totalComments = await Comment.countDocuments(commentQuery);
    const pendingComments = await Comment.countDocuments({ ...commentQuery, status: "pending" });
    
    // Subscribers (admin only)
    let totalSubscribers = 0;
    if (isAdmin) {
      totalSubscribers = await Subscriber.countDocuments({ isActive: true });
    }
    
    // Recent articles
    const recentArticles = await Article.find(articleQuery)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Pending authors (admin only)
    let pendingAuthors = 0;
    if (isAdmin) {
      pendingAuthors = await User.countDocuments({ role: "author", status: "pending" });
    }
    
    res.json({
      success: true,
      data: {
        articles: { total: totalArticles, published: publishedArticles, draft: draftArticles },
        views: totalViews,
        comments: { total: totalComments, pending: pendingComments },
        subscribers: totalSubscribers,
        pendingAuthors,
        recentArticles
      }
    });
    
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   GET /api/dashboard/my-articles
// @desc    Get author's articles
// @access  Private (Author/Admin)
router.get("/my-articles", protect, authorize("author", "admin"), async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { author: req.user._id };
    
    const articles = await Article.find(query)
      .populate("category", "name")
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: articles });
  } catch (error) {
    console.error("My articles error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   GET /api/dashboard/pending-authors
// @desc    Get pending author approvals (admin only)
// @access  Private (Admin)
router.get("/pending-authors", protect, authorize("admin"), async (req, res) => {
  try {
    const pendingAuthors = await User.find({ role: "author", status: "pending" })
      .select("name email createdAt")
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: pendingAuthors });
  } catch (error) {
    console.error("Pending authors error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   PUT /api/dashboard/approve-author/:id
// @desc    Approve an author (admin only)
// @access  Private (Admin)
router.put("/approve-author/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    res.json({ success: true, message: "Author approved", data: user });
  } catch (error) {
    console.error("Approve author error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   GET /api/dashboard/comments
// @desc    Get comments for moderation
// @access  Private (Author/Admin)
router.get("/comments", protect, authorize("author", "admin"), async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role !== "admin") {
      const articles = await Article.find({ author: req.user._id });
      query.article = { $in: articles.map(a => a._id) };
    }
    
    const comments = await Comment.find(query)
      .populate("article", "title")
      .populate("author", "name")
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: comments });
  } catch (error) {
    console.error("Comments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;