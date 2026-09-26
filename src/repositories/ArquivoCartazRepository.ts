import { In, LessThan } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { ArquivoCartaz, StatusArquivoCartaz } from '../models/ArquivoCartaz';

export class ArquivoCartazRepository {
  private static get repo() {
    return AppDataSource.getRepository(ArquivoCartaz);
  }

  /** Nasce sempre `pendente` e sem projeto — só vira `confirmado`/vinculado em `ArquivoCartazService.confirmar`. */
  static criar(dados: { organizacaoId: string; criadoPorId: string | null; mimeType: string; tamanhoBytes: number }) {
    return this.repo.save(this.repo.create({ ...dados, projetoId: null, status: StatusArquivoCartaz.PENDENTE }));
  }

  static findByIdEOrganizacao(id: string, organizacaoId: string) {
    return this.repo.findOne({ where: { id, organizacaoId } });
  }

  static listarConfirmadosPorProjeto(projetoId: string, organizacaoId: string) {
    return this.repo.find({
      where: { projetoId, organizacaoId, status: StatusArquivoCartaz.CONFIRMADO },
      order: { criadoEm: 'ASC' },
    });
  }

  /** Usado pra montar URLs de leitura em lote (ex.: miniaturas de "produtos recentes") — ids de outra organização ou não confirmados são simplesmente omitidos do resultado. */
  static listarConfirmadosPorIds(ids: string[], organizacaoId: string) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repo.find({ where: { id: In(ids), organizacaoId, status: StatusArquivoCartaz.CONFIRMADO } });
  }

  static salvar(arquivo: ArquivoCartaz) {
    return this.repo.save(arquivo);
  }

  static async remover(id: string, organizacaoId: string) {
    const resultado = await this.repo.delete({ id, organizacaoId });
    return (resultado.affected ?? 0) > 0;
  }

  /** Pendentes mais antigos que `antesDe` — candidatos do job de limpeza (upload que nunca chegou a ser confirmado). */
  static listarPendentesAntigos(antesDe: Date) {
    return this.repo.find({ where: { status: StatusArquivoCartaz.PENDENTE, criadoEm: LessThan(antesDe) } });
  }

  static async removerPorIds(ids: string[]) {
    if (ids.length === 0) return 0;
    const resultado = await this.repo.delete(ids);
    return resultado.affected ?? 0;
  }
}
