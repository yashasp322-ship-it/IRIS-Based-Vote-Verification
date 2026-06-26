const { MerkleTree } = require('merkletreejs');
const SHA256 = require('crypto-js/sha256');

class MerkleService {
    constructor() {
        this.leaves = [];
        this.tree = new MerkleTree([], SHA256, { sortPairs: true });
    }

    // Initialize tree from existing database records
    initializeTree(ledgerRecords) {
        this.leaves = ledgerRecords.map(record => record.tracking_hash);
        this.tree = new MerkleTree(this.leaves, SHA256, { sortPairs: true });
    }

    // Add a new leaf (tracking_hash) to the tree
    addLeaf(trackingHash) {
        this.leaves.push(trackingHash);
        this.tree = new MerkleTree(this.leaves, SHA256, { sortPairs: true });
        return this.tree.getRoot().toString('hex');
    }

    // Get proof for a specific tracking hash
    getProof(trackingHash) {
        const leaf = SHA256(trackingHash);
        const proof = this.tree.getProof(leaf);
        return proof.map(x => ({
            position: x.position,
            data: x.data.toString('hex')
        }));
    }

    // Get current root
    getRoot() {
        return this.tree.getRoot().toString('hex');
    }
    
    // Get leaf index
    getLeafIndex(trackingHash) {
        return this.leaves.indexOf(trackingHash);
    }
}

// Export as a singleton
module.exports = new MerkleService();
