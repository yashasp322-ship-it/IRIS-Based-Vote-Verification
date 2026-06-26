const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes (each route handler calls connectDB() before any DB operation)
const voteRoutes = require('./routes/voteRoutes');
app.use('/', voteRoutes);

// Export the app for Vercel. When run directly (node server.js), start the server locally.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
} else {
  module.exports = app;
}