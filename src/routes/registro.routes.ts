import { Router } from 'express';
import { RegistroController } from '../controllers/RegistroController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Rotas públicas — cadastro de organização nova, sem autenticação.
router.get('/slug-disponivel', asyncHandler(RegistroController.slugDisponivel));
router.post('/', asyncHandler(RegistroController.registrarOrganizacao));

export default router;
