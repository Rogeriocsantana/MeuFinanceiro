# Financeiro

**Organização financeira pessoal, do saldo de hoje às parcelas dos próximos meses.**

Aplicativo Android desenvolvido em React Native e TypeScript, com SQLite no aparelho, integração Open Finance via Pluggy e servidor configurável. Reúne contas, cartões, compras compartilhadas, empréstimos, receitas, reservas e análises por categoria.

<p align="center"><img src="docs/media/visao-geral.gif" width="300" alt="Demonstração geral do Financeiro com dados fictícios"></p>

> Demonstração com dados fictícios na prévia web em formato de celular. O GIF reúne telas capturadas, sem operações bancárias reais. O visual no Android pode variar ligeiramente.

**[Galeria: 20 áreas com imagem e GIF](docs/funcionalidades.md)** · **[Guia completo do servidor próprio](docs/servidor-proprio.md)** · **[Aplicativo Android](mobile/README.md)** · **[Backend](backend/README.md)**

## Por que este projeto existe

Todo mês, separar minhas compras das compras de amigos e familiares nas faturas exigia tempo e conferência manual. Além disso, eu precisava acompanhar empréstimos em planilhas e somar parcelas futuras para entender quanto ainda tinha disponível e o que já estava comprometido.

Também faltava uma resposta simples para perguntas como: quanto estou gastando com alimentação e delivery? Quanto cada pessoa ainda precisa me pagar? Quanto falta para quitar o cartão?

A primeira versão nasceu no Google Apps Script. O uso diário fez o projeto crescer até uma versão Android, com consulta local, notificações e uma experiência voltada ao celular. A integração bancária levou à criação de um servidor para intermediar o acesso à Pluggy. Cada pessoa pode configurar a própria estrutura, sem depender do servidor do autor.

## O que você pode acompanhar

| Área | Recursos |
| --- | --- |
| Visão geral | Patrimônio acompanhado, entradas, saídas, obrigações e últimos lançamentos |
| Contas | Saldos por conta, instituições e movimentações |
| Cartões | Faturas, fechamento, vencimento, parcelas e participação de cada pessoa |
| Compras compartilhadas | Divisão de valores, responsáveis, vencimentos e recebimentos vinculados |
| Empréstimos | Contratos, parcelas, juros, valores recebidos e saldo por pessoa |
| Análises | Despesas por categoria, evolução e limites mensais |
| Patrimônio | Reservas, cofrinhos e investimentos cadastrados |
| Planejamento | Consulta de compromissos e simulação para uma data futura |
| Organização | Categorias, regras, busca e filtros por pessoa e origem |
| Configuração | Servidor próprio, importação, sincronização opcional, perfil, tema e notificações |

O aplicativo diferencia compras, pagamentos de fatura, transferências e recebimentos para evitar tratar todos os movimentos bancários como novas despesas ou receitas. Previsões dependem dos dados e das classificações disponíveis; confira os valores oficiais da instituição.

## Algumas telas

<table>
<tr><th>Início</th><th>Cartões</th><th>Análises</th></tr>
<tr><td><img src="docs/media/inicio.jpg" width="250" alt="Resumo financeiro demonstrativo"></td><td><img src="docs/media/cartoes.jpg" width="250" alt="Cartões e fatura demonstrativa"></td><td><img src="docs/media/analises.jpg" width="250" alt="Análises por categoria demonstrativas"></td></tr>
</table>

<table>
<tr><th>Servidor próprio</th><th>Importações</th><th>Preferências</th></tr>
<tr><td><img src="docs/media/integracoes.gif" width="250" alt="Configuração do servidor e sincronização"></td><td><img src="docs/media/importacoes.gif" width="250" alt="Opções de importação bancária"></td><td><img src="docs/media/perfil.gif" width="250" alt="Perfil e opções de atualização"></td></tr>
</table>

Na [galeria completa](docs/funcionalidades.md), cada área tem sua imagem, GIF, caminho de acesso e explicação. Inclui classificação e divisão de compras, filtros da fatura, planejamento, categorias, regras, temas e notificações.

## Como os dados circulam

```mermaid
flowchart LR
    App[App Android] <--> Local[(SQLite do aparelho)]
    App -->|HTTPS e token individual| API[Seu servidor Financeiro]
    API -->|Credenciais da sua aplicação| Pluggy[Pluggy / conexões autorizadas]
    API <--> Cofre[Cofre de credenciais cifradas]
    API <-. Sincronização opcional .-> D1[(Cloudflare D1)]
```

- **SQLite:** consulta dos dados já importados, inclusive offline.
- **Servidor:** API autenticada, validação de conexões e comunicação com a Pluggy.
- **Cofre:** Workers KV ou diretório persistente no Node; guarda credenciais cifradas.
- **D1:** sincronização financeira remota opcional. Não é requisito para importar bancos.

A URL do servidor e o token são configurados no aplicativo. Conectar outra instituição não exige alterar o código quando a integração estiver disponível; logos e cores do catálogo são aplicados às instituições reconhecidas. Bancos fora do catálogo usam uma marca neutra.

## Usar com seu próprio servidor

Você precisa de uma implantação da **API deste projeto**, com HTTPS e token individual. Informar a URL de uma API qualquer não cria a integração.

| Opção | Onde executa | Credenciais | Sincronização remota |
| --- | --- | --- | --- |
| Cloudflare | Workers | Workers KV cifrado | D1 opcional |
| Servidor próprio | Node atrás de proxy HTTPS | Arquivos cifrados em volume persistente | Não há adaptadores PostgreSQL/MySQL incluídos |

O [guia de servidor próprio](docs/servidor-proprio.md) ensina:

1. Instalar o backend e criar sua configuração local.
2. Criar o cofre e gerar um usuário/token individual.
3. Publicar no Cloudflare ou executar no Node com HTTPS.
4. Validar o serviço e conectar o aplicativo.
5. Configurar suas credenciais e conexões Pluggy.
6. Importar o histórico e consultar os dados offline.
7. Habilitar D1, se desejar, e resolver os erros mais comuns.

**O projeto não inclui credenciais, conexões ou acesso ao servidor do autor.** A integração bancária depende da sua conta, do provedor e dos consentimentos necessários. Para uso pessoal, consulte o [guia oficial do MeuPluggy](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use); aplicações para terceiros seguem as condições de integração do provedor.

## Primeiro uso do aplicativo

1. Instale seu APK ou execute o projeto em um Android de desenvolvimento.
2. Em **Mais → Integrações**, configure a origem HTTPS do servidor e o token do seu usuário.
3. Conecte o servidor e configure Client ID, Client Secret e IDs dos Items da sua aplicação Pluggy.
4. Em **Mais → Open Finance e importações**, escolha o início do histórico e atualize os dados.
5. Confira as contas e faturas importadas. Cadastre pessoas e classifique os movimentos.
6. Nas compras compartilhadas, informe os valores de cada pessoa; ao receber, vincule a entrada aos itens pagos.
7. Ajuste avisos, tema e intervalo de atualização conforme seu uso.

O app importa conexões existentes. O consentimento e a criação da conexão ocorrem no fluxo autorizado do provedor, não por digitar a senha bancária no Financeiro.

## Executar o projeto

### Requisitos

- Node.js **22.13 ou superior**, pnpm e Git.
- Android: JDK 17 e Android SDK configurados.
- Para integração real: sua conta Pluggy e servidor HTTPS configurado.

### Aplicativo

```sh
cd mobile
pnpm install
pnpm typecheck
pnpm android
```

A pasta Android é gerada pelo Expo. Expo Go não inclui todos os módulos nativos deste projeto. Consulte [mobile/README.md](mobile/README.md) para gerar seu APK e preservar a chave de assinatura.

### Backend

```sh
cd backend
pnpm install
pnpm test
```

Depois, siga o [guia de implantação](docs/servidor-proprio.md). Não publique `wrangler.example.jsonc` com os IDs de exemplo: copie para `wrangler.jsonc`, use os recursos da sua conta e mantenha a configuração preenchida fora do Git.

## Testes e verificação de publicação

Na pasta `mobile`:

```sh
pnpm typecheck
node --test tests/*.test.cjs
```

Na pasta `backend`:

```sh
pnpm test
```

Na raiz, antes de enviar ao GitHub:

```sh
node scripts/check-publication.cjs
```

Os testes verificam regras financeiras, persistência, isolamento de usuários, autenticação e fluxos do projeto. Não substituem a validação em aparelho ou uma auditoria de produção.

## Estrutura do repositório

```text
mobile/
  src/             Interface, regras e persistência local
  assets/          Ícones e logos incorporados
  plugins/         Configuração e extensões nativas
  tests/           Testes com cenários de demonstração
  scripts/         Build e verificação do APK
backend/
  src/             API, integração, autenticação e adaptadores
  migrations/      Schema do D1 opcional
  test/            Testes do servidor
  scripts/         Provisionamento local de usuários
  wrangler.example.jsonc
scripts/
  check-publication.cjs
docs/
  servidor-proprio.md
  funcionalidades.md
  media/           Imagens e GIFs com dados fictícios
```

## Privacidade e limites atuais

- Não envie tokens, Client Secret, extratos, fotos pessoais ou chaves de assinatura para o GitHub.
- Variáveis `EXPO_PUBLIC_*` são públicas no bundle e não devem conter segredos.
- O `.gitignore` usa uma lista de inclusão; dados locais e evidências não fazem parte da publicação.
- O SQLite local não deve ser considerado um banco com criptografia completa em repouso.
- O backend Node requer armazenamento persistente e HTTPS; o app não configura a infraestrutura por você.
- D1 é o adaptador de sincronização remota implementado. Administração de familiares também depende dele nesta versão.
- O código de Google Drive está preservado, mas seu módulo nativo está desabilitado no fluxo atual.
- Notificações e execução em segundo plano dependem das permissões e do agendamento do Android.

Veja [SECURITY.md](SECURITY.md) antes de implantar ou compartilhar dados de diagnóstico.

## Créditos

Projeto pessoal de Rogério Santana. React Native, Expo, TypeScript e SQLite formam a base do aplicativo; Pluggy fornece a integração de dados bancários autorizados. O projeto não é um aplicativo oficial dos bancos exibidos.

Logos pertencem às respectivas instituições. Proveniência em [mobile/assets/banks/SOURCES.md](mobile/assets/banks/SOURCES.md). Não há licença de redistribuição definida nesta entrega.
