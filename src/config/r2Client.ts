import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '../utils/AppError';
import { env } from './env';

/**
 * Cliente do Cloudflare R2, via API compatível com S3. Nunca recebe/entrega
 * bytes de imagem — só assina URLs (upload/download) que o front usa direto
 * com o R2, e confere metadados (`HeadObjectCommand`) na hora de confirmar um
 * upload. Ver PLANO da migração de Cartazes de Base64/localStorage pra R2.
 */

const TTL_UPLOAD_SEGUNDOS = 300; // 5 min — tempo de sobra pra um upload de foto de celular numa conexão ruim.
const TTL_DOWNLOAD_SEGUNDOS = 900; // 15 min — gerado sob demanda a cada leitura, nunca guardado.

let clienteCache: S3Client | null = null;

/**
 * Cria (ou reaproveita) o cliente S3 apontando pro endpoint do R2. Lança
 * AppError.conflict se as variáveis R2_* não estiverem configuradas — mesmo
 * padrão de `CartazService.buscarImagem` pra `ANTHROPIC_API_KEY`: a
 * funcionalidade fica indisponível com uma mensagem clara, em vez de estourar
 * um erro genérico ou deixar o resto do sistema fora do ar.
 */
function clienteR2(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = env.r2;
  if (!accountId || !accessKeyId || !secretAccessKey || !env.r2.bucket) {
    throw AppError.conflict('Armazenamento de imagens (Cloudflare R2) não está configurado nesta instalação.');
  }
  if (!clienteCache) {
    clienteCache = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return clienteCache;
}

/** Só é chamado depois de `clienteR2()` já ter validado que `env.r2.bucket` existe. */
function bucketR2(): string {
  return env.r2.bucket as string;
}

/** Key do objeto no bucket — um arquivo por `arquivoId`, sem mais hierarquia (a ligação com projeto/organização já mora no Postgres). */
export function chaveObjeto(organizacaoId: string, arquivoId: string): string {
  return `org/${organizacaoId}/${arquivoId}`;
}

/**
 * Presigned PUT — o front sobe o Blob direto pro R2 com essa URL, sem passar
 * pelo backend. O `Content-Type` devolvido tem que ser exatamente o header
 * enviado no PUT (a assinatura SigV4 quebra se divergir).
 */
export async function gerarUrlUpload(key: string, mimeType: string): Promise<{ url: string; expiraEm: Date }> {
  const client = clienteR2();
  const comando = new PutObjectCommand({ Bucket: bucketR2(), Key: key, ContentType: mimeType });
  const url = await getSignedUrl(client, comando, { expiresIn: TTL_UPLOAD_SEGUNDOS });
  return { url, expiraEm: new Date(Date.now() + TTL_UPLOAD_SEGUNDOS * 1000) };
}

/** Presigned GET — bucket privado, então toda leitura de imagem passa por aqui, gerada sob demanda. */
export async function gerarUrlDownload(key: string): Promise<string> {
  const client = clienteR2();
  const comando = new GetObjectCommand({ Bucket: bucketR2(), Key: key });
  return getSignedUrl(client, comando, { expiresIn: TTL_DOWNLOAD_SEGUNDOS });
}

/** `null` = objeto ainda não existe no R2 (upload não chegou a acontecer ou ainda está em andamento). */
export async function verificarObjetoEnviado(key: string): Promise<{ tamanhoBytes: number } | null> {
  const client = clienteR2();
  try {
    const resultado = await client.send(new HeadObjectCommand({ Bucket: bucketR2(), Key: key }));
    return { tamanhoBytes: resultado.ContentLength ?? 0 };
  } catch (erro) {
    const nome = (erro as { name?: string })?.name;
    const status = (erro as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (nome === 'NotFound' || nome === 'NoSuchKey' || status === 404) return null;
    throw erro;
  }
}

/** Apaga em lotes de 1000 (limite do `DeleteObjects` do S3) — sem erro se alguma key já não existir (delete é idempotente). */
export async function apagarObjetos(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const client = clienteR2();
  const TAMANHO_LOTE = 1000;
  for (let i = 0; i < keys.length; i += TAMANHO_LOTE) {
    const lote = keys.slice(i, i + TAMANHO_LOTE);
    await client.send(new DeleteObjectsCommand({ Bucket: bucketR2(), Delete: { Objects: lote.map((Key) => ({ Key })) } }));
  }
}
