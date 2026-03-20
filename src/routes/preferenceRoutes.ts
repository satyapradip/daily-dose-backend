import { Router } from 'express';
import * as preferenceController from '../controllers/preferenceController';

const router = Router();

router.get('/categories', preferenceController.getCategories);
router.get('/:deviceId', preferenceController.getPreferences);
router.put('/:deviceId', preferenceController.setPreferences);

export default router;
