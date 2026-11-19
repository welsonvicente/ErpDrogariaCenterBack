import { Router } from 'express';
import { EstoqueController } from '../controllers/EstoqueController';
import { authenticate, requireGerente } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Inteligência de estoque lida com custo e capital investido — dado financeiro,
// então o módulo inteiro é restrito a ADMIN/GERENTE (como o dashboard de gastos).
router.use(authenticate, requireGerente);

router.get('/', asyncHandler(EstoqueController.painel));
router.post('/importacoes', asyncHandler(EstoqueController.importar));
router.post('/importacoes/:id/restaurar', asyncHandler(EstoqueController.restaurar));
router.get('/importacoes/:id/arquivo', asyncHandler(EstoqueController.baixarArquivo));
// "/lote" precisa vir antes de "/:id", senão "lote" seria lido como um id.
router.patch('/produtos/lote', asyncHandler(EstoqueController.atualizarLote));
router.patch('/produtos/:id', asyncHandler(EstoqueController.atualizarProduto));
router.get('/historico', asyncHandler(EstoqueController.historico));
router.put('/config', asyncHandler(EstoqueController.salvarConfig));

export default router;
