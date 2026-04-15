const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const Article = require("../models/Article");
const { protect, authorize } = require("../middleware/auth");

// @route   GET /api/comments
// @desc    Get all comments (Admin only)
// @access  Private/Admin
router.get("/", protect, authorize("admin", "author"), async (req, res) => {
  try {
    const { status, article, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (article) query.article = article;
    
    const comments = await Comment.find(query)
      .populate("article", "title slug featuredImage")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Comment.countDocuments(query);
    
    res.json({
      success: true,
      data: comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   GET /api/comments/article/:articleId
// @desc    Get approved comments for an article
// @access  Public
router.get("/article/:articleId", async (req, res) => {
  try {
    const comments = await Comment.find({ 
      article: req.params.articleId,
      status: "approved"
    })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error("Get article comments error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   POST /api/comments
// @desc    Create a comment
// @access  Public
router.post("/", async (req, res) => {
  try {
    const { articleId, content, guestName, guestEmail } = req.body;
    
    if (!articleId || !content) {
      return res.status(400).json({ 
        success: false, 
        message: "Article ID and content are required" 
      });
    }
    
    // Check if article exists and allows comments
    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: "Article not found" 
      });
    }
    
    if (!article.allowComments) {
      return res.status(403).json({ 
        success: false, 
        message: "Comments are disabled for this article" 
      });
    }
    
    // Auto-approve or set as pending based on settings
    const autoApprove = true; // You can make this configurable
    
    const comment = await Comment.create({
      article: articleId,
      content,
      guestName: guestName || "Guest",
      guestEmail: guestEmail || "",
      status: autoApprove ? "approved" : "pending"
    });
    
    // Add comment reference to article
    await Article.findByIdAndUpdate(articleId, {
      $push: { comments: comment._id }
    });
    
    res.status(201).json({
      success: true,
      data: comment,
      message: "Comment posted successfully"
    });
    
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   PATCH /api/comments/:id/approve
// @desc    Approve a comment
// @access  Private/Admin
router.patch("/:id/approve", protect, authorize("admin", "author"), async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: "Comment not found" 
      });
    }
    
    comment.status = "approved";
    await comment.save();
    
    res.json({ 
      success: true, 
      data: comment,
      message: "Comment approved" 
    });
  } catch (error) {
    console.error("Approve comment error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   PATCH /api/comments/:id/spam
// @desc    Mark comment as spam
// @access  Private/Admin
router.patch("/:id/spam", protect, authorize("admin", "author"), async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: "Comment not found" 
      });
    }
    
    comment.status = "spam";
    await comment.save();
    
    res.json({ 
      success: true, 
      data: comment,
      message: "Comment marked as spam" 
    });
  } catch (error) {
    console.error("Mark spam error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   DELETE /api/comments/:id
// @desc    Delete a comment
// @access  Private/Admin
router.delete("/:id", protect, authorize("admin", "author"), async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: "Comment not found" 
      });
    }
    
    // Remove comment reference from article
    await Article.findByIdAndUpdate(comment.article, {
      $pull: { comments: comment._id }
    });
    
    await comment.deleteOne();
    
    res.json({ 
      success: true, 
      message: "Comment deleted successfully" 
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   DELETE /api/comments/spam/clear
// @desc    Delete all spam comments
// @access  Private/Admin
router.delete("/spam/clear", protect, authorize("admin"), async (req, res) => {
  try {
    const spamComments = await Comment.find({ status: "spam" });
    
    // Remove references from articles
    for (const comment of spamComments) {
      await Article.findByIdAndUpdate(comment.article, {
        $pull: { comments: comment._id }
      });
    }
    
    const result = await Comment.deleteMany({ status: "spam" });
    
    res.json({ 
      success: true, 
      message: `${result.deletedCount} spam comments deleted` 
    });
  } catch (error) {
    console.error("Clear spam error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

module.exports = router;