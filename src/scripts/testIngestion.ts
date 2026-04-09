import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { runIngestion } from '../jobs/ingestionJob';
import logger from '../utils/logger';
import Article from '../models/Article';

const run = async () => {
	// Why we connect first:
	// ingestion reads and writes Article documents, so DB must be available.
	await connectDB();

	try {
		// Why this function is useful for beginners:
		// it runs exactly one ingestion cycle and gives a clear summary of results.
		const summary = await runIngestion();

		logger.info('--- Ingestion Test Summary ---');
		logger.info(`Feeds processed: ${summary.feedsProcessed}`);
		logger.info(`Feed items fetched: ${summary.feedItemsFetched}`);
		logger.info(`Articles created: ${summary.articlesCreated}`);
		logger.info(`Duplicates skipped: ${summary.duplicatesSkipped}`);
		logger.info(`Scrape failures: ${summary.scrapeFailures}`);
		logger.info(`Item failures: ${summary.itemFailures}`);

		try {
			const sampleArticles = await Article.find({ status: 'pending' })
				.sort({ createdAt: -1 })
				.limit(3)
				.select('title source rawBody');

			if (sampleArticles.length > 0) {
				logger.info('--- Sample Pending Article Snippets ---');
				for (const article of sampleArticles) {
					const snippet = article.rawBody.replace(/\s+/g, ' ').slice(0, 180);
					logger.info(`[${article.source}] ${article.title}`);
					logger.info(`Snippet: ${snippet}${article.rawBody.length > 180 ? '...' : ''}`);
				}
			}
		} catch (error) {
			logger.warn(`Could not load snippet preview: ${String(error)}`);
		}
	} catch (error) {
		logger.error(`testIngestion failed: ${String(error)}`);
		process.exitCode = 1;
	} finally {
		// Always close DB connection so this script exits cleanly.
		await mongoose.disconnect();
		logger.info('MongoDB connection closed');
	}
};

void run();
