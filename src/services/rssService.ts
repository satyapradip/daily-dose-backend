import Parser from 'rss-parser';
import logger from '../utils/logger';

export interface FeedArticleCandidate {
	title: string;
	url: string;
	source: string;
	category: string;
	publishedAt: Date;
}

const parser = new Parser();

// Cleans text values and avoids undefined usage.
const safeText = (value: string | undefined, fallback = ''): string => {
	if (!value) {
		return fallback;
	}

	return value.trim();
};

// Converts feed date strings into a safe Date object.
const toValidDate = (value: string | undefined): Date => {
	if (!value) {
		return new Date();
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return new Date();
	}

	return parsed;
};

// Uses feed title as source name, or falls back to feed URL hostname.
const getSourceName = (feedTitle: string | undefined, feedUrl: string): string => {
	const cleanedTitle = safeText(feedTitle);
	if (cleanedTitle) {
		return cleanedTitle;
	}

	try {
		return new URL(feedUrl).hostname;
	} catch {
		return 'Unknown Source';
	}
};

// Keeps only valid HTTP/HTTPS links.
const isValidHttpUrl = (value: string): boolean => {
	try {
		const parsed = new URL(value);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
};

export const fetchFeed = async (feedUrl: string, category: string): Promise<FeedArticleCandidate[]> => {
	try {
		const feed = await parser.parseURL(feedUrl);
		const source = getSourceName(feed.title, feedUrl);

		// Map raw RSS items into your app's clean article shape.
		const items = (feed.items ?? [])
			.map((item): FeedArticleCandidate | null => {
				const title = safeText(item.title);
				const url = safeText(item.link);

				// Skip incomplete or invalid items so ingestion stays stable.
				if (!title || !url || !isValidHttpUrl(url)) {
					return null;
				}

				return {
					title,
					url,
					source,
					category,
					publishedAt: toValidDate(item.isoDate || item.pubDate)
				};
			})
			.filter((item): item is FeedArticleCandidate => item !== null);

		logger.info(`Fetched ${items.length} RSS items from ${source}`);
		return items;
	} catch (error) {
		// Return empty array on failure so one bad feed does not break the pipeline.
		logger.error(`Failed to fetch RSS feed (${feedUrl}): ${String(error)}`);
		return [];
	}
};
