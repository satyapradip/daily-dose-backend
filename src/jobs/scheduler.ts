import cron from 'node-cron';
import { env } from '../config/env';
import { runIngestion, runProcessing } from './ingestionJob';
import logger from '../utils/logger';

const DEFAULT_INGESTION_CRON = '*/30 * * * *';
const DEFAULT_PROCESSING_CRON = '*/10 * * * *';
const DEFAULT_PROCESSING_BATCH_LIMIT = 20;

const isBackgroundJobsEnabled = (): boolean => {
  const raw = (env.ENABLE_BACKGROUND_JOBS ?? 'true').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
};

const getProcessingBatchLimit = (): number => {
  const parsed = Number(env.PROCESSING_BATCH_LIMIT ?? DEFAULT_PROCESSING_BATCH_LIMIT);

  if (Number.isNaN(parsed)) {
    return DEFAULT_PROCESSING_BATCH_LIMIT;
  }

  return Math.max(1, Math.min(100, Math.floor(parsed)));
};

const validateCronExpression = (value: string, label: string): string => {
  if (!cron.validate(value)) {
    throw new Error(`Invalid ${label} cron expression: ${value}`);
  }

  return value;
};

export const startBackgroundJobs = (): void => {
  if (!isBackgroundJobsEnabled()) {
    logger.info('Background jobs are disabled by ENABLE_BACKGROUND_JOBS');
    return;
  }

  const ingestionSchedule = validateCronExpression(
    env.INGESTION_CRON ?? DEFAULT_INGESTION_CRON,
    'INGESTION_CRON'
  );
  const processingSchedule = validateCronExpression(
    env.PROCESSING_CRON ?? DEFAULT_PROCESSING_CRON,
    'PROCESSING_CRON'
  );
  const processingLimit = getProcessingBatchLimit();

  let ingestionRunning = false;
  let processingRunning = false;

  cron.schedule(ingestionSchedule, async () => {
    if (ingestionRunning) {
      logger.warn('Ingestion job skipped because a previous run is still active');
      return;
    }

    ingestionRunning = true;
    logger.info('Scheduled ingestion job started');

    try {
      const summary = await runIngestion();
      logger.info(
        `Scheduled ingestion job finished | feeds=${summary.feedsProcessed}, fetched=${summary.feedItemsFetched}, created=${summary.articlesCreated}, duplicates=${summary.duplicatesSkipped}, scrapeFailures=${summary.scrapeFailures}, itemFailures=${summary.itemFailures}`
      );
    } catch (error) {
      logger.error(`Scheduled ingestion job failed: ${String(error)}`);
    } finally {
      ingestionRunning = false;
    }
  });

  cron.schedule(processingSchedule, async () => {
    if (processingRunning) {
      logger.warn('Processing job skipped because a previous run is still active');
      return;
    }

    processingRunning = true;
    logger.info('Scheduled processing job started');

    try {
      const summary = await runProcessing(processingLimit);
      logger.info(
        `Scheduled processing job finished | requested=${summary.requestedLimit}, pending=${summary.pendingFound}, success=${summary.processedSuccess}, deferred=${summary.processedDeferred}, failed=${summary.processedFailed}`
      );
    } catch (error) {
      logger.error(`Scheduled processing job failed: ${String(error)}`);
    } finally {
      processingRunning = false;
    }
  });

  logger.info(
    `Background jobs registered | ingestion='${ingestionSchedule}' | processing='${processingSchedule}' | processingLimit=${processingLimit}`
  );
};
