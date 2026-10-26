# Financeiro

Aplicativo Android de organização financeira pessoal, desenvolvido com React Native, Expo e TypeScript. Reúne contas, cartões, parcelas, despesas compartilhadas, empréstimos e análises por categoria.

## Estrutura

- **mobile/**: aplicativo, SQLite local, recursos visuais e testes.
- **backend/**: API autenticada, integração com Pluggy e sincronização opcional em D1.
- **scripts/check-publication.cjs**: verifica os arquivos que o Git pode publicar.

O projeto começou no Google Apps Script. Esta publicação contém a versão mobile e seu backend; arquivos históricos, extratos e dados de uso pessoal ficam fora do repositório.

## Começar

Use Node.js 22.13 ou superior (os testes usam node:sqlite), pnpm e, para Android, JDK 17 e Android SDK. Consulte [o aplicativo](mobile/README.md) e [o servidor](backend/README.md).

Cada instalação configura seu próprio servidor e token em Configurações → Integrações. A integração bancária exige conta, credenciais, consentimentos e disponibilidade do provedor. Clonar este projeto não fornece acesso às conexões ou ao servidor do autor.

## Validação

Na raiz:

```sh
node scripts/check-publication.cjs
```

Em mobile: pnpm install, pnpm typecheck e node --test tests/*.test.cjs.
Em backend: pnpm install e pnpm test.

## Publicação e privacidade

O .gitignore da raiz usa uma lista de inclusão: backups, evidências, vídeos, extratos, builds e configurações locais não são candidatos a commit. Não use git add -f para contornar essa proteção. Rode a verificação novamente antes de publicar.

Credenciais e dados reais não acompanham este código. Veja [SECURITY.md](SECURITY.md). O projeto está em evolução; a verificação de publicação não substitui uma auditoria completa da aplicação. Não há licença de redistribuição definida nesta entrega. Logos pertencem às respectivas instituições, com proveniência em mobile/assets/banks/SOURCES.md.
