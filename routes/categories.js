const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Article = require("../models/Article");
const { protect, authorize } = require("../middleware/auth");

// @route   GET /api/categories
// @desc    Get all categories with article count
// @access  Public
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 })
      .lean();
    
    // Get article count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const articleCount = await Article.countDocuments({ 
          category: category._id,
          status: "published"
        });
        return { ...category, articleCount };
      })
    );
    
    res.json({
      success: true,
      data: categoriesWithCount
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   GET /api/categories/all
// @desc    Get all categories including inactive (Admin only)
// @access  Private/Admin
router.get("/all", protect, authorize("admin"), async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const articleCount = await Article.countDocuments({ category: category._id });
        return { ...category, articleCount };
      })
    );
    
    res.json({
      success: true,
      data: categoriesWithCount
    });
  } catch (error) {
    console.error("Get all categories error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   GET /api/categories/:id
// @desc    Get single category by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: "Category not found" 
      });
    }
    
    const articleCount = await Article.countDocuments({ 
      category: category._id,
      status: "published"
    });
    
    res.json({
      success: true,
      data: { ...category.toObject(), articleCount }
    });
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   POST /api/categories
// @desc    Create a new category
// @access  Private/Admin
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, nameEn, description, color, icon } = req.body;
    
    // Check if category already exists
    const existingCategory = await Category.findOne({ 
      $or: [{ name }, { nameEn }] 
    });
    
    if (existingCategory) {
      return res.status(400).json({ 
        success: false, 
        message: "Category with this name already exists" 
      });
    }
    
    const category = await Category.create({
      name,
      nameEn,
      description,
      color: color || "#6366f1",
      icon: icon || "folder",
      isActive: true
    });
    
    res.status(201).json({
      success: true,
      data: category,
      message: "Category created successfully"
    });
  } catch (error) {
    console.error("Create category error:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Category with this name already exists" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   PUT /api/categories/:id
// @desc    Update a category
// @access  Private/Admin
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, nameEn, description, color, icon, isActive } = req.body;
    
    let category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: "Category not found" 
      });
    }
    
    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name, _id: { $ne: req.params.id } });
      if (existingCategory) {
        return res.status(400).json({ 
          success: false, 
          message: "Category with this name already exists" 
        });
      }
    }
    
    // Update fields
    if (name !== undefined) category.name = name;
    if (nameEn !== undefined) category.nameEn = nameEn;
    if (description !== undefined) category.description = description;
    if (color !== undefined) category.color = color;
    if (icon !== undefined) category.icon = icon;
    if (isActive !== undefined) category.isActive = isActive;
    
    await category.save();
    
    res.json({
      success: true,
      data: category,
      message: "Category updated successfully"
    });
  } catch (error) {
    console.error("Update category error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Category with this name already exists" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   DELETE /api/categories/:id
// @desc    Delete a category
// @access  Private/Admin
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: "Category not found" 
      });
    }
    
    // Check if category has articles
    const articleCount = await Article.countDocuments({ category: req.params.id });
    
    if (articleCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category with ${articleCount} articles. Reassign or delete articles first.` 
      });
    }
    
    await category.deleteOne();
    
    res.json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

// @route   GET /api/categories/:id/articles
// @desc    Get articles by category
// @access  Public
router.get("/:id/articles", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const articles = await Article.find({ 
      category: req.params.id,
      status: "published",
      isPublic: true
    })
      .populate("author", "name avatar")
      .populate("category", "name nameEn")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Article.countDocuments({ 
      category: req.params.id,
      status: "published",
      isPublic: true
    });
    
    res.json({
      success: true,
      data: articles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Get category articles error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
});

module.exports = router;