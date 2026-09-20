import { Router } from 'express';
import { ArmazenamentoAppController } from '../controllers/ArmazenamentoAppController';
import { authenticate } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// O controller consulta o papel atual no banco em toda chamada. Chaves
// genéricas são exclusivas de ADMIN/GERENTE; FUNCIONARIO só acessa a chave de
// Folgas, recebendo os motivos de atestado redigidos e podendo gravar apenas
// suas próprias folgas/atestados (ver FolgasSigiloService). A autorização não
// fica a cargo do JavaScript público da ferramenta.
router.get('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.get));
router.put('/:chave', authenticate, asyncHandler(ArmazenamentoAppController.set));

export default router;
