import { Router } from 'express';
import { CartazController } from '../controllers/CartazController';
import { authenticate, requireGestor } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Tem custo por chamada (usa busca na web) — restrito a gestor/admin logado.
router.post('/buscar-imagem', authenticate, requireGestor, asyncHandler(CartazController.buscarImagem));

export default router;
