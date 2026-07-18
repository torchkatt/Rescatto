/**
 * Image utilities — client-side image compression before upload.
 * Uses Canvas API (no external dependencies).
 */

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const QUALITY = 0.8; // 80% JPEG quality
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — don't compress if smaller

/**
 * Compress an image File to JPEG with max dimensions.
 * Returns a compressed Blob suitable for upload.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (file.size <= MAX_FILE_SIZE && file.type === 'image/jpeg') {
    return file; // Skip if already small JPEG
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if too large
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        QUALITY
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));

    const url = URL.createObjectURL(file);
    img.src = url;
  });
}

export async function getOptimizedImageUrl(file: File): Promise<string> {
  const compressed = await compressImage(file);
  return URL.createObjectURL(compressed);
}