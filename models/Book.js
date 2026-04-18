const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    titleUrdu: { type: String },
    author: { type: String, required: true },
    authorUrdu: { type: String },
    description: { type: String, required: true },
    descriptionUrdu: { type: String },
    coverImage: { type: String, required: true },
    pdfUrl: { type: String },
    epubUrl: { type: String },
    category: { type: String },
    categoryUrdu: { type: String },
    language: { type: String, default: "Urdu" },
    pages: { type: Number },
    publishedYear: { type: Number },
    publisher: { type: String },
    isbn: { type: String },
    featured: { type: Boolean, default: false },
    downloads: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    tags: [String],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Book", BookSchema);