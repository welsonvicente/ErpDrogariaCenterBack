import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';

/**
 * Loga toda requisição HTTP (método, rota, status, tempo de resposta).
 * Essencial para reconstruir "o que aconteceu" ao investigar um bug relatado
 * pelo usuário, sem precisar reproduzir o problema localmente.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(level, `${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`, {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
    });
  });

  next();
}
