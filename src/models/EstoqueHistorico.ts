import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organizacao } from './Organizacao';

export enum TipoHistoricoEstoque {
  IMPORTACAO = 'IMPORTACAO',
  RESTAURACAO = 'RESTAURACAO',
  /** Qualquer campo editado à mão num produto. */
  EDICAO = 'EDICAO',
  /** Mudança de status do plano de ação — a trilha de "o que foi executado". */
  ACAO = 'ACAO',
  CONFIG = 'CONFIG',
}

/**
 * Trilha de alterações do módulo de estoque. Código e nome do produto ficam
 * copiados aqui (em vez de só uma FK) pra o histórico continuar legível mesmo
 * depois de uma importação "substituir" apagar o produto.
 */
@Entity('estoque_historico')
@Index(['organizacaoId', 'criadoEm'])
export class EstoqueHistorico {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ type: 'enum', enum: TipoHistoricoEstoque, enumName: 'estoque_historico_tipo_enum' })
  tipo!: TipoHistoricoEstoque;

  @Column({ name: 'codigo_trier', type: 'varchar', length: 40, nullable: true })
  codigoTrier!: string | null;

  @Column({ name: 'produto_nome', type: 'varchar', length: 255, nullable: true })
  produtoNome!: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  campo!: string | null;

  @Column({ name: 'valor_anterior', type: 'text', nullable: true })
  valorAnterior!: string | null;

  @Column({ name: 'valor_novo', type: 'text', nullable: true })
  valorNovo!: string | null;

  @Column({ type: 'text', nullable: true })
  descricao!: string | null;

  @Column({ name: 'usuario_nome', type: 'varchar', length: 160, nullable: true })
  usuarioNome!: string | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;
}
