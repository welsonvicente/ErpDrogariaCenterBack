import { AppError } from '../utils/AppError';

/**
 * Testa a assinatura de URL de verdade (SigV4 não faz nenhuma chamada de
 * rede — é só criptografia local), então roda sem precisar de um bucket R2
 * real. As rotas/serviços que USAM este módulo mockam `r2Client` inteiro
 * (ver `routes/projetoCartaz.routes.test.ts` e `routes/arquivoCartaz.routes.test.ts`)
 * — aqui testamos só o módulo em si.
 */
describe('config/r2Client', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('recusa gerar URL de upload sem as variáveis R2_* configuradas', async () => {
    jest.doMock('./env', () => ({
      env: { r2: { accountId: null, accessKeyId: null, secretAccessKey: null, bucket: null } },
    }));
    const { gerarUrlUpload } = await import('./r2Client');

    await expect(gerarUrlUpload('org/1/abc', 'image/jpeg')).rejects.toThrow(AppError);
    await expect(gerarUrlUpload('org/1/abc', 'image/jpeg')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('gera uma URL de upload assinada válida quando R2 está configurado', async () => {
    jest.doMock('./env', () => ({
      env: {
        r2: {
          accountId: 'conta-teste',
          accessKeyId: 'chave-teste',
          secretAccessKey: 'segredo-teste',
          bucket: 'bucket-teste',
        },
      },
    }));
    const { gerarUrlUpload } = await import('./r2Client');

    const { url, expiraEm } = await gerarUrlUpload('org/org-1/arquivo-1', 'image/jpeg');

    expect(url).toMatch(/^https:\/\/bucket-teste\.conta-teste\.r2\.cloudflarestorage\.com\/org\/org-1\/arquivo-1\?/);
    expect(url).toContain('X-Amz-Signature=');
    expect(expiraEm.getTime()).toBeGreaterThan(Date.now());
  });

  it('gera uma URL de download assinada válida', async () => {
    jest.doMock('./env', () => ({
      env: {
        r2: {
          accountId: 'conta-teste',
          accessKeyId: 'chave-teste',
          secretAccessKey: 'segredo-teste',
          bucket: 'bucket-teste',
        },
      },
    }));
    const { gerarUrlDownload } = await import('./r2Client');

    const url = await gerarUrlDownload('org/org-1/arquivo-1');

    expect(url).toMatch(/^https:\/\/bucket-teste\.conta-teste\.r2\.cloudflarestorage\.com\/org\/org-1\/arquivo-1\?/);
    expect(url).toContain('X-Amz-Signature=');
  });

  it('chaveObjeto monta a key sem depender de configuração nenhuma', async () => {
    jest.doMock('./env', () => ({
      env: { r2: { accountId: null, accessKeyId: null, secretAccessKey: null, bucket: null } },
    }));
    const { chaveObjeto } = await import('./r2Client');

    expect(chaveObjeto('org-1', 'arquivo-1')).toBe('org/org-1/arquivo-1');
  });
});
