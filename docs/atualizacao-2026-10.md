# Atualização de autenticação, administração e mídias

- Cadastro sem sessão e login com `email_not_confirmed` mostram aviso persistente, endereço de destino e reenvio de confirmação com intervalo de 60 segundos.
- A aba Desafios permite editar título, descrição, instruções, pontos, datas, tipo, exigências, público, regras e situação, inclusive com o evento encerrado. Os pontos já concedidos não são recalculados.
- A aba Usuários inclui busca por nome/e-mail, status, ordenação e páginas de 20 registros.
- O perfil inclui o Instagram @prafaelsants.
- As galerias renovam links privados, permitem tentar novamente e abrir fotos/vídeos em tela cheia. Formatos não suportados pelo navegador têm link para o original.
- Uploads parciais preservam arquivos concluídos e permitem complementar comprovações ainda em análise. Envios confirmados não podem ser alterados.

## Aplicação no ambiente Lovable/Supabase

O código na branch conectada sincroniza com o editor Lovable. A publicação do site e a aplicação das migrações precisam ser confirmadas no ambiente de hospedagem.

Aplicar `supabase/migrations/20261005222500_upload_limits.sql` no banco do projeto. A migração aumenta o limite do bucket privado `proofs` para 100 MB e o limite padrão do evento de 50 para 100 MB. Não muda a visibilidade nem as políticas de acesso dos arquivos. O limite global do Storage/plano também precisa aceitar 100 MB; a migração não altera esse limite global.

Em Admin → Configurações, o organizador pode escolher de 1 a 100 MB por arquivo. O limite do evento é validado no frontend; o teto do bucket é aplicado pelo Storage.

## Verificação funcional após publicar

1. Criar conta com confirmação de e-mail habilitada, verificar o aviso e testar reenvio.
2. Editar um desafio com evento aberto e com evento fechado; confirmar que novos envios continuam bloqueados no evento fechado.
3. Buscar e filtrar usuários; abrir uma foto e um vídeo na central de validações.
4. Simular falha de rede no segundo arquivo e completar o envio sem reenviar o primeiro.
5. Confirmar upload de arquivo entre 50 e 100 MB após aplicar a migração e conferir a configuração global.

Nenhuma conta de participante real foi criada nem mídia real alterada durante a revisão local.
