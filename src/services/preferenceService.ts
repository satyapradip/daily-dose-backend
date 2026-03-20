import User from '../models/User';

export const VALID_CATEGORIES = [
	'technology',
	'politics',
	'sports',
	'business',
	'science',
	'health',
	'entertainment',
	'world'
] as const;

export const getCategories = () => [...VALID_CATEGORIES];

export const setPreferences = async (deviceId: string, categories: string[]) => {
	const categoryWeights = categories.reduce<Record<string, number>>((acc, category) => {
		acc[category] = 1.0;
		return acc;
	}, {});

	return User.findOneAndUpdate(
		{ deviceId },
		{
			$set: {
				'preferences.categories': categories,
				'preferences.categoryWeights': categoryWeights
			}
		},
		{ new: true }
	);
};

export const getPreferences = async (deviceId: string) => {
	const user = await User.findOne({ deviceId }).select('preferences');
	return user?.preferences ?? null;
};
