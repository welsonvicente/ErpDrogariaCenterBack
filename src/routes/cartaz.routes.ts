import { Router } from 'express';
import { CartazController } from '../controllers/CartazController';
import { authenticate } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Ferramenta de uso do funcionário — só exige login válido (gestor ou funcionário), sem restrição de perfil.
router.post('/buscar-imagem', authenticate, asyncHandler(CartazController.buscarImagem));

export default router;
