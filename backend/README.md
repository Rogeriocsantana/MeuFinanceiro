# API Financeiro

API autenticada para integração com Pluggy, administração de usuários e sincronização opcional com Cloudflare D1. A aplicação recebe URL HTTPS e token de uma API compatível; não basta informar uma URL bancária arbitrária.

## Desenvolvimento e testes

```sh
pnpm install
pnpm test
```

Use Node.js 22.13 ou superior. Para Cloudflare, copie wrangler.example.jsonc para wrangler.jsonc e preencha os recursos da sua conta. O arquivo preenchido é ignorado pelo Git.

## Cloudflare

1. Execute pnpm exec wrangler login.
2. Crie um Workers KV com pnpm exec wrangler kv namespace create CREDENTIALS e configure o ID no binding CREDENTIALS.
3. Defina ADMIN_USER_ID para o usuário administrador escolhido e ALLOWED_ORIGINS para as origens web exatas. Não use *.
4. Gere credenciais locais com node scripts/provision-user.cjs --id administrador. O token individual e o material de implantação ficam em .wrangler, fora do Git. Guarde-os em local privado.
5. Envie os segredos com pnpm exec wrangler secret bulk .wrangler/deploy-secrets.json. Eles incluem USERS_JSON e CREDENTIALS_KEY. Nunca publique esse JSON.
6. D1 é opcional. Para habilitá-lo, crie sua base, preencha o ID e aplique as migrations. Se não usar D1, remova d1_databases do arquivo local antes do deploy.
7. Publique com pnpm deploy e configure a URL HTTPS e o token individual no app.
8. Em Integrações no app, configure suas credenciais Pluggy e suas próprias conexões. O acesso aos bancos depende do provedor e dos consentimentos necessários.

CREDENTIALS_KEY deve ter 32 bytes aleatórios em base64. Ela cifra as credenciais com AES-GCM antes de armazená-las em KV. Mudar a chave sem migrar os registros impede a leitura do conteúdo existente. USERS_JSON armazena hashes SHA-256 dos tokens individuais. O token do aplicativo não é um API Token Cloudflare.

## Outro servidor

pnpm start:node inicia src/node-server.js. Configure USERS_JSON, CREDENTIALS_KEY e ALLOWED_ORIGINS no ambiente da hospedagem. Use HTTPS no proxy. HOST/PORT são configuráveis; o padrão é 127.0.0.1:8787. Credenciais cifradas usam CREDENTIAL_DIRECTORY (padrão .private-credentials); é necessário disco persistente.

src/api.js contém o núcleo; src/worker.js é o adaptador Cloudflare. A sincronização financeira remota implementada usa D1; não há drivers financeiros para outros bancos de dados nesta versão. SQLite local do app funciona sem D1.

Os arquivos de exemplo não possuem segredos funcionais. A publicação do código não equivale à validação de uma implantação de produção. Consulte [SECURITY.md](../SECURITY.md).
