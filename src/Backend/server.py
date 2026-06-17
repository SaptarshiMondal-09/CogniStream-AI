import os
import base64
import urllib.parse
import asyncio
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
import httpx
from google import genai
from google.genai import types
from motor.motor_asyncio import AsyncIOMotorClient

# Modern Security & Auth Imports
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta, timezone
from fastapi.security import HTTPBearer
from pydantic import BaseModel

app = FastAPI(title="CogniStream AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY) if API_KEY else None

MONGO_URI = "mongodb://localhost:27017"
try:
    mongo_client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    db = mongo_client["CogniStream"]
    chat_collection = db["chat_history"]
    session_collection = db["chat_sessions"] # Tracks the titles and session IDs
    print("Connected to MongoDB successfully!")
except Exception as e:
    print(f"MongoDB connection failed. Chats won't save. Error: {e}")
    chat_collection = None
    session_collection = None

# --- SECURITY SETUP ---
SECRET_KEY = "cognistream_super_secret_key_2026"
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# --- DATA MODELS ---
class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []
    session_id: str

class TTSRequest(BaseModel):
    text: str

class UserRegister(BaseModel):
    name: str
    email: str
    country: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

# --- DATA MODELS ---
class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []
    session_id: str  # Frontend passes a unique ID for each chat window

class ImageRequest(BaseModel):
    prompt: str
    session_id: str

class TTSRequest(BaseModel):
    text: str

# --- AUTHENTICATION ENDPOINTS ---
@app.post("/api/register")
async def register_user(user: UserRegister):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered")

    hashed_password = pwd_context.hash(user.password)

    user_dict = {
        "name": user.name,
        "email": user.email,
        "country": user.country,
        "password": hashed_password,
        "created_at": datetime.now(timezone.utc)
    }

    result = await db.users.insert_one(user_dict)
    return {"message": "Registration successful!", "user_id": str(result.inserted_id)}

# --- 2 . USER LOGIN ENDPOINT ---
@app.post("/api/login")
async def login_user(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email})

    if not db_user or not pwd_context.verify(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode = {"sub": str(db_user["_id"]), "exp": expire}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return {
        "access_token": token,
        "token_type": "bearer",
        "name": db_user["name"],
        "message": "Login successful"
    }

# --- JWT DEPENDENCY (THE SECURITY GUARD) ---
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        # Decrypt the token using our secret key
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        # Extract the user's MongoDB ID ('sub')
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# --- 1. MAIN CHAT ENDPOINT ---
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, current_user: str = Depends(get_current_user)):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if not client:
        raise HTTPException(status_code=500, detail="API Key not configured.")

    try:
        formatted_history = []
        for msg in request.history:
            if msg.get("role") and msg.get("content"):
                formatted_history.append(
                    types.Content(role=msg.get("role"), parts=[types.Part.from_text(text=msg.get("content"))])
                )

        chat = client.chats.create(model='gemini-2.5-flash', history=formatted_history)

        # FIX: We initialize a string variable right here
        final_response_text = "An unexpected error occurred."

        max_retries = 3
        delay = 1
        for attempt in range(max_retries):
            try:
                response = chat.send_message(request.message)
                final_response_text = response.text  # If successful, capture the AI's text
                break
            except Exception as e:
                error_str = str(e).lower()
                if "429" in error_str or "resource_exhausted" in error_str or "quota" in error_str:
                    final_response_text = "I am receiving too many requests right now! Please wait about a minute and try asking again."
                    break
                elif "safety" in error_str or "finish_reason" in error_str or "blocked" in error_str:
                    final_response_text = "This AI model don't support that type of Work."
                    break
                elif "503" in str(e) and attempt < max_retries - 1:
                    print(f"Google servers busy. Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                    delay *= 2
                else:
                    raise e

                    # --- MONGODB SESSION & SAVE LOGIC ---
        if chat_collection is not None and session_collection is not None:
            try:
                existing_session = await session_collection.find_one({"session_id": request.session_id})

                if not existing_session:
                    try:
                        title_prompt = f"Generate a very short, 3 to 5 word title for a chat that starts with this user message: '{request.message}'. Do not use quotes, punctuation, or extra conversational text."
                        title_response = client.chats.create(model='gemini-2.5-flash').send_message(title_prompt)
                        chat_title = title_response.text.strip()
                    except:
                        chat_title = "New Chat Session"

                    await session_collection.insert_one({
                        "session_id": request.session_id,
                        "user_id": current_user,
                        "title": chat_title,
                        "created_at": datetime.now(timezone.utc)
                    })

                await chat_collection.insert_one({
                    "session_id": request.session_id,
                    "user_id": current_user,
                    "timestamp": datetime.now(timezone.utc),
                    "role": "user",
                    "content": request.message
                })
                await chat_collection.insert_one({
                    "session_id": request.session_id,
                    "user_id": current_user,
                    "timestamp": datetime.now(timezone.utc),
                    "role": "model",
                    # FIX: Use the string variable, not response.text
                    "content": final_response_text
                })
            except Exception as db_err:
                print(f"Warning: Failed to save to MongoDB: {db_err}")

        # FIX: Send back the string variable
        return {"reply": final_response_text}

    except Exception as e:
        print(f"Error during AI generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- IMAGE GENERATION ENDPOINT ---
@app.post("/api/generate-image")
async def generate_image_endpoint(request: ImageRequest, current_user: str = Depends(get_current_user)):
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    try:
        # 1. Format the prompt for a web URL safely
        encoded_prompt = urllib.parse.quote(request.prompt)

        # 2. Use the free, open-source Pollinations API (No API key needed!)
        # We request a high-quality 1024x1024 image without watermarks
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"

        # 3. Fetch the image bytes asynchronously
        async with httpx.AsyncClient() as client_http:
            # High timeout because image generation takes a few seconds
            response = await client_http.get(image_url, timeout=45.0)

            if response.status_code != 200:
                raise Exception(f"Open-source generator failed with status {response.status_code}")

            image_bytes = response.content

        # 4. Convert to Base64 so it securely embeds in the chat and database
        base64_str = base64.b64encode(image_bytes).decode("utf-8")
        markdown_response = f"![Generated Image](data:image/jpeg;base64,{base64_str})"

        # --- MONGODB SESSION & SAVE LOGIC ---
        if chat_collection is not None and session_collection is not None:
            try:
                existing_session = await session_collection.find_one({"session_id": request.session_id})

                if not existing_session:
                    await session_collection.insert_one({
                        "session_id": request.session_id,
                        "user_id": current_user,
                        "title": f"Image: {request.prompt[:20]}...",
                        "created_at": datetime.now(timezone.utc)
                    })

                await chat_collection.insert_one({
                    "session_id": request.session_id,
                    "user_id": current_user,
                    "timestamp": datetime.now(timezone.utc),
                    "role": "user",
                    "content": f"/image {request.prompt}"
                })
                await chat_collection.insert_one({
                    "session_id": request.session_id,
                    "user_id": current_user,
                    "timestamp": datetime.now(timezone.utc),
                    "role": "model",
                    "content": markdown_response
                })
            except Exception as db_err:
                print(f"Warning: Failed to save to MongoDB: {db_err}")

        return {"reply": markdown_response}

    except httpx.ReadTimeout:
        raise HTTPException(status_code=504, detail="Image generation took too long. Try again.")
    except Exception as e:
        print(f"Image generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate image. Try a different prompt.")

# --- 2. GET HISTORY ENDPOINTS (NOW USER-SPECIFIC) ---
@app.get("/api/sessions")
async def get_sessions(current_user: str = Depends(get_current_user)):
    """Fetches ONLY the sessions belonging to the logged-in user."""
    if session_collection is None:
        return []
    try:
        # FILTER: Only find sessions where user_id matches the current token
        cursor = session_collection.find({"user_id": current_user}, {"_id": 0}).sort("created_at", -1)
        sessions = await cursor.to_list(length=100)
        return sessions
    except Exception:
        return []


@app.get("/api/history/{session_id}")
async def get_history(session_id: str, current_user: str = Depends(get_current_user)):
    """Loads previous messages, strictly checking ownership."""
    if chat_collection is None:
        return []
    try:
        # FILTER: Make sure the chat belongs to the session AND the current user
        cursor = chat_collection.find({"session_id": session_id, "user_id": current_user}, {"_id": 0}).sort("timestamp",
                                                                                                            1)
        messages = await cursor.to_list(length=500)
        return messages
    except Exception:
        return []


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, current_user: str = Depends(get_current_user)):
    """Deletes a chat, but only if the logged-in user owns it."""
    if session_collection is None or chat_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    try:
        # FILTER: Ensure they can only delete their own data
        await session_collection.delete_one({"session_id": session_id, "user_id": current_user})
        await chat_collection.delete_many({"session_id": session_id, "user_id": current_user})

        return {"status": "success", "message": "Chat deleted permanently"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 3. TTS ENDPOINT ---
@app.post("/api/tts")
async def tts_endpoint(request: TTSRequest):
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API Key not configured.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={API_KEY}"
    
    payload = {
        "contents": [{"role": "user", "parts": [{"text": request.text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Aoede"}}}
        }
    }
    
    try:
        # INCREASED TIMEOUT to 60.0 seconds! Long paragraphs take time to render.
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=60.0)
            
        if response.status_code != 200:
            print(f"Google TTS Error: {response.status_code} - {response.text}")
            detail_msg = "API Quota Exceeded. Please wait a minute." if response.status_code == 429 else "Google rejected the audio request."
            raise HTTPException(status_code=response.status_code, detail=detail_msg)
            
        return response.json()
        
    except httpx.ReadTimeout:
        raise HTTPException(status_code=504, detail="Audio generation timed out. The text might be too long.")
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail="Network error contacting Google.")
    
