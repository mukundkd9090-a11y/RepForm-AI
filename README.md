# RepForm AI — Real-Time Biomechanics & Workout Tracking Platform

RepForm AI is an intelligent fitness tracking web application that uses computer vision (MediaPipe PoseLandmarker) to track, evaluate, and coach exercise repetitions in real time. It features a Node.js + Express backend with a resilient dual-mode database architecture (MongoDB Atlas + Embedded JSON fallback), JWT authentication, multi-exercise biomechanical form scoring, progress analytics, and a global athlete leaderboard.

---

## 🚀 Key Features

### 1. Multi-Exercise Biomechanics & Pose Tracking
* **Barbell / Bodyweight Squats**: Tracks bilateral knee angle (`calcAngleAt(HIP, KNEE, ANKLE)`), knee valgus deviation (`kneeDist < ankleDist * 0.72`), and torso forward lean.
* **Pull-Ups / Chin-Ups**: Tracks bilateral elbow flexion, full dead-hang arm extension (≥150°), chin-over-bar clearance (≤75°), and body swing/kipping detection.
* **Push-Ups (Plank to Chest)**: Tracks bilateral elbow angle, optimal chest depth (≤90°), full top lockout (≥150°), and spine-to-leg plank alignment (hip sag / pike detection).
* **Jumping Task (Jumping Jacks & Plyometrics)**: Tracks vertical hip elevation (% of frame), synchronized arm overhead reach, cadence, and knee landing shock absorption vs stiff-legged impact.

### 2. Global Athlete Leaderboard
* Real-time athlete ranking by total volume and form correctness.
* Filter by timeframe: **All Time**, **This Week**, or **Today**.
* Filter by exercise: **All Exercises**, **Squats**, **Pull-Ups**, **Push-Ups**, or **Jumping Task**.
* Top 3 podium display with Gold, Silver, and Bronze badges.
* Automatic position detection highlighting the current logged-in user's rank.

### 3. Dual-Mode Resilient Database Layer
* **MongoDB Atlas**: Connects seamlessly via standard Mongoose connection URI.
* **Resilient Embedded JSON Fallback**: If `MONGODB_URI` is not set or remote cluster is unreachable, automatically operates in local embedded store (`.data/repform_db.json`) with zero downtime.

### 4. Audio Cues & Live Biomechanical Telemetry
* Real-time canvas overlay rendering joint keypoints and skeletal connections.
* Live mini-graphs visualizing joint angles/elevation, rep scores, and running accuracy trends.
* Web Audio API synthesis oscillator providing immediate auditory confirmation on clean reps.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite 6 |
| **Styling & UI** | Tailwind CSS v4, Lucide React, Chakra Petch & Inter fonts |
| **Computer Vision** | `@mediapipe/tasks-vision` (PoseLandmarker Lite in VIDEO mode with WebGL GPU/CPU fallback) |
| **Audio** | Native Web Audio API synthesis |
| **Backend** | Node.js, Express 4, tsx dev server, esbuild |
| **Database** | Mongoose 9 (MongoDB Atlas / Embedded JSON Store fallback) |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` password hashing |

---

## 📦 Installation & Running

### Prerequisites
* Node.js v18+ (tested on Node v24)
* npm or bun

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listening port | `3000` |
| `MONGODB_URI` | MongoDB connection string (Optional: leave empty for embedded mode) | `""` |
| `JWT_SECRET` | Secret key used for signing JWT auth tokens | `repform-ai-secure-jwt-secret-key-2026` |
| `GEMINI_API_KEY` | Optional Gemini API key | `""` |

### 3. Run in Development Mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 📡 API Endpoints

### Authentication (`/api/auth`)
* `POST /api/auth/register` — Create new athlete account
* `POST /api/auth/login` — Sign in with email and password
* `POST /api/auth/demo` — 1-click instant demo login
* `GET /api/auth/me` — Get current authenticated user profile
* `PUT /api/auth/profile` — Update athlete target reps and body weight

### Workout Sessions (`/api/sessions`)
* `POST /api/sessions` — Save logged workout session with rep scores and flags
* `GET /api/sessions` — List user workout session history
* `GET /api/sessions/today` — Retrieve today's rep count, calories, and average score
* `GET /api/sessions/analytics` — Retrieve 7-day volume breakdown and lifetime stats
* `DELETE /api/sessions/:id` — Delete a workout session record

### Leaderboard (`/api/leaderboard`)
* `GET /api/leaderboard?timeframe=all|week|today&exercise=all|squat|pull_up|push_up|jump` — Global ranked athletes with current user's relative position

---

## 📐 Exercise Detection Details

| Exercise | Keypoints Tracked | Start Trigger | Rep Completion Trigger | Form Penalties |
|---|---|---|---|---|
| **Squats** | Hips, Knees, Ankles, Shoulders | Knee angle < 140° | Knee angle > 160° | Shallow depth (>100°), Knee valgus, Forward lean |
| **Pull-Ups** | Wrists, Elbows, Shoulders, Hips | Elbow angle < 135° (from dead hang) | Elbow angle > 145° (after reaching ≤75°) | Shallow pull (>75°), Incomplete lockout, Body swing/kipping |
| **Push-Ups** | Wrists, Elbows, Shoulders, Hips, Ankles | Elbow angle < 140° (from plank) | Elbow angle > 152° (after reaching ≤90°) | Shallow chest depth (>90°), Hip sag/pike (<155°), Incomplete lockout |
| **Jumping Task** | Hips, Knees, Ankles, Wrists, Shoulders | Elevation > 4.5% or Arms overhead | Return to ground baseline | Low elevation (<12%), Stiff landing (>172° knee angle) |

---

## 🔒 Security & Performance
* No private keys or database credentials committed to source control.
* MediaPipe models load once and persist across session runs.
* Real-time landmark calculations run on `requestAnimationFrame` with zero UI blocking.
