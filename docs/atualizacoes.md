# Atualizações pelo GitHub

## Correção necessária nas versões 0.3.38 e 0.3.39

Essas versões usavam uma função de tempo limite indisponível no ambiente React Native do Android. A consulta falhava antes de acessar o GitHub. Instale manualmente a versão 0.3.40 por cima da atual, sem desinstalar; ela corrige a consulta e permite testar as próximas Releases pelo próprio app.

Em Mais → Sobre o aplicativo, use **Verificar atualização do aplicativo**. A consulta manual informa se existe atualização, se a versão já é a mais recente ou se houve falha de conexão. O aviso automático continua no topo quando há uma versão mais nova.

Na versão 0.3.41, o botão ganhou contorno e fundo transparente para acompanhar o cartão também no tema escuro. O filtro do Resumo do mês e das outras telas novas foi alinhado ao cabeçalho, como nas demais páginas.

<img src="media/escuro/atualizacao-botao.png" width="300" alt="Botão Verificar atualizações com contorno e fundo transparente no tema escuro">

Captura demonstrativa da prévia web; a versão exibida na imagem é a da prévia, não a versão do APK publicado.

<img src="media/claro/atualizacao-app.png" width="300" alt="Demonstração da faixa de atualização no topo do aplicativo">

Captura da prévia web com dados fictícios e aviso demonstrativo. No Android, a faixa consulta as Releases reais.

## Teste após instalar a correção

1. Instale manualmente a versão 0.3.40 corrigida. Quando uma versão superior for publicada, mantenha essa instalação para testar o aviso.
2. Encerre e reabra o aplicativo para consultar a última Release.
3. Confira a versão mais nova, tamanho e novidades na faixa superior. Se estiver na última versão, use Mais → Sobre → Verificar atualização do aplicativo para conferir o resultado.
4. Toque em Atualizar. Se o Android pedir permissão para instalar desta origem, autorize, volte e toque novamente.
5. Confirme a instalação e abra o app.
6. Verifique em Mais que Resumo do mês e Gastos por dia estão em Gestão financeira. Seus dados devem permanecer.

Se o app já estava aberto durante a publicação, a consulta em segundo plano respeita o intervalo de um minuto. Encerrar e reabrir inicia uma nova consulta. O botão de atualizar dados bancários é independente da atualização do APK.

O Android consulta a última Release estável de `Rogeriocsantana/MeuFinanceiro` ao abrir e ao retornar ao app, com intervalo mínimo de um minuto. Uma faixa no topo mostra versão, tamanho, novidades e a ação Atualizar. Dispensar a faixa vale apenas para a sessão.

Cada Release deve conter o APK assinado e `update.json`:

```json
{
  "packageName": "com.roger.financeiro",
  "version": "0.3.39",
  "versionCode": 40,
  "apkAssetName": "financeiro-0.3.39-arm64-v8a.apk",
  "size": 12345678,
  "sha256": "SHA256_DO_APK_COM_64_CARACTERES_HEXADECIMAIS"
}
```

Use o tamanho real em bytes e o SHA-256 calculado sobre o APK final. Aumente `versionCode` a cada atualização. O aplicativo ignora rascunhos, pré-lançamentos e versões iguais ou anteriores. Escreva as novidades na descrição da Release.

O download verifica tamanho, SHA-256, pacote, versão e assinatura original. O Android pede autorização para instalar aplicativos desta origem e confirma a instalação. Os dados permanecem no aparelho ao atualizar com o mesmo pacote e chave. Não desinstale o aplicativo para atualizar.

Guarde a chave de assinatura e suas senhas fora do Git. APK e manifesto são anexos da Release, não arquivos para adicionar ao código-fonte. O acesso público às Releases não exige tokens dentro do app.

Para testar: instale a versão inicial com atualizador; publique depois uma Release estável com um versionCode maior. Reabra o aplicativo e toque em Atualizar. A versão inicial não deve anunciar a si mesma como atualização.


