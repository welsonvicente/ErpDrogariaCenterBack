/**
 * Erro "esperado" da aplicação (regra de negócio, validação, não encontrado...).
 * Controllers/middleware de erro usam `statusCode` para responder o HTTP certo
 * e distinguir isso de um bug inesperado (que vira 500 + log completo).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static notFound(entity: string, id?: string) {
    return new AppError(`${entity} não encontrado(a)${id ? ` (id: ${id})` : ''}.`, 404);
  }

  static conflict(message: string) {
    return new AppError(message, 409);
  }

  static unauthorized(message = 'Não autorizado.') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Acesso negado.') {
    return new AppError(message, 403);
  }
}
