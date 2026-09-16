import { Router } from 'express';
import { ArmazenamentoAppController } from '../controllers/ArmazenamentoAppController';
import { authenticate } from '../middlewares/authMiddleware';
import { loginRateLimiter } from '../middlewares/rateLimitMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Usado pelas ferramentas estáticas (public/tools/*.html) pra persistir estado
// compartilhado entre gerente e funcionário — só exige login válido, sem
// restrição de perfil (cada ferramenta decide sozinha o que cada papel pode fazer).
// Exceção: a chave da ferramenta de Folgas guarda dado sensível (senhas de
// papel, motivo de atestado) dentro desse mesmo blob de acesso amplo — o
// get/set filtra isso pra quem não "elevou" o acesso, e /elevar é como se
// prova essa elevação. Ver FolgasSigiloService pro motivo completo.
router.get('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.get));
router.put('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.set));
// Limitada por IP: a senha de papel (5 dígitos) e o código de funcionário
// promovido são forçáveis por script sem isso — ver rateLimitMiddleware.ts.
router.post('/:chave/elevar', authenticate, loginRateLimiter, asyncHandler(ArmazenamentoAppController.elevar));

// Mesma proteção, pelo mesmo motivo: com os códigos fora da resposta de GET
// (ver FolgasSigiloService.redigirEstado), esta é a única via de conferir um
// código — sem limite ela seria o oráculo de força bruta que o GET era antes.
router.post('/:chave/identificar', authenticate, loginRateLimiter, asyncHandler(ArmazenamentoAppController.identificar));

export default router;
