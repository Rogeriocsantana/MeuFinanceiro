# Aplicativo Android

React Native + Expo SDK 54, TypeScript e SQLite. Contas, cartões, faturas, parcelas, compras compartilhadas, empréstimos, pessoas, reservas e análises financeiras. Dados locais e conexão configurável com uma API Financeiro.

## Desenvolvimento

```sh
pnpm install
pnpm typecheck
node --test tests/*.test.cjs
pnpm android
```

Configure JDK 17 e Android SDK para compilar. Expo Go não inclui todos os módulos nativos usados pelo app. A pasta android é gerada pelo Expo prebuild e fica fora do Git.

A configuração do servidor é feita no app, em Configurações → Integrações, com URL HTTPS e token individual. O arquivo configuracao-servidor-exemplo.json é um modelo sem credenciais. Variáveis EXPO_PUBLIC são públicas no bundle: nunca coloque segredos nelas.

## APK release local no Windows

Configure JAVA_HOME e ANDROID_HOME. Execute:

```powershell
./scripts/build-apk.ps1
node scripts/verify-apk.cjs
```

O script gera uma chave própria em .private/android-signing se ela não existir. Faça backup privado da chave e das senhas: são necessárias para atualizar instalações assinadas por você. Não use a chave do autor. O APK fica em artifacts, fora do Git. EAS também possui perfil preview em eas.json.

A integração Google Drive tem código preservado, mas seu módulo nativo está desabilitado na configuração atual; não é requisito para o fluxo principal. A configuração de servidor, integração bancária e sincronização está descrita em [backend/README.md](../backend/README.md).

Os testes usam dados de cenário. A função Apps Script em tests/fixtures é apenas uma regressão isolada de orçamento, sem depender das cópias históricas do projeto. Atribuições de logos em assets/banks/SOURCES.md.
