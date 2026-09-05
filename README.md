# PharmaMind — Backend

Backend do PharmaMind — Node + Express + TypeScript + TypeORM + PostgreSQL.

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

## Produção

- Backend: `https://apierp.drogariacenter.com.br`
- Front: `https://erp.drogariacenter.com.br`

Defina `CORS_ORIGINS=https://erp.drogariacenter.com.br` no `.env` de produção (aceita uma lista separada por vírgula, caso precise liberar mais de uma origem). Sem isso — ou com o domínio errado — o navegador bloqueia as chamadas do front por CORS mesmo com a API no ar.

Frontend: [ErpDrogariaCenterFront](https://github.com/welsonvicente/ErpDrogariaCenterFront)
