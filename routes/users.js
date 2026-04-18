const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Article = require("../models/Article");
const { protect, authorize } = require("../middleware/auth");

// =============================================
// PUBLIC ROUTES
// =============================================

/**
 * @route   GET /api/users/authors
 * @desc    Get popular approved authors (Used on All Posts & Homepage)
 * @access  Public
 */
router.get("/authors", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 6;

        // ✅ FIXED: Only fetch authors with role "author" (exclude admins)
        const authors = await User.find({
            role: "author",  // ← CHANGED: Only authors, not admins
            status: "approved"
        })
            .select("name avatar bio totalArticles totalViews followers")
            .sort({ totalArticles: -1, totalViews: -1 })
            .limit(limit);

        // Calculate followers count for each author
        const authorsWithStats = authors.map(author => ({
            ...author.toObject(),
            followersCount: author.followers?.length || 0
        }));

        res.json({
            success: true,
            count: authorsWithStats.length,
            data: authorsWithStats
        });
    } catch (error) {
        console.error("Get popular authors error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error while fetching authors" 
        });
    }
});

/**
 * @route   GET /api/users/authors/all
 * @desc    Get all approved authors including admins (for admin use)
 * @access  Public (can be used for filters)
 */
router.get("/authors/all", async (req, res) => {
    try {
        const authors = await User.find({
            role: { $in: ["author", "admin"] },
            status: "approved"
        })
            .select("name avatar bio totalArticles totalViews followers role")
            .sort({ role: 1, totalArticles: -1 });

        const authorsWithStats = authors.map(author => ({
            ...author.toObject(),
            followersCount: author.followers?.length || 0
        }));

        res.json({
            success: true,
            count: authorsWithStats.length,
            data: authorsWithStats
        });
    } catch (error) {
        console.error("Get all authors error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error while fetching authors" 
        });
    }
});

/**
 * @route   GET /api/users/profile
 * @desc    Get current logged-in user profile
 * @access  Private
 */
router.get("/profile", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select("-password")
            .populate("followers", "name avatar");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Real-time stats calculation
        const totalArticles = await Article.countDocuments({ author: user._id });
        const publishedArticles = await Article.countDocuments({ 
            author: user._id, 
            status: "published" 
        });

        const viewsResult = await Article.aggregate([
            { $match: { author: user._id, status: "published" } },
            { $group: { _id: null, totalViews: { $sum: "$views" } } }
        ]);

        const userData = user.toObject();
        userData.totalArticles = totalArticles;
        userData.publishedArticles = publishedArticles;
        userData.totalViews = viewsResult[0]?.totalViews || 0;
        userData.followersCount = user.followers?.length || 0;

        res.json({ success: true, data: userData });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get public author profile by ID
 * @access  Public
 */
router.get("/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select("-password -email")
            .populate("followers", "name avatar");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const articles = await Article.find({ 
            author: user._id,
            status: "published"
        })
            .populate("category", "name")
            .sort({ publishedAt: -1 })
            .limit(10);

        // Calculate accurate stats
        const totalArticles = await Article.countDocuments({ 
            author: user._id, 
            status: "published" 
        });
        
        const viewsResult = await Article.aggregate([
            { $match: { author: user._id, status: "published" } },
            { $group: { _id: null, totalViews: { $sum: "$views" } } }
        ]);

        const userData = user.toObject();
        userData.totalArticles = totalArticles;
        userData.totalViews = viewsResult[0]?.totalViews || 0;
        userData.followersCount = user.followers?.length || 0;

        res.json({ 
            success: true, 
            data: { 
                user: userData, 
                articles 
            } 
        });
    } catch (error) {
        console.error("Get user by ID error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// =============================================
// PRIVATE ROUTES (User Actions)
// =============================================

/**
 * @route   PUT /api/users/profile
 * @desc    Update own profile
 * @access  Private
 */
router.put("/profile", protect, async (req, res) => {
    try {
        const allowedUpdates = ["name", "bio", "avatar", "socialLinks"];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/**
 * @route   POST /api/users/:id/follow
 * @desc    Follow or Unfollow user
 * @access  Private
 */
router.post("/:id/follow", protect, async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: "Cannot follow yourself" });
        }

        const userToFollow = await User.findById(req.params.id);
        if (!userToFollow) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const currentUser = await User.findById(req.user._id);

        const isAlreadyFollowing = currentUser.following.includes(req.params.id);

        if (isAlreadyFollowing) {
            // Unfollow
            currentUser.following = currentUser.following.filter(
                id => id.toString() !== req.params.id
            );
            userToFollow.followers = userToFollow.followers.filter(
                id => id.toString() !== req.user._id.toString()
            );
        } else {
            // Follow
            currentUser.following.push(req.params.id);
            userToFollow.followers.push(req.user._id);
        }

        await currentUser.save();
        await userToFollow.save();

        res.json({
            success: true,
            isFollowing: !isAlreadyFollowing,
            followersCount: userToFollow.followers.length
        });
    } catch (error) {
        console.error("Follow/Unfollow error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// =============================================
// ADMIN WRITER MANAGEMENT ROUTES
// =============================================

// @route   GET /api/users/admin/writers
// @desc    Get all writers (authors) with filters - ADMIN ONLY
// @access  Private/Admin
router.get("/admin/writers", protect, authorize("admin"), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    let query = { role: "author" };
    
    if (status && status !== "all") {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const writers = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("approvedBy", "name");
    
    const total = await User.countDocuments(query);
    
    const writersWithStats = await Promise.all(writers.map(async (writer) => {
      const totalArticles = await Article.countDocuments({ author: writer._id });
      const publishedArticles = await Article.countDocuments({ author: writer._id, status: "published" });
      const draftArticles = totalArticles - publishedArticles;
      
      return {
        ...writer.toObject(),
        stats: {
          totalArticles,
          publishedArticles,
          draftArticles
        }
      };
    }));
    
    res.json({
      success: true,
      data: writersWithStats,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Get writers error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// @route   PUT /api/users/admin/writers/:id/approve
// @desc    Approve a writer - ADMIN ONLY
// @access  Private/Admin
router.put("/admin/writers/:id/approve", protect, authorize("admin"), async (req, res) => {
  try {
    const writer = await User.findById(req.params.id);
    
    if (!writer) {
      return res.status(404).json({ success: false, message: "Writer not found" });
    }
    
    if (writer.role !== "author") {
      return res.status(400).json({ success: false, message: "User is not an author" });
    }
    
    writer.status = "approved";
    writer.approvedAt = new Date();
    writer.approvedBy = req.user._id;
    
    await writer.save();
    
    res.json({
      success: true,
      message: "Writer approved successfully",
      data: writer
    });
  } catch (error) {
    console.error("Approve writer error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// @route   PUT /api/users/admin/writers/:id/suspend
// @desc    Suspend a writer - ADMIN ONLY
// @access  Private/Admin
router.put("/admin/writers/:id/suspend", protect, authorize("admin"), async (req, res) => {
  try {
    const writer = await User.findById(req.params.id);
    
    if (!writer) {
      return res.status(404).json({ success: false, message: "Writer not found" });
    }
    
    if (writer.role !== "author") {
      return res.status(400).json({ success: false, message: "User is not an author" });
    }
    
    writer.status = "suspended";
    await writer.save();
    
    res.json({
      success: true,
      message: "Writer suspended successfully",
      data: writer
    });
  } catch (error) {
    console.error("Suspend writer error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// @route   PUT /api/users/admin/writers/:id/activate
// @desc    Activate a suspended writer - ADMIN ONLY
// @access  Private/Admin
router.put("/admin/writers/:id/activate", protect, authorize("admin"), async (req, res) => {
  try {
    const writer = await User.findById(req.params.id);
    
    if (!writer) {
      return res.status(404).json({ success: false, message: "Writer not found" });
    }
    
    if (writer.role !== "author") {
      return res.status(400).json({ success: false, message: "User is not an author" });
    }
    
    writer.status = "approved";
    await writer.save();
    
    res.json({
      success: true,
      message: "Writer activated successfully",
      data: writer
    });
  } catch (error) {
    console.error("Activate writer error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// @route   DELETE /api/users/admin/writers/:id
// @desc    Delete a writer - ADMIN ONLY
// @access  Private/Admin
router.delete("/admin/writers/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const writer = await User.findById(req.params.id);
    
    if (!writer) {
      return res.status(404).json({ success: false, message: "Writer not found" });
    }
    
    if (writer.role !== "author") {
      return res.status(400).json({ success: false, message: "User is not an author" });
    }
    
    const deleteArticles = req.query.deleteArticles === "true";
    if (deleteArticles) {
      await Article.deleteMany({ author: writer._id });
    }
    
    await writer.deleteOne();
    
    res.json({
      success: true,
      message: "Writer deleted successfully",
      articlesDeleted: deleteArticles
    });
  } catch (error) {
    console.error("Delete writer error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// @route   GET /api/users/admin/writers/stats
// @desc    Get writer statistics for admin dashboard
// @access  Private/Admin
router.get("/admin/writers/stats", protect, authorize("admin"), async (req, res) => {
  try {
    const totalWriters = await User.countDocuments({ role: "author" });
    const pendingWriters = await User.countDocuments({ role: "author", status: "pending" });
    const approvedWriters = await User.countDocuments({ role: "author", status: "approved" });
    const suspendedWriters = await User.countDocuments({ role: "author", status: "suspended" });
    
    const topWriters = await User.aggregate([
      { $match: { role: "author", status: "approved" } },
      { $lookup: {
          from: "articles",
          localField: "_id",
          foreignField: "author",
          as: "articles"
        }
      },
      { $addFields: { articleCount: { $size: "$articles" } } },
      { $sort: { articleCount: -1 } },
      { $limit: 5 },
      { $project: { name: 1, avatar: 1, articleCount: 1, totalViews: 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalWriters,
        pendingWriters,
        approvedWriters,
        suspendedWriters,
        topWriters
      }
    });
  } catch (error) {
    console.error("Get writer stats error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

module.exports = router;