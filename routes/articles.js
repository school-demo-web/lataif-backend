const express = require("express");
const router = express.Router();
const Article = require("../models/Article");
const User = require("../models/User");
const Category = require("../models/Category");
const { protect, authorize } = require("../middleware/auth");

// ============================================
// HELPER FUNCTION - Recalculate author stats
// ============================================
async function updateAuthorStats(authorId) {
  try {
    // Count published articles
    const totalArticles = await Article.countDocuments({ 
      author: authorId, 
      status: "published" 
    });
    
    // Sum all views from published articles
    const articles = await Article.find({ 
      author: authorId, 
      status: "published" 
    });
    const totalViews = articles.reduce((sum, article) => sum + (article.views || 0), 0);
    
    // Update user with accurate stats
    await User.findByIdAndUpdate(authorId, {
      totalArticles,
      totalViews
    });
    
    console.log(`📊 Updated author ${authorId}: ${totalArticles} articles, ${totalViews} views`);
    return { totalArticles, totalViews };
  } catch (error) {
    console.error("Update author stats error:", error);
    return null;
  }
}

// ============================================
// GET /api/articles - Get all articles (paginated)
// ============================================
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

// ============================================
// GET /api/articles/trending - Get trending articles
// ============================================
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

// ============================================
// GET /api/articles/:id - Get single article
// ============================================
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
    
    // Update author's total views (recalculate for accuracy)
    if (article.author) {
      await updateAuthorStats(article.author._id);
    }
    
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

// ============================================
// POST /api/articles - Create new article
// ============================================
router.post("/", protect, authorize("author", "admin"), async (req, res) => {
  try {
    const articleData = { 
      ...req.body, 
      author: req.user._id,
      publishedAt: req.body.status === 'published' ? new Date() : null
    };
    
    const article = await Article.create(articleData);
    
    // Update category article count
    if (article.category) {
      await Category.findByIdAndUpdate(article.category, { 
        $inc: { articleCount: 1 } 
      });
    }
    
    // ✅ RECALCULATE author stats (instead of just incrementing)
    await updateAuthorStats(req.user._id);
    
    // Push notifications for published articles
    if (article.status === 'published') {
      try {
        const Subscription = require('../models/Subscription');
        const webPush = require('web-push');
        
        if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
          webPush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@lataif.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
          );
          
          const subscriptions = await Subscription.find();
          if (subscriptions.length > 0) {
            const payload = JSON.stringify({
              title: '📝 نئی تحریر شائع ہوگئی!',
              body: article.title.substring(0, 100),
              icon: '/logo.png',
              data: { url: `/article_detail?id=${article._id}` }
            });
            
            for (const sub of subscriptions) {
              try {
                await webPush.sendNotification(sub, payload);
              } catch(e) {
                if (e.statusCode === 410) {
                  await Subscription.deleteOne({ _id: sub._id });
                }
              }
            }
          }
        }
      } catch (pushError) {
        console.error('Push notification error:', pushError.message);
      }
    }
    
    res.status(201).json({ success: true, data: article });
  } catch (error) {
    console.error("Create article error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ============================================
// PUT /api/articles/:id - Update article
// ============================================
router.put("/:id", protect, async (req, res) => {
  try {
    let article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: "Article not found" });
    
    // Check authorization
    if (article.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    const oldStatus = article.status;
    const oldCategory = article.category?.toString();
    
    // Update article
    const updateData = { ...req.body };
    
    // Set publishedAt if status changed to published
    if (oldStatus !== 'published' && req.body.status === 'published') {
      updateData.publishedAt = new Date();
    }
    
    article = await Article.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    // Handle category change
    if (oldCategory !== article.category?.toString()) {
      if (oldCategory) {
        await Category.findByIdAndUpdate(oldCategory, { $inc: { articleCount: -1 } });
      }
      if (article.category) {
        await Category.findByIdAndUpdate(article.category, { $inc: { articleCount: 1 } });
      }
    }
    
    // ✅ RECALCULATE author stats (especially important if status changed)
    await updateAuthorStats(article.author);
    
    res.json({ success: true, data: article });
  } catch (error) {
    console.error("Update article error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ============================================
// DELETE /api/articles/:id - Delete article
// ============================================
router.delete("/:id", protect, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: "Article not found" });
    
    // Check authorization
    if (article.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    const authorId = article.author;
    const categoryId = article.category;
    
    // Delete article
    await article.deleteOne();
    
    // Update category count
    if (categoryId) {
      await Category.findByIdAndUpdate(categoryId, { $inc: { articleCount: -1 } });
    }
    
    // ✅ RECALCULATE author stats (instead of just decrementing)
    await updateAuthorStats(authorId);
    
    res.json({ success: true, message: "Article deleted successfully" });
  } catch (error) {
    console.error("Delete article error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ============================================
// POST /api/articles/:id/like - Like/Unlike article
// ============================================
router.post("/:id/like", async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }
    
    const { deviceId } = req.body;
    
    let identifier = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = require("jsonwebtoken").verify(token, process.env.JWT_SECRET);
        identifier = decoded.id.toString();
      } catch (e) {}
    }
    
    if (!identifier) {
      if (!deviceId) {
        return res.status(400).json({ 
          success: false, 
          message: "Device ID required for guest likes" 
        });
      }
      identifier = deviceId;
    }
    
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

// ============================================
// POST /api/articles/fix-all-stats - Fix all author stats (Admin only)
// ============================================
router.post("/fix-all-stats", protect, authorize("admin"), async (req, res) => {
  try {
    const authors = await User.find({ role: { $in: ["author", "admin"] } });
    const results = [];
    
    for (const author of authors) {
      const stats = await updateAuthorStats(author._id);
      if (stats) {
        results.push({
          author: author.name,
          totalArticles: stats.totalArticles,
          totalViews: stats.totalViews
        });
      }
    }
    
    res.json({
      success: true,
      message: `Fixed stats for ${results.length} authors`,
      data: results
    });
  } catch (error) {
    console.error("Fix all stats error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;