import { apagarObjetos, chaveObjeto } from '../config/r2Client';
import { TipoProjetoCartaz } from '../models/ProjetoCartaz';
import { ArquivoCartazRepository } from '../repositories/ArquivoCartazRepository';
import { ProjetoCartazRepository } from '../repositories/ProjetoCartazRepository';
import { AppError } from '../utils/AppError';
import { ArquivoCartazService } from './ArquivoCartazService';

export class ProjetoCartazService {
  static criar(organizacaoId: string, usuarioId: string, tipo: TipoProjetoCartaz, nome: string) {
    return ProjetoCartazRepository.criar({ organizacaoId, criadoPorId: usuarioId, tipo, nome });
  }

  static listar(organizacaoId: string, tipo?: TipoProjetoCartaz) {
    return ProjetoCartazRepository.listarPorOrganizacao(organizacaoId, tipo);
  }

  /** Projeto + arquivos confirmados já com URL de leitura assinada — pronto pro front recarregar o editor. */
  static async obterCompleto(id: string, organizacaoId: string) {
    const projeto = await ProjetoCartazRepository.findByIdEOrganizacao(id, organizacaoId);
    if (!projeto) throw AppError.notFound('Projeto', id);

    const arquivos = await ArquivoCartazRepository.listarConfirmadosPorProjeto(id, organizacaoId);
    const arquivosComUrl = await Promise.all(
      arquivos.map(async (arquivo) => ({
        id: arquivo.id,
        mimeType: arquivo.mimeType,
        tamanhoBytes: arquivo.tamanhoBytes,
        url: await ArquivoCartazService.obterUrlLeitura(arquivo),
      })),
    );

    return { ...projeto, arquivos: arquivosComUrl };
  }

  static async atualizar(id: string, organizacaoId: string, dados: { nome?: string; estadoEditor?: Record<string, unknown> }) {
    const projeto = await ProjetoCartazRepository.findByIdEOrganizacao(id, organizacaoId);
    if (!projeto) throw AppError.notFound('Projeto', id);

    if (dados.nome !== undefined) projeto.nome = dados.nome;
    if (dados.estadoEditor !== undefined) projeto.estadoEditor = dados.estadoEditor;
    return ProjetoCartazRepository.salvar(projeto);
  }

  /**
   * Apaga os objetos no R2 antes de apagar o projeto — o `ON DELETE CASCADE`
   * do banco cuida das linhas de `arquivos_cartaz`, mas não sabe nada sobre o
   * R2, então os bytes ficariam órfãos lá se não fossem removidos aqui antes.
   */
  static async remover(id: string, organizacaoId: string) {
    const projeto = await ProjetoCartazRepository.findByIdEOrganizacao(id, organizacaoId);
    if (!projeto) throw AppError.notFound('Projeto', id);

    const arquivos = await ArquivoCartazRepository.listarConfirmadosPorProjeto(id, organizacaoId);
    if (arquivos.length > 0) {
      await apagarObjetos(arquivos.map((arquivo) => chaveObjeto(organizacaoId, arquivo.id)));
    }

    await ProjetoCartazRepository.remover(id, organizacaoId);
  }
}
