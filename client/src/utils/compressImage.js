/**
 * Shrinks a photo in the browser before upload: longest side ≤ 1600 px, JPEG/WEBP quality 0.85.
 * Phone photos (often 3–8 MB) become ~200–600 KB, so uploads are fast and stay under the
 * server limit (2 MB per image) and the hosting request limit (~4.5 MB on Vercel).
 * Never throws: if the browser cannot decode the file, or the result is not smaller, the original is returned
 * (the server still validates type and size).
 */
const MAX_SIDE = 1600;
const QUALITY = 0.85;
const SMALL_ENOUGH = 400 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

const toBlob = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));

export async function compressImage(file) {
  if (!file?.type?.startsWith('image/')) return file;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size <= SMALL_ENOUGH) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNG -> white background instead of black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // WEBP keeps quality at a smaller size; browsers that can't encode it return PNG, then use JPEG.
    let blob = await toBlob(canvas, 'image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg');
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.${ext}`;
    return new File([blob], name, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Compresses several files (keeps their order). */
export const compressImages = (files) => Promise.all([...files].map(compressImage));
