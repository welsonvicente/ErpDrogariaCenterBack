import { Router } from 'express';
import { PerfilController } from '../controllers/PerfilController';
import { authenticate } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// "Meus dados" — qualquer usuário autenticado edita só a própria conta.
router.get('/', authenticate, asyncHandler(PerfilController.getMe));
router.put('/', authenticate, asyncHandler(PerfilController.atualizar));
router.put('/senha', authenticate, asyncHandler(PerfilController.alterarSenha));

export default router;
