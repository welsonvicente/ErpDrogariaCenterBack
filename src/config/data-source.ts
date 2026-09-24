import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env, isProduction, isTest } from './env';
import { ArmazenamentoApp } from '../models/ArmazenamentoApp';
import { ArquivoImportado } from '../models/ArquivoImportado';
import { Categoria } from '../models/Categoria';
import { Despesa } from '../models/Despesa';
import { Organizacao } from '../models/Organizacao';
import { RegistroAuditoria } from '../models/RegistroAuditoria';
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
  // Em teste, alguns cenários exercitam de propósito um caminho de erro
  // esperado (ex.: violação de unique numa corrida de concorrência) — sem
  // silenciar aqui, a saída dos testes fica cheia de "erros" que na
  // verdade são o comportamento correto sendo testado.
  logging: isTest ? false : isProduction ? ['error', 'warn'] : ['error', 'warn', 'schema'],
  entities: [Organizacao, Usuario, Categoria, Despesa, ArmazenamentoApp, RegistroAuditoria, ArquivoImportado],
  migrations: [__dirname + '/../migrations/*.{ts,js}'],
});
