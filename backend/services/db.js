/**
 * db.js
 * 
 * Mongoose connection helper for Vercel serverless functions.
 * 
 * On Vercel, each function invocation may be a cold start where
 * mongoose.connect() is called asynchronously. We use a cached
 * connection pattern so:
 *  - First request: opens the connection and awaits it fully.
 *  - Subsequent requests (warm container): reuses the existing connection.
 */

const mongoose = require('mongoose');

let cached = global._mongooseConnection;

if (!cached) {
  cached = global._mongooseConnection = { conn: null, promise: null };
}

async function connectDB() {
  // If we already have a live connection, return it immediately
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If a connection attempt is already in progress, wait for it
  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error(
        'MONGODB_URI is not set. Add it to your Vercel environment variables.'
      );
    }

    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,  // Don't buffer — fail fast if not connected
        serverSelectionTimeoutMS: 10000, // 10s timeout
      })
      .then((m) => m)
      .catch((err) => {
        // Reset so the next request retries
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
