import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organizacao } from './Organizacao';
import { Usuario } from './Usuario';

/** Qual dos três modos de Cartazes esse projeto pertence — decide como o front interpreta `estadoEditor`. */
export enum TipoProjetoCartaz {
  STORY = 'story',
  PANFLETO = 'panfleto',
  PLANILHA = 'planilha',
}

/**
 * Projeto/rascunho nomeado de Cartazes (Story, Panfleto ou Importar planilha)
 * — substitui o antigo "rascunho implícito" que só existia em `localStorage`
 * (um por modo, sem nome, perdido ao trocar de aparelho). Guardado por
 * organização pra ficar acessível de qualquer aparelho logado nela, igual
 * `ArquivoImportado` já faz pra planilha original.
 *
 * `estadoEditor` guarda tudo que hoje é "rascunho" no front (nome, preços,
 * posições, cores, lista de produtos) — o mesmo formato que já existe em
 * `cartazPersistencia.ts`, só que os campos de imagem passam a referenciar um
 * `ArquivoCartaz.id` em vez de um `imgSrc` em base64. O front é quem conhece a
 * forma exata desse JSON por tipo; o backend só guarda e devolve.
 */
@Entity('projetos_cartaz')
export class ProjetoCartaz {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Index()
  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  /**
   * Quem criou — só informativo (aparece na lista de projetos). `SET NULL`
   * porque isso é um dado complementar do projeto, não o dono de verdade: o
   * projeto pertence à organização (ver isolamento por `organizacaoId`), e
   * remover o usuário não deveria arrastar o projeto com ele.
   */
  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'criado_por_id' })
  criadoPor!: Usuario | null;

  @Column({ name: 'criado_por_id', nullable: true })
  criadoPorId!: string | null;

  @Column({ type: 'enum', enum: TipoProjetoCartaz })
  tipo!: TipoProjetoCartaz;

  @Column({ length: 120 })
  nome!: string;

  @Column({ name: 'estado_editor', type: 'jsonb', default: {} })
  estadoEditor!: Record<string, unknown>;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
