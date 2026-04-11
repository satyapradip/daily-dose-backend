import cron from 'node-cron';
import { env } from '../config/env';
import { runIngestion, runProcessing } from './ingestionJob';
import { runCleanup } from './cleanupJob';
import logger from '../utils/logger';

const DEFAULT_INGESTION_CRON = '*/30 * * * *';
const DEFAULT_PROCESSING_CRON = '*/10 * * * *';
const DEFAULT_CLEANUP_CRON = '0 3 * * *';
const DEFAULT_PROCESSING_BATCH_LIMIT = 20;
const DEFAULT_CLEANUP_RETENTION_DAYS = 7;

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

const getCleanupRetentionDays = (): number => {
  const parsed = Number(env.CLEANUP_RETENTION_DAYS ?? DEFAULT_CLEANUP_RETENTION_DAYS);

  if (Number.isNaN(parsed)) {
    return DEFAULT_CLEANUP_RETENTION_DAYS;
  }

  return Math.max(1, Math.floor(parsed));
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
  const cleanupSchedule = validateCronExpression(
    env.CLEANUP_CRON ?? DEFAULT_CLEANUP_CRON,
    'CLEANUP_CRON'
  );
  const processingLimit = getProcessingBatchLimit();
  const cleanupRetentionDays = getCleanupRetentionDays();

  let ingestionRunning = false;
  let processingRunning = false;
  let cleanupRunning = false;

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

  cron.schedule(cleanupSchedule, async () => {
    if (cleanupRunning) {
      logger.warn('Cleanup job skipped because a previous run is still active');
      return;
    }

    cleanupRunning = true;
    logger.info('Scheduled cleanup job started');

    try {
      const summary = await runCleanup(cleanupRetentionDays);
      logger.info(
        `Scheduled cleanup job finished | retentionDays=${summary.retentionDays}, matched=${summary.matchedCount}, deleted=${summary.deletedCount}`
      );
    } catch (error) {
      logger.error(`Scheduled cleanup job failed: ${String(error)}`);
    } finally {
      cleanupRunning = false;
    }
  });

  logger.info(
    `Background jobs registered | ingestion='${ingestionSchedule}' | processing='${processingSchedule}' | cleanup='${cleanupSchedule}' | processingLimit=${processingLimit} | cleanupRetentionDays=${cleanupRetentionDays}`
  );
};
