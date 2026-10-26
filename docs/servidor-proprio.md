# Servidor próprio: do zero à primeira importação

Este guia usa o backend deste repositório. A URL configurada no app deve apontar para uma API Financeiro compatível, e não diretamente para a Pluggy. Nenhum passo requer acesso ao servidor do autor.

## O que você precisa

- Node.js 22.13+ e pnpm para executar os comandos; Git para clonar o projeto.
- Uma conta Pluggy com aplicação, credenciais e conexões bancárias autorizadas. Disponibilidade, limites e condições dependem do provedor.
- Cloudflare Workers + KV **ou** uma hospedagem Node com HTTPS e armazenamento persistente.
- Um APK compilado por você ou uma distribuição confiável do aplicativo.

O SQLite do aparelho é a base local. KV ou o diretório do servidor guardam credenciais cifradas. D1 é um banco financeiro remoto opcional, separado do cofre de credenciais.

## Opção A — Cloudflare Workers

Execute os comandos dentro da pasta `backend`, usando uma conta Cloudflare sua.

### 1. Instalar e criar a configuração local

```sh
cd backend
pnpm install
pnpm exec wrangler login
```

Copie `wrangler.example.jsonc` para `wrangler.jsonc`:

```powershell
Copy-Item wrangler.example.jsonc wrangler.jsonc
```

No Linux/macOS, use `cp wrangler.example.jsonc wrangler.jsonc`. O arquivo preenchido é ignorado pelo Git. Não sobrescreva uma configuração que você já usa.

### 2. Criar o cofre KV

```sh
pnpm exec wrangler kv namespace create CREDENTIALS
```

Copie o ID retornado para `kv_namespaces[0].id` no arquivo local. Mantenha o binding `CREDENTIALS`. Em `vars`, configure:

| Campo | Valor |
| --- | --- |
| `ADMIN_USER_ID` | `administrador`, ou o mesmo ID que você usar ao provisionar o administrador |
| `ALLOWED_ORIGINS` | Origens web exatas, separadas por vírgula; Android nativo não exige origem web |

Para começar **sem sincronização remota**, remova todo o campo `d1_databases` de `wrangler.jsonc`. Não deixe o ID de exemplo. Isso não impede a importação bancária ou o uso do SQLite.

### 3. Gerar o acesso individual

```sh
node scripts/provision-user.cjs --id administrador
```

O comando cria, sem exibir segredos no terminal:

- `.wrangler/deploy-secrets.json`: chave de cifra e cadastro com hash do token.
- `.wrangler/app-access-administrador.json`: token que será informado no aplicativo.

O ID do usuário deve corresponder a `ADMIN_USER_ID` para ter funções administrativas. Não publique esses arquivos e faça backup privado da chave. O script recusa substituir o mesmo usuário existente.

### 4. Enviar os segredos e publicar

```sh
pnpm exec wrangler secret bulk .wrangler/deploy-secrets.json
pnpm deploy
```

Anote a URL HTTPS retornada. Se o serviço pedir nome do Worker durante o envio de segredos, use o mesmo `name` de `wrangler.jsonc`.

Abra `https://SEU-WORKER.workers.dev/health`. A resposta deve identificar `financeiro-api`. `/health` confirma que a API está acessível; não valida token, armazenamento nem credenciais bancárias.

### 5. Habilitar D1 depois — opcional

D1 permite sincronização entre aparelhos e dá suporte à administração de familiares no backend atual. Não é necessário para importar bancos.

```sh
pnpm exec wrangler d1 create financeiro-dados
```

Adicione o bloco `d1_databases` usando o exemplo do projeto. Mantenha `binding: "DB"`, informe o seu `database_id` e use `migrations_dir: "migrations"`.

```sh
pnpm exec wrangler d1 migrations apply financeiro-dados --remote
pnpm deploy
```

As migrations alteram o banco remoto: confira a conta, o banco e os backups antes de executar. No app, habilite a sincronização remota somente depois de configurar e testar essa etapa.

## Opção B — VPS ou hospedagem Node

O adaptador `src/node-server.js` usa o mesmo núcleo de API do Worker. Pode rodar atrás de um proxy HTTPS, com um volume persistente para as credenciais.

### 1. Preparar o serviço

```sh
cd backend
pnpm install
node scripts/provision-user.cjs --id administrador
```

No painel da hospedagem, cadastre como variáveis privadas:

| Variável | Origem / uso |
| --- | --- |
| `USERS_JSON` | Valor correspondente em `.wrangler/deploy-secrets.json`; preserve a string JSON completa |
| `CREDENTIALS_KEY` | Valor correspondente no mesmo arquivo; 32 bytes aleatórios em base64 |
| `ADMIN_USER_ID` | Mesmo ID do administrador provisionado |
| `ALLOWED_ORIGINS` | Apenas as origens web usadas por você |
| `HOST` | `127.0.0.1` atrás de proxy na mesma máquina; em containers pode ser necessário `0.0.0.0` na rede interna |
| `PORT` | Porta interna, por exemplo `8787`, ou a exigida pela hospedagem |
| `CREDENTIAL_DIRECTORY` | Diretório privado em volume persistente, por exemplo `/var/lib/financeiro/credentials` |

Mantenha o listener HTTP inacessível pela internet; somente o proxy HTTPS deve recebê-la. Dê ao usuário do processo acesso ao diretório privado e restrinja o acesso de outros usuários.

Com as variáveis já configuradas:

```sh
pnpm start:node
```

Para desenvolvimento local, você pode usar um `.env` ignorado pelo Git e iniciar explicitamente com:

```sh
node --env-file=.env src/node-server.js
```

O comando `pnpm start:node` não carrega `.env` automaticamente. Em produção, prefira o gerenciador de segredos da hospedagem. Não coloque credenciais na linha de comando, no repositório ou nas variáveis públicas do app.

### 2. Configurar domínio e HTTPS

Aponte um domínio seu para a hospedagem e use certificado TLS válido. Exemplo de proxy Caddy na mesma máquina:

```caddyfile
financeiro.seudominio.com {
    reverse_proxy 127.0.0.1:8787
}
```

Substitua o domínio pelo seu e siga a instalação/configuração do Caddy. Use o gerenciador de serviços da hospedagem para reiniciar o processo após falhas ou reinicializações. Verifique `https://financeiro.seudominio.com/health` antes de configurar o celular.

O adaptador Node fornecido persiste o cofre em arquivos; **não fornece sincronização financeira em PostgreSQL ou MySQL**. D1 é o adaptador remoto implementado. A administração de familiares atual também depende de D1. Para o uso individual no Node, utilize o usuário provisionado em `USERS_JSON` e o SQLite do celular.

## Conectar o aplicativo

1. Abra **Mais → Integrações**.
2. Informe a origem HTTPS do servidor, sem `/health`, `/v1`, parâmetros ou caminhos adicionais.
3. Informe o token de `.wrangler/app-access-administrador.json` e toque em **Conectar servidor**. Esse é o token individual do app, não um API Token da Cloudflare ou a chave da Pluggy.
4. Quando o cofre for reconhecido, informe seu **Client ID**, **Client Secret** e os IDs dos **Items** das conexões Pluggy.
5. Salve as credenciais. O servidor valida a autenticação e se as conexões informadas pertencem à aplicação configurada.
6. Abra a área de importação, escolha a data inicial e toque em **Atualizar tudo**.
7. Confira as contas, faturas e os valores importados antes de classificar ou vincular recebimentos.

Também existe `mobile/configuracao-servidor-exemplo.json`, um modelo de arquivo de conexão. Preencha uma cópia privada com sua URL e token e importe pelo fluxo do aplicativo. O arquivo preenchido concede acesso: trate-o como uma senha.

## Configurar as conexões Pluggy

Crie sua aplicação no painel Pluggy e siga o fluxo disponível para sua conta. Para uso pessoal, o app possui um guia para **MeuPluggy**. O consentimento deve ocorrer no ambiente autorizado pelo provedor e pelo banco; o Financeiro não pede a senha bancária.

Os IDs dos Items são as conexões já criadas na sua aplicação Pluggy. O cadastro no Financeiro não cria automaticamente uma conexão bancária. Confirme na documentação do provedor as condições de uso, disponibilidade, eventuais custos e o fluxo adequado ao seu projeto.

## Como conferir a instalação

| Verificação | Resultado esperado |
| --- | --- |
| `/health` pelo HTTPS | JSON com `service: "financeiro-api"` |
| Conectar servidor no app | Identidade confirmada e configuração salva |
| Cofre disponível | Campos de credenciais bancárias liberados |
| Salvar Pluggy | Credenciais e Items validados pelo servidor |
| Atualizar tudo | Contas e transações gravadas no SQLite |
| Consultar offline | Últimos dados importados continuam disponíveis |

## Problemas frequentes

| Sintoma | O que conferir |
| --- | --- |
| Token inválido / `401` | Token individual correto, hash provisionado em `USERS_JSON`, usuário habilitado e mesma implantação |
| `/health` funciona, mas o app não conecta | Origem HTTPS sem caminhos, token, certificado válido e API compatível |
| Cofre não configurado | Binding KV ou diretório persistente e `CREDENTIALS_KEY` correta |
| `403` na prévia web | Origem exata em `ALLOWED_ORIGINS`; não use `*` |
| Credenciais ou Items recusados | Client ID/Secret da mesma aplicação e conexão pertencente a ela |
| `503` | Variáveis válidas, chave de cifra original, acesso do servidor ao provedor e armazenamento disponível |
| Dados não chegam em outro aparelho | D1/migrations, opção de sincronização, mesma identidade e conflitos pendentes |
| Erro de certificado | Corrija o HTTPS; não desative a verificação TLS |

## Backup e operação

Guarde o material de acesso, a chave de cifra e o cofre em backup privado. Para Node, preserve o volume de `CREDENTIAL_DIRECTORY`. Para D1, configure os backups e a restauração da sua implantação. Trocar a chave de cifra sem migrar os dados torna o cofre antigo ilegível.

Não compartilhe tokens entre pessoas. No fluxo manual, execute o provisionador uma vez por ID e reaplique os segredos atualizados. Nunca envie logs de extratos, tokens ou respostas completas do provedor para issues públicas.

## Referências

- [Workers e secrets](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Workers KV](https://developers.cloudflare.com/kv/reference/kv-commands/)
- [D1 e migrations](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Node: carregamento de arquivos de ambiente](https://nodejs.org/api/cli.html#--env-filefile)
- [Pluggy: MeuPluggy](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use)
- [Caddy: reverse proxy](https://caddyserver.com/docs/quick-starts/reverse-proxy)
