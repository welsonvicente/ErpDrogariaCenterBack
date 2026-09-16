import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Despesa } from './Despesa';
import { Organizacao } from './Organizacao';

/**
 * Usuário central do ERP — todo mundo que acessa o sistema (de qualquer
 * módulo, atual ou futuro) é um Usuario vinculado a uma Organizacao.
 *
 * Dois jeitos de entrar, de acordo com o perfil:
 *  - ADMIN/GERENTE: e-mail + senha (login completo, acesso ao dashboard).
 *  - FUNCIONARIO: código + PIN (login rápido, pensado para uso no balcão,
 *    em terminal compartilhado, sem digitar senha longa).
 */
export enum PerfilUsuario {
  ADMIN = 'ADMIN',
  GERENTE = 'GERENTE',
  FUNCIONARIO = 'FUNCIONARIO',
}

@Entity('usuarios')
@Unique('uk_usuarios_organizacao_email', ['organizacaoId', 'email'])
@Unique('uk_usuarios_organizacao_codigo', ['organizacaoId', 'codigo'])
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ length: 120 })
  nome!: string;

  /** Obrigatório para ADMIN/GERENTE; opcional para FUNCIONARIO. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  email!: string | null;

  /** Hash bcrypt da senha (login de ADMIN/GERENTE). Nulo para FUNCIONARIO. */
  @Column({ type: 'varchar', name: 'senha_hash', nullable: true })
  senhaHash!: string | null;

  /** Código curto de identificação rápida (login de FUNCIONARIO), único por organização. */
  @Column({ type: 'varchar', length: 12, nullable: true })
  codigo!: string | null;

  /** Hash bcrypt do PIN numérico usado junto com o código. Nulo para ADMIN/GERENTE. */
  @Column({ type: 'varchar', name: 'pin_hash', nullable: true })
  pinHash!: string | null;

  /** Emoji/ícone exibido nas telas de seleção rápida. */
  @Column({ default: '🙂' })
  icone!: string;

  @Column({ type: 'enum', enum: PerfilUsuario, default: PerfilUsuario.FUNCIONARIO })
  perfil!: PerfilUsuario;

  @Column({ default: true })
  ativo!: boolean;

  /**
   * A pessoa já definiu, ela mesma, um PIN no padrão exigido de quem acessa o
   * Painel do Gerente (ver constants/credenciais.ts).
   *
   * Existe porque o papel muda o que o PIN protege: o de 4 dígitos foi escolhido
   * pra "lançar um gasto em meu nome", às vezes pelo próprio gerente que
   * cadastrou a pessoa. Em vez de um PIN padrão (que seria uma credencial de
   * fábrica conhecida — exatamente o problema que as senhas de papel tinham), o
   * acesso fica pendente até ela trocar o PIN no primeiro uso, provando saber o
   * antigo. Volta a false quando alguém é promovido a ADMIN/GERENTE ou quando um
   * gerente redefine o PIN de alguém — nos dois casos o segredo deixou de ser só dela.
   *
   * Só é cobrado de quem entra por PIN: quem entra por e-mail+senha não passa por
   * esta regra (ver middlewares/authMiddleware.requireGerente).
   */
  @Column({ name: 'pin_forte', default: false })
  pinForte!: boolean;

  @OneToMany(() => Despesa, (despesa) => despesa.usuario)
  despesas!: Despesa[];

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
