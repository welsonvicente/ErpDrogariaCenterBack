import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numericTransformer } from '../utils/numericTransformer';
import { Organizacao } from './Organizacao';

export enum VereditoCritica {
  APROVADO = 'APROVADO',
  APROVADO_COM_RESSALVAS = 'APROVADO_COM_RESSALVAS',
  REPROVADO = 'REPROVADO',
}

/**
 * Crítica de pedido salva (conferência do pedido do CotaPreço contra o Trier).
 *
 * Guarda os **dados já lidos** dos dois PDFs (`pedido`, `relatorio`), as decisões
 * manuais e as tolerâncias — com isso o front refaz a auditoria idêntica ao
 * reabrir, sem depender de ler o PDF de novo — mais os **PDFs originais**
 * (bytea) para baixar depois. O formato interno dos jsonb é validado no dto; o
 * banco só guarda. Colunas de resumo ficam soltas pra listar sem abrir os jsonb.
 */
@Entity('criticas_pedido')
@Index(['organizacaoId', 'criadoEm'])
export class CriticaPedido {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ type: 'varchar', length: 200 })
  titulo!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  distribuidora!: string | null;

  @Column({ name: 'numero_pedido', type: 'varchar', length: 80, nullable: true })
  numeroPedido!: string | null;

  @Column({ name: 'periodo_trier', type: 'varchar', length: 80, nullable: true })
  periodoTrier!: string | null;

  @Column({ type: 'enum', enum: VereditoCritica, enumName: 'criticas_pedido_veredito_enum' })
  veredito!: VereditoCritica;

  @Column({ name: 'total_pedido', type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: numericTransformer })
  totalPedido!: number | null;

  @Column({ name: 'total_trier', type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: numericTransformer })
  totalTrier!: number | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: numericTransformer })
  diferenca!: number | null;

  /** Quantas linhas de cada resultado (OK, ATENCAO, DIVERGENCIA...) — pra mostrar na lista. */
  @Column({ type: 'jsonb' })
  contagens!: Record<string, number>;

  @Column({ type: 'jsonb' })
  pedido!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  relatorio!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  decisoes!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  tolerancias!: Record<string, number>;

  /** Motivo/observação que a pessoa anotou por linha da conferência (chave = chave estável da linha, ex.: "c3", "t7"). */
  @Column({ type: 'jsonb', default: {} })
  anotacoes!: Record<string, { motivo: string | null; texto: string }>;

  @Column({ name: 'pdf_cota_nome', type: 'varchar', length: 255, nullable: true })
  pdfCotaNome!: string | null;

  @Column({ name: 'pdf_cota', type: 'bytea', nullable: true })
  pdfCota!: Buffer | null;

  @Column({ name: 'pdf_trier_nome', type: 'varchar', length: 255, nullable: true })
  pdfTrierNome!: string | null;

  @Column({ name: 'pdf_trier', type: 'bytea', nullable: true })
  pdfTrier!: Buffer | null;

  @Column({ name: 'usuario_nome', type: 'varchar', length: 160, nullable: true })
  usuarioNome!: string | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
