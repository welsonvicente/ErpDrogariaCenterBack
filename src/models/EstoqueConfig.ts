import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organizacao } from './Organizacao';

/** Parâmetros editáveis da análise de estoque. Valores de fábrica em `CONFIG_ESTOQUE_PADRAO` (dto). */
export interface ConfigEstoque {
  /** Saldo mínimo de cada faixa: P1 ≥ p1Min, P2 ≥ p2Min (e < p1Min), P3, P4. Abaixo de p4Min não entra na priorização. */
  faixas: { p1Min: number; p2Min: number; p3Min: number; p4Min: number };
  /** "Faz tempo desde a última entrada" (alerta) e "faz muito tempo" (crítico). */
  diasAlerta: number;
  diasCritico: number;
  /** A partir de quantas unidades o saldo é considerado "estoque elevado" no dashboard. */
  estoqueElevadoMin: number;
  /** Margem bruta mínima (%) — o simulador avisa quando o novo preço fica abaixo dela. */
  margemMinimaPct: number;
  /** Pesos (qualquer escala; o front normaliza) da pontuação do ranking. */
  pesos: { quantidade: number; valor: number; tempo: number };
  /** O Trier exporta o grupo só como código ("30"). Aqui a gestão dá nome a cada código ("Suplementos"). */
  nomesGrupos: Record<string, string>;
  /**
   * Produtos cuja ÚLTIMA ENTRADA caiu neste período ficam fora das análises (ex.: o que chegou em
   * outubro e novembro ainda não é "parado"). `ate` null = até hoje; null/ausente = considera tudo.
   */
  desconsiderarEntradas?: { de: string | null; ate: string | null } | null;
}

/** Uma linha por organização. O formato do JSON é validado no dto; o banco só guarda. */
@Entity('estoque_config')
@Index(['organizacaoId'], { unique: true })
export class EstoqueConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ type: 'jsonb' })
  config!: ConfigEstoque;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
