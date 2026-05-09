# Daily Dose Backend

A production-minded TypeScript and Express backend that powers a personalized, swipe-based news experience.

It handles:
- device-based user onboarding (no full auth flow required)
- preference capture and personalization
- RSS ingestion and web scraping
- AI enrichment (summary, key facts, impact level)
- feed delivery, swipe learning, and bookmarks
- scheduled ingestion, processing, and cleanup jobs

## Highlights

- Personalization loop based on category weights and swipe feedback
- Clean API response contract: success or error envelope
- Input validation with Zod at controller boundaries
- Rate limiting and security middleware enabled by default
- Background jobs with cron schedules and overlap protection
- MongoDB SRV fallback support for DNS-related deployment issues

## Tech Stack

- Node.js + TypeScript
- Express 5
- MongoDB + Mongoose
- Zod
- RSS Parser + Cheerio + Axios
- Gemini API (with safe fallback behavior)
- Unsplash API
- node-cron

## Project Structure

```text
src/
  app.ts                 # Express app, middleware, routes
  server.ts              # App bootstrap and DB startup
  config/
    db.ts                # MongoDB connection + SRV fallback logic
    env.ts               # Environment schema validation
  controllers/           # Request validation + response shaping
  services/              # Business logic
  jobs/                  # Scheduled ingestion/processing/cleanup
  models/                # Mongoose models
  routes/                # API route declarations
  scripts/               # One-off test/diagnostic scripts
  utils/                 # Logger, API helpers, hashing
```

## API Overview

Base URL (local):
- http://localhost:3000

Health:
- GET /

Users:
- POST /api/users/register
- GET /api/users/:deviceId
- POST /api/users/:deviceId/bookmarks/:articleId
- DELETE /api/users/:deviceId/bookmarks/:articleId

Preferences:
- GET /api/preferences/categories
- GET /api/preferences/:deviceId
- PUT /api/preferences/:deviceId

News:
- GET /api/news/feed/:deviceId?page=1
- POST /api/news/swipe/:deviceId
- GET /api/news/:articleId

### Response Shape

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": "error message"
}
```

## Feed Personalization Logic

The feed service ranks ready articles by:
1. category preference weight (higher first)
2. recency (newer first)

When a user swipes:
- like: category weight increases by +0.2
- dislike: category weight decreases by -0.2
- bounds are enforced between 0.1 and 5.0
- only one swipe entry per article is retained

Default feed page size: 20

## Background Jobs

Background jobs start automatically when the server starts (unless disabled).

Jobs:
- Ingestion: fetch RSS items, scrape body, store pending articles
- Processing: enrich pending articles with AI summary, key facts, impact level, and image
- Cleanup: delete stale articles older than configured retention

Each scheduled job is protected against overlapping executions.

## Environment Variables

Create a .env file in the project root.

Required:
- MONGO_URI

Optional:
- PORT (default: 3000)
- MONGO_URI_DIRECT (fallback URI when SRV lookup fails)
- DNS_SERVERS (comma-separated DNS resolvers)
- GEMINI_API_KEY
- ALLOW_HEURISTIC_AI_FALLBACK (true/false, default true behavior)
- UNSPLASH_ACCESS_KEY
- ENABLE_BACKGROUND_JOBS (true/false)
- INGESTION_CRON (default: */30 * * * *)
- PROCESSING_CRON (default: */10 * * * *)
- PROCESSING_BATCH_LIMIT (default: 20, min 1, max 100)
- CLEANUP_CRON (default: 0 3 * * *)
- CLEANUP_RETENTION_DAYS (default: 7)

A starter template exists in .env.example.

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

On macOS/Linux:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then update values in .env.

### 3) Run in development

```bash
npm run dev
```

### 4) Build and run production bundle

```bash
npm run build
npm start
```

## NPM Scripts

- npm run dev
  - Run server with hot reload via ts-node-dev
- npm run build
  - Compile TypeScript to dist/
- npm start
  - Run compiled server from dist/
- npm run test:ingestion
  - Build and run one ingestion cycle test script
- npm run test:processing
  - Build and run one processing cycle test script
- npm run test:gemini
  - Build and verify Gemini integration path

## Supported Categories

- technology
- politics
- sports
- business
- science
- health
- entertainment
- world

## Operational Notes

- Global rate limit is applied across the API; news endpoints have stricter limits.
- The app trusts one proxy hop for accurate client IP handling in hosted environments.
- If Gemini is unavailable and fallback is enabled, the service returns heuristic summaries to keep processing resilient.

## Troubleshooting

### MongoDB SRV/DNS issues

If you see SRV lookup errors:
1. set DNS_SERVERS in .env (for example: 8.8.8.8,1.1.1.1)
2. set MONGO_URI_DIRECT as a direct fallback URI
3. restart the server

### Empty feed results

Check that:
- ingestion has created pending articles
- processing has converted pending articles to ready
- user has a valid deviceId and preferences set

## Documentation and Roadmap

- Implementation roadmap: ROADMAP.md
- API testing guide: testApi.md

## License

ISC
