import { Router} from "express";
import * as userController from '../controllers/userController';

const router = Router();

router.post('/register', userController.register);
router.get('/:deviceId', userController.getProfile);
router.post('/:deviceId/bookmarks/:articleId', userController.addBookmark);
router.delete('/:deviceId/bookmarks/:articleId', userController.removeBookmark);

export default router;