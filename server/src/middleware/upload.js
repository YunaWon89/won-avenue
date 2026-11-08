const multer = require('multer');
const env = require('../config/env');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const imagesOnly = (req, file, cb) => {
  if (ALLOWED.includes(file.mimetype)) cb(null, true);
  else cb(ApiError.badRequest('Only JPEG, PNG or WEBP images are allowed', { code: 'INVALID_FILE_TYPE' }));
};

// Files are kept in memory, then saved to the `images` table (persistent across redeploys).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSize, files: 1 },
  fileFilter: imagesOnly,
});

/** Check magic bytes so a renamed non-image file cannot pass as an image. */
function looksLikeImage(buf) {
  if (buf.length < 12) return false;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
  return jpeg || png || webp;
}

/** Review photos: up to 3 images in the "photos" field. */
const MAX_REVIEW_PHOTOS = 3;
const reviewPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSize, files: MAX_REVIEW_PHOTOS },
  fileFilter: imagesOnly,
}).array('photos', MAX_REVIEW_PHOTOS);

/** Persist a file and return its public URL. Pass a transaction client to save together with other rows. */
async function saveImage(file, userId, client = db) {
  if (!file) return undefined;
  if (!looksLikeImage(file.buffer)) {
    throw ApiError.badRequest('File content is not a valid image', { code: 'INVALID_FILE_TYPE' });
  }
  const { rows } = await client.query(
    'INSERT INTO images (mime_type, size_bytes, data, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING id',
    [file.mimetype, file.size, file.buffer, userId ?? null],
  );
  return `/api/images/${rows[0].id}`;
}

module.exports = { upload, reviewPhotos, saveImage, looksLikeImage, MAX_REVIEW_PHOTOS };
