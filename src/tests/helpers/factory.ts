import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppDataSource } from '../../config/data-source';
import { Categoria } from '../../models/Categoria';
import { Organizacao } from '../../models/Organizacao';
import { PerfilUsuario, Usuario } from '../../models/Usuario';

/** Sufixo aleatório pra nunca colidir com uniques (slug, código, e-mail) entre testes que rodam na mesma organização/tabela. */
function sufixo() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function criarOrganizacao(overrides: Partial<Organizacao> = {}) {
  const repo = AppDataSource.getRepository(Organizacao);
  return repo.save(
    repo.create({ nome: 'Farmácia Teste', slug: 'farmacia-teste-' + sufixo(), ativo: true, ...overrides }),
  );
}

/** Rounds baixos (não é a mesma constante do UsuarioService) só pra bcrypt não deixar a suíte lenta — nunca usar isso fora de teste. */
const SALT_ROUNDS_TESTE = 4;

export async function criarAdmin(organizacaoId: string, overrides: Partial<Usuario> = {}) {
  const repo = AppDataSource.getRepository(Usuario);
  const senhaHash = await bcrypt.hash('SenhaTeste@123', SALT_ROUNDS_TESTE);
  return repo.save(
    repo.create({
      organizacaoId,
      nome: 'Admin Teste',
      email: `admin-${sufixo()}@teste.local`,
      senhaHash,
      perfil: PerfilUsuario.ADMIN,
      ativo: true,
      ...overrides,
    }),
  );
}

export async function criarFuncionario(organizacaoId: string, overrides: Partial<Usuario> = {}) {
  const repo = AppDataSource.getRepository(Usuario);
  const pinHash = await bcrypt.hash('1234', SALT_ROUNDS_TESTE);
  return repo.save(
    repo.create({
      organizacaoId,
      nome: 'Funcionário Teste',
      codigo: 'F' + sufixo().slice(-8),
      pinHash,
      perfil: PerfilUsuario.FUNCIONARIO,
      ativo: true,
      icone: '🙂',
      ...overrides,
    }),
  );
}

export async function criarCategoria(organizacaoId: string, overrides: Partial<Categoria> = {}) {
  const repo = AppDataSource.getRepository(Categoria);
  return repo.save(
    repo.create({
      organizacaoId,
      nome: 'Categoria Teste ' + sufixo(),
      icone: '✳️',
      ordem: 0,
      ativo: true,
      exigeBeneficiario: false,
      ...overrides,
    }),
  );
}

/** Token JWT no mesmo formato que AuthService gera — evita passar pelo login de verdade (bcrypt+senha) em todo teste. */
export function gerarToken(usuario: Pick<Usuario, 'id' | 'organizacaoId' | 'perfil' | 'email'>, via: 'senha' | 'pin' = usuario.email ? 'senha' : 'pin') {
  return jwt.sign(
    { sub: usuario.id, organizacaoId: usuario.organizacaoId, perfil: usuario.perfil, email: usuario.email, via },
    env.jwt.secret,
    { expiresIn: '1h' },
  );
}
