import cron from 'node-cron';
import { apagarObjetos, chaveObjeto } from '../config/r2Client';
import { logger } from '../config/logger';
import { ArquivoCartazRepository } from '../repositories/ArquivoCartazRepository';

const HORAS_RETENCAO_PENDENTE = 24;

/**
 * Apaga arquivos de Cartazes que ficaram `pendente` por mais de 24h — upload
 * que nunca chegou a ser confirmado (aba fechada, PUT que falhou, usuário
 * desistiu no meio). Nunca toca em arquivos `confirmado` (vinculados a um
 * projeto válido).
 *
 * Exportada separada de `iniciarJobLimpezaArquivosCartaz` pra poder ser
 * chamada diretamente nos testes, sem esperar o cron disparar.
 */
export async function limparArquivosPendentesAntigos(): Promise<number> {
  const limite = new Date(Date.now() - HORAS_RETENCAO_PENDENTE * 60 * 60 * 1000);
  const pendentes = await ArquivoCartazRepository.listarPendentesAntigos(limite);
  if (pendentes.length === 0) return 0;

  try {
    await apagarObjetos(pendentes.map((arquivo) => chaveObjeto(arquivo.organizacaoId, arquivo.id)));
  } catch (erro) {
    // Não remove as linhas do banco se não confirmou a remoção no R2 — evita
    // um registro apontando para um objeto que na verdade ainda existe lá.
    logger.error('Falha ao apagar objetos órfãos no R2 durante limpeza de arquivos de Cartazes', { erro });
    throw erro;
  }

  const removidos = await ArquivoCartazRepository.removerPorIds(pendentes.map((arquivo) => arquivo.id));
  logger.info('Limpeza de arquivos pendentes de Cartazes concluída', { removidos });
  return removidos;
}

/**
 * Registra o cron (1x por dia, 3h da manhã) — chamado só em `server.ts`,
 * nunca em `app.ts`: os testes de integração usam `createApp()` direto e não
 * devem disputar o banco de teste com um job agendado rodando em paralelo.
 */
export function iniciarJobLimpezaArquivosCartaz() {
  cron.schedule('0 3 * * *', () => {
    limparArquivosPendentesAntigos().catch((erro) => {
      logger.error('Job de limpeza de arquivos de Cartazes falhou', { erro });
    });
  });
}
