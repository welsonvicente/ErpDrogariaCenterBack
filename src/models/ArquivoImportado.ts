import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organizacao } from './Organizacao';

/**
 * Arquivo enviado pela pessoa (hoje: a planilha usada em "Importar planilha"
 * de Cartazes) guardado no banco pra ficar acessível de qualquer aparelho
 * logado na mesma organização — antes disso, o arquivo só existia na memória
 * do navegador que fez o upload, então um import feito no computador nunca
 * aparecia no celular (e nem sobrevivia a fechar a aba).
 *
 * `conteudo` é o arquivo inteiro em binário (bytea) — arquivos pequenos
 * (planilhas sem foto embutida, no máximo alguns MB), então guardar no mesmo
 * Postgres da aplicação é suficiente; não há storage de objeto (S3/CDN)
 * configurado nesse projeto.
 */
@Entity('arquivos_importados')
export class ArquivoImportado {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Organizacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacao_id' })
  organizacao!: Organizacao;

  @Index()
  @Column({ name: 'organizacao_id' })
  organizacaoId!: string;

  @Column({ name: 'nome_original', length: 255 })
  nomeOriginal!: string;

  @Column({ name: 'mime_type', length: 120 })
  mimeType!: string;

  @Column({ name: 'tamanho_bytes' })
  tamanhoBytes!: number;

  @Column({ type: 'bytea' })
  conteudo!: Buffer;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm!: Date;
}
