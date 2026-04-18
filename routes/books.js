const router = require("express").Router();
const Book = require("../models/Book");

// Get all books with pagination and filters
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const category = req.query.category;
        const search = req.query.search;
        const featured = req.query.featured === 'true';
        
        let query = {};
        
        if (category) query.category = category;
        if (featured) query.featured = true;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { titleUrdu: { $regex: search, $options: 'i' } },
                { author: { $regex: search, $options: 'i' } },
                { authorUrdu: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        const books = await Book.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Book.countDocuments(query);
        
        res.json({
            success: true,
            data: books,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get featured books
router.get("/featured", async (req, res) => {
    try {
        const books = await Book.find({ featured: true })
            .sort({ downloads: -1 })
            .limit(6);
        res.json({ success: true, data: books });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get book by ID
router.get("/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ success: false, message: "Book not found" });
        }
        // Increment views
        book.views += 1;
        await book.save();
        res.json({ success: true, data: book });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get books by category
router.get("/category/:category", async (req, res) => {
    try {
        const books = await Book.find({ category: req.params.category })
            .sort({ createdAt: -1 });
        res.json({ success: true, data: books });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Track download
router.post("/:id/download", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ success: false, message: "Book not found" });
        }
        book.downloads += 1;
        await book.save();
        res.json({ success: true, downloads: book.downloads });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get book categories
router.get("/meta/categories", async (req, res) => {
    try {
        const categories = await Book.distinct("category");
        res.json({ success: true, data: categories.filter(c => c) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;