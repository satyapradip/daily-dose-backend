import Article from '../models/Article';
import { fetchFeed } from '../services/rssService';
import { scrapeArticle } from '../services/scraperService';
import { hashUrl } from '../utils/hashUrl';  // Centralized URL normalization and hashing for consistent deduplication.
import { processArticle } from '../services/geminiService';
import { getImage } from '../services/imageService';
import logger from '../utils/logger';  // Centralized logging for better observability of the ingestion process.

export interface FeedSource {
	category: string;
	url: string;
}

export interface IngestionSummary {
	feedsProcessed: number;
	feedItemsFetched: number;
	articlesCreated: number;
	duplicatesSkipped: number;
	scrapeFailures: number;
	itemFailures: number;
}

export interface ProcessingSummary {
	requestedLimit: number;
	pendingFound: number;
	processedSuccess: number;
	processedFailed: number;
	processedDeferred: number;
}

const isTemporaryProcessingError = (error: unknown): boolean => {
	const message = String(error).toLowerCase();

	return (
		message.includes('429') ||
		message.includes('rate limit') ||
		message.includes('quota') ||
		message.includes('econnaborted') ||
		message.includes('etimedout') ||
		message.includes('econnreset') ||
		message.includes('enotfound')
	);
};

// Starter feed list for local development.
// Why this array exists:
// - We need a predictable set of RSS endpoints to test ingestion end-to-end.
// - Each feed is tagged with a category so downstream personalization can use it.
export const DEFAULT_FEED_SOURCES: FeedSource[] = [
	{ category: 'technology', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
	{ category: 'business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
	{ category: 'sports', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
	{ category: 'science', url: 'https://www.sciencedaily.com/rss/top/science.xml' },
	{ category: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }
];

// Runs one full ingestion cycle:
// 1) Pull RSS items.
// 2) Skip duplicates using urlHash.
// 3) Scrape article body.
// 4) Save as pending records for the AI processing phase.
export const runIngestion = async (
	feedSources: FeedSource[] = DEFAULT_FEED_SOURCES
): Promise<IngestionSummary> => {
	const summary: IngestionSummary = {
		feedsProcessed: 0,
		feedItemsFetched: 0,
		articlesCreated: 0,
		duplicatesSkipped: 0,
		scrapeFailures: 0,
		itemFailures: 0
	};

	logger.info(`Ingestion started for ${feedSources.length} feed sources`);

	for (const source of feedSources) {
		// Feed-level failure should not stop the whole batch.
		// fetchFeed already catches internal failures and returns [] when needed.
		const feedItems = await fetchFeed(source.url, source.category);

		summary.feedsProcessed += 1;
		summary.feedItemsFetched += feedItems.length;

		// Item-level isolation keeps the pipeline resilient.
		// If one URL is broken, we continue with remaining items.
		for (const item of feedItems) {
			try {
				const urlHash = hashUrl(item.url);

				// Dedupe check before scraping:
				// if already stored, skip expensive HTTP + parsing work.
				const existingArticle = await Article.exists({ urlHash });
				if (existingArticle) {
					summary.duplicatesSkipped += 1;
					continue;
				}

				const rawBody = await scrapeArticle(item.url);
				if (!rawBody) {
					summary.scrapeFailures += 1;
					continue;
				}

				await Article.create({
					title: item.title,
					source: item.source,
					category: item.category,
					url: item.url,
					urlHash,
					rawBody,
					status: 'pending',
					publishedAt: item.publishedAt
				});

				summary.articlesCreated += 1;
			} catch (error) {
				summary.itemFailures += 1;
				logger.error(`Ingestion item failed (${item.url}): ${String(error)}`);
			}
		}
	}

	logger.info(
		`Ingestion finished | feeds=${summary.feedsProcessed}, fetched=${summary.feedItemsFetched}, created=${summary.articlesCreated}, duplicates=${summary.duplicatesSkipped}, scrapeFailures=${summary.scrapeFailures}, itemFailures=${summary.itemFailures}`
	);

	return summary;
};

// Converts pending articles into ready cards by enriching with:
// 1) Gemini summary + key facts + impact level
// 2) Image URL from Unsplash
// Failed items are marked as failed with a processingError for traceability.
export const runProcessing = async (limit = 20): Promise<ProcessingSummary> => {
	const cappedLimit = Math.max(1, Math.min(limit, 100));

	const summary: ProcessingSummary = {
		requestedLimit: cappedLimit,
		pendingFound: 0,
		processedSuccess: 0,
		processedFailed: 0,
		processedDeferred: 0
	};

	const pendingArticles = await Article.find({ status: 'pending' })
		.sort({ createdAt: 1 })
		.limit(cappedLimit);

	summary.pendingFound = pendingArticles.length;
	logger.info(`Processing started for ${summary.pendingFound} pending articles`);

	for (const article of pendingArticles) {
		try {
			if (!article.rawBody?.trim()) {
				throw new Error('rawBody is empty; cannot process article');
			}

			const aiResult = await processArticle(article.title, article.rawBody);
			const imageQuery = `${article.category} ${article.title}`;
			const imageUrl = await getImage(imageQuery);

			article.summary = aiResult.summary;
			article.keyFacts = aiResult.keyFacts;
			article.impactLevel = aiResult.impactLevel;
			article.imageUrl = imageUrl;
			article.processingError = undefined;
			article.status = 'ready';

			await article.save();
			summary.processedSuccess += 1;
		} catch (error) {
			const temporary = isTemporaryProcessingError(error);

			article.status = temporary ? 'pending' : 'failed';
			article.processingError = String(error);
			await article.save();

			if (temporary) {
				summary.processedDeferred += 1;
				logger.warn(`Processing deferred for article ${article._id}: ${String(error)}`);
			} else {
				summary.processedFailed += 1;
				logger.error(`Processing failed for article ${article._id}: ${String(error)}`);
			}
		}
	}

	logger.info(
		`Processing finished | requested=${summary.requestedLimit}, pending=${summary.pendingFound}, success=${summary.processedSuccess}, deferred=${summary.processedDeferred}, failed=${summary.processedFailed}`
	);

	return summary;
};
