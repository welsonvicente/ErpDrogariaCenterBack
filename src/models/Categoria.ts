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

/** Categoria de despesa (ex.: Combustível, Uniformes, Manutenção da moto...), específica de cada organização. */
@Entity('categorias')
@Unique('uk_categorias_organizacao_nome', ['organizacaoId', 'nome'])
export class Categoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ length: 120 })
  nome!: string;

  @Column({ default: '✳️' })
  icone!: string;

  /** Posição de exibição nas telas (menor = aparece primeiro). */
  @Column({ default: 0 })
  ordem!: number;

  @Column({ default: true })
  ativo!: boolean;

  /**
   * Quando true, lançar uma despesa nessa categoria exige informar quem
   * recebeu o valor (ver DespesaService.assertBeneficiario) — hoje usado
   * pela categoria "Diária de domingo ou feriado". Antes essa regra
   * comparava o nome da categoria por string; um gerente renomeando a
   * categoria fazia a exigência sumir sem aviso. Uma coluna própria
   * sobrevive a renomeações e permite marcar outras categorias no futuro.
   */
  @Column({ name: 'exige_beneficiario', default: false })
  exigeBeneficiario!: boolean;

  @OneToMany(() => Despesa, (despesa) => despesa.categoria)
  despesas!: Despesa[];

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
