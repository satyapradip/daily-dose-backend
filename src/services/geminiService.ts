import axios from 'axios';
import { z } from 'zod';
import { env } from '../config/env';
import logger from '../utils/logger';

export interface GeminiProcessedArticle {
	summary: string;
	keyFacts: string[];
	impactLevel: 'low' | 'medium' | 'high';
}

const PREFERRED_MODEL = 'gemini-2.5-flash';
const GEMINI_MODELS = [PREFERRED_MODEL, 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const GEMINI_TIMEOUT_MS = 25000;
const MAX_BODY_CHARS = 12000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const MAX_MODEL_CANDIDATES = 4;
const MODEL_LIST_URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`;
const GEMINI_MIN_INTERVAL_MS = 2500;

let discoveredModelCache: string[] | null = null;
let lastGeminiRequestAt = 0;

// Strict schema protects DB updates from malformed AI output.
const geminiOutputSchema = z.object({
	summary: z.string().min(20).max(500),
	keyFacts: z.array(z.string().min(5).max(200)).min(3).max(5),
	impactLevel: z.enum(['low', 'medium', 'high'])
});

const buildPrompt = (title: string, body: string): string => `
You are an expert news analyst.
Return ONLY valid minified JSON with this exact shape:
{"summary":"string","keyFacts":["string"],"impactLevel":"low|medium|high"}

Rules:
- summary: 2-3 clear sentences, neutral tone.
- keyFacts: exactly 3 concise bullet-style facts.
- impactLevel: choose low, medium, or high based on likely public impact.
- Do not include markdown, backticks, or extra text.

Article title: ${title}
Article body:
${body}
`;

const isFallbackEnabled = (): boolean => {
	const raw = (env.ALLOW_HEURISTIC_AI_FALLBACK ?? 'true').toLowerCase().trim();
	return raw === '1' || raw === 'true' || raw === 'yes';
};

const splitSentences = (text: string): string[] =>
	text
		.replace(/\s+/g, ' ')
		.split(/(?<=[.!?])\s+/)
		.map((value) => value.trim())
		.filter(Boolean);

const buildHeuristicFallback = (title: string, body: string): GeminiProcessedArticle => {
	const sentences = splitSentences(body);
	const summarySentences = sentences.slice(0, 2);

	const summaryBase = summarySentences.join(' ');
	const summary =
		summaryBase.length >= 20
			? summaryBase.slice(0, 500)
			: `This article discusses ${title}. More detailed AI summary is temporarily unavailable.`;

	const keyFactsSource = sentences.length > 0 ? sentences : [`Topic: ${title}`, 'Reported as part of current news updates.', 'Readers should track further updates.'];
	const keyFacts = keyFactsSource.slice(0, 3).map((value) => value.slice(0, 200));

	const lowered = `${title} ${body}`.toLowerCase();
	const impactLevel: GeminiProcessedArticle['impactLevel'] =
		lowered.includes('war') || lowered.includes('election') || lowered.includes('crisis')
			? 'high'
			: lowered.includes('market') || lowered.includes('policy') || lowered.includes('health')
			? 'medium'
			: 'low';

	return {
		summary,
		keyFacts,
		impactLevel
	};
};

const sanitizeModelOutput = (parsed: unknown): GeminiProcessedArticle => {
	const input = (parsed ?? {}) as {
		summary?: unknown;
		keyFacts?: unknown;
		impactLevel?: unknown;
	};

	const rawSummary = typeof input.summary === 'string' ? input.summary : '';
	const summary = rawSummary.replace(/\s+/g, ' ').trim().slice(0, 500);

	const factsArray = Array.isArray(input.keyFacts) ? input.keyFacts : [];
	const normalizedFacts = factsArray
		.map((value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''))
		.filter(Boolean)
		.map((value) => value.slice(0, 200));

	const keyFacts = normalizedFacts.slice(0, 3);

	const impactLevelRaw = input.impactLevel;
	const impactLevel: GeminiProcessedArticle['impactLevel'] =
		impactLevelRaw === 'low' || impactLevelRaw === 'medium' || impactLevelRaw === 'high'
			? impactLevelRaw
			: 'medium';

	return { summary, keyFacts, impactLevel };
};

// Gemini can return plain JSON or JSON wrapped in markdown fences.
// This helper extracts a valid JSON object string from either form.
const extractJsonObject = (rawText: string): string => {
	const fencedMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
	if (fencedMatch?.[1]) {
		return fencedMatch[1].trim();
	}

	const firstBrace = rawText.indexOf('{');
	const lastBrace = rawText.lastIndexOf('}');
	if (firstBrace >= 0 && lastBrace > firstBrace) {
		return rawText.slice(firstBrace, lastBrace + 1).trim();
	}

	return rawText.trim();
};

const getGeminiTextFromResponse = (responseData: unknown): string => {
	const data = responseData as {
		candidates?: Array<{
			content?: {
				parts?: Array<{ text?: string }>;
			};
		}>;
	};

	const text = data.candidates
		?.flatMap((candidate) => candidate.content?.parts ?? [])
		.map((part) => part.text)
		.find((value): value is string => Boolean(value && value.trim()));

	if (!text) {
		throw new Error('Gemini response did not include text output');
	}

	return text;
};

const sleep = async (durationMs: number): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, durationMs));
};

const applyRequestPacing = async (): Promise<void> => {
	const now = Date.now();
	const elapsed = now - lastGeminiRequestAt;
	if (elapsed < GEMINI_MIN_INTERVAL_MS) {
		await sleep(GEMINI_MIN_INTERVAL_MS - elapsed);
	}
	lastGeminiRequestAt = Date.now();
};

const getRetryAfterMs = (error: unknown): number | null => {
	if (!axios.isAxiosError(error)) {
		return null;
	}

	const retryAfterHeader = error.response?.headers?.['retry-after'];
	if (!retryAfterHeader) {
		return null;
	}

	const raw = Array.isArray(retryAfterHeader) ? retryAfterHeader[0] : String(retryAfterHeader);
	const seconds = Number(raw);
	if (!Number.isNaN(seconds) && seconds > 0) {
		return seconds * 1000;
	}

	const retryDateMs = Date.parse(raw);
	if (!Number.isNaN(retryDateMs)) {
		const remaining = retryDateMs - Date.now();
		return remaining > 0 ? remaining : null;
	}

	return null;
};

const isRetryableError = (error: unknown): boolean => {
	if (!axios.isAxiosError(error)) {
		return false;
	}

	const status = error.response?.status;
	if (status === 429 || (status !== undefined && status >= 500)) {
		return true;
	}

	const code = error.code ?? '';
	return ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'].includes(code);
};

const calculateBackoffMs = (attempt: number): number => {
	// Exponential backoff: 500ms, 1000ms, 2000ms
	return RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
};

const discoverAvailableModels = async (): Promise<string[]> => {
	if (!env.GEMINI_API_KEY) {
		return [...GEMINI_MODELS];
	}

	if (discoveredModelCache) {
		return discoveredModelCache;
	}

	try {
		const response = await axios.get<{ models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }>(
			MODEL_LIST_URL,
			{ timeout: GEMINI_TIMEOUT_MS }
		);

		const discovered = (response.data.models ?? [])
			.filter((model) => (model.supportedGenerationMethods ?? []).includes('generateContent'))
			.map((model) => model.name?.split('/').pop() ?? '')
			.filter((name) => Boolean(name))
			.filter((name) => name.startsWith('gemini-'))
			.filter((name) => name.includes('flash'))
			.filter((name) => !name.includes('tts'))
			.filter((name) => !name.includes('image'))
			.filter((name) => !name.includes('pro'))
			.filter((name) => !name.includes('computer-use'))
			.filter((name) => !name.includes('robotics'))
			.filter((name) => !name.includes('deep-research'));

		const ordered = Array.from(
			new Set([
				...GEMINI_MODELS.filter((name) => discovered.includes(name)),
				...discovered.filter((name) => !GEMINI_MODELS.includes(name))
			])
		);

		discoveredModelCache = (ordered.length > 0 ? ordered : [...GEMINI_MODELS]).slice(0, MAX_MODEL_CANDIDATES);
		logger.info(`Discovered Gemini models: ${discoveredModelCache.join(', ')}`);
		return discoveredModelCache;
	} catch (error) {
		logger.warn(`Model discovery failed, using default model list: ${String(error)}`);
		discoveredModelCache = [...GEMINI_MODELS];
		return discoveredModelCache;
	}
};

const generateGeminiContent = async (prompt: string): Promise<unknown> => {
	const modelErrors: string[] = [];
	const candidateModels = await discoverAvailableModels();

	for (const modelName of candidateModels) {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
		let attempt = 0;

		while (attempt < MAX_RETRIES) {
			attempt += 1;
			const startedAt = Date.now();

			try {
				await applyRequestPacing();

				const response = await axios.post(
					url,
					{
						contents: [{ parts: [{ text: prompt }] }],
						generationConfig: {
							temperature: 0.2,
							responseMimeType: 'application/json'
						}
					},
					{
						timeout: GEMINI_TIMEOUT_MS,
						headers: { 'Content-Type': 'application/json' }
					}
				);

				const durationMs = Date.now() - startedAt;
				logger.info(`Gemini request succeeded with model ${modelName} on attempt ${attempt} in ${durationMs}ms`);
				return response.data;
			} catch (error) {
				const durationMs = Date.now() - startedAt;
				const retryable = isRetryableError(error);
				const status = axios.isAxiosError(error) ? error.response?.status : undefined;
				const retryAfterMs = getRetryAfterMs(error);

				logger.warn(
					`Gemini request failed | model=${modelName} | attempt=${attempt} | duration=${durationMs}ms | retryable=${retryable} | status=${status ?? 'n/a'} | retryAfterMs=${retryAfterMs ?? 'n/a'} | error=${String(error)}`
				);

				// If model is not found for this key/account, try the next model name.
				if (status === 404) {
					modelErrors.push(`${modelName}: not found (404)`);
					break;
				}

				if (!retryable || attempt >= MAX_RETRIES) {
					modelErrors.push(`${modelName}: ${String(error)}`);
					break;
				}

				await sleep(retryAfterMs ?? calculateBackoffMs(attempt));
			}
		}
	}

	throw new Error(`Gemini request failed for all models. Details: ${modelErrors.join(' | ')}`);
};

export const processArticle = async (title: string, rawBody: string): Promise<GeminiProcessedArticle> => {
	if (!env.GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY is missing in environment variables');
	}

	const trimmedTitle = title.trim();
	const trimmedBody = rawBody.trim();

	if (!trimmedTitle || !trimmedBody) {
		throw new Error('Title and rawBody are required for Gemini processing');
	}

	// Token safety: trim very long articles before sending to model.
	const boundedBody = trimmedBody.slice(0, MAX_BODY_CHARS);

	try {
		const prompt = buildPrompt(trimmedTitle, boundedBody);
		const responseData = await generateGeminiContent(prompt);

		const modelText = getGeminiTextFromResponse(responseData);
		const jsonText = extractJsonObject(modelText);
		const parsed = JSON.parse(jsonText);
		const sanitized = sanitizeModelOutput(parsed);
		const validated = geminiOutputSchema.parse(sanitized);

		logger.info(`Gemini processed article: ${trimmedTitle.slice(0, 80)}`);
		return validated;
	} catch (error) {
		if (isFallbackEnabled()) {
			logger.warn(`Gemini unavailable, using heuristic fallback: ${String(error)}`);
			return buildHeuristicFallback(trimmedTitle, boundedBody);
		}

		logger.error(`Gemini processing failed: ${String(error)}`);
		throw error;
	}
};
