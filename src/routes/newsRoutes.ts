import { Router } from 'express';
import * as newsController from '../controllers/newsController';

const router = Router();

router.get('/feed/:deviceId', newsController.getFeed);
router.post('/swipe/:deviceId', newsController.recordSwipe);
router.get('/:articleId', newsController.getArticleById);

export default router;
