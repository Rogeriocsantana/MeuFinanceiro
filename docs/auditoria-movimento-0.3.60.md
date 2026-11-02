# Auditoria de movimento — 0.3.60

O layout e as funções existentes foram mantidos. A revisão cobre os componentes de movimento compartilhados e os fluxos de navegação das telas; não é uma reformulação visual.

## Problemas corrigidos

| Área | Correção |
| --- | --- |
| Rolagem | Offset inicial fixo durante cada visita. Dados atualizados não disparam `scrollTo` depois de pintar a tela. Eventos atrasados de uma tela anterior são ignorados. Voltar usa o offset salvo; nova visita começa no topo. |
| Entrada de painéis | Inicia na posição correta, antes da primeira pintura, e não reinicia quando a preferência de movimento termina de carregar. Nós animados estáveis durante edição. |
| Grupos de pessoas e categorias | Expansão nativa somente de geometria, sem fade de criação/exclusão das linhas. Conteúdo recortado durante a expansão. |
| Seletores de mês | Offset inicial nativo e nós estáveis. Opacidade permanece ligada ao mesmo valor animado, inclusive nos meses vizinhos. |
| Campos e botões | Nós estáveis durante renderizações. Feedback de toque preserva as transformações já definidas pelo componente. |
| Filtros | Menu ancorado sem somar a barra de status duas vezes; busca retorna à primeira opção. |
| Gráfico de categorias | Destaque animado no segmento e toque calculado pela posição no gráfico. Os círculos tracejados do SVG no Android não podem mais selecionar sempre o último segmento sobreposto. |
| Carregamento | Barra ligada a operações reais. Retirado o pulso artificial de 120 ms ao navegar/trocar período. |
| Dados locais na abertura | Telas usam o último snapshot local da própria conexão enquanto confirmam a leitura, evitando a montagem com controles vazios seguida dos valores reais. Retornos assíncronos antigos são ignorados. |

Cartões em Leque, indicadores de operação, abertura inicial, navegação inferior, botões flutuantes, gráficos de faturas e componentes sem animação também foram inspecionados. A entrada automática dos blocos da página continua desativada, conforme os ajustes anteriores.

## Testes no Android

Foi usada uma variante release para emulador x86_64, com o app completo, SQLite separado e dados fictícios. Nenhum acesso ao D1 ou aos bancos reais foi usado nessa auditoria. O APK público ARM64 usa a fonte original, sem os ganchos de navegação e sem a base da auditoria.

Percurso de 35 telas: Início; contas; detalhe da conta; cartões; lançamentos; detalhe do lançamento; categoria; análises; receitas; pessoas; detalhe de pessoa; empréstimos; contrato; patrimônio; Futuro; resumo mensal; gastos por dia; novos lançamentos; alertas; controles; recorrências; Mais; perfil; notificações; Sobre; configurações; categorias; regras; importações; backup; guia do servidor; guia Pluggy; fatura; parcelamentos; compra parcelada.

Também foram testados:

- Expansão e recolhimento de gastos por pessoa, com os itens completos.
- Abrir editor de controle, focar campo, usar e ocultar teclado e cancelar sem salvar.
- Abrir filtros e menu de opções dentro do painel; conferir a ancoragem.
- Trocar meses e passar para janeiro de 2027.
- Voltar de detalhe à lista já rolada e atualizar a tela sem voltar ao topo. As capturas da área de conteúdo antes/depois da atualização simulada ficaram idênticas.
- Tocar os segmentos de Alimentação e Casa e conferir a categoria e o destaque corretos.
- Alternar entre tema escuro e claro e conferir a reapresentação do gráfico e dos controles.

TypeScript e **245 testes automatizados** passaram. O APK foi conferido quanto a módulos Expo registrados, assinatura original, versão, arquitetura e permissões. Também foi verificada a igualdade de toda a fonte do estágio com a fonte de produção e a ausência dos identificadores do cenário de auditoria no bundle público.

O teste não foi realizado no Poco físico. O percurso não cobre todas as combinações possíveis de filtros, tamanho de base, teclado e configuração do fabricante; a confirmação de fluidez no aparelho permanece necessária.
