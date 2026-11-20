import { Router } from 'express';
import { CriticaPedidoController } from '../controllers/CriticaPedidoController';
import { authenticate, requireGerente } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Compra e custo são dado financeiro da gestão: só ADMIN/GERENTE, como o resto da área de Gestão.
router.use(authenticate, requireGerente);

router.get('/', asyncHandler(CriticaPedidoController.listar));
router.post('/', asyncHandler(CriticaPedidoController.criar));
router.get('/:id', asyncHandler(CriticaPedidoController.obter));
router.put('/:id', asyncHandler(CriticaPedidoController.atualizar));
router.get('/:id/pdf/:qual', asyncHandler(CriticaPedidoController.baixarPdf));
router.delete('/:id', asyncHandler(CriticaPedidoController.remover));

export default router;
