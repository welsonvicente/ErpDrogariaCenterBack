import { Router } from 'express';
import { ArmazenamentoAppController } from '../controllers/ArmazenamentoAppController';
import { authenticate } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Usado pelas ferramentas estáticas (public/tools/*.html) pra persistir estado
// compartilhado entre gestor e funcionário — só exige login válido, sem
// restrição de perfil (cada ferramenta decide sozinha o que cada papel pode fazer).
router.get('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.get));
router.put('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.set));

export default router;
