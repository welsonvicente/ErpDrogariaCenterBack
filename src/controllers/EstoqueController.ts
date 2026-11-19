import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import {
  atualizarLoteEstoqueSchema,
  atualizarProdutoEstoqueSchema,
  configEstoqueSchema,
  idEstoqueSchema,
  importarEstoqueSchema,
  listarHistoricoQuerySchema,
} from '../dtos/estoque.dto';
import { TipoHistoricoEstoque } from '../models/EstoqueHistorico';
import { EstoqueService } from '../services/EstoqueService';

/** Tipos de histórico que cada aba da tela pede. */
const TIPOS_POR_ABA: Record<'importacoes' | 'alteracoes' | 'acoes', TipoHistoricoEstoque[]> = {
  importacoes: [TipoHistoricoEstoque.IMPORTACAO, TipoHistoricoEstoque.RESTAURACAO],
  alteracoes: [TipoHistoricoEstoque.EDICAO, TipoHistoricoEstoque.CONFIG],
  acoes: [TipoHistoricoEstoque.ACAO],
};

export class EstoqueController {
  /** Tudo de uma vez: o front filtra, ordena e agrega no navegador (milhares de linhas, resposta instantânea). */
  static async painel(req: AuthenticatedRequest, res: Response) {
    const organizacaoId = req.usuario!.organizacaoId;
    const [produtos, config, importacoes] = await Promise.all([
      EstoqueService.listarProdutos(organizacaoId),
      EstoqueService.obterConfig(organizacaoId),
      EstoqueService.listarImportacoes(organizacaoId),
    ]);
    res.status(200).json({ produtos, config, importacoes });
  }

  static async importar(req: AuthenticatedRequest, res: Response) {
    const dados = importarEstoqueSchema.parse(req.body);
    const autor = await EstoqueService.autorDe(req.usuario!.organizacaoId, req.usuario!.id);
    const importacao = await EstoqueService.importar(req.usuario!.organizacaoId, autor, dados);
    res.status(201).json(importacao);
  }

  static async restaurar(req: AuthenticatedRequest, res: Response) {
    const id = idEstoqueSchema.parse(req.params.id);
    const autor = await EstoqueService.autorDe(req.usuario!.organizacaoId, req.usuario!.id);
    const importacao = await EstoqueService.restaurar(req.usuario!.organizacaoId, autor, id);
    res.status(201).json(importacao);
  }

  /** Devolve o .xlsx como veio (binário), com o nome original — o navegador baixa direto. */
  static async baixarArquivo(req: AuthenticatedRequest, res: Response) {
    const id = idEstoqueSchema.parse(req.params.id);
    const arquivo = await EstoqueService.baixarArquivoOriginal(req.usuario!.organizacaoId, id);
    res.setHeader('Content-Type', arquivo.mime);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`);
    res.status(200).send(arquivo.conteudo);
  }

  static async atualizarProduto(req: AuthenticatedRequest, res: Response) {
    const id = idEstoqueSchema.parse(req.params.id);
    const dados = atualizarProdutoEstoqueSchema.parse(req.body);
    const autor = await EstoqueService.autorDe(req.usuario!.organizacaoId, req.usuario!.id);
    const produto = await EstoqueService.atualizarProduto(req.usuario!.organizacaoId, autor, id, dados);
    res.status(200).json(produto);
  }

  static async atualizarLote(req: AuthenticatedRequest, res: Response) {
    const dados = atualizarLoteEstoqueSchema.parse(req.body);
    const autor = await EstoqueService.autorDe(req.usuario!.organizacaoId, req.usuario!.id);
    const produtos = await EstoqueService.atualizarLote(req.usuario!.organizacaoId, autor, dados);
    res.status(200).json(produtos);
  }

  static async historico(req: AuthenticatedRequest, res: Response) {
    const { aba, limite, codigoTrier } = listarHistoricoQuerySchema.parse(req.query);
    const registros = await EstoqueService.listarHistorico(req.usuario!.organizacaoId, aba ? TIPOS_POR_ABA[aba] : null, limite, codigoTrier);
    res.status(200).json(registros);
  }

  static async salvarConfig(req: AuthenticatedRequest, res: Response) {
    const config = configEstoqueSchema.parse(req.body);
    const autor = await EstoqueService.autorDe(req.usuario!.organizacaoId, req.usuario!.id);
    const salva = await EstoqueService.salvarConfig(req.usuario!.organizacaoId, autor, config);
    res.status(200).json(salva);
  }
}
