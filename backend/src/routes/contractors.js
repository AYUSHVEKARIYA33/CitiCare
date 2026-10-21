import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  listContractors,
  createContractor,
  updateContractor,
  getContractorStats,
} from '../controllers/contractors.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getContractorStats);
router.get('/', listContractors);
router.post('/', requireRole('admin'), createContractor);
router.patch('/:id', updateContractor);

export default router;
