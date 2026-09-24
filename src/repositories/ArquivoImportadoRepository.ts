import { AppDataSource } from '../config/data-source';
import { ArquivoImportado } from '../models/ArquivoImportado';

export class ArquivoImportadoRepository {
  private static get repo() {
    return AppDataSource.getRepository(ArquivoImportado);
  }

  static criar(dados: { organizacaoId: string; nomeOriginal: string; mimeType: string; tamanhoBytes: number; conteudo: Buffer }) {
    return this.repo.save(this.repo.create(dados));
  }

  /** Lista sem o conteúdo binário — só o necessário pra mostrar a lista de arquivos disponíveis. */
  static listarPorOrganizacao(organizacaoId: string) {
    return this.repo.find({
      where: { organizacaoId },
      select: ['id', 'nomeOriginal', 'mimeType', 'tamanhoBytes', 'criadoEm'],
      order: { criadoEm: 'DESC' },
    });
  }

  static findByIdEOrganizacao(id: string, organizacaoId: string) {
    return this.repo.findOne({ where: { id, organizacaoId } });
  }

  static async remover(id: string, organizacaoId: string) {
    const resultado = await this.repo.delete({ id, organizacaoId });
    return (resultado.affected ?? 0) > 0;
  }
}
