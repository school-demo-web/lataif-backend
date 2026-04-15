const express = require("express");
const router = express.Router();
const multer = require("multer");
const { uploadToCloudinary } = require("../utils/cloudinary");
const { protect, authorize } = require("../middleware/auth");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// @route   POST /api/upload/image
// @desc    Upload image to Cloudinary
// @access  Private (Author/Admin)
router.post("/image", protect, authorize("author", "admin"), upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    
    const result = await uploadToCloudinary(dataURI, "images", "image");
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// @route   POST /api/upload/pdf
// @desc    Upload PDF to Cloudinary
// @access  Private (Author/Admin)
router.post("/pdf", protect, authorize("author", "admin"), upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    
    const result = await uploadToCloudinary(dataURI, "pdfs", "raw");
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("PDF upload error:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

module.exports = router;