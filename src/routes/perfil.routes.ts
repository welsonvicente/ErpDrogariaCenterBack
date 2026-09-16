import { Router } from 'express';
import { PerfilController } from '../controllers/PerfilController';
import { authenticate } from '../middlewares/authMiddleware';
import { pinGestorRateLimiter } from '../middlewares/rateLimitMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// "Meus dados" — qualquer usuário autenticado edita só a própria conta.
router.get('/', authenticate, asyncHandler(PerfilController.getMe));
router.put('/', authenticate, asyncHandler(PerfilController.atualizar));
router.put('/senha', authenticate, asyncHandler(PerfilController.alterarSenha));

// Define o PIN que libera o Painel do Gerente (ver Usuario.pinForte). Tem limite
// próprio, contado por usuário e não por IP: o corpo carrega o PIN atual (então
// precisa de limite), mas dividir a cota por IP com as telas de login barraria
// quem define o PIN só porque os colegas do balcão logaram bastante no turno.
router.put('/pin-gerente', authenticate, pinGestorRateLimiter, asyncHandler(PerfilController.definirPinGestor));

export default router;
