from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from core.recognition import process_iris_image, clear_registered

app = FastAPI(title="IrisSecure Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def admin_auth(admin_id: str):
    if admin_id.upper() != "ADMIN123":
        raise HTTPException(status_code=403, detail="Invalid admin ID")
    return True

@app.post("/admin/reset")
async def admin_reset(admin_id: str):
    admin_auth(admin_id)
    clear_registered()
    return {"success": True, "message": "Database reset successfully"}

@app.post("/verify")
async def verify_iris(image: UploadFile = File(...)):
    try:
        contents = await image.read()
        result = process_iris_image(contents)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Verification failed"))
        return {"irisId": result["iris_id"], "status": result["message"]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
