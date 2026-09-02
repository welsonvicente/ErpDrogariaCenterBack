import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Envolve um controller assíncrono e encaminha qualquer erro para o
 * errorHandler central (`next(error)`), evitando `try/catch` repetido em
 * cada controller.
 */
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
