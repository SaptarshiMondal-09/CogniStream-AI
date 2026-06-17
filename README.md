# CogniStream AI Assistant 🧠⚡

CogniStream is a high-performance, full-stack AI conversational application powered by the Google Gemini 2.5 Flash model. Designed with a decoupled architecture, it features real-time text generation, an advanced streaming Text-to-Speech (TTS) queue, and robust multi-tenant user authentication with secure data isolation.

## 🌟 Key Features
* **Advanced Conversational AI:** Integrates the `google-genai` SDK to process complex multi-turn chats.
* **Streaming Text-to-Speech (TTS):** Features a custom-built, sentence-by-sentence asynchronous streaming queue. This eliminates audio timeout errors, bypasses API quota restrictions, and provides instant audio playback with a dynamic "Stop/Queue" UI.
* **Multi-Tenant Architecture:** Secure user registration and login system. Every chat session and message is cryptographically linked to individual user IDs in the database.
* **Robust Error Handling:** Built-in exponential backoff for 503 Server Errors and graceful fallback UI handling for 429 Resource Exhausted (Quota) limits.
* **Session Management:** Automatically generates contextual titles for new chat sessions and tracks conversation history natively in MongoDB.
* **Modern UI/UX:** A responsive, dark-mode frontend built with Tailwind CSS, featuring Markdown parsing, syntax highlighting, and dynamic modal overlays.

---

## 🛠️ Tech Stack

**Frontend**
* HTML5, CSS3, Vanilla JavaScript
* **Tailwind CSS** (Styling framework)
* **Marked.js** (Markdown rendering)
* **DOMPurify** (XSS protection & sanitization)

**Backend**
* **Python 3.10+**
* **FastAPI** (High-performance ASGI web framework)
* **Uvicorn** (Lightning-fast ASGI server)
* **HTTPX** (Asynchronous HTTP client for TTS fetching)
* **Google GenAI SDK** (Gemini 2.5 Flash & Gemini TTS integration)

**Database & Security**
* **MongoDB** (NoSQL database for flexible chat storage)
* **Motor** (Asynchronous Python driver for MongoDB)
* **PyJWT** (JSON Web Token generation for session management)
* **Passlib & Bcrypt** (Secure password hashing and verification)

---

## 🚀 Installation & Local Setup

### Prerequisites
* Python 3.10 or higher
* MongoDB Compass (or a local MongoDB server running on port 27017)
* A valid Google Gemini API Key


Clone the repository and navigate to the backend directory:
```bash
git clone [https://github.com/yourusername/CogniStream.git](https://github.com/yourusername/CogniStream.git)
cd CogniStream/src/Backend
