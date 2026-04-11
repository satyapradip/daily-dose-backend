import mongoose from 'mongoose';
import Article from '../models/Article';
import User from '../models/User';

const FEED_PAGE_SIZE = 20;
const DEFAULT_WEIGHT = 1;
const LIKE_WEIGHT_DELTA = 0.2;
const DISLIKE_WEIGHT_DELTA = -0.2;
const MIN_CATEGORY_WEIGHT = 0.1;
const MAX_CATEGORY_WEIGHT = 5;

export type SwipeAction = 'like' | 'dislike';

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

export interface SwipeResult {
	message: string;
	category: string;
	action: SwipeAction;
	updatedWeight: number;
}

export interface ArticleDetail {
	articleId: string;
	title: string;
	source: string;
	category: string;
	url: string;
	summary?: string;
	keyFacts: string[];
	impactLevel?: 'low' | 'medium' | 'high';
	imageUrl?: string;
	publishedAt: Date;
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

const clampWeight = (value: number): number => {
	if (value < MIN_CATEGORY_WEIGHT) {
		return MIN_CATEGORY_WEIGHT;
	}

	if (value > MAX_CATEGORY_WEIGHT) {
		return MAX_CATEGORY_WEIGHT;
	}

	return Number(value.toFixed(3));
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

export const recordSwipe = async (
	deviceId: string,
	articleId: string,
	action: SwipeAction
): Promise<SwipeResult | null> => {
	const [user, article] = await Promise.all([
		User.findOne({ deviceId }),
		Article.findOne({ _id: articleId, status: 'ready' }).select('category')
	]);

	if (!user || !article) {
		return null;
	}

	const category = article.category;
	const categoryWeights = user.preferences.categoryWeights;
	const currentWeight = Number(categoryWeights.get(category) ?? DEFAULT_WEIGHT);
	const delta = action === 'like' ? LIKE_WEIGHT_DELTA : DISLIKE_WEIGHT_DELTA;
	const updatedWeight = clampWeight(currentWeight + delta);

	categoryWeights.set(category, updatedWeight);

	// Keep only one swipe entry per article to avoid duplicate learning events.
	user.swipeHistory = user.swipeHistory.filter(
		(entry) => String(entry.articleId) !== String(article._id)
	);

	user.swipeHistory.push({
		articleId: article._id as mongoose.Types.ObjectId,
		action,
		at: new Date()
	});

	await user.save();

	return {
		message: 'Swipe recorded successfully',
		category,
		action,
		updatedWeight
	};
};

export const getArticleById = async (articleId: string): Promise<ArticleDetail | null> => {
	if (!mongoose.isValidObjectId(articleId)) {
		return null;
	}

	const article = await Article.findOne({ _id: articleId, status: 'ready' })
		.select('title source category url summary keyFacts impactLevel imageUrl publishedAt')
		.lean();

	if (!article) {
		return null;
	}

	return {
		articleId: String(article._id),
		title: article.title,
		source: article.source,
		category: article.category,
		url: article.url,
		summary: article.summary,
		keyFacts: article.keyFacts ?? [],
		impactLevel: article.impactLevel,
		imageUrl: article.imageUrl,
		publishedAt: article.publishedAt
	};
};
