import { Router } from 'express';
import { AuditoriaController } from '../controllers/AuditoriaController';
import { authenticate, requireGerente } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Restrito a ADMIN/GERENTE — quem editou/excluiu um lançamento, quem
// concedeu/revogou o atalho pro painel do gerente a um funcionário.
router.get('/', authenticate, requireGerente, asyncHandler(AuditoriaController.list));

export default router;
