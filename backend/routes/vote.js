const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /verify-iris
router.post('/verify-iris', async (req, res) => {
  try {
    const { voterId } = req.body;

    // Find user by voterId
    const user = await User.findOne({ voterId });
    if (!user) {
      return res.status(404).json({ error: 'Voter not found' });
    }

    // Check if user has already voted
    if (user.hasVoted) {
      return res.status(400).json({ error: 'Voter has already cast a vote' });
    }

    // Mock a successful iris match
    // TODO: Replace with actual iris verification logic
    user.hasVoted = true;
    await user.save();

    return res.status(200).json({ message: 'Vote successfully cast' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;