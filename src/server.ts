import 'reflect-metadata';
import { createApp } from './app';
import { AppDataSource } from './config/data-source';
import { env } from './config/env';
import { logger } from './config/logger';

/**
 * Ponto de entrada do processo: conecta ao banco e só então sobe o HTTP.
 * Assim evitamos aceitar requisições enquanto o banco ainda não está pronto.
 */
async function bootstrap() {
  try {
    await AppDataSource.initialize();
    logger.info('Conexão com o banco de dados estabelecida', {
      host: env.db.host,
      database: env.db.database,
    });
  } catch (error) {
    logger.error('Falha ao conectar no banco de dados. Encerrando processo.', { error });
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`Servidor rodando em http://localhost:${env.port} (ambiente: ${env.nodeEnv})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`Sinal ${signal} recebido, encerrando servidor com segurança...`);
    server.close(async () => {
      await AppDataSource.destroy();
      logger.info('Servidor encerrado.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Promise rejeitada sem tratamento (unhandledRejection)', { reason });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Exceção não capturada (uncaughtException)', { error });
  });
}

bootstrap();
