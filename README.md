# CogniStream

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/release/python-3100/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

CogniStream is a high-performance, full-stack AI conversational application powered by the Google Gemini 2.5 Flash model. Designed with a decoupled architecture, it features real-time text generation, an advanced streaming Text-to-Speech (TTS) queue, and robust multi-tenant user authentication with secure data isolation.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Advanced Conversational AI:** Integrates the `google-genai` SDK to process complex multi-turn chats.
- **Streaming Text-to-Speech (TTS):** Features a custom-built, sentence-by-sentence asynchronous streaming queue. This eliminates audio timeout errors, bypasses API quota restrictions, and provides instant audio playback with a dynamic Stop/Queue interface.
- **Multi-Tenant Architecture:** Secure user registration and login system. Every chat session and message is cryptographically linked to individual user IDs in the database.
- **Robust Error Handling:** Built-in exponential backoff for 503 Server Errors and graceful fallback UI handling for 429 Resource Exhausted (Quota) limits.
- **Session Management:** Automatically generates contextual titles for new chat sessions and tracks conversation history natively in MongoDB.
- **Modern UI/UX:** A responsive, dark-mode frontend built with Tailwind CSS, featuring Markdown parsing, syntax highlighting, and dynamic modal overlays.

## Architecture

CogniStream utilizes a decoupled architecture separating the client interface from the AI processing server.

### Frontend
- **Core:** HTML5, CSS3, Vanilla JavaScript
- **Frameworks & Libraries:** Tailwind CSS, Marked.js, DOMPurify

### Backend
- **Core:** Python 3.10+, FastAPI, Uvicorn
- **Integrations:** HTTPX (Asynchronous HTTP client for TTS), Google GenAI SDK

### Database & Security
- **Database:** MongoDB, Motor (Asynchronous Python driver)
- **Security:** PyJWT, Passlib, Bcrypt

## Getting Started

### Prerequisites

Ensure you have the following installed before proceeding:
- [Python 3.10+](https://www.python.org/downloads/)
- [MongoDB](https://www.mongodb.com/) (Local server running on port 27017 or MongoDB Compass)
- A valid Google Gemini API Key

### Installation

1. Clone the repository and navigate to the backend directory:
   ```bash
   git clone [https://github.com/yourusername/CogniStream.git](https://github.com/yourusername/CogniStream.git)
   cd CogniStream/src/Backend
