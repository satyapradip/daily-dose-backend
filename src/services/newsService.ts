import mongoose from 'mongoose';
import Article from '../models/Article';
import User from '../models/User';

const FEED_PAGE_SIZE = 20;
const DEFAULT_WEIGHT = 1;

export interface FeedCard {
	articleId: string;
	title: string;
	source: string;
	category: string;
	summary?: string;
	keyFacts: string[];
	impactLevel?: 'low' | 'medium' | 'high';
	imageUrl?: string;
	publishedAt: Date;
}

export interface FeedResult {
	page: number;
	pageSize: number;
	total: number;
	items: FeedCard[];
}

const normalizePage = (page: number): number => {
	if (!Number.isFinite(page)) {
		return 1;
	}

	return Math.max(1, Math.floor(page));
};

const toCategoryWeightEntries = (value: unknown): Array<[string, number]> => {
	if (!value) {
		return [];
	}

	if (value instanceof Map) {
		return Array.from(value.entries())
			.map(([category, weight]) => [String(category), Number(weight)] as [string, number])
			.filter(([, weight]) => Number.isFinite(weight));
	}

	if (typeof value === 'object') {
		return Object.entries(value as Record<string, unknown>)
			.map(([category, weight]) => [category, Number(weight)] as [string, number])
			.filter(([, weight]) => Number.isFinite(weight));
	}

	return [];
};

export const getFeed = async (deviceId: string, page: number): Promise<FeedResult | null> => {
	const normalizedPage = normalizePage(page);

	const user = await User.findOne({ deviceId }).select('preferences.categoryWeights swipeHistory.articleId');
	if (!user) {
		return null;
	}

	const swipedArticleIds = user.swipeHistory.map((item) => item.articleId as mongoose.Types.ObjectId);
	const categoryWeightEntries = toCategoryWeightEntries(user.preferences?.categoryWeights);

	const baseMatch: {
		status: 'ready';
		_id?: { $nin: mongoose.Types.ObjectId[] };
	} = { status: 'ready' };

	if (swipedArticleIds.length > 0) {
		baseMatch._id = { $nin: swipedArticleIds };
	}

	const weightBranches = categoryWeightEntries.map(([category, weight]) => ({
		case: { $eq: ['$category', category] },
		then: weight
	}));

	const [items, total] = await Promise.all([
		Article.aggregate<FeedCard>([
			{ $match: baseMatch },
			{
				$addFields: {
					preferenceWeight: {
						$switch: {
							branches: weightBranches,
							default: DEFAULT_WEIGHT
						}
					}
				}
			},
			{ $sort: { preferenceWeight: -1, publishedAt: -1, _id: -1 } },
			{ $skip: (normalizedPage - 1) * FEED_PAGE_SIZE },
			{ $limit: FEED_PAGE_SIZE },
			{
				$project: {
					_id: 0,
					articleId: { $toString: '$_id' },
					title: 1,
					source: 1,
					category: 1,
					summary: 1,
					keyFacts: 1,
					impactLevel: 1,
					imageUrl: 1,
					publishedAt: 1
				}
			}
		]),
		Article.countDocuments(baseMatch)
	]);

	return {
		page: normalizedPage,
		pageSize: FEED_PAGE_SIZE,
		total,
		items
	};
};
