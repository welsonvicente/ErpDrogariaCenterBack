import { Router } from 'express';
import { UsuarioController } from '../controllers/UsuarioController';
import { authenticate, requireGestor } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Gestão de funcionários é restrita a ADMIN/GESTOR.
router.use(authenticate, requireGestor);

router.get('/', asyncHandler(UsuarioController.list));
router.get('/:id', asyncHandler(UsuarioController.getById));
router.post('/', asyncHandler(UsuarioController.create));
router.put('/:id', asyncHandler(UsuarioController.update));
router.delete('/:id', asyncHandler(UsuarioController.deactivate));

export default router;
