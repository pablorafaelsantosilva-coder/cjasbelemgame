# Otimização e navegação pelo logo

## Resultado esperado
- Ao tocar no logo, quem está dentro do jogo volta para a tela inicial dos desafios; na tela de acesso, o logo leva à página inicial pública.
- Páginas mais leves e fluidas, mantendo o fundo de montanhas, as animações essenciais e a atualização do ranking e das notificações.

## Implementação
1. Tornar o logo da tela de acesso clicável. Manter o logo do cabeçalho ligado ao início dos desafios e adicionar identificação acessível ao link; na página inicial pública, o logo pode permanecer como elemento visual da própria página.
2. Reduzir trabalho desnecessário nas telas de desafios: atualizar o relógio apenas quando existir contagem regressiva visível e evitar atualizações contínuas quando a aba não estiver ativa, preservando a precisão dos desafios relâmpago.
3. Diminuir requisições repetidas entre páginas usando o cache já existente para dados compartilhados, sem atrasar validações, pontuação, ranking ou notificações; conservar a atualização automática das telas abertas.
4. Ajustar carregamento das imagens secundárias e das prévias de fotos/vídeos para que não prejudiquem a primeira visualização, sem perder qualidade perceptível nem os controles de reprodução.

## Verificação
- Testar cliques no logo, navegação e atualização de contadores, ranking e notificações em computador e celular.
- Conferir erros e carregamento antes e depois; não alterar regras de pontuação, autenticação ou permissões.

## Detalhes técnicos
- Usar `Link` nas rotas existentes (`/dashboard` e `/`) e otimizações pontuais em hooks, consultas com TanStack Query e mídia. Não criar novas páginas nem modificar o banco de dados.
