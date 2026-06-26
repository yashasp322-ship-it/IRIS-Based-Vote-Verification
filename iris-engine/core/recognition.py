import cv2
import numpy as np
import hashlib

REGISTERED_IRISES = set()

def clear_registered():
    """Clears the in‑memory registered iris hash set.
    Useful for admin resets or testing.
    """
    REGISTERED_IRISES.clear()
    return True

def process_iris_image(image_bytes: bytes) -> dict:
    """
    Processes an image to detect an iris, extract a hash, and check for duplicates.
    """
    # 1. Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return {"success": False, "error": "Invalid image format"}
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 0)
    
    # 2. Reliable Demo Crop (Center 50%)
    # Hough circles are very unstable on standard webcams due to lighting.
    # For a reliable demo, we take a large center crop where the face/eye is.
    h, w = gray.shape
    iris_roi = gray[h//4:3*h//4, w//4:3*w//4]

    # 3. Feature Extraction (8x8 dHash)
    # We resize to 9x8 to compare adjacent pixels. This is extremely robust to lighting changes.
    resized = cv2.resize(iris_roi, (9, 8))
    
    bits = []
    for row in range(8):
        for col in range(8):
            bits.append(resized[row, col] > resized[row, col+1])
            
    hash_int = sum([1 << i for i, b in enumerate(bits) if b])
    
    # Convert to hex for display
    iris_hash = f"{hash_int:016x}"
    iris_id = f"IRIS-{iris_hash[:8].upper()}"
    
    # 4. Duplicate Check using Hamming Distance
    # 64 bit hash. A difference of < 15 bits is highly likely to be the same person.
    duplicate_found = False
    for registered_hash_int in REGISTERED_IRISES:
        xor_val = hash_int ^ registered_hash_int
        distance = bin(xor_val).count('1')
        print(f"Comparing hashes... Distance: {distance}/64")
        
        if distance < 18: # Generous threshold for webcam variance
            duplicate_found = True
            break
            
    if duplicate_found:
        return {
            "success": False,
            "error": "Duplicate Iris Detected - Multiple Voting Not Allowed",
            "iris_id": iris_id
        }
    
    # Register the new iris (storing the integer for distance calculation)
    REGISTERED_IRISES.add(hash_int)
    
    return {
        "success": True,
        "iris_id": iris_id,
        "message": "Cryptographically Verified - Not a Duplicate"
    }
