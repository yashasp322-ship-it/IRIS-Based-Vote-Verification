# IrisSecure: Secure Biometric Voting & Public Verification Platform
Live Demo: https://iris-based-vote-verification.vercel.app

**IrisSecure** is an advanced, high-security voting prototype designed to ensure election integrity by combining cutting-edge biometric deduplication with a cryptographically secure backend ledger. 

This system guarantees that voters can cast their ballot securely, verify it independently on a public ledger, and most importantly, physically cannot cast a duplicate vote.

## 🌟 Core Features

1. **Live Biometric Computer Vision Engine (`iris-engine`)**
   - Uses a live camera feed to capture the voter's face/eye.
   - Built with Python, OpenCV, and FastAPI.
   - Implements an **8x8 dHash (Difference Hash)** algorithm to extract a unique biometric signature from the camera feed.
   - Instantly compares incoming scans against the active memory registry using **Hamming Distance** thresholds to aggressively detect and block duplicate voting attempts, even under varying webcam lighting conditions.

2. **Cryptographic Merkle Tree Ledger (`backend`)**
   - A robust Node.js and Express backend connected to a MongoDB database.
   - Stores each cast vote securely inside a **Merkle Tree**.
   - Upon voting, the voter receives a unique cryptographic Tracking Hash and a digital receipt.
   - Votes are immutable and their integrity can be mathematically verified.

3. **Voting Portal & Security Lock-Out (`frontend`)**
   - Built with React, Vite, and Tailwind CSS using a sleek, neo-brutalist aesthetic.
   - Integrates `navigator.mediaDevices` for live browser-based webcam access.
   - **Fraud Lock-Down:** If a duplicate biometric signature is detected, the terminal immediately destroys the camera feed, flashes a system alert, and fully locks the UI. Only a Booth Admin with the correct override code (`ADMIN123`) can unlock the terminal for the next voter.

4. **Public Verification Tracker**
   - A dedicated portal where voters can enter their Tracking Hash to verify that their vote was recorded properly.
   - The system calculates the Merkle Audit Path and verifies the leaf against the Merkle Root to cryptographically prove the vote is in the database without revealing *who* they voted for.
   - Users can download their verification proof as a JSON receipt.

---

## 🏗 System Architecture

The project consists of three distinct microservices running in parallel:

```text
iris-vote-system/
│
├── frontend/          # React.js SPA (User Interface & Camera capture)
├── backend/           # Node.js API (MongoDB connection & Merkle Tree logic)
└── iris-engine/       # Python FastAPI (OpenCV Biometric Hashing)
```

---

## 🚀 How to Run the Project Locally

To run the full end-to-end system, you will need three terminal windows open to start each microservice.

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- Local MongoDB instance running (`brew services start mongodb-community`)

### Step 1: Start the Biometric Iris Engine (Python)
```bash
cd iris-engine
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
*The engine will listen on port 8000 for image processing requests.*

### Step 2: Start the Secure Ledger Backend (Node.js)
```bash
cd backend
npm install
npm start
```
*The backend will connect to MongoDB, initialize the Merkle Tree, and listen on port 5000.*

### Step 3: Start the Voting Portal (React)
```bash
cd frontend
npm install
npm run dev
```
*Navigate to `http://localhost:5173` in your browser.*

---

## 🔐 Testing the Security Protocols

1. **Cast a Valid Vote**: Allow camera access, capture your face, and cast a vote. Observe the "Vote Cast!" success screen and copy your Tracking Hash.
2. **Verify the Vote**: Go to the Public Tracker, paste your hash, and see the cryptographic proof that your vote is in the Merkle Tree.
3. **Attempt Voter Fraud**: Return to the Voting Portal and try to capture your face again. The Python engine will catch the duplicate structural hash and trigger the **Admin Alert** lockdown sequence.
4. **Admin Override**: Click "Admin Override" and enter the passcode (`ADMIN123`) to unlock the terminal for the next user.

---

## 🔮 Future Scope
- **Homomorphic Encryption**: Allow the total tally of votes to be calculated without decrypting individual ballot data.
- **Coercion Resistance (Decoy Tokens)**: Allow coerced voters to generate "Decoy" receipts that look valid but are silently excluded from the final tally by the backend.
- **Docker Containerization**: Wrap the 3 microservices into a single `docker-compose.yml` file for 1-click deployments.
