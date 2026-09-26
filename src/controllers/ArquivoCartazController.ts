import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { arquivoIdSchema, confirmarArquivoSchema, duplicarArquivoSchema, obterUrlsArquivosSchema, presignArquivoSchema } from '../dtos/arquivoCartaz.dto';
import { ArquivoCartazService } from '../services/ArquivoCartazService';

export class ArquivoCartazController {
  static async presign(req: AuthenticatedRequest, res: Response) {
    const dados = presignArquivoSchema.parse(req.body);
    const resultado = await ArquivoCartazService.presign(req.usuario!.organizacaoId, req.usuario!.id, dados);
    res.status(201).json(resultado);
  }

  static async confirmar(req: AuthenticatedRequest, res: Response) {
    const id = arquivoIdSchema.parse(req.params.id);
    const { projetoId } = confirmarArquivoSchema.parse(req.body);
    const resultado = await ArquivoCartazService.confirmar(id, req.usuario!.organizacaoId, projetoId);
    res.status(200).json(resultado);
  }

  static async remover(req: AuthenticatedRequest, res: Response) {
    const id = arquivoIdSchema.parse(req.params.id);
    await ArquivoCartazService.remover(id, req.usuario!.organizacaoId);
    res.status(204).send();
  }

  static async obterUrls(req: AuthenticatedRequest, res: Response) {
    const { ids } = obterUrlsArquivosSchema.parse(req.body);
    const resultado = await ArquivoCartazService.obterUrlsPorIds(ids, req.usuario!.organizacaoId);
    res.status(200).json(resultado);
  }

  static async duplicar(req: AuthenticatedRequest, res: Response) {
    const id = arquivoIdSchema.parse(req.params.id);
    const { projetoId } = duplicarArquivoSchema.parse(req.body);
    const resultado = await ArquivoCartazService.duplicarParaProjeto(id, req.usuario!.organizacaoId, req.usuario!.id, projetoId);
    res.status(201).json(resultado);
  }
}
