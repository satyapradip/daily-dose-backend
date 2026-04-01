import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/logger';

const REQUEST_TIMEOUT_MS = 12000;

// Converts noisy text into a cleaner single-space paragraph.
const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

// Picks the first selector that has meaningful content.
const pickBestContent = ($: ReturnType<typeof cheerio.load>): string => {
	const contentSelectors = [
		'article',
		'main article',
		'main',
		'[role="main"]',
		'.article-body',
		'.post-content',
		'.entry-content'
	];

	for (const selector of contentSelectors) {
		const text = normalizeText($(selector).first().text());
		if (text.length >= 200) {
			return text;
		}
	}

	// Fallback to full body text when article-specific selectors are unavailable.
	return normalizeText($('body').text());
};

export const scrapeArticle = async (url: string): Promise<string> => {
	try {
		const response = await axios.get<string>(url, {
			timeout: REQUEST_TIMEOUT_MS,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
			}
		});

		const $ = cheerio.load(response.data);

		// Remove non-content elements so output is cleaner for AI summarization.
		$('script, style, noscript, iframe, svg, form, nav, footer, header, aside').remove();

		const articleText = pickBestContent($);
		if (!articleText) {
			logger.warn(`Scraper returned empty content for: ${url}`);
			return '';
		}

		logger.info(`Scraped article content (${articleText.length} chars) from ${url}`);
		return articleText;
	} catch (error) {
		logger.error(`Failed to scrape article (${url}): ${String(error)}`);
		return '';
	}
};
