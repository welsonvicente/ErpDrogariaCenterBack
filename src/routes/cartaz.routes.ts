import { Router } from 'express';
import { ArquivoImportadoController } from '../controllers/ArquivoImportadoController';
import { CartazController } from '../controllers/CartazController';
import { authenticate } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Ferramenta de uso do funcionário — só exige login válido (gerente ou funcionário), sem restrição de perfil.
router.post('/buscar-imagem', authenticate, asyncHandler(CartazController.buscarImagem));

// Arquivos importados (ex.: a planilha do modo "Importar planilha") — guardados
// por organização pra ficarem acessíveis de qualquer aparelho, não só de quem
// enviou. Mesma regra de acesso da ferramenta: qualquer login válido na
// organização enxerga os arquivos dela.
router.post('/arquivos', authenticate, asyncHandler(ArquivoImportadoController.enviar));
router.get('/arquivos', authenticate, asyncHandler(ArquivoImportadoController.listar));
router.get('/arquivos/:id', authenticate, asyncHandler(ArquivoImportadoController.baixar));
router.delete('/arquivos/:id', authenticate, asyncHandler(ArquivoImportadoController.remover));

export default router;
