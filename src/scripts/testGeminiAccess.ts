import { processArticle } from '../services/geminiService';
import logger from '../utils/logger';

const SAMPLE_TITLE = 'Global market update from major economies';
const SAMPLE_BODY = `
Global equity markets showed mixed movement today as investors reacted to inflation data,
central bank commentary, and energy price fluctuations. Analysts highlighted ongoing uncertainty
around interest rate policy, while some sectors outperformed due to stronger earnings guidance.
`;

const run = async () => {
  try {
    const result = await processArticle(SAMPLE_TITLE, SAMPLE_BODY);

    logger.info('--- Gemini Access Test Summary ---');
    logger.info(`Summary length: ${result.summary.length}`);
    logger.info(`Key facts count: ${result.keyFacts.length}`);
    logger.info(`Impact level: ${result.impactLevel}`);
    logger.info('Gemini access test completed successfully');
  } catch (error) {
    logger.error(`Gemini access test failed: ${String(error)}`);
    process.exitCode = 1;
  }
};

void run();
