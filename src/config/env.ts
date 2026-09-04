import dotenv from 'dotenv';

dotenv.config();

/**
 * Lê uma variável de ambiente obrigatória.
 * Lança erro na inicialização (fail-fast) em vez de deixar o app subir "quebrado".
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}. Verifique o arquivo .env (veja .env.example).`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3333),

  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'drogaria_center_erp',
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },

  logLevel: process.env.LOG_LEVEL ?? 'info',

  /**
   * Origens do front autorizadas a chamar a API (CORS). Lista separada por
   * vírgula em CORS_ORIGINS; sem essa variável, cai nos endereços de
   * desenvolvimento local (localhost e rede local na porta padrão do Vite).
   */
  corsOrigins: (
    process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export const isProduction = env.nodeEnv === 'production';
