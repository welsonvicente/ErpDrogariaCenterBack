import 'reflect-metadata';
import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import routes from './routes';

/**
 * Monta a aplicação Express (sem subir o servidor HTTP nem conectar ao
 * banco). Separado de server.ts para permitir testes de integração que
 * importem `app` diretamente, sem precisar abrir uma porta de rede.
 */
export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        // Sem "origin" = requisição sem navegador (curl, health check, etc.) — sempre permitida.
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        logger.warn('Origem bloqueada pelo CORS', { origin, permitidas: env.corsOrigins });
        callback(new Error('Origem não autorizada pelo CORS.'));
      },
    }),
  );
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api', routes);

  // 404 para qualquer rota não mapeada.
  app.use((req, res) => {
    res.status(404).json({ message: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
  });

  // Precisa ser o último middleware registrado.
  app.use(errorHandler);

  return app;
}
