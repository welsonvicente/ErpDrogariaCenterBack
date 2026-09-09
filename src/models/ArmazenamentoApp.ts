import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Organizacao } from './Organizacao';

/**
 * Armazenamento chave-valor simples, por organização, para ferramentas
 * auxiliares fora do bundle do React (ver public/tools/*.html) que
 * precisam persistir um estado compartilhado (ex.: a ferramenta de Folgas)
 * sem justificar um schema relacional próprio.
 */
@Entity('armazenamento_app')
@Unique('uk_armazenamento_app_organizacao_chave', ['organizacaoId', 'chave'])
export class ArmazenamentoApp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ length: 120 })
  chave!: string;

  @Column({ type: 'text' })
  valor!: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
