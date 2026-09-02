# ErpDrogariaCenterBack

Backend do ERP Drogaria Center — Node + Express + TypeScript + TypeORM + PostgreSQL.

Arquitetura em camadas: Controller → Service → Repository → Model, com logging estruturado (Winston) e multi-tenant (cada empresa é uma `Organizacao`).

## Rodando localmente

```bash
npm install
cp .env.example .env   # ajuste DB_PASSWORD e JWT_SECRET
npm run migration:run
npm run seed
npm run dev
```

Sobe em `http://localhost:3333`. Requer PostgreSQL rodando (veja `.env.example` para as variáveis de conexão).

Frontend: [ErpDrogariaCenterFront](https://github.com/welsonvicente/ErpDrogariaCenterFront)
