import { Router } from 'express';
import { DespesaController } from '../controllers/DespesaController';
import { DespesaExportController } from '../controllers/DespesaExportController';
import { authenticate, requireGestor } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Lançar despesa é a ação do funcionário — qualquer usuário autenticado pode.
router.post('/', authenticate, asyncHandler(DespesaController.create));

// "Meus lançamentos": o próprio funcionário consultando o que ele já registrou.
router.get('/minhas', authenticate, asyncHandler(DespesaController.listMinhas));

// Exportação (Excel/PDF) é uma ferramenta do dashboard do gestor.
router.get('/exportar/excel', authenticate, requireGestor, asyncHandler(DespesaExportController.excel));
router.get('/exportar/pdf', authenticate, requireGestor, asyncHandler(DespesaExportController.pdf));

// Consultar/editar/remover despesas é restrito ao dashboard do gestor.
router.get('/', authenticate, requireGestor, asyncHandler(DespesaController.list));
router.get('/resumo', authenticate, requireGestor, asyncHandler(DespesaController.summary));
router.get('/:id', authenticate, requireGestor, asyncHandler(DespesaController.getById));
router.put('/:id', authenticate, requireGestor, asyncHandler(DespesaController.update));
router.delete('/:id', authenticate, requireGestor, asyncHandler(DespesaController.remove));

export default router;
