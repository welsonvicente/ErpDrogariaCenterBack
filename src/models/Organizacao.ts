import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Empresa cliente do ERP (multi-tenant). Tudo no sistema — usuários,
 * categorias, despesas, e futuros módulos — pertence a uma Organizacao.
 *
 * O `slug` identifica a organização em rotas públicas (ex.: login do
 * funcionário), como "drogariacenter".
 */
@Entity('organizacoes')
export class Organizacao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  nome!: string;

  @Column({ unique: true, length: 60 })
  slug!: string;

  @Column({ default: true })
  ativo!: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
