import os
import json
import base64
from groq import Groq
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
print(f"[DEBUG] Loading .env from: {env_path}")
print(f"[DEBUG] .env exists: {os.path.exists(env_path)}")
load_dotenv(dotenv_path=env_path, override=True)

api_key = os.getenv("GROQ_API_KEY", "your_key_here")
print(f"[DEBUG] API key loaded: {api_key[:8]}...{api_key[-4:]}" if len(api_key) > 12 else f"[DEBUG] API key: {api_key}")
client = Groq(api_key=api_key)

TEXT_MODEL = 'llama-3.3-70b-versatile'
VISION_MODEL = 'llama-3.2-90b-vision-preview'

def get_json_from_response(res_text: str) -> dict:
    res_text = res_text.strip()
    if res_text.startswith("```json"):
        res_text = res_text[7:]
    elif res_text.startswith("```"):
        res_text = res_text[3:]
    if res_text.endswith("```"):
        res_text = res_text[:-3]
    return json.loads(res_text.strip())

def analyze_prescription(text: str) -> dict:
    prompt = """
You are RxClear, a clinical prescription assistant. Analyze the given prescription and return a structured JSON response with the following fields:

{
  "medicines": [
    {
      "name": "Medicine name",
      "generic_name": "Generic name",
      "dosage": "e.g. 500mg",
      "frequency": "e.g. Three times daily (every 8 hours)",
      "duration": "e.g. 7 days",
      "timing": "before food / after food / with food / empty stomach",
      "drug_class": "e.g. Penicillin Antibiotic",
      "purpose": "Why this medicine is prescribed — explain in plain English for a non-medical patient",
      "how_to_take": "Step-by-step: e.g. Swallow whole with a full glass of water. Do not crush or chew.",
      "missed_dose": "What to do if a dose is missed — specific and practical",
      "side_effects": ["List 2-3 common side effects to watch for"],
      "warnings": ["Specific warnings for this medicine"]
    }
  ],
  "combination_explanation": "In 3-4 sentences, explain why THIS specific combination of medicines was prescribed together — what each one contributes, how they complement each other, and why this combination makes sense for the likely condition. Write for a patient, not a doctor.",
  "diet_tips": [
    {
      "type": "tip / warning / avoid",
      "icon": "relevant emoji",
      "title": "Short title",
      "detail": "Specific, contextual advice tied to the actual medicines prescribed — not generic advice"
    }
  ],
  "food_drug_interactions": [
    {
      "medicine": "Medicine name",
      "avoid": "What food/drink to avoid and why"
    }
  ],
  "instructions": [
    "Step-by-step plain English instruction — specific to this prescription, not generic. Each step should tell the patient exactly what to do, when, and why."
  ],
  "reminders": [
    {
      "medicine": "Medicine name",
      "times": ["08:00", "14:00", "20:00"],
      "note": "e.g. Take after breakfast"
    }
  ],
  "refill_date": "Calculate based on quantity and frequency — return as a date string or 'X days from start'",
  "doctor_visit_flag": true,
  "doctor_visit_reason": "If true, explain why a follow-up is needed and when",
  "overall_summary": "2-3 sentence plain English summary of what this prescription is treating and the expected recovery timeline"
}

Rules:
- Never use abbreviations (OD, BD, TDS, SOS, etc.) — always expand them in plain English
- Write as if explaining to a patient with no medical background
- Diet tips must be specific to the medicines prescribed, not generic
- The combination_explanation must reference all medicines by name
- Warnings must be genuinely actionable (e.g. exact symptom to watch for, not just "consult a doctor")
- If the prescription image is unclear or unreadable, return an error field explaining what was unclear

Prescription Text:
""" + text
    try:
        response = client.chat.completions.create(
            model=TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        return get_json_from_response(response.choices[0].message.content)
    except Exception as e:
        print(f"Groq API Error: {e}")
        return {"error": str(e)}

def encode_image(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def analyze_prescription_image(image_path: str) -> dict:
    try:
        base64_image = encode_image(image_path)
        prompt = """
You are RxClear, a clinical prescription assistant. Analyze the given prescription and return a structured JSON response with the following fields:

{
  "medicines": [
    {
      "name": "Medicine name",
      "generic_name": "Generic name",
      "dosage": "e.g. 500mg",
      "frequency": "e.g. Three times daily (every 8 hours)",
      "duration": "e.g. 7 days",
      "timing": "before food / after food / with food / empty stomach",
      "drug_class": "e.g. Penicillin Antibiotic",
      "purpose": "Why this medicine is prescribed — explain in plain English for a non-medical patient",
      "how_to_take": "Step-by-step: e.g. Swallow whole with a full glass of water. Do not crush or chew.",
      "missed_dose": "What to do if a dose is missed — specific and practical",
      "side_effects": ["List 2-3 common side effects to watch for"],
      "warnings": ["Specific warnings for this medicine"]
    }
  ],
  "combination_explanation": "In 3-4 sentences, explain why THIS specific combination of medicines was prescribed together — what each one contributes, how they complement each other, and why this combination makes sense for the likely condition. Write for a patient, not a doctor.",
  "diet_tips": [
    {
      "type": "tip / warning / avoid",
      "icon": "relevant emoji",
      "title": "Short title",
      "detail": "Specific, contextual advice tied to the actual medicines prescribed — not generic advice"
    }
  ],
  "food_drug_interactions": [
    {
      "medicine": "Medicine name",
      "avoid": "What food/drink to avoid and why"
    }
  ],
  "instructions": [
    "Step-by-step plain English instruction — specific to this prescription, not generic. Each step should tell the patient exactly what to do, when, and why."
  ],
  "reminders": [
    {
      "medicine": "Medicine name",
      "times": ["08:00", "14:00", "20:00"],
      "note": "e.g. Take after breakfast"
    }
  ],
  "refill_date": "Calculate based on quantity and frequency — return as a date string or 'X days from start'",
  "doctor_visit_flag": true,
  "doctor_visit_reason": "If true, explain why a follow-up is needed and when",
  "overall_summary": "2-3 sentence plain English summary of what this prescription is treating and the expected recovery timeline"
}

Rules:
- Never use abbreviations (OD, BD, TDS, SOS, etc.) — always expand them in plain English
- Write as if explaining to a patient with no medical background
- Diet tips must be specific to the medicines prescribed, not generic
- The combination_explanation must reference all medicines by name
- Warnings must be genuinely actionable (e.g. exact symptom to watch for, not just "consult a doctor")
- If the prescription image is unclear or unreadable, return an error field explaining what was unclear
"""
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.1
        )
        return get_json_from_response(response.choices[0].message.content)
    except Exception as e:
        print(f"Groq Vision API Error: {e}")
        return {"error": str(e)}

def check_symptoms(symptoms: str, current_medicines: list) -> dict:
    prompt = f"""
You are a medical triage assistant. Given symptoms and current medicines,
classify severity and return ONLY this JSON:
{{
  "severity": "mild" | "moderate" | "severe",
  "color": "#00E5A0" | "#F5A623" | "#FF4757",
  "emoji": "🟢" | "🟡" | "🔴",
  "guidance": "Clear 2-sentence guidance for the patient",
  "action": "Continue medication" | "Contact doctor" | "Seek emergency care"
}}

Symptoms: {symptoms}
Current Medicines: {current_medicines}
"""
    try:
        response = client.chat.completions.create(
            model=TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        return get_json_from_response(response.choices[0].message.content)
    except Exception as e:
        print(f"Groq API Error: {e}")
        return {"error": str(e)}
