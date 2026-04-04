import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
print(f"Loading .env from: {env_path}")
print(f"File exists: {os.path.exists(env_path)}")

load_dotenv(dotenv_path=env_path, override=True)
api_key = os.getenv("GEMINI_API_KEY")
print(f"Key loaded: {api_key[:8]}...{api_key[-4:]}" if api_key and len(api_key) > 12 else f"Key: {api_key}")

import google.generativeai as genai
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.0-flash')

try:
    response = model.generate_content("Say hello in one word")
    print(f"SUCCESS: {response.text}")
except Exception as e:
    print(f"ERROR: {e}")
