# PrepAI - AI Interview & Coding Preparation Platform

PrepAI is a full-stack, monorepo platform designed to help candidates practice interviews, audit resumes against Job Descriptions, solve algorithm tasks using an integrated code sandbox editor, practice STAR behavioral questions, and review detailed grading reports.

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
*Port mapping: API starts listening on port `5000`.*

### 2. Frontend Client Setup
Install dependencies and initiate the client development server:
```bash
cd ../client
npm install
npm run dev
```
*Port mapping: Client dashboard mounts on port `5173`.*

### 3. System Admin Dashboard Setup
Install dependencies and run the admin control dashboard:
```bash
cd ../admin
npm install
npm run dev
```
*Port mapping: Admin panel starts on port `5174`.*

### 4. Desktop Client Launch (Electron)
To boot PrepAI inside the desktop shell frame:
```bash
cd ../desktop
npm install
npm run electron
```
*Make sure client port `5173` is running locally to preview modifications in real-time inside the shell.*

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
This generates: `/desktop/release/InterviewAISetup.exe`.

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

1. **Download**: Obtain the compiled `InterviewAISetup.exe` from the target distribution server.
2. **Execute**: Double-click `InterviewAISetup.exe` to trigger NSIS installation.
3. **Accept**: Approve license arrangements and select target folder paths (creates Desktop & Start menu shortcuts automatically).
4. **Launch**: Launch PrepAI from shortcuts.
5. **Practice**: Set up candidate profiles, sync PDF resumes, start mock voice interviews, and solve algorithm sheets!
