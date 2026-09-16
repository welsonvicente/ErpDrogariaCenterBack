import { Router } from 'express';
import { CategoriaController } from '../controllers/CategoriaController';
import { authenticate, requireGerente } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Qualquer usuário autenticado da organização pode consultar (funcionário precisa
// da lista para escolher a categoria ao lançar um gasto).
router.get('/', authenticate, asyncHandler(CategoriaController.list));
router.get('/:id', authenticate, asyncHandler(CategoriaController.getById));

// Gerenciar categorias é restrito a ADMIN/GERENTE.
router.post('/', authenticate, requireGerente, asyncHandler(CategoriaController.create));
router.put('/:id', authenticate, requireGerente, asyncHandler(CategoriaController.update));
router.patch('/:id/ativar', authenticate, requireGerente, asyncHandler(CategoriaController.activate));
router.delete('/:id/permanente', authenticate, requireGerente, asyncHandler(CategoriaController.remove));
router.delete('/:id', authenticate, requireGerente, asyncHandler(CategoriaController.deactivate));

export default router;
