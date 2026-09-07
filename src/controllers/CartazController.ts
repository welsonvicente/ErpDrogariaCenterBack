import { Request, Response } from 'express';
import { buscarImagemSchema } from '../dtos/cartaz.dto';
import { CartazService } from '../services/CartazService';

export class CartazController {
  static async buscarImagem(req: Request, res: Response) {
    const data = buscarImagemSchema.parse(req.body);
    const imageUrl = await CartazService.buscarImagem(data);
    res.status(200).json({ imageUrl });
  }
}
