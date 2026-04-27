# QuizForge — Master AI Context Prompt

> Paste this entire document at the start of any AI conversation to give the model full context about the QuizForge project — its architecture, data models, API surface, frontend structure, design system, and deployment requirements.

---

## 1. Project Overview

**QuizForge** is a **multi-tenant, admin-controlled SaaS quiz platform** built for educational institutions (schools, colleges, training centers). It allows admins to:
- Upload MCQ question banks from PDFs
- Create quiz sessions with unique 6-character join codes
- Let students join via code without authentication
- Review student results and leaderboards

It is **not** a generic quiz builder — it follows a strict **admin creates, student joins** model.

---

## 2. Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | MongoDB Atlas (Mongoose ODM) |
| Auth | JWT (admin only) + Tenant API Key header |
| File Uploads | Multer (PDF, max 10MB) |
| PDF Parsing | pdf-parse with custom text extraction |
| Security | Helmet, express-rate-limit (200 req/15min) |
| Dev Server | Nodemon |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| HTTP Client | Axios (via src/services/api.js) |
| Styling | Vanilla CSS (custom design system, src/index.css) |
| State | React Context (AuthContext) |
| Font | Inter (Google Fonts) |

---

## 3. Repository Structure

```
quiz_maker/
├── server/
│   ├── server.js              Entry point
│   ├── .env                   Secrets (never commit)
│   ├── .env.example
│   ├── config/db.js           Mongoose connection
│   ├── middleware/
│   │   ├── auth.js            requireAuth (JWT check)
│   │   └── tenant.js          Injects req.tenantId + req.tenant
│   ├── models/
│   │   ├── Admin.js
│   │   ├── Tenant.js
│   │   ├── Question.js
│   │   ├── Quiz.js            Active quiz sessions
│   │   ├── QuizTemplate.js    Admin-created quiz configs with join codes
│   │   ├── Attempt.js         Student submission records
│   │   └── UploadJob.js       PDF upload job tracking
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── adminRoutes.js     Auth-guarded admin CRUD
│   │   └── quizRoutes.js      Public quiz routes (tenant API key only)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── adminController.js
│   │   ├── quizController.js
│   │   └── templateController.js
│   └── utils/
│       ├── pdfParser.js       PDF to MCQ extraction
│       └── shuffle.js         Fisher-Yates shuffle
│
└── client/src/
    ├── App.jsx                Router + AuthContext + Toast
    ├── index.css              Design system (CSS vars + responsive breakpoints)
    ├── contexts/AuthContext.jsx
    ├── services/api.js        All Axios calls
    └── pages/
        ├── LoginPage.jsx
        ├── admin/
        │   ├── AdminDashboard.jsx
        │   ├── UploadPDF.jsx
        │   ├── ManageQuestions.jsx
        │   └── CreateQuiz.jsx     Quiz templates + two-mode delete modal
        └── quiz/
            ├── StartQuiz.jsx      Code entry -> name -> start
            ├── QuizAttempt.jsx    Per-question SVG timer + answer lock
            ├── QuizResult.jsx     Score + correct answers expanded by default
            └── Leaderboard.jsx
```

---

## 4. Environment Variables (server/.env)

```
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/quiz_service_db
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your_strong_secret_here
```

In production set NODE_ENV=production and CORS_ORIGIN=https://your-frontend-domain.com

---

## 5. MongoDB Models

### Tenant
```
name, apiKey (unique), adminId (ref Admin)
settings: { shuffleOptions, defaultTimePerQuestion, defaultQuestionCount }
```

### Admin
```
name, email, passwordHash, tenantId
JWT issued on login, expires 7d
```

### Question
```
tenantId, question, options[4], correctAnswer,
difficulty: easy|medium|hard, category, source: pdf|manual
```

### QuizTemplate
```
tenantId, title, code (6-char unique e.g. S3H38A), createdBy (ref Admin)
questionCount, timePerQuestion (seconds), difficulty, category
maxAttempts (0 = unlimited), isActive, startsAt, endsAt, totalAttempts
```

### Quiz (Session)
```
tenantId, userId, userName
quizCode (links session to QuizTemplate for deletion)
questions[{ questionId, question, options(shuffled), correctAnswer }]
totalQuestions, timeLimit (total seconds), timePerQuestion
difficulty, category
status: in-progress|completed|expired
startedAt, expiresAt (server-authoritative anti-cheat)
```

### Attempt
```
quizId (ref Quiz), tenantId, userId, userName
answers[{ questionId, selectedAnswer, isCorrect }]
score, totalQuestions, percentage, timeTaken
startTime, submissionTime
status: submitted|timed-out
```

### UploadJob
```
tenantId, status: pending|processing|completed|failed
filename, questionsExtracted, error
```

---

## 6. API Reference (all routes prefixed /api)

### Auth (no tenant middleware)
```
POST /auth/register     Create admin + tenant
POST /auth/login        Returns JWT
GET  /auth/me           Verify JWT
```

### Admin (requires Authorization: Bearer JWT + x-api-key header)
```
POST   /admin/upload-pdf             Upload PDF, returns jobId
GET    /admin/upload-status/:jobId   Poll PDF processing
GET    /admin/questions              Paginated (?difficulty=&category=&page=&limit=)
POST   /admin/questions              Bulk save questions
PUT    /admin/questions/:id          Edit question
DELETE /admin/questions/:id          Delete one question
DELETE /admin/questions              CASCADE delete ALL tenant data
GET    /admin/stats                  Dashboard stats + recentAttempts
GET    /admin/quiz-templates         List templates
POST   /admin/quiz-templates         Create template (returns join code)
PATCH  /admin/quiz-templates/:id/toggle   Pause/Resume
DELETE /admin/quiz-templates/:id?mode=quiz-only|full   Two-mode delete
```

### Quiz / Public (requires x-api-key only, no JWT)
```
POST /quiz/join           Validate join code, return quiz config
POST /quiz/start          Create session, return questions (no answers)
GET  /quiz/session/:id    Session state + remaining time
POST /quiz/submit         Submit answers, return attemptId
GET  /quiz/result/:id     Full result with answers + correctAnswer
GET  /quiz/leaderboard    Top scores for tenant
GET  /quiz/config         Tenant default config
```

---

## 7. Authentication and Multi-Tenant Design

### Auth Flow
1. Admin registers -> Admin + Tenant records created. Tenant gets unique apiKey.
2. Admin logs in -> JWT issued containing { adminId, tenantId }.
3. All admin requests need both:
   - Authorization: Bearer jwt (verified by requireAuth middleware)
   - x-api-key: tenantApiKey (verified by tenantMiddleware)
4. Public quiz requests only need x-api-key.
5. tenantMiddleware injects req.tenantId and req.tenant into every request.
6. EVERY DB query is scoped by tenantId — complete isolation between tenants.

### Frontend Auth (AuthContext)
- On app load: calls GET /auth/me with stored JWT.
- Valid JWT -> admin role -> full nav shown.
- Invalid/missing -> student mode -> only Take Quiz + Leaderboard shown.
- apiKey stored in localStorage, added to every Axios request via interceptor.

---

## 8. Key Feature Details

### Student Quiz Flow
1. Visit /quiz -> code entry form (no login)
2. Enter 6-char code -> POST /quiz/join validates it
3. Enter name
4. POST /quiz/start creates Quiz session with quizCode stored
5. QuizAttempt.jsx:
   - Circular SVG countdown (per-question, not total)
   - Next/Submit disabled until option selected
   - Auto-advance on timeout with red flash
   - 5-second warning animation
6. POST /quiz/submit records attempt
7. Redirect to /quiz/result/:id showing score + all correct answers

### Quiz Delete Modes
DELETE /admin/quiz-templates/:id?mode=quiz-only|full

- quiz-only (default): deletes this template + Quiz sessions with matching quizCode + Attempts for those sessions
- full: deletes ALL QuizTemplates + ALL Quizzes + ALL Questions + ALL Attempts + ALL UploadJobs for tenant

### PDF Question Extraction
- Uploaded via Multer to server/uploads/
- pdf-parse extracts raw text
- Multi-strategy regex handles various MCQ formats
- Runs async; frontend polls /upload-status/:jobId
- Admin reviews before saving

### Server-Authoritative Timer
- expiresAt = now + (timePerQuestion x questionCount) stored on Quiz session
- Server validates submissionTime <= expiresAt on submit
- Client timer is UI-only, cannot extend time

### Cascade Delete All
- DELETE /admin/questions
- Clears: Question, UploadJob, QuizTemplate, Quiz, Attempt — all by tenantId
- Uses Promise.all for atomicity
- Toast shows per-collection counts

---

## 9. Frontend Design System (src/index.css)

### CSS Variables
```
--bg-primary: #0a0e1a
--bg-secondary: #111827
--bg-card: #1a1f35
--bg-input: #151b2e
--accent: #6366f1         indigo primary
--success: #22c55e
--warning: #f59e0b
--danger: #ef4444
--gradient-1: linear-gradient(135deg,#6366f1,#8b5cf6)
--font: 'Inter', system-ui
--transition: .2s cubic-bezier(.4,0,.2,1)
```

### Responsive Breakpoints
```
<= 360px  Ultra-small: compact options, smaller fonts
<= 480px  Mobile S: single-column, sheet modals, bottom toasts
<= 768px  Mobile L: 2-col stats, stacked nav, compact cards
<= 1024px Tablet: 2-col stats, reduced padding
default   Desktop: full layout
>= 1440px Large: 4-col stats, wider padding
hover:none Touch: 44px min tap targets everywhere
```

### Key CSS Classes
```
.btn .btn-primary .btn-secondary .btn-danger .btn-ghost .btn-sm .btn-lg .btn-icon
.card .card-header .card-title
.input .select .textarea .form-group .form-label
.stats-grid .stat-card .stat-value .stat-label
.table-wrapper .table
.badge .badge-easy .badge-medium .badge-hard .badge-info
.modal-overlay .modal .modal-header .modal-title
.toast-container .toast .toast-success .toast-error .toast-info
.quiz-container .question-card .options-list .option-btn .option-marker
.loading-screen .spinner .empty-state
.fade-in .slide-up
```

---

## 10. Known Patterns and Conventions

1. All controllers return { success: true/false, ... }
2. All DB queries include tenantId filter — never query without it
3. Correct answers NEVER sent to client during quiz — only in /quiz/result/:id
4. Shuffling done server-side before sending questions
5. Toast: addToast(message, 'success'|'error'|'info') passed as prop from App.jsx
6. Modal pattern: local state modalData = null | {...fields}, rendered at top of component
7. Cascade deletes: always use Promise.all([...deleteMany]) for atomicity
8. quizCode field on Quiz session: links sessions to templates for targeted deletion

---

## 11. Deployment Guide

### Option A: Railway (Recommended)

Backend:
1. Push repo to GitHub
2. New Railway project -> Deploy from GitHub -> select /server directory
3. Add all env vars, set NODE_ENV=production
4. Note generated URL e.g. https://quizforge-api.railway.app

Frontend:
1. New Railway service -> /client directory
2. Build: npm run build | Start: npx serve dist -p $PORT
3. Add VITE_API_URL=https://quizforge-api.railway.app/api

Update client/src/services/api.js:
```js
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
```

---

### Option B: Render + Vercel

Backend on Render:
- Web Service, Root: server, Start: node server.js
- Set CORS_ORIGIN=https://your-vercel-app.vercel.app

Frontend on Vercel:
```bash
cd client && vercel --prod
```
Set VITE_API_URL env var. Add client/vercel.json:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Frontend on Netlify, add client/public/_redirects:
```
/*  /index.html  200
```

---

### Option C: Docker

server/Dockerfile:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

client/Dockerfile:
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

client/nginx.conf:
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
}
```

docker-compose.yml:
```yaml
version: '3.8'
services:
  api:
    build: ./server
    ports: ["5000:5000"]
    env_file: ./server/.env
    environment:
      - NODE_ENV=production
  client:
    build:
      context: ./client
      args:
        VITE_API_URL: http://localhost:5000/api
    ports: ["80:80"]
```

---

### Pre-deployment Checklist
- JWT_SECRET is strong random string (min 32 chars)
- MONGODB_URI points to Atlas with IP 0.0.0.0/0 whitelisted (cloud deploy)
- CORS_ORIGIN matches exact frontend URL (no trailing slash)
- NODE_ENV=production set
- api.js uses VITE_API_URL env var
- Test GET /api/health returns { status: "ok" }
- MongoDB Atlas: ensure indexes on tenantId, quizCode, expiresAt fields

---

## 12. Pending / Suggested Next Features

| Feature | Complexity | Notes |
|---|---|---|
| Deep-link join (/quiz?code=XXXXXX) | Low | Read URL param in StartQuiz, auto-fill code |
| Result analytics per quiz template | Medium | Aggregate Attempts by quizCode |
| Re-attempt cooldown | Low | Check last attempt timestamp in /quiz/join |
| Quiz scheduling UI | Low | startsAt/endsAt already in model |
| Email result to student | Medium | Nodemailer + student email field |
| Export leaderboard CSV | Low | Server-side CSV generation |
| Bulk question edit | Medium | Editable table in ManageQuestions |

---

## 13. Common Debugging

| Symptom | Cause | Fix |
|---|---|---|
| 401 on admin routes | Expired JWT | Re-login, check Authorization header |
| 403 on quiz routes | Missing x-api-key | Ensure tenant apiKey in localStorage |
| Questions not appearing | Wrong tenantId | Check x-api-key matches tenant |
| PDF extraction returns 0 | Unsupported format | Check pdfParser.js regex patterns |
| Timer mismatch | Client clock drift | All timing server-side via expiresAt |
| Delete not removing attempts | quizCode was null (old sessions) | Pre-date sessions; manually clear if needed |
| CORS error in production | CORS_ORIGIN mismatch | Exact URL, no trailing slash |
