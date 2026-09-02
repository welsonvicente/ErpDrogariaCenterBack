import { Router } from 'express';
import { OrganizacaoController } from '../controllers/OrganizacaoController';
import { authenticate, requireGestor } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', authenticate, asyncHandler(OrganizacaoController.getAtual));
router.put('/', authenticate, requireGestor, asyncHandler(OrganizacaoController.atualizar));

export default router;
