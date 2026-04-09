# Daily Dose Backend - Refined Implementation Roadmap

> Keep this file open while building.
> Work top-to-bottom and do not move ahead if a test fails.

---

## How to Use This Roadmap

- Build phase by phase. Avoid jumping ahead.
- Every phase has a Definition of Done and Test Checkpoint.
- Keep API contracts stable once a phase is marked done.
- Update this file only after tests pass.

---

## Professional Refinement Layer (Applies to Every Phase)

### 1) API Contract Discipline
- Route path, method, params, and response shape must match roadmap exactly.
- If API changes, update roadmap and frontend docs in the same commit.

### 2) Validation First
- Validate req.params, req.query, req.body at controller boundary using zod.
- Return 400 for invalid input with a clear message.

### 3) Error Code Standards
- 200: Success read/update
- 201: Resource created
- 400: Invalid input
- 404: Resource not found
- 409: Conflict (duplicate)
- 500: Unexpected server error

### 4) Service Layer Rules
- Services contain business logic only.
- Controllers should be thin: parse -> call service -> send response.

### 5) Logging and Observability
- Log startup, DB connection, job starts/ends, and errors with context.
- Keep logs short and meaningful.

### 6) Testing Gate
- Do not mark a phase complete unless all listed tests pass.
- Run TypeScript build after every major change.

### 7) Beginner-Friendly Coding Style
- Add short comments only where logic is not obvious.
- Prefer small functions with readable names.
- Avoid clever code that is hard to debug.

---

## Project Stack

- TypeScript + Node.js
- Express
- MongoDB Atlas + Mongoose
- Zod
- RSS Parser + Cheerio
- Gemini 1.5 Flash
- Unsplash API
- node-cron

---

## Current Status

- [x] Phase 1 - Foundation (complete)
- [x] Phase 2 - User system (completed)
- [x] Phase 3 - News ingestion (completed)
- [x] Phase 4 - AI processing (completed)
- [ ] Phase 5 - News delivery (in progress: Step 1 feed service implemented)
- [ ] Phase 6 - Polish and deploy

---

# PHASE 1 - Foundation

## Completed
- Server startup flow
- MongoDB connection
- Environment loading and validation
- API response helper
- Global error handler

## Definition of Done
- App boots locally
- DB connects successfully
- Root health route responds

---

# PHASE 2 - User System

> Goal: Register a device, store preferences, manage bookmarks.

## Scope Files
- src/models/User.ts
- src/services/userService.ts
- src/controllers/userController.ts
- src/routes/userRoutes.ts
- src/services/preferenceService.ts
- src/controllers/preferenceController.ts
- src/routes/preferenceRoutes.ts
- src/app.ts

## Required Routes (Contract)
- POST /api/users/register
- GET /api/users/:deviceId
- POST /api/users/:deviceId/bookmarks/:articleId
- DELETE /api/users/:deviceId/bookmarks/:articleId
- GET /api/preferences/categories
- GET /api/preferences/:deviceId
- PUT /api/preferences/:deviceId

## Data Rules
- deviceId is UUID
- articleId is Mongo ObjectId
- categories must be from:
  - technology
  - politics
  - sports
  - business
  - science
  - health
  - entertainment
  - world
- setPreferences initializes categoryWeights to 1.0 for selected categories

## Definition of Done
- All routes above are mounted and reachable.
- Validation exists for params and body.
- Proper status codes are returned.

## Test Checkpoint (Run in Postman)

### Test 1: Register Device
POST http://localhost:3000/api/users/register

Expected:
{
  "success": true,
  "data": {
    "deviceId": "uuid-value"
  }
}

### Test 2: Save Preferences
PUT http://localhost:3000/api/preferences/YOUR_DEVICE_ID
Body:
{
  "categories": ["technology", "sports", "world"]
}

Expected:
{
  "success": true,
  "data": {
    "message": "Preferences saved"
  }
}

### Test 3: Verify User Profile
GET http://localhost:3000/api/users/YOUR_DEVICE_ID

Expected:
- user exists
- preferences.categories populated
- preferences.categoryWeights has selected categories at 1.0

---
# ---------------Phase2 completed ✅👋--------------
# PHASE 3 - News Ingestion (RSS + Scraping)

> Goal: Fetch RSS news, scrape body text, save pending articles.

## Install
npm install rss-parser cheerio axios
npm install -D @types/cheerio

## Build Tasks
- Create Article model with all roadmap fields
- Add URL hash utility (sha256)
- Build rssService.fetchFeed(url)
- Build scraperService.scrapeArticle(url)
- Add script testIngestion.ts
- Save/upsert pending articles in DB

## Definition of Done
- testIngestion logs real article snippets
- articles collection contains pending records with rawBody

---

# PHASE 4 - AI Processing (Gemini + Images)

> Goal: Process pending articles into ready cards.

## Install
npm install @google/generative-ai node-cron
npm install -D @types/node-cron

## Build Tasks
- Implement geminiService.processArticle(title, body)
- Implement imageService.getImage(prompt)
- Build ingestion job orchestration with per-article try/catch
- Register cron in server.ts

## Definition of Done
- pending articles become ready
- summary, keyFacts, impactLevel, imageUrl are filled
- failed items are marked failed with processingError

---

# PHASE 5 - News Delivery

> Goal: Personalized feed and swipe learning.

## Install
npm install express-rate-limit
npm install -D @types/express-rate-limit

## Build Tasks
- Build newsService.getFeed(deviceId, page)
- Build newsService.recordSwipe(deviceId, articleId, action)
- Build newsService.getArticleById(articleId)
- Implement controllers/routes for feed, swipe, article detail
- Add cleanup job for articles older than 7 days
- Add rate limiting on /api/news

## Definition of Done
- Feed returns 20 card objects
- Swipe updates categoryWeights and swipeHistory
- Swiped article does not reappear in feed

---

# PHASE 6 - Polish and Deploy

> Goal: Secure, stable deployment.

## Install
npm install helmet cors
npm install -D @types/helmet @types/cors

## Build Tasks
- Add helmet middleware
- Add cors middleware
- Deploy to Railway
- Move all env values to Railway Variables
- Re-test all endpoints on deployed URL

## Definition of Done
- Production URL is live
- No secrets in repository
- End-to-end tests pass on hosted API

---

## API Quick Reference

### User
- POST /api/users/register
- GET /api/users/:deviceId
- POST /api/users/:deviceId/bookmarks/:articleId
- DELETE /api/users/:deviceId/bookmarks/:articleId

### Preferences
- GET /api/preferences/categories
- GET /api/preferences/:deviceId
- PUT /api/preferences/:deviceId

### News
- GET /api/news/feed/:deviceId
- POST /api/news/swipe/:deviceId
- GET /api/news/:articleId

---

## Notes for Beginner Implementation

- Keep one concern per file (model, service, controller, route).
- If stuck, first test service functions directly, then test routes.
- Prefer incremental commits after each passing checkpoint.

---

Last updated: Phase 5 Step 1 completed with weighted feed service and pagination; next is swipe recording and API wiring.
