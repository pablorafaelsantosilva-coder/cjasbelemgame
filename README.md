# Belém Challenge Hub

CJAS BELÉM GAME — PROMPT V2 PARA LOVABLE

Crie uma aplicação web completa chamada CJAS Belém Game.

NÃO quero apenas um protótipo visual ou uma landing page.

Quero uma plataforma de jogo gamificada funcional, com frontend, backend, autenticação, banco de dados, armazenamento de fotos/vídeos, painel administrativo, sistema de desafios, agendamento automático, validação manual das atividades, pontuação e ranking.

A aplicação será utilizada em um evento de 4 dias, com aproximadamente 300 participantes.

A plataforma deve ser preparada para que vários participantes possam utilizar o sistema simultaneamente.

1. OBJETIVO DO SISTEMA

O CJAS Belém Game é um jogo baseado em desafios.

Durante os quatro dias do evento, os participantes receberão atividades.

O participante deverá:

Entrar na plataforma.

Visualizar os desafios disponíveis.

Realizar o desafio.

Enviar uma foto ou vídeo como comprovação.

Aguardar a análise da organização.

Receber a confirmação ou rejeição.

Receber os pontos somente após a confirmação.

Acompanhar sua posição no ranking.

O administrador terá controle completo sobre os desafios, participantes, comprovações, pontuação e ranking.

2. REGRA MAIS IMPORTANTE

NUNCA considerar uma atividade como válida apenas porque o participante enviou uma foto ou vídeo.

Existem três estados principais:

🔴 PENDENTE

O participante ainda não enviou a atividade.

🟢 ENVIADO / AGUARDANDO VALIDAÇÃO

O participante enviou a comprovação.

A atividade ainda NÃO vale pontos.

🔵 CONFIRMADO

O administrador analisou e aprovou a comprovação.

Somente nesse momento os pontos são adicionados.

Também existir um estado:

❌ REJEITADO

O administrador rejeitou a comprovação.

Nenhum ponto é concedido.

3. TIPOS DE USUÁRIO

Criar sistema de permissões baseado em função.

PARTICIPANTE

Pode:

Criar conta/login.

Editar seu perfil.

Ver seus desafios.

Enviar fotos.

Enviar vídeos.

Ver suas atividades.

Ver suas pontuações.

Ver ranking.

Ver suas conquistas.

Ver suas próprias memórias/fotos.

Receber notificações.

Não pode:

Ver dados privados de outros participantes.

Confirmar atividades.

Alterar pontuação.

Criar desafios.

Acessar o painel administrativo.

ADMINISTRADOR

Pode:

Gerenciar participantes.

Criar desafios.

Programar desafios.

Criar desafios relâmpago.

Definir pontuação.

Definir horários.

Definir regras de comprovação.

Ver fotos e vídeos enviados.

Confirmar atividades.

Rejeitar atividades.

Ver ranking.

Ajustar pontuação quando necessário.

Gerenciar notificações.

Ver estatísticas.

Ver histórico/auditoria.

Gerenciar configurações do evento.

4. AUTENTICAÇÃO

Criar autenticação real.

Páginas:

Login

Cadastro

Recuperação de senha

Perfil

Logout

O sistema deve proteger as rotas.

Se um participante tentar acessar uma URL administrativa, bloquear o acesso.

Se um administrador entrar, direcionar para o painel administrativo.

5. BANCO DE DADOS

Criar estrutura de banco de dados relacional.

Tabelas principais:

users

Campos:

id

nome

email

senha/autenticação segura

foto_perfil

role

status

created_at

updated_at

challenges

Campos:

id

titulo

descricao

instrucoes

pontos

tipo

data_inicio

horario_inicio

data_fim

horario_fim

foto_obrigatoria

video_obrigatorio

publico

status

created_at

updated_at

Tipos:

normal

relampago

Status:

rascunho

agendado

ativo

encerrado

cancelado

challenge_submissions

Campos:

id

challenge_id

user_id

status

submitted_at

reviewed_at

reviewed_by

rejection_reason

created_at

updated_at

Status:

pending

submitted

confirmed

rejected

submission_files

Campos:

id

submission_id

file_url

file_type

file_size

created_at

points_transactions

Registrar cada alteração de pontuação.

Campos:

id

user_id

challenge_id

points

type

description

created_at

created_by

notifications

Campos:

id

user_id

title

message

type

read

created_at

achievements

Campos:

id

name

description

icon

criteria

user_achievements

Relacionar participantes e conquistas.

audit_logs

Registrar ações administrativas importantes.

Campos:

id

admin_id

action

entity_type

entity_id

details

created_at

6. SEGURANÇA DO BANCO

Implementar controle de acesso adequado.

Um participante só pode:

Ler seus próprios dados.

Ler seus próprios envios.

Criar seus próprios envios.

Ver seus próprios arquivos.

Ver informações públicas necessárias ao ranking.

Um participante NÃO pode consultar diretamente dados privados de outros usuários.

Administradores autorizados podem acessar os dados necessários para a organização.

7. DASHBOARD DO PARTICIPANTE

Criar uma interface muito bonita.

A tela inicial deve mostrar:

Cabeçalho

Logo/nome CJAS Belém Game

Foto do usuário

Nome

Sino de notificações

Cards principais

⭐ Meus pontos

🏆 Minha posição

🎯 Desafios disponíveis

📸 Memórias

8. DESAFIOS DO DIA

Criar uma seção:

🎯 DESAFIOS DE HOJE

Cada desafio aparece em um card.

Mostrar:

Título

Descrição

Pontos

Horário

Prazo

Tipo de comprovação

Status

Exemplo:

🎯 Faça 5 novos amigos

Complete a atividade seguindo as instruções.

+100 pontos

📸 Foto obrigatória

Status:

🔴 Não realizado

Botão:

REALIZAR DESAFIO

9. ENVIO DE COMPROVAÇÃO

Ao clicar em realizar desafio, abrir página/modal:

ENVIAR COMPROVAÇÃO

Mostrar as instruções.

Permitir:

Tirar foto pelo celular.

Escolher foto da galeria.

Gravar vídeo.

Escolher vídeo.

Enviar arquivo.

Mostrar preview antes do envio.

Botão:

ENVIAR COMPROVAÇÃO

Depois do envio:

✅ Comprovação enviada!

Sua atividade está aguardando validação da organização.

Alterar automaticamente para:

🟢 AGUARDANDO VALIDAÇÃO

Impedir múltiplos envios desnecessários.

Se o administrador rejeitar, permitir novo envio somente se a configuração da atividade permitir.

10. DESAFIO RELÂMPAGO

Criar um tipo especial de desafio:

⚡ DESAFIO RELÂMPAGO

O administrador pode programá-lo antecipadamente.

Exemplo:

Título:
Desafio Surpresa

Data:
Dia 2

Início:
15:30

Fim:
16:00

Pontos:
300

Comprovação:
Vídeo obrigatório

Quando chegar 15:30:

O desafio deve aparecer automaticamente para os participantes.

Mostrar:

⚡ DESAFIO RELÂMPAGO ATIVO!

E um contador:

29:59

Quando chegar ao horário final:

🔒 DESAFIO ENCERRADO

Não aceitar novas submissões depois do horário final.

As submissões feitas dentro do período continuam disponíveis para validação administrativa.

11. AGENDAMENTO DE DESAFIOS

O administrador precisa conseguir preparar o jogo inteiro antes do evento.

Por exemplo:

DIA 1

09:00 — Desafio A — 100 pontos

12:00 — Desafio B — 150 pontos

18:00 — Relâmpago — 300 pontos

DIA 2

08:00 — Desafio C — 100 pontos

15:30 — Relâmpago — 250 pontos

DIA 3

...

DIA 4

...

O sistema deve publicar automaticamente os desafios conforme data e horário.

12. CRIADOR DE DESAFIOS

No painel:

+ CRIAR DESAFIO

Campos obrigatórios:

Título

Descrição

Instruções

Pontuação

Data de início

Horário de início

Data de encerramento

Horário de encerramento

Tipo de desafio

Foto obrigatória

Vídeo obrigatório

Campos opcionais:

Público específico

Grupo específico

Quantidade máxima de participantes

Regras adicionais

Texto de orientação

Permitir salvar como:

RASCUNHO

ou

PROGRAMAR

13. CALENDÁRIO ADMINISTRATIVO

Criar calendário visual dos quatro dias.

Cada atividade deve aparecer no calendário.

Cores:

Rascunho

Programado

Ativo

Encerrado

Cancelado

Ao clicar em uma atividade, abrir seus detalhes.

Permitir:

Editar

Duplicar

Cancelar

Reprogramar

Visualizar resultados

14. PAINEL DE VALIDAÇÃO

Criar uma área chamada:

🔔 CENTRAL DE APROVAÇÕES

Mostrar todas as atividades enviadas e ainda não analisadas.

Exemplo:

João Silva

Desafio:
"Faça 5 novos amigos"

Status:

🟢 Aguardando validação

Botão:

ANALISAR

Ao abrir:

Nome do participante

Foto do participante

Nome do desafio

Descrição

Data/hora do envio

Foto

Vídeo

Arquivos enviados

Botões:

🔵 CONFIRMAR ATIVIDADE

❌ REJEITAR

15. CONFIRMAÇÃO

Quando o administrador clicar em confirmar:

Alterar status para confirmed.

Registrar administrador responsável.

Registrar data/hora.

Criar transação de pontos.

Atualizar pontuação total.

Atualizar ranking.

Criar notificação para participante.

Exemplo de notificação:

🎉 Atividade confirmada!

Você recebeu +100 pontos.

16. REJEIÇÃO

Ao rejeitar:

Solicitar motivo.

Opções:

Comprovação insuficiente.

Arquivo não corresponde à atividade.

Atividade não realizada.

Arquivo inválido.

Outro.

Permitir comentário personalizado.

Enviar notificação:

❌ Atividade não confirmada.

Motivo: Comprovação insuficiente.

17. DASHBOARD ADMINISTRATIVO

Criar um dashboard profissional.

Mostrar:

PARTICIPANTES

300

ATIVOS

Número atual

DESAFIOS PROGRAMADOS

Quantidade

AGUARDANDO VALIDAÇÃO

Quantidade

CONFIRMADOS

Quantidade

REJEITADOS

Quantidade

PONTOS DISTRIBUÍDOS

Total

Criar gráficos simples e visualmente bonitos.

18. PARTICIPANTES

Criar página:

👥 PARTICIPANTES

Tabela com:

Foto

Nome

E-mail

Pontos

Ranking

Atividades confirmadas

Atividades pendentes

Status

Adicionar busca.

Adicionar filtros:

Nome

Status

Ranking

Pontuação

Ao clicar no participante:

Abrir perfil administrativo completo.

19. PERFIL ADMINISTRATIVO DO PARTICIPANTE

Mostrar:

João Silva

Pontuação:

850 pontos

Ranking:

12º lugar

Depois mostrar:

ATIVIDADES

AtividadeStatusPontosDesafio 1🔵 Confirmado100Desafio 2🔵 Confirmado200Desafio 3🟢 Aguardando—Desafio 4🔴 Pendente—

Ao clicar em cada atividade, mostrar toda a comprovação.

20. RANKING

Criar ranking em tempo real baseado apenas em atividades confirmadas.

Mostrar:

🥇 1º

🥈 2º

🥉 3º

E demais posições.

Mostrar:

Foto

Nome

Pontos

No participante atual, destacar sua posição.

Exemplo:

Você está em 12º lugar

850 pontos

Faltam 50 pontos para o TOP 10.

21. CONQUISTAS

Criar conquistas simples.

Exemplos:

🏅 Primeiro desafio confirmado

⭐ 500 pontos

🏆 TOP 10

🎯 5 desafios confirmados

🚀 1.000 pontos

As conquistas devem aparecer no perfil do participante.

22. ÁLBUM DE MEMÓRIAS

Criar:

📸 MINHAS MEMÓRIAS

Mostrar somente fotos enviadas pelo próprio participante.

Criar carrossel visual no dashboard.

Exemplo:

Suas memórias

8 momentos registrados.

As fotos podem aparecer de forma dinâmica na página inicial.

Não mostrar automaticamente fotos privadas de outros participantes.

23. NOTIFICAÇÕES

Criar sistema de notificações com sino.

Tipos:

Novo desafio

Desafio relâmpago

Atividade enviada

Atividade confirmada

Atividade rejeitada

Pontos recebidos

Alteração no ranking

Aviso da organização

24. ATIVIDADE RELÂMPAGO PROGRAMADA

IMPORTANTE:

O administrador deve conseguir criar um desafio relâmpago hoje para acontecer amanhã.

Exemplo:

Hoje:

Criar desafio.

Configurar:

Data:
12/09/2026

Hora:
15:00

Fim:
15:20

Pontos:
500

Salvar.

O sistema deve permanecer aguardando.

Quando chegar 15:00:

Publicar automaticamente.

Não exigir que o administrador esteja conectado naquele momento.

25. DESIGN

Criar um design premium, moderno e elegante.

Paleta:

Marrom suave

Branco

Preto suave

Tons neutros

Não utilizar excesso de cores.

Usar cores fortes apenas para indicar status.

Design inspirado em aplicativos modernos de eventos e gamificação.

Utilizar:

Cards

Bordas arredondadas

Sombras suaves

Gradientes muito discretos

Animações suaves

Ícones modernos

Microinterações

Barra de progresso

Ranking visual

Contadores

O sistema deve parecer um jogo de evento, não uma planilha.

26. MOBILE FIRST

Priorizar smartphone.

O participante provavelmente utilizará o celular para:

Receber desafios

Tirar fotos

Gravar vídeos

Enviar comprovações

Consultar ranking

Receber notificações

O botão de envio de mídia deve ser extremamente simples.

No celular, permitir acesso direto à câmera/galeria quando suportado pelo navegador.

27. ARMAZENAMENTO DE ARQUIVOS

Não armazenar vídeos e fotos diretamente no banco de dados.

Utilizar armazenamento apropriado de arquivos.

Cada arquivo deve possuir:

URL segura

Tipo

Tamanho

Data

Usuário

Atividade relacionada

Criar políticas para impedir que um participante veja arquivos privados de outro.

28. DESEMPENHO

A aplicação deve ser preparada para aproximadamente 300 participantes.

Considerar:

Vários usuários conectados simultaneamente.

Vários envios de fotos.

Vários envios de vídeos.

Atualização do ranking.

Muitos acessos durante a publicação de um desafio.

O ranking e as consultas principais devem ser eficientes.

O sistema não deve recalcular dados desnecessariamente a cada acesso.

29. HISTÓRICO

Registrar eventos importantes:

Participante enviou atividade.

Administrador abriu atividade.

Administrador confirmou.

Administrador rejeitou.

Pontos adicionados.

Desafio criado.

Desafio editado.

Desafio cancelado.

Desafio publicado automaticamente.

Isso deve ficar disponível para auditoria administrativa.

30. CONFIGURAÇÕES DO EVENTO

Criar página:

⚙️ CONFIGURAÇÕES

Permitir configurar:

Nome do evento

Logo

Data inicial

Data final

Quantidade de dias

Regras

Pontuação

Configurações de upload

Limites de arquivo

Mensagens da organização

O evento padrão será:

CJAS Belém Game

Duração:

4 dias

31. REGRAS DE PONTUAÇÃO

Criar sistema de transações.

Nunca simplesmente sobrescrever a pontuação sem registrar o motivo.

Exemplo:

João:

+100 — Desafio 1 confirmado

+200 — Desafio 2 confirmado

+300 — Desafio relâmpago confirmado

Total:

600 pontos

Se um administrador precisar corrigir pontos, registrar:

Valor

Motivo

Administrador

Data/hora

32. EXPERIÊNCIA DE CONFIRMAÇÃO

Quando o participante receber a confirmação:

Mostrar uma animação discreta:

🎉 DESAFIO CONFIRMADO!

+100 PONTOS

Atualizar:

Pontuação

Ranking

Conquistas

A experiência deve ser satisfatória, mas sem exagerar nas animações.

33. ENCERRAMENTO DO EVENTO

Como o jogo terá somente quatro dias, criar um modo de encerramento.

Após o último dia:

Impedir novos desafios.

Encerrar atividades abertas conforme configuração.

Manter ranking disponível.

Mostrar classificação final.

Mostrar conquistas.

Mostrar álbum de memórias.

Página final:

🏆 RESULTADO FINAL

Mostrar ranking final.

34. RESPONSIVIDADE DO ADMINISTRADOR

O painel administrativo também deve funcionar no celular.

O administrador deve conseguir:

Ver atividades pendentes.

Abrir vídeos.

Confirmar.

Rejeitar.

Criar desafios.

Programar desafios.

Consultar ranking.

Tudo pelo celular ou computador.

35. NÃO FAZER

Não criar:

Sistema de pagamento.

Assinatura.

Loja.

Chat privado entre participantes.

Sistema complexo de amizades.

Sequência semanal.

Sequência mensal.

Recursos que não sejam necessários para o jogo de quatro dias.

Manter o sistema focado no evento.

36. ENTREGA

Antes de considerar o projeto concluído, verificar se todos estes fluxos estão funcionando:

PARTICIPANTE

Cadastro → Login → Dashboard → Ver desafio → Realizar → Enviar mídia → Aguardar → Receber confirmação → Ganhar pontos → Ranking.

ADMINISTRADOR

Login → Dashboard → Criar desafio → Definir pontos → Programar → Publicação automática → Receber comprovação → Visualizar mídia → Confirmar/Rejeitar → Atualizar pontos → Atualizar ranking.

DESAFIO RELÂMPAGO

Criar hoje → Programar para amanhã → Sistema aguarda → Publica automaticamente → Contador → Encerra automaticamente → Envia comprovações para validação.

37. PRIORIDADE DE DESENVOLVIMENTO

Desenvolver nesta ordem:

Autenticação

Banco de dados

Usuários e permissões

Dashboard do participante

Sistema de desafios

Upload de mídia

Dashboard administrativo

Sistema de validação

Pontuação

Ranking

Agendamento

Desafios relâmpago

Notificações

Conquistas

Álbum de memórias

Estatísticas

Auditoria

Refinamento visual

Não sacrificar funcionalidades reais para criar apenas uma interface bonita.

38. RESULTADO ESPERADO

O resultado final deve ser uma plataforma chamada:

CJAS BELÉM GAME

Com aparência profissional e moderna, mas principalmente com funcionalidade real.

O administrador deve conseguir preparar todo o jogo antecipadamente e controlar tudo durante os quatro dias.

O participante deve ter uma experiência simples:

ENTRAR → VER → FAZER → ENVIAR → AGUARDAR → GANHAR PONTOS → SUBIR NO RANKING.

A organização deve ter:

CRIAR → PROGRAMAR → RECEBER → ANALISAR → CONFIRMAR → CONTROLAR.

Construir o projeto de forma modular e organizada para que novas funcionalidades possam ser adicionadas posteriormente sem precisar refazer toda a aplicação.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cjasbelemgame.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4f7d0823-327a-46b8-a71b-786df2a1f5db).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
