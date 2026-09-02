import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Rotas públicas — a organização é identificada pelo slug enviado no corpo
// (o front já sabe o slug porque ele vem como parâmetro da URL, ex.: /drogariacenter/...).
router.post('/login', asyncHandler(AuthController.login));
router.post('/funcionario-login', asyncHandler(AuthController.loginFuncionario));

export default router;
