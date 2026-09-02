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

  @OneToMany(() => Despesa, (despesa) => despesa.categoria)
  despesas!: Despesa[];

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
