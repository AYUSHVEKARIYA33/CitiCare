import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { login, me, register } from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/rate-limiter.js';

const router = Router();
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', authMiddleware, me);

export default router;


