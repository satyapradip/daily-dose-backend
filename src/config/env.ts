import { z } from 'zod';
import dotenv  from 'dotenv';

dotenv.config(); // Load environment variables from .env file
// Define a schema for environment variables using Zod
const envSchema = z.object({
  PORT: z.string().default('3000'),
  MONGO_URI: z.string().describe('MONGO_URI is required'),
  MONGO_URI_DIRECT: z.string().optional(),
  DNS_SERVERS: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  ALLOW_HEURISTIC_AI_FALLBACK: z.string().optional(),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  ENABLE_BACKGROUND_JOBS: z.string().optional(),
  INGESTION_CRON: z.string().optional(),
  PROCESSING_CRON: z.string().optional(),
  PROCESSING_BATCH_LIMIT: z.string().optional(),
  CLEANUP_CRON: z.string().optional(),
  CLEANUP_RETENTION_DAYS: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env); // Validate and parse environment variables

if (!parsed.success) {
  console.error('Environment variable validation failed:', parsed.error.format());
  process.exit(1); // Exit the application if validation fails
}

export const env = parsed.data