from pydantic import BaseModel
from typing import List, Optional

class AnalyzeRequest(BaseModel):
    prescription_text: str

class ReminderCreate(BaseModel):
    medicine_name: str
    dose_time: str
    frequency: str
    days: int

class SymptomCheckRequest(BaseModel):
    symptoms: str
    current_medicines: List[str]

class EmergencyContactCreate(BaseModel):
    name: str
    phone: str

# Tracking Models
class TrackingStart(BaseModel):
    rx_id: int
    patient_name: str
    medicine_names: List[str]

class AdherenceLog(BaseModel):
    session_id: int
    medicine_name: str
    dose_time: str
    taken: bool = True

class SymptomLog(BaseModel):
    session_id: int
    symptom_type: str
    severity: int
    before_medicine: bool = True
    notes: Optional[str] = None

class SideEffectLog(BaseModel):
    session_id: int
    medicine_name: str
    effect: str
    severity: int
    onset_time: str
    duration: str
    action_taken: Optional[str] = None

class EffectivenessRating(BaseModel):
    session_id: int
    medicine_name: str
    rating: int
    improvement_area: str

class PersonalNote(BaseModel):
    session_id: int
    note_type: str
    content: str

class HealthGoal(BaseModel):
    session_id: int
    goal_name: str
    target: str
