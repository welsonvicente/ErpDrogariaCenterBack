import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';

/**
 * Middleware central de tratamento de erros — é o último elo da cadeia de
 * middlewares do Express (por isso recebe 4 argumentos, `err` incluso).
 *
 * Qualquer erro lançado (ou passado via `next(error)`) em controllers,
 * services ou repositórios acaba aqui. Isso mantém os controllers limpos
 * (sem try/catch repetido) e garante uma resposta HTTP consistente.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    logger.warn('Falha de validação de entrada', { path: req.originalUrl, issues: err.issues });
    return res.status(422).json({
      message: 'Dados inválidos.',
      issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  if (err instanceof AppError) {
    logger.warn(err.message, { path: req.originalUrl, statusCode: err.statusCode, details: err.details });
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }

  // Erro não mapeado: é um bug de verdade. Logamos com stack completo e nunca
  // vazamos detalhes internos para o cliente.
  // Obs.: um Error dentro de um objeto de metadata não é expandido automaticamente
  // pelo winston (só funciona quando o Error é o próprio `message` do log) — por
  // isso extraímos message/stack manualmente, senão o log mostra só "{}".
  const erroSerializado = err instanceof Error ? { message: err.message, stack: err.stack } : err;
  logger.error('Erro não tratado', { path: req.originalUrl, error: erroSerializado });
  return res.status(500).json({ message: 'Erro interno no servidor.' });
}
