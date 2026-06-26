import React, { useState, useRef, useEffect } from 'react';
import { ScanFace, CheckCircle2, ShieldCheck, Search, Download, ChevronRight, Activity, Camera } from 'lucide-react';
import SHA256 from 'crypto-js/sha256';

const API_BASE = window.location.origin + "/api";

export default function App() {
  // Initialize state from localStorage to prevent refresh bypass
  const [appState, setAppState] = useState(() => {
    return localStorage.getItem('iris_terminal_locked') === 'true' ? 'admin_alert' : 'scan';
  });

  const [isScanning, setIsScanning] = useState(false);
  const [irisData, setIrisData] = useState(null);
  const [scanError, setScanError] = useState('');

  const [trackingHash, setTrackingHash] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const [adminId, setAdminId] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleAdminReset = async () => {
    const enteredId = window.prompt('🔐 Enter Admin ID to reset the database:');
    if (!enteredId) return;
    if (enteredId.toUpperCase() !== 'ADMIN123') {
      alert('❌ Invalid Admin ID. Access denied.');
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: enteredId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      // Clear the localStorage lock and reset app state
      localStorage.removeItem('iris_terminal_locked');
      setAppState('scan');
      setIrisData(null);
      setScanError('');
      setTrackingHash('');
      setVerificationResult(null);
      setVerifyError('');
      alert('✅ Database reset! You can now test from fresh.');
    } catch (err) {
      alert('❌ Reset failed: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };


  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);

  // Initialize camera when in scan state
  useEffect(() => {
    if (appState === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [appState]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
      }
    } catch (err) {
      setScanError("Camera access denied or unavailable.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setStreamActive(false);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Draw current video frame to canvas
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob and send
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "iris_scan.jpg", { type: "image/jpeg" });
        sendIrisToBackend(file);
      }
    }, 'image/jpeg');
  };

  const sendIrisToBackend = async (file) => {
    setIsScanning(true);
    setScanError('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_BASE}/scan-iris`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan iris');
      }

      setIrisData({
        id: data.irisId,
        timestamp: new Date().toLocaleString(),
        status: data.status
      });
      setAppState('validation');
    } catch (err) {
      if (err.message.toLowerCase().includes('duplicate') || err.message.toLowerCase().includes('multiple')) {
        localStorage.setItem('iris_terminal_locked', 'true');
        alert('🚨 WARNING: MULTIPLE VOTER DETECTED! 🚨\n\nSecurity protocol initiated. Notifying Booth Admin and locking terminal.');
        setAppState('admin_alert');
      } else {
        setScanError(err.message);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleVoteSubmit = async (candidate) => {
    try {
      const response = await fetch(`${API_BASE}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          irisId: irisData.id,
          ballotData: candidate
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit vote');
      }

      alert(`Vote Submitted! Your tracking hash is: ${data.receipt.tracking_hash}\n\nPlease save this hash to track your vote.`);
      setTrackingHash(data.receipt.tracking_hash);
      setAppState('done');
    } catch (error) {
      alert(error.message);
    }
  };

  const resetApp = () => {
    setAppState('scan');
    setIrisData(null);
    setTrackingHash('');
    setVerificationResult(null);
    setScanError('');
    setVerifyError('');
  };

  const verifyHash = async () => {
    setIsVerifying(true);
    setVerifyError('');
    setVerificationResult(null);

    try {
      const response = await fetch(`${API_BASE}/verify/${trackingHash}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setVerificationResult(data);
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const downloadReceipt = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(verificationResult, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "iris-vote-receipt.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div
      className="min-h-screen bg-white text-black font-sans selection:bg-[#D4FF2A] selection:text-black relative"
      style={{
        backgroundImage: 'url(/bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-0 pointer-events-none" />

      {/* Header */}
      <header className="border-b-4 border-black bg-white/90 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 font-black text-2xl tracking-tight uppercase">
            <ScanFace className="w-8 h-8" />
            IrisSecure
          </div>
          <nav className="flex gap-6 text-sm font-bold uppercase">
            <button
              onClick={() => setAppState('scan')}
              disabled={appState === 'admin_alert'}
              className={`transition-all hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${appState === 'scan' || appState === 'validation' ? 'border-b-4 border-[#D4FF2A]' : ''}`}
            >
              Voting Portal
            </button>
            <button
              onClick={() => setAppState('tracker')}
              disabled={appState === 'admin_alert'}
              className={`transition-all hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${appState === 'tracker' ? 'border-b-4 border-[#D4FF2A]' : ''}`}
            >
              Public Tracker
            </button>
            <button
              onClick={handleAdminReset}
              disabled={isResetting}
              title="Admin only — resets iris DB and unlocks terminal"
              style={{ background: '#dc2626', color: '#fff', border: '2px solid #000', boxShadow: '3px 3px 0 #000', padding: '4px 12px', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.05em' }}
              className="transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResetting ? '⏳ Resetting…' : '🔄 Reset DB'}
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        {appState === 'scan' && (
          <div className="max-w-md mx-auto space-y-8">
            <div className="text-center space-y-2 p-6 bg-white border-4 border-black shadow-[8px_8px_0_0_#000]">
              <h1 className="text-3xl font-black uppercase">Biometric Auth</h1>
              <p className="font-medium text-black">Position your eye in the camera and capture.</p>
            </div>

            {scanError && (
              <div className="p-4 bg-red-100 border-4 border-red-500 text-red-700 font-bold uppercase shadow-[4px_4px_0_0_#ef4444]">
                {scanError}
              </div>
            )}

            <div className="bg-white border-4 border-black flex flex-col items-center justify-center p-4 shadow-[8px_8px_0_0_#000] relative">
              <div className={`relative w-full aspect-square border-4 ${isScanning ? 'border-[#D4FF2A] animate-pulse' : 'border-black'} bg-black overflow-hidden flex items-center justify-center`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-150 transform transition-transform duration-1000 ${streamActive ? 'opacity-100' : 'opacity-0'}`}
                />
                {!streamActive && <ScanFace className="w-24 h-24 text-white/20 absolute z-10" />}
                {isScanning && <div className="absolute inset-0 bg-[#D4FF2A]/30 mix-blend-multiply z-10" />}
                <canvas ref={canvasRef} className="hidden" />

                {/* Aiming crosshair UI overlay */}
                <div className="absolute inset-0 pointer-events-none border-[12px] border-black/20 m-8 rounded-full z-20" />
                <div className="absolute inset-1/2 w-4 h-4 -ml-2 -mt-2 bg-[#D4FF2A]/80 rounded-full z-20" />
              </div>

              <div className="mt-8 w-full">
                <button
                  onClick={handleCapture}
                  disabled={isScanning || !streamActive}
                  className="w-full py-4 border-4 border-black bg-[#D4FF2A] hover:bg-white text-black font-black uppercase tracking-wider shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <><Activity className="w-6 h-6 animate-spin" /> Processing...</>
                  ) : (
                    <><Camera className="w-6 h-6" /> Capture Iris</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {appState === 'admin_alert' && (
          <div className="max-w-xl mx-auto space-y-8 animate-in zoom-in duration-300">
            <div className="text-center space-y-2 bg-red-600 text-white p-8 border-8 border-black shadow-[12px_12px_0_0_#000]">
              <h1 className="text-5xl font-black uppercase flex items-center justify-center gap-4 animate-pulse">
                <ShieldCheck className="w-12 h-12" />
                SECURITY ALERT
              </h1>
            </div>

            <div className="bg-black text-[#D4FF2A] border-8 border-red-600 p-8 space-y-8 shadow-[12px_12px_0_0_#ef4444]">
              <div className="text-center space-y-6">
                <p className="font-black uppercase text-3xl">Multiple Voter Detected!</p>
                <div className="p-4 bg-red-600/20 border-4 border-red-600">
                  <p className="font-mono font-bold text-lg text-white">
                    ERROR CODE: DUPLICATE_BIOMETRIC_SIGNATURE
                  </p>
                </div>
                <p className="font-bold text-white/80 uppercase text-lg leading-relaxed">
                  The captured Iris signature already exists in the immutable ledger.
                  <br /><br />
                  Further attempts have been blocked. The Election Commission booth administrator has been notified.
                </p>
              </div>

              <div className="flex flex-col gap-4 mt-8 pt-8 border-t-4 border-red-600/50">
                <button
                  onClick={() => {
                    const id = prompt('ENTER ADMIN ID TO UNLOCK TERMINAL:');
                    if (id && id.toUpperCase() === 'ADMIN123') {
                      localStorage.removeItem('iris_terminal_locked');
                      resetApp();
                    } else if (id !== null) {
                      alert('ERROR: Invalid Admin ID. Access Denied.');
                    }
                  }}
                  className="w-full py-6 border-4 border-black bg-white text-black hover:bg-red-600 hover:text-white font-black text-xl uppercase tracking-wider transition-all"
                >
                  Admin Override (Unlock)
                </button>
              </div>
            </div>
          </div>
        )}

        {appState === 'validation' && irisData && (
          <div className="max-w-md mx-auto space-y-8">
            <div className="text-center space-y-2 bg-[#D4FF2A] p-6 border-4 border-black shadow-[8px_8px_0_0_#000]">
              <h1 className="text-3xl font-black uppercase flex items-center justify-center gap-3">
                <CheckCircle2 className="w-8 h-8" />
                Verified
              </h1>
            </div>

            <div className="bg-white border-4 border-black p-6 space-y-6 shadow-[8px_8px_0_0_#000]">
              <div className="space-y-4 font-mono font-bold text-sm uppercase">
                <div className="flex justify-between items-center py-3 border-b-4 border-black">
                  <span>Iris ID</span>
                  <span>{irisData.id}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b-4 border-black">
                  <span>Timestamp</span>
                  <span>{irisData.timestamp}</span>
                </div>
                <div className="flex justify-between items-start py-3">
                  <span>Status</span>
                  <span className="flex items-center gap-2 text-right">
                    <ShieldCheck className="w-5 h-5" />
                    Valid
                  </span>
                </div>
              </div>

              <button
                onClick={() => setAppState('vote')}
                className="w-full py-4 border-4 border-black bg-black text-[#D4FF2A] hover:bg-white hover:text-black font-black uppercase tracking-wider shadow-[4px_4px_0_0_#D4FF2A] hover:shadow-[4px_4px_0_0_#000] hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                Proceed to Vote
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {appState === 'vote' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-4xl font-black uppercase text-center bg-white p-4 border-4 border-black shadow-[8px_8px_0_0_#000] inline-block mb-4 relative left-1/2 -translate-x-1/2">
              Cast Your Ballot
            </h1>
            <div className="grid gap-6">
              {['Candidate A', 'Candidate B', 'Candidate C'].map((candidate) => (
                <button
                  key={candidate}
                  onClick={() => handleVoteSubmit(candidate)}
                  className="p-6 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all text-left flex items-center justify-between group"
                >
                  <span className="text-2xl font-black uppercase">{candidate}</span>
                  <div className="w-8 h-8 border-4 border-black flex items-center justify-center">
                    <div className="w-4 h-4 bg-[#D4FF2A] opacity-0 group-hover:opacity-100 transition-opacity border-2 border-black" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {appState === 'done' && (
          <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-2 bg-black text-[#D4FF2A] p-6 border-4 border-black shadow-[8px_8px_0_0_#D4FF2A]">
              <h1 className="text-3xl font-black uppercase flex items-center justify-center gap-3">
                <CheckCircle2 className="w-8 h-8" />
                Vote Cast!
              </h1>
            </div>

            <div className="bg-white border-4 border-black p-6 space-y-6 shadow-[8px_8px_0_0_#000]">
              <div className="text-center space-y-4">
                <p className="font-bold uppercase text-black">Your vote has been securely recorded.</p>
                <div className="p-4 bg-slate-100 border-2 border-black break-all">
                  <span className="text-sm font-black text-black/50 block mb-1">TRACKING HASH</span>
                  <span className="font-mono text-indigo-600">{trackingHash}</span>
                </div>
                <p className="text-xs font-bold text-black/60 uppercase">Save this hash to verify your vote on the public tracker.</p>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setAppState('tracker')}
                  className="w-full py-4 border-4 border-black bg-[#D4FF2A] text-black hover:bg-white font-black uppercase tracking-wider shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                >
                  Verify on Tracker
                </button>
                <button
                  onClick={resetApp}
                  className="w-full py-4 border-4 border-black bg-white text-black hover:bg-black hover:text-[#D4FF2A] font-black uppercase tracking-wider shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                >
                  Return to Home
                </button>
              </div>
            </div>
          </div>
        )}

        {appState === 'tracker' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center p-6 bg-white border-4 border-black shadow-[8px_8px_0_0_#000]">
              <h1 className="text-3xl font-black uppercase">Public Tracker</h1>
            </div>

            {verifyError && (
              <div className="p-4 bg-red-100 border-4 border-red-500 text-red-700 font-bold uppercase shadow-[4px_4px_0_0_#ef4444]">
                {verifyError}
              </div>
            )}

            <div className="bg-white border-4 border-black p-2 flex shadow-[8px_8px_0_0_#000]">
              <div className="relative flex-1">
                <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-black" />
                <input
                  type="text"
                  value={trackingHash}
                  onChange={(e) => setTrackingHash(e.target.value)}
                  placeholder="ENTER TRACKING HASH"
                  className="w-full bg-transparent border-none py-4 pl-14 pr-4 focus:outline-none focus:ring-0 text-black font-black placeholder:text-black/50 uppercase"
                />
              </div>
              <button
                onClick={verifyHash}
                disabled={!trackingHash || isVerifying}
                className="px-8 py-2 m-1 bg-[#D4FF2A] border-4 border-black hover:bg-white text-black font-black uppercase disabled:opacity-50 transition-colors"
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>

            {verificationResult && (
              <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] overflow-hidden">
                <div className="p-6 border-b-4 border-black flex justify-between items-center bg-[#D4FF2A]">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-black" />
                    <h3 className="font-black uppercase text-xl text-black">Proof Validated</h3>
                  </div>
                  <button
                    onClick={downloadReceipt}
                    className="p-2 border-4 border-black bg-white hover:bg-black hover:text-[#D4FF2A] transition-colors"
                    title="Download Receipt"
                  >
                    <Download className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 space-y-6 font-mono font-bold text-sm uppercase">
                  <div>
                    <span className="block mb-2 text-black/50">Merkle Root</span>
                    <span className="bg-black text-[#D4FF2A] px-2 py-1 break-all border-2 border-black">{verificationResult.root}</span>
                  </div>
                  <div>
                    <span className="block mb-2 text-black/50">Leaf Index</span>
                    <span className="text-xl">{verificationResult.leaf_index}</span>
                  </div>
                  <div>
                    <span className="block mb-2 text-black/50">Audit Path</span>
                    <div className="space-y-2 bg-white p-4 border-4 border-black overflow-x-auto">
                      {verificationResult.audit_path.map((node, i) => (
                        <div key={i} className="flex gap-4">
                          <span>[{node.position}]</span>
                          <span className="truncate">{node.data}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
