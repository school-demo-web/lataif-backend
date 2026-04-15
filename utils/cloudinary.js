const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (file, folder, resourceType = "auto") => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: `editorial-flow/${folder}`,
      resource_type: resourceType,
      allowed_formats: ["jpg", "png", "webp", "gif", "pdf"],
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Upload failed");
  }
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new Error("Delete failed");
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };