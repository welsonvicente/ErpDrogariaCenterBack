import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source';
import { logger } from '../config/logger';
import { Categoria } from '../models/Categoria';
import { Organizacao } from '../models/Organizacao';
import { PerfilUsuario, Usuario } from '../models/Usuario';

/**
 * Popula o banco com dados iniciais para o ambiente rodar de fato:
 *  - a organização "Drogaria Center" (slug usado nas rotas do front);
 *  - categorias padrão de despesa (mesmas do protótipo original);
 *  - um usuário ADMIN para o primeiro login do dashboard.
 *
 * Idempotente: pode ser rodado várias vezes sem duplicar registros.
 * Uso: npm run seed
 */
const ORGANIZACAO_PADRAO = {
  nome: 'Drogaria Center',
  slug: 'drogariacenter',
};

const CATEGORIAS_PADRAO = [
  { nome: 'Combustível', icone: '⛽' },
  { nome: 'Manutenção da moto', icone: '🔧' },
  { nome: 'Óleo da moto', icone: '🛢️' },
  { nome: 'Material de limpeza', icone: '🧹' },
  { nome: 'Cabine de aplicação', icone: '🧴' },
  { nome: 'Uso e consumo e faxina', icone: '🧼' },
  { nome: 'Consumo interno - material de escritório', icone: '📎' },
  { nome: 'Uniformes', icone: '👕' },
  { nome: 'Embalagens e impressos', icone: '📦' },
  { nome: 'Produto avulso e valor', icone: '🏷️' },
  { nome: 'Entregador terceirizado', icone: '🛵' },
  { nome: 'Diária de domingo ou feriado', icone: '📅' },
  { nome: 'Retirada de vitaminas ou produtos de campanha', icone: '💊' },
  { nome: 'Outros', icone: '✳️' },
];

const ADMIN_PADRAO = {
  nome: 'Administrador Drogaria Center',
  email: 'admin@drogariacenter.local',
  senha: 'TrocarSenha@123',
};

async function seedOrganizacao(): Promise<Organizacao> {
  const repo = AppDataSource.getRepository(Organizacao);

  let organizacao = await repo.findOne({ where: { slug: ORGANIZACAO_PADRAO.slug } });
  if (!organizacao) {
    organizacao = await repo.save(repo.create(ORGANIZACAO_PADRAO));
    logger.info(`Organização seedada: ${organizacao.nome} (${organizacao.slug})`);
  }

  return organizacao;
}

async function seedCategorias(organizacaoId: string) {
  const repo = AppDataSource.getRepository(Categoria);

  for (const [index, cat] of CATEGORIAS_PADRAO.entries()) {
    const existente = await repo.findOne({ where: { organizacaoId, nome: cat.nome } });
    if (existente) continue;

    await repo.save(repo.create({ organizacaoId, nome: cat.nome, icone: cat.icone, ordem: index }));
    logger.info(`Categoria seedada: ${cat.nome}`);
  }
}

async function seedAdmin(organizacaoId: string) {
  const repo = AppDataSource.getRepository(Usuario);

  const existente = await repo.findOne({ where: { organizacaoId, email: ADMIN_PADRAO.email } });
  if (existente) {
    logger.info('Usuário admin padrão já existe, seed pulado.');
    return;
  }

  const senhaHash = await bcrypt.hash(ADMIN_PADRAO.senha, 10);
  await repo.save(
    repo.create({
      organizacaoId,
      nome: ADMIN_PADRAO.nome,
      email: ADMIN_PADRAO.email,
      senhaHash,
      perfil: PerfilUsuario.ADMIN,
    }),
  );

  logger.warn(
    `Usuário admin padrão criado: organização "${ORGANIZACAO_PADRAO.slug}", e-mail ${ADMIN_PADRAO.email} / senha inicial "${ADMIN_PADRAO.senha}" — troque a senha após o primeiro login.`,
  );
}

async function run() {
  await AppDataSource.initialize();
  const organizacao = await seedOrganizacao();
  await seedCategorias(organizacao.id);
  await seedAdmin(organizacao.id);
  await AppDataSource.destroy();
  logger.info('Seed concluído.');
}

run().catch((error) => {
  logger.error('Falha ao rodar o seed', { error });
  process.exit(1);
});
