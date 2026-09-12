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

  /**
   * Colaborador que recebe o valor lançado — usado hoje pela categoria
   * "Diária de domingo ou feriado" (quem lançou o gasto não é necessariamente
   * quem recebeu a diária). Nulo para as demais categorias. `SET NULL` em vez
   * de `RESTRICT` porque essa é só uma informação complementar da despesa,
   * não o dono do lançamento — remover o funcionário não deveria travar nada.
   */
  @ManyToOne(() => Usuario, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'beneficiario_id' })
  beneficiario!: Usuario | null;

  @Column({ name: 'beneficiario_id', nullable: true })
  beneficiarioId!: string | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
