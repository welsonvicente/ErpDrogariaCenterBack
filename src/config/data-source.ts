import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env, isProduction } from './env';
import { Categoria } from '../models/Categoria';
import { Despesa } from '../models/Despesa';
import { Organizacao } from '../models/Organizacao';
import { Usuario } from '../models/Usuario';

/**
 * Fonte de dados única do TypeORM, usada tanto pela aplicação (server.ts)
 * quanto pela CLI de migrations (npm run migration:*).
 *
 * `synchronize` fica sempre false: em um ERP, alterações de schema devem
 * passar por migrations versionadas, nunca ser aplicadas "magicamente" ao
 * subir o servidor (isso evita perda de dados em produção).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.db.host,
  port: env.db.port,
  username: env.db.username,
  password: env.db.password,
  database: env.db.database,
  synchronize: false,
  logging: isProduction ? ['error', 'warn'] : ['error', 'warn', 'schema'],
  entities: [Organizacao, Usuario, Categoria, Despesa],
  migrations: [__dirname + '/../migrations/*.{ts,js}'],
});
