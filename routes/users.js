const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Article = require("../models/Article");
const { protect } = require("../middleware/auth");

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("followers", "name avatar");
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Get article counts
    const totalArticles = await Article.countDocuments({ author: user._id });
    const publishedArticles = await Article.countDocuments({ author: user._id, status: "published" });
    
    // Get total views
    const articles = await Article.find({ author: user._id });
    const totalViews = articles.reduce((sum, article) => sum + (article.views || 0), 0);
    
    const userData = user.toObject();
    userData.totalArticles = totalArticles;
    userData.publishedArticles = publishedArticles;
    userData.totalViews = totalViews;
    
    res.json({ success: true, data: userData });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// @route   GET /api/users/authors
// @desc    Get all authors
// @access  Public
router.get("/authors", async (req, res) => {
  try {
    const authors = await User.find({ 
      role: { $in: ["author", "admin"] },
      totalArticles: { $gt: 0 }
    })
      .select("name avatar bio totalArticles totalViews followers")
      .sort({ totalArticles: -1 });
    
    res.json({ success: true, data: authors });
  } catch (error) {
    console.error("Get authors error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/users/:id
// @desc    Get user profile by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -email")
      .populate("followers", "name avatar");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const articles = await Article.find({ 
      author: user._id,
      status: "published"
    })
      .populate("category", "name")
      .sort({ publishedAt: -1 })
      .limit(10);
    
    res.json({ success: true, data: { user, articles } });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", protect, async (req, res) => {
  try {
    const allowedUpdates = ["name", "bio", "avatar", "socialLinks"];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select("-password");
    
    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/users/:id/follow
// @desc    Follow/Unfollow user
// @access  Private
router.post("/:id/follow", protect, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }
    
    const userToFollow = await User.findById(req.params.id);
    if (!userToFollow) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const currentUser = await User.findById(req.user._id);
    const followIndex = currentUser.following.indexOf(req.params.id);
    
    if (followIndex === -1) {
      currentUser.following.push(req.params.id);
      userToFollow.followers.push(req.user._id);
    } else {
      currentUser.following.splice(followIndex, 1);
      const followerIndex = userToFollow.followers.indexOf(req.user._id);
      userToFollow.followers.splice(followerIndex, 1);
    }
    
    await currentUser.save();
    await userToFollow.save();
    
    res.json({
      success: true,
      isFollowing: followIndex === -1,
      followersCount: userToFollow.followers.length
    });
  } catch (error) {
    console.error("Follow user error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;