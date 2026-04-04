from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import json
import shutil
from typing import List

from models import AnalyzeRequest, ReminderCreate, SymptomCheckRequest
from database import init_db, get_db_connection
import groq_llm

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize Database
init_db()

@app.post("/api/analyze")
async def analyze_text(request: AnalyzeRequest):
    result = groq_llm.analyze_prescription(request.prescription_text)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    # Save to DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO analyses (raw_text, result_json) VALUES (?, ?)",
        (request.prescription_text, json.dumps(result))
    )
    conn.commit()
    conn.close()
    
    return result

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    result = groq_llm.analyze_prescription_image(file_path)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    # Save to DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO analyses (raw_text, result_json) VALUES (?, ?)",
        (f"Image: {file.filename}", json.dumps(result))
    )
    conn.commit()
    conn.close()
    
    return result

@app.post("/api/reminders")
async def create_reminder(reminder: ReminderCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO reminders (medicine_name, dose_time, frequency, days) VALUES (?, ?, ?, ?)",
        (reminder.medicine_name, reminder.dose_time, reminder.frequency, reminder.days)
    )
    reminder_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": reminder_id, "success": True}

@app.get("/api/reminders")
async def get_reminders():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reminders WHERE active=1 ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.delete("/api/reminders/{id}")
async def delete_reminder(id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reminders WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"success": True}

@app.post("/api/symptom-check")
async def check_symptom(request: SymptomCheckRequest):
    result = groq_llm.check_symptoms(request.symptoms, request.current_medicines)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/api/history")
async def get_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analyses ORDER BY created_at DESC LIMIT 10")
    rows = cursor.fetchall()
    conn.close()
    
    history_list = []
    for row in rows:
        r_dict = dict(row)
        try:
            r_dict["result_json"] = json.loads(r_dict["result_json"])
        except Exception as e:
            r_dict["result_json"] = {}
        history_list.append(r_dict)
    return history_list

# Serve frontend statically
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
os.makedirs(FRONTEND_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
