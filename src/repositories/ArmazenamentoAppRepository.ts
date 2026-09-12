import { AppDataSource } from '../config/data-source';
import { ArmazenamentoApp } from '../models/ArmazenamentoApp';

export class ArmazenamentoAppRepository {
  private static get repo() {
    return AppDataSource.getRepository(ArmazenamentoApp);
  }

  static findByChave(organizacaoId: string, chave: string) {
    return this.repo.findOne({ where: { organizacaoId, chave } });
  }

  /** Grava sem checar concorrência — usado quando quem chama não pediu controle de versão. */
  static async upsert(organizacaoId: string, chave: string, valor: string) {
    const existente = await this.findByChave(organizacaoId, chave);
    if (existente) {
      existente.valor = valor;
      existente.versao = existente.versao + 1;
      return this.repo.save(existente);
    }
    return this.repo.save(this.repo.create({ organizacaoId, chave, valor, versao: 1 }));
  }

  /**
   * Grava só se a versão atual no banco for exatamente `versaoEsperada` —
   * concorrência otimista (ver ArmazenamentoApp.versao). O UPDATE com
   * `versao = :versaoEsperada` na cláusula WHERE, tudo numa única
   * instrução SQL, é o que evita a corrida entre ler e escrever (duas
   * gravações concorrentes não podem as duas "verem" a mesma versão como
   * disponível — só uma delas afeta alguma linha).
   *
   * `versaoEsperada === 0` significa "eu acho que essa chave nunca foi
   * salva" — tenta inserir; se já existir, é conflito.
   */
  static async atualizarComVersao(organizacaoId: string, chave: string, valor: string, versaoEsperada: number) {
    if (versaoEsperada === 0) {
      try {
        const criado = await this.repo.save(this.repo.create({ organizacaoId, chave, valor, versao: 1 }));
        return { conflito: false as const, registro: criado };
      } catch (e) {
        // Alguém criou essa chave entre o GET e esse PUT — conflito, não erro.
        const atual = await this.findByChave(organizacaoId, chave);
        return { conflito: true as const, registro: atual };
      }
    }

    const resultado = await this.repo
      .createQueryBuilder()
      .update(ArmazenamentoApp)
      .set({ valor, versao: () => 'versao + 1' })
      .where('organizacao_id = :organizacaoId AND chave = :chave AND versao = :versaoEsperada', {
        organizacaoId,
        chave,
        versaoEsperada,
      })
      .execute();

    if (resultado.affected && resultado.affected > 0) {
      return { conflito: false as const, registro: await this.findByChave(organizacaoId, chave) };
    }
    return { conflito: true as const, registro: await this.findByChave(organizacaoId, chave) };
  }
}
