import { Router } from 'express';
import { CategoriaController } from '../controllers/CategoriaController';
import { authenticate, requireGestor } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Qualquer usuário autenticado da organização pode consultar (funcionário precisa
// da lista para escolher a categoria ao lançar um gasto).
router.get('/', authenticate, asyncHandler(CategoriaController.list));
router.get('/:id', authenticate, asyncHandler(CategoriaController.getById));

// Gerenciar categorias é restrito a ADMIN/GESTOR.
router.post('/', authenticate, requireGestor, asyncHandler(CategoriaController.create));
router.put('/:id', authenticate, requireGestor, asyncHandler(CategoriaController.update));
router.patch('/:id/ativar', authenticate, requireGestor, asyncHandler(CategoriaController.activate));
router.delete('/:id/permanente', authenticate, requireGestor, asyncHandler(CategoriaController.remove));
router.delete('/:id', authenticate, requireGestor, asyncHandler(CategoriaController.deactivate));

export default router;
