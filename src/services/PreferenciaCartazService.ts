import { ChavePreferenciaCartaz } from '../models/PreferenciaCartaz';
import { PreferenciaCartazRepository } from '../repositories/PreferenciaCartazRepository';

export class PreferenciaCartazService {
  /** Todas as preferências da organização num objeto `{ chave: valor }` — chaves nunca salvas ficam de fora. */
  static async listar(organizacaoId: string) {
    const linhas = await PreferenciaCartazRepository.listarPorOrganizacao(organizacaoId);
    return Object.fromEntries(linhas.map((linha) => [linha.chave, linha.valor]));
  }

  static async salvar(organizacaoId: string, chave: ChavePreferenciaCartaz, valor: Record<string, unknown>) {
    const salva = await PreferenciaCartazRepository.salvar(organizacaoId, chave, valor);
    return { chave: salva.chave, valor: salva.valor, atualizadoEm: salva.atualizadoEm };
  }
}
