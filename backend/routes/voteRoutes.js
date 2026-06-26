const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Ledger = require('../models/Ledger');
const VoteReceipt = require('../models/VoteReceipt');
const merkleService = require('../services/merkleService');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const upload = multer({ storage: multer.memoryStorage() });

// Initialize merkle tree from DB on startup
Ledger.find({}).sort({ block_index: 1 }).then(records => {
    merkleService.initializeTree(records);
    console.log(`Merkle tree initialized with ${records.length} leaves.`);
}).catch(err => {
    console.error("Failed to initialize Merkle tree:", err);
});

// POST /scan-iris
// Forwards the uploaded image to the Python Iris Engine
router.post('/scan-iris', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const formData = new FormData();
        formData.append('image', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        const pythonServiceUrl = process.env.IRIS_ENGINE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/engine` : 'http://localhost:8000');

        const response = await axios.post(`${pythonServiceUrl}/verify`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        res.status(200).json(response.data);

    } catch (error) {
        console.error('Error scanning iris:', error.response?.data || error.message);
        const status = error.response?.status || 500;
        const detail = error.response?.data?.detail || 'Verification failed in Iris Engine';
        res.status(status).json({ error: detail });
    }
});

// POST /submit
// Handles the submission of a vote after Iris validation
router.post('/submit', async (req, res) => {
    try {
        const { irisId, ballotData } = req.body;

        if (!irisId || !ballotData) {
            return res.status(400).json({ error: 'irisId and ballotData are required' });
        }

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
            ballot_data: ballotData // in a real system, this would be encrypted
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
        console.error('Error submitting vote:', error);
        res.status(500).json({ error: 'Failed to submit vote' });
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
