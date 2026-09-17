import bcrypt from 'bcryptjs';
import { logger } from '../config/logger';
import { AtualizarFuncionarioDTO, CriarFuncionarioDTO } from '../dtos/usuario.dto';
import { PerfilUsuario, Usuario } from '../models/Usuario';
import { DespesaRepository } from '../repositories/DespesaRepository';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { AppError } from '../utils/AppError';
import { AuditoriaService } from './AuditoriaService';

const SALT_ROUNDS = 10;

/** Remove campos sensíveis (hashes) antes de devolver o usuário pela API. */
function sanitize(usuario: Usuario) {
  const { pinHash, senhaHash, ...publico } = usuario;
  return publico;
}

/** Gestão de funcionários (perfil FUNCIONARIO) dentro de uma organização, feita pelo gerente/admin. */
export class UsuarioService {
  /** Busca interna (traz hashes) — usada só para validações antes de update/deactivate. */
  private static async findOrFail(organizacaoId: string, id: string) {
    const usuario = await UsuarioRepository.findByIdInOrganizacao(organizacaoId, id);
    if (!usuario) throw AppError.notFound('Funcionário', id);
    return usuario;
  }

  /**
   * Quem administra (ADMIN/GERENTE) só é mexido por um ADMIN.
   *
   * Sem isto, um GERENTE podia gravar código+PIN na conta do ADMIN e entrar como
   * ele, ou simplesmente excluí-la — as rotas de `usuario.routes.ts` só exigiam
   * `requireGerente`, e o alvo era buscado por `findByIdInOrganizacao`, que não
   * filtra por papel. Como agora o ADMIN tem poderes que o GERENTE não tem
   * (ver middlewares/requireAdmin), isso virou escalada de privilégio de fato.
   *
   * `autorEhAdmin` vem de quem está autenticado; as rotas de ADMIN já barram
   * antes, isto é a defesa da camada de negócio.
   */
  private static assertPodeGerenciar(alvo: Usuario, autorEhAdmin: boolean) {
    if (alvo.perfil === PerfilUsuario.FUNCIONARIO) return;
    if (autorEhAdmin) return;
    throw AppError.forbidden('Somente o administrador da organização pode alterar contas de gestão.');
  }

  /**
   * A organização precisa sempre ter ao menos um ADMIN ativo — senão ninguém
   * consegue mais editar os dados dela nem promover outra pessoa, e só dá pra
   * consertar mexendo direto no banco.
   */
  private static async assertNaoEhUltimoAdmin(alvo: Usuario, acao: string) {
    if (alvo.perfil !== PerfilUsuario.ADMIN) return;

    const admins = await UsuarioRepository.contarAdminsAtivos(alvo.organizacaoId);
    if (admins <= 1) {
      throw AppError.conflict(
        `Não é possível ${acao}: esta é a única conta de administrador ativa da organização. ` +
          'Promova outra pessoa a administrador antes.',
      );
    }
  }

  static async list(organizacaoId: string, incluirInativos = false) {
    const usuarios = await UsuarioRepository.findTodos(organizacaoId, incluirInativos);
    return usuarios.map(sanitize);
  }

  /**
   * Versão enxuta da lista de funcionários (só o essencial pra exibir num
   * seletor), aberta a qualquer usuário autenticado da organização — usada
   * pelo funcionário pra escolher "quem vai receber a diária" ao lançar um
   * gasto na categoria "Diária de domingo ou feriado". Diferente de `list`,
   * que traz o cadastro completo e é restrito ao gerente.
   */
  static async listColegas(organizacaoId: string) {
    // Todos os ativos, não só os de papel FUNCIONARIO: quem recebe uma diária ou
    // uma retirada de vitaminas é um colega qualquer, e gerentes também trabalham
    // no balcão. Filtrar por papel deixava essas pessoas de fora do seletor, sem
    // jeito de lançar o gasto no nome delas.
    const usuarios = await UsuarioRepository.findTodos(organizacaoId, false);
    return usuarios.map((u) => ({ id: u.id, nome: u.nome, icone: u.icone }));
  }

  static async getById(organizacaoId: string, id: string) {
    const usuario = await this.findOrFail(organizacaoId, id);
    return sanitize(usuario);
  }

  static async create(organizacaoId: string, data: CriarFuncionarioDTO) {
    const existente = await UsuarioRepository.findByCodigo(organizacaoId, data.codigo);
    if (existente) {
      throw AppError.conflict(`Já existe um funcionário com o código "${data.codigo}".`);
    }

    const pinHash = await bcrypt.hash(data.pin, SALT_ROUNDS);

    const usuario = await UsuarioRepository.create({
      organizacaoId,
      nome: data.nome,
      codigo: data.codigo,
      pinHash,
      icone: data.icone,
      perfil: PerfilUsuario.FUNCIONARIO,
    });

    logger.info('Funcionário criado', { usuarioId: usuario.id, organizacaoId, nome: usuario.nome });
    return sanitize(usuario);
  }

  /** `autorId` é quem está autenticado fazendo a alteração — usado só pra registrar na auditoria. */
  static async update(organizacaoId: string, id: string, autorId: string, data: AtualizarFuncionarioDTO, autorEhAdmin = false) {
    const existente = await this.findOrFail(organizacaoId, id);
    this.assertPodeGerenciar(existente, autorEhAdmin);

    if (data.ativo === false) {
      await this.assertNaoEhUltimoAdmin(existente, 'inativar');
    }

    if (data.codigo) {
      const jaExiste = await UsuarioRepository.findByCodigo(organizacaoId, data.codigo);
      if (jaExiste && jaExiste.id !== id) {
        throw AppError.conflict(`Já existe um funcionário com o código "${data.codigo}".`);
      }
    }

    const mudaPapel = data.perfil !== undefined && data.perfil !== existente.perfil;

    if (mudaPapel) {
      // Só o ADMIN define quem administra. Sem isto, um GERENTE se promoveria a
      // ADMIN sozinho — e o ADMIN deixaria de ser o dono de quem tem acesso.
      if (!autorEhAdmin) {
        throw AppError.forbidden('Somente o administrador da organização pode alterar o papel de alguém.');
      }
      // Rebaixar o último ADMIN deixaria a organização sem ninguém capaz de
      // promover outra pessoa — só o banco resolveria.
      if (existente.perfil === PerfilUsuario.ADMIN) {
        await this.assertNaoEhUltimoAdmin(existente, 'rebaixar');
      }
    }

    const papelFinal = data.perfil ?? existente.perfil;
    const temGestao = papelFinal === PerfilUsuario.ADMIN || papelFinal === PerfilUsuario.GERENTE;

    // Não há exigência de tamanho para o código, nem para quem tem papel de
    // gestão: ele é o identificador do funcionário dentro da organização, um
    // dado do negócio, e quem decide o formato é a empresa. O que protege a
    // conta é o PIN (6+ dígitos para gestão, definido pela própria pessoa) e o
    // rate limit por IP — um código curto não
    // enfraquece nenhum dos dois, já que o atacante ainda precisa do PIN e o
    // bloqueio conta por conta.

    const { pin, ...resto } = data;
    const alteracoes: Record<string, unknown> = { ...resto };
    if (pin) {
      alteracoes.pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
      // Um PIN definido por outra pessoa é um segredo que ela conhece — não serve
      // pra proteger o painel. Quem administra volta a ter que escolher o seu.
      alteracoes.pinForte = false;
    }

    // Promover a um papel de gestão zera o PIN forte: o painel só abre depois que
    // a própria pessoa definir um PIN à altura do que ele passa a abrir.
    if (mudaPapel && temGestao) {
      alteracoes.pinForte = false;
    }

    const atualizado = await UsuarioRepository.update(id, alteracoes);
    logger.info('Usuário atualizado', { usuarioId: id, organizacaoId, alteracoes: resto });

    // Promover/rebaixar é a mudança mais sensível que existe aqui — fica
    // registrada e consultável na auditoria pelo próprio gerente.
    if (mudaPapel) {
      const autor = await UsuarioRepository.findById(autorId);
      await AuditoriaService.registrar(
        organizacaoId,
        { nome: autor?.nome ?? '—', email: autor?.email ?? null },
        temGestao ? 'usuario.papel_promovido' : 'usuario.papel_rebaixado',
        `${existente.nome} (${existente.perfil} → ${papelFinal})`,
      );
    }

    return sanitize(atualizado!);
  }

  /** Inativação lógica (soft delete) — preserva o histórico de despesas já lançadas. */
  static async deactivate(organizacaoId: string, id: string, autorEhAdmin = false) {
    const existente = await this.findOrFail(organizacaoId, id);
    this.assertPodeGerenciar(existente, autorEhAdmin);
    await this.assertNaoEhUltimoAdmin(existente, 'inativar');

    const atualizado = await UsuarioRepository.update(id, { ativo: false });
    logger.info('Funcionário inativado', { usuarioId: id, organizacaoId });
    return sanitize(atualizado!);
  }

  static async activate(organizacaoId: string, id: string, autorEhAdmin = false) {
    const existente = await this.findOrFail(organizacaoId, id);
    this.assertPodeGerenciar(existente, autorEhAdmin);

    const atualizado = await UsuarioRepository.update(id, { ativo: true });
    logger.info('Funcionário ativado', { usuarioId: id, organizacaoId });
    return sanitize(atualizado!);
  }

  static async remove(organizacaoId: string, id: string, autorEhAdmin = false) {
    const existente = await this.findOrFail(organizacaoId, id);
    this.assertPodeGerenciar(existente, autorEhAdmin);
    await this.assertNaoEhUltimoAdmin(existente, 'excluir');

    const totalDespesas = await DespesaRepository.countByUsuario(id);
    if (totalDespesas > 0) {
      throw AppError.conflict(
        'Não é possível excluir: já existem despesas lançadas por este funcionário. Inative o funcionário em vez de excluí-lo.',
      );
    }

    await UsuarioRepository.remove(id);
    logger.info('Funcionário excluído', { usuarioId: id, organizacaoId });
  }
}
