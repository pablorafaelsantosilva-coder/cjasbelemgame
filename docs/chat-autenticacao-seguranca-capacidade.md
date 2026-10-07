# Chat, autenticação e capacidade — 6 de outubro de 2026

## Adicionar pessoas às conversas privadas

Na aba Privadas, o botão visível **Adicionar pessoas** abre a busca de participantes cadastrados e ativos. Para quem ainda não tem conversas, o diretório abre automaticamente. Selecionar uma pessoa abre a conversa; ela passa a integrar o histórico após o primeiro envio. Não é um convite por telefone/e-mail nem um grupo privado. A busca possui nova tentativa em caso de falha.

Erros específicos de função/tabela ausente mostram que o recurso precisa ser ativado; administradores recebem o nome da migração na própria tela. A busca continua usando `get_chat_people`, sem expor e-mails ou consultar perfis por um caminho que contorne as políticas. O teste de primeira conversa usa caixa de entrada vazia e verifica que selecionar um participante abre o campo de envio.

## Acabamento final do chat

Geral e Privadas usam a mesma caixa de escrita, com expansão até 128 px, emojis e prévia da resposta. Em dispositivos de toque, Enter insere uma linha; o botão envia. No computador, Enter envia e Shift+Enter insere uma linha. O símbolo de confirmação significa apenas envio, sem simular leitura pelo destinatário.

A busca local percorre o texto das mensagens carregadas, permite navegar entre resultados e destaca a mensagem escolhida. Não consulta conversas alheias nem promete buscar no histórico ainda não carregado. A interface informa se está recebendo atualizações em tempo real ou usando consultas periódicas.

Rascunhos são mantidos em memória por conta e conversa durante a navegação, por até 30 minutos sem uso. Não são persistidos em disco: recarregar/fechar a página os perde e sair da conta limpa o cache. Uma falha de envio mantém o texto e mostra aviso persistente; o usuário pode tentar pelo mesmo botão. O teste de navegador inclui falha simulada, recuperação do envio, busca, navegação com rascunho, expansão da caixa e comportamento do Enter móvel. Também verifica limpeza do campo após enviar texto com espaços nas pontas.

O código está pronto para publicação, mas a ativação das conversas privadas e respostas ainda exige aplicar `20261006033000_private_chat_and_replies.sql` no banco do projeto. A migração `20261006034000_proof_security.sql` continua necessária para as proteções das comprovações. Esses arquivos estão em `supabase/migrations`. Esta etapa não foi executada remotamente; o diagnóstico no painel administrativo ajuda a identificar recursos ausentes. Esta revisão de interface não adiciona migrações.

## Otimização de recursos

- Contadores do início e do detalhe do desafio compartilham um relógio por frequência (1 segundo ou 30 segundos), suspendem os temporizadores com a página oculta e atualizam o horário ao retornar. `node tests/clock-store.mjs` verifica 20 consumidores com um temporizador, pausa, retomada e limpeza.
- Galerias normalizam os caminhos para reaproveitar a mesma consulta mesmo quando a ordem dos arquivos muda. Links privados de uma hora são renovados após 45 minutos a partir da geração, com margem de 15 minutos; voltar o foco não renova links ainda recentes. A tentativa manual continua disponível. Links compartilhados no chat mantêm sua política separada de 600 segundos.
- Vídeos nas listas usam `preload="none"`, deixando o download inicial para o play. A visualização ampliada mantém metadados. Fotos usam decodificação assíncrona e carregamento sob demanda.
- Eventos de mensagens privadas invalidam somente o histórico do interlocutor envolvido e a caixa de entrada, evitando recarregar a conversa aberta por mensagens de outras pessoas.
- A consulta de configurações no detalhe do desafio usa a mesma estrutura completa do início, evitando sobrescrever o cache compartilhado com campos parciais.

As mudanças não requerem nova migração. Os 13 fluxos de navegador passaram com respostas de rede simuladas, além das verificações de tipos e geração de produção. O teste do relógio demonstra redução de temporizadores; não houve medição de latência ou teste de carga no site publicado. Não é uma certificação para 500 acessos.

## Correção após o relato da tela de mensagens

O erro relatado é compatível com a leitura de `reply_to_id` antes de aplicar a migração. A interface agora reconhece especificamente o erro de coluna ausente (`42703`/`PGRST204`) e consulta as colunas anteriores mantendo a mesma autenticação e RLS. Outros erros continuam aparecendo como falhas, sem disfarçar problemas de permissão ou conexão. Mensagens sem citação não enviam o campo novo, permitindo continuar o chat geral no banco anterior. Responder fica indisponível enquanto o campo não existe; não há simulação de conversa privada sem proteção de banco.

Avisos de falha ficam fora da área rolável, evitando texto cortado atrás do cabeçalho. A caixa de escrita começa compacta e o histórico usa data e identificador juntos na paginação, para não pular mensagens com o mesmo horário. O painel administrativo ganhou diagnóstico de disponibilidade das tabelas e funções, com orientação de migração. Esse diagnóstico usa apenas leituras e não certifica RLS, Realtime, envio ou capacidade.

Melhorias adicionais: início com progresso, próximo desafio elegível por prazo e filtros de situação; ranking com destaques, posição pessoal, busca por nome e exibição gradual; memórias com filtros de fotos/vídeos e lotes de 24 para reduzir assinatura e renderização de mídias; tema claro/escuro persistente, aviso de falta de conexão, navegação com área segura do celular, foco acessível e telas de erro em português. O início e o ranking compartilham a consulta em cache. Falhas de contagem administrativa deixam de se passar por zero.

O teste de navegador passou em 13 fluxos, incluindo banco anterior, envio sem `reply_to_id`, indisponibilidade de privados, filtros do início, busca no ranking, persistência do tema e diagnóstico administrativo em 320 px. As respostas de rede são simuladas; não foi executada migração nem enviado e-mail real. Esta correção de interface não requer uma nova migração, mas a ativação de privados/respostas e a proteção de comprovações ainda dependem das migrações abaixo. Publicar a nova versão no Lovable depois da sincronização do GitHub.

## Entrega e ativação

O código acrescenta as abas Geral e Privadas, busca de participantes, conversas individuais, respostas com citação, emojis e rascunhos separados por destinatário. A interface adapta a lista de conversas para celular. O indicador de envio não representa confirmação de leitura.

O cadastro sem sessão mostra um aviso persistente para confirmar o e-mail, com Abrir Gmail, reenviar e corrigir endereço. Outros provedores continuam funcionando: Gmail é apenas um atalho. O aviso dura até 24 horas na mesma aba. Login inválido mostra erro no formulário. Recuperação abre um formulário próprio, confirma a solicitação sem revelar se a conta existe e permite definir e confirmar a nova senha pelo link recebido.

Depois da sincronização do GitHub, aplicar pelo ambiente autorizado do Lovable/Supabase, em ordem:

1. `supabase/migrations/20261005222500_upload_limits.sql`, se ainda pendente da atualização anterior.
2. `supabase/migrations/20261006033000_private_chat_and_replies.sql`.
3. `supabase/migrations/20261006034000_proof_security.sql`.
4. Publicar a versão atualizada no Lovable.

As migrações foram verificadas em banco local isolado; isso não aplica mudanças ao banco publicado. O chat novo depende das migrações. Conferir no provedor de autenticação: confirmação de e-mail habilitada, remetente/SMTP, URL pública do site e URLs de retorno `/auth` e `/reset-password`. Se a confirmação estiver desabilitada e o cadastro já retornar sessão, a tela informa que a conta está pronta, sem fingir que enviou uma confirmação.

## Componentes e fluxo de autenticação

| Componente                                        | Responsabilidade                                                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/auth.tsx`                             | Cadastro, login por senha, provedores sociais, reenvio e solicitação de recuperação.                                       |
| `src/routes/reset-password.tsx`                   | Valida acesso ao fluxo, compara as senhas e chama `updateUser`.                                                            |
| `src/lib/auth-feedback.ts`                        | Traduz erros e guarda somente o e-mail do aviso temporário.                                                                |
| `src/integrations/supabase/client.ts`             | Cliente público, persistência da sessão e renovação automática.                                                            |
| `src/integrations/supabase/previewAuthStorage.ts` | Usa armazenamento local fora do preview; no preview integrado, compartilha sessão apenas com origens de editor permitidas. |
| `src/hooks/useAuth.ts`                            | Observa sessão e consulta perfil/papel administrativo.                                                                     |
| `src/routes/_authenticated/route.tsx`             | Consulta `getUser` antes de abrir rotas autenticadas.                                                                      |
| `src/integrations/supabase/auth-middleware.ts`    | Recebe Bearer token, valida claims e cria cliente com identidade do usuário para funções de servidor.                      |
| Migrações em `supabase/migrations`                | RLS, permissões, validação de mensagens e comprovações no banco.                                                           |

Login chama Supabase Auth; o provedor valida as credenciais e devolve a sessão. O SDK persiste os tokens e renova o acesso. Requisições de dados seguem com o token do participante; o banco decide o acesso por `auth.uid()` e pelas políticas RLS. A checagem visual de rota complementa essas políticas, mas não substitui a autorização no banco.

Senhas ficam apenas no formulário até o envio ao provedor e não são gravadas pelo código de aviso. Tokens da sessão são administrados pelo SDK no armazenamento do navegador; não são cookies HttpOnly. Isso torna a prevenção de XSS relevante. O novo chat renderiza texto como conteúdo React, sem interpretar HTML fornecido por participantes. A chave publicável identifica o projeto e não é uma senha administrativa. `SUPABASE_SERVICE_ROLE_KEY` fica no servidor e ignora RLS: seu uso exige validação prévia. Em `src/lib/chat-media.functions.ts`, o RPC autenticado filtra comprovações aprovadas e com consentimento antes de o servidor gerar links assinados de 600 segundos.

## Privacidade e integridade verificadas

A leitura direta das mensagens continua restrita ao remetente e destinatário. A aba administrativa acrescenta uma exceção para casos de violação das regras, com login de administrador, senha adicional e motivo auditado. Operadores com acesso privilegiado ao banco continuam tendo acesso técnico. Não há criptografia de ponta a ponta.

O banco bloqueia remetente falsificado, conversa consigo mesmo, participantes inativos, corpo vazio/excessivo, respostas de outra conversa, alteração/exclusão pelo cliente e envio repetido em menos de um segundo. O diretório retorna nome, identificador e avatar, sem e-mail. Respostas do chat geral guardam referência, sem copiar permanentemente o texto de uma mensagem ocultada.

A revisão encontrou possibilidade de excluir arquivos de comprovações já confirmadas. A nova política impede essa exclusão e restringe novos uploads a envios próprios elegíveis, dentro do período do desafio e com evento aberto. A confirmação exige registros de arquivos presentes no armazenamento e os tipos exigidos pelo desafio. Essa checagem verifica existência e metadados; não substitui a análise humana do conteúdo ou antivírus.

## Capacidade para 500 acessos simultâneos

**Ainda não certificada.** Contas cadastradas, visitantes e participantes simultâneos conversando/enviando vídeos geram cargas diferentes. Não houve teste de carga no site publicado nem acesso às quotas contratadas, configuração de e-mail ou métricas reais de banco/hospedagem.

O código usa páginas de 40 mensagens, índices de conversa, cache e agrupamento de atualizações. Somente a aba de chat ativa mantém sua assinatura de atualizações. No privado, a atualização periódica é de 60 segundos quando conectado e 20 segundos como alternativa; eventos antecipam a leitura. O chat geral agrupa atualizações e não recria links de mídia a cada mensagem de texto.

Ainda há limites: a caixa de entrada consulta o histórico para obter a última mensagem de cada conversa, páginas já carregadas podem ser consultadas novamente e o chat geral distribui cada evento a todos os conectados. Para histórico grande, medir essas consultas e considerar uma tabela de conversas com último evento. Vídeos de até 100 MB exigem orçamento de armazenamento/tráfego: 500 uploads desse tamanho representam aproximadamente 50 GB, antes de downloads.

A documentação oficial consultada em 06/10/2026 informa 200 conexões simultâneas de Realtime no Free e 500 no Pro padrão; 500 participantes deixam o Pro padrão sem margem para abas extras. A mesma tabela informa 100 e 500 mensagens por segundo, respectivamente. Um evento distribuído a 500 clientes pode consumir cerca de 500 entregas. Esses valores são referência do Supabase, não confirmação do plano/configuração do Lovable Cloud deste projeto.

O provedor padrão de e-mail do Supabase tem limite documentado de 2 e-mails/hora. Para cadastro em escala, verificar o provedor efetivo e suas quotas. Limites de autenticação por IP também importam quando muitas pessoas usam o mesmo Wi-Fi. Não desabilitar as proteções para contornar limites: configurar capacidade e distribuição de inscrições adequadas.

Para validar 500 ou mais: usar um ambiente de homologação com as mesmas configurações e dados sintéticos; aumentar 50 → 100 → 250 → 500 participantes, medir por pelo menos 15 minutos por estágio, incluindo login, navegação, chat, reconexão e uploads representativos. Medir latência p95, erros, CPU/banco, conexões/eventos Realtime, tráfego e filas de e-mail. Definir metas antes do teste (por exemplo, menos de 1% de erros e p95 abaixo de 2 segundos para operações de texto). Esses números são critérios propostos, não resultados obtidos.

Referências oficiais:

- https://supabase.com/docs/guides/realtime/limits
- https://supabase.com/docs/guides/auth/rate-limits

## Verificação reproduzível

`npx tsc --noEmit` e `npm run build` verificam tipos e geração de produção. ESLint foi aplicado aos componentes alterados.

Os testes `tests/chat-permissions.mjs` e `tests/proof-security.mjs` usam PostgreSQL isolado via PGlite. Instalar `@electric-sql/pglite` em um diretório temporário e apontar `PGLITE_MODULE` para seu `dist/index.js`; executar cada arquivo com Node. Eles cobrem 16 cenários de chat e 8 cenários de comprovações, sem acessar dados de participantes reais.

`tests/chat-auth-ui.cjs` usa Playwright, um servidor local em `TEST_URL` (padrão `http://127.0.0.1:5173`) e respostas de Supabase simuladas. Informar `PLAYWRIGHT_MODULE` e `CHROMIUM_PATH` se não estiverem disponíveis normalmente. O teste não envia e-mails reais nem cria contas. As credenciais de teste são fictícias. Entrega real de e-mail, Realtime em produção e limites do serviço precisam de verificação após a ativação.

## Consulta administrativa por violação das regras

A aba **Painel → Conversas privadas** exige papel de administrador, senha adicional e justificativa de 10 a 500 caracteres. Consulta somente para leitura, paginada em 50 itens; o PIN e o texto das mensagens não são copiados para a auditoria. A interface bloqueia após cinco minutos ou ao ocultar a aba. O servidor verifica papel e senha em cada chamada POST e marca a resposta como não armazenável. Cinco tentativas incorretas bloqueiam o administrador por 15 minutos, persistidas no banco. Não há nova política de leitura irrestrita para administradores na tabela original.

Ativação: aplicar **drizzle/migrations/0004_admin_private_chat_review.sql** pelo fluxo de migrações do projeto, configurar o segredo de servidor **ADMIN_CHAT_PIN** com o valor informado pelo proprietário e publicar. Não usar variável com prefixo VITE nem inserir a senha no código, documentação ou GitHub. O segredo não foi configurado remotamente por esta alteração: sem ele a área permanece bloqueada. A migração depende do chat privado já criado.

O aviso aos participantes aparece em texto de 10 px, abaixo do cabeçalho: “Os administradores podem ter acesso às conversas privadas em casos de violação das regras.” A justificativa é declarada pelo administrador, não há verificação automática de que ocorreu uma violação; a auditoria permite revisar o uso.

`tests/admin-chat-permissions.mjs` verifica isolamento da função privilegiada, bloqueio persistente, justificativa e auditoria em PostgreSQL isolado. `tests/admin-chat-ui.cjs` verifica acesso de participante/administrador e falha fechada com respostas simuladas, sem usuários ou consultas reais.

## Desafios: lembretes, links e primeira foto

Aplicar, em ordem, `drizzle/migrations/0005_challenge_reminders.sql` e
`drizzle/migrations/0006_first_photo_bonus.sql` pelo fluxo de migrações do projeto.
Não reaplicar os SQLs manualmente se o journal já os executou. As migrações foram
validadas em banco de teste; sua aplicação no ambiente Lovable depende do deploy.

- Os desafios abertos aparecem antes dos programados e encerrados, com borda,
  selo **Aberto agora** e os prazos mais próximos primeiro. O encerramento do evento
  remove o destaque de aberto. Nenhum prazo foi estendido.
- **Compartilhar desafio** abre o compartilhamento nativo quando disponível; usa
  cópia do link como alternativa e exibe um campo selecionável se a cópia falhar.
  Compartilha somente a rota do desafio, sem credenciais ou arquivos privados.
  O acesso continua autenticado e o login preserva o UUID do desafio de destino.
  Para confirmação de e-mail/OAuth, a lista de redirects permitidos deve incluir
  a rota `/auth` do domínio publicado, inclusive seu parâmetro `challenge`.
- **Lembrar-me** salva a preferência por conta no banco. Desafios futuros geram
  aviso quando abrem; os já abertos, nos últimos dez minutos. A consulta do sino,
  a cada minuto enquanto o site está ativo e ao retornar ao site, entrega o aviso
  uma única vez. O usuário precisa abrir o site antes do encerramento. Não é push,
  cron, e-mail nem garantia de aviso com o navegador fechado. A data atual do
  desafio é consultada na entrega, respeitando remarcação/cancelamento/fechamento.
  RLS protege a leitura e RPCs derivam a identidade de `auth.uid()`; não recebem
  um usuário de destino informado pelo cliente. `FOR UPDATE SKIP LOCKED` impede
  entrega duplicada entre abas. Falta de migração mantém o sino antigo e apresenta
  indisponibilidade no botão, sem fingir que salvou o lembrete.
- **Bônus pela primeira foto válida**: valor inteiro editável de 0 a 10.000 no painel
  de desafios; 0 desativa. Novos desafios sugerem +10; existentes permanecem com 0
  até decisão da organização, para não alterar silenciosamente regras anunciadas.
  A ordem usa o recebimento do arquivo no servidor, não o relógio do participante
  nem a ordem de aprovação. Uma submissão vazia não reserva a primeira colocação.
  Em reenvios vale o horário do novo envio, quando posterior à foto. Empates usam
  o UUID da submissão como desempate determinístico. Fotos anteriores pendentes
  precisam ser avaliadas: se aprovadas, ganham; se rejeitadas, liberam o próximo
  envio válido. O bônus é único por desafio, registrado em transação de pontos,
  notificação e auditoria. Pontos normais continuam dependendo de aprovação manual
  e de todas as comprovações exigidas. Alterar o valor após concedido não recalcula
  o bônus já pago; correções seguem o ajuste de pontos administrativo.

Validação: `tests/challenge-features.mjs` aplica as migrações e verifica RLS,
entrega única, cancelamento, encerramento, ordem de aprovação invertida, rejeição,
reserva vazia, relógio adulterado e bloqueio de aprovação sem arquivos. Executar
com `PGLITE_MODULE` apontando para uma instalação de `@electric-sql/pglite`.

### Opção de fotos no chat por desafio

A migração `0007_challenge_chat_photos.sql` adiciona `share_photos_in_chat`.
O painel de criação/edição oferece **Mostrar fotos deste desafio no chat geral**,
inicialmente desligado nos novos desafios. Desafios existentes preservam a
permissão anterior, que já exigia autorização individual e aprovação. O participante
vê a opção de autorizar suas fotos somente se o desafio permitir. A política de
inserção rejeita autorizações quando a opção está desligada. A RPC de leitura
exige simultaneamente opção ligada, autorização do autor, aprovação e ausência de
ocultação pela organização; retorna somente imagens, sem vídeos. Desligar impede
novas leituras pelo chat. Fotos já carregadas podem permanecer na tela até a
atualização e URLs assinadas anteriormente continuam válidas por até dez minutos.
Os arquivos de comprovação permanecem em armazenamento privado.
