# CareerCopilot - AI Interview & Coding Preparation Platform

CareerCopilot is a full-stack, monorepo platform designed to help candidates practice interviews, audit resumes against Job Descriptions, solve algorithm tasks using an integrated code sandbox editor, practice STAR behavioral questions, and review detailed grading reports.

## How It Works (High Level)

The platform is split into four main parts:

1. `client/` (candidate web app)
2. `admin/` (admin dashboard)
3. `server/` (Express + MongoDB API)
4. `desktop/` (Electron shell/overlay)

Core runtime flow:

1. User logs in on the client app (`/api/auth`).
2. JWT token is stored in localStorage and sent in `Authorization: Bearer <token>` for protected API calls.
3. User uploads resume (`/api/resume/upload`), server parses PDF text, then OpenAI analyzes and stores summary/skills.
4. User uses practice modules (interview, behavioral, coding, assistant overlay), which call API routes and receive AI feedback.
5. Results are saved in MongoDB (`Interview`, `CodingSession`, `Resume`, etc.) and shown back in UI.

## Question Processing Flow (Detailed)

This section explains exactly how a question moves through the system.

### A) Mock Interview Question Loop

Request path: `client -> /api/interview/start -> /api/interview/answer (repeat)`

1. Start session:

- Client sends category, experience, duration to `POST /interview/start`.
- Server calls `OpenAIService.generateNextQuestion(...)`.
- First question is saved in an `Interview` document with empty answer.

2. Submit answer:

- Client sends `interviewId`, `answerText`, `timeSpentSeconds` to `POST /interview/answer`.
- Server finds current unanswered question.
- Server calls `OpenAIService.evaluateAnswer(question, answer, category)`.
- Score + metrics (technicalAccuracy, communication, grammar, completeness) are stored.

3. Next question or finish:

- If under duration-based question limit, server calls `generateNextQuestion(...)` again with question history (to reduce duplicates).
- Otherwise server computes final aggregate score and feedback summary, marks interview as completed, returns final report.

### B) Behavioral (STAR) Question Evaluation

Request path: `client -> POST /api/interview/behavioral`

1. User picks or enters a behavioral question.
2. User submits answer text.
3. Server calls `OpenAIService.evaluateBehavioralAnswer(question, answer)`.
4. JSON result returned with score, feedback, and STAR-related metrics.

### C) Coding Question Processing

Request paths:

- `GET /api/coding/questions` -> fetch question bank
- `POST /api/coding/run` -> run sample test in sandbox (JS real VM, others mocked)
- `POST /api/coding/submit` -> full test + AI review + save session

Flow:

1. Client loads question and starter template.
2. On Run:

- For JavaScript, server executes code in Node `vm` sandbox with timeout.
- For non-JS languages, server currently returns simulated compiler output.

3. On Submit:

- Server runs all test cases.
- Server calls `OpenAIService.evaluateCodingSolution(...)` for complexity/mistakes/score.
- Combined result saved as `CodingSession` and returned to client.

### D) Real-Time Assistant Question Help

Request paths:

- `POST /api/assistant/transcribe` (audio -> text)
- `POST /api/assistant/ask` (question text -> guidance)
- `POST /api/assistant/analyze-screen` (screen image -> detected question + hints)

Flow:

1. User speaks or sends text/screenshot.
2. Server gets latest parsed resume for personalization.
3. OpenAI generates concise response (and optional code snippet).
4. If OpenAI key is missing/fails, server returns fallback mock guidance so UI still works.

## OpenAI and Fallback Behavior

- If `OPENAI_API_KEY` is present, `OpenAIService` uses models (`gpt-4o-mini`, `gpt-4o`, `whisper-1`).
- If key is missing, service returns deterministic mock responses.
- This lets local development run without breaking the UI.

## Current Wiring Status

The API server now mounts all core route groups in `server/src/server.ts`:

- `/api/auth`
- `/api/profile`
- `/api/resume`
- `/api/assistant`
- `/api/interview`
- `/api/coding`
- `/api/payment`
- `/api/admin`

---

## 📂 Project Structure

```
/ai-interview-platform
  ├── /client             # Candidate User portal (React + Vite + Tailwind CSS)
  ├── /admin              # System analytics control dashboard (React + Vite + Tailwind)
  ├── /server             # Core Express API (TypeScript + MongoDB + Socket.IO + Node VM)
  ├── /desktop            # Desktop installer shell configuration (Electron + Builder)
  ├── /shared             # Types and seed problems data library
  ├── docker-compose.yml  # Multi-container local/production setup
  ├── nginx.conf          # Reverse proxy routing for frontend & API paths
  └── ecosystem.config.js # Process management process configurations for VPS
```

---

## 🛠️ Prerequisites

Ensure the following tools are set up locally:

- **Node.js**: `v20.x` or later
- **MongoDB**: `v6.x` or later running on `127.0.0.1:27017`
- **Git**

---

## 🚀 Installation & Local Development

### 1. Core Server APIs Setup

Navigate to the server folder and configure connection keys:

```bash
cd server
npm install
cp .env.example .env
```

Update variables in `.env` (such as `OPENAI_API_KEY` to enable active AI reviews).

Start server API in hot-reload development mode:

```bash
npm run dev
```

_Port mapping: API starts listening on port `5000`._

### 2. Frontend Client Setup

Install dependencies and initiate the client development server:

```bash
cd ../client
npm install
npm run dev
```

_Port mapping: Client dashboard mounts on port `5173`._

### 3. System Admin Dashboard Setup

Install dependencies and run the admin control dashboard:

```bash
cd ../admin
npm install
npm run dev
```

_Port mapping: Admin panel starts on port `5174`._

### 4. Desktop Client Launch (Electron)

To boot CareerCopilot inside the desktop shell frame:

```bash
cd ../desktop
npm install
npm run electron
```

_Make sure client port `5173` is running locally to preview modifications in real-time inside the shell._

---

## 📦 Production Builds

### 1. Compile Backend REST APIs

```bash
cd server
npm run build
npm start
```

### 2. Build Web Clients

Compile candidate user portal:

```bash
cd client
npm run build
```

Compile admin dashboard panel:

```bash
cd admin
npm run build
```

### 3. Generate Windows Desktop installer (.exe)

To package client assets inside a single native Windows installer:

1. Make sure client assets are compiled (`npm run build` in `/client`).
2. Navigate to the desktop package and run the packaging command:

```bash
cd desktop
npm run dist
```

 This generates the installer in `desktop/release/CareerCopilotSetup.exe`.

---

## 🐳 Docker Deployment

To launch all backend components, databases, React panels, and Nginx proxy in Docker:

```bash
docker-compose up --build -d
```

Access points:

- **Candidate User Portal**: `http://localhost/`
- **System Admin Dashboard**: `http://localhost/admin/`
- **Core APIs**: `http://localhost/api/`

---

## 🪟 Windows Installation Guide (End-User)

1. **Download**: Obtain the compiled `CareerCopilotSetup.exe` from the target distribution server or web dashboard.
2. **Execute**: Double-click `CareerCopilotSetup.exe` to trigger NSIS installation.
3. **Accept**: Approve license arrangements and select target folder paths (creates Desktop & Start menu shortcuts automatically).
4. **Launch**: Launch CareerCopilot from shortcuts.
5. **Practice**: Set up candidate profiles, sync PDF resumes, start mock voice interviews, and solve algorithm sheets!
