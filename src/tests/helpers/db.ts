import { AppDataSource } from '../../config/data-source';

/**
 * Limpa todas as tabelas de dado (nunca a tabela `migrations` do TypeORM) —
 * chamar no início de cada `describe` que precisa de um banco vazio.
 * `CASCADE` cuida da ordem das foreign keys sozinho.
 */
export async function resetDb() {
  await AppDataSource.query(`
    TRUNCATE TABLE
      despesas,
      categorias,
      usuarios,
      armazenamento_app,
      registros_auditoria,
      arquivos_importados,
      organizacoes
    RESTART IDENTITY CASCADE
  `);
}
