import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';

const UNSPLASH_SEARCH_URL = 'https://api.unsplash.com/search/photos';
const UNSPLASH_TIMEOUT_MS = 12000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 400;

const buildFallbackImageUrl = (query: string): string => {
	// Source endpoint gives a deterministic, license-safe fallback image by query.
	return `https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}`;
};

const sleep = async (durationMs: number): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, durationMs));
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

const calculateBackoffMs = (attempt: number): number => RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);

const cleanQuery = (query: string): string => {
	const value = query.trim().replace(/\s+/g, ' ');
	return value || 'news';
};

export const getImage = async (query: string): Promise<string> => {
	const normalizedQuery = cleanQuery(query);

	if (!env.UNSPLASH_ACCESS_KEY) {
		logger.warn('UNSPLASH_ACCESS_KEY missing. Using fallback image URL.');
		return buildFallbackImageUrl(normalizedQuery);
	}

	let attempt = 0;

	while (attempt < MAX_RETRIES) {
		attempt += 1;
		const startedAt = Date.now();

		try {
			const response = await axios.get<{
				results?: Array<{ urls?: { regular?: string; full?: string } }>;
			}>(UNSPLASH_SEARCH_URL, {
				timeout: UNSPLASH_TIMEOUT_MS,
				headers: {
					Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`
				},
				params: {
					query: normalizedQuery,
					orientation: 'landscape',
					per_page: 1,
					content_filter: 'high'
				}
			});

			const imageUrl = response.data.results?.[0]?.urls?.regular ?? response.data.results?.[0]?.urls?.full;
			const durationMs = Date.now() - startedAt;

			if (imageUrl) {
				logger.info(`Unsplash image fetched on attempt ${attempt} in ${durationMs}ms`);
				return imageUrl;
			}

			logger.warn(`Unsplash returned no images for query: ${normalizedQuery}`);
			return buildFallbackImageUrl(normalizedQuery);
		} catch (error) {
			const durationMs = Date.now() - startedAt;
			const retryable = isRetryableError(error);

			logger.warn(
				`Unsplash request failed on attempt ${attempt} in ${durationMs}ms | retryable=${retryable} | error=${String(error)}`
			);

			if (!retryable || attempt >= MAX_RETRIES) {
				logger.warn(`Using fallback image for query: ${normalizedQuery}`);
				return buildFallbackImageUrl(normalizedQuery);
			}

			await sleep(calculateBackoffMs(attempt));
		}
	}

	return buildFallbackImageUrl(normalizedQuery);
};
