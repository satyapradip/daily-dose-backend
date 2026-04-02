import Article from '../models/Article';
import { fetchFeed } from '../services/rssService';
import { scrapeArticle } from '../services/scraperService';
import { hashUrl } from '../utils/hashUrl';  // Centralized URL normalization and hashing for consistent deduplication.
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
