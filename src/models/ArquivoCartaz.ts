import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organizacao } from './Organizacao';
import { ProjetoCartaz } from './ProjetoCartaz';

/**
 * `pendente`: URL de upload já foi assinada, mas o backend ainda não
 * confirmou (via HEAD no R2) que o objeto foi mesmo enviado — pode nunca
 * chegar a existir (usuário cancelou, aba fechou, PUT falhou) ou pode existir
 * no R2 sem que o front tenha confirmado ainda (janela curta entre o PUT
 * terminar e a chamada de confirmação). `confirmado`: upload confirmado e
 * vinculado a um projeto — nunca apagado pelo job de limpeza de órfãos.
 */
export enum StatusArquivoCartaz {
  PENDENTE = 'pendente',
  CONFIRMADO = 'confirmado',
}

/**
 * Metadado de uma imagem usada num projeto de Cartazes — os bytes em si vivem
 * no Cloudflare R2 (key = `org/{organizacaoId}/{id}`, ver `config/r2Client.ts`),
 * nunca no Postgres. Fica com `projetoId` nulo desde que é criado (no momento
 * do presign) até o front confirmar o upload E informar a qual projeto ele
 * pertence — isso é o que separa um arquivo "temporário" de um "vinculado"
 * (ver job de limpeza em `jobs/limpezaArquivosCartazJob.ts`).
 *
 * Não guarda a extensão/nome original: o `mimeType` já basta pra decidir a
 * extensão da key no R2 e pro `Content-Type` do presigned GET.
 */
@Entity('arquivos_cartaz')
@Index(['status', 'criadoEm'])
export class ArquivoCartaz {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Index()
  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @ManyToOne(() => ProjetoCartaz, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'projeto_id' })
  projeto!: ProjetoCartaz | null;

  @Index()
  @Column({ name: 'projeto_id', nullable: true })
  projetoId!: string | null;

  /**
   * Só informativo — mesmo motivo de `ProjetoCartaz.criadoPorId`. Sem relação
   * `@ManyToOne` própria (não precisa carregar o Usuario aqui); `type: 'uuid'`
   * é explícito porque, sem uma relação com `@JoinColumn` no mesmo nome de
   * coluna pra TypeORM inferir o tipo a partir dela, a metadata emitida pelo
   * TS para `string | null` vira `Object` e a geração de migration falha.
   */
  @Column({ name: 'criado_por_id', type: 'uuid', nullable: true })
  criadoPorId!: string | null;

  @Column({ name: 'mime_type', length: 120 })
  mimeType!: string;

  @Column({ name: 'tamanho_bytes' })
  tamanhoBytes!: number;

  @Column({ type: 'enum', enum: StatusArquivoCartaz, default: StatusArquivoCartaz.PENDENTE })
  status!: StatusArquivoCartaz;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;
}
