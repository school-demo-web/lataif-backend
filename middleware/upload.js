const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|webp|gif/;
  const allowedDocTypes = /pdf|doc|docx/;
  
  const extname = path.extname(file.originalname).toLowerCase();
  
  if (file.fieldname === "image") {
    if (allowedImageTypes.test(extname)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  } else if (file.fieldname === "pdf") {
    if (allowedDocTypes.test(extname)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
});

// Upload to Cloudinary
const uploadToCloudinary = async (file, folder) => {
  try {
    const b64 = Buffer.from(file.buffer).toString("base64");
    const dataURI = `data:${file.mimetype};base64,${b64}`;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: `editorial-flow/${folder}`,
      resource_type: "auto",
      allowed_formats: ["jpg", "png", "webp", "pdf"],
      transformation: folder === "images" ? [
        { quality: "auto" },
        { fetch_format: "auto" }
      ] : []
    });
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload file");
  }
};

// Delete from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new Error("Failed to delete file");
  }
};

module.exports = { upload, uploadToCloudinary, deleteFromCloudinary };
