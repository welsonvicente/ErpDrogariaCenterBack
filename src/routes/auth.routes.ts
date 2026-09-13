import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { loginRateLimiter } from '../middlewares/rateLimitMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Rotas públicas — a organização é identificada pelo slug enviado no corpo
// (o front já sabe o slug porque ele vem como parâmetro da URL, ex.: /drogariacenter/...).
// Limitadas por IP: sem isso, um PIN de funcionário (4-8 dígitos) é forçável
// por script em segundos — ver rateLimitMiddleware.ts.
router.post('/login', loginRateLimiter, asyncHandler(AuthController.login));
router.post('/funcionario-login', loginRateLimiter, asyncHandler(AuthController.loginFuncionario));

export default router;
