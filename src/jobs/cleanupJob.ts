import Article from '../models/Article';
import logger from '../utils/logger';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 7;

export interface CleanupSummary {
	retentionDays: number;
	cutoffDate: Date;
	matchedCount: number;
	deletedCount: number;
	dryRun: boolean;
}

const normalizeRetentionDays = (retentionDays: number): number => {
	if (!Number.isFinite(retentionDays)) {
		return DEFAULT_RETENTION_DAYS;
	}

	return Math.max(1, Math.floor(retentionDays));
};

export const runCleanup = async (
	retentionDays = DEFAULT_RETENTION_DAYS,
	dryRun = false
): Promise<CleanupSummary> => {
	const normalizedDays = normalizeRetentionDays(retentionDays);
	const cutoffDate = new Date(Date.now() - normalizedDays * DAY_IN_MS);

	const filter = { createdAt: { $lt: cutoffDate } };
	const matchedCount = await Article.countDocuments(filter);

	if (dryRun) {
		logger.info(
			`Cleanup dry-run | retentionDays=${normalizedDays}, cutoff=${cutoffDate.toISOString()}, matched=${matchedCount}`
		);

		return {
			retentionDays: normalizedDays,
			cutoffDate,
			matchedCount,
			deletedCount: 0,
			dryRun: true
		};
	}

	const deletionResult = await Article.deleteMany(filter);
	const deletedCount = deletionResult.deletedCount ?? 0;

	logger.info(
		`Cleanup finished | retentionDays=${normalizedDays}, cutoff=${cutoffDate.toISOString()}, matched=${matchedCount}, deleted=${deletedCount}`
	);

	return {
		retentionDays: normalizedDays,
		cutoffDate,
		matchedCount,
		deletedCount,
		dryRun: false
	};
};
