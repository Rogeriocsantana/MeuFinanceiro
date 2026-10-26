# Segurança e publicação

Não inclua tokens, Client Secret, chaves de assinatura, senhas, extratos, fotos de pessoas ou backups em commits, issues, logs ou capturas públicas. Use dados fictícios nas demonstrações públicas. Variáveis EXPO_PUBLIC não são secretas.

Antes de cada publicação, rode node scripts/check-publication.cjs e revise git status. Não force a inclusão de arquivos ignorados. Configure sua própria infraestrutura usando os exemplos e mantenha as configurações preenchidas fora do Git.

O app guarda dados financeiros em SQLite local. Não assuma que o banco local possui criptografia completa em repouso. O servidor pode armazenar dados financeiros quando a sincronização é habilitada. A proteção de acesso, armazenamento, backups e HTTPS da hospedagem é responsabilidade de quem implanta.

Se uma credencial for publicada, revogue-a ou troque-a na origem. Apagar o arquivo em um commit posterior não remove o segredo do histórico nem das cópias existentes. Chaves de assinatura Android exigem tratamento específico para preservar a possibilidade de atualização dos aplicativos.

Não publique dados financeiros ao relatar uma falha. Este projeto não informa um canal privado dedicado a vulnerabilidades; combine um canal privado com o mantenedor antes de enviar detalhes sensíveis. A verificação automatizada de arquivos reduz exposição acidental, mas não garante ausência de vulnerabilidades.
