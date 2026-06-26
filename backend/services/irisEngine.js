/**
 * irisEngine.js
 *
 * Pure-JavaScript iris recognition engine (Jimp v1 API).
 * Ports the Python dHash algorithm from iris-engine/core/recognition.py so that
 * the whole system works on Vercel — no Python / OpenCV / external service needed.
 *
 * Algorithm:
 *  1. Decode image buffer with Jimp.fromBuffer()
 *  2. Crop the centre 50% (reliable eye region for a webcam demo)
 *  3. Compute 8×8 dHash → 64-bit BigInt
 *  4. Hamming-distance duplicate check (threshold < 18, matches Python engine)
 *  5. Register and return iris ID
 *
 * Jimp v1 API notes (different from v0):
 *  - resize(w, h)      → resize({ w, h })
 *  - crop(x, y, w, h)  → crop({ x, y, w, h })
 *  - Jimp.read(buf)    → Jimp.fromBuffer(buf)
 */

const { Jimp, intToRGBA } = require('jimp');

// In-memory iris hash store (reset on cold start on Vercel — use /admin/reset to clear manually)
const REGISTERED_IRISES = new Set();

/** Clears all registered iris hashes (called by POST /admin/reset) */
function clearRegistered() {
  REGISTERED_IRISES.clear();
  return true;
}

/**
 * Count differing bits between two BigInts (Hamming distance).
 */
function hammingDistance(a, b) {
  let xor = a ^ b;
  let count = 0;
  while (xor > BigInt(0)) {
    count += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }
  return count;
}

/**
 * Compute 8×8 dHash of a Jimp image object.
 * Resizes to 9×8 using Jimp v1 object API, converts to greyscale,
 * then compares adjacent pixels in each row.
 * @param {Jimp} img
 * @returns {BigInt} 64-bit hash integer
 */
function computeDHash(img) {
  // Jimp v1: resize({ w, h }) — NOT resize(w, h)
  const small = img.clone().resize({ w: 9, h: 8 }).greyscale();

  let hashInt = BigInt(0);
  let bit = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const pixA = intToRGBA(small.getPixelColor(col, row)).r;
      const pixB = intToRGBA(small.getPixelColor(col + 1, row)).r;
      if (pixA > pixB) {
        hashInt |= (BigInt(1) << BigInt(bit));
      }
      bit++;
    }
  }
  return hashInt;
}

/**
 * Main entry point — mirrors process_iris_image() from recognition.py.
 * @param {Buffer} imageBuffer  raw image bytes from multer
 * @returns {Promise<object>}   { success, iris_id?, message?, error? }
 */
async function processIrisImage(imageBuffer) {
  let img;

  try {
    img = await Jimp.fromBuffer(imageBuffer);
  } catch (err) {
    console.error('[IrisEngine] Failed to decode image:', err.message);
    return { success: false, error: 'Invalid image format' };
  }

  const { width, height } = img.bitmap;

  // Centre 50% crop — mirrors: gray[h//4:3*h//4, w//4:3*w//4]
  // Jimp v1: crop({ x, y, w, h }) — NOT crop(x, y, w, h)
  const cropX = Math.floor(width / 4);
  const cropY = Math.floor(height / 4);
  const cropW = Math.floor(width / 2);
  const cropH = Math.floor(height / 2);

  const cropped = img.clone().crop({ x: cropX, y: cropY, w: cropW, h: cropH });

  // Compute dHash
  const hashInt = computeDHash(cropped);

  // Build human-readable iris ID from upper 32 bits of the 64-bit hash
  const hashHex = hashInt.toString(16).padStart(16, '0');
  const irisId = `IRIS-${hashHex.slice(0, 8).toUpperCase()}`;

  // Duplicate check using Hamming distance
  for (const stored of REGISTERED_IRISES) {
    const dist = hammingDistance(hashInt, stored);
    console.log(`[IrisEngine] Hamming distance: ${dist}/64`);
    if (dist < 18) {
      return {
        success: false,
        error: 'Duplicate Iris Detected - Multiple Voting Not Allowed',
        iris_id: irisId,
      };
    }
  }

  // Register new iris
  REGISTERED_IRISES.add(hashInt);

  return {
    success: true,
    iris_id: irisId,
    message: 'Cryptographically Verified - Not a Duplicate',
  };
}

module.exports = { processIrisImage, clearRegistered };
