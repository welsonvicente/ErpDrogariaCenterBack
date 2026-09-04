import { Request, Response } from 'express';
import { z } from 'zod';
import { registrarOrganizacaoSchema } from '../dtos/registro.dto';
import { RegistroService } from '../services/RegistroService';

const slugQuerySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});

export class RegistroController {
  static async slugDisponivel(req: Request, res: Response) {
    const { slug } = slugQuerySchema.parse(req.query);
    const disponivel = await RegistroService.slugDisponivel(slug);
    res.status(200).json({ disponivel });
  }

  static async registrarOrganizacao(req: Request, res: Response) {
    const data = registrarOrganizacaoSchema.parse(req.body);
    const result = await RegistroService.registrarOrganizacao(data);
    res.status(201).json(result);
  }
}
