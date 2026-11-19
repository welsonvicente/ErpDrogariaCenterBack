import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organizacao } from './Organizacao';

export enum ModoImportacaoEstoque {
  /** Atualiza o que já existe pelo código Trier, preservando plano de ação e observações. */
  ATUALIZAR = 'ATUALIZAR',
  /** Descarta tudo que existia (inclusive ações) e começa do zero com o arquivo. */
  SUBSTITUIR = 'SUBSTITUIR',
  /** Reaplicou os dados de uma importação anterior (modo ATUALIZAR, a partir do snapshot guardado). */
  RESTAURACAO = 'RESTAURACAO',
}

export interface ResumoImportacaoEstoque {
  novos: number;
  atualizados: number;
  /** Já existiam e não vieram neste arquivo — ficam guardados, marcados como fora do relatório. */
  saiuDoRelatorio: number;
  /** Linhas descartadas na leitura do arquivo (vazias, sem código, duplicadas). */
  ignoradas: number;
  /** Produtos que existiam antes e foram apagados (só no modo SUBSTITUIR). */
  removidos: number;
}

/**
 * Registro de cada importação do relatório do Trier. Guarda um **snapshot**
 * (`linhas`) dos dados que o arquivo trouxe — é ele que permite "restaurar uma
 * importação anterior" sem depender de o arquivo original ainda existir.
 * O snapshot só tem dados do relatório; ações e observações vivem no produto.
 */
@Entity('estoque_importacoes')
@Index(['organizacaoId', 'criadoEm'])
export class EstoqueImportacao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ name: 'nome_arquivo', type: 'varchar', length: 255 })
  nomeArquivo!: string;

  @Column({ type: 'enum', enum: ModoImportacaoEstoque, enumName: 'estoque_importacoes_modo_enum' })
  modo!: ModoImportacaoEstoque;

  /** Linhas de dados lidas no arquivo (incluindo as ignoradas). */
  @Column({ name: 'total_linhas', type: 'int', default: 0 })
  totalLinhas!: number;

  /** Produtos válidos que entraram. */
  @Column({ name: 'total_produtos', type: 'int', default: 0 })
  totalProdutos!: number;

  @Column({ type: 'jsonb' })
  resumo!: ResumoImportacaoEstoque;

  @Column({ type: 'jsonb' })
  linhas!: Array<Record<string, unknown>>;

  /**
   * O .xlsx original enviado, guardado inteiro (bytea) pra poder baixar de novo de qualquer
   * aparelho. Fica nesta tabela, e não em `arquivos_importados`, porque aquela é a lista de
   * planilhas de Cartazes — misturar faria os arquivos de estoque aparecerem lá.
   * Nunca entra nas listagens (só no download), por isso o `select` explícito do repositório.
   */
  @Column({ name: 'arquivo_original', type: 'bytea', nullable: true })
  arquivoOriginal!: Buffer | null;

  @Column({ name: 'arquivo_mime', type: 'varchar', length: 120, nullable: true })
  arquivoMime!: string | null;

  @Column({ name: 'arquivo_tamanho', type: 'int', nullable: true })
  arquivoTamanho!: number | null;

  /** Quando é uma restauração: de qual importação veio. */
  @Column({ name: 'restaurada_de_id', type: 'uuid', nullable: true })
  restauradaDeId!: string | null;

  @Column({ name: 'usuario_nome', type: 'varchar', length: 160, nullable: true })
  usuarioNome!: string | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;
}
