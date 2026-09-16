import { Router } from 'express';
import { UsuarioController } from '../controllers/UsuarioController';
import { authenticate, requireGerente } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Lista enxuta aberta a qualquer autenticado (funcionário escolhe um colega
// num seletor, ex.: "quem recebeu a diária") — precisa vir antes do
// `router.use` abaixo, que restringe todo o resto a ADMIN/GERENTE.
router.get('/colegas', authenticate, asyncHandler(UsuarioController.listColegas));

// Gestão de funcionários é restrita a ADMIN/GERENTE.
router.use(authenticate, requireGerente);

router.get('/', asyncHandler(UsuarioController.list));
router.get('/:id', asyncHandler(UsuarioController.getById));
router.post('/', asyncHandler(UsuarioController.create));
router.put('/:id', asyncHandler(UsuarioController.update));
router.patch('/:id/ativar', asyncHandler(UsuarioController.activate));
router.delete('/:id/permanente', asyncHandler(UsuarioController.remove));
router.delete('/:id', asyncHandler(UsuarioController.deactivate));

export default router;
