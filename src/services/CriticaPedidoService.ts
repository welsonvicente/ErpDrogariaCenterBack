import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AppDataSource } from '../config/data-source';
import { logger } from '../config/logger';
import { AtualizarCriticaDTO, CriarCriticaDTO } from '../dtos/criticaPedido.dto';
import { CriticaPedido } from '../models/CriticaPedido';
import { AppError } from '../utils/AppError';

/** Colunas das listagens: tudo menos os jsonb dos documentos e os PDFs. */
const COLUNAS_LISTA: Array<keyof CriticaPedido> = [
  'id',
  'titulo',
  'distribuidora',
  'numeroPedido',
  'periodoTrier',
  'veredito',
  'totalPedido',
  'totalTrier',
  'diferenca',
  'contagens',
  'pdfCotaNome',
  'pdfTrierNome',
  'usuarioNome',
  'criadoEm',
  'atualizadoEm',
];

function repo() {
  return AppDataSource.getRepository(CriticaPedido);
}

/** O que a tela precisa saber sobre cada crítica sem carregar os binários (só "tem PDF?"). */
function paraResposta(c: CriticaPedido) {
  const { pdfCota: _a, pdfTrier: _b, ...resto } = c;
  void _a;
  void _b;
  return { ...resto, temPdfCota: !!c.pdfCotaNome, temPdfTrier: !!c.pdfTrierNome };
}

export class CriticaPedidoService {
  static async listar(organizacaoId: string) {
    const lista = await repo().find({ where: { organizacaoId }, select: COLUNAS_LISTA, order: { criadoEm: 'DESC' }, take: 200 });
    return lista.map(paraResposta);
  }

  static async obter(organizacaoId: string, id: string) {
    const critica = await repo().findOne({
      where: { id, organizacaoId },
      select: [...COLUNAS_LISTA, 'pedido', 'relatorio', 'decisoes', 'anotacoes', 'tolerancias'],
    });
    if (!critica) throw AppError.notFound('Crítica de pedido', id);
    return paraResposta(critica);
  }

  static async criar(organizacaoId: string, usuarioNome: string, dados: CriarCriticaDTO) {
    const critica = repo().create({
      organizacaoId,
      titulo: dados.titulo,
      distribuidora: dados.pedido.distribuidora,
      numeroPedido: dados.pedido.numero,
      periodoTrier: dados.relatorio.periodo,
      veredito: dados.resumo.veredito,
      totalPedido: dados.resumo.totalPedido,
      totalTrier: dados.resumo.totalTrier,
      diferenca: dados.resumo.diferenca,
      contagens: dados.resumo.contagens,
      pedido: dados.pedido as unknown as Record<string, unknown>,
      relatorio: dados.relatorio as unknown as Record<string, unknown>,
      decisoes: dados.decisoes,
      anotacoes: dados.anotacoes,
      tolerancias: dados.tolerancias,
      pdfCotaNome: dados.pdfCota?.nome ?? null,
      pdfCota: dados.pdfCota ? Buffer.from(dados.pdfCota.conteudoBase64, 'base64') : null,
      pdfTrierNome: dados.pdfTrier?.nome ?? null,
      pdfTrier: dados.pdfTrier ? Buffer.from(dados.pdfTrier.conteudoBase64, 'base64') : null,
      usuarioNome,
    });
    const salva = await repo().save(critica);
    logger.info('Crítica de pedido salva', { organizacaoId, criticaId: salva.id, veredito: salva.veredito });
    return this.obter(organizacaoId, salva.id);
  }

  static async atualizar(organizacaoId: string, id: string, dados: AtualizarCriticaDTO) {
    const existente = await repo().findOne({ where: { id, organizacaoId }, select: ['id'] });
    if (!existente) throw AppError.notFound('Crítica de pedido', id);
    // Documento trocado: dados lidos novos + PDF novo (ou nenhum, e então o antigo sai — não bateria mais com os dados).
    const trocaPedido = dados.pedido
      ? {
          pedido: dados.pedido as unknown as Record<string, unknown>,
          distribuidora: dados.pedido.distribuidora,
          numeroPedido: dados.pedido.numero,
          pdfCotaNome: dados.pdfCota?.nome ?? null,
          pdfCota: dados.pdfCota ? Buffer.from(dados.pdfCota.conteudoBase64, 'base64') : null,
        }
      : {};
    const trocaRelatorio = dados.relatorio
      ? {
          relatorio: dados.relatorio as unknown as Record<string, unknown>,
          periodoTrier: dados.relatorio.periodo,
          pdfTrierNome: dados.pdfTrier?.nome ?? null,
          pdfTrier: dados.pdfTrier ? Buffer.from(dados.pdfTrier.conteudoBase64, 'base64') : null,
        }
      : {};

    await repo().update(
      { id, organizacaoId },
      {
        ...trocaPedido,
        ...trocaRelatorio,
        ...(dados.titulo ? { titulo: dados.titulo } : {}),
        decisoes: dados.decisoes,
        ...(dados.anotacoes ? { anotacoes: dados.anotacoes } : {}),
        tolerancias: dados.tolerancias,
        veredito: dados.resumo.veredito,
        totalPedido: dados.resumo.totalPedido,
        totalTrier: dados.resumo.totalTrier,
        diferenca: dados.resumo.diferenca,
        contagens: dados.resumo.contagens,
      } as QueryDeepPartialEntity<CriticaPedido>,
    );
    return this.obter(organizacaoId, id);
  }

  static async baixarPdf(organizacaoId: string, id: string, qual: 'cota' | 'trier') {
    const critica = await repo().findOne({
      where: { id, organizacaoId },
      select: qual === 'cota' ? ['id', 'pdfCota', 'pdfCotaNome'] : ['id', 'pdfTrier', 'pdfTrierNome'],
    });
    const conteudo = qual === 'cota' ? critica?.pdfCota : critica?.pdfTrier;
    const nome = qual === 'cota' ? critica?.pdfCotaNome : critica?.pdfTrierNome;
    if (!conteudo || !nome) throw AppError.notFound('PDF da crítica', id);
    return { nome, conteudo };
  }

  static async remover(organizacaoId: string, id: string) {
    const resultado = await repo().delete({ id, organizacaoId });
    if (!resultado.affected) throw AppError.notFound('Crítica de pedido', id);
  }
}
