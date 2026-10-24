import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';

// Determine if Cloudinary is configured via environment variables
export const isCloudinaryConfigured = Boolean(
  (process.env.CLOUDINARY_CLOUD_NAME?.trim() && process.env.CLOUDINARY_API_KEY?.trim() && process.env.CLOUDINARY_API_SECRET?.trim()) ||
  process.env.CLOUDINARY_URL?.trim()
);

if (isCloudinaryConfigured) {
  if (process.env.CLOUDINARY_URL?.trim()) {
    // Cloudinary SDK automatically picks up CLOUDINARY_URL, or explicit setting
    process.env.CLOUDINARY_URL = process.env.CLOUDINARY_URL.trim();
    cloudinary.config();
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
      secure: true,
    });
  }
  console.log('[Storage] Cloudinary initialized for persistent cloud storage.');
} else {
  console.warn('[Storage] Cloudinary credentials not configured; falling back to local storage.');
}

export { cloudinary };

/**
 * Upload an in-memory buffer to Cloudinary
 * @param {Buffer} buffer
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'citicare/complaints',
        resource_type: 'image',
        use_filename: false,
        unique_filename: true,
        ...options,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary Upload Error]', error);
          return reject(error);
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          storage_provider: 'cloudinary',
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete a single asset from Cloudinary
 * @param {string} publicId
 */
export async function deleteCloudinaryAsset(publicId) {
  if (!publicId || !isCloudinaryConfigured) return null;
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn(`[Cloudinary] Failed to delete asset ${publicId}:`, err.message);
    return null;
  }
}

/**
 * Delete multiple assets from Cloudinary
 * @param {string[]} publicIds
 */
export async function deleteMultipleCloudinaryAssets(publicIds) {
  const ids = (publicIds || []).filter(Boolean);
  if (!ids.length || !isCloudinaryConfigured) return null;
  try {
    if (cloudinary.api?.delete_resources) {
      return await cloudinary.api.delete_resources(ids);
    }
    return await Promise.all(ids.map((id) => deleteCloudinaryAsset(id)));
  } catch (err) {
    console.warn('[Cloudinary] Failed to delete multiple assets:', err.message);
    return null;
  }
}

/**
 * Unified image upload handler:
 * - If Cloudinary is configured (production on Render), uploads directly to Cloudinary.
 * - If Cloudinary is not configured (offline / local dev), safely writes buffer to local disk.
 *
 * @param {Object} file - Multer file object (has .buffer or .path)
 * @param {Object} options - { folder, tags, publicBaseUrl }
 * @returns {Promise<Object>}
 */
export async function uploadImageFile(file, options = {}) {
  if (!file) throw new Error('No file provided for upload');

  const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
  if (!buffer) {
    throw new Error('Could not read file buffer for upload');
  }

  // 1. Cloudinary upload (Production on Render)
  if (isCloudinaryConfigured) {
    return await uploadBufferToCloudinary(buffer, {
      folder: options.folder || 'citicare/complaints',
      tags: options.tags || ['citicare'],
    });
  }

  // 2. Local fallback storage (Local development without Cloudinary credentials)
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
  const filename = `${randomBytes(12).toString('hex')}-${Date.now()}${safeExt}`;
  const filePath = path.join(uploadDir, filename);

  fs.writeFileSync(filePath, buffer);

  const baseUrl = (options.publicBaseUrl || process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  return {
    secure_url: `${baseUrl}/uploads/${filename}`,
    public_id: null,
    storage_provider: 'local',
    width: null,
    height: null,
    format: safeExt.replace('.', ''),
    bytes: buffer.length,
  };
}
