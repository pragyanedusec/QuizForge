# QuizForge — Quiz-as-a-Service Platform

A scalable, multi-tenant quiz platform built with React, Node.js, Express, and MongoDB.

## Features

- **PDF Upload & Extraction** — Upload MCQ PDFs and auto-extract questions
- **Manual Review** — Edit extracted questions before saving
- **Randomized Quizzes** — Each user gets unique question sets via MongoDB `$sample`
- **Timer System** — Configurable countdown with auto-submit
- **Multi-Tenant** — All data scoped by `tenantId`
- **Leaderboard** — Track top performers
- **Admin Dashboard** — Stats, question management, and PDF uploads

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Start Backend
```bash
cd server
cp .env.example .env    # Edit MongoDB URI if needed
npm install
npm run dev
```

### 2. Start Frontend
```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/upload-pdf` | Upload & parse PDF |
| GET | `/api/admin/questions` | List questions |
| POST | `/api/admin/questions` | Save questions |
| PUT | `/api/admin/questions/:id` | Update question |
| DELETE | `/api/admin/questions/:id` | Delete question |
| GET | `/api/admin/stats` | Dashboard stats |
| POST | `/api/quiz/start` | Start randomized quiz |
| POST | `/api/quiz/submit` | Submit answers |
| GET | `/api/quiz/result/:id` | Get result |
| GET | `/api/quiz/leaderboard` | Leaderboard |
| GET | `/api/quiz/config` | Quiz configuration |

All endpoints require `x-tenant-id` header (defaults to `default`).

## Architecture

```
client/          → React + Vite frontend
server/          → Express + MongoDB backend
  ├── models/    → Mongoose schemas
  ├── controllers/ → Business logic
  ├── routes/    → Express routes
  ├── middleware/ → Tenant middleware
  └── utils/     → PDF parser, shuffle
```
