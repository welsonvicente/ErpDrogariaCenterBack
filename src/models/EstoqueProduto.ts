import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numericTransformer } from '../utils/numericTransformer';
import { Organizacao } from './Organizacao';

export enum StatusAcaoEstoque {
  NAO_INICIADO = 'NAO_INICIADO',
  PLANEJADO = 'PLANEJADO',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  CONCLUIDO = 'CONCLUIDO',
  NAO_APLICAVEL = 'NAO_APLICAVEL',
}

/**
 * Produto do relatório de produtos parados do Trier, por organização.
 *
 * O produto é identificado pelo **código reduzido do Trier** (`codigoTrier`) —
 * é ele que liga uma importação nova ao que já foi cadastrado, então é o que
 * permite atualizar o relatório sem perder as ações e observações da gestão.
 *
 * Dois grupos de colunas com donos diferentes:
 *  - **dados do relatório** (código de barras ... preço da última compra): vêm do
 *    arquivo e são sobrescritos a cada importação "atualizar";
 *  - **dados da gestão** (preço de venda, plano de ação, status, responsável...):
 *    digitados por quem usa o sistema, NUNCA tocados por uma importação.
 *
 * Todo campo numérico/texto que o relatório pode não trazer é `null` — que
 * significa "não informado", diferente de zero ou de vazio.
 */
@Entity('estoque_produtos')
@Index(['organizacaoId', 'codigoTrier'], { unique: true })
@Index(['organizacaoId', 'ativo'])
export class EstoqueProduto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  // ---- dados do relatório do Trier ----

  @Column({ name: 'codigo_trier', type: 'varchar', length: 40 })
  codigoTrier!: string;

  @Column({ name: 'codigo_barras', type: 'varchar', length: 40, nullable: true })
  codigoBarras!: string | null;

  @Column({ type: 'varchar', length: 255 })
  produto!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  laboratorio!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  grupo!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  fornecedor!: string | null;

  @Column({ name: 'estoque_minimo', type: 'numeric', precision: 14, scale: 3, nullable: true, transformer: numericTransformer })
  estoqueMinimo!: number | null;

  @Column({ type: 'numeric', precision: 14, scale: 3, nullable: true, transformer: numericTransformer })
  demanda!: number | null;

  /** Saldo (quantidade) em estoque. */
  @Column({ type: 'numeric', precision: 14, scale: 3, nullable: true, transformer: numericTransformer })
  saldo!: number | null;

  @Column({ name: 'custo_unitario', type: 'numeric', precision: 14, scale: 4, nullable: true, transformer: numericTransformer })
  custoUnitario!: number | null;

  /** Valor total em estoque como o relatório trouxe; quando ausente, o front calcula saldo × custo. */
  @Column({ name: 'valor_total', type: 'numeric', precision: 16, scale: 2, nullable: true, transformer: numericTransformer })
  valorTotal!: number | null;

  @Column({ name: 'data_ultima_entrada', type: 'date', nullable: true })
  dataUltimaEntrada!: string | null;

  @Column({ name: 'qtd_ultima_compra', type: 'numeric', precision: 14, scale: 3, nullable: true, transformer: numericTransformer })
  qtdUltimaCompra!: number | null;

  @Column({ name: 'preco_ultima_compra', type: 'numeric', precision: 14, scale: 4, nullable: true, transformer: numericTransformer })
  precoUltimaCompra!: number | null;

  /** false = o produto não veio na importação mais recente (saiu do relatório), mas o histórico e o plano de ação dele continuam guardados. */
  @Column({ type: 'boolean', default: true })
  ativo!: boolean;

  /** Última importação que trouxe/atualizou este produto. Sem FK de propósito: apagar um registro de importação não pode apagar produtos. */
  @Column({ name: 'importacao_id', type: 'uuid', nullable: true })
  importacaoId!: string | null;

  // ---- dados da gestão (nunca sobrescritos por importação) ----

  /** O relatório de parados não traz preço de venda — quem usa o simulador informa. */
  @Column({ name: 'preco_venda', type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: numericTransformer })
  precoVenda!: number | null;

  @Column({ name: 'acao_recomendada', type: 'text', nullable: true })
  acaoRecomendada!: string | null;

  @Column({ type: 'text', nullable: true })
  objetivo!: string | null;

  @Column({ name: 'como_executar', type: 'text', nullable: true })
  comoExecutar!: string | null;

  @Column({ name: 'status_acao', type: 'enum', enum: StatusAcaoEstoque, enumName: 'estoque_produtos_status_acao_enum', default: StatusAcaoEstoque.NAO_INICIADO })
  statusAcao!: StatusAcaoEstoque;

  @Column({ type: 'varchar', length: 120, nullable: true })
  responsavel!: string | null;

  @Column({ name: 'data_inicio', type: 'date', nullable: true })
  dataInicio!: string | null;

  @Column({ type: 'date', nullable: true })
  prazo!: string | null;

  @Column({ type: 'text', nullable: true })
  observacoes!: string | null;

  @Column({ type: 'text', nullable: true })
  resultado!: string | null;

  @Column({ name: 'quantidade_atualizada', type: 'numeric', precision: 14, scale: 3, nullable: true, transformer: numericTransformer })
  quantidadeAtualizada!: number | null;

  /** Marcado pela gestão: vale tentar troca/devolução com o fornecedor. */
  @Column({ name: 'negociar_fornecedor', type: 'boolean', default: false })
  negociarFornecedor!: boolean;

  /** Quando a gestão mexeu pela última vez em algum campo do plano de ação. */
  @Column({ name: 'acao_atualizada_em', type: 'timestamp', nullable: true })
  acaoAtualizadaEm!: Date | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
