# Deploy — configuração inicial da VPS (fazer uma vez só)

O workflow `.github/workflows/deploy.yml` cuida das atualizações a cada push
em `main`, mas ele espera que a VPS já tenha isso pronto:

## 1. Node.js na VPS

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
```

## 2. Pasta da aplicação e `.env` de produção

```bash
mkdir -p /var/www/pharmamind-api
```

Crie `/var/www/pharmamind-api/.env` (nunca vai pelo git) com os valores reais de produção — veja `backend/.env.example` para a lista completa de variáveis. Pontos importantes:

- `NODE_ENV=production`
- `CORS_ORIGINS=https://erp.drogariacenter.com.br`
- `DB_*` apontando para o Postgres de produção
- `JWT_SECRET` — uma string aleatória longa, diferente da usada em desenvolvimento

## 3. Serviço systemd

```bash
cp deploy/pharmamind-api.service /etc/systemd/system/pharmamind-api.service
systemctl daemon-reload
systemctl enable pharmamind-api
```

(Esse arquivo deste repo precisa estar na VPS só para copiar — pode vir de um `git clone` manual único, ou colar o conteúdo direto.)

## 4. Segredo do GitHub Actions

No repositório do backend no GitHub: **Settings → Secrets and variables → Actions** → adicionar `VPS_PASSWORD` com a senha do usuário `root` da VPS (`103.199.184.22`).

## 5. Primeiro deploy

Um `git push` para `main` já dispara o workflow, que builda, envia o `dist/`, roda `npm ci --omit=dev`, aplica as migrations e reinicia o serviço.

Depois do **primeiro** deploy bem-sucedido, rode o seed uma única vez (cria a organização, categorias padrão e o usuário admin):

```bash
cd /var/www/pharmamind-api
node -r reflect-metadata dist/seeds/run-seed.js
```

A partir daí, é só dar push em `main` que o deploy é automático.
