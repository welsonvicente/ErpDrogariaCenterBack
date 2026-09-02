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
 *  - ADMIN/GESTOR: e-mail + senha (login completo, acesso ao dashboard).
 *  - FUNCIONARIO: código + PIN (login rápido, pensado para uso no balcão,
 *    em terminal compartilhado, sem digitar senha longa).
 */
export enum PerfilUsuario {
  ADMIN = 'ADMIN',
  GESTOR = 'GESTOR',
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

  /** Obrigatório para ADMIN/GESTOR; opcional para FUNCIONARIO. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  email!: string | null;

  /** Hash bcrypt da senha (login de ADMIN/GESTOR). Nulo para FUNCIONARIO. */
  @Column({ type: 'varchar', name: 'senha_hash', nullable: true })
  senhaHash!: string | null;

  /** Código curto de identificação rápida (login de FUNCIONARIO), único por organização. */
  @Column({ type: 'varchar', length: 12, nullable: true })
  codigo!: string | null;

  /** Hash bcrypt do PIN numérico usado junto com o código. Nulo para ADMIN/GESTOR. */
  @Column({ type: 'varchar', name: 'pin_hash', nullable: true })
  pinHash!: string | null;

  /** Emoji/ícone exibido nas telas de seleção rápida. */
  @Column({ default: '🙂' })
  icone!: string;

  @Column({ type: 'enum', enum: PerfilUsuario, default: PerfilUsuario.FUNCIONARIO })
  perfil!: PerfilUsuario;

  @Column({ default: true })
  ativo!: boolean;

  @OneToMany(() => Despesa, (despesa) => despesa.usuario)
  despesas!: Despesa[];

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
