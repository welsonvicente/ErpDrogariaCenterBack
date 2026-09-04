import { Router } from 'express';
import authRoutes from './auth.routes';
import categoriaRoutes from './categoria.routes';
import despesaRoutes from './despesa.routes';
import organizacaoRoutes from './organizacao.routes';
import perfilRoutes from './perfil.routes';
import registroRoutes from './registro.routes';
import usuarioRoutes from './usuario.routes';

const router = Router();

router.get('/health', (_req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/registro', registroRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/despesas', despesaRoutes);
router.use('/perfil', perfilRoutes);
router.use('/organizacao', organizacaoRoutes);

export default router;
