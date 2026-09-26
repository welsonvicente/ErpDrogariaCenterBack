import { AppDataSource } from '../config/data-source';
import { apagarObjetos } from '../config/r2Client';
import { ArquivoCartaz, StatusArquivoCartaz } from '../models/ArquivoCartaz';
import { criarAdmin, criarOrganizacao } from '../tests/helpers/factory';
import { resetDb } from '../tests/helpers/db';
import { limparArquivosPendentesAntigos } from './limpezaArquivosCartazJob';

jest.mock('../config/r2Client', () => ({
  chaveObjeto: jest.fn((organizacaoId: string, arquivoId: string) => `org/${organizacaoId}/${arquivoId}`),
  apagarObjetos: jest.fn(async () => undefined),
}));

const apagarObjetosMock = apagarObjetos as jest.Mock;

describe('limparArquivosPendentesAntigos', () => {
  beforeEach(async () => {
    await resetDb();
    apagarObjetosMock.mockClear();
    apagarObjetosMock.mockResolvedValue(undefined);
  });

  /**
   * `@CreateDateColumn` costuma sobrescrever qualquer `criadoEm` passado na
   * hora do insert (TypeORM aplica `now()` por padrão) — por isso, quando o
   * teste precisa de um arquivo "antigo", cria normalmente e depois força a
   * data certa com um UPDATE direto, sem depender desse comportamento.
   */
  async function criarArquivo(organizacaoId: string, overrides: Partial<ArquivoCartaz> & { criadoEm?: Date } = {}) {
    const { criadoEm, ...resto } = overrides;
    const repo = AppDataSource.getRepository(ArquivoCartaz);
    const arquivo = await repo.save(
      repo.create({
        organizacaoId,
        criadoPorId: null,
        projetoId: null,
        mimeType: 'image/jpeg',
        tamanhoBytes: 1000,
        status: StatusArquivoCartaz.PENDENTE,
        ...resto,
      }),
    );
    if (criadoEm) {
      await AppDataSource.query('UPDATE arquivos_cartaz SET criado_em = $1 WHERE id = $2', [criadoEm, arquivo.id]);
      arquivo.criadoEm = criadoEm;
    }
    return arquivo;
  }

  it('apaga pendentes com mais de 24h (do R2 e do banco)', async () => {
    const org = await criarOrganizacao();
    const antigo = await criarArquivo(org.id, { criadoEm: new Date(Date.now() - 25 * 60 * 60 * 1000) });

    const removidos = await limparArquivosPendentesAntigos();

    expect(removidos).toBe(1);
    expect(apagarObjetosMock).toHaveBeenCalledWith([`org/${org.id}/${antigo.id}`]);
    const restante = await AppDataSource.getRepository(ArquivoCartaz).findOne({ where: { id: antigo.id } });
    expect(restante).toBeNull();
  });

  it('não toca em pendente recente nem em confirmado antigo', async () => {
    const org = await criarOrganizacao();
    const recente = await criarArquivo(org.id, { criadoEm: new Date() });
    const confirmadoAntigo = await criarArquivo(org.id, {
      criadoEm: new Date(Date.now() - 25 * 60 * 60 * 1000),
      status: StatusArquivoCartaz.CONFIRMADO,
    });

    const removidos = await limparArquivosPendentesAntigos();

    expect(removidos).toBe(0);
    expect(apagarObjetosMock).not.toHaveBeenCalled();
    const repo = AppDataSource.getRepository(ArquivoCartaz);
    expect(await repo.findOne({ where: { id: recente.id } })).not.toBeNull();
    expect(await repo.findOne({ where: { id: confirmadoAntigo.id } })).not.toBeNull();
  });

  it('não remove as linhas do banco se a remoção no R2 falhar', async () => {
    const org = await criarOrganizacao();
    const antigo = await criarArquivo(org.id, { criadoEm: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    apagarObjetosMock.mockRejectedValueOnce(new Error('R2 fora do ar'));

    await expect(limparArquivosPendentesAntigos()).rejects.toThrow('R2 fora do ar');

    const restante = await AppDataSource.getRepository(ArquivoCartaz).findOne({ where: { id: antigo.id } });
    expect(restante).not.toBeNull();
  });

  it('ignora organizacaoId ao limpar — roda pra todas as organizações de uma vez', async () => {
    const orgA = await criarOrganizacao();
    const orgB = await criarOrganizacao();
    await criarAdmin(orgA.id);
    const antigoA = await criarArquivo(orgA.id, { criadoEm: new Date(Date.now() - 48 * 60 * 60 * 1000) });
    const antigoB = await criarArquivo(orgB.id, { criadoEm: new Date(Date.now() - 48 * 60 * 60 * 1000) });

    const removidos = await limparArquivosPendentesAntigos();

    expect(removidos).toBe(2);
    expect(apagarObjetosMock).toHaveBeenCalledWith(
      expect.arrayContaining([`org/${orgA.id}/${antigoA.id}`, `org/${orgB.id}/${antigoB.id}`]),
    );
  });
});
