import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organizacao } from './Organizacao';
import { Usuario } from './Usuario';

/**
 * Campanha de Cartazes (ex.: "Black Friday — semana 1"): agrupa os projetos
 * de Story, Panfleto e Importar planilha e guarda a folha A4 do Cartaz de
 * oferta. Trocar de campanha não mexe nas outras — dá pra ter várias em
 * andamento ao mesmo tempo, cada uma com as suas fotos e arquivos.
 *
 * `folhaOferta` é a folha do Cartaz de oferta desta campanha (antes era uma
 * preferência única da organização); o formato é do front, o backend só guarda.
 */
@Entity('campanhas_cartaz')
export class CampanhaCartaz {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Index('IDX_campanhas_cartaz_organizacao')
  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'criado_por_id' })
  criadoPor!: Usuario | null;

  @Column({ name: 'criado_por_id', nullable: true })
  criadoPorId!: string | null;

  @Column({ length: 120 })
  nome!: string;

  @Column({ name: 'folha_oferta', type: 'jsonb', default: {} })
  folhaOferta!: Record<string, unknown>;

  /**
   * Aparência própria da campanha — fundos, cores, posições e logomarca padrão de
   * Story/Panfleto/Tablet/Importar, por chave ('story', 'panfleto', 'planilha', 'logo_story';
   * mesmo formato das antigas preferências da organização). Mexer numa campanha não muda as outras.
   */
  @Column({ type: 'jsonb', default: {} })
  aparencia!: Record<string, unknown>;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm!: Date;
}
