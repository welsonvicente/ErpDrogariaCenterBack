import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organizacao } from './Organizacao';

/**
 * Trilha de ações sensíveis dentro de uma organização (quem editou/excluiu
 * um lançamento, quem concedeu o atalho pro painel do gestor a um
 * funcionário...) — hoje isso só existia como log estruturado do servidor
 * (não consultável pelo gestor pela tela). `usuarioNome`/`usuarioEmail` são
 * uma cópia do que era verdade no momento da ação (não uma referência viva
 * ao Usuario): assim o registro continua legível mesmo se aquela conta for
 * excluída depois.
 */
@Entity('registros_auditoria')
export class RegistroAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Index()
  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ name: 'usuario_nome', length: 120 })
  usuarioNome!: string;

  @Column({ name: 'usuario_email', type: 'varchar', length: 160, nullable: true })
  usuarioEmail!: string | null;

  /** Ex.: "despesa.editada", "despesa.excluida", "funcionario.acesso_gestor_concedido". */
  @Column({ length: 60 })
  acao!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  detalhes!: string | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;
}
