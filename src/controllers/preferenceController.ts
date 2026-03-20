import { Request, Response } from 'express';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/apiResponse';
import * as preferenceService from '../services/preferenceService';

const deviceIdSchema = z.object({
	deviceId: z.string().uuid('deviceId must be a valid UUID')
});

const setPreferencesBodySchema = z.object({
	categories: z.array(z.string()).min(1, 'At least one category is required')
});

export const getCategories = (_req: Request, res: Response) => {
	return sendSuccess(res, preferenceService.getCategories());
};

export const getPreferences = async (req: Request, res: Response) => {
	const parsed = deviceIdSchema.safeParse(req.params);
	if (!parsed.success) {
		return sendError(res, parsed.error.issues[0]?.message || 'Invalid deviceId', 400);
	}

	const preferences = await preferenceService.getPreferences(parsed.data.deviceId);
	if (!preferences) {
		return sendError(res, 'User not found', 404);
	}

	return sendSuccess(res, preferences);
};

export const setPreferences = async (req: Request, res: Response) => {
	const paramParsed = deviceIdSchema.safeParse(req.params);
	if (!paramParsed.success) {
		return sendError(res, paramParsed.error.issues[0]?.message || 'Invalid deviceId', 400);
	}

	const bodyParsed = setPreferencesBodySchema.safeParse(req.body);
	if (!bodyParsed.success) {
		return sendError(res, bodyParsed.error.issues[0]?.message || 'Invalid request body', 400);
	}

	// Normalize input to lowercase + unique values for consistency.
	const normalized = Array.from(new Set(bodyParsed.data.categories.map((c) => c.trim().toLowerCase())));
	const validCategories = preferenceService.getCategories();
	const invalid = normalized.filter((c) => !validCategories.includes(c as (typeof validCategories)[number]));

	if (invalid.length > 0) {
		return sendError(
			res,
			`Invalid categories: ${invalid.join(', ')}. Valid categories are: ${validCategories.join(', ')}`,
			400
		);
	}

	const user = await preferenceService.setPreferences(paramParsed.data.deviceId, normalized);
	if (!user) {
		return sendError(res, 'User not found', 404);
	}

	return sendSuccess(res, { message: 'Preferences saved' });
};
