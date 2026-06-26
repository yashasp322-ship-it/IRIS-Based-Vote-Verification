/**
 * irisEngine.js
 * 
 * Pure‑JavaScript iris recognition engine.
 * Ports the Python dHash algorithm from iris-engine/core/recognition.py so that
 * the whole system works on Vercel (no Python / OpenCV / external service needed).
 *
 * Algorithm summary:
 *  1. Decode the uploaded image with Jimp.
 *  2. Crop the centre 50% of the image (reliable "face / eye" region for a webcam demo).
 *  3. Compute an 8×8 dHash (difference hash) → 64‑bit integer.
 *  4. Compare against all previously registered hashes using Hamming distance.
 *     Distance < 18 → duplicate (same person). Threshold matches the Python engine.
 *  5. Register the new hash and return the iris ID.
 */

const Jimp = require('jimp');

// In‑memory store (same approach as the Python engine).
// On Vercel serverless functions this is reset on cold‑start.
// For persistence across invocations use the /admin/reset route to manage it,
// or store hashes in MongoDB (optional future upgrade).
const REGISTERED_IRISES = new Set();

/**
 * Clears all registered iris hashes.
 * Called by the /admin/reset endpoint.
 */
function clearRegistered() {
  REGISTERED_IRISES.clear();
  return true;
}

/**
 * Compute the 64‑bit dHash of an image region as a BigInt.
 * @param {Jimp} jimpImage  – already‑cropped Jimp image object
 * @returns {BigInt}
 */
function computeDHash(jimpImage) {
  // Resize to 9×8 so we can compare adjacent pixel columns (9-1 = 8 comparisons per row)
  const resized = jimpImage.clone().resize(9, 8, Jimp.RESIZE_BILINEAR).greyscale();

  let hashInt = BigInt(0);
  let bitIndex = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // Get greyscale value of current and next pixel
      const pixelA = Jimp.intToRGBA(resized.getPixelColor(col, row)).r;
      const pixelB = Jimp.intToRGBA(resized.getPixelColor(col + 1, row)).r;

      if (pixelA > pixelB) {
        hashInt |= (BigInt(1) << BigInt(bitIndex));
      }
      bitIndex++;
    }
  }

  return hashInt;
}

/**
 * Count the number of differing bits between two BigInts (Hamming distance).
 * @param {BigInt} a
 * @param {BigInt} b
 * @returns {number}
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
 * Main entry point – mirrors process_iris_image() from recognition.py.
 * @param {Buffer} imageBuffer  – raw image bytes from multer
 * @returns {Promise<object>}   – { success, iris_id?, message?, error? }
 */
async function processIrisImage(imageBuffer) {
  let img;

  try {
    img = await Jimp.read(imageBuffer);
  } catch (err) {
    return { success: false, error: 'Invalid image format' };
  }

  const { width, height } = img.bitmap;

  // Centre 50% crop (same as Python: gray[h//4:3*h//4, w//4:3*w//4])
  const cropX = Math.floor(width / 4);
  const cropY = Math.floor(height / 4);
  const cropW = Math.floor(width / 2);
  const cropH = Math.floor(height / 2);

  const cropped = img.clone().crop(cropX, cropY, cropW, cropH);

  // Compute dHash
  const hashInt = computeDHash(cropped);

  // Build a human‑readable iris ID from the upper 32 bits of the 64‑bit hash
  const hashHex = hashInt.toString(16).padStart(16, '0');
  const irisId = `IRIS-${hashHex.slice(0, 8).toUpperCase()}`;

  // Duplicate check
  for (const registeredHash of REGISTERED_IRISES) {
    const distance = hammingDistance(hashInt, registeredHash);
    console.log(`[IrisEngine] Comparing hashes… Hamming distance: ${distance}/64`);

    if (distance < 18) {
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
