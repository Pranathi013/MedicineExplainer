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
