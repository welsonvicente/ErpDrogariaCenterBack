import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { arquivoIdSchema, enviarArquivoSchema } from '../dtos/arquivoImportado.dto';
import { ArquivoImportadoService } from '../services/ArquivoImportadoService';

export class ArquivoImportadoController {
  static async enviar(req: AuthenticatedRequest, res: Response) {
    const { nomeArquivo, mimeType, conteudoBase64 } = enviarArquivoSchema.parse(req.body);
    const resultado = await ArquivoImportadoService.enviar(req.usuario!.organizacaoId, nomeArquivo, mimeType, conteudoBase64);
    res.status(201).json(resultado);
  }

  static async listar(req: AuthenticatedRequest, res: Response) {
    const arquivos = await ArquivoImportadoService.listar(req.usuario!.organizacaoId);
    res.status(200).json(arquivos);
  }

  static async baixar(req: AuthenticatedRequest, res: Response) {
    const id = arquivoIdSchema.parse(req.params.id);
    const arquivo = await ArquivoImportadoService.baixar(id, req.usuario!.organizacaoId);
    res.status(200).json({
      nomeOriginal: arquivo.nomeOriginal,
      mimeType: arquivo.mimeType,
      conteudoBase64: arquivo.conteudo.toString('base64'),
    });
  }

  static async remover(req: AuthenticatedRequest, res: Response) {
    const id = arquivoIdSchema.parse(req.params.id);
    await ArquivoImportadoService.remover(id, req.usuario!.organizacaoId);
    res.status(204).send();
  }
}
