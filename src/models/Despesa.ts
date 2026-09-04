import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Categoria } from './Categoria';
import { Organizacao } from './Organizacao';
import { Usuario } from './Usuario';

export enum FormaPagamento {
  DINHEIRO = 'DINHEIRO',
  CARTAO_DEBITO = 'CARTAO_DEBITO',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  OUTRO = 'OUTRO',
}

/** Lançamento de despesa feito por um usuário (perfil FUNCIONARIO, em geral). */
@Entity('despesas')
export class Despesa {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  /** Data do gasto (não confundir com criadoEm, que é quando foi lançado no sistema). */
  @Column({ type: 'date' })
  data!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  valor!: string;

  @Column({ type: 'enum', enum: FormaPagamento, name: 'forma_pagamento', default: FormaPagamento.DINHEIRO })
  formaPagamento!: FormaPagamento;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descricao!: string | null;

  @ManyToOne(() => Usuario, (usuario) => usuario.despesas, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ name: 'usuario_id' })
  usuarioId!: string;

  @ManyToOne(() => Categoria, (categoria) => categoria.despesas, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoria_id' })
  categoria!: Categoria;

  @Column({ name: 'categoria_id' })
  categoriaId!: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
