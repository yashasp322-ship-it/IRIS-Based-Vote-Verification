/**
 * db.js — Mongoose connection helper for Vercel serverless.
 *
 * Uses a global cached connection so warm containers reuse the existing
 * connection instead of opening a new one every invocation.
 */

const mongoose = require('mongoose');

// Use a global variable so the connection survives between hot-reload invocations
let cached = global._mongoConn;
if (!cached) {
  cached = global._mongoConn = { conn: null, promise: null };
}

async function connectDB() {
  // Already connected — return immediately
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error(
      'MONGODB_URI environment variable is not set. ' +
      'Add it in Vercel → Project → Settings → Environment Variables.'
    );
  }

  // Start a new connection attempt if none is in progress
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 30000,
    }).then(m => {
      console.log('[DB] Connected to MongoDB');
      return m;
    }).catch(err => {
      // Reset so the next request retries from scratch
      cached.promise = null;
      console.error('[DB] Connection failed:', err.message);
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
