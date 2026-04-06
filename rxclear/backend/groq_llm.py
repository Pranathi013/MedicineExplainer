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
VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

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
    prompt = """You are RxClear, an AI-powered prescription assistant. Analyze the prescription provided and return ONLY a valid JSON object. No markdown, no explanation, no backticks — raw JSON only.

{
  "medicines": [
    {
      "name": "string — brand name as written on prescription",
      "generic_name": "string — generic/chemical name",
      "dosage": "string — e.g. 500mg",
      "frequency": "string — always in plain English, never abbreviations. e.g. 'Three times a day (every 8 hours)' not 'TDS'",
      "duration": "string — e.g. '7 days' or 'Until finished'",
      "timing": "string — one of: 'before food' / 'after food' / 'with food' / 'on empty stomach' / 'as needed'",
      "drug_class": "string — e.g. 'Penicillin Antibiotic'",
      "purpose": "string — why this medicine is prescribed, in plain English for a patient with no medical background",
      "how_to_take": "string — step-by-step instructions e.g. 'Swallow whole with a full glass of water. Do not crush or chew.'",
      "missed_dose": "string — exactly what to do if a dose is missed, specific and practical",
      "side_effects_action": [
        {
          "effect": "name of side effect",
          "severity": "mild | moderate | severe",
          "description": "simple explanation in easy language",
          "action": "clear step-by-step instruction for the user",
          "stop_medicine": true,
          "doctor_required": true,
          "emergency": true
        }
      ],
      "warnings": ["string — specific actionable warnings for this medicine"]
    }
  ],
  "combination_explanation": "string — 3 to 4 sentences explaining why THIS specific combination of medicines was prescribed together. Name each medicine, explain what it contributes, how they complement each other, and what condition this combination is likely treating. Write for a patient, not a doctor.",
  "diet_tips": [
    {
      "type": "string — exactly one of: 'tip' / 'caution' / 'avoid'",
      "title": "string — short label e.g. 'Stay Hydrated'",
      "detail": "string — specific advice tied to the actual medicines prescribed, not generic filler"
    }
  ],
  "food_drug_interactions": [
    {
      "medicine": "string — medicine name",
      "avoid": "string — what food or drink to avoid and why, specific"
    }
  ],
  "instructions": [
    "string — each item is one plain English step specific to this prescription. Tell the patient exactly what to do, when, and why. Minimum 4 steps, no generic filler like 'take medicines as directed'"
  ],
  "reminders": [
    {
      "medicine": "string — medicine name",
      "times": ["string — 24hr format e.g. '08:00', '14:00', '20:00'"],
      "note": "string — e.g. 'Take after breakfast with a full glass of water'"
    }
  ],
  "refill_date": "string — calculated from dosage and duration e.g. 'Refill needed in 7 days' or 'Course ends in 5 days, no refill needed'",
  "doctor_visit_flag": "boolean — true if follow-up is recommended",
  "doctor_visit_reason": "string — if doctor_visit_flag is true, explain exactly when and why to visit. Empty string if false.",
  "overall_summary": "string — 2 to 3 sentences summarizing what this prescription is treating, the expected recovery timeline, and the most important thing the patient should remember"
}

Strict rules:
- Return ONLY the JSON object. No markdown. No backticks. No extra text before or after.
- Never use medical abbreviations anywhere in the output. Always expand: OD = once daily, BD = twice daily, TDS = three times daily, QID = four times daily, SOS = as needed, AC = before food, PC = after food, HS = at bedtime.
- diet_tips must be specific to the medicines in this prescription. No generic advice.
- Every string field must have a real value. Never return null, undefined, or an empty string for any field.
- combination_explanation must mention every medicine by name.
- instructions must have at least 4 specific, actionable steps — not generic placeholders.
- If the prescription is an image and handwriting is unclear, still attempt analysis and add a "parse_warning" field with a string explaining what was unclear.

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
        prompt = """You are RxClear, an AI-powered prescription assistant. Analyze the prescription provided and return ONLY a valid JSON object. No markdown, no explanation, no backticks — raw JSON only.

{
  "medicines": [
    {
      "name": "string — brand name as written on prescription",
      "generic_name": "string — generic/chemical name",
      "dosage": "string — e.g. 500mg",
      "frequency": "string — always in plain English, never abbreviations. e.g. 'Three times a day (every 8 hours)' not 'TDS'",
      "duration": "string — e.g. '7 days' or 'Until finished'",
      "timing": "string — one of: 'before food' / 'after food' / 'with food' / 'on empty stomach' / 'as needed'",
      "drug_class": "string — e.g. 'Penicillin Antibiotic'",
      "purpose": "string — why this medicine is prescribed, in plain English for a patient with no medical background",
      "how_to_take": "string — step-by-step instructions e.g. 'Swallow whole with a full glass of water. Do not crush or chew.'",
      "missed_dose": "string — exactly what to do if a dose is missed, specific and practical",
      "side_effects": ["string — 2 to 3 common side effects to watch for"],
      "warnings": ["string — specific actionable warnings for this medicine"]
    }
  ],
  "combination_explanation": "string — 3 to 4 sentences explaining why THIS specific combination of medicines was prescribed together. Name each medicine, explain what it contributes, how they complement each other, and what condition this combination is likely treating. Write for a patient, not a doctor.",
  "diet_tips": [
    {
      "type": "string — exactly one of: 'tip' / 'caution' / 'avoid'",
      "title": "string — short label e.g. 'Stay Hydrated'",
      "detail": "string — specific advice tied to the actual medicines prescribed, not generic filler"
    }
  ],
  "food_drug_interactions": [
    {
      "medicine": "string — medicine name",
      "avoid": "string — what food or drink to avoid and why, specific"
    }
  ],
  "instructions": [
    "string — each item is one plain English step specific to this prescription. Tell the patient exactly what to do, when, and why. Minimum 4 steps, no generic filler like 'take medicines as directed'"
  ],
  "reminders": [
    {
      "medicine": "string — medicine name",
      "times": ["string — 24hr format e.g. '08:00', '14:00', '20:00'"],
      "note": "string — e.g. 'Take after breakfast with a full glass of water'"
    }
  ],
  "refill_date": "string — calculated from dosage and duration e.g. 'Refill needed in 7 days' or 'Course ends in 5 days, no refill needed'",
  "doctor_visit_flag": "boolean — true if follow-up is recommended",
  "doctor_visit_reason": "string — if doctor_visit_flag is true, explain exactly when and why to visit. Empty string if false.",
  "overall_summary": "string — 2 to 3 sentences summarizing what this prescription is treating, the expected recovery timeline, and the most important thing the patient should remember"
}

Strict rules:
- Return ONLY the JSON object. No markdown. No backticks. No extra text before or after.
- Never use medical abbreviations anywhere in the output. Always expand: OD = once daily, BD = twice daily, TDS = three times daily, QID = four times daily, SOS = as needed, AC = before food, PC = after food, HS = at bedtime.
- diet_tips must be specific to the medicines in this prescription. No generic advice.
- Every string field must have a real value. Never return null, undefined, or an empty string for any field.
- combination_explanation must mention every medicine by name.
- instructions must have at least 4 specific, actionable steps — not generic placeholders.
- If the prescription is an image and handwriting is unclear, still attempt analysis and add a "parse_warning" field with a string explaining what was unclear.
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
