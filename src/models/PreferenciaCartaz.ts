import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organizacao } from './Organizacao';

/** Qual grupo de preferências — decide como o front interpreta `valor`. */
export enum ChavePreferenciaCartaz {
  /** Padrão do Story produto único (cores, letras, tamanhos, posições) — também o padrão dos stories de cada produto do Panfleto. */
  STORY = 'story',
  /** Configurações do Panfleto (textos, cores, tamanhos, itens por página...). */
  PANFLETO = 'panfleto',
  /** Cores dos stories gerados pelo Importar planilha. */
  PLANILHA = 'planilha',
  /** Logomarca padrão dos stories (referência ao arquivo no R2 + posição). */
  LOGO_STORY = 'logo_story',
}

/**
 * Preferências "padrão" de Cartazes, por organização — antes ficavam só no
 * `localStorage` do navegador, então cada perfil do Chrome/aparelho tinha as
 * suas e mudar a cor num computador não valia no outro. Agora valem em
 * qualquer lugar logado na organização. Uma linha por (organização, chave);
 * `valor` é um JSON cujo formato só o front conhece (ver
 * `cartazPersistencia.ts`), o backend só guarda e devolve.
 */
@Entity('preferencias_cartaz')
@Index(['organizacaoId', 'chave'], { unique: true })
export class PreferenciaCartaz {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ type: 'enum', enum: ChavePreferenciaCartaz })
  chave!: ChavePreferenciaCartaz;

  @Column({ type: 'jsonb', default: {} })
  valor!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
