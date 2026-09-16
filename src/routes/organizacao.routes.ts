import { Router } from 'express';
import { OrganizacaoController } from '../controllers/OrganizacaoController';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', authenticate, asyncHandler(OrganizacaoController.getAtual));
// Dados da organização afetam todo mundo dentro dela — restrito ao ADMIN.
router.put('/', authenticate, requireAdmin, asyncHandler(OrganizacaoController.atualizar));

export default router;
