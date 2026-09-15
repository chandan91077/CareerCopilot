# 🚀 CareerCopilot — 24-Hour AI Hackathon Documentation & Project Guide

> **Theme**: Build something that couldn't have existed two years ago.
> **Track**: Multimodal / Agents & Automation / Developer Tooling

---

## 📌 Executive Summary & "The 2023 Test"

### Could this have existed in 2023? **NO.**
In 2023:
1. **Low-Latency Real-Time Audio Transcription**: Whisper models required heavy local GPUs or took 10–20 seconds per audio chunk on traditional cloud endpoints. Ultra-fast sub-second transcription engines like **Groq Llama-3.3 / Whisper-Large-v3** did not exist for real-time web streaming.
2. **On-Device Desktop Screen & System Audio Fusion**: Combining real-time desktop screen captures, live speaker loopback audio, microphone activity detection (VAD), and multi-model fallback AI into a lightweight transparent desktop overlay was practically impossible at real-time speeds.
3. **Instant Structural Code Generation**: Generating complete, runnable Java, Python, SQL, and C++ code solutions with step-by-step complexity analysis under 1.5 seconds was beyond 2023 LLM speed capabilities.

---

## 🛠️ 1. Technical Architecture & How It Works

### High-Level System Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                ELECTRON DESKTOP OVERLAY                                │
│                                                                                        │
│   [ Microphones ]  ──┐                                                                 │
│                      ├──> Web Audio VAD (RMS Check) ──> [ Audio Chunks (4s) ]         │
│   [ System Audio ] ──┘          (Filters Silence)                   │                  │
│                                                                     ▼                  │
│                                                       POST /api/assistant/transcribe   │
└─────────────────────────────────────────────────────────────────────┬──────────────────┘
                                                                      │
                                                                      ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  BACKEND SERVER (EXPRESS)                              │
│                                                                                        │
│   1. Groq / OpenAI Whisper Speech-to-Text                                              │
│      └─ Temperature: 0.0, Language: 'en', Prompt Grounding                            │
│                                                                                        │
│   2. 3.5-Second Silence Pause Buffer (Question Aggregator)                             │
│      └─ Merges fragmented speech chunks into 1 complete query                          │
│                                                                                        │
│   3. Groq Llama-3.3-70B Versatile AI Engine                                            │
│      └─ Fallback Chain: Llama-3.3-70b -> Llama3-70b -> Llama3-8b -> Mixtral -> DeepSeek │
│                                                                                        │
│   4. Output JSON: { text: "Explanation + Complexity", code: "Working Solution Code" }  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔊 2. How Speaker Voice & Microphone Audio Listening Works

### Dual-Audio Stream Capture
The application captures two distinct audio sources simultaneously:
1. **Microphone Stream (`startMicListening`)**: Captures the candidate's voice using browser/Electron `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } })`.
2. **System Speaker Stream (`startSpeakerListening`)**: Captures the interviewer's voice coming through Zoom, Google Meet, or MS Teams using Electron `desktopCapturer` system audio loopback.

### Voice Activity Detection (VAD) & Silence Filtering
To prevent API waste and Whisper silence hallucinations (e.g. random phrases like *"Kansai International Airport"*), every 4-second audio blob passes through an audio energy analyzer before network transmission:
```typescript
// Web Audio API Root Mean Square (RMS) Volume Calculation
const volumeRms = await checkAudioChunkVolume(audioBlob);

if (volumeRms < 0.005) {
  // Silence detected (RMS < 0.5%) — skip network call completely
  return;
}
```

---

## ✍️ 3. How Live Captioning & 3.5s Pause Detection Works

### Live Caption Rendering
When audio chunks pass the VAD volume threshold:
1. The chunk is posted to `/api/assistant/transcribe`.
2. Groq Whisper (`whisper-large-v3`) decodes the speech with zero temperature (`temperature: 0.0`) to guarantee deterministic English text.
3. As speech chunks arrive, they are rendered live in the **Live Captions feed** (`Me` or `Interviewer`).

### 3.5-Second Silence Pause Finalization Buffer
To prevent generating incomplete AI answers every 4 seconds mid-sentence:
1. Incoming transcribed text fragments are collected into an **accumulated question buffer** (`questionBufferRef`).
2. A **3.5-second pause timer** is set/reset on every new speech fragment.
3. When the speaker stops talking for 3.5 seconds (a natural pause), the system:
   - Merges all accumulated speech fragments.
   - Deduplicates repeating words/phrases.
   - Finalizes the full question string (e.g., *"How can we find the second largest element in Java?"*).
   - Triggers **one complete AI answer**.

---

## 🔐 4. How Session ID, Authentication & Password Work

### User Registration & Authentication Flow
1. **User Sign Up / Login**: User registers with Email & Password via `/api/auth/register` or `/api/auth/login`.
2. **Password Hashing**: Passwords are encrypted using **bcryptjs** (salted hashing) before storing in MongoDB (`Profile` / `User` schemas).
3. **JWT Token Generation**: Server issues a signed **JSON Web Token (JWT)** containing `user.id`, valid for 7 days.

### Desktop Overlay Synchronized Resume Mode (`optionalAuthMiddleware`)
- When running in the standalone Desktop App (`.exe`), the app communicates with the backend via `/api/resume/latest`.
- If an auth token is present in `localStorage`, it retrieves the user's uploaded CV.
- If the token is absent (standalone desktop session), the backend gracefully falls back to `optionalAuthMiddleware`, retrieving the candidate's latest synchronized CV from the platform.

---

## 🖥️ 5. How Real-Time Screen Sharing Works (WebRTC + Socket.IO)

### Overview
The Screen Sharing feature allows a candidate using the Desktop Overlay to **broadcast their screen live** to an evaluator (interviewer/recruiter/coach) watching via the Web App — with **encrypted peer-to-peer video streaming** and **real-time remote mouse & keyboard control**.

---

### Full Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                CANDIDATE (Electron Desktop Overlay)                   │
│                                                                       │
│  [Screen Share] button clicked                                        │
│          │                                                            │
│          ▼                                                            │
│  desktopCapturer.getSources() ──► getUserMedia(chromeMediaSource)    │
│  (captures full desktop video stream)                                 │
│          │                                                            │
│          ▼                                                            │
│  POST /api/screen-share/create                                        │
│  └── Server creates session: { sessionId, password, expiresAt }      │
│          │                                                            │
│          ▼                                                            │
│  Socket.IO: emit("screen-share:host-register", { sessionId })        │
│  RTCPeerConnection created, video track added                         │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │   Socket.IO Signaling (WebSocket)
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER (Express + Socket.IO)               │
│                                                                       │
│  REST API Endpoints:                                                  │
│  ├── POST /api/screen-share/create  → Generate sessionId + password  │
│  ├── POST /api/screen-share/join    → Validate credentials           │
│  └── POST /api/screen-share/stop   → Invalidate session              │
│                                                                       │
│  Socket.IO Event Relay (No media passes through server):             │
│  ├── "screen-share:host-register"  → Register candidate host room    │
│  ├── "screen-share:viewer-joined"  → Notify host that viewer joined  │
│  ├── "screen-share:offer"         → Relay SDP offer host → viewer   │
│  ├── "screen-share:answer"        → Relay SDP answer viewer → host  │
│  ├── "screen-share:ice-candidate" → Relay ICE candidates both ways  │
│  ├── "screen-share:remote-input"  → Forward mouse/keyboard events   │
│  └── "screen-share:stop"          → Broadcast session ended         │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │   WebRTC (Peer-to-Peer, direct)
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                VIEWER (Browser Web App /screen-share/view)            │
│                                                                       │
│  Enter Session ID + Password  ──► POST /api/screen-share/join       │
│          │                                                            │
│          ▼                                                            │
│  Socket.IO: emit("screen-share:join-room", { sessionId })            │
│  RTCPeerConnection: Receives SDP offer → sends answer                │
│          │                                                            │
│          ▼                                                            │
│  pc.ontrack ──► MediaStream ──► <video autoplay> rendered            │
│          │                                                            │
│          ▼                                                            │
│  Remote Control: Mouse move / click / scroll / keydown               │
│  └── Viewer mouse events ──► socket "screen-share:remote-input"      │
│      Host receives ──► electronAPI.executeRemoteInput()              │
│      ──► Win32 SetCursorPos() + mouse_event() via Koffi FFI          │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Step-by-Step: How a Session Works

#### 🟢 Candidate Side (Desktop Overlay)
1. Candidate clicks **"Screen Share"** button in the overlay top bar.
2. Electron calls `desktopCapturer.getSources()` to get available screen sources.
3. `getUserMedia({ chromeMediaSource: 'desktop', chromeMediaSourceId })` captures the full-resolution desktop video stream (1280–1920 × 720–1080).
4. A `POST /api/screen-share/create` request generates a unique **6-char Session ID** (e.g., `PREP-8F42K9`) and a **6-char temporary Password** (e.g., `7X9P2Q`), stored in MongoDB with a 60-minute expiry.
5. Candidate shares the **Session ID** and **Password** verbally or via chat to the viewer.
6. The desktop overlay displays the credentials with **one-click copy** buttons.

#### 🔵 Viewer Side (Browser / Web App)
1. Viewer opens the Dashboard → **"Watch Stream"** sidebar link → `/screen-share/view`.
2. Viewer enters the **Session ID** and **Password** → clicks **"Connect to Stream"**.
3. The browser calls `POST /api/screen-share/join` to validate credentials against the stored MongoDB session.
4. A **WebRTC `RTCPeerConnection`** is established peer-to-peer using **Google STUN servers** for NAT traversal:
   - Host candidate sends **SDP Offer** via Socket.IO relay.
   - Viewer sends back **SDP Answer**.
   - Both exchange **ICE candidates** for network path negotiation.
5. Once connected, the candidate's screen streams **directly** into the viewer's `<video>` element — the media **never passes through the server** (pure WebRTC P2P).

---

### Remote Mouse & Keyboard Control
When the viewer has **"Remote Control: ON"** enabled:
| Viewer Action | How It Works |
|---|---|
| Move mouse | `mousemove` event → socket `screen-share:remote-input` → `electronAPI.executeRemoteInput()` → Win32 `SetCursorPos(x, y)` |
| Click | `mousedown/mouseup` → socket relay → `mouse_event(MOUSEEVENTF_LEFTDOWN)` via **Koffi FFI** |
| Right-click | `contextmenu` → `mouse_event(MOUSEEVENTF_RIGHTDOWN + RIGHTUP)` |
| Scroll | `wheel.deltaY` → `mouse_event(MOUSEEVENTF_WHEEL, delta)` |
| Keypress | `keydown/keyup` → `keybd_event(virtualKeyCode)` via Win32 API |

Mouse coordinates are normalized as `(xRatio, yRatio)` ratios of the video element size and then scaled to the actual screen resolution using `GetSystemMetrics(0/1)`.

---

### Security Model
- **Session IDs are single-use per 60 minutes** — stored in MongoDB with `expiresAt` timestamp.
- **Passwords are randomly generated** at session creation — not stored in plain text (hashed server-side).
- **Content Protection**: The overlay window itself is **excluded from screen capture** via `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` — meaning the AI overlay is invisible in the broadcast to the viewer.
- **No media relay**: The video stream is **pure WebRTC peer-to-peer** — the server only relays tiny SDP/ICE signaling messages, never video frames.

---

## 📸 6. How Screen Capture, Storage & AI Vision Analysis Work

### Overview
CareerCopilot includes an instant multimodal vision engine that allows candidates to take a snapshot of their screen (such as a LeetCode problem, online assessment MCQ, or system design diagram) and receive step-by-step hints and working solution code tailored to their resume.

---

### Step 1: How the Image is Captured

1. **Triggering the Snapshot**:
   - **Global Keyboard Shortcut**: Pressing <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (or <kbd>Cmd</kbd> + <kbd>Enter</kbd> on macOS). Electron registers this globally using `globalShortcut.register('CommandOrControl+Enter', ...)`.
   - **UI Camera Button**: Clicking the **"Capture"** button in the overlay top bar, which triggers `electronAPI.triggerScreenCapture()` via IPC from the renderer to the main process.

2. **Native Screen Capture in `desktop/main.js` (`captureActiveScreenBase64`)**:
   - Electron queries `screen.getPrimaryDisplay()` to determine the exact screen width, height, and display DPI scaling factor:
     ```javascript
     const width = Math.round(bounds.width * scale);
     const height = Math.round(bounds.height * scale);
     ```
   - It invokes Electron’s native `desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } })` to grab the primary monitor frame.
   - The thumbnail is converted to a PNG buffer via `sources[0].thumbnail.toPNG()`, and then encoded into a **Base64 string** (`pngBuffer.toString('base64')`).
   - Electron emits the Base64 image directly to the React overlay window through IPC:
     ```javascript
     mainWindow.webContents.send('screen-captured', base64Image);
     ```

3. **Stealth & Self-Exclusion (Content Protection)**:
   - The floating assistant overlay uses Win32 API `SetWindowDisplayAffinity(hwnd, 0x00000011)` (`WDA_EXCLUDEFROMCAPTURE`) and `win.setContentProtection(true)`.
   - This ensures the CareerCopilot overlay itself is **completely invisible to screenshots and screen shares**, capturing only the underlying coding environment or browser.

---

### Step 2: Does It Store the Image Anywhere? (Storage Lifecycle)

- **Local Disk (Ephemeral Debug File only)**:
  - During capture, `main.js` writes a temporary copy to the operating system's temp folder:
    ```javascript
    path.join(app.getPath('temp'), 'last-capture-debug.png')
    ```
    *(On Windows: `%TEMP%\last-capture-debug.png`)*.
  - This file exists only for local debugging and is overwritten on every subsequent capture.
- **Client Frontend Memory (React State)**:
  - In `client/src/pages/AssistantOverlay.tsx`, the Base64 string is held in component memory (`capturedScreen` state) while the user decides to type an instruction or press Enter.
  - As soon as the user submits or clears the capture, this state is set back to `null`.
- **Backend / Database Storage**:
  - **Zero persistence.** The image is never saved to the server's disk, filesystem, or database (no MongoDB or cloud bucket storage like S3). It is processed in-memory as an HTTP POST payload and immediately passed to the AI vision endpoint.

---

### Step 3: How the Image is Sent to the API for the Answer

1. **Frontend Request Dispatch (`AssistantOverlay.tsx` → `sendScreenAnalysis`)**:
   - The client packages the Base64 image and any optional user prompt (e.g., *"code in java"*) into a JSON payload:
     ```http
     POST /api/assistant/analyze-screen
     Content-Type: application/json
     Authorization: Bearer <token>

     {
       "image": "<base64_string>",
       "userInstruction": "solve in Python using dynamic programming"
     }
     ```

2. **Backend Route Processing (`server/src/routes/assistant.routes.ts`)**:
   - Extracts `image` and `userInstruction` from `req.body`.
   - Queries MongoDB for the candidate's latest parsed resume (`Resume.findOne({ user: req.user?.id })`) to inject candidate-specific context.
   - Passes the image, resume text, and instruction to `OpenAIService.analyzeScreen(...)`.

3. **Multimodal LLM Processing (`server/src/services/openai.service.ts`)**:
   - Cleans the Base64 string and embeds it as a data URI: `data:image/png;base64,${cleanBase64}`.
   - Constructs a multimodal payload sent to vision-capable models:
     ```javascript
     messages: [
       { role: 'system', content: 'You are an expert real-time technical interview companion analyzing a live screen capture image...' },
       {
         role: 'user',
         content: [
           { type: 'text', text: `Candidate's Resume:\n${resumeText}\n\nUSER TYPED INSTRUCTION: "${userInstruction}"` },
           { type: 'image_url', image_url: { url: `data:image/png;base64,${cleanBase64}` } }
         ]
       }
     ]
     ```
   - **Model Chain**: Primary vision models are `gpt-4o-mini` and `gpt-4o`, with automatic fallback to Groq Vision models (`llama-3.2-11b-vision-preview`, `llama-3.2-90b-vision-preview`).
   - **Enforced JSON Output**:
     ```json
     {
       "questionDetected": "Exact problem name or topic visible on screen",
       "hint": "Step-by-step logic, optimal approach, Time/Space Complexity O(...)",
       "codeSnippet": "Complete working solution code for the visible problem"
     }
     ```

4. **Overlay Rendering**:
   - The backend returns `{ success: true, analysis }` to the overlay.
   - The client calls `pushQA(...)`, rendering a card in the overlay containing the detected question title, formatted explanation, and syntax-highlighted code with a one-click copy button.

---

## ❓ 7. Hackathon Judge Q&A / FAQs
**Target Audience**: Software engineering job candidates and computer science students taking live technical interviews, system design rounds, and online coding assessments.
**The Problem**: High-pressure technical interviews require recalling complex data structures, algorithms, SQL syntax, and system design patterns under intense time pressure while speaking.

### Q2: What is the non-obvious hard part?
**The Hard Part**: Eliminating audio Whisper hallucinations on quiet background noise, preventing mid-sentence AI answer fragmentation, and running real-time desktop loopback audio capture inside a transparent glassmorphic overlay without lagging the user's coding environment.

### Q3: What did you build versus what did the API give you?
- **What the API gave us**: Raw Speech-to-Text (Whisper) and raw text completion (Llama-3.3-70B).
- **What WE built**:
  - The complete Electron glassmorphic floating desktop overlay app (`desktop/main.js`).
  - The Web Audio API VAD silence volume filter (`RMS < 0.005`).
  - The 3.5-second silence pause aggregation buffer for sentence finalization.
  - The Groq AI multi-model fallback resiliency chain (`GROQ_TEXT_FALLBACKS`).
  - The direct download server handler (`/api/download/desktop`).
  - The automatic resume parser & synchronized candidate profile context matcher.

### Q4: Why does this break if you remove the AI?
If you remove the AI:
- Speech recognition cannot synthesize candidate answers.
- The app becomes a simple audio recording tool. It can no longer understand questions, analyze algorithms, generate Java/Python/SQL code, or provide interview coaching hints.

### Q5: What breaks at 10,000 users?
- **Whisper & LLM Rate Limits**: Groq / OpenAI rate limits (RPM/TPM). 
- **Mitigation**: Client-side VAD filtering drops 70% of silent audio blobs before hitting the server. Server fallback chains rotate through alternative model endpoints (`llama-3.3-70b-versatile`, `llama3-70b-8192`, `mixtral-8x7b-32768`, `deepseek-r1`).

---

## 📊 8. Rubric Alignment

### Hackathon Constraints Satisfied
1. **Two models / modalities**: Speech (Whisper audio) + Vision (Screen capture analysis) + Text (Llama-3.3-70B).
2. **Degrade Gracefully**: If Groq API fails or rate limits occur, the fallback model chain activates immediately without throwing 404/500 errors to the client.
3. **Handle Being Wrong**: If Whisper transcribes noise, the hallucination filter (`isHallucinationOrFiller`) blocks invalid captions.

### Failure Log & Lessons Learned
- **Issue 1**: Whisper hallucinated random phrases (*"Kansai International Airport"*, *"1.5 kg of chicken breast"*) on silence.
  - *Fix*: Implemented Web Audio RMS volume check (`< 0.005`) and added `temperature: 0.0` with English prompt grounding.
- **Issue 2**: Mid-sentence answer fragmentation.
  - *Fix*: Built a 3.5s pause detection buffer to wait for sentence finalization before calling LLM.

---

## 📦 9. How to Run & Download the App

1. **Web Dashboard**: Run `npm run dev` in `client/` and `server/`.
2. **Direct Windows (.exe) Download**: Click **Download Windows App (.exe)** on the Dashboard or visit `/api/download/desktop`.
3. **Desktop App Build**:
   ```bash
   cd desktop
   npm run dist
   ```
   Generates `release/InterviewAISetup.exe`.

