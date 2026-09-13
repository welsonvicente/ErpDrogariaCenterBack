import 'reflect-metadata';
import { AppDataSource } from '../config/data-source';

/**
 * Roda antes/depois de cada arquivo de teste (setupFilesAfterEnv) — conecta
 * no banco de TESTE (.env.test, nunca o de desenvolvimento) uma vez por
 * arquivo e desconecta ao final, já que o Jest reseta o registro de módulos
 * (e portanto o singleton AppDataSource) entre arquivos.
 */
beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});
