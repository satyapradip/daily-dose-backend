import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/apiResponse';
import * as userService from '../services/userService';
import { z } from 'zod';

const deviceIdSchema = z.object({
  deviceId: z.string().uuid('deviceId must be a valid UUID')
});

const bookmarkParamSchema = z.object({
  deviceId: z.string().uuid('deviceId must be a valid UUID'),
  articleId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'articleId must be a valid Mongo ObjectId')
});

export const register = async (_req: Request, res: Response) => {
  try {
    const data = await userService.registerDevice();
    sendSuccess(res, data, 201);
  } catch (_error) {
    sendError(res, 'Error registering device');
  }
};

export const getProfile = async (req: Request, res: Response) => {
  const parsed = deviceIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, parsed.error.issues[0]?.message || 'Invalid deviceId', 400);
  }

  const user = await userService.getUserByDeviceId(parsed.data.deviceId);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  return sendSuccess(res, user);
};

export const addBookmark = async (req: Request, res: Response) => {
  // Bookmark route uses URL params: /:deviceId/bookmarks/:articleId
  const parsed = bookmarkParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, parsed.error.issues[0]?.message || 'Invalid route params', 400);
  }

  const { deviceId, articleId } = parsed.data;
  const user = await userService.addBookmark(deviceId, articleId);
  if (user) {
    return sendSuccess(res, { message: 'Bookmark added successfully' });
  }

  return sendError(res, 'User not found', 404);
};

export const removeBookmark = async (req: Request, res: Response) => {
  const parsed = bookmarkParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, parsed.error.issues[0]?.message || 'Invalid route params', 400);
  }

  const { deviceId, articleId } = parsed.data;
  const user = await userService.removeBookmark(deviceId, articleId);
  if (user) {
    return sendSuccess(res, { message: 'Bookmark removed successfully' });
  }

  return sendError(res, 'User not found', 404);
};