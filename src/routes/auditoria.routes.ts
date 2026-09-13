import { Router } from 'express';
import { AuditoriaController } from '../controllers/AuditoriaController';
import { authenticate, requireGestor } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Restrito a ADMIN/GESTOR — quem editou/excluiu um lançamento, quem
// concedeu/revogou o atalho pro painel do gestor a um funcionário.
router.get('/', authenticate, requireGestor, asyncHandler(AuditoriaController.list));

export default router;
