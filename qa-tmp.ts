import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { AppDataSource } from './src/config/data-source';
import { CATEGORIAS_PADRAO } from './src/constants/categoriasPadrao';
import { Categoria } from './src/models/Categoria';
import { Organizacao } from './src/models/Organizacao';
import { PerfilUsuario, Usuario } from './src/models/Usuario';
(async () => {
  await AppDataSource.initialize();
  const orgRepo = AppDataSource.getRepository(Organizacao);
  const antiga = await orgRepo.findOne({ where: { slug: 'qa-menu' } });
  if (antiga) await orgRepo.remove(antiga);
  if (process.argv.includes('--limpar')) { console.log('LIMPO'); await AppDataSource.destroy(); return; }
  const org = await orgRepo.save(orgRepo.create({ nome: 'QA Menu', slug: 'qa-menu', ativo: true }));
  const u = AppDataSource.getRepository(Usuario);
  const admin = await u.save(u.create({ organizacaoId: org.id, nome: 'Welson Vicente', email: 'qamenu@teste.local', senhaHash: await bcrypt.hash('SenhaTeste@123', 10), perfil: PerfilUsuario.ADMIN, ativo: true, icone: '🧑‍💼' }));
  await u.save(u.create({ organizacaoId: org.id, nome: 'Maria Gerente', codigo: 'maria', pinHash: await bcrypt.hash('123456', 10), perfil: PerfilUsuario.GERENTE, ativo: true }));
  const c = AppDataSource.getRepository(Categoria);
  for (const [i, cat] of CATEGORIAS_PADRAO.entries()) {
    await c.save(c.create({ organizacaoId: org.id, nome: cat.nome, icone: cat.icone, ordem: i, exigeBeneficiario: cat.exigeBeneficiario ?? false }));
  }
  console.log(JSON.stringify({ adminId: admin.id }));
  await AppDataSource.destroy();
})();
