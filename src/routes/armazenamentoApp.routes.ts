import { Router } from 'express';
import { ArmazenamentoAppController } from '../controllers/ArmazenamentoAppController';
import { authenticate } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Usado pelas ferramentas estáticas (public/tools/*.html) pra persistir estado
// compartilhado entre gestor e funcionário — só exige login válido, sem
// restrição de perfil (cada ferramenta decide sozinha o que cada papel pode fazer).
// Exceção: a chave da ferramenta de Folgas guarda dado sensível (senhas de
// papel, motivo de atestado) dentro desse mesmo blob de acesso amplo — o
// get/set filtra isso pra quem não "elevou" o acesso, e /elevar é como se
// prova essa elevação. Ver FolgasSigiloService pro motivo completo.
router.get('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.get));
router.put('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.set));
router.post('/:chave/elevar', authenticate, asyncHandler(ArmazenamentoAppController.elevar));

export default router;
