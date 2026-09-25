# Revisão geral, desempenho e navegação pelo logo

## Resultado esperado
- Ao tocar no logo, quem está dentro do jogo volta para a tela inicial dos desafios; na tela de acesso, o logo leva à página inicial pública.
- Páginas mais leves e fluidas, com erros importantes corrigidos e fluxos completos, mantendo o visual do evento e a atualização do jogo.

## Implementação
1. Tornar o logo da tela de acesso clicável. Manter o logo do cabeçalho ligado ao início dos desafios e adicionar identificação acessível ao link; na página inicial pública, o logo pode permanecer como elemento visual da própria página.
2. Corrigir o fluxo de reenvio: hoje a tela tenta inserir outra comprovação para o mesmo desafio, mas o banco só permite uma por participante. Tratar arquivos, estado e validação de forma consistente, inclusive erros durante o envio.
3. Fazer o encerramento do evento bloquear novos envios de verdade, inclusive tentativas fora da interface; hoje a opção aparece nas configurações, mas o bloqueio não está imposto no banco.
4. Revisar as permissões das comprovações e dados do perfil para impedir alterações indevidas de status, dono ou pontos por chamadas diretas, preservando a validação exclusiva da organização.
5. Reduzir trabalho desnecessário nas telas de desafios e requisições repetidas, sem atrasar ranking, notificações e desafios relâmpago. Ajustar carregamento de mídia secundária sem perda visual relevante.
6. Corrigir problemas confirmados em navegação, estados de carregamento/erro e acessibilidade que a revisão encontrar, sem redesenhar as telas nem adicionar funcionalidades alheias ao jogo.

## Verificação
- Testar cliques no logo, cadastro/acesso, envio e reenvio, validação, encerramento, ranking e notificações em computador e celular.
- Verificar desempenho, erros e regras de acesso após as correções, sem alterar a pontuação prevista para os desafios.

## Detalhes técnicos
- Usar `Link` nas rotas existentes (`/dashboard` e `/`), otimizações pontuais em consultas e mídia e uma migração específica para impor as regras de envio e permissões no banco. Não criar páginas novas.
