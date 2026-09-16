import { Router } from 'express';
import { DespesaController } from '../controllers/DespesaController';
import { DespesaExportController } from '../controllers/DespesaExportController';
import { authenticate, requireGerente } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Lançar despesa é a ação do funcionário — qualquer usuário autenticado pode.
router.post('/', authenticate, asyncHandler(DespesaController.create));

// "Meus lançamentos": o próprio funcionário consultando o que ele já registrou.
router.get('/minhas', authenticate, asyncHandler(DespesaController.listMinhas));

// Exportação (Excel/PDF) é uma ferramenta do dashboard do gerente.
router.get('/exportar/excel', authenticate, requireGerente, asyncHandler(DespesaExportController.excel));
router.get('/exportar/pdf', authenticate, requireGerente, asyncHandler(DespesaExportController.pdf));

// Consultar/editar/remover despesas é restrito ao dashboard do gerente.
router.get('/', authenticate, requireGerente, asyncHandler(DespesaController.list));
router.get('/resumo', authenticate, requireGerente, asyncHandler(DespesaController.summary));
router.get('/:id', authenticate, requireGerente, asyncHandler(DespesaController.getById));
router.put('/:id', authenticate, requireGerente, asyncHandler(DespesaController.update));
router.delete('/:id', authenticate, requireGerente, asyncHandler(DespesaController.remove));

export default router;
