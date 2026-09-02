import { Router } from 'express';
import { DespesaController } from '../controllers/DespesaController';
import { authenticate, requireGestor } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Lançar despesa é a ação do funcionário — qualquer usuário autenticado pode.
router.post('/', authenticate, asyncHandler(DespesaController.create));

// Consultar/editar/remover despesas é restrito ao dashboard do gestor.
router.get('/', authenticate, requireGestor, asyncHandler(DespesaController.list));
router.get('/resumo', authenticate, requireGestor, asyncHandler(DespesaController.summary));
router.get('/:id', authenticate, requireGestor, asyncHandler(DespesaController.getById));
router.put('/:id', authenticate, requireGestor, asyncHandler(DespesaController.update));
router.delete('/:id', authenticate, requireGestor, asyncHandler(DespesaController.remove));

export default router;
