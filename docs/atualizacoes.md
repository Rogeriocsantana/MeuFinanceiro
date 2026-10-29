# Atualizações pelo GitHub

## Segundo plano e notificações na versão 0.3.48

O agendamento só é configurado depois de carregar as preferências da conexão ativa. Isso evita cancelar a tarefa com o valor manual padrão durante a abertura do app. Avisos imediatos usam o canal financeiro explicitamente; se o Android recusar um agendamento, o registro de deduplicação é liberado para permitir nova tentativa.

Em **Mais → Perfil**, o diagnóstico informa se a tarefa está registrada e a última execução efetiva em segundo plano registrada nesta versão (concluída, intervalo ainda não vencido ou falha). Abrir o app para atualizar não conta como uma execução em segundo plano. Esse diagnóstico fica somente neste aparelho.

Em **Mais → Notificações**, use **Enviar notificação de teste** e **Atualizar diagnóstico** para conferir a permissão do Android, o canal de avisos e a quantidade de lembretes agendados. O teste pede permissão se necessário, mas não altera as preferências salvas de avisos financeiros. Uma atualização bloqueada por vínculos não produz aviso de dados bancários atualizados.

Para testar: salve um intervalo no Perfil, ative e salve os tipos desejados em Notificações, envie o teste e deixe o aplicativo em segundo plano. Depois confira o horário da execução no diagnóstico. O Android controla quando a tarefa roda e pode adiá-la por bateria, rede ou restrições do fabricante; não é um horário garantido. Forçar a parada bloqueia a execução até reabrir o app.

Validação: 214 testes aprovados e TypeScript sem erros. Inclui nova tentativa de notificação após falha e registro de sucesso/falha da tarefa sem tela montada. A execução real no celular depende do teste no aparelho.

## Resultado separado na versão 0.3.47

Ao terminar a atualização geral, o painel **Resultado da atualização** apresenta duas seções:

- **Open Finance:** registros atualizados ou o motivo da interrupção, incluindo vínculos aguardando conferência.
- **D1:** sincronizado, com pendências, desativado, não configurado ou falha. Uma comunicação concluída mostra o horário, as operações aguardando envio e os conflitos da conta sincronizada.

O D1 só aparece como sincronizado quando a passagem concluiu e a fila e os conflitos estão zerados. A atualização geral aguarda uma passagem remota anterior e inicia uma nova para incluir alterações recentes. Edições feitas durante o envio são capturadas entre os lotes, reduzindo a necessidade de uma segunda atualização manual. Em caso de limite de lotes ou alterações ainda pendentes, o painel indica pendências para conferir em Integrações.

Para testar com vínculos pendentes, mantenha-os aguardando, use a atualização geral e confira as duas seções do painel. A importação bloqueada não impede a tentativa remota e nenhuma quitação é transferida sem sua decisão.

## Sincronizações independentes na versão 0.3.46

A atualização geral e a atualização automática tentam sincronizar o banco remoto D1 mesmo se o Open Finance falhar ou aguardar conferência de vínculos. A sincronização remota precisa estar ativada em Integrações e depende de acesso ao servidor.

Os resultados são independentes: uma falha bancária continua indicada e pode ser tentada novamente; uma falha no D1 mantém a fila pendente. Nenhum vínculo duvidoso é aprovado automaticamente para permitir a sincronização.

## Vínculos para conferir na versão 0.3.45

Em **Mais → Open Finance / Importações → Vínculos para conferir**, revise compras cuja identidade mudou sem uma referência segura do banco. Se uma importação já foi bloqueada na versão anterior, atualize os dados novamente para carregar os itens para conferência.

- **É o mesmo lançamento:** selecione o registro salvo. O aplicativo mantém a identidade local, as participações, a quitação e os recebimentos vinculados, e passa a reconhecer o novo identificador externo.
- **É outra compra:** o lançamento recebido fica separado. Nenhum pagamento da compra anterior é transferido para ele.

Salve a decisão de cada item e toque em **Concluir importação**. As decisões parciais ficam salvas mesmo ao fechar o aplicativo; a importação só é aplicada quando todos os itens estiverem conferidos. Depois de concluída, repetir os mesmos identificadores não exige nova conferência. Uma nova mudança de identidade sem referência segura pode exigir outra revisão.

Se os dados financeiros mudarem durante a conferência, a conclusão é recusada para preservar os vínculos. Atualize a importação e confira novamente com os dados atuais. Alterações de valor e outros campos continuam passando pela revisão de alterações existente.

Validação: 194 testes automatizados, incluindo persistência das decisões, importações repetidas, compras separadas, preservação de recebimentos e rollback em falha de gravação.


## Proteção de vínculos na versão 0.3.44

Nas próximas importações, os identificadores internos usados nas participações e recebimentos permanecem estáveis. Se a referência estável do banco confirmar a identidade, um novo identificador externo é registrado como alias, preservando a quitação.

Valor, descrição e data semelhantes não autorizam transferir pagamentos. Ao detectar possível troca de identificador sem referência segura, a importação é cancelada por inteiro e mostra uma mensagem para conferência. Os dados salvos, quitações, recebimentos e a fila de sincronização permanecem como estavam. Isso pode exigir conferência também para compras legitimamente parecidas; a proteção prioriza não aplicar uma quitação à compra errada.

## Vencimentos na versão 0.3.43

O dia-base do cartão fica salvo e pode ser editado. Sem configuração anterior, o aplicativo usa o dia recorrente do histórico; sem histórico suficiente, inicia com dia 10. Uma fatura excepcional não muda esse dia-base. Para os cartões Itaú e Mercado Pago desta configuração, o dia-base é 10.

Quando não há uma data oficial para o mês, a previsão avança sábados e domingos para segunda-feira. O aplicativo não presume feriados: quando a instituição enviar o vencimento específico pelo Open Finance, essa data prevalece sobre a previsão. A mesma regra acompanha as parcelas importadas, participações e projeções futuras, preservando valores e vínculos.

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


