import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { runProcessing } from '../jobs/ingestionJob';
import logger from '../utils/logger';

const run = async () => {
  await connectDB();

  try {
    // Run one processing pass for up to 20 pending articles.
    const summary = await runProcessing(20);

    logger.info('--- Processing Test Summary ---');
    logger.info(`Requested limit: ${summary.requestedLimit}`);
    logger.info(`Pending found: ${summary.pendingFound}`);
    logger.info(`Processed success: ${summary.processedSuccess}`);
    logger.info(`Processed deferred: ${summary.processedDeferred}`);
    logger.info(`Processed failed: ${summary.processedFailed}`);
  } catch (error) {
    logger.error(`testProcessing failed: ${String(error)}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  }
};

void run();
