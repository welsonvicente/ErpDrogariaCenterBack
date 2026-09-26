import { Router } from 'express';
import { ArquivoCartazController } from '../controllers/ArquivoCartazController';
import { ArquivoImportadoController } from '../controllers/ArquivoImportadoController';
import { CartazController } from '../controllers/CartazController';
import { ProjetoCartazController } from '../controllers/ProjetoCartazController';
import { authenticate } from '../middlewares/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Ferramenta de uso do funcionário — só exige login válido (gerente ou funcionário), sem restrição de perfil.
router.post('/buscar-imagem', authenticate, asyncHandler(CartazController.buscarImagem));

// Arquivos importados (a planilha original do modo "Importar planilha") —
// continuam guardados como bytea no Postgres, sem relação com o R2 (essa
// migração é só das IMAGENS de produto usadas nos 3 modos, não da planilha
// em si). Guardados por organização, acessíveis de qualquer aparelho.
router.post('/arquivos', authenticate, asyncHandler(ArquivoImportadoController.enviar));
router.get('/arquivos', authenticate, asyncHandler(ArquivoImportadoController.listar));
router.get('/arquivos/:id', authenticate, asyncHandler(ArquivoImportadoController.baixar));
router.delete('/arquivos/:id', authenticate, asyncHandler(ArquivoImportadoController.remover));

// Projetos de Cartazes (Story/Panfleto/Importar planilha) — substituem o
// antigo "rascunho implícito" só em localStorage. Mesma regra de acesso do
// resto de Cartazes: qualquer login válido na organização acessa os projetos
// dela (ver ProjetoCartazRepository/ArquivoCartazRepository, sempre
// filtrados por organizacaoId).
router.post('/projetos', authenticate, asyncHandler(ProjetoCartazController.criar));
router.get('/projetos', authenticate, asyncHandler(ProjetoCartazController.listar));
router.get('/projetos/:id', authenticate, asyncHandler(ProjetoCartazController.obter));
router.patch('/projetos/:id', authenticate, asyncHandler(ProjetoCartazController.atualizar));
router.delete('/projetos/:id', authenticate, asyncHandler(ProjetoCartazController.remover));

// Imagens dos projetos — nome "imagens" (não "arquivos") de propósito, pra
// não colidir com as rotas de planilha original acima. Os bytes vão direto
// do front pro Cloudflare R2 com a URL assinada devolvida aqui; o backend só
// gera a URL e confirma metadados (ver ArquivoCartazService/config/r2Client).
router.post('/imagens/presign', authenticate, asyncHandler(ArquivoCartazController.presign));
router.post('/imagens/urls', authenticate, asyncHandler(ArquivoCartazController.obterUrls));
router.post('/imagens/:id/confirmar', authenticate, asyncHandler(ArquivoCartazController.confirmar));
router.post('/imagens/:id/duplicar', authenticate, asyncHandler(ArquivoCartazController.duplicar));
router.delete('/imagens/:id', authenticate, asyncHandler(ArquivoCartazController.remover));

export default router;
