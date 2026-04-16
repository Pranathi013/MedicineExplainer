from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import json
import shutil
from typing import List

from backend.models import (
    AnalyzeRequest, ReminderCreate, SymptomCheckRequest, EmergencyContactCreate,
    TrackingStart, AdherenceLog, SymptomLog, SideEffectLog,
    EffectivenessRating, PersonalNote, HealthGoal
)
from backend.database import init_db, get_db_connection
from backend import groq_llm

app = FastAPI()
# Trigger auto-reload for new API key

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

@app.get("/api/emergency")
async def get_emergency_support():
    return {
        "emergency_support": {
          "ambulance": {
            "available": True,
            "contact_numbers": ["108", "102"],
            "description": "Call ambulance immediately in case of emergency",
            "estimated_response": "10-15 minutes"
          },
          "hospitals": [
            {
              "name": "Nearest Hospital",
              "distance": "2 km",
              "type": "24/7 Emergency"
            }
          ],
          "general_instruction": "In case of severe symptoms, seek immediate medical help."
        }
    }

@app.post("/api/emergency/contacts")
async def create_emergency_contact(contact: EmergencyContactCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO emergency_contacts (name, phone) VALUES (?, ?)",
        (contact.name, contact.phone)
    )
    contact_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": contact_id, "success": True}

@app.get("/api/emergency/contacts")
async def get_emergency_contacts():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM emergency_contacts ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.delete("/api/emergency/contacts/{id}")
async def delete_emergency_contact(id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM emergency_contacts WHERE id=?", (id,))
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

# ─────────────────────────────────────────────────────
#  PHASE 1: TRACKING APIS
# ─────────────────────────────────────────────────────

@app.post("/api/tracking/start")
async def start_tracking(req: TrackingStart):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO tracking_sessions (rx_id, patient_name, medicine_names) VALUES (?, ?, ?)",
        (req.rx_id, req.patient_name, ",".join(req.medicine_names))
    )
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"session_id": session_id, "status": "active"}

@app.get("/api/tracking/sessions")
async def list_tracking_sessions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tracking_sessions ORDER BY start_date DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/tracking/{session_id}/status")
async def get_tracking_status(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tracking_sessions WHERE id=?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {"error": "Session not found"}

@app.post("/api/tracking/{session_id}/end")
async def end_tracking(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE tracking_sessions SET status='completed', end_date=CURRENT_TIMESTAMP WHERE id=?",
        (session_id,)
    )
    conn.commit()
    conn.close()
    return {"success": True}

@app.post("/api/tracking/{session_id}/adherence")
async def log_adherence(session_id: int, req: AdherenceLog):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO adherence_logs (session_id, medicine_name, dose_time, taken) VALUES (?, ?, ?, ?)",
        (req.session_id, req.medicine_name, req.dose_time, int(req.taken))
    )
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/tracking/{session_id}/adherence")
async def get_adherence(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM adherence_logs WHERE session_id=? ORDER BY timestamp DESC",
        (session_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/tracking/{session_id}/symptom")
async def log_symptom(session_id: int, req: SymptomLog):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO symptom_logs (session_id, symptom_type, severity, before_medicine, notes) VALUES (?, ?, ?, ?, ?)",
        (req.session_id, req.symptom_type, req.severity, int(req.before_medicine), req.notes)
    )
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/tracking/{session_id}/symptoms")
async def get_symptoms(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM symptom_logs WHERE session_id=? ORDER BY timestamp DESC",
        (session_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/tracking/{session_id}/sideeffect")
async def log_sideeffect(session_id: int, req: SideEffectLog):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO sideeffect_logs (session_id, medicine_name, effect, severity, onset_time, duration, action_taken) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (req.session_id, req.medicine_name, req.effect, req.severity, req.onset_time, req.duration, req.action_taken)
    )
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/tracking/{session_id}/sideeffects")
async def get_sideeffects(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM sideeffect_logs WHERE session_id=? ORDER BY timestamp DESC",
        (session_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/tracking/{session_id}/effectiveness")
async def log_effectiveness(session_id: int, req: EffectivenessRating):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO effectiveness_ratings (session_id, medicine_name, rating, improvement_area) VALUES (?, ?, ?, ?)",
        (req.session_id, req.medicine_name, req.rating, req.improvement_area)
    )
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/tracking/{session_id}/effectiveness")
async def get_effectiveness(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM effectiveness_ratings WHERE session_id=? ORDER BY timestamp DESC",
        (session_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/tracking/{session_id}/note")
async def add_note(session_id: int, req: PersonalNote):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO personal_notes (session_id, note_type, content) VALUES (?, ?, ?)",
        (req.session_id, req.note_type, req.content)
    )
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/tracking/{session_id}/notes")
async def get_notes(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM personal_notes WHERE session_id=? ORDER BY timestamp DESC",
        (session_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# ─────────────────────────────────────────────────────
#  PHASE 2: ANALYTICS APIS
# ─────────────────────────────────────────────────────

@app.get("/api/tracking/{session_id}/daily-summary")
async def get_daily_summary(session_id: int):
    from datetime import date
    today = str(date.today())
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT COUNT(*) FROM adherence_logs WHERE session_id=? AND DATE(timestamp)=?",
        (session_id, today)
    )
    adherence = cursor.fetchone()[0]

    cursor.execute(
        "SELECT AVG(severity) FROM sideeffect_logs WHERE session_id=? AND DATE(timestamp)=?",
        (session_id, today)
    )
    avg_side_effect = cursor.fetchone()[0] or 0

    cursor.execute(
        "SELECT AVG(severity) FROM symptom_logs WHERE session_id=? AND DATE(timestamp)=? AND before_medicine=0",
        (session_id, today)
    )
    mood = cursor.fetchone()[0] or 0

    conn.close()
    return {
        "date": today,
        "adherence_count": adherence,
        "avg_side_effect_severity": round(avg_side_effect, 1),
        "mood_rating": round(mood, 1)
    }

@app.get("/api/tracking/{session_id}/weekly-stats")
async def get_weekly_stats(session_id: int):
    from datetime import datetime, timedelta
    conn = get_db_connection()
    cursor = conn.cursor()

    stats = []
    for i in range(6, -1, -1):
        date_str = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")

        cursor.execute(
            "SELECT COUNT(*) FROM adherence_logs WHERE session_id=? AND DATE(timestamp)=?",
            (session_id, date_str)
        )
        adherence = cursor.fetchone()[0]

        cursor.execute(
            "SELECT AVG(severity) FROM symptom_logs WHERE session_id=? AND DATE(timestamp)=?",
            (session_id, date_str)
        )
        symptom_avg = cursor.fetchone()[0] or 0

        stats.append({
            "date": date_str,
            "adherence": adherence,
            "symptom_severity": round(symptom_avg, 1)
        })

    conn.close()
    return stats

@app.get("/api/tracking/{session_id}/insights")
async def get_insights(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT COUNT(DISTINCT DATE(timestamp)) FROM adherence_logs WHERE session_id=?",
        (session_id,)
    )
    days_tracked = cursor.fetchone()[0]

    cursor.execute(
        "SELECT AVG(severity) FROM sideeffect_logs WHERE session_id=?",
        (session_id,)
    )
    avg_side_effect = cursor.fetchone()[0] or 0

    cursor.execute(
        "SELECT AVG(rating) FROM effectiveness_ratings WHERE session_id=?",
        (session_id,)
    )
    avg_effectiveness = cursor.fetchone()[0] or 0

    conn.close()

    insights = []
    if days_tracked > 0:
        insights.append(f"✅ You've been consistent for {days_tracked} days!")
    if avg_effectiveness > 7:
        insights.append(f"🎉 Medicines are working great! Average rating: {round(avg_effectiveness, 1)}/10")
    if avg_side_effect < 3 and avg_side_effect > 0:
        insights.append("👍 Side effects are minimal or decreasing!")
    if avg_side_effect == 0 and days_tracked > 0:
        insights.append("🌟 No significant side effects reported!")

    return {
        "insights": insights,
        "days_tracked": days_tracked,
        "effectiveness_avg": round(avg_effectiveness, 1)
    }

@app.post("/api/tracking/{session_id}/goals")
async def create_goal(session_id: int, req: HealthGoal):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO health_goals (session_id, goal_name, target) VALUES (?, ?, ?)",
        (session_id, req.goal_name, req.target)
    )
    goal_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"goal_id": goal_id, "success": True}

@app.get("/api/tracking/{session_id}/goals")
async def get_goals(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM health_goals WHERE session_id=? ORDER BY timestamp DESC",
        (session_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.put("/api/tracking/{session_id}/goals/{goal_id}")
async def update_goal(session_id: int, goal_id: int, progress: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE health_goals SET progress=?, completed=? WHERE id=? AND session_id=?",
        (progress, 1 if progress >= 100 else 0, goal_id, session_id)
    )
    conn.commit()
    conn.close()
    return {"success": True}

# ─────────────────────────────────────────────────────
#  PHASE 3: REPORT APIS
# ─────────────────────────────────────────────────────

@app.get("/api/tracking/{session_id}/report-preview")
async def report_preview(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM tracking_sessions WHERE id=?", (session_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")
    session = dict(row)

    cursor.execute(
        "SELECT COUNT(*) FROM adherence_logs WHERE session_id=?", (session_id,)
    )
    total_doses = cursor.fetchone()[0]

    cursor.execute(
        "SELECT AVG(rating) FROM effectiveness_ratings WHERE session_id=?", (session_id,)
    )
    avg_effectiveness = cursor.fetchone()[0] or 0

    cursor.execute(
        "SELECT COUNT(DISTINCT medicine_name) FROM sideeffect_logs WHERE session_id=?", (session_id,)
    )
    side_effects_count = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(DISTINCT DATE(timestamp)) FROM adherence_logs WHERE session_id=?", (session_id,)
    )
    days_tracked = cursor.fetchone()[0]

    conn.close()

    return {
        "patient_name": session["patient_name"],
        "medicines": session["medicine_names"].split(","),
        "start_date": session["start_date"],
        "status": session["status"],
        "total_doses_logged": total_doses,
        "days_tracked": days_tracked,
        "average_effectiveness": round(avg_effectiveness, 1),
        "side_effects_recorded": side_effects_count,
        "recommendations": "Continue current medication schedule. Maintain consistency for best results."
    }

@app.get("/api/tracking/{session_id}/export-report")
async def export_report(session_id: int):
    from datetime import datetime
    preview_data = await report_preview(session_id)
    report = {
        "title": "30-Day Health Journey Report",
        "generated_at": datetime.now().isoformat(),
        "data": preview_data
    }
    return report

# Serve frontend statically
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
os.makedirs(FRONTEND_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
