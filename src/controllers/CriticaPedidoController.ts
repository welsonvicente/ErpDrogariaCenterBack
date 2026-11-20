import { Response } from 'express';
import { atualizarCriticaSchema, criarCriticaSchema, idCriticaSchema, qualPdfSchema } from '../dtos/criticaPedido.dto';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { CriticaPedidoService } from '../services/CriticaPedidoService';
import { EstoqueService } from '../services/EstoqueService';

export class CriticaPedidoController {
  static async listar(req: AuthenticatedRequest, res: Response) {
    res.status(200).json(await CriticaPedidoService.listar(req.usuario!.organizacaoId));
  }

  static async obter(req: AuthenticatedRequest, res: Response) {
    const id = idCriticaSchema.parse(req.params.id);
    res.status(200).json(await CriticaPedidoService.obter(req.usuario!.organizacaoId, id));
  }

  static async criar(req: AuthenticatedRequest, res: Response) {
    const dados = criarCriticaSchema.parse(req.body);
    // Reaproveita a busca do nome do autor que o módulo de estoque já usa (nome copiado, não FK).
    const autor = await EstoqueService.autorDe(req.usuario!.organizacaoId, req.usuario!.id);
    res.status(201).json(await CriticaPedidoService.criar(req.usuario!.organizacaoId, autor.nome, dados));
  }

  static async atualizar(req: AuthenticatedRequest, res: Response) {
    const id = idCriticaSchema.parse(req.params.id);
    const dados = atualizarCriticaSchema.parse(req.body);
    res.status(200).json(await CriticaPedidoService.atualizar(req.usuario!.organizacaoId, id, dados));
  }

  /** Devolve o PDF original (binário) com o nome que ele tinha quando foi enviado. */
  static async baixarPdf(req: AuthenticatedRequest, res: Response) {
    const id = idCriticaSchema.parse(req.params.id);
    const qual = qualPdfSchema.parse(req.params.qual);
    const pdf = await CriticaPedidoService.baixarPdf(req.usuario!.organizacaoId, id, qual);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(pdf.nome)}`);
    res.status(200).send(pdf.conteudo);
  }

  static async remover(req: AuthenticatedRequest, res: Response) {
    const id = idCriticaSchema.parse(req.params.id);
    await CriticaPedidoService.remover(req.usuario!.organizacaoId, id);
    res.status(204).send();
  }
}
