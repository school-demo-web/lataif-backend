const express = require("express");
const router = express.Router();
const Follow = require("../models/Follow");
const User = require("../models/User");

// @route   POST /api/follows
// @desc    Follow an author (guest or authenticated)
// @access  Public
router.post("/", async (req, res) => {
  try {
    const { authorId, deviceId, email } = req.body;
    
    if (!authorId) {
      return res.status(400).json({ success: false, message: "Author ID required" });
    }
    
    if (!deviceId && !req.user?._id) {
      return res.status(400).json({ success: false, message: "Device ID or authentication required" });
    }
    
    const author = await User.findById(authorId);
    if (!author) {
      return res.status(404).json({ success: false, message: "Author not found" });
    }
    
    // Check if already following
    const query = req.user?._id 
      ? { author: authorId, follower: req.user._id }
      : { author: authorId, deviceId };
    
    const existingFollow = await Follow.findOne(query);
    
    if (existingFollow) {
      return res.status(400).json({ success: false, message: "Already following" });
    }
    
    // Create follow
    const followData = { author: authorId };
    if (req.user?._id) {
      followData.follower = req.user._id;
    } else {
      followData.deviceId = deviceId;
      if (email) followData.email = email;
    }
    
    const follow = await Follow.create(followData);
    
    // Update author's followers count
    await User.findByIdAndUpdate(authorId, { $inc: { totalFollowers: 1 } });
    
    res.status(201).json({
      success: true,
      message: "Followed successfully",
      data: follow
    });
    
  } catch (error) {
    console.error("Follow error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Already following" });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   DELETE /api/follows
// @desc    Unfollow an author
// @access  Public
router.delete("/", async (req, res) => {
  try {
    const { authorId, deviceId } = req.body;
    
    if (!authorId) {
      return res.status(400).json({ success: false, message: "Author ID required" });
    }
    
    const query = req.user?._id 
      ? { author: authorId, follower: req.user._id }
      : { author: authorId, deviceId };
    
    const follow = await Follow.findOneAndDelete(query);
    
    if (!follow) {
      return res.status(404).json({ success: false, message: "Not following" });
    }
    
    // Update author's followers count
    await User.findByIdAndUpdate(authorId, { $inc: { totalFollowers: -1 } });
    
    res.json({ success: true, message: "Unfollowed successfully" });
    
  } catch (error) {
    console.error("Unfollow error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   GET /api/follows/check/:authorId
// @desc    Check if current user/device is following an author
// @access  Public
router.get("/check/:authorId", async (req, res) => {
  try {
    const { authorId } = req.params;
    const { deviceId } = req.query;
    
    let query = { author: authorId };
    
    if (req.user?._id) {
      query.follower = req.user._id;
    } else if (deviceId) {
      query.deviceId = deviceId;
    } else {
      return res.json({ success: true, isFollowing: false });
    }
    
    const follow = await Follow.findOne(query);
    
    res.json({ success: true, isFollowing: !!follow });
    
  } catch (error) {
    console.error("Check follow error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   GET /api/follows/count/:authorId
// @desc    Get follower count for an author
// @access  Public
router.get("/count/:authorId", async (req, res) => {
  try {
    const count = await Follow.countDocuments({ author: req.params.authorId });
    res.json({ success: true, count });
  } catch (error) {
    console.error("Count error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;