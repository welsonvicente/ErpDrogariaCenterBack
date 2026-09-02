import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env, isProduction } from './env';

/**
 * Logger central da aplicação (Winston).
 *
 * Por que existe: em produção não temos um debugger anexado ao processo, então
 * os logs são a principal ferramenta para investigar bugs. Por isso:
 *  - todo log tem timestamp e nível;
 *  - erros vão para um arquivo separado (error-*.log), facilitando achar
 *    rapidamente "o que quebrou" sem precisar filtrar o log geral;
 *  - em desenvolvimento, o console mostra tudo colorido e formatado.
 *
 * Uso recomendado nas outras camadas:
 *   logger.info('Descrição curta', { contexto: 'relevante' });
 *   logger.error('Falha ao salvar despesa', { error, expenseId });
 */

const logsDir = path.join(__dirname, '..', '..', 'logs');

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
);

const consoleFormat = winston.format.combine(
  baseFormat,
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${stack ?? message}${metaStr}`;
  }),
);

const fileFormat = winston.format.combine(baseFormat, winston.format.json());

export const logger = winston.createLogger({
  level: env.logLevel,
  format: fileFormat,
  defaultMeta: { service: 'drogaria-center-erp-backend' },
  transports: [
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
    }),
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
    }),
  ],
});

// Fora de produção, também loga no console (formatado e colorido) para facilitar
// o dia a dia de desenvolvimento.
if (!isProduction) {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  );
}
