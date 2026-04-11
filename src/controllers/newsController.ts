import { Request, Response } from 'express';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/apiResponse';
import * as newsService from '../services/newsService';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const deviceIdParamSchema = z.object({
	deviceId: z.string().uuid('deviceId must be a valid UUID')
});

const articleIdParamSchema = z.object({
	articleId: z.string().regex(objectIdRegex, 'articleId must be a valid Mongo ObjectId')
});

const feedQuerySchema = z.object({
	page: z.coerce.number().int().min(1, 'page must be a positive integer').default(1)
});

const swipeBodySchema = z.object({
	articleId: z.string().regex(objectIdRegex, 'articleId must be a valid Mongo ObjectId'),
	action: z.enum(['like', 'dislike'])
});

export const getFeed = async (req: Request, res: Response) => {
	const paramParsed = deviceIdParamSchema.safeParse(req.params);
	if (!paramParsed.success) {
		return sendError(res, paramParsed.error.issues[0]?.message || 'Invalid deviceId', 400);
	}

	const queryParsed = feedQuerySchema.safeParse(req.query);
	if (!queryParsed.success) {
		return sendError(res, queryParsed.error.issues[0]?.message || 'Invalid page query', 400);
	}

	const feed = await newsService.getFeed(paramParsed.data.deviceId, queryParsed.data.page);
	if (!feed) {
		return sendError(res, 'User not found', 404);
	}

	return sendSuccess(res, feed);
};

export const recordSwipe = async (req: Request, res: Response) => {
	const paramParsed = deviceIdParamSchema.safeParse(req.params);
	if (!paramParsed.success) {
		return sendError(res, paramParsed.error.issues[0]?.message || 'Invalid deviceId', 400);
	}

	const bodyParsed = swipeBodySchema.safeParse(req.body);
	if (!bodyParsed.success) {
		return sendError(res, bodyParsed.error.issues[0]?.message || 'Invalid request body', 400);
	}

	const result = await newsService.recordSwipe(
		paramParsed.data.deviceId,
		bodyParsed.data.articleId,
		bodyParsed.data.action
	);

	if (!result) {
		return sendError(res, 'User or article not found', 404);
	}

	return sendSuccess(res, result);
};

export const getArticleById = async (req: Request, res: Response) => {
	const parsed = articleIdParamSchema.safeParse(req.params);
	if (!parsed.success) {
		return sendError(res, parsed.error.issues[0]?.message || 'Invalid articleId', 400);
	}

	const article = await newsService.getArticleById(parsed.data.articleId);
	if (!article) {
		return sendError(res, 'Article not found', 404);
	}

	return sendSuccess(res, article);
};
