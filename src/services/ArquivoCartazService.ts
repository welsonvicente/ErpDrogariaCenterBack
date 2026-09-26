import { apagarObjetos, chaveObjeto, gerarUrlDownload, gerarUrlUpload, verificarObjetoEnviado } from '../config/r2Client';
import { ArquivoCartaz, StatusArquivoCartaz } from '../models/ArquivoCartaz';
import { ArquivoCartazRepository } from '../repositories/ArquivoCartazRepository';
import { ProjetoCartazRepository } from '../repositories/ProjetoCartazRepository';
import { AppError } from '../utils/AppError';

export class ArquivoCartazService {
  /**
   * Cria o registro `pendente` e devolve a URL assinada de upload — os bytes
   * da imagem vão direto do front pro R2 a partir daqui, nunca pelo backend.
   */
  static async presign(
    organizacaoId: string,
    usuarioId: string,
    dados: { projetoId?: string; mimeType: string; tamanhoBytes: number },
  ) {
    if (dados.projetoId) {
      const projeto = await ProjetoCartazRepository.findByIdEOrganizacao(dados.projetoId, organizacaoId);
      if (!projeto) throw AppError.notFound('Projeto', dados.projetoId);
    }

    const arquivo = await ArquivoCartazRepository.criar({
      organizacaoId,
      criadoPorId: usuarioId,
      mimeType: dados.mimeType,
      tamanhoBytes: dados.tamanhoBytes,
    });

    const key = chaveObjeto(organizacaoId, arquivo.id);
    const { url, expiraEm } = await gerarUrlUpload(key, dados.mimeType);

    return {
      arquivoId: arquivo.id,
      uploadUrl: url,
      headers: { 'Content-Type': dados.mimeType },
      expiraEm,
    };
  }

  /**
   * Confere (via HEAD no R2) que o upload realmente chegou antes de marcar
   * `confirmado` e vincular ao projeto — sem isso, um PUT que falhou
   * silenciosamente ficaria registrado como se a foto existisse.
   *
   * `projetoId` é opcional: uma foto confirmada sem projeto é o caso de
   * "produtos recentes" (Story/Panfleto) — fica `confirmado` (nunca apagada
   * pelo job de limpeza, que só toca em `pendente`) mas sem vínculo, até a
   * lista de recentes decidir descartar essa entrada (ver
   * `ArquivoCartazService.remover`, chamado pelo front nesse momento).
   */
  static async confirmar(id: string, organizacaoId: string, projetoId?: string) {
    const arquivo = await ArquivoCartazRepository.findByIdEOrganizacao(id, organizacaoId);
    if (!arquivo) throw AppError.notFound('Arquivo', id);

    if (projetoId) {
      const projeto = await ProjetoCartazRepository.findByIdEOrganizacao(projetoId, organizacaoId);
      if (!projeto) throw AppError.notFound('Projeto', projetoId);
      arquivo.projetoId = projetoId;
    }

    const key = chaveObjeto(organizacaoId, arquivo.id);
    const objeto = await verificarObjetoEnviado(key);
    if (!objeto) {
      throw AppError.conflict('O upload dessa imagem ainda não chegou ao armazenamento. Tente enviar de novo.');
    }

    arquivo.status = StatusArquivoCartaz.CONFIRMADO;
    // O tamanho real do objeto no R2 é a fonte da verdade a partir daqui, não o valor informado no presign.
    arquivo.tamanhoBytes = objeto.tamanhoBytes;
    await ArquivoCartazRepository.salvar(arquivo);

    return { id: arquivo.id, mimeType: arquivo.mimeType, tamanhoBytes: arquivo.tamanhoBytes, status: arquivo.status };
  }

  /** URL de leitura assinada, gerada sob demanda (nunca guardada) — usada ao montar a resposta de um projeto. */
  static obterUrlLeitura(arquivo: ArquivoCartaz) {
    return gerarUrlDownload(chaveObjeto(arquivo.organizacaoId, arquivo.id));
  }

  /** Em lote, pra montar miniaturas (ex.: "produtos recentes") sem uma chamada por imagem. Ids inválidos/de outra organização são simplesmente omitidos. */
  static async obterUrlsPorIds(ids: string[], organizacaoId: string) {
    const arquivos = await ArquivoCartazRepository.listarConfirmadosPorIds(ids, organizacaoId);
    return Promise.all(
      arquivos.map(async (arquivo) => ({ id: arquivo.id, url: await ArquivoCartazService.obterUrlLeitura(arquivo) })),
    );
  }

  static async remover(id: string, organizacaoId: string) {
    const arquivo = await ArquivoCartazRepository.findByIdEOrganizacao(id, organizacaoId);
    if (!arquivo) throw AppError.notFound('Arquivo', id);

    await apagarObjetos([chaveObjeto(organizacaoId, arquivo.id)]);
    await ArquivoCartazRepository.remover(id, organizacaoId);
  }
}
