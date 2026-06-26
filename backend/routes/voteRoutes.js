const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Ledger = require('../models/Ledger');
const VoteReceipt = require('../models/VoteReceipt');
const merkleService = require('../services/merkleService');
const multer = require('multer');
const { processIrisImage, clearRegistered } = require('../services/irisEngine');

const upload = multer({ storage: multer.memoryStorage() });

// Initialize merkle tree from DB on startup
Ledger.find({}).sort({ block_index: 1 }).then(records => {
    merkleService.initializeTree(records);
    console.log(`Merkle tree initialized with ${records.length} leaves.`);
}).catch(err => {
    console.error("Failed to initialize Merkle tree:", err);
});

// POST /scan-iris
// Runs iris recognition locally using the JS engine (no Python/external service needed)
router.post('/scan-iris', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const result = await processIrisImage(req.file.buffer);

        if (!result.success) {
            return res.status(400).json({ error: result.error, iris_id: result.iris_id });
        }

        res.status(200).json({ irisId: result.iris_id, status: result.message });

    } catch (error) {
        console.error('Error scanning iris:', error.message);
        res.status(500).json({ error: 'Iris verification failed: ' + error.message });
    }
});

// POST /admin/reset
// Clears all registered iris hashes (admin only)
router.post('/admin/reset', (req, res) => {
    const { admin_id } = req.body;
    if (!admin_id || admin_id.toUpperCase() !== 'ADMIN123') {
        return res.status(403).json({ error: 'Invalid admin ID' });
    }
    clearRegistered();
    res.status(200).json({ success: true, message: 'Database reset successfully' });
});


// POST /submit
// Handles the submission of a vote after Iris validation
router.post('/submit', async (req, res) => {
    try {
        // Guard: fail fast if MongoDB is not connected
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected. Ensure MONGODB_URI is set in Vercel environment variables.' });
        }

        const { irisId, ballotData } = req.body;

        if (!irisId || !ballotData) {
            return res.status(400).json({ error: 'irisId and ballotData are required' });
        }

        // Normalize ballot data to a plain string for storage
        const normalizedBallot = typeof ballotData === 'string' ? ballotData : JSON.stringify(ballotData);

        // Generate blinded tracking hash using crypto
        const timestamp = Date.now();
        const trackingHash = crypto.createHash('sha256').update(`${irisId}-${timestamp}`).digest('hex');

        // Get current block index
        const blockIndex = merkleService.leaves.length;

        // Save to Ledger
        const ledgerEntry = new Ledger({
            tracking_hash: trackingHash,
            timestamp,
            block_index: blockIndex,
            ballot_data: normalizedBallot
        });
        await ledgerEntry.save();

        // Update Merkle Tree
        const newRoot = merkleService.addLeaf(trackingHash);

        // Create Receipt
        const receipt = new VoteReceipt({
            tracking_hash: trackingHash,
            timestamp,
            block_index: blockIndex,
            merkle_root: newRoot,
            signature: 'digital-signature-placeholder' // Would be signed by the server's private key
        });
        await receipt.save();

        res.status(201).json({
            message: 'Vote submitted successfully',
            receipt: {
                tracking_hash: receipt.tracking_hash,
                timestamp: receipt.timestamp,
                block_index: receipt.block_index,
                merkle_root: receipt.merkle_root
            }
        });

    } catch (error) {
        console.error('Error submitting vote:', error.message || error);
        res.status(500).json({ error: 'Failed to submit vote: ' + (error.message || 'Unknown error') });
    }
});

// GET /verify/:hash
// Fetches the Merkle proof for a given tracking hash
router.get('/verify/:hash', async (req, res) => {
    try {
        const trackingHash = req.params.hash;

        // Check if it exists in Ledger
        const ledgerEntry = await Ledger.findOne({ tracking_hash: trackingHash });
        if (!ledgerEntry) {
            return res.status(404).json({ error: 'Tracking hash not found in ledger' });
        }

        // Get proof from Merkle Service
        const proof = merkleService.getProof(trackingHash);
        const root = merkleService.getRoot();
        const leafIndex = merkleService.getLeafIndex(trackingHash);

        res.status(200).json({
            root: root,
            leaf_index: leafIndex,
            audit_path: proof
        });

    } catch (error) {
        console.error('Error verifying hash:', error);
        res.status(500).json({ error: 'Failed to verify tracking hash' });
    }
});

module.exports = router;
