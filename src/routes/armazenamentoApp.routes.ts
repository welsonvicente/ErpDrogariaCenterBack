import { Router } from 'express';
import { ArmazenamentoAppController } from '../controllers/ArmazenamentoAppController';
import { authenticate } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Usado pelas ferramentas estáticas (public/tools/*.html) pra persistir estado
// compartilhado entre gerente e funcionário — só exige login válido, sem
// restrição de perfil (cada ferramenta decide sozinha o que cada papel pode
// fazer). Exceção: a chave da ferramenta de Folgas guarda dado sensível
// (motivo de atestado) dentro desse mesmo blob de acesso amplo — o
// controller filtra isso sozinho, checando o papel real de quem chamou (ver
// FolgasSigiloService e authMiddleware.verificarPoderDeGerente).
router.get('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.get));
router.put('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.set));

export default router;
