import { env } from '../config/env';
import { logger } from '../config/logger';
import { BuscarImagemDTO } from '../dtos/cartaz.dto';
import { AppError } from '../utils/AppError';

const SYSTEM_PROMPT =
  'Você ajuda a encontrar uma URL direta de imagem de um produto farmacêutico/consumo, a partir do nome e do ' +
  'código de barras (EAN), pesquisando na web (sites de fabricante, distribuidoras, e-commerces). Responda ' +
  'SOMENTE com um objeto JSON válido, sem markdown, sem texto antes ou depois, no formato: ' +
  '{"image_url":"https://..."} apontando para uma URL que termine em .jpg, .png ou .webp e que mostre ' +
  'claramente a embalagem do produto. Se não encontrar nada confiável, responda {"image_url":null}.';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

/**
 * Busca de imagem de produto por IA, usada pela ferramenta de Cartazes
 * (modo "Importar planilha" → "buscar automaticamente"). Mora no backend
 * (não no navegador) por dois motivos: a chave da Anthropic nunca pode ir
 * pro código do cliente, e a chamada usa a ferramenta de busca na web, que
 * tem custo por requisição — melhor controlar isso atrás de autenticação.
 */
export class CartazService {
  static async buscarImagem({ descricao, ean }: BuscarImagemDTO): Promise<string | null> {
    if (!env.anthropicApiKey) {
      throw AppError.conflict('Busca automática de imagem não está configurada nesta instalação.');
    }

    const userMessage = `Produto: ${descricao}${ean ? ` | EAN: ${ean}` : ''}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    if (!response.ok) {
      const corpo = await response.text();
      logger.warn('Falha na busca de imagem via Anthropic', { status: response.status, corpo });
      throw AppError.conflict('Não foi possível buscar a imagem agora. Tente novamente mais tarde.');
    }

    const data = (await response.json()) as { content?: AnthropicContentBlock[] };
    const textBlocks = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '');
    const cleaned = textBlocks.join('\n').trim().replace(/```json|```/g, '').trim();

    let parsed: { image_url: string | null };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { image_url: null };
    }

    return parsed.image_url ?? null;
  }
}
